"""Rapid toggling of toppings / 17 flavours / temperature on the real site page; nothing may leave the cup, no console errors."""
import sys, time
from helpers import *

ok = True
with sync_playwright() as p:
    browser, page, logs = open_page(p, "index.debug.html", 430, 760, wait=9000)
    page.evaluate(JS_SAMPLER)
    badge = lambda: page.evaluate("document.getElementById('tempBadge').classList.contains('is-hot') ? 'HOT' : 'cold'")

    def settle(max_s=80):
        t0 = time.time()
        while time.time() - t0 < max_s:
            st = page.evaluate(JS_STATE)
            if not any(v and v["active"] for v in st.values()):
                return st
            page.wait_for_timeout(500)
        return page.evaluate(JS_STATE)

    for t in ["gelee", "tapioca", "gelee", "haricot", "multifruit", "tapioca", "gelee", "multifruit"]:
        click(page, "top", t); page.wait_for_timeout(100)
    st = settle()
    ok &= check("rapid toppings end with ONLY multifruit visible", [k for k, v in st.items() if v and v["on"]] == ["popping"], str({k: v["on"] for k, v in st.items() if v}))

    n = 0
    for base in ("lait", "fruit"):
        click(page, "base", base)
        for fid in page.evaluate(f"Object.keys(window.mryeCup.flavors.{base})"):
            click(page, "flavor", fid); n += 1; page.wait_for_timeout(80)
    st = settle()
    ok &= check("all 17 flavours clicked", n == 17, str(n))
    ok &= check("fruit tea shows ice", st["ice"]["on"])
    click(page, "base", "lait"); page.wait_for_timeout(200)
    ok &= check("back to milk: ice gone", not settle()["ice"]["on"])

    for i in range(10):
        click(page, "temp", "chaud" if i % 2 == 0 else "froid"); page.wait_for_timeout(60)
    click(page, "temp", "chaud"); page.wait_for_timeout(300)
    ok &= check("temperature x10 ends on HOT", badge() == "HOT")
    alive = page.evaluate("document.getAnimations().filter(a => a.constructor.name === 'Animation').length")
    ok &= check("badge pop animations do not pile up", alive <= 3, f"{alive} alive")
    click(page, "temp", "froid"); page.wait_for_timeout(300)
    ok &= check("Froid -> snowflake", badge() == "cold")

    viol = page.evaluate("window.__viol")
    ok &= check("no topping ever left the cup during any animation", len(viol) == 0, str(viol[:2]))
    ok &= check("no console errors/warnings", not logs, "; ".join(logs[:2]))
    info = page.evaluate("(() => { const i = window.__dbg.renderer.info; return { draw_calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures }; })()")
    print("  info  renderer.info (software GL, last frame):", info)
    browser.close()
sys.exit(0 if ok else 1)
