using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Controls;

namespace ElementHabitat
{
    // Camera and gestures mirror the production view.js spherical controller. Unity screen
    // pixels start at the bottom left and LookAt has the opposite horizontal handedness.
    public sealed partial class HabitatBoard
    {
        readonly List<RaycastResult> uiHits=new List<RaycastResult>();
        Vector3 cameraTarget=new Vector3(0,.2f,0),cameraGoal=new Vector3(0,.2f,0),focusTarget;
        float yaw=.78f,pitch=.88f,distance=18,cameraYaw=.78f,cameraPitch=.9f,cameraDistance=13;
        float cameraIntro=1,pinchDistance,framedRadius;
        Vector2 pointerStart,pointerPrevious,lastHoverPosition;
        bool pressed,pointerBlocked,dragging,hadPinch,pointerTouch,photoCamera,hoverReported;
        int pointerButton;

        public bool InputEnabled { get; set; }=true;
        public bool KeyboardInputEnabled { get; set; }=true;
        public Action OnMiss { get; set; }
        public Action<string,Vector2> OnHover { get; set; }

        float BaseCameraRadius()
        {
            float aspect=boardCamera!=null?boardCamera.aspect:1;
            return aspect<1?13/Mathf.Max(.5f,aspect)*.85f:13;
        }

        void InitializeCamera()
        {
            cameraTarget=cameraGoal=new Vector3(0,.2f,0);
            yaw=cameraYaw=.78f;pitch=.88f;cameraPitch=.9f;distance=18;cameraDistance=BaseCameraRadius();
            cameraIntro=1;framedRadius=0;focusTarget=cameraTarget;ApplyCameraProjection();ApplyCameraTransform();
        }

        void StartCameraIntro(float amount)
        {
            cameraIntro=reducedMotion?0:amount;
            cameraGoal.x=cameraGoal.z=0;
            cameraDistance=BaseCameraRadius();framedRadius=0;
            SetHover(null,Vector2.zero,false);CancelPointer();
        }

        public void StartIntro() { StartCameraIntro(.6f); }

        public void ResetCamera() { ResetCamera(false); }
        public void ResetCamera(bool immediate)
        {
            cameraIntro=0;framedRadius=0;cameraGoal=new Vector3(0,.2f,0);
            cameraYaw=.78f;cameraPitch=.9f;cameraDistance=BaseCameraRadius();focusTarget=cameraGoal;
            CancelPointer();
            if(immediate)UpdateCamera(true);
        }

        public void FitCameraToViewport() { ApplyCameraProjection();ApplyCameraTransform(); }

        public void SetPhotoMode(bool enabled)
        {
            if(photoCamera==enabled)return;
            photoCamera=enabled;SetHover(null,Vector2.zero,false);ApplyCameraProjection();
        }

        // The web photo framing fits placed terrain, retaining the current viewing direction.
        public void FrameMap()
        {
            if(state==null||state.cells.Count==0||boardCamera==null)return;
            float loX=float.MaxValue,hiX=float.MinValue,loZ=float.MaxValue,hiZ=float.MinValue;
            foreach(string key in state.cells.Keys){Vector3 p=World(key);loX=Mathf.Min(loX,p.x);hiX=Mathf.Max(hiX,p.x);loZ=Mathf.Min(loZ,p.z);hiZ=Mathf.Max(hiZ,p.z);}
            cameraIntro=0;cameraGoal.x=(loX+hiX)*.5f;cameraGoal.z=(loZ+hiZ)*.5f;
            float span=Mathf.Max(hiX-loX+2*Spacing,hiZ-loZ+2*Spacing);
            cameraDistance=Mathf.Max(BaseCameraRadius(),span/(2*Mathf.Tan(boardCamera.fieldOfView*Mathf.Deg2Rad*.5f)*Mathf.Min(1,boardCamera.aspect))*1.05f);
            framedRadius=cameraDistance;
            distance=cameraDistance;cameraTarget=cameraGoal;ApplyCameraProjection();ApplyCameraTransform();
        }

