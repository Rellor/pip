// What Pip sees through his window: a real 3D world behind the wall (sky, sun and moon, stars, clouds, hills, a garden, trees, a house, birds, weather).
// It is part of the same 3D scene as the room and only shows through the hole in the wall (a stencil mask), so when you or the camera move,
// the view outside changes with the perspective, like a real window. It follows the real time and weather. All of it is free for Pip: no tokens.
//
// Local coordinates: x along the wall, y up with 0 at the middle of the window, z negative = away from the room. The window is at z = 0.
// The ground is at GY (the room's floor is 2.9 m below the middle of the window, and a little thickness more).

import { PLACE, seasonInfo, fetchWeather, skyAim, aimVector } from './season.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const GY = -3.2;

// [hour, zenith, horizon, light colour, light strength, grass, hill]
const DAY = [
  [0, '#060b1d', '#17254a', '#6c7fc0', 0.35, '#12261f', '#16273a'],
  [5, '#0a1230', '#243a6a', '#6c7fc0', 0.35, '#14291f', '#18304a'],
  [6.5, '#3a4a86', '#f2a273', '#ffc9a0', 0.8, '#6d8a58', '#6f7f9a'],
  [8.5, '#5aa6ea', '#cfe6f7', '#fff4e0', 1.1, '#6fb07a', '#6ea0b0'],
  [13, '#4a98e4', '#cfe9fb', '#ffffff', 1.25, '#69b672', '#6a9fb4'],
  [17.5, '#5a86c8', '#f2d3a2', '#ffe2b8', 1.05, '#6aa56a', '#7a8fa8'],
  [19.5, '#3a4478', '#f08a62', '#ff9f78', 0.7, '#4a6a52', '#58607e'],
  [21, '#0a1230', '#243a6a', '#6c7fc0', 0.35, '#14291f', '#18304a'],
  [24, '#060b1d', '#17254a', '#6c7fc0', 0.35, '#12261f', '#16273a'],
];

