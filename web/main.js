import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
const lerp = (a, b, t) => a + (b - a) * Math.min(1, t);
const stage = $('stage');

// ---------------------------------------------------------------- scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(getComputedStyle(document.body).backgroundColor);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
const view = { mode: 'overview', x: 0, z: 3.4, yaw: 0, pitch: 0, keys: new Set(), stick: { x: 0, y: 0 } };
function fitCamera() {
  const w = stage.clientWidth || 1;
  const h = stage.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (view.mode === 'overview') {
    const k = Math.max(1, 1.3 / camera.aspect);
    camera.position.set(9.5 * k, 9 * k, 11 * k);
    camera.lookAt(0, 1.2, -0.3);
  }
  camera.updateProjectionMatrix();
}
new ResizeObserver(fitCamera).observe(stage);

const hemi = new THREE.HemisphereLight(0xfff3e6, 0xc9a98d, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe9d2, 1.3);
sun.position.set(6, 11, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
scene.add(sun);
const lamp = new THREE.PointLight(0xffb066, 12, 12);
lamp.position.set(-2, 3.5, -1);
scene.add(lamp);

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
function box(parent, [w, h, d], color, [x, y, z], opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cyl(parent, [rt, rb, h], color, [x, y, z], opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 32), mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------- room
box(scene, [10, 0.3, 10], 0xd9b48a, [0, -0.15, 0]);
box(scene, [10.3, 5, 0.3], 0xf3d9c4, [0.15, 2.5, -5.15]);
box(scene, [0.3, 5, 10], 0xefcfb6, [-5.15, 2.5, 0]);
// The front and right walls and the ceiling only appear in walk mode, so the overview stays open.
const extraWalls = new THREE.Group();
extraWalls.visible = false;
box(extraWalls, [10.3, 5, 0.3], 0xefd7c0, [0, 2.5, 5.15]);
box(extraWalls, [0.3, 5, 10.3], 0xefd7c0, [5.15, 2.5, 0]);
box(extraWalls, [10.6, 0.3, 10.6], 0xe8c9b0, [0, 5.15, 0]);
extraWalls.traverse((o) => (o.castShadow = false));
scene.add(extraWalls);
const rug = cyl(scene, [2, 2, 0.04], 0xe3a183, [0, 0.02, 0.8]);
rug.castShadow = false;

// window (sky depends on the real time of day)
const hour = new Date().getHours();
const night = hour < 7 || hour >= 20;
if (night) {
  hemi.intensity = 0.45;
  sun.intensity = 0.35;
  lamp.intensity = 18;
}
box(scene, [2.4, 2.2, 0.1], 0xffffff, [0.3, 2.9, -4.98]);
box(scene, [2, 1.8, 0.05], night ? 0x1d2a4a : 0x9ad0f5, [0.3, 2.9, -4.93], {
  emissive: night ? 0x0b1226 : 0x6fb4e6,
  emissiveIntensity: 0.6,
});
box(scene, [0.06, 1.8, 0.07], 0xffffff, [0.3, 2.9, -4.9]);
box(scene, [2, 0.06, 0.07], 0xffffff, [0.3, 2.9, -4.9]);
if (night) {
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }));
  moon.position.set(0.9, 3.5, -4.88);
  scene.add(moon);
  for (let i = 0; i < 9; i++) {
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    star.position.set(-0.5 + ((i * 37) % 17) / 10, 2.3 + ((i * 53) % 13) / 10, -4.88);
    scene.add(star);
  }
}

// framed photo above the piano (ESO / Luis Calçada / Herbert Zodet, CC BY 4.0: the credit is shown on the page)
const wallFrame = new THREE.Group();
wallFrame.position.set(-2.2, 2.75, -4.93);
scene.add(wallFrame);
box(wallFrame, [1.7, 1.2, 0.08], 0x8d5a3b, [0, 0, 0]);
const photoMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), photoMat);
photo.position.z = 0.05;
wallFrame.add(photo);
new THREE.TextureLoader().load('pictures/dark-sky.jpg', (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  photoMat.map = tex;
  photoMat.color.set(0xffffff);
  photoMat.needsUpdate = true;
  photo.scale.x = tex.image.width / tex.image.height / 1.5;
});

// Things Pip made for his room: plain data from state.json, drawn from a few simple shapes.
const decorGroups = new Map();
const SHAPE_GEO = {
  box: (s) => new THREE.BoxGeometry(...s),
  sphere: (s) => new THREE.SphereGeometry(s[0], 20, 14),
  cylinder: (s) => new THREE.CylinderGeometry(s[0], s[1], s[2], 20),
  cone: (s) => new THREE.ConeGeometry(s[0], s[1], 20),
  torus: (s) => new THREE.TorusGeometry(s[0], s[1], 10, 24),
  capsule: (s) => new THREE.CapsuleGeometry(s[0], s[1], 6, 12),
};
function buildDecor(d) {
  const g = new THREE.Group();
  if (d.image) {
    // A picture from Bas that Pip chose to put up: a frame with the photo in it.
    const [w, h] = d.size || [0.8, 0.55];
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x8d5a3b, roughness: 0.8 }));
    frame.position.z = 0.04;
    frame.castShadow = true;
    g.add(frame);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    photo.position.z = 0.075;
    g.add(photo);
    new THREE.TextureLoader().load(d.image, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      photo.material.map = tex;
      photo.material.color.set(0xffffff);
      photo.material.needsUpdate = true;
    });
  }
  for (const p of d.parts || []) {
    const geo = SHAPE_GEO[p.shape];
    if (!geo) continue;
    const mesh = new THREE.Mesh(
      geo(p.size),
      new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7, emissive: p.glow ? p.color : 0x000000, emissiveIntensity: p.glow ? 0.9 : 0 })
    );
    mesh.position.set(...p.pos);
    mesh.rotation.set(...p.rot.map((r) => (r * Math.PI) / 180));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  g.position.set(...d.pos);
  g.rotation.y = d.rotY || 0;
  g.userData.scale = d.scale || 1;
  g.userData.info = () => decorInfo(d);
  g.scale.setScalar(0.001);
  return g;
}
// A thing appears when Pip has walked to its spot (its time in state.json), and pops in.
function updateDecor(s) {
  const list = (s?.decor || []).filter((d) => Date.parse(d.at) <= Date.now());
  const ids = new Set(list.map((d) => d.id));
  for (const [id, g] of decorGroups) {
    if (!ids.has(id)) {
      scene.remove(g);
      decorGroups.delete(id);
    }
  }
  for (const d of list) {
    if (decorGroups.has(d.id)) continue;
    const g = buildDecor(d);
    g.userData.born = performance.now() - Math.min(Date.now() - Date.parse(d.at), 5000); // old things are simply there
    scene.add(g);
    decorGroups.set(d.id, g);
  }
}
function popDecor(now) {
  for (const g of decorGroups.values()) {
    const k = Math.min(1, (now - g.userData.born) / 700);
    const ease = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // small overshoot, then settles
    g.scale.setScalar(Math.max(0.001, g.userData.scale * (k >= 1 ? 1 : ease)));
  }
}

// The chest, where Pip keeps things he does not want in his room right now.
const chestGroup = new THREE.Group();
chestGroup.position.set(-4.1, 0, 3.9);
scene.add(chestGroup);
box(chestGroup, [1.0, 0.45, 0.6], 0x8d5a3b, [0, 0.225, 0]);
box(chestGroup, [1.04, 0.06, 0.64], 0xd9a441, [0, 0.1, 0]);
const chestLid = new THREE.Group();
chestLid.position.set(0, 0.45, -0.3);
chestGroup.add(chestLid);
box(chestLid, [1.04, 0.14, 0.64], 0xa06a3f, [0, 0.07, 0.3]);
box(chestLid, [0.12, 0.12, 0.05], 0xd9a441, [0, 0.0, 0.62]);

// piano
const PIANO = new V3(-2.6, 0, -4.5);
box(scene, [2.6, 1.3, 0.9], 0x2a2a2e, [PIANO.x, 0.65, PIANO.z]);
box(scene, [2.7, 0.1, 1], 0x1d1d20, [PIANO.x, 1.35, PIANO.z]);
box(scene, [2.4, 0.1, 0.5], 0x1d1d20, [PIANO.x, 0.85, PIANO.z + 0.65]);
const keys = {};
'CDEFGAB'.split('').forEach((n, i) => {
  keys[n] = box(scene, [0.29, 0.08, 0.4], 0xfdfdf8, [PIANO.x + (i - 3) * 0.32, 0.93, PIANO.z + 0.72]);
});
[0, 1, 3, 4, 5].forEach((i) => box(scene, [0.15, 0.08, 0.24], 0x111111, [PIANO.x + (i - 3) * 0.32 + 0.16, 1.0, PIANO.z + 0.65]));
cyl(scene, [0.06, 0.06, 0.5], 0x6b4a33, [PIANO.x, 0.28, -3.15]);
cyl(scene, [0.38, 0.38, 0.12], 0xc9604a, [PIANO.x, 0.55, -3.15]);

