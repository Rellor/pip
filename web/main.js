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

scene.add(new THREE.HemisphereLight(0xfff3e6, 0xc9a98d, 0.9));
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
box(scene, [0.02, 0.65, 0.95], 0x8fd3ff, [-4.49, 1.3, 1.2], { emissive: 0x4aa8e0, emissiveIntensity: 0.9 });
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

  return { group, body, eyes, arms, feet, book };
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

// ---------------------------------------------------------------- what Pip does
let task = null;
let bubbleUntil = 0;
const bubble = $('bubble');
function say(text, secs = 9) {
  bubble.textContent = text;
  bubble.style.opacity = 1;
  bubbleUntil = performance.now() + secs * 1000;
}

function planFor(last) {
  const d = last.details || {};
  switch (last.action) {
    case 'play_piano': {
      const notes = parseNotes(d.notes);
      const step = stepFor(d.style);
      return { at: 'piano', anim: 'play', notes, step, dur: notes.length * step * 1000 + 1500 };
    }
    case 'read_book': return { at: 'bookshelf', anim: 'read', dur: 7000 };
    case 'search_web': return { at: 'computer', anim: 'search', dur: 7000 };
    case 'write_diary': return { at: 'center', anim: 'write', dur: 7000 };
    case 'rest': return { at: 'bed', anim: 'rest', dur: Infinity };
    case 'ask_for': return { at: 'center', anim: 'ask', dur: 6000 };
    default: return { at: resolveSpot(d.object), anim: 'look', dur: 5000 };
  }
}
function startTask(last) {
  const plan = planFor(last);
  task = { ...plan, spot: SPOTS[plan.at], phase: 'walk', t0: 0, last };
  say(last.thought || '…', 10);
}

function turnTo(angle, t) {
  const g = pip.group;
  let diff = angle - g.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  g.rotation.y += diff * Math.min(1, t);
}

let blinkAt = 3;
let blinkEnd = 0;
function frame(now, dt) {
  const t = now / 1000;
  const g = pip.group;
  const { body, eyes, arms, feet, book } = pip;

  // phase changes
  if (task?.phase === 'walk') {
    const to = task.spot.p.clone().sub(g.position);
    to.y = 0;
    const dist = to.length();
    g.rotation.x = lerp(g.rotation.x, 0, dt * 8);
    g.position.y = lerp(g.position.y, 0, dt * 8);
    if (dist < 0.06) {
      task.phase = 'do';
      task.t0 = now;
      if (task.anim === 'play') playNotes(task.notes, task.step);
      if (task.anim === 'search' && task.last.found) say(`📖 ${task.last.found.title}`, 12);
      if (task.anim === 'ask') say('❗ ' + (task.last.detail || 'I need something'), 12);
      if (task.anim === 'rest') say('Zzz…', 30);
    } else {
      g.position.addScaledVector(to.normalize(), Math.min(dist, 2.2 * dt));
      turnTo(Math.atan2(to.x, to.z), dt * 10);
    }
  } else if (task) {
    turnTo(task.spot.face, dt * 6);
    g.position.y = lerp(g.position.y, task.spot.y || 0, dt * 6);
    g.rotation.x = lerp(g.rotation.x, task.spot.rx || 0, dt * 6);
    if (task.phase === 'do' && now - task.t0 > task.dur) task.phase = 'stay';
  }

  // body pose
  const walking = task?.phase === 'walk' && task.spot.p.distanceTo(g.position) > 0.06;
  const active = task?.phase === 'do';
  const anim = task?.anim;
  const sleeping = anim === 'rest' && !walking;
  body.position.set(0, 0, 0);
  body.rotation.set(0, 0, 0);
  book.visible = false;
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
      la = [-0.3, 0.55, 0.4 + (active ? Math.max(0, Math.sin(t * 9)) * 0.03 : 0)];
      ra = [0.3, 0.55, 0.4 + (active ? Math.max(0, Math.sin(t * 9 + Math.PI)) * 0.03 : 0)];
      if (active) body.rotation.z = Math.sin(t * 2.5) * 0.06;
    } else if (anim === 'read' || anim === 'write') {
      la = [-0.28, 0.5, 0.4];
      ra = [0.28, 0.5, 0.4];
      book.visible = true;
      body.rotation.x = 0.1;
      if (anim === 'write' && active) ra = [0.28 + Math.sin(t * 6) * 0.05, 0.5, 0.4];
    } else if (anim === 'search') {
      la = [-0.32, 0.5 + (active ? Math.sin(t * 14) * 0.03 : 0), 0.4];
      ra = [0.32, 0.5 + (active ? Math.sin(t * 14 + 2) * 0.03 : 0), 0.4];
    } else if (anim === 'ask' && active) {
      body.position.y = Math.abs(Math.sin(t * 5)) * 0.25;
      ra = [0.5 + Math.sin(t * 10) * 0.1, 1.0, 0.1];
    } else if (anim === 'look') {
      body.rotation.y = Math.sin(t * 0.8) * 0.25;
    }
  }
  arms[0].position.set(...la);
  arms[1].position.set(...ra);
  feet[0].position.set(...fl);
  feet[1].position.set(...fr);

  // keys
  Object.values(keys).forEach((k) => (k.position.y = 0.93));
  if (anim === 'play' && active) {
    const idx = Math.floor((now - task.t0) / (task.step * 1000));
    const n = task.notes[idx];
    if (n) keys[n.letter].position.y = 0.9;
  }

  // blink
  if (t > blinkAt) {
    blinkEnd = t + 0.13;
    blinkAt = t + 3 + Math.random() * 3;
  }
  const closed = sleeping || t < blinkEnd;
  eyes.forEach((e) => (e.scale.y = closed ? 0.1 : 1));
}