        public void SetFocus(string cell)
        {
            string key=!string.IsNullOrEmpty(hover)&&(!string.IsNullOrEmpty(placementPreviewType)||rangePreview.Count>0)?hover:cell;
            focusTarget=string.IsNullOrEmpty(key)||!shape.Contains(key)?cameraTarget:World(key)+Vector3.up*.3f;
            if(Vector3.Distance(focusTarget,cameraTarget)>windowRadius*Spacing)focusTarget=cameraTarget;
        }

        public void CenterOnCell(string cell)
        {
            if(string.IsNullOrEmpty(cell)||!shape.Contains(cell))return;
            Vector3 p=World(cell);cameraGoal.x=p.x;cameraGoal.z=p.z;SetFocus(cell);
        }

        void UpdateCamera(bool immediate)
        {
            if(boardCamera==null)return;
            float dt=Mathf.Min(.05f,Time.unscaledDeltaTime);
            if(reducedMotion&&cameraIntro>0){cameraIntro=0;cameraDistance=BaseCameraRadius();}
            if(cameraIntro>0){cameraIntro=Mathf.Max(0,cameraIntro-dt*.55f);cameraDistance=BaseCameraRadius()+cameraIntro*16;cameraPitch=.9f-cameraIntro*.15f;}
            if(InputEnabled&&KeyboardInputEnabled&&!CameraControlHasFocus())HandleCameraKeys(dt);
            if(state==null||state.mode!="endless"){cameraGoal.x=Mathf.Clamp(cameraGoal.x,-10,10);cameraGoal.z=Mathf.Clamp(cameraGoal.z,-10,10);}
            cameraPitch=Mathf.Clamp(cameraPitch,.42f,1.22f);cameraDistance=Mathf.Clamp(cameraDistance,8,Mathf.Max(60,framedRadius));
            float k=immediate?1:1-Mathf.Exp(-dt*8);
            distance=Mathf.Lerp(distance,cameraDistance,k);pitch=Mathf.Lerp(pitch,cameraPitch,k);yaw=Mathf.Lerp(yaw,cameraYaw,k);
            cameraTarget=Vector3.Lerp(cameraTarget,cameraGoal,k);
            ApplyCameraProjection();ApplyCameraTransform();
            SetFocus(selected);
            if(depthOfField!=null)depthOfField.focusDistance.value=Mathf.Lerp(depthOfField.focusDistance.value,Mathf.Max(.1f,Vector3.Dot(focusTarget-boardCamera.transform.position,boardCamera.transform.forward)),immediate?1:1-Mathf.Exp(-dt*5));
        }

        void ApplyCameraProjection()
        {
            if(boardCamera==null)return;
            if(boardCamera.farClipPlane<distance*3)boardCamera.farClipPlane=distance*3;
            // Current live setViewOffset shifts above the dock by 6.5% desktop / 14% narrow.
            boardCamera.ResetProjectionMatrix();Matrix4x4 projection=boardCamera.projectionMatrix;
            float width=boardCamera.pixelWidth>0?boardCamera.pixelWidth:Screen.width;
            projection.m12=-2*(photoCamera?0:width<640?.14f:.065f);boardCamera.projectionMatrix=projection;
        }

        void ApplyCameraTransform()
        {
            if(boardCamera==null)return;
            float ring=distance*Mathf.Sin(pitch);
            boardCamera.transform.position=cameraTarget+new Vector3(ring*Mathf.Sin(yaw),distance*Mathf.Cos(pitch),ring*Mathf.Cos(yaw));
            boardCamera.transform.LookAt(cameraTarget,Vector3.up);
        }

