// Capture production motion in a fresh browser context. The private probe exists only
// in this intercepted request; neither production nor root web sources are modified.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch (error) { throw new Error('Install development Playwright or set NODE_PATH to the bundled node_modules. ' + error.message); }
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts', 'web-motion-reference');
const url = process.env.MOTION_REFERENCE_URL || 'https://element-habitat.vercel.app/';
fs.mkdirSync(out, { recursive: true });
const productionView = fs.readFileSync(path.join(root, 'migration/web-reference/view.js'), 'utf8');
const view = productionView.replace('  root.View = {', `
  root.__motion = {
    stats(cell) {const n=tileMap[cell];return {effects:spellFX.length,queuedEffects:queuedFX.length,particles:particles.length,
      landingY:n?n.group.position.y:0,scaleY:n?n.group.scale.y:1,tokens:document.querySelectorAll('#tokens .token').length};},
    baseline(){intro=0;for(const f of spellFX)disposeFX(f.m);spellFX.length=0;queuedFX.length=0;particles.length=0;
      for(const n of Object.values(tileMap)){n.rise=n.pop=n.impact=0;n.group.position.y=0;n.group.scale.set(1,1,1);}shake=0;},
    draw(){if(post)post.render(scene,camera,cam.target.clone(),0);else renderer.render(scene,camera);renderer.getContext().finish();}
  };
  root.View = {`);