// bookshelf
const shelf = new THREE.Group();
shelf.position.set(2.6, 0, -4.65);
scene.add(shelf);
box(shelf, [2, 3, 0.6], 0x8d5a3b, [0, 1.5, 0]);
[0.75, 1.5, 2.25].forEach((y) => box(shelf, [1.8, 0.06, 0.55], 0x6e4529, [0, y, 0.03]));
const bookColors = [0xd96c5b, 0x6fa8dc, 0xf0c05a, 0x7bb87f, 0xb48ac9, 0xf08fb0];
[0.78, 1.53, 2.28, 0.03].forEach((y, row) => {
  if (row === 3) return;
  for (let i = 0; i < 6; i++) {
    const h = 0.45 + ((i * 7 + row * 3) % 4) * 0.05;
    box(shelf, [0.2, h, 0.4], bookColors[(i + row) % 6], [-0.7 + i * 0.27, y + h / 2, 0.05]);
  }
});

// computer desk
box(scene, [1.3, 0.1, 2], 0xb98a62, [-4.3, 0.8, 1.2]);
box(scene, [0.1, 0.8, 1.9], 0x9a6f4b, [-3.75, 0.4, 1.2]);
box(scene, [0.1, 0.8, 1.9], 0x9a6f4b, [-4.85, 0.4, 1.2]);
box(scene, [0.1, 0.8, 1.1], 0x222222, [-4.55, 1.3, 1.2]);
const screenCanvas = document.createElement('canvas');
screenCanvas.width = 128;
screenCanvas.height = 160;
const sctx = screenCanvas.getContext('2d');
const screenTex = new THREE.CanvasTexture(screenCanvas);
let screenScroll = 0;
function drawScreen(typing) {
  if (typing) screenScroll += 1;
  sctx.fillStyle = '#0f2a3d';
  sctx.fillRect(0, 0, 128, 160);
  for (let i = -1; i < 13; i++) {
    const row = i + screenScroll;
    const w = 20 + ((row * 37) % 80);
    sctx.fillStyle = row % 5 === 0 ? '#ffd27a' : '#8fd3ff';
    sctx.fillRect(10 + ((row * 13) % 3) * 6, 10 + i * 12 + (typing ? 0 : 0), w, 5);
  }
  if (Math.floor(performance.now() / 500) % 2) {
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(10, 148, 8, 6);
  }
  screenTex.needsUpdate = true;
}
drawScreen(false);
const screenMesh = box(scene, [0.02, 0.65, 0.95], 0x8fd3ff, [-4.49, 1.3, 1.2]);
screenMesh.material = new THREE.MeshBasicMaterial({ map: screenTex });
box(scene, [0.1, 0.3, 0.2], 0x222222, [-4.55, 0.95, 1.2]);
box(scene, [0.4, 0.04, 0.8], 0x444444, [-4.0, 0.87, 1.2]);

// bed
box(scene, [2.2, 0.4, 3.2], 0x8d5a3b, [3.4, 0.2, 3]);
box(scene, [2, 0.3, 3], 0xcfe3f3, [3.4, 0.55, 3]);
box(scene, [1.4, 0.2, 0.6], 0xffffff, [3.4, 0.8, 1.85]);

// plant
cyl(scene, [0.3, 0.22, 0.4], 0xc9604a, [4.1, 0.2, -4.1]);
[[0, 0.75, 0, 0.42], [0.18, 1.05, 0.05, 0.3], [-0.15, 1.0, -0.05, 0.28]].forEach(([x, y, z, r]) => {
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(0x6fae6f));
  leaf.position.set(4.1 + x, y, -4.1 + z);
  leaf.castShadow = true;
  scene.add(leaf);
});

// ---------------------------------------------------------------- Pip
function makePip() {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const fur = mat(0xffc47a, { roughness: 0.7 });
  const body = new THREE.Group();
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), fur);
  belly.scale.set(1, 1.1, 0.95);
  belly.position.y = 0.65;
  belly.castShadow = true;
  body.add(belly);

  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 16), fur);
    ear.position.set(s * 0.3, 1.2, 0);
    ear.rotation.z = -s * 0.4;
    ear.castShadow = true;
    body.add(ear);
  });

  const eyes = [-1, 1].map((s) => {
    const eye = new THREE.Group();
    eye.position.set(s * 0.17, 0.8, 0.44);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), mat(0x2b211d));
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(0.02, 0.025, 0.06);
    eye.add(ball, shine);
    body.add(eye);
    return eye;
  });
  [-1, 1].forEach((s) => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mat(0xff9a9a));
    cheek.scale.set(1, 0.6, 0.4);
    cheek.position.set(s * 0.3, 0.64, 0.4);
    body.add(cheek);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), mat(0x2b211d));
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.68, 0.48);
  body.add(smile);

  const limb = (r) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), fur);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const arms = [limb(0.11), limb(0.11)];
  const feet = [limb(0.14), limb(0.14)];

  const book = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.25), mat(0xd96c5b));
  book.position.set(0, 0.55, 0.55);
  book.visible = false;
  group.add(book);
  const pageHinge = new THREE.Group();
  pageHinge.position.set(0, 0.03, 0);
  const page = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.23), mat(0xfff6e0));
  page.position.set(0.08, 0, 0);
  pageHinge.add(page);
  book.add(pageHinge);

  return { group, body, eyes, arms, feet, book, pageHinge };
}
const pip = makePip();
scene.add(pip.group);
pip.group.position.set(0, 0, 1.6);

const SPOTS = {
  center: { p: new V3(0, 0, 1.6), face: 0 },
  piano: { p: new V3(PIANO.x, 0, -3.15), face: Math.PI, y: 0.5 },
  bookshelf: { p: new V3(2.6, 0, -3.6), face: Math.PI },
  computer: { p: new V3(-3.3, 0, 1.2), face: -Math.PI / 2 },
  window: { p: new V3(0.3, 0, -3.9), face: Math.PI },
  plant: { p: new V3(3.7, 0, -3.1), face: Math.PI },
  bed: { p: new V3(3.4, 0, 3.45), face: 0, y: 1.15, rx: -Math.PI / 2 },
  frame: { p: new V3(-1.5, 0, -3.7), face: Math.PI },
  chest: { p: new V3(-4.1, 0, 4.65), face: Math.PI },
};
const SYNONYMS = {
  frame: ['picture', 'frame', 'photo', 'painting', 'milky way'],
  piano: ['piano', 'keys', 'music'],
  bookshelf: ['book', 'shelf'],
  computer: ['computer', 'desk', 'screen', 'laptop'],
  window: ['window', 'sky', 'star', 'outside'],
  plant: ['plant', 'flower', 'leaf'],
  bed: ['bed', 'pillow'],
};
function resolveSpot(name) {
  const n = String(name || '').toLowerCase();
  for (const [spot, words] of Object.entries(SYNONYMS)) if (words.some((w) => n.includes(w))) return spot;
  return 'center';
}

