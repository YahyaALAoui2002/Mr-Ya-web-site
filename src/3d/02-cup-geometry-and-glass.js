  /* ---------- Dimensions ---------- */
  const H = 2.9, R0 = 0.78, R1 = 1.08;
  // Exact glass radius at height y. It mirrors cupProfile below: a rounded base corner, then a straight cone from
  // (R0, y=.11) to (R1, y=H). Every topping, the liquid, the label and the lid are placed from this single function.
  const BASE_KNOTS = [[0, 0.62], [0.012, 0.72], [0.05, 0.765], [0.11, 0.78]];
  const rAt = (y) => {
    if (y >= 0.11) return R0 + (R1 - R0) * (y - 0.11) / (H - 0.11);
    y = Math.max(0, y);
    for (let i = 1; i < BASE_KNOTS.length; i++) if (y <= BASE_KNOTS[i][0]) {
      const a = BASE_KNOTS[i - 1], b = BASE_KNOTS[i];
      return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]);
    }
    return R0;
  };
  const GLASS_IN = 0.006;                                // every topping stays at least this far INSIDE the glass
  const WALL = 0.04;           // liquid surface sits this far inside the glass (beads poke through it, but never through the glass)
  const FILL = H - 0.26;      // liquid height: 0.26 of air under the lid

  const LBL_Y0 = 1.18, LBL_Y1 = 1.98, LBL_T = 1.62;          // label placement (also used to keep toppings off it)
  const cup = new THREE.Group();
  scene.add(cup);

  /* ---------- Canvas helpers ---------- */
  const canvasTex = (w, h, draw, opts = {}) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (opts.wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  };
  const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  /* ---------- Cup: thin clear PP plastic ---------- */
  const condensation = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = rand() * w, y = rand() * h, r = 1 + Math.pow(rand(), 3) * 9;
      const gr = g.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, { srgb: false, wrap: true });
  condensation.repeat.set(3, 1.5);

  const cupProfile = [
    new THREE.Vector2(0.001, 0.0), new THREE.Vector2(0.62, 0.0), new THREE.Vector2(0.72, 0.012),
    new THREE.Vector2(0.765, 0.05), new THREE.Vector2(R0, 0.11),
    new THREE.Vector2(rAt(H), H), new THREE.Vector2(rAt(H) + 0.03, H + 0.02),
  ];
  const cupGeo = new THREE.LatheGeometry(cupProfile, 160);
  const cupMat = new THREE.MeshPhysicalMaterial({
    color: L(0xf3f6f2), roughness: 0.25, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false,
  });
  const cupMesh = new THREE.Mesh(cupGeo, cupMat);
  cupMesh.renderOrder = 2;
  const glossMat = new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    bumpMap: condensation, bumpScale: 0.004, envMapIntensity: 1.6,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const gloss = new THREE.Mesh(cupGeo, glossMat);
  gloss.renderOrder = 3;
  cup.add(gloss);
  cup.add(cupMesh);

