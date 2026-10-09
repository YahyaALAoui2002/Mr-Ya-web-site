"""The PRODUCTION build (dist/site, what GitHub Pages serves): no third-party request, fonts and Three.js self-hosted, share tags and files,
and the hero layout rules from the audit (2-line headline, order button above the fold on a 1440x900 laptop, phone dock, 44 px targets on touch).
Needs `node build.mjs` (npm test does it)."""
import sys, re, threading, functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from helpers import *

SITE = DIST / "site"
if not (SITE / "index.html").exists():
    sys.exit("dist/site/index.html not found. Run `npm run build` first.")
# serve it over http like GitHub Pages does (file:// would make the font preloads fail on CORS, which is not what production does)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(SITE)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{server.server_address[1]}/"
URL = BASE
LINES = "(() => { const h = document.querySelector('h1'); return Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)); })()"


def open_site(p, w, h, touch=False, three=True, wait=800):
    browser = p.chromium.launch(args=GL_ARGS)
    ctx = browser.new_context(viewport={"width": w, "height": h}, is_mobile=touch, has_touch=touch)
    page = ctx.new_page(); page.set_default_timeout(150000)
    reqs, logs = [], []
    page.on("request", lambda r: reqs.append(r.url))
    page.on("pageerror", lambda e: logs.append("PAGEERR " + str(e)[:300]))
    page.on("console", lambda m: logs.append(m.type + ": " + m.text[:240]) if m.type == "error" and (three or "ERR_FAILED" not in m.text) else None)   # aborting Three.js on purpose is not an error
    if not three:
        page.route("**/three.min.js", lambda r: r.abort())
    page.goto(URL, wait_until="domcontentloaded"); page.wait_for_timeout(wait)
    return browser, page, reqs, logs


