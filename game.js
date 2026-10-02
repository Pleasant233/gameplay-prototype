// 纯逻辑引擎：不碰 DOM，浏览器和 Node 都能跑（node test.js）
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.GameData;
  const { TILE_TYPES, RULES, SCORE, ORES, RECIPES } = D;
  const EL = D.ELEMENTS.map(e => e.key);
  const TYPE = Object.fromEntries(TILE_TYPES.map(t => [t.id, t]));

  // ---------- 地图形状 ----------
  // 7x7 核心 + 四边各一个 5/3/1 的阶梯延伸（每边 9 格，共 4x9=36），合计 85 格
  function buildShape() {
    const cells = [];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) cells.push([x, y]);
    const rows = [[1, 5], [2, 4], [3, 3]]; // 距离 1/2/3 的行，覆盖 [from,to]
    rows.forEach(([a, b], i) => {
      const d = i + 1;
      for (let t = a; t <= b; t++) {
        cells.push([t, -d]);      // 上
        cells.push([t, 6 + d]);   // 下
        cells.push([-d, t]);      // 左
        cells.push([6 + d, t]);   // 右
      }
    });
    return cells;
  }
  const SHAPE = buildShape();
  const key = (x, y) => x + ',' + y;
  const parse = k => k.split(',').map(Number);
  const SHAPE_KEYS = new Set(SHAPE.map(([x, y]) => key(x, y)));
  const BOUNDS = { minX: -3, maxX: 9, minY: -3, maxY: 9 };

  function neighbors(k) {
    const [x, y] = parse(k);
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].map(([a, b]) => key(a, b)).filter(n => SHAPE_KEYS.has(n));
  }

  // ---------- 随机数（可复现） ----------
  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  function pickWeighted(s, pairs) {
    const total = pairs.reduce((a, [, w]) => a + w, 0);
    let r = rand(s) * total;
    for (const [v, w] of pairs) { if ((r -= w) < 0) return v; }
    return pairs[pairs.length - 1][0];
  }

  // ---------- 状态 ----------
  const sum = a => a.reduce((x, y) => x + y, 0);
  const emptyEl = () => Object.fromEntries(EL.map(e => [e, 0]));

  function makeTile(typeId) {
    return {
      type: typeId, attrs: TYPE[typeId].attrs.slice(),
      spirits: [], beasts: [], plants: [], animals: [], ores: [],
      spring: false, shelter: false,
    };
  }

  function newGame(seed) {
    const s = {
      seed: seed >>> 0, rng: seed | 0, round: 1, ap: RULES.apPerRound,
      placed: 0, magicUsed: {}, offers: [], cells: {}, nextId: 1,
      inv: { crystal: emptyEl(), bigCrystal: emptyEl(), ore: Object.fromEntries(Object.keys(ORES).map(k => [k, 0])),
             wood: 0, bucket: 0, bucketFull: 0, charm: 0 },
      log: [], over: false,
    };
    // 开局：中心十字 5 块，属性和 = 9
    const start = [key(3, 3), key(2, 3), key(4, 3), key(3, 2), key(3, 4)];
    let types;
    for (let i = 0; i < 5000; i++) {
      types = start.map(() => pick(s, TILE_TYPES).id);
      if (sum(types.map(t => sum(TYPE[t].attrs))) === RULES.startSum) break;
    }
    start.forEach((k, i) => { s.cells[k] = makeTile(types[i]); });
    rollOffers(s);
    log(s, `第 1 轮开始。初始 5 块地属性和 = ${totalAttrs(s)}`);
    return s;
  }

  // 表现层用的事件流（产出 / 获得），每次 act / endRound 前清空，不影响规则
  function emit(s, e) { (s.events || (s.events = [])).push(e); }
  function log(s, msg) { s.log.unshift(`[${s.round}] ${msg}`); if (s.log.length > 200) s.log.pop(); }
  function rollOffers(s) { s.offers = Array.from({ length: RULES.offersPerRound }, () => pick(s, TILE_TYPES).id); }
  const id = s => s.nextId++;
  const clamp = v => Math.max(RULES.attrMin, Math.min(RULES.attrMax, v));
  function addAttr(t, i, d) { t.attrs[i] = clamp(t.attrs[i] + d); }

  const placedKeys = s => Object.keys(s.cells);
  const emptyKeys = s => SHAPE.map(([x, y]) => key(x, y)).filter(k => !s.cells[k]);
  function legalPlacements(s) {
    return emptyKeys(s).filter(k => neighbors(k).some(n => s.cells[n]));
  }
  const spiritCap = t => Math.max(0, sum(t.attrs));
  function totalAttrs(s) { return placedKeys(s).reduce((a, k) => a + sum(s.cells[k].attrs), 0); }

  function score(s) {
    let spirits = 0, beasts = 0, elemAnimals = 0;
    for (const k of placedKeys(s)) {
      const t = s.cells[k];
      spirits += t.spirits.length; beasts += t.beasts.length;
      elemAnimals += t.animals.filter(a => a.el).length;
    }
    const attrs = totalAttrs(s);
    return { attrs, spirits, beasts, elemAnimals,
      total: attrs + spirits * SCORE.spirit + beasts * SCORE.beast + elemAnimals * SCORE.elemAnimal };
  }

  // ---------- 行动 ----------
  // 每个行动 1 点；必须给「本轮至少放置 1 块」留 1 点
  function canSpend(s, isPlace) {
    if (s.over) return '游戏已结束';
    if (s.ap <= 0) return '行动点不足';
    if (!isPlace && s.placed === 0 && s.ap <= 1) return '最后 1 点必须用于放置地块';
    return null;
  }
  const fail = msg => ({ ok: false, msg });
  function tileAt(s, k) { return s.cells[k] || null; }
  function adjacentPlaced(s, a, b) { return neighbors(a).includes(b) && !!s.cells[b]; }

  const handlers = {
    place(s, { offer, cell }) {
      const typeId = s.offers[offer];
      if (!typeId) return fail('无效的待选地块');
      if (!legalPlacements(s).includes(cell)) return fail('只能放在已有地块相邻的空位');
      s.cells[cell] = makeTile(typeId);
      s.offers.splice(offer, 1);
      s.placed++;
      emit(s, { cell, kind: 'place' });
      return { ok: true, msg: `放置 ${TYPE[typeId].name}` };
    },

    cast(s, { magic, cell }) {
      const t = tileAt(s, cell);
      if (!t) return fail('需要选择已放置的地块');
      if (s.magicUsed[magic]) return fail('每种魔法每轮只能施放一次');
      const { M, W, A, F, E } = D.IDX;
      switch (magic) {
        case 'purify':
          if (!t.attrs.some(v => v < 0)) return fail('该地块没有负值属性');
          t.attrs = t.attrs.map(v => v < 0 ? v + 1 : v); break;
        case 'mine': addAttr(t, M, 1); break;
        case 'spring': t.spring = true; addAttr(t, A, 1); break;
        case 'rich': addAttr(t, E, 1); break;
        case 'burn':
          t.attrs[W] = 0; t.attrs[A] = 0; addAttr(t, F, 1);
          t.plants = [];
          t.animals = t.animals.filter(a => a.kind !== 'fish');
          t.spirits = t.spirits.filter(sp => sp.el !== 'wood' && sp.el !== 'water');
          t.spring = false;
          break;
        default: return fail('未知魔法');
      }
      s.magicUsed[magic] = true;
      return { ok: true, msg: `对 ${TYPE[t.type].name} 施放${D.MAGICS.find(m => m.id === magic).name}魔法` };
    },

    moveSpirit(s, { from, spiritId, to }) {
      const a = tileAt(s, from), b = tileAt(s, to);
      if (!a || !adjacentPlaced(s, from, to)) return fail('只能移到相邻地块');
      const i = a.spirits.findIndex(x => x.id === spiritId);
      if (i < 0) return fail('找不到该元素灵');
      if (b.spirits.length >= spiritCap(b)) return fail('目标地块元素灵已满');
      b.spirits.push(a.spirits.splice(i, 1)[0]);
      return { ok: true, msg: '移动元素灵' };
    },

    merge(s, { cell, el }) {
      const t = tileAt(s, cell);
      if (!t) return fail('无效地块');
      const same = t.spirits.filter(x => x.el === el);
      if (same.length < RULES.mergeCount) return fail(`需要 ${RULES.mergeCount} 个同元素灵`);
      const used = new Set(same.slice(0, RULES.mergeCount).map(x => x.id));
      t.spirits = t.spirits.filter(x => !used.has(x.id));
      t.beasts.push({ id: id(s), el, age: 0 });
      return { ok: true, msg: `合成${elName(el)}元素兽` };
    },

    moveAnimal(s, { from, animalId, to }) {
      const a = tileAt(s, from), b = tileAt(s, to);
      if (!a || !adjacentPlaced(s, from, to)) return fail('只能移到相邻地块');
      const i = a.animals.findIndex(x => x.id === animalId);
      if (i < 0) return fail('找不到该动物');
      if (b.animals.length >= RULES.maxAnimals) return fail('目标地块动物已满');
      if (a.animals[i].kind === 'fish' && b.attrs[D.IDX.A] <= 0) return fail('鱼只能去有水的地块');
      b.animals.push(a.animals.splice(i, 1)[0]);
      return { ok: true, msg: '移动动物' };
    },

    pair(s, { cell, animalId }) {
      const t = tileAt(s, cell);
      const a = t && t.animals.find(x => x.id === animalId);
      if (!a) return fail('找不到该动物');
      const b = t.animals.find(x => x !== a && x.kind === a.kind && x.cd === 0);
      if (a.cd > 0 || !b) return fail('同地块需要另一只同种且未冷却的动物');
      if (t.animals.length >= RULES.maxAnimals) return fail('该地块动物已满');
      a.cd = b.cd = RULES.pairCooldown;
      t.animals.push({ id: id(s), kind: a.kind, el: null, cd: RULES.pairCooldown, age: 0 });
      return { ok: true, msg: `${D.ANIMALS[a.kind].name}配对成功` };
    },

    compost(s, { cell, what, targetId }) {
      const t = tileAt(s, cell);
      if (!t) return fail('无效地块');
      const list = what === 'plant' ? t.plants : t.animals;
      const i = list.findIndex(x => x.id === targetId);
      if (i < 0) return fail('找不到堆肥对象');
      list.splice(i, 1);
      addAttr(t, D.IDX.E, 1);
      return { ok: true, msg: '堆肥：土 +1' };
    },

    feed(s, { cell, animalId, el }) {
      const t = tileAt(s, cell);
      const a = t && t.animals.find(x => x.id === animalId);
      if (!a) return fail('找不到该动物');
      if (a.el) return fail('已经是元素动物');
      if (s.inv.crystal[el] <= 0) return fail('没有该元素结晶');
      s.inv.crystal[el]--; a.el = el; a.age = 0;
      return { ok: true, msg: `${D.ANIMALS[a.kind].name}成为${elName(el)}元素动物` };
    },

    chop(s, { cell, plantId }) {
      const t = tileAt(s, cell);
      const i = t ? t.plants.findIndex(p => p.id === plantId && (p.kind === 'tree' || p.kind === 'shrub')) : -1;
      if (i < 0) return fail('只能砍树或灌木');
      const p = t.plants.splice(i, 1)[0];
      const n = p.kind === 'tree' ? 2 : 1;
      s.inv.wood += n;
      emit(s, { cell, kind: 'wood', n });
      return { ok: true, msg: `获得木材 ×${n}` };
    },

    mineOre(s, { cell, index }) {
      const t = tileAt(s, cell);
      if (!t || !t.ores[index]) return fail('没有矿物');
      const o = t.ores.splice(index, 1)[0];
      s.inv.ore[o]++;
      emit(s, { cell, kind: 'ore', ore: o });
      return { ok: true, msg: `采集${ORES[o].name}` };
    },

    craft(s, { recipe, cell }) {
      const r = RECIPES.find(x => x.id === recipe);
      if (!r) return fail('未知配方');
      for (const [k, n] of Object.entries(r.cost)) if (invCount(s, k) < n) return fail('材料不足');
      let t = null;
      if (r.target) {
        t = tileAt(s, cell);
        if (!t) return fail('需要选择地块');
        if (t.shelter) return fail('该地块已有庇护所');
      }
      for (const [k, n] of Object.entries(r.cost)) invTake(s, k, n);
      if (recipe === 'bucket') s.inv.bucket++;
      if (recipe === 'charm') s.inv.charm++;
      if (recipe === 'shelter') { t.shelter = true; addAttr(t, D.IDX.W, 1); addAttr(t, D.IDX.E, 1); }
      return { ok: true, msg: `制造${r.name}` };
    },

    scoop(s, { cell }) {
      const t = tileAt(s, cell);
      if (!t) return fail('无效地块');
      if (s.inv.bucket - s.inv.bucketFull <= 0) return fail('没有空桶');
      if (!t.spring && t.attrs[D.IDX.A] <= 0) return fail('该地块没有水');
      if (!t.spring) addAttr(t, D.IDX.A, -1);
      s.inv.bucketFull++;
      return { ok: true, msg: t.spring ? '从泉眼打水（不减少水）' : '舀水：水 -1' };
    },

    pour(s, { cell }) {
      const t = tileAt(s, cell);
      if (!t) return fail('无效地块');
      if (s.inv.bucketFull <= 0) return fail('没有装水的桶');
      addAttr(t, D.IDX.A, 1); s.inv.bucketFull--;
      return { ok: true, msg: '倒水：水 +1' };
    },

    useCrystal(s, { cell, el, big }) {
      const t = tileAt(s, cell);
      if (!t) return fail('无效地块');
      const bag = big ? s.inv.bigCrystal : s.inv.crystal;
      if (bag[el] <= 0) return fail('没有该结晶');
      bag[el]--; addAttr(t, EL.indexOf(el), big ? 2 : 1);
      return { ok: true, msg: `使用${big ? '大型' : ''}${elName(el)}结晶：${elName(el)} +${big ? 2 : 1}` };
    },

    useCharm(s, { cell }) {
      const t = tileAt(s, cell);
      if (!t) return fail('无效地块');
      if (s.inv.charm <= 0) return fail('没有净化符');
      if (!t.attrs.some(v => v < 0)) return fail('该地块没有负值属性');
      s.inv.charm--; t.attrs = t.attrs.map(v => v < 0 ? v + 1 : v);
      return { ok: true, msg: '使用净化符' };
    },
  };

  function invCount(s, k) { return k === 'wood' ? s.inv.wood : s.inv.ore[k]; }
  function invTake(s, k, n) { if (k === 'wood') s.inv.wood -= n; else s.inv.ore[k] -= n; }
  const elName = el => D.ELEMENTS.find(e => e.key === el).name;

  function act(s, action) {
    s.events = [];
    const h = handlers[action.type];
    if (!h) return fail('未知行动');
    const err = canSpend(s, action.type === 'place');
    if (err) return fail(err);
    const r = h(s, action);
    if (!r.ok) return r;
    s.ap--;
    log(s, r.msg);
    if (emptyKeys(s).length === 0) finish(s);
    else if (s.ap === 0) endRound(s);
    return r;
  }

  // ---------- 轮末结算 ----------
  function endRound(s) {
    if (s.over) return fail('游戏已结束');
    if (s.placed === 0) return fail('本轮至少要放置 1 块地块');
    const { M, W, A, E } = D.IDX;
    const keys = placedKeys(s);
    const gained = [];

    // 1) 元素灵：每块地按正属性加权生成 1 个，总数不超过属性和
    for (const k of keys) {
      const t = s.cells[k];
      const pos = EL.map((e, i) => [e, Math.max(0, t.attrs[i])]).filter(([, w]) => w > 0);
      if (pos.length && t.spirits.length < spiritCap(t)) {
        const el = pickWeighted(s, pos);
        t.spirits.push({ id: id(s), el, age: 0 });
        emit(s, { cell: k, kind: 'spirit', el });
      }
    }
    // 2) 元素灵 / 元素兽 / 元素动物 产结晶
    for (const k of keys) {
      const t = s.cells[k];
      for (const sp of t.spirits) if (++sp.age % RULES.spiritCrystalEvery === 0) { s.inv.crystal[sp.el]++; gained.push(elName(sp.el) + '结晶'); emit(s, { cell: k, kind: 'crystal', el: sp.el }); }
      for (const b of t.beasts) if (++b.age % RULES.beastCrystalEvery === 0) { s.inv.bigCrystal[b.el]++; gained.push('大型' + elName(b.el) + '结晶'); emit(s, { cell: k, kind: 'bigCrystal', el: b.el }); }
      for (const a of t.animals) {
        if (a.cd > 0) a.cd--;
        if (a.el && ++a.age % RULES.elemAnimalEvery === 0) { s.inv.crystal[a.el]++; gained.push(elName(a.el) + '结晶(元素动物)'); emit(s, { cell: k, kind: 'crystal', el: a.el }); }
      }
    }
    // 3) 元素兽游走：在该属性 > 0 的相邻地块中随机移动或不动
    const moves = [];
    for (const k of keys) for (const b of s.cells[k].beasts) {
      const opts = [k, ...neighbors(k).filter(n => s.cells[n] && s.cells[n].attrs[EL.indexOf(b.el)] > 0)];
      const to = pick(s, opts);
      if (to !== k) moves.push([k, to, b]);
    }
    for (const [from, to, b] of moves) {
      const f = s.cells[from]; f.beasts = f.beasts.filter(x => x !== b); s.cells[to].beasts.push(b);
    }
    // 4) 植物、动物、矿物自然生成
    for (const k of keys) {
      const t = s.cells[k], a = t.attrs;
      if (a[W] > 0 && t.plants.length < RULES.maxPlants && rand(s) < Math.min(0.8, 0.3 * a[W])) {
        const kind = a[A] >= 2 ? 'weed' : a[E] >= 2 ? 'crop' : a[W] >= 2 ? 'tree' : pick(s, ['grass', 'shrub']);
        t.plants.push({ id: id(s), kind });
        emit(s, { cell: k, kind: 'plant', plant: kind });
      }
      if (a[W] >= 2 && t.plants.length > 0 && t.animals.length < RULES.maxAnimals && rand(s) < 0.15) {
        const kind = a[A] >= 2 ? 'fish' : a[E] >= 2 ? pick(s, ['cow', 'sheep', 'rabbit']) : pick(s, ['deer', 'bear', 'leopard', 'bird']);
        t.animals.push({ id: id(s), kind, el: null, cd: 0, age: 0 });
        emit(s, { cell: k, kind: 'animal', animal: kind });
      }
      if (a[M] > 0 && t.ores.length < RULES.maxOres && rand(s) < Math.min(0.8, 0.2 * a[M])) {
        const o = pickWeighted(s, Object.entries(ORES).map(([o, v]) => [o, v.weight]));
        t.ores.push(o);
        emit(s, { cell: k, kind: 'oreSpawn', ore: o });
      }
    }
    if (gained.length) log(s, '获得：' + summarize(gained));
    log(s, `第 ${s.round} 轮结束，灵力值 ${score(s).total}`);

    s.round++; s.ap = RULES.apPerRound; s.placed = 0; s.magicUsed = {};
    rollOffers(s);
    return { ok: true, msg: '新一轮' };
  }

  function summarize(list) {
    const c = {}; list.forEach(x => c[x] = (c[x] || 0) + 1);
    return Object.entries(c).map(([k, n]) => `${k}×${n}`).join('、');
  }

  function finish(s) {
    s.over = true;
    const sc = score(s);
    log(s, `地图已铺满，游戏结束。最终灵力值 ${sc.total}`);
  }

  // 对外的结束本轮：先清空事件流（act 内部自动结算时保留本次行动的事件）
  function endRoundPublic(s) { s.events = []; return endRound(s); }

  const Game = { newGame, act, endRound: endRoundPublic, legalPlacements, neighbors, score, spiritCap, SHAPE, SHAPE_KEYS, BOUNDS, key, parse, TYPE, emptyKeys };
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(this);
