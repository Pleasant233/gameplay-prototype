const assert = require('node:assert/strict');
const G = require('./game.js'), D = require('./data.js'), Book = require('./achievements.js');
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('ok -', name); };
const total = xs => xs.reduce((a, b) => a + b, 0);
const game = seed => G.newGame(seed || 37);
const place = s => assert.ok(G.act(s, { type: 'place', offer: 0, cell: G.legalPlacements(s)[0] }).ok);
const prepare = () => { const s = game(); place(s); return s; };
const end = s => { if (!s.placed) place(s); assert.ok(G.endRound(s).ok); };
const crystal = (s, cell, el, options = {}) => G.act(s, { type: 'useCrystal', cell, el, ...options });
const snapshot = s => JSON.stringify({ ...s, events: [] });
const rejected = (s, a) => { const before = snapshot(s); assert.equal(G.act(s, a).ok, false); assert.equal(snapshot(s), before); assert.deepEqual(s.events, []); };
const receipt = (s, fn) => { const before = G.score(s).total; fn(); assert.equal(total(s.events.map(e => e.score || 0)), G.score(s).total - before); s.events.forEach(e => assert.ok(G.SHAPE_KEYS.has(e.cell))); };

test('85格、三种剧本开局五块相连恒为9、初始三选一为低阶', () => {
  assert.equal(G.SHAPE.length, 85);
  for (const scenario of ['standard', 'fire', 'water']) for (let seed = 1; seed <= 60; seed++) {
    const s = G.newGame(seed, { scenario }); assert.equal(Object.keys(s.cells).length, 5); assert.equal(total(G.globalAttrs(s)), 9);
    assert.ok(Object.keys(s.cells).every(k => G.neighbors(k).some(n => s.cells[n]))); assert.equal(new Set(s.offers).size, 3);
    s.offers.forEach(t => assert.equal(total(G.TYPE[t].attrs), 1));
  }
  assert.deepEqual(game(12), game(12));
});
test('先放置、每轮一次、放置耗1、跳过必须放过', () => {
  const s = game(); rejected(s, { type: 'cast', cell: '3,3', magic: 'purify' }); assert.equal(G.endRound(s).ok, false);
  rejected(s, { type: 'place', offer: 0, cell: '0,0' }); place(s); assert.equal(s.ap, 2);
  rejected(s, { type: 'place', offer: 0, cell: G.emptyKeys(s)[0] }); assert.ok(G.endRound(s).ok); assert.equal(s.round, 2); assert.equal(s.ap, 3);
});
test('普通大型逆结晶每轮可连续免费使用、0AP不换轮、库存耗尽拒绝', () => {
  for (const options of [{}, { big: true }, { inverse: true }]) for (const ap of [0, 1, 3]) for (const { key: el } of D.ELEMENTS) {
    const s = game(); s.ap = ap; s.cells['3,3'].attrs = [0, 0, 0, 0, 0];
    const bag = options.inverse ? s.inv.inverseCrystal : options.big ? s.inv.bigCrystal : s.inv.crystal; bag[el] = 2;
    receipt(s, () => assert.ok(crystal(s, '3,3', el, options).ok)); assert.equal(s.ap, ap); assert.equal(s.round, 1); assert.equal(bag[el], 1);
    assert.equal(s.cells['3,3'].attrs[D.ELEMENTS.findIndex(e => e.key === el)], options.inverse ? -1 : options.big ? 2 : 1);
    receipt(s, () => assert.ok(crystal(s, '3,3', el, options).ok));
    assert.equal(s.cells['3,3'].attrs[D.ELEMENTS.findIndex(e => e.key === el)], options.inverse ? -2 : options.big ? 4 : 2);
    assert.equal(bag[el], 0); assert.equal(s.ap, ap); assert.equal(s.round, 1); assert.equal(s.placed, 0);
    assert.deepEqual(s.interactionUsed, {});
    rejected(s, { type: 'useCrystal', cell: '3,3', el, ...options });
  }
});
test('同轮跨地块连续结晶、补库存继续用、到上限拒绝不扣库存', () => {
  const s = game(); s.ap = 0; s.inv.crystal.water = G.attrCap(s, '3,3') + G.attrCap(s, '2,3') + 2;
  for (const k of ['3,3', '2,3']) {
    s.cells[k].attrs = [0, 0, 0, 0, 0];
    const cap = G.attrCap(s, k);
    for (let i = 0; i < cap; i++) receipt(s, () => assert.ok(crystal(s, k, 'water').ok));
    assert.equal(s.cells[k].attrs[2], cap);
    rejected(s, { type: 'useCrystal', cell: k, el: 'water' });
  }
  s.inv.crystal.water++; s.cells['3,3'].attrs[2]--;
  assert.ok(crystal(s, '3,3', 'water').ok); assert.equal(s.ap, 0); assert.equal(s.round, 1);
});
test('无库存/无效元素/结束/封顶拒绝且不扣资源', () => {
  const s = game(); rejected(s, { type: 'useCrystal', cell: '3,3', el: 'bogus' }); rejected(s, { type: 'useCrystal', cell: '3,3', el: 'water' });
  s.inv.crystal.water = 1; s.cells['3,3'].attrs[2] = G.attrCap(s, '3,3'); rejected(s, { type: 'useCrystal', cell: '3,3', el: 'water' });
  s.over = true; rejected(s, { type: 'useCrystal', cell: '2,3', el: 'water' });
});
const guardianFixture = () => {
  const s=prepare(); s.visions=[];
  Object.values(s.cells).forEach(t=>{t.type='ruin_town';t.attrs=[0,0,0,0,0];t.beasts=[];t.cancers=[];t.animals=[];t.plants=[];});
  s.cells['3,3'].beasts=['wood','wood','wood','water','water','fire'].map((el,i)=>({id:900+i,el,age:0}));return s;
};
test('同格任意5兽免费合成守护灵，精确保留木3水2且不立即加属性',()=>{
  const s=guardianFixture();s.ap=0;s.interactionUsed['beast:900']=true;
  const before=G.score(s).base;receipt(s,()=>assert.ok(G.act(s,{type:'mergeGuardian',cell:'3,3',beastIds:[900,901,902,903,904]}).ok));
  assert.equal(s.ap,0);assert.equal(s.round,1);assert.equal(s.cells['3,3'].beasts.length,1);assert.equal(s.cells['3,3'].beasts[0].id,905);
  assert.deepEqual(s.cells['3,3'].guardians[0].power,{metal:0,wood:3,water:2,fire:0,earth:0});assert.equal(G.score(s).base,before-15);
  assert.deepEqual(s.cells['3,3'].attrs,[0,0,0,0,0]);assert.equal(s.events.filter(e=>e.kind==='guardianMerge').length,1);
});
test('守护灵合成拒绝不足、超量、重复、异格或失效ID，失败无消耗',()=>{
  const s=guardianFixture();s.cells['2,3'].beasts=[{id:999,el:'wood',age:0}];
  for(const ids of [null,[],[900,901,902,903],[900,901,902,903,904,905],[900,900,902,903,904],[900,901,902,903,999],[900,901,902,903,123]])rejected(s,{type:'mergeGuardian',cell:'3,3',beastIds:ids});
  rejected(s,{type:'mergeGuardian',cell:'0,0',beastIds:[900,901,902,903,904]});
});
test('守护灵轮末五格按配比滋养一次且不会自动移动或产大结晶',()=>{
  const s=guardianFixture();s.cells['3,3'].beasts.pop();G.act(s,{type:'mergeGuardian',cell:'3,3',beastIds:[900,901,902,903,904]});
  const guardian=s.cells['3,3'].guardians[0],area=G.guardianArea(s,'3,3');assert.equal(area.length,5);
  for(let i=1;i<=2;i++){
    s.placed=1;receipt(s,()=>assert.ok(G.endRound(s).ok));
    for(const k of area)assert.deepEqual(s.cells[k].attrs,[0,i*3,i*2,0,0]);
    assert.equal(s.events.filter(e=>e.kind==='guardian').length,1);assert.equal(s.cells['3,3'].guardians[0],guardian);
    assert.equal(total(Object.values(s.inv.bigCrystal)),0);
  }
});
test('守护灵只滋养已放置四邻，不影响空格或对角，属性封顶并按实际值记账',()=>{
  const s=game();s.visions=[];s.placed=1;s.cells={'3,3':G.makeTile('ruin_town'),'4,3':G.makeTile('desert'),'4,4':G.makeTile('ruin_town')};
  Object.values(s.cells).forEach(t=>t.attrs=[0,0,0,0,0]);s.cells['4,3'].attrs[1]=8;s.cells['4,3'].attrs[2]=-2;
  s.cells['3,3'].guardians=[{id:800,power:{metal:0,wood:3,water:2,fire:0,earth:0}}];
  receipt(s,()=>assert.ok(G.endRound(s).ok));assert.deepEqual(s.cells['4,3'].attrs,[0,9,0,0,0]);assert.deepEqual(s.cells['4,4'].attrs,[0,0,0,0,0]);
  assert.equal(Object.keys(s.cells).length,3);assert.deepEqual(s.events.find(e=>e.kind==='guardian').targets,['3,3','4,3']);
  assert.ok(s.events.some(e=>e.kind==='attr'&&e.cell==='4,3'&&e.el==='wood'&&e.n===1));
});
test('同格多守护灵叠加且同轮可多次合成，不增加独立单位分',()=>{
  const s=guardianFixture();s.cells['3,3'].beasts=Array.from({length:10},(_,i)=>({id:1000+i,el:'metal',age:0}));
  for(let n=0;n<2;n++)assert.ok(G.act(s,{type:'mergeGuardian',cell:'3,3',beastIds:Array.from({length:5},(_,i)=>1000+n*5+i)}).ok);
  assert.equal(s.cells['3,3'].guardians.length,2);assert.equal(s.ap,2);assert.equal(G.score(s).base,0);
  receipt(s,()=>assert.ok(G.endRound(s).ok));for(const k of G.guardianArea(s,'3,3'))assert.equal(s.cells[k].attrs[0],10);
  assert.equal(s.events.filter(e=>e.kind==='guardian').length,2);
});
test('守护灵移动每次耗1行动、同轮可往返，目标无属性门槛，无效目标不扣行动',()=>{
  const s=guardianFixture();G.act(s,{type:'mergeGuardian',cell:'3,3',beastIds:[900,901,902,903,904]});const g=s.cells['3,3'].guardians[0];s.cells['3,3'].beasts=[];s.ap=3;
  const move=(from,to)=>G.act(s,{type:'moveGuardian',from,to,guardianId:g.id});
  receipt(s,()=>assert.ok(move('3,3','2,3').ok));assert.equal(s.ap,2);assert.equal(s.round,1);assert.equal(s.cells['2,3'].guardians[0],g);
  receipt(s,()=>assert.ok(move('2,3','3,3').ok));assert.equal(s.ap,1);assert.equal(s.round,1);assert.ok(!s.interactionUsed['guardian:'+g.id]);
  for(const to of ['3,3','4,4','0,0'])rejected(s,{type:'moveGuardian',from:'3,3',to,guardianId:g.id});
  rejected(s,{type:'moveGuardian',from:'3,3',to:'2,3',guardianId:9999});
  receipt(s,()=>assert.ok(move('3,3','4,3').ok));assert.equal(s.round,2);assert.equal(s.cells['4,3'].guardians[0],g);
  const event=s.events.find(e=>e.kind==='guardian');assert.equal(event.cell,'4,3');assert.ok(!event.targets.includes('2,3'));assert.equal(s.cells['2,3'].attrs[1],0);
  s.ap=0;rejected(s,{type:'moveGuardian',from:'4,3',to:'3,3',guardianId:g.id});
  s.ap=3;rejected(s,{type:'moveGuardian',from:'4,3',to:'3,3',guardianId:g.id}); // first placement still required
});
test('净化五格负值+5、正值不动、癌元清零、同轮不重复', () => {
  const s = prepare(); for (const k of ['3,3', ...G.neighbors('3,3')]) { s.cells[k].attrs = [-1, -7, 1, 0, 0]; s.cells[k].cancers = [{ id: 1000, el: 'wood', age: 0 }]; }
  receipt(s, () => assert.ok(G.act(s, { type: 'cast', magic: 'purify', cell: '3,3' }).ok));
  for (const k of ['3,3', ...G.neighbors('3,3')]) { assert.deepEqual(s.cells[k].attrs, [4, -2, 1, 0, 0]); assert.equal(s.cells[k].cancers.length, 0); }
  assert.equal(s.events.filter(e => e.kind === 'purify').length, 5); rejected(s, { type: 'cast', magic: 'purify', cell: '3,3' });
});
test('净化干净中心可清邻污染、无目标拒绝', () => {
  const s = prepare(); Object.values(s.cells).forEach(t => { t.attrs = [0, 1, 0, 0, 0]; }); rejected(s, { type: 'cast', magic: 'purify', cell: '3,3' });
  s.cells['2,3'].attrs[0] = -1; assert.ok(G.act(s, { type: 'cast', magic: 'purify', cell: '3,3' }).ok); assert.equal(s.cells['2,3'].attrs[0], 4);
});
test('魔法20解锁边界、+5及矿脉泉眼耕田，耗1AP', () => {
  for (const [magic, i, field] of [['mine', 0, 'vein'], ['spring', 2, 'spring'], ['rich', 4, 'farm']]) {
    const s = prepare(); Object.values(s.cells).forEach(t => { t.attrs = [0, 0, 0, 0, 0]; });
    s.cells['2,3'].attrs[i] = 9; s.cells['4,3'].attrs[i] = 9; s.cells['3,2'].attrs[i] = 1; rejected(s, { type: 'cast', magic, cell: '3,3' });
    s.cells['3,2'].attrs[i] = 2; assert.ok(G.act(s, { type: 'cast', magic, cell: '3,3' }).ok); assert.equal(s.cells['3,3'].attrs[i], 5); assert.equal(s.cells['3,3'][field], true); assert.equal(s.ap, 1);
  }
});
test('焚尽水木归零火+5、癌元和植物清除', () => {
  const s = prepare(); Object.values(s.cells).forEach(t => { t.attrs[3] = 5; }); const t = s.cells['3,3']; t.attrs = [0, 2, 2, 0, 1];
  t.cancers = [{ id: 900, el: 'metal', age: 0 }]; t.plants = [{ id: 901, kind: 'grass' }];
  assert.ok(G.act(s, { type: 'cast', magic: 'burn', cell: '3,3' }).ok); assert.deepEqual(t.attrs, [0, 0, 0, 5, 1]); assert.equal(t.cancers.length + t.plants.length, 0);
});
test('同种四邻连片每多一格上限+3，封顶不超出', () => {
  const s = game(); for (const k of Object.keys(s.cells)) s.cells[k] = G.makeTile('ruin_town');
  assert.equal(G.attrCap(s, '3,3'), 21); assert.equal(G.attrCap(s, '2,3'), 21); s.cells['2,2'] = G.makeTile('forest'); assert.equal(G.attrCap(s, '2,2'), 9);
  s.inv.bigCrystal.wood = 1; s.cells['2,3'].attrs[1] = 20; crystal(s, '2,3', 'wood', { big: true }); assert.equal(s.cells['2,3'].attrs[1], 21);
});
test('免费升级逐维匹配、保留属性、成就一次解锁', () => {
  const s = game(); s.cells['3,3'] = G.makeTile('ruin_town'); s.cells['3,3'].attrs = [0, 2, 1, 0, 1];
  assert.ok(G.upgrades(s, '3,3').some(t => t.id === 'forest')); const before = s.ap;
  assert.ok(G.act(s, { type: 'upgrade', cell: '3,3', tileType: 'forest' }).ok); assert.equal(s.ap, before); assert.deepEqual(s.cells['3,3'].attrs, [0, 2, 1, 0, 1]);
  rejected(s, { type: 'upgrade', cell: '3,3', tileType: 'mine' }); assert.ok(s.achievements.includes('upgrade'));
});
test('重投3普通结晶、全层候选、放置后拒绝', () => {
  const s = game(); rejected(s, { type: 'reroll' }); s.inv.crystal.water = 3; assert.ok(G.act(s, { type: 'reroll' }).ok);
  assert.equal(s.ap, 3); assert.equal(s.inv.crystal.water, 0); assert.equal(s.offers.length, 3); place(s); s.inv.crystal.water = 3; rejected(s, { type: 'reroll' });
});
test('阶段500/1000/1500增行动，最高9，升级当轮补差', () => {
  const s = game(); for (const [n, ap] of [[499, 3], [500, 5], [1000, 7], [1500, 9], [5000, 9]]) { s.peakScore = n; assert.equal(G.apLimit(s), ap); }
  s.peakScore = 500; s.inv.crystal.water = 1; crystal(s, '3,3', 'water'); assert.equal(s.roundAP, 5); assert.equal(s.ap, 5);
  end(s); s.offers.forEach(id => assert.ok(total(G.TYPE[id].attrs) >= 1 && total(G.TYPE[id].attrs) <= 3));
});
test('植物逐种门槛、可耕地水稻、有水域水草', () => {
  const t = G.makeTile('barren'); t.attrs = [0, 3, 5, 0, 3]; assert.deepEqual(G.eligiblePlants(t), ['grass', 'shrub', 'tree', 'crop']);
  t.pond = true; assert.ok(G.eligiblePlants(t).includes('weed')); t.type = 'desert'; assert.ok(!G.eligiblePlants(t).includes('crop'));
  t.farm = true; assert.ok(G.eligiblePlants(t).includes('crop')); t.attrs[1] = 0; assert.deepEqual(G.eligiblePlants(t), []);
});
test('动物严格草树数量条件，不在不满足的地块出生', () => {
  const t = G.makeTile('forest'); t.attrs[1] = 3; t.plants = Array.from({ length: 3 }, (_, id) => ({ id, kind: 'tree' })); assert.deepEqual(G.eligibleAnimals(t), ['bird', 'bear']);
  t.plants.push({ id: 4, kind: 'tree' }); assert.ok(G.eligibleAnimals(t).includes('leopard')); t.plants = Array.from({ length: 4 }, (_, id) => ({ id, kind: 'grass' }));
  assert.deepEqual(G.eligibleAnimals(t), ['rabbit', 'cow', 'sheep', 'deer']); t.pond = true; assert.ok(G.eligibleAnimals(t).includes('fish'));
});
test('三灵合兽免费，兽移动给新格+1，重复移动拒绝', () => {
  const s = game(), t = s.cells['3,3']; t.spirits = [801, 802, 803].map(id => ({ id, el: 'wood', age: 0 })); t.attrs[1] = 5;
  const before = G.score(s).base; assert.ok(G.act(s, { type: 'merge', cell: '3,3', el: 'wood' }).ok); assert.equal(G.score(s).base, before + 3); assert.equal(s.ap, 3);
  s.cells['2,3'].attrs[1] = 1; const b = t.beasts[0]; assert.ok(G.act(s, { type: 'moveBeast', from: '3,3', to: '2,3', beastId: b.id }).ok); assert.equal(s.cells['2,3'].attrs[1], 2);
  rejected(s, { type: 'moveBeast', from: '2,3', to: '3,3', beastId: b.id });
});
test('生物移动移植堆肥共享每对象一轮一次；下轮可再交互', () => {
  const s = game(); s.cells['3,3'].plants = [{ id: 700, kind: 'tree' }]; assert.ok(G.act(s, { type: 'movePlant', from: '3,3', to: '2,3', plantId: 700 }).ok);
  rejected(s, { type: 'chop', cell: '2,3', plantId: 700 }); assert.equal(s.ap, 3); end(s); assert.ok(G.act(s, { type: 'chop', cell: '2,3', plantId: 700 }).ok); assert.equal(s.inv.wood, 2);
});
test('配对标记两个亲本，容量3，喂养不耗AP', () => {
  const s = game(), t = s.cells['3,3']; t.animals = [710, 711].map(id => ({ id, kind: 'rabbit', el: null, cd: 0, age: 0 }));
  assert.ok(G.act(s, { type: 'pair', cell: '3,3', animalId: 710 }).ok); assert.equal(t.animals.length, 3); assert.ok(s.interactionUsed['animal:710'] && s.interactionUsed['animal:711']);
  s.inv.crystal.water = 1; rejected(s, { type: 'feed', cell: '3,3', animalId: 711, el: 'water' }); assert.ok(G.act(s, { type: 'feed', cell: '3,3', animalId: t.animals[2].id, el: 'water' }).ok);
});
test('元素动物三轮各产矿物/作物/水/火+1/土+1', () => {
  for (const el of D.ELEMENTS.map(e => e.key)) {
    const s = prepare(); Object.values(s.cells).forEach(t => { t.attrs = [0, 0, 0, 0, 0]; t.plants = []; }); const t = s.cells['3,3']; t.animals = [{ id: 900, kind: 'rabbit', el, cd: 0, age: 2 }];
    receipt(s, () => assert.ok(G.endRound(s).ok));
    if (el === 'metal') assert.equal(total(Object.values(s.inv.ore)), 1); if (el === 'wood') assert.equal(t.plants.length, 1); if (el === 'water') assert.equal(s.inv.water, 1);
    if (el === 'fire') assert.equal(t.attrs[3], 1); if (el === 'earth') assert.equal(t.attrs[4], 1); assert.equal(total(Object.values(s.inv.crystal)), 0);
  }
});
test('桶仅木1、火山不耗水、沙漠成绿洲、舀倒同轮不能重复', () => {
  const s = game(); s.inv.wood = 1; assert.ok(G.act(s, { type: 'craft', recipe: 'bucket' }).ok); assert.equal(s.inv.wood, 0); assert.equal(s.inv.bucket, 1); assert.equal(s.ap, 3);
  s.inv.bucketFull = 1; s.cells['3,3'] = G.makeTile('volcano'); rejected(s, { type: 'pour', cell: '3,3' }); s.cells['3,3'] = G.makeTile('desert');
  assert.ok(G.act(s, { type: 'pour', cell: '3,3' }).ok); assert.ok(s.cells['3,3'].pond && s.cells['3,3'].oasis); assert.equal(s.inv.bucketFull, 0); rejected(s, { type: 'scoop', cell: '3,3' });
});
test('庇护所木4铁2，容量+4且属性不变', () => {
  const s = game(), before = G.spiritCap(s.cells['3,3']), attrs = s.cells['3,3'].attrs.slice(); s.inv.wood = 4; s.inv.ore.iron = 2;
  assert.ok(G.act(s, { type: 'craft', recipe: 'shelter', cell: '3,3' }).ok); assert.equal(G.spiritCap(s.cells['3,3']), before + 4); assert.deepEqual(s.cells['3,3'].attrs, attrs); assert.equal(s.inv.wood + s.inv.ore.iron, 0);
});
test('癌元负属性生成、三轮吸收产逆晶、移邻感染原地灵', () => {
  const s = prepare(); Object.values(s.cells).forEach(t => { t.attrs = [0, 0, 0, 0, 0]; t.spirits = []; }); const t = s.cells['3,3'];
  t.attrs = [0, -2, 0, 0, 5]; t.cancers = [{ id: 991, el: 'wood', age: 2 }]; t.spirits = [{ id: 992, el: 'earth', age: 0 }];
  assert.ok(G.endRound(s).ok); assert.equal(t.attrs[1], -3); assert.equal(s.inv.inverseCrystal.wood, 1); assert.ok(Object.values(s.cells).some(t => t.cancers.some(c => c.id === 991)));
  assert.ok(t.cancers.some(c => c.id === 992)); assert.ok(s.events.some(e => e.kind === 'infection'));
});
test('癌元对应属性0不吸收不产逆晶，灵3轮兽2轮结晶', () => {
  const s = prepare(); Object.values(s.cells).forEach(t => { t.attrs = [0, 0, 0, 0, 0]; }); const t = s.cells['3,3'];
  t.cancers = [{ id: 991, el: 'metal', age: 2 }]; t.attrs[1] = 8; t.spirits = [{ id: 992, el: 'wood', age: 2 }]; t.beasts = [{ id: 993, el: 'wood', age: 1 }];
  G.endRound(s); assert.equal(s.inv.inverseCrystal.metal, 0); assert.equal(s.inv.crystal.wood, 1); assert.equal(s.inv.bigCrystal.wood, 1);
});
test('每10轮陨石精确floor(n/3)、−3，9轮不触发', () => {
  const s = prepare(); Object.values(s.cells).forEach(t => { t.attrs = [0, 0, 0, 0, 0]; }); s.round = 9; G.endRound(s); assert.equal(s.lastMeteor, null);
  place(s); Object.values(s.cells).forEach(t => { t.attrs = [0, 0, 0, 0, 0]; }); receipt(s, () => G.endRound(s));
  assert.equal(s.lastMeteor.round, 10); assert.equal(s.lastMeteor.cells.length, Math.floor(Object.keys(s.cells).length / 3)); const i = D.ELEMENTS.findIndex(e => e.key === s.lastMeteor.el);
  s.lastMeteor.cells.forEach(k => assert.equal(s.cells[k].attrs[i], -3));
});
test('盾配比5的倍数、整数、库存、覆盖、共享防护正确', () => {
  const s = prepare(); Object.values(s.cells).forEach(t => { t.attrs = [0, 0, 0, 0, 0]; }); s.inv.crystal.metal = 10;
  for (const crystals of [{ metal: 6 }, { metal: 1.5 }, { metal: 11, wood: -1 }]) rejected(s, { type: 'craftShield', crystals });
  assert.ok(G.act(s, { type: 'craftShield', crystals: { metal: 10 } }).ok); const sh = s.inv.shields[0]; assert.equal(sh.coverage, 2); assert.equal(s.inv.crystal.metal, 0);
  assert.ok(G.act(s, { type: 'deployShield', shieldId: sh.id, cell: '3,3' }).ok); assert.equal(s.shields[0].cells.length, 2);
  s.shields = [{ id: 2000, defense: Object.fromEntries(D.ELEMENTS.map(e => [e.key, 10])), coverage: 10, cells: Object.keys(s.cells) }]; s.round = 10; G.endRound(s);
  assert.equal(s.lastMeteor.blocked, s.lastMeteor.cells.length * 3); assert.equal(s.shields[0].defense[s.lastMeteor.el], 10 - s.lastMeteor.blocked); assert.ok(s.achievements.includes('shield'));
});
test('确认公式不计元素灵、植物×1，愿景奖励单列不重复', () => {
  const s = game(); Object.values(s.cells).forEach(t => { t.attrs = [0, 0, 0, 0, 0]; }); const t = s.cells['3,3']; t.attrs = [1, 2, 3, 4, 5];
  t.spirits = [{ id: 1, el: 'wood', age: 0 }]; t.beasts = [{ id: 2, el: 'wood', age: 0 }]; t.animals = [{ id: 3, kind: 'rabbit', el: 'earth' }]; t.plants = [{ id: 4, kind: 'grass' }]; assert.equal(G.score(s).base, 20);
  s.visions = [{ id: 'settlement', done: false }]; s.inv.wood = 4; s.inv.ore.iron = 2;
  receipt(s, () => assert.ok(G.act(s, { type: 'craft', recipe: 'shelter', cell: '3,3' }).ok)); assert.equal(G.score(s).bonus, 30); rejected(s, { type: 'craft', recipe: 'shelter', cell: '2,3' }); assert.equal(G.score(s).bonus, 30);
});
test('成就不重复、本机持久化、损坏或禁用存储降级', () => {
  const s = game(); place(s); const map = new Map(), storage = { getItem: k => map.get(k), setItem: (k, v) => map.set(k, v) }, book = Book.create(storage);
  assert.ok(book.observe(s, G.metrics(s)).includes('first_place')); assert.deepEqual(book.observe(s, G.metrics(s)), []); assert.ok(Book.create(storage).snapshot().unlocked.includes('first_place'));
  const bad = Book.create({ getItem() { return '{bad'; }, setItem() { throw Error('blocked'); } }); assert.ok(bad.observe(s, G.metrics(s)).includes('first_place')); assert.equal(bad.persistent(), false); assert.ok(Book.create(undefined));
});
test('自动轮末保留行动事件、分数账一致、失败清空收益', () => {
  const s = game(); s.ap = 1; receipt(s, () => place(s)); assert.equal(s.round, 2); assert.ok(s.events.some(e => e.kind === 'place')); assert.ok(s.events.some(e => e.kind === 'spirit'));
  rejected(s, { type: 'place', offer: 0, cell: '3,3' });
});
test('30局含灾变交互完整打到终局，资源容量上限与账目始终成立', () => {
  for (let seed = 100; seed < 130; seed++) {
    const s = game(seed); let guard = 0;
    while (!s.over && guard++ < 90) {
      receipt(s, () => place(s)); if (s.over) break; const pollution = Object.keys(s.cells).find(k => G.canPurify(s, k));
      if (pollution) receipt(s, () => G.act(s, { type: 'cast', magic: 'purify', cell: pollution }));
      for (const e of D.ELEMENTS) if (s.inv.crystal[e.key]) { const k = Object.keys(s.cells).find(k => s.cells[k].attrs[D.ELEMENTS.indexOf(e)] < G.attrCap(s, k)); if (k) receipt(s, () => crystal(s, k, e.key)); }
      if (s.placed) receipt(s, () => assert.ok(G.endRound(s).ok));
      for (const [k, t] of Object.entries(s.cells)) { assert.ok(t.spirits.length <= G.spiritCap(t)); assert.ok(t.attrs.every(Number.isFinite)); assert.ok(t.attrs.every(v => v <= G.attrCap(s, k))); assert.ok(t.plants.length <= 5 && t.animals.length <= 3 && t.ores.length <= 2); }
    }
    assert.ok(s.over); assert.equal(G.emptyKeys(s).length, 0); assert.equal(s.stats.placements, 80); assert.ok(s.achievements.includes('world')); assert.ok(Number.isFinite(G.score(s).total));
  }
});
console.log(`\n${pass} rule groups passed`);
