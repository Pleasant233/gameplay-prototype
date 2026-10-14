// Fixed-clock captures and lifecycle checks for the interaction feedback update.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','feedback');
fs.mkdirSync(out,{recursive:true});
const view=fs.readFileSync(path.join(root,'view.js'),'utf8').replace('  root.View = {',`  root.__feedback={
  stats(){return {transient:spellFX.length,queued:queuedFX.length,particles:particles.length,shake,geometries:renderer.info.memory.geometries};},
  frame(){intro=0;cam.gR=10;cam.sph.radius=10;},draw(){if(post)post.render(scene,camera,cam.target.clone(),0);else renderer.render(scene,camera);renderer.getContext().finish();},cluster:clusterPulse
};
  root.View = {`);
const shieldOnly=process.env.FEEDBACK_UI_ONLY==='1';
const report={checks:[],errors:[],screenshots:[],mode:shieldOnly?'shield-ui':'full'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
function check(name,value){assert.ok(value,name);report.checks.push(name);console.log('ok - '+name);}
async function advance(page,ms,step=50){for(let left=ms;left>0;left-=step)await page.clock.fastForward(Math.min(step,left));}
async function shot(page,name){await page.evaluate('__feedback.draw()');await page.screenshot({path:path.join(out,name),animations:'disabled'});report.screenshots.push(name);}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    const options={headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};
    if(process.env.PLAYWRIGHT_BROWSER_PATH)options.executablePath=process.env.PLAYWRIGHT_BROWSER_PATH;
    else if(process.env.PLAYWRIGHT_BROWSER_CHANNEL)options.channel=process.env.PLAYWRIGHT_BROWSER_CHANNEL;
    browser=await chromium.launch(options);report.browser=browser.version();
    for(const mobile of [false,true]){
      const label=mobile?'phone':'desktop',context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}:{viewport:{width:1440,height:900}}),page=await context.newPage();
      page.setDefaultTimeout(90000);page.setDefaultNavigationTimeout(90000);
      page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
      await page.route('**/view.js',r=>r.fulfill({body:view,contentType:'application/javascript'}));
      await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction('typeof S!=="undefined"&&S&&document.querySelector("#world canvas")');
      if(!shieldOnly){
      await page.evaluate(`start(43);for(const k of ['2,2','3,2','4,2','2,3','3,3','4,3','2,4','3,4','4,4'])S.cells[k]=G.makeTile('woodland_t2');S={...S,cells:{...S.cells}};mode=null;selected=null;render();__feedback.frame();`);
      await page.waitForTimeout(1200);await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate('Date.now()')+1000));
      await shot(page,`feedback-${label}-before.png`);await page.evaluate('__feedback.cluster("3,3")');await advance(page,330);
      check(label+' connected terrain wave is active',await page.evaluate('__feedback.stats().transient>0'));
      await shot(page,`feedback-${label}-cluster-wave.png`);await advance(page,2500,250);
      await page.evaluate(`S.shields=[{id:900,cells:['3,3','4,3'],coverage:2,defense:{metal:0,wood:0,water:0,fire:10,earth:0}}];render();View.shieldDeploy(S.shields[0]);`);
      await advance(page,1600,100);await shot(page,`feedback-${label}-shield.png`);
      const effectsBefore=await page.evaluate('JSON.stringify(S)');
      await page.evaluate(`View.meteorRain(['3,3','4,3','3,4','2,3','3,2'].map((cell,i)=>({cell,el:'fire',damage:i<2?0:3})))`);
      await advance(page,180);await shot(page,`feedback-${label}-meteor-warning.png`);
      await advance(page,620);await shot(page,`feedback-${label}-meteor-flight.png`);
      await advance(page,500);await shot(page,`feedback-${label}-meteor-impact.png`);
      check(label+' visual scheduling leaves authoritative state unchanged',effectsBefore===await page.evaluate('JSON.stringify(S)'));
      await advance(page,3000,250);
      check(label+' meteor and shield meshes, queues and particles expire',await page.evaluate(`(()=>{const n=__feedback.stats();return n.transient===0&&n.queued===0&&n.particles===0;})()`));
      const geometryBefore=await page.evaluate('__feedback.stats().geometries');
      await page.evaluate(`for(let i=0;i<12;i++)View.meteorRain(Array.from({length:28},(_,i)=>({cell:['3,3','4,3','3,4','2,3','3,2'][i%5],el:'fire',damage:3})))`);
      check(label+' repeated storms keep bounded transient and queue budgets',await page.evaluate(m=>{const n=__feedback.stats();return n.transient<=(m?180:360)&&n.queued<=(m?80:160);},mobile));
      await advance(page,4300,250);check(label+' repeated storms release owned geometry',await page.evaluate(n=>{const s=__feedback.stats();return !s.transient&&!s.queued&&!s.particles&&s.geometries<=n;},geometryBefore));
      await page.evaluate(`View.meteorRain([{cell:'3,3',el:'fire',damage:3}])`);
      await page.evaluate('start(99)');check(label+' restart clears every delayed impact',await page.evaluate('__feedback.stats().transient===0&&__feedback.stats().queued===0'));
      await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(`View.meteorRain([{cell:'3,3',el:'water',damage:0}]);`);await advance(page,80);
      check(label+' reduced motion uses static short cues without shake or queued flights',await page.evaluate(`__feedback.stats().shake===0&&__feedback.stats().queued===0&&__feedback.stats().transient<=2`));
      await advance(page,700,100);check(label+' reduced cues expire',await page.evaluate('__feedback.stats().transient===0'));
      // Mixed recipes, focus, maximum and shortage with actual controls.
      await page.clock.resume();
      }else await page.waitForTimeout(1100);
      await page.evaluate(`S.inv.crystal={metal:2,wood:2,water:5,fire:1,earth:2};render();`);
      await page.locator('#btnBag').click();await page.locator('#btnShield').click();
      check(label+' balanced preset respects each stock',await page.evaluate('Object.values(shieldMix).every(n=>n===1)'));
      await page.locator('[data-shield-focus="water"]').click();check(label+' elemental focus creates pure water recipe',await page.evaluate('shieldMix.water===5&&Object.values(shieldMix).reduce((a,b)=>a+b,0)===5'));
      await page.locator('[data-shield-preset="max"]').click();check(label+' maximum leaves unusable remainder without overspending',await page.evaluate('Object.values(shieldMix).reduce((a,b)=>a+b,0)===10&&D.ELEMENTS.every(e=>shieldMix[e.key]<=S.inv.crystal[e.key])&&S.inv.crystal.water===5'));
      if(mobile)await page.setViewportSize({width:320,height:700});
      await shot(page,`feedback-${label}-mixed-shield.png`);
      check(label+' shield controls fit and scroll within viewport',await page.evaluate(`(()=>{const p=document.querySelector('#dlgShield .dlg'),r=p.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&p.scrollWidth<=p.clientWidth;})()`));
      await page.evaluate(`document.getElementById('shieldBody').scrollTop=document.getElementById('shieldBody').scrollHeight`);
      check(label+' scrolled mixer keeps close and craft controls accessible',await page.evaluate(`['#dlgShield [data-close]','#btnCraftShield'].every(sel=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest(sel)===el;})`));
      await shot(page,`feedback-${label}-shield-scrolled.png`);
      await page.locator('[data-shield-preset="clear"]').click();
      await page.locator('[data-shield-adjust="water"][data-delta="1"]').click();
      check(label+' plus button changes selected crystals',await page.evaluate('shieldMix.water===1'));
      await page.locator('[data-shield-adjust="water"][data-delta="-1"]').click();
      check(label+' minus button removes selected crystals',await page.evaluate('shieldMix.water===0'));
      const slider=page.locator('[data-element="water"]');await slider.scrollIntoViewIfNeeded();const track=await slider.boundingBox();
      if(mobile)await page.touchscreen.tap(track.x+track.width-10,track.y+track.height/2);
      else {await page.mouse.move(track.x+10,track.y+track.height/2);await page.mouse.down();await page.mouse.move(track.x+track.width-10,track.y+track.height/2,{steps:8});await page.mouse.up();}
      check(label+' slider pointer changes the water mixture',await page.evaluate('shieldMix.water>=4'));
      await slider.press('Home');check(label+' slider Home clears water',await page.evaluate('shieldMix.water===0'));
      await slider.press('End');check(label+' slider End uses available water',await page.evaluate('shieldMix.water===5&&Number(document.querySelector("[data-shield-row=water] output").value)===5'));
      const roundBefore=await page.evaluate('S.round'),apBefore=await page.evaluate('S.ap');await page.locator('#btnCraftShield').click();
      check(label+' actual craft deducts exact mix and keeps AP and round',await page.evaluate(({round,ap})=>S.inv.crystal.water===0&&S.inv.shields.length===1&&S.inv.shields[0].defense.water===5&&S.inv.shields[0].coverage===1&&S.round===round&&S.ap===ap,{round:roundBefore,ap:apBefore}));
      check(label+' crafting once leaves mixture entry available',await page.locator('#btnShield').isEnabled());
      await page.locator('#btnShield').click();await page.locator('[data-shield-adjust="wood"][data-delta="1"]').click();
      check(label+' used round still allows adjustment and explains craft restriction',await page.evaluate('shieldMix.wood===2&&document.querySelector("#btnCraftShield").disabled&&document.querySelector("#btnCraftShield").textContent.includes("本轮已制造")&&document.querySelector("#shieldPreview").textContent.includes("下一轮")&&S.inv.crystal.wood===2&&S.inv.shields.length===1'));
      await shot(page,`feedback-${label}-shield-used-round.png`);await page.locator('#dlgShield [data-close]').click();
      await page.locator('#btnBag').click();await page.locator('#btnEnd').click();await page.locator('#btnBag').click();
      check(label+' next round enables shield mixture again',await page.locator('#btnShield').isEnabled());
      await page.locator('#btnShield').click();
      check(label+' next round can craft matching recipe',await page.locator('#btnCraftShield').isEnabled());
      await page.locator('#dlgShield [data-close]').click();await page.evaluate('S.inv.crystal={metal:0,wood:0,water:2,fire:0,earth:0};render()');await page.locator('#btnShield').click();
      check(label+' shortage gives clear disabled state',await page.evaluate(`document.querySelector('#btnCraftShield').disabled&&document.querySelector('#shieldComplete').disabled&&document.querySelector('#shieldPreview').textContent.includes('库存不足')`));
      await context.close();
    }
    check('No JavaScript, console or shader errors',report.errors.length===0);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,shieldOnly?'shield-layout-report.json':'feedback-report.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
