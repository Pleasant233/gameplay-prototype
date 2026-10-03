"""Quick setup check: start the real game and capture its WebGL canvas."""
import functools
import http.server
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright
from browser_support import launch_browser

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = http.server.ThreadingHTTPServer(
    ('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
report = {'checks': [], 'errors': []}
try:
    with sync_playwright() as p:
        with launch_browser(p) as browser:
            page = browser.new_page(viewport={'width': 1440, 'height': 900})
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            page.on('console', lambda message: report['errors'].append(message.text) if message.type == 'error' else None)
            page.goto(f'http://127.0.0.1:{server.server_port}', wait_until='domcontentloaded')
            page.wait_for_function('typeof S!=="undefined" && S && window.View && document.querySelector("#world canvas")')
            page.evaluate('start(37)')
            page.wait_for_timeout(1500)
            status = page.evaluate('''() => {
              const c=document.querySelector('#world canvas');
              const gl=c.getContext('webgl2')||c.getContext('webgl');
              return {webgl:!!gl,width:c.width,height:c.height,cells:Object.keys(S.cells).length,
                error:gl?gl.getError():-1,score:Number(document.querySelector('#score').textContent),expected:G.score(S).total};
            }''')
            assert status['webgl'] and status['width'] > 0 and status['height'] > 0, status
            report['checks'].append('Real WebGL canvas initialized')
            assert status['cells'] == 5 and status['score'] == status['expected'], status
            report['checks'].append('Seeded game and HUD initialized')
            page.screenshot(path=str(OUT / 'cloud-smoke.png'))
            assert status['error'] == 0 and not report['errors'], report
            report['checks'].append('No JavaScript or WebGL errors')
            print('Cloud smoke passed: ' + ', '.join(report['checks']), flush=True)
finally:
    server.shutdown()
    server.server_close()
    (OUT / 'cloud-smoke-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
