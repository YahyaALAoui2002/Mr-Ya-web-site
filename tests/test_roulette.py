"""The oval menu roulette: layout, rotation, every control, auto-rotation and reduced motion (UI only, no WebGL)."""
import sys
from helpers import *

STATE = """(() => { const sel = document.querySelector('.card[aria-selected=true]'); const ring = document.getElementById('ring').getBoundingClientRect();
  const cards = [...document.querySelectorAll('.card')].map((c, i) => { const r = c.getBoundingClientRect(); return { i, op: +c.style.opacity || 0, cx: r.x + r.width / 2, w: r.width, tag: c.getAttribute('aria-label') }; });
  const front = cards.find(c => c.i === +sel.id.split('-')[1]);
  const vis = cards.filter(c => c.i !== front.i && c.op >= 0.5 && c.cx > ring.x - 40 && c.cx < ring.x + ring.width + 40);
  return { selected: front.tag, front_w: Math.round(front.w), left: vis.filter(c => c.cx < front.cx).length, right: vis.filter(c => c.cx > front.cx).length,
           pick: document.querySelector('.pk-name').textContent, price: document.querySelector('.pk-price').textContent, play: document.getElementById('rplay').getAttribute('aria-pressed') }; })()"""
SEL = "document.querySelector('.card[aria-selected=true]').getAttribute('aria-label')"
IDX = "+document.querySelector('.card[aria-selected=true]').id.split('-')[1]"
N = 19


def settled(page, quiet=4, max_s=8):
    """Wait until the selected dish has not changed for `quiet` consecutive polls (the wheel stopped)."""
    last, same, t0 = None, 0, 0
    while t0 < max_s * 1000:
        cur = page.evaluate(SEL); same = same + 1 if cur == last else 0; last = cur
        if same >= quiet: return cur
        page.wait_for_timeout(200); t0 += 200
    return last

ok = True
with sync_playwright() as p:
    browser, page, logs = open_page(p, "index.html", 1280, 900, three=False, wait=600)
    page.evaluate("document.getElementById('roulette').scrollIntoView({block:'center'})"); page.wait_for_timeout(500)
    st = page.evaluate(STATE)
    ok &= check("starts on N° 8", st["selected"].startswith("N° 8"), st["selected"])
    ok &= check("at least 2 plates visible on each side", st["left"] >= 2 and st["right"] >= 2, f"left {st['left']} right {st['right']}")
    page.wait_for_timeout(4600)
    ok &= check("auto-rotates by itself", "N° 8" not in page.evaluate(SEL), page.evaluate(SEL))
    settled(page); i0 = page.evaluate(IDX)
    page.click(".rbtn.next"); settled(page)
    ok &= check("the next button moves one dish forward", (page.evaluate(IDX) - i0) % N == 1)
    ok &= check("a click stops the auto-rotation", page.evaluate(STATE)["play"] == "true")
    i1 = page.evaluate(IDX)
    page.focus("#ring"); page.keyboard.press("ArrowLeft"); page.keyboard.press("ArrowLeft"); settled(page)
    ok &= check("keyboard arrows move 2 dishes back", (i1 - page.evaluate(IDX)) % N == 2, f"{i1} -> {page.evaluate(IDX)}")
    page.click("label.opt:has(input[value=desserts])"); settled(page)
    ok &= check("category chip jumps to desserts", page.evaluate(SEL).startswith("Dessert"), page.evaluate(SEL))
    box = page.evaluate("(() => { const r = document.getElementById('ring').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
    before = page.evaluate(SEL)
    page.mouse.move(box[0], box[1]); page.mouse.down(); page.mouse.move(box[0] - 120, box[1], steps=4); page.mouse.move(box[0] - 320, box[1], steps=6); page.mouse.up(); settled(page)
    ok &= check("dragging left 320 px moves the wheel", page.evaluate(SEL) != before, f"{before} -> {page.evaluate(SEL)}")
    ok &= check("no console errors", not logs, "; ".join(logs[:2]))
    browser.close()
    browser, page, logs = open_page(p, "index.html", 1280, 900, three=False, reduced=True, wait=600)
    page.evaluate("document.getElementById('roulette').scrollIntoView({block:'center'})"); page.wait_for_timeout(500); page.wait_for_timeout(4600)
    ok &= check("reduced motion: no auto-rotation", "N° 8" in page.evaluate(SEL))
    page.click(".rbtn.next"); page.wait_for_timeout(150)
    ok &= check("reduced motion: moves instantly", "N° 10" in page.evaluate(SEL))
    browser.close()
sys.exit(0 if ok else 1)