ok = True
with sync_playwright() as p:
    # 1. the real thing, 3D included: nothing leaves our own origin
    browser, page, reqs, logs = open_site(p, 1440, 900, wait=500)
    page.wait_for_selector("#cup3d.is-3d", timeout=150000); page.wait_for_timeout(1500)
    outside = sorted({u for u in reqs if not u.startswith((BASE, "data:", "blob:"))})
    ok &= check("no request to another origin (no Google Fonts, no CDN)", not outside, ", ".join(outside[:3]))
    ok &= check("the 3D cup starts from the self-hosted Three.js", page.evaluate("typeof THREE !== 'undefined' && !!document.querySelector('#cup3d canvas')"))
    fonts = page.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/\"/g, '') + ' ' + f.weight)")
    for need in ("Familjen Grotesk 400", "Familjen Grotesk 700", "Noto Serif SC 900", "Dancing Script 700"):
        ok &= check(f"font loaded from our files: {need}", need in fonts, ", ".join(fonts))
    ok &= check("the page text really uses Familjen Grotesk", page.evaluate("document.fonts.check('700 20px \"Familjen Grotesk\"')"))
    ok &= check("no console errors", not logs, "; ".join(logs[:2]))
    browser.close()

    # 2. head tags and files that the share previews and search engines need
    html = (SITE / "index.html").read_text(encoding="utf8")
    for label, pat in (("canonical", r'<link rel="canonical" href="https://[^"]+/">'), ("og:image is an absolute https URL", r'og:image" content="https://[^"]+/og\.png"'),
                       ("og:title", r'og:title"'), ("twitter card", r'twitter:card" content="summary_large_image"'), ("svg favicon", r'<link rel="icon" type="image/svg\+xml"'),
                       ("apple-touch-icon", r'<link rel="apple-touch-icon" href="apple-touch-icon\.png">'), ("light theme-color", r'theme-color" content="#eef1ea"'),
                       ("dark theme-color", r'theme-color" content="#122016"'), ("skip link", r'class="skip" href="#top"'), ("mobile dock", r'<nav class="dock"')):
        ok &= check(f"head/markup: {label}", re.search(pat, html) is not None)
    ok &= check("no placeholder left in the page", "%%" not in html and "<!--__" not in html)
    for f in ("og.png", "apple-touch-icon.png", "favicon.svg", "robots.txt", "sitemap.xml", "assets/three.min.js", "assets/fonts/familjen-grotesk-700.woff2", "assets/fonts/noto-serif-sc-900.woff2"):
        ok &= check(f"file shipped: {f}", (SITE / f).exists() and (SITE / f).stat().st_size > 0)
    ok &= check("og.png is 1200x630", (SITE / "og.png").read_bytes()[16:24] == (1200).to_bytes(4, "big") + (630).to_bytes(4, "big"))

    # 3. desktop hero (no WebGL needed for layout)
    browser, page, reqs, logs = open_site(p, 1440, 900, three=False)
    ok &= check("desktop: headline is 2 lines at most", page.evaluate(LINES) <= 2, str(page.evaluate(LINES)))
    bottom = page.evaluate("document.querySelector('.order .btn').getBoundingClientRect().bottom")
    ok &= check("desktop 1440x900: the whole order card (button included) is above the fold", bottom <= 900, f"{bottom:.0f}px")
    ok &= check("desktop: no horizontal scroll", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    ok &= check("desktop: the phone dock is hidden", page.evaluate("getComputedStyle(document.querySelector('.dock')).display") == "none")
    page.keyboard.press("Tab")
    ok &= check("first Tab stop is the skip link", page.evaluate("document.activeElement.className") == "skip")
    page.keyboard.press("Enter"); page.wait_for_timeout(200)
    ok &= check("the skip link moves focus to <main>", page.evaluate("document.activeElement.tagName") == "MAIN")
    for (w, h) in ((1366, 768), (1024, 768)):
        page.set_viewport_size({"width": w, "height": h}); page.wait_for_timeout(300)
        ok &= check(f"{w}x{h}: headline 2 lines, no sideways scroll", page.evaluate(LINES) <= 2 and page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    ok &= check("no console errors (no 3D)", not logs, "; ".join(logs[:2]))
    browser.close()

    # 4. phone: headline, dock, touch targets
    browser, page, reqs, logs = open_site(p, 390, 844, touch=True, three=False)
    ok &= check("phone: headline is 2 lines at most", page.evaluate(LINES) <= 2, str(page.evaluate(LINES)))
    ok &= check("phone: no horizontal scroll", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    dock = page.evaluate("(() => { const d = document.querySelector('.dock'); const r = d.getBoundingClientRect(); return { shown: getComputedStyle(d).display !== 'none', bottom: Math.round(r.bottom), n: d.querySelectorAll('a').length, minH: Math.min(...[...d.querySelectorAll('a')].map(a => a.getBoundingClientRect().height)) }; })()")
    ok &= check("phone: the dock is pinned to the bottom with 4 links", dock["shown"] and dock["bottom"] == 844 and dock["n"] == 4, str(dock))
    ok &= check("phone: dock buttons are at least 44 px tall", dock["minH"] >= 44, f"{dock['minH']:.0f}px")
    ok &= check("phone: the top nav is replaced (header nav and call hidden)", page.evaluate("getComputedStyle(document.querySelector('header nav')).display") == "none")
    small = page.evaluate("[...document.querySelectorAll('.opt span, .tab, .btn, .dock a')].filter(e => e.offsetParent !== null).map(e => [e.textContent.trim().slice(0, 18), Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44)")
    ok &= check("touch: chips, tabs and buttons are all at least 44 px tall", not small, str(small[:4]))
    page.evaluate("document.getElementById('carte').scrollIntoView()"); page.wait_for_timeout(300)
    top = page.evaluate("document.getElementById('carte').getBoundingClientRect().top")
    ok &= check("phone: a dock link lands the section below the sticky header", 60 <= top <= 140, f"{top:.0f}px")
    browser.close()

sys.exit(0 if ok else 1)
