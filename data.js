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
    { id: 'purify', name: '净化', glyph: '✦', desc: '地块所有负值属性 +1（需有负值）' },
    { id: 'mine',   name: '生矿', glyph: '◈', desc: '金 +1' },
    { id: 'spring', name: '源泉', glyph: '◉', desc: '生成泉眼，水 +1' },
    { id: 'rich',   name: '富庶', glyph: '◎', desc: '土 +1' },
    { id: 'burn',   name: '焚尽', glyph: '▲', desc: '水、木归零，火 +1；烧掉植物、鱼和木/水元素灵' },
  ];

  const PLANTS = {
    grass:  { name: '草',   icon: '🌱' },
    shrub:  { name: '灌木', icon: '🌿' },
    tree:   { name: '树',   icon: '🌳' },
    weed:   { name: '水草', icon: '🪴' },
    crop:   { name: '作物', icon: '🌾' },
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
    { id: 'bucket',  name: '桶',     cost: { iron: 1, wood: 1 }, desc: '可舀水、倒水（移动水属性）' },
    { id: 'charm',   name: '净化符', cost: { silver: 1, gold: 1 }, desc: '对地块释放一次净化，不占魔法' },
    { id: 'shelter', name: '庇护所', cost: { wood: 2, copper: 1 }, target: true, desc: '在地块上搭建：木 +1、土 +1（每块一次）' },
  ];

  const RULES = {
    apPerRound: 3,
    offersPerRound: 3,
    startTiles: 5,
    startSum: 9,
    attrMin: -3,
    attrMax: 9,
    spiritCrystalEvery: 3,   // 元素灵每 3 轮产 1 结晶
    beastCrystalEvery: 2,    // 元素兽每 2 轮产 1 大结晶
    mergeCount: 3,           // 3 个同元素灵合成元素兽
    maxPlants: 3,
    maxAnimals: 4,
    maxOres: 2,
    pairCooldown: 3,
    elemAnimalEvery: 3,
  };

  // 灵力值 = Σ地块属性 + 元素灵×spirit + 元素兽×beast + 元素动物×elemAnimal
  const SCORE = { spirit: 1, beast: 3, elemAnimal: 2 };

  const Data = { ELEMENTS, TILE_TYPES, MAGICS, PLANTS, ANIMALS, ORES, RECIPES, RULES, SCORE, IDX: { M, W, A, F, E } };
  if (typeof module !== 'undefined' && module.exports) module.exports = Data;
  else root.GameData = Data;
})(this);
