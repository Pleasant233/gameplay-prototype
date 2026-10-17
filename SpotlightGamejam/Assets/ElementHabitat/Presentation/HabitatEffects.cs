using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace ElementHabitat
{
    // Native equivalents of the production view.js feedback timelines. Every clock is unscaled
    // absolute time; a long frame never lends its elapsed time to a newly spawned impact.
    public sealed partial class HabitatBoard
    {
        sealed class FeedbackObject
        {
            public Transform transform; public MeshFilter filter; public MeshRenderer renderer;
            public readonly MaterialPropertyBlock properties=new MaterialPropertyBlock();
            public double born; public float life,alpha=1,mode,progress; public Color color;
            public bool ownMesh,particle,ambient; public Action<FeedbackObject,float> animate;
        }
        sealed class DeferredFeedback {public double at;public Action run;}
        sealed class AmbientView {public MeshFilter filter;public Mesh mesh;public float phase;}
        readonly List<FeedbackObject> feedbackObjects=new List<FeedbackObject>();
        readonly Stack<FeedbackObject> feedbackPool=new Stack<FeedbackObject>();
        readonly List<DeferredFeedback> feedbackQueue=new List<DeferredFeedback>();
        readonly Dictionary<GameEvent,float> receiptDelays=new Dictionary<GameEvent,float>();
        readonly Dictionary<string,Mesh> feedbackMeshes=new Dictionary<string,Mesh>();
        readonly Dictionary<string,AmbientView> ambientViews=new Dictionary<string,AmbientView>();
        readonly Dictionary<Transform,Vector3> cloudHomes=new Dictionary<Transform,Vector3>();
        sealed class FeedbackLamp {public Light light;public double born=-10;}
        readonly List<FeedbackLamp> feedbackLamps=new List<FeedbackLamp>();
        Material feedbackMaterial;
        double ambientAt; int transientCount,particleCount;
        float cameraShake;bool creatingAmbient;
        bool FeedbackLow => Application.isMobilePlatform||Screen.width<600;
        double FeedbackNow => Time.realtimeSinceStartupAsDouble;
        static Color EffectColor(string element)
        {
            switch(element){case "metal":return Hex(0xffc928);case "wood":return Hex(0x5ad13a);case "water":return Hex(0x38a8ff);case "fire":return Hex(0xff5a2a);case "earth":return Hex(0xd0904a);default:return Hex(0xffe7a0);}
        }

        string placementPreviewType;
        public void SetPlacementPreview(string tileType)
        {
            if(placementPreviewType==tileType)return;placementPreviewType=tileType;RebuildFrames();
        }
        void AppendClusterPreview(HabitatMeshBuilder builder)
        {
            if(state==null||rangePreview.Count>0)return;
            string key=!string.IsNullOrEmpty(hover)?hover:selected;if(string.IsNullOrEmpty(key))return;
            State preview=state;
            if(!state.cells.ContainsKey(key)){
                if(string.IsNullOrEmpty(placementPreviewType)||!legal.Contains(key)||!Catalog.Types.ContainsKey(placementPreviewType))return;
                preview=new State{cells=new Dictionary<string,Tile>(state.cells)};preview.cells[key]=Game.MakeTile(placementPreviewType);
            }
            var cluster=Game.Cluster(preview,key);if(cluster.Count<2)return;var members=new HashSet<string>(cluster);
            foreach(string member in cluster){
                if(!cells.TryGetValue(member,out var cell))continue;Vector3 origin=World(member);
                for(int side=0;side<4;side++){
                    var p=cell.coordinate;string neighbor=(p.x+(side==1?1:side==3?-1:0))+","+(p.y+(side==2?1:side==0?-1:0));if(members.Contains(neighbor))continue;
                    for(int i=0;i<8;i++){
                        Vector2 a=EdgePoint(side,(float)i/8),c=EdgePoint(side,(float)(i+1)/8),inward=(side==0?Vector2.up:side==1?Vector2.left:side==2?Vector2.down:Vector2.right)*.025f;
                        Vector3 P(Vector2 v){return origin+new Vector3(v.x,Surface(cell,v.x,v.y)+.045f,v.y);}
                        builder.Quad(P(a),P(a+inward),P(c+inward),P(c),Hex(0xcfff78));
                    }
                }
            }
        }
        void InitializeFeedback()
        {
            var shader=Resources.Load<Shader>("HabitatFeedback");if(shader==null)shader=Shader.Find("ElementHabitat/Feedback");
            if(shader==null)shader=Shader.Find("Universal Render Pipeline/Unlit");
            feedbackMaterial=new Material(shader){name="Shared pooled spell and particle feedback",enableInstancing=true};
            if(!FeedbackLow)for(int i=0;i<2;i++){var go=new GameObject("Recycled subtle action light");go.transform.SetParent(effects,false);var light=go.AddComponent<Light>();light.type=LightType.Point;light.range=2.6f;light.intensity=0;light.shadows=LightShadows.None;feedbackLamps.Add(new FeedbackLamp{light=light});}
        }

        public Vector3 CellWorldPosition(string key)
        {
            if(string.IsNullOrEmpty(key))key=Game.TOWER_CELL;
            Vector3 p=World(key);var coordinate=Game.Parse(key);p.y=Height(coordinate[0],coordinate[1])+.06f;return p;
        }
        public Vector3 WorldToScreenPoint(string key)
        {
            return boardCamera==null?Vector3.zero:boardCamera.WorldToScreenPoint(CellWorldPosition(key)+Vector3.up*.3f);
        }
        public float FeedbackDelay(GameEvent receipt)
        {
            return !reducedMotion&&receipt!=null&&receiptDelays.TryGetValue(receipt,out float delay)?delay:0;
        }
        public float PlacementLandingDelay => reducedMotion?0:.4f;
        public void ClearFeedback()
        {
            feedbackQueue.Clear();receiptDelays.Clear();
            for(int i=feedbackObjects.Count-1;i>=0;i--)RecycleFeedback(i);
            foreach(var cell in cells.Values){cell.landingBorn=cell.popBorn=cell.impactBorn=-1;cell.terrain.transform.parent.localPosition=World(cell.key);cell.terrain.transform.parent.localScale=Vector3.one;}
            cameraShake=0;foreach(var lamp in feedbackLamps)if(lamp.light!=null)lamp.light.intensity=0;
        }
        void DisposeFeedback()
        {
            ClearFeedback();foreach(var mesh in feedbackMeshes.Values)if(mesh!=null)Destroy(mesh);feedbackMeshes.Clear();
            foreach(var ambient in ambientViews.Values)if(ambient.mesh!=null)Destroy(ambient.mesh);ambientViews.Clear();
            if(feedbackMaterial!=null)Destroy(feedbackMaterial);
        }

        // Render first, then pass the complete receipt list once. State changes stay synchronous;
        // Impact delays also schedule sound. HUD receipts retain the web's parallel timeline.
        public void PlayAction(GameAction action,State before,State after,IReadOnlyList<GameEvent> receipts)
        {
            if(!initialized||after==null)return;receiptDelays.Clear();
            float crystalDelay=action!=null&&(action.type=="useCrystal"||action.type=="useCrystals")&&!reducedMotion?.70f:0;
            if(action!=null){
                switch(action.type){
                    case "useCrystal":
                        Delay(crystalDelay,()=>SpellFeedback(action.inverse?"infection":"crystal",action.cell,action.el));break;
                    case "useCrystals":
                        var elements=new HashSet<string>();var positive=new HashSet<string>();
                        if(action.crystals is IEnumerable<CrystalUse> uses)foreach(var c in uses){elements.Add(c.el);if(c.kind!="inverseCrystal")positive.Add(c.el);}
                        if(elements.Count==0&&after.cells.TryGetValue(action.cell,out var current)&&before!=null&&before.cells.TryGetValue(action.cell,out var previous))
                            for(int i=0;i<5;i++)if(current.attrs[i]!=previous.attrs[i]){elements.Add(ElementKeys[i]);if(current.attrs[i]>previous.attrs[i])positive.Add(ElementKeys[i]);}
                        if(elements.Count==0)elements.Add(action.el??"earth");
                        foreach(string element in elements){string el=element;bool pos=positive.Contains(el);Delay(crystalDelay,()=>SpellFeedback(pos?"crystal":"infection",action.cell,el));}break;
                    case "deployShield":
                        foreach(var shield in after.shields)if(shield.id==action.shieldId){ShieldDeployment(shield);break;}break;
                    case "merge":SpellFeedback("merge",action.cell,action.el);break;
                    case "moveSpirit":case "moveBeast":MoveUnitFeedback(action.from,action.to,action.el);break;
                    case "range":case "usePureCrystal":Rune(CellWorldPosition(action.cell),EffectColor(action.el));break;
                }
            }
            int meteorIndex=0,meteorCount=0;bool meteor=false;if(receipts!=null)foreach(var e in receipts)if(e.kind=="meteor"){meteor=true;meteorCount++;}float lastMeteorDelay=reducedMotion||!meteor?0:.42f+Mathf.Min(1.35f,(meteorCount-1)*.075f)+.72f;
            if(receipts==null)return;
            foreach(var e in receipts){
                float delay=crystalDelay;
                if(e.kind=="place")delay=PlacementLandingDelay;
                if(e.kind=="meteor"){delay=reducedMotion?0:.42f+Mathf.Min(1.35f,meteorIndex*.075f)+.72f;MeteorFeedback(e,meteorIndex++);}
                else if(e.kind=="shield"&&meteor)continue;
                else if(e.kind=="pureCrystal"&&meteor)delay=lastMeteorDelay;
                else if(e.kind=="attr"&&meteor)delay=lastMeteorDelay;
                else PlayReceipt(e,delay);
                receiptDelays[e]=delay;
            }
        }

        void PlayReceipt(GameEvent e,float delay)
        {
            if(e==null)return;
            switch(e.kind){
                case "place":if(cells.TryGetValue(e.cell,out var cell)&&cell.landingBorn<0)BeginLanding(cell);break;
                case "spell":SpellFeedback(e.magic,e.cell,e.el);break;
                case "purify":case "infection":case "upgrade":case "degrade":case "vanish":SpellFeedback(e.kind,e.cell,e.el);break;
                case "meteor":MeteorFeedback(e,0);break;
                case "guardianMerge":case "guardianMove":case "guardian":GuardianFeedback(e);break;
                case "towerUpgrade":SpellFeedback("upgrade",Game.TOWER_CELL,e.el);break;
                case "weather":WeatherFeedback(e.cell,e.id);break;
                case "towerSpring":if(!reducedMotion)Burst(CellWorldPosition(e.cell),EffectColor(e.el),FeedbackLow?1:2,.15f,.5f,.55f,"spark");break;
                case "autoMerge":case "animalAwaken":SpellFeedback("merge",e.cell,e.el);break;
                case "spirit":case "animal":case "plant":case "oreSpawn":
                    if(!reducedMotion){Pop(e.cell);Burst(CellWorldPosition(e.cell)+Vector3.up*.15f,EffectColor(e.el),3,.2f,.55f,.65f,"spark");}break;
                case "cancer":SpellFeedback("infection",e.cell,e.el);break;
                case "shield":ShieldFlash(e.cell,EffectColor(e.el));break;
                case "mapComplete":case "stageClear":SpellFeedback("upgrade",Game.TOWER_CELL,"metal");break;
                // Resource and score receipts are represented by HUD tokens, never by 85 simultaneous bursts.
            }
        }

        void Delay(float seconds,Action callback)
        {
            if(seconds<=0){callback();return;}
            int budget=FeedbackLow?80:160;if(feedbackQueue.Count>=budget)feedbackQueue.RemoveAt(0);
            feedbackQueue.Add(new DeferredFeedback{at=FeedbackNow+seconds,run=callback});
        }
        FeedbackObject Visual(string shape,Color color,float life,Action<FeedbackObject,float> animate,float delay=0,float alpha=1,bool particle=false,Mesh owned=null,float mode=0)
        {
            if(feedbackMaterial==null)return null;
            int budget=particle?(FeedbackLow?400:800):(FeedbackLow?180:360);
            if((particle?particleCount:transientCount)>=budget){
                if(particle)return null;
                for(int i=0;i<feedbackObjects.Count;i++)if(!feedbackObjects[i].particle){RecycleFeedback(i);break;}
            }
            FeedbackObject f;
            if(feedbackPool.Count>0)f=feedbackPool.Pop();
            else {var filter=MeshObject("Pooled native feedback",effects,feedbackMaterial);var renderer=filter.GetComponent<MeshRenderer>();renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;f=new FeedbackObject{transform=filter.transform,filter=filter,renderer=renderer};}
            f.filter.sharedMesh=owned!=null?owned:FeedbackMesh(shape);f.ownMesh=owned!=null;f.particle=particle;f.ambient=creatingAmbient;f.color=color;f.alpha=alpha;f.mode=mode;f.progress=0;f.born=FeedbackNow+delay;f.life=life;f.animate=animate;
            f.transform.localPosition=Vector3.zero;f.transform.localRotation=Quaternion.identity;f.transform.localScale=Vector3.one;f.transform.gameObject.SetActive(delay<=0);
            if(particle)particleCount++;else transientCount++;feedbackObjects.Add(f);animate?.Invoke(f,0);ApplyFeedbackProperties(f);return f;
        }
        void ApplyFeedbackProperties(FeedbackObject f)
        {
            f.properties.Clear();Color c=f.color;c.a*=Mathf.Clamp01(f.alpha);f.properties.SetColor("_BaseColor",c);f.properties.SetFloat("_Mode",f.mode);f.properties.SetFloat("_Progress",f.progress);f.renderer.SetPropertyBlock(f.properties);
        }
        void RecycleFeedback(int index)
        {
            var f=feedbackObjects[index];if(f.ownMesh&&f.filter.sharedMesh!=null)Destroy(f.filter.sharedMesh);
            f.filter.sharedMesh=null;f.animate=null;f.transform.gameObject.SetActive(false);if(f.particle)particleCount--;else transientCount--;feedbackObjects.RemoveAt(index);feedbackPool.Push(f);
        }
        void UpdateFeedback()
        {
            double now=FeedbackNow;
            for(int i=feedbackQueue.Count-1;i>=0;i--)if(now>=feedbackQueue[i].at){var next=feedbackQueue[i];feedbackQueue.RemoveAt(i);next.run();}
            for(int i=feedbackObjects.Count-1;i>=0;i--){var f=feedbackObjects[i];if(now<f.born)continue;float u=(float)((now-f.born)/f.life);if(u>=1){RecycleFeedback(i);continue;}if(!f.transform.gameObject.activeSelf)f.transform.gameObject.SetActive(true);f.animate?.Invoke(f,u);ApplyFeedbackProperties(f);}
            AnimateCells(now);foreach(var lamp in feedbackLamps)if(lamp.light!=null)lamp.light.intensity=.18f*Mathf.Max(0,1-(float)(now-lamp.born)/.4f);
            if(!reducedMotion){
                float t=(float)now;foreach(var cloud in cloudBanks){if(!cloudHomes.TryGetValue(cloud.transform,out var home)){home=cloud.transform.localPosition;cloudHomes[cloud.transform]=home;}cloud.transform.localPosition=home+new Vector3(Mathf.Sin(t*.065f)*.08f,Mathf.Sin(t*.18f+home.x)*.035f,0);}
                foreach(var ambient in ambientViews.Values)if(ambient.filter!=null){ambient.filter.transform.localPosition=new Vector3(0,Mathf.Sin(t*1.7f+ambient.phase)*.015f,0);ambient.filter.transform.localRotation=Quaternion.Euler(0,Mathf.Sin(t*.6f+ambient.phase)*3,0);}
                if(now>=ambientAt){ambientAt=now+.30;AmbientFeedback();}
                if(cameraShake>0&&boardCamera!=null){float amount=cameraShake*Mathf.Sin(t*87)*.12f;boardCamera.transform.position+=boardCamera.transform.right*amount+Vector3.up*(amount*.45f);cameraShake=Mathf.Max(0,cameraShake-Time.unscaledDeltaTime*.8f);}
            }
        }

        void Flash(Vector3 pos,Color color)
        {
            if(reducedMotion||FeedbackLow||feedbackLamps.Count==0)return;
            var slot=feedbackLamps[0];foreach(var lamp in feedbackLamps)if(lamp.born<slot.born)slot=lamp;
            slot.born=FeedbackNow;slot.light.transform.localPosition=pos+Vector3.up*.5f;slot.light.color=color;slot.light.intensity=.18f;
        }
        void BeginLanding(CellView cell)
        {
            if(reducedMotion){RegionOutline(new[]{cell.key},Hex(0xffe066),.3f);return;}
            cell.landingBorn=FeedbackNow;cell.terrain.transform.parent.localPosition=World(cell.key)+Vector3.up*2.2f;cell.terrain.transform.parent.localScale=Vector3.one;
            Delay(.4f,()=>{
                if(!cells.TryGetValue(cell.key,out var visible)||!ReferenceEquals(visible,cell)||state==null||!state.cells.ContainsKey(cell.key))return;
                Pop(cell.key);Vector3 pos=CellWorldPosition(cell.key);
                Burst(pos,Hex(0xc9b896),12,.65f,.7f,.18f,"dust");Burst(pos,Hex(0x8d7150),8,.8f,.55f,.3f,"shard");cameraShake=Mathf.Max(cameraShake,.045f);ClusterFeedback(cell.key);
                int i=0;foreach(var k in Game.Neighbors(cell.key)){string key=k;Delay(.04f*(++i),()=>ImpactCell(key,.4f));}
            });
        }
        void AnimateCells(double now)
        {
            foreach(var cell in cells.Values){
                float y=0,sxz=1,sy=1;
                if(cell.landingBorn>=0){float u=Mathf.Clamp01((float)(now-cell.landingBorn)/.4f);float s=u-1;float back=1+3.2f*s*s*s+2.2f*s*s;y+=(1-back)*2.2f;if(u>=1)cell.landingBorn=-1;}
                if(cell.popBorn>=0){float u=(float)(now-cell.popBorn)*3.5f;if(u>=1)cell.popBorn=-1;else{float v=1-u,s=Mathf.Sin(v*Mathf.PI)*v;sy=1-s*.25f;sxz=1+s*.12f;}}
                if(cell.impactBorn>=0){float u=(float)(now-cell.impactBorn)/.4f;if(u>=1)cell.impactBorn=-1;else y+=Mathf.Sin(u*Mathf.PI)*.05f;}
                Transform root=cell.terrain.transform.parent;root.localPosition=World(cell.key)+Vector3.up*y;root.localScale=new Vector3(sxz,sy,sxz);
            }
        }
        void Pop(string key){if(!reducedMotion&&!string.IsNullOrEmpty(key)&&cells.TryGetValue(key,out var cell))cell.popBorn=FeedbackNow;}
        void ImpactCell(string key,float strength){if(!reducedMotion&&cells.TryGetValue(key,out var cell))cell.impactBorn=FeedbackNow;}

        void Burst(Vector3 pos,Color color,int count,float speed,float life,float up,string style)
        {
            if(reducedMotion)return;count=Mathf.CeilToInt(count*(FeedbackLow?.5f:1));
            for(int i=0;i<count;i++){
                float angle=UnityEngine.Random.value*Mathf.PI*2,r=UnityEngine.Random.value*speed;
                var velocity=new Vector3(Mathf.Cos(angle)*r,up*(UnityEngine.Random.value*speed+.4f),Mathf.Sin(angle)*r);
                float swirlRadius=UnityEngine.Random.Range(.05f,.25f);float duration=life*UnityEngine.Random.Range(.7f,1.2f),size=style=="dust"?UnityEngine.Random.Range(.22f,.34f):style=="water"?UnityEngine.Random.Range(.06f,.11f):UnityEngine.Random.Range(.055f,.11f);
                string shape=style=="dust"||style=="spark"?"sphere":style=="water"?"drop":"octa";
                Visual(shape,color,duration,(f,u)=>{
                    float t=u*duration,damped=(1-Mathf.Exp(-.8f*t))/.8f,gravity=style=="dust"?.3f:style=="ember"?0:2.2f;f.transform.localPosition=pos+velocity*damped+Vector3.down*(gravity/.8f)*(t-damped);
                    if(style=="ember"){var p=f.transform.localPosition;p.x=pos.x+Mathf.Cos(angle+t*8)*swirlRadius;p.z=pos.z+Mathf.Sin(angle+t*8)*swirlRadius;f.transform.localPosition=p;}
                    float fade=Mathf.Clamp01((1-u)*2);f.transform.localScale=(style=="water"?new Vector3(.8f,1.6f,.8f):Vector3.one)*size*(style=="dust"?(1+u*1.5f):fade);
                    f.transform.localRotation=Quaternion.Euler(u*75,angle*Mathf.Rad2Deg+u*100,u*30);f.alpha=(1-u)*(style=="dust"?.22f:.9f);
                },0,1,true,null,style=="dust"?3:0);
            }
        }
        void Ring(Vector3 pos,Color color,float life=.6f,float size=1.1f,float delay=0,float opacity=.5f,bool thick=false)
        {
            Visual(thick?"waveRing":"ring",color,life,(f,u)=>{f.transform.localPosition=pos;f.transform.localScale=Vector3.one*(.2f+u*size);f.alpha=(1-u)*opacity;},delay,opacity);
        }
        void Beam(Vector3 pos,Color color)
        {
            Visual("beam",color,.6f,(f,u)=>{float h=1.8f*(1-u*.2f);f.transform.localPosition=pos+Vector3.up*h*.5f;f.transform.localScale=new Vector3(.09f*(1+u),h,.09f*(1+u));f.alpha=(1-u)*.22f;});
        }
        void Rune(Vector3 pos,Color color)
        {
            Visual("rune",color,reducedMotion?.3f:.85f,(f,u)=>{f.transform.localPosition=pos+Vector3.up*.015f;f.transform.localScale=Vector3.one*(reducedMotion?.85f:.2f+Mathf.Min(1,u*4)*.75f);f.transform.localRotation=Quaternion.Euler(0,reducedMotion?0:u*28.65f,0);f.alpha=(1-u)*.28f;});
        }
        void RegionOutline(IEnumerable<string> region,Color color,float life,float opacity=.8f,bool pulse=false,bool cluster=false)
        {
            var members=new HashSet<string>(region);var b=new HabitatMeshBuilder();
            foreach(string key in members){
                if(!cells.TryGetValue(key,out var cell))continue;Vector3 center=World(key);
                for(int side=0;side<4;side++){
                    var p=cell.coordinate;string neighbor=(p.x+(side==1?1:side==3?-1:0))+","+(p.y+(side==2?1:side==0?-1:0));if(members.Contains(neighbor))continue;
                    for(int i=0;i<8;i++){Vector2 a=EdgePoint(side,(float)i/8),c=EdgePoint(side,(float)(i+1)/8);Vector2 inward=(side==0?Vector2.up:side==1?Vector2.left:side==2?Vector2.down:Vector2.right)*.04f;Vector3 P(Vector2 v){return center+new Vector3(v.x,Surface(cell,v.x,v.y)+.07f,v.y);}b.Quad(P(a),P(a+inward),P(c+inward),P(c),Color.white);}
                }
            }
            Visual("ring",color,life,(f,u)=>{f.alpha=cluster?(1-u)*(.45f+.4f*Mathf.Sin(u*Mathf.PI)):pulse?.25f+Mathf.Sin(u*22)*.25f:(1-u)*opacity;},0,opacity,false,b.Mesh("Owned connected terrain outer contour"));
        }
        void ClusterFeedback(string key)
        {
            if(state==null||!state.cells.ContainsKey(key))return;var connected=Game.Cluster(state,key);if(connected.Count<2)return;
            Color color=Hex(0xcfff78);RegionOutline(connected,color,reducedMotion?.35f:1.65f,.9f,false,!reducedMotion);if(reducedMotion)return;
            Vector3 origin=World(key);
            foreach(string k in connected){
                if(!cells.TryGetValue(k,out var cell))continue;float delay=Mathf.Min(1.1f,Vector3.Distance(World(k),origin)*.10f);
                // The radial band follows the actual triangulated surface, rather than floating above it.
                var overlay=Instantiate(cell.terrainMesh);overlay.name="Owned surface wave "+k;
                Visual("ring",color,.85f,(f,u)=>{f.transform.localPosition=World(k)+Vector3.up*.015f;f.mode=1;f.progress=u;f.alpha=.5f;},delay,.5f,false,overlay,1);
                string target=k;Delay(delay,()=>{Burst(CellWorldPosition(target)+Vector3.up*.08f,color,FeedbackLow?3:5,.2f,.7f,.7f,"spark");ImpactCell(target,.3f);});
            }
        }
        void SpellFeedback(string kind,string key,string element)
        {
            if(string.IsNullOrEmpty(key)||!cells.ContainsKey(key))return;
            Vector3 pos=CellWorldPosition(key);Color color=EffectColor(element);
            switch(kind){case "purify":color=Hex(0xfff5cf);break;case "mine":color=Hex(0xffcc22);break;case "spring":color=Hex(0x38c0ff);break;case "rich":color=Hex(0x79e84b);break;case "burn":color=Hex(0xff5a1a);break;case "upgrade":color=Hex(0x8aca66);break;case "infection":color=Hex(0x9d71b2);break;}
            if(reducedMotion){RegionOutline(new[]{key},color,.3f,.55f);return;}
            if(kind=="degrade"||kind=="vanish"){Burst(pos,Hex(0x9e84b1),12,.35f,.8f,.2f,"dust");return;}
            if(kind=="purify"||kind=="mine"||kind=="spring"||kind=="rich"||kind=="burn"){
                int count=FeedbackLow?3:6;
                for(int i=0;i<count;i++){float angle=i*Mathf.PI*2/count;Visual("octa",color,.9f,(f,u)=>{float r=.34f*(1-u);f.transform.localPosition=pos+new Vector3(Mathf.Cos(angle+u*3)*r,.05f+u*.65f,Mathf.Sin(angle+u*3)*r);f.transform.localScale=Vector3.one*.04f*(1-u);f.alpha=1-u;});}
            }
            if(kind=="infection"){
                Burst(pos,Hex(0x9d71b2),9,.35f,.75f,.45f,"dust");
                for(int i=0;i<3;i++){float a=i*Mathf.PI*2/3;Visual("octa",Hex(0xc9a4e8),.8f,(f,u)=>{float r=.4f-u*.3f;f.transform.localPosition=pos+new Vector3(Mathf.Cos(a+u*6)*r,u*.5f,Mathf.Sin(a+u*6)*r);f.transform.localScale=Vector3.one*.14f*(1-u);f.alpha=(1-u)*.65f;});}return;
            }
            if(kind=="upgrade"){
                RegionOutline(new[]{key},Hex(0xffe894),1.25f,.9f);Beam(pos,Hex(0xcfff86));Burst(pos,Hex(0xffe8a0),28,.65f,1.1f,1.5f,"spark");Pop(key);
                for(int i=0;i<6;i++){float a=i*Mathf.PI/3;Visual("octa",i%2==0?Hex(0xffefb2):Hex(0xa4ec67),1.05f,(f,u)=>{float r=.5f-u*.15f;f.transform.localPosition=pos+new Vector3(Mathf.Cos(a+u*2)*r,.1f+u*1.2f,Mathf.Sin(a+u*2)*r);f.transform.localScale=Vector3.one*.13f*(1-u);f.transform.localRotation=Quaternion.Euler(0,u*401,0);f.alpha=(1-u)*.8f;});}
                Flash(pos,Hex(0xf5e8a3));ClusterFeedback(key);return;
            }
            if(kind=="purify"||kind=="merge"||kind=="crystal")Rune(pos,color);Flash(pos,color);Pop(key);
            if(kind=="purify"){
                Beam(pos,color);Burst(pos,Hex(0xdbe8c0),20,.26f,1,1.8f,"spark");
                if(cells.TryGetValue(key,out var cell)){var overlay=Instantiate(cell.terrainMesh);overlay.name="Owned radial purification";Visual("ring",Hex(0x797554),.85f,(f,u)=>{f.transform.localPosition=World(key)+Vector3.up*.016f;f.progress=u*.9f;f.alpha=.85f;},0,.85f,false,overlay,2);}
            }else if(kind=="mine"){
                for(int i=0;i<4;i++){float a=i*Mathf.PI/2+.4f;
                    Visual("cube",color,.8f,(f,u)=>{f.transform.localPosition=pos;f.transform.localScale=new Vector3(.028f,.015f,.75f);f.transform.localRotation=Quaternion.Euler(0,a*Mathf.Rad2Deg,0);f.alpha=1-u;});
                    Visual("octa",color,1.05f,(f,u)=>{f.transform.localPosition=pos+new Vector3(Mathf.Cos(a)*u*.38f,Mathf.Sin(u*Mathf.PI)*.9f,Mathf.Sin(a)*u*.38f);f.transform.localScale=new Vector3(.10f,.20f,.10f);f.transform.localRotation=Quaternion.Euler(0,u*286,0);f.alpha=Mathf.Min(1,(1-u)*5);});
                }Burst(pos,Hex(0xbd994d),14,.55f,.7f,1.1f,"shard");
            }else if(kind=="spring"){
                Visual("cylinder",color,.85f,(f,u)=>{float h=Mathf.Sin(u*Mathf.PI)*1.6f;f.transform.localPosition=pos+Vector3.up*h*.5f;f.transform.localScale=new Vector3(.12f,h,.12f);f.alpha=(1-u)*.8f;});
                Burst(pos,Hex(0x8ab7cf),30,.7f,.85f,1.6f,"water");Ring(pos,Hex(0xa5c8d3),.75f,.85f,.2f,.3f);Ring(pos,Hex(0xa5c8d3),.75f,.85f,.35f,.3f);
            }else if(kind=="rich"){
                for(int i=0;i<12;i++){float a=i*Mathf.PI/6;bool soil=i%2!=0;
                    Visual(soil?"cube":"octa",soil?Hex(0x9a6c34):Hex(0x7ee348),.95f,(f,u)=>{f.transform.localPosition=pos+new Vector3(Mathf.Cos(a)*u*.65f,Mathf.Sin(u*Mathf.PI)*(soil?.55f:1),Mathf.Sin(a)*u*.65f);f.transform.localScale=Vector3.one*.07f;f.transform.localRotation=Quaternion.Euler(u*344,a*Mathf.Rad2Deg,u*229);f.alpha=1-u;});
                }
                for(int i=0;i<8;i++){float a=i*Mathf.PI/4;Visual("cone",Hex(0x8fff66),.9f,(f,u)=>{f.transform.localPosition=pos+new Vector3(Mathf.Cos(a)*.4f,.07f,Mathf.Sin(a)*.4f);f.transform.localScale=new Vector3(.09f,Mathf.Sin(u*Mathf.PI)*.25f,.09f);f.alpha=1-u;},i*.045f);}
            }else if(kind=="burn"){
                cameraShake=Mathf.Max(cameraShake,.14f);Burst(pos,Hex(0xf2a55b),36,.45f,.9f,1.8f,"ember");Burst(pos,Hex(0x736d61),9,.20f,1.1f,1.1f,"dust");
                for(int i=0;i<5;i++){float a=i*Mathf.PI*2/5;Visual("cone",i%2==0?Hex(0xc97e49):Hex(0xe7ad62),.65f,(f,u)=>{f.transform.localPosition=pos+new Vector3(Mathf.Cos(a+u*5)*.16f,u*.6f,Mathf.Sin(a+u*5)*.16f);f.transform.localScale=new Vector3(.10f*(1-u),Mathf.Sin(u*Mathf.PI)*.5f,.10f*(1-u));f.alpha=(1-u)*.55f;},i*.07f);}
            }else if(kind=="merge"){
                cameraShake=Mathf.Max(cameraShake,.10f);
                for(int i=0;i<3;i++){float a=i*Mathf.PI*2/3;Visual("sphere",color,.8f,(f,u)=>{float r=(1-u)*.9f;f.transform.localPosition=pos+new Vector3(Mathf.Cos(a+u*9)*r,.25f+u*.45f,Mathf.Sin(a+u*9)*r);f.transform.localScale=Vector3.one*.11f;f.alpha=.8f;});}
                Visual("octa",color,.6f,(f,u)=>{f.transform.localPosition=pos+Vector3.up*.7f;f.transform.localScale=Vector3.one*Mathf.Sin(u*Mathf.PI)*.45f;f.transform.localRotation=Quaternion.Euler(0,u*286,0);f.alpha=1-u;},.65f);
            }else if(kind=="crystal")Burst(pos,color,16,.55f,.7f,.9f,"shard");
            else Burst(pos,color,10,.5f,.6f,.8f,"spark");
        }

        void MeteorFeedback(GameEvent e,int index)
        {
            if(string.IsNullOrEmpty(e.cell)||!cells.ContainsKey(e.cell))return;
            Vector3 pos=CellWorldPosition(e.cell);Color color=EffectColor(e.el);float delay=reducedMotion?0:.42f+Mathf.Min(1.35f,index*.075f);
            RegionOutline(new[]{e.cell},color,reducedMotion?.25f:delay+.72f,.7f,!reducedMotion);
            if(reducedMotion){MeteorImpact(e,index);return;}
            Vector3 start=pos+new Vector3(-1.9f,3.5f,-.85f),direction=(start-pos).normalized;
            Visual("ico",color,.72f,(f,u)=>{f.transform.localPosition=Vector3.Lerp(start,pos,u*u);f.transform.localScale=Vector3.one*.30f;f.transform.localRotation=Quaternion.Euler(u*229,u*401,0);f.alpha=1;},delay);
            Visual("sphere",Hex(0xfff7d0),.72f,(f,u)=>{f.transform.localPosition=Vector3.Lerp(start,pos,u*u);f.transform.localScale=Vector3.one*.19f;f.alpha=1;},delay);
            Visual("tail",color,.72f,(f,u)=>{f.transform.localPosition=Vector3.Lerp(start,pos,u*u)+direction*.6f;f.transform.localRotation=Quaternion.FromToRotation(Vector3.up,direction);f.transform.localScale=new Vector3(.7f,1.25f,.7f);f.alpha=.6f+u*.2f;},delay,.8f,false,null,4);
            Delay(delay+.72f,()=>MeteorImpact(e,index));
        }
        void MeteorImpact(GameEvent e,int index)
        {
            Vector3 pos=CellWorldPosition(e.cell);Color color=EffectColor(e.el);bool blocked=e.damage<e.strength;
            if(blocked)ShieldFlash(e.cell,e.sheltered?Hex(0xffe6a2):color);
            if(reducedMotion)return;
            Burst(pos,blocked?Hex(0xc6faff):color,blocked?12:18,.7f,.7f,1.1f,blocked?"spark":"shard");if(e.damage>0)Burst(pos,Hex(0xb9a18c),10,.75f,.85f,.32f,"dust");
            Flash(pos,color);Ring(pos,blocked?Hex(0xb4f4ff):color,.6f,1.5f,0,.7f,true);ImpactCell(e.cell,.4f);cameraShake=Mathf.Max(cameraShake,FeedbackLow?.045f:.10f);
        }
        void ShieldFlash(string key,Color color)
        {
            if(string.IsNullOrEmpty(key)||!cells.ContainsKey(key))return;Vector3 pos=CellWorldPosition(key);
            Visual("dome",color,reducedMotion?.3f:.8f,(f,u)=>{float v=reducedMotion?0:u;f.transform.localPosition=pos;f.transform.localScale=new Vector3(1.06f+v*.26f,1.36f+v*.20f,1.06f+v*.26f);f.alpha=(1-u)*.32f;},0,.32f,false,null,5);
            if(reducedMotion)return;
            int count=FeedbackLow?4:8;for(int i=0;i<count;i++){float a=i*Mathf.PI*2/count;Visual("octa",Hex(0xc4fbff),.6f,(f,u)=>{f.transform.localPosition=pos+new Vector3(Mathf.Cos(a)*(.35f+u*.4f),.3f+Mathf.Sin(u*Mathf.PI)*.3f,Mathf.Sin(a)*(.35f+u*.4f));f.transform.localScale=Vector3.one*.1f;f.transform.localRotation=Quaternion.Euler(0,u*344,0);f.alpha=(1-u)*.8f;});}
        }
        void ShieldDeployment(Shield shield)
        {
            string main="metal";foreach(string el in ElementKeys)if(shield.defense[el]>shield.defense[main])main=el;Color color=EffectColor(main);
            RegionOutline(shield.cells,color,reducedMotion?.35f:1.5f,.95f);
            int i=0;foreach(string k in shield.cells){string target=k;Delay(reducedMotion?0:Mathf.Min(.7f,i++*.075f),()=>{ShieldFlash(target,color);if(!reducedMotion)Rune(CellWorldPosition(target),color);});}
        }
        void GuardianFeedback(GameEvent e)
        {
            if(state==null||string.IsNullOrEmpty(e.cell)||!state.cells.TryGetValue(e.cell,out var tile))return;
            ElementBag power=e.power;if(power==null)foreach(var guardian in tile.guardians)if(guardian.id==e.guardianId){power=guardian.power;break;}if(power==null)return;
            var colors=new List<Color>();var fiveColors=new List<Color>();foreach(string el in ElementKeys)if(power[el]>0){colors.Add(EffectColor(el));for(int i=0;i<power[el];i++)fiveColors.Add(EffectColor(el));}
            var targets=e.targets??Game.GuardianArea(state,e.cell);Vector3 pos=CellWorldPosition(e.cell);RegionOutline(targets,Hex(0xffd873),reducedMotion?.4f:e.kind=="guardianMerge"?1.4f:.9f,.8f);if(reducedMotion)return;
            Pop(e.cell);
            if(e.kind=="guardianMerge"){
                Rune(pos,Hex(0xffd873));Flash(pos,Hex(0xffe8a5));
                for(int i=0;i<5;i++){float a=i*Mathf.PI*2/5;Color color=fiveColors[i%fiveColors.Count];Visual("octa",color,1,(f,u)=>{float r=(1-u)*.7f;f.transform.localPosition=pos+new Vector3(Mathf.Cos(a+u*4)*r,.2f+u*.65f,Mathf.Sin(a+u*4)*r);f.transform.localScale=Vector3.one*(.12f*(1-u)+.035f);f.transform.localRotation=Quaternion.Euler(0,u*458,0);f.alpha=.8f;});}
            }else if(e.kind=="guardianMove"&&!string.IsNullOrEmpty(e.from))MoveUnitFeedback(e.from,e.cell,"metal",Hex(0xffe5a2));
            int j=0;foreach(string k in targets){string target=k;Delay(j++*.045f,()=>{foreach(Color color in colors)Burst(CellWorldPosition(target),color,FeedbackLow?2:3,.25f,.45f,.55f,"spark");});}
        }
        void MoveUnitFeedback(string from,string to,string element,Color? overrideColor=null)
        {
            if(reducedMotion||string.IsNullOrEmpty(from)||string.IsNullOrEmpty(to))return;Vector3 start=CellWorldPosition(from)+Vector3.up*.3f,end=CellWorldPosition(to);
            Visual("octa",overrideColor??EffectColor(element),.5f,(f,u)=>{f.transform.localPosition=Vector3.Lerp(start,end,u)+Vector3.up*Mathf.Sin(u*Mathf.PI)*.45f;f.transform.localScale=Vector3.one*(.15f*(1-u)+.06f);f.alpha=(1-u)*.8f;});
        }
        void WeatherFeedback(string key,string id)
        {
            if(reducedMotion||string.IsNullOrEmpty(key)||!cells.ContainsKey(key))return;
            Vector3 pos=CellWorldPosition(key);Color color=Hex(0xffd977);
            foreach(var d in Catalog.NaturalEvents)if(d.id==id&&ColorUtility.TryParseHtmlString(d.color,out var parsed)){color=parsed;break;}
            if(id=="earthPulse"){Ring(pos,color,1.1f,.9f,0,.65f,true);Burst(pos,color,FeedbackLow?2:4,.25f,.8f,.5f,"dust");return;}
            int count=FeedbackLow?2:3;
            for(int i=0;i<count;i++){float a=i*Mathf.PI*2/count;Visual(id=="rain"?"drop":id=="springWind"?"cube":"octa",color,id=="rain"?.8f:1.3f,(f,u)=>{
                f.alpha=Mathf.Sin(u*Mathf.PI)*.85f;
                if(id=="rain"){f.transform.localScale=new Vector3(.04f,.22f,.04f);f.transform.localPosition=pos+new Vector3(Mathf.Cos(a)*.3f,1.2f*(1-u),Mathf.Sin(a)*.3f);}
                else if(id=="springWind"){f.transform.localScale=new Vector3(.18f,.04f,.09f);f.transform.localPosition=pos+new Vector3((u-.5f)*1.1f,.15f+Mathf.Sin(u*Mathf.PI)*.3f,Mathf.Sin(u*5+a)*.3f);f.transform.localRotation=Quaternion.Euler(0,(a+u*5)*Mathf.Rad2Deg,0);}
                else if(id=="abundance"){f.transform.localScale=Vector3.one*.12f*(1-u);f.transform.localPosition=pos+new Vector3(Mathf.Cos(a)*.3f,u*1.2f,Mathf.Sin(a)*.3f);f.transform.localRotation=Quaternion.Euler(0,u*286,0);}
                else{float r=.4f-u*.15f;f.transform.localScale=new Vector3(.09f,.18f,.09f);f.transform.localPosition=pos+new Vector3(Mathf.Cos(a+u*5)*r,.2f+Mathf.Sin(u*Mathf.PI)*.4f,Mathf.Sin(a+u*5)*r);f.transform.localRotation=Quaternion.Euler(0,u*401,0);}
            });}
        }
        void SyncAmbient(CellView cell,Tile tile)
        {
            bool needed=tile!=null&&(tile.spirits.Count>0||tile.guardians.Count>0);
            if(!needed){RemoveAmbient(cell.key);return;}
            if(!ambientViews.TryGetValue(cell.key,out var ambient)){
                var filter=MeshObject("Breathing spirits and guardian core",cell.terrain.transform.parent,glowMaterial);
                ambient=new AmbientView{filter=filter,phase=StableHash(cell.key)%97*.17f};ambientViews.Add(cell.key,ambient);
            }
            var b=new HabitatMeshBuilder();
            for(int i=0;i<Mathf.Min(5,tile.spirits.Count);i++){
                float a=i*1.7f+.6f,x=Mathf.Cos(a)*.33f,z=Mathf.Sin(a)*.33f;
                b.Part(Primitive("sphere"),new Vector3(x,Surface(cell,x,z)+.30f,z),Vector3.one*.105f,Quaternion.identity,ElementColor(tile.spirits[i].el));
            }
            if(tile.guardians.Count>0){
                Color c=Hex(0xf7df9f);int max=0;foreach(var power in tile.guardians[0].power)if(power.Value>max){max=power.Value;c=ElementColor(power.Key);}
                float h=Surface(cell,0,0);b.Part(Primitive("sphere"),new Vector3(0,h+.58f,0),new Vector3(.34f,.39f,.31f),Quaternion.identity,c);
                b.Part(Primitive("cone"),new Vector3(-.12f,h+.82f,0),new Vector3(.11f,.19f,.10f),Quaternion.Euler(0,20,-20),c);
                b.Part(Primitive("cone"),new Vector3(.12f,h+.82f,0),new Vector3(.11f,.19f,.10f),Quaternion.Euler(0,-20,20),c);
                b.Part(Primitive("sphere"),new Vector3(-.06f,h+.64f,-.143f),new Vector3(.028f,.043f,.025f),Quaternion.identity,Hex(0x3c514b));
                b.Part(Primitive("sphere"),new Vector3(.06f,h+.64f,-.143f),new Vector3(.028f,.043f,.025f),Quaternion.identity,Hex(0x3c514b));
                b.Ring(new Vector3(0,h+.055f,0),.31f,.325f,c,32);
            }
            ReplaceMesh(ambient.filter,ref ambient.mesh,b.Mesh("Ambient spirits "+cell.key));
        }
        void RemoveAmbient(string key)
        {
            if(!ambientViews.TryGetValue(key,out var ambient))return;if(ambient.mesh!=null)Destroy(ambient.mesh);
            if(ambient.filter!=null){ambient.filter.gameObject.SetActive(false);Destroy(ambient.filter.gameObject);}ambientViews.Remove(key);
        }
        void AmbientFeedback()
        {
            if(state==null)return;int generated=0,limit=FeedbackLow?4:8;creatingAmbient=true;
            foreach(var entry in cells){
                if(generated>=limit)break;if(!state.cells.TryGetValue(entry.Key,out var tile)||!Catalog.Types.TryGetValue(tile.type,out var def))continue;
                string look=def.look??"";bool water=look=="water"||look=="wet"||look=="pollute_water"||def.family=="ocean"||def.family=="river"||tile.spring||tile.pond;
                if(water&&UnityEngine.Random.value<.17f){Ring(CellWorldPosition(entry.Key)+new Vector3(.04f,.005f,.035f),Hex(0xcaf4f3),1.25f,.45f,0,.16f);generated++;}
                if((look=="lava"||def.family=="volcano")&&UnityEngine.Random.value<.10f){Burst(CellWorldPosition(entry.Key)+Vector3.up*.45f,Hex(0xff7a20),1,.15f,.8f,1.3f,"ember");generated++;}
                if(tile.beasts.Count>0&&UnityEngine.Random.value<.08f){Burst(CellWorldPosition(entry.Key)+Vector3.up*.65f,EffectColor(tile.beasts[0].el),1,.25f,.7f,.6f,"spark");generated++;}
            }
            creatingAmbient=false;
        }

        public int ActiveTransientEffectCount {get{int n=0;foreach(var f in feedbackObjects)if(!f.ambient)n++;return n;}}
        public int ActiveAmbientEffectCount => feedbackObjects.Count-ActiveTransientEffectCount;

        Mesh FeedbackMesh(string kind)
        {
            if(feedbackMeshes.TryGetValue(kind,out var mesh))return mesh;
            if(kind=="sphere"||kind=="cube"||kind=="cone"||kind=="cylinder")return Primitive(kind);
            var b=new HabitatMeshBuilder();Color white=Color.white;
            if(kind=="ring")b.Ring(Vector3.zero,.48f,.50f,white,48);
            else if(kind=="waveRing")b.Ring(Vector3.zero,.5f,.6f,white,48);
            else if(kind=="rune"){
                b.Ring(Vector3.zero,.30f,.308f,white,48);b.Ring(Vector3.zero,.39f,.398f,white,48);b.Ring(Vector3.zero,.435f,.443f,white,48);
                for(int i=0;i<12;i++){
                    float a=i*Mathf.PI/6;Vector3 outer=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a)),tangent=new Vector3(-outer.z,0,outer.x);
                    b.Quad(outer*.335f-tangent*.022f,outer*.38f-tangent*.003f,outer*.38f+tangent*.003f,outer*.335f+tangent*.022f,white);
                }
                for(int j=0;j<2;j++)for(int i=0;i<3;i++){
                    float a=i*Mathf.PI*2/3+j*Mathf.PI,c=(i+1)*Mathf.PI*2/3+j*Mathf.PI;Vector3 p=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a))*.265f,q=new Vector3(Mathf.Cos(c),0,Mathf.Sin(c))*.265f;
                    Vector3 off=Vector3.Cross(q-p,Vector3.up).normalized*.003f;b.Quad(p-off,p+off,q+off,q-off,white);
                }
            }else if(kind=="dome"){
                const int rows=8,cols=24;
                for(int row=0;row<=rows;row++)for(int col=0;col<=cols;col++){float p=Mathf.PI*.5f*row/rows,a=Mathf.PI*2*col/cols;b.Vertex(new Vector3(Mathf.Sin(p)*Mathf.Cos(a),Mathf.Cos(p),Mathf.Sin(p)*Mathf.Sin(a))*.5f,white);}
                for(int row=0;row<rows;row++)for(int col=0;col<cols;col++){int i=row*(cols+1)+col;b.Triangle(i,i+1,i+cols+1);b.Triangle(i+1,i+cols+2,i+cols+1);}
            }else if(kind=="tail"||kind=="beam"){
                const int sides=16;for(int i=0;i<sides;i++){float a=i*Mathf.PI*2/sides,c=(i+1)*Mathf.PI*2/sides;b.Quad(new Vector3(Mathf.Cos(a)*.26f,-.5f,Mathf.Sin(a)*.26f),new Vector3(Mathf.Cos(a)*.10f,.5f,Mathf.Sin(a)*.10f),new Vector3(Mathf.Cos(c)*.10f,.5f,Mathf.Sin(c)*.10f),new Vector3(Mathf.Cos(c)*.26f,-.5f,Mathf.Sin(c)*.26f),white);}
            }else if(kind=="ico"){
                float g=(1+Mathf.Sqrt(5))*.5f;Vector3[] p={new Vector3(-1,g,0),new Vector3(1,g,0),new Vector3(-1,-g,0),new Vector3(1,-g,0),new Vector3(0,-1,g),new Vector3(0,1,g),new Vector3(0,-1,-g),new Vector3(0,1,-g),new Vector3(g,0,-1),new Vector3(g,0,1),new Vector3(-g,0,-1),new Vector3(-g,0,1)};
                int[] faces={0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1};
                for(int i=0;i<faces.Length;i+=3){int a=b.Vertex(p[faces[i]].normalized*.5f,white);b.Vertex(p[faces[i+1]].normalized*.5f,white);b.Vertex(p[faces[i+2]].normalized*.5f,white);b.Triangle(a,a+1,a+2);}            }else {
                // Octahedra and droplets stay visually distinct from rounded dust and sparks.
                Vector3[] p={Vector3.up*(kind=="drop"?.72f:.5f),Vector3.down*.5f,Vector3.right*.5f,Vector3.forward*.5f,Vector3.left*.5f,Vector3.back*.5f};
                for(int i=0;i<4;i++){int a=b.Vertex(p[0],white);b.Vertex(p[2+i],white);b.Vertex(p[2+(i+1)%4],white);b.Triangle(a,a+1,a+2);int c=b.Vertex(p[1],white);b.Vertex(p[2+(i+1)%4],white);b.Vertex(p[2+i],white);b.Triangle(c,c+1,c+2);}
            }
            mesh=b.Mesh("Shared feedback "+kind);feedbackMeshes.Add(kind,mesh);return mesh;
        }
    }
}
