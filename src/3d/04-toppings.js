  /* ---------- Topping shader: milk film + edge/core light, instancing-aware ----------
     rim   = [r,g,b,amount,power]  light scattered through the thin edge (grazing angles)
     core  = [r,g,b,amount,power]  light from the middle of a translucent bead (facing the viewer) */
  const veilU = { uCupInv: { value: new THREE.Matrix4() }, uMilkCol: { value: new THREE.Color() }, uMilk: { value: 1 },
    uSigma: { value: 3.0 }, uTint: { value: 0.16 } };   // liquid density + how much the drink tints what is behind it (both follow the flavour)
  const topShader = (mat, o) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, veilU);
      const rm = o.rim || [0, 0, 0, 0, 1], core = o.core || [0, 0, 0, 0, 1];          // [r, g, b, amount, power]
      sh.uniforms.uRim = { value: new THREE.Vector4(rm[0], rm[1], rm[2], rm[3]) };
      sh.uniforms.uRimP = { value: rm[4] };
      sh.uniforms.uCore = { value: new THREE.Vector4(core[0], core[1], core[2], core[3]) };
      sh.uniforms.uCoreP = { value: core[4] };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vec4 twp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            twp = instanceMatrix * twp;
          #endif
          vWPos = (modelMatrix * twp).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform mat4 uCupInv;\nuniform vec3 uMilkCol;\nuniform float uRimP, uCoreP, uSigma, uTint;\nuniform vec4 uRim, uCore;')
        .replace('#include <opaque_fragment>', `
          float tNdV = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
          outgoingLight += uRim.rgb * uRim.a * pow(1.0 - tNdV, uRimP);
          outgoingLight += uCore.rgb * uCore.a * pow(tNdV, uCoreP);
          vec3 lp = (uCupInv * vec4(vWPos, 1.0)).xyz;
          float rL = ${(R0 - ((R1 - R0) / (H - 0.11)) * 0.11).toFixed(4)} + ${((R1 - R0) / (H - 0.11)).toFixed(5)} * lp.y - ${WALL.toFixed(4)};
          // The bead is seen THROUGH the drink, milk and fruit tea alike (Beer-Lambert along the view ray inside the liquid).
          // Same look in both; only the liquid's density (uSigma) differs: milk hides deep beads, clear tea shows them.
          vec3 cl = (uCupInv * vec4(cameraPosition, 1.0)).xyz;
          vec2 dxz = lp.xz - cl.xz;
          float qa = max(dot(dxz, dxz), 1e-6), qb = 2.0 * dot(cl.xz, dxz), qc = dot(cl.xz, cl.xz) - rL * rL;
          float disc = qb * qb - 4.0 * qa * qc;
          float tIn = disc > 0.0 ? (-qb - sqrt(disc)) / (2.0 * qa) : 1.0;
          float Lm = max(0.0, 1.0 - clamp(tIn, 0.0, 1.0)) * length(lp - cl);
          float Tm = exp(-uSigma * (Lm + 0.05));                            // nearest the glass = darkest, deeper = fades into the drink
          float soft = mix(0.7, 1.0, smoothstep(0.0, 0.5, tNdV));         // edges soften, like a slightly blurred disc
          outgoingLight = mix(outgoingLight, uMilkCol, uTint * (1.0 - Tm));  // the drink tints what lies behind it
          diffuseColor.a *= Tm * soft;
          #include <opaque_fragment>`);
    };
    mat.needsUpdate = true;
  };

  /* ---------- Toppings are SETTLED by a tiny physics pass, drawn as InstancedMesh ---------- */
  const POKE = -GLASS_IN;                               // beads end GLASS_IN inside the glass
  const floorY = (d) => d < 0.62 ? 0.025 : d < 0.76 ? 0.025 + (d - 0.62) * 0.32 : 0.07;
  function settle(items, iters, fall) {
    const n = items.length;
    for (let it = 0; it < iters; it++) {
      const g = fall * (1 - 0.7 * it / iters);
      for (let i = 0; i < n; i++) items[i].p.y -= g;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n; i++) {
          const a = items[i];
          for (let j = i + 1; j < n; j++) {
            const b = items[j];
            const dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dz = b.p.z - a.p.z;
            const mn = ((a.rc || a.r) + (b.rc || b.r)) * 0.98;              // a hair of overlap = beads squash against each other
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < mn * mn && d2 > 1e-10) {
              const d = Math.sqrt(d2), push = (mn - d) * 0.5 / d;
              a.p.x -= dx * push; a.p.y -= dy * push; a.p.z -= dz * push;
              b.p.x += dx * push; b.p.y += dy * push; b.p.z += dz * push;
            }
          }
          const dist = Math.hypot(a.p.x, a.p.z), lim = rAt(Math.max(0, a.p.y - a.r * 0.6)) + POKE - a.r;
          if (dist > lim) { const s = lim / dist; a.p.x *= s; a.p.z *= s; }
          const fy = floorY(dist) + a.r * 0.92;
          if (a.p.y < fy) a.p.y = fy;
        }
      }
    }
  }
  const randQ = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6.28, rand() * 6.28, rand() * 6.28));
  const dropIn = (n, baseR, sMin, sRange, yMax, spacing) => {
    const list = [];
    for (let i = 0; i < n; i++) {
      const s = sMin + rand() * sRange, r = baseR * s;
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (R0 - r - 0.05);
      list.push({ p: new THREE.Vector3(Math.sin(a) * d, 0.25 + rand() * yMax, Math.cos(a) * d), r, s, rc: r * (spacing || 1) });
    }
    return list;
  };

  const dummy = new THREE.Object3D();
  const smooth = (k) => k * k * (3 - 2 * k);
  /* A set animates each bead independently and CONTINUOUSLY: k moves toward 1 (settled) or 0 (gone) at a fixed
     speed, so reversing mid-animation never pops. Beads only scale and settle a few centimetres, they never
     travel outside the liquid (the old version flew them up through the lid). */
  function makeSet(geo, mat, build, drop, overlay) {
    const S = { mat, on: false, items: null, mesh: null, k: null, t0: 0, last: 0, active: false, maxDelay: 0 };
    S.show = (v) => { S.mesh.visible = v; };
    S.write = () => {
      let any = false;
      for (let i = 0; i < S.items.length; i++) {
        const it = S.items[i], e = smooth(S.k[i]);
        if (e > 0.003) any = true;
        dummy.position.set(it.p.x, it.p.y + (1 - e) * drop, it.p.z);
        dummy.quaternion.copy(it.q);
        dummy.scale.copy(it.sc).multiplyScalar(Math.max(1e-4, e));
        dummy.updateMatrix();
        S.mesh.setMatrixAt(i, dummy.matrix);
      }
      S.mesh.instanceMatrix.needsUpdate = true;
      S.show(any);
    };
    S.ensure = () => {
      if (S.items) return;
      S.items = build();
      S.k = new Float32Array(S.items.length);
      // toppings are drawn once, in the transparent pass AFTER the glass layers (so the glass cannot wash them out) and with an
      // alpha that follows how much liquid lies in front of them. No opaque copy is needed any more.
      let useMat = mat;
      if (overlay) { useMat = mat.clone(); useMat.transparent = true; useMat.onBeforeCompile = mat.onBeforeCompile; }
      S.mat = useMat;
      S.mesh = new THREE.InstancedMesh(geo, useMat, S.items.length);
      if (overlay) S.mesh.renderOrder = 5;
      S.mesh.frustumCulled = false;
      S.items.forEach((it, i) => { if (it.color) S.mesh.setColorAt(i, it.color); S.maxDelay = Math.max(S.maxDelay, it.delay); });
      if (S.mesh.instanceColor) S.mesh.instanceColor.needsUpdate = true;
      S.write();
      cup.add(S.mesh);
    };
    S.setOn = (on, at, instant) => {
      if (S.items && on === S.on) return;               // idempotent: repeated calls change nothing
      S.on = on;
      if (on) S.ensure();
      if (!S.items) return;
      if (instant || reduceMotion) { S.k.fill(on ? 1 : 0); S.write(); S.active = false; return; }
      S.t0 = at; S.last = performance.now(); S.active = true;
    };
    S.update = (now) => {
      if (!S.active) return false;
      const dt = Math.min(0.1, Math.max(0, (now - S.last) / 1000)); S.last = now;
      const el = (now - S.t0) / 1000, target = S.on ? 1 : 0;
      const up = dt / 0.7, down = dt / 0.4;
      let moving = false;
      for (let i = 0; i < S.items.length; i++) {
        let k = S.k[i];
        if (k !== target) {
          if (el >= S.items[i].delay * (S.on ? 1 : 0.3)) k = k < target ? Math.min(target, k + up) : Math.max(target, k - down);
          if (k !== target) moving = true;
          S.k[i] = k;
        }
      }
      S.write();
      if (!moving) { S.active = false; S.show(S.on); }
      return moving;
    };
    return S;
  }
  // rounded cube with smoothly blended normals (pillow shading, no hard edges)
  const roundedCube = (seg, round, shade) => {
    const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
    const p = g.attributes.position, nrm = g.attributes.normal, v = new THREE.Vector3(), fn = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); fn.fromBufferAttribute(nrm, i);
      const dir = v.clone().normalize();
      v.lerp(dir.clone().multiplyScalar(0.62), round);
      p.setXYZ(i, v.x, v.y, v.z);
      fn.multiplyScalar(1 - shade).addScaledVector(dir, shade).normalize();
      nrm.setXYZ(i, fn.x, fn.y, fn.z);
    }
    return g;
  };

  /* ---- tapioca: glossy dark-brown pearls, uneven sizes, a lighter amber rim where light passes through the edge ---- */
  const pearlMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.25 });
  topShader(pearlMat, { rim: [0.34, 0.15, 0.05, 0.6, 3.0] });
  const tapioca = makeSet(new THREE.SphereGeometry(0.1, 18, 12), pearlMat, () => {
    const items = dropIn(120, 0.1, 0.84, 0.26, 0.8, 1.3);     // a loose layer, a couple of beads deep
    settle(items, 130, 0.012); settle(items, 12, 0);          // fall, then relax the overlaps
    items.forEach(it => {
      it.q = randQ(); it.sc = new THREE.Vector3(it.s, it.s * (0.93 + rand() * 0.07), it.s);
      it.color = new THREE.Color().setHSL(0.06 + rand() * 0.02, 0.5, 0.045 + rand() * 0.04, THREE.SRGBColorSpace);
      it.delay = it.p.y * 0.22 + rand() * 0.2;
    });
    return items;
  }, 0.3, true);

  /* ---- popping pearls: thin translucent orange skin, brighter juicy core ---- */
  const popMat = new THREE.MeshPhysicalMaterial({ color: L(0xf08a00), roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02,
    emissive: L(0x7a2a00), emissiveIntensity: 0.15, envMapIntensity: 1.6 });
  topShader(popMat, { rim: [0.85, 0.3, 0.0, 0.35, 2.5], core: [1.0, 0.62, 0.12, 0.4, 1.6] });
  const popping = makeSet(new THREE.SphereGeometry(0.095, 18, 12), popMat, () => {
    const items = dropIn(140, 0.095, 0.9, 0.2, 0.8, 1.25);      // popping pearls: a loose layer like the tapioca
    settle(items, 130, 0.012); settle(items, 12, 0);
    items.forEach(it => {
      it.q = randQ(); it.sc = new THREE.Vector3(it.s, it.s, it.s);
      it.color = new THREE.Color().setHSL(0.075 + rand() * 0.03, 1, 0.5 + rand() * 0.08, THREE.SRGBColorSpace);
      it.delay = it.p.y * 0.22 + rand() * 0.2;
    });
    return items;
  }, 0.3, true);

  /* ---- red beans: small oval beans, matte satin skin ---- */
  const beanMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  topShader(beanMat, { rim: [0.45, 0.12, 0.07, 0.35, 2.4] });
  const beans = makeSet(new THREE.SphereGeometry(0.066, 16, 12), beanMat, () => {
    const items = dropIn(240, 0.089, 0.85, 0.25, 0.6, 1.025);     // red beans: thinner layer. r = real long semi-axis (0.066 x 1.35), so even a radially-turned bean stays inside the glass
    settle(items, 110, 0.012); settle(items, 12, 0);
    items.forEach(it => {
      it.q = randQ(); it.sc = new THREE.Vector3(1.35 * it.s, 0.9 * it.s, 0.95 * it.s);
      it.color = new THREE.Color().setHSL(0.02 + rand() * 0.02, 0.62, 0.27 + rand() * 0.09, THREE.SRGBColorSpace);
      it.delay = it.p.y * 0.22 + rand() * 0.2;
    });
    return items;
  }, 0.3, true);

  /* ---- grass jelly (仙草), rebuilt from the menu photo -----------------------------------------------------
     Real gelée d'herbe is NOT glossy round dice: it is irregular, sharp-edged chunks of different sizes and proportions,
     matte-satin charcoal / blue-black, whose flat facets catch the light as lighter grey. Here: crisp-edged slabs and
     blocks (independent X/Y/Z size, random orientation) in a heap ON THE BOTTOM of the cup, like in the photo; the chunks
     that touch the glass lie with a flat face against it. Every chunk is checked against the glass with its real corners. */
  const jellyMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, clearcoat: 0.28, clearcoatRoughness: 0.4, envMapIntensity: 0.85 });
  topShader(jellyMat, { rim: [0.2, 0.23, 0.26, 0.55, 2.4] });
  const jellies = makeSet(roundedCube(4, 0.07, 0.0), jellyMat, () => {
    const items = [], corner = new THREE.Vector3();
    const lowest = (q, sc) => { let m = 9; for (let i = 0; i < 8; i++) { corner.set(i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5).multiply(sc).applyQuaternion(q); m = Math.min(m, corner.y); } return m; };
    const chunk = (p, edge, tilt, yaw, snap) => {
      // x = tangential width, y = height, z = depth toward the glass: slabs, blocks and bars
      const sc = new THREE.Vector3(edge * (0.7 + rand() * 0.9), edge * (0.55 + rand() * 0.7), edge * (0.55 + rand() * 0.6));
      let d = Math.hypot(p.x, p.z);
      const ang = Math.atan2(p.x, p.z);
      // a chunk that reaches the glass rests with a FLAT FACE against it (like in a real cup), so its whole face shows through
      // the liquid surface instead of a thin corner sliver
      const flush = snap && d > rAt(Math.max(0, p.y - edge * 0.5)) - GLASS_IN - 0.62 * Math.max(sc.x, sc.z) - 0.08;
      const q = new THREE.Quaternion().setFromEuler(flush
        ? new THREE.Euler((rand() - 0.5) * 0.2, ang + (rand() - 0.5) * 0.25, (rand() - 0.5) * 0.2, 'YXZ')
        : new THREE.Euler((rand() - 0.5) * tilt, yaw, (rand() - 0.5) * tilt, 'YXZ'));
      const it = { p, q, sc, color: new THREE.Color().setHSL(0.56 + rand() * 0.06, 0.1 + rand() * 0.06, 0.13 + rand() * 0.1, THREE.SRGBColorSpace), delay: 0 };
      // exact fit: slide the chunk along its radial direction until its 8 real corners touch the glass from the inside
      // (a flat face on a ROUND glass has corners that swing outward, so a single "reach" number is not enough)
      const cs = []; for (let i = 0; i < 8; i++) cs.push(new THREE.Vector3(i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5).multiply(sc).applyQuaternion(q));
      const over = (dd) => { let m = -9; const px = Math.sin(ang) * dd, pz = Math.cos(ang) * dd; for (const c of cs) m = Math.max(m, Math.hypot(px + c.x, pz + c.z) - (rAt(Math.max(0, p.y + c.y)) - GLASS_IN)); return m; };
      for (let k = 0; k < 8; k++) { const o = over(d); if (flush || o > 0) d = Math.max(0, d - o); else break; }
      p.x = Math.sin(ang) * d; p.z = Math.cos(ang) * d;
      p.y = Math.max(p.y, 0.03 - lowest(q, sc));
      items.push(it); return it;
    };
    // the heap at the bottom, settled like the pearls. Nothing climbs the wall and nothing floats: gelée stays on the bottom, in every drink.
    const heap = dropIn(135, 0.1, 0.85, 0.3, 0.9, 1.15);
    settle(heap, 120, 0.012); settle(heap, 12, 0);
    heap.forEach(h => chunk(h.p, 0.21 * h.s, 1.6, rand() * 6.28, true));
    items.forEach(it => { it.delay = it.p.y * 0.25 + rand() * 0.2; });
    return items;
  }, 0.25, true);

  /* ---- ice cubes (menu says "thé fruit glacé"): frosted, floating near the top, fruit teas only ---- */
  const iceMat = new THREE.MeshPhysicalMaterial({ color: L(0xdbe9ef), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9,
    emissive: L(0x1a2a32), emissiveIntensity: 0.5 });
  topShader(iceMat, { rim: [0.55, 0.75, 0.85, 0.25, 2.5] });
  const ice = makeSet(roundedCube(8, 0.14, 0.85), iceMat, () => {
    const items = [];
    for (let guard = 0; items.length < 5 && guard < 600; guard++) {
      const y = FILL - 0.95 + rand() * 0.55, a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 0.4;
      const p = new THREE.Vector3(Math.sin(a) * d, y, Math.cos(a) * d);
      if (items.every(o => o.p.distanceTo(p) > 0.5)) items.push({ p });
    }
    items.forEach(it => {
      const s = 0.44 + rand() * 0.12;
      it.q = randQ(); it.sc = new THREE.Vector3(s, s * (0.9 + rand() * 0.15), s * (0.9 + rand() * 0.15));
      it.delay = rand() * 0.3;
    });
    return items;
  }, 0.2);

