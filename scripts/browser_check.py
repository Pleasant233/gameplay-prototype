"""Headless Chromium/Edge integration checks; see docs/CODEX-CLOUD.md."""
import functools
import http.server
import json
from pathlib import Path
import threading
import time
import sys
from datetime import datetime, timezone, timedelta

from playwright.sync_api import sync_playwright
from browser_support import launch_browser, capture_source, capture_frame

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


source = capture_source((ROOT / 'view.js').read_text(encoding='utf-8'))
# Test-only inspection: the shipped View API stays small.
source = source.replace('  root.View = {', '''
  root.__viewTest={
    prepare(){intro=0;cam.gR=baseR();cam.gP=.9;cam.sph.radius=cam.gR;cam.sph.phi=.9;updateCam(0);},
    pickCell, tiles:()=>tileMap,
    meshParent(k){return tileMap[k].terrain.parent===tileMap[k].group;},
    point(k,x=0,z=0){const n=tileMap[k],p=wp(k,surfaceHeight(k,x,z)+0.005);p.x+=x;p.z+=z;if(n)p.applyMatrix4(new THREE.Matrix4().makeTranslation(0,n.group.position.y,0));p.project(camera);const r=renderer.domElement.getBoundingClientRect();return {x:(p.x/2+0.5)*r.width+r.left,y:(-p.y/2+0.5)*r.height+r.top};},
    effects(){return {transient:spellFX.length,lights:lights.filter(f=>f.t<0.4).length,particles:particles.length,rings:rings.length,falling:Object.values(tileMap).some(n=>n.rise>0)};},
    memory(){return {...renderer.info.memory};}
  };
  root.View = {''')

SETUP = '''() => {
  start(37);
  for(let r=0;r<14;r++){
    const cell=G.legalPlacements(S).sort((a,b)=>{const f=k=>G.parse(k).reduce((n,v)=>n+Math.abs(v-3),0);return f(a)-f(b);})[0];
    G.act(S,{type:'place',offer:0,cell});G.endRound(S);
  }
  S={...S};S.events=[];mode=null;selected=null;Tokens.reset();render();__viewTest.prepare();
}'''

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}'
report = {'browser': 'Headless Chromium / SwiftShader', 'checks': [], 'errors': []}
phone_only='--phone-only' in sys.argv
if phone_only and (OUT/'browser-report.json').exists():
    report=json.loads((OUT/'browser-report.json').read_text(encoding='utf-8'))
    report['checks']=list(dict.fromkeys(report['checks']))


def check(name, passed):
    assert passed, name
    if name not in report['checks']:
        report['checks'].append(name)
    print('ok - '+name, flush=True)


def pause_animation(page):
    # Use the browser's current clock, including earlier run_for advances.
    now = datetime.fromtimestamp(page.evaluate('Date.now()') / 1000, timezone.utc)
    # pause_at skips due timers once, so this margin does not run a minute of
    # frames. It allows slow software-renderer protocol round trips to finish.
    page.clock.pause_at(now + timedelta(minutes=1))


