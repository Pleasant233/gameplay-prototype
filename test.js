// node test.js —— 规则自检 + 随机整局模拟
const assert = require('assert');
const G = require('./game.js');
const D = require('./data.js');

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log('ok -', name); };
const sum = a => a.reduce((x, y) => x + y, 0);

t('地图共 85 格（7x7 + 4x9）', () => assert.strictEqual(G.SHAPE.length, 85));

t('开局 5 块相连，属性和 = 9', () => {
  for (let seed = 1; seed < 50; seed++) {
    const s = G.newGame(seed);
    const ks = Object.keys(s.cells);
    assert.strictEqual(ks.length, 5);
    assert.strictEqual(sum(ks.map(k => sum(s.cells[k].attrs))), 9);
  }
});

t('只能放在相邻空位', () => {
  const s = G.newGame(7);
  assert.strictEqual(G.act(s, { type: 'place', offer: 0, cell: '0,0' }).ok, false);
  const cell = G.legalPlacements(s)[0];
  assert.ok(G.act(s, { type: 'place', offer: 0, cell }).ok);
  assert.strictEqual(s.ap, 2);
});

t('先放置再施法，每轮只能放置一次', () => {
  const s = G.newGame(3), k = '3,3';
  s.unlockedMagics.push('mine');
  assert.strictEqual(G.act(s, {type:'cast',magic:'mine',cell:k}).ok,false);
  assert.ok(G.act(s,{type:'place',offer:0,cell:G.legalPlacements(s)[0]}).ok);
  assert.deepStrictEqual(G.legalPlacements(s),[]);
  assert.strictEqual(G.act(s,{type:'place',offer:0,cell:'0,0'}).ok,false);
  assert.ok(G.act(s,{type:'cast',magic:'mine',cell:k}).ok);
  assert.strictEqual(G.act(s,{type:'cast',magic:'mine',cell:k}).ok,false);
});

t('普通和大型结晶免费，零行动点也不自动换轮', () => {
  for (const el of D.ELEMENTS.map(e => e.key)) for (const big of [false, true]) for (const ap of [0, 1, 3]) {
    const s = G.newGame(43), cell = '3,3', index = D.ELEMENTS.findIndex(e => e.key === el);
    s.ap = ap; s.placed = ap === 0 ? 1 : 0; s.cells[cell].attrs = [0, 0, 0, 0, 0];
    const bag = big ? s.inv.bigCrystal : s.inv.crystal;
    bag[el] = 1;
    const before = G.score(s).total;
    assert.ok(G.act(s, { type: 'useCrystal', cell, el, big }).ok);
    assert.strictEqual(s.ap, ap);
    assert.strictEqual(s.round, 1);
    assert.strictEqual(s.placed, ap === 0 ? 1 : 0);
    assert.strictEqual(bag[el], 0);
    assert.strictEqual(s.cells[cell].attrs[index], big ? 2 : 1);
    assert.strictEqual(s.events.reduce((n, e) => n + (e.score || 0), 0), G.score(s).total - before);
  }
});

t('免费结晶保留最后 1 点，付费行动与放置规则照常生效', () => {
  const s = G.newGame(44);
  s.ap = 1; s.inv.crystal.water = 1;
  assert.ok(G.act(s, { type: 'useCrystal', cell: '3,3', el: 'water', big: false }).ok);
  assert.strictEqual(s.ap, 1);
  assert.strictEqual(G.act(s, { type: 'cast', magic: 'mine', cell: '3,3' }).ok, false);
  assert.strictEqual(G.endRound(s).ok, false);
  assert.ok(G.act(s, { type: 'place', offer: 0, cell: G.legalPlacements(s)[0] }).ok);
  assert.strictEqual(s.round, 2);
  assert.strictEqual(s.ap, D.RULES.apPerRound);
});

t('结晶库存不足、目标无效或对局结束时不改变规则状态', () => {
  for (const reason of ['empty', 'target', 'over']) {
    const s = G.newGame(45);
    s.inv.crystal.water = reason === 'empty' ? 0 : 1;
    s.over = reason === 'over';
    const before = JSON.stringify(s);
    assert.strictEqual(G.act(s, { type: 'useCrystal', cell: reason === 'target' ? '0,0' : '3,3', el: 'water', big: false }).ok, false);
    assert.strictEqual(JSON.stringify(s), before);
  }
});

t('跳过前必须已放置', () => {
  const s = G.newGame(4);
  assert.strictEqual(G.endRound(s).ok, false);
  G.act(s, { type: 'place', offer: 0, cell: G.legalPlacements(s)[0] });
  assert.ok(G.endRound(s).ok);
  assert.strictEqual(s.round, 2);
});

t('焚尽：水木归零、火+5', () => {
  const s = G.newGame(5);
  const k = Object.keys(s.cells)[0];
  s.placed=1;s.unlockedMagics.push('burn');
  s.cells[k].attrs = [0, 2, 2, 0, 1];
  G.act(s, { type: 'cast', magic: 'burn', cell: k });
  assert.deepStrictEqual(s.cells[k].attrs, [0, 0, 0, 5, 1]);
});

