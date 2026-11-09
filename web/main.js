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
function fitCamera() {
  const w = stage.clientWidth || 1;
  const h = stage.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const k = Math.max(1, 1.3 / camera.aspect);
  camera.position.set(9.5 * k, 9 * k, 11 * k);
  camera.lookAt(0, 1.2, -0.3);
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
};
const SYNONYMS = {
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
    default: return { at: resolveSpot(d.object), anim: 'look' };
  }
}
function startTask(last) {
  const plan = planFor(last);
  task = { ...plan, spot: SPOTS[plan.at], last, arrived: false, detour: null, phrase: null, nextPhraseAt: 0, nextBreak: Infinity, askUntil: 0 };
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

let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.3, (now - prev) / 1000);
  prev = now;
  frame(now, dt);
  updateFloaters(dt, now);
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
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {}
  return null;
}
function entry(meta, body, cls) {
  const li = el('li', null, 'item' + (cls ? ' ' + cls : ''));
  const m = el('div', null, 'meta');
  meta.forEach((t) => m.append(el('span', t)));
  li.append(m, el('p', body));
  return li;
}
const empty = (t) => [el('li', t, 'muted')];

// tabs
let tab = store('pip-tab') || 'thoughts';
let latestMsg = null;
function showTab(name) {
  tab = name;
  store('pip-tab', name);
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('.pane').forEach((p) => (p.hidden = p.dataset.pane !== name));
  if (name === 'messages' && latestMsg) store('pip-seen', latestMsg);
  $('msgdot').classList.toggle('on', name !== 'messages' && !!latestMsg && latestMsg !== store('pip-seen'));
}
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

function render(s) {
  $('mood').textContent = s.mood || '…';

  const thoughts = (s.thoughts || []).slice().reverse();
  fill($('thoughts'), thoughts.length
    ? thoughts.map((t) => entry([when(t.at), `${ICON[t.action] || '•'} ${(t.action || '').replace('_', ' ')}${t.detail ? ': ' + t.detail : ''}`, t.mood || ''].filter(Boolean), t.text))
    : empty('Pip has not thought anything yet.'));

  const wants = s.wants || [];
  fill($('wants'), wants.length ? wants.map((w) => entry([`since ${when(w.since)}`], w.text)) : empty('Pip does not know yet what he wants.'));
  const qs = s.questions || [];
  fill($('questions'), qs.length ? qs.map((q) => entry([`since ${when(q.since)}`], q.text)) : empty('nothing yet'));
  const done = (s.fulfilled || []).slice().reverse();
  fill($('fulfilled'), done.length ? done.map((w) => entry([when(w.at)], w.text)) : empty('nothing yet'));
  const interests = s.interests || [];
  fill($('interests'), interests.length ? interests.map((i) => el('span', i, 'chip')) : [el('span', 'none yet', 'muted')]);

  const msgs = (s.outbox || []).slice().reverse();
  latestMsg = msgs[0]?.id ?? null;
  fill($('messages'), msgs.length
    ? msgs.map((m) => entry([when(m.at), m.kind === 'ask' ? '🙏 Pip asks for something' : '✉️ Pip writes to you'], m.text, m.kind === 'ask' ? 'ask' : ''))
    : empty('Pip has not written to you yet. He only writes when something really matters to him.'));
  showTab(tab);

  $('story').textContent = s.story || 'Pip has only just come to life. His story starts here.';
  fill($('bars'), [['Energy', s.energy], ['Boredom', s.boredom], ['Lonely', s.loneliness]].map(([name, val]) => {
    const row = el('div', null, 'bar');
    const track = el('div', null, 'track');
    const f = el('div', null, 'fill');
    f.style.width = `${((val ?? 0) / 10) * 100}%`;
    track.append(f);
    row.append(el('span', name), track);
    return row;
  }));
  const recent = (s.activities || []).slice(-6).reverse();
  fill($('recent'), recent.length
    ? recent.map((a) => el('li', `${ICON[a.action] || '•'} ${a.action.replace('_', ' ')}${a.detail ? ': ' + a.detail : ''}`))
    : empty('Pip has not done anything yet.'));
  $('learned').textContent = (s.notes || []).slice(-1)[0] || 'nothing yet';

  $('err').textContent = s._error ? '⚠️ ' + s._error : '';
  $('wake').disabled = !!s._waking;
  $('wake').textContent = s._waking ? 'Pip is thinking…' : 'Wake Pip now';
  $('hint').textContent = !s.last
    ? (s._static ? 'Pip has not woken up yet.' : 'Pip has not woken up yet. Press "Wake Pip now".')
    : s._static ? `Pip last woke up ${new Date(s.last.at).toLocaleString()}` : '';
}

let seenAt = null;
let waking = false;

// Local: the server gives live state. Online: fall back to the state.json file next to the page.
async function loadState() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return await r.json();
  } catch {}
  const r = await fetch('state.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('no state');
  return { ...(await r.json()), _static: true };
}

async function poll() {
  let delay = 2000;
  try {
    const s = await loadState();
    render(s);
    if (s._static) {
      delay = 60_000;
      $('wake').hidden = true;
    }
    waking = !!s._waking;
    if (s.last && s.last.at !== seenAt) {
      seenAt = s.last.at;
      startTask(s.last);
    }
  } catch {
    $('err').textContent = "⚠️ Pip's data is not available yet.";
    delay = 10_000;
  }
  setTimeout(poll, delay);
}
poll();

$('wake').addEventListener('click', () => {
  $('wake').disabled = true;
  fetch('/api/wake', { method: 'POST' });
});

// handy for testing in the browser console: window.pipDo({action:'play_piano', ...})
window.pipDo = (last) => startTask({ at: String(Date.now()), thought: '(test)', details: {}, ...last });
window.__debug = { pip, getTask: () => task };
