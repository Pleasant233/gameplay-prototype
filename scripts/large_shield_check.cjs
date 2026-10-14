// Weighted shield recipes through real controls, locally or in production.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts'),remote=process.argv[2];
const report={checks:[],errors:[],screenshots:[]},record=s=>{report.checks.push(s);console.log('ok - '+s);};
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png'),animations:'disabled',timeout:60000});report.screenshots.push(name+'.png');}
(async()=>{fs.mkdirSync(out,{recursive:true});let server,browser;try{
  if(!remote){server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
  report.url=remote||'http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({...(process.env.PLAYWRIGHT_BROWSER_CHANNEL?{channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL}:{}),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const mobile of [false,true]){
    const label=mobile?'phone':'desktop',c=await browser.newContext({viewport:mobile?{width:320,height:700}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile}),p=await c.newPage();
    p.on('pageerror',e=>report.errors.push(label+': '+e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(label+': '+m.text());});
    await p.goto(report.url);await p.waitForFunction('typeof renderJourney==="function"&&S');
    await p.evaluate(()=>{Tokens.reset();S=G.newGame(19,{mode:'endless'});S.inv.crystal={metal:2,wood:1,water:0,fire:0,earth:0};S.inv.bigCrystal={metal:0,wood:0,water:5,fire:1,earth:0};S.inv.inverseCrystal.water=3;S.inv.pureCrystal.fire=2;selected=null;mode=null;render();});
    await p.locator('#btnBag').click();await p.locator('#btnShield').click();await p.locator('[data-shield-preset="15"]').click();
    assert.equal(await p.evaluate('shieldPoints()'),15);assert.ok(await p.locator('#btnCraftShield').isEnabled());
    assert.ok(await p.evaluate('D.ELEMENTS.every(e=>shieldMix[e.key]<=S.inv.crystal[e.key]&&shieldBigMix[e.key]<=S.inv.bigCrystal[e.key])'));
    record(label+' presets use both sizes by defense weight without spending inventory');
    await p.locator('[data-shield-preset="5"]').click();await p.locator('[data-shield-focus="water"]').click();
    assert.equal(await p.evaluate('shieldPoints()'),5);assert.equal(await p.evaluate('shieldBigMix.water'),2);assert.equal(await p.evaluate('shieldMix.metal'),1);
    record(label+' elemental focus prioritizes matching large crystals');
    await p.locator('[data-shield-kind="bigCrystal"]').click();assert.equal(await p.locator('[data-shield-row="water"] output').innerText(),'2');
    await p.locator('[data-shield-adjust="water"][data-delta="1"]').click();assert.equal(await p.evaluate('shieldPoints()'),7);
    await p.locator('[data-shield-adjust="water"][data-delta="-1"]').click();await p.locator('[data-shield-kind="crystal"]').click();assert.equal(await p.locator('[data-shield-row="metal"] output').innerText(),'1');assert.equal(await p.evaluate('shieldBigMix.water'),2);
    record(label+' size switching preserves both selections and large buttons change defense by two');
    await p.locator('[data-shield-preset="clear"]').click();await p.locator('[data-shield-adjust="metal"][data-delta="1"]').click();await p.locator('[data-shield-kind="bigCrystal"]').click();
    const slider=p.locator('[data-element="water"]');await slider.press('End');assert.equal(await p.evaluate('shieldBigMix.water'),5);assert.ok(await p.locator('#btnCraftShield').isDisabled());
    for(let i=0;i<3;i++)await slider.press('ArrowLeft');assert.equal(await p.evaluate('shieldPoints()'),5);assert.match(await p.locator('#shieldPreview').innerText(),/1 格覆盖 · 5 点防护/);assert.match(await p.locator('#btnCraftShield').innerText(),/普通1颗 \+ 大型2颗/);
    await shot(p,'large-shield-mixed-'+label);record(label+' manual mixed recipe and slider show exact weighted preview');
    const before=await p.evaluate('({inv:structuredClone(S.inv),round:S.round,ap:S.ap})');await p.locator('#btnCraftShield').click();
    const after=await p.evaluate('S.inv');assert.equal(after.crystal.metal,before.inv.crystal.metal-1);assert.equal(after.bigCrystal.water,before.inv.bigCrystal.water-2);assert.equal(after.bigCrystal.fire,before.inv.bigCrystal.fire);assert.deepEqual(after.inverseCrystal,before.inv.inverseCrystal);assert.deepEqual(after.pureCrystal,before.inv.pureCrystal);assert.equal(after.shields[0].defense.water,4);assert.equal(after.shields[0].defense.metal,1);assert.equal(after.shields[0].coverage,1);assert.equal(await p.evaluate('S.round'),before.round);assert.equal(await p.evaluate('S.ap'),before.ap);
    record(label+' actual mixed crafting consumes only selected inventories without AP or round cost');
    await p.locator('#btnShield').click();assert.ok(await p.locator('#btnCraftShield').isDisabled());assert.match(await p.locator('#btnCraftShield').innerText(),/本轮已制造/);await p.locator('[data-shield-kind="crystal"]').click();await p.locator('[data-shield-adjust="wood"][data-delta="1"]').click();assert.equal(await p.evaluate('shieldMix.wood'),1);
    await p.locator('#dlgShield [data-close]').click();await p.locator('#btnBag').click();await p.locator('#btnEnd').click();await p.locator('#btnBag').click();await p.locator('#btnShield').click();assert.ok(await p.locator('#btnCraftShield').isEnabled());await p.locator('#dlgShield [data-close]').click();
    record(label+' manufacturing remains once per round while adjustment stays available');
    await p.evaluate(()=>{Tokens.reset();S=G.newGame(19,{mode:'endless'});S.ap=0;S.inv.bigCrystal.water=5;selected=null;mode=null;render();});await p.locator('#btnShield').click();
    assert.equal(await p.evaluate('shieldBag'),'bigCrystal');assert.equal(await p.evaluate('shieldPoints()'),10);assert.equal(await p.evaluate('shieldBigMix.water'),5);assert.ok(await p.locator('[data-shield-preset="5"]').isDisabled());assert.ok(await p.locator('#btnCraftShield').isEnabled());
    record(label+' large-only stock opens its controls and forms a two-cell shield');
    await p.locator('[data-shield-preset="clear"]').click();await slider.press('End');await slider.press('ArrowLeft');await slider.press('ArrowLeft');assert.equal(await p.evaluate('shieldPoints()'),6);assert.ok(await p.locator('#btnCraftShield').isDisabled());assert.match(await p.locator('#shieldComplete').innerText(),/补齐 4 点 → 2 格/);await p.locator('#shieldComplete').click();assert.equal(await p.evaluate('shieldBigMix.water'),5);
    await p.evaluate(()=>document.getElementById('shieldBody').scrollTop=document.getElementById('shieldBody').scrollHeight);
    assert.ok(await p.evaluate(()=>{const panel=document.querySelector('#dlgShield .dlg'),r=panel.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&panel.scrollWidth<=panel.clientWidth;}));
    assert.ok(await p.evaluate(()=>['#dlgShield [data-close]','#btnCraftShield'].every(sel=>{const el=document.querySelector(sel),r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest(sel)===el;})));
    await shot(p,'large-shield-pure-'+label);record(label+' completion handles even-only stock and close/craft controls remain accessible');
    await p.locator('#btnCraftShield').click();assert.equal(await p.evaluate('S.inv.bigCrystal.water'),0);assert.equal(await p.evaluate('S.inv.shields[0].defense.water'),10);assert.equal(await p.evaluate('S.inv.shields[0].coverage'),2);assert.equal(await p.evaluate('S.ap'),0);assert.equal(await p.evaluate('S.round'),1);
    await p.locator('[data-shield]').click();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const at=await p.evaluate('View.project("3,3")');if(mobile)await p.touchscreen.tap(at.x,at.y);else await p.mouse.click(at.x,at.y);
    assert.equal(await p.evaluate('S.shields.length'),1);assert.equal(await p.evaluate('S.shields[0].cells.length'),2);assert.equal(await p.evaluate('S.shields[0].defense.water'),10);
    record(label+' large-only craft is free at zero AP and its shield deploys with two cells');
    const saved=await p.evaluate('JSON.stringify(S.shields)');await p.reload();await p.waitForFunction('typeof S!=="undefined"&&S.shields.length===1');assert.equal(await p.evaluate('JSON.stringify(S.shields)'),saved);
    record(label+' reload retains weighted defense and deployed coverage');
    await p.evaluate(()=>{S.inv.bigCrystal.water=3;S.interactionUsed={};render();});await p.locator('#btnBag').click();await p.locator('#btnShield').click();await slider.press('End');assert.equal(await p.evaluate('shieldPoints()'),6);assert.ok(await p.locator('#btnCraftShield').isDisabled());assert.ok(await p.locator('#shieldComplete').isDisabled());assert.match(await p.locator('#shieldPreview').innerText(),/库存不足/);assert.equal(await p.evaluate('S.inv.bigCrystal.water'),3);
    record(label+' insufficient even-only stock cannot create a partial shield or spend crystals');
    await c.close();
  }
  assert.deepEqual(report.errors,[]);record('No browser or WebGL errors');
}finally{fs.writeFileSync(path.join(out,remote?'large-shield-production.json':'large-shield-local.json'),JSON.stringify(report,null,2));if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
