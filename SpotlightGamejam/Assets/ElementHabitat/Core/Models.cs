// Native, engine-independent state. Attribute order is metal, wood, water, fire, earth.
using System;
using System.Collections.Generic;

namespace ElementHabitat
{
    [Serializable] public sealed class ElementBag : Dictionary<string, int>
    {
        public ElementBag() { foreach (var e in new[] { "metal", "wood", "water", "fire", "earth" }) this[e] = 0; }
        public int metal { get { return this["metal"]; } set { this["metal"] = value; } }
        public int wood { get { return this["wood"]; } set { this["wood"] = value; } }
        public int water { get { return this["water"]; } set { this["water"] = value; } }
        public int fire { get { return this["fire"]; } set { this["fire"] = value; } }
        public int earth { get { return this["earth"]; } set { this["earth"] = value; } }
    }
    [Serializable] public sealed class Unit { public int id, age, cd; public string el, kind; }
    [Serializable] public sealed class Guardian { public int id; public ElementBag power = new ElementBag(); }
    [Serializable] public sealed class Tile
    {
        public string type; public int[] attrs = new int[5];
        public List<Unit> spirits = new List<Unit>(), cancers = new List<Unit>(), beasts = new List<Unit>(), plants = new List<Unit>(), animals = new List<Unit>();
        public List<Guardian> guardians = new List<Guardian>(); public List<string> ores = new List<string>();
        public bool spring, pond, farm, vein, shelter, oasis; public int cleanAge;
    }
    [Serializable] public sealed class Shield
    {
        public int id, coverage; public ElementBag initialDefense, defense = new ElementBag();
        public List<string> cells = new List<string>();
    }
    [Serializable] public sealed class Inventory
    {
        public ElementBag crystal = new ElementBag(), bigCrystal = new ElementBag(), inverseCrystal = new ElementBag(), pureCrystal = new ElementBag();
        public Dictionary<string,int> ore = new Dictionary<string,int>();
        public int wood, bucket, bucketFull, water, charm; public List<Shield> shields = new List<Shield>();
    }
    [Serializable] public sealed class Progress { public bool t2, t3; public int natural; }
    [Serializable] public sealed class JourneyGrants { public bool water, shield; }
    [Serializable] public sealed class Journey
    {
        public int step, waterUses, useRound, version = 1; public bool skipped;
        public List<string> memories = new List<string>(), done = new List<string>(), read = new List<string>();
        public JourneyGrants grants = new JourneyGrants();
    }
    [Serializable] public sealed class Story { public List<string> memories = new List<string>(), read = new List<string>(); }
    [Serializable] public sealed class VisionState { public string id; public bool done; }
    [Serializable] public sealed class MeteorState { public int round, blocked, damage; public string el; public List<string> cells = new List<string>(); }
    [Serializable] public sealed class Tower { public ElementBag shelter = Ones(), spring = Ones(); public int spent; private static ElementBag Ones(){var b=new ElementBag();foreach(var e in Game.EL)b[e]=1;return b;} }
    [Serializable] public sealed class NaturalEventState { public string id, el; }
    [Serializable] public sealed class NaturalEventDefinition { public string id,name,tone,color,el; public int[] delta; }
    [Serializable] public sealed class StageTarget { public int round, score; }
    [Serializable] public sealed class MeteorPower { public int damage,count; }
    [Serializable] public sealed class TowerPayment { public int normal,big; public bool ok; }
    [Serializable] public sealed class UpgradePayment { public int[] deficit; public ElementBag normal=new ElementBag(),big=new ElementBag(); }
    [Serializable] public sealed class CrystalUse { public string kind,el;public int count; }
    [Serializable] public sealed class CrystalPlan { public bool ok,capped;public string msg;public int[] attrs;public int count,gain; }
    [Serializable] public sealed class UpgradePlan { public bool ok;public string msg;public ElementBag normal,big; }
    [Serializable] public sealed class Relation { public string[] targets;public string el,name,neighbor;public int n; }
    [Serializable] public sealed class Gain { public string cell, el; public int n; }
    [Serializable] public sealed class GameEvent
    {
        public string cell, kind, id, el, from, memory, plant, animal, ore, magic, neighbor;
        public double n, score;public int guardianId, damage,strength,round;public bool sheltered; public ElementBag power;
        public List<string> targets; public List<Gain> gains;
    }
    [Serializable] public sealed class State
    {
        public string edition = "v13", mode="challenge", result,endReason; public Progress progress = new Progress();
        public uint seed; public int rng, round = 1, ap = 3, roundAP = 3, placed, nextId = 1;public double peakScore; public bool over,completedMap;
        public Tower tower=new Tower();public NaturalEventState nextEvent;
        public Dictionary<string,int> magicRange=new Dictionary<string,int>{{"purify",5},{"mine",1},{"spring",1},{"rich",1},{"burn",1}};
        public List<string> unlockedMagics = new List<string> { "purify" }, offers = new List<string>(), log = new List<string>(), achievements = new List<string>();
        public Dictionary<string,bool> magicUsed = new Dictionary<string,bool>(), interactionUsed = new Dictionary<string,bool>();
        public Dictionary<string,Tile> cells = new Dictionary<string,Tile>(); public Inventory inv = new Inventory();
        public List<Shield> shields = new List<Shield>(); public List<GameEvent> events = new List<GameEvent>();
        public Dictionary<string,int> stats = new Dictionary<string,int>(); public List<VisionState> visions = new List<VisionState>();
        public Journey journey; public Story story; public MeteorState lastMeteor;
    }
    [Serializable] public sealed class GameAction
    {
        public string type, cell, from, to, magic, el, tileType, kind, what, read, recipe, feature;
        public int offer = -1, spiritId, beastId, guardianId, animalId, plantId, targetId, shieldId, index, count = 1;
        public bool inverse, big, skip; public List<int> beastIds; public object crystals;public Dictionary<string,int> bigCrystals;public List<GameAction> upgrades;
    }
    [Serializable] public sealed class ActionResult { public bool ok; public string msg; public ActionResult(bool ok, string msg) { this.ok = ok; this.msg = msg; } }
    [Serializable] public sealed class ScoreResult { public int attrs,ecology,tower,spirits,beasts,elemAnimals,plants,bonus;public double @base,total; }
    [Serializable] public sealed class TileDefinition
    {
        public string id, name, family, familyName, branch, branchKey, parent, effect, tag, art, look, passiveId, cost, trigger, limit;
        public int level, requiredN = 1; public int[] attrs;
    }
    [Serializable] public sealed class ElementDefinition { public string key, name, color; }
    [Serializable] public sealed class MagicDefinition { public string id, name, glyph, unlock, desc, element; }
    [Serializable] public sealed class MilestoneDefinition { public string id, name, icon, desc, metric; public int target, bonus; }
    [Serializable] public sealed class ItemDefinition { public string name, icon; public int weight; }
}
