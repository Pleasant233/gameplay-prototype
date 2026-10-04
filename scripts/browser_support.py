"""Shared browser choice: bundled Chromium by default, optional local Edge."""
import os


def launch_browser(playwright):
    channel = os.environ.get('PLAYWRIGHT_BROWSER_CHANNEL', '').strip()
    options = {
        'headless': True,
        'args': ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    }
    if channel and channel != 'chromium':
        options['channel'] = channel
    print(f"Browser: {channel or 'bundled Chromium'} / SwiftShader", flush=True)
    return playwright.chromium.launch(**options)


def capture_source(source):
    """Test-only pause so the software GPU can drain before a screenshot."""
    return source.replace('if (document.hidden)', 'if (root.__holdCapture || document.hidden)').replace(
        '}else renderer.render(scene,camera);',
        '}else renderer.render(scene,camera);root.__captureFrame=(root.__captureFrame||0)+1;')


def capture_frame(page, path, advance=True):
    # Preserve the last REAL WebGL frame. Rendering resumes even if capture
    # fails; assertions and all WebGL drawing remain enabled between captures.
    if advance:
        frame=page.evaluate('window.__captureFrame||0')
        page.wait_for_function('(before)=>(window.__captureFrame||0)>before',arg=frame,timeout=60000)
    page.evaluate('window.__holdCapture=true')
    try:
        return page.screenshot(path=str(path), timeout=60000)
    finally:
        page.evaluate('delete window.__holdCapture')