// ---------------------------------------------------------------- piano sound
let audio = null;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function parseNotes(input) {
  const text = Array.isArray(input) ? input.join(' ') : String(input ?? '');
  const notes = [];
  for (const tok of text.split(/[\s,;|/-]+/)) {
    const m = /^([A-G])([#b]?)(\d)?$/.exec(tok);
    if (!m) continue;
    const semi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const oct = m[3] ? Number(m[3]) : 4;
    notes.push({ letter: m[1], freq: 440 * 2 ** ((oct - 4) * 1 + (semi - 9) / 12) });
  }
  return notes.length ? notes.slice(0, 24) : parseNotes('C E G E C');
}
function stepFor(style) {
  const s = String(style || '').toLowerCase();
  if (/slow|sad|soft|gentle|calm|sleep|dream/.test(s)) return 0.75;
  if (/fast|happy|quick|bright|fun|dance/.test(s)) return 0.28;
  return 0.48;
}
function playNotes(notes, step) {
  if (!audio) return;
  const t0 = audio.currentTime + 0.05;
  notes.forEach((n, i) => {
    const t = t0 + i * step;
    [[1, 0.35, 'triangle'], [2, 0.12, 'sine']].forEach(([mult, vol, type]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = n.freq * mult;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 1.5);
    });
  });
}
$('sound').addEventListener('click', () => {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  const on = audio.state !== 'running';
  (on ? audio.resume() : audio.suspend()).then(() => {
    $('sound').textContent = on ? '🔊 Sound on' : '🔇 Sound off';
  });
});

// ---------------------------------------------------------------- floating signs (symbols, no words)
const glyphCache = {};
function glyph(ch, color) {
  const key = ch + color;
  if (!glyphCache[key]) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.font = 'bold 46px system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = color;
    x.fillText(ch, 32, 34);
    glyphCache[key] = new THREE.CanvasTexture(c);
  }
  return glyphCache[key];
}
const floaters = [];
const tmpV = new V3();
function headPos() {
  pip.eyes[0].getWorldPosition(tmpV);
  return tmpV.clone().add(new V3(0, 0.55, 0));
}
function floatSign(ch, color, pos, { life = 2.2, rise = 0.5, size = 0.45 } = {}) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyph(ch, color), transparent: true, depthTest: false }));
  sp.position.copy(pos);
  sp.scale.setScalar(size);
  scene.add(sp);
  floaters.push({ sp, born: performance.now(), life: life * 1000, rise, drift: (Math.random() - 0.5) * 0.25 });
}
function updateFloaters(dt, now) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    const a = (now - f.born) / f.life;
    if (a >= 1) {
      scene.remove(f.sp);
      f.sp.material.dispose();
      floaters.splice(i, 1);
    } else {
      f.sp.position.y += f.rise * dt;
      f.sp.position.x += f.drift * dt;
      f.sp.material.opacity = 1 - a * a;
    }
  }
}

