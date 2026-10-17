"""Assemble genuine Unity/Web capture sequences; images are never synthesized.

Usage: python scripts/unity-motion-evidence.py [artifacts/unity-motion]
PNG files remain the acceptance source. GIF duration follows each frame's recorded
elapsed time, including the measured overhead of native rendering/readback.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


def assemble(folder):
    folder = Path(folder).resolve()
    report_path = folder / "motion-validation.json"
    if not report_path.exists():
        report_path = folder / "web-motion-reference.json"
    report = json.loads(report_path.read_text(encoding="utf-8-sig"))
    groups = {}
    for frame in report["frames"]:
        groups.setdefault((frame["viewport"], frame["scenario"]), []).append(frame)
    generated = []
    for (viewport, scenario), entries in groups.items():
        captures = []
        for entry in entries:
            source = Image.open(folder / entry["image"]).convert("RGB")
            source.thumbnail((800, 600))
            capture = Image.new("RGB", (source.width, source.height + 30), "#202b34")
            capture.paste(source, (0, 30))
            ImageDraw.Draw(capture).text((10, 8), f"{viewport} / {scenario} / {entry['seconds']:.3f} s", fill="white")
            captures.append(capture)
        durations = [max(20, round((entries[i + 1]["seconds"] - entries[i]["seconds"]) * 1000))
                     for i in range(len(entries) - 1)] + [800]
        name = f"{viewport}-{scenario}.gif"
        captures[0].save(folder / name, save_all=True, append_images=captures[1:], loop=0, duration=durations)
        generated.append(name)
        chosen = list(range(len(captures)))
        if len(chosen) > 8:
            chosen = [round(i * (len(captures) - 1) / 7) for i in range(8)]
        tile_width = 360 if viewport == "desktop" else 196
        tile_height = 245 if viewport == "desktop" else 440
        sheet = Image.new("RGB", (tile_width * 4, tile_height * ((len(chosen) + 3) // 4)), "#eaf1f4")
        for position, index in enumerate(chosen):
            tile = ImageOps.contain(captures[index], (tile_width - 8, tile_height - 8))
            x = position % 4 * tile_width + (tile_width - tile.width) // 2
            y = position // 4 * tile_height
            sheet.paste(tile, (x, y))
        name = f"{viewport}-{scenario}-sequence.jpg"
        sheet.save(folder / name, quality=92)
        generated.append(name)
    (folder / "evidence-index.json").write_text(json.dumps({"source": report_path.name, "files": generated}, indent=2), encoding="utf-8")
    print(f"Assembled {len(groups)} real capture sequences in {folder}")


if __name__ == "__main__":
    assemble(sys.argv[1] if len(sys.argv) > 1 else "artifacts/unity-motion")
