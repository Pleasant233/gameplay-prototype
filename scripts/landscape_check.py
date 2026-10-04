"""Actual rendered region growth, continuity, picking, lifecycle and captures."""
import functools
import http.server
import json
from pathlib import Path
import subprocess
import threading
from playwright.sync_api import sync_playwright
from browser_support import launch_browser

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'
OUT.mkdir(exist_ok=True)
report={'checks':[], 'errors':[], 'metrics':{}}
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}'
source=(ROOT/'view.js').read_text(encoding='utf-8').replace('    updateCam(dt);','    renderer.info.autoReset=false;renderer.info.reset();\n    updateCam(dt);').replace('    }else renderer.render(scene,camera);','    }else renderer.render(scene,camera);root.__landscapeFrame=(root.__landscapeFrame||0)+1;').replace('  root.View = {','''
  root.__stableLandscape=()=>{intro=0;cam.gR=baseR();cam.gP=.9;cam.sph.radius=cam.gR;cam.sph.phi=cam.gP;cam.sph.theta=cam.gT;cam.target.set(cam.gx,cam.gy,cam.gz);updateCam(0);};
  root.__landscapeTest={
    status(){return {frame:root.__landscapeFrame||0,regions:landscape.regions.map(r=>({family:r.family,size:r.size,level:r.level})),
      growing:Object.values(tileMap).some(n=>n.growth||n.growthPending||n.rise>0),
      memory:{...renderer.info.memory},calls:renderer.info.render.calls,particles:particles.length,
      instances:Object.values(tileMap).reduce((n,t)=>n+t.scenery.children.filter(o=>o.isInstancedMesh).reduce((n,o)=>n+o.count,0),0),
      pendingWaves:Object.values(tileMap).filter(n=>n.growth).length,
      waterPhases:waters.filter(w=>w.m.userData.landscape).map(w=>w.p)};},
    point(k){const p=wp(k,visualHeight(k,0,0)+.005);if(tileMap[k])p.y+=tileMap[k].group.position.y;p.project(camera);const r=renderer.domElement.getBoundingClientRect();return {x:(p.x*.5+.5)*r.width+r.left,y:(-p.y*.5+.5)*r.height+r.top};},
    pickCell,
    settled(){return Object.values(tileMap).every(n=>n.scenery.children.every(o=>o.scale.y===1)&&!n.growth);}
  };
  root.View = {''')
FIXTURE='''(kind) => {
  start(37);const template=JSON.parse(JSON.stringify(S.cells['3,3']));
  S=JSON.parse(JSON.stringify(S));S.cells={};
  const put=(x,z,type)=>{
    const t=JSON.parse(JSON.stringify(template));t.type=type;t.attrs=[...G.TYPE[type].attrs];
    for(const key of ['spirits','beasts','plants','animals','ores'])t[key]=[];
    t.spring=false;t.shelter=false;S.cells[G.key(x,z)]=t;
  };
  if(kind==='mixed'){
    for(let z=1;z<=4;z++)for(let x=1;x<=3;x++)put(x,z,z===1?'rainforest':'forest');
    for(let z=1;z<=3;z++)for(let x=4;x<=6;x++)put(x,z,x===6?'bare_mount':'rock_mount');
    for(let z=4;z<=5;z++)for(let x=4;x<=6;x++)put(x,z,'lake');
    for(let x=1;x<=3;x++)for(let z=5;z<=6;z++)put(x,z,'grassland');
  }else if(kind==='pair'){put(3,3,'forest');put(4,3,'forest');S.offers=['forest','lake','grassland'];}
  else {for(const [x,z] of G.SHAPE)put(x,z,kind);}
  S.ap=3;S.placed=0;S.over=false;S.events=[];mode=null;selected=null;Tokens.reset();render();
  document.querySelector('#banner').classList.remove('go');if(window.__stableLandscape)__stableLandscape();
}'''
def check(name,passed):
    assert passed,name
    report['checks'].append(name)
    print('ok - '+name,flush=True)
def settle(page):
    frame=page.evaluate('__landscapeTest.status().frame')
    page.wait_for_function('(frame)=>__landscapeTest.status().frame>=frame+2&&!__landscapeTest.status().growing',arg=frame,timeout=60000)
def capture(page,name):
    print('capture - '+name,flush=True)
    page.screenshot(path=str(OUT/(name+'.png')),timeout=60000)
