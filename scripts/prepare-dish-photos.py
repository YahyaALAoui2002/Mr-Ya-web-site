#!/usr/bin/env python3
"""Turns originals into the files the site uses: src/dishes/<key>.webp (720 px square) and src/dishes/small/<key>.webp (360 px).

  python3 scripts/prepare-dish-photos.py /path/to/originals [--focus n8=0.5,0.4] [--zoom n8=1.3]

Originals are named by dish key (see src/dishes/README.md): n8.jpg, jianbing.png ... Any format Pillow reads (jpg, png, webp). The square crop is
centred by default; --focus x,y (0..1) moves its centre, --zoom (>= 1) tightens it. EXIF rotation is applied. Needs: pip install pillow
"""
import argparse, sys
from pathlib import Path
from PIL import Image, ImageOps

KEYS = ["n1", "n2", "n3", "n4", "n5", "n6", "n8", "n10", "n11", "n12", "n13", "n14", "n9", "jianbing", "takoyaki", "taro", "liangfen", "waffle", "waffle-glace"]
ap = argparse.ArgumentParser()
ap.add_argument("folder", type=Path)
ap.add_argument("--focus", action="append", default=[], metavar="key=x,y")
ap.add_argument("--zoom", action="append", default=[], metavar="key=z")
a = ap.parse_args()
focus = {k: tuple(map(float, v.split(","))) for k, v in (s.split("=") for s in a.focus)}
zoom = {k: float(v) for k, v in (s.split("=") for s in a.zoom)}
out = Path(__file__).resolve().parents[1] / "src" / "dishes"; (out / "small").mkdir(parents=True, exist_ok=True)

done, missing = [], []
for key in KEYS:
    src = next((f for f in sorted(a.folder.glob(key + ".*")) if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")), None)
    if not src: missing.append(key); continue
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    w, h = im.size
    side = min(w, h) / max(1.0, zoom.get(key, 1.0))
    fx, fy = focus.get(key, (0.5, 0.5))
    left = min(max(fx * w - side / 2, 0), w - side); top = min(max(fy * h - side / 2, 0), h - side)
    sq = im.crop((round(left), round(top), round(left + side), round(top + side)))
    if side < 500: print(f"  warning: {src.name} is only {round(side)} px after the crop; it will look soft", file=sys.stderr)
    for size, q, folder in ((720, 82, out), (360, 64, out / "small")):
        sq.resize((size, size), Image.LANCZOS).save(folder / f"{key}.webp", "WEBP", quality=q, method=6)
    done.append(key)
    print(f"  {key:13s} <- {src.name}  ({(out / f'{key}.webp').stat().st_size // 1024} KB + {(out / 'small' / f'{key}.webp').stat().st_size // 1024} KB)")
print(f"{len(done)} dishes done, {len(missing)} without a photo: {', '.join(missing) or 'none'}")
