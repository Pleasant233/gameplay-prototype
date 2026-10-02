"""Focused crystal UI regression, locally or against a deployed URL."""
import argparse
import functools
import http.server
import json
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--url')
parser.add_argument('--report', default='crystal-check-local.json')
args = parser.parse_args()


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = None
if not args.url:
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
url = args.url or f'http://127.0.0.1:{server.server_port}'
report = {'url': url, 'checks': [], 'errors': []}


def check(name, passed):
    assert passed, name
    report['checks'].append(name)
    print('ok - ' + name, flush=True)


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for mobile in [False, True]:
            label = 'phone' if mobile else 'desktop'
            options = {'viewport': {'width': 390, 'height': 844}, 'is_mobile': True, 'has_touch': True,
                       'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'} if mobile else {'viewport': {'width': 1440, 'height': 900}}
            page = browser.new_page(**options)
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            page.on('console', lambda message: report['errors'].append(message.text) if message.type == 'error' else None)
            page.goto(url, wait_until='domcontentloaded', timeout=60000)
            page.wait_for_function('typeof S!="undefined" && S && document.querySelector("#world canvas")')
            # Deliberately keep the placement reserve unused: crystals must still work.
            page.evaluate('''() => {
              start(37);S.ap=1;S.cells['3,3'].attrs=[0,0,0,0,0];
              S.inv.crystal.water=1;S.inv.bigCrystal.water=1;
              selected='3,3';mode=null;render();
            }''')
            page.locator('#btnBag').click()
            page.locator('[data-crystal="water"][data-big=""]').click()
            check(label + ': ordinary crystal consumes only ordinary stock and adds 1 without AP or round change', page.evaluate("S.inv.crystal.water===0 && S.inv.bigCrystal.water===1 && S.cells['3,3'].attrs[2]===1 && S.ap===1 && S.round===1 && S.placed===0 && document.querySelectorAll('#ap i.used').length===2"))
            page.locator('[data-crystal="water"][data-big="1"]').click()
            check(label + ': large crystal consumes large stock and adds 2 without AP or round change', page.evaluate("S.inv.bigCrystal.water===0 && S.cells['3,3'].attrs[2]===3 && S.ap===1 && S.round===1 && S.placed===0 && document.querySelectorAll('#ap i.used').length===2"))
            page.wait_for_function("Number(document.getElementById('score').textContent)===G.score(S).total && Number(document.getElementById('bagCount').textContent)===0 && !document.querySelector('.token')", timeout=20000)
            check(label + ': score, inventory counter and flights settle', True)
            check(label + ': help states ordinary and large crystals are free', page.locator('#dlgHelp').text_content().find('使用普通或大型元素结晶不消耗行动点') >= 0)
            page.close()
        check('No browser or WebGL errors', not report['errors'])
        browser.close()
finally:
    if server:
        server.shutdown()
    out = ROOT / 'artifacts'
    out.mkdir(exist_ok=True)
    (out / args.report).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
