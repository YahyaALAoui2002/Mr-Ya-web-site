"""Phone only: once the visitor has chosen in EVERY group (size, base, flavour, topping, and hot/cold for a milk tea) the page scrolls back up to the
finished cup + recap. Also: no jump on a later tweak, no jump on desktop, tapping an already-ticked default counts, switching base resets the flavour,
the recap mirrors the order. UI only (no WebGL)."""
import sys
from helpers import *

HEAD = 76 + 8
Y = "window.scrollY"
STAGE_TOP = "document.querySelector('.cup-stage').getBoundingClientRect().top"


def tap(page, name, value):
    page.click(f"label.opt:has(input[name={name}][value='{value}'])")


def to_controls(page):
    page.evaluate("window.scrollTo(0, document.querySelector('.controls').getBoundingClientRect().top + scrollY - 90)"); page.wait_for_timeout(400)


def waits_for_scroll_up(page, y0, ms=2500):
    t = 0
    while t < ms:
        if page.evaluate(Y) < y0 - 200: break
        page.wait_for_timeout(100); t += 100
    page.wait_for_timeout(900)          # let the smooth scroll finish
    return page.evaluate(Y)


ok = True
with sync_playwright() as p:
    browser, page, logs = open_page(p, "index.html", 390, 760, three=False, wait=600)
    to_controls(page); y0 = page.evaluate(Y)
    ok &= check("setup: the controls are far below the cup", y0 > 500, f"scrollY {y0:.0f}")
    for name, value in (("size", "M"), ("base", "lait"), ("flavor", "fraise"), ("temp", "chaud")):
        tap(page, name, value); page.wait_for_timeout(500)
    ok &= check("4 of 5 groups chosen: the page stays where it is", abs(page.evaluate(Y) - y0) < 40, f"{y0:.0f} -> {page.evaluate(Y):.0f}")
    tap(page, "top", "gelee")
    y1 = waits_for_scroll_up(page, y0)
    top = page.evaluate(STAGE_TOP)
    ok &= check("the 5th choice scrolls up to the finished cup", y1 < y0 - 200 and HEAD - 120 <= top <= HEAD + 12, f"scrollY {y0:.0f} -> {y1:.0f}, cup top at {top:.0f}px")
    ok &= check("the recap is visible under the cup", page.evaluate("(() => { const r = document.getElementById('recap').getBoundingClientRect(); return r.bottom <= innerHeight - 72 + 2 && r.top > 0 && r.height > 40; })()"))
    rec = page.evaluate("document.getElementById('recap').textContent")
    ok &= check("the recap mirrors the order (size, tea, topping, price)", all(s in rec for s in ("Medium 50 cl", "fraise", "chaud", "Gelée d'herbe", "6,50")) or all(s in rec for s in ("Medium 50 cl", "fraise", "chaud", "Gelée d'herbe", "5,50")), rec)
    to_controls(page); y2 = page.evaluate(Y)
    tap(page, "flavor", "mangue"); page.wait_for_timeout(1600)
    ok &= check("changing ONE option afterwards does not make the page jump again", abs(page.evaluate(Y) - y2) < 40, f"{y2:.0f} -> {page.evaluate(Y):.0f}")

    # tapping a default that is already ticked counts; a fruit tea needs no hot/cold
    page.reload(); page.wait_for_timeout(800); to_controls(page); y3 = page.evaluate(Y)
    tap(page, "size", "L"); tap(page, "base", "fruit"); page.wait_for_timeout(300); tap(page, "flavor", "citron"); page.wait_for_timeout(300)
    ok &= check("fruit tea: size + base + flavour is not enough yet", abs(page.evaluate(Y) - y3) < 40)
    tap(page, "top", "tapioca")
    y4 = waits_for_scroll_up(page, y3)
    ok &= check("fruit tea: after the topping it scrolls, hot/cold is not asked (and a ticked default counted)", y4 < y3 - 200, f"{y3:.0f} -> {y4:.0f}")
    ok &= check("fruit tea recap shows the shop price note", "Prix affiché" in page.evaluate("document.getElementById('recap').textContent"))

    # switching base resets the flavour: it has to be chosen again
    page.reload(); page.wait_for_timeout(800); to_controls(page); y5 = page.evaluate(Y)
    for name, value in (("size", "L"), ("top", "tapioca"), ("temp", "froid"), ("base", "lait"), ("flavor", "matcha")):
        tap(page, name, value); page.wait_for_timeout(200)
    # (matcha is milk-only; the four others were touched; the 5th tap above already completed the set, so start over)
    page.wait_for_timeout(2500)
    page.reload(); page.wait_for_timeout(800); to_controls(page); y5 = page.evaluate(Y)
    for name, value in (("size", "L"), ("top", "tapioca"), ("temp", "froid"), ("flavor", "matcha")):
        tap(page, name, value); page.wait_for_timeout(250)
    tap(page, "base", "fruit"); page.wait_for_timeout(1500)       # matcha does not exist in the fruit list: the flavour must be picked again
    ok &= check("switching base (flavour list changes) asks for a flavour again: no scroll", abs(page.evaluate(Y) - y5) < 40, f"{y5:.0f} -> {page.evaluate(Y):.0f}")
    tap(page, "flavor", "rose")
    y6 = waits_for_scroll_up(page, y5)
    ok &= check("... and picking it completes the set", y6 < y5 - 200, f"{y5:.0f} -> {y6:.0f}")
    ok &= check("no console errors", not logs, "; ".join(logs[:2]))
    browser.close()

    # desktop: nothing moves
    browser, page, logs = open_page(p, "index.html", 1280, 900, three=False, wait=600)
    for name, value in (("size", "M"), ("base", "lait"), ("flavor", "fraise"), ("temp", "chaud"), ("top", "gelee")):
        tap(page, name, value); page.wait_for_timeout(200)
    page.wait_for_timeout(500); d0 = page.evaluate(Y)       # (Playwright itself scrolls to the chips it clicks: measure only after the last tap)
    page.wait_for_timeout(1500)
    ok &= check("desktop: no guided scroll", abs(page.evaluate(Y) - d0) < 5, f"{d0:.0f} -> {page.evaluate(Y):.0f}")
    ok &= check("desktop: the recap is hidden", page.evaluate("getComputedStyle(document.getElementById('recap')).display") == "none")
    browser.close()

sys.exit(0 if ok else 1)