try:
    with sync_playwright() as p:
        browser = launch_browser(p)
        report['browser'] = f'Chromium {browser.version} / SwiftShader'
        if not phone_only:
            page = browser.new_page(viewport={'width': 1440, 'height': 900})
            page.route('**/view.js', lambda route: route.fulfill(body=source, content_type='application/javascript'))
            page.on('pageerror', lambda e: report['errors'].append(str(e)))
            page.on('console', lambda m: report['errors'].append(m.text) if m.type == 'error' else None)
            page.clock.install()
            page.goto(url)
            page.wait_for_timeout(2500)
            page.evaluate(SETUP)
            page.wait_for_function('__viewTest.effects().rings===0 && !__viewTest.effects().falling', timeout=15000)
            page.wait_for_timeout(1500)
            check('Terrain retains its per-cell transform', page.evaluate("__viewTest.meshParent('3,3')"))
            capture_frame(page, OUT / 'desktop-midgame.png')

            point = page.evaluate("__viewTest.point('3,3',0.12,0.1)")
            check('Ray picks the projected cell', page.evaluate('(p)=>__viewTest.pickCell(p.x,p.y)', point) == '3,3')
            page.mouse.click(point['x'], point['y'])
            page.wait_for_timeout(450)
            check('Real pointer click selects the tile', page.evaluate("selected==='3,3'"))
            check('Shader selection band is visible', page.evaluate("__viewTest.tiles()['3,3'].frame.visible"))
            capture_frame(page, OUT / 'desktop-selected.png')

            page.keyboard.press('Escape')
            page.locator('[data-offer="0"]').click()
            cell = page.evaluate('G.legalPlacements(S)[0]')
            point = page.evaluate('(k)=>__viewTest.point(k)', cell)
            page.mouse.move(point['x'], point['y'])
            page.wait_for_timeout(120)
            capture_frame(page, OUT / 'placement-hover.png')
            before_left = page.locator('#left').inner_text()
            pause_animation(page)
            page.mouse.click(point['x'], point['y'])
            check('Pointer places the offered tile', page.evaluate('(k)=>!!S.cells[k]', cell))
            check('Space count waits for the flight', page.locator('#left').inner_text() == before_left)
            page.clock.resume()
            page.wait_for_function("Number(document.getElementById('left').textContent)===G.emptyKeys(S).length", timeout=30000)
            check('Space count settles correctly', page.evaluate("Number(document.getElementById('left').textContent)===G.emptyKeys(S).length"))

            # Capture actual settlement flights, including crystals and spirits.
            page.evaluate('''() => {
              for(const t of Object.values(S.cells))t.spirits.forEach(sp=>sp.age=D.RULES.spiritCrystalEvery-1);
              if(S.placed===0)G.act(S,{type:'place',offer:0,cell:G.legalPlacements(S)[0]});
              Tokens.reset();render();
            }''')
            before = page.evaluate("Number(document.getElementById('score').textContent)")
            pause_animation(page)
            # The frozen clock cannot advance the actionability animation check.
            # force still sends a real button click; the visible button is fixed.
            page.locator('#btnEnd').click(force=True)
            check('Score waits for arriving production tokens', page.evaluate("Number(document.getElementById('score').textContent)") == before)
            page.clock.run_for(420)
            count = page.locator('.token').count()
            check('Production tokens visibly fly with a 40-token cap', 0 < count <= 40)
            capture_frame(page, OUT / 'round-tokens.png', advance=False)
            page.clock.resume()
            page.wait_for_function("Number(document.getElementById('score').textContent)===G.score(S).total && !document.querySelector('.token')", timeout=30000)
            check('All delayed counters settle to the game state', page.evaluate("Number(document.getElementById('score').textContent)===G.score(S).total && Number(document.getElementById('bagCount').textContent)===Object.values(S.inv.crystal).reduce((a,b)=>a+b,0)+Object.values(S.inv.bigCrystal).reduce((a,b)=>a+b,0)+Object.values(S.inv.ore).reduce((a,b)=>a+b,0)+S.inv.wood+S.inv.bucket+S.inv.charm"))
            check('No flight nodes remain after settlement', page.locator('.token').count() == 0)

            for kind in ['purify', 'mine', 'spring', 'rich', 'burn', 'merge', 'crystal']:
                page.evaluate('(kind)=>View.fx(kind,"3,3","water")', kind)
                page.wait_for_timeout(300)
                capture_frame(page, OUT / f'fx-{kind}.png')
                # Software WebGL can need more wall time to draw the animation frames.
                page.wait_for_function('__viewTest.effects().transient===0 && __viewTest.effects().lights===0', timeout=45000)
                check(f'{kind} transient meshes and lights expire', page.evaluate('__viewTest.effects().transient===0 && __viewTest.effects().lights===0'))

            pause_animation(page)
            page.evaluate('''() => {
              S.inv.crystal.water=1;S.ap=3;S.placed=1;render();
              doAct({type:'useCrystal',cell:'3,3',el:'water',big:false});
            }''')
            page.clock.run_for(220)
            check('Crystal consumption flies from the HUD to the tile', page.locator('.token').count() > 0)
            check('Crystal use preserves action points', page.evaluate('S.ap===3'))
            capture_frame(page, OUT / 'crystal-down.png', advance=False)
            page.clock.resume()
            page.wait_for_timeout(2100)

            # Overflow grouping, rapid actions, and restart must never leave stale numbers.
            # Freeze the inspected frame: software rendering may finish the flight
            # between two protocol reads when the clock is left running.
            pause_animation(page)
            page.evaluate('Tokens.enqueue(Array.from({length:250},()=>({cell:"3,3",kind:"plant"})))')
            page.clock.run_for(350)
            check('Overflow receipts merge into at most 40 nodes', 0 < page.locator('.token').count() <= 40)
            check('Merged receipts show their quantity', page.locator('.token small').filter(has_text='×').count() > 0)
            page.evaluate('start(99)')
            page.clock.resume()
            page.wait_for_timeout(1500)
            check('Restart clears flights and transient effects', page.locator('.token').count() == 0 and page.evaluate('__viewTest.effects().transient===0'))

            page.emulate_media(reduced_motion='reduce')
            page.evaluate('doAct({type:"place",offer:0,cell:G.legalPlacements(S)[0]})')
            check('Reduced motion settles counters without flight nodes', page.locator('.token').count() == 0 and page.evaluate("Number(document.getElementById('score').textContent)===G.score(S).total"))
            page.emulate_media(reduced_motion='no-preference')

            page.close()

        phone = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True,
                                 user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')
        phone.route('**/view.js', lambda route: route.fulfill(body=source, content_type='application/javascript'))
        phone.on('pageerror', lambda e: report['errors'].append(str(e)))
        phone.on('console', lambda m: report['errors'].append(m.text) if m.type == 'error' else None)
        phone.goto(url, wait_until="domcontentloaded")
        phone.wait_for_timeout(2500)
        phone.evaluate(SETUP)
        phone.wait_for_function("!__viewTest.effects().falling", timeout=15000)
        phone.wait_for_timeout(1200)
        capture_frame(phone, OUT / 'phone-midgame.png')
        point = phone.evaluate("__viewTest.point('3,3',0.12,0.1)")
        phone.touchscreen.tap(point['x'], point['y'])
        phone.wait_for_timeout(450)
        check('Phone touch selects the tile', phone.evaluate("selected==='3,3'"))
        check('Phone HUD and bottom controls fit within viewport', phone.evaluate("['top','dock'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight+1;})"))
        capture_frame(phone, OUT / 'phone-selected.png')
        phone.evaluate('View.fx("burn","3,3")')
        check('Mobile quality omits transient point lights', phone.evaluate('__viewTest.effects().lights===0'))
        phone.wait_for_timeout(1600)
        check('No browser or WebGL errors', not report['errors'])
        browser.close()
finally:
    server.shutdown()
    (OUT / 'browser-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')

print(json.dumps(report, indent=2))
