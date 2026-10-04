// 确定性规则引擎：所有规则与进度都在这里；DOM、存储、动画在表现层。
(function (root) {
  const D = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.GameData;
  const { TILE_TYPES, RULES, SCORE, ORES, RECIPES } = D;
  const EL = D.ELEMENTS.map(e => e.key);
  const TYPE = Object.fromEntries(TILE_TYPES.map(t => [t.id, t]));
  const sum = a => a.reduce((x, y) => x + y, 0);
  const tier = t => sum(t.attrs);
  const emptyEl = () => Object.fromEntries(EL.map(e => [e, 0]));
  const key = (x, y) => x + ',' + y;
  const parse = k => k.split(',').map(Number);
  const SHAPE = [];
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) SHAPE.push([x, y]);
  [[1, 5], [2, 4], [3, 3]].forEach(([a, b], i) => {
    for (let t = a; t <= b; t++) SHAPE.push([t, -i - 1], [t, 7 + i], [-i - 1, t], [7 + i, t]);
  });
  const SHAPE_KEYS = new Set(SHAPE.map(([x, y]) => key(x, y)));
  const BOUNDS = { minX: -3, maxX: 9, minY: -3, maxY: 9 };
  function neighbors(k) {
    const [x, y] = parse(k);
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].map(([a, b]) => key(a, b)).filter(n => SHAPE_KEYS.has(n));
  }
  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, a) => a[Math.floor(rand(s) * a.length)];
  function shuffle(s, a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function pickWeighted(s, pairs) {
    let r = rand(s) * sum(pairs.map(p => p[1]));
    for (const [v, w] of pairs) if ((r -= w) < 0) return v;
    return pairs[pairs.length - 1][0];
  }
  const id = s => s.nextId++;
  const elName = el => D.ELEMENTS.find(e => e.key === el).name;
  const emit = (s, e) => s.events.push(e);
  function log(s, msg) { s.log.unshift(`[${s.round}] ${msg}`); if (s.log.length > 200) s.log.pop(); }
  const fail = msg => ({ ok: false, msg });
  const success = msg => ({ ok: true, msg });
  const placedKeys = s => Object.keys(s.cells);
  const emptyKeys = s => SHAPE.map(([x, y]) => key(x, y)).filter(k => !s.cells[k]);
  const spiritCap = t => Math.max(0, sum(t.attrs)) + (t.shelter ? 4 : 0);
  const cancerCap = t => -sum(t.attrs.filter(v => v < 0));
  const legalPlacements = s => s.placed || s.over ? [] : emptyKeys(s).filter(k => neighbors(k).some(n => s.cells[n]));
  const globalAttrs = s => EL.map((_, i) => sum(Object.values(s.cells).map(t => t.attrs[i])));
  const totalAttrs = s => sum(globalAttrs(s));
  const hasWater = t => t.attrs[2] > 0 && (t.spring || t.pond || D.WATER_TYPES.includes(t.type));
  const isFarm = t => t.farm || D.FARM_TYPES.includes(t.type);
  const hasOre = t => t.vein || D.ORE_TYPES.includes(t.type);
  function makeTile(typeId) {
    return { type: typeId, attrs: TYPE[typeId].attrs.slice(), spirits: [], cancers: [], beasts: [], plants: [], animals: [], ores: [], spring: false, pond: false, farm: false, vein: false, shelter: false, oasis: false };
  }
  function cluster(s, cell) {
    if (!s.cells[cell]) return [];
    const found = new Set([cell]), todo = [cell], type = s.cells[cell].type;
    for (let i = 0; i < todo.length; i++) for (const n of neighbors(todo[i])) {
      if (!found.has(n) && s.cells[n] && s.cells[n].type === type) { found.add(n); todo.push(n); }
    }
    return todo;
  }
  const attrCap = (s, cell) => RULES.attrMax + RULES.clusterBonus * (cluster(s, cell).length - 1);
  function addAttr(s, cell, i, n) { s.cells[cell].attrs[i] = Math.min(attrCap(s, cell), s.cells[cell].attrs[i] + n); }
  function trimSpirits(s) { for (const t of Object.values(s.cells)) t.spirits.length = Math.min(t.spirits.length, spiritCap(t)); }
  function capTerrain(s) { for (const k of placedKeys(s)) s.cells[k].attrs = s.cells[k].attrs.map(v => Math.min(attrCap(s, k), v)); trimSpirits(s); }
  function upgrades(s, cell) {
    const t = s.cells[cell];
    return t ? TILE_TYPES.filter(ty => tier(ty) > tier(TYPE[t.type]) && ty.attrs.every((v, i) => t.attrs[i] >= v)) : [];
  }
  function score(s) {
    const ts = Object.values(s.cells);
    const attrs = totalAttrs(s), spirits = sum(ts.map(t => t.spirits.length)), beasts = sum(ts.map(t => t.beasts.length));
    const elemAnimals = sum(ts.map(t => t.animals.filter(a => a.el).length)), plants = sum(ts.map(t => t.plants.length));
    const base = attrs + spirits * SCORE.spirit + beasts * SCORE.beast + elemAnimals * SCORE.elemAnimal + plants * SCORE.plant;
    const bonus = sum((s.visions || []).filter(v => v.done).map(v => D.VISIONS.find(d => d.id === v.id).bonus));
    return { attrs, spirits, beasts, elemAnimals, plants, base, bonus, total: base + bonus };
  }
  const stage = s => Math.min(4, 1 + Math.floor(Math.max(0, s.peakScore || 0) / RULES.stageEvery));
  const apLimit = s => Math.min(RULES.maxAP, RULES.apPerRound + (stage(s) - 1) * 2);
  function offerPool(s, unrestricted) {
    const st = stage(s);
    return unrestricted ? TILE_TYPES : TILE_TYPES.filter(t => st === 1 ? tier(t) === 1 : Math.abs(tier(t) - st) <= 1);
  }
  function rollOffers(s, unrestricted = false) {
    s.offers = shuffle(s, offerPool(s, unrestricted)).slice(0, RULES.offersPerRound).map(t => t.id);
  }
  function newGame(seed, options = {}) {
    const s = {
      seed: seed >>> 0, rng: seed | 0, round: 1, ap: RULES.apPerRound, roundAP: RULES.apPerRound,
      placed: 0, unlockedMagics: ['purify'], magicUsed: {}, interactionUsed: {}, offers: [], cells: {}, nextId: 1,
      inv: { crystal: emptyEl(), bigCrystal: emptyEl(), inverseCrystal: emptyEl(), ore: Object.fromEntries(Object.keys(ORES).map(k => [k, 0])), wood: 0, bucket: 0, bucketFull: 0, water: 0, charm: 0, shields: [] },
      shields: [], scenario: ['standard', 'fire', 'water'].includes(options.scenario) ? options.scenario : 'standard',
      log: [], events: [], over: false, peakScore: 0, stats: {}, achievements: [], visions: [], lastMeteor: null,
    };
    let types;
    if (s.scenario === 'fire') types = ['desert', 'desert', 'barren', 'bare_mount', 'ruin_town'];
    else if (s.scenario === 'water') types = ['polluted_lake', 'polluted_lake', 'lake', 'lake', 'ruin_town'];
    else types = [1, 2, 2, 2, 2].map(n => pick(s, TILE_TYPES.filter(t => tier(t) === n)).id);
    types = shuffle(s, types);
    ['3,3', '2,3', '4,3', '3,2', '3,4'].forEach((k, i) => { s.cells[k] = makeTile(types[i]); });
    s.visions = shuffle(s, D.VISIONS).slice(0, 2).map(v => ({ id: v.id, done: false }));
    rollOffers(s); s.peakScore = score(s).total;
    log(s, `元素生境开始。初始 5 块地属性和 = ${totalAttrs(s)}`);
    return s;
  }
  function magicUnlocked(s, magic) {
    const m = D.MAGICS.find(m => m.id === magic);
    return !!m && (!m.unlock || s.unlockedMagics.includes(m.id) || globalAttrs(s)[EL.indexOf(m.unlock)] >= RULES.magicUnlock);
  }
  function canPurify(s, cell) { return [cell, ...neighbors(cell)].some(k => s.cells[k] && (s.cells[k].attrs.some(v => v < 0) || (s.cells[k].cancers || []).length)); }
  function metrics(s) {
    const ts = Object.values(s.cells);
    return { ...s.stats, tiles: ts.length, cluster: Math.max(...placedKeys(s).map(k => cluster(s, k).length)),
      peakScore: s.peakScore, beastElements: new Set(ts.flatMap(t => t.beasts.map(b => b.el))).size,
      plants: sum(ts.map(t => t.plants.length)), clean: s.stats.purified > 0 && ts.every(t => t.attrs.every(v => v >= 0) && t.cancers.length === 0) ? 1 : 0,
      visions: s.visions.filter(v => v.done).length };
  }
  function updateProgress(s) {
    for(const m of D.MAGICS)if(magicUnlocked(s,m.id)&&!s.unlockedMagics.includes(m.id))s.unlockedMagics.push(m.id);
    s.peakScore = Math.max(s.peakScore, score(s).base);
    let values = metrics(s);
    for (const v of s.visions) {
      const d = D.VISIONS.find(d => d.id === v.id);
      if (!v.done && (values[d.metric] || 0) >= d.target) { v.done = true; log(s, `愿景完成：${d.name}，奖励 ${d.bonus}`); emit(s, { cell: '3,3', kind: 'vision', id: d.id, score: d.bonus }); }
    }
    values = metrics(s);
    for (const a of D.ACHIEVEMENTS) if (!s.achievements.includes(a.id) && (values[a.metric] || 0) >= a.target) {
      s.achievements.push(a.id); log(s, `成就解锁：${a.name}`); emit(s, { cell: '3,3', kind: 'achievement', id: a.id });
    }
    s.peakScore = Math.max(s.peakScore, score(s).base);
    const limit = apLimit(s);
    if (limit > s.roundAP) { s.ap += limit - s.roundAP; s.roundAP = limit; log(s, `灵脉提升，行动上限 ${limit}`); }
  }
  const countStat = (s, name, n = 1) => { s.stats[name] = (s.stats[name] || 0) + n; };
  function purify(s, cell, area) {
    for (const k of area ? [cell, ...neighbors(cell)] : [cell]) {
      const t = s.cells[k]; if (!t) continue;
      if (t.attrs.some(v => v < 0) || t.cancers.length) countStat(s, 'purified');
      t.attrs = t.attrs.map(v => v < 0 ? Math.min(attrCap(s, k), v + 5) : v);
      t.cancers = []; emit(s, { cell: k, kind: 'purify' });
    }
  }
  const nearby = (s, a, b) => !!s.cells[a] && !!s.cells[b] && neighbors(a).includes(b);
  function interactionKeys(s, a) {
    const t = s.cells[a.cell || a.from];
    if (a.type === 'moveSpirit') return ['spirit:' + a.spiritId];
    if (a.type === 'moveBeast') return ['beast:' + a.beastId];
    if (a.type === 'moveAnimal' || a.type === 'feed' || a.type === 'pair') {
      const keys = ['animal:' + a.animalId];
      if (a.type === 'pair' && t) {
        const animal = t.animals.find(x => x.id === a.animalId);
        const mate = animal && t.animals.find(x => x.id !== animal.id && x.kind === animal.kind && !x.cd && !s.interactionUsed['animal:' + x.id]);
        if (mate) keys.push('animal:' + mate.id);
      }
      return keys;
    }
    if (a.type === 'chop' || a.type === 'movePlant') return ['plant:' + a.plantId];
    if (a.type === 'compost') return [a.what + ':' + a.targetId];
    if (a.type === 'merge' && t) return t.spirits.filter(sp => sp.el === a.el && !s.interactionUsed['spirit:' + sp.id]).slice(0, 3).map(sp => 'spirit:' + sp.id);
    if (a.type === 'mineOre' && t) return ['ore:' + (t.ores[a.index] || '')];
    if (a.type === 'scoop' || a.type === 'pour') return ['bucket'];
    if (a.type === 'deployShield') return ['shield:' + a.shieldId];
    if (a.type === 'craft') return ['craft:' + a.recipe];
    if (a.type === 'craftShield') return ['craft:shield'];
    if (a.type === 'useCharm') return ['charm'];
    return [];
  }
  const handlers = {
    place(s, a) {
      if (s.placed) return fail('每轮只能放置一块地块');
      const typeId = s.offers[a.offer];
      if (!typeId || !Number.isInteger(a.offer)) return fail('无效的待选地块');
      if (!legalPlacements(s).includes(a.cell)) return fail('只能放在已有地块相邻的空位');
      s.cells[a.cell] = makeTile(typeId); s.offers = []; s.placed = 1;
      countStat(s, 'placements'); emit(s, { cell: a.cell, kind: 'place' });
      return success(`放置 ${TYPE[typeId].name}`);
    },
    cast(s, a) {
      const t = s.cells[a.cell], m = D.MAGICS.find(m => m.id === a.magic);
      if (!t || !m) return fail('需要选择地块和有效魔法');
      if (!magicUnlocked(s, a.magic)) return fail(`全图${elName(m.unlock)}属性须达到 20`);
      if (s.magicUsed[a.magic]) return fail('每种魔法每轮只能施放一次');
      if (a.magic === 'purify') {
        if (!canPurify(s, a.cell)) return fail('选中及四邻没有污染或癌元');
        purify(s, a.cell, true);
      } else if (a.magic === 'mine') { t.vein = true; addAttr(s, a.cell, 0, 5); }
      else if (a.magic === 'spring') { t.spring = true; addAttr(s, a.cell, 2, 5); }
      else if (a.magic === 'rich') { t.farm = true; addAttr(s, a.cell, 4, 5); }
      else {
        t.attrs[1] = t.attrs[2] = 0; addAttr(s, a.cell, 3, 5);
        t.cancers = []; t.plants = []; t.animals = t.animals.filter(a => a.kind !== 'fish');
        t.spirits = t.spirits.filter(sp => sp.el !== 'wood' && sp.el !== 'water');
        t.spring = t.pond = false;
      }
      s.magicUsed[a.magic] = true;
      return success(`施放${m.name}魔法`);
    },
    upgrade(s, a) {
      const ty = upgrades(s, a.cell).find(t => t.id === a.tileType);
      if (!ty) return fail('属性未达到该地形的五维门槛');
      s.cells[a.cell].type = ty.id; s.cells[a.cell].oasis = false; capTerrain(s);
      countStat(s, 'upgrades'); emit(s, { cell: a.cell, kind: 'upgrade' });
      return success(`升级为${ty.name}`);
    },
    reroll(s) {
      if (s.placed) return fail('地块放置后不能重投');
      if (sum(Object.values(s.inv.crystal)) < 3) return fail('重投需要 3 颗普通元素结晶');
      takeCrystals(s, 3); rollOffers(s, true); countStat(s, 'rerolls');
      return success('消耗 3 颗结晶重投');
    },
    moveSpirit(s, a) {
      if (!nearby(s, a.from, a.to)) return fail('只能移到相邻地块');
      const from = s.cells[a.from], to = s.cells[a.to], i = from.spirits.findIndex(x => x.id === a.spiritId);
      if (i < 0) return fail('找不到该元素灵');
      if (to.spirits.length >= spiritCap(to)) return fail('目标地块元素灵已满');
      to.spirits.push(from.spirits.splice(i, 1)[0]); return success('移动元素灵');
    },
    moveBeast(s, a) {
      if (!nearby(s, a.from, a.to)) return fail('只能移到相邻地块');
      const from = s.cells[a.from], b = from.beasts.find(b => b.id === a.beastId);
      if (!b || s.cells[a.to].attrs[EL.indexOf(b.el)] <= 0) return fail('目标需要该元素的正属性');
      from.beasts = from.beasts.filter(x => x !== b); s.cells[a.to].beasts.push(b); addAttr(s, a.to, EL.indexOf(b.el), 1);
      return success('元素兽移动并滋养地块');
    },
    movePlant(s, a) {
      if (!nearby(s, a.from, a.to)) return fail('只能移到相邻地块');
      const from = s.cells[a.from], to = s.cells[a.to], i = from.plants.findIndex(x => x.id === a.plantId);
      if (i < 0) return fail('找不到植物');
      if (to.plants.length >= RULES.maxPlants || (from.plants[i].kind === 'weed' && !hasWater(to))) return fail('目标植物已满或缺少水域');
      to.plants.push(from.plants.splice(i, 1)[0]); return success('移植植物');
    },
    moveAnimal(s, a) {
      if (!nearby(s, a.from, a.to)) return fail('只能移到相邻地块');
      const from = s.cells[a.from], to = s.cells[a.to], i = from.animals.findIndex(x => x.id === a.animalId);
      if (i < 0) return fail('找不到该动物');
      if (to.animals.length >= RULES.maxAnimals) return fail('目标地块动物已满');
      if (from.animals[i].kind === 'fish' && !hasWater(to)) return fail('鱼只能去有水域的地块');
      to.animals.push(from.animals.splice(i, 1)[0]); return success('移动动物');
    },
    merge(s, a) {
      const t = s.cells[a.cell]; if (!t || !EL.includes(a.el)) return fail('无效地块或元素');
      const same = t.spirits.filter(x => x.el === a.el && !s.interactionUsed['spirit:' + x.id]);
      if (same.length < 3) return fail('需要 3 个本轮未交互的同元素灵');
      const used = new Set(same.slice(0, 3).map(x => x.id));
      t.spirits = t.spirits.filter(x => !used.has(x.id)); t.beasts.push({ id: id(s), el: a.el, age: 0 });
      countStat(s, 'merges'); return success(`合成${elName(a.el)}元素兽`);
    },
    pair(s, a) {
      const t = s.cells[a.cell], animal = t && t.animals.find(x => x.id === a.animalId);
      if (!animal) return fail('找不到动物');
      const mate = t.animals.find(x => x !== animal && x.kind === animal.kind && !x.cd && !s.interactionUsed['animal:' + x.id]);
      if (animal.cd || !mate) return fail('需要另一只同种且本轮未交互、未冷却的动物');
      if (t.animals.length >= RULES.maxAnimals) return fail('该地块动物已满');
      animal.cd = mate.cd = RULES.pairCooldown;
      t.animals.push({ id: id(s), kind: animal.kind, el: null, cd: RULES.pairCooldown, age: 0 });
      return success(`${D.ANIMALS[animal.kind].name}配对成功`);
    },
    compost(s, a) {
      const t = s.cells[a.cell]; if (!t || !['plant', 'animal'].includes(a.what)) return fail('无效堆肥对象');
      const list = a.what === 'plant' ? t.plants : t.animals, i = list.findIndex(x => x.id === a.targetId);
      if (i < 0) return fail('找不到堆肥对象');
      list.splice(i, 1); addAttr(s, a.cell, 4, 1); return success('堆肥：土 +1');
    },
    feed(s, a) {
      const t = s.cells[a.cell], animal = t && t.animals.find(x => x.id === a.animalId);
      if (!animal || !EL.includes(a.el)) return fail('无效动物或元素');
      if (animal.el) return fail('已经是元素动物');
      if (s.inv.crystal[a.el] < 1) return fail('没有该元素结晶');
      s.inv.crystal[a.el]--; animal.el = a.el; animal.age = 0; countStat(s, 'feeds');
      return success(`${D.ANIMALS[animal.kind].name}成为${elName(a.el)}元素动物`);
    },
    chop(s, a) {
      const t = s.cells[a.cell], i = t ? t.plants.findIndex(p => p.id === a.plantId && ['tree', 'shrub'].includes(p.kind)) : -1;
      if (i < 0) return fail('只能砍树或灌木');
      const n = t.plants.splice(i, 1)[0].kind === 'tree' ? 2 : 1;
      s.inv.wood += n; emit(s, { cell: a.cell, kind: 'wood', n }); return success(`获得木材 ×${n}`);
    },
    mineOre(s, a) {
      const t = s.cells[a.cell]; if (!t || !Number.isInteger(a.index) || !t.ores[a.index]) return fail('没有矿物');
      const ore = t.ores.splice(a.index, 1)[0]; s.inv.ore[ore]++; emit(s, { cell: a.cell, kind: 'ore', ore }); return success(`采集${ORES[ore].name}`);
    },
    craft(s, a) {
      const r = RECIPES.find(r => r.id === a.recipe); if (!r) return fail('未知配方');
      if (Object.entries(r.cost).some(([k, n]) => invCount(s, k) < n)) return fail('材料不足');
      const t = s.cells[a.cell]; if (r.target && (!t || t.shelter)) return fail('需要没有庇护所的地块');
      for (const [k, n] of Object.entries(r.cost)) invTake(s, k, n);
      if (a.recipe === 'bucket') s.inv.bucket++;
      if (a.recipe === 'charm') s.inv.charm++;
      if (a.recipe === 'shelter') { t.shelter = true; countStat(s, 'shelters'); }
      return success(`制造${r.name}`);
    },
    scoop(s, a) {
      const t = s.cells[a.cell]; if (!t) return fail('无效地块');
      if (s.inv.bucket <= s.inv.bucketFull) return fail('没有空桶');
      if (!hasWater(t)) return fail('地块没有可取水的水域');
      if (!t.spring) addAttr(s, a.cell, 2, -1);
      s.inv.bucketFull++; return success(t.spring ? '从泉眼打水' : '舀水：水 -1');
    },
    pour(s, a) {
      const t = s.cells[a.cell]; if (!t) return fail('无效地块');
      if (t.type === 'volcano') return fail('火山无法使用水桶，水未消耗');
      if (s.inv.bucketFull <= 0 && s.inv.water <= 0) return fail('没有装水的桶');
      if (s.inv.water > 0) s.inv.water--; else s.inv.bucketFull--;
      t.pond = true; if (t.type === 'desert') t.oasis = true;
      addAttr(s, a.cell, 2, 1); return success(t.oasis ? '沙漠绿洲：水 +1' : '生成小湖：水 +1');
    },
    useCrystal(s, a) {
      const t = s.cells[a.cell]; if (!t || !EL.includes(a.el)) return fail('无效地块或元素');
      const bag = a.inverse ? s.inv.inverseCrystal : a.big ? s.inv.bigCrystal : s.inv.crystal;
      if (bag[a.el] < 1) return fail('没有该结晶');
      const n = a.inverse ? -1 : a.big ? 2 : 1;
      if (n > 0 && t.attrs[EL.indexOf(a.el)] >= attrCap(s, a.cell)) return fail('属性已达连片上限');
      bag[a.el]--; addAttr(s, a.cell, EL.indexOf(a.el), n);
      return success(`使用${a.inverse ? '逆' : a.big ? '大型' : ''}${elName(a.el)}结晶：${n > 0 ? '+' : ''}${n}`);
    },
    useCharm(s, a) {
      const t = s.cells[a.cell]; if (!t || s.inv.charm < 1) return fail('没有净化符或无效地块');
      if (!t.attrs.some(v => v < 0) && !t.cancers.length) return fail('该地块没有污染');
      s.inv.charm--; purify(s, a.cell, false); return success('使用净化符');
    },
    craftShield(s, a) {
      const cost = a.crystals;
      if (!cost || Object.keys(cost).some(e => !EL.includes(e)) || EL.some(e => !Number.isInteger(cost[e] === undefined ? 0 : cost[e]) || (cost[e] || 0) < 0 || (cost[e] || 0) > s.inv.crystal[e])) return fail('无效的结晶配比');
      const n = sum(EL.map(e => cost[e] || 0));
      if (n < 5 || n % 5 !== 0) return fail('元素盾需要 5 颗或 5 的倍数普通结晶');
      const shield = { id: id(s), defense: Object.fromEntries(EL.map(e => [e, cost[e] || 0])), coverage: n / 5 };
      for (const e of EL) s.inv.crystal[e] -= cost[e] || 0;
      s.inv.shields.push(shield); return success(`制造元素盾，覆盖 ${shield.coverage} 格`);
    },
    deployShield(s, a) {
      const i = s.inv.shields.findIndex(sh => sh.id === a.shieldId);
      if (i < 0 || !s.cells[a.cell]) return fail('无效元素盾或地块');
      const sh = s.inv.shields.splice(i, 1)[0]; sh.cells = region(s, a.cell, sh.coverage); s.shields.push(sh);
      return success(`部署元素盾，覆盖 ${sh.cells.length} 格`);
    },
  };
  const invCount = (s, k) => k === 'wood' ? s.inv.wood : s.inv.ore[k];
  const invTake = (s, k, n) => { if (k === 'wood') s.inv.wood -= n; else s.inv.ore[k] -= n; };
  function takeCrystals(s, n) { for (const e of EL) { const take = Math.min(n, s.inv.crystal[e]); s.inv.crystal[e] -= take; n -= take; } }
  function reconcile(s, before, cell, eventStart = 0) {
    const actual = score(s).total - before, accounted = sum(s.events.slice(eventStart).map(e => e.score || 0));
    if (actual !== accounted) emit(s, { cell: cell || '3,3', kind: 'attr', n: actual - accounted, score: actual - accounted });
  }
  function act(s, action) {
    s.events = [];
    if (!action || !handlers[action.type]) return fail('未知行动');
    if (s.over) return fail('游戏已结束');
    const cost = ['place', 'cast'].includes(action.type) ? 1 : 0;
    if (s.ap < cost) return fail('行动点不足');
    if (action.type === 'cast' && !s.placed) return fail('请先放置本轮地块');
    const used = interactionKeys(s, action);
    if (used.some(k => s.interactionUsed[k])) return fail('该生物或物品本轮已交互');
    const before = score(s).total, beforeBag = bagCount(s);
    const r = handlers[action.type](s, action); if (!r.ok) return r;
    used.forEach(k => { s.interactionUsed[k] = true; }); s.ap -= cost;
    trimSpirits(s); updateProgress(s); log(s, r.msg);
    const cell = action.cell || action.to || action.from || '3,3';
    const bagDelta = bagCount(s) - beforeBag;
    const bagAccounted = sum(s.events.filter(e => ['wood', 'ore', 'crystal', 'bigCrystal', 'inverseCrystal', 'item'].includes(e.kind)).map(e => e.n || 1));
    if (bagDelta > bagAccounted) emit(s, { cell, kind: 'item', n: bagDelta - bagAccounted });
    reconcile(s, before, cell);
    if (!emptyKeys(s).length) finish(s);
    else if (cost && s.ap === 0) endRound(s);
    return r;
  }
  function eligiblePlants(t) {
    const [, w, a, , e] = t.attrs, kinds = [];
    if (w >= 1 && e >= 1) kinds.push('grass');
    if (w >= 2 && e >= 2) kinds.push('shrub');
    if (w >= 3 && e >= 3) kinds.push('tree');
    if (w >= 1 && e >= 1 && a >= 5 && hasWater(t)) kinds.push('weed');
    if (w >= 1 && e >= 2 && a >= 1 && isFarm(t)) kinds.push('crop');
    return kinds;
  }
  function eligibleAnimals(t) {
    const w = t.attrs[1], grass = t.plants.filter(p => p.kind === 'grass').length, trees = t.plants.filter(p => p.kind === 'tree').length, kinds = [];
    if (w >= 1 && grass >= 1) kinds.push('rabbit');
    if (w >= 1 && hasWater(t)) kinds.push('fish');
    if (w >= 1 && trees >= 1) kinds.push('bird');
    if (w >= 3 && trees > 2) kinds.push('bear');
    if (w >= 3 && trees > 3) kinds.push('leopard');
    if (w >= 2 && grass > 2) kinds.push('cow', 'sheep');
    if (w >= 3 && grass > 3) kinds.push('deer');
    return kinds;
  }
  function region(s, start, count) {
    const todo = [start], seen = new Set(todo);
    for (let i = 0; i < todo.length && todo.length < count; i++) for (const n of neighbors(todo[i])) {
      if (s.cells[n] && !seen.has(n) && todo.length < count) { todo.push(n); seen.add(n); }
    }
    return todo;
  }
  function meteor(s) {
    const element = pick(s, EL), cells = region(s, pick(s, placedKeys(s)), Math.max(1, Math.floor(placedKeys(s).length / 3)));
    let blocked = 0;
    for (const cell of cells) {
      let damage = 3;
      for (const shield of s.shields) if (shield.cells.includes(cell)) {
        const n = Math.min(damage, shield.defense[element]); shield.defense[element] -= n; damage -= n; blocked += n;
        if (n) emit(s, { cell, kind: 'shield', el: element });
      }
      if (damage) addAttr(s, cell, EL.indexOf(element), -damage);
      emit(s, { cell, kind: 'meteor', el: element, damage });
    }
    s.shields = s.shields.filter(sh => sum(Object.values(sh.defense)) > 0);
    if (blocked) countStat(s, 'blocked');
    s.lastMeteor = { round: s.round, el: element, cells, blocked };
    log(s, `${elName(element)}陨石雨影响 ${cells.length} 格，元素盾抵挡 ${blocked} 点`);
  }
  function endRound(s) {
    if (s.over) return fail('游戏已结束');
    if (!s.placed) return fail('本轮必须先放置一块地块');
    const before = score(s).total, keys = placedKeys(s), eventStart = s.events.length;
    for (const k of keys) {
      const t = s.cells[k];
      const pos = EL.map((e, i) => [e, Math.max(0, t.attrs[i])]).filter(p => p[1]);
      if (pos.length && t.spirits.length < spiritCap(t)) { const el = pickWeighted(s, pos); t.spirits.push({ id: id(s), el, age: 0 }); emit(s, { cell: k, kind: 'spirit', el }); }
      const neg = EL.map((e, i) => [e, Math.max(0, -t.attrs[i])]).filter(p => p[1]);
      if (neg.length && t.cancers.length < cancerCap(t)) { const el = pickWeighted(s, neg); t.cancers.push({ id: id(s), el, age: 0 }); emit(s, { cell: k, kind: 'cancer', el }); }
      for (const sp of t.spirits) if (++sp.age % 3 === 0) { s.inv.crystal[sp.el]++; emit(s, { cell: k, kind: 'crystal', el: sp.el }); }
      for (const b of t.beasts) if (++b.age % 2 === 0) { s.inv.bigCrystal[b.el]++; emit(s, { cell: k, kind: 'bigCrystal', el: b.el }); }
      for (const c of t.cancers) if (++c.age % 3 === 0 && t.attrs[EL.indexOf(c.el)] !== 0) {
        addAttr(s, k, EL.indexOf(c.el), -1); s.inv.inverseCrystal[c.el]++; emit(s, { cell: k, kind: 'inverseCrystal', el: c.el });
      }
      for (const a of t.animals) {
        if (a.cd > 0) a.cd--;
        if (!a.el || ++a.age % 3) continue;
        if (a.el === 'metal') { const ore = pick(s, Object.keys(ORES)); s.inv.ore[ore]++; emit(s, { cell: k, kind: 'ore', ore }); }
        if (a.el === 'wood' && t.plants.length < RULES.maxPlants) { t.plants.push({ id: id(s), kind: pick(s,['crop','wheat','corn']) }); emit(s, { cell: k, kind: 'plant', plant: t.plants[t.plants.length-1].kind }); }
        if (a.el === 'water') { s.inv.water++; emit(s, { cell: k, kind: 'item' }); }
        if (a.el === 'fire') addAttr(s, k, 3, 1);
        if (a.el === 'earth') addAttr(s, k, 4, 1);
      }
    }
    // 先收集移动再应用，防止一轮在多个地块重复移动/感染。
    const moves = [];
    for (const k of keys) {
      for (const b of s.cells[k].beasts) {
        const to = pick(s, [k, ...neighbors(k).filter(n => s.cells[n] && s.cells[n].attrs[EL.indexOf(b.el)] > 0)]);
        if (to !== k) moves.push({ from: k, to, unit: b, list: 'beasts' });
      }
      for (const c of s.cells[k].cancers) {
        const opts = neighbors(k).filter(n => s.cells[n]);
        if (opts.length) moves.push({ from: k, to: pick(s, opts), unit: c, list: 'cancers' });
      }
    }
    for (const m of moves) {
      const from = s.cells[m.from], to = s.cells[m.to];
      from[m.list] = from[m.list].filter(x => x.id !== m.unit.id); to[m.list].push(m.unit);
      if (m.list === 'beasts') addAttr(s, m.to, EL.indexOf(m.unit.el), 1);
      else if (from.spirits.length) {
        const sp = from.spirits.shift(); from.cancers.push({ id: sp.id, el: sp.el, age: 0 });
        emit(s, { cell: m.from, kind: 'infection', el: sp.el });
      }
    }
    for (const k of keys) {
      const t = s.cells[k], plants = eligiblePlants(t), animals = eligibleAnimals(t);
      if (plants.length && t.plants.length < RULES.maxPlants && rand(s) < RULES.spawnChance) { const kind = pick(s, plants); t.plants.push({ id: id(s), kind }); emit(s, { cell: k, kind: 'plant', plant: kind }); }
      if (animals.length && t.animals.length < RULES.maxAnimals && rand(s) < RULES.spawnChance) { const kind = pick(s, animals); t.animals.push({ id: id(s), kind, el: null, cd: 0, age: 0 }); emit(s, { cell: k, kind: 'animal', animal: kind }); }
      if (t.attrs[0] > 0 && hasOre(t) && t.ores.length < RULES.maxOres && rand(s) < RULES.spawnChance) { const ore = pickWeighted(s, Object.entries(ORES).map(([o, v]) => [o, v.weight])); t.ores.push(ore); emit(s, { cell: k, kind: 'oreSpawn', ore }); }
      for (const predator of t.animals.slice()) {
        const preyKinds = { bird: ['fish'], bear: ['rabbit', 'fish'], leopard: ['deer'] }[predator.kind];
        const prey = preyKinds && t.animals.find(a => a !== predator && preyKinds.includes(a.kind));
        if (prey) { t.animals = t.animals.filter(a => a !== prey); emit(s, { cell: k, kind: 'predation' }); }
      }
    }
    if (s.round % RULES.meteorEvery === 0) meteor(s);
    trimSpirits(s); updateProgress(s); reconcile(s, before, '3,3', eventStart);
    const receipts = s.events.filter(e => ['crystal', 'bigCrystal', 'inverseCrystal', 'wood', 'ore', 'item'].includes(e.kind));
    if (receipts.length) log(s, `获得：${receipts.length} 份结晶或资源`);
    log(s, `第 ${s.round} 轮结束，灵力值 ${score(s).total}`);
    s.round++; s.roundAP = apLimit(s); s.ap = s.roundAP; s.placed = 0; s.magicUsed = {}; s.interactionUsed = {}; rollOffers(s);
    return success('新一轮');
  }
  function bagCount(s) {
    return sum(Object.values(s.inv.crystal)) + sum(Object.values(s.inv.bigCrystal)) + sum(Object.values(s.inv.inverseCrystal)) + sum(Object.values(s.inv.ore)) + s.inv.wood + s.inv.bucket + s.inv.water + s.inv.charm + s.inv.shields.length;
  }
  function finish(s) { s.over = true; log(s, `地图已铺满，最终灵力值 ${score(s).total}`); }
  function endRoundPublic(s) { s.events = []; return endRound(s); }
  const Game = { newGame, act, endRound: endRoundPublic, legalPlacements, neighbors, score, spiritCap, cancerCap, attrCap, cluster, region, upgrades, globalAttrs, magicUnlocked, canPurify, stage, apLimit, eligiblePlants, eligibleAnimals, hasWater, bagCount, metrics, SHAPE, SHAPE_KEYS, BOUNDS, key, parse, TYPE, emptyKeys, makeTile };
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(this);
