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

t('最后 1 点必须放置', () => {
  const s = G.newGame(3);
  const k = Object.keys(s.cells)[0];
  assert.ok(G.act(s, { type: 'cast', magic: 'mine', cell: k }).ok);
  assert.ok(G.act(s, { type: 'cast', magic: 'rich', cell: k }).ok);
  assert.strictEqual(G.act(s, { type: 'cast', magic: 'spring', cell: k }).ok, false);
});

t('跳过前必须已放置', () => {
  const s = G.newGame(4);
  assert.strictEqual(G.endRound(s).ok, false);
  G.act(s, { type: 'place', offer: 0, cell: G.legalPlacements(s)[0] });
  assert.ok(G.endRound(s).ok);
  assert.strictEqual(s.round, 2);
});

t('焚尽：水木归零、火+1', () => {
  const s = G.newGame(5);
  const k = Object.keys(s.cells)[0];
  s.cells[k].attrs = [0, 2, 2, 0, 1];
  G.act(s, { type: 'cast', magic: 'burn', cell: k });
  assert.deepStrictEqual(s.cells[k].attrs, [0, 0, 0, 1, 1]);
});

t('净化：所有负值 +1，无负值时拒绝', () => {
  const s = G.newGame(6);
  const k = Object.keys(s.cells)[0];
  s.cells[k].attrs = [1, 1, 1, 1, 1];
  assert.strictEqual(G.act(s, { type: 'cast', magic: 'purify', cell: k }).ok, false);
  s.cells[k].attrs = [-1, -2, 0, 0, 1];
  assert.ok(G.act(s, { type: 'cast', magic: 'purify', cell: k }).ok);
  assert.deepStrictEqual(s.cells[k].attrs, [0, -1, 0, 0, 1]);
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

console.log(`\n${pass} passed`);
