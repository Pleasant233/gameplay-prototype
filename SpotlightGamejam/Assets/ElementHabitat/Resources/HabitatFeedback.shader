Shader "ElementHabitat/Feedback"
{
    Properties
    {
        _BaseColor("Tint and opacity",Color)=(1,1,1,1)
        _Mode("Shape treatment",Float)=0
        _Progress("Surface wave progress",Float)=0
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "RenderPipeline"="UniversalPipeline" "Queue"="Transparent+20" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha ZWrite Off Cull Off
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half _Mode;
                half _Progress;
            CBUFFER_END
            struct Attributes { float4 positionOS:POSITION;float3 normalOS:NORMAL;half4 color:COLOR; };
            struct Varyings {float4 positionCS:SV_POSITION;float3 positionOS:TEXCOORD0;float3 positionWS:TEXCOORD1;float3 normalWS:TEXCOORD2;};
            Varyings vert(Attributes v)
            {
                Varyings o;VertexPositionInputs p=GetVertexPositionInputs(v.positionOS.xyz);o.positionCS=p.positionCS;o.positionOS=v.positionOS.xyz;o.positionWS=p.positionWS;o.normalWS=TransformObjectToWorldNormal(v.normalOS);return o;
            }
            half4 frag(Varyings i):SV_Target
            {
                half alpha=_BaseColor.a;
                if(_Mode>.5 && _Mode<1.5)
                {
                    float band=max(0,1-abs(length(i.positionOS.xz)-_Progress*.9)/.16);
                    alpha*=band*(1-_Progress);
                }
                else if(_Mode>1.5 && _Mode<2.5)
                    alpha*=smoothstep(_Progress-.05,_Progress+.05,length(i.positionOS.xz));
                else if(_Mode>2.5 && _Mode<3.5)
                    alpha*=pow(saturate(abs(dot(normalize(i.normalWS),GetWorldSpaceNormalizeViewDir(i.positionWS)))),.6);
                else if(_Mode>3.5 && _Mode<4.5)
                    alpha*=pow(1-saturate(i.positionOS.y+.5),1.4)*.7;
                else if(_Mode>4.5)
                {
                    float rim=pow(1-abs(dot(normalize(i.normalWS),GetWorldSpaceNormalizeViewDir(i.positionWS))),2);
                    float2 p=i.positionWS.xz*12+i.positionWS.y*3;
                    const float2 r=float2(1,1.7320508);
                    float2 a=p-r*floor(p/r)-r*.5,b=(p-r*.5)-r*floor((p-r*.5)/r)-r*.5;
                    float2 q=abs(dot(a,a)<dot(b,b)?a:b);
                    float edge=smoothstep(.425,.47,max(q.x,dot(q,float2(.5,.8660254))));
                    alpha*=.2+rim*.65+edge*.35;
                }
                return half4(_BaseColor.rgb*1.08,alpha);
            }
            ENDHLSL
        }
    }
}