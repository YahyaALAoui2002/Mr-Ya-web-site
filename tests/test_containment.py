"""Every vertex of every topping must lie inside the true glass profile (violations must be 0)."""
import sys
from helpers import *

JS = """(() => {
  // GROUND TRUTH glass radius, straight from the cup mesh profile: rounded base corner, then a straight cone from (0.78, y=.11) to (1.08, y=2.9)
  const glass = (y) => { y = Math.max(0, y); if (y >= 0.11) return 0.78 + (1.08 - 0.78) * (y - 0.11) / (2.9 - 0.11);
    const K = [[0, 0.62], [0.012, 0.72], [0.05, 0.765], [0.11, 0.78]];
    for (let i = 1; i < K.length; i++) if (y <= K[i][0]) { const a = K[i-1], b = K[i]; return a[1] + (b[1]-a[1]) * (y-a[0]) / (b[0]-a[0]); } return 0.78; };
  const out = {};
  for (const n of ['tapioca', 'popping', 'beans', 'jellies', 'ice']) {
    const S = window.__dbg[n]; S.ensure(); S.k.fill(1); S.write();
    const g = S.mesh.geometry.attributes.position, a = S.mesh.instanceMatrix.array;
    let worst = -9, beads = 0, outside = 0;
    for (let i = 0; i < S.items.length; i++) { const m = a.subarray(i * 16, i * 16 + 16); let bead = false;
      for (let j = 0; j < g.count; j++) { const x = g.getX(j), y = g.getY(j), z = g.getZ(j);
        const wx = m[0]*x + m[4]*y + m[8]*z + m[12], wy = m[1]*x + m[5]*y + m[9]*z + m[13], wz = m[2]*x + m[6]*y + m[10]*z + m[14];
        const over = Math.hypot(wx, wz) - glass(wy); if (over > worst) worst = over; if (over > 0.002 || wy < -0.001) bead = true; }
      if (bead) outside++; }
    out[n] = { instances: S.items.length, beads_poking_outside_glass: outside, worst_overshoot: +worst.toFixed(3) }; }
  return out; })()"""

with sync_playwright() as p:
    browser, page, logs = open_page(p, "lab.debug.html", 430, 700, reduced=True, wait=14000)
    res = page.evaluate(JS)
    ok = True
    for name, v in res.items():
        ok &= check(f"{name:9} {v['instances']:4} instances, none outside the glass", v["beads_poking_outside_glass"] == 0, f"worst overshoot {v['worst_overshoot']}")
    ok &= check("no console errors", not logs, "; ".join(logs[:2]))
    browser.close()
sys.exit(0 if ok else 1)
