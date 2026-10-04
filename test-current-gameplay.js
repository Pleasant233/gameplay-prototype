// Regression coverage for the recovered Element Habitat gameplay baseline.
const assert=require('node:assert/strict');
const G=require('./game.js'),D=require('./data.js'),Book=require('./achievements.js');
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('ok - '+name);};
const place=s=>assert.ok(G.act(s,{type:'place',offer:0,cell:G.legalPlacements(s)[0]}).ok);
test('magic unlocks at 20 global attributes and persists after attributes fall',()=>{
  const s=G.newGame(37);
  Object.values(s.cells).forEach(t=>t.attrs[0]=0);
  assert.equal(G.magicUnlocked(s,'mine'),false);
  Object.values(s.cells).forEach(t=>t.attrs[0]=4);
  s.inv.crystal.water=1;assert.ok(G.act(s,{type:'useCrystal',cell:'3,3',el:'water'}).ok);
  assert.ok(s.unlockedMagics.includes('mine'));
  Object.values(s.cells).forEach(t=>t.attrs[0]=0);
  assert.ok(G.magicUnlocked(s,'mine'));
  place(s);assert.ok(G.act(s,{type:'cast',cell:'3,3',magic:'mine'}).ok);
  assert.equal(s.cells['3,3'].attrs[0],5);assert.equal(s.cells['3,3'].vein,true);
});
test('ordinary, large and inverse crystals can repeat per round without AP costs',()=>{
  for(const [bag,big,inverse,delta] of [['crystal',false,false,1],['bigCrystal',true,false,2],['inverseCrystal',false,true,-1]]){
    const s=G.newGame(37);s.cells['3,3'].attrs=[0,0,0,-30,0];s.inv[bag].fire=12;
    for(let n=1;n<=12;n++){
      assert.ok(G.act(s,{type:'useCrystal',cell:'3,3',el:'fire',big,inverse}).ok);
      assert.equal(s.cells['3,3'].attrs[3],Math.min(G.attrCap(s,'3,3'),-30+n*delta));
      assert.equal(s.ap,3);assert.equal(s.round,1);assert.equal(s.placed,0);
    }
    assert.equal(s.inv[bag].fire,0);
  }
});
test('same-type gameplay clusters retain independent attribute caps',()=>{
  const s=G.newGame(37);s.cells={};
  for(const [k,ty] of [['3,3','forest'],['4,3','forest'],['5,3','rainforest']])s.cells[k]=G.makeTile(ty);
  assert.equal(G.cluster(s,'3,3').length,2);
  assert.equal(G.attrCap(s,'3,3'),D.RULES.attrMax+D.RULES.clusterBonus);
  assert.equal(G.cluster(s,'5,3').length,1);
});
test('fire meteor rain occurs on round 10 in a connected third of the board, shields absorb damage',()=>{
  let fixture;
  for(let seed=1;seed<=100&&!fixture;seed++){
    const s=G.newGame(seed);
    for(let round=1;round<=10;round++){
      place(s);
      if(round===10){const preview=structuredClone(s);G.endRound(preview);if(preview.lastMeteor.el==='fire')fixture=s;break;}
      G.endRound(s);assert.equal(s.lastMeteor,null);
    }
  }
  assert.ok(fixture,'deterministic fire fixture exists');
  const shielded=structuredClone(fixture);
  shielded.shields=[{id:999,defense:Object.fromEntries(D.ELEMENTS.map(e=>[e.key,100])),cells:Object.keys(shielded.cells)}];
  G.endRound(fixture);G.endRound(shielded);
  const rain=fixture.events.filter(e=>e.kind==='meteor');
  assert.equal(fixture.lastMeteor.round,10);assert.equal(fixture.lastMeteor.el,'fire');
  assert.equal(rain.length,Math.floor(Object.keys(fixture.cells).length/3));
  assert.deepEqual(G.region(fixture,rain[0].cell,rain.length),rain.map(e=>e.cell));
  assert.ok(rain.every(e=>e.el==='fire'&&e.damage===3));
  assert.ok(shielded.events.filter(e=>e.kind==='meteor').every(e=>e.damage===0));
  assert.equal(shielded.lastMeteor.blocked,rain.length*3);
  for(const e of rain)assert.equal(shielded.cells[e.cell].attrs[3]-fixture.cells[e.cell].attrs[3],3);
  assert.equal(fixture.round,11);
});
test('stage progression raises AP to 5, 7 and 9, achievements persist in the browser book',()=>{
  const s=G.newGame(37);
  for(const [peak,ap] of [[499,3],[500,5],[1000,7],[1500,9],[9000,9]]){s.peakScore=peak;assert.equal(G.apLimit(s),ap);}
  const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  const a=D.ACHIEVEMENTS[0];s.achievements=[a.id];const book=Book.create(storage);
  assert.deepEqual(book.observe(s,{[a.metric]:a.target}),[a.id]);
  const reopened=Book.create(storage);assert.ok(reopened.snapshot().unlocked.includes(a.id));
  assert.deepEqual(reopened.observe(G.newGame(38),{}),[]);assert.equal(reopened.snapshot().progress[a.id],a.target);
});
test('five beasts merge into a free guardian that moves for 1 AP and nourishes its area each round',()=>{
  const s=G.newGame(37),k='3,3',t=s.cells[k];
  t.beasts=['fire','fire','water','wood','metal'].map((el,i)=>({id:900+i,el,age:0}));
  const ids=t.beasts.map(b=>b.id);
  assert.equal(G.act(s,{type:'mergeGuardian',cell:k,beastIds:ids.slice(0,4)}).ok,false);
  assert.ok(G.act(s,{type:'mergeGuardian',cell:k,beastIds:ids}).ok);
  assert.equal(s.ap,3);assert.equal(t.beasts.length,0);
  assert.deepEqual(t.guardians[0].power,{metal:1,wood:1,water:1,fire:2,earth:0});
  const gid=t.guardians[0].id,to=G.neighbors(k).find(n=>s.cells[n]);
  assert.equal(G.act(s,{type:'moveGuardian',from:k,guardianId:gid,to}).ok,false);   // place first
  place(s);
  assert.ok(G.act(s,{type:'moveGuardian',from:k,guardianId:gid,to}).ok);
  assert.equal(s.ap,1);assert.equal(s.cells[to].guardians[0].id,gid);
  const area=G.guardianArea(s,to),before=area.map(c=>s.cells[c].attrs[3]);
  assert.ok(G.endRound(s).ok);
  const ev=s.events.find(e=>e.kind==='guardian');
  assert.ok(ev);assert.deepEqual(ev.targets,area);
  area.forEach((c,i)=>assert.ok(s.cells[c].attrs[3]>=before[i]));
});
console.log(`${passed} current-gameplay regressions passed`);
