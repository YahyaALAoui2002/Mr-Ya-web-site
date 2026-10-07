"""The mascot bear: single mesh builds by itself (time-sliced), head follows the pointer, nods on a selection."""
import sys, time
from helpers import *

ok = True
with sync_playwright() as p:
    browser, page, logs = open_page(p, "lab.debug.html", 360, 400, wait=100)
    t0 = time.time(); ready = False
    while time.time() - t0 < 140:
        if page.evaluate("window.__dbg.mascot.ready"): ready = True; break
        page.wait_for_timeout(1000)
    ok &= check("the body finishes building on its own (7 ms of work per frame)", ready, f"{time.time() - t0:.0f} s in this very slow software renderer")
    if not ready: page.evaluate("window.__dbg.mascot.finish()")
    page.wait_for_timeout(3000)
    tris = page.evaluate("window.__dbg.bear.children.filter(c => c.isMesh).map(c => c.geometry.index.count / 3).sort((a, b) => b - a)[0]")
    ok &= check("body is ONE mesh with a sane triangle count", 10000 < tris < 120000, f"{int(tris)} triangles (phone lattice at this viewport width)")
    rot = lambda: page.evaluate("(() => { const r = window.__dbg.mascot.head.rotation; return [r.x, r.y]; })()")
    page.mouse.move(20, 200); page.wait_for_timeout(7000); left = rot()[1]
    page.mouse.move(340, 200); page.wait_for_timeout(7000); right = rot()[1]
    ok &= check("head follows the pointer", abs(right - left) > 0.08, f"yaw {left:.3f} -> {right:.3f}")
    base = rot()[0]; click(page, "flavor", "lait:taro"); peak = 0; t1 = time.time()
    while time.time() - t1 < 10:
        peak = max(peak, abs(rot()[0] - base)); page.wait_for_timeout(250)
    ok &= check("head nods when a flavour is chosen", peak > 0.01, f"pitch moved {peak:.3f} rad")
    page.evaluate("window.mryeCup.setMascot(false)"); page.wait_for_timeout(2500)
    ok &= check("setMascot(false) hides the bear", page.evaluate("window.__dbg.bear.visible") is False)
    page.evaluate("window.mryeCup.setMascot(true)"); page.wait_for_timeout(2500)
    ok &= check("setMascot(true) shows it again", page.evaluate("window.__dbg.bear.visible") is True)
    ok &= check("no console errors", not logs, "; ".join(logs[:2]))
    browser.close()
sys.exit(0 if ok else 1)