        static bool Held(ButtonControl key) => key!=null&&key.isPressed;
        bool CameraControlHasFocus()
        {
            var focused=EventSystem.current!=null?EventSystem.current.currentSelectedGameObject:null;
            return focused!=null&&focused.activeInHierarchy&&focused.GetComponentInParent<UnityEngine.UI.Selectable>()!=null;
        }
        void HandleCameraKeys(float dt)
        {
            var keys=Keyboard.current;if(keys==null)return;
            if(keys.spaceKey.wasPressedThisFrame){ResetCamera();return;}
            if(Held(keys.qKey))cameraYaw-=dt*1.1f;
            if(Held(keys.eKey))cameraYaw+=dt*1.1f;
            if(Held(keys.rKey)){framedRadius=0;cameraDistance=Mathf.Max(8,cameraDistance-dt*10);}
            if(Held(keys.fKey)){framedRadius=0;cameraDistance=Mathf.Min(60,cameraDistance+dt*10);}
            int x=(Held(keys.dKey)||Held(keys.rightArrowKey)?1:0)-(Held(keys.aKey)||Held(keys.leftArrowKey)?1:0);
            int z=(Held(keys.sKey)||Held(keys.downArrowKey)?1:0)-(Held(keys.wKey)||Held(keys.upArrowKey)?1:0);
            if(x==0&&z==0)return;
            Vector3 right=new Vector3(-Mathf.Cos(yaw),0,Mathf.Sin(yaw)),fwd=new Vector3(-Mathf.Sin(yaw),0,-Mathf.Cos(yaw));
            cameraGoal+=(right*x+fwd*z)*8*dt;
        }

        bool OverUI(Vector2 position)
        {
            if(EventSystem.current==null)return false;
            var pointer=new PointerEventData(EventSystem.current){position=position};uiHits.Clear();EventSystem.current.RaycastAll(pointer,uiHits);
            foreach(var hit in uiHits)if(hit.module is UnityEngine.UI.GraphicRaycaster)return true;
            return false;
        }

        void HandleInput()
        {
            var screen=Touchscreen.current;
            if(screen!=null){
                int count=0;Vector2 a=Vector2.zero,b=Vector2.zero;
                foreach(var touch in screen.touches)if(touch.press.isPressed){if(count==0)a=touch.position.ReadValue();else if(count==1)b=touch.position.ReadValue();count++;}
                if(count>=2){
                    Vector2 center=(a+b)*.5f;float next=Vector2.Distance(a,b);
                    if(!hadPinch){pointerBlocked=(pressed&&pointerBlocked)||OverUI(a)||OverUI(b);pinchDistance=next;pointerPrevious=center;hadPinch=true;pointerTouch=true;}
                    if(!pointerBlocked){if(next>0&&pinchDistance>0){framedRadius=0;cameraDistance*=pinchDistance/next;}Pan(center-pointerPrevious);}
                    pinchDistance=next;pointerPrevious=center;dragging=true;pressed=false;SetHover(null,Vector2.zero,false);return;
                }
                // Once two fingers have participated, wait for both releases. Lifting one cannot
                // turn the remaining finger into a tap or a fresh rotate gesture.
                if(hadPinch){if(count==0)CancelPointer();return;}
                if(count==1){
                    if(!pressed)BeginPointer(a,0,true);else if(pointerTouch)MovePointer(a,false);
                    return;
                }
                if(pressed&&pointerTouch){
                    bool released=screen.primaryTouch.press.wasReleasedThisFrame&&screen.primaryTouch.phase.ReadValue()!=UnityEngine.InputSystem.TouchPhase.Canceled;
                    if(released)EndPointer(screen.primaryTouch.position.ReadValue());else CancelPointer();
                    return;
                }
            }
            var mouse=Mouse.current;if(mouse==null){SetHover(null,Vector2.zero,false);return;}
            Vector2 p=mouse.position.ReadValue();
            if(!pressed){
                if(mouse.leftButton.wasPressedThisFrame)BeginPointer(p,0,false);
                else if(mouse.rightButton.wasPressedThisFrame)BeginPointer(p,1,false);
                else if(mouse.middleButton.wasPressedThisFrame)BeginPointer(p,2,false);
            }
            if(pressed&&!pointerTouch){
                ButtonControl button=pointerButton==1?mouse.rightButton:pointerButton==2?mouse.middleButton:mouse.leftButton;
                if(button.isPressed)MovePointer(p,pointerButton!=0);
                if(button.wasReleasedThisFrame)EndPointer(p);
                else if(!button.isPressed)CancelPointer();
            }
            float scroll=mouse.scroll.ReadValue().y;
            if(scroll!=0&&!OverUI(p)){framedRadius=0;cameraDistance*=scroll>0?.92f:1.08f;}
            if(p.x<0||p.y<0||p.x>Screen.width||p.y>Screen.height||OverUI(p))SetHover(null,p,false);
            else SetHover(Pick(p),p,true);
        }