try:
    with sync_playwright() as p:
        browser=launch_browser(p)
        # Same controlled map and seed, old renderer versus new renderer.
        baseline=subprocess.run(['git','show','a0d03cc:view.js'],cwd=ROOT,check=True,capture_output=True,text=True).stdout.replace('  root.View = {','  root.__stableLandscape=()=>{intro=0;cam.gR=baseR();cam.gP=.9;cam.sph.radius=cam.gR;cam.sph.phi=cam.gP;cam.sph.theta=cam.gT;cam.target.set(cam.gx,cam.gy,cam.gz);updateCam(0);};\n  root.View = {')
        before=browser.new_page(viewport={'width':1440,'height':900})
        before.route('**/view.js',lambda route:route.fulfill(body=baseline,content_type='application/javascript'))
        before.goto(url,wait_until='domcontentloaded');before.wait_for_function('typeof S!=="undefined" && S')
        before.evaluate(FIXTURE,'mixed');before.wait_for_timeout(3000);capture(before,'landscape-before-desktop');before.close()
        for mobile in [False,True]:
            label='phone' if mobile else 'desktop'
            opts={'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True,'user_agent':'iPhone Mobile'} if mobile else {'viewport':{'width':1440,'height':900}}
            page=browser.new_page(**opts)
            page.route('**/view.js',lambda route:route.fulfill(body=source,content_type='application/javascript'))
            page.on('pageerror',lambda e:report['errors'].append(str(e)))
            page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
            page.goto(url,wait_until='domcontentloaded');page.wait_for_function('typeof S!=="undefined" && S && window.__landscapeTest')
            page.evaluate(FIXTURE,'mixed');settle(page);capture(page,'landscape-after-'+label)
            status=page.evaluate('__landscapeTest.status()');report['metrics'][label+'Mixed']=status
            check(label+': 12 forests, 9 mountains and 6 lakes have distinct growth tiers',sorted((r['family'],r['size'],r['level']) for r in status['regions'])==[('forest',12,3),('lake',6,2),('meadow',6,2),('mountain',9,2)])
            check(label+': all connected water surfaces share one wave phase',len(set(status['waterPhases']))==1)
            check(label+': procedural details use instancing',status['instances']>100)
            point=page.evaluate('__landscapeTest.point("5,2")')
            check(label+': raised mountain mesh can be picked',page.evaluate('(p)=>__landscapeTest.pickCell(p.x,p.y)',point)=='5,2')
            if mobile:page.touchscreen.tap(point['x'],point['y'])
            else:page.mouse.click(point['x'],point['y'])
            check(label+': actual input selects the mountain',page.evaluate('selected==="5,2"'))
            capture(page,'landscape-selected-'+label)
            page.evaluate(FIXTURE,'pair');settle(page)
            # Real card and board click grows 2 -> 3 and preserves rule accounting.
            page.locator('[data-offer="0"]').click()
            point=page.evaluate('__landscapeTest.point("5,3")')
            if mobile:page.touchscreen.tap(point['x'],point['y'])
            else:page.mouse.click(point['x'],point['y'])
            check(label+': placement joins the forest without changing AP rules',page.evaluate('S.cells["5,3"].type==="forest" && S.ap===2 && S.placed===1'))
            # A detail-panel render during landing must not invalidate the region.
            page.evaluate('selected="3,3";render()')
            page.wait_for_function('__landscapeTest.status().pendingWaves>0',timeout=45000)
            check(label+': milestone is communicated', '连成 3 格' in page.locator('#landscapeNotice').inner_text())
            capture(page,'landscape-growth-'+label);settle(page)
            check(label+': growth wave expires and restores model scale',page.evaluate('__landscapeTest.settled()'))
            page.evaluate(FIXTURE,'forest');settle(page)
            full=page.evaluate('__landscapeTest.status()');report['metrics'][label+'FullBoard']=full
            check(label+': 85-cell canopy renders with bounded draw calls',full['regions'][0]['size']==85 and full['calls']<1900)
            capture(page,'landscape-full-'+label)
            memories=[]
            for _ in range(3):
                page.evaluate(FIXTURE,'mixed');settle(page)
                memories.append(page.evaluate('__landscapeTest.status().memory.geometries'))
            report['metrics'][label+'RebuildGeometries']=memories
            check(label+': repeated rebuilds do not accumulate geometries',max(memories)-min(memories)<=2)
            page.emulate_media(reduced_motion='reduce')
            page.evaluate(FIXTURE,'pair');page.evaluate('doAct({type:"place",offer:0,cell:"5,3"})')
            check(label+': reduced motion skips the growth wave but retains feedback',page.evaluate('__landscapeTest.status().pendingWaves===0 && document.querySelector("#landscapeNotice").textContent.includes("3 格")'))
            page.evaluate('start(99)')
            check(label+': restart clears growth and notice',page.evaluate('__landscapeTest.status().pendingWaves===0 && !document.querySelector("#landscapeNotice").classList.contains("show")'))
            page.close()
        check('Mobile reduces canopy instance count',report['metrics']['phoneFullBoard']['instances']<report['metrics']['desktopFullBoard']['instances'])
        check('No browser, shader or WebGL errors',not report['errors'])
        browser.close()
finally:
    server.shutdown();server.server_close()
    (OUT/'landscape-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
