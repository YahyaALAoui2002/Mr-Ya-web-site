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
    if (mascot.onReact) mascot.onReact(k);
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
    bear: bearApi,                                      // the rig: bear.play('wave'|'cheer'|'nod'|'tilt'), bear.setWire(bool), bear.setBones(bool), bear.rig (THREE.Bone nodes), bear.clips
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


