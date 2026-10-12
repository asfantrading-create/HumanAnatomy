// Floor disc with a soft glow and a polar grid (built-in pipeline, VR ready).
Shader "Anatomy/Floor"
{
    Properties
    {
        _Glow ("Glow", Color) = (0.30, 0.79, 0.94, 0.28)
        _Line ("Grid", Color) = (0.17, 0.29, 0.42, 0.8)
        _Radius ("Radius", Float) = 6
    }
    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent-100" }
        Pass
        {
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Off
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"
            fixed4 _Glow, _Line;
            float _Radius;
            struct appdata { float4 vertex : POSITION; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos : SV_POSITION; float2 p : TEXCOORD0; UNITY_VERTEX_OUTPUT_STEREO };
            v2f vert(appdata v)
            {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.pos = UnityObjectToClipPos(v.vertex);
                o.p = v.vertex.xz;
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                float r = length(i.p);
                float glow = saturate(1.0 - r / 0.8);
                float4 c = float4(_Glow.rgb, _Glow.a * glow * glow);
                // rings every 0.5 m and 16 spokes
                float ring = abs(frac(r / 0.5 + 0.5) - 0.5) * 0.5 / max(fwidth(r), 1e-4);
                float ang = atan2(i.p.y, i.p.x) / 6.28318 * 16.0;
                float spoke = abs(frac(ang + 0.5) - 0.5) / max(fwidth(ang), 1e-4);
                float g = 1.0 - saturate(min(ring, spoke));
                float fade = saturate(1.0 - r / _Radius);
                c.rgb = lerp(c.rgb, _Line.rgb, g * _Line.a);
                c.a = max(c.a, g * _Line.a * fade);
                return c;
            }
            ENDCG
        }
    }
}
