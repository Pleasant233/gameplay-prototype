"""Element Habitat regression: real magic buttons and round-10 fire meteor effects."""
import argparse, functools, http.server, json, threading
from pathlib import Path
from datetime import timedelta
from playwright.sync_api import sync_playwright
from browser_support import launch_browser, capture_frame, capture_source
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=None
if not args.url:
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
url=args.url or f'http://127.0.0.1:{server.server_port}'
report={'url':url,'checks':[],'errors':[],'testProbes':not bool(args.url)}
source=capture_source((ROOT/'view.js').read_text()).replace('  root.View = {','''
  root.__gameplayFX=()=>({active:spellFX.length,pending:queuedFX.length,particles:particles.length,cleanWater:!!tileMap['4,3']&&tileMap['4,3'].scenery.children.some(o=>o.material===mats.water)});
  root.View = {''')
def check(name,value):
    assert value,name
    report['checks'].append(name);print('ok - '+name,flush=True)

try:
    with sync_playwright() as p:
        browser=launch_browser(p)
        for mobile in [False,True]:
            label='phone' if mobile else 'desktop'
            opts={'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True,'user_agent':'iPhone Mobile'} if mobile else {'viewport':{'width':1440,'height':900}}
            page=browser.new_page(**opts)
            if not args.url:page.route('**/view.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
            page.on('pageerror',lambda e:report['errors'].append(str(e)))
            page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
            page.clock.install();page.goto(url,wait_until='domcontentloaded');page.wait_for_function('typeof S!=="undefined" && S')
            check(label+': correct title and current gameplay APIs loaded',page.title()=='元素生境' and page.evaluate('D.RULES.meteorEvery===10 && typeof G.magicUnlocked==="function" && typeof View.meteorRain==="function"'))
            page.evaluate("start(37);for(const t of Object.values(S.cells))t.attrs=[0,0,0,0,0];render()")
            check(label+': mine magic starts locked',page.locator('[data-magic="mine"]').is_disabled())
            page.evaluate("for(const t of Object.values(S.cells))t.attrs[0]=4;S.inv.crystal.water=1;G.act(S,{type:'useCrystal',cell:'3,3',el:'water'});render()")
            check(label+': unlocked magic still requires placement',page.locator('[data-magic="mine"]').is_disabled())
            page.evaluate("G.act(S,{type:'place',offer:0,cell:G.legalPlacements(S)[0]});selected='3,3';render()")
            check(label+': magic becomes available after placement',page.locator('[data-magic="mine"]').is_enabled())
            page.locator('[data-magic="mine"]').click()
            check(label+': real magic button adds 5 metal, vein and costs one AP',page.evaluate("S.cells['3,3'].attrs[0]===9 && S.cells['3,3'].vein && S.ap===1 && S.magicUsed.mine"))
            check(label+': same magic cannot cast twice in a round',page.locator('[data-magic="mine"]').is_disabled())
            page.evaluate("start(38);G.act(S,{type:'place',offer:0,cell:G.legalPlacements(S)[0]});for(const t of Object.values(S.cells)){t.attrs=[0,0,0,0,0];t.cancers=[];}S.cells['3,3'].attrs[2]=-6;S.cells['4,3'].type='polluted_lake';S.cells['4,3'].attrs[1]=-2;S.cells['4,3'].cancers=[{id:999,el:'wood',age:0}];selected='3,3';render()")
            page.locator('[data-magic="purify"]').click()
            check(label+': area purify clears neighbor cancer and adds 5 to negatives',page.evaluate("S.cells['3,3'].attrs[2]===-1 && S.cells['4,3'].attrs[1]===3 && S.cells['4,3'].cancers.length===0"))
            if not args.url:
                check(label+': purified connected water uses clean water material',page.evaluate('__gameplayFX().cleanWater'))
                capture_frame(page,OUT/f'current-gameplay-magic-{label}.png')
            # Search a deterministic natural round-10 fixture, without changing RNG or rules.
            seed=page.evaluate('''()=>{
              for(let seed=1;seed<=100;seed++){
                const s=G.newGame(seed);
                for(let round=1;round<=10;round++){
                  G.act(s,{type:'place',offer:0,cell:G.legalPlacements(s)[0]});
                  if(round===10){const preview=structuredClone(s);G.endRound(preview);if(preview.lastMeteor.el==='fire'){S=s;selected=null;mode=null;Tokens.reset();render();return seed;}break;}
                  G.endRound(s);
                }
              }
              throw Error('no fire fixture');
            }''')
            page.wait_for_timeout(1400)
            # Keep the actual renderer's meteor meshes on screen for the capture.
            now=page.evaluate('Date.now()')
            from datetime import datetime,timezone
            page.clock.pause_at(datetime.fromtimestamp(now/1000,timezone.utc)+timedelta(minutes=1))
            page.locator('#btnEnd').click(force=True)
            check(label+': real end-round button triggers connected fire rain',page.evaluate("S.round===11 && S.lastMeteor.round===10 && S.lastMeteor.el==='fire' && S.lastMeteor.cells.length===5 && S.events.filter(e=>e.kind==='meteor').every(e=>e.damage===3)"))
            check(label+': fire rain is announced in UI and log', '火陨星雨' in page.locator('#banTxt').inner_text() and '火陨石雨' in page.locator('#log').inner_text())
            page.clock.fast_forward(1000)
            if not args.url:
                check(label+': meteor warning, falling meshes and queued impacts are active',page.evaluate('__gameplayFX().active>0 && __gameplayFX().pending>0'))
                capture_frame(page,OUT/f'current-gameplay-fire-rain-{label}.png',advance=False)
            page.clock.fast_forward(1700)
            if not args.url:check(label+': scheduled meteor impacts run and the queue drains',page.evaluate('__gameplayFX().pending===0 && __gameplayFX().active>0'))
            page.clock.fast_forward(2800)
            if not args.url:check(label+': meteor effects finish and dispose',page.evaluate('__gameplayFX().active===0 && __gameplayFX().pending===0'))
            page.clock.resume()
            check(label+': new scenario, shield composer and achievement book remain available',page.locator('#scenario option').count()==3 and page.locator('#btnShield').count()==1 and page.locator('#btnAchievements').count()==1)
            report[label+'FireSeed']=seed
            page.close()
        check('No browser or WebGL errors',not report['errors']);browser.close()
finally:
    if server:server.shutdown();server.server_close()
    (OUT/('current-gameplay-production.json' if args.url else 'current-gameplay-local.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
