// Unlit colour for lasers, markers and the section plane (built-in pipeline, VR ready).
Shader "Anatomy/Unlit"
{
    Properties
    {
        _Color ("Color", Color) = (1, 1, 1, 1)
        [HideInInspector] _ZWrite ("", Float) = 0
        [HideInInspector] _ZTest ("", Float) = 4
    }
    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent+50" }
        Pass
        {
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite [_ZWrite]
            ZTest [_ZTest]
            Cull Off
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"
            fixed4 _Color;
            struct appdata { float4 vertex : POSITION; float4 color : COLOR; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos : SV_POSITION; float4 color : COLOR; UNITY_VERTEX_OUTPUT_STEREO };
            v2f vert(appdata v)
            {
                v2f o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_OUTPUT(v2f, o);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.pos = UnityObjectToClipPos(v.vertex);
                o.color = v.color * _Color;
                return o;
            }
            fixed4 frag(v2f i) : SV_Target { return i.color; }
            ENDCG
        }
    }
}
