// DOM-only matrix uses the real CSS, rule engine and detail renderer; no WebGL context.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(v=>v[1]).join('\n'),constants=html.slice(html.indexOf('const D = GameData'),html.indexOf('// ---------- 音效'));
const detail=html.slice(html.indexOf('function batchChanges()'),html.indexOf('\nfunction renderInv()'));
(async()=>{fs.mkdirSync(out,{recursive:true});const report={checks:[],failures:[]},browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_CHANNEL?{channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL}:{})});try{
  for(const [width,height] of [[1440,900],[1440,700],[320,700],[390,844]]){
    const c=await browser.newContext({viewport:{width,height},isMobile:width<760,hasTouch:width<760}),p=await c.newPage();
    await p.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><aside id="detail" class="panel"></aside><aside id="batchPanel" hidden></aside><div id="eventGuide" hidden></div></body></html>`);
    for(const name of ['terrain.js','data.js','game.js','achievements.js'])await p.addScriptTag({path:path.join(root,name)});
    await p.addScriptTag({content:constants+'\n'+detail+'\nS=G.newGame(12,{mode:"endless"});selected="3,3";mode=null;renderDetail();'});
    await p.waitForFunction('(()=>{const r=document.getElementById("detail").getBoundingClientRect();return r.left>=0&&r.top>=0&&r.bottom<=innerHeight;})()');
    await p.waitForFunction('getComputedStyle(document.getElementById("detail")).transform==="none"');
    const failures=await p.evaluate(()=>{const bad=[];for(const type of D.TILE_TYPES)for(const hasGuardian of [false,true]){
      S.cells['3,3']=G.makeTile(type.id);if(hasGuardian)S.cells['3,3'].guardians=[{id:700,power:{metal:1,wood:1,water:1,fire:1,earth:1}}];renderDetail();
      const box=document.getElementById('detail'),r=box.getBoundingClientRect();if(r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1||box.scrollWidth>box.clientWidth+1)bad.push({id:type.id,hasGuardian,bottom:r.bottom,width:r.width,scrollWidth:box.scrollWidth,clientWidth:box.clientWidth});
    }return bad;});
    report.failures.push(...failures.map(v=>({viewport:[width,height],...v})));report.checks.push({viewport:[width,height],cases:160,failures:failures.length});console.log(`${width}x${height}: ${160-failures.length}/160 panels fit`);
    if(failures.length){await p.evaluate(id=>{S.cells['3,3']=G.makeTile(id);S.cells['3,3'].guardians=[{id:700,power:{metal:1,wood:1,water:1,fire:1,earth:1}}];renderDetail();},failures[0].id);await p.screenshot({path:path.join(out,`detail-layout-failure-${width}-${height}.png`),animations:'disabled'});}
    await c.close();
  }
  fs.writeFileSync(path.join(out,'detail-layout.json'),JSON.stringify(report,null,2));assert.equal(report.failures.length,0,JSON.stringify(report.failures.slice(0,3)));console.log('ok - all 640 terrain/guardian/layout combinations fit without scrolling');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
