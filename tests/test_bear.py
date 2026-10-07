"""The mascot bear, behaviour: it is built at load, the Head follows the pointer and nods on a selection, it greets with a wave,
a click on it makes it wave, and setMascot() hides/shows it. (Structure, rig and clips: test_rig.py.)"""
import sys, time
from helpers import *

ok = True
TRIS = """(() => { let t = 0, m = 0; window.__dbg.bear.traverse(o => { if (o.isMesh) { m++; t += o.geometry.index.count / 3; } }); return [m, t]; })()"""
with sync_playwright() as p:
    browser, page, logs = open_page(p, "lab.debug.html", 360, 400, wait=100)
    ok &= check("the plush is built at load (no slow marching step any more)", page.evaluate("window.__dbg.mascot.ready === true"))
    meshes, tris = page.evaluate(TRIS)
    ok &= check("a handful of meshes and a sane triangle count", 5 <= meshes <= 24 and 8000 < tris < 80000, f"{meshes} meshes, {int(tris)} triangles")

    # the greeting wave starts by itself (autoplay), a little after the first frames
    t0 = time.time(); seen = False
    while time.time() - t0 < 90:
        if page.evaluate("window.__dbg.bearApi.playing") == "wave": seen = True; break
        page.wait_for_timeout(400)
    ok &= check("the bear greets with a wave on its own", seen, f"after {time.time() - t0:.0f} s")
    page.evaluate("window.__dbg.mascot.autoplay = false")
    t0 = time.time()
    while time.time() - t0 < 120 and page.evaluate("window.__dbg.bearApi.playing"): page.wait_for_timeout(500)       # let the greeting finish (software GL frames are slow)
    ok &= check("the wave ends and the bear returns to idle", page.evaluate("window.__dbg.bearApi.playing") is None, f"{time.time() - t0:.0f} s")

    rot = lambda: page.evaluate("(() => { const r = window.__dbg.mascot.head.rotation; return [r.x, r.y]; })()")
    page.mouse.move(20, 200); page.wait_for_timeout(7000); left = rot()[1]
    page.mouse.move(340, 200); page.wait_for_timeout(7000); right = rot()[1]
    ok &= check("head follows the pointer", abs(right - left) > 0.08, f"yaw {left:.3f} -> {right:.3f}")
    base = rot()[0]; click(page, "flavor", "lait:taro"); peak = 0; t1 = time.time()
    while time.time() - t1 < 10:
        peak = max(peak, abs(rot()[0] - base)); page.wait_for_timeout(250)
    ok &= check("head nods when a flavour is chosen", peak > 0.01, f"pitch moved {peak:.3f} rad")

    # a click on the bear: project its head into the screen and click there
    page.evaluate("window.mryeCup.setMascot(false)"); page.wait_for_timeout(1500); page.evaluate("window.mryeCup.setMascot(true)"); page.wait_for_timeout(2500)
    xy = page.evaluate("""(() => { const d = window.__dbg, v = new THREE.Vector3(); d.mascot.head.getWorldPosition(v); v.project(d.camera);
      const r = d.renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; })()""")
    page.evaluate("window.__dbg.bearApi.pose('none', 0)")
    page.mouse.click(xy[0], xy[1]); page.wait_for_timeout(800)
    ok &= check("clicking the bear makes it wave", page.evaluate("window.__dbg.bearApi.playing") == "wave", f"clicked at {xy[0]:.0f},{xy[1]:.0f}")
    page.evaluate("window.__dbg.bearApi.pose('none', 0)")
    page.mouse.click(5, 5); page.wait_for_timeout(500)
    ok &= check("clicking empty space does nothing", page.evaluate("window.__dbg.bearApi.playing") is None)

    page.evaluate("window.mryeCup.setMascot(false)"); page.wait_for_timeout(2500)
    ok &= check("setMascot(false) hides the bear", page.evaluate("window.__dbg.bear.visible") is False)
    page.evaluate("window.mryeCup.setMascot(true)"); page.wait_for_timeout(2500)
    ok &= check("setMascot(true) shows it again", page.evaluate("window.__dbg.bear.visible") is True)
    ok &= check("no console errors", not logs, "; ".join(logs[:2]))
    browser.close()
sys.exit(0 if ok else 1)
