// Shading of the anatomical structures (built-in render pipeline, single-pass instanced VR ready).
// Lighting comes from global values set by AnatomyApp: a key light, a fill light and a sky/ground ambient.
Shader "Anatomy/Lit"
{
    Properties
    {
        _BaseColor ("Color", Color) = (1, 1, 1, 1)
        _Emission ("Emission", Color) = (0, 0, 0, 0)
        _Gloss ("Gloss", Range(0, 1)) = 0.4
        _UseVColor ("Use vertex colour", Float) = 0
        _Muscle ("Muscle fibres", Float) = 0
        _Vessel ("Vessel type", Float) = 0
        _Clip ("Use section planes", Float) = 1
        [HideInInspector] _SrcBlend ("", Float) = 1
        [HideInInspector] _DstBlend ("", Float) = 0
        [HideInInspector] _ZWrite ("", Float) = 1
        [HideInInspector] _ZTest ("", Float) = 4
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "Queue" = "Geometry" }
        Pass
        {
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]
            ZTest [_ZTest]
            Cull Off

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.5
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"

            fixed4 _BaseColor;
            fixed4 _Emission;
            float _Gloss, _UseVColor, _Muscle, _Vessel, _Clip;

            // globals (AnatomyApp / AnatomyModel)
            float4 _AnatKeyDir, _AnatKeyColor, _AnatFillDir, _AnatFillColor, _AnatSky, _AnatGround;
            float4 _AnatClip0, _AnatClip1, _AnatClip2;   // world-space planes (xyz normal, w offset); (0,0,0,1) when off
            float _AnatSection, _AnatFlow, _AnatTime;
            float4 _AnatHeart, _AnatSA;

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
                float4 color : COLOR;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };
            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 wpos : TEXCOORD0;
                float3 wnormal : TEXCOORD1;
                float3 opos : TEXCOORD2;
                float4 color : COLOR;
                UNITY_VERTEX_OUTPUT_STEREO
            };

            v2f vert(appdata v)
            {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.pos = UnityObjectToClipPos(v.vertex);
                o.wpos = mul(unity_ObjectToWorld, v.vertex).xyz;
                o.wnormal = UnityObjectToWorldNormal(v.normal);
                o.opos = v.vertex.xyz;
                o.color = v.color;
                return o;
            }

            float hash21(float2 p) { p = frac(p * float2(123.34, 456.21)); p += dot(p, p + 45.32); return frac(p.x * p.y); }
            float vnoise(float2 p)
            {
                float2 i = floor(p), f = frac(p);
                f = f * f * (3.0 - 2.0 * f);
                return lerp(lerp(hash21(i), hash21(i + float2(1, 0)), f.x), lerp(hash21(i + float2(0, 1)), hash21(i + float2(1, 1)), f.x), f.y);
            }

            fixed4 frag(v2f i, fixed facing : VFACE) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i);
                // section planes are given in world space (AnatomyModel converts them from the body frame every frame,
                // so they follow the body when it is moved or scaled in VR)
                if (_Clip > 0.5)
                {
                    float3 bp = mul(unity_ObjectToWorld, float4(i.opos, 1)).xyz;
                    if (dot(_AnatClip0.xyz, bp) + _AnatClip0.w < 0) discard;
                    if (dot(_AnatClip1.xyz, bp) + _AnatClip1.w < 0) discard;
                    if (dot(_AnatClip2.xyz, bp) + _AnatClip2.w < 0) discard;
                }

                float3 base = _BaseColor.rgb;
                if (_UseVColor > 0.5) base = i.color.rgb;
                if (_Muscle > 0.5)
                {
                    float fib = vnoise(float2((i.opos.x + i.opos.z) * 260.0, i.opos.y * 22.0));
                    fib = fib * 0.6 + vnoise(float2((i.opos.x - i.opos.z) * 520.0, i.opos.y * 45.0)) * 0.4;
                    base *= 0.84 + 0.3 * fib;
                }

                float3 n = normalize(i.wnormal);
                bool back = facing < 0;
                if (back) n = -n;
                float3 v = normalize(_WorldSpaceCameraPos.xyz - i.wpos);

                float3 kd = normalize(_AnatKeyDir.xyz), fd = normalize(_AnatFillDir.xyz);
                float key = saturate(dot(n, kd) * 0.85 + 0.15);
                float fill = saturate(dot(n, fd));
                float3 amb = lerp(_AnatGround.rgb, _AnatSky.rgb, n.y * 0.5 + 0.5);
                float3 col = base * (amb + _AnatKeyColor.rgb * key + _AnatFillColor.rgb * fill);

                float3 h = normalize(kd + v);
                float sp = pow(saturate(dot(n, h)), lerp(12.0, 64.0, _Gloss)) * lerp(0.05, 0.35, _Gloss);
                col += _AnatKeyColor.rgb * sp;
                float rim = pow(1.0 - saturate(dot(n, v)), 3.0) * 0.12;
                col += amb * rim;

                // inner faces revealed by a section are tinted darker red
                if (back && _AnatSection > 0.5) col = lerp(col, float3(0.55, 0.12, 0.12), 0.35) * 0.65;

                if (_AnatFlow > 0.5 && _Vessel != 0)
                {
                    if (_Vessel > 1.5)
                    {
                        // cardiac conduction: a wave spreading from the sinoatrial node once per heartbeat (72 bpm)
                        float ph = frac(_AnatTime * 1.2);
                        float r = ph * 0.13;
                        float w = exp(-pow((distance(i.opos, _AnatSA.xyz) - r) / 0.01, 2.0)) * (1.0 - ph);
                        col += float3(1.0, 0.85, 0.2) * w * 1.6;
                    }
                    else
                    {
                        // pulse waves travel away from the heart in arteries and back towards it in veins
                        float d = distance(i.opos, _AnatHeart.xyz);
                        float s = _Vessel > 0 ? d * 9.0 - _AnatTime * 2.4 : d * 9.0 + _AnatTime * 1.3;
                        float w = pow(0.5 + 0.5 * sin(s * 6.2831), 8.0);
                        col += (_Vessel > 0 ? float3(1.0, 0.25, 0.15) : float3(0.25, 0.45, 1.0)) * w * 0.9;
                    }
                }
                col += _Emission.rgb;
                return fixed4(col, _BaseColor.a);
            }
            ENDCG
        }
    }
}
