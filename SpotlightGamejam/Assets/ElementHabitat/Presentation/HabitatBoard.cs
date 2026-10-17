using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace ElementHabitat
{
    /// <summary>Native miniature landscape. Presentation reads state and never mutates the rules.</summary>
    public sealed partial class HabitatBoard : MonoBehaviour
    {
        const float Spacing=1.12f, Half=Spacing*.5f, WallBottom=-.34f;
        static readonly string[] ElementKeys={"metal","wood","water","fire","earth"};
        static readonly Color[] ElementColors={Hex(0xffcf4b),Hex(0x66d64c),Hex(0x42b9ed),Hex(0xff7651),Hex(0xd99c64)};
        readonly Dictionary<string,CellView> cells=new Dictionary<string,CellView>();
        readonly Dictionary<Collider,string> pickCells=new Dictionary<Collider,string>();
        readonly Dictionary<string,Look> looks=new Dictionary<string,Look>();
        readonly Dictionary<string,Mesh> primitives=new Dictionary<string,Mesh>();
        readonly List<Mesh> permanentMeshes=new List<Mesh>();
        readonly HashSet<string> legal=new HashSet<string>();
        readonly HashSet<string> shape=new HashSet<string>();
        readonly Dictionary<string,Vector2Int> footprintCoordinates=new Dictionary<string,Vector2Int>();
        readonly HashSet<string> rangePreview=new HashSet<string>();
        readonly List<MeshFilter> cloudBanks=new List<MeshFilter>();
        Action<string> onCellSelected;
        State state;
        Transform landscape,clouds,effects;
        Camera boardCamera;
        Material terrainMaterial,glowMaterial,shieldMaterial;
        Transform shieldRoot;
        string shieldSignature;
        MeshFilter frames;
        Mesh frameMesh,baseMesh;
        MeshFilter baseFilter,horizon;
        Mesh[] cloudVariants;
        Volume atmosphere;
        VolumeProfile atmosphereProfile;
        DepthOfField depthOfField;
        bool initialized,reducedMotion,atmosphereEnabled=true;
        string selected,hover;
        bool hasRendered;
        Color rangeColor;
        Vector2Int windowCenter=new Vector2Int(int.MinValue,int.MinValue);
        int windowRadius;
        float minWorldX=-8,maxWorldX=8,minWorldZ=-8,maxWorldZ=8;

        sealed class CellView { public string key,signature,surfaceSignature; public Vector2Int coordinate; public MeshFilter terrain,scenery; public MeshCollider collider; public Mesh terrainMesh,sceneryMesh; public double landingBorn=-1,popBorn=-1,impactBorn=-1; }
        struct Look { public Color color; public float height; public Look(uint c,float h=.12f) { color=Hex(c);height=h; } }

        public Camera Camera => boardCamera;
        public int ActiveEffectCount => feedbackObjects.Count;
        public int QueuedEffectCount => feedbackQueue.Count;

        public void Initialize(Action<string> callback)
        {
            onCellSelected=callback;
            if(initialized)return;
            initialized=true;
            BuildPalette();
            var shader=Resources.Load<Shader>("HabitatTerrain");
            if(shader==null)shader=Shader.Find("ElementHabitat/Terrain");
            if(shader==null)shader=Shader.Find("Universal Render Pipeline/Lit");
            terrainMaterial=new Material(shader) { name="Habitat shared vertex colors",enableInstancing=true };
            glowMaterial=new Material(terrainMaterial) { name="Habitat luminous accents" };
            glowMaterial.SetFloat("_EmissionStrength",.25f);
            var shieldShader=Resources.Load<Shader>("HabitatShield");
            if(shieldShader!=null)shieldMaterial=new Material(shieldShader){name="Quiet honeycomb shields"};
            landscape=Child("Continuous square landscape").transform;
            clouds=Child("Rounded cloud sea").transform;
            effects=Child("Recycled feedback").transform;
            shieldRoot=Child("Persistent elemental shields").transform;
            InitializeFeedback();
            foreach(string key in Game.Shape){shape.Add(key);var p=Game.Parse(key);footprintCoordinates.Add(key,new Vector2Int(p[0],p[1]));}
            foreach(string key in Game.Shape)AddCell(key);
            BuildBase();BuildClouds();BuildCamera();
            frames=MeshObject("Selection and legal placements",landscape,glowMaterial);
            frames.GetComponent<MeshRenderer>().shadowCastingMode=ShadowCastingMode.Off;
            SetAtmosphere(atmosphereEnabled);
        }

        void BuildPalette()
        {
            looks["ruin"]=new Look(0xd7b981);looks["pollute_water"]=new Look(0x98b978,.10f);
            looks["pollute_earth"]=new Look(0xa6b95c);looks["pollute_rock"]=new Look(0xaa97b7,.15f);
            looks["barren"]=new Look(0xdfbd79);looks["rock"]=new Look(0xc7b9a3,.155f);
            looks["sand"]=new Look(0xf1d78c);looks["bare"]=new Look(0xc9ae84,.20f);
            looks["grass"]=new Look(0x91cf60);looks["water"]=new Look(0xf0d390,.10f);
            looks["lava"]=new Look(0x9d7061,.14f);looks["waste"]=new Look(0xcfb678);
            looks["peak"]=new Look(0xb8d3df,.25f);looks["forest"]=new Look(0x70b450);
            looks["wet"]=new Look(0x71c6a3,.11f);looks["mine"]=new Look(0xc5a174,.15f);
            looks["valley"]=new Look(0x95d069);looks["rain"]=new Look(0x56ab60);
            looks["fertile"]=new Look(0xaacb54);looks["creek"]=new Look(0x8ed28b);
        }

        public void Render(State next,string selectedCell,ICollection<string> legalCells)
        {
            if(!initialized)Initialize(onCellSelected);
            if(state!=null&&!ReferenceEquals(state,next)){ClearFeedback();hasRendered=false;StartCameraIntro(.6f);rangePreview.Clear();}
            state=next;selected=selectedCell;legal.Clear();
            if(legalCells!=null)foreach(var key in legalCells)legal.Add(key);
            var keys=Game.BoardKeys(state);bool footprintChanged=!shape.SetEquals(keys);
            if(footprintChanged) {
                shape.Clear();footprintCoordinates.Clear();foreach(var key in keys){shape.Add(key);var p=Game.Parse(key);footprintCoordinates.Add(key,new Vector2Int(p[0],p[1]));}
                minWorldX=minWorldZ=float.MaxValue;maxWorldX=maxWorldZ=float.MinValue;
                foreach(var p in footprintCoordinates.Values){float x=(p.x-3)*Spacing,z=(p.y-3)*Spacing;minWorldX=Mathf.Min(minWorldX,x);maxWorldX=Mathf.Max(maxWorldX,x);minWorldZ=Mathf.Min(minWorldZ,z);maxWorldZ=Mathf.Max(maxWorldZ,z);}
            }
            bool windowChanged=SyncVisibleCells(footprintChanged);
            RenderVisibleCells();hasRendered=true;
            if(windowChanged||footprintChanged){BuildBase();RefreshCloudBanks();shieldSignature=null;}
            RebuildFrames();
            RebuildShields();
            SetFocus(selectedCell);
        }

        void AddCell(string key)
        {
            var p=Game.Parse(key);var root=new GameObject("Cell "+key);root.transform.SetParent(landscape,false);root.transform.localPosition=World(key);
            var view=new CellView{key=key,coordinate=new Vector2Int(p[0],p[1])};view.terrain=MeshObject("Shared terrain",root.transform,terrainMaterial);
            view.collider=view.terrain.gameObject.AddComponent<MeshCollider>();pickCells.Add(view.collider,key);view.scenery=MeshObject("Miniature scenery",root.transform,terrainMaterial);cells.Add(key,view);
        }

        // State has no world-size limit. Only the camera neighbourhood owns native render objects.
        // This bounds colliders, meshes and draw calls while retaining every rule cell in State.
        bool SyncVisibleCells(bool force=false)
        {
            Vector2Int center=new Vector2Int(Mathf.RoundToInt(cameraTarget.x/Spacing)+3,Mathf.RoundToInt(cameraTarget.z/Spacing)+3);
            int radius=Mathf.Clamp(Mathf.CeilToInt(distance*.72f/Spacing),10,19);
            if(!force&&center==windowCenter&&radius==windowRadius)return false;
            bool viewportChanged=center!=windowCenter||radius!=windowRadius;
            windowCenter=center;windowRadius=radius;var wanted=new HashSet<string>();
            foreach(var entry in footprintCoordinates) {
                Vector2Int p=entry.Value;if(shape.Count<=900||Mathf.Abs(p.x-center.x)<=radius&&Mathf.Abs(p.y-center.y)<=radius)wanted.Add(entry.Key);
            }
            bool changed=false;var removed=new List<string>();foreach(var key in cells.Keys)if(!wanted.Contains(key))removed.Add(key);
            foreach(var key in removed) {var view=cells[key];RemoveAmbient(key);pickCells.Remove(view.collider);if(view.terrainMesh!=null)Destroy(view.terrainMesh);if(view.sceneryMesh!=null)Destroy(view.sceneryMesh);view.terrain.transform.parent.gameObject.SetActive(false);Destroy(view.terrain.transform.parent.gameObject);cells.Remove(key);changed=true;}
            foreach(var key in wanted)if(!cells.ContainsKey(key)){AddCell(key);changed=true;}
            return changed||viewportChanged;
        }

        void RenderVisibleCells()
        {
            if(state==null)return;
            foreach(var cell in cells.Values) {
                var surface=new StringBuilder();
                for(int z=-1;z<=1;z++)for(int x=-1;x<=1;x++) {
                    string k=(cell.coordinate.x+x)+","+(cell.coordinate.y+z);surface.Append(shape.Contains(k)?'1':'0');
                    if(state.cells.TryGetValue(k,out var neighbor)){surface.Append(neighbor.type);foreach(int a in neighbor.attrs)surface.Append('/').Append(a);}
                }
                string signature=surface.ToString();bool groundChanged=cell.surfaceSignature!=signature;
                if(groundChanged){ReplaceMesh(cell.terrain,ref cell.terrainMesh,BuildTerrain(cell),cell.collider);cell.surfaceSignature=signature;}
                bool isTower=cell.key==Game.TOWER_CELL;
                string fingerprint=isTower?TowerFingerprint():state.cells.TryGetValue(cell.key,out var tile)?Fingerprint(tile):"empty";
                if(groundChanged||cell.signature!=fingerprint) {
                    if(hasRendered&&cell.signature=="empty"&&fingerprint!="empty")BeginLanding(cell);
                    state.cells.TryGetValue(cell.key,out var terrain);
                    ReplaceMesh(cell.scenery,ref cell.sceneryMesh,isTower?BuildTower(cell):BuildScenery(cell,terrain));cell.signature=fingerprint;SyncAmbient(cell,terrain);
                }
            }
        }

        string TowerFingerprint()
        {
            var text=new StringBuilder("tower");if(state?.tower!=null){foreach(var e in ElementKeys)text.Append('/').Append(state.tower.shelter[e]).Append('/').Append(state.tower.spring[e]);}return text.ToString();
        }

        public void SetRangePreview(IEnumerable<string> keys,string element="water")
        {
            rangePreview.Clear();if(keys!=null)foreach(var key in keys)rangePreview.Add(key);rangeColor=Color.Lerp(ElementColor(element),Color.white,.18f);RebuildFrames();
        }
        public void ClearRangePreview(){rangePreview.Clear();RebuildFrames();}

        void RebuildShields()
        {
            if(shieldMaterial==null||state==null)return;
            var signature=new StringBuilder();
            foreach(var shield in state.shields) {signature.Append(shield.id);foreach(var item in shield.defense)signature.Append(item.Key).Append(item.Value);foreach(var cell in shield.cells)signature.Append(cell);}
            string current=signature.ToString();if(current==shieldSignature)return;shieldSignature=current;
            for(int i=shieldRoot.childCount-1;i>=0;i--){var child=shieldRoot.GetChild(i).gameObject;child.SetActive(false);Destroy(child);}
            var covered=new HashSet<string>();
            foreach(var shield in state.shields)foreach(var key in shield.cells)if(cells.TryGetValue(key,out var cell)&&state.cells.ContainsKey(key)&&covered.Add(key)) {
                var filter=MeshObject("Honeycomb cover "+key,shieldRoot,shieldMaterial);filter.sharedMesh=FeedbackMesh("dome");
                filter.transform.localPosition=World(key)+Vector3.up*(Surface(cell,0,0)+.03f);filter.transform.localScale=new Vector3(1.14f,1.45f,1.14f);
                var renderer=filter.GetComponent<MeshRenderer>();renderer.shadowCastingMode=ShadowCastingMode.Off;
                string main="metal";foreach(string el in ElementKeys)if(shield.defense[el]>shield.defense[main])main=el;
                var properties=new MaterialPropertyBlock();Color tint=EffectColor(main);tint.a=.30f;properties.SetColor("_BaseColor",tint);properties.SetFloat("_Motion",reducedMotion?0:1);renderer.SetPropertyBlock(properties);
            }
        }

        static string Fingerprint(Tile t)
        {
            var s=new StringBuilder(t.type);
            foreach(int a in t.attrs)s.Append('/').Append(a);
            foreach(var list in new[]{t.spirits,t.cancers,t.beasts,t.plants,t.animals}) {
                s.Append('|');foreach(var u in list)s.Append(u.id).Append(u.kind).Append(u.el).Append(',');
            }
            s.Append('|').Append(t.guardians.Count).Append('|').Append(t.ores.Count);
            s.Append(t.spring).Append(t.pond).Append(t.farm).Append(t.vein).Append(t.shelter).Append(t.oasis);
            return s.ToString();
        }

        Look GetLook(string key)
        {
            if(key==Game.TOWER_CELL)return new Look(0xdacfa7,.16f);
            if(state!=null && state.cells.TryGetValue(key,out Tile tile) && Catalog.Types.TryGetValue(tile.type,out var def) && looks.TryGetValue(def.look??"grass",out Look look))return look;
            return new Look(0xa395aa,.11f);
        }
        Color CellColor(int x,int z)
        {
            string key=x+","+z;Color color=GetLook(key).color;
            if(state!=null && state.cells.TryGetValue(key,out Tile tile)) {
                int max=0,element=0;bool negative=false;
                for(int i=0;i<tile.attrs.Length;i++){if(tile.attrs[i]<0)negative=true;if(tile.attrs[i]>max){max=tile.attrs[i];element=i;}}
                if(negative)color=Color.Lerp(color,Hex(0x76645d),.2f);
                if(max>0)color=Color.Lerp(color,ElementColors[element],.08f);
            }
            return color;
        }
        float Height(float x,float z)
        {
            int bx=Mathf.FloorToInt(x),bz=Mathf.FloorToInt(z);
            float u=Smooth(x-bx),v=Smooth(z-bz);
            float h=Mathf.Lerp(Mathf.Lerp(GetLook(bx+","+bz).height,GetLook((bx+1)+","+bz).height,u),Mathf.Lerp(GetLook(bx+","+(bz+1)).height,GetLook((bx+1)+","+(bz+1)).height,u),v);
            return h+Mathf.Sin(x*1.13f+z*.39f)*Mathf.Cos(z*.92f-x*.25f)*.012f;
        }
        Color GroundColor(float x,float z)
        {
            int bx=Mathf.FloorToInt(x),bz=Mathf.FloorToInt(z);
            float u=Smooth(Mathf.Clamp01((x-bx-.32f)/.36f)),v=Smooth(Mathf.Clamp01((z-bz-.32f)/.36f));
            return Color.Lerp(Color.Lerp(CellColor(bx,bz),CellColor(bx+1,bz),u),Color.Lerp(CellColor(bx,bz+1),CellColor(bx+1,bz+1),u),v);
        }
        float Surface(CellView cell,float x,float z) { return Height(cell.coordinate.x+x/Spacing,cell.coordinate.y+z/Spacing); }
        static float Smooth(float t) {return t*t*(3-2*t);}
        static Vector3 World(string key) {var p=Game.Parse(key);return new Vector3((p[0]-3)*Spacing,0,(p[1]-3)*Spacing);}

        Mesh BuildTerrain(CellView cell)
        {
            var b=new HabitatMeshBuilder();const int segments=8;
            for(int z=0;z<=segments;z++)for(int x=0;x<=segments;x++) {
                float px=-Half+x*Spacing/segments,pz=-Half+z*Spacing/segments;
                b.Vertex(new Vector3(px,Surface(cell,px,pz),pz),GroundColor(cell.coordinate.x+px/Spacing,cell.coordinate.y+pz/Spacing));
            }
            for(int z=0;z<segments;z++)for(int x=0;x<segments;x++) {
                int a=z*(segments+1)+x;b.Triangle(a,a+segments+1,a+1);b.Triangle(a+1,a+segments+1,a+segments+2);
            }
            Vector2Int[] offsets={new Vector2Int(0,-1),new Vector2Int(1,0),new Vector2Int(0,1),new Vector2Int(-1,0)};
            for(int side=0;side<4;side++) {
                var off=offsets[side];if(shape.Contains((cell.coordinate.x+off.x)+","+(cell.coordinate.y+off.y)))continue;
                for(int i=0;i<segments;i++) {
                    Vector2 a=EdgePoint(side,(float)i/segments),c=EdgePoint(side,(float)(i+1)/segments);
                    bool unplaced=cell.key!=Game.TOWER_CELL&&(state==null||!state.cells.ContainsKey(cell.key));
                    Color top=Color.Lerp(GroundColor(cell.coordinate.x+a.x/Spacing,cell.coordinate.y+a.y/Spacing),Hex(unplaced?0x625868u:0x89613fu),.56f),bottom=Hex(unplaced?0x544959u:0x956b45u);
                    b.Quad(new Vector3(a.x,Surface(cell,a.x,a.y),a.y),new Vector3(c.x,Surface(cell,c.x,c.y),c.y),new Vector3(c.x,WallBottom,c.y),new Vector3(a.x,WallBottom,a.y),top,bottom);
                }
            }
            var mesh=b.Mesh("Continuous terrain "+cell.key);
            // Both sides of a shared edge use the same analytic world normal as well as height/color.
            var normals=mesh.normals;const float epsilon=.002f;
            for(int z=0;z<=segments;z++)for(int x=0;x<=segments;x++) {
                float wx=cell.coordinate.x-.5f+(float)x/segments,wz=cell.coordinate.y-.5f+(float)z/segments;
                float dx=(Height(wx+epsilon,wz)-Height(wx-epsilon,wz))/(2*epsilon*Spacing);
                float dz=(Height(wx,wz+epsilon)-Height(wx,wz-epsilon))/(2*epsilon*Spacing);
                normals[z*(segments+1)+x]=new Vector3(-dx,1,-dz).normalized;
            }
            mesh.normals=normals;return mesh;
        }
        static Vector2 EdgePoint(int side,float t)
        {
            float p=Mathf.Lerp(-Half,Half,t);
            if(side==0)return new Vector2(p,-Half);if(side==1)return new Vector2(Half,p);if(side==2)return new Vector2(-p,Half);return new Vector2(-Half,-p);
        }

        void BuildBase()
        {
            var b=new HabitatMeshBuilder();Color color=Hex(0x75677a);
            foreach(var entry in cells) {
                var cell=entry.Value;Vector3 p=World(cell.key);
                b.Quad(p+new Vector3(-Half,WallBottom,-Half),p+new Vector3(-Half,WallBottom,Half),p+new Vector3(Half,WallBottom,Half),p+new Vector3(Half,WallBottom,-Half),color);
                for(int side=0;side<4;side++) {
                    var a=EdgePoint(side,0);var c=EdgePoint(side,1);int nx=cell.coordinate.x+(side==1?1:side==3?-1:0),nz=cell.coordinate.y+(side==2?1:side==0?-1:0);
                    if(shape.Contains(nx+","+nz))continue;
                    b.Quad(p+new Vector3(a.x,WallBottom,a.y),p+new Vector3(c.x,WallBottom,c.y),p+new Vector3(c.x,-.43f,c.y),p+new Vector3(a.x,-.43f,a.y),color,Hex(0x574b60));
                }
            }
            if(baseFilter==null)baseFilter=MeshObject("Thin earth foundation",landscape,terrainMaterial);
            ReplaceMesh(baseFilter,ref baseMesh,b.Mesh("Underside below terrain walls"));
        }

        void BuildClouds()
        {
            var sky=new HabitatMeshBuilder();sky.Quad(new Vector3(-90,-2.8f,-90),new Vector3(-90,-2.8f,90),new Vector3(90,-2.8f,90),new Vector3(90,-2.8f,-90),Hex(0xd4e5ed));
            var skyMesh=sky.Mesh("Cloud sea horizon");permanentMeshes.Add(skyMesh);horizon=MeshObject("Pale blue horizon",clouds,terrainMaterial);horizon.sharedMesh=skyMesh;horizon.GetComponent<MeshRenderer>().shadowCastingMode=ShadowCastingMode.Off;
            cloudVariants=new Mesh[4];for(int i=0;i<4;i++){cloudVariants[i]=HabitatCloudMesh.Create(i);permanentMeshes.Add(cloudVariants[i]);}
            RefreshCloudBanks();
        }

        void RefreshCloudBanks()
        {
            if(cloudVariants==null)return;
            Vector3 center=new Vector3(Mathf.Round(cameraTarget.x/4)*4,0,Mathf.Round(cameraTarget.z/4)*4);horizon.transform.localPosition=center;
            var random=new System.Random(1729);
            int used=0;
            for(int row=0;row<15;row++)for(int column=0;column<15;column++) {
                float x=center.x-28+column*4+(row%2)*2+(float)random.NextDouble()*.7f,z=center.z-28+row*4+(float)random.NextDouble()*.7f,s=1.35f+(float)random.NextDouble()*.35f;
                float nearest=float.MaxValue;
                int cx=Mathf.RoundToInt(x/Spacing)+3,cz=Mathf.RoundToInt(z/Spacing)+3;
                // Hash lookup of nearby squares keeps cloud clearance independent of endless-world size.
                for(int iz=-4;iz<=4;iz++)for(int ix=-4;ix<=4;ix++)if(shape.Contains((cx+ix)+","+(cz+iz))) {
                    float dx=Mathf.Max(Mathf.Abs(x-(cx+ix-3)*Spacing)-Half,0),dz=Mathf.Max(Mathf.Abs(z-(cz+iz-3)*Spacing)-Half,0);nearest=Mathf.Min(nearest,Mathf.Sqrt(dx*dx+dz*dz));
                }
                if(nearest<1.8f*s+.28f)continue;
                MeshFilter filter;
                if(used<cloudBanks.Count)filter=cloudBanks[used];else {filter=MeshObject("Rounded bank",clouds,terrainMaterial);cloudBanks.Add(filter);}
                used++;filter.gameObject.SetActive(true);filter.sharedMesh=cloudVariants[random.Next(4)];
                filter.transform.localPosition=new Vector3(x,-1.03f+(float)random.NextDouble()*.15f,z);cloudHomes[filter.transform]=filter.transform.localPosition;
                filter.transform.localScale=new Vector3(s,s*.78f,s);filter.transform.localRotation=Quaternion.Euler(0,35+(float)random.NextDouble()*25,0);
                var renderer=filter.GetComponent<MeshRenderer>();renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;
            }
            for(int i=used;i<cloudBanks.Count;i++)cloudBanks[i].gameObject.SetActive(false);
        }

        Mesh BuildTower(CellView cell)
        {
            var b=new HabitatMeshBuilder();float ground=Surface(cell,0,0),height=1.08f;int level=1;
            if(state?.tower!=null)foreach(var element in ElementKeys)level=Mathf.Max(level,Mathf.Max(state.tower.shelter[element],state.tower.spring[element]));
            height+=(level-1)*.055f;
            void Part(string mesh,Vector3 p,Vector3 scale,uint color){b.Part(Primitive(mesh),p+Vector3.up*ground,scale,Quaternion.identity,Hex(color));}
            Part("cylinder",new Vector3(0,.065f,0),new Vector3(.86f,.13f,.86f),0xd9cda9);
            Part("cylinder",new Vector3(0,.15f,0),new Vector3(.67f,.10f,.67f),0xf0dfb4);
            Part("cylinder",new Vector3(0,height*.43f+.17f,0),new Vector3(.40f,height*.86f,.40f),0xe8ddbf);
            Part("cylinder",new Vector3(0,height+.13f,0),new Vector3(.58f,.12f,.58f),0xf1e2bd);
            Part("cone",new Vector3(0,height+.34f,0),new Vector3(.70f,.35f,.70f),0x739f92);
            Part("sphere",new Vector3(0,height+.58f,0),new Vector3(.20f,.24f,.20f),0xffdc8d);
            Part("cube",new Vector3(0,.43f,-.207f),new Vector3(.12f,.22f,.025f),0x82b7be);
            Part("cube",new Vector3(-.207f,.70f,0),new Vector3(.025f,.17f,.11f),0x82b7be);
            for(int i=0;i<5;i++) {
                float a=i*Mathf.PI*2/5+.32f;Color color=ElementColors[i];float crystalHeight=.17f+(state?.tower==null?1:state.tower.shelter[ElementKeys[i]])*.022f;
                b.Part(Primitive("crystal"),new Vector3(Mathf.Cos(a)*.31f,ground+.23f,Mathf.Sin(a)*.31f),new Vector3(.11f,crystalHeight,.11f),Quaternion.Euler(0,i*72,0),color);
                b.Ring(new Vector3(0,ground+.18f+i*.004f,0),.38f+i*.006f,.387f+i*.006f,Color.Lerp(color,Color.white,.2f),32);
            }
            return b.Mesh("Permanent five-element guardian tower");
        }

        Mesh BuildScenery(CellView cell,Tile tile)
        {
            var b=new HabitatMeshBuilder();if(tile==null)return b.Mesh("Unplaced cell");
            if(!Catalog.Types.TryGetValue(tile.type,out var def))return b.Mesh("Unknown tile");
            string look=def.look??"grass",family=def.family??"";int level=Mathf.Max(1,def.level);
            var rnd=new System.Random(StableHash(cell.key));
            float R(){return ((float)rnd.NextDouble()-.5f)*.66f;}
            void Part(string primitive,float x,float y,float z,float sx,float sy,float sz,uint color,float angle=0) { b.Part(Primitive(primitive),new Vector3(x,Surface(cell,x,z)+y,z),new Vector3(sx,sy,sz),Quaternion.Euler(0,angle,0),Hex(color)); }
            void Rock(float x,float z,float size,uint color=0xc2b7a4) {Part("rock",x,size*.32f,z,size,size*.72f,size*.85f,color,rnd.Next(360));}
            void Tree(float x,float z,float scale,bool pine=false) {
                Part("cylinder",x,.18f*scale,z,.075f*scale,.36f*scale,.075f*scale,0x91603d);
                if(pine) {Part("cone",x,.43f*scale,z,.47f*scale,.55f*scale,.47f*scale,0x397c4d);Part("cone",x,.61f*scale,z,.35f*scale,.43f*scale,.35f*scale,0x63ab53);}
                else {Part("sphere",x,.44f*scale,z,.48f*scale,.48f*scale,.44f*scale,0x69b448);Part("sphere",x+.1f*scale,.52f*scale,z-.05f*scale,.32f*scale,.35f*scale,.34f*scale,0x87ce57);}
            }
            void Tuft(float x,float z,float scale=1) {for(int i=0;i<3;i++)Part("cone",x+(i-1)*.035f,.065f*scale,z,.045f,.13f*scale,.045f,0x56a34b,i*30);}
            void Pool(float size,bool dirty=false) {
                Part("sphere",0,.014f,0,size,.035f,size*.83f,dirty?0x7f9862u:0xf5dea2u);
                Part("sphere",0,.035f,0,size*.87f,.035f,size*.72f,dirty?0x7f9d75u:0x44bce6u);
                b.Ring(new Vector3(.04f,Surface(cell,0,0)+.058f,.035f),size*.24f,size*.25f,Hex(0xcaf4f3),22,.76f);
                if(!dirty)Part("sphere",-.17f,.06f,.1f,.12f,.015f,.10f,0x86c660);
            }
            bool dirty=look.StartsWith("pollute")||level==1&&(family=="woodland"||family=="ocean"||family=="wetland");
            if(family=="ice") {
                Part("sphere",0,.035f,0,.92f,.09f,.88f,0xc5e7ef);
                for(int i=0;i<(def.branchKey=="A"?3:2);i++)Part("crystal",-.25f+i*.2f,.19f+(level-1)*.025f,-.08f,.19f,.38f+(level-1)*.05f,.23f,i%2==0?0x88c8dfu:0xe4f7f3u,18+i*40);
                if(def.branchKey=="B")Pool(.5f);
            }
            else if(family=="volcano" || look=="lava") {
                Part("cone",0,.27f,0,.84f,.54f,.78f,0x77635f,18);
                Part("sphere",0,.50f,0,.30f,.035f,.25f,def.branchKey=="B"?0xd69469u:0xffac53u);
                for(int i=0;i<4;i++) {float angle=i*Mathf.PI*.5f;Rock(Mathf.Cos(angle)*.31f,Mathf.Sin(angle)*.31f,.16f,0x9a7a63);}
                if(def.branchKey=="B") {Tuft(.28f,.25f);Tuft(-.25f,.28f);}
                else Part("sphere",.13f,.18f,.26f,.13f,.035f,.30f,0xffa34f);
            }
            else if(look=="forest"||look=="rain"||family=="woodland") {
                int n=look=="rain"?5:3;
                for(int i=0;i<n;i++) {float a=i*Mathf.PI*2/n;Tree(Mathf.Cos(a)*.26f,Mathf.Sin(a)*.25f,.72f+(float)rnd.NextDouble()*.25f,look=="rain"||i==0);}
                if(def.branchKey=="A") {Part("cylinder",.28f,.075f,.27f,.16f,.15f,.16f,0xb7824b);Part("sphere",.28f,.15f,.27f,.13f,.018f,.13f,0xe3bd7f);}
            }
            else if(look=="peak"||look=="bare") {
                bool snow=look=="peak";
                Part("rock",0,.08f,.04f,.79f,.22f,.69f,snow?0xb4cbd2u:0xd2b18au);
                Part("cone",.04f,.40f,-.04f,.65f,.8f,.64f,snow?0x99bac9u:0xbba17fu,15);
                Part("cone",-.22f,.24f,.16f,.36f,.48f,.36f,snow?0x9bb5bcu:0xc8a77du,42);
                if(snow)Part("cone",.04f,.69f,-.04f,.25f,.25f,.25f,0xf2fcfa,15);
                else Tree(.28f,.22f,.45f,true);
            }
            else if(look=="rock"||look=="pollute_rock"||family=="mine"||look=="mine") {
                Rock(-.16f,-.05f,.42f,dirty?0x93829du:0xb6b6b1u);Rock(.23f,.15f,.32f,0x9eaaa8);
                if(level>=2 || family=="mine") {
                    Part("cube",0,.14f,-.27f,.31f,.28f,.10f,0x544638);
                    Part("cube",-.17f,.15f,-.21f,.06f,.32f,.07f,0xb98b50);Part("cube",.17f,.15f,-.21f,.06f,.32f,.07f,0xb98b50);Part("cube",0,.32f,-.21f,.42f,.065f,.08f,0xd4ac6c);
                    Part("crystal",.25f,.15f,.29f,.16f,.28f,.16f,def.branchKey=="B"?0x78d4cfu:0xf3cd65u,20);
                }
            }
            else if(look=="water"||look=="wet"||look=="pollute_water"||family=="ocean"||family=="wetland") {
                Pool(.94f,dirty);
                if(family=="ocean") {for(int i=0;i<3;i++)Part("sphere",-.27f+i*.13f,.10f,.27f,.1f,.14f,.1f,i%2==0?0xf2b4a2u:0xd3beecu);}
                else {Tuft(-.34f,.19f,1.4f);Tuft(.32f,-.19f,1.3f);}
            }
            else if(look=="ruin"||family=="ruins") {
                Part("cube",-.15f,.12f,-.21f,.42f,.24f,.10f,0xddceb0);Part("cube",-.31f,.085f,-.02f,.1f,.17f,.34f,0xc4b895);
                for(int i=0;i<(level>=3?3:1);i++) {float x=.20f-i*.18f;Part("cylinder",x,.19f,.10f,.12f,.38f,.12f,0xe7d8b9);Part("cube",x,.39f,.10f,.19f,.045f,.17f,0xd1bc94);}
                if(def.branchKey=="A")Part("cube",0,.1f,.30f,.35f,.2f,.19f,0xb88850);
                else if(def.branchKey=="B")Part("crystal",0,.22f,.29f,.18f,.38f,.18f,0x78d7d1);
                Tuft(.27f,-.26f);
            }
            else if(look=="sand"||family=="desert") {
                Part("sphere",-.17f,.07f,-.1f,.64f,.20f,.48f,0xe7c27c);Part("sphere",.23f,.035f,.13f,.47f,.12f,.38f,0xf4d994);
                if(def.branchKey=="B") {Pool(.58f);Tree(-.32f,-.22f,.55f);}
                else {Part("cylinder",.24f,.17f,-.22f,.09f,.34f,.09f,0x74a662);Part("sphere",.24f,.34f,-.22f,.09f,.08f,.09f,0x86b872);if(level>=3)Part("crystal",-.22f,.18f,.23f,.18f,.30f,.17f,0xeec264);}
            }
            else {
                for(int i=0;i<3;i++)Tuft(R(),R(),.8f+(float)rnd.NextDouble()*.3f);
                if(look=="grass"||look=="fertile")for(int i=0;i<3;i++) {float x=R(),z=R();Part("sphere",x,.11f,z,.075f,.05f,.075f,i%2==0?0xf1b5c2u:0xf2dd75u);}
                if(look=="barren"||look=="waste")Rock(.22f,-.20f,.18f,0xc5a479);
                if(def.branchKey=="A"&&family=="grassland")for(int row=0;row<3;row++)for(int i=0;i<3;i++)Part("cone",-.23f+row*.2f,.1f,-.22f+i*.2f,.09f,.19f,.075f,0xd8c260);
                if(def.branchKey=="B"&&family=="grassland")for(int i=0;i<3;i++)Part("cube",-.33f+i*.32f,.1f,-.36f,.035f,.20f,.035f,0xc4a174);
                if(look=="valley"||look=="creek"||family=="river") {Part("sphere",.02f,.015f,0,.24f,.035f,.99f,0xe4dba4);Part("sphere",.02f,.036f,0,.17f,.032f,.98f,0x5ac3d6);}
            }
            // Staged silhouettes and the same warm/cool branch markers as the web version.
            if(level>=3)for(int i=0;i<level-2;i++)Part("crystal",.37f-i*.13f,.12f+i*.015f,.37f,.075f,.17f+i*.025f,.075f,def.branchKey=="A"?0xffd17eu:0x8ee0d6u,15);
            if(tile.spring||tile.pond||tile.oasis) {Part("sphere",-.29f,.025f,.27f,.32f,.035f,.25f,0x57c8e2);b.Ring(new Vector3(-.29f,Surface(cell,-.29f,.27f)+.05f,.27f),.09f,.10f,Hex(0xe3f8f1),18);}
            if(tile.farm)for(int i=0;i<3;i++)Part("cube",-.25f+i*.16f,.025f,.24f,.07f,.04f,.3f,0x99784b);
            if(tile.shelter) {Part("cube",.27f,.15f,-.27f,.21f,.25f,.20f,0xd4ac76);Part("cone",.27f,.32f,-.27f,.34f,.18f,.30f,0x9a7855,45);}
            for(int i=0;i<Mathf.Min(5,tile.plants.Count);i++) {
                var plant=tile.plants[i];float a=1+i*2.399f,x=Mathf.Cos(a)*.33f,z=Mathf.Sin(a)*.33f;
                if(plant.kind=="tree")Tree(x,z,.50f);
                else if(plant.kind=="shrub") {Part("sphere",x,.12f,z,.21f,.22f,.19f,0x75b856);Part("sphere",x+.045f,.20f,z-.04f,.04f,.04f,.04f,0xf28c96);}
                else {Tuft(x,z,1.4f);if(plant.kind!="weed")Part("sphere",x,.20f,z,.075f,.11f,.075f,0xeacb6a);}
            }
            for(int i=0;i<Mathf.Min(4,tile.animals.Count);i++) {
                Unit animal=tile.animals[i];float angle=i*1.8f+.5f,x=Mathf.Cos(angle)*.26f,z=Mathf.Sin(angle)*.26f;
                Color color=string.IsNullOrEmpty(animal.el)?Hex(0xf0e8cf):ElementColor(animal.el);
                Animal(b,cell,animal.kind,x,z,color,angle*25);
            }
            for(int i=0;i<Mathf.Min(3,tile.beasts.Count);i++) {float a=i*2.2f;float x=Mathf.Cos(a)*.24f,z=Mathf.Sin(a)*.24f;Animal(b,cell,"deer",x,z,ElementColor(tile.beasts[i].el),i*65);}
            for(int i=0;i<Mathf.Min(3,tile.cancers.Count);i++) {float x=-.26f+i*.24f;Part("crystal",x,.15f,.04f,.13f,.24f,.13f,0x9278a5);}
            return b.Mesh("Scenery "+cell.key+" "+def.id);
        }

        void Animal(HabitatMeshBuilder b,CellView cell,string kind,float x,float z,Color color,float angle)
        {
            Quaternion rotation=Quaternion.Euler(0,angle,0);float h=Surface(cell,x,z);
            void Part(string mesh,Vector3 p,Vector3 scale,Color c) {b.Part(Primitive(mesh),new Vector3(x,h,z)+rotation*p,scale,rotation,c);}
            if(kind=="fish") {Part("sphere",new Vector3(0,.09f,0),new Vector3(.19f,.09f,.085f),color);Part("cone",new Vector3(.11f,.09f,0),new Vector3(.10f,.11f,.045f),color);return;}
            bool rabbit=kind=="rabbit",large=kind=="cow"||kind=="bear"||kind=="deer";
            float s=large?1.12f:.83f;
            Part("sphere",new Vector3(0,.13f*s,0),new Vector3(.23f,.16f,.16f)*s,color);
            Part("sphere",new Vector3(-.1f,.20f*s,-.025f),new Vector3(.14f,.14f,.12f)*s,color);
            for(int i=0;i<4;i++)Part("cylinder",new Vector3((i%2==0?-.07f:.07f)*s,.055f,(i<2?-.055f:.055f)*s),new Vector3(.035f,.11f,.035f)*s,Color.Lerp(color,Hex(0x7d7159),.25f));
            for(int i=0;i<2;i++)Part("sphere",new Vector3(-.105f,.29f*s,(i==0?-.055f:.035f)*s),new Vector3(.04f,rabbit?.18f:.075f,.04f)*s,color);
            Part("sphere",new Vector3(-.163f,.215f*s,-.073f*s),new Vector3(.018f,.022f,.018f),Hex(0x354d4a));
            if(kind=="deer")for(int i=0;i<2;i++)Part("cone",new Vector3(-.07f,.33f,(i==0?-.055f:.04f)),new Vector3(.045f,.14f,.035f),Hex(0xc59b67));
        }

        void RebuildFrames()
        {
            if(frames==null)return;
            var b=new HabitatMeshBuilder();
            foreach(var cell in cells.Values) {
                Color color=Hex(state!=null&&state.cells.ContainsKey(cell.key)?0x769965u:0x83768eu);bool isSelected=cell.key==selected,isLegal=legal.Contains(cell.key),isHover=cell.key==hover;
                float width=.009f;
                if(rangePreview.Contains(cell.key)){color=rangeColor;width=.034f;}
                if(isLegal){color=Hex(0x4fcac5);width=.028f;}
                if(isHover){color=Hex(0xc5f4e6);width=.025f;}
                if(isSelected){color=Hex(0xffd667);width=.042f;}
                bool dashed=isSelected||isLegal||rangePreview.Contains(cell.key);Vector3 center=World(cell.key);
                for(int side=0;side<4;side++) {
                    int steps=dashed?12:8;
                    for(int i=0;i<steps;i++) {
                        if(dashed&&i%3==2)continue;
                        Vector2 a=EdgePoint(side,(float)i/steps)*.965f,c=EdgePoint(side,(float)(i+1)/steps)*.965f;
                        Vector2 inward=(side==0?Vector2.up:side==1?Vector2.left:side==2?Vector2.down:Vector2.right)*width;
                        Vector3 P(Vector2 v){return center+new Vector3(v.x,Surface(cell,v.x,v.y)+.018f,v.y);}
                        b.Quad(P(a),P(a+inward),P(c+inward),P(c),color);
                    }
                }
            }
            AppendClusterPreview(b);
            ReplaceMesh(frames,ref frameMesh,b.Mesh("Grid outlines and square selection"));
        }

        void BuildCamera()
        {
            var go=Child("Habitat camera");go.tag="MainCamera";boardCamera=go.AddComponent<Camera>();boardCamera.clearFlags=CameraClearFlags.SolidColor;
            boardCamera.backgroundColor=Hex(0xc8dce7);boardCamera.fieldOfView=40;boardCamera.nearClipPlane=.1f;boardCamera.farClipPlane=400;boardCamera.allowHDR=true;
            go.AddComponent<AudioListener>();var data=go.AddComponent<UniversalAdditionalCameraData>();data.renderPostProcessing=true;data.requiresDepthTexture=true;data.antialiasing=AntialiasingMode.FastApproximateAntialiasing;
            var sunObject=Child("Warm miniature sunlight");var light=sunObject.AddComponent<Light>();light.type=LightType.Directional;light.intensity=1;light.color=Hex(0xffefd8);light.shadows=LightShadows.Soft;light.shadowStrength=.60f;light.shadowBias=.035f;light.shadowNormalBias=.2f;sunObject.transform.rotation=Quaternion.Euler(47,-35,0);
            RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=Hex(0xb7d6e4);RenderSettings.ambientEquatorColor=Hex(0xb9d1c4);RenderSettings.ambientGroundColor=Hex(0x9d947f);RenderSettings.ambientIntensity=.8f;RenderSettings.sun=light;RenderSettings.fog=true;RenderSettings.fogMode=FogMode.Linear;RenderSettings.fogColor=boardCamera.backgroundColor;RenderSettings.fogStartDistance=32;RenderSettings.fogEndDistance=86;RenderSettings.skybox=null;
            var volumeObject=Child("Soft bloom and miniature focus");atmosphere=volumeObject.AddComponent<Volume>();atmosphere.isGlobal=true;atmosphere.priority=10;
            atmosphereProfile=ScriptableObject.CreateInstance<VolumeProfile>();atmosphere.sharedProfile=atmosphereProfile;
            var bloom=atmosphereProfile.Add<Bloom>(true);bloom.threshold.Override(1.1f);bloom.intensity.Override(.13f);bloom.scatter.Override(.48f);
            var vignette=atmosphereProfile.Add<Vignette>(true);vignette.color.Override(Hex(0x5b7378));vignette.intensity.Override(.12f);vignette.smoothness.Override(.6f);
            depthOfField=atmosphereProfile.Add<DepthOfField>(true);depthOfField.mode.Override(DepthOfFieldMode.Bokeh);depthOfField.focalLength.Override(42);depthOfField.aperture.Override(7.5f);depthOfField.focusDistance.Override(distance);
            if(Application.isMobilePlatform){depthOfField.active=false;light.shadowResolution=LightShadowResolution.Medium;}
            InitializeCamera();
        }
        public void SetAtmosphere(bool enabled) { atmosphereEnabled=enabled;if(atmosphere!=null)atmosphere.enabled=enabled; }
        public void SetReducedMotion(bool enabled) {reducedMotion=enabled;if(enabled){ClearFeedback();foreach(var ambient in ambientViews.Values)if(ambient.filter!=null){ambient.filter.transform.localPosition=Vector3.zero;ambient.filter.transform.localRotation=Quaternion.identity;}}shieldSignature=null;RebuildShields();}

        void Update()
        {
            if(!initialized)return;
            if(InputEnabled)HandleInput();else CancelPointer();
            UpdateCamera(false);
            if(state!=null&&SyncVisibleCells()){RenderVisibleCells();BuildBase();RefreshCloudBanks();RebuildFrames();shieldSignature=null;RebuildShields();}
            UpdateFeedback();
        }
        // Compatibility for isolated previews. Normal actions use PlayAction so receipts share a timeline.
        public void PlayFeedback(string cell,string element="wood",int count=10)
        {
            if(initialized&&!reducedMotion)Burst(CellWorldPosition(cell)+Vector3.up*.12f,EffectColor(element),count,.3f,.6f,.8f,"spark");
        }
        public void PlayEvent(GameEvent receipt) {if(receipt!=null)PlayReceipt(receipt,0);}
        GameObject Child(string name){var child=new GameObject(name);child.transform.SetParent(transform,false);return child;}
        static MeshFilter MeshObject(string name,Transform parent,Material material)
        {
            var go=new GameObject(name);go.transform.SetParent(parent,false);var filter=go.AddComponent<MeshFilter>();var renderer=go.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.receiveShadows=true;renderer.shadowCastingMode=ShadowCastingMode.On;return filter;
        }
        static void ReplaceMesh(MeshFilter filter,ref Mesh old,Mesh next,MeshCollider collider=null)
        {
            if(collider!=null)collider.sharedMesh=null;filter.sharedMesh=next;if(collider!=null)collider.sharedMesh=next;if(old!=null)Destroy(old);old=next;
        }
        Mesh Primitive(string kind)
        {
            if(primitives.TryGetValue(kind,out Mesh mesh))return mesh;
            mesh=HabitatMeshBuilder.Primitive(kind);primitives.Add(kind,mesh);return mesh;
        }
        static int StableHash(string text){unchecked{int h=17;foreach(char c in text)h=h*31+c;return h&int.MaxValue;}}
        static Color Hex(uint color){return new Color(((color>>16)&255)/255f,((color>>8)&255)/255f,(color&255)/255f,1);}
        static Color ElementColor(string element){for(int i=0;i<ElementKeys.Length;i++)if(ElementKeys[i]==element)return ElementColors[i];return Hex(0xd7efc6);}
        void OnDestroy()
        {
            DisposeFeedback();
            foreach(var cell in cells.Values){if(cell.terrainMesh!=null)Destroy(cell.terrainMesh);if(cell.sceneryMesh!=null)Destroy(cell.sceneryMesh);}
            foreach(var mesh in primitives.Values)Destroy(mesh);foreach(var mesh in permanentMeshes)Destroy(mesh);
            if(frameMesh!=null)Destroy(frameMesh);if(baseMesh!=null)Destroy(baseMesh);if(terrainMaterial!=null)Destroy(terrainMaterial);if(glowMaterial!=null)Destroy(glowMaterial);if(shieldMaterial!=null)Destroy(shieldMaterial);
            if(atmosphereProfile!=null){foreach(var component in atmosphereProfile.components)Destroy(component);Destroy(atmosphereProfile);}
        }
    }

    internal sealed class HabitatMeshBuilder
    {
        readonly List<Vector3> vertices=new List<Vector3>();readonly List<Color> colors=new List<Color>();readonly List<int> triangles=new List<int>();
        public int Vertex(Vector3 p,Color color){int i=vertices.Count;vertices.Add(p);colors.Add(color);return i;}
        public void Triangle(int a,int b,int c){triangles.Add(a);triangles.Add(b);triangles.Add(c);}
        public void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d,Color color){Quad(a,b,c,d,color,color);}
        public void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d,Color top,Color bottom){int i=vertices.Count;Vertex(a,top);Vertex(b,top);Vertex(c,bottom);Vertex(d,bottom);Triangle(i,i+1,i+2);Triangle(i,i+2,i+3);}
        public void Part(Mesh primitive,Vector3 position,Vector3 scale,Quaternion rotation,Color color)
        {
            int start=vertices.Count;var p=primitive.vertices;for(int i=0;i<p.Length;i++)Vertex(position+rotation*Vector3.Scale(p[i],scale),color);
            var t=primitive.triangles;for(int i=0;i<t.Length;i+=3)Triangle(start+t[i],start+t[i+1],start+t[i+2]);
        }
        public void Ring(Vector3 center,float inner,float outer,Color color,int steps=24,float zScale=1)
        {
            for(int i=0;i<steps;i++){float a=i*Mathf.PI*2/steps,b=(i+1)*Mathf.PI*2/steps;Vector3 P(float angle,float r){return center+new Vector3(Mathf.Cos(angle)*r,0,Mathf.Sin(angle)*r*zScale);}Quad(P(a,inner),P(b,inner),P(b,outer),P(a,outer),color);}
        }
        public Mesh Mesh(string name)
        {
            var mesh=new Mesh {name=name};if(vertices.Count>65535)mesh.indexFormat=IndexFormat.UInt32;mesh.SetVertices(vertices);mesh.SetColors(colors);mesh.SetTriangles(triangles,0);mesh.RecalculateNormals();mesh.RecalculateBounds();return mesh;
        }
        public static Mesh Primitive(string kind)
        {
            var b=new HabitatMeshBuilder();Color white=Color.white;
            if(kind=="cube") {
                Vector3 P(float x,float y,float z){return new Vector3(x,y,z)*.5f;}
                b.Quad(P(-1,-1,-1),P(-1,1,-1),P(1,1,-1),P(1,-1,-1),white);b.Quad(P(1,-1,1),P(1,1,1),P(-1,1,1),P(-1,-1,1),white);
                b.Quad(P(-1,-1,1),P(-1,1,1),P(-1,1,-1),P(-1,-1,-1),white);b.Quad(P(1,-1,-1),P(1,1,-1),P(1,1,1),P(1,-1,1),white);
                b.Quad(P(-1,1,-1),P(-1,1,1),P(1,1,1),P(1,1,-1),white);b.Quad(P(-1,-1,1),P(-1,-1,-1),P(1,-1,-1),P(1,-1,1),white);
            }
            else if(kind=="sphere"||kind=="rock") {
                int rows=kind=="rock"?4:8,columns=kind=="rock"?7:12;
                for(int row=0;row<=rows;row++)for(int col=0;col<=columns;col++) {
                    float p=Mathf.PI*row/rows,a=Mathf.PI*2*col/columns;
                    b.Vertex(new Vector3(Mathf.Sin(p)*Mathf.Cos(a),Mathf.Cos(p),Mathf.Sin(p)*Mathf.Sin(a))*.5f,white);
                }
                for(int row=0;row<rows;row++)for(int col=0;col<columns;col++){int i=row*(columns+1)+col;b.Triangle(i,i+1,i+columns+1);b.Triangle(i+1,i+columns+2,i+columns+1);}
            }
            else {
                int sides=kind=="cone"?7:kind=="crystal"?5:9;
                for(int i=0;i<sides;i++) {
                    float a=i*Mathf.PI*2/sides,c=(i+1)*Mathf.PI*2/sides;
                    Vector3 p=new Vector3(Mathf.Cos(a)*.5f,-.5f,Mathf.Sin(a)*.5f),q=new Vector3(Mathf.Cos(c)*.5f,-.5f,Mathf.Sin(c)*.5f);
                    if(kind=="cylinder")b.Quad(p,p+Vector3.up,q+Vector3.up,q,white);
                    else {int s=b.vertices.Count;b.Vertex(p,white);b.Vertex(Vector3.up*.5f,white);b.Vertex(q,white);b.Triangle(s,s+1,s+2);}
                    int k=b.vertices.Count;b.Vertex(Vector3.down*.5f,white);b.Vertex(p,white);b.Vertex(q,white);b.Triangle(k,k+1,k+2);
                    if(kind=="cylinder"){int j=b.vertices.Count;b.Vertex(Vector3.up*.5f,white);b.Vertex(q+Vector3.up,white);b.Vertex(p+Vector3.up,white);b.Triangle(j,j+1,j+2);}
                }
            }
            return b.Mesh("Habitat primitive "+kind);
        }
    }
}
