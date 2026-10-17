Shader "ElementHabitat/Shield"
{
    Properties { _BaseColor("Color",Color)=(.42,.82,.88,.3) _Motion("Ambient motion",Float)=1 }
    SubShader
    {
        Tags { "RenderType"="Transparent" "RenderPipeline"="UniversalPipeline" "Queue"="Transparent" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha ZWrite Off Cull Back
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor; half _Motion;
            CBUFFER_END
            struct Attributes { float4 positionOS:POSITION;float3 normalOS:NORMAL; };
            struct Varyings {float4 positionCS:SV_POSITION;float3 positionWS:TEXCOORD0;float3 normalWS:TEXCOORD1;};
            Varyings vert(Attributes v) {Varyings o;VertexPositionInputs p=GetVertexPositionInputs(v.positionOS.xyz);o.positionCS=p.positionCS;o.positionWS=p.positionWS;o.normalWS=TransformObjectToWorldNormal(v.normalOS);return o;}
            half4 frag(Varyings i):SV_Target
            {
                float3 n=normalize(i.normalWS),view=GetWorldSpaceNormalizeViewDir(i.positionWS);
                float rim=pow(1-saturate(dot(n,view)),2);
                float2 p=float2(i.positionWS.x+i.positionWS.y*.3,i.positionWS.z)*8;
                const float2 r=float2(1,1.7320508);
                float2 a=p-r*floor(p/r)-r*.5;
                float2 b=(p-r*.5)-r*floor((p-r*.5)/r)-r*.5;
                float2 q=dot(a,a)<dot(b,b)?a:b;
                float d=max(abs(q.x),dot(abs(q),float2(.5,.8660254)));
                float hexEdge=smoothstep(.425,.47,d);
                float sweep=pow(max(0,1-abs(frac(i.positionWS.y*.9)-frac(_Time.y*.18))/.08),2)*_Motion;
                half alpha=saturate((.022+rim*.30+hexEdge*.075+sweep*.045)*_BaseColor.a*2.8);
                return half4(_BaseColor.rgb*(1+rim*.55+hexEdge*.12),alpha);
            }
            ENDHLSL
        }
    }
}
