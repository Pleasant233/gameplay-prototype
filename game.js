// 确定性规则引擎：所有规则与进度都在这里；DOM、存储、动画在表现层。
(function (root) {
  const D = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.GameData;
  const { TILE_TYPES, RULES, SCORE } = D;
  const EL = D.ELEMENTS.map(e => e.key);
  const TYPE = Object.fromEntries(TILE_TYPES.map(t => [t.id, t]));
  const sum = a => a.reduce((x, y) => x + y, 0);
  const tier = t => t.level;
  const animalCap = () => Infinity;
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
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].map(([a, b]) => key(a, b));
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
  const boardKeys = s => s.mode==='endless' ? [...new Set([...SHAPE_KEYS,...placedKeys(s),...placedKeys(s).flatMap(neighbors)])] : [...SHAPE_KEYS];
  const emptyKeys = s => boardKeys(s).filter(k => !s.cells[k]);
  const spiritCap = t => Math.max(0, sum(t.attrs)) + (t.shelter ? 4 : 0);
  const cancerCap = t => -sum(t.attrs.filter(v => v < 0));
  const legalPlacements = s => s.ap < 1 || s.over ? [] : emptyKeys(s).filter(k => neighbors(k).some(n => s.cells[n]));
  const globalAttrs = s => EL.map((_, i) => sum(Object.values(s.cells).map(t => t.attrs[i])));
  const totalAttrs = s => sum(globalAttrs(s));
  const hasWater = t => t.attrs[2] > 0 && (t.spring || t.pond || TYPE[t.type].tag.split(/[；、，]/).includes("水域"));
  const isFarm = t => t.farm || TYPE[t.type].tag.includes("可耕地");
  function makeTile(typeId) {
    return { type: typeId, attrs: TYPE[typeId].attrs.slice(), spirits: [], cancers: [], beasts: [], guardians: [], plants: [], animals: [], spring: false, pond: false, farm: false, shelter: false, oasis: false };
  }
  function cluster(s, cell) {
    if (!s.cells[cell]) return [];
    const found = new Set([cell]), todo = [cell], type = s.cells[cell].type;
    for (let i = 0; i < todo.length; i++) for (const n of neighbors(todo[i])) {
      if (!found.has(n) && s.cells[n] && TYPE[s.cells[n].type].family === TYPE[type].family) { found.add(n); todo.push(n); }
    }
    return todo;
  }
  const attrCap = (s, cell) => RULES.attrMax + RULES.clusterBonus * (cluster(s, cell).length - 1);
  function addAttr(s, cell, i, n) { s.cells[cell].attrs[i] = Math.min(attrCap(s, cell), s.cells[cell].attrs[i] + n); }
  function trimSpirits(s) { for (const t of Object.values(s.cells)) t.spirits.length = Math.min(t.spirits.length, spiritCap(t)); }
  function capTerrain(s) { for (const k of placedKeys(s)) s.cells[k].attrs = s.cells[k].attrs.map(v => Math.min(attrCap(s, k), v)); trimSpirits(s); }
  function upgrades(s, cell) {
    const t = s.cells[cell];
    if (!t) return [];
    return TILE_TYPES.filter(ty => ty.parent===t.type && upgradeReasons(s,cell,ty).length===0);
  }
  function upgradeReasons(s,cell,ty){
    const t=s.cells[cell], reasons=[];
    const cost=upgradeCost(s,cell,ty);
    EL.forEach((e,i)=>{if(cost.normal[e]>s.inv.crystal[e]||cost.big[e]>s.inv.bigCrystal[e])reasons.push(D.ELEMENTS[i].name+'结晶不足（缺属性 '+cost.deficit[i]+'）');if(ty.attrs[i]>attrCap(s,cell))reasons.push(D.ELEMENTS[i].name+'需求超过连片上限');});
    if(cluster(s,cell).length<ty.requiredN)reasons.push('同系列需'+ty.requiredN+'格');
    if(ty.level>=4 && !(s.stats.merges>0))reasons.push('先合成元素兽');
    if(ty.level===5 && !placedKeys(s).some(k=>(s.cells[k].guardians||[]).length && guardianArea(s,k).includes(cell)))reasons.push('需守护灵覆盖');
    return reasons;
  }
  function upgradeCost(s,cell,ty){
    const deficit=ty.attrs.map((v,i)=>Math.max(0,v-s.cells[cell].attrs[i]));
    const normal=emptyEl(),big=emptyEl();
    EL.forEach((e,i)=>{normal[e]=Math.min(deficit[i],s.inv.crystal[e]);big[e]=Math.ceil((deficit[i]-normal[e])/2);});
    return {deficit,normal,big};
  }
  const checkpoint = s => RULES.stageTargets.find(t=>t.round>=s.round);
  const restoration = s => Math.min(1,Math.max(0,score(s).total)/RULES.stageTargets.at(-1).score);
  const meteorStrength = s => ({damage:1+2*Math.ceil(s.round/RULES.meteorEvery),count:Math.max(1,Math.floor(placedKeys(s).length*Math.min(.7,.25+.05*Math.ceil(s.round/RULES.meteorEvery))))});
  const magicArea = (s,cell,magic) => region(s,cell,s.magicRange[magic]);
  function autoGuardians(s){
    for(const cell of placedKeys(s))while(s.cells[cell].beasts.length>=RULES.guardianMergeCount){
      handlers.mergeGuardian(s,{cell,beastIds:s.cells[cell].beasts.slice(0,RULES.guardianMergeCount).map(b=>b.id)});
      unlockMemory(s,'guardian');
    }
  }
  function degrade(s){
    for(const cell of placedKeys(s)){
      const t=s.cells[cell];
      if(t.attrs.every(v=>v<0)){delete s.cells[cell];emit(s,{cell,kind:'vanish'});log(s,'地块全属性为负，消散：'+cell);continue;}
      let def=TYPE[t.type];
      while(def.parent && def.attrs.some((v,i)=>v>0&&t.attrs[i]<v))def=TYPE[def.parent];
      if(def.id!==t.type){t.type=def.id;emit(s,{cell,kind:'degrade'});log(s,'地形退化为'+def.name);}
    }
    capTerrain(s);
  }
  // Directed four-neighbor relationships; every family has a partner, all 80 nodes inherit it.
  const RELATIONS = {
    desert: {targets:['ocean','river'],el:'water',name:'水源润沙'},
    woodland: {targets:['wetland','river'],el:'wood',name:'活水育林'},
    ice: {targets:['volcano'],el:'water',name:'地热融雪'},
    ocean: {targets:['ice','river'],el:'water',name:'汇流入海'},
    grassland: {targets:['woodland','river'],el:'earth',name:'林岸沃野'},
    wetland: {targets:['ocean','grassland'],el:'wood',name:'水草净泽'},
    river: {targets:['ice','woodland'],el:'water',name:'涵养溪流'},
    mine: {targets:['volcano','ice'],el:'metal',name:'冷热凝脉'},
    volcano: {targets:['mine','desert'],el:'fire',name:'岩砂蓄火'},
    ruins: {targets:['mine','woodland'],el:'earth',name:'林岩护址'}
  };
  function tileRelations(s,cell){
    const t=s.cells[cell],rule=RELATIONS[TYPE[t.type].family];
    return rule?neighbors(cell).filter(k=>s.cells[k]&&rule.targets.includes(TYPE[s.cells[k].type].family)).map(k=>({...rule,neighbor:k,n:Math.max(1,tier(TYPE[t.type])-2)})):[];
  }
  function settleRelations(s){
    for(const cell of placedKeys(s))for(const r of tileRelations(s,cell)){
      const i=EL.indexOf(r.el),before=s.cells[cell].attrs[i];addAttr(s,cell,i,r.n);
      const n=s.cells[cell].attrs[i]-before;if(n)emit(s,{cell,kind:'relation',el:r.el,n,neighbor:r.neighbor});
    }
  }
  function supplyLevel(s){return s.progress && s.progress.t3 && s.stats.merges>0 ? 3 : s.progress && (s.progress.t2 || s.progress.natural>=5) ? 2 : 1;}
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
  function offerPool(s) {return TILE_TYPES.filter(t=>t.level<=supplyLevel(s)&&t.level<=3);}
  function rollOffers(s, unrestricted = false) {
    const pool=offerPool(s,unrestricted);
    const groups=shuffle(s,placedKeys(s)).sort((a,b)=>cluster(s,b).length-cluster(s,a).length),family=TYPE[s.cells[groups[0]].type].family;
    const first=pool.find(t=>t.family===family && t.level===Math.min(2,supplyLevel(s))) || pool[0];
    const others=pool.filter(t=>t.family!==first.family && t.level===supplyLevel(s));
    const second=pick(s,others.length?others:pool.filter(t=>t.id!==first.id));
    const third=pick(s,pool.filter(t=>t.id!==first.id&&t.id!==second.id));s.offers=[first.id,second.id,third.id];
    if(s.journey && !s.journey.skipped && s.round===1)s.offers=['mine_t1','woodland_t1','ocean_t1'];
    if(s.journey && !s.journey.skipped && s.round===3 && supplyLevel(s)>=2 && !s.offers.includes('woodland_t2'))s.offers[1]='woodland_t2';
  }
  function newGame(seed, options = {}) {
    const s = {
      mode: options.mode==='endless'?'endless':'challenge',magicRange:Object.fromEntries(D.MAGICS.map(m=>[m.id,1])),completedMap:false,result:null,
      edition: 'v13', progress:{t2:false,t3:false,natural:0},
      seed: seed >>> 0, rng: seed | 0, round: 1, ap: RULES.apPerRound, roundAP: RULES.apPerRound,
      placed: 0, unlockedMagics: ['purify'], magicUsed: {}, interactionUsed: {}, offers: [], cells: {}, nextId: 1,
      inv: { crystal: emptyEl(), bigCrystal: emptyEl(), inverseCrystal: emptyEl(), pureCrystal:emptyEl(), shields: [] },
      shields: [],
      log: [], events: [], over: false, peakScore: 0, stats: {}, achievements: [], visions: [], lastMeteor: null,
    };
    const types=['grassland_t2','ocean_t1','mine_t1','woodland_t1','volcano_t1'];
    if(options.tutorial){s.journey={step:0,skipped:false,memories:[],done:[],read:[],waterUses:0,version:1,grants:{water:true}};s.inv.crystal.water=3;}
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
  function canPurify(s, cell) { return magicArea(s,cell,'purify').some(k=>s.cells[k]&&(s.cells[k].attrs.some(v=>v<0)||s.cells[k].cancers.length)); }
  function metrics(s) {
    const ts = Object.values(s.cells);
    return { ...s.stats, tiles: ts.length, cluster: Math.max(0,...placedKeys(s).map(k => cluster(s, k).length)),
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
    for (const k of area) {
      const t = s.cells[k]; if (!t) continue;
      if (t.attrs.some(v => v < 0) || t.cancers.length) countStat(s, 'purified');
      t.attrs = t.attrs.map(v => v < 0 ? Math.min(attrCap(s, k), v + 5) : v);
      t.cancers = []; emit(s, { cell: k, kind: 'purify' });
    }
  }
  const nearby = (s, a, b) => !!s.cells[a] && !!s.cells[b] && neighbors(a).includes(b);
  const guardianArea = (s, cell) => s.cells[cell] ? [cell, ...neighbors(cell).filter(k => s.cells[k])] : [];
  function unlockMemory(s,key){
    s.story ||= {memories:[],read:[]};
    if(!s.story.memories.includes(key)){s.story.memories.push(key);emit(s,{cell:'3,3',kind:'memory',memory:key});}
  }
  function journeyAction(s,a){
    if(a.type==='cast')unlockMemory(s,a.magic);
    if(a.type==='merge')unlockMemory(s,'beast');
    if(a.type==='mergeGuardian')unlockMemory(s,'guardian');
    const j=s.journey;if(!j || j.skipped)return;
    const step=j.step;
    if(step===2 && a.type==='place')j.step=3;
    if(step===3 && a.type==='cast' && a.magic==='purify')j.step=4;
    if(step===5 && a.type==='upgrade' && TYPE[s.cells[a.cell].type].level===2)j.step=6;
    if(step===6 && a.type==='useCrystal'){if(j.useRound!==s.round){j.useRound=s.round;j.waterUses=0;}j.waterUses++;if(j.waterUses>=2)j.step=7;}
    if(step===7 && s.round>=3 && a.type==='place')j.step=8;
    if(!j.done.includes(a.type))j.done.push(a.type);
  }
  function journeyRound(s){
    if(s.events.some(e=>e.kind==='crystal'))unlockMemory(s,'crystal');
    if(s.events.some(e=>e.kind==='plant'||e.kind==='animal'))unlockMemory(s,'life');
    if(s.events.some(e=>e.kind==='meteor'))unlockMemory(s,'meteor');
    const j=s.journey;if(!j||j.skipped)return;
    if(j.step===4)j.step=5;
    if(s.round>=8 && !j.grants.shield){
      j.grants.shield=true;
      if(![...s.shields,...s.inv.shields].some(sh=>sh.defense.earth>=3)){
        const n=Math.max(0,5-s.inv.crystal.earth);s.inv.crystal.earth+=n;
        if(n){emit(s,{cell:'3,3',kind:'item',n});log(s,'教学补给：普通土晶补足5颗，准备第10轮土陨石雨');}
      }
    }
  }
  function interactionKeys(s, a) {
    const t = s.cells[a.cell || a.from];
    if (a.type === 'moveSpirit') return ['spirit:' + a.spiritId];
    if (a.type === 'moveBeast') return ['beast:' + a.beastId];
    if (a.type === 'merge' && t) return t.spirits.filter(sp => sp.el === a.el && !s.interactionUsed['spirit:' + sp.id]).slice(0, 3).map(sp => 'spirit:' + sp.id);
    if (a.type === 'deployShield') return ['shield:' + a.shieldId];
    if (a.type === 'craftShield') return ['craft:shield'];
    return [];
  }
  const handlers = {
    tutorial(s,a){
      if(!s.journey)return fail('未开启操作教学');
      if(a.skip){s.journey.skipped=true;return success('已跳过操作教学，回声仍可解锁');}
      if(a.read){if(!s.journey.read.includes(a.read))s.journey.read.push(a.read);return success('收录回声');}
      if(s.journey.step===0)s.journey.step=1;
      else if(s.journey.step===1 && a.cell==='3,2')s.journey.step=2;
      return success('继续旅程');
    },
    place(s, a) {
      const typeId = s.offers[a.offer];
      if (!typeId || !Number.isInteger(a.offer)) return fail('无效的待选地块');
      if (!legalPlacements(s).includes(a.cell)) return fail('只能放在已有地块相邻的空位');
      s.cells[a.cell] = makeTile(typeId); s.placed++; rollOffers(s);
      countStat(s, 'placements'); emit(s, { cell: a.cell, kind: 'place' });
      return success(`放置 ${TYPE[typeId].name}`);
    },
    cast(s, a) {
      const t = s.cells[a.cell], m = D.MAGICS.find(m => m.id === a.magic);
      if (!t || !m) return fail('需要选择地块和有效魔法');
      if (!magicUnlocked(s, a.magic)) return fail(`全图${elName(m.unlock)}属性须达到 20`);
      if (s.magicUsed[a.magic]) return fail('每种魔法每轮只能施放一次');
      const area=magicArea(s,a.cell,a.magic);
      if(a.magic==='purify'){
        if(!canPurify(s,a.cell))return fail('覆盖区域没有污染或癌元');
        purify(s,a.cell,area);
      }else for(const cell of area){
        const target=s.cells[cell];
        if(a.magic==='mine')addAttr(s,cell,0,5);
        else if(a.magic==='spring'){target.spring=true;addAttr(s,cell,2,5);}
        else if(a.magic==='rich'){target.farm=true;addAttr(s,cell,4,5);}
        else {target.attrs[1]=target.attrs[2]=0;addAttr(s,cell,3,5);target.cancers=[];target.plants=[];target.animals=target.animals.filter(v=>v.kind!=='fish');target.spirits=target.spirits.filter(sp=>sp.el!=='wood'&&sp.el!=='water');target.spring=target.pond=false;}
        emit(s,{cell,kind:'spell',magic:a.magic,el:m.element});
      }
      s.magicUsed[a.magic] = true;
      return success(`施放${m.name}魔法`);
    },
    upgrade(s, a) {
      const ty = upgrades(s, a.cell).find(t => t.id === a.tileType);
      if (!ty) return fail('结晶或升级条件不足');
      const cost=upgradeCost(s,a.cell,ty);
      EL.forEach((el,i)=>{s.inv.crystal[el]-=cost.normal[el];s.inv.bigCrystal[el]-=cost.big[el];addAttr(s,a.cell,i,cost.normal[el]+2*cost.big[el]);});
      const oldLevel=TYPE[s.cells[a.cell].type].level;
      if(s.progress){if(oldLevel===1&&ty.level===2)s.progress.t2=true;if(oldLevel===2&&ty.level===3)s.progress.t3=true;}
      s.cells[a.cell].type = ty.id; s.cells[a.cell].oasis = false; capTerrain(s);
      countStat(s, 'upgrades'); emit(s, { cell: a.cell, kind: 'upgrade' });
      return success(`升级为${ty.name}`);
    },
    reroll(s) {rollOffers(s,true);countStat(s,'rerolls');return success('刷新地块 · 消耗 1 行动点');},
    usePureCrystal(s,a){
      const m=D.MAGICS.find(m=>m.id===a.magic);
      if(!m)return fail('请选择魔法');
      if(s.magicRange[m.id]>=5)return fail('魔法覆盖已达到 5 格');
      if(s.inv.pureCrystal[m.element]<1)return fail('没有对应至纯元素结晶');
      s.inv.pureCrystal[m.element]--;s.magicRange[m.id]++;
      emit(s,{cell:a.cell||'3,3',kind:'range',magic:m.id});
      return success(m.name+'覆盖提升到 '+s.magicRange[m.id]+' 格');
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
    mergeGuardian(s, a) {
      const t = s.cells[a.cell], ids = a.beastIds;
      if (!t || !Array.isArray(ids) || ids.length !== RULES.guardianMergeCount || new Set(ids).size !== ids.length) return fail('请选择同一地块的 5 个不同元素兽');
      const beasts = ids.map(i => t.beasts.find(b => b.id === i));
      if (beasts.some(b => !b || !EL.includes(b.el))) return fail('元素兽不在该地块');
      const power = emptyEl(); beasts.forEach(b => power[b.el]++);
      t.beasts = t.beasts.filter(b => !ids.includes(b.id));
      const guardian = { id: id(s), power }; (t.guardians || (t.guardians = [])).push(guardian);
      countStat(s, 'guardians'); emit(s, { cell: a.cell, kind: 'guardianMerge', guardianId: guardian.id, power: { ...power } });
      return success('合成守护灵：' + EL.filter(e => power[e]).map(e => elName(e) + '×' + power[e]).join(' '));
    },
    moveGuardian(s, a) {
      if (!nearby(s, a.from, a.to)) return fail('守护灵只能移到四邻已放置地块');
      const from = s.cells[a.from], i = (from.guardians || []).findIndex(g => g.id === a.guardianId);
      if (i < 0) return fail('找不到该守护灵');
      const to = s.cells[a.to]; (to.guardians || (to.guardians = [])).push(from.guardians.splice(i, 1)[0]);
      emit(s, { cell: a.to, from: a.from, kind: 'guardianMove', guardianId: a.guardianId });
      return success('移动守护灵 · 消耗 1 行动点');
    },
    merge(s, a) {
      const t = s.cells[a.cell]; if (!t || !EL.includes(a.el)) return fail('无效地块或元素');
      const same = t.spirits.filter(x => x.el === a.el && !s.interactionUsed['spirit:' + x.id]);
      if (same.length < 3) return fail('需要 3 个本轮未交互的同元素灵');
      const used = new Set(same.slice(0, 3).map(x => x.id));
      t.spirits = t.spirits.filter(x => !used.has(x.id)); t.beasts.push({ id: id(s), el: a.el, age: 0 });
      countStat(s, 'merges'); return success(`合成${elName(a.el)}元素兽`);
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
  function reconcile(s, before, cell, eventStart = 0) {
    const actual = score(s).total - before, accounted = sum(s.events.slice(eventStart).map(e => e.score || 0));
    if (actual !== accounted) emit(s, { cell: cell || '3,3', kind: 'attr', n: actual - accounted, score: actual - accounted });
  }
  function act(s, action) {
    s.events = [];
    if (!action || !handlers[action.type]) return fail('未知行动');
    if (s.over) return fail('游戏已结束');
    const cost = ['place', 'cast', 'moveGuardian','reroll'].includes(action.type) ? 1 : 0;
    if (s.ap < cost) return fail('行动点不足');
    const used = interactionKeys(s, action);
    if (used.some(k => s.interactionUsed[k])) return fail('该生物或物品本轮已交互');
    const before = score(s).total, beforeBag = bagCount(s);
    const r = handlers[action.type](s, action); if (!r.ok) return r;
    used.forEach(k => { s.interactionUsed[k] = true; }); s.ap -= cost;
    journeyAction(s,action);autoGuardians(s);degrade(s);
    trimSpirits(s); updateProgress(s); log(s, r.msg);
    const cell = action.cell || action.to || action.from || '3,3';
    const bagDelta = bagCount(s) - beforeBag;
    const bagAccounted = sum(s.events.filter(e => ['crystal', 'bigCrystal', 'inverseCrystal','pureCrystal', 'item'].includes(e.kind)).map(e => e.n || 1));
    if (bagDelta > bagAccounted) emit(s, { cell, kind: 'item', n: bagDelta - bagAccounted });
    reconcile(s, before, cell);
    checkMap(s);
    if(!placedKeys(s).length)finish(s,'failed','所有地块已消散');
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
    const teaching=s.journey&&!s.journey.skipped&&s.round===10;
    const element = teaching?'earth':pick(s, EL), cells = region(s, teaching?'3,3':pick(s, placedKeys(s)), meteorStrength(s).count);
    const strength=meteorStrength(s);
    let blocked = 0;
    for (const cell of cells) {
      let damage = strength.damage;
      for (const shield of s.shields) if (shield.cells.includes(cell)) {
        const n = Math.min(damage, shield.defense[element]); shield.defense[element] -= n; damage -= n; blocked += n;
        if (n) emit(s, { cell, kind: 'shield', el: element });
      }
      if (damage) addAttr(s, cell, EL.indexOf(element), -damage);
      emit(s, { cell, kind: 'meteor', el: element, damage, strength:strength.damage });
    }
    s.shields = s.shields.filter(sh => sum(Object.values(sh.defense)) > 0);
    if (blocked) countStat(s, 'blocked');
    s.lastMeteor = { round: s.round, el: element, cells, blocked,damage:strength.damage };
    s.inv.pureCrystal[element]++;emit(s,{cell:cells[0],kind:'pureCrystal',el:element,n:1});
    log(s, `${elName(element)}陨石雨影响 ${cells.length} 格，元素盾抵挡 ${blocked} 点`);
  }
  // Settle after production, migration and disasters; newborn beasts act next round.
  function autoMergeSpirits(s) {
    for (const cell of placedKeys(s)) for (const el of EL) {
      let n = 0;
      while (handlers.merge(s, {cell, el}).ok) n++;
      if (n) {
        journeyAction(s, {type:'merge', cell, el});
        emit(s, {kind:'autoMerge', cell, el, n});
        log(s, `自动合成${elName(el)}元素兽 ×${n}`);
      }
    }
  }
  function endRound(s) {
    if (s.over) return fail('游戏已结束');
    const before = score(s).total, keys = placedKeys(s), eventStart = s.events.length;
    autoGuardians(s);settleRelations(s);
    // Guardians remain attached: settle each at its current location exactly once.
    // Apply the aura before natural spawning so every tile sees its final boost.
    for (const k of keys) for (const guardian of s.cells[k].guardians || []) {
      const targets = guardianArea(s, k), gains = [];
      for (const target of targets) EL.forEach((el, i) => {
        const power = guardian.power[el] || 0; if (!power) return;
        const previous = s.cells[target].attrs[i]; addAttr(s, target, i, power);
        const n = s.cells[target].attrs[i] - previous;
        if (n) { emit(s, { cell: target, kind: 'attr', el, n, score: n }); gains.push({ cell: target, el, n }); }
      });
      emit(s, { cell: k, kind: 'guardian', guardianId: guardian.id, power: { ...guardian.power }, targets, gains });
    }
    for (const k of keys) {
      const t = s.cells[k];
      const pos = EL.map((e, i) => [e, Math.max(0, t.attrs[i])]).filter(p => p[1]);
      if (pos.length && t.spirits.length < spiritCap(t)) { const el = pickWeighted(s, pos); t.spirits.push({ id: id(s), el, age: 0 }); emit(s, { cell: k, kind: 'spirit', el }); }
      const neg = EL.map((e, i) => [e, Math.max(0, -t.attrs[i])]).filter(p => p[1]);
      if (neg.length && t.cancers.length < cancerCap(t)) { const el = pickWeighted(s, neg); t.cancers.push({ id: id(s), el, age: 0 }); emit(s, { cell: k, kind: 'cancer', el }); }
      for (const sp of t.spirits) if (++sp.age % 3 === 0) { s.inv.crystal[sp.el]++; if(s.progress)s.progress.natural++; emit(s, { cell: k, kind: 'crystal', el: sp.el }); }
      for (const b of t.beasts) if (++b.age % 2 === 0) { s.inv.bigCrystal[b.el]++; emit(s, { cell: k, kind: 'bigCrystal', el: b.el }); }
      for (const c of t.cancers) if (++c.age % 3 === 0 && t.attrs[EL.indexOf(c.el)] !== 0) {
        addAttr(s, k, EL.indexOf(c.el), -1); s.inv.inverseCrystal[c.el]++; emit(s, { cell: k, kind: 'inverseCrystal', el: c.el });
      }
      for (const a of t.animals) {
        if (a.el) { a.age=(a.age||0)+1; const i=EL.indexOf(a.el);if(i>=0)addAttr(s,k,i,1); }
        else if (rand(s)<.35) {
          const available=EL.filter((el,i)=>t.attrs[i]>0);
          if(available.length){a.el=pick(s,available);a.age=0;countStat(s,'feeds');emit(s,{cell:k,kind:'animalAwaken',el:a.el});}
        }
      }

      for(const p of t.plants){
        p.age=(p.age||0)+1;if(p.age%3)continue;
        const i=['tree','shrub'].includes(p.kind)?1:p.kind==='weed'?2:4;
        addAttr(s,k,i,1);
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
      if (plants.length && t.plants.length < RULES.maxPlants && rand(s) < RULES.spawnChance) { const kind = pick(s,plants); t.plants.push({ id: id(s), kind }); emit(s, { cell: k, kind: 'plant', plant: kind }); }
      if (animals.length && t.animals.length < animalCap(t) && rand(s) < RULES.spawnChance) { const kind = pick(s,animals); t.animals.push({ id: id(s), kind, el: null, cd: 0, age: 0 }); emit(s, { cell: k, kind: 'animal', animal: kind }); }
      for (const predator of t.animals.slice()) {
        const preyKinds = { bird: ['fish'], bear: ['rabbit', 'fish'], leopard: ['deer'] }[predator.kind];
        const prey = preyKinds && t.animals.find(a => a !== predator && preyKinds.includes(a.kind));
        if (prey) { t.animals = t.animals.filter(a => a !== prey); emit(s, { cell: k, kind: 'predation' }); }
      }
    }
    if (s.round % RULES.meteorEvery === 0) meteor(s);
    degrade(s);trimSpirits(s); autoMergeSpirits(s);autoGuardians(s);checkMap(s);
    journeyRound(s);
    trimSpirits(s); updateProgress(s); reconcile(s, before, '3,3', eventStart);
    const receipts = s.events.filter(e => ['crystal', 'bigCrystal', 'inverseCrystal','pureCrystal', 'item'].includes(e.kind));
    if (receipts.length) log(s, `获得：${receipts.length} 份元素结晶`);
    log(s, `第 ${s.round} 轮结束，灵力值 ${score(s).total}`);
    if(!placedKeys(s).length){finish(s,'failed','所有地块已消散');return success('游戏结束');}
    const goal=checkpoint(s);
    if(s.mode==='challenge'&&goal&&s.round===goal.round){
      if(score(s).total<goal.score){finish(s,'failed',`第 ${goal.round} 轮目标 ${goal.score}，当前灵力 ${score(s).total}`);return success('阶段挑战失败');}
      emit(s,{cell:'3,3',kind:'stageClear',round:s.round});
    }
    if(s.mode==='challenge'&&s.round>=RULES.maxRounds){finish(s,'won','完成 40 轮复苏挑战');return success('挑战完成');}
    s.round++; s.roundAP = apLimit(s); s.ap = s.roundAP; s.placed = 0; s.magicUsed = {}; s.interactionUsed = {}; rollOffers(s);
    return success('新一轮');
  }
  function bagCount(s) {return ['crystal','bigCrystal','inverseCrystal','pureCrystal'].reduce((n,k)=>n+sum(Object.values(s.inv[k])),s.inv.shields.length);}
  function checkMap(s){if(!s.completedMap&&SHAPE.every(([x,y])=>s.cells[key(x,y)])){s.completedMap=true;unlockMemory(s,'ending');emit(s,{cell:'3,3',kind:'mapComplete'});log(s,'初始地图铺满，可保存、摄影、检视或转入无尽模式');}}
  function finish(s,result,reason){s.over=true;s.result=result;s.endReason=reason;log(s,reason);}
  function enterEndless(s){
    if(!s.completedMap||s.result==='failed')return fail('需要先完成初始地图');
    if(s.result==='won'){s.round++;s.roundAP=apLimit(s);s.ap=s.roundAP;s.placed=0;s.magicUsed={};s.interactionUsed={};rollOffers(s);}
    s.mode='endless';s.over=false;s.result=null;delete s.endReason;return success('进入无尽模式');
  }
  function endRoundPublic(s) { s.events = []; return endRound(s); }
  function restore(raw){
    try{
      const v=JSON.parse(raw),s=v.state;if(v.version!==1||!s||s.edition!=='v13'||!s.cells||!s.inv||!s.progress||!s.stats||!Array.isArray(s.offers)||!Array.isArray(s.shields)||!Array.isArray(s.visions))return null;
      if(!Number.isInteger(s.round)||s.round<1||!Number.isInteger(s.ap)||s.ap<0||!Number.isInteger(s.nextId)||!Number.isFinite(s.rng))return null;
      const keys=Object.keys(s.cells);if((keys.length===0&&s.result!=='failed')||keys.some(k=>!/^[-]?\d+,[-]?\d+$/.test(k)||(s.mode!=='endless'&&!SHAPE_KEYS.has(k))))return null;
      for(const t of Object.values(s.cells))if(!TYPE[t.type]||!Array.isArray(t.attrs)||t.attrs.length!==5||t.attrs.some(n=>!Number.isFinite(n))||['spirits','cancers','beasts','guardians','animals','plants'].some(k=>!Array.isArray(t[k])))return null;
      if(s.offers.some(k=>!TYPE[k])||['crystal','bigCrystal','inverseCrystal'].some(k=>!s.inv[k]||EL.some(e=>!Number.isInteger(s.inv[k][e])||s.inv[k][e]<0)))return null;
      if(!s.unlockedMagics||!s.interactionUsed||!s.magicUsed||!Array.isArray(s.log)||!Array.isArray(s.achievements))return null;
      s.mode ||= s.round>RULES.maxRounds?'endless':'challenge';s.magicRange ||= Object.fromEntries(D.MAGICS.map(m=>[m.id,1]));s.inv.pureCrystal ||= emptyEl();
      for(const k of ['ore','wood','bucket','bucketFull','water','charm'])delete s.inv[k];
      for(const t of Object.values(s.cells)){delete t.ores;delete t.vein;}
      for(const shield of [...s.shields,...s.inv.shields])delete shield.initialDefense;
      if(D.MAGICS.some(m=>!Number.isInteger(s.magicRange[m.id])||s.magicRange[m.id]<1||s.magicRange[m.id]>5)||EL.some(e=>!Number.isInteger(s.inv.pureCrystal[e])||s.inv.pureCrystal[e]<0))return null;
      s.completedMap ||= SHAPE.every(([x,y])=>s.cells[key(x,y)]);
      if(s.over&&!s.result&&s.completedMap){s.result='won';s.endReason='初始地图已铺满，可继续无尽模式';}
      s.events=[];return s;
    }catch(_){return null;}
  }
  const Game = { boardKeys, checkpoint,restoration,meteorStrength,magicArea,upgradeCost,tileRelations,RELATIONS,enterEndless,restore, supplyLevel, upgradeReasons, animalCap, newGame, act, endRound: endRoundPublic, legalPlacements, neighbors, score, spiritCap, cancerCap, attrCap, cluster, region, guardianArea, upgrades, globalAttrs, magicUnlocked, canPurify, stage, apLimit, eligiblePlants, eligibleAnimals, hasWater, bagCount, metrics, SHAPE, SHAPE_KEYS, BOUNDS, key, parse, TYPE, emptyKeys, makeTile };
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
  else root.Game = Game;
})(this);
