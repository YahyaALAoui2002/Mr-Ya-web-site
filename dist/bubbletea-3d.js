/* Mr Ye — realistic 3D bubble tea cup (three.js r159, UMD global THREE) */
(function () {
  const host = document.getElementById('cup3d');
  if (!host) return;
  const showFallback = (msg) => { if (!(host.parentElement && host.parentElement.querySelector('svg'))) host.insertAdjacentHTML('beforeend', '<div class="fallback-3d">' + msg + '</div>'); };
  if (!window.THREE) { showFallback('Impossible de charger le moteur 3D.'); return; }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) { console.error('Mr Ye 3D: WebGL indisponible', e); showFallback('La prévisualisation 3D n’est pas disponible sur cet appareil.'); return; }
  if (!renderer.getContext()) { showFallback('La prévisualisation 3D n’est pas disponible sur cet appareil.'); return; }

  const L = (h) => new THREE.Color(h);   // r159: hex is treated as sRGB and converted automatically
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 820 ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  let emaDt = 0.016, slowFrames = 0;               // adaptive resolution: steps pr down on a weak GPU
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;
  
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 60);
  let needs = true, paramsDirty = true;   // shared by handlers declared above their use

  /* ---------- Studio environment for reflections (softboxes) ---------- */
  (function buildEnv() {
    // Port of three.js RoomEnvironment (from Google model-viewer): a lit studio room used as the reflection source
    const env = new THREE.Scene();
    const geo = new THREE.BoxGeometry(); geo.deleteAttribute('uv');
    const roomMat = new THREE.MeshStandardMaterial({ side: THREE.BackSide });
    const boxMat = new THREE.MeshStandardMaterial();
    const main = new THREE.PointLight(0xffffff, 900, 28, 2); main.position.set(0.418, 16.199, 0.3); env.add(main);
    const add = (mat, p, r, sc) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (r) m.rotation.set(0, r, 0); m.scale.set(...sc); env.add(m); };
    add(roomMat, [-0.757, 13.219, 0.717], 0, [31.713, 28.305, 28.591]);
    add(boxMat, [-10.906, 2.009, 1.846], -0.195, [2.328, 7.905, 4.651]);
    add(boxMat, [-5.607, -0.754, -0.758], 0.994, [1.97, 1.534, 3.955]);
    add(boxMat, [6.167, 0.857, 7.803], 0.561, [3.927, 6.285, 3.687]);
    add(boxMat, [-2.017, 0.018, 6.124], 0.333, [2.002, 4.566, 2.064]);
    add(boxMat, [2.291, -0.756, -2.621], -0.286, [1.546, 1.552, 1.496]);
    add(boxMat, [-2.193, -0.369, -5.547], 0.516, [3.875, 3.487, 2.986]);
    const lightMat = (i) => { const m = new THREE.MeshBasicMaterial(); m.color.setScalar(i); return m; };
    add(lightMat(50), [-16.116, 14.37, 8.208], 0, [0.1, 2.428, 2.739]);
    add(lightMat(50), [-16.109, 18.021, -8.207], 0, [0.1, 2.425, 2.751]);
    add(lightMat(17), [14.904, 12.198, -1.832], 0, [0.15, 4.265, 6.331]);
    add(lightMat(43), [-0.462, 8.89, 14.52], 0, [4.38, 5.441, 0.088]);
    add(lightMat(20), [3.235, 11.486, -12.541], 0, [2.5, 2.0, 0.1]);
    add(lightMat(100), [0, 20, 0], 0, [1.0, 0.1, 1.0]);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.04).texture;
    pm.dispose();
  })();
  // transmission refracts whatever is behind it, so the scene needs the page colour as a real background
  let isDark = 0;
  const syncBg = () => {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#eef1ea';
    const col = new THREE.Color(css);
    isDark = (col.r * 0.2126 + col.g * 0.7152 + col.b * 0.0722) < 0.1 ? 1 : 0;
    // soft studio light pool: page colour everywhere, a little lighter behind the cup, back to the exact page colour at the edges
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = css; g.fillRect(0, 0, 256, 256);
    const gr = g.createRadialGradient(128, 112, 0, 128, 112, 128);
    gr.addColorStop(0, isDark ? 'rgba(130,185,145,.16)' : 'rgba(255,255,255,.62)');
    gr.addColorStop(0.55, isDark ? 'rgba(130,185,145,.06)' : 'rgba(255,255,255,.2)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    if (scene.background && scene.background.isTexture) scene.background.dispose();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  };
  syncBg();
  const onScheme = () => { syncBg(); paramsDirty = true; needs = true; };
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  if (mqDark.addEventListener) mqDark.addEventListener('change', onScheme); else if (mqDark.addListener) mqDark.addListener(onScheme);
  if ('MutationObserver' in window) new MutationObserver(onScheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const keyLight = new THREE.DirectionalLight(0xfff4e6, 1.6); keyLight.position.set(-4, 7, 6); scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0xe8f0ff, 1.1); rim.position.set(5, 4, -6); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2c3a2f, 0.25));

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

  /* ---------- Flavours: every menu flavour gets its own hue, clarity and depth ----------
     hex = base colour        trans = how much light passes through the liquid
     att = absorption distance (small = deeper colour)   glow = inner light of a backlit fruit tea
     rough = surface haze     deep = darker/denser at the bottom
     speck/speckDark = suspended particles (taro, matcha, passion-fruit seeds)   grad = fruit-tea colour gradient */
  const DEF = { milky: 0.08, cream: 1, bubbles: 0, sheen: 0.35, trans: 0.08, att: 0.22, glow: 0, rough: 0.42, deep: 0.5, speck: 0, speckDark: 0.3, grad: 0.5, thick: 1.4, ior: 1.35, coat: 0.18, gloss: 0.2, sigma: 3.0, tint: 0.16 };
  const FRUIT_DEF = { milky: 0, cream: 0, bubbles: 1, sheen: 0.02, trans: 0.6, att: 0.8, glow: 0.18, rough: 0.1, thick: 0.55, ior: 1.33, coat: 0.6, gloss: 0.2, sigma: 0.9, tint: 0.32 };
  const FRUIT_SIGMA = { citron: 0.7, mangue: 0.9, passion: 0.9, rose: 0.9, peche: 1.2, litchi: 1.8, fraise: 1.2, myrtille: 1.6, cerise: 1.8 };   // darker / cloudier teas hide deep beads sooner
  const FLAVORS = {
    lait: {
      nature:   { hex: '#a47a4e', deep: 0.65 },
      fraise:   { hex: '#ee8fab', deep: 0.5 },
      mangue:   { hex: '#f4a824', deep: 0.55 },
      coco:     { hex: '#dccfb8', trans: 0.05, deep: 0.25, milky: 0.06 },
      pasteque: { hex: '#ee5566', deep: 0.55 },
      matcha:   { hex: '#729638', deep: 0.85 },
      taro:     { hex: '#9774c6', deep: 0.6 },
      vanille:  { hex: '#e7c67a', deep: 0.4, milky: 0.06 },
    },
    fruit: {
      citron:   { hex: '#e9e03a', trans: 0.6,  att: 0.9, glow: 0.16, rough: 0.08, grad: 0.4 },
      mangue:   { hex: '#f77f12', trans: 0.6,  att: 0.7, glow: 0.2,  rough: 0.1,  grad: 0.6 },
      passion:  { hex: '#f2a014', trans: 0.6,  att: 0.7, glow: 0.2,  rough: 0.1,  grad: 0.6, speck: 0.5, speckDark: 0.75 },
      rose:     { hex: '#e04a78', trans: 0.58, att: 0.6, glow: 0.18, rough: 0.1,  grad: 0.5 },
      peche:    { hex: '#f4825a', trans: 0.5,  att: 0.6, glow: 0.2,  rough: 0.16, grad: 0.5 },
      litchi:   { hex: '#e3b9ae', trans: 0.36, att: 1.0, glow: 0.05, rough: 0.26, grad: 0.3 },
      fraise:   { hex: '#d82a45', trans: 0.58, att: 0.5, glow: 0.16, rough: 0.1,  grad: 0.7 },
      myrtille: { hex: '#5f2f9a', trans: 0.55, att: 0.4, glow: 0.12, rough: 0.1,  grad: 0.8 },
      cerise:   { hex: '#9a0f28', trans: 0.52, att: 0.4, glow: 0.1,  rough: 0.1,  grad: 0.8 },
    },
  };
  Object.keys(FLAVORS).forEach(base => Object.keys(FLAVORS[base]).forEach(id => {
    FLAVORS[base][id] = Object.assign({}, DEF, base === 'fruit' ? FRUIT_DEF : {}, base === 'fruit' ? { sigma: FRUIT_SIGMA[id] } : {}, FLAVORS[base][id]);
    if (base === 'fruit') FLAVORS[base][id].trans = Math.min(0.88, FLAVORS[base][id].trans * 1.22);     // clear tea: far more see-through than milk
  }));

  /* ---------- Liquid: procedural, animated, scattering ---------- */
  const NOISE = `
    float h31(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h31(i+vec3(0,0,0)),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y), f.z); }
    float fbm(vec3 p){ float a = .5, s = 0.; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + 7.1; a *= .5; } return s; }
  `;
  const liqU = {
    uMilk: { value: 1 }, uFill: { value: FILL }, uTime: { value: 0 },
    uMilky: { value: 0.08 }, uCream: { value: 1 }, uBubbles: { value: 0 },
    uTilt: { value: new THREE.Vector2() },
    uDeep: { value: 0.5 }, uSpeck: { value: 0 }, uSpeckDark: { value: 0.3 }, uGrad: { value: 0.5 },
  };
  // profile: rounded bottom edge, straight-ish walls, meniscus climbing the wall, flat surface
  const liqProfile = [new THREE.Vector2(0.001, 0.02), new THREE.Vector2(0.66, 0.02), new THREE.Vector2(0.73, 0.045), new THREE.Vector2(R0 - WALL, 0.12)];
  for (let i = 1; i <= 24; i++) { const y = 0.12 + (FILL + 0.03 - 0.12) * i / 24; liqProfile.push(new THREE.Vector2(rAt(y) - WALL, y)); }
  const rTop = rAt(FILL) - WALL;
  [[rTop - 0.012, FILL + 0.038], [rTop - 0.035, FILL + 0.016], [rTop - 0.08, FILL + 0.005], [rTop - 0.2, FILL + 0.001], [0.001, FILL]]
    .forEach(([x, y]) => liqProfile.push(new THREE.Vector2(x, y)));
  const teaMat = new THREE.MeshPhysicalMaterial({ color: L(0xa47a4e), roughness: 0.42, clearcoat: 0.18, clearcoatRoughness: 0.35,
    transmission: 0.08, thickness: 1.4, ior: 1.35, attenuationColor: L(0xa47a4e), attenuationDistance: 0.22,
    sheen: 0.35, sheenColor: L(0xfff3de), sheenRoughness: 0.6,           // velvet satin sheen: the soft glow of milk at grazing angles
    emissive: L(0xa47a4e), emissiveIntensity: 0, depthWrite: false });
  teaMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, liqU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform float uFill;\nuniform vec2 uTilt;')
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float topK = smoothstep(uFill - 0.08, uFill + 0.03, position.y);
        transformed.y += topK * (uTilt.x * position.x + uTilt.y * position.z);
        vObj = transformed;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform float uMilk, uFill, uDeep, uSpeck, uSpeckDark, uGrad, uTime, uMilky, uCream, uBubbles;\n' + NOISE)
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        vec3 lqP = vObj;
        float lqAng = atan(lqP.x, lqP.z);
        vec3 lqC = vec3(sin(lqAng), cos(lqAng), 0.0) * 1.15;      // seamless around the cup
        float lqH = clamp(lqP.y / uFill, 0.0, 1.0);
        float lqSpeck = 0.0;
        if (uSpeck > 0.001) lqSpeck = smoothstep(0.80, 0.90, vnoise(vec3(lqC.xy * 46.0, lqP.y * 46.0))) * uSpeck;
        if (uMilk > 0.5) {
          // MILKY: fat globules scatter every wavelength, so the colour is lifted toward a warm cream white (the hue is kept)
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(0.62, 0.57, 0.50), 0.6), uMilky);
          diffuseColor.rgb *= mix(0.86, 0.98, smoothstep(0.0, 0.8, lqH));       // denser at the bottom, silkier toward the top
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * diffuseColor.rgb, uDeep * smoothstep(0.6, 0.0, lqH) * 0.4);
          // thick cream cap at the top: lighter and silky, with a soft edge where it meets the milk
          float cap = smoothstep(0.86, 0.98, lqH);
          vec3 froth = min(diffuseColor.rgb * 1.32 + vec3(0.04, 0.035, 0.03), vec3(1.0));          // a lighter version of the flavour, not neutral white
          diffuseColor.rgb = mix(diffuseColor.rgb, froth, cap * 0.5 * uCream);
          // light cream wisps folding in slowly. They are only ever LIGHTER than the milk: dark swirls read as dirt
          if (lqH > 0.65 && uCream > 0.01) {
            float w = fbm(vec3(lqC.xy * 1.5, lqP.y * 2.0 - uTime * 0.035));
            float wisp = smoothstep(0.5, 0.82, w) * smoothstep(0.7, 0.97, lqH);
            diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * 1.5 + vec3(0.05), vec3(1.0)), wisp * 0.26 * uCream);
          }
          // soft foam film at the surface
          float foam = smoothstep(uFill - 0.12, uFill - 0.01, lqP.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * 1.16 + 0.03, vec3(1.0)), foam * 0.8);
        } else {
          // fruit tea: deeper and more saturated toward the bottom, lighter and sunnier near the top
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * diffuseColor.rgb, uGrad * 0.7 * smoothstep(0.85, 0.0, lqH));
          diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * 1.12 + vec3(0.025, 0.02, 0.0), vec3(1.0)), uGrad * smoothstep(0.7, 1.0, lqH));
          // faint streaks of juice settling
          diffuseColor.rgb *= 0.94 + 0.12 * fbm(vec3(lqC.xy * 2.0, lqP.y * 0.55));
          diffuseColor.rgb *= 1.0 - lqSpeck * uSpeckDark;      // passion-fruit seeds
          // rising micro-bubbles: tiny bright beads drifting up (fresh, sparkling): clear tea only
          float bn = vnoise(vec3(lqC.xy * 17.0, lqP.y * 17.0 - uTime * 0.9));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), smoothstep(0.88, 0.94, bn) * uBubbles * 0.8);
        }`)
      .replace('#include <opaque_fragment>', `
        if (uMilk > 0.5) {
          vec3 Vv = normalize(vViewPosition);
          float NdV = clamp(dot(normal, Vv), 0.0, 1.0);
          // milk scatters light: soft warm falloff toward grazing angles instead of a hard terminator
          float rim = pow(1.0 - NdV, 2.2);
          outgoingLight += diffuseColor.rgb * (0.06 * rim) * vec3(1.0, 0.86, 0.7);
          outgoingLight += vec3(0.05, 0.06, 0.075) * rim * uMilky;           // thin edges of milk scatter a cool white
          outgoingLight *= vec3(0.98, 0.96, 0.93);
          // light wrap: the side facing the key light glows a little more
          float wrap = clamp(dot(normal, normalize(vec3(-0.45, 0.35, 0.8))) * 0.5 + 0.5, 0.0, 1.0);
          outgoingLight *= 0.94 + 0.12 * wrap;
        } else {
          // clear tea: a thin sunlit streak, like light bending through the liquid
          float band = smoothstep(0.3, 0.0, abs(normal.x + 0.6));
          outgoingLight += diffuseColor.rgb * band * 0.5 + vec3(0.05) * band;
        }
        #include <opaque_fragment>`);
  };
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liqProfile, 160), teaMat);
  cup.add(liquid);

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

  /* ---------- Label: the real green sticker ---------- */
  function drawLabel(g, w, h) {
    g.clearRect(0, 0, w, h);
    const green = '#2f5d3f', cream = '#eef2ea';
    // ornate outline: notched corners, crest on top
    const path = () => {
      const p = new Path2D(), m = 26, cx = w / 2;
      p.moveTo(m + 30, 40);
      p.lineTo(cx - 120, 40); p.quadraticCurveTo(cx - 60, 40, cx - 40, 14); p.quadraticCurveTo(cx, -6, cx + 40, 14); p.quadraticCurveTo(cx + 60, 40, cx + 120, 40);
      p.lineTo(w - m - 30, 40); p.quadraticCurveTo(w - m, 40, w - m, 70);
      p.lineTo(w - m, h - 100); p.quadraticCurveTo(w - m - 4, h - 60, w - m - 50, h - 50);
      p.quadraticCurveTo(cx + 120, h - 40, cx, h - 12); p.quadraticCurveTo(cx - 120, h - 40, m + 50, h - 50);
      p.quadraticCurveTo(m + 4, h - 60, m, h - 100);
      p.lineTo(m, 70); p.quadraticCurveTo(m, 40, m + 30, 40); p.closePath();
      return p;
    };
    const outer = path();
    g.fillStyle = green; g.fill(outer);
    // print texture: very faint paper grain
    g.save(); g.clip(outer);
    for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(255,255,255,${rand() * 0.035})`; g.fillRect(rand() * w, rand() * h, 2, 2); }
    g.restore();
    // inner dashed line
    g.save(); g.translate(w / 2, h / 2); g.scale(0.94, 0.9); g.translate(-w / 2, -h / 2);
    g.setLineDash([7, 6]); g.lineWidth = 2.5; g.strokeStyle = 'rgba(238,242,234,.75)'; g.stroke(path()); g.restore();
    // rose emblem
    const rx = w / 2, ry = 72;
    g.strokeStyle = cream; g.lineWidth = 3; g.fillStyle = cream;
    g.beginPath(); g.arc(rx, ry, 22, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(rx + (k - 1) * 4, ry + 1, 13 - k * 3.5, Math.PI * (0.2 + k * .3), Math.PI * (1.7 + k * .3)); g.stroke(); }
    // leaves + sprigs
    const leaf = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2); g.fill(); g.restore(); };
    leaf(rx - 42, ry + 12, -0.4); leaf(rx + 42, ry + 12, 0.4);
    g.lineWidth = 2.5; g.beginPath(); g.moveTo(rx - 230, ry + 32); g.quadraticCurveTo(rx - 120, ry + 22, rx - 58, ry + 16); g.stroke();
    g.beginPath(); g.moveTo(rx + 230, ry + 32); g.quadraticCurveTo(rx + 120, ry + 22, rx + 58, ry + 16); g.stroke();
    ['❀'].forEach(() => { g.font = '34px serif'; g.textAlign = 'center'; g.fillText('✿', rx - 300, ry + 22); g.fillText('✿', rx + 300, ry + 22); });
    // 幸福食光
    g.fillStyle = cream; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = '900 132px "Noto Serif SC","Songti SC","SimSun",serif';
    const chars = ['幸', '福', '食', '光'];
    chars.forEach((c, i) => g.fillText(c, w / 2 + (i - 1.5) * 168, 252));
    // underline rules + Mr. Ye
    g.fillRect(w / 2 - 330, 300, 140, 3); g.fillRect(w / 2 + 190, 300, 140, 3);
    g.font = 'italic 700 96px "Dancing Script","Brush Script MT",cursive';
    g.fillText('Mr. Ye', w / 2, 334);
    g.font = '600 30px "Familjen Grotesk",Arial,sans-serif';
    g.fillText('TEL : 09 80 61 56 80', w / 2 + 40, 390);
    g.fillText('Adresse : 69 AV des Gobelins 75013 Paris', w / 2, 428);
  }
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 1024; labelCanvas.height = 480;
  drawLabel(labelCanvas.getContext('2d'), 1024, 480);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace; labelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const labelMat = new THREE.MeshPhysicalMaterial({ map: labelTex, alphaTest: 0.4, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.18, side: THREE.FrontSide });
  const labelGeo = new THREE.CylinderGeometry(rAt(LBL_Y1) + 0.004, rAt(LBL_Y0) + 0.004, LBL_Y1 - LBL_Y0, 96, 1, true, -LBL_T / 2, LBL_T);
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.y = (LBL_Y0 + LBL_Y1) / 2;
  cup.add(label);
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load('900 132px "Noto Serif SC"', '幸福食光'),
      document.fonts.load('700 96px "Dancing Script"', 'Mr. Ye'),
      document.fonts.load('600 30px "Familjen Grotesk"', 'TEL'),
    ]).then(() => { drawLabel(labelCanvas.getContext('2d'), 1024, 480); labelTex.needsUpdate = true; }).catch(() => {});
  }

  /* ---------- Lid: opaque white PP, rim + recess + flat top ---------- */
  const lidMat = new THREE.MeshPhysicalMaterial({ color: L(0xf2f3ef), roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.25, sheenColor: new THREE.Color(0x9a9a9a), side: THREE.DoubleSide });
  const rt = rAt(H);
  const lidProfile = [
    [rt - 0.01, H - 0.1], [rt + 0.05, H - 0.07], [rt + 0.075, H - 0.02], [rt + 0.08, H + 0.08],
    [rt + 0.06, H + 0.115], [rt - 0.02, H + 0.12], [rt - 0.07, H + 0.09], [rt - 0.1, H + 0.1],
    [rt - 0.13, H + 0.19], [rt - 0.16, H + 0.215], [rt - 0.25, H + 0.22], [0.001, H + 0.225],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const lid = new THREE.Mesh(new THREE.LatheGeometry(lidProfile, 140), lidMat);
  cup.add(lid);
  // embossed ring detail on top
  const ring = new THREE.Mesh(new THREE.TorusGeometry(rt - 0.42, 0.008, 8, 120), lidMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = H + 0.226; cup.add(ring);

  /* ---------- Heart stopper on its nub ---------- */
  const nubX = 0.55, nubZ = 0.22;
  const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.09, 40), lidMat);
  nub.position.set(nubX, H + 0.265, nubZ); cup.add(nub);
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -0.5);
  heartShape.bezierCurveTo(-0.15, -0.32, -0.62, -0.05, -0.55, 0.28);
  heartShape.bezierCurveTo(-0.5, 0.58, -0.12, 0.62, 0, 0.32);
  heartShape.bezierCurveTo(0.12, 0.62, 0.5, 0.58, 0.55, 0.28);
  heartShape.bezierCurveTo(0.62, -0.05, 0.15, -0.32, 0, -0.5);
  const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 8, curveSegments: 40 });
  heartGeo.center();
  const heartMat = new THREE.MeshPhysicalMaterial({ color: L(0xb3101b), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
  const heart = new THREE.Mesh(heartGeo, heartMat);
  heart.scale.setScalar(0.34);
  heart.position.set(nubX, H + 0.46, nubZ);
  heart.rotation.set(0, -0.35, 0.08);
  cup.add(heart);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 20), heartMat);
  stem.position.set(nubX, H + 0.33, nubZ); cup.add(stem);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.035, 40), heartMat);
  cap.position.set(nubX, H + 0.305, nubZ); cup.add(cap);

  /* ---------- Kraft paper straw ---------- */
  const kraft = canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#c49a68'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const s = rand(); g.fillStyle = s > .5 ? `rgba(255,236,200,${rand() * .12})` : `rgba(90,55,25,${rand() * .12})`; g.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1); }
    g.strokeStyle = 'rgba(110,72,38,.28)'; g.lineWidth = 3;
    for (let k = -6; k < 12; k++) { g.beginPath(); g.moveTo(0, k * 120); g.lineTo(w, k * 120 + 220); g.stroke(); }
  }, { wrap: true });
  kraft.repeat.set(1, 3);
  const strawMat = new THREE.MeshStandardMaterial({ map: kraft, roughness: 0.82, bumpMap: kraft, bumpScale: 0.004, side: THREE.DoubleSide });
  const strawLen = 4.3;
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, strawLen, 48, 1, true), strawMat);
  const strawBase = new THREE.Vector3(-0.32, 0.35, -0.05);
  const tilt = 0.08;
  straw.rotation.z = tilt;
  straw.position.set(strawBase.x - Math.sin(tilt) * strawLen / 2, strawBase.y + Math.cos(tilt) * strawLen / 2, strawBase.z);
  cup.add(straw);
  // straw hole collar
  const yLid = H + 0.225;
  const collarX = strawBase.x - Math.sin(tilt) * (yLid - strawBase.y) / Math.cos(tilt);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 12, 48), lidMat);
  collar.rotation.x = Math.PI / 2; collar.position.set(collarX, yLid + 0.01, strawBase.z); cup.add(collar);

  /* ---------- Soft contact shadow ---------- */
  const shadowTex = canvasTex(256, 256, (g, w, h) => {
    // wide soft penumbra + a tight dark core right where the base touches the table
    const pen = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    pen.addColorStop(0, 'rgba(0,0,0,.30)'); pen.addColorStop(0.5, 'rgba(0,0,0,.12)'); pen.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = pen; g.fillRect(0, 0, w, h);
    const core = g.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.26);
    core.addColorStop(0, 'rgba(0,0,0,.5)'); core.addColorStop(0.6, 'rgba(0,0,0,.22)'); core.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = core; g.fillRect(0, 0, w, h);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.001;
  scene.add(shadow);

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

  /* ---------- Framing ---------- */
  const target = new THREE.Vector3(0, 2.35, 0);
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const wide = camera.aspect > 0.95;
    layoutBear(wide);
    const fitH = 5.9, fitW = !mascot.on ? 3.1 : wide ? 5.5 : 4.0;
    target.x = !mascot.on ? 0 : wide ? -1.35 : -0.72;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const distH = (fitH / 2) / Math.tan(vFov / 2);
    const distW = (fitW / 2) / (Math.tan(vFov / 2) * camera.aspect);
    const d = Math.max(distH, distW);
    camera.position.set(target.x, target.y + d * 0.2, d);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    needs = true;
  }

  /* ---------- Interaction: drag to rotate, gentle idle spin ---------- */
  let rotY = -0.35, vel = 0, dragging = false, lastX = 0, lastT = performance.now();
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y pinch-zoom';
  el.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; vel = 0; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
  el.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; rotY += dx * 0.01; vel = dx * 0.01; needs = true; });
  const end = () => { if (!dragging) return; dragging = false; el.style.cursor = 'grab'; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  el.style.cursor = 'grab';

  /* ---------- Flavour / topping / size state ---------- */
  const teaColor = L(0xa47a4e), teaTarget = L(0xa47a4e);
  const NUM = ['trans', 'att', 'glow', 'rough', 'deep', 'speck', 'speckDark', 'grad', 'thick', 'ior', 'coat', 'gloss', 'sigma', 'tint', 'milky', 'cream', 'bubbles', 'sheen'];
  const P = Object.assign({}, FLAVORS.lait.nature), PT = Object.assign({}, P);
  const SETS = { tapioca, multifruit: popping, haricot: beans, gelee: jellies };
  const GLOSSY = [[tapioca, 0.16, 1, 1.25], [popping, 0.05, 1, 1.6], [beans, 0.42, 0.35, 1]];   // [set, roughness, clearcoat, env] when fully glossy
  let topNow = 'tapioca';
  tapioca.setOn(true, 0, true);                         // already settled when the page opens
  let scaleNow = 1, scaleTarget = 1;
  let pulse = 0, pulseV = 0;                            // settle spring on the whole cup
  function react(k) {                                   // k = strength; every selection calls this once
    if (reduceMotion) return;
    pulseV = Math.max(-0.3, Math.min(0.3, pulseV + 0.16 * k));
    mascot.nodV = Math.max(-1.2, Math.min(1.2, mascot.nodV + 0.9 * k));
    if (!dragging && Math.abs(vel) < 0.01) vel += (Math.random() < 0.5 ? -1 : 1) * 0.005 * k;
    needs = true;
  }

  /* ---------- Slosh: damped spring on the surface tilt ---------- */
  const sTilt = new THREE.Vector2(), tiltV = new THREE.Vector2();
  function slosh(a) { if (reduceMotion) return; const ang = rand() * Math.PI * 2; tiltV.x += Math.cos(ang) * a; tiltV.y += Math.sin(ang) * a; }
  let prevVel = 0;

  function applyFlavor(f, milk) {
    teaTarget.set(f.hex);
    NUM.forEach(k => { PT[k] = f[k]; });
    const fruit = !milk;
    if (fruit !== !!teaMat.userData.fruit) {
      teaMat.userData.fruit = fruit;
      liqU.uMilk.value = fruit ? 0 : 1; veilU.uMilk.value = fruit ? 0 : 1;
      ice.setOn(fruit, performance.now() + (fruit ? 150 : 0));
    }
    paramsDirty = true; slosh(0.04); react(1); needs = true;
  }
  let cur = 'lait:nature';

  window.mryeCup = {
    flavors: FLAVORS,
    setFlavor(base, id) { const id2 = base + ':' + id, f = FLAVORS[base] && FLAVORS[base][id]; if (!f || id2 === cur) return; cur = id2; applyFlavor(f, base === 'lait'); },
    // kept for the site: any hex colour, milk or fruit
    setTea(hex, milk) { cur = ''; applyFlavor(Object.assign({}, DEF, milk === false ? FRUIT_DEF : {}, { hex }), milk !== false); },
    setTopping(top) {
      if (top === topNow || !SETS[top]) return;
      const now = performance.now();
      SETS[topNow].setOn(false, now); SETS[top].setOn(true, now + 120);
      topNow = top; needs = true; slosh(0.09); react(0.8);
    },
    setMascot(on) { mascot.on = !!on; resize(); needs = true; },
    setSize(sz) { const t = sz === 'M' ? 0.88 : 1; if (t === scaleTarget) return; slosh(0.06); react(1.4); scaleTarget = t; needs = true; },
  };

  /* ---------- Robustness ---------- */
  el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); host.classList.remove('is-3d'); }, false);
  el.addEventListener('webglcontextrestored', () => { host.classList.add('is-3d'); paramsDirty = true; needs = true; }, false);
  // Build every topping and compile its shader once, shortly after load, so the first click never hitches.
  const idle = window.requestIdleCallback ? (fn) => window.requestIdleCallback(fn, { timeout: 2500 }) : (fn) => setTimeout(fn, 400);
  const warm = [popping, beans, jellies, ice];
  const warmStep = (i) => {
    try {
      if (i < warm.length) { warm[i].ensure(); idle(() => warmStep(i + 1)); }
      else { renderer.compile(scene, camera); needs = true; }
    } catch (err) { /* non-fatal: toppings then build on first use */ }
  };
  setTimeout(() => idle(() => warmStep(0)), 900);

  /* ---------- Loop (paused off-screen) ---------- */
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0] ? es[0].isIntersecting : true; }).observe(host);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize, { passive: true });
  resize();

  function frame(now) {
    requestAnimationFrame(frame);
    const lastT0 = lastT;
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (!visible) return;
    const raw = (now - lastT0) / 1000;
    if (raw > 0 && raw < 0.25) {
      emaDt += (raw - emaDt) * 0.05;
      slowFrames = emaDt > 0.034 && pr > 1 ? slowFrames + 1 : 0;
      if (slowFrames > 90) { pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); resize(); slowFrames = 0; emaDt = 0.02; }
    }
    let busy = false;
    if (!dragging) {
      if (Math.abs(vel) > 0.0005) { rotY += vel * dt * 60; vel *= Math.pow(0.94, dt * 60); busy = true; }
      else if (!reduceMotion) { rotY += dt * 0.18; busy = true; }
    }
    if (!teaColor.equals(teaTarget)) {
      teaColor.lerp(teaTarget, reduceMotion ? 1 : Math.min(1, dt * 7));
      if (Math.abs(teaColor.r - teaTarget.r) + Math.abs(teaColor.g - teaTarget.g) + Math.abs(teaColor.b - teaTarget.b) < 0.004) teaColor.copy(teaTarget);
      teaMat.color.copy(teaColor); teaMat.attenuationColor.copy(teaColor); teaMat.emissive.copy(teaColor); busy = true;
    }
    if (paramsDirty) {
      const kk = reduceMotion ? 1 : Math.min(1, dt * 6);
      let moving = false;
      for (const key of NUM) { const d = PT[key] - P[key]; if (Math.abs(d) > 0.002) { P[key] += d * kk; moving = true; } else P[key] = PT[key]; }
      teaMat.transmission = P.trans; teaMat.attenuationDistance = P.att; teaMat.roughness = P.rough; teaMat.thickness = P.thick; teaMat.ior = P.ior; teaMat.clearcoat = P.coat;
      teaMat.emissiveIntensity = P.glow * (1 + 0.9 * isDark);
      for (const [S, r0, cc0, env0] of GLOSSY) for (const m of [S.mat]) if (m) {
        m.roughness = r0 + (1 - P.gloss) * 0.38; m.clearcoat = cc0 * (0.12 + 0.88 * P.gloss); m.envMapIntensity = env0 * (0.45 + 0.55 * P.gloss); }
      veilU.uSigma.value = P.sigma; veilU.uTint.value = P.tint;
      teaMat.sheen = P.sheen; liqU.uMilky.value = P.milky; liqU.uCream.value = P.cream; liqU.uBubbles.value = P.bubbles;
      liqU.uDeep.value = P.deep; liqU.uSpeck.value = P.speck; liqU.uSpeckDark.value = P.speckDark; liqU.uGrad.value = P.grad;
      paramsDirty = moving; busy = true;
    }
    liqU.uTime.value = reduceMotion ? 3.0 : now / 1000;
    updateBear(now, dt);
    for (const k in SETS) busy = SETS[k].update(now) || busy;
    busy = ice.update(now) || busy;
    if (Math.abs(scaleNow - scaleTarget) > 0.0005) { scaleNow += (scaleTarget - scaleNow) * (reduceMotion ? 1 : Math.min(1, dt * 6)); busy = true; }
    if (Math.abs(pulse) > 0.0002 || Math.abs(pulseV) > 0.0002) { pulseV += (-90 * pulse - 9 * pulseV) * dt; pulse += pulseV * dt; pulse = Math.max(-0.03, Math.min(0.03, pulse)); busy = true; } else { pulse = 0; pulseV = 0; }
    const sNow = scaleNow * (1 + pulse);
    cup.scale.setScalar(sNow);
    shadow.scale.setScalar(sNow * (1 - pulse * 2.5));       // the shadow follows the cup size and tightens when the cup 'lifts'
    // drag acceleration kicks the liquid sideways
    const acc = (vel - prevVel); prevVel = vel;
    if (!reduceMotion && Math.abs(acc) > 0.002) tiltV.x += acc * 0.6;
    tiltV.addScaledVector(sTilt, -38 * dt); tiltV.multiplyScalar(Math.exp(-3.2 * dt)); sTilt.addScaledVector(tiltV, dt * 6);
    if (sTilt.length() > 0.1) sTilt.setLength(0.1);
    if (sTilt.lengthSq() + tiltV.lengthSq() > 1e-7) busy = true; else { sTilt.set(0, 0); tiltV.set(0, 0); }
    const ca = Math.cos(-rotY), sa = Math.sin(-rotY);
    liqU.uTilt.value.set(sTilt.x * ca - sTilt.y * sa, sTilt.x * sa + sTilt.y * ca);
    veilU.uMilkCol.value.copy(teaColor).multiplyScalar(liqU.uMilk.value > 0.5 ? 0.92 : 0.6);
    cup.rotation.y = rotY;
    cup.updateMatrixWorld();
    veilU.uCupInv.value.copy(cup.matrixWorld).invert();
    if (busy || needs || dragging) { renderer.render(scene, camera); needs = false; }
  }
  requestAnimationFrame(frame);
  host.classList.add('is-3d');
})();