// ---------------------------------------------------------------- piano phrases
const FREQ = (letter, oct) => 440 * 2 ** (oct - 4 + (SEMI[letter] - 9) / 12);
const SCALE = [['C', 4], ['D', 4], ['E', 4], ['G', 4], ['A', 4], ['C', 5], ['D', 5], ['E', 5]].map(([letter, oct]) => ({
  letter,
  freq: FREQ(letter, oct),
}));
const rand = (a, b) => a + Math.random() * (b - a);
// A short made-up tune that wanders up and down inside the notes Pip chose.
function improvise(palette) {
  const pool = (palette.length >= 3 ? palette : SCALE).slice().sort((a, b) => a.freq - b.freq);
  let i = Math.floor(Math.random() * pool.length);
  const out = [];
  const len = 3 + Math.floor(Math.random() * 5);
  for (let n = 0; n < len; n++) {
    out.push(pool[i]);
    i = Math.max(0, Math.min(pool.length - 1, i + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
  }
  return out;
}

// ---------------------------------------------------------------- what Pip does
// Pip keeps doing his chosen activity until the next wake-up, with small breaks in between.
let task = null;

// A little food symbol for whatever he is eating.
function foodEmoji(food) {
  const f = String(food || '').toLowerCase();
  const map = [[/berr|strawberr/, '🍓'], [/apple/, '🍎'], [/bread|toast|bun/, '🍞'], [/tea|coffee|cocoa/, '☕'], [/soup|stew/, '🍲'], [/cookie|biscuit/, '🍪'], [/cake|pie/, '🍰'], [/cheese/, '🧀'], [/honey/, '🍯'], [/rice|noodle|pasta/, '🍜'], [/fish/, '🐟'], [/carrot/, '🥕'], [/nut|seed/, '🥜'], [/pear/, '🍐'], [/banana/, '🍌'], [/grape/, '🍇'], [/milk/, '🥛']];
  return map.find(([re]) => re.test(f))?.[1] ?? '🍽️';
}
function planFor(last) {
  const d = last.details || {};
  switch (last.action) {
    case 'play_piano': {
      const notes = parseNotes(d.notes);
      return { at: 'piano', anim: 'play', notes, step: stepFor(d.style), palette: [...new Map(notes.map((n) => [n.freq, n])).values()] };
    }
    case 'read_book': return { at: 'bookshelf', anim: 'read' };
    case 'search_web': return { at: 'computer', anim: 'search' };
    case 'write_diary': return { at: 'center', anim: 'write' };
    case 'rest': return { at: 'bed', anim: 'rest' };
    case 'ask_for': return { at: 'center', anim: 'ask' };
    case 'eat': return { at: 'center', anim: 'eat', food: String(d.food || '') };
    case 'remove_decoration': return last.made?.chest ? { at: 'chest', anim: 'stash' } : { at: 'center', anim: 'look' };
    case 'take_out':
    case 'place_picture':
    case 'decorate': {
      const m = last.made;
      if (!m) return { at: 'center', anim: 'look' };
      const [sx, sz] = m.stand;
      return { at: 'custom', anim: 'make', spot: { p: new V3(sx, 0, sz), face: Math.atan2(m.pos[0] - sx, m.pos[2] - sz) }, madeAt: m.pos };
    }
    case 'take_down_picture': return { at: 'center', anim: 'look' };
    default: return { at: resolveSpot(d.object), anim: 'look' };
  }
}
function startTask(last) {
  const plan = planFor(last);
  task = { ...plan, spot: plan.spot || SPOTS[plan.at], last, arrived: false, detour: null, phrase: null, nextPhraseAt: 0, nextBreak: Infinity, askUntil: 0 };
}
function startPhrase(notes, step, now) {
  task.phrase = { notes, step, t0: now, lastIdx: -1 };
  playNotes(notes, step);
}
function startBreak() {
  const options = ['window', 'plant', 'center', 'bookshelf', 'computer'].filter((n) => n !== task.at);
  task.detour = { spot: SPOTS[options[Math.floor(Math.random() * options.length)]], until: 0 };
  task.phrase = null;
}

function turnTo(angle, t) {
  const g = pip.group;
  let diff = angle - g.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  g.rotation.y += diff * Math.min(1, t);
}

let blinkAt = 3;
let blinkEnd = 0;
let nextSign = 0;
let pageStart = 0;
let nextPage = 0;
let screenNext = 0;

function frame(now, dt) {
  const t = now / 1000;
  const g = pip.group;
  const { body, eyes, arms, feet, book, pageHinge } = pip;

  // --- where is Pip and what is he doing right now?
  let walking = false;
  let engaged = false;
  let anim = 'idle';
  if (task) {
    const spot = task.detour ? task.detour.spot : task.spot;
    const to = spot.p.clone().sub(g.position);
    to.y = 0;
    const dist = to.length();
    if (dist > 0.06) {
      walking = true;
      g.rotation.x = lerp(g.rotation.x, 0, dt * 8);
      g.position.y = lerp(g.position.y, 0, dt * 8);
      g.position.addScaledVector(to.normalize(), Math.min(dist, 2.2 * dt));
      turnTo(Math.atan2(to.x, to.z), dt * 10);
    } else {
      turnTo(spot.face, dt * 6);
      g.position.y = lerp(g.position.y, spot.y || 0, dt * 6);
      g.rotation.x = lerp(g.rotation.x, spot.rx || 0, dt * 6);
      if (task.detour) {
        anim = 'look';
        if (!task.detour.until) task.detour.until = now + rand(5000, 10000);
        else if (now > task.detour.until) {
          task.detour = null;
          task.nextPhraseAt = now + 1500;
          task.nextBreak = now + rand(60_000, 110_000);
        }
      } else {
        if (!task.arrived) {
          task.arrived = true;
          if (task.anim === 'play') startPhrase(task.notes, task.step, now);
          if (task.anim === 'ask') task.askUntil = now + 9000;
          task.nextBreak = task.anim === 'rest' ? Infinity : now + rand(40_000, 80_000);
        }
        anim = task.anim;
        engaged = true;
        if (now > task.nextBreak) startBreak();
      }
    }
  }

  // --- piano: play the planned tune, then keep improvising
  let phraseIdx = -1;
  if (engaged && anim === 'play') {
    if (task.phrase) {
      phraseIdx = Math.floor((now - task.phrase.t0) / (task.phrase.step * 1000));
      if (phraseIdx >= task.phrase.notes.length) {
        task.phrase = null;
        task.nextPhraseAt = now + rand(2500, 7000);
        phraseIdx = -1;
      } else if (phraseIdx !== task.phrase.lastIdx) {
        task.phrase.lastIdx = phraseIdx;
        floatSign('♪', '#ffd27a', headPos().add(new V3(rand(-0.4, 0.4), 0.15, 0)), { life: 2, rise: 0.5 });
      }
    } else if (now >= task.nextPhraseAt) {
      startPhrase(improvise(task.palette), rand(0.35, 0.7), now);
    }
  }

  // --- signs
  if (engaged && anim === 'stash' && now > nextSign) {
    nextSign = now + 1200;
    floatSign('📦', '#ffffff', new V3(-4.1, 1.1, 3.9), { life: 1.3, rise: 0.3, size: 0.45 });
  }
  chestLid.rotation.x = lerp(chestLid.rotation.x, engaged && anim === 'stash' ? -1.1 : 0, dt * 6);
  if (engaged && anim === 'eat' && now > nextSign) {
    nextSign = now + 1100;
    floatSign(foodEmoji(task.food), '#ffffff', headPos().add(new V3(rand(-0.1, 0.1), -0.2, 0.3)), { life: 1.2, rise: 0.25, size: 0.45 });
  }
  if (engaged && anim === 'make' && task.madeAt && now > nextSign) {
    nextSign = now + 450;
    floatSign('✨', '#ffd27a', new V3(task.madeAt[0] + rand(-0.4, 0.4), task.madeAt[1] + 0.5 + rand(0, 0.5), task.madeAt[2] + 0.3), { life: 1.4, rise: 0.35, size: 0.4 });
  }
  if (engaged && anim === 'rest' && now > nextSign) {
    nextSign = now + 1600;
    floatSign('z', '#bcd8ff', headPos(), { life: 2.6, rise: 0.35, size: 0.5 });
  }
  const asking = engaged && anim === 'ask' && now < task.askUntil;
  if (asking && now > nextSign) {
    nextSign = now + 1100;
    floatSign('!', '#ff8a5c', headPos(), { life: 1.4, rise: 0.3, size: 0.6 });
  }

  // --- pose
  const sleeping = engaged && anim === 'rest';
  body.position.set(0, 0, 0);
  body.rotation.set(0, 0, 0);
  const reading = engaged && (anim === 'read' || anim === 'write');
  book.visible = reading;
  const base = (s) => [s * 0.5, 0.55, 0.1];
  let la = base(-1);
  let ra = base(1);
  let fl = [-0.22, 0.1, 0];
  let fr = [0.22, 0.1, 0];

  if (walking) {
    const s = Math.sin(t * 10);
    body.position.y = Math.abs(s) * 0.05;
    fl = [-0.22, 0.1 + Math.max(0, s) * 0.08, s * 0.15];
    fr = [0.22, 0.1 + Math.max(0, -s) * 0.08, -s * 0.15];
    la = [-0.5, 0.55, -s * 0.15];
    ra = [0.5, 0.55, s * 0.15];
  } else {
    body.position.y = Math.sin(t * 2) * 0.012;
    if (anim === 'play') {
      const playing = phraseIdx >= 0;
      la = [-0.3, 0.55, 0.4 + (playing ? Math.max(0, Math.sin(t * 9)) * 0.03 : 0)];
      ra = [0.3, 0.55, 0.4 + (playing ? Math.max(0, Math.sin(t * 9 + Math.PI)) * 0.03 : 0)];
      if (playing) body.rotation.z = Math.sin(t * 2.5) * 0.06;
      else body.rotation.y = Math.sin(t * 0.7) * 0.12;
    } else if (anim === 'read' || anim === 'write') {
      la = [-0.28, 0.5, 0.4];
      ra = [0.28 + (anim === 'write' ? Math.sin(t * 6) * 0.05 : 0), 0.5, 0.4];
      body.rotation.x = 0.1;
    } else if (anim === 'search') {
      la = [-0.32, 0.5 + Math.sin(t * 14) * 0.03, 0.4];
      ra = [0.32, 0.5 + Math.sin(t * 14 + 2) * 0.03, 0.4];
    } else if (anim === 'ask') {
      if (asking) {
        body.position.y = Math.abs(Math.sin(t * 5)) * 0.25;
        ra = [0.5 + Math.sin(t * 10) * 0.1, 1.0, 0.1];
      } else body.rotation.y = Math.sin(t * 0.9) * 0.3;
    } else if (anim === 'look') {
      body.rotation.y = Math.sin(t * 0.8) * 0.3;
    } else if (anim === 'stash') {
      la = [-0.3, 0.35 + Math.sin(t * 3) * 0.1, 0.4];
      ra = [0.3, 0.35 + Math.sin(t * 3 + 1) * 0.1, 0.4];
      body.rotation.x = 0.25;
    } else if (anim === 'eat') {
      la = [-0.12, 0.95 + Math.sin(t * 5) * 0.06, 0.35];
      ra = [0.12, 0.95 + Math.sin(t * 5 + Math.PI) * 0.06, 0.35];
      body.rotation.x = 0.08;
    } else if (anim === 'make') {
      la = [-0.4, 0.85 + Math.sin(t * 8) * 0.15, 0.3];
      ra = [0.4, 0.85 + Math.sin(t * 8 + Math.PI) * 0.15, 0.3];
      body.rotation.z = Math.sin(t * 4) * 0.05;
    }
  }
  arms[0].position.set(...la);
  arms[1].position.set(...ra);
  feet[0].position.set(...fl);
  feet[1].position.set(...fr);

  // --- page turns while reading or writing
  if (reading) {
    if (!pageStart && now > nextPage) pageStart = now;
    if (pageStart) {
      const p = (now - pageStart) / 700;
      if (p >= 1) {
        pageStart = 0;
        nextPage = now + rand(4000, 9000);
        pageHinge.rotation.z = 0;
      } else pageHinge.rotation.z = p * Math.PI;
    }
  }

  // --- piano keys and the computer screen
  Object.values(keys).forEach((k) => (k.position.y = 0.93));
  if (phraseIdx >= 0) keys[task.phrase.notes[phraseIdx].letter].position.y = 0.9;
  const typing = engaged && anim === 'search';
  if (now > screenNext) {
    drawScreen(typing);
    screenNext = now + (typing ? 120 : 1500);
  }

  // --- blink
  if (t > blinkAt) {
    blinkEnd = t + 0.13;
    blinkAt = t + 3 + Math.random() * 3;
  }
  const closed = sleeping || t < blinkEnd;
  eyes.forEach((e) => (e.scale.y = closed ? 0.1 : 1));
}

// ---------------------------------------------------------------- free view: walk around and tap things to read about them
const r1 = (v) => (Math.round(Number(v) * 10) / 10).toString();
const logOf = (...actions) => (lastState?.log || []).filter((e) => actions.includes(e.action) && Date.parse(e.at) <= Date.now());
const WALK_BLOCKS = [ // places you cannot walk through: [minX, maxX, minZ, maxZ]
  [-3.95, -1.25, -5, -3.6], [-2.95, -2.25, -3.5, -2.8], [1.55, 3.65, -5, -4.3], [-5, -3.6, 0.1, 2.3], [2.2, 4.6, 1.3, 4.7], [3.6, 4.6, -4.6, -3.6], [-4.6, -3.6, 3.6, 4.2],
];
function blocked(x, z) {
  if (Math.abs(x) > 4.7 || Math.abs(z) > 4.7) return true;
  return WALK_BLOCKS.some(([x0, x1, z0, z1]) => x > x0 - 0.28 && x < x1 + 0.28 && z > z0 - 0.28 && z < z1 + 0.28);
}
function updateWalk(dt) {
  if (view.mode !== 'walk') return;
  const fwd = (view.keys.has('w') || view.keys.has('arrowup') ? 1 : 0) - (view.keys.has('s') || view.keys.has('arrowdown') ? 1 : 0) + view.stick.y;
  const side = (view.keys.has('d') || view.keys.has('arrowright') ? 1 : 0) - (view.keys.has('a') || view.keys.has('arrowleft') ? 1 : 0) + view.stick.x;
  const len = Math.hypot(fwd, side);
  if (len > 0.05) {
    const speed = 2.4 * dt * Math.min(1, len);
    const dx = ((-Math.sin(view.yaw) * fwd + Math.cos(view.yaw) * side) / len) * speed;
    const dz = ((-Math.cos(view.yaw) * fwd - Math.sin(view.yaw) * side) / len) * speed;
    if (!blocked(view.x + dx, view.z)) view.x += dx;
    if (!blocked(view.x, view.z + dz)) view.z += dz;
  }
  camera.position.set(view.x, 1.55, view.z);
  camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ');
}
function setMode(mode) {
  view.mode = mode;
  document.body.classList.toggle('walking', mode === 'walk');
  extraWalls.visible = mode === 'walk';
  $('stick').hidden = mode !== 'walk';
  if (mode === 'walk') {
    Object.assign(view, { x: 0, z: 3.4, yaw: 0, pitch: 0 });
    camera.fov = 70;
    camera.rotation.order = 'YXZ';
  } else {
    camera.fov = 35;
    view.stick = { x: 0, y: 0 };
    view.keys.clear();
    $('knob').style.transform = '';
  }
  camera.updateProjectionMatrix();
  if (mode === 'overview') fitCamera();
  $('walk').textContent = mode === 'walk' ? '🏠 Back to overview' : '🚶 Walk around';
  hideInfo();
}
$('walk').addEventListener('click', () => setMode(view.mode === 'walk' ? 'overview' : 'walk'));

// Things you can tap: Pip, the photo and Pip's creations carry their own info; furniture is found by where you tapped.
const REGIONS = [
  { box: [-3.95, -1.25, 0, 1.5, -5, -3.55], info: () => { const n = logOf('play_piano'); const last = n.at(-1); return { title: 'The piano', lines: ['Pip plays here when he feels like music.', n.length ? `He has played it ${n.length} time${n.length === 1 ? '' : 's'} lately${last?.style ? `, the last time ${last.style}` : ''}.` : 'He has not played it yet.'] }; } },
  { box: [-2.95, -2.25, 0, 0.7, -3.5, -2.8], info: () => ({ title: 'The piano stool', lines: ['Pip sits here to play.'] }) },
  { box: [1.55, 3.65, 0, 3.1, -5, -4.3], info: () => { const last = logOf('read_book').at(-1); return { title: 'The bookshelf', lines: ['Pip goes here to read.', last?.opened ? `He last read about ${last.opened.title}.` : 'He has not read anything here yet.'], links: last?.opened?.url ? [{ text: `Read: ${last.opened.title}`, url: last.opened.url }] : [] }; } },
  { box: [-5, -3.6, 0, 1.9, 0.1, 2.3], info: () => { const last = logOf('search_web').at(-1); return { title: 'The computer', lines: ['Pip looks things up on the web here.', last ? `His last search was "${last.query}".` : 'He has not searched yet.'], links: last?.opened?.url ? [{ text: `He opened: ${last.opened.title}`, url: last.opened.url }] : [] }; } },
  { box: [2.2, 4.6, 0, 1.1, 1.3, 4.7], info: () => ({ title: "Pip's bed", lines: ['Pip sleeps here, from 23:00 until 08:00.', 'He also rests here when he is tired.'] }) },
  { box: [3.6, 4.6, 0, 1.5, -4.6, -3.6], info: () => ({ title: 'A plant', lines: ['A leafy plant in the corner.'] }) },
  { box: [-0.9, 1.5, 1.7, 4.1, -5.1, -4.8], info: () => ({ title: 'The window', lines: ['Pip looks outside here.', 'The sky follows the real time of day where you are.'] }) },
  { box: [-2, 2, 0, 0.12, -1.2, 2.8], info: () => ({ title: 'The rug', lines: ['A soft round rug in the middle of the room.'] }) },
];
function infoFor(hit) {
  for (let o = hit.object; o; o = o.parent) {
    if (o.userData?.info) return typeof o.userData.info === 'function' ? o.userData.info() : o.userData.info;
  }
  const { x, y, z } = hit.point;
  return REGIONS.find(({ box: [x0, x1, y0, y1, z0, z1] }) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1)?.info() ?? null;
}
pip.group.userData.info = () => {
  const s = lastState;
  const [icon, text] = plan && stepNow >= 0 ? headline(plan.steps[stepNow]) : ['•', 'getting ready'];
  return { title: 'Pip', lines: [`${icon} ${text}`, s?.mood ? `Mood: ${s.mood}` : '', s ? `Fullness ${r1(s.fullness)} · Energy ${r1(s.energy)} · Wonder ${r1(s.wonder)} · Joy ${r1(s.joy)} · Calm ${r1(s.calm)}` : ''].filter(Boolean) };
};
wallFrame.userData.info = () => ({
  title: 'Beneath the Milky Way',
  image: 'pictures/dark-sky.jpg',
  lines: ["A photo of the Milky Way over a very dark sky, with two people in silhouette looking up from a railing. It hangs above Pip's piano.", 'Photo: ESO/Luis Calçada/Herbert Zodet'],
  links: [{ text: 'Photo page on Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:Beneath_the_Milky_Way.jpg' }, { text: 'License: CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }],
});
chestGroup.userData.info = () => {
  const items = lastState?.stored || [];
  return { title: "Pip's chest", lines: items.length ? ['Things Pip put away. Nothing is lost, and he can take them out again:', ...items.map((x) => `• ${x.name}`)] : ['An empty chest. Pip puts things here when he does not want them in his room for a while.'] };
};
function decorInfo(d) {
  const pic = (lastState?.pictures || []).find((p) => p.id === d.picture);
  const lines = d.image
    ? [`A picture${pic?.caption ? `: "${pic.caption}"` : ''} that Bas gave to Pip. It hangs ${d.label}.`, pic?.notes ? `Pip says: ${pic.notes}` : '']
    : [`Made by Pip. It is ${d.label}.`, d.why ? `Why: ${d.why}` : '', d.project ? `For his project: ${d.project}` : '', `Made ${when(d.createdAt)}.`];
  return { title: d.name, lines: lines.filter(Boolean), image: d.image || null };
}

const infoBox = $('info');
function showInfo(info) {
  $('infotitle').textContent = info.title || '';
  const link = $('infoimglink');
  link.hidden = !info.image;
  if (info.image) {
    link.href = info.image;
    $('infoimg').src = info.image;
  }
  const body = el('div');
  (info.lines || []).forEach((l, i) => body.append(el('p', l, i && l.startsWith('Photo:') ? 'small' : '')));
  (info.links || []).forEach((l) => {
    const p = el('p', null, 'small');
    p.append(link_(l.url, l.text));
    body.append(p);
  });
  $('infobody').replaceChildren(body);
  infoBox.hidden = false;
}
const link_ = (url, text) => link(url, text);
function hideInfo() {
  infoBox.hidden = true;
}
$('infoclose').addEventListener('click', hideInfo);

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickAt(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObjects(scene.children, true)) {
    if (h.object.isSprite || !h.object.visible) continue;
    const info = infoFor(h);
    if (info) return info;
  }
  return null;
}

// Looking around (drag) and tapping (a short touch that hardly moves).
const dom = renderer.domElement;
dom.style.touchAction = 'none';
let drag = null;
dom.addEventListener('pointerdown', (e) => {
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
  dom.setPointerCapture(e.pointerId);
});
dom.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
  if (view.mode === 'walk' && drag.moved) {
    view.yaw -= dx * 0.005;
    view.pitch = Math.max(-1.2, Math.min(1.2, view.pitch - dy * 0.005));
  }
});
dom.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const tap = !drag.moved && performance.now() - drag.t < 500;
  drag = null;
  if (!tap) return;
  const info = pickAt(e.clientX, e.clientY);
  if (info) showInfo(info);
  else hideInfo();
});
dom.addEventListener('pointercancel', () => (drag = null));

