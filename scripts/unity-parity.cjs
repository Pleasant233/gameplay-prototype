// Published snapshot is the migration oracle. Root browser sources remain unchanged.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const G=require('../migration/web-reference/game.js'),D=require('../migration/web-reference/data.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','unity-rules-published');fs.mkdirSync(out,{recursive:true});
const clone=x=>JSON.parse(JSON.stringify(x)),fixtures=[],cases=[];
const original={newGame:G.newGame,act:G.act,endRound:G.endRound,enterEndless:G.enterEndless};
let activeSequence=null;
G.newGame=function(seed,options={}){const state=original.newGame(seed,options);fixtures.push({input:{op:'new',seed:seed>>>0,tutorial:!!options.tutorial,mode:options.mode||'challenge'},state:clone(state),score:G.score(state)});return state;};
for(const [name,op]of [['act','act'],['endRound','end'],['enterEndless','endless']])G[name]=function(state,action){if(activeSequence)activeSequence.push(name==='act'?clone(action):{type:name==='endRound'?'endRound':'enterEndless'});const input={op,state:clone(state),action},result=original[name](state,action);fixtures.push({input,state:clone(state),result:clone(result),score:G.score(state)});return result;};
const test=(name,fn)=>{fn();cases.push(name);console.log('ok published - '+name);},game=(seed=1313,options={})=>G.newGame(seed,options);
const act=(s,a)=>{const r=G.act(s,a);assert.ok(r.ok,r.msg);return r;},end=s=>{const r=G.endRound(s);assert.ok(r.ok,r.msg);return r;},place=s=>act(s,{type:'place',offer:0,cell:G.legalPlacements(s)[0]});
test('中央守护塔、84可放格、初始4.5分与两种模式',()=>{
 for(const mode of ['challenge','endless'])for(const tutorial of [true,false]){const s=game(6,{mode,tutorial});assert.equal(s.cells['3,3'],undefined);assert.equal(Object.keys(s.cells).length,5);assert.equal(G.score(s).total,4.5);assert.equal(G.boardKeys(s).length,85);assert.ok(!G.legalPlacements(s).includes('3,3'));}
});
test('AP自由分配，多次放地、不强制放地且AP0不自动换轮',()=>{
 const s=game();for(let i=0;i<3;i++)place(s);assert.equal(s.ap,0);assert.equal(s.round,1);assert.equal(s.placed,3);assert.equal(G.legalPlacements(s).length,0);assert.equal(G.act(s,{type:'reroll'}).ok,false);end(s);end(s);assert.equal(s.round,3);act(s,{type:'reroll'});assert.equal(s.ap,2);
});
test('普通大型逆结晶0/1/3AP免费、库存与上限拒绝',()=>{
 for(const option of [{},{big:true},{inverse:true}])for(const ap of [0,1,3])for(const {key:el}of D.ELEMENTS){const s=game();s.ap=ap;s.cells['2,2'].attrs=[0,0,0,0,0];const bag=option.inverse?s.inv.inverseCrystal:option.big?s.inv.bigCrystal:s.inv.crystal;bag[el]=2;for(let i=0;i<2;i++)act(s,{type:'useCrystal',cell:'2,2',el,...option});assert.equal(s.ap,ap);assert.equal(s.round,1);assert.equal(G.act(s,{type:'useCrystal',cell:'2,2',el,...option}).ok,false);if(!option.inverse){bag[el]=1;s.cells['2,2'].attrs[D.ELEMENTS.findIndex(e=>e.key===el)]=G.attrCap(s,'2,2');assert.equal(G.act(s,{type:'useCrystal',cell:'2,2',el,...option}).ok,false);}}
});
test('批量结晶封顶、共享库存与原子拒绝',()=>{
 const s=game();s.inv.crystal.wood=20;s.inv.bigCrystal.water=4;s.inv.inverseCrystal.fire=2;act(s,{type:'useCrystals',cell:'2,2',crystals:[{kind:'crystal',el:'wood',count:12},{kind:'bigCrystal',el:'water',count:2},{kind:'inverseCrystal',el:'fire',count:2}]});for(const crystals of [[],[{kind:'crystal',el:'wood',count:99}],[{kind:'crystal',el:'wood',count:1},{kind:'crystal',el:'wood',count:2}]])assert.equal(G.act(s,{type:'useCrystals',cell:'2,2',crystals}).ok,false);
});
test('升级补晶差额、大晶取整、批量方向和库存预检',()=>{
 const s=game();s.inv.crystal=Object.fromEntries(D.ELEMENTS.map(e=>[e.key,100]));s.inv.bigCrystal.water=3;act(s,{type:'upgrade',cell:'3,2',tileType:'woodland_t2'});act(s,{type:'upgradeBatch',upgrades:[{cell:'4,3',tileType:'mine_t2'},{cell:'3,4',tileType:'volcano_t2'}]});assert.equal(G.act(s,{type:'upgradeBatch',upgrades:[{cell:'4,3',tileType:'mine_a_t5'}]}).ok,false);assert.equal(G.act(s,{type:'upgradeBatch',upgrades:[{cell:'4,3',tileType:'mine_a_t3'},{cell:'4,3',tileType:'mine_b_t3'}]}).ok,false);const b=game();b.cells['3,2'].attrs=[0,2,0,0,2];b.inv.bigCrystal.water=1;act(b,{type:'upgrade',cell:'3,2',tileType:'woodland_t2'});assert.equal(b.cells['3,2'].attrs[2],2);
});
test('守护塔十条升级、混合支付与7级封顶',()=>{
 for(const feature of ['shelter','spring'])for(const {key:el}of D.ELEMENTS){const s=game();s.inv.crystal[el]=11;s.inv.bigCrystal[el]=600000;for(let level=1;level<7;level++)act(s,{type:'upgradeTower',feature,el});assert.equal(s.tower[feature][el],7);assert.equal(G.act(s,{type:'upgradeTower',feature,el}).ok,false);}
});
test('至纯晶扩魔法范围、可先施法与魔法轮锁',()=>{
 const s=game(6,{tutorial:true});act(s,{type:'tutorial'});act(s,{type:'tutorial',cell:'3,2'});act(s,{type:'cast',magic:'purify',cell:'3,2'});assert.equal(s.placed,0);assert.equal(G.act(s,{type:'cast',magic:'purify',cell:'3,2'}).ok,false);for(const m of D.MAGICS){s.inv.pureCrystal[m.element]++;act(s,{type:'usePureCrystal',magic:m.id});}end(s);s.unlockedMagics=D.MAGICS.map(m=>m.id);s.ap=9;for(const m of D.MAGICS.filter(m=>m.id!=='purify'))act(s,{type:'cast',magic:m.id,cell:'2,2'});
});
test('元素盾普通大型混合配比、部署与天候消耗',()=>{
 const s=game();s.inv.crystal.earth=5;s.inv.bigCrystal.earth=5;act(s,{type:'craftShield',crystals:{earth:5},bigCrystals:{earth:5}});act(s,{type:'deployShield',cell:'2,2',shieldId:s.inv.shields[0].id});s.round=4;s.nextEvent={id:'meteor',el:'earth'};end(s);
});
test('五兽自动合守护灵、滋养、重复移动与自动合兽',()=>{
 const s=game(7,{tutorial:true});s.ap=9;s.cells['2,2'].beasts=Array.from({length:10},(_,i)=>({id:1000+i,el:i%2?'wood':'water',age:0}));act(s,{type:'tutorial',skip:true});assert.equal(s.cells['2,2'].guardians.length,2);const guardianId=s.cells['2,2'].guardians[0].id;act(s,{type:'moveGuardian',from:'2,2',to:'2,3',guardianId});act(s,{type:'moveGuardian',from:'2,3',to:'2,2',guardianId});end(s);const t=s.cells['2,2'];t.attrs=[0,9,0,0,0];t.spirits=Array.from({length:7},(_,i)=>({id:2100+i,el:'wood',age:2}));end(s);
});
test('80地块定向四邻关系、植物动物自动生态',()=>{
 for(const def of D.TILE_TYPES){const s=game(),t=s.cells['2,2']=G.makeTile(def.id),relation=G.RELATIONS[def.family];s.cells['1,2']=G.makeTile(relation.targets[0]+'_t2');t.plants=[{id:31001,kind:'tree',age:2},{id:31002,kind:'crop',age:2}];t.animals=[{id:32001,kind:'fish',el:'water',age:0},{id:32002,kind:'rabbit',el:null,age:0}];t.cancers=[{id:33001,el:'wood',age:2}];end(s);end(s);}
});
test('6类天气、分期陨星伤害、塔庇护与至纯晶产出',()=>{
 for(const ev of D.NATURAL_EVENTS)for(const round of [4,12,24,40]){const s=game();s.mode='endless';s.round=round;s.nextEvent={id:ev.id,...(ev.id==='meteor'?{el:'earth'}:{})};s.tower.shelter.earth=2;end(s);}
});
test('铲除退晶、连续退化、全负消散与失败',()=>{
 const s=game();act(s,{type:'demolish',cell:'2,2'});assert.equal(s.inv.crystal.earth,3);s.cells['3,2']=G.makeTile('woodland_a_t5');s.cells['3,2'].attrs=[0,1,0,0,0];act(s,{type:'reroll'});assert.equal(s.cells['3,2'].type,'woodland_t1');for(const t of Object.values(s.cells))t.attrs=[-1,-1,-1,-1,-1];act(s,{type:'reroll'});assert.equal(s.result,'failed');assert.equal(Object.keys(s.cells).length,0);
});
test('阶段失败、40轮胜利、铺满后进入无尽与扩展',()=>{
 const failed=game();failed.round=10;end(failed);assert.equal(failed.result,'failed');const s=game();s.cells=Object.fromEntries(G.SHAPE.map(([x,y])=>G.key(x,y)).filter(k=>k!=='3,3').map(k=>[k,G.makeTile('grassland_t1')]));s.inv.crystal.earth=1;act(s,{type:'useCrystal',cell:'2,2',el:'earth'});assert.ok(s.completedMap);assert.equal(s.over,false);s.round=40;s.tower.spent=10000;end(s);assert.equal(s.result,'won');assert.ok(G.enterEndless(s).ok);const outside=G.legalPlacements(s).find(k=>!G.SHAPE_KEYS.has(k));assert.ok(outside);act(s,{type:'place',offer:0,cell:outside});end(s);
});
let fullGames=0;
test('同一原生State铲除重放、对象键顺序与连续保存恢复',()=>{
 const s=game(20261017,{mode:'endless'}),initial=clone(s);activeSequence=[];
 for(let turn=0;turn<16;turn++){
  act(s,{type:'demolish',cell:Object.keys(s.cells)[0]});
  while(s.ap>0)place(s);end(s);
 }
 const actions=activeSequence;activeSequence=null;
 fixtures.push({input:{op:'sequence',state:initial,actions},state:clone(s),score:G.score(s)});
 const saved=clone(s);saved.events=[];
 fixtures.push({input:{op:'sequence',state:initial,actions,roundtripEach:true},state:saved,score:G.score(s)});
});
test('挑战与无尽完整40/48轮、多个种子和教学',()=>{
 for(const [seed,mode,boost]of [[1,'challenge',false],[6,'challenge',false],[91,'challenge',true],[20261017,'challenge',true],[12,'endless',false],[24,'endless',false]]){const s=game(seed,{mode,tutorial:seed===6});if(boost)s.tower.spent=10000;const initial=clone(s);activeSequence=[];while(!s.over&&s.round<=48){while(s.ap>0){const legal=G.legalPlacements(s);if(!legal.length)break;act(s,{type:'place',offer:s.round%3,cell:legal[(s.round*7+seed)%legal.length]});}if(!s.over)end(s);}const actions=activeSequence;activeSequence=null;fixtures.push({input:{op:'sequence',state:initial,actions},state:clone(s),score:G.score(s)});const saved=clone(s);saved.events=[];fixtures.push({input:{op:'sequence',state:initial,actions,roundtripEach:true},state:saved,score:G.score(s)});if(mode==='challenge')assert.equal(s.result,boost?'won':'failed');else assert.equal(s.round,49);fullGames++;}
});
test('当前schema存档和原生JSON往返、损坏schema拒绝',()=>{
 const samples=fixtures.filter((_,i)=>i%43===0).map(f=>clone(f.state));for(const state of samples){const expected=G.restore(JSON.stringify({version:1,state}));assert.ok(expected);fixtures.push({input:{op:'roundtrip',state},state:clone(expected),score:G.score(expected)});fixtures.push({input:{op:'restore',raw:JSON.stringify({version:1,state})},state:clone(expected),score:G.score(expected)});}for(const raw of ['{','{}','{"version":99,"state":{}}','{"version":1,"state":{"edition":"v13"}}'])fixtures.push({input:{op:'restore',raw},state:null,score:null});
});
function compare(expected,actual,at){if(expected===null||typeof expected!=='object'){assert.equal(actual,expected,at);return;}assert.ok(actual!=null,at+' is missing');if(Array.isArray(expected)){assert.ok(Array.isArray(actual),at+' array');assert.equal(actual.length,expected.length,at+'.length');expected.forEach((v,i)=>compare(v,actual[i],at+'['+i+']'));return;}for(const [k,v]of Object.entries(expected))compare(v,actual[k],at+'.'+k);for(const [k,v]of Object.entries(actual))if(!(k in expected)){const empty=v==null||v===0||v===false||(Array.isArray(v)&&v.length===0)||(typeof v==='object'&&Object.keys(v).length===0);assert.ok(empty,at+'.'+k+' unexpected value '+JSON.stringify(v));}}
const build=spawnSync('dotnet',['build','tools/UnityRulesCheck/UnityRulesCheck.csproj','--nologo','-v:q','--ignore-failed-sources'],{cwd:root,encoding:'utf8'});if(build.status!==0){process.stderr.write(build.stdout+build.stderr);process.exit(1);}
const dll=path.join(root,'artifacts','unity-rules','bin','net9.0','UnityRulesCheck.dll'),run=spawnSync('dotnet',[dll],{cwd:root,input:fixtures.map(f=>JSON.stringify(f.input)).join('\n')+'\n',encoding:'utf8',maxBuffer:256*1024*1024});if(run.status!==0)throw new Error(run.stderr);
const lines=run.stdout.trim().split(/\r?\n/);assert.equal(lines.length,fixtures.length,'native fixture response count');let failed=0;
for(let i=0;i<fixtures.length;i++){const f=fixtures[i],actual=JSON.parse(lines[i]);try{assert.ok(!actual.error,actual.error);compare(f.state,actual.state,'state');compare(f.score,actual.score,'score');if(f.result)compare(f.result,actual.result,'result');}catch(e){failed++;if(failed<=8){console.error('Native parity case '+i+' ('+(f.input.action?.type||f.input.op)+'): '+e.message);fs.writeFileSync(path.join(out,'failure-'+i+'.json'),JSON.stringify({fixture:f,actual},null,2));}}}
const report={reference:'migration/web-reference',fixtures:fixtures.length,failed,directedGroups:cases.length,fullGames,cases,checked:'every published state field, score, receipts, results, events and RNG; native extra nondefault values rejected'};fs.writeFileSync(path.join(out,'parity-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failed)process.exitCode=1;
