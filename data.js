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

  const TERRAIN = typeof module !== 'undefined' && module.exports ? require('./terrain.js') : root.TerrainCatalog;
  const TILE_TYPES = TERRAIN.nodes;
  const MAGICS = [
    { element: 'wood', id: 'purify', name: '净化', glyph: '✦', unlock: null, desc: '覆盖区负属性 +5，清除癌元' },
    { element: 'metal', id: 'mine',   name: '生矿', glyph: '◈', unlock: 'metal', desc: '金 +5；全图金≥20解锁' },
    { element: 'water', id: 'spring', name: '源泉', glyph: '◉', unlock: 'water', desc: '水 +5；全图水≥20解锁' },
    { element: 'earth', id: 'rich',   name: '富庶', glyph: '◎', unlock: 'earth', desc: '土 +5；全图土≥20解锁' },
    { element: 'fire', id: 'burn',   name: '焚尽', glyph: '▲', unlock: 'fire', desc: '水木归零、火 +5，清除癌元及易燃生物；全图火≥20解锁' },
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
    maxAnimals: Infinity,
    spawnChance: 1 / 3,
    meteorEvery: 10,
    maxRounds: 40,
    stageEvery: 500,
    stageTargets: [{round:10,score:80},{round:20,score:220},{round:30,score:450},{round:40,score:800}],
    maxAP: 9,
    magicUnlock: 20,
    pairCooldown: 3,
    elemAnimalEvery: 3,
  };

  // 用户确认第七节：属性和 + 元素兽×3 + 动物不计分 + 植物×1；愿景奖励另列
  const SCORE = { spirit: 0, beast: 3, elemAnimal: 0, plant: 1 };

  const ACHIEVEMENTS = [
    { id: 'first_place', name: '新生的一角', icon: '🌱', desc: '放置第一块地块', metric: 'placements', target: 1 },
    { id: 'purifier', name: '万物复原', icon: '✦', desc: '净化 5 块污染地块', metric: 'purified', target: 5 },
    { id: 'cluster', name: '连绵生境', icon: '🏞', desc: '连接 5 块同种地形', metric: 'cluster', target: 5 },
    { id: 'upgrade', name: '大地蜕变', icon: '⬆', desc: '升级一块地形', metric: 'upgrades', target: 1 },
    { id: 'beast', name: '贤者的伙伴', icon: '◆', desc: '合成一只元素兽', metric: 'merges', target: 1 },
    { id: 'animal', name: '元素共生', icon: '🐾', desc: '见证一只动物自动元素化', metric: 'feeds', target: 1 },
    { id: 'shelter', name: '灵性生境', icon: '🐾', desc: '见证3只动物元素化', metric: 'feeds', target: 3 },
    { id: 'shield', name: '星雨守护者', icon: '🛡', desc: '使用元素盾抵挡一次陨石伤害', metric: 'blocked', target: 1 },
    { id: 'stage', name: '灵脉苏醒', icon: '✨', desc: '灵力达到 500', metric: 'peakScore', target: 500 },
    { id: 'variety', name: '五行归位', icon: '🌈', desc: '拥有五种元素兽', metric: 'beastElements', target: 5 },
    { id: 'world', name: '生境重建', icon: '🌍', desc: '铺满 85 格地图', metric: 'tiles', target: 85 },
    { id: 'vision', name: '愿景成真', icon: '⭐', desc: '完成本局的全部愿景', metric: 'visions', target: 2 },
  ];
  ACHIEVEMENTS.push({id:'guardian',name:'五兽同誓',icon:'✦',desc:'合成首个守护灵',metric:'guardians',target:1});
  const VISIONS = [
    { id: 'wake_beast', name: '唤醒伙伴', desc: '合成一只元素兽', metric: 'merges', target: 1, bonus: 30 },
    { id: 'clean_world', name: '澄澈大地', desc: '施放净化后使全图无负值且无癌元', metric: 'clean', target: 1, bonus: 30 },
    { id: 'green_world', name: '绿意归巢', desc: '同时拥有 20 株植物', metric: 'plants', target: 20, bonus: 30 },
    { id: 'settlement', name: '灵性共生', desc: '见证3只动物元素化', metric: 'feeds', target: 3, bonus: 30 },
  ];
  const Data = { TERRAIN, ACHIEVEMENTS, VISIONS, ELEMENTS, TILE_TYPES, MAGICS, PLANTS, ANIMALS, RULES, SCORE, IDX: { M, W, A, F, E } };
  if (typeof module !== 'undefined' && module.exports) module.exports = Data;
  else root.GameData = Data;
})(this);
