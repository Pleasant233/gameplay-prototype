// Presentation only: successful engine actions own all tutorial progression and resources.
const MEMORIES={
 purify:['第一道回声','“先让腐化停下来。”\n你听见一声很轻的“老师”。土地似乎比你更早记得。'],
 mine:['还它一座山','“大地会疼吗？”\n你忽然记起回答：“所以我们要记得还它一座山。”'],
 spring:['河床的歌','你想起一首歌。唱歌的人已经不在，河床却仍在应和。'],
 rich:['未到的春天','“老师，土会把死亡收好，再长出春天。”'],
 burn:['火的边界','“火不是毁灭。火是炉，是暖，是边界。”'],
 beast:['三灵同源','三灵同源，凝为一兽。你仿佛又看见围坐在身旁的孩子。'],
 guardian:['五兽同誓','五兽聚力，同誓一地。\n“老师，我们守住了吗？”\n你把它留在土地上，继续完成未竟的春天。'],
 meteor:['这一次','五道模糊的身影撑住碎裂的光。\n“这一次，我不会再让你们独自面对。”'],
 crystal:['凝成结晶','回声会凝成结晶。普通结晶来自元素灵的三轮孕育；每轮使用不限次数，库存仍会消耗。'],
 life:['生灵归巢','土地能养活什么，取决于它拥有什么。动物自动元素化，之后每轮滋养对应属性；植物每3轮自动滋养。'],
 ending:['老师归来','你终于记起：你是最初的灵脉师，是五贤之师。你曾以名字与记忆，保住元素之环最后一线生机。\n五贤者没有归来。但他们的老师回来了。']
};
const LESSONS=[
 ['五格初醒','你不记得名字，只记得金、木、水、火、土。\n“去荒芜之地。把环接上。”','开始旅程',null],
 ['看懂土地','点选北侧腐化枯林，查看木 −1。负值，是土地的伤口。','查看枯林','3,2'],
 ['让地脉相连','选择碎矿地，铺在东侧矿地的外侧。同系列相连，上限从 9 提升到 12。','查看铺地位置','5,3'],
 ['第一次净化','选北侧枯林，施放净化。初始覆盖1格，至纯木结晶能扩大覆盖。','选中枯林','3,2'],
 ['等待新的生命','点击结束本轮，观察元素灵诞生。它们每 3 轮才会凝成结晶。','查看土地','3,3'],
 ['土地长成新的样子','选北侧枯林，直接选择疏林升级。系统自动消耗所缺的水结晶。现有生物会保留。','选中枯林','3,2'],
 ['结晶可以连续使用','从背包选择普通水晶，再点中心草原使用，重复2次。选结晶不会立即消耗，不耗行动点，也不会换轮。','选中中心','3,3'],
 ['继续接上地脉','第 2 轮正常铺地。第 3 轮试着把疏林接到北侧林地，建立你的第一个系列。','查看林地','3,2'],
 ['旅程由你决定','基础教学完成。经营土地，唤醒元素兽。新能力会随资源与生命逐步出现。','回声册',null]
];
let journeyExpanded=true,saveWarning=false;
function saveJourney(){
 try{localStorage.setItem('element-habitat-save-v13',JSON.stringify({version:1,state:S}));saveWarning=false;}catch(_){saveWarning=true;}
}
function renderJourney(){
 if(!$('journey'))return;
 saveJourney();
 const j=S.journey;if(!j||j.skipped){$('journey').hidden=true;return;}$('journey').hidden=false;
 const step=j&&!j.skipped?j.step:8,lesson=LESSONS[Math.min(8,step)];
 let title=lesson[0],copy=lesson[1];
 if(step>=8 && S.round>=9 && S.round<=10 && j&&!j.skipped){title='替土地撑起一片光';copy='第10轮将有土陨石雨。用5颗普通土晶造1格盾，部署在中心。防护池在覆盖范围内共享。';}
 else if(step>=8){
  const cells=Object.values(S.cells);
  if(cells.some(t=>t.guardians.length)){title='五兽聚力';copy='同格达到5只元素兽时自动合成守护灵。配比决定每轮十字范围的滋养，移动每步耗1行动。';}
  else if(cells.some(t=>EL.some(e=>t.spirits.filter(sp=>sp.el===e.key&&!S.interactionUsed['spirit:'+sp.id]).length>=3))){title='三灵同源';copy='这片土地已有3个同属性元素灵。轮末会免费自动合成元素兽，也可以现在手动合成。';}
 }
 const latest=(S.story?.memories||[]).filter(k=>!S.story.read.includes(k)).at(-1);
 $('journey').innerHTML=`<button id="journeyToggle" class="journey-title">✦ ${esc(title)} <small>${journeyExpanded?'−':'＋'}</small></button>${journeyExpanded?`<p>${esc(copy).replace(/\n/g,'<br>')}</p><div class="journey-controls"><button class="btn sm green" id="journeyFocus">${step===0?'开始旅程':step<8?lesson[2]:'回声册'}</button>${step<8?'<button class="btn sm" id="journeySkip">跳过教学</button>':''}${latest?`<button class="btn sm gold" id="journeyMemory">新回声 · ${esc(MEMORIES[latest]?.[0]||latest)}</button>`:''}</div><small>v1.3 · 地块供给 T${G.supplyLevel(S)} · ${saveWarning?'本机存储不可用':'已自动保存'}</small>`:''}`;
 $('journeyToggle').onclick=()=>{journeyExpanded=!journeyExpanded;renderJourney();};
 if($('journeyFocus'))$('journeyFocus').onclick=()=>{if(step===0){doAct({type:'tutorial'});return;}if(step>=8){openEchoes();return;}mode=null;onCell(lesson[3]);if(step===2)hint('选择碎矿地卡片，放在东侧外沿空格');};
 if($('journeySkip'))$('journeySkip').onclick=()=>doAct({type:'tutorial',skip:true});
 if($('journeyMemory'))$('journeyMemory').onclick=()=>openEchoes(latest);
}
function openEchoes(focus){
 $('dlgMenu').close();
 const list=S.completedMap?Object.keys(MEMORIES):(S.story?.memories||[]);
 $('echoBody').innerHTML=`<p class="muted">土地记得你走过的每一步。${S.completedMap?'未触发的残卷已在生境重建后解封。':'完成首次行动，找回新的回声。'}</p>`+(list.length?list.map(k=>`<article id="echo-${k}"><small>${S.story?.memories.includes(k)?'旅途记忆':'生境重建后解封'}</small><h3>${esc(MEMORIES[k]?.[0]||k)}</h3><p>${esc(MEMORIES[k]?.[1]||'').replace(/\n/g,'<br>')}</p></article>`).join(''):'<p>第一道回声藏在净化之后。</p>');
 if(S.story)S.story.read=[...S.story.memories];saveJourney();$('dlgEcho').showModal();if(focus)$('echo-'+focus)?.scrollIntoView({block:'nearest'});
}
function terrainPanel(t,k){
 const ty=G.TYPE[t.type];if(!ty.family)return '';
 let h=`<section class="terrain-info">${S.journey&&!S.journey.skipped&&S.journey.step<8?'<p><b>✦ '+esc(LESSONS[S.journey.step][0])+'</b><br>'+esc(LESSONS[S.journey.step][1])+'</p>':''}<b>${esc(ty.familyName)} · T${ty.level} · ${esc(ty.branch)}</b><p>${esc(ty.effect)}</p>`;
 if(ty.trigger)h+=`<small>${esc(ty.trigger)}。${esc(ty.cost)}</small>`;
 const rule=G.RELATIONS[ty.family],active=G.tileRelations(S,k);
 h+=`<div class="relation-list"><b>四邻互作 · ${esc(rule.name)}</b><small>搭配 ${rule.targets.map(f=>D.TERRAIN.families.find(v=>v.key===f).name).join(' / ')}</small>${active.length?active.map(r=>`<div>${esc(G.TYPE[S.cells[r.neighbor].type].name)} → 本格${elName(r.el)} +${r.n}/轮</div>`).join(''):'<div>相邻尚无对应地块</div>'}</div>`;
 const children=D.TILE_TYPES.filter(v=>v.parent===t.type);
 h+=children.map(v=>{const reasons=G.upgradeReasons(S,k,v),cost=G.upgradeCost(S,k,v),pay=EL.filter(e=>cost.normal[e.key]||cost.big[e.key]).map(e=>`${e.name} 普通${cost.normal[e.key]} / 大型${cost.big[e.key]}`).join(' · ');return `<div class="branch-card"><b>${esc(v.name)} · T${v.level} · ${esc(v.branch)}</b><p>${esc(v.effect)}</p><small>自动消耗：${pay||'属性已满足，无需结晶'}</small><small>${reasons.length?esc(reasons.join(' · ')):'升级条件满足'}</small><button class="btn sm green upgrade-direction" data-a="upgrade" data-type="${v.id}" ${reasons.length||S.over?'disabled':''}>选择 ${esc(v.branch)} · 升为${esc(v.name)}</button></div>`;}).join('');
 return h+'</section>';
}
$('btnEcho').onclick=()=>openEchoes();$('closeEcho').onclick=()=>$('dlgEcho').close();
$('btnAtlas').onclick=()=>{
 $('dlgMenu').close();
 $('echoBody').innerHTML='<h2>地脉图鉴</h2><p>同系列连片共享上限。T4需要元素兽经历，T5需要5格连片和守护灵覆盖。</p>'+D.TERRAIN.families.map(f=>`<article><h3>${esc(f.name)}</h3><p>${esc(f.role)}</p>${D.TERRAIN.nodes.filter(n=>n.family===f.key).map(n=>`<div class="branch-card"><b>T${n.level} ${esc(n.name)}</b><p>${n.attrs.map((v,i)=>EL[i].name+' '+v).join(' · ')}</p><small>${esc(n.effect)}</small></div>`).join('')}</article>`).join('');$('dlgEcho').showModal();
};
render();
