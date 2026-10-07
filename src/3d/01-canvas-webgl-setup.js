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
  function buildEnv() {
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
    const prevEnv = scene.environment;
    scene.environment = pm.fromScene(env, 0.04).texture;
    pm.dispose();
    if (prevEnv) prevEnv.dispose();
  }
  buildEnv();
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

