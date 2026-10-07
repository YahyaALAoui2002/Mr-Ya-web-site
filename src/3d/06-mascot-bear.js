  /* ---------- Mascot: the restaurant's teddy bear, seated beside the cup ----------
     Modelled from the photo of the shop front. The plush body (head, ears, muzzle, arms, legs, feet) is ONE smooth mesh: a signed
     distance field of ~20 soft blobs, polygonised once at load (marching tetrahedra, time-sliced so the page never freezes). The apron,
     eyes, nose and mouth are separate small meshes. The head turns inside the vertex shader, so the single mesh still follows the pointer. */
  /* ===== SDF teddy body: ONE smooth plush mesh, generated once at load (marching tetrahedra) ===== */
  const bClamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const bSstep = (a, b, x) => { const t = bClamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const bHex = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };          // sRGB hex -> linear colour (vertex colours are linear)
  const BTAN = bHex('#b08856'), BCREAM = bHex('#efdcb6'), BEAR_IN = bHex('#6e4326');       // caramel fur, cream muzzle/soles, darker inner ear (all measured on the shop photo)
  /* proportions: ONE table to tune against the photo. c/r = ellipsoid, a/b/rad = capsule, k = how softly it blends into the rest */
  const BP = [];
  const bPart = (sym, o) => {
    const mir = (v, s) => v ? [v[0] * s, v[1], v[2]] : undefined;
    for (const s of (sym ? [-1, 1] : [1])) BP.push({ c: mir(o.c, s), a: mir(o.a, s), b: mir(o.b, s), r: o.r, rad: o.rad, k: o.k, col: o.col });
  };
  bPart(0, { c: [0, 0.55, -0.06], r: [1.14, 0.60, 1.04], k: 0.55, col: BTAN });          // hips
  bPart(0, { c: [0, 1.02, 0.10], r: [1.18, 1.00, 1.06], k: 0.60, col: BTAN });           // heavy belly
  bPart(0, { c: [0, 1.60, 0.02], r: [1.00, 0.90, 0.88], k: 0.55, col: BTAN });           // chest
  bPart(0, { a: [0, 1.95, 0.06], b: [0, 2.42, 0.10], rad: 0.55, k: 0.60, col: BTAN });   // neck
  bPart(0, { c: [0, 2.91, 0.10], r: [0.90, 0.84, 0.86], k: 0.32, col: BTAN });           // head
  bPart(0, { c: [0, 2.78, 0.74], r: [0.42, 0.33, 0.32], k: 0.20, col: BCREAM });         // muzzle (short and wide like the real bear, not a snout)
  bPart(1, { c: [0.70, 3.49, -0.02], r: [0.31, 0.31, 0.21], k: 0.14, col: BTAN });       // ears
  bPart(1, { c: [0.68, 3.46, 0.12], r: [0.19, 0.19, 0.10], k: 0.10, col: BEAR_IN });     // inner ears
  /* ARMS hang down the OUTER sides of the body and end in small round paws. LEGS stretch forward, apart, and end in big feet with a cream sole facing the viewer. */
  bPart(1, { a: [1.02, 1.95, 0.06], b: [1.50, 0.98, 0.38], rad: 0.31, k: 0.16, col: BTAN });     // arm: shoulder to wrist
  bPart(1, { c: [1.54, 0.84, 0.46], r: [0.31, 0.33, 0.31], k: 0.12, col: BTAN });                // paw (small, round)
  bPart(1, { a: [0.64, 0.64, 0.08], b: [0.86, 0.60, 1.18], rad: 0.50, k: 0.22, col: BTAN });     // thigh, forward
  bPart(1, { a: [0.86, 0.60, 1.18], b: [0.92, 0.54, 1.82], rad: 0.43, k: 0.20, col: BTAN });     // lower leg
  bPart(1, { c: [0.94, 0.56, 2.0], r: [0.46, 0.43, 0.46], k: 0.16, col: BTAN });                 // foot (big, rounded)
  bPart(1, { c: [0.94, 0.62, 2.34], r: [0.31, 0.35, 0.15], k: 0.07, col: BCREAM });              // cream sole pad, facing the viewer
  bPart(0, { c: [0, 0.72, -0.96], r: [0.30, 0.28, 0.26], k: 0.30, col: BTAN });          // tail
  bPart(0, { c: [0, 1.02, 0.60], r: [0.72, 0.80, 0.40], k: 0.22, col: BCREAM });         // cream belly patch
  const BTORSO = 4;                                    // the first four parts (hips, belly, chest, neck) are what the apron is draped on
  const _bcol = [0, 0, 0];
  function bPrim(pt, x, y, z) {
    if (pt.rad !== undefined) {                        // capsule
      const ax = x - pt.a[0], ay = y - pt.a[1], az = z - pt.a[2], bx = pt.b[0] - pt.a[0], by = pt.b[1] - pt.a[1], bz = pt.b[2] - pt.a[2];
      let h = (ax * bx + ay * by + az * bz) / (bx * bx + by * by + bz * bz); h = h < 0 ? 0 : h > 1 ? 1 : h;
      const dx = ax - bx * h, dy = ay - by * h, dz = az - bz * h;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - pt.rad;
    }
    const qx = (x - pt.c[0]) / pt.r[0], qy = (y - pt.c[1]) / pt.r[1], qz = (z - pt.c[2]) / pt.r[2];
    const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    if (k0 < 1e-5) return -Math.min(pt.r[0], pt.r[1], pt.r[2]);
    const k1 = Math.sqrt(qx * qx / (pt.r[0] * pt.r[0]) + qy * qy / (pt.r[1] * pt.r[1]) + qz * qz / (pt.r[2] * pt.r[2]));
    return k0 * (k0 - 1) / k1;                         // ellipsoid distance (iq's approximation)
  }
  /* smooth union of parts [0, n): polynomial smooth-min, the colour is carried along with the same weight */
  function bField(x, y, z, colOut, n) {
    const N = n || BP.length;
    let pt = BP[0], d = bPrim(pt, x, y, z), r = pt.col[0], g = pt.col[1], b = pt.col[2];
    for (let i = 1; i < N; i++) {
      pt = BP[i];
      const pd = bPrim(pt, x, y, z), k = pt.k, h = bClamp01(0.5 + 0.5 * (pd - d) / k);      // NB: (pd - d): h -> 1 where the accumulated shape is the nearer one
      d = pd * (1 - h) + d * h - k * h * (1 - h);
      const hc = bSstep(0.12, 0.88, h);                                                      // colour boundaries crisper than the shape blend
      r = pt.col[0] * (1 - hc) + r * hc; g = pt.col[1] * (1 - hc) + g * hc; b = pt.col[2] * (1 - hc) + b * hc;
    }
    if (n === undefined) d = Math.max(d, -y);          // flat base: everything below the ground is cut away
    if (colOut) { colOut[0] = r; colOut[1] = g; colOut[2] = b; }
    return d;
  }
  const bHash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  function bNoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    let acc = 0;
    for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++)
      acc += bHash(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    return acc * 2 - 1;
  }
  /* the head (and only the head) turns: 1 on the head + ears, 0 on the body and the shoulders, soft across the neck */
  const bHeadMask = (x, y) => bSstep(2.05, 2.3, y) * (1 - bSstep(0.75, 1.0, Math.abs(x)) * (1 - bSstep(2.7, 3.05, y)));
  const BAO_H = [0.05, 0.12, 0.24, 0.42], BAO_W = [0.3, 0.3, 0.25, 0.15], BAO_GAIN = 1.5;       // baked occlusion: 4 field samples along the normal
  const BMIN = [-2.15, -0.02, -1.35], BMAX = [2.15, 3.9, 2.75];
  const BH = (typeof innerWidth !== 'undefined' && innerWidth < 760) ? 0.1 : 0.072;       // lattice step: coarser on phones (the fine fur is done in the shader)
  const BNX = Math.ceil((BMAX[0] - BMIN[0]) / BH) + 1, BNY = Math.ceil((BMAX[1] - BMIN[1]) / BH) + 1, BNZ = Math.ceil((BMAX[2] - BMIN[2]) / BH) + 1;
  /* marching tetrahedra, written as a generator so it can be time-sliced (it yields once per lattice slice) */
  function* bearGeometryGen() {
    const NXY = BNX * BNY, NTOT = NXY * BNZ, latId = (i, j, k) => i + j * BNX + k * NXY;
    const F = new Float32Array(NTOT);
    for (let k = 0; k < BNZ; k++) {
      for (let j = 0; j < BNY; j++) for (let i = 0; i < BNX; i++) F[latId(i, j, k)] = bField(BMIN[0] + i * BH, BMIN[1] + j * BH, BMIN[2] + k * BH, null);
      yield;
    }
    const pos = [], nor = [], col = [], hd = [], bl = [], idx = [], vmap = new Map();
    const EP = BH * 0.4, FUZZ = BH * 0.34, FFREQ = 3.2;                    // coherent, low-frequency lumpiness: per-vertex jitter folds the many tiny triangles
    const CO = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    const TETS = [[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
    const cid = new Int32Array(8);
    function vert(idA, idB, vA, vB) {                  // welded vertex on a lattice edge
      const lo = idA < idB ? idA : idB, hi = idA < idB ? idB : idA, key = lo * NTOT + hi;
      let id = vmap.get(key); if (id !== undefined) return id;
      const vlo = idA < idB ? vA : vB, vhi = idA < idB ? vB : vA, t = vlo / (vlo - vhi);      // t runs from the LOWER lattice id to the higher one, whichever order the edge was listed in
      const ai = lo % BNX, aj = ((lo / BNX) | 0) % BNY, ak = (lo / NXY) | 0, bi = hi % BNX, bj = ((hi / BNX) | 0) % BNY, bk = (hi / NXY) | 0;
      const px = BMIN[0] + (ai + (bi - ai) * t) * BH, py = BMIN[1] + (aj + (bj - aj) * t) * BH, pz = BMIN[2] + (ak + (bk - ak) * t) * BH;
      const gx = bField(px + EP, py, pz) - bField(px - EP, py, pz), gy = bField(px, py + EP, pz) - bField(px, py - EP, pz), gz = bField(px, py, pz + EP) - bField(px, py, pz - EP);
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1, nx = gx / gl, ny = gy / gl, nz = gz / gl;
      const f = bNoise(px * FFREQ, py * FFREQ, pz * FFREQ) * FUZZ * (py > 0.06 ? 1 : 0);   // plush fuzz, not on the flat base
      const qx = px + nx * f, qy = Math.max(0, py + ny * f), qz = pz + nz * f;
      bField(qx, qy, qz, _bcol);
      const gm = gl / (2 * EP);                          // |grad f|: the smooth unions make the field a little slower than a true distance, so measure against it
      let occ = 0; for (let m = 0; m < 4; m++) { const h = BAO_H[m]; occ += BAO_W[m] * bClamp01(1 - bField(qx + nx * h, qy + ny * h, qz + nz * h) / (gm * h)); }
      occ = bClamp01(occ * BAO_GAIN);
      id = pos.length / 3; pos.push(qx, qy, qz); nor.push(nx, ny, nz);
      col.push(_bcol[0] * (1 - 0.50 * occ), _bcol[1] * (1 - 0.62 * occ), _bcol[2] * (1 - 0.75 * occ));      // creases go warm brown, not grey
      hd.push(bHeadMask(qx, qy));
      bl.push(bSstep(0.45, 0.85, qy) * (1 - bSstep(1.55, 2.05, qy)) * (1 - bSstep(0.55, 1.25, Math.hypot(qx, qz - 0.1))));
      vmap.set(key, id); return id;
    }
    function tri(a, b, c) {                            // wind outward, judged against the averaged vertex normals
      const ax = pos[a*3], ay = pos[a*3+1], az = pos[a*3+2];
      const e1x = pos[b*3] - ax, e1y = pos[b*3+1] - ay, e1z = pos[b*3+2] - az, e2x = pos[c*3] - ax, e2y = pos[c*3+1] - ay, e2z = pos[c*3+2] - az;
      const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
      const sx = nor[a*3] + nor[b*3] + nor[c*3], sy = nor[a*3+1] + nor[b*3+1] + nor[c*3+1], sz = nor[a*3+2] + nor[b*3+2] + nor[c*3+2];
      if (fx * sx + fy * sy + fz * sz < 0) idx.push(a, c, b); else idx.push(a, b, c);
    }
    for (let k = 0; k < BNZ - 1; k++) {
      for (let j = 0; j < BNY - 1; j++) for (let i = 0; i < BNX - 1; i++) {
        let neg = 0;
        for (let c = 0; c < 8; c++) { cid[c] = latId(i + CO[c][0], j + CO[c][1], k + CO[c][2]); if (F[cid[c]] < 0) neg++; }
        if (neg === 0 || neg === 8) continue;
        for (const tet of TETS) {
          const v = [F[cid[tet[0]]], F[cid[tet[1]]], F[cid[tet[2]]], F[cid[tet[3]]]], ins = [], out = [];
          for (let m = 0; m < 4; m++) (v[m] < 0 ? ins : out).push(m);
          if (ins.length === 0 || ins.length === 4) continue;
          const e = (a, b) => vert(cid[tet[a]], cid[tet[b]], v[a], v[b]);
          if (ins.length === 1 || out.length === 1) {   // one vertex apart from the other three: a triangle
            const s = ins.length === 1 ? ins[0] : out[0], o = ins.length === 1 ? out : ins;
            tri(e(s, o[0]), e(s, o[1]), e(s, o[2]));
          } else {                                      // two against two: a quad, in cyclic order (a,c) (a,d) (b,d) (b,c)
            const [a, b] = ins, [c, d] = out;
            const p0 = e(a, c), p1 = e(a, d), p2 = e(b, d), p3 = e(b, c);
            tri(p0, p1, p2); tri(p0, p2, p3);
          }
        }
      }
      yield;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aHead', new THREE.Float32BufferAttribute(hd, 1));
    geo.setAttribute('aBelly', new THREE.Float32BufferAttribute(bl, 1));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    return geo;
  }

  const bear = new THREE.Group();
  const mascot = { on: true, ready: false, baseYaw: -0.5, head: null, nod: 0, nodV: 0, yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };
  scene.add(bear);
  const BPIVOT = new THREE.Vector3(0, 2.43, 0.08);
  const furTex = canvasTex(512, 512, (g, w, h) => {                           // tileable plush strokes (strokes near an edge are repeated on the opposite side)
    g.fillStyle = '#f7f1e6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 15000; i++) {
      const x = rand() * w, y = rand() * h, a = rand() * 6.283, len = 5 + rand() * 12;
      g.strokeStyle = (rand() > 0.5 ? 'rgba(255,250,238,A)' : 'rgba(122,88,46,A)').replace('A', (0.1 + rand() * 0.18).toFixed(2)); g.lineWidth = 1 + rand() * 0.9;
      for (const ox of (x < 18 ? [0, w] : x > w - 18 ? [-w, 0] : [0])) for (const oy of (y < 18 ? [0, h] : y > h - 18 ? [-h, 0] : [0])) {
        g.beginPath(); g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(x + ox + Math.cos(a + 0.7) * len * 0.5, y + oy + Math.sin(a + 0.7) * len * 0.5, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke();
      }
    }
  }, { wrap: true });
  const furU = { uPivot: { value: BPIVOT }, uHeadRot: { value: new THREE.Matrix3() }, uBreath: { value: 0 }, uFur: { value: furTex }, uBump: { value: 0.0045 } };
  const furMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.94, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xf6d9a0), envMapIntensity: 0.75 });
  furMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, furU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aHead; attribute float aBelly;
        uniform vec3 uPivot; uniform mat3 uHeadRot; uniform float uBreath;
        varying vec3 vBearP; varying vec3 vBearN;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = normalize(mix(objectNormal, uHeadRot * objectNormal, aHead));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBearP = position; vBearN = normal;                                       // the fur texture stays attached to the surface
        transformed.xz *= 1.0 + uBreath * aBelly;
        vec3 hp = transformed - uPivot; transformed = uPivot + mix(hp, uHeadRot * hp, aHead);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uFur; uniform float uBump; varying vec3 vBearP; varying vec3 vBearN;
        float furH(vec3 p, vec3 n) {                                              // triplanar plush strokes: no UV seams on a generated mesh
          vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
          return texture2D(uFur, p.zy * 0.9).r * w.x + texture2D(uFur, p.xz * 0.9).r * w.y + texture2D(uFur, p.xy * 0.9).r * w.z;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.9, 1.09, furH(vBearP, normalize(vBearN)));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float fh = furH(vBearP, normalize(vBearN));
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
          vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1);
          normal = normalize(abs(det) * normal - uBump * sign(det) * (dFdx(fh) * R1 + dFdy(fh) * R2)); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float bearRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.5);
          totalEmissiveRadiance += vec3(0.98, 0.82, 0.55) * bearRim * 0.16; }`);        // soft warm plush rim
  };
  /* build the body a little after the first frame, a few milliseconds per frame */
  const bearGen = bearGeometryGen();
  const installBody = (geo) => { if (mascot.ready) return; const m = new THREE.Mesh(geo, furMat); m.frustumCulled = false; bear.add(m); mascot.ready = true; needs = true; };
  const bearPump = () => {
    const t = performance.now(); let r;
    do { r = bearGen.next(); } while (!r.done && performance.now() - t < 7);
    if (!r.done) { requestAnimationFrame(bearPump); return; }
    installBody(r.value);
  };
  mascot.finish = () => { if (mascot.ready) return; let r; while (!(r = bearGen.next()).done); installBody(r.value); };      // synchronous build (tests, or if you ever want it before the first frame)
  setTimeout(() => requestAnimationFrame(bearPump), 350);

  /* face: eyes (with catchlights), nose, mouth. Each feature is placed ON the real surface of the head field (faceZ), so nothing floats.
     They sit on the head pivot and use the same rotation as the shader. */
  const headFx = new THREE.Group(); headFx.position.copy(BPIVOT); headFx.rotation.order = 'YXZ'; bear.add(headFx); mascot.head = headFx;
  const faceZ = (x, y) => { let lo = 0.15, hi = 2.4; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (bField(x, y, m) > 0) hi = m; else lo = m; } return (lo + hi) / 2; };
  const fxm = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat); m.scale.set(sx, sy, sz); m.position.set(x - BPIVOT.x, y - BPIVOT.y, z - BPIVOT.z); headFx.add(m); return m; };
  const noseMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2216, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x070605, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x3a2216, roughness: 0.6 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: 0xc8805a, roughness: 0.65 });
  const BEYE = { x: 0.215, y: 3.17 }, BNOSE = { y: 2.93 };
  for (const s of [-1, 1]) {
    const ez = faceZ(s * BEYE.x, BEYE.y);
    fxm(eyeMat, 0.064, 0.074, 0.05, s * BEYE.x, BEYE.y, ez - 0.012);
    fxm(lightMat, 0.017, 0.017, 0.012, s * (BEYE.x - 0.022), BEYE.y + 0.03, ez + 0.036);
  }
  fxm(noseMat, 0.15, 0.105, 0.1, 0, BNOSE.y, faceZ(0, BNOSE.y) - 0.03);
  (function buildMouth() {                                                    // philtrum + a soft open smile with a tongue, drawn on the muzzle surface
    const P = (x, y, lift) => new THREE.Vector3(x - BPIVOT.x, y - BPIVOT.y, faceZ(x, y) + (lift || 0.006) - BPIVOT.z);
    const line = (pts, r) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 6), lineMat); headFx.add(m); };
    line([P(0, 2.86), P(0, 2.78), P(0, 2.715)], 0.0105);
    line([[-1, 0.235, 2.755], [-1, 0.19, 2.705], [-1, 0.12, 2.685], [-1, 0.055, 2.69], [0, 0, 2.715], [1, 0.055, 2.69], [1, 0.12, 2.685], [1, 0.19, 2.705], [1, 0.235, 2.755]].map(([sd, x, y]) => P(sd * x, y)), 0.0105);   // one tube for the whole smile
    fxm(lineMat, 0.155, 0.062, 0.03, 0, 2.645, faceZ(0, 2.645) - 0.016);      // mouth opening
    fxm(tongueMat, 0.108, 0.04, 0.03, 0, 2.612, faceZ(0, 2.612) - 0.008);     // tongue
  })();

  /* apron: draped on the TORSO field (not the arms), so it can never bulge onto a paw */
  const apronGreen = new THREE.MeshStandardMaterial({ color: 0x173f37, roughness: 0.85 });
  const apronOrange = new THREE.MeshStandardMaterial({ color: 0xe8802a, roughness: 0.55 });
  const aCv = document.createElement('canvas'); aCv.width = aCv.height = 1024;
  const drawApron = () => {
    const g = aCv.getContext('2d'); g.fillStyle = '#1c4a40'; g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 2;
    for (let i = -1024; i < 2048; i += 7) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 1024, 1024); g.stroke(); }
    g.fillStyle = '#f4f1e8'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '900 150px "Noto Serif SC","Songti SC","SimSun",serif'; g.fillText('幸福食光', 512, 300);
    g.font = '700 120px "Noto Serif SC","Songti SC",Georgia,serif'; g.fillText('Mr.Ye', 512, 438);
    g.lineCap = 'round';
    for (const sd of [-1, 1]) {                                                 // the two orange pocket slits: painted on the cloth, they slant up toward the centre
      g.strokeStyle = 'rgba(8,24,22,.5)'; g.lineWidth = 84; g.beginPath(); g.moveTo(512 + sd * 366, 618); g.lineTo(512 + sd * 200, 524); g.stroke();
      g.strokeStyle = '#ee8a2c'; g.lineWidth = 58; g.beginPath(); g.moveTo(512 + sd * 364, 608); g.lineTo(512 + sd * 202, 516); g.stroke();
    }
  };
  drawApron();
  const aTex = new THREE.CanvasTexture(aCv); aTex.colorSpace = THREE.SRGBColorSpace; aTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (document.fonts && document.fonts.load) document.fonts.load('900 150px "Noto Serif SC"', '幸福食光').then(() => { drawApron(); aTex.needsUpdate = true; needs = true; }).catch(() => {});
  const apronMat = new THREE.MeshStandardMaterial({ map: aTex, roughness: 0.86, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });   // cloth wins any depth fight with the fur
  const torsoSurf = (y, phi) => {                                             // march from the body axis to the torso surface
    const dx = Math.sin(phi), dz = Math.cos(phi); let t = 0.05, tp = t;
    for (let s = 0; s < 90; s++) {
      t += BH * 0.5;
      if (bField(dx * t, y, dz * t, null, BTORSO) > 0) { let lo = tp, hi = t; for (let b = 0; b < 8; b++) { const m = (lo + hi) / 2; if (bField(dx * m, y, dz * m, null, BTORSO) > 0) hi = m; else lo = m; } t = (lo + hi) / 2; break; }
      tp = t;
    }
    return new THREE.Vector3(dx * t, y, dz * t);
  };
  (function buildApron() {
    const NU = 28, NV = 24, HEM = 1.02, G = [], APR_OFF = BH * 0.34 + 0.016;                                          // the cloth must clear the plush fuzz of the body mesh (BH * 0.34)
    const grad = (p, e) => new THREE.Vector3(bField(p.x + e, p.y, p.z) - bField(p.x - e, p.y, p.z), bField(p.x, p.y + e, p.z) - bField(p.x, p.y - e, p.z), bField(p.x, p.y, p.z + e) - bField(p.x, p.y, p.z - e)).normalize();
    const settle = (p, n) => { for (let it = 0; it < n; it++) { const f = bField(p.x, p.y, p.z); p.addScaledVector(grad(p, 0.02), Math.max(-0.1, Math.min(0.1, (APR_OFF - f) * 0.85))); } return p; };   // rests just above the WHOLE body (arms and thighs included)
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, y = 2.12 - v * (2.12 - HEM), half = 0.66 + 0.4 * Math.pow(v, 0.8), row = [];            // a bib that ends at the belly, above the thighs
      for (let i = 0; i <= NU; i++) row.push(settle(torsoSurf(y, (i / NU * 2 - 1) * half), 10));
      G.push(row);
    }
    for (let pass = 0; pass < 3; pass++) {                                                                            // cloth does not wrinkle at a 1 cm scale: relax, then settle back onto the body
      const nx = G.map((row, j) => row.map((p, i) => {
        const a = G[Math.max(0, j - 1)][i], b = G[Math.min(NV, j + 1)][i], c = row[Math.max(0, i - 1)], d = row[Math.min(NU, i + 1)];
        return p.clone().multiplyScalar(0.5).addScaledVector(a, 0.125).addScaledVector(b, 0.125).addScaledVector(c, 0.125).addScaledVector(d, 0.125);
      }));
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) G[j][i] = settle(nx[j][i], 3);
    }
    const Pn = [], UVn = [], IXn = [], eL = [], eR = [], eB = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const p = G[j][i]; Pn.push(p.x, p.y, p.z); UVn.push(i / NU, 1 - j / NV);
      if (i === 0) eL.push(p); if (i === NU) eR.push(p); if (j === NV) eB.push(p);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i; IXn.push(a, a + NU + 1, a + 1, a + 1, a + NU + 1, a + NU + 2); }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(Pn, 3)); ag.setAttribute('uv', new THREE.Float32BufferAttribute(UVn, 2)); ag.setIndex(IXn); ag.computeVertexNormals();
    bear.add(new THREE.Mesh(ag, apronMat));
    bear.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(eL.concat(eB.slice(1), eR.slice().reverse().slice(1))), 90, 0.016, 6), apronGreen));
    for (const s of [-1, 1]) {                                                              // the two shoulder straps
      const a = G[0][s < 0 ? Math.round(NU * 0.28) : Math.round(NU * 0.72)].clone(), b = new THREE.Vector3(s * 0.36, 2.46, 0.3), d = b.clone().sub(a);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, Math.max(0.01, d.length() - 0.08), 6, 12), apronGreen);
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); bear.add(m);
    }
  })();

  const bearShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  bearShadow.rotation.x = -Math.PI / 2; scene.add(bearShadow);
  function updateHead(pitch, yaw, roll) {
    headFx.rotation.set(pitch, yaw, roll); headFx.updateMatrix(); furU.uHeadRot.value.setFromMatrix4(headFx.matrix);      // ONE rotation drives the shader and the face
  }
  function layoutBear(wide) {
    bear.visible = bearShadow.visible = mascot.on;
    mascot.baseYaw = wide ? -0.5 : -0.4;
    if (wide) { bear.position.set(-2.7, 0, 0.1); bear.scale.setScalar(0.66); bear.rotation.y = 0.62; }
    else { bear.position.set(-1.8, 0, 0.95); bear.scale.setScalar(0.46); bear.rotation.y = 0.5; }
    bearShadow.position.set(bear.position.x + 0.1, 0.001, bear.position.z + 0.45 * bear.scale.x); bearShadow.scale.set(bear.scale.x * 1.05, bear.scale.x * 0.9, 1);
    updateHead(0.04, mascot.baseYaw, 0.07);
  }
  function updateBear(now, dt) {
    if (!mascot.on || reduceMotion) return;
    const t = now / 1000;
    mascot.yaw += (mascot.tYaw - mascot.yaw) * Math.min(1, dt * 4); mascot.pitch += (mascot.tPitch - mascot.pitch) * Math.min(1, dt * 4);
    mascot.nodV += (-60 * mascot.nod - 7 * mascot.nodV) * dt; mascot.nod += mascot.nodV * dt;       // a nod on every selection
    furU.uBreath.value = 0.006 * Math.sin(t * 1.7);                                                   // breathing: only the belly swells, the feet stay put
    updateHead(0.04 + mascot.pitch + mascot.nod, mascot.baseYaw + mascot.yaw * 0.8, 0.07 + 0.012 * Math.sin(t * 1.1));
  }
  window.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect(); if (!r.width) return;
    mascot.tYaw = Math.max(-0.5, Math.min(0.5, ((e.clientX - r.left) / r.width * 2 - 1) * 0.5)); mascot.tPitch = Math.max(-0.2, Math.min(0.2, -((e.clientY - r.top) / r.height * 2 - 1) * 0.2));
  }, { passive: true });