const report = { source: url, clock: 'Playwright virtual time; genuine rendered browser frames', frames: [], checks: [], errors: [] };
if (process.argv.includes('--phone-only')) {
  const prior = JSON.parse(fs.readFileSync(path.join(out, 'web-motion-reference.json'), 'utf8'));
  report.frames = prior.frames.filter(frame => frame.viewport !== 'phone');
  report.checks = prior.checks.filter(check => !check.startsWith('phone '));
}
const times = [0, 100, 220, 420, 600, 900, 1300, 1800, 2600];
async function advance(page, milliseconds) {
  for (let remaining = milliseconds; remaining > 0; remaining -= 20) await page.clock.fastForward(Math.min(20, remaining));
}
async function prepare(page, broad = false) {
  await page.evaluate(broad => {
    document.getElementById('scenario').value = 'standard';
    start(43); document.querySelectorAll('dialog[open]').forEach(d => d.close());
    S.cells = {};
    for (let y = 2; y <= (broad ? 6 : 4); y++) for (let x = 2; x <= (broad ? 6 : 4); x++)
      if (x !== 3 || y !== 3) S.cells[x + ',' + y] = G.makeTile('woodland_t2');
    S.ap = S.roundAP = 9; S.inv.crystal.wood = 20; S.inv.crystal.fire = 20;
    S = { ...S }; selected = null; mode = null; render(); Tokens.reset(); __motion.baseline();
    document.getElementById('banner').classList.remove('go');
  }, broad);
  await advance(page, 1000);
}
(async () => {
  let browser;
  try {
    const options = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
    if (process.env.PLAYWRIGHT_BROWSER_PATH) options.executablePath = process.env.PLAYWRIGHT_BROWSER_PATH;
    else options.channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'msedge';
    browser = await playwright.chromium.launch(options);
    if (process.argv.includes('--source-only')) {
      const page = await browser.newPage();
      // Asset retrieval does not create a second software WebGL rendering context.
      await page.route('**/view.js', route => route.abort());
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      const sources = await page.evaluate(async () => Object.fromEntries(await Promise.all(['tokens.js', 'postfx.js', 'music.js'].map(async name => {
        const response = await fetch('/' + name); if (!response.ok) throw new Error(name + ': ' + response.status);
        return [name, await response.text()];
      }))));
      for (const [name, body] of Object.entries(sources)) {
        fs.writeFileSync(path.join(root, 'migration/web-reference', name), body);
        console.log('Saved production source: ' + name + ' (' + Buffer.byteLength(body) + ' bytes)');
      }
      return;
    }
    if (process.argv.includes('--source-only')) {
      const page = await browser.newPage();
      // Asset retrieval does not create a second software WebGL rendering context.
      await page.route('**/view.js', route => route.abort());
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      const sources = await page.evaluate(async () => Object.fromEntries(await Promise.all(['tokens.js', 'postfx.js', 'music.js'].map(async name => {
        const response = await fetch('/' + name); if (!response.ok) throw new Error(name + ': ' + response.status);
        return [name, await response.text()];
      }))));
      for (const [name, body] of Object.entries(sources)) {
        fs.writeFileSync(path.join(root, 'migration/web-reference', name), body);
        console.log('Saved production source: ' + name + ' (' + Buffer.byteLength(body) + ' bytes)');
      }
      return;
    }
    for (const mobile of process.argv.includes('--phone-only') ? [true] : [false, true]) {
      const viewport = mobile ? 'phone' : 'desktop';
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile,
        ...(mobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' } : {}) });
      const page = await context.newPage(); page.setDefaultTimeout(90000);
      page.on('pageerror', error => report.errors.push(error.message));
      await page.route('**/view.js', route => route.fulfill({ body: view, contentType: 'application/javascript' }));
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction('typeof S!=="undefined" && S && document.querySelector("#world canvas") && window.__motion');
      await page.waitForTimeout(1200); await page.clock.install();
      await page.clock.pauseAt(new Date(await page.evaluate('Date.now()') + 1000));
      for (const scenario of ['placement', 'crystal', 'shield-deploy', 'meteor', 'guardian-merge', 'guardian-move']) {
        await prepare(page, scenario === 'meteor');
        const cell = scenario === 'placement' ? '5,3' : '3,2';
        await page.evaluate(scenario => {
          let ok = true;
          if (scenario === 'placement') { S.offers[0] = 'woodland_t2'; ok = doAct({ type: 'place', offer: 0, cell: '5,3' }); }
          if (scenario === 'crystal') { S.cells['3,2'].attrs[1] = 0; render(); ok = doAct({ type: 'useCrystal', cell: '3,2', el: 'wood' }); }
          if (scenario === 'shield-deploy') {
            S.inv.shields.push({ id: 900, coverage: 8, defense: { metal: 0, wood: 0, water: 0, fire: 30, earth: 0 } });
            ok = doAct({ type: 'deployShield', shieldId: 900, cell: '3,2' });
          }
          if (scenario === 'meteor') {
            S.round = 4; S.placed = 1; S.nextEvent = { id: 'meteor', el: 'fire' };
            for (const tile of Object.values(S.cells)) tile.attrs[3] = 8;
            S.shields = [{ id: 901, cells: Object.keys(S.cells).slice(0, 12), coverage: 12, defense: { metal: 0, wood: 0, water: 0, fire: 90, earth: 0 } }];
            render(); document.getElementById('btnEnd').onclick();
          }
          if (scenario === 'guardian-merge') {
            S.cells['3,2'].beasts = D.ELEMENTS.map((el, i) => ({ id: 9000 + i, el: el.key, age: 0 })); render();
            ok = doAct({ type: 'mergeGuardian', cell: '3,2', beastIds: [9000, 9001, 9002, 9003, 9004] });
          }
          if (scenario === 'guardian-move') {
            S.cells['2,2'].guardians = [{ id: 9500, power: { metal: 1, wood: 1, water: 1, fire: 1, earth: 1 } }]; S.placed = 1; render();
            ok = doAct({ type: 'moveGuardian', from: '2,2', to: '3,2', guardianId: 9500 });
          }
          if (!ok) throw new Error('Production action failed: ' + scenario);
        }, scenario);
        const samples = scenario === 'meteor' ? [...times, 3600, 5000, 6500] : times;
        let elapsed = 0;
        for (let index = 0; index < samples.length; index++) {
          await advance(page, samples[index] - elapsed); elapsed = samples[index];
          const image = `${viewport}/${scenario}/${String(index).padStart(2, '0')}-${String(elapsed).padStart(4, '0')}ms.png`;
          fs.mkdirSync(path.dirname(path.join(out, image)), { recursive: true });
          const statistics = await page.evaluate(cell => { __motion.draw(); return __motion.stats(cell); }, cell);
          await page.screenshot({ path: path.join(out, image) });
          report.frames.push({ image, viewport, scenario, seconds: elapsed / 1000, ...statistics });
        }
        report.checks.push(`${viewport} ${scenario}: production action and ${samples.length} genuine rendered frames`);
        fs.writeFileSync(path.join(out, 'web-motion-reference.json'), JSON.stringify(report, null, 2));
      }
      await context.close();
    }
    assert.deepEqual(report.errors, []);
  } finally {
    if (browser) await browser.close();
    if (!process.argv.includes('--source-only')) fs.writeFileSync(path.join(out, 'web-motion-reference.json'), JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
