"""Focused crystal UI regression, locally or against a deployed URL."""
import argparse
import functools
import http.server
import json
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright
from browser_support import launch_browser

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


def click_tile(page, key, mobile):
    point = page.evaluate('(key) => View.project(key)', key)
    if mobile:
        page.touchscreen.tap(point['x'], point['y'])
    else:
        page.mouse.click(point['x'], point['y'])


try:
    with sync_playwright() as p:
        browser = launch_browser(p)
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
              Tokens.reset();S=G.newGame(37,{mode:'endless'});S.ap=1;S.cells['3,3'].attrs=[0,0,0,0,0];
              S.inv.crystal.water=1;S.inv.bigCrystal.water=1;S.inv.inverseCrystal.water=1;
              selected='3,3';mode=null;render();
            }''')
            if mobile and page.locator('#detail.open').count():
                page.locator('[data-a="close"]').click()
            page.locator('#btnBag').click()
            page.locator('[data-crystal="water"][data-big=""][data-inverse=""]').click()
            check(label + ': choosing crystal after viewing a tile does not spend it', page.evaluate("S.inv.crystal.water===1 && S.cells['3,3'].attrs[2]===0 && mode.kind==='crystal' && selected===null && !document.querySelector('#bag').classList.contains('open') && !document.querySelector('#detail').classList.contains('open')"))
            check(label + ': target hint fits without covering the map', page.evaluate("document.querySelector('#hint').getBoundingClientRect().height<80 && document.documentElement.scrollWidth<=innerWidth"))
            page.screenshot(path=str(ROOT / 'artifacts' / f'crystal-select-{label}.png'), animations='disabled')
            page.keyboard.press('Escape')
            click_tile(page, '3,3', mobile)
            check(label + ': cancel and ordinary tile selection do not spend crystals', page.evaluate("mode===null && selected==='3,3' && S.inv.crystal.water===1 && S.cells['3,3'].attrs[2]===0"))
            if mobile and page.locator('#detail.open').count():
                page.locator('[data-a="close"]').click()
            page.locator('#btnBag').click()
            page.locator('[data-crystal="water"][data-big=""][data-inverse=""]').click()
            click_tile(page, '3,3', mobile)
            check(label + ': explicit target click spends ordinary crystal without AP or round change', page.evaluate("S.inv.crystal.water===0 && S.inv.bigCrystal.water===1 && S.cells['3,3'].attrs[2]===1 && S.ap===1 && S.round===1 && S.placed===0 && document.querySelectorAll('#ap i.used').length===2"))
            click_tile(page, '3,3', mobile)
            if mobile and page.locator('#detail.open').count():
                page.locator('[data-a="close"]').click()
            page.locator('#btnBag').click()
            page.locator('[data-crystal="water"][data-big="1"]').click()
            check(label + ': choosing large crystal does not spend it', page.evaluate("S.inv.bigCrystal.water===1 && S.cells['3,3'].attrs[2]===1"))
            click_tile(page, '3,3', mobile)
            check(label + ': explicit target click spends large crystal and adds 2', page.evaluate("S.inv.bigCrystal.water===0 && S.cells['3,3'].attrs[2]===3 && S.ap===1 && S.round===1 && S.placed===0"))
            if mobile and page.locator('#detail.open').count():
                page.locator('[data-a="close"]').click()
            page.locator('#btnBag').click()
            page.locator('[data-crystal="water"][data-inverse="1"]').click()
            check(label + ': choosing inverse crystal does not spend it', page.evaluate("S.inv.inverseCrystal.water===1 && S.cells['3,3'].attrs[2]===3"))
            click_tile(page, '3,3', mobile)
            check(label + ': explicit target click spends inverse crystal and subtracts 1', page.evaluate("S.inv.inverseCrystal.water===0 && S.cells['3,3'].attrs[2]===2 && mode===null && S.ap===1 && S.round===1 && S.placed===0"))
            page.wait_for_function("Number(document.getElementById('score').textContent)===G.score(S).total && Number(document.getElementById('bagCount').textContent)===0 && !document.querySelector('.token')", timeout=20000)
            check(label + ': score, inventory counter and flights settle', True)
            check(label + ': help states ordinary and large crystals are free', page.locator('#dlgHelp').text_content().find('使用普通或大型元素结晶不消耗行动点') >= 0)
            page.evaluate('''() => {Tokens.reset();S=G.newGame(37,{mode:'endless'});S.cells['3,2'].attrs=[0,4,0,0,1];S.inv.crystal.water=1;S.inv.crystal.earth=1;S.inv.bigCrystal.water=1;selected='3,2';mode=null;render();}''')
            check(label + ': upgrade preview does not automatically spend stock', page.evaluate("S.inv.crystal.water===1 && S.inv.crystal.earth===1 && S.cells['3,2'].type==='woodland_t1'"))
            page.screenshot(path=str(ROOT / 'artifacts' / f'crystal-upgrade-{label}.png'), animations='disabled')
            page.locator('[data-a="upgrade"][data-type="woodland_t2"]').click()
            check(label + ': choosing upgrade direction still pays exact matching deficits', page.evaluate("S.cells['3,2'].type==='woodland_t2' && S.cells['3,2'].attrs[2]===1 && S.cells['3,2'].attrs[4]===2 && S.inv.crystal.water===0 && S.inv.crystal.earth===0 && S.inv.bigCrystal.water===1 && S.ap===3 && S.round===1"))
            page.close()
        check('No browser or WebGL errors', not report['errors'])
        browser.close()
finally:
    if server:
        server.shutdown()
    out = ROOT / 'artifacts'
    out.mkdir(exist_ok=True)
    (out / args.report).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
