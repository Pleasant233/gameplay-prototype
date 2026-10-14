// Real desktop and touch controls, local or published static game.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts'),remote=process.argv[2];
const report={checks:[],errors:[],screenshots:[]};
const record=s=>{report.checks.push(s);console.log('ok - '+s);};
async function clickCell(p,k,mobile){
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const at=await p.evaluate(k=>View.project(k),k);
  if(mobile)await p.touchscreen.tap(at.x,at.y);else await p.mouse.click(at.x,at.y);
}
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png'),animations:'disabled',timeout:60000});report.screenshots.push(name+'.png');}
(async()=>{
  fs.mkdirSync(out,{recursive:true});let server,browser;
  try{
    if(!remote){
      server=http.createServer((req,res)=>{
        const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);
      });
      await new Promise(r=>server.listen(0,'127.0.0.1',r));
    }
    report.url=remote||'http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({...(process.env.PLAYWRIGHT_BROWSER_CHANNEL?{channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL}:{}),headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    for(const mobile of [false,true]){
      const label=mobile?'phone':'desktop',c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile}),p=await c.newPage();
      p.on('pageerror',e=>report.errors.push(label+': '+e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(label+': '+m.text());});
      await p.goto(report.url);await p.waitForFunction('typeof renderJourney==="function"&&S');
      await p.evaluate(()=>{
        Tokens.reset();S=G.newGame(19,{mode:'endless'});S.cells['3,3'].attrs=[3,-2,4,0,1];
        S.cells['3,3'].beasts=[{id:700,el:'metal',age:0}];S.cells['3,3'].plants=[{id:701,kind:'grass',age:0}];
        selected=null;mode=null;render();
      });
      await clickCell(p,'3,3',mobile);
      const btn=p.locator('[data-a="demolish"]');assert.ok(await btn.isEnabled());
      const text=await p.locator('#detail').innerText();assert.match(text,/金 ×3/);assert.match(text,/水 ×4/);assert.match(text,/土 ×1/);assert.doesNotMatch(text,/木 ×-2/);
      await shot(p,'demolition-preview-'+label);record(label+' select terrain and preview matching positive crystal refunds');
      const before=await p.evaluate('({score:G.score(S).total,inv:structuredClone(S.inv),offers:S.offers.slice(),empty:G.emptyKeys(S).length})');
      await btn.click();
      assert.equal(await p.evaluate(`'3,3' in S.cells`),false);assert.equal(await p.evaluate('selected'),null);assert.equal(await p.locator('#detail.open').count(),0);
      assert.equal(await p.evaluate('S.ap'),2);assert.equal(await p.evaluate('S.round'),1);assert.equal(await p.evaluate('S.placed'),0);
      assert.deepEqual(await p.evaluate('S.offers'),before.offers);
      const inv=await p.evaluate('S.inv');assert.deepEqual(inv.crystal,{metal:before.inv.crystal.metal+3,wood:before.inv.crystal.wood,water:before.inv.crystal.water+4,fire:before.inv.crystal.fire,earth:before.inv.crystal.earth+1});
      for(const bag of ['bigCrystal','inverseCrystal','pureCrystal','shields'])assert.deepEqual(inv[bag],before.inv[bag]);
      assert.equal(await p.evaluate('G.score(S).total'),before.score-10);assert.equal(await p.evaluate('G.emptyKeys(S).length'),before.empty+1);
      record(label+' real demolition costs one AP, removes inhabitants and refunds eight ordinary crystals');
      await p.waitForFunction(`document.getElementById('bagCount').textContent===String(G.bagCount(S))&&document.getElementById('score').textContent===String(G.score(S).total)&&document.getElementById('left').textContent===String(G.emptyKeys(S).length)`);
      await p.waitForFunction('!document.querySelector("#tokens .token")');await shot(p,'demolition-cleared-'+label);
      record(label+' refund flights settle and score, bag and empty-cell HUD agree');
      await p.reload();await p.waitForFunction(`typeof S!=="undefined"&&S.ap===2&&!S.cells['3,3']`);assert.deepEqual(await p.evaluate('S.inv'),inv);
      record(label+' reload preserves removal, exact refunds and AP');
      assert.ok(await p.evaluate('G.legalPlacements(S).includes("3,3")'));
      await p.locator('[data-offer="0"]').click();await clickCell(p,'3,3',mobile);assert.ok(await p.evaluate(`S.cells['3,3']`));assert.equal(await p.evaluate('S.ap'),1);assert.equal(await p.evaluate('S.placed'),1);
      record(label+' cleared cell can be placed again through actual controls');
      await p.evaluate(()=>{Tokens.reset();S.ap=0;selected='3,3';mode=null;render();});assert.ok(await p.locator('[data-a="demolish"]').isDisabled());
      const blocked=await p.evaluate('JSON.stringify({inv:S.inv,cells:S.cells,ap:S.ap})');assert.equal(await p.evaluate('G.act(S,{type:"demolish",cell:"3,3"}).ok'),false);assert.equal(await p.evaluate('JSON.stringify({inv:S.inv,cells:S.cells,ap:S.ap})'),blocked);
      record(label+' zero AP disables demolition and rejects mutation');
      await p.evaluate(()=>{S.ap=3;S.completedMap=true;render();});await p.keyboard.press('p');await p.evaluate(()=>{selected='3,3';renderDetail();});assert.ok(await p.locator('[data-a="demolish"]').isDisabled());await p.keyboard.press('Escape');
      record(label+' photography and inspection prevent demolition');
      await p.evaluate(()=>{Tokens.reset();S=G.newGame(19,{mode:'endless'});S.cells={'3,3':G.makeTile('mine_t1')};selected='3,3';mode=null;render();});await p.locator('[data-a="demolish"]').click();
      assert.equal(await p.evaluate('Object.keys(S.cells).length'),0);assert.equal(await p.evaluate('S.result'),'failed');assert.equal(await p.evaluate('S.ap'),2);assert.equal(await p.evaluate('S.inv.crystal.metal'),1);assert.ok(await p.locator('#over').isVisible());
      record(label+' last terrain removal follows existing empty-map failure rule');
      await c.close();
    }
    assert.deepEqual(report.errors,[]);record('No browser or WebGL errors');
  }finally{
    fs.writeFileSync(path.join(out,remote?'demolition-production.json':'demolition-local.json'),JSON.stringify(report,null,2));
    if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