        void BeginPointer(Vector2 position,int button,bool touch)
        {
            pressed=true;dragging=false;pointerStart=pointerPrevious=position;pointerBlocked=OverUI(position);pointerButton=button;pointerTouch=touch;
        }
        void MovePointer(Vector2 position,bool pan)
        {
            Vector2 delta=position-pointerPrevious;pointerPrevious=position;if(pointerBlocked)return;
            Vector2 travel=position-pointerStart;
            if(Mathf.Abs(travel.x)+Mathf.Abs(travel.y)>(pointerTouch?10:5))dragging=true;
            if(!dragging)return;
            if(pan)Pan(delta);else{cameraYaw+=delta.x*.005f;cameraPitch+=delta.y*.004f;}
        }
        void Pan(Vector2 delta)
        {
            Vector3 right=new Vector3(-Mathf.Cos(yaw),0,Mathf.Sin(yaw)),fwd=new Vector3(-Mathf.Sin(yaw),0,-Mathf.Cos(yaw));
            // Preserve the current site's vertical pan direction. Its CSS downward delta
            // subtracts ground-forward; Unity's upward screen delta reverses that sign.
            cameraGoal+=(-right*delta.x+fwd*delta.y)*distance*.0022f;
        }
        void EndPointer(Vector2 position)
        {
            // A move and release can arrive in the same InputSystem update, after press is
            // already false. Check the release position too so that frame cannot place a tile.
            Vector2 travel=position-pointerStart;
            bool moved=Mathf.Abs(travel.x)+Mathf.Abs(travel.y)>(pointerTouch?10:5);
            bool tap=!pointerBlocked&&!dragging&&!moved&&pointerButton==0&&!OverUI(position);bool touch=pointerTouch;CancelPointer(false);
            if(!tap)return;
            string key=Pick(position);if(touch)SetHover(key,position,false);
            if(key!=null)onCellSelected?.Invoke(key);else OnMiss?.Invoke();
        }
        void CancelPointer(bool clearHover=true)
        {
            pressed=dragging=hadPinch=pointerBlocked=pointerTouch=false;
            if(clearHover)SetHover(null,Vector2.zero,false);
        }
        void SetHover(string key,Vector2 screenPosition,bool report)
        {
            bool changed=hover!=key;if(changed){hover=key;RebuildFrames();SetFocus(selected);}
            if(report&&(changed||!hoverReported||screenPosition!=lastHoverPosition)){OnHover?.Invoke(key,screenPosition);hoverReported=key!=null;lastHoverPosition=screenPosition;}
            else if(!report&&hoverReported){OnHover?.Invoke(null,Vector2.zero);hoverReported=false;}
        }
        string Pick(Vector2 position)
        {
            if(boardCamera!=null&&Physics.Raycast(boardCamera.ScreenPointToRay(position),out RaycastHit hit,boardCamera.farClipPlane)&&pickCells.TryGetValue(hit.collider,out string key))return key;return null;
        }
        void OnApplicationFocus(bool focused) { if(!focused)CancelPointer(); }
        void OnDisable() { CancelPointer(); }
    }
}