function placeBubble(now) {
  if (now > bubbleUntil) bubble.style.opacity = 0;
  const w = stage.clientWidth;
  const v = new V3();
  pip.group.getWorldPosition(v);
  v.y += pip.group.rotation.x ? 1.2 : 1.9;
  v.project(camera);
  const x = Math.max(130, Math.min(w - 130, (v.x * 0.5 + 0.5) * w));
  const y = Math.max(bubble.offsetHeight + 12, (-v.y * 0.5 + 0.5) * stage.clientHeight);
  bubble.style.left = x + 'px';
  bubble.style.top = y + 'px';
}

let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.3, (now - prev) / 1000);
  prev = now;
  frame(now, dt);
  placeBubble(now);
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
function render(s) {
  $('mood').textContent = s.mood || '…';
  fill($('bars'), [['Energy', s.energy], ['Boredom', s.boredom], ['Lonely', s.loneliness]].map(([name, val]) => {
    const row = el('div', null, 'bar');
    const track = el('div', null, 'track');
    const f = el('div', null, 'fill');
    f.style.width = `${((val ?? 0) / 10) * 100}%`;
    track.append(f);
    row.append(el('span', name), track);
    return row;
  }));
  const interests = s.interests || [];
  fill($('interests'), interests.length ? interests.map((i) => el('span', i, 'chip')) : [el('span', 'none yet', 'muted')]);
  const open = (s.requests || []).filter((r) => r.status === 'open').slice(-5);
  fill($('requests'), open.length ? open.map((r) => el('li', '🙏 ' + r.detail)) : [el('li', 'nothing right now', 'muted')]);
  const recent = (s.activities || []).slice(-6).reverse();
  fill($('recent'), recent.length
    ? recent.map((a) => el('li', `${ICON[a.action] || '•'} ${a.action.replace('_', ' ')}${a.detail ? ': ' + a.detail : ''}`))
    : [el('li', 'Pip has not done anything yet.', 'muted')]);
  const note = (s.notes || []).slice(-1)[0];
  $('learned').textContent = note || 'nothing yet';
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
    if (s._waking && !waking) say('💭 …', 6);
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
  say('💭 …', 6);
});

// handy for testing in the browser console: window.pipDo({action:'play_piano', ...})
window.pipDo = (last) => startTask({ at: String(Date.now()), thought: '(test)', details: {}, ...last });
window.__debug = { pip, getTask: () => task };
