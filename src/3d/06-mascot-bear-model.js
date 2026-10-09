  /* ---------- Mascot: the restaurant's teddy bear, seated beside the cup (MODEL: parts, rig, face, apron) ----------
     Built the way a plush toy is sewn: separate pieces (torso, pelvis, head, muzzle, ears, arms with paws, legs with soles) joined at creases,
     each piece an all-quad "quad sphere" (a subdivided cube pushed onto a sphere: no poles, clean quad rings, like the reference wireframes).
     The pieces hang on a real bone hierarchy (THREE.Bone, names below) so the bear can be animated: see slice 07. The HEAD is its own node
     ("Head": head, muzzle, ears, eyes, nose, mouth all hang from it) and turns independently of the body. The branded apron hangs on the spine.
     Rest pose and every proportion live in BONE_DEFS and PARTS: tune them against the shop-front photo (kept privately, see docs/reference/README.md). */
  const bClamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const bSstep = (a, b, x) => { const t = bClamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const bHex = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };          // sRGB hex -> linear colour (vertex colours are linear)
  const bSoftMin = (a, b, k) => { const h = bClamp01(0.5 + 0.5 * (b - a) / k); return b * (1 - h) + a * h - k * h * (1 - h); };
  const BTAN = bHex('#b08856'), BCREAM = bHex('#f0e4c8'), BSOLE = bHex('#e6d3ac'), BEAR_IN = bHex('#8d5f3a');     // caramel fur, cream muzzle, warmer cream soles, inner ear (measured on the shop photo)

  /* ===== 1. Quad sphere: a box of nx x ny x nz quads on its 6 faces, projected onto the unit sphere (all quads, no poles; n may be a number or
     [nx, ny, nz] so long limbs get near-square cells and clean rings, like the reference wireframes). All counts EVEN. ===== */
  const bQuadCache = new Map();
  function bQuadSphere(N) {
    const NN = typeof N === 'number' ? [N, N, N] : N, ck = NN.join(',');
    if (bQuadCache.has(ck)) return bQuadCache.get(ck);
    const dirs = [], quads = [], ids = new Map(), M1 = NN[1] + 1, M2 = NN[2] + 1;
    const vid = (a, b, c) => {
      const key = (a * M1 + b) * M2 + c; let id = ids.get(key); if (id !== undefined) return id;
      const x = 2 * a / NN[0] - 1, y = 2 * b / NN[1] - 1, z = 2 * c / NN[2] - 1;
      id = dirs.length / 3; ids.set(key, id);
      dirs.push(x * Math.sqrt(1 - y * y / 2 - z * z / 2 + y * y * z * z / 3), y * Math.sqrt(1 - z * z / 2 - x * x / 2 + z * z * x * x / 3), z * Math.sqrt(1 - x * x / 2 - y * y / 2 + x * x * y * y / 3));
      return id;
    };
    for (let k = 0; k < 3; k++) for (const s of [0, NN[k]]) {                    // the face on axis k, at its low (0) or high end
      const iu = (k + 1) % 3, iv = (k + 2) % 3;
      for (let i = 0; i < NN[iu]; i++) for (let j = 0; j < NN[iv]; j++) {
        const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v]) => { const p = [0, 0, 0]; p[k] = s; p[iu] = u; p[iv] = v; return vid(p[0], p[1], p[2]); });
        if (s === 0) q.reverse();                                                // the low face looks the other way: keep every quad counter-clockwise seen from outside
        quads.push(q[0], q[1], q[2], q[3]);
      }
    }
    const V = dirs.length / 3, seen = new Set(), lines = [];
    for (let i = 0; i < quads.length; i += 4) for (let e = 0; e < 4; e++) {      // every quad edge once (the wireframe view draws QUADS, not triangles)
      const a = quads[i + e], b = quads[i + (e + 1) % 4], key = a < b ? a * V + b : b * V + a;
      if (!seen.has(key)) { seen.add(key); lines.push(a, b); }
    }
    const tris = []; for (let i = 0; i < quads.length; i += 4) tris.push(quads[i], quads[i + 1], quads[i + 2], quads[i], quads[i + 2], quads[i + 3]);
    const r = { dirs: new Float32Array(dirs), tris: new Uint32Array(tris), lines: new Uint32Array(lines), V, N: NN };
    bQuadCache.set(ck, r); return r;
  }

  /* ===== 2. The rig: bones in WORLD rest coordinates [x, y, z] (the bear faces +z; +x is the bear's LEFT), parent first ===== */
  const BONE_DEFS = [
    ['root', null, [0, 0, 0]],
    ['hips', 'root', [0, 0.62, -0.04]],
    ['spine', 'hips', [0, 1.0, 0.0]],
    ['neck', 'spine', [0, 2.2, 0.06]],
    ['Head', 'neck', [0, 2.45, 0.08]],                                              // the head group: everything on the head hangs from this node
    ['earL', 'Head', [0.83, 3.42, -0.02]], ['earR', 'Head', [-0.83, 3.42, -0.02]],
    ['shoulderL', 'spine', [0.9, 2.12, 0.08], [-0.3, 0, 0.17]], ['shoulderR', 'spine', [-0.9, 2.12, 0.08], [-0.3, 0, -0.17]],      // the shoulder joint sits INSIDE the body; arms hug the sides, paws forward
    ['hipL', 'hips', [0.74, 0.58, 0.15], [-0.06, 0.2, 0]], ['hipR', 'hips', [-0.74, 0.58, 0.15], [-0.06, -0.2, 0]],                // legs stretch forward, toes out
  ];
  const bear = new THREE.Group(); bear.name = 'MrYeBear'; scene.add(bear);
  const rig = {}, bw = {};
  for (const [name, parent, w, rot] of BONE_DEFS) {
    const b = new THREE.Bone(); b.name = name; bw[name] = w;
    const pw = parent ? bw[parent] : [0, 0, 0];
    b.position.set(w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]);
    if (rot) b.rotation.set(rot[0], rot[1], rot[2]);
    (parent ? rig[parent] : bear).add(b); rig[name] = b;
  }
  rig.Head.rotation.order = 'YXZ';
  bear.updateMatrixWorld(true);
  const bLocal = (bone, x, y, z) => [x - bw[bone][0], y - bw[bone][1], z - bw[bone][2]];     // world rest position -> bone-local (valid for bones without a rest rotation)

  /* ===== 3. The pieces. r = radii, taper = wider (+) or narrower (-) towards the top, n = quads per cube-face edge (keep EVEN: a ring of
     vertices then lies exactly on the centre planes, where the seams are). seams: grooves sewn along a ring. patch = a second colour,
     thresholded in the shader (smooth edge whatever the mesh density). ao = baked occlusion 0..1 from the direction on the piece. ===== */
  const bSeam = (f, u, w, mask, axis) => ({ f, u, w, mask, axis: axis || 0 });             // groove where f(dir) = 0, stitch coordinate u(dir), width in quads across axis
  const bSeamX = (mask) => bSeam((dx) => dx, (dx, dy, dz) => (dz >= 0 ? dy : 2 - dy) * 9, 0.55, mask, 0);   // down the centre plane x = 0, front and back
  const bUnder = (k, dy) => k * bSstep(-0.2, -0.95, dy);                                  // darker underneath (ground contact, chin shadow)
  const PARTS = [
    { mesh: 'torso', bone: 'spine', pos: bLocal('spine', 0, 1.46, 0.06), r: [1.2, 1.18, 1.04], n: [18, 18, 16], col: BTAN, clear: true, seams: [bSeamX()],        // broad all the way up: the shoulders are part of the torso
      ao: (dx, dy) => bUnder(0.75, dy) },
    { mesh: 'pelvis', bone: 'hips', pos: bLocal('hips', 0, 0.58, -0.06), r: [1.12, 0.62, 1.04], n: [16, 8, 14], col: BTAN, clear: true, ao: (dx, dy) => bUnder(0.9, dy) },
    { mesh: 'pelvis', bone: 'hips', pos: bLocal('hips', 0, 0.76, -1.0), r: [0.26, 0.24, 0.22], n: 6, col: BTAN, ao: (dx, dy) => bUnder(0.6, dy) },       // tail
    { mesh: 'head', bone: 'Head', pos: bLocal('Head', 0, 2.93, 0.10), r: [0.98, 0.85, 0.90], n: [20, 18, 18], col: BTAN,
      seams: [bSeamX((dx, dy, dz) => bSstep(-0.35, 0.05, dy) * bSstep(0.3, -0.15, dz))],                                     // the head seam runs over the crown and down the back only: the face stays clean, as in the photo
      ao: (dx, dy, dz) => bUnder(0.7, dy) * bSstep(-0.6, 0.2, dz) },
    { mesh: 'head', bone: 'Head', pos: bLocal('Head', 0, 2.73, 0.74), r: [0.46, 0.43, 0.32], n: [10, 10, 8], col: BCREAM, ao: (dx, dy) => bUnder(0.3, dy) },          // muzzle
  ];
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    PARTS.push(
      { mesh: 'ear' + side, bone: 'ear' + side, pos: [0, 0, 0], rot: [0, s * 0.5, 0], r: [0.32, 0.32, 0.20], n: [8, 8, 6], col: BTAN, dent: 0.08,                // ear: a shallow bowl with a soft inner patch
        patch: { t: 0.78, s: 0.22, col: BEAR_IN }, ao: (dx, dy) => bUnder(0.4, dy) },
      { mesh: 'arm' + side, bone: 'shoulder' + side, pos: [0, -0.72, 0], r: [0.42, 0.84, 0.40], taper: 0.03, n: [8, 16, 8], col: BTAN, seamDepth: 0.008,          // one thick limb, buried in the shoulder
        seams: [bSeam((dx, dy, dz) => dz, (dx, dy) => dy * 5, 0.55, null, 2)], ao: (dx, dy) => 0.5 * bSstep(0.1, 0.9, -s * dx) + bUnder(0.3, dy) },
      { mesh: 'leg' + side, bone: 'hip' + side, pos: [0, 0, 0.95], r: [0.56, 0.52, 1.05], flatZ: 0.78, n: [10, 10, 20], col: BTAN, clear: true,              // one smooth leg ending in a flat cream sole facing the viewer
        patch: { t: 0.74, s: 0.05, col: BSOLE }, ao: (dx, dy, dz) => bUnder(0.85, dy) + 0.3 * bSstep(0.2, 0.9, -s * dx) },
    );
  }

  const BM = new THREE.Matrix4(), BV = new THREE.Vector3(), BQ = new THREE.Quaternion(), BE = new THREE.Euler(), BONE = new THREE.Vector3(1, 1, 1);
  const bPartMatrix = (df) => new THREE.Matrix4().compose(new THREE.Vector3(df.pos[0], df.pos[1], df.pos[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(df.rot || [0, 0, 0]))), BONE);
  function bBuildPart(df) {                            // -> typed arrays in the BONE's frame
    const qs = bQuadSphere(df.n), D = qs.dirs, V = qs.V, NN = qs.N;
    const pos = new Float32Array(V * 3), col = new Float32Array(V * 3), col2 = new Float32Array(V * 3), dir = new Float32Array(V * 3), pt = new Float32Array(V * 2), st = new Float32Array(V * 2);
    BM.copy(bPartMatrix(df));
    const sdepth = df.seamDepth || 0.009, c2 = df.patch ? df.patch.col : df.col;
    for (let i = 0; i < V; i++) {
      const dx = D[i * 3], dy = D[i * 3 + 1], dz = D[i * 3 + 2], sc = 1 + (df.taper || 0) * dy;
      let x = df.r[0] * dx * sc, y = df.r[1] * dy, z = df.r[2] * dz * sc;
      if (df.flatZ !== undefined) z = bSoftMin(z, df.flatZ, 0.12);                  // the sole: a flat plane with a rounded rim
      if (df.dent) z -= df.dent * bSstep(df.patch.t - 0.25, df.patch.t + 0.15, dz);   // the ear bowl
      let g = 0, u = 0;
      for (const s of df.seams || []) {
        const t = Math.max(0, 1 - Math.abs(s.f(dx, dy, dz)) / (s.w * 2 / NN[s.axis])) * (s.mask ? s.mask(dx, dy, dz) : 1);
        if (t > g) { g = t; u = s.u(dx, dy, dz); }
      }
      const k = 1 - sdepth * g; x *= k; y *= k; z *= k;                                // the groove: a V-shaped crease along the lattice ring
      const occ = df.ao ? df.ao(dx, dy, dz) : 0, sh = 1 - 0.28 * g, ar = (1 - 0.50 * occ) * sh, ag = (1 - 0.62 * occ) * sh, ab = (1 - 0.75 * occ) * sh;      // creases go warm brown, not grey
      col[i * 3] = df.col[0] * ar; col[i * 3 + 1] = df.col[1] * ag; col[i * 3 + 2] = df.col[2] * ab;
      col2[i * 3] = c2[0] * ar; col2[i * 3 + 1] = c2[1] * ag; col2[i * 3 + 2] = c2[2] * ab;
      dir[i * 3] = dx; dir[i * 3 + 1] = dy; dir[i * 3 + 2] = dz; pt[i * 2] = df.patch ? df.patch.t : 2; pt[i * 2 + 1] = df.patch ? df.patch.s : 1;      // no patch: threshold 2 is never reached
      st[i * 2] = g; st[i * 2 + 1] = u;
      BV.set(x, y, z).applyMatrix4(BM); pos[i * 3] = BV.x; pos[i * 3 + 1] = BV.y; pos[i * 3 + 2] = BV.z;
    }
    return { pos, col, col2, dir, pt, st, tris: qs.tris, lines: qs.lines, V };
  }
  function bMergeParts(list) {                         // several pieces -> ONE geometry (one draw call), seams of the piece borders preserved
    let V = 0, T = 0, L = 0; for (const p of list) { V += p.V; T += p.tris.length; L += p.lines.length; }
    const pos = new Float32Array(V * 3), col = new Float32Array(V * 3), col2 = new Float32Array(V * 3), dir = new Float32Array(V * 3), pt = new Float32Array(V * 2), st = new Float32Array(V * 2), idx = new Uint32Array(T), lines = new Uint32Array(L);
    let v = 0, t = 0, l = 0;
    for (const p of list) {
      pos.set(p.pos, v * 3); col.set(p.col, v * 3); col2.set(p.col2, v * 3); dir.set(p.dir, v * 3); pt.set(p.pt, v * 2); st.set(p.st, v * 2);
      for (let i = 0; i < p.tris.length; i++) idx[t + i] = p.tris[i] + v;
      for (let i = 0; i < p.lines.length; i++) lines[l + i] = p.lines[i] + v;
      v += p.V; t += p.tris.length; l += p.lines.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aCol2', new THREE.BufferAttribute(col2, 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3)); geo.setAttribute('aPatchT', new THREE.BufferAttribute(pt, 2)); geo.setAttribute('aStitch', new THREE.BufferAttribute(st, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals(); geo.userData.lines = lines;
    return geo;
  }
  /* a plain ellipsoid piece (no vertex colours): eyes, nose, tongue, mouth */
  function bEllipsoid(n, r, p, taper) {
    const qs = bQuadSphere(n), pos = new Float32Array(qs.V * 3);
    for (let i = 0; i < qs.V; i++) {
      const dx = qs.dirs[i * 3], dy = qs.dirs[i * 3 + 1], dz = qs.dirs[i * 3 + 2], sc = 1 + (taper || 0) * dy;
      pos[i * 3] = p[0] + r[0] * dx * sc; pos[i * 3 + 1] = p[1] + r[1] * dy; pos[i * 3 + 2] = p[2] + r[2] * dz * sc;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(qs.tris, 1)); geo.computeVertexNormals(); geo.userData.lines = qs.lines;
    return geo;
  }
  function bMergeGeos(list) {                          // position + normal + index only
    let V = 0, T = 0; for (const g of list) { V += g.attributes.position.count; T += g.index.count; }
    const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), idx = new Uint32Array(T); let v = 0, t = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, v * 3); nor.set(g.attributes.normal.array, v * 3);
      for (let i = 0; i < g.index.count; i++) idx[t + i] = g.index.array[i] + v;
      v += g.attributes.position.count; t += g.index.count;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    return geo;
  }

  /* ===== 4. Fur material: one shader for every plush piece (vertex colours + patches + stitches + fine fur grain + soft warm rim) ===== */
  const furTex = canvasTex(512, 512, (g, w, h) => {                           // tileable plush strokes (strokes near an edge are repeated on the opposite side)
    g.fillStyle = '#f7f1e6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40000; i++) {
      const x = rand() * w, y = rand() * h, a = rand() * 6.283, len = 2 + rand() * 5;
      g.strokeStyle = (rand() > 0.5 ? 'rgba(255,250,238,A)' : 'rgba(122,88,46,A)').replace('A', (0.1 + rand() * 0.18).toFixed(2)); g.lineWidth = 0.6 + rand() * 0.5;
      for (const ox of (x < 18 ? [0, w] : x > w - 18 ? [-w, 0] : [0])) for (const oy of (y < 18 ? [0, h] : y > h - 18 ? [-h, 0] : [0])) {
        g.beginPath(); g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(x + ox + Math.cos(a + 0.7) * len * 0.5, y + oy + Math.sin(a + 0.7) * len * 0.5, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke();
      }
    }
  }, { wrap: true });
  const furU = { uFur: { value: furTex }, uBump: { value: 0.0026 } };
  const furMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.94, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xf6d9a0), envMapIntensity: 0.5 });
  furMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, furU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 aStitch; attribute vec2 aPatchT; attribute vec3 aDir; attribute vec3 aCol2;
        varying vec3 vBearP; varying vec3 vBearN; varying vec2 vStitch; varying vec2 vPatchT; varying vec3 vDir; varying vec3 vCol2;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBearP = position; vBearN = normal; vStitch = aStitch; vPatchT = aPatchT; vDir = aDir; vCol2 = aCol2;       // the fur texture stays attached to the surface`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uFur; uniform float uBump; varying vec3 vBearP; varying vec3 vBearN; varying vec2 vStitch; varying vec2 vPatchT; varying vec3 vDir; varying vec3 vCol2;
        float furH(vec3 p, vec3 n) {                                              // triplanar plush strokes: no UV seams on a generated mesh
          vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
          return texture2D(uFur, p.zy * 1.8).r * w.x + texture2D(uFur, p.xz * 1.8).r * w.y + texture2D(uFur, p.xy * 1.8).r * w.z;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float patchM = clamp(0.5 + (normalize(vDir).z - vPatchT.x) / vPatchT.y, 0.0, 1.0);      // patches (soles, inner ear): the edge is computed PER PIXEL from the interpolated direction, so it is a clean circle on any mesh density
        diffuseColor.rgb = mix(diffuseColor.rgb, vCol2, smoothstep(0.42, 0.58, patchM));
        diffuseColor.rgb *= 1.0 - 0.16 * smoothstep(0.30, 0.46, patchM) * (1.0 - smoothstep(0.50, 0.62, patchM));       // a thin sewn seam round the patch
        diffuseColor.rgb *= mix(0.9, 1.09, furH(vBearP, normalize(vBearN)));
        diffuseColor.rgb *= 1.0 - 0.2 * smoothstep(0.8, 0.97, vStitch.x) * (0.35 + 0.65 * step(0.5, fract(vStitch.y)));   // fine stitches along the seams`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float fh = furH(vBearP, normalize(vBearN));
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
          vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1);
          normal = normalize(abs(det) * normal - uBump * sign(det) * (dFdx(fh) * R1 + dFdy(fh) * R2)); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float bearRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.5);
          totalEmissiveRadiance += vec3(0.98, 0.82, 0.55) * bearRim * 0.11; }`);        // soft warm plush rim
  };
  const clayMat = new THREE.MeshStandardMaterial({ color: 0xb4b8bc, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });       // the wireframe view: grey clay
  const wireMat = new THREE.LineBasicMaterial({ color: 0x555b63, transparent: true, opacity: 0.6 });

  /* ===== 5. Assemble: one mesh per bone-and-material (a handful of draw calls), every piece merged from its quad spheres ===== */
  const bearMeshes = [];                                                            // { mesh, mat (the real one), wire (lazy quad-edge lines) }
  const bAddMesh = (name, bone, geo, mat) => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.frustumCulled = false; rig[bone].add(m);
    bearMeshes.push({ mesh: m, mat, wire: null }); return m;
  };
  const bGroups = new Map();
  for (const df of PARTS) { if (!bGroups.has(df.mesh)) bGroups.set(df.mesh, { bone: df.bone, list: [] }); bGroups.get(df.mesh).list.push(bBuildPart(df)); }
  for (const [name, gr] of bGroups) bAddMesh(name, gr.bone, bMergeParts(gr.list), furMat);

  /* ===== 6. Face: placed ON the real surface of the head and muzzle (analytic, so nothing floats). All of it hangs from the Head node.
     Proportions measured on the shop photo: close-set eyes, a big cream muzzle, a broad matte nose, a wide shallow open mouth with a tan tongue. ===== */
  const bHeadZ = (x, y) => 0.10 + 0.90 * Math.sqrt(Math.max(0, 1 - (x / 0.98) ** 2 - ((y - 2.93) / 0.85) ** 2));       // head surface, world rest z
  const bMuzzleZ = (x, y) => 0.74 + 0.32 * Math.sqrt(Math.max(0, 1 - (x / 0.46) ** 2 - ((y - 2.73) / 0.43) ** 2));      // muzzle surface
  const hp = (x, y, z) => bLocal('Head', x, y, z);
  const noseMat = new THREE.MeshPhysicalMaterial({ color: 0x4a2c1a, roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.5 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x070605, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x5e3b27, roughness: 0.6 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7a4a30, roughness: 0.7 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: 0xc08a64, roughness: 0.65 });
  const BEYE = { x: 0.22, y: 3.18 }, BNOSE_Y = 2.93;
  const bSmile = (g, rx, k) => { const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const u = a.getX(i) / rx; a.setY(i, a.getY(i) + k * u * u); } return g; };      // bend a flat piece into a smile: the corners go up
  const bDecal = (g, off) => {                                                 // lay a flat piece on the muzzle surface (the mouth and the tongue are decals)
    const a = g.attributes.position, h = bw.Head;
    for (let i = 0; i < a.count; i++) a.setZ(i, bMuzzleZ(a.getX(i) + h[0], a.getY(i) + h[1]) - h[2] + off);
    g.computeVertexNormals(); return g;
  };
  const eyes = new THREE.Group(); eyes.name = 'eyes'; eyes.position.set(0, hp(0, BEYE.y, 0)[1], 0); rig.Head.add(eyes);          // pivot at eye height: the blink squashes around it
  {
    const eg = [], cg = [];
    for (const s of [-1, 1]) {
      const ez = bHeadZ(s * BEYE.x, BEYE.y), p = hp(s * BEYE.x, BEYE.y, ez - 0.02); p[1] = 0;
      eg.push(bEllipsoid(8, [0.085, 0.095, 0.06], p));
      cg.push(bEllipsoid(5, [0.02, 0.02, 0.014], [p[0] - s * 0.026, 0.034, p[2] + 0.046]));                                          // catchlight
    }
    const em = new THREE.Mesh(bMergeGeos(eg), eyeMat); em.name = 'eyeballs'; eyes.add(em);
    const lm = new THREE.Mesh(bMergeGeos(cg), lightMat); lm.name = 'catchlights'; eyes.add(lm);
  }
  {
    const nm = new THREE.Mesh(bEllipsoid(8, [0.19, 0.135, 0.11], hp(0, BNOSE_Y, bMuzzleZ(0, BNOSE_Y) - 0.05), 0.1), noseMat); nm.name = 'nose'; rig.Head.add(nm);
    const P = (x, y) => new THREE.Vector3(...hp(x, y, bMuzzleZ(x, y) + 0.004));
    const phil = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([P(0, 2.84), P(0, 2.75), P(0, 2.67)]), 20, 0.008, 6);              // a short philtrum line under the nose
    const mm = new THREE.Mesh(bMergeGeos([phil]), lineMat); mm.name = 'mouth'; rig.Head.add(mm);
    const open = new THREE.Mesh(bDecal(bSmile(bEllipsoid(12, [0.27, 0.062, 0.0005], hp(0, 2.56, 0)), 0.27, 0.07), 0.004), mouthMat); open.name = 'mouthOpening'; rig.Head.add(open);   // the wide shallow open smile
    const tm = new THREE.Mesh(bDecal(bSmile(bEllipsoid(8, [0.15, 0.04, 0.0005], hp(0, 2.54, 0)), 0.15, 0.03), 0.007), tongueMat); tm.name = 'tongue'; rig.Head.add(tm);
  }

  /* ===== 7. Apron: the branded bib, hung on the spine. It is laid on the torso at rest, then settled just outside every piece it must clear
     (torso, pelvis, legs): cloth cannot be rigged round a bend, so it follows the spine and stays above the lap. Measured on the shop photo:
     a dark teal bib from under the chin to the lap, a small white print near the top, two red-orange pocket bars at the outer edges. ===== */
  const apronGreen = new THREE.MeshStandardMaterial({ color: 0x0f2f2c, roughness: 0.9 });
  const YTOP = 2.2, HEM = 0.92, WREF = 2.0;                                          // the cloth's top and hem heights; WREF = world units across the 1024 px texture (1 px = the same size everywhere)
  const aCv = document.createElement('canvas'); aCv.width = aCv.height = 1024;
  const drawApron = () => {
    const g = aCv.getContext('2d'); g.fillStyle = '#184649'; g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = 'rgba(255,255,255,.04)'; g.lineWidth = 1.5;
    for (let i = -1024; i < 2048; i += 7) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 1024, 1024); g.stroke(); }
    g.fillStyle = '#f4f1e8'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '900 112px "Noto Serif SC","Songti SC","SimSun",serif'; g.fillText('幸福食光', 512, 150);
    g.font = '500 74px "Noto Serif SC","Songti SC",Georgia,serif'; if ('letterSpacing' in g) g.letterSpacing = '3px'; g.fillText('Mr.Ye', 512, 234); if ('letterSpacing' in g) g.letterSpacing = '0px';
    for (const sd of [-1, 1]) {                                                 // the two pocket bars: flat, sharp-ended, red-orange, slanting up toward the centre (like the photo)
      g.save(); g.translate(512 + sd * 398, 318); g.rotate(sd * 0.3);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-98, -20, 196, 56);
      g.fillStyle = '#d2560f'; g.fillRect(-98, -28, 196, 56); g.restore();
    }
  };
  drawApron();
  const aTex = new THREE.CanvasTexture(aCv); aTex.colorSpace = THREE.SRGBColorSpace; aTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (document.fonts && document.fonts.load) document.fonts.load('900 112px "Noto Serif SC"', '幸福食光').then(() => { drawApron(); aTex.needsUpdate = true; needs = true; }).catch(() => {});
  const apronMat = new THREE.MeshStandardMaterial({ map: aTex, roughness: 0.95, envMapIntensity: 0.35, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });   // cloth wins any depth fight with the fur
  const bClear = PARTS.filter((p) => p.clear).map((df) => {                         // the pieces the cloth must clear, as rest-pose implicit ellipsoids (the torso is first)
    const inv = bPartMatrix(df).premultiply(rig[df.bone].matrixWorld).invert(); return { df, inv };
  });
  const bPieceD = (c, x, y, z) => {                                                // approximate signed distance to one piece (ellipsoid, with its taper)
    BV.set(x, y, z).applyMatrix4(c.inv); const r = c.df.r, sc = 1 + (c.df.taper || 0) * Math.max(-1, Math.min(1, BV.y / r[1]));
    const qx = BV.x / (r[0] * sc), qy = BV.y / r[1], qz = BV.z / (r[2] * sc);
    return (Math.sqrt(qx * qx + qy * qy + qz * qz) - 1) * Math.min(r[0], r[1], r[2]);
  };
  const bClearD = (x, y, z) => { let d = 1e9; for (const c of bClear) d = Math.min(d, bPieceD(c, x, y, z)); return d; };
  (function buildApron() {
    const NU = 20, NV = 16, OFF = 0.024, G = [], torso = bClear[0];
    const surf = (y, phi) => {                                                     // march from the body axis to the torso surface
      const dx = Math.sin(phi), dz = Math.cos(phi); let lo = 0.05, hi = 2.4;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bPieceD(torso, dx * m, y, 0.06 + dz * m) > 0) hi = m; else lo = m; }
      return new THREE.Vector3(dx * lo, y, 0.06 + dz * lo);
    };
    const grad = (p, e) => new THREE.Vector3(bClearD(p.x + e, p.y, p.z) - bClearD(p.x - e, p.y, p.z), bClearD(p.x, p.y + e, p.z) - bClearD(p.x, p.y - e, p.z), bClearD(p.x, p.y, p.z + e) - bClearD(p.x, p.y, p.z - e)).normalize();
    const settle = (p, n) => { for (let it = 0; it < n; it++) p.addScaledVector(grad(p, 0.02), Math.max(-0.1, Math.min(0.1, (OFF - bClearD(p.x, p.y, p.z)) * 0.85))); return p; };
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, y = YTOP - v * (YTOP - HEM), half = 0.86 + 0.32 * Math.pow(v, 0.8), row = [];
      for (let i = 0; i <= NU; i++) row.push(settle(surf(y, (i / NU * 2 - 1) * half), 10));
      G.push(row);
    }
    for (let pass = 0; pass < 5; pass++) {                                           // relax like cloth, then settle back out of the body
      const nx = G.map((row, j) => row.map((p, i) => {
        const a = G[Math.max(0, j - 1)][i], b = G[Math.min(NV, j + 1)][i], c = row[Math.max(0, i - 1)], d = row[Math.min(NU, i + 1)];
        return p.clone().multiplyScalar(0.5).addScaledVector(a, 0.125).addScaledVector(b, 0.125).addScaledVector(c, 0.125).addScaledVector(d, 0.125);
      }));
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) G[j][i] = settle(nx[j][i], 4);
    }
    const sp = bw.spine, Pn = [], UVn = [], IXn = [], LNn = [], eL = [], eR = [], eB = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const p = G[j][i], q = new THREE.Vector3(p.x - sp[0], p.y - sp[1], p.z - sp[2]); G[j][i] = q;                       // into the spine's frame
      Pn.push(q.x, q.y, q.z); UVn.push(0.5 + p.x / WREF, 1 - (YTOP - p.y) / WREF);                                         // projected UVs: the print is not stretched
      if (i === 0) eL.push(q); if (i === NU) eR.push(q); if (j === NV) eB.push(q);
      if (i < NU) LNn.push(j * (NU + 1) + i, j * (NU + 1) + i + 1); if (j < NV) LNn.push(j * (NU + 1) + i, (j + 1) * (NU + 1) + i);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i; IXn.push(a, a + NU + 1, a + 1, a + 1, a + NU + 1, a + NU + 2); }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(Pn, 3)); ag.setAttribute('uv', new THREE.Float32BufferAttribute(UVn, 2)); ag.setIndex(IXn); ag.computeVertexNormals();
    ag.userData.lines = new Uint32Array(LNn);
    bAddMesh('apron', 'spine', ag, apronMat);
    const trim = [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(eL.concat(eB.slice(1), eR.slice().reverse().slice(1))), 90, 0.011, 6)];     // a thin hem line round the edge
    for (const s of [-1, 1]) {                                                       // the neck straps: they run up under the chin and disappear into the head
      const a = G[0][s < 0 ? Math.round(NU * 0.28) : Math.round(NU * 0.72)].clone(), b = new THREE.Vector3(s * 0.3 - sp[0], 2.36 - sp[1], 0.3 - sp[2]), d = b.clone().sub(a);
      const cap = new THREE.CapsuleGeometry(0.036, Math.max(0.01, d.length() - 0.072), 6, 12);
      cap.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), BONE)); trim.push(cap);
    }
    bAddMesh('apronTrim', 'spine', bMergeGeos(trim), apronGreen);
  })();
  bearMeshes.find((b) => b.mesh.name === 'apronTrim').noWire = true;
