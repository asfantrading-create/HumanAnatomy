// Object-id pass used for the on-screen labels: writes each structure's index as a colour.
// Used as a replacement shader, so _PickId comes from each structure's own material.
Shader "Anatomy/Id"
{
    Properties { _PickId ("Id", Vector) = (0, 0, 0, 0) }
    SubShader
    {
        Tags { "RenderType" = "Opaque" }
        Pass
        {
            Cull Off
            ZWrite On
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            float4 _PickId;
            float4 _AnatClip0, _AnatClip1, _AnatClip2;
            struct v2f { float4 pos : SV_POSITION; float3 wpos : TEXCOORD0; };
            v2f vert(float4 v : POSITION)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v);
                o.wpos = mul(unity_ObjectToWorld, v).xyz;
                return o;
            }
            float4 frag(v2f i) : SV_Target
            {
                if (_PickId.a < 0.5) discard;
                if (dot(_AnatClip0.xyz, i.wpos) + _AnatClip0.w < 0) discard;
                if (dot(_AnatClip1.xyz, i.wpos) + _AnatClip1.w < 0) discard;
                if (dot(_AnatClip2.xyz, i.wpos) + _AnatClip2.w < 0) discard;
                return float4(_PickId.rgb, 1);
            }
            ENDCG
        }
    }
}
