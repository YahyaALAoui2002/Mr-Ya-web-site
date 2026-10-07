"""Shared helpers for the browser tests (Playwright, Python).

Setup once:   pip install -r requirements.txt && playwright install chromium
Run:          npm test            (builds the debug pages, then runs every test)
Note: tests run in headless Chromium with SOFTWARE WebGL (SwiftShader). That is fine for logic, geometry and screenshots,
but it says nothing about real phone / GPU performance, and frames are very slow (seconds): wait for states, do not sleep.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
THREE = (ROOT / "vendor" / "three.min.js").read_bytes()
CDN_THREE = "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js"
GL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
IGNORED_CONSOLE = ("403", "deprecated", "ERR_")      # fonts/CDN blocked offline, three.min.js deprecation notice


def open_page(p, name, w=430, h=760, scheme="light", reduced=False, three=True, wait=9000):
    """Open dist/<name> in Chromium. three=False aborts the Three.js request (UI-only tests, fast)."""
    page_file = DIST / name
    if not page_file.exists():
        sys.exit(f"{page_file} not found. Run `npm run build:debug` first.")
    browser = p.chromium.launch(args=GL_ARGS)
    page = browser.new_page(viewport={"width": w, "height": h}, color_scheme=scheme, reduced_motion="reduce" if reduced else "no-preference")
    page.set_default_timeout(150000)
    if three:
        page.route(CDN_THREE, lambda r: r.fulfill(status=200, content_type="application/javascript", body=THREE))
    else:
        page.route("**/three.min.js", lambda r: r.abort())
    logs = []
    page.on("pageerror", lambda e: logs.append("PAGEERR " + str(e)[:300]))
    page.on("console", lambda m: logs.append(m.type + ": " + m.text[:240]) if m.type in ("error", "warning") and not any(s in m.text for s in IGNORED_CONSOLE) else None)
    page.goto(page_file.as_uri(), wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(wait)
    return browser, page, logs


def click(page, name, value):
    page.evaluate(f"document.querySelector('input[name={name}][value=\"{value}\"]').click()")


def check(label, ok, detail=""):
    print(("  PASS  " if ok else "  FAIL  ") + label + (f"   [{detail}]" if detail else ""))
    return bool(ok)


# --- JS snippets used by several tests (they need the *.debug.html build, which exposes window.__dbg) ---
JS_SAMPLER = """
window.__viol = []; window.__maxK = 0;
const R0=.78,R1=1.08,H=2.9,FILL=2.7; const rAt=y=>R0+(R1-R0)*y/H;
window.__check = () => {
  const d = window.__dbg, names = ['tapioca','popping','beans','jellies','ice'];
  for (const n of names) {
    const S = d[n]; if (!S || !S.mesh) continue;
    const a = S.mesh.instanceMatrix.array;
    for (let i = 0; i < S.items.length; i++) {
      const x=a[i*16+12], y=a[i*16+13], z=a[i*16+14];
      const rad = Math.hypot(x,z);
      if (y > FILL - 0.02 || y < 0.0 || rad > rAt(y) + 0.06) { window.__viol.push([n,i,+x.toFixed(2),+y.toFixed(2),+z.toFixed(2)]); break; }
    }
  }
};
setInterval(window.__check, 40);
"""
JS_STATE = """
(() => { const d = window.__dbg, out = {};
  for (const n of ['tapioca','popping','beans','jellies','ice']) { const S = d[n];
    out[n] = S && S.items ? { on: S.on, active: S.active, visible: S.mesh.visible, kmin: Math.min(...S.k), kmax: Math.max(...S.k), n: S.items.length } : null; }
  return out; })()
"""
