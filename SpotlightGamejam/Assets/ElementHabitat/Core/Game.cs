// C# port of the published game preserved in migration/web-reference. No runtime JS dependency.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Globalization;

namespace ElementHabitat
{
    public static class Game
    {
        public static readonly string[] EL = { "metal", "wood", "water", "fire", "earth" };
        public const string TOWER_CELL = "3,3";
        public static readonly List<string> Shape = BuildShape();
        public static readonly HashSet<string> ShapeKeys = new HashSet<string>(Shape);
        public static Dictionary<string, TileDefinition> TYPE { get { return Catalog.Types; } }
        private static List<string> BuildShape()
        {
            var cells = new List<string>();
            for (int y = 0; y < 7; y++) for (int x = 0; x < 7; x++) cells.Add(Key(x,y));
            int[] starts = { 1, 2, 3 }, ends = { 5, 4, 3 };
            for (int i = 0; i < 3; i++) for (int t = starts[i]; t <= ends[i]; t++)
                cells.AddRange(new[] { Key(t,-i-1), Key(t,7+i), Key(-i-1,t), Key(7+i,t) });
            return cells;
        }
        public static string Key(int x, int y) { return x + "," + y; }
        public static int[] Parse(string cell) { return cell.Split(',').Select(int.Parse).ToArray(); }
        public static List<string> Neighbors(string cell)
        {
            var p = Parse(cell); int x=p[0],y=p[1];
            return new[] { Key(x+1,y), Key(x-1,y), Key(x,y+1), Key(x,y-1) }.ToList();
        }
        public static List<string> PlacedKeys(State s) { return s.cells.Keys.ToList(); }
        public static List<string> BoardKeys(State s)
        {
            var keys=new List<string>(Shape);keys.AddRange(PlacedKeys(s));if(s.mode=="endless")keys.AddRange(PlacedKeys(s).SelectMany(Neighbors));return keys.Distinct().ToList();
        }
        public static List<string> EmptyKeys(State s) { return BoardKeys(s).Where(k => k!=TOWER_CELL&&!s.cells.ContainsKey(k)).ToList(); }
        public static List<string> LegalPlacements(State s)
        {
            return s.ap<1 || s.over ? new List<string>() : EmptyKeys(s).Where(k => Neighbors(k).Any(n=>n==TOWER_CELL||s.cells.ContainsKey(n))).ToList();
        }
        private static double Rand(State s)
        {
            unchecked {
                s.rng += (int)0x6D2B79F5;
                uint t = (uint)s.rng;
                t = (t ^ (t >> 15)) * (t | 1);
                t ^= t + (t ^ (t >> 7)) * (t | 61);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }
        private static T Pick<T>(State s, IList<T> values) { return values[(int)Math.Floor(Rand(s) * values.Count)]; }
        private static List<T> Shuffle<T>(State s, IEnumerable<T> values)
        {
            var a = values.ToList();
            for (int i=a.Count-1;i>0;i--) { int j=(int)Math.Floor(Rand(s)*(i+1)); T v=a[i];a[i]=a[j];a[j]=v; }
            return a;
        }
        private static T PickWeighted<T>(State s, List<KeyValuePair<T,int>> pairs)
        {
            double r=Rand(s)*pairs.Sum(p=>p.Value);
            foreach(var pair in pairs) { r-=pair.Value;if(r<0)return pair.Key; }
            return pairs[pairs.Count-1].Key;
        }
        private static ElementBag CopyBag(ElementBag bag) { var copy = new ElementBag(); foreach(var e in EL)copy[e]=bag[e];return copy; }
        private static string ElName(string el) { var e = Catalog.Elements.Find(v=>v.key==el); return e==null?el:e.name; }
        private static ActionResult Fail(string msg) { return new ActionResult(false,msg); }
        private static ActionResult Success(string msg) { return new ActionResult(true,msg); }
        private static bool Used(Dictionary<string,bool> map,string key) { bool value;return key!=null&&map.TryGetValue(key,out value)&&value; }
        private static int Stat(State s,string key) { int n;return s.stats.TryGetValue(key,out n)?n:0; }
        private static void CountStat(State s,string key,int n=1) { s.stats[key]=Stat(s,key)+n; }
        private static void Emit(State s,GameEvent e) { s.events.Add(e); }
        private static void Log(State s,string msg) { s.log.Insert(0,"["+s.round+"] "+msg);if(s.log.Count>200)s.log.RemoveAt(s.log.Count-1); }
        private static Tile GetTile(State s,string k) { Tile t;return k!=null && s.cells.TryGetValue(k,out t)?t:null; }
        private static void RemoveCell(State s,string cell)
        {
            // JS Object appends reinserted keys. Clear Dictionary's recycled slots so the
            // subsequent placement has the same traversal order on .NET and Unity Mono.
            s.cells.Remove(cell);s.cells=s.cells.ToDictionary(p=>p.Key,p=>p.Value);
        }
        public static int SpiritCap(Tile t) { return Math.Max(0,t.attrs.Sum())+(t.shelter?4:0); }
        public static int CancerCap(Tile t) { return -t.attrs.Where(v=>v<0).Sum(); }
        public static double AnimalCap(Tile t) { return double.PositiveInfinity; }
        public static int[] GlobalAttrs(State s) { return Enumerable.Range(0,5).Select(i=>s.cells.Values.Sum(t=>t.attrs[i])).ToArray(); }
        public static int TotalAttrs(State s) { return GlobalAttrs(s).Sum(); }
        public static bool HasWater(Tile t) { return t.attrs[2]>0&&(t.spring||t.pond||(TYPE[t.type].tag??"").Split('；','、','，').Contains("水域")); }
        public static bool IsFarm(Tile t) { return t.farm||(TYPE[t.type].tag??"").Contains("可耕地"); }
        public static bool HasOre(Tile t) { return false; }
        public static Tile MakeTile(string type) { return new Tile { type=type, attrs=(int[])TYPE[type].attrs.Clone() }; }
        public static List<string> Cluster(State s,string cell)
        {
            var todo=new List<string>();var t=GetTile(s,cell);if(t==null)return todo;
            var found=new HashSet<string>{cell};todo.Add(cell);var def=TYPE[t.type];
            for(int i=0;i<todo.Count;i++)foreach(var n in Neighbors(todo[i])) {
                var other=GetTile(s,n);
                if(!found.Contains(n)&&other!=null&&(!string.IsNullOrEmpty(def.family)?TYPE[other.type].family==def.family:other.type==t.type)) { found.Add(n);todo.Add(n); }
            }
            return todo;
        }
        public static int AttrCap(State s,string cell) { return 9+3*(Cluster(s,cell).Count-1); }
        private static void AddAttr(State s,string cell,int i,int n) { s.cells[cell].attrs[i]=Math.Min(AttrCap(s,cell),s.cells[cell].attrs[i]+n); }
        private static void TrimSpirits(State s) { foreach(var t in s.cells.Values){int n=SpiritCap(t);if(t.spirits.Count>n)t.spirits.RemoveRange(n,t.spirits.Count-n);} }
        private static void CapTerrain(State s) { foreach(var k in PlacedKeys(s)){int cap=AttrCap(s,k);s.cells[k].attrs=s.cells[k].attrs.Select(v=>Math.Min(cap,v)).ToArray();}TrimSpirits(s); }
        public static List<TileDefinition> Upgrades(State s,string cell)
        {
            var t=GetTile(s,cell);if(t==null)return new List<TileDefinition>();
            return Catalog.Tiles.Where(ty=>ty.parent==t.type&&UpgradeReasons(s,cell,ty).Count==0).ToList();
        }
        public static List<string> UpgradeReasons(State s,string cell,TileDefinition ty)
        {
            var t=GetTile(s,cell);if(t==null)return new List<string>{"请选择地块"};var reasons=new List<string>();
            var cost=UpgradeCost(s,cell,ty);
            for(int i=0;i<5;i++){string e=EL[i];if(cost.normal[e]>s.inv.crystal[e]||cost.big[e]>s.inv.bigCrystal[e])reasons.Add(Catalog.Elements[i].name+"结晶不足（缺属性 "+cost.deficit[i]+"）");if(ty.attrs[i]>AttrCap(s,cell))reasons.Add(Catalog.Elements[i].name+"需求超过连片上限");}
            if(Cluster(s,cell).Count<ty.requiredN)reasons.Add("同系列需"+ty.requiredN+"格");
            if(ty.level>=4&&Stat(s,"merges")==0)reasons.Add("先合成元素兽");
            if(ty.level==5&&!PlacedKeys(s).Any(k=>s.cells[k].guardians.Count>0&&GuardianArea(s,k).Contains(cell)))reasons.Add("需守护灵覆盖");
            return reasons;
        }
        public static UpgradePayment UpgradeCost(State s,string cell,TileDefinition ty)
        {
            var cost=new UpgradePayment{deficit=ty.attrs.Select((v,i)=>Math.Max(0,v-s.cells[cell].attrs[i])).ToArray()};
            for(int i=0;i<5;i++){string e=EL[i];cost.normal[e]=Math.Min(cost.deficit[i],s.inv.crystal[e]);cost.big[e]=(int)Math.Ceiling((cost.deficit[i]-cost.normal[e])/2.0);}return cost;
        }
        public static int SupplyLevel(State s) { return s.progress!=null&&s.progress.t3&&Stat(s,"merges")>0?3:s.progress!=null&&(s.progress.t2||s.progress.natural>=5)?2:1; }
        public static ScoreResult Score(State s)
        {
            var r=new ScoreResult{attrs=TotalAttrs(s),ecology=s.cells.Values.Sum(Ecology),tower=s.tower.spent};
            r.@base=r.attrs*.5+r.tower+r.ecology;r.total=r.@base;return r;
        }
        public static int Ecology(Tile t) { return t.animals.Count+t.plants.Count; }
        public static int Stage(State s) { return Math.Min(4,1+(int)Math.Floor(Math.Max(0,s.peakScore)/500)); }
        public static int APLimit(State s) { return Math.Min(9,3+(Stage(s)-1)*2); }
        private static List<TileDefinition> OfferPool(State s,bool unrestricted)
        {
            return Catalog.Tiles.Where(t=>t.level<=SupplyLevel(s)&&t.level<=3).ToList();
        }
        private static void RollOffers(State s,bool unrestricted=false)
        {
            var pool=OfferPool(s,unrestricted);
            var groups=Shuffle(s,PlacedKeys(s)).OrderByDescending(k=>Cluster(s,k).Count).ToList();string family=TYPE[s.cells[groups[0]].type].family;
            var first=pool.Find(t=>t.family==family&&t.level==Math.Min(2,SupplyLevel(s)))??pool[0];
            var others=pool.Where(t=>t.family!=first.family&&t.level==SupplyLevel(s)).ToList();
            var second=Pick(s,others.Count>0?others:pool.Where(t=>t.id!=first.id).ToList());
            var third=Pick(s,pool.Where(t=>t.id!=first.id&&t.id!=second.id).ToList());
            s.offers=new List<string>{first.id,second.id,third.id};
            if(s.journey!=null&&!s.journey.skipped&&s.round==1)s.offers=new List<string>{"mine_t1","woodland_t1","ocean_t1"};
            if(s.journey!=null&&!s.journey.skipped&&s.round==3&&SupplyLevel(s)>=2&&!s.offers.Contains("woodland_t2"))s.offers[1]="woodland_t2";
        }
        public static State NewGame(uint seed,bool tutorial=true,string mode="challenge")
        {
            var s=new State{seed=seed,rng=unchecked((int)seed),mode=mode=="endless"?"endless":"challenge"};
            if(tutorial){s.journey=new Journey{grants=new JourneyGrants{water=true}};s.inv.crystal.water=3;}
            string[] types={"grassland_t2","ocean_t1","mine_t1","woodland_t1","volcano_t1"},keys={"2,2","2,3","4,3","3,2","3,4"};
            for(int i=0;i<5;i++)s.cells.Add(keys[i],MakeTile(types[i]));
            s.visions=Shuffle(s,Catalog.Visions).Take(2).Select(v=>new VisionState{id=v.id}).ToList();
            RollOffers(s);RollEvent(s);s.peakScore=Score(s).total;Log(s,"元素生境开始。中央守护塔，初始 5 块地属性和 = "+TotalAttrs(s));return s;
        }
        public static bool MagicUnlocked(State s,string magic)
        {
            var m=Catalog.Magics.Find(v=>v.id==magic);
            return m!=null&&(string.IsNullOrEmpty(m.unlock)||s.unlockedMagics.Contains(m.id)||GlobalAttrs(s)[Array.IndexOf(EL,m.unlock)]>=20);
        }
        public static bool CanPurify(State s,string cell) { return MagicArea(s,cell,"purify").Any(k=>GetTile(s,k)!=null&&(s.cells[k].attrs.Any(v=>v<0)||s.cells[k].cancers.Count>0)); }
        public static List<string> GuardianArea(State s,string cell) { return GetTile(s,cell)==null?new List<string>():new[]{cell}.Concat(Neighbors(cell).Where(s.cells.ContainsKey)).ToList(); }
        public static Dictionary<string,double> Metrics(State s)
        {
            var values=s.stats.ToDictionary(p=>p.Key,p=>(double)p.Value);var ts=s.cells.Values;
            values["tiles"]=ts.Count;values["cluster"]=ts.Count==0?0:PlacedKeys(s).Max(k=>Cluster(s,k).Count);values["peakScore"]=s.peakScore;
            values["beastElements"]=ts.SelectMany(t=>t.beasts.Select(b=>b.el)).Distinct().Count();values["plants"]=ts.Sum(t=>t.plants.Count);
            values["clean"]=Stat(s,"purified")>0&&ts.All(t=>t.attrs.All(v=>v>=0)&&t.cancers.Count==0)?1:0;
            values["visions"]=s.visions.Count(v=>v.done);return values;
        }
        private static void UpdateProgress(State s)
        {
            foreach(var m in Catalog.Magics)if(MagicUnlocked(s,m.id)&&!s.unlockedMagics.Contains(m.id))s.unlockedMagics.Add(m.id);
            s.peakScore=Math.Max(s.peakScore,Score(s).@base);var values=Metrics(s);
            foreach(var v in s.visions){var d=Catalog.Visions.Find(x=>x.id==v.id);double n;values.TryGetValue(d.metric,out n);if(!v.done&&n>=d.target){v.done=true;Log(s,"愿景完成："+d.name);Emit(s,new GameEvent{cell="3,3",kind="vision",id=d.id});}}
            values=Metrics(s);
            foreach(var a in Catalog.Achievements){double n;values.TryGetValue(a.metric,out n);if(!s.achievements.Contains(a.id)&&n>=a.target){s.achievements.Add(a.id);Log(s,"成就解锁："+a.name);Emit(s,new GameEvent{cell="3,3",kind="achievement",id=a.id});}}
            s.peakScore=Math.Max(s.peakScore,Score(s).@base);int limit=APLimit(s);
            if(limit>s.roundAP){s.ap+=limit-s.roundAP;s.roundAP=limit;Log(s,"灵脉提升，行动上限 "+limit);}
        }
        private static void Purify(State s,string cell,List<string> area)
        {
            foreach(var k in area){var t=GetTile(s,k);if(t==null)continue;
                if(t.attrs.Any(v=>v<0)||t.cancers.Count>0)CountStat(s,"purified");
                t.attrs=t.attrs.Select(v=>v<0?Math.Min(AttrCap(s,k),v+5):v).ToArray();t.cancers.Clear();Emit(s,new GameEvent{cell=k,kind="purify"});}
        }
        private static bool Nearby(State s,string a,string b) { return GetTile(s,a)!=null&&GetTile(s,b)!=null&&Neighbors(a).Contains(b); }
        private static void UnlockMemory(State s,string key)
        {
            if(s.story==null)s.story=new Story();if(!s.story.memories.Contains(key)){s.story.memories.Add(key);Emit(s,new GameEvent{cell="3,3",kind="memory",memory=key});}
        }
        private static void JourneyAction(State s,GameAction a)
        {
            if(a.type=="cast")UnlockMemory(s,a.magic);if(a.type=="merge")UnlockMemory(s,"beast");if(a.type=="mergeGuardian")UnlockMemory(s,"guardian");
            var j=s.journey;if(j==null||j.skipped)return;int step=j.step;
            if(step==2&&a.type=="place")j.step=3;
            if(step==3&&a.type=="cast"&&a.magic=="purify")j.step=4;
            if(step==5&&(a.type=="upgrade"&&TYPE[s.cells[a.cell].type].level==2||a.type=="upgradeBatch"&&a.upgrades.Any(v=>TYPE[s.cells[v.cell].type].level==2)))j.step=6;
            if(step==6&&(a.type=="useCrystal"||a.type=="useCrystals")){if(j.useRound!=s.round){j.useRound=s.round;j.waterUses=0;}j.waterUses+=a.type=="useCrystal"?1:CrystalList(a.crystals).Sum(c=>c.count);if(j.waterUses>=2)j.step=7;}
            if(step==7&&s.round>=3&&a.type=="place")j.step=8;
            if(!j.done.Contains(a.type))j.done.Add(a.type);
        }
        private static void JourneyRound(State s)
        {
            if(s.events.Any(e=>e.kind=="crystal"))UnlockMemory(s,"crystal");if(s.events.Any(e=>e.kind=="plant"||e.kind=="animal"))UnlockMemory(s,"life");if(s.events.Any(e=>e.kind=="meteor"))UnlockMemory(s,"meteor");
            var j=s.journey;if(j==null||j.skipped)return;if(j.step==4)j.step=5;
            if(s.round>=2&&!j.grants.shield){j.grants.shield=true;if(!s.shields.Concat(s.inv.shields).Any(sh=>sh.defense.earth>=3)){int n=Math.Max(0,5-s.inv.crystal.earth);s.inv.crystal.earth+=n;if(n>0){Emit(s,new GameEvent{cell="3,3",kind="item",n=n});Log(s,"教学补给：普通土晶补足5颗，可制造元素盾抵御星雨");}}}
        }
        public static int TowerCost(int level) { return (int)Math.Pow(10,level); }
        public static TowerPayment TowerPayment(State s,string feature,string el)
        {
            int level=(feature=="shelter"?s.tower.shelter:s.tower.spring)[el],cost=TowerCost(level),normal=Math.Min(s.inv.crystal[el],cost),big=(int)Math.Ceiling((cost-normal)/2.0);
            return new TowerPayment{normal=normal,big=big,ok=level<7&&s.inv.bigCrystal[el]>=big};
        }
        public static List<string> TowerArea(State s,int level) { return PlacedKeys(s).Where(k=>{var p=Parse(k);int d=Math.Abs(p[0]-3)+Math.Abs(p[1]-3);return d>0&&d<=level;}).ToList(); }
        public static StageTarget Checkpoint(State s) { return Catalog.StageTargets.Find(t=>t.round>=s.round); }
        public static double Restoration(State s) { return Math.Min(1,Math.Max(0,Score(s).total)/Catalog.StageTargets[Catalog.StageTargets.Count-1].score); }
        public static MeteorPower MeteorStrength(State s) { int strength=(int)Math.Ceiling(s.round/10.0);return new MeteorPower{damage=1+2*strength,count=Math.Max(1,(int)Math.Floor(s.cells.Count*Math.Min(.7,.25+.05*strength)))}; }
        public static List<string> MagicArea(State s,string cell,string magic) { return magic=="purify"&&s.magicRange[magic]==5?GuardianArea(s,cell):Region(s,cell,s.magicRange[magic]); }
        public static NaturalEventDefinition EventForRound(State s)
        {
            var def=Catalog.NaturalEvents.Find(e=>e.id==s.nextEvent.id);return new NaturalEventDefinition{id=def.id,name=def.name,tone=def.tone,color=def.color,delta=def.delta,el=s.nextEvent.el};
        }
        private static void RollEvent(State s) { s.nextEvent=Rand(s)<.9?new NaturalEventState{id="meteor",el=Pick(s,EL)}:new NaturalEventState{id=Pick(s,Catalog.NaturalEvents.Where(e=>e.tone=="positive").ToList()).id}; }
        private static void AutoGuardians(State s)
        {
            foreach(var cell in PlacedKeys(s))while(s.cells[cell].beasts.Count>=5){Handle(s,new GameAction{type="mergeGuardian",cell=cell,beastIds=s.cells[cell].beasts.Take(5).Select(b=>b.id).ToList()});UnlockMemory(s,"guardian");}
        }
        private static void Degrade(State s)
        {
            foreach(var cell in PlacedKeys(s)){var t=s.cells[cell];if(t.attrs.All(v=>v<0)){RemoveCell(s,cell);Emit(s,new GameEvent{cell=cell,kind="vanish"});Log(s,"地块全属性为负，消散："+cell);continue;}
                var def=TYPE[t.type];while(!string.IsNullOrEmpty(def.parent)&&def.attrs.Where((v,i)=>v>0&&t.attrs[i]<v).Any())def=TYPE[def.parent];
                if(def.id!=t.type){t.type=def.id;Emit(s,new GameEvent{cell=cell,kind="degrade"});Log(s,"地形退化为"+def.name);}}
            CapTerrain(s);
        }
        public static readonly Dictionary<string,Relation> Relations=new Dictionary<string,Relation>{
            {"desert",new Relation{targets=new[]{"ocean","river"},el="water",name="水源润沙"}},
            {"woodland",new Relation{targets=new[]{"wetland","river"},el="wood",name="活水育林"}},
            {"ice",new Relation{targets=new[]{"volcano"},el="water",name="地热融雪"}},
            {"ocean",new Relation{targets=new[]{"ice","river"},el="water",name="汇流入海"}},
            {"grassland",new Relation{targets=new[]{"woodland","river"},el="earth",name="林岸沃野"}},
            {"wetland",new Relation{targets=new[]{"ocean","grassland"},el="wood",name="水草净泽"}},
            {"river",new Relation{targets=new[]{"ice","woodland"},el="water",name="涵养溪流"}},
            {"mine",new Relation{targets=new[]{"volcano","ice"},el="metal",name="冷热凝脉"}},
            {"volcano",new Relation{targets=new[]{"mine","desert"},el="fire",name="岩砂蓄火"}},
            {"ruins",new Relation{targets=new[]{"mine","woodland"},el="earth",name="林岩护址"}}
        };
        public static List<Relation> TileRelations(State s,string cell)
        {
            var t=s.cells[cell];Relation rule;if(!Relations.TryGetValue(TYPE[t.type].family,out rule))return new List<Relation>();
            return Neighbors(cell).Where(k=>GetTile(s,k)!=null&&rule.targets.Contains(TYPE[s.cells[k].type].family)).Select(k=>new Relation{targets=rule.targets,el=rule.el,name=rule.name,neighbor=k,n=Math.Max(1,TYPE[t.type].level-2)}).ToList();
        }
        private static void SettleRelations(State s)
        {
            foreach(var cell in PlacedKeys(s))foreach(var r in TileRelations(s,cell)){int i=Array.IndexOf(EL,r.el),before=s.cells[cell].attrs[i];AddAttr(s,cell,i,r.n);int n=s.cells[cell].attrs[i]-before;if(n!=0)Emit(s,new GameEvent{cell=cell,kind="relation",el=r.el,n=n,neighbor=r.neighbor});}
        }
        private static List<string> InteractionKeys(State s,GameAction a)
        {
            var t=GetTile(s,a.cell??a.from);
            switch(a.type){
                case "moveSpirit":return new List<string>{"spirit:"+a.spiritId};
                case "moveBeast":return new List<string>{"beast:"+a.beastId};
                case "merge":return t==null?new List<string>():t.spirits.Where(sp=>sp.el==a.el&&!Used(s.interactionUsed,"spirit:"+sp.id)).Take(3).Select(sp=>"spirit:"+sp.id).ToList();
                case "deployShield":return new List<string>{"shield:"+a.shieldId};
                case "craftShield":return new List<string>{"craft:shield"};
                default:return new List<string>();
            }
        }
        private static readonly HashSet<string> HandlerNames=new HashSet<string>{"upgradeTower","upgradeBatch","demolish","tutorial","place","cast","upgrade","reroll","usePureCrystal","moveSpirit","moveBeast","mergeGuardian","moveGuardian","merge","useCrystal","useCrystals","craftShield","deployShield"};
        private static ActionResult Handle(State s,GameAction a)
        {
            var t=GetTile(s,a.cell);
            switch(a.type)
            {
                case "upgradeTower":
                    var feature=a.feature=="shelter"?s.tower.shelter:s.tower.spring;int level=feature[a.el];if(level>=7)return Fail("已达最高7级");var pay=TowerPayment(s,a.feature,a.el);
                    if(!pay.ok)return Fail("对应元素结晶不足，需要 "+TowerCost(level)+" 点（普通1点、大型2点）");
                    s.inv.crystal[a.el]-=pay.normal;s.inv.bigCrystal[a.el]-=pay.big;s.tower.spent+=pay.normal+pay.big;feature[a.el]++;
                    Emit(s,new GameEvent{cell=TOWER_CELL,kind="towerUpgrade",el=a.el});return Success(ElName(a.el)+(a.feature=="shelter"?"庇护":"灵力涌泉")+"升至 "+(level+1)+" 级");
                case "upgradeBatch":
                    var upgradePlan=PlanUpgrades(s,a.upgrades);if(!upgradePlan.ok)return Fail(upgradePlan.msg);foreach(var change in a.upgrades)Handle(s,new GameAction{type="upgrade",cell=change.cell,tileType=change.tileType});return Success("同时升级 "+a.upgrades.Count+" 块地形");
                case "demolish":
                    if(t==null)return Fail("请选择已有地块");for(int i=0;i<5;i++){int refund=Math.Max(0,t.attrs[i]);if(refund>0){s.inv.crystal[EL[i]]+=refund;Emit(s,new GameEvent{cell=a.cell,kind="crystal",el=EL[i],n=refund});}}
                    RemoveCell(s,a.cell);Emit(s,new GameEvent{cell=a.cell,kind="vanish"});return Success("铲除地块，正属性已返还普通元素结晶");
                case "tutorial":
                    if(s.journey==null)return Fail("未开启操作教学");
                    if(a.skip){s.journey.skipped=true;return Success("已跳过操作教学，回声仍可解锁");}
                    if(!string.IsNullOrEmpty(a.read)){if(!s.journey.read.Contains(a.read))s.journey.read.Add(a.read);return Success("收录回声");}
                    if(s.journey.step==0)s.journey.step=1;else if(s.journey.step==1&&a.cell=="3,2")s.journey.step=2;
                    return Success("继续旅程");
                case "place":
                    if(a.offer<0||a.offer>=s.offers.Count)return Fail("无效的待选地块");
                    if(!LegalPlacements(s).Contains(a.cell))return Fail("只能放在已有地块相邻的空位");
                    string type=s.offers[a.offer];s.cells[a.cell]=MakeTile(type);s.placed++;RollOffers(s);
                    CountStat(s,"placements");Emit(s,new GameEvent{cell=a.cell,kind="place"});return Success("放置 "+TYPE[type].name);
                case "cast":
                    var m=Catalog.Magics.Find(v=>v.id==a.magic);
                    if(t==null||m==null)return Fail("需要选择地块和有效魔法");
                    if(!MagicUnlocked(s,a.magic))return Fail("全图"+ElName(m.unlock)+"属性须达到 20");
                    if(Used(s.magicUsed,a.magic))return Fail("每种魔法每轮只能施放一次");
                    var area=MagicArea(s,a.cell,a.magic);
                    if(a.magic=="purify"){if(!CanPurify(s,a.cell))return Fail("覆盖区域没有污染或癌元");Purify(s,a.cell,area);}
                    else foreach(var cell in area){var targetTile=s.cells[cell];
                        if(a.magic=="mine")AddAttr(s,cell,0,5);
                        else if(a.magic=="spring"){targetTile.spring=true;AddAttr(s,cell,2,5);}
                        else if(a.magic=="rich"){targetTile.farm=true;AddAttr(s,cell,4,5);}
                        else {targetTile.attrs[1]=targetTile.attrs[2]=0;AddAttr(s,cell,3,5);targetTile.cancers.Clear();targetTile.plants.Clear();targetTile.animals=targetTile.animals.Where(v=>v.kind!="fish").ToList();targetTile.spirits=targetTile.spirits.Where(sp=>sp.el!="wood"&&sp.el!="water").ToList();targetTile.spring=targetTile.pond=false;}
                        Emit(s,new GameEvent{cell=cell,kind="spell",magic=a.magic,el=m.element});}
                    s.magicUsed[a.magic]=true;return Success("施放"+m.name+"魔法");
                case "upgrade":
                    var ty=Upgrades(s,a.cell).Find(v=>v.id==a.tileType);if(ty==null)return Fail("结晶或升级条件不足");
                    var upgradeCost=UpgradeCost(s,a.cell,ty);for(int i=0;i<5;i++){string el=EL[i];s.inv.crystal[el]-=upgradeCost.normal[el];s.inv.bigCrystal[el]-=upgradeCost.big[el];AddAttr(s,a.cell,i,upgradeCost.normal[el]+2*upgradeCost.big[el]);}
                    int oldLevel=TYPE[t.type].level;if(s.progress!=null){if(oldLevel==1&&ty.level==2)s.progress.t2=true;if(oldLevel==2&&ty.level==3)s.progress.t3=true;}
                    t.type=ty.id;t.oasis=false;CapTerrain(s);CountStat(s,"upgrades");Emit(s,new GameEvent{cell=a.cell,kind="upgrade"});return Success("升级为"+ty.name);
                case "reroll":
                    RollOffers(s,true);CountStat(s,"rerolls");return Success("刷新地块 · 消耗 1 行动点");
                case "usePureCrystal":
                    var magic=Catalog.Magics.Find(v=>v.id==a.magic);if(magic==null)return Fail("请选择魔法");if(s.inv.pureCrystal[magic.element]<1)return Fail("没有对应至纯元素结晶");
                    s.inv.pureCrystal[magic.element]--;s.magicRange[magic.id]+=4;Emit(s,new GameEvent{cell=a.cell??TOWER_CELL,kind="range",magic=magic.id});return Success(magic.name+"覆盖提升到 "+s.magicRange[magic.id]+" 格");
                case "moveSpirit":
                    if(!Nearby(s,a.from,a.to))return Fail("只能移到相邻地块");
                    var source=s.cells[a.from];var target=s.cells[a.to];var spirit=source.spirits.Find(v=>v.id==a.spiritId);
                    if(spirit==null)return Fail("找不到该元素灵");if(target.spirits.Count>=SpiritCap(target))return Fail("目标地块元素灵已满");
                    source.spirits.Remove(spirit);target.spirits.Add(spirit);return Success("移动元素灵");
                case "moveBeast":
                    if(!Nearby(s,a.from,a.to))return Fail("只能移到相邻地块");
                    source=s.cells[a.from];target=s.cells[a.to];var beast=source.beasts.Find(v=>v.id==a.beastId);
                    if(beast==null||target.attrs[Array.IndexOf(EL,beast.el)]<=0)return Fail("目标需要该元素的正属性");
                    source.beasts.Remove(beast);target.beasts.Add(beast);AddAttr(s,a.to,Array.IndexOf(EL,beast.el),1);return Success("元素兽移动并滋养地块");
                case "mergeGuardian":
                    var ids=a.beastIds;
                    if(t==null||ids==null||ids.Count!=5||ids.Distinct().Count()!=5)return Fail("请选择同一地块的 5 个不同元素兽");
                    var beasts=ids.Select(i=>t.beasts.Find(b=>b.id==i)).ToList();if(beasts.Any(b=>b==null||!EL.Contains(b.el)))return Fail("元素兽不在该地块");
                    var power=new ElementBag();foreach(var b in beasts)power[b.el]++;t.beasts=t.beasts.Where(b=>!ids.Contains(b.id)).ToList();
                    var guardian=new Guardian{id=s.nextId++,power=power};t.guardians.Add(guardian);CountStat(s,"guardians");Emit(s,new GameEvent{cell=a.cell,kind="guardianMerge",guardianId=guardian.id,power=CopyBag(power)});
                    return Success("合成守护灵："+string.Join(" ",EL.Where(e=>power[e]>0).Select(e=>ElName(e)+"×"+power[e])));
                case "moveGuardian":
                    if(!Nearby(s,a.from,a.to))return Fail("守护灵只能移到四邻已放置地块");
                    source=s.cells[a.from];target=s.cells[a.to];guardian=source.guardians.Find(g=>g.id==a.guardianId);
                    if(guardian==null)return Fail("找不到该守护灵");source.guardians.Remove(guardian);target.guardians.Add(guardian);
                    Emit(s,new GameEvent{cell=a.to,from=a.from,kind="guardianMove",guardianId=a.guardianId});return Success("移动守护灵 · 消耗 1 行动点");
                case "merge":
                    if(t==null||!EL.Contains(a.el))return Fail("无效地块或元素");
                    var same=t.spirits.Where(sp=>sp.el==a.el&&!Used(s.interactionUsed,"spirit:"+sp.id)).ToList();
                    if(same.Count<3)return Fail("需要 3 个本轮未交互的同元素灵");
                    var consumed=new HashSet<int>(same.Take(3).Select(sp=>sp.id));t.spirits=t.spirits.Where(sp=>!consumed.Contains(sp.id)).ToList();t.beasts.Add(new Unit{id=s.nextId++,el=a.el,age=0});
                    CountStat(s,"merges");return Success("合成"+ElName(a.el)+"元素兽");
                case "useCrystal":
                    if(t==null||!EL.Contains(a.el))return Fail("无效地块或元素");var bag=a.inverse?s.inv.inverseCrystal:a.big?s.inv.bigCrystal:s.inv.crystal;
                    if(bag[a.el]<1)return Fail("没有该结晶");int n=a.inverse?-1:a.big?2:1;
                    if(n>0&&t.attrs[Array.IndexOf(EL,a.el)]>=AttrCap(s,a.cell))return Fail("属性已达连片上限");
                    bag[a.el]--;AddAttr(s,a.cell,Array.IndexOf(EL,a.el),n);return Success("使用"+(a.inverse?"逆":a.big?"大型":"")+ElName(a.el)+"结晶："+(n>0?"+":"")+n);
                case "useCrystals":
                    var crystals=CrystalList(a.crystals);var crystalPlan=PlanCrystals(s,a.cell,crystals);if(!crystalPlan.ok)return Fail(crystalPlan.msg);
                    foreach(var c in crystals)Bag(s,c.kind)[c.el]-=c.count;s.cells[a.cell].attrs=crystalPlan.attrs;return Success("使用 "+crystalPlan.count+" 颗结晶为地块加点");
                case "craftShield":
                    var cost=CrystalMix(a.crystals);var big=a.bigCrystals;
                    if(!ValidMix(cost,s.inv.crystal)||!ValidMix(big,s.inv.bigCrystal))return Fail("无效的结晶配比");
                    var defense=new ElementBag();foreach(var e in EL)defense[e]=Cost(cost,e)+2*Cost(big,e);n=defense.Values.Sum();if(n<5||n%5!=0)return Fail("元素盾需要 5 点或 5 的倍数防护，普通结晶1点、大型结晶2点");
                    var shield=new Shield{id=s.nextId++,coverage=n/5,defense=defense};foreach(var e in EL){s.inv.crystal[e]-=Cost(cost,e);s.inv.bigCrystal[e]-=Cost(big,e);}s.inv.shields.Add(shield);
                    return Success("制造元素盾，覆盖 "+shield.coverage+" 格");
                case "deployShield":
                    shield=s.inv.shields.Find(sh=>sh.id==a.shieldId);if(shield==null||t==null)return Fail("无效元素盾或地块");
                    s.inv.shields.Remove(shield);shield.cells=Region(s,a.cell,shield.coverage);s.shields.Add(shield);return Success("部署元素盾，覆盖 "+shield.cells.Count+" 格");
                default:return Fail("未知行动");
            }
        }
        private static int Cost(Dictionary<string,int> cost,string el) { int n;return cost.TryGetValue(el,out n)?n:0; }
        private static bool ValidMix(Dictionary<string,int> mix,ElementBag stock) { return mix!=null&&!mix.Keys.Any(e=>!EL.Contains(e))&&EL.All(e=>Cost(mix,e)>=0&&Cost(mix,e)<=stock[e]); }
        private static Dictionary<string,int> CrystalMix(object value)
        {
            if(value==null)return null;if(value is Dictionary<string,int>)return (Dictionary<string,int>)value;
            try{return (Dictionary<string,int>)NativeJson.ConvertValue(value,typeof(Dictionary<string,int>));}catch{return null;}
        }
        private static List<CrystalUse> CrystalList(object value)
        {
            if(value==null)return null;if(value is List<CrystalUse>)return (List<CrystalUse>)value;
            try{return (List<CrystalUse>)NativeJson.ConvertValue(value,typeof(List<CrystalUse>));}catch{return null;}
        }
        private static ElementBag Bag(State s,string kind) { return kind=="crystal"?s.inv.crystal:kind=="bigCrystal"?s.inv.bigCrystal:kind=="inverseCrystal"?s.inv.inverseCrystal:s.inv.pureCrystal; }
        public static CrystalPlan PlanCrystals(State s,string cell,List<CrystalUse> crystals)
        {
            var t=GetTile(s,cell);if(t==null)return new CrystalPlan{msg="请选择已有地块"};if(crystals==null||crystals.Count==0)return new CrystalPlan{msg="请选择结晶和数量"};
            var seen=new HashSet<string>();var delta=new int[5];int count=0;
            foreach(var c in crystals){string id=c.kind+":"+c.el;if(!EL.Contains(c.el)||!new[]{"crystal","bigCrystal","inverseCrystal"}.Contains(c.kind)||c.count<=0||seen.Contains(id))return new CrystalPlan{msg="无效的结晶数量"};
                if(Bag(s,c.kind)[c.el]<c.count)return new CrystalPlan{msg="对应结晶库存不足"};seen.Add(id);count+=c.count;delta[Array.IndexOf(EL,c.el)]+=c.count*(c.kind=="inverseCrystal"?-1:c.kind=="bigCrystal"?2:1);}
            int cap=AttrCap(s,cell);if(delta.Where((v,i)=>v>0&&t.attrs[i]>=cap).Any())return new CrystalPlan{msg="所选元素属性已达连片上限"};
            var attrs=t.attrs.Select((v,i)=>delta[i]>0?Math.Min(cap,v+delta[i]):v+delta[i]).ToArray();return new CrystalPlan{ok=true,attrs=attrs,count=count,gain=attrs.Sum()-t.attrs.Sum(),capped=delta.Where((v,i)=>v>0&&t.attrs[i]+v>cap).Any()};
        }
        public static UpgradePlan PlanUpgrades(State s,List<GameAction> changes)
        {
            if(changes==null||changes.Count==0||changes.Select(v=>v.cell).Distinct().Count()!=changes.Count)return new UpgradePlan{msg="请选择地块和各自的升级方向"};
            var preview=NativeJson.Deserialize<State>(NativeJson.Serialize(s));
            foreach(var change in changes){var result=Handle(preview,new GameAction{type="upgrade",cell=change.cell,tileType=change.tileType});if(!result.ok)return new UpgradePlan{msg=change.cell+"："+result.msg};}
            var normal=new ElementBag();var big=new ElementBag();foreach(var el in EL){normal[el]=s.inv.crystal[el]-preview.inv.crystal[el];big[el]=s.inv.bigCrystal[el]-preview.inv.bigCrystal[el];}return new UpgradePlan{ok=true,normal=normal,big=big};
        }
        private static void Reconcile(State s,double before,string cell,int eventStart=0)
        {
            double actual=Score(s).total-before,accounted=s.events.Skip(eventStart).Sum(e=>e.score);
            if(actual!=accounted)Emit(s,new GameEvent{cell=cell??"3,3",kind="attr",n=actual-accounted,score=actual-accounted});
        }
        private static readonly HashSet<string> ReceiptKinds=new HashSet<string>{"crystal","bigCrystal","inverseCrystal","pureCrystal","item"};
        public static ActionResult Apply(State s,GameAction action)
        {
            if(action!=null&&action.type=="endRound")return EndRound(s);
            s.events.Clear();if(action==null||action.type==null||!HandlerNames.Contains(action.type))return Fail("未知行动");if(s.over)return Fail("游戏已结束");
            int cost=new[]{"place","cast","moveGuardian","reroll","demolish"}.Contains(action.type)?1:0;
            if(s.ap<cost)return Fail("行动点不足");
            var used=InteractionKeys(s,action);if(used.Any(k=>Used(s.interactionUsed,k)))return Fail("该生物或物品本轮已交互");
            double before=Score(s).total;int beforeBag=BagCount(s);var r=Handle(s,action);if(!r.ok)return r;
            foreach(var k in used)s.interactionUsed[k]=true;s.ap-=cost;JourneyAction(s,action);AutoGuardians(s);Degrade(s);
            TrimSpirits(s);UpdateProgress(s);Log(s,r.msg);string cell=action.cell??action.to??action.from??"3,3";
            int bagDelta=BagCount(s)-beforeBag;double accounted=s.events.Where(e=>ReceiptKinds.Contains(e.kind)).Sum(e=>e.n==0?1:e.n);
            if(bagDelta>accounted)Emit(s,new GameEvent{cell=cell,kind="item",n=bagDelta-accounted});Reconcile(s,before,cell);
            CheckMap(s);if(s.cells.Count==0)Finish(s,"failed","所有地块已消散");
            return r;
        }
        public static List<string> EligiblePlants(Tile t)
        {
            int w=t.attrs[1],a=t.attrs[2],e=t.attrs[4];var kinds=new List<string>();
            if(w>=1&&e>=1)kinds.Add("grass");if(w>=2&&e>=2)kinds.Add("shrub");if(w>=3&&e>=3)kinds.Add("tree");
            if(w>=1&&e>=1&&a>=5&&HasWater(t))kinds.Add("weed");if(w>=1&&e>=2&&a>=1&&IsFarm(t))kinds.Add("crop");return kinds;
        }
        public static List<string> EligibleAnimals(Tile t)
        {
            int w=t.attrs[1],grass=t.plants.Count(p=>p.kind=="grass"),trees=t.plants.Count(p=>p.kind=="tree");var kinds=new List<string>();
            if(w>=1&&grass>=1)kinds.Add("rabbit");if(w>=1&&HasWater(t))kinds.Add("fish");if(w>=1&&trees>=1)kinds.Add("bird");
            if(w>=3&&trees>2)kinds.Add("bear");if(w>=3&&trees>3)kinds.Add("leopard");if(w>=2&&grass>2)kinds.AddRange(new[]{"cow","sheep"});if(w>=3&&grass>3)kinds.Add("deer");return kinds;
        }
        public static List<string> Region(State s,string start,int count)
        {
            var todo=new List<string>{start};var seen=new HashSet<string>(todo);
            for(int i=0;i<todo.Count&&todo.Count<count;i++)foreach(var n in Neighbors(todo[i]))if(s.cells.ContainsKey(n)&&!seen.Contains(n)&&todo.Count<count){todo.Add(n);seen.Add(n);}
            return todo;
        }
        private static void Meteor(State s)
        {
            string element=s.nextEvent.el;var cells=Region(s,Pick(s,PlacedKeys(s)),MeteorStrength(s).count);var strength=MeteorStrength(s);var shelterCells=new HashSet<string>(TowerArea(s,s.tower.shelter[element]));int blocked=0,shieldBlocked=0;
            foreach(var cell in cells){int damage=strength.damage;bool sheltered=shelterCells.Contains(cell);if(sheltered){blocked+=damage;damage=0;}
                int absorbed=ShieldDamage(s,cell,element,damage);damage-=absorbed;blocked+=absorbed;shieldBlocked+=absorbed;
                if(damage!=0)AddAttr(s,cell,Array.IndexOf(EL,element),-damage);Emit(s,new GameEvent{cell=cell,kind="meteor",el=element,damage=damage,strength=strength.damage,sheltered=sheltered});
            }
            s.shields=s.shields.Where(sh=>sh.defense.Values.Sum()>0).ToList();if(shieldBlocked>0)CountStat(s,"blocked");
            s.lastMeteor=new MeteorState{round=s.round,el=element,cells=cells,blocked=blocked,damage=strength.damage};s.inv.pureCrystal[element]++;Emit(s,new GameEvent{cell=cells[0],kind="pureCrystal",el=element,n=1});
            Log(s,ElName(element)+"陨石雨影响 "+cells.Count+" 格，守护塔与元素盾抵挡 "+blocked+" 点");
        }
        private static int ShieldDamage(State s,string cell,string element,int damage)
        {
            int blocked=0;foreach(var shield in s.shields)if(shield.cells.Contains(cell)){int n=Math.Min(damage-blocked,shield.defense[element]);shield.defense[element]-=n;blocked+=n;if(n!=0)Emit(s,new GameEvent{cell=cell,kind="shield",el=element});}return blocked;
        }
        private static void NaturalEvent(State s)
        {
            var ev=EventForRound(s);int strength=(int)Math.Ceiling(s.round/10.0);var cells=PlacedKeys(s);Emit(s,new GameEvent{kind="naturalEvent",id=ev.id,strength=strength,n=cells.Count});if(ev.id=="meteor"){Meteor(s);return;}
            foreach(var cell in cells){var t=s.cells[cell];int before=t.attrs.Sum();for(int i=0;i<5;i++)if(ev.delta[i]!=0)AddAttr(s,cell,i,ev.delta[i]*strength);Emit(s,new GameEvent{kind="weather",id=ev.id,cell=cell,strength=strength,score=(t.attrs.Sum()-before)*.5});}
            Log(s,ev.name+"影响 "+cells.Count+" 格 · 强度 "+strength);
        }
        private static void AutoMergeSpirits(State s)
        {
            foreach(var cell in PlacedKeys(s))foreach(var el in EL){int n=0;var a=new GameAction{type="merge",cell=cell,el=el};while(Handle(s,a).ok)n++;
                if(n>0){JourneyAction(s,a);Emit(s,new GameEvent{kind="autoMerge",cell=cell,el=el,n=n});Log(s,"自动合成"+ElName(el)+"元素兽 ×"+n);}}
        }
        private sealed class UnitMove { public string from,to,list;public Unit unit; }
        private static ActionResult EndRoundInternal(State s)
        {
            if(s.over)return Fail("游戏已结束");
            double before=Score(s).total;int eventStart=s.events.Count;var keys=PlacedKeys(s);AutoGuardians(s);SettleRelations(s);
            for(int i=0;i<5;i++){string el=EL[i];foreach(var cell in TowerArea(s,s.tower.spring[el])){int previous=s.cells[cell].attrs[i];AddAttr(s,cell,i,s.tower.spring[el]);int n=s.cells[cell].attrs[i]-previous;if(n!=0)Emit(s,new GameEvent{cell=cell,kind="towerSpring",el=el,n=n,score=n*.5});}}
            // Attached guardians settle before natural spawning, once per current position.
            foreach(var k in keys)foreach(var guardian in s.cells[k].guardians){var targets=GuardianArea(s,k);var gains=new List<Gain>();
                foreach(var target in targets)for(int i=0;i<5;i++){string el=EL[i];int power=guardian.power[el];if(power==0)continue;
                    int previous=s.cells[target].attrs[i];AddAttr(s,target,i,power);int n=s.cells[target].attrs[i]-previous;
                    if(n!=0){Emit(s,new GameEvent{cell=target,kind="attr",el=el,n=n,score=n*.5});gains.Add(new Gain{cell=target,el=el,n=n});}}
                Emit(s,new GameEvent{cell=k,kind="guardian",guardianId=guardian.id,power=CopyBag(guardian.power),targets=targets,gains=gains});
            }
            foreach(var k in keys){var t=s.cells[k];
                var pos=EL.Select((e,i)=>new KeyValuePair<string,int>(e,Math.Max(0,t.attrs[i]))).Where(p=>p.Value>0).ToList();
                if(pos.Count>0&&t.spirits.Count<SpiritCap(t)){string el=PickWeighted(s,pos);t.spirits.Add(new Unit{id=s.nextId++,el=el});Emit(s,new GameEvent{cell=k,kind="spirit",el=el});}
                var neg=EL.Select((e,i)=>new KeyValuePair<string,int>(e,Math.Max(0,-t.attrs[i]))).Where(p=>p.Value>0).ToList();
                if(neg.Count>0&&t.cancers.Count<CancerCap(t)){string el=PickWeighted(s,neg);t.cancers.Add(new Unit{id=s.nextId++,el=el});Emit(s,new GameEvent{cell=k,kind="cancer",el=el});}
                foreach(var sp in t.spirits)if(++sp.age%3==0){s.inv.crystal[sp.el]++;if(s.progress!=null)s.progress.natural++;Emit(s,new GameEvent{cell=k,kind="crystal",el=sp.el});}
                foreach(var b in t.beasts)if(++b.age%2==0){s.inv.bigCrystal[b.el]++;Emit(s,new GameEvent{cell=k,kind="bigCrystal",el=b.el});}
                foreach(var c in t.cancers)if(++c.age%3==0&&t.attrs[Array.IndexOf(EL,c.el)]!=0){AddAttr(s,k,Array.IndexOf(EL,c.el),-1);s.inv.inverseCrystal[c.el]++;Emit(s,new GameEvent{cell=k,kind="inverseCrystal",el=c.el});}
                foreach(var a in t.animals){
                    if(!string.IsNullOrEmpty(a.el)){a.age++;int i=Array.IndexOf(EL,a.el);if(i>=0)AddAttr(s,k,i,1);}
                    else if(Rand(s)<.35){var available=EL.Where((el,i)=>t.attrs[i]>0).ToList();if(available.Count>0){a.el=Pick(s,available);a.age=0;CountStat(s,"feeds");Emit(s,new GameEvent{cell=k,kind="animalAwaken",el=a.el});}}
                }
                foreach(var p in t.plants){p.age++;if(p.age%3!=0)continue;int i=p.kind=="tree"||p.kind=="shrub"?1:p.kind=="weed"?2:4;AddAttr(s,k,i,1);
                }
            }
            // Gather first, apply later: prevent repeated migration/infection in one round.
            var moves=new List<UnitMove>();
            foreach(var k in keys){foreach(var b in s.cells[k].beasts){var options=new[]{k}.Concat(Neighbors(k).Where(n=>GetTile(s,n)!=null&&s.cells[n].attrs[Array.IndexOf(EL,b.el)]>0)).ToList();string to=Pick(s,options);if(to!=k)moves.Add(new UnitMove{from=k,to=to,unit=b,list="beasts"});}
                foreach(var c in s.cells[k].cancers){var options=Neighbors(k).Where(s.cells.ContainsKey).ToList();if(options.Count>0)moves.Add(new UnitMove{from=k,to=Pick(s,options),unit=c,list="cancers"});}}
            foreach(var move in moves){var from=s.cells[move.from];var to=s.cells[move.to];
                if(move.list=="beasts"){from.beasts=from.beasts.Where(x=>x.id!=move.unit.id).ToList();to.beasts.Add(move.unit);AddAttr(s,move.to,Array.IndexOf(EL,move.unit.el),1);}
                else {from.cancers=from.cancers.Where(x=>x.id!=move.unit.id).ToList();to.cancers.Add(move.unit);
                    if(from.spirits.Count>0){var sp=from.spirits[0];from.spirits.RemoveAt(0);from.cancers.Add(new Unit{id=sp.id,el=sp.el,age=0});Emit(s,new GameEvent{cell=move.from,kind="infection",el=sp.el});}}
            }
            foreach(var k in keys){var t=s.cells[k];var plants=EligiblePlants(t);var animals=EligibleAnimals(t);
                if(plants.Count>0&&t.plants.Count<5&&Rand(s)<1.0/3){string kind=Pick(s,plants);
                    t.plants.Add(new Unit{id=s.nextId++,kind=kind});Emit(s,new GameEvent{cell=k,kind="plant",plant=kind});}
                if(animals.Count>0&&Rand(s)<1.0/3){string kind=Pick(s,animals);
                    t.animals.Add(new Unit{id=s.nextId++,kind=kind,el=null,cd=0,age=0});Emit(s,new GameEvent{cell=k,kind="animal",animal=kind});}
                foreach(var predator in t.animals.ToList()){string[] preyKinds=predator.kind=="bird"?new[]{"fish"}:predator.kind=="bear"?new[]{"rabbit","fish"}:predator.kind=="leopard"?new[]{"deer"}:null;
                    var prey=preyKinds==null?null:t.animals.Find(a=>a!=predator&&preyKinds.Contains(a.kind));if(prey!=null){t.animals.Remove(prey);Emit(s,new GameEvent{cell=k,kind="predation"});}}
            }
            if(s.round%4==0&&s.cells.Count>0){NaturalEvent(s);RollEvent(s);}Degrade(s);TrimSpirits(s);AutoMergeSpirits(s);AutoGuardians(s);CheckMap(s);JourneyRound(s);TrimSpirits(s);UpdateProgress(s);Reconcile(s,before,"3,3",eventStart);
            var receipts=s.events.Where(e=>ReceiptKinds.Contains(e.kind)).ToList();if(receipts.Count>0)Log(s,"获得："+receipts.Count+" 份元素结晶");Log(s,"第 "+s.round+" 轮结束，灵力值 "+Number(Score(s).total));
            if(s.cells.Count==0){Finish(s,"failed","所有地块已消散");return Success("游戏结束");}
            var goal=Checkpoint(s);if(s.mode=="challenge"&&goal!=null&&s.round==goal.round){if(Score(s).total<goal.score){Finish(s,"failed","第 "+goal.round+" 轮目标 "+goal.score+"，当前灵力 "+Number(Score(s).total));return Success("阶段挑战失败");}Emit(s,new GameEvent{cell=TOWER_CELL,kind="stageClear",round=s.round});}
            if(s.mode=="challenge"&&s.round>=40){Finish(s,"won","完成 40 轮复苏挑战");return Success("挑战完成");}
            s.round++;s.roundAP=APLimit(s);s.ap=s.roundAP;s.placed=0;s.magicUsed.Clear();s.interactionUsed.Clear();RollOffers(s);return Success("新一轮");
        }
        public static ActionResult EndRound(State s) { s.events.Clear();return EndRoundInternal(s); }
        public static int BagCount(State s)
        {
            return s.inv.crystal.Values.Sum()+s.inv.bigCrystal.Values.Sum()+s.inv.inverseCrystal.Values.Sum()+s.inv.pureCrystal.Values.Sum()+s.inv.shields.Count;
        }
        private static string Number(double n) { return n.ToString("0.################",CultureInfo.InvariantCulture); }
        private static void CheckMap(State s)
        {
            if(!s.completedMap&&Shape.All(k=>k==TOWER_CELL||s.cells.ContainsKey(k))){s.completedMap=true;UnlockMemory(s,"ending");Emit(s,new GameEvent{cell=TOWER_CELL,kind="mapComplete"});Log(s,"初始地图铺满，可保存、摄影、检视或转入无尽模式");}
        }
        private static void Finish(State s,string result,string reason) { s.over=true;s.result=result;s.endReason=reason;Log(s,reason); }
        public static ActionResult EnterEndless(State s)
        {
            if(!s.completedMap||s.result=="failed")return Fail("需要先完成初始地图");
            if(s.result=="won"){s.round++;s.roundAP=APLimit(s);s.ap=s.roundAP;s.placed=0;s.magicUsed.Clear();s.interactionUsed.Clear();RollOffers(s);}
            s.mode="endless";s.over=false;s.result=null;s.endReason=null;return Success("进入无尽模式");
        }
        public static string Serialize(State s) { return NativeJson.Serialize(new SaveEnvelope{state=s}); }
        public static State Restore(string raw)
        {
            try {var parsed=NativeJson.Parse(raw) as Dictionary<string,object>;if(parsed==null||!parsed.ContainsKey("version")||Convert.ToInt32(parsed["version"])!=1||!parsed.ContainsKey("state"))return null;
                var source=parsed["state"] as Dictionary<string,object>;if(source==null||!ValidateSource(source))return null;
                // Read current-schema saves only. Legacy inputs are rejected without editing their source.
                var s=(State)NativeJson.ConvertValue(source,typeof(State));
                if(s.cells.ContainsKey(TOWER_CELL)||s.tower==null||s.tower.spent<0||EL.Any(e=>!s.tower.shelter.ContainsKey(e)||s.tower.shelter[e]<1||s.tower.shelter[e]>7||!s.tower.spring.ContainsKey(e)||s.tower.spring[e]<1||s.tower.spring[e]>7))return null;
                if(s.nextEvent==null||!Catalog.NaturalEvents.Any(e=>e.id==s.nextEvent.id)||s.nextEvent.id=="meteor"&&!EL.Contains(s.nextEvent.el))return null;
                if(s.magicRange==null||Catalog.Magics.Any(m=>!s.magicRange.ContainsKey(m.id)||s.magicRange[m.id]<1))return null;
                s.magicRange["purify"]=Math.Max(5,s.magicRange["purify"]);s.completedMap=s.completedMap||Shape.All(k=>k==TOWER_CELL||s.cells.ContainsKey(k));s.events.Clear();return s;
            }catch { return null; }
        }
        private static bool ValidateSource(Dictionary<string,object> source)
        {
            object v;
            foreach(var key in new[]{"edition","cells","inv","progress","stats","offers","shields","visions","round","ap","nextId","rng","unlockedMagics","interactionUsed","magicUsed","log","achievements","tower","magicRange","nextEvent"})if(!source.TryGetValue(key,out v)||v==null)return false;
            if((string)source["edition"]!="v13")return false;
            foreach(var key in new[]{"round","ap","nextId","rng"}){if(!IsInteger(source[key]))return false;}
            if(Convert.ToInt64(source["round"])<1||Convert.ToInt64(source["ap"])<0||Convert.ToInt64(source["nextId"])<1)return false;
            object mode,completed,result;source.TryGetValue("mode",out mode);source.TryGetValue("completedMap",out completed);source.TryGetValue("result",out result);
            var cells=source["cells"] as Dictionary<string,object>;if(cells==null||cells.Count==0&&!Equals(result,"failed")||cells.Keys.Any(k=>!Regex.IsMatch(k,@"^[-]?\d+,[-]?\d+$")||!Equals(mode,"endless")&&!Equals(completed,true)&&!ShapeKeys.Contains(k)))return false;
            foreach(var rawTile in cells.Values){var t=rawTile as Dictionary<string,object>;if(t==null||!t.TryGetValue("type",out v)||!(v is string)||!TYPE.ContainsKey((string)v))return false;
                if(!t.TryGetValue("attrs",out v)||!(v is List<object>)||((List<object>)v).Count!=5||((List<object>)v).Any(n=>!IsInteger(n)))return false;
                foreach(var list in new[]{"spirits","cancers","beasts","guardians","animals","plants"})if(!t.TryGetValue(list,out v)||!(v is List<object>))return false;
            }
            var offers=source["offers"] as List<object>;if(offers==null||offers.Any(k=>!(k is string)||!TYPE.ContainsKey((string)k)))return false;
            foreach(var name in new[]{"shields","visions","unlockedMagics","log","achievements"})if(!(source[name] is List<object>))return false;
            foreach(var name in new[]{"progress","stats","interactionUsed","magicUsed"})if(!(source[name] is Dictionary<string,object>))return false;
            var inv=source["inv"] as Dictionary<string,object>;if(inv==null)return false;
            foreach(var name in new[]{"crystal","bigCrystal","inverseCrystal","pureCrystal"}){if(!inv.TryGetValue(name,out v))return false;var bag=v as Dictionary<string,object>;if(bag==null||EL.Any(e=>!bag.ContainsKey(e)||!IsInteger(bag[e])||Convert.ToInt64(bag[e])<0))return false;}
            return true;
        }
        private static bool IsInteger(object value) { return value is long||value is int||value is uint||value is double&& !double.IsNaN((double)value)&&!double.IsInfinity((double)value)&&(double)value==Math.Truncate((double)value); }
        [Serializable] private sealed class SaveEnvelope { public int version=1;public State state; }
    }
}
