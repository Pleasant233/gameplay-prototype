const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('./lib/three.min.js'),Game=require('./game.js'),GameData=require('./data.js'),Landscape=require('./landscape.js');
const cell=type=>({type,attrs:[...Game.TYPE[type].attrs]});
const make=entries=>Object.fromEntries(entries.map(([k,type])=>[k,cell(type)]));
const p=entries=>Landscape.plan(make(entries),Game.TYPE);
const a=p([['3,3','forest'],['4,4','rainforest'],['4,3','lake']]);
assert.equal(a.regions.length,3,'diagonal forests and different terrain must not connect');
const b=p([['3,3','forest'],['4,3','rainforest']]);
assert.equal(b.byCell['3,3'],b.byCell['4,3'],'compatible forest variants form one canopy');
const separated=p([['2,3','forest'],['4,3','forest']]);
const joined=p([['2,3','forest'],['3,3','forest'],['4,3','forest']]);
const growth=Landscape.growth(separated,joined);
assert.equal(growth.length,1);assert.equal(growth[0].merged,true);assert.equal(growth[0].milestone,true);
assert.equal(growth[0].origin,'3,3');
assert.equal(Landscape.growth(joined,joined).length,0,'selection and repeated sync do not repeat rewards');
assert.equal(Landscape.growth(joined,separated).length,0,'removal does not celebrate growth');
const pollution=p([['3,3','lake'],['4,3','polluted_lake']]);assert.notEqual(pollution.byCell['3,3'],pollution.byCell['4,3']);
const state={cells:make([['3,3','forest'],['4,3','rainforest']])},before=JSON.stringify(state);
Landscape.plan(state.cells,Game.TYPE);assert.equal(JSON.stringify(state),before,'visual planning cannot mutate rules');
console.log('ok - topology handles variants, diagonals, bridges, removals and repeated sync without state mutation');
const source=fs.readFileSync('view.js','utf8').replace('  root.View = {',`  root.probe={setState(s){G=root.Game;D=root.GameData;EL=D.ELEMENTS;stateRef=s;landscape=root.Landscape.plan(s.cells,G.TYPE);return landscape;},ridgeGeometry,waterGeometry,modelHeight};\n  root.View = {`);
const context={THREE,Game,GameData,Landscape,navigator:{userAgent:'test',hardwareConcurrency:8}};
vm.runInNewContext(source,context);const v=context.probe,half=1.12/2;
let lastDensity=0,lastVertices=0;
for(const size of [1,3,6,10]){
  // Use a single connected rectangular patch.
  const coordinates=Array.from({length:size},(_,i)=>[Game.key(1+i%5,2+Math.floor(i/5)),'rock_mount']);
  const s={cells:make(coordinates)},region=Landscape.plan(s.cells,Game.TYPE).regions[0];v.setState(s);
  const mesh=v.ridgeGeometry(region,coordinates[0][0]),count=mesh.attributes.position.count;
  assert.ok(count>lastVertices,'larger connected ranges acquire more geometric detail');lastVertices=count;
  const density=Landscape.density(region,false);assert.ok(density>lastDensity);lastDensity=density;
  assert.ok([...mesh.attributes.position.array,...mesh.attributes.normal.array].every(Number.isFinite));mesh.dispose();
}
for(const type of ['rock_mount','lake','creek_plain']){
  const s={cells:make([['3,3',type],['4,3',type],['4,4',type],['3,4',type]])};
  const r=v.setState(s).byCell['3,3'];
  const meshes=['3,3','4,3'].map(k=>type==='rock_mount'?v.ridgeGeometry(r,k):v.waterGeometry(r,k,.105));
  const edge=(g,x)=>{
    const p=g.attributes.position,points=new Map();
    for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-x)<1e-6)points.set(p.getZ(i).toFixed(5),p.getY(i));
    return points;
  };
  const left=edge(meshes[0],half),right=edge(meshes[1],-half);
  assert.ok(left.size>0&&right.size>0,`${type} crosses the seam`);
  assert.deepEqual([...left.keys()].sort(),[...right.keys()].sort());
  for(const [z,y] of left)assert.ok(Math.abs(y-right.get(z))<1e-5,`${type} joins without a height crack`);
  if(type==='rock_mount')assert.ok(v.modelHeight(r,'3,3',half,0)>.3,'range has a raised saddle between tiles');
  meshes.forEach(g=>g.dispose());
}
const full={cells:make(Game.SHAPE.map(([x,z])=>[Game.key(x,z),'forest']))};
const r=Landscape.plan(full.cells,Game.TYPE).regions[0];assert.equal(r.size,85);
assert.ok(Landscape.density(r,true)<Landscape.density(r,false));assert.ok(Landscape.density(r,false)<=13);
console.log('ok - model detail grows at 3/6/10, mountain/lake/stream seams join, and full-board density stays bounded');