export function createOutside(THREE) {
  const root = new THREE.Group(); // put this at the outer face of the wall, at the window's middle
  const C = (hex) => new THREE.Color(hex);

  // Everything here is only drawn where the mask (the hole in the wall) has been drawn.
  const inHole = (m) => {
    m.stencilWrite = true;
    m.stencilRef = 1;
    m.stencilFunc = THREE.EqualStencilFunc;
    m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp;
    return m;
  };
  const mask = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 1.8),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp })
  );
  mask.renderOrder = -100;

  // Things far away fade toward the colour of the horizon (haze), more so in fog. Each one remembers its own colour and distance.
  const hazed = [];
  const haze = (mat, hex, dist, stripe = false) => {
    hazed.push({ mat, base: C(hex), dist, stripe });
    mat.color.set(hex);
    return mat;
  };
  const basic = (hex, dist) => haze(inHole(new THREE.MeshBasicMaterial({ color: hex })), hex, dist);
  const lit = (hex, dist) => haze(inHole(new THREE.MeshLambertMaterial({ color: hex })), hex, dist);
  const add = (obj) => {
    root.add(obj);
    return obj;
  };

  // --- sky
  const skyMat = inHole(new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { zenith: { value: C('#4a98e4') }, horizon: { value: C('#cfe9fb') } },
    vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 zenith; uniform vec3 horizon; varying vec3 d; void main(){ float y = clamp(d.y * 1.6 + 0.05, 0.0, 1.0); gl_FragColor = linearToOutputTexel(vec4(mix(horizon, zenith, pow(y, 0.55)), 1.0)); }',
  }));
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), skyMat);
  sky.renderOrder = -10;
  add(sky);

  const canvasTex = (size, draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const sprite = (tex, w, h) => {
    const s = new THREE.Sprite(inHole(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })));
    s.scale.set(w, h, 1);
    return s;
  };

  // --- sun and moon (very far away: they do not shift when you move, like the real ones)
  const sunTex = canvasTex(256, (g, n) => {
    const r = g.createRadialGradient(n / 2, n / 2, 6, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(255,250,215,1)');
    r.addColorStop(0.16, 'rgba(255,244,190,1)');
    r.addColorStop(0.22, 'rgba(255,230,150,0.55)');
    r.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, n, n);
  });
  const sun = sprite(sunTex, 90, 90);
  add(sun);
  const moon = sprite(null, 40, 40);
  add(moon);
  const drawMoon = () => {
    const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000;
    const phase = (((days % 29.530588) + 29.530588) % 29.530588) / 29.530588; // 0 new, 0.5 full
    moon.material.map = canvasTex(256, (g, n) => {
      const glow = g.createRadialGradient(n / 2, n / 2, n * 0.2, n / 2, n / 2, n / 2);
      glow.addColorStop(0, 'rgba(255,245,200,0.5)');
      glow.addColorStop(1, 'rgba(255,245,200,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, n, n);
      const r = n * 0.24;
      g.fillStyle = '#fff1c2';
      g.beginPath();
      g.arc(n / 2, n / 2, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e2d5a8';
      for (const [x, y, s] of [[-0.35, -0.2, 0.18], [0.25, 0.1, 0.22], [-0.1, 0.4, 0.14], [0.4, -0.4, 0.1]]) {
        g.beginPath();
        g.arc(n / 2 + x * r, n / 2 + y * r, s * r, 0, Math.PI * 2);
        g.fill();
      }
      // the part in shadow: the unlit half is cut away, and an ellipse puts back the part of the other half that is lit
      const k = Math.cos(phase * 2 * Math.PI); // 1 new .. -1 full
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.arc(n / 2, n / 2, r + 1, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = 'rgba(0,0,0,0.93)';
      g.beginPath();
      if (phase < 0.5) g.rect(n / 2 - r - 2, n / 2 - r - 2, r + 2, r * 2 + 4);
      else g.rect(n / 2, n / 2 - r - 2, r + 2, r * 2 + 4);
      g.fill();
      if (k > 0) { // crescent: also cut the lit half back with an ellipse
        g.beginPath();
        g.ellipse(n / 2, n / 2, Math.abs(k) * r, r, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      if (k < 0) { // gibbous: put the lit part of the dark half back
        g.save();
        g.beginPath();
        g.arc(n / 2, n / 2, r, 0, Math.PI * 2);
        g.clip();
        g.fillStyle = '#fff1c2';
        g.beginPath();
        g.ellipse(n / 2, n / 2, Math.abs(k) * r, r, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    });
    moon.material.needsUpdate = true;
  };
  drawMoon();

  // --- stars
  const starPos = [];
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * 1.2 + 0.02;
    starPos.push(Math.sin(a) * Math.cos(e) * 600, Math.sin(e) * 600, -Math.abs(Math.cos(a)) * Math.cos(e) * 600);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starsA = new THREE.Points(starGeo, inHole(new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false })));
  const starsB = new THREE.Points(starGeo, inHole(new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.5, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false })));
  add(starsA);
  add(starsB);

  // --- clouds
  const cloudTex = canvasTex(256, (g, n) => {
    for (const [x, y, r] of [[0.3, 0.55, 0.2], [0.5, 0.45, 0.26], [0.7, 0.55, 0.2], [0.42, 0.6, 0.18], [0.6, 0.62, 0.17]]) {
      const grad = g.createRadialGradient(n * x, n * y, 0, n * x, n * y, n * r);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.6, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, n, n);
    }
  });
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const s = sprite(cloudTex, 160 + Math.random() * 120, 70 + Math.random() * 40);
    s.position.set(-380 + (i / 10) * 760 + Math.random() * 40, 40 + Math.random() * 90, -420 - Math.random() * 120);
    s.userData.speed = 1.5 + Math.random() * 2;
    clouds.push(s);
    add(s);
  }

  // --- land: ground, then hills far away, each layer hazier
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), basic('#69b672', 80));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GY, -780);
  add(ground);
  const noise = (x, seed) => Math.sin(x / 38 + seed) * 0.6 + Math.sin(x / 15 + seed * 2.1) * 0.3 + Math.sin(x / 7 + seed * 3.3) * 0.1;
  const ridge = (z, base, amp, seed, span, hex, dist) => {
    const shape = new THREE.Shape();
    shape.moveTo(-span, -60);
    for (let x = -span; x <= span; x += 8) shape.lineTo(x, base + (noise(x * (400 / Math.abs(z)), seed) * 0.5 + 0.5) * amp);
    shape.lineTo(span, -60);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), basic(hex, dist));
    m.position.z = z;
    add(m);
    return m;
  };
  const far = ridge(-560, GY, 150, 1.3, 900, '#6a9fb4', 560);
  const mid = ridge(-330, GY, 48, 4.1, 600, '#6ea08a', 330);
  const low = ridge(-170, GY, 15, 7.7, 400, '#6fa974', 170);

  // --- the garden: lawn, path, fence, bushes, flowers, trees, a neighbour's house
  const sway = [];
  const leaves = []; // every leaf bunch, with the moment (0 to 1) it falls in autumn and comes back in spring
  const trunkMat = (dist) => lit('#5a3b24', dist);
  const tree = (x, z, s, kind) => {
    const g = new THREE.Group();
    g.position.set(x, GY, z);
    g.scale.setScalar(s);
    const dist = Math.abs(z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.4, 6), lit('#5a3b24', dist));
    trunk.position.y = 1.2;
    g.add(trunk);
    const crown = new THREE.Group();
    crown.position.y = 2.2;
    if (kind === 'pine') {
      const m = lit('#2f7a4a', dist);
      [[1.7, 3.2, 0.6], [1.35, 2.8, 2.0], [0.95, 2.3, 3.3]].forEach(([r, h, y]) => {
        const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), m);
        c.position.y = y;
        crown.add(c);
      });
    } else {
      [[0, 1.6, 0, 1.5], [0.9, 1.2, 0.2, 1.0], [-0.9, 1.3, -0.1, 1.1], [0.1, 2.5, 0.2, 1.0]].forEach(([dx, dy, dz, r], i) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), lit('#4fa05a', dist));
        b.position.set(dx, dy, dz);
        crown.add(b);
        leaves.push({ mesh: b, entry: hazed[hazed.length - 1], at: Math.random(), shade: (Math.random() - 0.5) * 0.08, tree: kind });
      });
      // bare branches: they are there all year, the leaves hide them in summer
      for (let i = 0; i < 5; i++) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 1.9, 5), trunkMat(dist));
        br.position.set(Math.sin(i * 1.26) * 0.55, 1.5 + (i % 2) * 0.5, Math.cos(i * 1.26) * 0.55);
        br.rotation.set(Math.cos(i * 1.26) * 0.55, 0, -Math.sin(i * 1.26) * 0.55);
        crown.add(br);
      }
    }
    g.add(crown);
    add(g);
    sway.push({ crown, phase: Math.random() * 6, amp: kind === 'pine' ? 0.02 : 0.035 });
  };
  [[-9, -16, 1.5, 'round'], [8, -20, 1.8, 'pine'], [19, -28, 2, 'pine'], [-20, -26, 2.1, 'round'], [-34, -38, 2.4, 'pine'], [36, -44, 2.4, 'round'], [-5, -60, 2.2, 'pine'], [3.8, -7.5, 0.55, 'round'], [-4.6, -6, 0.5, 'round']].forEach((a) => tree(...a));
  // mown stripes on the lawn, a pond, a bench, flower beds by the wall
  for (let i = -6; i <= 6; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 60), basic('#69b672', 40));
    hazed[hazed.length - 1].stripe = true;
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(i * 3.2, GY + 0.01, -34);
    add(stripe);
  }
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.2, 28), basic('#5aa6d0', 20));
  pond.rotation.x = -Math.PI / 2;
  pond.scale.y = 0.65;
  pond.position.set(4.2, GY + 0.03, -7.2);
  add(pond);
  const pondMat = pond.material;
  const rim = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.55, 28), basic('#a9a49a', 20));
  rim.rotation.x = -Math.PI / 2;
  rim.scale.y = 0.65;
  rim.position.set(4.2, GY + 0.035, -7.2);
  add(rim);
  const bench = new THREE.Group();
  bench.position.set(-3.2, GY, -7.5);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), lit('#9a6a3c', 8));
  seat.position.y = 0.5;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), lit('#9a6a3c', 8));
  back.position.set(0, 0.8, -0.22);
  bench.add(seat, back);
  for (const x of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.4), lit('#6a4a2a', 8));
    leg.position.set(x, 0.25, 0);
    bench.add(leg);
  }
  add(bench);
  // a path from the window and a fence
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 14), basic('#c9b58f', 14));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0.3, GY + 0.02, -8);
  add(path);
  for (let x = -26; x <= 26; x += 1.5) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.16), lit('#e8dcc8', 12));
    post.position.set(x, GY + 0.65, -12);
    add(post);
  }
  for (const y of [0.45, 0.95]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(54, 0.12, 0.08), lit('#e8dcc8', 12));
    rail.position.set(0, GY + y, -12.05);
    add(rail);
  }
  // bushes and flowers in front of the wall
  const bushLeaves = [];
  const bushes = [[-3.5, -1.8, 0.7], [-2.2, -2.2, 0.55], [3.6, -1.7, 0.75], [5, -2.4, 0.6], [-6.5, -2.2, 0.8], [7.5, -2, 0.7]];
  bushes.forEach(([x, z, r]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), lit('#3f8f58', 2));
    b.position.set(x, GY + r * 0.7, z);
    add(b);
    bushLeaves.push({ mesh: b, entry: hazed[hazed.length - 1] });
  });
  const flowerCols = ['#ff7aa8', '#ffd24a', '#ffffff', '#b58cff', '#ff9a4a'];
  const flowerMeshes = [];
  const bed = (x0, x1, z0, z1) => {
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), basic('#6b4a32', 4));
    soil.rotation.x = -Math.PI / 2;
    soil.position.set((x0 + x1) / 2, GY + 0.02, (z0 + z1) / 2);
    add(soil);
    for (let i = 0; i < 26; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), basic(flowerCols[i % 5], 4));
      f.position.set(x0 + 0.2 + ((i * 0.37) % (x1 - x0 - 0.4)), GY + 0.28 + (i % 3) * 0.05, z0 + 0.2 + ((i * 0.53) % (z1 - z0 - 0.4)));
      add(f);
      flowerMeshes.push(f);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), basic('#3f8f58', 4));
      stem.position.set(f.position.x, GY + 0.15, f.position.z);
      add(stem);
      flowerMeshes.push(stem);
    }
  };
  bed(-3.2, -0.6, -1.2, -3.2);
  bed(1.2, 4.4, -1.2, -3.2);
  const house = new THREE.Group();
  house.position.set(22, GY, -58);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 9), lit('#e7d3b5', 58));
  wall.position.y = 4;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(11, 5, 4), lit('#b5523b', 58));
  roof.position.y = 10.5;
  roof.rotation.y = Math.PI / 4;
  house.add(wall, roof);
  const winMat = inHole(new THREE.MeshBasicMaterial({ color: 0x9ec9e8 }));
  for (const x of [-3.5, 3.5]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), winMat);
    w.position.set(x, 4.6, 4.55);
    house.add(w);
  }
  add(house);

  // --- birds, fireflies, rain, snow
  const birdTex = canvasTex(64, (g, n) => {
    g.strokeStyle = '#2a2a33';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(6, n * 0.35);
    g.quadraticCurveTo(n * 0.28, n * 0.7, n / 2, n * 0.5);
    g.quadraticCurveTo(n * 0.72, n * 0.7, n - 6, n * 0.35);
    g.stroke();
  });
  const birds = [0, 1, 2].map((i) => {
    const b = sprite(birdTex, 0.9, 0.9);
    b.userData = { x: -40 - i * 6, y: 3 + i * 1.5, v: 4 + i, wait: 6 + i * 9 };
    b.visible = false;
    add(b);
    return b;
  });
  const cloud = (n, [sx, sy, sz], [cx, cy, cz]) => {
    const p = [];
    for (let i = 0; i < n; i++) p.push(cx + (Math.random() - 0.5) * sx, cy + Math.random() * sy, cz - Math.random() * sz);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    return geo;
  };
  const flies = new THREE.Points(cloud(40, [16, 2.4, 10], [0, GY + 0.4, -3]), inHole(new THREE.PointsMaterial({ color: 0xf6f08a, size: 3, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false })));
  add(flies);
  const RAIN_TOP = 9;
  const rainGeo = new THREE.BufferGeometry();
  {
    const p = [];
    for (let i = 0; i < 700; i++) {
      const x = (Math.random() - 0.5) * 30;
      const y = GY + Math.random() * (RAIN_TOP - GY);
      const z = -1 - Math.random() * 22;
      p.push(x, y, z, x + 0.06, y - 0.7, z);
    }
    rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  }
  const rain = new THREE.LineSegments(rainGeo, inHole(new THREE.LineBasicMaterial({ color: 0xd6e6ff, transparent: true, opacity: 0.55, depthWrite: false })));
  rain.visible = false;
  rain.frustumCulled = false;
  add(rain);
  const snow = new THREE.Points(cloud(500, [30, RAIN_TOP - GY, 22], [0, GY, -1]), inHole(new THREE.PointsMaterial({ color: 0xffffff, size: 3.4, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false })));
  snow.visible = false;
  snow.frustumCulled = false;
  add(snow);

  const fallLeaves = new THREE.Points(cloud(160, [26, RAIN_TOP - GY, 20], [0, GY, -1]), inHole(new THREE.PointsMaterial({ color: 0xd98a2b, size: 4.2, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false })));
  fallLeaves.visible = false;
  fallLeaves.frustumCulled = false;
  add(fallLeaves);

  // --- the weather and the time
  const state = { hour: null, weather: 'clear', cloud: 0.25, wind: 0.3, flash: 0 };
  async function loadWeather() {
    try {
      const w = await fetchWeather();
      Object.assign(state, { weather: w.kind, cloud: w.cloud, wind: w.wind, temp: w.temp });
    } catch {}
  }
  loadWeather();
  setInterval(loadWeather, 15 * 60_000);

  const keyAt = (h) => {
    let i = 0;
    while (i < DAY.length - 2 && h >= DAY[i + 1][0]) i++;
    const a = DAY[i];
    const b = DAY[i + 1];
    const t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
    const col = (k) => C(a[k]).lerp(C(b[k]), t);
    return { zenith: col(1), horizon: col(2), light: col(3), power: mix(a[4], b[4], t), grass: col(5), hill: col(6) };
  };

  const tmp = new THREE.Color();
  const grey = C('#8a94a2');
  let last = 0;
  function update(now, { hour: forced, weather: forcedWeather, day: forcedDay } = {}) {
    const t = now / 1000;
    const dt = Math.min(0.1, t - last);
    last = t;
    const d = new Date();
    const real = forced ?? state.hour ?? d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    const se = seasonInfo(forcedDay ? new Date(d.getFullYear(), 0, forcedDay) : d);
    // the day is stretched or squeezed so that sunrise and sunset are at the real times of the year (the look is made for sunrise 6:30, sunset 19:30)
    const h = real < se.sunrise ? (real * 6.5) / se.sunrise : real <= se.sunset ? 6.5 + ((real - se.sunrise) * 13) / (se.sunset - se.sunrise) : 19.5 + ((real - se.sunset) * 4.5) / (24 - se.sunset);
    const wx = forcedWeather ?? state.weather;
    const k = keyAt(h);
    const dark = clamp(clamp((6 - h) / 1.5, 0, 1) + clamp((h - 19.5) / 1.5, 0, 1), 0, 1);
    const gloom = wx === 'storm' ? 0.55 : wx === 'rain' ? 0.35 : wx === 'snow' ? 0.3 : wx === 'fog' ? 0.5 : wx === 'cloudy' ? 0.12 + state.cloud * 0.2 : 0;
    const dim = 1 - dark * 0.85;
    const hz = skyMat.uniforms.horizon.value;

    skyMat.uniforms.zenith.value.copy(k.zenith).lerp(tmp.copy(grey).multiplyScalar(dim), gloom);
    hz.copy(k.horizon).lerp(tmp.copy(grey).multiplyScalar(dim * 1.1), gloom * 0.9);

    // colours of the land: day and night, then the haze with distance (a lot of it in fog), then snow on top
    const seasonGrass = se.name === 'spring' ? '#7fcf6c' : se.name === 'autumn' ? '#a39a56' : se.name === 'winter' ? '#98a68e' : null;
    const grass = k.grass.clone().lerp(tmp.copy(grey).multiplyScalar(dim), gloom * 0.3);
    if (seasonGrass) grass.lerp(tmp.set(seasonGrass).multiplyScalar(0.1 + 0.9 * dim), se.name === 'autumn' ? 0.2 + se.turn * 0.4 : 0.5);
    const hill = k.hill.clone().lerp(tmp.copy(grey).multiplyScalar(dim), gloom * 0.3);
    const snowy = wx === 'snow' ? C('#e8eef5').multiplyScalar(0.55 + 0.45 * dim) : null;
    for (const m of hazed) {
      let base = m.base;
      if (m.stripe) base = grass.clone().multiplyScalar(0.93);
      else if (m.mat === ground.material || m.mat === low.material) base = grass;
      else if (m.mat === mid.material) base = hill.clone().lerp(grass, 0.45);
      else if (m.mat === far.material) base = hill;
      else base = m.base.clone().multiplyScalar(0.2 + 0.8 * dim); // trees, fence, house darken at night
      if (snowy && (m.stripe || m.mat === ground.material || m.mat === low.material || m.mat === mid.material)) base = base.clone().lerp(snowy, 0.8);
      const amount = clamp(m.dist / 700, 0, 0.8) * (wx === 'fog' ? 1.6 : 1) + (wx === 'fog' ? clamp(m.dist / 120, 0, 0.7) : 0);
      m.mat.color.copy(base).lerp(hz, clamp(amount, 0, 0.95));
    }

    const fall = (pts, speed, drift, per = 1) => {
      const a = pts.geometry.attributes.position;
      for (let i = 0; i < a.count; i += per) {
        let y = a.getY(i) - speed * dt;
        let x = a.getX(i) + drift * dt;
        if (y < GY) y += RAIN_TOP - GY;
        if (x > 15) x -= 30;
        a.setXYZ(i, x, y, a.getZ(i));
        if (per === 2) a.setXYZ(i + 1, x + 0.06, y - 0.7, a.getZ(i));
      }
      a.needsUpdate = true;
    };
    // the trees: leaves come in spring, turn in autumn and fall; the flowers and the pond follow the year
    const green = C(se.blossom ? '#f3b9d3' : se.day < 152 ? '#7bc660' : '#4fa05a');
    const gold = C('#e6b83a');
    const orange = C('#d4762a');
    const brown = C('#8a4a22');
    const turned = se.turn < 0.4 ? green.clone().lerp(gold, se.turn / 0.4) : se.turn < 0.75 ? gold.clone().lerp(orange, (se.turn - 0.4) / 0.35) : orange.clone().lerp(brown, (se.turn - 0.75) / 0.25);
    const leafColor = se.day > 250 ? turned : green;
    for (const l of leaves) {
      l.mesh.visible = se.leafOn > l.at;
      l.entry.base.copy(leafColor).offsetHSL(l.shade, 0, l.shade * 0.5);
    }
    for (const b of bushLeaves) {
      b.mesh.visible = se.leafOn > 0.1 || se.name !== 'winter';
      b.entry.base.copy(se.day > 250 ? turned : C('#4fa05a')).lerp(C('#3f8f58'), 0.5); // bushes do not blossom pink
    }
    for (const f of flowerMeshes) f.visible = se.flowers;
    pondMat.color.set(se.frozen ? '#d8eaf2' : '#5aa6d0');
    pondMat.userData.frozen = se.frozen;
    fallLeaves.visible = se.falling;
    if (se.falling) fall(fallLeaves, 0.9, 0.6 + state.wind * 3 + Math.sin(t * 0.7) * 0.4);

    // sun and moon sit in the direction the window light comes from (see skyAim)
    const aim = skyAim(forcedDay ? new Date(d.getFullYear(), 0, forcedDay) : d, forced ?? null);
    const V = aimVector(aim);
    sun.visible = aim.body === 'sun' && aim.t > 0.01 && aim.t < 0.99;
    sun.position.set(V[0] * 400, V[1] * 400, V[2] * 400);
    sun.material.opacity = clamp(1 - gloom * 2.5, 0, 1);
    moon.visible = aim.body === 'moon' && dark > 0.05;
    moon.position.set(V[0] * 380, V[1] * 380, V[2] * 380);
    moon.material.opacity = clamp(dark * (1 - gloom * 1.2), 0, 1);
    const starsOn = clamp(dark * (1 - gloom * 1.6), 0, 1);
    starsA.material.opacity = starsOn * (0.6 + Math.sin(t * 2.1) * 0.4);
    starsB.material.opacity = starsOn * (0.6 + Math.sin(t * 3.3 + 2) * 0.4);

    // clouds drift; more of them and darker when the weather says so
    const want = wx === 'clear' ? 0.4 : wx === 'cloudy' ? 0.5 + state.cloud * 0.5 : 1;
    clouds.forEach((c, i) => {
      c.position.x += c.userData.speed * (0.8 + state.wind * 3) * dt;
      if (c.position.x > 460) c.position.x = -460;
      c.material.opacity = (i / clouds.length < want ? 1 : 0) * clamp(want * (i % 3 === 0 ? 1 : 0.8) * (1 - dark * 0.7), 0, 1);
      c.material.color.copy(k.light).lerp(grey, gloom * 1.4).multiplyScalar(0.55 + 0.45 * dim);
    });

    sway.forEach((s) => {
      s.crown.rotation.z = Math.sin(t * (0.9 + state.wind * 1.5) + s.phase) * s.amp * (0.4 + state.wind * 2.2);
    });
    winMat.color.set(dark > 0.4 ? 0xffd27a : 0x9ec9e8); // the neighbour's lights come on at night

    birds.forEach((b) => {
      const u = b.userData;
      const fly = h > 6.5 && h < 19.5 && (wx === 'clear' || wx === 'cloudy');
      if (!b.visible) {
        u.wait -= dt;
        if (fly && u.wait <= 0) { b.visible = true; u.x = -40; u.y = 3 + Math.random() * 7; u.wait = 20 + Math.random() * 40; }
      } else {
        u.x += u.v * dt * 2;
        b.position.set(u.x, u.y + Math.sin(u.x * 0.2) * 0.8, -22);
        b.scale.set(0.9, 0.9 * (0.45 + Math.abs(Math.sin(t * 9 + u.y)) * 0.8), 1);
        if (u.x > 40) b.visible = false;
      }
    });
    flies.visible = dark > 0.3 && (wx === 'clear' || wx === 'cloudy');
    if (flies.visible) {
      flies.material.opacity = (0.5 + Math.sin(t * 4) * 0.5) * dark;
      flies.position.x = Math.sin(t * 0.3) * 0.8;
      flies.position.y = Math.sin(t * 0.7) * 0.3;
    }
    rain.visible = wx === 'rain' || wx === 'storm';
    snow.visible = wx === 'snow';
    if (rain.visible) fall(rain, 14, 1.5 + state.wind * 4, 2);
    if (snow.visible) fall(snow, 1.4, Math.sin(t) * 0.8);
    if (wx === 'storm' && state.flash <= 0 && Math.random() < dt * 0.15) state.flash = 1;
    state.flash = Math.max(0, state.flash - dt * 4);
    if (state.flash > 0) hz.lerp(C('#ffffff'), state.flash * 0.5);
  }

  return { root, mask, update, state };
}
