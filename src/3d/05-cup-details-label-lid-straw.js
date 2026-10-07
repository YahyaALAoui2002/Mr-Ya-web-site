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

