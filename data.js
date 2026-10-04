// 静态配置：元素、地块、魔法、生物、配方、计分参数
// 属性数组顺序固定为 [金, 木, 水, 火, 土]
(function (root) {
  const ELEMENTS = [
    { key: 'metal', name: '金', color: '#c9a227' },
    { key: 'wood',  name: '木', color: '#3f9a4a' },
    { key: 'water', name: '水', color: '#2f7fd1' },
    { key: 'fire',  name: '火', color: '#d4512e' },
    { key: 'earth', name: '土', color: '#8a6a3d' },
  ];
  const M = 0, W = 1, A = 2, F = 3, E = 4; // 金木水火土 下标

  // 中层地块（文档 2.2），初始值 = 属性之和
  const TILE_TYPES = [
    { id: 'ruin_town',      name: '破败城镇', attrs: [0, 1, 0, 0, 0],  look: 'ruin' },
    { id: 'polluted_lake',  name: '污染湖泊', attrs: [0, -1, 2, 0, 0], look: 'pollute_water' },
    { id: 'polluted_waste', name: '污染荒原', attrs: [0, -1, 0, 0, 2], look: 'pollute_earth' },
    { id: 'polluted_mount', name: '污染山地', attrs: [1, -1, 0, 0, 1], look: 'pollute_rock' },
    { id: 'barren',         name: '荒土',     attrs: [0, 0, 0, 1, 1],  look: 'barren' },
    { id: 'rockland',       name: '岩地',     attrs: [1, 0, 0, 1, 0],  look: 'rock' },
    { id: 'desert',         name: '沙漠',     attrs: [0, 0, 0, 2, 0],  look: 'sand' },
    { id: 'bare_mount',     name: '荒山',     attrs: [1, 0, 0, 1, 0],  look: 'bare' },
    { id: 'grassland',      name: '草原',     attrs: [0, 1, 1, 0, 1],  look: 'grass' },
    { id: 'lake',           name: '湖泊',     attrs: [0, 1, 2, 0, 0],  look: 'water' },
    { id: 'volcano',        name: '火山',     attrs: [0, 0, 0, 3, 0],  look: 'lava' },
    { id: 'wasteland',      name: '荒漠',     attrs: [0, 1, 0, 1, 1],  look: 'waste' },
    { id: 'rock_mount',     name: '岩山',     attrs: [2, 0, 0, 1, 0],  look: 'peak' },
    { id: 'forest',         name: '森林',     attrs: [0, 2, 1, 0, 1],  look: 'forest' },
    { id: 'wetland',        name: '湿地',     attrs: [0, 2, 1, 0, 1],  look: 'wet' },
    { id: 'mine',           name: '矿山',     attrs: [3, 0, 1, 0, 0],  look: 'mine' },
    { id: 'valley',         name: '河谷',     attrs: [0, 2, 2, 0, 0],  look: 'valley' },
    { id: 'rainforest',     name: '雨林',     attrs: [0, 2, 1, 0, 2],  look: 'rain' },
    { id: 'fertile',        name: '肥土',     attrs: [0, 1, 1, 0, 3],  look: 'fertile' },
    { id: 'creek_plain',    name: '溪原',     attrs: [0, 3, 1, 0, 1],  look: 'creek' },
  ];

  const MAGICS = [
    { id: 'purify', name: '净化', glyph: '✦', unlock: null, desc: '选中及四邻地块负属性 +5，清除癌元' },
    { id: 'mine',   name: '生矿', glyph: '◈', unlock: 'metal', desc: '生成矿脉，金 +5；全图金≥20解锁' },
    { id: 'spring', name: '源泉', glyph: '◉', unlock: 'water', desc: '生成泉眼，水 +5；全图水≥20解锁' },
    { id: 'rich',   name: '富庶', glyph: '◎', unlock: 'earth', desc: '生成耕田，土 +5；全图土≥20解锁' },
    { id: 'burn',   name: '焚尽', glyph: '▲', unlock: 'fire', desc: '水木归零、火 +5，清除癌元及易燃生物；全图火≥20解锁' },
  ];

  const PLANTS = {
    grass:  { name: '草',   icon: '🌱' },
    shrub:  { name: '灌木', icon: '🌿' },
    tree:   { name: '树',   icon: '🌳' },
    weed:   { name: '水草', icon: '🪴' },
    crop:   { name: '水稻', icon: '🌾' },
    wheat:  { name: '小麦', icon: '🌾' },
    corn:   { name: '玉米', icon: '🌽' },
  };
  const ANIMALS = {
    rabbit:  { name: '兔子', icon: '🐇' },
    fish:    { name: '鱼',   icon: '🐟' },
    bird:    { name: '鸟',   icon: '🐦' },
    bear:    { name: '熊',   icon: '🐻' },
    deer:    { name: '鹿',   icon: '🦌' },
    leopard: { name: '豹子', icon: '🐆' },
    cow:     { name: '牛',   icon: '🐄' },
    sheep:   { name: '羊',   icon: '🐑' },
  };
  const ORES = {
    gold:   { name: '金矿', weight: 1 },
    silver: { name: '银矿', weight: 2 },
    copper: { name: '铜矿', weight: 3 },
    iron:   { name: '铁矿', weight: 4 },
  };

  // 配方：cost 从背包扣除；target=true 表示需要选一个地块
  const RECIPES = [
    { id: 'bucket',  name: '桶',     cost: { wood: 1 }, desc: '舀水、倒水免费；倒水 +1 并生成小湖，沙漠变绿洲' },
    { id: 'charm',   name: '净化符', cost: { silver: 1, gold: 1 }, desc: '对地块释放一次净化，不占魔法' },
    { id: 'shelter', name: '庇护所', cost: { wood: 4, iron: 2 }, target: true, desc: '元素灵容量 +4（每块一次）' },
  ];

  const RULES = {
    apPerRound: 3,
    offersPerRound: 3,
    startTiles: 5,
    startSum: 9,
    clusterBonus: 3,
    attrMax: 9,
    spiritCrystalEvery: 3,   // 元素灵每 3 轮产 1 结晶
    beastCrystalEvery: 2,    // 元素兽每 2 轮产 1 大结晶
    mergeCount: 3,           // 3 个同元素灵合成元素兽
    guardianMergeCount: 5,   // 同一地块任意 5 个元素兽，保留配比
    maxPlants: 5,
    maxAnimals: 3,
    maxOres: 2,
    spawnChance: 1 / 3,
    meteorEvery: 10,
    stageEvery: 500,
    maxAP: 9,
    magicUnlock: 20,
    pairCooldown: 3,
    elemAnimalEvery: 3,
  };

  // 用户确认第七节：属性和 + 元素兽×3 + 元素动物×1 + 植物×1；愿景奖励另列
  const SCORE = { spirit: 0, beast: 3, elemAnimal: 1, plant: 1 };

  const FARM_TYPES = ['barren', 'grassland', 'wetland', 'valley', 'fertile', 'creek_plain'];
  const ORE_TYPES = ['rockland', 'rock_mount', 'mine'];
  const WATER_TYPES = ['polluted_lake', 'lake', 'wetland', 'valley', 'creek_plain'];
  const ACHIEVEMENTS = [
    { id: 'first_place', name: '新生的一角', icon: '🌱', desc: '放置第一块地块', metric: 'placements', target: 1 },
    { id: 'purifier', name: '万物复原', icon: '✦', desc: '净化 5 块污染地块', metric: 'purified', target: 5 },
    { id: 'cluster', name: '连绵生境', icon: '🏞', desc: '连接 5 块同种地形', metric: 'cluster', target: 5 },
    { id: 'upgrade', name: '大地蜕变', icon: '⬆', desc: '升级一块地形', metric: 'upgrades', target: 1 },
    { id: 'beast', name: '贤者的伙伴', icon: '◆', desc: '合成一只元素兽', metric: 'merges', target: 1 },
    { id: 'animal', name: '元素共生', icon: '🐾', desc: '培养一只元素动物', metric: 'feeds', target: 1 },
    { id: 'shelter', name: '温暖归处', icon: '🏠', desc: '搭建一座庇护所', metric: 'shelters', target: 1 },
    { id: 'shield', name: '星雨守护者', icon: '🛡', desc: '使用元素盾抵挡一次陨石伤害', metric: 'blocked', target: 1 },
    { id: 'stage', name: '灵脉苏醒', icon: '✨', desc: '灵力达到 500', metric: 'peakScore', target: 500 },
    { id: 'variety', name: '五行归位', icon: '🌈', desc: '拥有五种元素兽', metric: 'beastElements', target: 5 },
    { id: 'world', name: '生境重建', icon: '🌍', desc: '铺满 85 格地图', metric: 'tiles', target: 85 },
    { id: 'vision', name: '愿景成真', icon: '⭐', desc: '完成本局的全部愿景', metric: 'visions', target: 2 },
  ];
  const VISIONS = [
    { id: 'wake_beast', name: '唤醒伙伴', desc: '合成一只元素兽', metric: 'merges', target: 1, bonus: 30 },
    { id: 'clean_world', name: '澄澈大地', desc: '施放净化后使全图无负值且无癌元', metric: 'clean', target: 1, bonus: 30 },
    { id: 'green_world', name: '绿意归巢', desc: '同时拥有 20 株植物', metric: 'plants', target: 20, bonus: 30 },
    { id: 'settlement', name: '安居之所', desc: '搭建一座庇护所', metric: 'shelters', target: 1, bonus: 30 },
  ];
  const Data = { FARM_TYPES, ORE_TYPES, WATER_TYPES, ACHIEVEMENTS, VISIONS, ELEMENTS, TILE_TYPES, MAGICS, PLANTS, ANIMALS, ORES, RECIPES, RULES, SCORE, IDX: { M, W, A, F, E } };
  if (typeof module !== 'undefined' && module.exports) module.exports = Data;
  else root.GameData = Data;
})(this);
