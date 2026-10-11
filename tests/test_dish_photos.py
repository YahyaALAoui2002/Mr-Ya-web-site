"""Dish photos on the roulette plates. Builds the page with SAMPLE photos (made here, in a temp folder via DISH_DIR) for three dishes, checks the plates,
then rebuilds the normal debug page so the other tests are not affected. UI only (no WebGL). Also checks scripts/prepare-dish-photos.py."""
import os, subprocess, sys, tempfile, json
from pathlib import Path
from PIL import Image, ImageDraw
from helpers import *

ROOT = Path(__file__).resolve().parents[1]
KEYS = {"n8": (200, 120, 60), "jianbing": (220, 180, 90), "waffle-glace": (230, 150, 170)}


def build(env_extra=None):
    env = dict(os.environ, **(env_extra or {}))
    subprocess.run(["node", "build.mjs", "--debug"], cwd=ROOT, env=env, check=True, capture_output=True)


ok = True
tmp = Path(tempfile.mkdtemp(prefix="dishes-"))
try:
    # 1. the prepare script turns odd-sized originals (a wide JPEG, a tall PNG) into the two square webp files per dish
    src = tmp / "originals"; src.mkdir()
    for key, col in KEYS.items():
        im = Image.new("RGB", (1600, 1000) if key != "jianbing" else (900, 1400), col); d = ImageDraw.Draw(im); d.ellipse((200, 150, 700, 650), fill=(255, 255, 255)); d.text((20, 20), key, fill=(0, 0, 0))
        im.save(src / (key + (".jpg" if key != "jianbing" else ".png")))
    # run the script against a copy of the repo layout so we never touch src/dishes
    fake = tmp / "repo"; (fake / "scripts").mkdir(parents=True); (fake / "scripts" / "prepare-dish-photos.py").write_text((ROOT / "scripts" / "prepare-dish-photos.py").read_text())
    r = subprocess.run([sys.executable, str(fake / "scripts" / "prepare-dish-photos.py"), str(src), "--focus", "n8=0.3,0.4", "--zoom", "n8=1.5"], capture_output=True, text=True)
    ok &= check("prepare-dish-photos.py runs", r.returncode == 0, r.stderr[-200:])
    dishes = fake / "src" / "dishes"
    sizes = {k: (Image.open(dishes / f"{k}.webp").size, Image.open(dishes / "small" / f"{k}.webp").size) for k in KEYS}
    ok &= check("every dish gets a 720 px and a 360 px SQUARE webp", all(a == (720, 720) and b == (360, 360) for a, b in sizes.values()), str(sizes))
    ok &= check("the dishes without an original are reported", "16 without a photo" in r.stdout, r.stdout.strip().splitlines()[-1])

    # 2. a page built with those photos
    build({"DISH_DIR": str(dishes)})
    with sync_playwright() as p:
        browser, page, logs = open_page(p, "index.debug.html", 1280, 900, three=False, wait=600)
        page.evaluate("document.getElementById('roulette').scrollIntoView({block:'center'})"); page.wait_for_timeout(1200)
        st = page.evaluate("""(() => {
          const cards = [...document.querySelectorAll('.card')];
          const info = (i) => { const c = cards[i], pl = c.querySelector('.plate'), im = c.querySelector('img.ph');
            return { photo: !!im, ok: im ? im.complete && im.naturalWidth > 0 : null, cls: pl.className, zh: !!c.querySelector('.zh'), num: c.querySelector('.num').textContent,
                     src: im ? im.getAttribute('src').slice(0, 22) : null, pe: im ? getComputedStyle(im).pointerEvents : null, alt: im ? im.getAttribute('alt') : null }; };
          return { n8: info(6), n1: info(0), jian: info(13), waffle: info(18), total: cards.length, imgs: document.querySelectorAll('.plate img.ph').length }; })()""")
        ok &= check("19 plates, exactly 3 carry a photo", st["total"] == 19 and st["imgs"] == 3, f"{st['total']} plates, {st['imgs']} photos")
        ok &= check("N° 8 shows its photo (inline webp, decoded)", st["n8"]["photo"] and st["n8"]["ok"] and st["n8"]["src"].startswith("data:image/webp"), str(st["n8"]["src"]))
        ok &= check("jianbing and the glacé waffle too", st["jian"]["ok"] and st["waffle"]["ok"])
        ok &= check("a dish without a photo keeps its plain plate (Chinese name, no image)", not st["n1"]["photo"] and st["n1"]["zh"] and "has-photo" not in st["n1"]["cls"])
        ok &= check("a photo plate keeps the dish number and the Chinese name on top", st["n8"]["zh"] and st["n8"]["num"] == "N° 8" and "has-photo" in st["n8"]["cls"])
        ok &= check("the photo is decorative (empty alt) and cannot be dragged away from the wheel", st["n8"]["alt"] == "" and st["n8"]["pe"] == "none")
        geo = page.evaluate("""(() => { const c = document.querySelector('.card[aria-selected=true]'), pl = c.querySelector('.plate').getBoundingClientRect(), im = c.querySelector('img.ph');
          if (!im) return null; const r = im.getBoundingClientRect(); return { dw: Math.abs(r.width - pl.width), dh: Math.abs(r.height - pl.height), radius: getComputedStyle(im).borderRadius }; })()""")
        ok &= check("the photo exactly fills the front plate and is round", geo is not None and geo["dw"] < 2 and geo["dh"] < 2 and "50%" in geo["radius"], str(geo))
        page.click(".rbtn.next"); page.wait_for_timeout(1500)
        ok &= check("the wheel still turns with photos on it", page.evaluate("document.querySelector('.card[aria-selected=true]').id") != "dish-6")
        ok &= check("no console errors", not logs, "; ".join(logs[:2]))
        browser.close()
    # 3. the production build ships the files and points at them
    subprocess.run(["node", "build.mjs"], cwd=ROOT, env=dict(os.environ, DISH_DIR=str(dishes)), check=True, capture_output=True)
    site = ROOT / "dist" / "site"
    ok &= check("production build: photos copied to assets/dishes", all((site / "assets" / "dishes" / f"{k}.webp").exists() for k in KEYS))
    html = (site / "index.html").read_text(encoding="utf8")
    ok &= check("production build: the page points at the files, not at inline data", '"n8":"assets/dishes/n8.webp"' in html and "data:image/webp" not in html)
finally:
    # leave the normal builds in place for everything else
    subprocess.run(["node", "build.mjs"], cwd=ROOT, check=True, capture_output=True)
    subprocess.run(["node", "build.mjs", "--debug"], cwd=ROOT, check=True, capture_output=True)

sys.exit(0 if ok else 1)