t('范围净化：负值 +5 并清癌元，干净区域拒绝', () => {
  const s = G.newGame(6);
  const k = Object.keys(s.cells)[0];
  s.placed=1;for(const tile of Object.values(s.cells)){tile.attrs=[1,1,1,1,1];tile.cancers=[];}
  assert.strictEqual(G.act(s, { type: 'cast', magic: 'purify', cell: k }).ok, false);
  s.cells[k].attrs = [-1, -6, 0, 0, 1];
  const neighbor=G.neighbors(k).find(n=>s.cells[n]);s.cells[neighbor].attrs[0]=-2;s.cells[neighbor].cancers=[{id:999,el:'metal',age:0}];
  assert.ok(G.act(s, { type: 'cast', magic: 'purify', cell: k }).ok);
  assert.deepStrictEqual(s.cells[k].attrs, [4, -1, 0, 0, 1]);
  assert.strictEqual(s.cells[neighbor].attrs[0],3);assert.strictEqual(s.cells[neighbor].cancers.length,0);
});

t('3 灵合成元素兽', () => {
  const s = G.newGame(8);
  const k = Object.keys(s.cells)[0];
  s.cells[k].spirits = [1, 2, 3].map(i => ({ id: 900 + i, el: 'wood', age: 0 }));
  assert.ok(G.act(s, { type: 'merge', cell: k, el: 'wood' }).ok);
  assert.strictEqual(s.cells[k].beasts.length, 1);
  assert.strictEqual(s.cells[k].spirits.length, 0);
});

t('元素灵数量不超过属性和', () => {
  const s = G.newGame(9);
  for (let r = 0; r < 20; r++) {
    G.act(s, { type: 'place', offer: 0, cell: G.legalPlacements(s)[0] });
    G.endRound(s);
  }
  for (const k of Object.keys(s.cells)) assert.ok(s.cells[k].spirits.length <= Math.max(0, sum(s.cells[k].attrs)));
});

t('随机 AI 打完 30 局，均能铺满结束', () => {
  for (let seed = 100; seed < 130; seed++) {
    const s = G.newGame(seed);
    let guard = 0;
    while (!s.over && guard++ < 1000) {
      const L = G.legalPlacements(s);
      G.act(s, { type: 'place', offer: 0, cell: L[Math.floor(Math.random() * L.length)] });
      if (s.over) break;
      const ks = Object.keys(s.cells);
      const k = ks[Math.floor(Math.random() * ks.length)];
      G.act(s, { type: 'cast', magic: D.MAGICS[Math.floor(Math.random() * 5)].id, cell: k });
      if (!s.over && s.round === s.round) G.endRound(s);
    }
    assert.ok(s.over, 'seed ' + seed + ' 未结束');
    assert.strictEqual(G.emptyKeys(s).length, 0);
    assert.ok(Number.isFinite(G.score(s).total));
  }
});

t('事件流：结晶事件数 = 结晶增量', () => {
  for (let seed = 1; seed < 30; seed++) {
    const s = G.newGame(seed);
    for (let r = 0; r < 12 && !s.over; r++) {
      const before = sum(Object.values(s.inv.crystal)) + sum(Object.values(s.inv.bigCrystal));
      G.act(s, { type: 'place', offer: 0, cell: G.legalPlacements(s)[0] });
      G.endRound(s);
      const after = sum(Object.values(s.inv.crystal)) + sum(Object.values(s.inv.bigCrystal));
      const n = s.events.filter(e => e.kind === 'crystal' || e.kind === 'bigCrystal').length;
      assert.strictEqual(n, after - before);
      s.events.forEach(e => assert.ok(G.SHAPE_KEYS.has(e.cell)));
    }
  }
});

t('事件流：失败行动清空，自动轮末保留行动事件', () => {
  const s = G.newGame(40);
  assert.deepStrictEqual(s.events, []);
  s.ap = 1;
  const cell = G.legalPlacements(s)[0];
  assert.ok(G.act(s, { type: 'place', offer: 0, cell }).ok);
  assert.strictEqual(s.round, 2);
  assert.ok(s.events.some(e => e.kind === 'place' && e.cell === cell));
  assert.ok(s.events.some(e => e.kind === 'spirit'));
  assert.strictEqual(G.act(s, { type: 'place', offer: 0, cell }).ok, false);
  assert.deepStrictEqual(s.events, []);
  assert.strictEqual(G.endRound(s).ok, false);
  assert.deepStrictEqual(s.events, []);
});

t('事件流：行动和轮末灵力事件总和等于实际分数变化', () => {
  const s = G.newGame(41);s.unlockedMagics.push('mine');
  for (let r = 0; r < 15; r++) {
    for (const action of [
      { type: 'place', offer: 0, cell: G.legalPlacements(s)[0] },
      { type: 'cast', magic: 'mine', cell: '3,3' },
    ]) {
      const before = G.score(s).total;
      assert.ok(G.act(s, action).ok);
      assert.strictEqual(s.events.reduce((n,e)=>n+(e.score||0),0), G.score(s).total-before);
    }
    const before = G.score(s).total;
    assert.ok(G.endRound(s).ok);
    assert.strictEqual(s.events.reduce((n,e)=>n+(e.score||0),0), G.score(s).total-before);
  }
});

console.log(`\n${pass} passed`);
