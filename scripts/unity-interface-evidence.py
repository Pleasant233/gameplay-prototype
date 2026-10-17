"""Arrange genuine browser/native captures for review; do not generate substitute UI."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--native", type=Path, default=root / "artifacts/unity-interface-run/unity-interface")
parser.add_argument("--web", type=Path, default=root / "artifacts/web-interface-reference")
args = parser.parse_args()
args.native.mkdir(parents=True, exist_ok=True)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 18)
except OSError:
    font = ImageFont.load_default()

def pair(viewport, scenario, chrome=False):
    browser = Image.open(args.web / f"{viewport}-{scenario}.png").convert("RGB")
    native = Image.open(args.native / f"{viewport}-{scenario}.png").convert("RGB")
    if browser.size != native.size:
        raise ValueError(f"Different viewport sizes: {browser.size} vs {native.size}")
    width, height = browser.size
    if chrome:
        def crop(image):
            canvas = Image.new("RGB", (width, 420), "#edf0f2")
            canvas.paste(image.crop((0, 0, width, 100)), (0, 0))
            canvas.paste(image.crop((0, height - 300, width, height)), (0, 120))
            return canvas
        browser, native = crop(browser), crop(native)
    h = browser.height
    sheet = Image.new("RGB", (width * 2 + 24, h + 48), "#f4f5f7")
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 8), "当前网页 / Browser", fill="#29344a", font=font)
    draw.text((width + 24, 8), "原生 Unity / Native Unity", fill="#29344a", font=font)
    sheet.paste(browser, (0, 48)); sheet.paste(native, (width + 24, 48))
    output = args.native / f"{viewport}-{scenario}-compare.png"
    sheet.save(output)
    print(output)

for viewport in ["desktop", "phone"]:
    for scenario in ["hud", "offer", "detail", "bag", "menu", "settings", "magic"]:
        if (args.native / f"{viewport}-{scenario}.png").exists():
            pair(viewport, scenario, viewport == "desktop" and scenario in ["hud", "offer", "magic"])

