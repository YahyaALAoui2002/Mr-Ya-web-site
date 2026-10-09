#!/usr/bin/env python3
"""Regenerates src/assets/og.png (1200x630 link preview) and src/assets/apple-touch-icon.png (180x180).

The preview is made from the site itself: it renders the production build (dist/site), crops the real 3D bear + cup, and sets it next to the
name and address on the site's own paper colour. Run `node build.mjs` once first (any placeholder images in src/assets are fine for that step).
Needs: pip install playwright && playwright install chromium
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "dist" / "site"
OUT = ROOT / "src" / "assets"; OUT.mkdir(exist_ok=True)
GL = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
FAV = (ROOT / "src" / "favicon.svg").read_text()

with sync_playwright() as p:
    b = p.chromium.launch(args=GL)
    # 1. the real hero, 3D included (slow in software GL: pass --reuse to keep the last crop)
    hero = OUT / "_hero.png"
    if "--reuse" not in sys.argv or not hero.exists():
      pg = b.new_page(viewport={"width": 1440, "height": 900}, color_scheme="light")
      pg.goto((SITE / "index.html").as_uri(), wait_until="load")
      pg.wait_for_selector("#cup3d.is-3d", timeout=120000)
      pg.wait_for_timeout(9000)
      pg.add_style_tag(content=".intro,.temp-badge,.cup-stage .hint,.controls,header{visibility:hidden!important}")   # keep only the bear and the cup
      pg.screenshot(path=str(hero), clip={"x": 150, "y": 150, "width": 800, "height": 750}, timeout=170000)   # software GL is slow
      pg.close()    # stop the 3D render loop: it would starve the next screenshots
    # 2. the card
    card = b.new_page(viewport={"width": 1200, "height": 630})
    page_file = OUT / "_card.html"
    page_file.write_text(f"""<!doctype html><meta charset=utf-8><style>
      @font-face{{font-family:G;font-weight:700;src:url({(SITE/'assets/fonts/familjen-grotesk-700.woff2').as_uri()})}}
      @font-face{{font-family:G;font-weight:400;src:url({(SITE/'assets/fonts/familjen-grotesk-400.woff2').as_uri()})}}
      @font-face{{font-family:H;font-weight:900;src:url({(SITE/'assets/fonts/noto-serif-sc-900.woff2').as_uri()})}}
      @font-face{{font-family:D;font-weight:700;src:url({(SITE/'assets/fonts/dancing-script-700.woff2').as_uri()})}}
      body{{margin:0;width:1200px;height:630px;background:#eef1ea;position:relative;overflow:hidden;font-family:G,sans-serif;color:#17271c}}
      .art{{position:absolute;right:-40px;top:0;height:630px;width:auto;-webkit-mask-image:linear-gradient(to right,transparent 0,#000 6%);mask-image:linear-gradient(to right,transparent 0,#000 6%)}}
      .t{{position:absolute;left:72px;top:92px;width:480px}}
      .label{{display:inline-grid;justify-items:center;background:#2f5d3f;color:#f1f4ec;padding:16px 38px 14px;line-height:1;
        clip-path:polygon(18px 0,calc(100% - 18px) 0,100% 18px,100% calc(100% - 28px),calc(100% - 28px) 100%,28px 100%,0 calc(100% - 28px),0 18px)}}
      .zh{{font:900 54px/1 H,serif;letter-spacing:.18em;margin-right:-.18em}} .mr{{font:700 46px/1 D,cursive;margin-top:6px}}
      h1{{font:700 56px/1.06 G;letter-spacing:-.035em;margin:44px 0 0}} p{{font:400 30px/1.4 G;color:#4d5d52;margin:22px 0 0}}
    </style><img class=art src="{hero.as_uri()}"><div class=t><div class=label><span class=zh>幸福食光</span><span class=mr>Mr. Ye</span></div>
    <h1>Bubble tea et street food du Hubei</h1><p>69 avenue des Gobelins, Paris 13e</p></div>""", encoding="utf8")
    card.goto(page_file.as_uri(), wait_until="load")
    card.wait_for_timeout(800)
    card.screenshot(path=str(OUT / "og.png"), timeout=120000)
    # 3. home-screen icon
    ic = b.new_page(viewport={"width": 180, "height": 180})
    ic.set_content(f"<body style='margin:0;background:#eef1ea;display:grid;place-items:center;width:180px;height:180px'><div style='width:132px;height:132px'>{FAV.replace('<svg ','<svg width=132 height=132 ')}</div>")
    ic.screenshot(path=str(OUT / "apple-touch-icon.png"), timeout=120000)
    b.close()
hero.unlink(); (OUT / "_card.html").unlink()
print("wrote", OUT / "og.png", OUT / "apple-touch-icon.png")
