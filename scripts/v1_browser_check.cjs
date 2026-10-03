// Real pointer/touch and WebGL verification, including the v1 additions.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), out = process.env.V1_ARTIFACT_DIR ? path.resolve(process.env.V1_ARTIFACT_DIR) : path.join(root, 'artifacts');
const remoteURL = process.env.V1_TEST_URL;
if (remoteURL && !['http:', 'https:'].includes(new URL(remoteURL).protocol)) throw new Error('V1_TEST_URL must use HTTP or HTTPS');
fs.mkdirSync(out, { recursive: true });
let view = fs.readFileSync(path.join(root, 'view.js'), 'utf8');
view = view.replace('  root.View = {', `
  root.__viewTest={
    point(k,x=0,z=0){const n=tileMap[k],p=wp(k,surfaceHeight(k,x,z)+0.005);p.x+=x;p.z+=z;if(n)p.applyMatrix4(new THREE.Matrix4().makeTranslation(0,n.group.position.y,0));p.project(camera);const r=renderer.domElement.getBoundingClientRect();return {x:(p.x/2+0.5)*r.width+r.left,y:(-p.y/2+0.5)*r.height+r.top};},
    effects(){return {transient:spellFX.length,queued:queuedFX.length,lights:lights.filter(f=>f.t<0.4).length,particles:particles.length,falling:Object.values(tileMap).some(n=>n.rise>0)};},
    region(){return regionPreview?regionPreview.userData.cells:[];},preview(k){hoverK=k;regionPreviewKey='';},cluster:clusterPulse,
    terrain(k){return {look:tileMap[k].look.kind,scenery:tileMap[k].sceneryKey};},memory(){return {...renderer.info.memory};},low:()=>LOW
  };
  root.View = {`);
