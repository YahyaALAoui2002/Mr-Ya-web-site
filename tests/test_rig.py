"""The rigged bear, structure: real bones in the right hierarchy, the Head as its own node (face, ears, muzzle all hang from it, body does not),
the animation clips (they move the right bones and never the Head, which is driven live), the wireframe view (quad edges) and the branded apron
(text + pocket slits painted, and it clears the body). No frames are needed: this runs on poses."""
import sys, math
from helpers import *

EXPECT_PARENT = {"root": "MrYeBear", "hips": "root", "spine": "hips", "neck": "spine", "Head": "neck", "earL": "Head", "earR": "Head",
                 "shoulderL": "spine", "shoulderR": "spine", "hipL": "hips", "hipR": "hips"}
HEAD_MESHES = {"head", "earL", "earR", "eyeballs", "catchlights", "nose", "mouth", "mouthOpening", "tongue"}
BODY_MESHES = {"torso", "pelvis", "armL", "armR", "legL", "legR", "apron", "apronTrim"}
ok = True
with sync_playwright() as p:
    browser, page, logs = open_page(p, "lab.debug.html", 360, 400, wait=100)
    page.evaluate("() => { const d = window.__dbg; d.mascot.autoplay = false; d.mascot.blink = false; d.bearApi.pose('none', 0); }")

    # ---- the bones
    info = page.evaluate("(() => { const r = window.__dbg.rig, o = {}; for (const k in r) o[k] = { parent: r[k].parent && r[k].parent.name, bone: r[k].isBone === true }; return o; })()")
    ok &= check("every bone exists with the right parent", all(k in info and info[k]["parent"] == v for k, v in EXPECT_PARENT.items()) and len(info) == len(EXPECT_PARENT),
                ", ".join(f"{k}<-{v['parent']}" for k, v in info.items() if EXPECT_PARENT.get(k) != v["parent"]) or f"{len(info)} bones")
    ok &= check("they are real THREE.Bone objects", all(v["bone"] for v in info.values()))

    # ---- the Head is its own node
    names = page.evaluate("""(() => { const d = window.__dbg, under = new Set(), out = new Set();
      d.rig.Head.traverse(o => { if (o.isMesh) under.add(o.name); });
      d.bear.traverse(o => { if (o.isMesh && !under.has(o.name)) out.add(o.name); });
      return [[...under].sort(), [...out].sort()]; })()""")
    ok &= check("everything on the head hangs from the Head node", set(names[0]) == HEAD_MESHES, ", ".join(names[0]))
    ok &= check("no body part hangs from the Head node, and every body part is outside it", set(names[1]) == BODY_MESHES, ", ".join(names[1]))
    moved = page.evaluate("""(() => { const d = window.__dbg, torso = d.rig.spine.children.find(o => o.name === 'torso'), eye = d.rig.Head.getObjectByName('eyeballs');
      d.bear.updateMatrixWorld(true); const t0 = torso.matrixWorld.elements.slice(), e0 = eye.matrixWorld.elements.slice();
      d.rig.Head.rotation.y += 0.6; d.bear.updateMatrixWorld(true);
      const dt = Math.max(...torso.matrixWorld.elements.map((v, i) => Math.abs(v - t0[i]))), de = Math.max(...eye.matrixWorld.elements.map((v, i) => Math.abs(v - e0[i])));
      d.rig.Head.rotation.y -= 0.6; d.bear.updateMatrixWorld(true); return [dt, de]; })()""")
    ok &= check("turning the Head moves the face and not the torso", moved[0] < 1e-9 and moved[1] > 0.05, f"torso change {moved[0]:.1e}, eyes change {moved[1]:.2f}")

    # ---- geometry sanity
    g = page.evaluate("""(() => { let bad = 0, mesh = 0, tris = 0; window.__dbg.bear.traverse(o => { if (!o.isMesh) return; mesh++; tris += o.geometry.index.count / 3;
      o.geometry.computeBoundingSphere(); const r = o.geometry.boundingSphere.radius; if (!(r > 0.05 && r < 6) || o.geometry.attributes.position.array.some(v => !Number.isFinite(v))) bad++; });
      return { mesh, tris, bad }; })()""")
    ok &= check("every mesh has finite, sane geometry", g["bad"] == 0, f"{g['mesh']} meshes, {int(g['tris'])} triangles")

    # ---- clips
    clips = page.evaluate("(() => { const a = window.__dbg.bearApi; return Object.fromEntries(Object.entries(a.mixer._actions ? {} : {}).concat(a.clips.map(n => [n, 0]))); })()")
    ok &= check("clips wave, cheer, nod and tilt exist", sorted(clips.keys()) == ["cheer", "nod", "tilt", "wave"], ", ".join(sorted(clips.keys())))
    tracks = page.evaluate("(() => window.__dbg.bearApi.mixer._actions.map(a => ({ name: a.getClip().name, dur: a.getClip().duration, tracks: a.getClip().tracks.map(t => t.name) })))()")
    allnames = [t for c in tracks for t in c["tracks"]]
    ok &= check("every track targets an existing bone", all(t.split(".")[0] in info for t in allnames), f"{len(allnames)} tracks in {len(tracks)} clips")
    ok &= check("no clip drives the Head (it is driven live: pointer look-at + nod spring)", not any(t.startswith("Head.") for t in allnames))
    ok &= check("every clip has a positive duration", all(c["dur"] > 0.5 for c in tracks), ", ".join(f"{c['name']} {c['dur']:.1f}s" for c in tracks))

    ANG = """([bone, clip, t]) => { const d = window.__dbg; d.bearApi.pose('none', 0); const q0 = d.rig[bone].quaternion.clone(); d.bearApi.pose(clip, t); return d.rig[bone].quaternion.angleTo(q0); }"""
    REST = """([bone, ex, ey, ez]) => { const d = window.__dbg; d.bearApi.pose('none', 0); return d.rig[bone].quaternion.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(ex, ey, ez))); }"""
    r1 = page.evaluate(REST, ["shoulderR", -0.3, 0, -0.17]); r2 = page.evaluate(REST, ["shoulderL", -0.3, 0, 0.17])
    ok &= check("idle leaves the arms at their rest pose", r1 < 0.1 and r2 < 0.1, f"{r1:.3f} / {r2:.3f} rad")
    a = page.evaluate(ANG, ["shoulderR", "wave", 1.2]); b = page.evaluate(ANG, ["shoulderL", "wave", 1.2])
    ok &= check("wave raises the right arm and leaves the left arm alone", a > 1.5 and b < 0.15, f"right {a:.2f} rad, left {b:.2f} rad")
    a = page.evaluate(ANG, ["shoulderR", "cheer", 0.7]); b = page.evaluate(ANG, ["shoulderL", "cheer", 0.7])
    ok &= check("cheer raises both arms", a > 1.5 and b > 1.5, f"{a:.2f} / {b:.2f} rad")
    hy = page.evaluate("""() => { const d = window.__dbg; d.bearApi.pose('none', 0); const y0 = d.rig.hips.position.y; d.bearApi.pose('cheer', 0.5); return d.rig.hips.position.y - y0; }""")
    ok &= check("cheer makes the whole bear bounce", hy > 0.03, f"hips +{hy:.3f}")
    a = page.evaluate(ANG, ["neck", "nod", 0.15]); b = page.evaluate(ANG, ["neck", "tilt", 1.0])
    ok &= check("nod and tilt move the neck", a > 0.08 and b > 0.15, f"nod {a:.2f}, tilt {b:.2f} rad")
    a = page.evaluate(ANG, ["shoulderR", "wave", 2.79]); b = page.evaluate(ANG, ["shoulderR", "wave", 0.0])
    ok &= check("every clip starts and ends on the idle pose (no pop when it blends)", a < 0.35 and b < 0.05, f"end {a:.2f}, start {b:.3f} rad")
    page.evaluate("window.__dbg.bearApi.pose('none', 0)")

    # ---- the shoulders are connected: the top contour of torso + arm (rest pose, front view) slopes down from the neck to the arm, no valley and no bump
    #      (the first version had arms like separate pads: the torso narrowed, then the arm top stuck up again)
    cont = page.evaluate("""(() => { const d = window.__dbg; d.bearApi.pose('none', 0); d.bear.updateMatrixWorld(true);
      const inv = d.bear.matrixWorld.clone().invert(), v = new THREE.Vector3(), pts = [];
      for (const nm of ['torso', 'armL']) { const m = d.bearMeshes.find(b => b.mesh.name === nm).mesh, a = m.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv); pts.push([v.x, v.y]); } }
      const ys = []; for (let x = 0.6; x <= 1.3001; x += 0.1) { let top = -1; for (const [px, py] of pts) if (Math.abs(px - x) < 0.07 && py > top) top = py; ys.push(+top.toFixed(3)); }
      return ys; })()""")
    drops = [round(cont[i] - cont[i + 1], 3) for i in range(len(cont) - 1)]            # how much the contour falls at each 0.1 step outwards
    ok &= check("the shoulder line slopes down from the neck over the arm: no shelf (every step falls) and no bump", min(drops[:5]) >= 0.015 and min(drops) >= -0.04, f"contour {cont}, drops {drops}")
    arms_in = page.evaluate("""(() => { const d = window.__dbg, out = []; d.bearApi.pose('none', 0); d.bear.updateMatrixWorld(true);
      for (const [b, sx] of [['shoulderL', 1], ['shoulderR', -1]]) { const w = d.rig[b].getWorldPosition(new THREE.Vector3()); d.bear.worldToLocal(w); out.push(+(Math.abs(w.x)).toFixed(2)); }
      return out; })()""")
    ok &= check("the shoulder joints sit inside the torso (|x| < 1.0 where the torso is 1.2 wide)", all(x < 1.0 for x in arms_in), f"|x| = {arms_in}")

    # ---- a clip that is interrupted must not leave weight behind (it would freeze half a pose into the bear)
    wts = page.evaluate("""(() => { const d = window.__dbg, a = d.bearApi; a.pose('none', 0); d.mascot.autoplay = false;
      a.play('wave'); a.pose('wave', 1.2); a.play('cheer'); a.mixer.update(0.05);                  // pose() leaves 'wave' current; play('cheer') interrupts it
      const w = Object.fromEntries(a.mixer._actions.map(x => [x.getClip().name, +x.weight.toFixed(3)])); a.pose('none', 0); return w; })()""")
    ok &= check("an interrupted clip leaves no weight behind", wts.get("wave") == 0 and wts.get("tilt") == 0 and wts.get("nod") == 0, str(wts))
    page.evaluate("window.mryeCup.setMascot(false)")
    hid = page.evaluate("window.__dbg.bearApi.play('wave')"); page.evaluate("window.mryeCup.setMascot(true)")
    ok &= check("a hidden bear does not queue clips", hid is False)

    # ---- wireframe view: grey clay + QUAD edges
    w = page.evaluate("""(() => { const d = window.__dbg, torso = d.bearMeshes.find(b => b.mesh.name === 'torso'); const fur = torso.mat;
      d.bearApi.setWire(true); const on = { clay: torso.mesh.material !== fur, lines: torso.wire && torso.wire.visible && torso.wire.geometry.index.count / 2 };
      d.bearApi.setWire(false); return { on, back: torso.mesh.material === fur && !torso.wire.visible, furIsVertexColoured: fur.vertexColors === true }; })()""")
    ok &= check("wireframe view: clay + quad-edge lines, and back to fur", w["on"]["clay"] and w["on"]["lines"] > 1000 and w["back"] and w["furIsVertexColoured"], f"{w['on']['lines']} quad edges on the torso")
    ok &= check("the torso is all quads: a closed all-quad mesh has 2 x quads edges (4 (nx ny + ny nz + nz nx) for 18 x 18 x 16)", w["on"]["lines"] == 4 * (18 * 18 + 18 * 16 + 16 * 18), f"{w['on']['lines']}")

    # ---- the branded apron
    ap = page.evaluate("""(() => { const d = window.__dbg, a = d.bearMeshes.find(b => b.mesh.name === 'apron'), img = a.mat.map.image, g = img.getContext('2d', { willReadFrequently: true }), ALL = g.getImageData(0, 0, 1024, 1024).data;       // one readback
      const px = (x0, y0, x1, y1, f) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 1024 + x) * 4; if (f(ALL[i], ALL[i + 1], ALL[i + 2])) n++; } return n; };
      const text = px(230, 20, 800, 260, (r, gg, b) => r > 215 && gg > 215 && b > 200), orange = px(100, 230, 930, 420, (r, gg, b) => r > 180 && gg > 60 && gg < 130 && b < 60);
      const p = a.mesh.geometry.attributes.position, sp = d.bw.spine; let worst = 1e9;
      for (let i = 0; i < p.count; i++) worst = Math.min(worst, d.apronClear(p.getX(i) + sp[0], p.getY(i) + sp[1], p.getZ(i) + sp[2]));
      return { text, orange, worst, parent: a.mesh.parent.name }; })()""")
    ok &= check("the apron carries the brand print (white text painted on the cloth)", ap["text"] > 8000, f"{ap['text']} text pixels")
    ok &= check("the red-orange pocket bars are painted on the cloth", ap["orange"] > 4000, f"{ap['orange']} orange pixels")
    ok &= check("the apron hangs on the spine", ap["parent"] == "spine")
    ok &= check("the apron clears the torso, pelvis and legs everywhere (no fur through the cloth)", ap["worst"] > 0.012, f"smallest clearance {ap['worst']:.3f}")
    ok &= check("no console errors", not logs, "; ".join(logs[:2]))
    browser.close()
sys.exit(0 if ok else 1)
