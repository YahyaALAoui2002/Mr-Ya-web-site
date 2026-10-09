#!/usr/bin/env python3
"""Rebuilds src/fonts/*.woff2 (the self-hosted fonts of the production build).

Why: the page used to pull its fonts from Google Fonts (a third-party request that leaks the visitor's IP; also slower).
All three families are SIL OFL, so we host them ourselves.

  Familjen Grotesk 400/500/600/700 and Dancing Script 700 : the Latin subset, copied as shipped by Fontsource.
  Noto Serif SC 600/900 : a SUBSET with only the Chinese characters that appear in src/site.template.html
                          (about 60 glyphs instead of a 10 MB font). Add a dish with a new character and re-run this.

Usage (needs fonttools + brotli:  pip install fonttools brotli):
  npm install --prefix /tmp/fontsrc @fontsource/familjen-grotesk @fontsource/dancing-script @expo-google-fonts/noto-serif-sc
  python3 scripts/subset-fonts.py /tmp/fontsrc/node_modules
"""
import re, shutil, sys
from pathlib import Path
from fontTools import subset

root = Path(__file__).resolve().parents[1]
nm = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/fontsrc/node_modules")
out = root / "src" / "fonts"; out.mkdir(parents=True, exist_ok=True)

for w in (400, 500, 600, 700):
    shutil.copy(nm / f"@fontsource/familjen-grotesk/files/familjen-grotesk-latin-{w}-normal.woff2", out / f"familjen-grotesk-{w}.woff2")
shutil.copy(nm / "@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff2", out / "dancing-script-700.woff2")

# every Chinese character the page can show (labels, menu, roulette plates)
html = (root / "src" / "site.template.html").read_text(encoding="utf8")
chars = sorted(set(re.findall(r"[　-〿㐀-鿿＀-￯]", html)))
(out / "noto-serif-sc.chars.txt").write_text("".join(chars) + "\n", encoding="utf8")
for name, ttf in (("600", "600SemiBold/NotoSerifSC_600SemiBold.ttf"), ("900", "900Black/NotoSerifSC_900Black.ttf")):
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["*"]; opts.notdef_outline = True; opts.name_IDs = [1, 2, 4, 6]
    font = subset.load_font(str(nm / "@expo-google-fonts/noto-serif-sc" / ttf), opts)
    sub = subset.Subsetter(opts); sub.populate(text="".join(chars)); sub.subset(font)
    subset.save_font(font, str(out / f"noto-serif-sc-{name}.woff2"), opts)
print("fonts written to", out, "for", len(chars), "Chinese characters")
