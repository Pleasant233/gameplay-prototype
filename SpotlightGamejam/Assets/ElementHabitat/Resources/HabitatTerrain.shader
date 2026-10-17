Shader "ElementHabitat/Terrain"
{
    Properties { _BaseColor("Tint", Color) = (1,1,1,1) _EmissionStrength("Emission", Range(0,1)) = 0 }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }
        Pass
        {
            Name "HabitatForward"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.core/ShaderLibrary/Color.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half _EmissionStrength;
            CBUFFER_END
            struct Attributes { float4 positionOS:POSITION; float3 normalOS:NORMAL; half4 color:COLOR; };
            struct Varyings { float4 positionCS:SV_POSITION; float3 normalWS:TEXCOORD0; float3 positionWS:TEXCOORD1; half4 color:COLOR; half fog:TEXCOORD2; };
            Varyings vert(Attributes v)
            {
                Varyings o;
                VertexPositionInputs p=GetVertexPositionInputs(v.positionOS.xyz);
                o.positionCS=p.positionCS; o.positionWS=p.positionWS;
                o.normalWS=TransformObjectToWorldNormal(v.normalOS);
                // Mesh palettes are authored as sRGB hex colors. Vertex COLOR is raw data;
                // unlike a color texture it does not receive Unity's automatic sRGB decode.
                #if defined(UNITY_COLORSPACE_GAMMA)
                    o.color=v.color*_BaseColor;
                #else
                    o.color=half4(SRGBToLinear(v.color.rgb),v.color.a)*_BaseColor;
                #endif
                o.fog=ComputeFogFactor(p.positionCS.z);
                return o;
            }
            half4 frag(Varyings i):SV_Target
            {
                half3 n=normalize(i.normalWS);
                Light sun=GetMainLight(TransformWorldToShadowCoord(i.positionWS));
                half diffuse=saturate(dot(n,sun.direction));
                half3 ambient=half3(.34,.38,.40)+SampleSH(n)*.15;
                half3 light=ambient+sun.color*(diffuse*.57+.045)*lerp(.54,1,sun.shadowAttenuation);
                half3 c=i.color.rgb*light+i.color.rgb*_EmissionStrength;
                return half4(MixFog(c,i.fog),1);
            }
            ENDHLSL
        }
        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode"="ShadowCaster" }
            ZWrite On ZTest LEqual ColorMask 0 Cull Back
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
            float3 _LightDirection;
            struct Attributes { float4 positionOS:POSITION; float3 normalOS:NORMAL; };
            float4 vert(Attributes i):SV_POSITION
            {
                float3 p=TransformObjectToWorld(i.positionOS.xyz);
                float3 n=TransformObjectToWorldNormal(i.normalOS);
                float4 clip=TransformWorldToHClip(ApplyShadowBias(p,n,_LightDirection));
                #if UNITY_REVERSED_Z
                clip.z=min(clip.z,UNITY_NEAR_CLIP_VALUE);
                #else
                clip.z=max(clip.z,UNITY_NEAR_CLIP_VALUE);
                #endif
                return clip;
            }
            half4 frag():SV_Target { return 0; }
            ENDHLSL
        }
        Pass
        {
            Name "DepthOnly" Tags { "LightMode"="DepthOnly" }
            ZWrite On ColorMask R
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            struct Attributes { float4 positionOS:POSITION; };
            float4 vert(Attributes i):SV_POSITION { return TransformObjectToHClip(i.positionOS.xyz); }
            half4 frag():SV_Target { return 0; }
            ENDHLSL
        }
    }
    Fallback "Universal Render Pipeline/Lit"
}
