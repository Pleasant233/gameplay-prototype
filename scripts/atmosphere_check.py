"""Render checks and comparison captures for bloom and aperture depth of field."""
import argparse
import functools
import http.server
import io
import json
from pathlib import Path
import threading
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
from browser_support import launch_browser, capture_source, capture_frame

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'
OUT.mkdir(exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('--url')
args=parser.parse_args()
report={'checks':[], 'errors':[]}
server=None
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
if not args.url:
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
url=args.url or f'http://127.0.0.1:{server.server_port}'
report['url']=url

# The probes and component isolation are injected only into the test browser.
post_source=(ROOT/'postfx.js').read_text(encoding='utf-8').replace(
    'const api={enabled:true,depthSupported,resize,render,dispose};',
    'const api={enabled:true,depthSupported,resize,render,dispose,_test:{sceneTarget,bright,blurA,blurB,combine}};')
view_source=capture_source((ROOT/'view.js').read_text(encoding='utf-8'))
delta_source='const elapsed=Math.max(0,clock.getDelta()),dt=Math.min(.05,elapsed);'
assert delta_source in view_source, 'Update the test freeze hook when the renderer clock changes'
view_source=view_source.replace(delta_source,'const elapsed=root.__freezeAtmosphere!=null?0:Math.max(0,clock.getDelta()),dt=Math.min(.05,elapsed);')
view_source=view_source.replace('const time = clock.elapsedTime;','const time = root.__freezeAtmosphere!=null?root.__freezeAtmosphere:clock.elapsedTime;')
view_source=view_source.replace('const now=performance.now()/1000;','const now=root.__freezePerformance!=null?root.__freezePerformance:performance.now()/1000;')
view_source=view_source.replace('  root.View = {','''
  root.__atmosphere={
    prepare(){intro=0;cam.gR=baseR();cam.gP=.9;cam.sph.radius=cam.gR;cam.sph.phi=.9;updateCam(0);},
    freeze(){root.__freezeAtmosphere=clock.elapsedTime;root.__freezePerformance=performance.now()/1000;shake=0;},
    unfreeze(){delete root.__freezeAtmosphere;delete root.__freezePerformance;clock.getDelta();},
    configure(bloom,depth,vignette){const u=post._test.combine.uniforms;u.bloomStrength.value=bloom;u.depthEnabled.value=depth;u.vignette.value=vignette;},
    status(){const t=post._test,u=t.combine.uniforms;return {enabled:post.enabled,depth:post.depthSupported,focus:u.focusDepth.value,focusUv:{x:u.focusUv.value.x,y:u.focusUv.value.y},size:[t.sceneTarget.width,t.sceneTarget.height],bloomSize:[t.bright.width,t.bright.height],samples:t.sceneTarget.samples||0,memory:{...renderer.info.memory},falling:Object.values(tileMap).some(n=>n.rise>0)};},
    point(k){const p=wp(k,visualHeight(k,0,0)+.005);p.project(camera);return {x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight};}
  };
  root.View = {''')
SETUP='''() => {
  start(37);
  for(let r=0;r<14;r++){
    const f=k=>G.parse(k).reduce((n,v)=>n+Math.abs(v-3),0);
    const cell=G.legalPlacements(S).sort((a,b)=>f(a)-f(b))[0];
    G.act(S,{type:'place',offer:0,cell});G.endRound(S);
  }
  S={...S};S.events=[];mode=null;selected=null;Tokens.reset();render();__atmosphere.prepare();
}'''
def check(name,passed):
    assert passed,name
    report['checks'].append(name)
    print('ok - '+name,flush=True)
def capture(page,name):
    page.wait_for_timeout(250)
    data=capture_frame(page,OUT/(name+'.png'))
    return Image.open(io.BytesIO(data)).convert('RGB')
def difference(a,b,box=None):
    if box:a,b=a.crop(box),b.crop(box)
    return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3

try:
    with sync_playwright() as p:
        browser=launch_browser(p)
        page=browser.new_page(viewport={'width':1440,'height':900})
        def prepare(page,effect_source=post_source):
            page.route('**/postfx.js',lambda route:route.fulfill(body=effect_source,content_type='application/javascript'))
            page.route('**/view.js',lambda route:route.fulfill(body=view_source,content_type='application/javascript'))
            page.on('pageerror',lambda error:report['errors'].append(str(error)))
            page.on('console',lambda message:report['errors'].append(message.text) if message.type=='error' else None)
            page.goto(url,wait_until='domcontentloaded',timeout=60000)
            page.wait_for_function('typeof S!="undefined" && S && window.__atmosphere')
            page.evaluate(SETUP)
            page.wait_for_function('!__atmosphere.status().falling',timeout=20000)
            page.wait_for_timeout(1800)
        prepare(page)
        status=page.evaluate('__atmosphere.status()')
        check('Desktop uses resolved depth and a quarter-resolution bloom buffer',status['depth'] and status['samples']==2 and status['bloomSize']==[360,225])
        page.evaluate('__atmosphere.freeze();__atmosphere.configure(0,0,0)')
        base=capture(page,'atmosphere-baseline')
        page.evaluate('View.setAtmosphere(false)')
        plain=capture(page,'atmosphere-plain')
        point=page.evaluate('__atmosphere.point("3,3")')
        px=int(point['x']);py=int(point['y'])
        report['surfacePrecisionDifference']=difference(base,plain,(px-7,py-7,px+7,py+7))
        check('Depth precision preserves thin surfaces without striping',report['surfacePrecisionDifference']<1.0)
        page.evaluate('View.setAtmosphere(true)')
        page.evaluate('__atmosphere.configure(.18,0,0)')
        bloom=capture(page,'atmosphere-bloom')
        # Positive glow should brighten selected highlights rather than replacing the frame.
        brightening=sum(ImageStat.Stat(bloom).mean)-sum(ImageStat.Stat(base).mean)
        report['bloomBrightening']=brightening
        check('Bloom measurably brightens the rendered highlights',brightening>.1)
        page.evaluate('__atmosphere.configure(0,1,0)')
        dof=capture(page,'atmosphere-dof')
        status=page.evaluate('__atmosphere.status()')
        cx=int(status['focusUv']['x']*1440);cy=int((1-status['focusUv']['y'])*900)
        center=(cx-15,cy-15,cx+15,cy+15)
        report['sharpCenterDifference']=difference(base,dof,center)
        report['defocusedDifference']=difference(base,dof,(350,180,1090,260))
        check('Aperture blur changes the distant scene while preserving the sharp center',report['sharpCenterDifference']<.5 and report['defocusedDifference']>.1)
        page.evaluate('__atmosphere.configure(.18,1,.065)')
        capture(page,'atmosphere-desktop')
        page.evaluate('__atmosphere.unfreeze()')
        point=page.evaluate('__atmosphere.point("3,3")')
        page.mouse.click(point['x'],point['y'])
        check('Picking still selects the rendered tile with atmosphere enabled',page.evaluate('selected==="3,3"'))
        page.wait_for_timeout(1200)
        first=page.evaluate('__atmosphere.status().focus')
        # Select a farther tile; the focal plane must follow it rather than the screen center.
        page.evaluate('selected="3,1";render()')
        # Wait for actual focus movement instead of assuming a software GPU
        # can draw enough interpolation frames in 1.2 seconds.
        page.wait_for_function('(before)=>Math.abs(__atmosphere.status().focus-before)>.1', arg=first, timeout=30000)
        second=page.evaluate('__atmosphere.status().focus')
        check('Focus follows a changed tile selection',abs(first-second)>.1)
        page.locator('#btnMenu').click()
        page.locator('#btnAtmosphere').click()
        check('Menu turns atmosphere off and stores the preference',page.evaluate('!__atmosphere.status().enabled && localStorage.getItem("atmosphere")==="0"') and page.locator('#btnAtmosphere').get_attribute('aria-pressed')=='false')
        page.locator('#dlgMenu [data-close]').click()
        capture(page,'atmosphere-off')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('typeof S!="undefined" && S && window.__atmosphere')
        check('Reload preserves the atmosphere preference',page.evaluate('!__atmosphere.status().enabled'))
        page.locator('#btnMenu').click();page.locator('#btnAtmosphere').click();page.locator('#dlgMenu [data-close]').click()
        page.wait_for_timeout(300)
        memory=page.evaluate('__atmosphere.status().memory')
        for width,height in [(1000,760),(1200,800),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(350)
        status=page.evaluate('__atmosphere.status()')
        check('Resize updates the render targets without growing the texture count',status['size']==[1440,900] and status['memory']['textures']==memory['textures'])
        page.close()

        phone=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')
        prepare(phone)
        status=phone.evaluate('__atmosphere.status()')
        check('Phone uses the cheaper pipeline without multisampling',status['depth'] and status['samples']==0 and status['size']==[390,844])
        capture(phone,'atmosphere-phone')
        point=phone.evaluate('__atmosphere.point("3,3")')
        phone.touchscreen.tap(point['x'],point['y'])
        check('Phone touch selects a tile with atmosphere enabled',phone.evaluate('selected==="3,3"'))
        phone.locator('#btnMenu').click();phone.locator('#btnAtmosphere').click()
        check('Phone atmosphere control remains visible and usable',phone.evaluate('!__atmosphere.status().enabled'))
        phone.close()
        fallback=browser.new_page(viewport={'width':800,'height':600})
        fallback_source=post_source.replace("const depthSupported=renderer.capabilities.isWebGL2||renderer.extensions.has('WEBGL_depth_texture');",'const depthSupported=false;')
        prepare(fallback,fallback_source)
        check('Simulated lack of depth textures keeps the bloom pipeline running',fallback.evaluate('__atmosphere.status().enabled && !__atmosphere.status().depth'))
        fallback.close()
        check('No browser, shader or framebuffer errors',not report['errors'])
        browser.close()
finally:
    if server:server.shutdown()
    (OUT/'atmosphere-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