// The joystick for touch screens.
const stick = $('stick');
let stickId = null;
const moveStick = (e) => {
  const r = stick.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2 - 10;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  $('knob').style.transform = `translate(${dx}px, ${dy}px)`;
  view.stick = { x: dx / max, y: -dy / max };
};
stick.addEventListener('pointerdown', (e) => {
  stickId = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  moveStick(e);
});
stick.addEventListener('pointermove', (e) => {
  if (e.pointerId === stickId) moveStick(e);
});
const stopStick = (e) => {
  if (e.pointerId !== stickId) return;
  stickId = null;
  view.stick = { x: 0, y: 0 };
  $('knob').style.transform = '';
};
stick.addEventListener('pointerup', stopStick);
stick.addEventListener('pointercancel', stopStick);

// Keys for desktop: W A S D or the arrow keys.
window.addEventListener('keydown', (e) => {
  if (view.mode !== 'walk' || /input|textarea/i.test(document.activeElement?.tagName || '')) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    view.keys.add(k);
    e.preventDefault();
  }
  if (k === 'escape') setMode('overview');
});
window.addEventListener('keyup', (e) => view.keys.delete(e.key.toLowerCase()));

let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.3, (now - prev) / 1000);
  prev = now;
  frame(now, dt);
  updateFloaters(dt, now);
  popDecor(now);
  updateWalk(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
fitCamera();
requestAnimationFrame(loop);

// ---------------------------------------------------------------- panel + polling
const ICON = { play_piano: '🎹', read_book: '📖', search_web: '🌐', write_diary: '✍️', rest: '💤', ask_for: '🙏', walk_to: '🚶' };
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function fill(node, children) {
  node.replaceChildren(...children);
}
function when(iso) {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? hm : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${hm}`;
}
const hm = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {}
  return null;
}
function entry(meta, body, cls, image) {
  const li = el('li', null, 'item' + (cls ? ' ' + cls : ''));
  const m = el('div', null, 'meta');
  meta.forEach((t) => m.append(el('span', t)));
  li.append(m, el('p', body));
  if (image) {
    const a = el('a');
    a.href = image;
    a.target = '_blank';
    a.rel = 'noopener';
    const img = el('img', null, 'thumb');
    img.src = image;
    img.alt = 'picture';
    a.append(img);
    li.append(a);
  }
  return li;
}
const empty = (t) => [el('li', t, 'muted')];
function link(url, text) {
  const a = el('a', text);
  if (/^https:\/\//.test(url || '')) {
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
  }
  return a;
}

// replies
let pending = [];
try {
  pending = JSON.parse(store('pip-pending') || '[]');
} catch {}
let lastState = null;
let isStatic = false;
let fastUntil = 0;

// Sends a message to Pip. Returns true when it was sent.
async function sendReply(body, image = '') {
  const status = $('replystatus');
  let key = store('pip-key') || '';
  if (isStatic && !key) key = $('replykey').value.trim();
  if (isStatic && !key) {
    showTab('messages');
    $('replytext').value = body;
    $('replykey').hidden = false;
    $('replykey').focus();
    status.textContent = 'Enter your reply key once, then press Send.';
    return false;
  }
  $('send').disabled = true;
  status.textContent = 'Sending…';
  try {
    const res = await fetch('/api/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: body, key, image }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      store('pip-key', '');
      $('replykey').value = '';
      $('replykey').hidden = false;
      showTab('messages');
      $('replytext').value = body;
      status.textContent = 'That key is not right.';
      return false;
    }
    if (!res.ok) {
      status.textContent = data.error || 'Could not send.';
      return false;
    }
    if (key) store('pip-key', key);
    $('replykey').hidden = true;
    pending.push({ id: data.id, at: new Date().toISOString(), text: body || '(a picture)' });
    store('pip-pending', JSON.stringify(pending));
    status.textContent = 'Sent. Pip reads it when he next wakes up, and answers if he wants to.';
    fastUntil = Date.now() + 3 * 60_000;
    if (lastState) render(lastState);
    return true;
  } catch {
    status.textContent = 'No connection. Try again.';
    return false;
  } finally {
    $('send').disabled = false;
  }
}
// The picture is shrunk first (at most 1280 px, JPEG) so it is small enough to send.
let chosenImage = '';
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
  return await new Promise((r) => {
    const reader = new FileReader();
    reader.onload = () => r(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}
function clearImage() {
  chosenImage = '';
  $('replyimg').value = '';
  $('imgname').textContent = '';
  $('imgclear').hidden = true;
}
$('replyimg').addEventListener('change', async () => {
  const file = $('replyimg').files[0];
  if (!file) return;
  try {
    chosenImage = await shrink(file);
    $('imgname').textContent = `📎 ${file.name}`;
    $('imgclear').hidden = false;
  } catch {
    clearImage();
    $('replystatus').textContent = 'I could not read that picture.';
  }
});
$('imgclear').addEventListener('click', clearImage);

$('reply').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = $('replytext').value.trim();
  if (!body && !chosenImage) return;
  if (await sendReply(body, chosenImage)) {
    $('replytext').value = '';
    clearImage();
  }
});

// What Bas typed in the ntfy app shows up in this chat too (the website asks ntfy through a small service, with the same key).
let ntfyMsgs = [];
let ntfyAt = 0;
let ntfyOff = false;
async function refreshNtfy() {
  const key = store('pip-key');
  if (ntfyOff || !isStatic || !key || Date.now() - ntfyAt < 20_000) return;
  ntfyAt = Date.now();
  try {
    const res = await fetch('/api/ntfy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
    if (res.status === 501 || res.status === 404) ntfyOff = true;
    if (!res.ok) return;
    ntfyMsgs = (await res.json()).messages || [];
    if (lastState) render(lastState);
  } catch {}
}

// tabs
const TABS = ['day', 'mind', 'asks', 'messages', 'life'];
let tab = TABS.includes(store('pip-tab')) ? store('pip-tab') : 'day';
let latestMsg = null;
function showTab(name) {
  tab = name;
  store('pip-tab', name);
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('.pane').forEach((p) => (p.hidden = p.dataset.pane !== name));
  if (name === 'messages') refreshNtfy(); // look for things typed in the ntfy app as soon as the chat is opened
  if (name === 'messages' && latestMsg) store('pip-seen', latestMsg);
  $('msgdot').classList.toggle('on', name !== 'messages' && !!latestMsg && latestMsg !== store('pip-seen'));
}
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ---- Day: what Pip does, reads and searches, as a timeline
function headline(st) {
  const d = st.details || {};
  switch (st.action) {
    case 'search_web': return ['🌐', `Searching the web for “${d.query || st.query || '…'}”`];
    case 'read_book': return ['📖', `Reading about “${d.topic || st.topic || '…'}”`];
    case 'play_piano': return ['🎹', `Playing the piano${d.style ? ` (${d.style})` : ''}`];
    case 'write_diary': return ['✍️', 'Writing in his diary'];
    case 'rest': return ['💤', 'Resting'];
    case 'ask_for': return ['🙏', `Asking Bas for ${d.item || st.item || 'something'}`];
    case 'walk_to': return ['🚶', `Walking to the ${d.object || st.object || 'room'}`];
    case 'eat': return ['🍽️', `Eating ${d.food || st.food || 'a snack'}`];
    case 'decorate': return ['🛠️', `Making ${d.name || st.name || 'something'} for his room`];
    case 'place_picture': return ['🖼️', 'Putting up a picture'];
    case 'take_down_picture': return ['🖼️', 'Taking a picture down'];
    case 'remove_decoration': return ['📦', `Putting ${d.name || st.name || 'something'} in his chest`];
    case 'take_out': return ['📦', `Taking ${d.name || st.name || 'something'} out of the chest`];
    default: return ['•', String(st.action || '')];
  }
}
const KINDS = { search_web: 'search', read_book: 'read', play_piano: 'piano', write_diary: 'diary', rest: 'rest', ask_for: 'ask', walk_to: 'walk', decorate: 'make', remove_decoration: 'make', take_out: 'make', place_picture: 'make', take_down_picture: 'make', eat: 'eat' };
const FILTERS = [['all', 'Everything'], ['search', 'Searches'], ['read', 'Reading'], ['piano', 'Piano'], ['make', 'Creations']];
let filter = FILTERS.some(([k]) => k === store('pip-filter')) ? store('pip-filter') : 'all';

// Old saves had no day log yet: build entries from the latest plan.
function dayEntries(s) {
  if (s.log?.length) return s.log;
  const last = s.last;
  if (!last?.steps) return [];
  const stepMs = ((last.intervalMin || 12) * 60_000) / last.steps.length;
  return last.steps.map((st, i) => ({
    at: new Date(Date.parse(last.at) + i * stepMs + 1000).toISOString(),
    action: st.action, thought: st.thought, query: st.details?.query, topic: st.details?.topic,
    notes: st.details?.notes, style: st.details?.style, text: st.details?.text, object: st.details?.object,
    item: st.details?.item, reason: st.details?.reason, results: [], opened: st.found ? { ...st.found } : null,
  }));
}

function pageBlock(opened, label) {
  const box = el('div', null, 'opened');
  const l = el('div', null, 'label');
  l.append(`${label} `, link(opened.url, opened.title));
  box.append(l);
  const text = opened.text || '';
  const short = text.length > 260 ? text.slice(0, 260).replace(/\s+\S*$/, '') + ' …' : text;
  box.append(el('p', short));
  if (text.length > short.length) {
    const d = el('details');
    d.append(el('summary', 'Read everything he read'), el('p', text));
    box.append(d);
  }
  return box;
}

function dayCard(e) {
  const kind = KINDS[e.action] || 'walk';
  const [icon] = headline(e);
  const card = el('article', null, `card ${kind}`);
  const labels = { search: 'Searched the web', read: 'Read', piano: 'Played the piano', diary: 'Wrote in his diary', rest: 'Rested', ask: 'Asked Bas for something', walk: 'Walked', make: 'Worked on his room', eat: 'Ate something' };
  const header = el('header');
  header.append(el('span', icon), el('span', labels[kind], 'kind'), el('time', hm(Date.parse(e.at))));
  card.append(header);

  if (kind === 'search') {
    card.append(el('h3', `“${e.query || ''}”`, 'title'));
    if (e.results?.length) {
      const ol = el('ol', null, 'results');
      e.results.forEach((r) => {
        const li = el('li');
        li.append(link(r.url, r.title), el('span', r.snippet, 'snip'));
        ol.append(li);
      });
      card.append(ol);
    }
    if (e.opened) card.append(pageBlock(e.opened, 'He opened:'));
    else if (e.results && !e.results.length) card.append(el('p', 'He found nothing.', 'muted'));
  } else if (kind === 'read') {
    card.append(el('h3', e.opened?.title || e.topic || '', 'title'));
    if (e.topic && e.opened) card.append(el('p', `He wanted to know about “${e.topic}”.`, 'muted'));
    if (e.opened) card.append(pageBlock(e.opened, 'He read:'));
    else card.append(el('p', 'He could not find anything to read about this.', 'muted'));
  } else if (kind === 'piano') {
    if (e.style) card.append(el('h3', e.style, 'title'));
    const notes = String(e.notes || '').split(/[\s,;]+/).filter(Boolean);
    if (notes.length) {
      const n = el('div', null, 'notes');
      notes.forEach((x) => n.append(el('span', x)));
      card.append(n);
    }
  } else if (kind === 'diary') {
    if (e.text) card.append(el('div', e.text, 'quote'));
  } else if (kind === 'ask') {
    card.append(el('h3', e.item || '', 'title'));
    if (e.reason) card.append(el('p', e.reason, 'muted'));
  } else if (kind === 'eat') {
    card.append(el('h3', e.food || 'a snack', 'title'));
    if (e.failed) card.append(el('p', 'He was not hungry yet.', 'muted'));
  } else if (kind === 'make') {
    card.append(el('h3', e.name || '', 'title'));
    if (e.image) {
      const img = el('img', null, 'thumb');
      img.src = e.image;
      img.alt = 'picture';
      card.append(img);
    }
    if (e.action === 'remove_decoration') {
      card.append(el('p', e.stored ? 'He put it away in his chest. It is not lost.' : `That did not work out: ${e.failed || 'unknown'}.`, 'muted'));
    } else if (e.action === 'take_out') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : `He took it out of his chest and put it ${e.place}.`, 'muted'));
    } else if (e.action === 'take_down_picture') {
      card.append(el('p', e.removed ? 'He took it down. It stays in his album.' : `That did not work out: ${e.failed || 'unknown'}.`, 'muted'));
    } else {
      card.append(el('p', e.failed ? `It did not work out: ${e.failed}.` : `He made it and put it ${e.place}.`, 'muted'));
    }
    if (e.why && !e.failed) card.append(el('p', e.why));
    if (e.project && !e.failed) card.append(el('p', `For his project: ${e.project}`, 'muted'));
  } else if (kind === 'walk') {
    card.append(el('h3', `To the ${e.object || 'room'}`, 'title'));
  }
  if (e.thought) card.append(el('p', `“${e.thought}”`, 'thought'));
  return card;
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function renderFilters() {
  fill($('filters'), FILTERS.map(([key, label]) => {
    const b = el('button', label, 'filter');
    b.setAttribute('aria-pressed', String(filter === key));
    b.addEventListener('click', () => {
      filter = key;
      store('pip-filter', key);
      renderFilters();
      if (lastState) renderDay(lastState);
    });
    return b;
  }));
}

// Entries appear when their step begins, so his day unfolds live.
function renderDay(s) {
  const now = Date.now();
  const list = dayEntries(s)
    .filter((e) => Date.parse(e.at) <= now && (filter === 'all' || KINDS[e.action] === filter))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!list.length) {
    fill($('day'), [el('p', filter === 'all' ? "Pip's day will show up here as it happens." : 'Nothing like this yet today.', 'muted')]);
    return;
  }
  const out = [];
  let box = null;
  let label = '';
  for (const e of list) {
    const l = dayLabel(e.at);
    if (l !== label) {
      label = l;
      out.push(el('h2', l, 'dayhead'));
      box = el('div', null, 'cards');
      out.push(box);
    }
    box.append(dayCard(e));
  }
  fill($('day'), out);
}

// "Right now" and "Next" at the top of the Day tab
function renderNow() {
  const box = $('now');
  const s = lastState;
  if (!s?.last) {
    fill(box, [el('div', 'Pip has not woken up yet.', 'muted')]);
    return;
  }
  if (s.last.sleeping) {
    const row = el('div', null, 'row');
    row.append(el('span', 'Now', 'label'), el('span', '💤 Sleeping. He wakes up in the morning.', 'big'));
    fill(box, [row]);
    return;
  }
  if (!plan) return;
  const end = plan.at + plan.steps.length * plan.stepMs;
  if (Date.now() > end + 90_000) {
    const row = el('div', null, 'row');
    row.append(el('span', 'Now', 'label'), el('span', 'Between wake-ups. He thinks again soon.', 'big'));
    fill(box, [row]);
    return;
  }
  const i = Math.max(0, stepNow);
  const [icon, text] = headline(plan.steps[i]);
  const rows = [];
  const r1 = el('div', null, 'row');
  r1.append(el('span', 'Now', 'label'), el('span', `${icon} ${text}`, 'big'));
  rows.push(r1);
  const next = plan.steps[i + 1];
  if (next) {
    const [ni, nt] = headline(next);
    const r2 = el('div', null, 'row');
    r2.append(el('span', `Next ${hm(plan.at + (i + 1) * plan.stepMs)}`, 'label'), el('span', `${ni} ${nt}`, 'big'));
    rows.push(r2);
  }
  fill(box, rows);
}
renderFilters();
setInterval(() => {
  if (lastState) renderDay(lastState);
  renderNow();
}, 10_000);

// ---- Mind: his reflections, wants and questions
function renderMind(s) {
  const projects = s.projects || [];
  fill($('projects'), projects.length
    ? projects.map((p) => {
      const li = el('li', null, 'item' + (p.status === 'working' ? ' project' : ' projectdone'));
      const m = el('div', null, 'meta');
      m.append(el('span', p.status === 'working' ? `since ${when(p.since)}` : p.status === 'done' ? '✓ done' : 'dropped'));
      const body = el('p');
      body.append(el('strong', p.title));
      if (p.why) body.append(`\n${p.why}`);
      li.append(m, body);
      if (p.next && p.status === 'working') li.append(el('p', `Next: ${p.next}`, 'next'));
      return li;
    })
    : empty('None yet. When Pip learns something that excites him, he can turn it into a project.'));
  const now = Date.now();
  const thoughts = (s.thoughts || []).filter((t) => !t.step && Date.parse(t.at) <= now).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 40);
  fill($('thoughts'), thoughts.length
    ? thoughts.map((t) => entry([when(t.at), t.mood || ''].filter(Boolean), t.text, 'reflect'))
    : empty('Pip has not thought anything yet.'));
  const wants = s.wants || [];
  fill($('wants'), wants.length ? wants.map((w) => entry([`since ${when(w.since)}`], w.text)) : empty('Pip does not know yet what he wants.'));
  const qs = s.questions || [];
  fill($('questions'), qs.length ? qs.map((q) => entry([`since ${when(q.since)}`], q.text)) : empty('nothing yet'));
  const done = (s.fulfilled || []).slice().reverse();
  fill($('fulfilled'), done.length ? done.map((w) => entry([when(w.at)], w.text)) : empty('nothing yet'));
  const interests = s.interests || [];
  fill($('interests'), interests.length ? interests.map((i) => el('span', i, 'chip')) : [el('span', 'none yet', 'muted')]);
}

function render(s) {
  $('mood').textContent = s.mood || '…';
  renderDay(s);
  renderNow();
  renderMind(s);

  const asks = s.asks || [];
  const open = asks.filter((a) => a.status === 'open');
  $('askcount').textContent = open.length || '';
  fill($('asks'), open.length
    ? open.map((a) => {
      const li = el('li');
      li.append(el('div', a.item, 'what'));
      if (a.why) li.append(el('div', a.why, 'why'));
      li.append(el('div', `asked ${when(a.since)}`, 'meta'));
      const row = el('div', null, 'buttons');
      const done = el('button', '✓ I did this', 'small primary');
      done.addEventListener('click', () => sendReply(`I did this for you: "${a.item}"`));
      const cant = el('button', "I can't do this", 'small');
      cant.addEventListener('click', () => sendReply(`I can't do this one: "${a.item}"`));
      row.append(done, cant);
      li.append(row);
      return li;
    })
    : [el('li', 'Nothing right now. Pip will add things here when he wants something from you.', 'muted')]);
  const closed = asks.filter((a) => a.status !== 'open').reverse();
  fill($('asksdone'), closed.length ? closed.map((a) => el('li', a.item)) : [el('li', 'nothing yet', 'muted')]);

  const outbox = s.outbox || [];
  latestMsg = outbox.at(-1)?.id ?? null;
  const gotIds = new Set((s.inbox || []).map((m) => m.id));
  if (pending.some((p) => gotIds.has(p.id))) {
    pending = pending.filter((p) => !gotIds.has(p.id));
    store('pip-pending', JSON.stringify(pending));
  }
  const thread = [
    ...outbox.map((m) => ({ at: m.at, kind: m.kind, text: m.text })),
    ...(s.inbox || []).map((m) => ({ at: m.at, mine: true, read: m.read, readAt: m.readAt, text: m.text, via: m.via, image: (s.pictures || []).find((p) => p.id === m.picture)?.image })),
    ...ntfyMsgs.filter((m) => !gotIds.has(m.id)).map((m) => ({ at: m.at, mine: true, via: 'ntfy', text: m.text })),
    ...pending.map((p) => ({ at: p.at, mine: true, sending: true, text: p.text })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  fill($('messages'), thread.length
    ? thread.map((m) => m.mine
      ? entry([when(m.at), m.via === 'ntfy' ? 'You (ntfy)' : 'You', m.sending ? 'on its way…' : m.read ? `✓ Pip read it ${when(m.readAt || m.at)}` : 'Pip has not read it yet'], m.text, 'mine', m.image)
      : entry([when(m.at), m.kind === 'ask' ? '🙏 Pip asks for something' : '✉️ Pip writes to you'], m.text, m.kind === 'ask' ? 'ask' : ''))
    : empty('Nothing yet. Pip writes to you when something really matters to him, and you can write to him too.'));
  showTab(tab);

  const pics = (s.pictures || []).slice().reverse();
  fill($('pics'), pics.length
    ? pics.map((p) => {
      const div = el('div', null, 'pic');
      const a = el('a');
      a.href = p.image;
      a.target = '_blank';
      a.rel = 'noopener';
      const img = el('img');
      img.src = p.image;
      img.alt = 'picture from Bas';
      a.append(img);
      div.append(a);
      div.append(el('div', p.seen ? (p.notes || 'Pip has looked at it.') : 'Pip has not looked at it yet.', 'note'));
      const hung = (s.decor || []).find((d) => d.picture === p.id);
      div.append(el('div', hung ? `🖼️ ${hung.label}` : 'in his album, not put up', 'meta'));
      return div;
    })
    : [el('div', 'Bas has not given Pip any pictures yet. Use the 📎 button in the chat.', 'muted')]);
  const inChest = s.stored || [];
  fill($('chestlist'), inChest.length
    ? inChest.map((x) => entry([`put away ${when(x.storedAt)}`, `it was ${x.label}`], x.name))
    : empty('The chest is empty.'));
  const news = s.news?.items || [];
  fill($('newslist'), news.length
    ? news.map((n) => {
      const li = el('li', null, 'item');
      const m = el('div', null, 'meta');
      m.append(el('span', n.kind));
      const p = el('p');
      p.append(`${n.text} `);
      if (n.url) p.append(link(n.url, n.topic ? `(${n.topic})` : '(read)'));
      li.append(m, p);
      return li;
    })
    : empty('No news yet today.'));
  const made = (s.decor || []).filter((d) => Date.parse(d.at) <= Date.now()).slice().reverse();
  fill($('decorlist'), made.length
    ? made.map((d) => entry([d.label, `made ${when(d.createdAt)}`], `${d.name}${d.why ? ' — ' + d.why : ''}`))
    : empty('Nothing yet. Pip can make things for his room when he feels like it.'));
  updateDecor(s);
  $('story').textContent = s.story || 'Pip has only just come to life. His story starts here.';
  const BARS = [['Fullness', s.fullness, '#e0974a', 'hungry → full'], ['Energy', s.energy, '#e2c13c', 'tired → lively'], ['Wonder', s.wonder, '#9b6fd6', 'bored → amazed'], ['Joy', s.joy, '#e8668c', 'low → happy'], ['Calm', s.calm, '#4fa3b8', 'restless → peaceful']];
  fill($('bars'), BARS.map(([name, val, color, hint]) => {
    const v = Number.isFinite(Number(val)) ? Number(val) : 5;
    const row = el('div', null, 'bar');
    row.title = hint;
    const track = el('div', null, 'track');
    const f = el('div', null, 'fill');
    f.style.width = `${(Math.max(0, Math.min(10, v)) / 10) * 100}%`;
    f.style.background = color;
    track.append(f);
    row.append(el('span', name), track, el('span', (Math.round(v * 10) / 10).toString(), 'val'));
    return row;
  }));

  $('err').textContent = s._error ? '⚠️ ' + s._error : '';
  $('wake').disabled = !!s._waking;
  $('wake').textContent = s._waking ? 'Pip is thinking…' : 'Wake Pip now';
  $('hint').textContent = !s.last
    ? (s._static ? 'Pip has not woken up yet.' : 'Pip has not woken up yet. Press "Wake Pip now".')
    : s._static ? `Pip last woke up ${new Date(s.last.at).toLocaleString()}` : '';
}

// Pip's plan: a few steps, spread over the time until his next wake-up. The page works out which step is happening now.
let plan = null;
let stepNow = -1;
function tickPlan() {
  if (!plan) return;
  const i = Math.max(0, Math.min(plan.steps.length - 1, Math.floor((Date.now() - plan.at) / plan.stepMs)));
  if (i !== stepNow) {
    stepNow = i;
    startTask(plan.steps[i]);
    renderNow();
    if (lastState) renderDay(lastState);
  }
}
function setPlan(last) {
  const steps = Array.isArray(last.steps) && last.steps.length ? last.steps : [last];
  plan = { at: Date.parse(last.at), stepMs: ((last.intervalMin || 12) * 60_000) / steps.length, steps };
  stepNow = -1;
  tickPlan();
  renderNow();
}
setInterval(() => {
  tickPlan();
  updateDecor(lastState);
}, 1000);

let seenAt = null;
let waking = false;

// Local: the server gives live state. Online: fall back to the state.json file next to the page.
async function loadState() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return await r.json();
  } catch {}
  const r = await fetch(`state.json?t=${Date.now()}`, { cache: 'no-store' }); // the number defeats any cache on the way
  if (!r.ok) throw new Error('no state');
  return { ...(await r.json()), _static: true };
}

