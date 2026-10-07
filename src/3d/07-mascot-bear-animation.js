  /* ---------- Mascot: animation. Clips on the bone rig (THREE.AnimationMixer) + live layers on top (look-at, nod spring, blink) ----------
     Clips (all authored procedurally from the rest pose, 24 keys per second): idle (breathing, loops), wave, cheer, nod, tilt. A one-shot
     clip is blended over idle with a weight envelope, so every clip starts and ends on the idle pose. The Head node is NOT animated by
     clips: it is driven live (pointer look-at + nod spring), so the bear keeps looking at the visitor while it waves. */
  const mascot = { on: true, ready: true, autoplay: true, blink: true, baseYaw: -0.5, head: rig.Head, nod: 0, nodV: 0, yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, finish() {} };      // ready: the plush is built at load (no slow marching step any more)
  const bRestQ = {}; for (const n in rig) bRestQ[n] = rig[n].quaternion.clone();
  const bRestP = {}; for (const n in rig) bRestP[n] = rig[n].position.clone();
  const bEul = new THREE.Euler(), bQo = new THREE.Quaternion();
  const bLerp = (a, b, t) => a + (b - a) * t, bPI2 = Math.PI * 2;
  /* ch: { rot: {bone: t => [rx, ry, rz]} offsets on top of the rest pose (in the parent's axes), abs: {bone: t => [rx, ry, rz]} absolute euler (XYZ),
           pos: {bone: t => [dx, dy, dz]} offsets, scl: {bone: t => [sx, sy, sz]} } */
  function bClip(name, dur, ch, fps) {
    const N = Math.round(dur * (fps || 24)), times = new Float32Array(N + 1), tracks = []; for (let i = 0; i <= N; i++) times[i] = i / N * dur;
    const quat = (bone, fn, abs) => {
      const v = new Float32Array((N + 1) * 4);
      for (let i = 0; i <= N; i++) { const o = fn(times[i]); bEul.set(o[0], o[1], o[2]); bQo.setFromEuler(bEul); if (!abs) bQo.multiply(bRestQ[bone]); bQo.toArray(v, i * 4); }
      tracks.push(new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, v));
    };
    const vec3 = (bone, prop, fn, rest) => {
      const v = new Float32Array((N + 1) * 3);
      for (let i = 0; i <= N; i++) { const o = fn(times[i]); v[i * 3] = (rest ? rest.x : 0) + o[0]; v[i * 3 + 1] = (rest ? rest.y : 0) + o[1]; v[i * 3 + 2] = (rest ? rest.z : 0) + o[2]; }
      tracks.push(new THREE.VectorKeyframeTrack(bone + '.' + prop, times, v));
    };
    for (const b in ch.rot || {}) quat(b, ch.rot[b], false);
    for (const b in ch.abs || {}) quat(b, ch.abs[b], true);
    for (const b in ch.pos || {}) vec3(b, 'position', ch.pos[b], bRestP[b]);
    for (const b in ch.scl || {}) vec3(b, 'scale', ch.scl[b], null);
    return new THREE.AnimationClip(name, dur, tracks);
  }
  const BW = bPI2 / 6;                                                                        // idle: 6 s loop, two breaths
  const bIdle = bClip('idle', 6, {
    rot: {
      spine: (t) => [0.02 * Math.sin(2 * BW * t + 0.4), 0, 0.016 * Math.sin(BW * t)],
      neck: (t) => [0.03 * Math.sin(2 * BW * t + 1.0), 0.07 * Math.sin(BW * t), 0.045 * Math.sin(BW * t + 0.5)],
      earL: (t) => [0, 0, 0.04 * Math.sin(2 * BW * t)], earR: (t) => [0, 0, -0.04 * Math.sin(2 * BW * t + 0.6)],
      shoulderL: (t) => [0.012 * Math.sin(2 * BW * t), 0, 0.035 * Math.sin(2 * BW * t + 1.0)], shoulderR: (t) => [0.012 * Math.sin(2 * BW * t + 0.5), 0, -0.035 * Math.sin(2 * BW * t + 1.4)],
    },
  });
  THREE.AnimationUtils.makeClipAdditive(bIdle, 0, bIdle);                                     // offsets from its first frame: added on top of whatever else plays, so the body keeps breathing during a wave
  const bWave = bClip('wave', 2.8, {                                                         // the bear's right arm (viewer's left) goes up and waves, like the plush in the references
    abs: { shoulderR: (t) => {
      const up = bSstep(0, 0.55, t) * (1 - bSstep(2.25, 2.8, t)), osc = Math.sin((t - 0.55) * 13.8) * bSstep(0.4, 0.75, t) * (1 - bSstep(2.0, 2.3, t));
      return [bLerp(-0.3, 0.18, up) + 0.06 * osc, 0.1 * osc, bLerp(-0.17, -2.1, up) + 0.22 * osc]; } },
    rot: {
      spine: (t) => [0, 0, -0.05 * bSstep(0, 0.55, t) * (1 - bSstep(2.25, 2.8, t))],
      earR: (t) => [0, 0, 0.1 * Math.sin((t - 0.55) * 13.8) * bSstep(0.4, 0.75, t) * (1 - bSstep(2.0, 2.3, t))],
      earL: (t) => [0, 0, -0.08 * Math.sin((t - 0.55) * 13.8 + 1) * bSstep(0.4, 0.75, t) * (1 - bSstep(2.0, 2.3, t))],
    },
  });
  const bCheer = bClip('cheer', 1.6, {                                                       // both arms up, two bounces, ears flop
    abs: {
      shoulderL: (t) => { const e = bSstep(0, 0.35, t) * (1 - bSstep(1.2, 1.6, t)), f = Math.sin(t * 15) * e; return [bLerp(-0.3, 0.18, e), 0, bLerp(0.17, 2.1, e) + 0.18 * f]; },
      shoulderR: (t) => { const e = bSstep(0, 0.35, t) * (1 - bSstep(1.2, 1.6, t)), f = Math.sin(t * 15 + 0.8) * e; return [bLerp(-0.3, 0.18, e), 0, bLerp(-0.17, -2.1, e) + 0.18 * f]; },
    },
    pos: { hips: (t) => [0, 0.24 * Math.abs(Math.sin(t * Math.PI * 2.5)) * bSstep(0, 0.2, t) * (1 - bSstep(1.3, 1.6, t)), 0] },
    rot: {
      earL: (t) => [0, 0, 0.14 * Math.sin(t * 15) * bSstep(0, 0.3, t) * (1 - bSstep(1.2, 1.6, t))], earR: (t) => [0, 0, -0.14 * Math.sin(t * 15 + 0.7) * bSstep(0, 0.3, t) * (1 - bSstep(1.2, 1.6, t))],
      hipL: (t) => [0.04 * Math.sin(t * 15) * bSstep(0, 0.3, t) * (1 - bSstep(1.2, 1.6, t)), 0, 0], hipR: (t) => [-0.04 * Math.sin(t * 15) * bSstep(0, 0.3, t) * (1 - bSstep(1.2, 1.6, t)), 0, 0],
    },
  });
  const bNod = bClip('nod', 0.9, { rot: { neck: (t) => [0.3 * Math.sin(bPI2 * 1.5 * t / 0.9) * (1 - t / 0.9), 0, 0], spine: (t) => [0.04 * Math.sin(bPI2 * 1.5 * t / 0.9) * (1 - t / 0.9), 0, 0] } });
  const bTilt = bClip('tilt', 2.0, {                                                         // a curious head tilt, one ear up
    rot: {
      neck: (t) => { const b = Math.pow(Math.sin(Math.PI * t / 2.0), 2); return [-0.04 * b, 0.12 * b, 0.26 * b]; },
      earL: (t) => [0, 0, 0.22 * Math.pow(Math.sin(Math.PI * t / 2.0), 2)], earR: (t) => [0, 0, 0.08 * Math.pow(Math.sin(Math.PI * t / 2.0), 2)],
    },
  });
  const mixer = new THREE.AnimationMixer(bear), bAnim = { clips: {}, act: {}, cur: null, t: 0, count: 0, lastCheer: -1e9 };
  for (const c of [bIdle, bWave, bCheer, bNod, bTilt]) {
    bAnim.clips[c.name] = c; const a = mixer.clipAction(c); a.play(); bAnim.act[c.name] = a;
    if (c.name !== 'idle') { a.paused = true; a.weight = 0; a.time = 0; }                   // one-shots: I set their time and weight myself, so they blend into the pose and end on the idle pose
    else a.blendMode = THREE.AdditiveAnimationBlendMode;
  }
  function bApply(dt) {                                                                       // advance the overlay clip (if any) and the mixer by dt
    for (const n in bAnim.act) if (n !== 'idle' && n !== bAnim.cur) bAnim.act[n].weight = 0;      // an interrupted clip must never leave weight behind (it would freeze half a pose into the bear)
    if (bAnim.cur) {
      const c = bAnim.clips[bAnim.cur], a = bAnim.act[bAnim.cur], T = c.duration;
      bAnim.t += dt;
      const env = bSstep(0, 0.22, bAnim.t) * (1 - bSstep(T - 0.28, T, bAnim.t));
      a.time = Math.min(bAnim.t, T - 1e-3); a.weight = env;
      if (bAnim.t >= T) { a.weight = 0; bAnim.cur = null; }
    }
    mixer.update(dt);
  }
  /* ---- the public handle: window.mryeCup.bear ---- */
  const bSkel = new THREE.SkeletonHelper(rig.root); bSkel.visible = false; bSkel.renderOrder = 10; scene.add(bSkel); let bSkelWanted = false;
  function bSetWire(on) {                                                                     // grey clay + the QUAD edges of every piece (the topology of the reference wireframes)
    for (const b of bearMeshes) {
      if (b.noWire) continue;
      b.mesh.material = on ? clayMat : b.mat;
      if (on && !b.wire) {
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', b.mesh.geometry.attributes.position); lg.setIndex(new THREE.BufferAttribute(b.mesh.geometry.userData.lines, 1));
        b.wire = new THREE.LineSegments(lg, wireMat); b.wire.name = b.mesh.name + '-quads'; b.wire.frustumCulled = false; b.mesh.add(b.wire);
      }
      if (b.wire) b.wire.visible = on;
    }
    needs = true;
  }
  const bResetRig = () => { for (const n in rig) { rig[n].quaternion.copy(bRestQ[n]); rig[n].position.copy(bRestP[n]); rig[n].scale.set(1, 1, 1); } };
  const bearApi = {
    rig, mixer, clips: Object.keys(bAnim.clips).filter((n) => n !== 'idle'),
    play(name) {
      if (reduceMotion || !mascot.on || !bAnim.clips[name] || name === 'idle' || bAnim.cur === name) return false;
      for (const n in bAnim.act) if (n !== 'idle') bAnim.act[n].weight = 0;
      bAnim.cur = name; bAnim.t = 0; bAnim.count++; needs = true;
      bBlink.fidget = performance.now() + 22000 + rand() * 18000;                              // the next idle fidget is counted from NOW, whoever started this clip
      return true;
    },
    pose(name, t) {                                                                           // jump to time t of a clip (tests, screenshots): the pose is applied at once, from the idle pose at time 0
      for (const n in bAnim.act) if (n !== 'idle') bAnim.act[n].weight = 0;
      bAnim.act.idle.time = 0;
      if (!bAnim.clips[name] || name === 'idle') { bAnim.cur = null; bResetRig(); mixer.update(0); needs = true; return; }
      bAnim.cur = name; bAnim.t = Math.max(0, t) - 1e-6; bApply(1e-6); needs = true;
    },
    setWire: bSetWire, setBones(on) { bSkelWanted = !!on; bSkel.visible = bSkelWanted && mascot.on; needs = true; },
    get playing() { return bAnim.cur; },
  };
  mascot.onReact = (k) => {                                                                   // every selection nods (spring, in slice 08); a big change (size) also cheers, at most once in a while
    const now = performance.now();
    if (!mascot.on || bAnim.cur || reduceMotion) return;
    bBlink.fidget = Math.max(bBlink.fidget, now + 12000);
    if (k >= 1.3 && now - bAnim.lastCheer > 20000) { bAnim.lastCheer = now; bearApi.play('cheer'); }
  };

  const bearShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  bearShadow.rotation.x = -Math.PI / 2; scene.add(bearShadow);
  function updateHead(pitch, yaw, roll) { rig.Head.rotation.set(pitch, yaw, roll); }          // the Head node is driven live, never by a clip
  function layoutBear(wide) {
    bear.visible = bearShadow.visible = mascot.on; bSkel.visible = bSkelWanted && mascot.on;
    mascot.baseYaw = wide ? -0.5 : -0.4;
    if (wide) { bear.position.set(-2.7, 0, 0.1); bear.scale.setScalar(0.66); bear.rotation.y = 0.62; }
    else { bear.position.set(-1.68, 0, 0.95); bear.scale.setScalar(0.46); bear.rotation.y = 0.5; }
    bearShadow.position.set(bear.position.x + 0.1, 0.001, bear.position.z + 0.45 * bear.scale.x); bearShadow.scale.set(bear.scale.x * 1.05, bear.scale.x * 0.9, 1);
    updateHead(0.04, mascot.baseYaw, 0.07);
  }
  let bBlink = { next: 2200, t: -1, fidget: 1e12 };                                           // fidget: set by play(), so it always counts from the last clip
  function updateBear(now, dt) {
    if (!mascot.on || reduceMotion) return;
    const t = now / 1000;
    if (mascot.autoplay && !bAnim.cur && bAnim.count === 0 && now > 2200) bearApi.play('wave');                       // a greeting, once
    else if (mascot.autoplay && !bAnim.cur && bAnim.count > 0 && now > bBlink.fidget) bearApi.play(rand() < 0.5 ? 'tilt' : 'nod');
    bApply(dt);
    const br = Math.sin(2 * BW * t), bx = 1 + 0.016 * br, by = 1 + 0.026 * br;                                       // breathing: the chest swells (the apron with it); neck and shoulders are counter-scaled so the head and arms move but do not squash
    rig.spine.scale.set(bx, by, bx); for (const n of ['neck', 'shoulderL', 'shoulderR']) rig[n].scale.set(1 / bx, 1 / by, 1 / bx);
    mascot.yaw += (mascot.tYaw - mascot.yaw) * Math.min(1, dt * 4); mascot.pitch += (mascot.tPitch - mascot.pitch) * Math.min(1, dt * 4);
    mascot.nodV += (-60 * mascot.nod - 7 * mascot.nodV) * dt; mascot.nod += mascot.nodV * dt;       // a nod on every selection
    updateHead(0.04 + mascot.pitch + mascot.nod, mascot.baseYaw + mascot.yaw * 0.8, 0.07 + 0.012 * Math.sin(t * 1.1));
    if (!mascot.blink) { bBlink.t = -1; eyes.scale.y = 1; }
    else if (bBlink.t < 0 && now > bBlink.next) bBlink.t = 0;                                       // blink: the eyes squash for ~150 ms every 2.5-6 s
    if (bBlink.t >= 0) { bBlink.t += dt; const p = bBlink.t / 0.15; eyes.scale.y = p >= 1 ? 1 : 1 - 0.92 * Math.sin(Math.PI * p); if (p >= 1) { bBlink.t = -1; bBlink.next = now + 2500 + rand() * 3500; } }
  }
  window.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect(); if (!r.width) return;
    mascot.tYaw = Math.max(-0.5, Math.min(0.5, ((e.clientX - r.left) / r.width * 2 - 1) * 0.5)); mascot.tPitch = Math.max(-0.2, Math.min(0.2, ((e.clientY - r.top) / r.height * 2 - 1) * 0.2));      // pointer above the bear -> negative pitch -> the nose goes up
  }, { passive: true });
  /* click (or tap) the bear: it waves, then cheers, tilts, nods... (a drag still just turns the cup) */
  const bRay = new THREE.Raycaster(), bPtr = new THREE.Vector2(), bTapOrder = ['wave', 'cheer', 'tilt', 'nod']; let bDown = null, bTaps = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => { bDown = (e.button === 0 && e.isPrimary) ? [e.clientX, e.clientY] : null; });
  renderer.domElement.addEventListener('pointercancel', () => { bDown = null; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!bDown || !mascot.on || !e.isPrimary) return;
    const moved = Math.hypot(e.clientX - bDown[0], e.clientY - bDown[1]); bDown = null; if (moved > 6) return;
    const r = renderer.domElement.getBoundingClientRect(); bPtr.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    bRay.setFromCamera(bPtr, camera);
    if (bRay.intersectObjects(bearMeshes.map((b) => b.mesh), false).length && !reduceMotion) bearApi.play(bTapOrder[bTaps++ % bTapOrder.length]);
  });

