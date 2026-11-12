// Different ways to make the room look better (for trying out: ?fx=a, b, c, full, d).
//   a    soft & warm: filmic colours, sharper softer shadows, warm fill lights, real sunlight through the window with a light beam and dust
//   b    glow: a + glow on lamps and bright things, a soft dark edge and a little colour grading
//   c    detailed: a + wooden floor, wallpaper, rug weave, baseboards, crown moulding, curtains, soft contact shadows under things
//   full everything together
//   d    diorama: full + a tilt-shift blur like a miniature
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function applyLook(mode, ctx) {
  const { THREE, renderer, scene, camera, hemi, sun, lamp, G, decorGroups } = ctx;
  if (!mode || mode === 'base') return null;
  const on = {
    a: mode !== 'base',
    glow: ['b', 'full', 'd'].includes(mode),
    detail: ['c', 'full', 'd'].includes(mode),
    tilt: mode === 'd',
  };
  const hourParam = new URLSearchParams(location.search).get('hour');
  const hourNow = () => (hourParam !== null ? Number(hourParam) : new Date().getHours() + new Date().getMinutes() / 60);

  // --- colours and shadows
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  hemi.color.set(0xfff0e0);
  hemi.groundColor.set(0xb88f6c);
  sun.color.set(0xffe2c0);
  lamp.color.set(0xffa860);
  // a little bounce light from the floor and a cool fill from the window side, so the shadows are not black
  const bounce = new THREE.PointLight(0xffc89a, 2.2, 14, 1.4);
  bounce.position.set(3.4, 0.9, -2.4); // far from where Pip stands, so he does not glow
  const cool = new THREE.PointLight(0xbcd4ff, 1.6, 16, 1.6);
  cool.position.set(0.3, 3.4, -3.8);
  scene.add(bounce, cool);

  // --- sunlight through the window: a spot light from outside, only the hole lets it in
  const winLight = new THREE.SpotLight(0xffe0b0, 3, 0, 0.13, 0.35, 0);
  winLight.position.set(5, 15, -17);
  winLight.target.position.set(0.3, 0, -1.8);
  winLight.castShadow = true;
  winLight.shadow.mapSize.set(2048, 2048);
  winLight.shadow.bias = -0.0003;
  winLight.shadow.normalBias = 0.02;
  winLight.shadow.camera.near = 8;
  winLight.shadow.camera.far = 40;
  scene.add(winLight, winLight.target);
  // a faint beam of light in the air, with dust in it
  const hole = [[-0.7, 2.0], [1.3, 2.0], [1.3, 3.8], [-0.7, 3.8]].map(([x, y]) => new THREE.Vector3(x + 0.0, y, -5.15));
  const dir = winLight.target.position.clone().sub(winLight.position).normalize();
  const floorPts = hole.map((p) => p.clone().addScaledVector(dir, p.y / -dir.y));
  const beamGeo = new THREE.BufferGeometry();
  const pos = [];
  const col = [];
  const quad = (a, b, c, d) => { for (const p of [a, b, c, a, c, d]) pos.push(p.x, p.y, p.z); };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(hole[i], hole[j], floorPts[j], floorPts[i]);
  }
  for (let i = 0; i < pos.length / 3; i++) {
    const y = pos[i * 3 + 1];
    const k = clamp(y / 3.8, 0, 1) * 0.9 + 0.08; // brighter near the window, fading toward the floor
    col.push(k, k * 0.9, k * 0.7);
  }
  beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  beamGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const beamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.renderOrder = 5;
  scene.add(beam);
  const dustN = 90;
  const dustPos = new Float32Array(dustN * 3);
  const dustSeed = Array.from({ length: dustN }, () => [Math.random(), Math.random(), Math.random() * 6]);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dustTex, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  dust.renderOrder = 6;
  scene.add(dust);

  // --- details: textures, trim, curtains, soft shadows
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  const byHex = (hex) => { const out = []; scene.traverse((o) => { if (o.isMesh && o.material?.color && o.geometry?.type === 'BoxGeometry' && o.material.color.getHex() === hex) out.push(o); }); return out; };
  const blobs = new Map();
  const aoTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(40,20,10,0.55)'); r.addColorStop(0.6, 'rgba(40,20,10,0.22)'); r.addColorStop(1, 'rgba(40,20,10,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  aoTex.wrapS = aoTex.wrapT = THREE.ClampToEdgeWrapping;
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const box3 = new THREE.Box3();
  const size = new THREE.Vector3();
  const ctr = new THREE.Vector3();
  function syncBlobs() {
    const groups = [...Object.values(G), ...decorGroups.values()];
    for (const g of groups) {
      if (!g.visible || g.scale.x < 0.5) continue;
      let b = blobs.get(g);
      if (!b) {
        b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), aoMat);
        b.rotation.x = -Math.PI / 2;
        b.renderOrder = 1;
        scene.add(b);
        blobs.set(g, b);
      }
      box3.setFromObject(g);
      if (box3.isEmpty() || box3.min.y > 1.2) { b.visible = false; continue; } // wall things and things on shelves have no floor shadow
      box3.getSize(size);
      box3.getCenter(ctr);
      b.visible = true;
      b.position.set(ctr.x, 0.012, ctr.z);
      b.scale.set(size.x * 1.35 + 0.15, size.z * 1.35 + 0.15, 1);
    }
    for (const [g, b] of blobs) if (!g.parent) { scene.remove(b); blobs.delete(g); }
  }
  if (on.detail) {
    const [floor] = byHex(0xd9b48a);
    if (floor) {
      floor.material.map = canvasTex(512, 512, (g, w, h) => {
        const rows = 14;
        const ph = h / rows;
        for (let r = 0; r < rows; r++) {
          let x = -((r * 97) % 160);
          while (x < w) {
            const len = 260 + ((x * 13 + r * 71) % 200);
            const sh = 216 + ((r * 31 + x * 7) % 18) - 9;
            g.fillStyle = `rgb(${sh},${sh - 38},${sh - 78})`;
            g.fillRect(x, r * ph, len, ph - 1);
            for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(110,70,40,${0.05 + ((k * 13 + r) % 5) * 0.015})`; g.beginPath(); const yy = r * ph + 3 + k * (ph / 7); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + 2, x + len * 0.6, yy - 2, x + len, yy); g.stroke(); }
            g.fillStyle = 'rgba(70,40,20,0.22)';
            g.fillRect(x + len - 1, r * ph, 1.5, ph);
            x += len;
          }
          g.fillStyle = 'rgba(70,40,20,0.3)';
          g.fillRect(0, r * ph + ph - 1, w, 1.4);
        }
      });
      floor.material.map.repeat.set(4, 5);
      floor.material.color.set(0xffffff);
      floor.material.roughness = 0.55;
    }
    const paper = (tint) => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(230,200,170,0.38)'; g.fillRect(x, 0, 32, h); }
      for (let y = 20; y < h; y += 48) for (let x = 16; x < w; x += 64) { g.fillStyle = 'rgba(205,160,130,0.28)'; g.beginPath(); g.arc(x + 16, y, 3.2, 0, 7); g.fill(); g.fillRect(x + 15, y + 4, 2, 7); }
    });
    for (const [hex, tex] of [[0xf3d9c4, paper()], [0xefcfb6, paper()]]) {
      for (const w of byHex(hex)) {
        const p = w.geometry.parameters;
        const t = tex.clone();
        t.needsUpdate = true;
        const big = Math.max(p.width, p.depth);
        t.repeat.set(big / 1.6, p.height / 1.6);
        w.material.map = t;
      }
    }
    const trim = (w, h, d, x, y, z, hex = 0xfaf3ea) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6 })); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
    trim(10, 0.22, 0.05, 0.15, 0.11, -4.97); // baseboards
    trim(0.05, 0.22, 10, -4.97, 0.11, 0);
    trim(10, 0.13, 0.09, 0.15, 4.93, -4.95); // crown moulding
    trim(0.09, 0.13, 10, -4.95, 4.93, 0);
    trim(10, 0.05, 0.04, 0.15, 1.1, -4.98, 0xf0e2d2); // a chair rail
    trim(0.04, 0.05, 10, -4.98, 1.1, 0, 0xf0e2d2);
    // curtains: pleated panels either side of the window, and a rod
    const cm = [new THREE.MeshStandardMaterial({ color: 0xc66a4c, roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: 0xb35a40, roughness: 0.95 })];
    for (const [x0, dirx] of [[-0.78, -1], [1.38, 1]]) {
      for (let i = 0; i < 3; i++) { // drawn to the side and held back, so they stay clear of the furniture next to the window
        const fold = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.15, 0.07), cm[i % 2]);
        fold.position.set(x0 + dirx * (0.045 + i * 0.065), 3.1, -4.86 + (i % 2) * 0.04);
        fold.castShadow = true;
        scene.add(fold);
      }
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.9, 10), new THREE.MeshStandardMaterial({ color: 0x5a3b24, roughness: 0.5, metalness: 0.2 }));
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0.3, 4.2, -4.84); // as wide as the window and its curtains
    scene.add(rod);
    for (const x of [-1.15, 1.75]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), rod.material); f.position.set(x, 4.2, -4.84); scene.add(f); }
    // soft darkening where the walls meet the floor and the ceiling
    const edge = (w, h, x, y, z, ry, flip) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex(4, 64, (g, ww, hh) => { const gr = g.createLinearGradient(0, flip ? 0 : hh, 0, flip ? hh : 0); gr.addColorStop(0, 'rgba(60,30,15,0.3)'); gr.addColorStop(1, 'rgba(60,30,15,0)'); g.fillStyle = gr; g.fillRect(0, 0, ww, hh); }), transparent: true, depthWrite: false }));
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.renderOrder = 1;
      scene.add(m);
    };
    edge(10, 1.0, 0.15, 0.55, -4.94, 0, false);
    edge(10, 1.0, -4.94, 0.55, 0, Math.PI / 2, false);
    edge(10, 0.7, 0.15, 4.62, -4.94, 0, true);
    edge(10, 0.7, -4.94, 4.62, 0, Math.PI / 2, true);
    // the rug gets a woven look
    const rug = G.rug?.children[0];
    if (rug) {
      rug.material.map = canvasTex(256, 256, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); for (let r = 120; r > 0; r -= 14) { g.strokeStyle = r % 28 === 0 ? 'rgba(160,70,50,0.35)' : 'rgba(255,240,225,0.5)'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, w / 2, r, 0, 7); g.stroke(); } for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,60,40,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 1); } });
      rug.material.map.wrapS = rug.material.map.wrapT = THREE.ClampToEdgeWrapping;
      rug.material.roughness = 1;
    }
  }

  // --- post-processing
  // Weak phones get a lighter look by themselves: first the glow and grading go, then the window light's shadow, dust and beam.
  // It starts lighter on devices that say they are small, and steps down further if the page runs slower than about 30 frames a second.
  let stage = 0;
  const weak = new URLSearchParams(location.search).has('weak') || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || (/Android|iPhone|iPad/i.test(navigator.userAgent) && Math.min(screen.width, screen.height) < 500);
  let composer = null;
  let grade = null;
  const size2 = new THREE.Vector2();
  if (on.glow || on.tilt) {
    renderer.getSize(size2);
    const target = new THREE.WebGLRenderTarget(size2.x, size2.y, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true, depthBuffer: true });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    if (on.glow) composer.addPass(new UnrealBloomPass(new THREE.Vector2(size2.x, size2.y), 0.28, 0.5, 1.3));
    composer.addPass(new OutputPass());
    const gradeShader = {
      uniforms: { tDiffuse: { value: null }, vig: { value: 0.07 }, sat: { value: on.tilt ? 1.22 : 1.07 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float vig; uniform float sat; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          float l = dot(c.rgb, vec3(0.299,0.587,0.114)); c.rgb = mix(vec3(l), c.rgb, sat);
          c.rgb = mix(c.rgb, c.rgb*c.rgb*(3.0-2.0*c.rgb), 0.18);
          c.rgb *= vec3(1.03, 1.0, 0.96);
          float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - vig * smoothstep(0.35, 0.85, d);
          gl_FragColor = c; }`,
    };
    grade = new ShaderPass(gradeShader);
    if (on.tilt) {
      const tilt = (dirv) => new ShaderPass({
        uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(...dirv) }, res: { value: new THREE.Vector2(size2.x, size2.y) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 dir; uniform vec2 res; varying vec2 vUv;
          void main(){ float band = smoothstep(0.16, 0.5, abs(vUv.y - 0.52)); vec2 px = dir * band * 5.0 / res; vec4 c = texture2D(tDiffuse, vUv) * 0.2270;
            c += texture2D(tDiffuse, vUv + px*1.0) * 0.3162; c += texture2D(tDiffuse, vUv - px*1.0) * 0.3162;
            c += texture2D(tDiffuse, vUv + px*2.4) * 0.0703; c += texture2D(tDiffuse, vUv - px*2.4) * 0.0703;
            gl_FragColor = c; }`,
      });
      composer.addPass(tilt([1, 0]));
      composer.addPass(tilt([0, 1]));
    }
    composer.addPass(grade);
  }

  const bg0 = scene.background.clone();
  const nightBg = new THREE.Color(0x3a3248);
  const lerpColor = (out, a, b, k) => out.set(a).lerp(new THREE.Color(b), k);
  let t0 = performance.now();
  let frames = 0;
  let sum = 0;
  let lastNow = performance.now();
  function downgrade() {
    stage++;
    if (stage === 1) { composer = null; renderer.setRenderTarget(null); }
    if (stage === 2) {
      winLight.castShadow = false;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      beam.visible = dust.visible = false;
      noDust = true;
    }
  }
  let noDust = false;
  if (weak) downgrade();
  return {
    render() {
      const t = (performance.now() - t0) / 1000;
      // the window light follows the real sun: gone at night, warm at dawn and dusk, weaker in bad weather
      const h = hourNow();
      const day = clamp(Math.sin(((h - 6.3) / 14) * Math.PI), 0, 1);
      const bad = ctx.land?.state?.weather && ['rain', 'storm', 'fog', 'snow'].includes(ctx.land.state.weather) ? 0.3 : 1;
      const dusk = day < 0.4 ? 1 - day / 0.4 : 0; // low sun: redder
      const nightK = 1 - clamp(day * 4, 0, 1);
      // the whole room follows the time of day: bright and warm by day, dim and blue at night with the lamp doing the work
      hemi.intensity = 0.42 + 0.55 * day;
      lerpColor(hemi.color, 0x9fb0f0, 0xfff0e0, 1 - nightK);
      lerpColor(hemi.groundColor, 0x5a4a6a, 0xb88f6c, 1 - nightK);
      sun.intensity = 0.28 + 1.02 * day;
      lerpColor(sun.color, 0x8fa6ff, dusk > 0.1 ? 0xffb48a : 0xffe2c0, 1 - nightK);
      lamp.intensity = 13 - 3 * day;
      bounce.intensity = 0.5 + 1.7 * day;
      cool.intensity = 0.7 + 1.1 * day;
      lerpColor(cool.color, 0x7f98ff, 0xbcd4ff, 1 - nightK);
      scene.background.copy(bg0).lerp(nightBg, nightK * 0.4);
      // sunlight by day, a little cool moonlight through the same window at night
      winLight.intensity = 3.2 * day * bad + 0.9 * nightK * bad;
      if (day > 0.05) winLight.color.setRGB(1, 0.72 + 0.26 * day - dusk * 0.12, 0.5 + 0.4 * day - dusk * 0.15);
      else winLight.color.setRGB(0.62, 0.72, 1);
      beam.visible = dust.visible = !noDust && day * bad > 0.08;
      beamMat.opacity = 0.08 * day * bad;
      dust.material.opacity = 0.9 * day * bad;
      for (let i = 0; i < dustN; i++) {
        const [a, b, s] = dustSeed[i];
        const k = (a + t * 0.012 * (0.5 + b)) % 1;
        const p = hole[0].clone().lerp(floorPts[2], 0.05 + k * 0.8);
        dustPos[i * 3] = p.x + (b - 0.5) * 1.6 + Math.sin(t * 0.4 + s) * 0.08;
        dustPos[i * 3 + 1] = p.y + (a - 0.5) * 1.2 + Math.cos(t * 0.5 + s) * 0.06;
        dustPos[i * 3 + 2] = p.z + (a - 0.5) * 0.6;
      }
      dustGeo.attributes.position.needsUpdate = true;
      if (on.detail) syncBlobs();
      if (noDust) winLight.intensity *= 0.9; // no shadow any more: keep only a little of it so it does not light the whole room
      const nowMs = performance.now();
      const dtMs = nowMs - lastNow;
      lastNow = nowMs;
      if (!document.hidden && dtMs < 250 && ++frames > 40) sum += dtMs; // the first frames and pauses do not count
      if (frames >= 130) {
        if (sum / 90 > 34 && stage < 2) downgrade();
        frames = 20;
        sum = 0;
      }
      if (composer) {
        renderer.getSize(size2);
        const pr = renderer.getPixelRatio();
        if (composer._w !== size2.x || composer._h !== size2.y || composer._p !== pr) {
          composer.setPixelRatio(pr);
          composer.setSize(size2.x, size2.y);
          Object.assign(composer, { _w: size2.x, _h: size2.y, _p: pr });
        }
        composer.render();
      } else renderer.render(scene, camera);
    },
  };
}
