// Check geometric invariants against the actual view implementation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const THREE=require('./lib/three.min.js');
const Game=require('./game.js'),GameData=require('./data.js');
const source=fs.readFileSync('view.js','utf8').replace('  root.View = {',
  '  root.testView={setState(s){G=root.Game;D=root.GameData;EL=D.ELEMENTS;stateRef=s;},surfaceHeight,surfaceColor,terrainGeometry,outlineGeometry,cloudDistance,cloudGeometry};\n  root.View = {');
const context={THREE,Game,GameData,navigator:{userAgent:'test',hardwareConcurrency:8}};
vm.runInNewContext(source,context);
const v=context.testView,s=Game.newGame(42),half=1.12/2;
// Include high peaks, low water, empty cells, and diagonally placed tiles.
Game.SHAPE.forEach(([x,z],i)=>{if(i%4!==0)s.cells[Game.key(x,z)]={...s.cells['3,3'],type:GameData.TILE_TYPES[i%GameData.TILE_TYPES.length].id};});
v.setState(s);
function checkEdges(){
  let checks=0;
  const sameColor=(a,b)=>{for(const c of ['r','g','b'])assert.ok(Math.abs(a[c]-b[c])<1e-10);};
  for(const [x,z] of Game.SHAPE){
    const k=Game.key(x,z);
    for(let i=0;i<=24;i++){
      const t=-half+i*1.12/24;
      if(Game.SHAPE_KEYS.has(Game.key(x+1,z))){assert.ok(Math.abs(v.surfaceHeight(k,half,t)-v.surfaceHeight(Game.key(x+1,z),-half,t))<1e-10);sameColor(v.surfaceColor(k,half,t),v.surfaceColor(Game.key(x+1,z),-half,t));checks++;}
      if(Game.SHAPE_KEYS.has(Game.key(x,z+1))){assert.ok(Math.abs(v.surfaceHeight(k,t,half)-v.surfaceHeight(Game.key(x,z+1),t,-half))<1e-10);sameColor(v.surfaceColor(k,t,half),v.surfaceColor(Game.key(x,z+1),t,-half));checks++;}
    }
    const g=v.terrainGeometry(k),positions=g.attributes.position.array;
    assert.ok([...positions].every(Number.isFinite));
    assert.ok(Math.abs(Math.min(...[...positions].filter((_,i)=>i%3===1))+0.32)<1e-6);
    assert.ok(g.attributes.normal.array[1]>0);
    g.dispose();
  }
  return checks;
}
const first=checkEdges();
delete s.cells['3,3'];s.cells['3,2'].type=GameData.TILE_TYPES.find(t=>t.look==='peak').id;
const second=checkEdges();
console.log(`ok - ${first+second} shared edge/corner heights agree, including placement/removal`);
console.log('ok - all terrain meshes have finite vertices, upward tops and buried side walls');
Game.SHAPE.forEach(([x,z])=>assert.strictEqual(v.cloudDistance((x-3)*1.12,(z-3)*1.12),0));
assert.ok(v.cloudDistance(20,20)>1.35);
console.log('ok - shared boundary colors agree and cloud clearance covers the entire board');
// A closed cloud surface needs consistent winding and a safe clearance bound.
for(let variant=0;variant<4;variant++){
  const g=v.cloudGeometry(variant),p=g.attributes.position,n=g.attributes.normal,edges=new Map();
  const vertex=i=>[p.getX(i),p.getY(i),p.getZ(i)],code=a=>a.map(v=>v.toFixed(5)).join(',');
  for(let i=0;i<g.index.count;i+=3){
    const j=g.index.getX(i),a=vertex(j),b=vertex(g.index.getX(i+1)),c=vertex(g.index.getX(i+2)),cross=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a)));
    assert.ok([...a,...b,...c].every(Number.isFinite));
    assert.ok(cross.dot(new THREE.Vector3(n.getX(j),n.getY(j),n.getZ(j)))>-1e-6,'outward cloud triangles');
    for(const point of [a,b,c])assert.ok(Math.hypot(point[0],point[2])<1.65,'cloud horizontal clearance bound');
    for(const [from,to] of [[a,b],[b,c],[c,a]]){const edge=[code(from),code(to)].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}
  }
  assert.ok([...edges.values()].every(count=>count===2),'closed cloud surface');
  g.dispose();
}
console.log('ok - four rounded cloud meshes are closed, face outward and fit their clearance bounds');
