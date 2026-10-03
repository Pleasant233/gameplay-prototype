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
