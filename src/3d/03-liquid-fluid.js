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

