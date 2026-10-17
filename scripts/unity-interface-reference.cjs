// Fresh production UI/camera evidence. The private camera reader is injected only into
// the browser response. Existing migration snapshots and manifests are never rewritten.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const snapshot = process.argv.includes('--snapshot');
const out = path.join(root, 'artifacts', snapshot ? 'web-interface-snapshot' : 'web-interface-reference');
const base = process.env.INTERFACE_REFERENCE_URL || 'https://element-habitat.vercel.app/';
fs.mkdirSync(out, { recursive: true });
const report = { source: snapshot ? 'author-confirmed migration/web-reference 2026-10-17' : base, checkedAt: new Date().toISOString(), capture: 'CSS animations fast-forwarded to final pose for still layout evidence; world rendering remains genuine', sources: [], frames: [], camera: [], errors: [] };
const save = () => fs.writeFileSync(path.join(out, 'web-interface-reference.json'), JSON.stringify(report, null, 2));
const selectors = ['#top', '#formulaHud', '#stageHud', '#dock', '#offers', '#magicTray', '#btnEnd', '#detail', '#bag', '#corner', '#journey', '#dlgMenu', '[data-offer="0"]', '[data-magic="purify"]'];
async function capture(page, viewport, scenario) {
  await page.waitForTimeout(450); // Let CSS open/close transitions reach their final bounds.
  const name = viewport + '-' + scenario + '.png';
  await page.screenshot({ path: path.join(out, name), animations: 'disabled' });
  const values = await page.evaluate(selectors => selectors.map(selector => {
    const e = document.querySelector(selector); if (!e) return { selector, exists: false };
    const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    return { selector, x: r.x, y: r.y, width: r.width, height: r.height, visible: r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none', text: e.textContent.trim().slice(0, 350), background: c.backgroundColor, fontSize: c.fontSize };
  }), selectors);
  report.frames.push({ viewport, scenario, image: name, bounds: values });
  save();
  console.log('Captured ' + viewport + ' ' + scenario);
}
async function camera(page, label) { report.camera.push({ label, ...await page.evaluate(() => __interface.camera()) }); }
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    let liveView;
    for (const phone of [false, true]) {
      const viewport = phone ? 'phone' : 'desktop';
      const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
      const page = await context.newPage(); page.setDefaultTimeout(60000);
      if (snapshot) await page.route('**/*', route => {
        const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
        const local = path.join(root, 'migration', 'web-reference', name);
        if (fs.existsSync(local) && fs.statSync(local).isFile()) return route.fulfill({ path: local });
        return route.continue();
      });
      page.on('pageerror', e => report.errors.push(e.message));
      await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction('window.View && typeof S!=="undefined" && S');
      if (!phone) {
        const sources = await page.evaluate(async () => Object.fromEntries(await Promise.all(['index.html','game.js','data.js','terrain.js','journey-ui.js','tokens.js','postfx.js','music.js','view.js'].map(async name => { const r = await fetch('/' + name + '?unity-interface=' + Date.now(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }); return [name, { status: r.status, url: r.url, headers: Object.fromEntries(r.headers.entries()), text: await r.text() }]; }))));
        liveView = sources['view.js'].text;
        for (const [name, value] of Object.entries(sources)) {
          const { text, status, url, headers } = value;
          const hash = crypto.createHash('sha256').update(text).digest('hex');
          const priorPath = path.join(root, 'migration', 'web-reference', name);
          const prior = fs.existsSync(priorPath) ? crypto.createHash('sha256').update(fs.readFileSync(priorPath)).digest('hex') : null;
          report.sources.push({ file: name, status, url, headers, sha256: hash, snapshotSha256: prior, matchesSnapshot: status === 200 && hash === prior });
          if (hash !== prior) fs.writeFileSync(path.join(out, 'live-' + name), text);
        }
        save();
      }
      await page.route('**/view.js', route => route.fulfill({ contentType: 'application/javascript', body: liveView.replace('  root.View = {', '  root.__interface={camera(){return {radius:cam.sph.radius,phi:cam.sph.phi,theta:cam.sph.theta,target:cam.target.toArray(),goal:[cam.gx,cam.gy,cam.gz],goalRadius:cam.gR,goalPhi:cam.gP,goalTheta:cam.gT}}};\n  root.View = {') }));
      await page.reload({ waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction('window.View && window.__interface && typeof S!=="undefined" && S');
      await page.waitForTimeout(3000);
      await capture(page, viewport, 'initial');
      await page.locator('#btnMenu').click(); await capture(page, viewport, 'menu');
      await page.locator('#dlgMenu [data-close]').click();
      await page.evaluate(() => { document.getElementById('scenario').value = 'standard'; start(43); });
      await page.waitForTimeout(2500); await capture(page, viewport, 'hud');
      await page.locator('[data-offer="0"]').click(); await capture(page, viewport, 'offer');
      await page.keyboard.press('Escape');
      const pos = await page.evaluate(() => View.project('3,2'));
      await page.mouse.click(pos.x, pos.y); await capture(page, viewport, 'detail');
      await page.keyboard.press('Escape');
      await page.locator('#btnBag').click(); await capture(page, viewport, 'bag');
      await page.locator('#btnBag').click();
      if (!await page.locator('[data-magic="purify"]').isDisabled()) await page.locator('[data-magic="purify"]').click();
      await capture(page, viewport, 'magic');
      await page.keyboard.press('Escape');
      await page.locator('#btnMenu').click(); await capture(page, viewport, 'settings');
      await page.locator('#dlgMenu [data-close]').click();
      if (!phone) {
        await page.locator('#world').click({ position: { x: 1400, y: 450 } });
        await camera(page, 'desktop baseline');
        await page.mouse.move(1050, 400); await page.mouse.down(); await page.mouse.move(1150, 440, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1000); await camera(page, 'desktop left drag +100,+40');
        await page.mouse.wheel(0, 120); await page.waitForTimeout(1000); await camera(page, 'desktop wheel +120');
        await page.keyboard.press('Space'); await page.waitForTimeout(1000); await camera(page, 'desktop space reset');
      }
      await context.close();
    }
  } catch (e) { report.errors.push(e.stack); process.exitCode = 1; }
  finally { if (browser) await browser.close(); fs.writeFileSync(path.join(out, 'web-interface-reference.json'), JSON.stringify(report, null, 2)); }
})();