const report = { checks: [], errors: [], screenshots: [], browser: '' };
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent((req.url || '/').split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
function check(name, value) { assert.ok(value, name); report.checks.push(name); console.log('ok - ' + name); }
async function shot(page, name) { await page.screenshot({ path: path.join(out, name), animations: 'disabled' }); report.screenshots.push(name); }
async function settle(page) {
  await page.waitForFunction(`Number(document.getElementById('score').textContent)===G.score(S).total && Number(document.getElementById('bagCount').textContent)===G.bagCount(S) && !document.querySelector('.token')`, null, { timeout: 30000 });
}
async function pointClick(page, cell, mobile) {
  const p = await page.evaluate(k => __viewTest.point(k, 0.08, 0.06), cell);
  if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const targetURL = remoteURL || `http://127.0.0.1:${server.address().port}`;
  report.url = targetURL;
  report.testProbes = 'Local view.js with test-only picking and effect probes; game/UI/assets loaded from target URL';
  const options = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
  if (process.env.PLAYWRIGHT_BROWSER_PATH) options.executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
  else if (process.env.PLAYWRIGHT_BROWSER_CHANNEL) options.channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  let browser;
  try {
    browser = await chromium.launch(options); report.browser = `Chromium ${browser.version()} / SwiftShader`;
    for (const mobile of [false, true]) {
      const label = mobile ? 'phone' : 'desktop';
      const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' } : { viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', e => report.errors.push(label + ': ' + e.message));
      page.on('console', msg => { if (msg.type() === 'error') report.errors.push(label + ': ' + msg.text()); });
      await page.route('**/view.js', route => route.fulfill({ body: view, contentType: 'application/javascript' }));
      await page.goto(targetURL);
      await page.waitForFunction('typeof S!=="undefined" && S && document.querySelector("#world canvas")');
      await page.evaluate('start(37)'); await page.waitForTimeout(1100);
      check(label + ' initial magics locked and 3 offers', await page.evaluate(`document.querySelector('[data-magic="mine"]').disabled && document.querySelectorAll('[data-offer]').length===3`));
      await shot(page, `v1-${label}-initial.png`);
      await page.locator('[data-offer="0"]').click(); const cell = await page.evaluate('G.legalPlacements(S)[0]');
      await pointClick(page, cell, mobile); check(label + ' real pointer/touch placement, once per round', await page.evaluate(k => !!S.cells[k] && S.placed === 1 && S.ap === 2 && S.offers.length === 0, cell));
      await settle(page); await page.waitForFunction('!__viewTest.effects().falling');
      await pointClick(page, '3,3', mobile); check(label + ' real pointer/touch opens detail', await page.evaluate(`selected==='3,3'&&document.getElementById('detail').classList.contains('open')`));
      // All crystal categories can be repeated in the same round, including at zero AP.
      await page.evaluate(`S.ap=0;S.cells['3,3'].attrs=[0,0,0,0,0];S.inv.crystal.water=2;S.inv.bigCrystal.water=2;S.inv.inverseCrystal.fire=2;render();`);
      await page.locator('#btnBag').click();
      await page.locator('[data-crystal="water"][data-big=""][data-inverse=""]').click();
      check(label + ' ordinary crystal +1 free', await page.evaluate(`S.cells['3,3'].attrs[2]===1&&S.ap===0&&S.inv.crystal.water===1`));
      check(label + ' repeated crystal button stays enabled', await page.locator('[data-crystal="water"][data-big=""][data-inverse=""]').isEnabled());
      await page.locator('[data-crystal="water"][data-big=""][data-inverse=""]').click();
      check(label + ' same-round ordinary repetition spends stock at zero AP',await page.evaluate(`S.cells['3,3'].attrs[2]===2&&S.inv.crystal.water===0&&S.round===1&&S.ap===0`));
      await page.locator('[data-crystal="water"][data-big="1"]').click();
      await page.locator('[data-crystal="fire"][data-inverse="1"]').click();
      check(label + ' large +2 and inverse -1 free', await page.evaluate(`S.cells['3,3'].attrs[2]===4&&S.cells['3,3'].attrs[3]===-1&&S.ap===0&&S.round===1`));
      await page.locator('[data-crystal="water"][data-big="1"]').click();
      await page.locator('[data-crystal="fire"][data-inverse="1"]').click();
      check(label + ' repeated large and inverse crystals spend stock without round or placement change', await page.evaluate(`S.cells['3,3'].attrs[2]===6&&S.cells['3,3'].attrs[3]===-2&&S.inv.bigCrystal.water===0&&S.inv.inverseCrystal.fire===0&&S.ap===0&&S.round===1&&S.placed===1`));
      check(label + ' depleted crystal buttons disappear and crystal interaction locks are absent',await page.evaluate(`!document.querySelector('[data-crystal="water"]')&&!document.querySelector('[data-crystal="fire"][data-inverse="1"]')&&!Object.keys(S.interactionUsed).some(k=>/^(crystal|big|inverse):/.test(k))`));
      await settle(page); await shot(page,`v1-${label}-repeat-crystals.png`);
      await page.locator('#btnBag').click();
      // Area purify actual button dispatch, locks and corresponding effect cleanup.
      await page.evaluate(`S.ap=2;S.roundAP=3;S.placed=1;S.magicUsed={};for(const k of ['3,3',...G.neighbors('3,3')]){S.cells[k].attrs=[0,-1,0,0,0];S.cells[k].cancers=[{id:200,el:'wood',age:0}];}selected='3,3';render();`);
      await page.locator('[data-magic="purify"]').click();
      check(label + ' purify five cells and cancer removal via UI', await page.evaluate(`['3,3',...G.neighbors('3,3')].every(k=>S.cells[k].attrs[1]===4&&S.cells[k].cancers.length===0)&&S.ap===1`));
      await shot(page, `v1-${label}-purify.png`); await settle(page);
      await page.waitForFunction('__viewTest.effects().transient===0&&__viewTest.effects().lights===0', null, { timeout: 45000 });
      // Upgrade and stage display, highest AP on narrow screen.
      await page.evaluate(`S.cells['3,3']=G.makeTile('ruin_town');S.cells['3,3'].attrs=[0,2,1,0,1];selected='3,3';render();`);
      await page.locator('[data-a="upgrade"][data-type="forest"]').click(); check(label + ' upgraded forest redraws scenery',await page.evaluate(`__viewTest.terrain('3,3').look==='forest'&&__viewTest.terrain('3,3').scenery.startsWith('forest:')`));check(label + ' upgrade keeps attrs and AP', await page.evaluate(`S.cells['3,3'].type==='forest'&&S.ap===1&&S.cells['3,3'].attrs[1]===2`));
      await page.evaluate('S.peakScore=1500;S.roundAP=9;S.ap=9;render()');
      check(label + ' 9 AP HUD and dock remain inside viewport', await page.evaluate(`['top','dock','stageHud'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;})`));
      // Shield recipe and placement via real DOM.
      await page.evaluate(`S.interactionUsed={};S.inv.crystal=Object.fromEntries(D.ELEMENTS.map(e=>[e.key,0]));S.inv.crystal.water=10;selected='3,3';render();`);
      await page.locator('#btnBag').click(); await page.locator('#btnShield').click();
      check(label+' shield opens with useful one-cell recipe',await page.evaluate(`shieldMix.water===5&&document.querySelectorAll('#shieldInputs input[type=number]').length===0&&!document.querySelector('#btnCraftShield').disabled`));
      await page.locator('[data-shield-adjust="water"][data-delta="1"]').click();check(label + ' shield invalid amount cannot craft', await page.locator('#btnCraftShield').isDisabled());
      await page.locator('#shieldComplete').click();check(label+' one-click completion fills exact inventory',await page.evaluate(`shieldMix.water===10&&!document.querySelector('#btnCraftShield').disabled&&document.querySelector('[data-shield-adjust="water"][data-delta="1"]').disabled&&document.querySelector('[data-shield-preset="15"]').disabled`));
      await page.locator('[data-shield-preset="clear"]').click();await page.locator('[data-shield-focus="water"]').click();
      await page.locator('[data-shield-adjust="water"][data-delta="1"]').click();await page.locator('[data-shield-adjust="water"][data-delta="-1"]').click();
      check(label+' plus/minus and elemental focus never spend inventory',await page.evaluate('shieldMix.water===5&&S.inv.crystal.water===10'));
      await page.locator('[data-element="water"]').press('End');check(label+' shield slider supports keyboard',await page.evaluate('shieldMix.water===10'));
      await page.locator('[data-shield-preset="max"]').click();await shot(page,`v1-${label}-shield-mixer.png`);
      check(label+' shield mixer fits viewport',await page.evaluate(`(()=>{const r=document.querySelector('#dlgShield .dlg').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;})()`));
      await page.locator('#btnCraftShield').click();
      check(label + ' shield craft costs 10, covers 2', await page.evaluate('S.inv.shields.length===1&&S.inv.shields[0].coverage===2&&S.inv.crystal.water===0'));
      await page.locator('[data-shield]').click();await page.evaluate(`__viewTest.preview('3,3')`);await page.waitForFunction('__viewTest.region().length===2');
      check(label+' shield placement previews actual two-cell coverage',await page.evaluate('mode.kind==="deployShield"&&S.inv.shields.length===1&&__viewTest.region().length===2'));
      await pointClick(page,'3,3',mobile);check(label + ' deploy shield from inventory', await page.evaluate('S.shields.length===1&&S.shields[0].cells.length===2&&S.inv.shields.length===0'));
      await page.waitForFunction('__viewTest.effects().transient===0&&__viewTest.effects().queued===0');await shot(page,`v1-${label}-shield-dome.png`);
      // Actual ten-round settlement trigger and effect lifecycle.
      await page.evaluate(`S.round=10;S.placed=1;S.events=[];Tokens.reset();render();`); await page.locator('#btnEnd').click();
      check(label + ' meteor triggered from end button', await page.evaluate('S.round===11&&S.lastMeteor.round===10&&S.lastMeteor.cells.length===Math.floor(Object.keys(S.cells).length/3)'));
      await shot(page, `v1-${label}-meteor.png`); await settle(page);
      await page.waitForFunction('__viewTest.effects().transient===0&&__viewTest.effects().lights===0', null, { timeout: 45000 });
      // Connected terrain effect, outer contour and bounded cleanup using real placement.
      await page.evaluate(`start(23);for(const k of Object.keys(S.cells))S.cells[k]=G.makeTile('ruin_town');S.offers=['ruin_town','polluted_lake','polluted_waste'];selected=null;render();`);
      await page.waitForTimeout(1100);
      await page.locator('[data-offer="0"]').click();const linked=await page.evaluate('G.legalPlacements(S)[0]');await page.evaluate(k=>__viewTest.preview(k),linked);
      await page.waitForFunction('__viewTest.region().length===6');check(label+' placement previews six-cell connected terrain',true);
      await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate('Date.now()')+100));
      await pointClick(page,linked,mobile);check(label+' linked placement succeeds through real input',await page.evaluate(k=>!!S.cells[k]&&S.placed===1,linked));
      for(let i=0;i<14;i++)await page.clock.fastForward(50);
      check(label+' landing starts connected terrain wave',await page.evaluate('__viewTest.effects().transient>0&&!!document.querySelector(".float")'));
      await shot(page,`v1-${label}-cluster.png`);for(let i=0;i<12;i++)await page.clock.fastForward(250);
      check(label+' linked terrain wave and queue expire',await page.evaluate('__viewTest.effects().transient===0&&__viewTest.effects().queued===0'));await page.clock.resume();
      await settle(page);
      // Seed a representative habitat so vegetation and new models are visible.
      await page.evaluate(`for(let i=0;i<12;i++){G.act(S,{type:'place',offer:0,cell:G.legalPlacements(S)[0]});G.endRound(S);}S.cells['3,3'].vein=true;S.cells['3,3'].farm=true;S.cells['3,3'].pond=true;S.cells['3,3'].shelter=true;S.cells['3,3'].plants=[{id:700,kind:'tree'},{id:701,kind:'crop'}];S.cells['2,3'].cancers=[{id:702,el:'wood',age:0}];mode=null;selected=null;Tokens.reset();render();`);
      await page.waitForTimeout(1300); await shot(page, `v1-${label}-habitat.png`);
      await page.locator('#btnMenu').click(); await page.locator('#btnAchievements').click();
      check(label + ' achievement book and two visions visible', await page.evaluate(`document.querySelectorAll('#achievementList .progress-card').length===12&&document.querySelectorAll('#visions .progress-card').length===2&&document.querySelector('[data-achievement="first_place"]').classList.contains('done')`));
      await shot(page, `v1-${label}-achievements.png`);
      const dialogRect=await page.evaluate(`(()=>{const r=document.querySelector('#dlgAchievements .dlg').getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right,bottom:r.bottom,viewport:innerWidth};})()`);
      check(label+' achievement dialog content fits viewport',dialogRect.width>200&&dialogRect.height>100&&dialogRect.left>=0&&dialogRect.right<=dialogRect.viewport+1&&dialogRect.bottom<=(mobile?844:900)+1);
 await page.locator('#dlgAchievements [data-close]').click();
      await page.reload(); await page.waitForFunction('typeof S!=="undefined"&&S');
      check(label + ' persisted achievement survives reload with fresh game', await page.evaluate(`achievementBook.snapshot().unlocked.includes('first_place')&&S.stats.placements===undefined`));
      // Restart cancels delayed game-over and old-session achievement toast.
      await page.evaluate(`S.over=true;gameSession++;const session=gameSession;overTimer=setTimeout(()=>{if(gameSession===session&&S.over)showOver();},900);start(99);`);
      await page.waitForTimeout(1100); check(label + ' restart cancels old settlement and effects', await page.evaluate(`!document.getElementById('over').open&&!document.querySelector('.token')&&__viewTest.effects().transient===0`));
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(`doAct({type:'place',offer:0,cell:G.legalPlacements(S)[0]})`);
      check(label + ' reduced motion counts settle without tokens', await page.evaluate(`!document.querySelector('.token')&&Number(document.getElementById('score').textContent)===G.score(S).total`));
      if(!mobile){
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.evaluate(`['mine','spring','rich','burn','merge','crystal','meteor','shield','infection','upgrade'].forEach(k=>View.fx(k,'3,3','water'));View.shieldDeploy({cells:['3,3','2,3'],defense:{water:10}});`);
        await page.waitForFunction('__viewTest.effects().transient===0&&__viewTest.effects().queued===0&&__viewTest.effects().lights===0',null,{timeout:45000});
        check('All spell and added effects release transient meshes and lights',true);
        await page.clock.pauseAt(new Date(await page.evaluate('Date.now()')+60000));
        await page.evaluate(`Tokens.enqueue(Array.from({length:250},()=>({cell:'3,3',kind:'plant'})))`);await page.clock.runFor(420);
        check('Overflow production retains 40-token cap and grouped quantities',await page.evaluate(`document.querySelectorAll('.token').length>0&&document.querySelectorAll('.token').length<=40&&Array.from(document.querySelectorAll('.token small')).some(el=>el.textContent.includes('×'))`));
        await shot(page,'v1-production-flights.png');await page.evaluate('start(81)');await page.clock.resume();
        check('Restart clears overflow token nodes',await page.evaluate(`!document.querySelector('.token')`));
      }
      if(mobile){
        await page.setViewportSize({width:320,height:700});await page.evaluate(`S.roundAP=9;S.ap=9;render()`);
        check('320px phone HUD and dock fit',await page.evaluate(`['top','dock','stageHud'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;})`));
        await page.locator('#btnMenu').click();await page.locator('#btnAchievements').click();await shot(page,'v1-phone-small-achievements.png');
        check('320px phone achievement content fits and scrolls',await page.evaluate(`(()=>{const p=document.querySelector('#dlgAchievements .dlg'),r=p.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&p.scrollHeight>p.clientHeight;})()`));
      }
      if (mobile) check('phone retains low rendering quality', await page.evaluate('__viewTest.low()'));
      await context.close();
    }
    check('No console, JS or WebGL errors', report.errors.length === 0);
  } finally {
    if (browser) await browser.close(); await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(out, 'v1-browser-report.json'), JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
