"""Create the offline Unity Chinese font from the OFL Noto Sans SC source.

Development only: python -m pip install fonttools==4.60.1
python scripts/unity-font.py <NotoSansSC[wght].ttf>
"""
from pathlib import Path
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

root = Path(__file__).resolve().parents[1]
font = TTFont(sys.argv[1])
if "fvar" in font:
    font = instantiateVariableFont(font, {"wght": 500}, inplace=True)
options = subset.Options()
options.name_IDs = ["*"]
options.name_legacy = True
options.name_languages = ["*"]
# Include the standard CJK unified block to support future Chinese game text as well.
unicodes = set(range(0x20, 0x7F)) | set(range(0x3000, 0x3100)) | set(range(0x4E00, 0xA000)) | set(range(0xFF00, 0xFFEF))
for path in list(root.glob("*.js")) + list(root.glob("*.html")) + list((root / "SpotlightGamejam/Assets/ElementHabitat").rglob("*.cs")):
    unicodes.update(map(ord, path.read_text(encoding="utf-8-sig")))
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=unicodes)
subsetter.subset(font)
for record in font["name"].names:
    if record.nameID in (1, 3, 4, 6, 16, 17):
        value = "Habitat Chinese Medium" if record.nameID != 6 else "HabitatChinese-Medium"
        record.string = value.encode(record.getEncoding(), errors="replace")
out = root / "SpotlightGamejam/Assets/ElementHabitat/Resources/HabitatChinese.ttf"
font.save(out)
print(f"{out}: {out.stat().st_size:,} bytes")
