using System;
using UnityEngine;

namespace ElementHabitat
{
    /// <summary>Native counterpart of the browser's sliding drawers and elastic dialog entry.</summary>
    public sealed class HabitatDrawerMotion : MonoBehaviour
    {
        Func<bool> reduced, bottom;
        RectTransform rect;
        CanvasGroup opacity;
        bool right, popup, resting;
        Vector2 rest,last;
        float began;
        public void Initialize(Func<bool> reducedMotion,bool fromRight,Func<bool> fromBottom=null,bool dialog=false)
        {
            reduced=reducedMotion;right=fromRight;bottom=fromBottom;popup=dialog;rect=GetComponent<RectTransform>();
            opacity=GetComponent<CanvasGroup>();if(opacity==null)opacity=gameObject.AddComponent<CanvasGroup>();began=Time.unscaledTime;
        }
        void OnEnable(){began=Time.unscaledTime;resting=false;}
        void LateUpdate()
        {
            if(rect==null)return;
            if(!resting||(rect.anchoredPosition-last).sqrMagnitude>.05f){rest=rect.anchoredPosition;resting=true;}
            float t=reduced!=null&&reduced()?1:Mathf.Clamp01((Time.unscaledTime-began)/(popup?.45f:right?.35f:.4f));
            float q=t-1,ease=1+2.25f*q*q*q+1.25f*q*q;
            if(popup)
            {
                rect.localScale=Vector3.one*(.5f+.5f*ease);last=rest+new Vector2(0,-40*(1-ease));rect.anchoredPosition=last;
            }
            else
            {
                bool vertical=bottom!=null&&bottom();var offset=vertical?new Vector2(0,-rect.rect.height-280):new Vector2((right?1:-1)*(rect.rect.width+30),0);
                last=rest+offset*(1-ease);rect.anchoredPosition=last;
                rect.localRotation=Quaternion.Euler(0,0,!right&&!vertical?-4*(1-ease):0);
            }
            if(opacity!=null)opacity.alpha=Mathf.Clamp01(t*4);
        }
        void OnDisable()
        {
            if(rect!=null){if(resting)rect.anchoredPosition=rest;rect.localScale=Vector3.one;rect.localRotation=Quaternion.identity;}
            if(opacity!=null)opacity.alpha=1;resting=false;
        }
    }
}