let pollTimer = null;
async function poll() {
  if (document.hidden) {
    // Nobody is looking: do not use the battery. The page refreshes the moment you come back.
    pollTimer = setTimeout(poll, 30_000);
    return;
  }
  let delay = 2000;
  try {
    const s = await loadState();
    lastState = s;
    isStatic = !!s._static;
    render(s);
    refreshNtfy();
    if (s._static) {
      delay = Date.now() < fastUntil ? 10_000 : 60_000;
      $('wake').hidden = true;
    }
    waking = !!s._waking;
    if (s.last && s.last.at !== seenAt) {
      seenAt = s.last.at;
      setPlan(s.last);
    }
  } catch {
    $('err').textContent = "⚠️ Pip's data is not available yet.";
    delay = 10_000;
  }
  pollTimer = setTimeout(poll, delay);
}
poll();

// Phones freeze a page in the background, and bring the old picture back when you return. Refresh at once instead of waiting for the timer.
let hiddenAt = 0;
function refreshNow() {
  clearTimeout(pollTimer);
  poll();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }
  const away = hiddenAt ? Date.now() - hiddenAt : 0;
  hiddenAt = 0;
  // After a long break the page itself can be an old version, so load it again (unless you are in the middle of something).
  const busy = $('replytext').value.trim() || $('replykey').value || chosenImage || $('send').disabled || view.mode === 'walk';
  if (away > 5 * 60_000 && !busy) location.reload();
  else refreshNow();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload(); // the browser put the whole page back from memory
});
window.addEventListener('online', refreshNow);

$('wake').addEventListener('click', () => {
  $('wake').disabled = true;
  fetch('/api/wake', { method: 'POST' });
});

// handy for testing in the browser console: window.pipDo({action:'play_piano', ...})
window.pipDo = (last) => startTask({ at: String(Date.now()), thought: '(test)', details: {}, ...last });
window.__debug = { pip, getTask: () => task, decorGroups, view, setMode, pickAt, camera };
