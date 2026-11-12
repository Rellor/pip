import * as THREE from 'three';
import { awakeMinutes } from './sleep.js';
import { FURNITURE, MOVABLE, pivotOf, placeOf, turn, worldPoint, frontWorld, sideOfVector, SIDE_VECTORS, furnRects } from './furniture.js';

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
// Furniture that can be moved: each piece is a group, put where the saved state says.
const G = Object.fromEntries(MOVABLE.map((k) => [k, new THREE.Group()]));
Object.values(G).forEach((g) => scene.add(g));
scene.background = new THREE.Color(getComputedStyle(document.body).backgroundColor);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
const view = { mode: 'overview', x: 0, z: 3.4, yaw: 0, pitch: 0, keys: new Set(), stick: { x: 0, y: 0 } };
// Overview camera: drag to turn, pinch or scroll to zoom, two fingers (or shift + drag) to move.
const orbit = { az: 0, el: 0, zoom: 1, px: 0, py: 0, pz: 0, fit: 1 };
// The parts of the room that can be seen from the front: the floor and the two back walls.
const ROOM_POINTS = [[-5, 0, -5], [5, 0, -5], [-5, 0, 5], [5, 0, 5], [-5, 5, -5], [5, 5, -5], [-5, 5, 5]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
// How far back the camera must be for the whole room to fit on this screen, however wide or tall it is.
function fitRoom() {
  orbit.fit = 1;
  for (let i = 0; i < 8; i++) {
    const base = new THREE.Vector3(9.5, 9, 11).multiplyScalar(orbit.fit);
    camera.position.set(base.x, 1.2 + base.y, -0.3 + base.z);
    camera.lookAt(0, 1.2, -0.3);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const worst = Math.max(...ROOM_POINTS.map((p) => { const q = p.clone().project(camera); return Math.max(Math.abs(q.x), Math.abs(q.y)); }));
    orbit.fit *= worst / 0.94;
  }
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function applyOrbit() {
  const k = orbit.fit;
  const base = new THREE.Vector3(9.5 * k, 9 * k * (1 + orbit.el), 11 * k).applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit.az).multiplyScalar(orbit.zoom);
  // How high or low the middle of the view may go: the top edge of the screen can reach just above the walls (5 high), the bottom edge the floor.
  const dist = base.length();
  const half = dist * Math.tan((camera.fov * Math.PI) / 360) * Math.sqrt(1 - (base.y / dist) ** 2);
  orbit.py = clamp(orbit.py, Math.min(0, -0.3 + half - 1.2), Math.max(0, 5.3 - half - 1.2));
  const target = new THREE.Vector3(orbit.px, 1.2 + orbit.py, -0.3 + orbit.pz);
  camera.position.copy(target).add(base);
  camera.lookAt(target);
}
function resetOrbit() {
  Object.assign(orbit, { az: 0, el: 0, zoom: 1, px: 0, py: 0, pz: 0 });
  if (view.mode === 'overview') applyOrbit();
}
function fitCamera() {
  const w = stage.clientWidth || 1;
  const h = stage.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (view.mode === 'overview') {
    fitRoom();
    applyOrbit();
  }
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
const rug = cyl(G.rug, [2, 2, 0.04], 0xe3a183, [0, 0.02, 0.8]);
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
// What is outside: a small painted view that follows the real time of day. Pip's photos of "the window" show this.
function paintOutside(date = new Date()) {
  const W = 500;
  const H = 450;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const h = date.getHours() + date.getMinutes() / 60;
  const dark = h < 7 || h >= 20;
  const glow = !dark && (h < 8.5 || h >= 18);
  const sky = g.createLinearGradient(0, 0, 0, H);
  const stops = dark ? ['#0b1226', '#26345c'] : glow ? ['#e58f6a', '#f6d8a8'] : ['#6fb8ee', '#d3ebfb'];
  sky.addColorStop(0, stops[0]);
  sky.addColorStop(1, stops[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  if (dark) {
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(255,255,255,${0.4 + ((k * 31) % 6) / 10})`;
      g.fillRect(((k * 97) % W), ((k * 53) % 240), 2 + (k % 3 === 0 ? 1 : 0), 2 + (k % 3 === 0 ? 1 : 0));
    }
    g.fillStyle = '#fff1b8';
    g.beginPath();
    g.arc(W * 0.74, H * 0.22, 26, 0, Math.PI * 2);
    g.fill();
  } else {
    const t = clamp((h - 7) / 13, 0, 1);
    const sx = W * (0.1 + 0.8 * t);
    const sy = H * 0.5 - Math.sin(Math.PI * t) * H * 0.38;
    const halo = g.createRadialGradient(sx, sy, 6, sx, sy, 70);
    halo.addColorStop(0, 'rgba(255,244,190,0.9)');
    halo.addColorStop(1, 'rgba(255,244,190,0)');
    g.fillStyle = halo;
    g.fillRect(sx - 80, sy - 80, 160, 160);
    g.fillStyle = '#fff4b8';
    g.beginPath();
    g.arc(sx, sy, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = glow ? 'rgba(255,235,220,0.8)' : 'rgba(255,255,255,0.92)';
    for (const [cx, cy, s] of [[110, 90, 1], [330, 60, 1.3], [400, 150, 0.8]]) {
      for (const [dx, dy, r] of [[0, 0, 26], [28, 6, 22], [-28, 8, 20], [8, -12, 20]]) {
        g.beginPath();
        g.ellipse(cx + dx * s, cy + dy * s, r * s * 1.25, r * s * 0.8, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const hill = (base, amp, phase, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) g.lineTo(x, base + Math.sin(x / 70 + phase) * amp + Math.sin(x / 31 + phase * 2) * amp * 0.3);
    g.lineTo(W, H);
    g.fill();
  };
  hill(300, 24, 0.5, dark ? '#16273a' : glow ? '#9bb08a' : '#9ccfae');
  hill(350, 18, 2.4, dark ? '#101d2b' : glow ? '#7d9c6e' : '#76bb8b');
  for (const [tx, ty] of [[90, 372], [170, 384], [380, 366], [440, 380]]) {
    g.fillStyle = dark ? '#0b1620' : '#5a3b24';
    g.fillRect(tx - 3, ty, 6, 22);
    g.fillStyle = dark ? '#0d2218' : '#3f8f58';
    g.beginPath();
    g.moveTo(tx, ty - 46);
    g.lineTo(tx - 20, ty + 4);
    g.lineTo(tx + 20, ty + 4);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const outside = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.8), new THREE.MeshBasicMaterial({ map: paintOutside(), toneMapped: false }));
outside.position.set(0.3, 2.9, -4.895);
scene.add(outside);
setInterval(() => {
  outside.material.map.dispose();
  outside.material.map = paintOutside();
  outside.material.needsUpdate = true;
}, 5 * 60_000);

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
    const print = Boolean(d.print); // a small paper print: white border, thicker at the bottom, almost flat
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(print ? w + 0.04 : w + 0.1, print ? h + 0.07 : h + 0.1, print ? 0.012 : 0.06),
      new THREE.MeshStandardMaterial({ color: print ? 0xf6f3ea : 0x8d5a3b, roughness: 0.8 })
    );
    frame.position.z = print ? 0.01 : 0.04;
    if (print) frame.position.y = -0.015;
    frame.castShadow = true;
    g.add(frame);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    photo.position.z = print ? 0.02 : 0.075;
    g.add(photo);
    new THREE.TextureLoader().setCrossOrigin('anonymous').load(d.image, (tex) => {
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
    if (p.glow) (g.userData.glow ??= []).push({ mat: mesh.material, at: mesh.position, color: p.color });
  }
  g.position.set(...d.pos);
  g.rotation.y = d.rotY || 0;
  g.userData.scale = d.scale || 1;
  g.userData.id = d.id;
  g.userData.info = () => decorInfo(d);
  g.userData.name = d.name;
  g.scale.setScalar(0.001);
  return g;
}
// A thing appears when Pip has walked to its spot (its time in state.json), and pops in.
const SPOT_OF = { piano: 'piano', bookshelf: 'bookshelf', desk: 'computer', bed: 'bed', plant: 'plant' };
// A moved piece stays where it was until Pip gets there (its `at`).
const shownFurniture = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, p]) => [k, p?.from && Date.parse(p.at) > Date.now() ? p.from : p]));
function applyFurniture(s) {
  const furn = shownFurniture(s?.furniture);
  for (const key of MOVABLE) {
    const pl = placeOf(furn, key);
    const [px, pz] = pivotOf(key);
    const [rx, rz] = turn([px, pz], pl.rot);
    slideTo(G[key], pl.x - rx, pl.z - rz, pl.rot);
    const sp = FURNITURE[key].spot;
    if (sp && SPOT_OF[key]) {
      const [wx, wz] = worldPoint(key, pl, sp.p);
      SPOTS[SPOT_OF[key]] = { ...SPOTS[SPOT_OF[key]], p: new V3(wx, 0, wz), face: sp.face + pl.rot };
    }
  }
  for (const r of REGIONS) {
    if (!r.furn) continue;
    const pl = placeOf(furn, r.furn);
    const [x0, x1, y0, y1, z0, z1] = r.box;
    const c = [worldPoint(r.furn, pl, [x0, z0]), worldPoint(r.furn, pl, [x1, z1])];
    r.live = [Math.min(c[0][0], c[1][0]), Math.max(c[0][0], c[1][0]), y0, y1, Math.min(c[0][1], c[1][1]), Math.max(c[0][1], c[1][1])];
  }
}
// A moved thing slides to its new place and Pip pushes it there (free: the page does it).
const slides = new Set();
let pushing = null; // the slide Pip is pushing right now
function slideTo(g, x, z, rot, force) {
  if (!g.userData.placed && !force) {
    g.userData.placed = true;
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    return;
  }
  g.userData.placed = true;
  if (Math.hypot(g.position.x - x, g.position.z - z) < 0.02 && Math.abs(g.rotation.y - rot) < 0.02) return;
  g.userData.slide = { x, z, rot, wait: true, t0: performance.now() };
  slides.add(g);
}
function updateSlides(now, dt) {
  pushing = null;
  for (const g of slides) {
    const sl = g.userData.slide;
    if (!sl || !g.parent) { slides.delete(g); continue; }
    const dx = sl.x - g.position.x;
    const dz = sl.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    let drot = sl.rot - g.rotation.y;
    drot = Math.atan2(Math.sin(drot), Math.cos(drot));
    if (dist < 0.02 && Math.abs(drot) < 0.02) {
      g.position.set(sl.x, 0, sl.z);
      g.rotation.y = sl.rot;
      delete g.userData.slide;
      slides.delete(g);
      continue;
    }
    const ux = dist > 0.01 ? dx / dist : 0;
    const uz = dist > 0.01 ? dz / dist : 0;
    const spot = { p: new V3(g.position.x - ux * 0.85, 0, g.position.z - uz * 0.85), face: Math.atan2(ux, uz) };
    const mine = task && task.at !== 'custom' && task.anim === 'look' && !pushing;
    if (mine) {
      task.spot = spot;
      task.detour = null;
      if (sl.wait && (pip.group.position.distanceTo(spot.p) < 0.3 || now - sl.t0 > 5000)) sl.wait = false;
      pushing = sl;
    } else sl.wait = false; // nobody to wait for: it just slides
    if (sl.wait) continue;
    const step = Math.min(dist, 1.1 * dt);
    g.position.x += ux * step;
    g.position.z += uz * step;
    g.rotation.y += drot * Math.min(1, dt * 4);
  }
}
function updateDecor(s) {
  applyFurniture(s);
  scheduleDue(s);
  const c = s?.chest; // Pip moved his chest
  if (c && Date.parse(c.at) <= Date.now()) {
    chestGroup.position.set(c.x, 0, c.z);
    chestGroup.rotation.y = c.rotY;
    SPOTS.chest = { p: new V3(c.x + Math.sin(c.rotY) * 0.75, 0, c.z + Math.cos(c.rotY) * 0.75), face: Math.PI + c.rotY };
  }
  const list = (s?.decor || []).filter((d) => Date.parse(d.at) <= Date.now());
  const ids = new Set(list.map((d) => d.id));
  for (const [id, g] of decorGroups) {
    if (!ids.has(id)) {
      scene.remove(g);
      decorGroups.delete(id);
    }
  }
  for (const d of list) {
    const have = decorGroups.get(d.id);
    // Pip changed it: the old one goes and the new shape pops in at the same place.
    if (have && d.updatedAt && have.userData.rev !== d.updatedAt && Date.parse(d.updatedAt) <= Date.now()) {
      scene.remove(have);
      decorGroups.delete(d.id);
    } else if (have) {
      setLit(have, litOf(d)); // a lamp Pip switched
      continue;
    }
    const g = buildDecor(d);
    if (have && d.pos && have.position.distanceTo(new V3(d.pos[0], have.position.y, d.pos[2])) > 0.3 && !d.image && d.kind !== 'wall') {
      g.position.x = have.position.x; // a thing that was moved: he pushes it over, it does not jump
      g.position.z = have.position.z;
      g.rotation.y = have.rotation.y;
      slideTo(g, d.pos[0], d.pos[2], d.rotY || 0, true);
    }
    g.userData.lit = true;
    setLit(g, litOf(d));
    g.userData.rev = d.updatedAt || null;
    if (d.updatedAt && Date.parse(d.updatedAt) > Date.now()) g.userData.rev = null;
    g.userData.born = performance.now() - Math.min(Date.now() - Date.parse(d.at), 5000); // old things are simply there
    scene.add(g);
    decorGroups.set(d.id, g);
    if (d.song && audio?.state === 'running' && Date.now() - Date.parse(d.at) < 8000) playSong(d.song);
  }
}
// Things Pip placed count from a moment in the near future (so they appear when he walks there). Show them exactly then, not at the next refresh.
let dueTimer = null;
function scheduleDue(s) {
  clearTimeout(dueTimer);
  const now = Date.now();
  const times = [...(s?.decor || []).flatMap((d) => [d.at, d.updatedAt]), s?.chest?.at, ...Object.values(s?.furniture || {}).map((f) => f?.at)].map((t) => Date.parse(t)).filter((t) => t > now);
  if (!times.length) return;
  dueTimer = setTimeout(() => lastState && updateDecor(lastState), Math.min(...times) - now + 300);
}
// ---- What things DO when they are used (light, drive, spin). The data says what it does; the page plays it.
// A lamp is lit unless Pip switched it off. Before his switch is due (litAt) it still shows the old state.
const litOf = (d) => (d.litAt && Date.parse(d.litAt) > Date.now() ? d.lit === false : d.lit !== false);
function setLit(g, on) {
  const list = g.userData.glow;
  if (!list || g.userData.lit === on) return;
  g.userData.lit = on;
  for (const x of list) x.mat.emissiveIntensity = on ? 0.9 : 0;
  if (!g.userData.lamp) {
    const l = new THREE.PointLight(new THREE.Color(list[0].color), 0, 3);
    l.position.copy(list[0].at);
    g.add(l);
    g.userData.lamp = l;
  }
  g.userData.lamp.intensity = on ? 1.6 : 0;
}
const behaviors = new Map(); // thing id -> what it is doing now
const floorBlocked = (x, z, skipId) => {
  if (Math.abs(x) > 4.55 || Math.abs(z) > 4.55) return true;
  const furn = shownFurniture(lastState?.furniture);
  for (const k of MOVABLE) {
    if (FURNITURE[k].flat) continue;
    for (const r of furnRects(furn, k)) if (x > r.x0 - 0.25 && x < r.x1 + 0.25 && z > r.z0 - 0.25 && z < r.z1 + 0.25) return true;
  }
  return (lastState?.decor || []).some((o) => o.id !== skipId && o.kind === 'floor' && !o.image && o.pos && Math.hypot(o.pos[0] - x, o.pos[2] - z) < 0.55);
};
const DEFAULT_MOTION = [{ forward: 1.0 }, { turn: 90, forward: 0.9 }, { turn: 90, forward: 1.0 }, { turn: 120, forward: 0.8 }];
// The steps of a drive as little legs: turn on the spot, roll forward or back, hop, wait. It stops at the first thing in the way, then comes back.
function planDrive(g, id, motion) {
  const start = g.position.clone();
  const rot0 = g.rotation.y;
  let h = rot0;
  const p = start.clone();
  const legs = [];
  let bumped = false;
  for (const m of motion) {
    if (m.turn) {
      h += (m.turn * Math.PI) / 180;
      legs.push({ kind: 'turn', face: h });
    }
    if (m.forward) {
      const dir = Math.sign(m.forward);
      let ok = 0;
      for (let k = 1; k <= 8; k++) {
        const f = (m.forward * k) / 8;
        if (floorBlocked(p.x + Math.sin(h) * f, p.z + Math.cos(h) * f, id)) {
          bumped = true;
          break;
        }
        ok = f;
      }
      if (Math.abs(ok) > 0.05) {
        p.x += Math.sin(h) * ok;
        p.z += Math.cos(h) * ok;
        legs.push({ kind: 'move', to: p.clone(), face: h, back: dir < 0 });
      }
    }
    if (m.hop) legs.push({ kind: 'hop', h: m.hop, t: 0.35 });
    if (m.wait) legs.push({ kind: 'wait', t: m.wait });
    if (bumped) {
      legs.push({ kind: 'wait', t: 0.4 });
      break;
    }
  }
  if (p.distanceTo(start) > 0.05) {
    legs.push({ kind: 'turn', face: Math.atan2(start.x - p.x, start.z - p.z) });
    legs.push({ kind: 'move', to: start.clone(), face: Math.atan2(start.x - p.x, start.z - p.z), back: false });
  }
  legs.push({ kind: 'turn', face: rot0 });
  return legs;
}
// One step of a custom movement at progress k (0 to 1). Parts move from where they started, plus what the steps before them did.
function applyCustom(b, step, k) {
  const e = k * k * (3 - 2 * k);
  const i = (step.part || 1) - 1;
  const mesh = b.parts[i];
  if (step.do === 'rotate_part' && mesh) {
    const t = b.turned[i];
    if (!t.set) Object.assign(t, { set: true, axis: step.axis || 'y', hinge: step.hinge || 'center', base: 0 });
    if (b.curStep !== step) { b.curStep = step; t.base = t.a; }
    const a = t.base + ((step.deg || 0) * e * Math.PI) / 180;
    t.a = a;
    mesh.geometry.computeBoundingBox();
    const hb = mesh.geometry.boundingBox;
    const h = new THREE.Vector3((hb.max.x - hb.min.x) / 2, (hb.max.y - hb.min.y) / 2, (hb.max.z - hb.min.z) / 2);
    const off = { left: [-h.x, 0, 0], right: [h.x, 0, 0], top: [0, h.y, 0], bottom: [0, -h.y, 0], front: [0, 0, h.z], back: [0, 0, -h.z], center: [0, 0, 0] }[t.hinge];
    const axis = new THREE.Vector3(...{ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[t.axis]);
    const q = new THREE.Quaternion().setFromAxisAngle(axis, a);
    const pivot = new THREE.Vector3(...off).applyQuaternion(b.snap[i].q).add(b.snap[i].p);
    mesh.quaternion.copy(q).multiply(b.snap[i].q);
    mesh.position.copy(b.snap[i].p).sub(pivot).applyQuaternion(q).add(pivot);
    const s = b.slid[i];
    mesh.position.add(new THREE.Vector3(...s));
  } else if (step.do === 'slide_part' && mesh) {
    const s = b.slid[i];
    if (b.curStep !== step) { b.curStep = step; step._from = [...s]; }
    for (let j = 0; j < 3; j++) s[j] = step._from[j] + (step.d?.[j] || 0) * e;
    mesh.position.copy(b.snap[i].p).add(new THREE.Vector3(...s));
  } else if (step.do === 'glow' && mesh) {
    mesh.material.emissiveIntensity = step.on === false ? 0 : 0.9;
    if (step.on !== false) mesh.material.emissive.copy(mesh.material.color);
  } else if (step.do === 'spin') {
    if (b.curStep !== step) { b.curStep = step; b.spun0 = b.spun; }
    b.spun = b.spun0 + (step.turns || 1) * e * Math.PI * 2;
    b.parts[0].parent.rotation.y = b.y0 + b.spun;
  }
}
function runBehavior(id, does, motion) {
  const g = decorGroups.get(id);
  if (!g || behaviors.has(id)) return;
  const now = performance.now();
  if (does === 'light') return setLit(g, !g.userData.lit);
  if (does === 'custom') {
    const steps = (Array.isArray(motion) ? motion : []).slice(0, 10);
    const parts = g.children.filter((c) => c.isMesh);
    if (!steps.length || !parts.length) return;
    return behaviors.set(id, { does, steps, i: -1, t: 0, parts, snap: parts.map((p) => ({ p: p.position.clone(), q: p.quaternion.clone(), glow: p.material.emissiveIntensity })), turned: parts.map(() => ({ a: 0, axis: 'y', hinge: 'center' })), slid: parts.map(() => [0, 0, 0]), y0: g.rotation.y, spun: 0 });
  }
  if (does === 'spin') return behaviors.set(id, { does, t0: now, until: now + 3500, y0: g.rotation.y });
  if (does === 'drive') {
    const legs = planDrive(g, id, motion?.length ? motion : DEFAULT_MOTION);
    if (legs.length < 2) return;
    behaviors.set(id, { does, legs, i: 0, y0: g.rotation.y, y: g.position.y, t: 0 });
  }
}
function updateBehaviors(now, dt) {
  for (const [id, b] of behaviors) {
    const g = decorGroups.get(id);
    if (!g) {
      behaviors.delete(id);
      continue;
    }
    if (b.does === 'custom') {
      const step = b.steps[b.i];
      if (!step || b.t >= (step.s || 0.8)) { // next step (or done: everything goes back)
        if (step) applyCustom(b, step, 1);
        b.i++;
        b.t = 0;
        if (b.i >= b.steps.length) {
          b.parts.forEach((p, k) => { p.position.copy(b.snap[k].p); p.quaternion.copy(b.snap[k].q); p.material.emissiveIntensity = b.snap[k].glow; });
          g.rotation.y = b.y0;
          behaviors.delete(id);
        } else if (b.steps[b.i].do === 'glow') applyCustom(b, b.steps[b.i], 1);
        continue;
      }
      b.t += dt;
      applyCustom(b, step, Math.min(1, b.t / (step.s || 0.8)));
      continue;
    }
    if (b.does === 'spin') {
      g.rotation.y = b.y0 + ((now - b.t0) / 1000) * 5;
      if (now > b.until) {
        g.rotation.y = b.y0;
        behaviors.delete(id);
      }
      continue;
    }
    const leg = b.legs[b.i];
    if (!leg) {
      g.position.y = b.y;
      behaviors.delete(id);
      continue;
    }
    const next = () => {
      b.i++;
      b.t = 0;
    };
    if (leg.kind === 'turn' || leg.kind === 'move') {
      let diff = leg.face - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), dt * 4.5);
      if (leg.kind === 'turn') {
        if (Math.abs(diff) < 0.03) next();
      } else {
        const dx = leg.to.x - g.position.x;
        const dz = leg.to.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.04) next();
        else {
          const step = Math.min(dist, dt * 1.0);
          g.position.x += (dx / dist) * step;
          g.position.z += (dz / dist) * step;
        }
      }
    } else if (leg.kind === 'hop') {
      b.t += dt;
      g.position.y = b.y + Math.sin(Math.min(1, b.t / leg.t) * Math.PI) * leg.h;
      if (b.t >= leg.t) {
        g.position.y = b.y;
        next();
      }
    } else if (leg.kind === 'wait') {
      b.t += dt;
      if (b.t >= leg.t) next();
    }
  }
}
function popDecor(now) {
  for (const g of decorGroups.values()) {
    const k = Math.min(1, (now - g.userData.born) / 700);
    const ease = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // small overshoot, then settles
    g.scale.setScalar(Math.max(0.001, g.userData.scale * (k >= 1 ? 1 : ease)));
  }
}

// Clothes Pip made: a few shapes on a spot of his body. They move with him.
const clothesGroups = new Map();
function buildClothes(c) {
  const g = new THREE.Group();
  for (const p of c.parts || []) {
    const geo = SHAPE_GEO[p.shape];
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo(p.size), new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7, emissive: p.glow ? p.color : 0x000000, emissiveIntensity: p.glow ? 0.9 : 0 }));
    mesh.position.set(...p.pos);
    mesh.rotation.set(...p.rot.map((r) => (r * Math.PI) / 180));
    mesh.castShadow = true;
    g.add(mesh);
  }
  g.position.set(...c.at);
  g.scale.setScalar(c.scale || 1);
  return g;
}
function syncClothes(s) {
  const worn = (s?.wardrobe || []).filter((c) => c.worn && Date.parse(c.wornAt) <= Date.now());
  const rev = (c) => `${c.madeAt}|${c.wornAt}`;
  for (const [id, g] of clothesGroups) {
    const c = worn.find((x) => x.id === id);
    if (!c || g.userData.rev !== rev(c)) {
      pip.body.remove(g);
      clothesGroups.delete(id);
    }
  }
  for (const c of worn) {
    if (clothesGroups.has(c.id)) continue;
    const g = buildClothes(c);
    g.userData.rev = rev(c);
    pip.body.add(g);
    clothesGroups.set(c.id, g);
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
box(G.piano, [2.6, 1.3, 0.9], 0x2a2a2e, [PIANO.x, 0.65, PIANO.z]);
box(G.piano, [2.7, 0.1, 1], 0x1d1d20, [PIANO.x, 1.35, PIANO.z]);
box(G.piano, [2.4, 0.1, 0.5], 0x1d1d20, [PIANO.x, 0.85, PIANO.z + 0.65]);
const keys = {};
'CDEFGAB'.split('').forEach((n, i) => {
  keys[n] = box(G.piano, [0.29, 0.08, 0.4], 0xfdfdf8, [PIANO.x + (i - 3) * 0.32, 0.93, PIANO.z + 0.72]);
});
[0, 1, 3, 4, 5].forEach((i) => box(G.piano, [0.15, 0.08, 0.24], 0x111111, [PIANO.x + (i - 3) * 0.32 + 0.16, 1.0, PIANO.z + 0.65]));
cyl(G.piano, [0.06, 0.06, 0.5], 0x6b4a33, [PIANO.x, 0.28, -3.15]);
cyl(G.piano, [0.38, 0.38, 0.12], 0xc9604a, [PIANO.x, 0.55, -3.15]);

// bookshelf
const shelf = new THREE.Group();
shelf.position.set(2.6, 0, -4.65);
G.bookshelf.add(shelf);
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
box(G.desk, [1.3, 0.1, 2], 0xb98a62, [-4.3, 0.8, 1.2]);
box(G.desk, [0.1, 0.8, 1.9], 0x9a6f4b, [-3.75, 0.4, 1.2]);
box(G.desk, [0.1, 0.8, 1.9], 0x9a6f4b, [-4.85, 0.4, 1.2]);
box(G.desk, [0.1, 0.8, 1.1], 0x222222, [-4.55, 1.3, 1.2]);
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
const screenMesh = box(G.desk, [0.02, 0.65, 0.95], 0x8fd3ff, [-4.49, 1.3, 1.2]);
screenMesh.material = new THREE.MeshBasicMaterial({ map: screenTex });
box(G.desk, [0.1, 0.3, 0.2], 0x222222, [-4.55, 0.95, 1.2]);
box(G.desk, [0.4, 0.04, 0.8], 0x444444, [-4.0, 0.87, 1.2]);
// photo printer on the desk (faces into the room); its little light blinks while he prints
box(G.desk, [0.26, 0.1, 0.3], 0xe9e4da, [-3.84, 0.92, 0.5]);
box(G.desk, [0.22, 0.03, 0.24], 0xcfc8ba, [-3.85, 0.985, 0.5]);
box(G.desk, [0.012, 0.016, 0.18], 0x2a2a2a, [-3.708, 0.93, 0.5]);
const printLight = box(G.desk, [0.03, 0.012, 0.03], 0x2f6b3a, [-3.76, 1.004, 0.38]);
printLight.material = new THREE.MeshBasicMaterial({ color: 0x2f6b3a });

// bed
box(G.bed, [2.2, 0.4, 3.2], 0x8d5a3b, [3.4, 0.2, 3]);
box(G.bed, [2, 0.3, 3], 0xcfe3f3, [3.4, 0.55, 3]);
box(G.bed, [1.4, 0.2, 0.6], 0xffffff, [3.4, 0.8, 1.85]);

// plant
cyl(G.plant, [0.3, 0.22, 0.4], 0xc9604a, [4.1, 0.2, -4.1]);
[[0, 0.75, 0, 0.42], [0.18, 1.05, 0.05, 0.3], [-0.15, 1.0, -0.05, 0.28]].forEach(([x, y, z, r]) => {
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(0x6fae6f));
  leaf.position.set(4.1 + x, y, -4.1 + z);
  leaf.castShadow = true;
  G.plant.add(leaf);
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
    const m = /^([A-G])([#b]?)(\d)?(?::[\d.]+)?$/.exec(tok);
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
// What Pip played on the piano ("C4 E4:2 - G4", the style) as a song the player can hear again: :n is how many beats, - is a rest.
function pianoSong(notesText, style) {
  const notes = [];
  for (const tok of String(Array.isArray(notesText) ? notesText.join(' ') : notesText ?? '').split(/[\s,;|/]+/).filter(Boolean).slice(0, 80)) {
    if (/^-+$/.test(tok)) {
      notes.push([null, 1]);
      continue;
    }
    const m = /^([A-G])([#b]?)(\d)?(?::([\d.]+))?$/.exec(tok);
    if (!m) continue;
    notes.push([`${m[1]}${m[2]}${m[3] ?? 4}`, Math.min(4, Math.max(0.25, Number(m[4]) || 1))]);
  }
  if (!notes.some(([n]) => n)) return null;
  const st = String(style || '').toLowerCase();
  return { notes, tempo: /slow|sad|soft|gentle|calm|sleep|dream|quiet/.test(st) ? 62 : /fast|happy|quick|bright|fun|dance/.test(st) ? 130 : 92, timbre: 'piano' };
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
  unlockAudio();
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  const on = audio.state !== 'running';
  (on ? audio.resume() : audio.suspend()).then(() => {
    $('sound').textContent = on ? '🔊 Sound on' : '🔇 Sound off';
  });
});
// ---- songs and sounds: what Pip makes can play a tune and a background sound (a short list of notes, a tempo, a voice, rain...)
// Everything goes through one master volume and a limiter, so a phone speaker is loud enough and never crackles.
let master = null;
let unlocked = false;
// An iPhone on silent mode mutes web sound unless the page says it is "playback". A silent clip does the same on older ones.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {}
  try {
    const a = new Audio(SILENT_WAV);
    a.loop = true;
    a.play().then(() => setTimeout(() => a.pause(), 300)).catch(() => {});
  } catch {}
}
async function ensureAudio() {
  unlockAudio();
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state !== 'running') await audio.resume();
  if (!master) {
    const comp = audio.createDynamicsCompressor();
    master = audio.createGain();
    master.gain.value = 1.3;
    master.connect(comp).connect(audio.destination);
  }
  $('sound').textContent = '🔊 Sound on';
}
function noteFreq(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) return null;
  const semi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** (Number(m[3]) - 4 + (semi - 9) / 12);
}
const VOICES = {
  piano: { parts: [[1, 'triangle', 0.35], [2, 'sine', 0.12]], attack: 0.015, release: 1.4 },
  musicbox: { parts: [[1, 'sine', 0.3], [3, 'sine', 0.12], [6, 'sine', 0.05]], attack: 0.005, release: 0.9 },
  bell: { parts: [[1, 'sine', 0.28], [2.76, 'sine', 0.14], [5.4, 'sine', 0.05]], attack: 0.005, release: 2.2 },
  soft: { parts: [[1, 'sine', 0.22], [2, 'sine', 0.05]], attack: 0.22, release: 1.3 },
  pluck: { parts: [[1, 'sawtooth', 0.12], [2, 'triangle', 0.14]], attack: 0.004, release: 0.5, hold: 0.12 },
  flute: { parts: [[1, 'sine', 0.3], [2, 'sine', 0.06], [3, 'sine', 0.02]], attack: 0.09, release: 0.35, vibrato: 5.5 },
  pad: { parts: [[1, 'sawtooth', 0.07], [1.005, 'sawtooth', 0.07], [0.5, 'sine', 0.12]], attack: 0.5, release: 1.8 },
  marimba: { parts: [[1, 'sine', 0.34], [4, 'sine', 0.1]], attack: 0.003, release: 0.45, hold: 0.1 },
};
function voice(freq, t, hold, timbre) {
  const v = VOICES[timbre] || VOICES.piano;
  const len = v.hold ?? Math.max(v.attack, hold);
  for (const [mult, type, vol] of v.parts) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq * mult;
    if (v.vibrato) {
      const lfo = audio.createOscillator();
      const depth = audio.createGain();
      lfo.frequency.value = v.vibrato;
      depth.gain.value = freq * mult * 0.008;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + len + v.release + 0.1);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + v.attack);
    g.gain.setValueAtTime(vol, t + Math.max(v.attack, len));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(v.attack, len) + v.release);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + Math.max(v.attack, len) + v.release + 0.1);
  }
}
let noiseBuffer = null;
function noise(kind) {
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate * 4, audio.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = audio.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}
// Drums are short bursts of tone and noise.
function drum(kind, t) {
  if (kind === 'kick') {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.35);
    return;
  }
  const src = noise();
  const f = audio.createBiquadFilter();
  const g = audio.createGain();
  f.type = kind === 'hat' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'hat' ? 7000 : 1800;
  g.gain.setValueAtTime(kind === 'hat' ? 0.25 : 0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hat' ? 0.06 : 0.18));
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.25);
}
// A background sound that lasts `secs` seconds: rain, wind, waves, fire, crickets or a low hum.
function ambience(kind, t, secs) {
  const out = audio.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + Math.min(1.5, secs / 4));
  out.gain.setValueAtTime(1, t + Math.max(0.1, secs - 1.5));
  out.gain.exponentialRampToValueAtTime(0.0001, t + secs);
  out.connect(master);
  const stopAt = t + secs + 0.2;
  const slow = (freq, depth, param) => {
    const lfo = audio.createOscillator();
    const d = audio.createGain();
    lfo.frequency.value = freq;
    d.gain.value = depth;
    lfo.connect(d).connect(param);
    lfo.start(t);
    lfo.stop(stopAt);
  };
  const layer = (type, freq, q, vol) => {
    const src = noise();
    const f = audio.createBiquadFilter();
    const g = audio.createGain();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.value = vol;
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(stopAt);
    return { f, g };
  };
  if (kind === 'rain') {
    layer('highpass', 1200, 0.5, 0.22);
    layer('bandpass', 5000, 0.8, 0.18);
  } else if (kind === 'wind') {
    const { f, g } = layer('bandpass', 500, 1.2, 0.5);
    slow(0.11, 300, f.frequency);
    slow(0.17, 0.25, g.gain);
  } else if (kind === 'waves') {
    const { g } = layer('lowpass', 700, 0.7, 0.35);
    slow(0.13, 0.3, g.gain);
  } else if (kind === 'fire') {
    layer('lowpass', 400, 0.7, 0.4);
    for (let x = t + 0.2; x < t + secs; x += 0.05 + Math.random() * 0.4) {
      const src = noise();
      const f = audio.createBiquadFilter();
      const g = audio.createGain();
      f.type = 'highpass';
      f.frequency.value = 2000 + Math.random() * 3000;
      g.gain.setValueAtTime(0.25 + Math.random() * 0.3, x);
      g.gain.exponentialRampToValueAtTime(0.0001, x + 0.03 + Math.random() * 0.05);
      src.connect(f).connect(g).connect(out);
      src.start(x);
      src.stop(x + 0.12);
    }
  } else if (kind === 'crickets') {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 4300;
    g.gain.value = 0;
    slow(14, 0.05, g.gain); // the chirp
    const gate = audio.createGain();
    gate.gain.value = 0.5;
    slow(1.3, 0.5, gate.gain); // chirps come in bursts
    o.connect(g).connect(gate).connect(out);
    o.start(t);
    o.stop(stopAt);
  } else if (kind === 'hum') {
    for (const [freq, vol] of [[110, 0.14], [165, 0.07], [220, 0.04]]) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = freq;
      g.gain.value = vol;
      slow(0.2, vol * 0.4, g.gain);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(stopAt);
    }
  }
}
// Plays a song or sound. Returns how many seconds it lasts.
// The photo printer: a short beep, a buzzing print head that stutters like paper being fed, and a click when the print is done.
// Only plays when the viewer has turned the sound on.
function printerSound() {
  if (!audio || audio.state !== 'running' || !master) return;
  const t = audio.currentTime + 0.05;
  const len = 3.6;
  const beep = audio.createOscillator();
  const beepGain = audio.createGain();
  beep.type = 'square';
  beep.frequency.value = 1320;
  beepGain.gain.setValueAtTime(0.0001, t);
  beepGain.gain.linearRampToValueAtTime(0.05, t + 0.01);
  beepGain.gain.linearRampToValueAtTime(0.0001, t + 0.09);
  beep.connect(beepGain).connect(master);
  beep.start(t);
  beep.stop(t + 0.1);
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * len), audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = audio.createBufferSource();
  noise.buffer = buf;
  const band = audio.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 4;
  band.frequency.setValueAtTime(900, t + 0.2);
  band.frequency.linearRampToValueAtTime(2400, t + len - 0.3); // the head moves across the paper
  const gate = audio.createGain();
  gate.gain.value = 0;
  for (let s = t + 0.25; s < t + len - 0.3; s += 0.07) {
    gate.gain.setValueAtTime(0.16, s);
    gate.gain.setValueAtTime(0.03, s + 0.035);
  }
  gate.gain.setValueAtTime(0, t + len - 0.25);
  noise.connect(band).connect(gate).connect(master);
  noise.start(t);
  const click = audio.createOscillator();
  const clickGain = audio.createGain();
  click.type = 'triangle';
  click.frequency.value = 260;
  clickGain.gain.setValueAtTime(0.0001, t + len - 0.2);
  clickGain.gain.linearRampToValueAtTime(0.12, t + len - 0.19);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t + len - 0.06);
  click.connect(clickGain).connect(master);
  click.start(t + len - 0.2);
  click.stop(t + len);
}
async function playSong(song) {
  if (!song || (!song.notes?.length && !song.ambience)) return 0;
  await ensureAudio();
  const beat = 60 / (song.tempo || 90);
  const start = audio.currentTime + 0.1;
  let t = start;
  for (const [n, beats] of song.notes || []) {
    if (n === 'kick' || n === 'snare' || n === 'hat') drum(n, t);
    else {
      const f = n ? noteFreq(n) : null;
      if (f) voice(f, t, beat * beats * 0.9, song.timbre);
    }
    t += beat * beats;
  }
  const secs = Math.max(t - start, song.ambience ? song.seconds || 20 : 0);
  if (song.ambience) ambience(song.ambience, start, secs);
  return secs;
}
function songButton(song) {
  const b = el('button', '▶ Hear it', 'small');
  b.addEventListener('click', async () => {
    b.disabled = true;
    const secs = await playSong(song);
    b.textContent = '♪ playing…';
    setTimeout(() => {
      b.textContent = '▶ Hear it again';
      b.disabled = false;
    }, Math.min(secs, 90) * 1000);
  });
  return b;
}

// ---- apps Pip writes: they run only when opened, in a locked box (no internet, no saving, no way out)
const APP_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'";
async function openApp(app) {
  try {
    const res = await fetch(`${app.file}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('missing');
    const html = await res.text();
    $('appframe').srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${APP_CSP}">${html}`;
    $('apptitle').textContent = app.name;
    $('appview').hidden = false;
  } catch {
    $('replystatus').textContent = 'I could not open that app.';
  }
}
function closeApp() {
  $('appview').hidden = true;
  $('appframe').srcdoc = '';
}
function appButton(app) {
  const b = el('button', '▶ Open the app', 'small');
  b.addEventListener('click', () => openApp(app));
  return b;
}
window.addEventListener('message', (e) => {
  if (e.source === $('appframe').contentWindow && e.data && e.data.__pipTest) window.__appReport = e.data; // only used by tests
});
$('appclose').addEventListener('click', closeApp);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('appview').hidden) closeApp();
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
  const map = [[/berr|strawberr/, '🍓'], [/apple/, '🍎'], [/bread|toast|bun/, '🍞'], [/tea|coffee|cocoa/, '☕'], [/soup|stew/, '🍲'], [/cookie|biscuit/, '🍪'], [/cake|pie/, '🍰'], [/cheese/, '🧀'], [/honey/, '🍯'], [/rice|noodle|pasta/, '🍜'], [/fish/, '🐟'], [/carrot/, '🥕'], [/egg/, '🥚'], [/potato/, '🥔'], [/onion|garlic/, '🧅'], [/tomato/, '🍅'], [/mushroom/, '🍄'], [/butter/, '🧈'], [/flour|wheat|oat|grain/, '🌾'], [/sugar|salt|spice|herb|pepper/, '🧂'], [/corn/, '🌽'], [/lemon|orange/, '🍋'], [/bean|pea/, '🫘'], [/nut|seed/, '🥜'], [/pear/, '🍐'], [/banana/, '🍌'], [/grape/, '🍇'], [/milk/, '🥛']];
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
    case 'do': {
      const mv = d.move ? (lastState?.moves || []).find((m) => m.name.toLowerCase() === String(d.move).toLowerCase()) : null;
      const where = d.where ? resolveSpot(d.where) : 'center';
      return mv ? { at: where, anim: 'move', move: mv } : { at: where, anim: 'look' };
    }
    case 'make_move': return { at: 'center', anim: 'look' };
    case 'blueprint': return { at: 'computer', anim: 'write' };
    case 'print_photo': return { at: 'computer', anim: 'look' };
    case 'move_thing':
    case 'extend_thing': return { at: 'center', anim: 'look' };
    case 'remove_decoration': return last.made?.chest ? { at: 'chest', anim: 'stash' } : { at: 'center', anim: 'look' };
    case 'compose':
    case 'add_use': return { at: 'center', anim: 'write' };
    case 'use': {
      const m = last.made;
      if (!m?.stand) return { at: 'center', anim: 'look' };
      const [sx, sz] = m.stand;
      const climbs = m.does === 'stand' || (m.does === 'custom' && (m.steps || []).some((x) => x.do === 'climb'));
      if (climbs && m.height) return { at: 'custom', anim: 'look', spot: { p: new V3(m.pos[0], 0, m.pos[2]), face: Math.atan2(m.pos[0] - sx, m.pos[2] - sz), y: m.height } }; // he climbs on top of it
      return { at: 'custom', anim: 'look', spot: { p: new V3(sx, 0, sz), face: Math.atan2(m.pos[0] - sx, m.pos[2] - sz) } };
    }
    case 'make_app':
    case 'update_app': return { at: 'computer', anim: 'search' };
    case 'make_clothes':
    case 'wear':
    case 'take_off': return { at: 'center', anim: 'look' };
    case 'take_out':
    case 'change_thing':
    case 'place_picture':
    case 'draw':
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
// A move is a few poses over time (see moves.js). Between two poses it eases; the last one leads back to the first.
let preview = null;
const ease = (x) => x * x * (3 - 2 * x);
// Little things he does by himself when a step is quick and he is just standing there (not sleeping): free, no tokens, played by the page.
// They use the same pose data as the moves Pip designs.
const IDLES = [
  { id: 'idle-look', duration: 4.5, frames: [{ at: 0 }, { at: 0.2, turn: -0.9 }, { at: 0.45, turn: -0.9 }, { at: 0.65, turn: 0.9 }, { at: 0.85, turn: 0.9 }, { at: 1 }] },
  { id: 'idle-stretch', duration: 3.2, frames: [{ at: 0 }, { at: 0.3, armL: 1, armR: 1, lean: -0.2, spread: 0.2, eyes: 0.8 }, { at: 0.65, armL: 1, armR: 1, lean: -0.2, spread: 0.2, eyes: 0.8 }, { at: 1 }] },
  { id: 'idle-yawn', duration: 3, frames: [{ at: 0 }, { at: 0.35, lean: -0.25, armL: 0.5, armR: 0.5, eyes: 1 }, { at: 0.7, lean: -0.25, armL: 0.5, armR: 0.5, eyes: 1, sign: '…' }, { at: 1 }] },
  { id: 'idle-sway', duration: 3.4, frames: [{ at: 0 }, { at: 0.25, tilt: 0.14 }, { at: 0.75, tilt: -0.14 }, { at: 1 }] },
  { id: 'idle-tap', duration: 2.4, frames: [{ at: 0 }, { at: 0.15, footR: 1 }, { at: 0.3 }, { at: 0.45, footR: 1 }, { at: 0.6 }, { at: 1 }] },
  { id: 'idle-hop', duration: 1.6, frames: [{ at: 0 }, { at: 0.25, hop: 0.16 }, { at: 0.5 }, { at: 0.75, hop: 0.12 }, { at: 1 }] },
  { id: 'idle-think', duration: 4, frames: [{ at: 0 }, { at: 0.2, tilt: 0.3, armR: 0.9, armL: 0.1 }, { at: 0.8, tilt: 0.3, armR: 0.9, armL: 0.1, sign: '?' }, { at: 1 }] },
  { id: 'idle-hum', duration: 4, frames: [{ at: 0 }, { at: 0.2, tilt: 0.12, sign: '♪' }, { at: 0.5, tilt: -0.12 }, { at: 0.7, tilt: 0.12, sign: '♪' }, { at: 1 }] },
  { id: 'idle-sit', duration: 9, frames: [{ at: 0 }, { at: 0.12, hop: -0.24, lean: 0.12 }, { at: 0.85, hop: -0.24, lean: 0.12 }, { at: 1 }] },
  { id: 'idle-shrug', duration: 1.8, frames: [{ at: 0 }, { at: 0.3, spread: 0.6, armL: 0.3, armR: 0.3, hop: 0.05 }, { at: 0.7, spread: 0.6, armL: 0.3, armR: 0.3, hop: 0.05 }, { at: 1 }] },
];
let lastIdle = '';
function pickIdle() {
  const options = IDLES.filter((m) => m.id !== lastIdle);
  const m = options[Math.floor(Math.random() * options.length)];
  lastIdle = m.id;
  return m;
}
function movePose(mv, ms) {
  const keys = ['hop', 'lean', 'turn', 'tilt', 'armL', 'armR', 'spread', 'footL', 'footR'];
  const f = [...mv.frames];
  const first = f[0];
  if (first.at > 0) f.unshift({ ...first, at: 0 });
  f.push({ ...f[0], at: 1 });
  const x = ((ms / 1000) / (mv.duration || 2)) % 1;
  let i = 0;
  while (i < f.length - 2 && x >= f[i + 1].at) i++;
  const a = f[i];
  const b = f[i + 1];
  const k = b.at > a.at ? ease(Math.min(1, Math.max(0, (x - a.at) / (b.at - a.at)))) : 1;
  const pose = Object.fromEntries([...keys, 'eyes'].map((key) => [key, (a[key] || 0) + ((b[key] || 0) - (a[key] || 0)) * k]));
  // sounds and symbols fire once each time the move passes their pose
  const cycle = Math.floor(ms / 1000 / (mv.duration || 2));
  if (mvTrig.id !== mv.id || mvTrig.cycle !== cycle) Object.assign(mvTrig, { id: mv.id, cycle, done: new Set() });
  mv.frames.forEach((fr, i) => {
    if ((fr.sound || fr.sign) && x >= fr.at && !mvTrig.done.has(i)) {
      mvTrig.done.add(i);
      if (fr.sound) moveSound(fr.sound);
      if (fr.sign) floatSign(fr.sign, '#ffd27a', headPos().add(new V3(rand(-0.3, 0.3), 0.1, 0)), { life: 1.6, rise: 0.5, size: 0.5 });
    }
  });
  return pose;
}
const mvTrig = { id: null, cycle: -1, done: new Set() };
// Small synthesized sounds for moves.
function moveSound(kind) {
  if (!audio || audio.state !== 'running' || !master) return;
  const t = audio.currentTime + 0.02;
  const blip = (type, f0, f1, len, vol, at = 0) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t + at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + at + len);
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.linearRampToValueAtTime(vol, t + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
    o.connect(g).connect(master);
    o.start(t + at);
    o.stop(t + at + len + 0.02);
  };
  if (kind === 'chirp') { blip('sine', 1400, 2200, 0.1, 0.12); blip('sine', 1800, 2600, 0.1, 0.1, 0.12); }
  else if (kind === 'boing') blip('sine', 180, 520, 0.35, 0.2);
  else if (kind === 'pop') blip('triangle', 700, 120, 0.08, 0.22);
  else if (kind === 'sparkle') [1568, 1976, 2349, 2637].forEach((f, i) => blip('sine', f, f * 1.01, 0.18, 0.07, i * 0.06));
  else if (kind === 'hum') { blip('triangle', 196, 200, 0.9, 0.09); blip('sine', 392, 396, 0.9, 0.04); }
  else if (kind === 'sigh') blip('sine', 520, 260, 0.7, 0.07);
  else if (kind === 'whoosh') {
    const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.5), audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = audio.createBufferSource();
    src.buffer = buf;
    const f = audio.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2800, t + 0.45);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }
}
function startTask(last) {
  const plan = planFor(last);
  if (last.action === 'use' && last.made?.id && last.made.does === 'custom') setTimeout(() => runBehavior(last.made.id, 'custom', last.made.steps), 2500);
  if (last.action === 'use' && last.made?.id && ['drive', 'spin'].includes(last.made.does)) setTimeout(() => runBehavior(last.made.id, last.made.does, last.made.motion), 2500); // when he has walked up to it
  task = { ...plan, spot: plan.spot || SPOTS[plan.at], last, arrived: false, detour: null, phrase: null, nextPhraseAt: 0, nextBreak: Infinity, askUntil: 0 };
}
function startPhrase(notes, step, now) {
  task.phrase = { notes, step, t0: now, lastIdx: -1 };
  playNotes(notes, step);
}
// Walking: go round furniture and things on the floor instead of through them (free: the page does it).
// Near his goal he walks straight so he can still reach it.
let steerSide = 1; // once he picks a side to go round, he keeps it (no dithering in front of a wall)
function steer(pos, dir, dist) {
  if (dist < 0.8) return dir;
  const tryAngle = (a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const d = new V3(dir.x * c - dir.z * s, 0, dir.x * s + dir.z * c);
    return floorBlocked(pos.x + d.x * 0.5, pos.z + d.z * 0.5) ? null : d;
  };
  const straight = tryAngle(0);
  if (straight) return straight;
  for (const a of [0.6, 1.2, 1.8, -0.6, -1.2, -1.8]) {
    const d = tryAngle(a * steerSide);
    if (d) return d;
  }
  steerSide = -steerSide; // boxed in on that side: try the other way next time
  return dir;
}
// A free place to walk to, away from furniture and things; sometimes by something interesting, sometimes just anywhere.
function wanderSpot(from) {
  if (Math.random() < 0.3) {
    const names = Object.keys(SPOTS).filter((n) => n !== 'chest' && SPOTS[n].p.distanceTo(from) > 1);
    if (names.length) return SPOTS[names[Math.floor(Math.random() * names.length)]];
  }
  for (let i = 0; i < 20; i++) {
    const p = new V3(rand(-4.1, 4.1), 0, rand(-3.6, 4.1));
    if (p.distanceTo(from) < 1.3 || floorBlocked(p.x, p.z)) continue;
    const look = SPOTS[Object.keys(SPOTS)[Math.floor(Math.random() * Object.keys(SPOTS).length)]].p;
    return { p, face: Math.atan2(look.x - p.x, look.z - p.z) };
  }
  return null;
}
function startBreak() {
  const options = ['window', 'plant', 'center', 'bookshelf', 'computer'].filter((n) => n !== task.at);
  const free = Math.random() < 0.5 ? wanderSpot(pip.group.position) : null;
  task.detour = { spot: free || SPOTS[options[Math.floor(Math.random() * options.length)]], until: 0 };
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
      const dir = steer(g.position, to.normalize(), dist);
      g.position.addScaledVector(dir, Math.min(dist, 2.2 * dt));
      turnTo(Math.atan2(dir.x, dir.z), dt * 10);
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
          task.arrivedAt = now;
          if (task.anim === 'play') startPhrase(task.notes, task.step, now);
          if (task.anim === 'ask') task.askUntil = now + 9000;
          task.nextBreak = task.anim === 'rest' ? Infinity : now + rand(40_000, 80_000);
        }
        anim = task.anim;
        engaged = true;
        if (task.anim !== 'look' && now > task.nextBreak) startBreak(); // a quick step does not send him walking back and forth: he idles in place
      }
    }
  }

  // --- idle: while a quick step has nothing more to show, he does small things by himself, now and then
  if (engaged && anim === 'look' && !walking && !pushing) {
    if (!task.idle) task.idle = { move: null, start: 0, until: 0, next: now + rand(1500, 3500) };
    const id = task.idle;
    if (!id.move || now >= id.until) {
      id.move = null;
      if (now >= id.next && task.at !== 'custom' && Math.random() < 0.55) {
        // he strolls somewhere new and stays there (a quick step has no place he must keep)
        const w = wanderSpot(g.position);
        if (w) task.spot = w;
        id.next = now + rand(5000, 12000);
      } else if (now >= id.next) {
        id.move = pickIdle();
        id.start = now;
        id.until = now + id.move.duration * 1000;
        id.next = id.until + rand(1500, 5000);
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
  const pv = preview && now < preview.until && !walking ? preview : null; // a move shown from the Life tab
  const idleNow = engaged && anim === 'look' && !walking && task.idle?.move ? task.idle : null;
  const mv = pv ? pv.move : idleNow ? idleNow.move : engaged && anim === 'move' && task.move ? task.move : null;
  const mvStart = pv ? pv.start : idleNow ? idleNow.start : task?.arrivedAt || now;
  let mvEyes = 0;
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
    if (pushing && !pushing.wait) { // arms out in front, leaning into it
      la = [-0.35, 0.8, 0.55];
      ra = [0.35, 0.8, 0.55];
      body.rotation.x = 0.28;
    }
  } else {
    body.position.y = Math.sin(t * 2) * 0.012;
    if (mv) {
      const p = movePose(mv, now - mvStart);
      mvEyes = p.eyes;
      body.position.y = p.hop;
      body.rotation.set(p.lean, p.turn, p.tilt);
      la = [-(0.5 + p.spread * 0.45), 0.55 + p.armL * 0.75, 0.1 + p.armL * 0.1];
      ra = [0.5 + p.spread * 0.45, 0.55 + p.armR * 0.75, 0.1 + p.armR * 0.1];
      fl = [-0.22, 0.1 + p.footL * 0.25, p.footL * 0.1];
      fr = [0.22, 0.1 + p.footR * 0.25, p.footR * 0.1];
    } else if (anim === 'play') {
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
  const closed = sleeping || t < blinkEnd || (mv && mvEyes > 0.6);
  eyes.forEach((e) => (e.scale.set(1, closed ? 0.1 : mv ? 1 + Math.max(0, -mvEyes) * 0.45 - Math.max(0, mvEyes) * 0.5 : 1, 1)));
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
  $('resetview').hidden = mode === 'walk';
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
  { furn: 'piano', box: [-3.95, -1.25, 0, 1.5, -5, -3.55], info: () => { const n = logOf('play_piano'); const last = n.at(-1); const songs = n.slice(-5).reverse().map((x) => ({ x, song: pianoSong(x.notes, x.style) })).filter((x) => x.song); return { title: 'The piano', lines: ['Pip plays here when he feels like music.', n.length ? `He has played it ${n.length} time${n.length === 1 ? '' : 's'} lately${last?.style ? `, the last time ${last.style}` : ''}.` : 'He has not played it yet.', songs.length ? 'Hear what he played:' : ''].filter(Boolean), actions: songs.map(({ x, song }) => ({ text: `▶ ${hm(Date.parse(x.at))}${x.style ? ` ${x.style}` : ''}`, run: () => playSong(song) })) }; } },
  { furn: 'piano', box: [-2.95, -2.25, 0, 0.7, -3.5, -2.8], info: () => ({ title: 'The piano stool', lines: ['Pip sits here to play.'] }) },
  { furn: 'bookshelf', box: [1.55, 3.65, 0, 3.1, -5, -4.3], info: () => { const last = logOf('read_book').at(-1); return { title: 'The bookshelf', lines: ['Pip goes here to read.', last?.opened ? `He last read about ${last.opened.title}.` : 'He has not read anything here yet.'], links: last?.opened?.url ? [{ text: `Read: ${last.opened.title}`, url: last.opened.url }] : [] }; } },
  { furn: 'desk', box: [-5, -3.6, 0, 1.9, 0.1, 2.3], info: () => { const last = logOf('search_web').at(-1); const apps = lastState?.apps || []; return { title: 'The computer', lines: ['Pip looks things up on the web here.', last ? `His last search was "${last.query}".` : 'He has not searched yet.', apps.length ? `He has written ${apps.length} app${apps.length === 1 ? '' : 's'}:` : ''].filter(Boolean), links: last?.opened?.url ? [{ text: `He opened: ${last.opened.title}`, url: last.opened.url }] : [], actions: apps.slice(-5).map((a) => ({ text: `▶ Open ${a.name}`, run: () => openApp(a) })) }; } },
  { furn: 'bed', box: [2.2, 4.6, 0, 1.1, 1.3, 4.7], info: () => ({ title: "Pip's bed", lines: ['Pip sleeps here, from 23:00 until 08:00.', 'He also rests here when he is tired.'] }) },
  { furn: 'plant', box: [3.6, 4.6, 0, 1.5, -4.6, -3.6], info: () => ({ title: 'A plant', lines: ['A leafy plant in the corner.'] }) },
  { box: [-0.9, 1.5, 1.7, 4.1, -5.1, -4.8], info: () => ({ title: 'The window', lines: ['Pip looks outside here.', 'The sky follows the real time of day where you are.'] }) },
  { furn: 'rug', box: [-2, 2, 0, 0.12, -1.2, 2.8], info: () => ({ title: 'The rug', lines: ['A soft round rug in the middle of the room.'] }) },
];
// `direct` is true when the thing tapped carries its own info (Pip, his creations); furniture is found by where the ray landed.
function infoFor(hit) {
  for (let o = hit.object; o; o = o.parent) {
    if (o.userData?.info) return { info: typeof o.userData.info === 'function' ? o.userData.info() : o.userData.info, direct: true };
  }
  const { x, y, z } = hit.point;
  const info = REGIONS.find(({ live, box }) => { const [x0, x1, y0, y1, z0, z1] = live ?? box; return x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1; })?.info() ?? null;
  return info ? { info, direct: false } : null;
}
pip.group.userData.info = () => {
  const s = lastState;
  const [icon, text] = plan && stepNow >= 0 ? headline(plan.steps[stepNow]) : ['•', 'getting ready'];
  const wearing = (s?.wardrobe || []).filter((c) => c.worn).map((c) => c.name);
  const bag = (s?.tools || []).map((x) => `• ${x.name}${x.why ? ` — ${x.why}` : ''}`);
  return { title: 'Pip', lines: [`${icon} ${text}`, s?.mood ? `Mood: ${s.mood}` : '', wearing.length ? `Wearing: ${wearing.join(', ')}` : '', bag.length ? `🎒 In his inventory:\n${bag.join('\n')}` : '🎒 His inventory is empty.', s ? `Fullness ${r1(s.fullness)} · Energy ${r1(s.energy)} · Wonder ${r1(s.wonder)} · Joy ${r1(s.joy)} · Calm ${r1(s.calm)}` : ''].filter(Boolean) };
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
function appById(id) {
  return (lastState?.apps || []).find((a) => a.id === id);
}
// What happens when a use is pressed: its text, what you see, a song, an app.
function showUse(d, use) {
  const actions = [];
  if (use.does) runBehavior(d.id, use.does, use.motion);
  if (use.song) actions.push({ text: '▶ Hear it', run: () => playSong(use.song) });
  const app = use.app ? appById(use.app) : null;
  if (app) actions.push({ text: `▶ Open ${app.name}`, run: () => openApp(app) });
  actions.push({ text: '← Back', run: () => showInfo(decorInfo(d)) });
  showInfo({ title: `${d.name}: ${use.label}`, lines: [use.text || ''].filter(Boolean), image: use.view || null, actions });
}
function decorInfo(d) {
  if (d.art) return { title: d.name, image: d.image, lines: [`A drawing by Pip. It hangs ${d.label}.`, d.why ? `Why: ${d.why}` : ''].filter(Boolean) };
  if (d.print) return { title: d.name, image: d.image, lines: [`A small print from Pip's photo printer. It is pinned ${d.label}.`] };
  const pic = (lastState?.pictures || []).find((p) => p.id === d.picture);
  const lines = d.image
    ? [pic?.by === 'pip' ? `A photo Pip took${pic.caption ? `: "${pic.caption}"` : ''}. It hangs ${d.label}.` : `A picture${pic?.caption ? `: "${pic.caption}"` : ''} that someone gave to Pip. It hangs ${d.label}.`, pic?.notes ? `Pip says: ${pic.notes}` : '']
    : [`Made by Pip. It is ${d.label}.`, d.why ? `Why: ${d.why}` : '', d.project ? `For his project: ${d.project}` : '', `Made ${when(d.createdAt)}.`];
  const actions = (d.uses || []).map((u) => ({ text: u.label, run: () => showUse(d, u) }));
  if (d.song) actions.push({ text: '▶ Hear it', run: () => playSong(d.song) });
  if (!d.image && !(d.uses || []).length) lines.push('Pip has not decided yet what it is for.');
  return { title: d.name, lines: lines.filter(Boolean), image: d.image || null, actions };
}

const infoBox = $('info');
let infoShownAt = 0;
// On a phone the browser sends a click after the touch ends. It lands on the modal that just opened and would close it again.
infoBox.addEventListener('click', (e) => {
  if (performance.now() - infoShownAt < 450) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);
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
  (info.actions || []).forEach((a) => {
    const b = el('button', a.text, 'small');
    b.addEventListener('click', a.run);
    body.append(b);
  });
  $('infobody').replaceChildren(body);
  if (infoBox.hidden) infoShownAt = performance.now();
  infoBox.hidden = false;
}
const link_ = (url, text) => link(url, text);
function hideInfo() {
  infoBox.hidden = true;
}
$('infoclose').addEventListener('click', hideInfo);
infoBox.addEventListener('click', (e) => {
  if (e.target === infoBox) hideInfo(); // a tap outside the card closes it
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !infoBox.hidden) hideInfo();
});
$('resetview').addEventListener('click', resetOrbit);

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
// Small things are hard to hit with a finger, so a tap close to one of Pip's creations counts as a tap on it.
const box3 = new THREE.Box3();
const corner = new THREE.Vector3();
function nearDecor(clientX, clientY, rect) {
  let best = null;
  for (const g of decorGroups.values()) {
    if (!g.visible || !g.userData.info) continue;
    box3.setFromObject(g);
    if (box3.isEmpty()) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box3.max.x : box3.min.x, i & 2 ? box3.max.y : box3.min.y, i & 4 ? box3.max.z : box3.min.z).project(camera);
      if (corner.z > 1) behind = true;
      const px = rect.left + ((corner.x + 1) / 2) * rect.width;
      const py = rect.top + ((1 - corner.y) / 2) * rect.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const pad = 16;
    if (behind || clientX < x0 - pad || clientX > x1 + pad || clientY < y0 - pad || clientY > y1 + pad) continue;
    const area = (x1 - x0 + 2 * pad) * (y1 - y0 + 2 * pad);
    if (!best || area < best.area) best = { area, g };
  }
  const info = best?.g.userData.info;
  return info ? (typeof info === 'function' ? info() : info) : null;
}
function pickAt(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
  ray.setFromCamera(ndc, camera);
  let furniture = null;
  for (const h of ray.intersectObjects(scene.children, true)) {
    if (h.object.isSprite || !h.object.visible) continue;
    const found = infoFor(h);
    if (!found) continue;
    if (found.direct) return found.info;
    furniture ??= found.info;
    break;
  }
  return nearDecor(clientX, clientY, r) ?? furniture;
}

// Looking around (drag) and tapping (a short touch that hardly moves).
const dom = renderer.domElement;
dom.style.touchAction = 'none';
let drag = null;
const touches = new Map(); // fingers on the screen, for pinching
let pinch = null;
const spread = () => {
  const [p, q] = [...touches.values()];
  return { d: Math.hypot(p.x - q.x, p.y - q.y), x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
};
// Slides the overview camera across the screen, so the room follows the fingers. It can go up to a little above the top of the walls.
function panBy(dx, dy) {
  camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const dist = camera.position.distanceTo(new THREE.Vector3(orbit.px, 1.2 + orbit.py, -0.3 + orbit.pz));
  const s = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / (renderer.domElement.clientHeight || 600); // world units per pixel
  orbit.px = clamp(orbit.px - (right.x * dx - up.x * dy) * s, -5, 5);
  orbit.py = orbit.py - (right.y * dx - up.y * dy) * s; // applyOrbit keeps it between the floor and just above the walls
  orbit.pz = clamp(orbit.pz - (right.z * dx - up.z * dy) * s, -5, 5);
}
dom.addEventListener('contextmenu', (e) => e.preventDefault());
dom.addEventListener('pointerdown', (e) => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try {
    dom.setPointerCapture(e.pointerId);
  } catch {}
  if (touches.size === 2 && view.mode === 'overview') {
    pinch = spread();
    if (drag) drag.moved = true; // two fingers are never a tap
    return;
  }
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, pan: e.shiftKey || e.button === 2 };
});
dom.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size === 2) {
    const now = spread();
    orbit.zoom = clamp(orbit.zoom * (pinch.d / Math.max(20, now.d)), 0.3, 1.6);
    panBy(now.x - pinch.x, now.y - pinch.y);
    pinch = now;
    applyOrbit();
    return;
  }
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
  if (!drag.moved) return;
  if (view.mode === 'walk') {
    view.yaw -= dx * 0.005;
    view.pitch = Math.max(-1.2, Math.min(1.2, view.pitch - dy * 0.005));
  } else if (drag.pan) {
    panBy(dx, dy);
    applyOrbit();
  } else {
    orbit.az = clamp(orbit.az - dx * 0.006, -0.7, 0.7);
    orbit.el = clamp(orbit.el + dy * 0.004, -0.5, 0.9);
    applyOrbit();
  }
});
dom.addEventListener('wheel', (e) => {
  if (view.mode !== 'overview') return;
  e.preventDefault();
  orbit.zoom = clamp(orbit.zoom * Math.exp(e.deltaY * 0.001), 0.3, 1.6);
  applyOrbit();
}, { passive: false });
dom.addEventListener('pointerup', (e) => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (!drag || e.pointerId !== drag.id) return;
  const tap = !drag.moved && performance.now() - drag.t < 500;
  drag = null;
  if (!tap) return;
  if (frontPick) {
    if (frontSideAt(e.clientX, e.clientY)) return tapFront(e.clientX, e.clientY);
    const other = teachOn() ? frontTargetAt(e.clientX, e.clientY) : null; // a tap on another thing starts over with that one
    if (other) return showFrontCard(other);
    return;
  }
  const front = teachOn() ? frontTargetAt(e.clientX, e.clientY) : null;
  if (front) return showFrontCard(front);
  const info = pickAt(e.clientX, e.clientY);
  if (info) showInfo(info);
  else hideInfo();
});
dom.addEventListener('pointercancel', (e) => {
  touches.delete(e.pointerId);
  pinch = null;
  drag = null;
});

// ---------------------------------------------------------------- teaching Pip the front of things (settings, needs the key)
const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
let teachUnlocked = localHost; // on your own Mac there is no key
const teachOn = () => teachUnlocked && store('pip-teach') === '1';
const SIDE_NAMES = { back: 'the window wall', left: 'the left wall', right: 'the right wall', front: 'the front of the room' };
function frontTargetAt(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObjects(scene.children, true)) {
    if (h.object.isSprite || !h.object.visible || h.object.userData.frontGuide) continue;
    for (let o = h.object; o; o = o.parent) {
      if (o === chestGroup) return { key: 'chest', name: "Pip's chest", rot: chestGroup.rotation.y, group: o };
      const fk = MOVABLE.find((k) => G[k] === o);
      if (fk) return { key: fk, name: FURNITURE[fk].n.replace(/^the /, ''), rot: o.rotation.y, group: o };
      for (const [id, g] of decorGroups) if (g === o) {
        const d = (lastState?.decor || []).find((x) => x.id === id);
        return d && d.kind === 'floor' && !d.image ? { key: id, name: d.name, rot: g.rotation.y, group: g } : null;
      }
    }
  }
  return null;
}

// Picking the front inside the room: a ring and arrows lie on the floor around the thing. The green arrow is where Pip thinks the front is.
// Tap the floor on the side the front really faces: the orange arrow shows what you would pick, and the tap saves it.
// Things in this room always stand square to the walls, so there are four directions: the arrow snaps to the nearest one.
let frontPick = null;
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function makeArrow(color) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, depthTest: false });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 12), mat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.35;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 16), mat);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.88;
  g.add(shaft, head);
  g.traverse((o) => { o.userData.frontGuide = true; o.renderOrder = 999; });
  g.scale.setScalar(1.5);
  return g;
}
function pointArrow(arrow, center, radius, [vx, vz]) {
  arrow.position.set(center.x + vx * radius, 0.04, center.z + vz * radius);
  arrow.rotation.y = Math.atan2(vx, vz);
  arrow.visible = true;
}
function endFrontPick() {
  if (!frontPick) return;
  scene.remove(frontPick.guide);
  frontPick = null;
  $('frontbar').hidden = true;
}
function showFrontCard(t) {
  endFrontPick();
  const box = new THREE.Box3().setFromObject(t.group);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 + 0.9;
  const guide = new THREE.Group();
  guide.userData.frontGuide = true;
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.04, radius + 0.04, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(center.x, 0.03, center.z);
  ring.userData.frontGuide = true;
  ring.renderOrder = 998;
  const now = makeArrow(0x39b36b);
  const pick = makeArrow(0xff8a1f);
  pick.visible = false;
  const cur = frontWorld(t.key, t.rot, lastState?.fronts);
  pointArrow(now, center, radius, cur);
  guide.add(ring, now, pick);
  scene.add(guide);
  frontPick = { t, center, radius, guide, pick, cur };
  const side = sideOfVector(cur);
  $('fronttext').textContent = `${t.name}: the green arrow is where Pip thinks the front is (${SIDE_NAMES[side]}). Tap the floor on the side the front really faces.`;
  $('frontsave').hidden = true;
  $('frontbar').hidden = false;
}
// The side of the room (one of four) that a tap on the floor points to, seen from the middle of the thing.
function frontSideAt(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
  ray.setFromCamera(ndc, camera);
  const p = ray.ray.intersectPlane(FLOOR, new THREE.Vector3());
  if (!p) return null;
  const dx = p.x - frontPick.center.x;
  const dz = p.z - frontPick.center.z;
  if (Math.hypot(dx, dz) < 0.25) return null; // on top of the thing itself
  return Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : dz > 0 ? 'front' : 'back';
}
function previewFront(clientX, clientY) {
  if (!frontPick || frontPick.choice) return; // once you tapped, the orange arrow stays where you put it
  const side = frontSideAt(clientX, clientY);
  if (!side) frontPick.pick.visible = false;
  else pointArrow(frontPick.pick, frontPick.center, frontPick.radius, SIDE_VECTORS[side]);
}
// A tap puts the orange arrow on that side and it stays there. You can tap again to change it. Save keeps it, Cancel drops it.
function tapFront(clientX, clientY) {
  const side = frontSideAt(clientX, clientY);
  if (!side) return;
  frontPick.choice = side;
  pointArrow(frontPick.pick, frontPick.center, frontPick.radius, SIDE_VECTORS[side]);
  $('fronttext').textContent = `${frontPick.t.name}: the front faces ${SIDE_NAMES[side]}. Tap another side to change it, or save.`;
  $('frontsave').hidden = false;
}
async function saveFrontPick() {
  if (!frontPick?.choice) return;
  const { t, choice, guide, pick, center, radius } = frontPick;
  $('frontsave').disabled = true;
  const ok = await saveFront(t, choice);
  $('frontsave').disabled = false;
  if (!ok) return; // the card stays so you can try again
  const now = guide.children.find((c) => c.userData.frontGuide && c.children.length); // the green arrow becomes the new front
  pick.visible = false;
  if (now) pointArrow(now, center, radius, SIDE_VECTORS[choice]);
  $('fronttext').textContent = `Saved! ${t.name} faces ${SIDE_NAMES[choice]}. Pip learns it at his next wake-up.`;
  $('frontsave').hidden = true;
  setTimeout(() => { if (frontPick?.guide === guide) endFrontPick(); }, 1800);
}
$('frontsave').addEventListener('click', saveFrontPick);
$('frontcancel').addEventListener('click', endFrontPick);
dom.addEventListener('pointermove', (e) => { if (frontPick && !drag && e.pointerType === 'mouse') previewFront(e.clientX, e.clientY); });
async function saveFront(t, side) {
  const v = turn(SIDE_VECTORS[side], -t.rot); // the front in the thing's own frame: the nearest of the four directions, also for a thing that is turned
  const [lx, lz] = Math.abs(v[0]) >= Math.abs(v[1]) ? [Math.sign(v[0]) || 0, 0] : [0, Math.sign(v[1]) || 0];
  try {
    if (!localHost) {
      const res = await fetch('/api/front', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: store('pip-key'), target: t.key, local: [lx, lz] }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save it.');
    } else {
      const res = await fetch('/api/front', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: t.key, local: [lx, lz] }) });
      if (!res.ok) throw new Error('Could not save it.');
    }
    if (lastState) lastState.fronts = { ...(lastState.fronts || {}), [t.key]: [lx, lz] };
    return true;
  } catch (e) {
    toast(`⚠️ ${e.message}`);
    return false;
  }
}
// The reply key lives in Settings only: filled in once there, it works for every button.
function needKey(status, again) {
  showTab('settings');
  $('setlock').hidden = false;
  $('setpanel').hidden = true;
  teachUnlocked = false;
  $('setstatus').textContent = again ? 'That key is not right. Enter it again.' : 'Enter your reply key here once. After that every button works.';
  $('setkey').focus();
  if (status) status.textContent = again ? 'That key is not right. See Settings.' : 'Add your reply key in Settings first (the gear).';
}
async function unlockSettings(key) {
  const status = $('setstatus');
  try {
    const res = await fetch('/api/front', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, check: true }) });
    if (!res.ok) throw new Error(res.status === 401 ? 'That key is not right.' : 'The settings are not available yet.');
    store('pip-key', key);
    teachUnlocked = true;
    status.textContent = '';
    $('setlock').hidden = true;
    $('setpanel').hidden = false;
    $('teachfront').checked = store('pip-teach') === '1';
    if (lastState) renderErrorLog(lastState);
    toast('Key saved. Every button works now.');
  } catch (e) {
    teachUnlocked = false;
    status.textContent = e.message;
  }
}
$('setunlock').addEventListener('click', () => unlockSettings($('setkey').value.trim()));
$('setkey').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlockSettings($('setkey').value.trim());
});
$('teachfront').addEventListener('change', (e) => store('pip-teach', e.target.checked ? '1' : '0'));
if (localHost) {
  $('setlock').hidden = true;
  $('setpanel').hidden = false;
  teachUnlocked = true;
  $('teachfront').checked = store('pip-teach') === '1';
} else if (store('pip-key')) unlockSettings(store('pip-key')); // a saved key is checked again, so a changed key locks it

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

// Slow device: draw with fewer pixels so it stays smooth; fast again: back to sharp.
const SHARP = Math.min(devicePixelRatio, 1.5);
let pixels = SHARP;
let slowSum = 0;
let slowN = 0;
let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.3, (now - prev) / 1000);
  if (!document.hidden && dt < 0.25 && ++slowN > 5) slowSum += dt; // the first frames and long pauses do not count
  if (slowN >= 95) {
    const avg = slowSum / 90;
    const want = avg > 0.026 ? Math.max(0.75, pixels - 0.25) : avg < 0.015 ? Math.min(SHARP, pixels + 0.25) : pixels;
    if (want !== pixels) {
      pixels = want;
      renderer.setPixelRatio(pixels);
      fitCamera();
    }
    slowSum = 0;
    slowN = 0;
  }
  prev = now;
  updateSlides(now, dt);
  frame(now, dt);
  updateFloaters(dt, now);
  popDecor(now);
  updateBehaviors(now, dt);
  const printing = plan && stepNow >= 0 && plan.steps[stepNow]?.action === 'print_photo';
  printLight.material.color.set(printing && Math.floor(now / 250) % 2 ? 0x6dff8a : 0x2f6b3a);
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

// Things Bas asks Pip to do. Pip answers yes or no himself.
let pendingTasks = [];
try {
  pendingTasks = JSON.parse(store('pip-task-pending') || '[]');
} catch {}
$('taskform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('taskstatus');
  const body = $('tasktext').value.trim();
  if (!body) return;
  const key = store('pip-key');
  if (!key) return needKey(status);
  $('tasksend').disabled = true;
  status.textContent = 'Sending…';
  try {
    const res = await fetch('/api/task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: body, key }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      store('pip-key', '');
      return needKey(status, true);
    }
    if (!res.ok) {
      status.textContent = data.error || 'Could not send.';
      return;
    }
    $('tasktext').value = '';
    pendingTasks.push({ id: data.id, at: new Date().toISOString(), text: body });
    store('pip-task-pending', JSON.stringify(pendingTasks));
    status.textContent = 'Sent. Pip answers when he next wakes up.';
    if (lastState) render(lastState);
  } catch {
    status.textContent = 'No connection. Try again.';
  } finally {
    $('tasksend').disabled = false;
  }
});

// Asks you answered (by id), kept until Pip has saved his side.
let answeredAsks = {};
try {
  answeredAsks = JSON.parse(store('pip-asks-answered') || '{}');
} catch {}

// Closing a task yourself: "done" or "remove". It shows right away and is saved when Pip next wakes up.
let closing = {};
try {
  closing = JSON.parse(store('pip-task-closing') || '{}');
} catch {}
async function closeTask(id, action) {
  const status = $('taskstatus');
  const key = store('pip-key');
  if (!key) return needKey(status);
  status.textContent = 'Sending…';
  try {
    const res = await fetch('/api/task', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, key }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      store('pip-key', '');
      return needKey(status, true);
    }
    if (!res.ok) {
      status.textContent = data.error || 'Could not send.';
      return;
    }
    closing[id] = action;
    store('pip-task-closing', JSON.stringify(closing));
    status.textContent = action === 'done' ? 'Marked as done.' : 'Removed.';
    toast(action === 'done' ? 'Marked as done. Pip sees it when he next wakes up.' : 'Removed.');
    if (lastState) render(lastState);
  } catch {
    status.textContent = 'No connection. Try again.';
  }
}

// A short message at the bottom of the screen, so a click always shows it worked.
function toast(text) {
  const t = el('div', text, 'toast');
  t.setAttribute('role', 'status');
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

// Sends a message to Pip. Returns true when it was sent.
async function sendReply(body, image = '') {
  const status = $('replystatus');
  const key = store('pip-key') || '';
  if (isStatic && !key) {
    $('replytext').value = body;
    needKey(status);
    return false;
  }
  $('send').disabled = true;
  status.textContent = 'Sending…';
  try {
    const res = await fetch('/api/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: body, key, image }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      store('pip-key', '');
      $('replytext').value = body;
      needKey(status, true);
      return false;
    }
    if (!res.ok) {
      status.textContent = data.error || 'Could not send.';
      return false;
    }
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
const TABS = ['day', 'mind', 'asks', 'tasks', 'photos', 'found', 'messages', 'life'];
let tab = TABS.includes(store('pip-tab')) ? store('pip-tab') : 'day';
let latestMsg = null;
function showTab(name) {
  tab = name;
  if (name !== 'settings') store('pip-tab', name);
  $('settingsbtn').setAttribute('aria-pressed', String(name === 'settings'));
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('.pane').forEach((p) => (p.hidden = p.dataset.pane !== name));
  if (name === 'day') loadOlder();
  if (name === 'messages') refreshNtfy(); // look for things typed in the ntfy app as soon as the chat is opened
  if (name === 'messages' && latestMsg) store('pip-seen', latestMsg);
  $('msgdot').classList.toggle('on', name !== 'messages' && !!latestMsg && latestMsg !== store('pip-seen'));
}
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
// The settings are not a tab: the gear in the corner opens them, and pressing it again goes back.
$('settingsbtn').addEventListener('click', () => showTab(tab === 'settings' ? (TABS.includes(store('pip-tab')) ? store('pip-tab') : 'day') : 'settings'));

// ---- Day: what Pip does, reads and searches, as a timeline
const SLOT_WORDS = { head: 'his head', face: 'his face', neck: 'around his middle', body: 'his body', back: 'his back' };
function headline(st) {
  const [icon, line] = headlineBase(st);
  return [icon, st.working_on ? `${line} · ${st.working_on}` : line];
}
function headlineBase(st) {
  const d = st.details || {};
  switch (st.action) {
    case 'search_web': return ['🌐', `Searching the web for “${d.query || st.query || '…'}”`];
    case 'read_book': return ['📖', `Reading about “${d.topic || st.topic || '…'}”`];
    case 'play_piano': return ['🎹', `Playing the piano${d.style ? ` (${d.style})` : ''}`];
    case 'write_diary': return ['✍️', 'Writing in his diary'];
    case 'rest': return ['💤', 'Resting'];
    case 'cook': return ['🍳', `Cooking ${d.dish || st.dish || 'something'}`];
    case 'take_photo': return ['📷', `Taking a photo of ${d.target || st.target || 'something'}`];
    case 'find_picture': return ['🔎', `Looking for a picture of “${d.query || st.query || '…'}”`];
    case 'ask_for': return ['🙏', `Asking for ${d.item || st.item || 'something'}`];
    case 'place_tool': return ['🧰', `Putting ${d.name || st.name || 'a tool'} in the room`];
    case 'request_ability': return ['🙋', `Asking for a new ability: ${d.name || st.name || ''}`];
    case 'measure': return ['📏', `Measuring ${d.name || st.name || 'something'}`];
    case 'take_tool': return ['🎒', `Putting ${d.name || st.name || 'a tool'} in his inventory`];
    case 'extend_thing': return ['🧱', d.with || st.joined ? `Joining things into ${d.name || st.name || 'one'}` : `Adding to ${d.name || st.name || 'something'}`];
    case 'move_thing': return ['↔️', `Moving ${d.name || st.name || 'something'}`];
    case 'print_photo': return ['🖨️', `Printing a photo (${d.id || st.name || 'a picture'})`];
    case 'take_down_print': return ['🖨️', 'Taking a print off the wall'];
    case 'blueprint': return ['📐', `Planning ${d.name || st.name || 'something new'}`];
    case 'make_move': return ['🕺', `Designing the move “${d.name || st.name || '…'}”`];
    case 'do': return [d.emoji || st.emoji || '✨', d.what || st.what || 'Doing something'];
    case 'walk_to': return ['🚶', `Walking to the ${d.object || st.object || 'room'}`];
    case 'eat': return ['🍽️', `Eating ${d.food || st.food || 'a snack'}`];
    case 'decorate': return ['🛠️', `Making ${d.name || st.name || 'something'} for his room`];
    case 'use': return ['✨', `Using ${d.name || st.name || 'something'}${d.label || st.label ? `: ${d.label || st.label}` : ''}`];
    case 'add_use': return ['🔧', `Deciding what ${d.name || st.name || 'it'} is for`];
    case 'compose': return ['🎵', `Composing a song for ${d.name || st.name || 'something'}`];
    case 'draw': return ['🎨', `Drawing ${d.name || st.name || 'something'}`];
    case 'make_app': return ['💻', `Writing the app ${d.name || st.name || ''}`];
    case 'change_thing': return ['🔁', `Changing ${d.name || st.name || 'something'}`];
    case 'update_app': return ['💻', `Updating the app ${d.name || st.name || ''}`];
    case 'make_clothes': return ['👕', `Making ${d.name || st.name || 'clothes'}`];
    case 'wear': return ['👕', `Putting on ${d.name || st.name || 'something'}`];
    case 'take_off': return ['👕', `Taking off ${d.name || st.name || 'something'}`];
    case 'place_picture': return ['🖼️', 'Putting up a picture'];
    case 'take_down_picture': return ['🖼️', 'Taking a picture down'];
    case 'remove_decoration': return ['📦', `Putting ${d.name || st.name || 'something'} in his chest`];
    case 'take_out': return ['📦', `Taking ${d.name || st.name || 'something'} out of the chest`];
    default: return ['•', String(st.action || '')];
  }
}
const KINDS = { blueprint: 'make', search_web: 'search', read_book: 'read', play_piano: 'piano', write_diary: 'diary', rest: 'rest', ask_for: 'ask', walk_to: 'walk', decorate: 'make', use: 'make', add_use: 'make', compose: 'make', draw: 'make', make_app: 'make', change_thing: 'make', update_app: 'make', make_clothes: 'make', wear: 'make', take_off: 'make', remove_decoration: 'make', take_out: 'make', make_move: 'make', place_tool: 'make', take_tool: 'make', measure: 'make', request_ability: 'ask', place_picture: 'make', take_down_picture: 'make', eat: 'eat', do: 'do', cook: 'cook', take_photo: 'photo', find_picture: 'find', print_photo: 'print', take_down_print: 'make', move_thing: 'make', extend_thing: 'make' };
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
  const kind = KINDS[e.action] || 'other'; // anything without its own card still gets one, built from what the entry holds
  const [icon] = headline(e);
  const card = el('article', null, `card ${kind}`);
  const labels = { search: 'Searched the web', read: 'Read', piano: 'Played the piano', diary: 'Wrote in his diary', rest: 'Rested', ask: 'Asked for something', walk: 'Walked', make: 'Worked on his room', eat: 'Ate something', do: 'Did something', cook: 'Cooked', photo: 'Took a photo', find: 'Found a picture', print: 'Printed a photo' };
  const header = el('header');
  header.append(el('span', icon), el('span', labels[kind] || String(e.action || 'something').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), 'kind'), el('time', hm(Date.parse(e.at))));
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
      const song = pianoSong(e.notes, e.style);
      if (song) {
        const b = el('button', '▶ Listen', 'small');
        b.addEventListener('click', () => playSong(song));
        card.append(b);
      }
    }
  } else if (kind === 'diary') {
    if (e.text) card.append(el('div', e.text, 'quote'));
  } else if (kind === 'ask') {
    card.append(el('h3', e.item || '', 'title'));
    if (e.reason) card.append(el('p', e.reason, 'muted'));
  } else if (kind === 'do') {
    card.append(el('h3', e.what || '', 'title'));
  } else if (kind === 'cook') {
    card.append(el('h3', e.dish || 'a meal', 'title'));
    if (e.ingredients?.length) card.append(el('p', e.ingredients.join(', '), 'muted'));
    if (e.failed) card.append(el('p', 'It did not work out: ' + e.failed, 'muted'));
  } else if (kind === 'print') {
    card.append(el('h3', e.name || 'a photo', 'title'));
    if (e.image) {
      const img = el('img', null, 'thumb');
      img.src = e.image;
      img.referrerPolicy = 'no-referrer';
      img.alt = e.name || '';
      card.append(img);
    }
    card.append(el('p', e.failed ? 'It did not work out: ' + e.failed : e.place ? `Pinned ${e.place}.` : '', 'muted'));
  } else if (kind === 'photo' || kind === 'find') {
    card.append(el('h3', kind === 'photo' ? `A photo of ${e.target || 'something'}` : e.title || `“${e.query || ''}”`, 'title'));
    const src = kind === 'photo' ? e.image : e.picture;
    if (src) {
      const img = el('img', null, 'thumb');
      img.src = src;
      img.referrerPolicy = 'no-referrer';
      img.alt = e.caption || '';
      card.append(img);
    }
    if (e.caption) card.append(el('p', e.caption, 'muted'));
    if (e.failed) card.append(el('p', 'It did not work out: ' + e.failed, 'muted'));
  } else if (kind === 'eat') {
    card.append(el('h3', e.food || 'a snack', 'title'));
    if (e.failed) card.append(el('p', 'He was not hungry yet.', 'muted'));
  } else if (kind === 'make') {
    card.append(el('h3', e.action === 'use' && e.label ? `${e.name}: ${e.label}` : e.name || '', 'title'));
    if (e.image) {
      const img = el('img', null, 'thumb');
      img.src = e.image;
      img.alt = 'picture';
      card.append(img);
    }
    if (e.action === 'use') {
      if (e.failed) card.append(el('p', `That did not work out: ${e.failed}.`, 'muted'));
      else {
        if (e.text) card.append(el('div', e.text, 'quote'));
        if (e.view) {
          const img = el('img', null, 'thumb');
          img.src = e.view;
          img.alt = 'what he saw';
          card.append(img);
        }
        const app = e.app ? appById(e.app) : null;
        if (app) card.append(appButton(app));
      }
    } else if (e.action === 'add_use') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : `He decided what it is for: ${e.label}.`, 'muted'));
    } else if (e.action === 'compose') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : 'He gave it a song.', 'muted'));
    } else if (e.action === 'draw') {
      card.append(el('p', e.failed ? `It did not work out: ${e.failed}.` : `He drew it and put it ${e.place}.`, 'muted'));
    } else if (e.action === 'change_thing') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : e.grew ? (e.limited ? `He made it bigger, as big as this spot allows (x${e.grew}).` : `He made it bigger (x${e.grew}).`) : e.reshaped ? 'He gave it a new shape.' : 'He changed it.', 'muted'));
    } else if (e.action === 'extend_thing') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : e.joined ? `He joined ${e.joined} on, so it is one thing now (${e.total} parts).` : e.side ? `He built onto the ${e.side} side: ${e.added} new parts (${e.total} in all).` : `He added ${e.added} parts (${e.total} in all).`, 'muted'));
    } else if (e.action === 'blueprint') {
      if (e.failed) card.append(el('p', `That did not work out: ${e.failed}.`, 'muted'));
      else {
        card.append(el('p', `Goal: ${e.goal || ''}`, 'muted'));
        const ul = el('ul', null, 'results');
        (e.mechanisms || []).forEach((m) => ul.append(el('li', `${m.ok ? '✅' : '❓'} ${m.part}${m.ok ? ` (${m.uses})` : ' (cannot do yet)'}`)));
        card.append(ul);
      }
    } else if (e.action === 'move_thing') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : `He moved it${e.place ? ` (${e.place})` : ''}.`, 'muted'));
    } else if (e.action === 'update_app') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : 'He made a new version of the app.', 'muted'));
    } else if (e.action === 'make_clothes') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : `He made clothes for ${SLOT_WORDS[e.slot] || 'himself'}.`, 'muted'));
    } else if (e.action === 'wear') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : 'He put it on.', 'muted'));
    } else if (e.action === 'take_off') {
      card.append(el('p', e.failed ? `That did not work out: ${e.failed}.` : 'He took it off.', 'muted'));
    } else if (e.action === 'make_app') {
      card.append(el('p', e.failed ? `It did not work out: ${e.failed}.` : 'He wrote a small app on his computer. It opens in a locked box.', 'muted'));
    } else if (e.action === 'remove_decoration') {
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
    if (e.uses?.length && !e.failed) card.append(el('p', `It can: ${e.uses.join(' · ')}`, 'muted'));
    if (e.song && !e.failed) card.append(songButton(e.song));
    if (e.file && !e.failed) card.append(appButton({ name: e.name, file: e.file }));
  } else if (kind === 'walk') {
    card.append(el('h3', `To the ${e.object || 'room'}`, 'title'));
  } else {
    const SKIP = new Set(['at', 'action', 'thought', 'enjoyment', 'emoji', 'failed']);
    const parts = Object.entries(e).filter(([k, v]) => !SKIP.has(k) && typeof v === 'string' && v.trim());
    const [, main] = parts.find(([k]) => ['what', 'name', 'title', 'dish', 'target', 'query', 'item', 'object', 'text'].includes(k)) ?? parts[0] ?? [0, ''];
    if (main) card.append(el('h3', main.slice(0, 160), 'title'));
    for (const [, v] of parts.filter(([, v]) => v !== main).slice(0, 2)) card.append(el('p', v.slice(0, 200), 'muted'));
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

// Older days: what fell out of his state is kept in web/archive/<day>.json. It is only read here, never by Pip.
var olderDays = null;
async function loadOlder() {
  await Promise.resolve(); // the page is still starting up when the Day tab opens first
  if (olderDays) return;
  const base = localHost ? 'archive/' : `${RAW}archive/`;
  try {
    const r = await fetch(`${base}index.json?t=${Math.floor(Date.now() / 60_000)}`, { cache: 'no-store' });
    olderDays = r.ok ? await r.json() : [];
  } catch {
    olderDays = [];
  }
  if (!olderDays.length) {
    fill($('olderlist'), [el('p', 'Nothing here yet. When his day gets old, it is saved here.', 'muted')]);
    return;
  }
  fill($('olderlist'), olderDays.map((d) => {
    const wrap = el('div', null, 'olderday');
    const b = el('button', `${d.day} · ${d.log} things he did`, 'filter');
    const body = el('div', null, 'cards');
    body.hidden = true;
    let loaded = false;
    b.addEventListener('click', async () => {
      body.hidden = !body.hidden;
      if (body.hidden || loaded) return;
      loaded = true;
      try {
        const r = await fetch(`${base}${d.day}.json`, { cache: 'no-store' });
        const data = fromGithub(await r.json());
        const cards = (data.log || []).slice().reverse().map((e) => dayCard(e));
        body.replaceChildren(...(cards.length ? cards : [el('p', 'Nothing saved for this day.', 'muted')]));
      } catch {
        body.replaceChildren(el('p', 'Could not load this day.', 'muted'));
      }
    });
    wrap.append(b, body);
    return wrap;
  }));
}
$('oldernote').addEventListener('click', loadOlder);

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
  const end = plan.at + plan.total;
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
    r2.append(el('span', `Next ${hm(plan.at + plan.starts[i + 1])}`, 'label'), el('span', `${ni} ${nt}`, 'big'));
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
  const mems = new Map((s.memories || []).map((m) => [m.id, m.text]));
  fill($('reflections'), (s.reflections || []).length
    ? s.reflections.slice(-8).reverse().map((r) => {
      const li = entry([when(r.at), '🪞 realized'], r.text, 'mine');
      const why = (r.because || []).map((id) => mems.get(id)).filter(Boolean).slice(0, 2);
      if (why.length) li.append(el('p', `Because: ${why.join(' · ')}`, 'muted'));
      return li;
    })
    : empty('Not yet. Every now and then Pip looks back on his days and writes down what he realized.'));
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
      const steps = p.steps || [];
      if (steps.length) {
        const doneN = steps.filter((x) => x.done).length;
        const prog = el('div', null, 'pprog');
        const track = el('div', null, 'track');
        const fillBar = el('div', null, 'fill');
        fillBar.style.width = `${(doneN / steps.length) * 100}%`;
        fillBar.style.background = 'var(--make)';
        track.append(fillBar);
        prog.append(track, el('span', `${doneN} of ${steps.length} steps`));
        const list = el('ul', null, 'psteps');
        const current = steps.findIndex((x) => !x.done);
        steps.forEach((x, i) => list.append(el('li', `${x.done ? '✓' : i === current && p.status === 'working' ? '➜' : '○'} ${x.text}`, x.done ? 'done' : '')));
        li.append(prog, list);
      } else if (p.next && p.status === 'working') li.append(el('p', `Next: ${p.next}`, 'next'));
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

// Every wake-up that failed, newest first. Only shown once the key is filled in (Settings is unlocked).
function renderErrorLog(s) {
  const box = $('errlog');
  const list = (s?.errors || []).slice().reverse();
  fill(box, list.length
    ? list.map((e) => {
        const d = el('details');
        d.append(el('summary', `${when(e.at)} · ${e.kind}${e.count > 1 ? ` · ${e.count} times` : ''}`), el('p', e.message, 'muted'));
        return d;
      })
    : [el('p', 'No errors yet.', 'muted')]);
}
// The lines that depend on the clock, so they stay right even when nothing new came in.
function renderStatus(s) {
  const quiet = s.last && !s._waking ? awakeMinutes(Date.parse(s.last.at), Date.now(), s.sleep) : 0; // his sleeping hours do not count
  const stuckText = s._error ? '⚠️ ' + s._error : quiet >= 30 ? `⚠️ Pip has not woken up for ${quiet >= 120 ? Math.round(quiet / 60) + ' hours' : quiet + ' minutes'}. He may be stuck. A restart is tried automatically.` : '';
  const e = s.lastError && (!s.last || Date.parse(s.lastError.at) >= Date.parse(s.last.at)) ? s.lastError : null; // gone once a wake-up works
  const why = { 'rate limit': 'Gemini says the daily or per-minute limit is used up. Pip naps and tries again later. The daily count resets at about 09:00 Dutch time.', 'Gemini is busy': 'Gemini was too busy to answer. It usually clears by itself.', 'Gemini refused': 'Gemini refused the request. Check the key and model.', error: 'Something went wrong at the last wake-up.' };
  const box = $('err');
  box.textContent = '';
  if (e) {
    const d = el('details');
    d.append(el('summary', `⚠️ Last wake-up failed: ${e.kind} (${when(e.at)}). Tap for details.`));
    d.append(el('p', why[e.kind] ?? why.error, 'muted'), el('p', e.message, 'muted'));
    box.append(d);
  }
  if (stuckText) box.append(el('div', stuckText));
  $('settingsbtn').classList.toggle('warn', !!$('err').textContent); // the warning itself lives in Settings; the gear gets a red dot
  if (!$('setpanel').hidden) renderErrorLog(s);
  $('wake').disabled = !!s._waking;
  $('wake').textContent = s._waking ? 'Pip is thinking…' : 'Wake Pip now';
  $('hint').textContent = !s.last
    ? (s._static ? 'Pip has not woken up yet.' : 'Pip has not woken up yet. Press "Wake Pip now".')
    : s._static ? `Pip last woke up ${new Date(s.last.at).toLocaleString()}` : '';
}
function render(s) {
  $('mood').textContent = s.mood || '…';
  renderDay(s);
  renderNow();
  renderMind(s);

  const wishes = (s.requests || []).filter((r) => r.status === 'open');
  fill($('requests'), wishes.length ? wishes.map((r) => el('li', `❓ ${r.what}${r.blueprint ? ` — for “${r.blueprint}”` : ''}`)) : empty('Nothing yet. When Pip works out something new and finds a part he cannot make work, it shows up here.'));
  const asks = s.asks || [];
  // Pip only saves your answer when he next wakes up, so an ask you answered is hidden here at once.
  for (const a of asks) if (answeredAsks[a.id ?? a.item] && a.status !== 'open') delete answeredAsks[a.id ?? a.item];
  store('pip-asks-answered', JSON.stringify(answeredAsks));
  const shownAsks = asks.filter((a) => a.status === 'open');
  const open = shownAsks.filter((a) => !answeredAsks[a.id ?? a.item]);
  $('askcount').textContent = open.length || '';
  fill($('asks'), shownAsks.length
    ? shownAsks.map((a) => {
      const li = el('li');
      li.append(el('div', a.item, 'what'));
      if (a.why) li.append(el('div', a.why, 'why'));
      const was = answeredAsks[a.id ?? a.item];
      if (was) { // you answered: it stays here with a confirmation until Pip has saved it
        li.append(el('div', was === 'done' ? '✅ Sent: you did this. Pip sees it when he next wakes up.' : '✅ Sent: you cannot do this one. Pip sees it when he next wakes up.', 'meta'));
        return li;
      }
      li.append(el('div', `asked ${when(a.since)}`, 'meta'));
      const row = el('div', null, 'buttons');
      const done = el('button', '✓ I did this', 'small primary');
      const answer = async (text, kind) => {
        row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        done.textContent = kind === 'done' ? 'Sending…' : '✓ I did this';
        if (await sendReply(text)) {
          toast('Sent! Pip sees it when he next wakes up.');
          answeredAsks[a.id ?? a.item] = kind;
          store('pip-asks-answered', JSON.stringify(answeredAsks));
          if (lastState) render(lastState);
        } else row.querySelectorAll('button').forEach((b) => { b.disabled = false; done.textContent = '✓ I did this'; });
      };
      done.addEventListener('click', () => answer(`I did this for you: "${a.item}"`, 'done'));
      const cant = el('button', "I can't do this", 'small');
      cant.addEventListener('click', () => answer(`I can't do this one: "${a.item}"`, 'cant'));
      row.append(done, cant);
      li.append(row);
      return li;
    })
    : [el('li', 'Nothing right now. Pip will add things here when he wants something from you.', 'muted')]);
  const tasks = s.tasks || [];
  const knownTasks = new Set(tasks.map((t) => t.id));
  if (pendingTasks.some((p) => knownTasks.has(p.id))) {
    pendingTasks = pendingTasks.filter((p) => !knownTasks.has(p.id));
    store('pip-task-pending', JSON.stringify(pendingTasks));
  }
  // A task you closed disappears from the "closing" list once Pip has saved it.
  for (const t of tasks) if (closing[t.id] && !['open', 'accepted'].includes(t.status)) delete closing[t.id];
  store('pip-task-closing', JSON.stringify(closing));
  const shown = [...pendingTasks.map((p) => ({ ...p, status: 'sending' })), ...tasks.slice().reverse()]
    .filter((t) => t.status !== 'removed' && closing[t.id] !== 'remove')
    .map((t) => (closing[t.id] === 'done' ? { ...t, status: 'done', soon: true } : t));
  $('taskcount').textContent = shown.filter((t) => t.status === 'open' || t.status === 'accepted' || t.status === 'sending').length || '';
  const GROUPS = [
    ['Pip is working on it', ['accepted'], '✅ Pip said yes'],
    ['Waiting for Pip', ['sending', 'open'], '⏳ Waiting'],
    ['Done', ['done'], '🎉 Done'],
    ['Not now', ['declined'], '🙅 Pip said no'],
  ];
  const taskCard = (t, chipText) => {
    const card = el('article', null, `task st-${t.status}`);
    const head = el('div', null, 'tk-head');
    head.append(el('span', t.status === 'sending' ? '📨 On its way…' : t.soon ? '🎉 Done (saving…)' : chipText, 'tk-chip'), el('time', when(t.at)));
    card.append(head, el('p', t.text, 'tk-text'));
    if (t.note) card.append(el('p', `Pip: ${t.note}`, 'tk-note'));
    if (['open', 'accepted'].includes(t.status) && t.id && !String(t.id).startsWith('sending')) {
      const actions = el('div', null, 'tk-actions');
      const done = el('button', '✓ Mark as done', 'small primary');
      done.addEventListener('click', () => closeTask(t.id, 'done'));
      const remove = el('button', 'Remove', 'small');
      remove.addEventListener('click', () => closeTask(t.id, 'remove'));
      actions.append(done, remove);
      card.append(actions);
    }
    return card;
  };
  const sections = GROUPS.map(([title, statuses, chipText]) => {
    const list = shown.filter((t) => statuses.includes(t.status));
    if (!list.length) return null;
    const box = el('section');
    const h = el('h3', title, 'tk-group');
    h.append(el('span', String(list.length), 'count'));
    const cards = el('div', null, 'tk-list');
    cards.append(...(title === 'Done' ? list.slice(0, 6) : list).map((t) => taskCard(t, chipText)));
    box.append(h, cards);
    return box;
  }).filter(Boolean);
  fill($('tasklist'), sections.length ? sections : [el('p', 'Nothing yet. Ask Pip to do something, for example to build a kitchen.', 'muted')]);
  const closed = asks.filter((a) => a.status !== 'open' || answeredAsks[a.id ?? a.item]).reverse();
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

  const taken = (s.pictures || []).filter((p) => p.by === 'pip' && Date.parse(p.at) <= Date.now()).slice().reverse();
  fill($('photolist'), taken.length
    ? taken.map((p) => {
      const div = el('div', null, 'pic');
      const a = el('a');
      a.href = p.image;
      a.target = '_blank';
      a.rel = 'noopener';
      const img = el('img');
      img.src = p.image;
      img.alt = p.caption || 'a photo by Pip';
      img.loading = 'lazy';
      a.append(img);
      div.append(a, el('div', p.caption || '', 'note'));
      const hung = (s.decor || []).find((d) => d.picture === p.id);
      div.append(el('div', `${p.target ? `of ${p.target} · ` : ''}${when(p.at)}${hung ? ` · 🖼️ ${hung.label}` : ''}`, 'meta'));
      return div;
    })
    : [el('div', 'No photos yet. Pip takes one when he wants to.', 'muted')]);
  const foundPics = (s.found || []).filter((f) => Date.parse(f.at) <= Date.now()).slice().reverse();
  fill($('foundlist'), foundPics.length
    ? foundPics.map((f) => {
      const div = el('div', null, 'pic');
      const a = el('a');
      if (/^https:\/\//.test(f.page || '')) {
        a.href = f.page;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      const img = el('img');
      img.src = f.image;
      img.alt = f.title || 'a picture Pip found';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      a.append(img);
      div.append(a, el('div', f.caption || f.title || '', 'note'));
      div.append(el('div', `${f.credit ? `${f.credit} · ` : ''}${f.license || ''} · ${when(f.at)}`, 'meta'));
      return div;
    })
    : [el('div', 'Nothing yet. Pip looks for a picture when he wants to see something.', 'muted')]);
  const pics = (s.pictures || []).filter((p) => p.by !== 'pip').slice().reverse();
  fill($('pics'), pics.length
    ? pics.map((p) => {
      const div = el('div', null, 'pic');
      const a = el('a');
      a.href = p.image;
      a.target = '_blank';
      a.rel = 'noopener';
      const img = el('img');
      img.src = p.image;
      img.alt = 'picture from a visitor';
      a.append(img);
      div.append(a);
      div.append(el('div', p.seen ? (p.notes || 'Pip has looked at it.') : 'Pip has not looked at it yet.', 'note'));
      const hung = (s.decor || []).find((d) => d.picture === p.id);
      div.append(el('div', hung ? `🖼️ ${hung.label}` : 'in his album, not put up', 'meta'));
      return div;
    })
    : [el('div', 'Nobody has given Pip any pictures yet. Use the 📎 button in the chat.', 'muted')]);
  const pantry = (s.pantry || []).filter((p) => p.qty > 0).sort((a, b) => (a.kind === 'dish' ? 0 : 1) - (b.kind === 'dish' ? 0 : 1));
  const bag = s.tools || [];
  const away = [...(s.decor || []).filter((d) => d.tool).map((d) => `${d.name} (in his room)`), ...(s.stored || []).filter((d) => d.tool).map((d) => `${d.name} (in his chest)`)];
  fill($('toollist'), [
    ...(bag.length ? bag.map((x) => el('li', `🎒 ${x.name}${x.why ? ` — ${x.why}` : ''}`)) : [el('li', 'His inventory is empty. Without a tool he cannot do some things, like drawing.', 'muted')]),
    ...away.map((x) => el('li', `📦 ${x}. Not in his inventory, so he cannot use it.`, 'muted')),
  ]);
  const pieces = (s.log || []).filter((e) => e.action === 'play_piano' && !e.failed && Date.parse(e.at) <= Date.now()).slice(-15).reverse();
  fill($('pianolist'), pieces.length ? pieces.map((e) => {
    const song = pianoSong(e.notes, e.style);
    const li = el('li', `🎹 ${when(e.at)}${e.style ? ` — ${e.style}` : ''} `);
    if (song) {
      const b = el('button', '▶ Listen', 'small');
      b.addEventListener('click', () => playSong(song));
      li.append(b);
    }
    return li;
  }) : empty('He has not played the piano yet.'));
  fill($('movelist'), (s.moves || []).length ? s.moves.map((m) => {
    const li = el('li', `🕺 ${m.name}${m.why ? ` — ${m.why}` : ''} `);
    const b = el('button', '▶ Show', 'small');
    b.addEventListener('click', () => {
      preview = { move: m, start: performance.now(), until: performance.now() + Math.max(3000, (m.duration || 2) * 2000) };
    });
    li.append(b);
    return li;
  }) : empty('No moves yet.'));
  $('selfnote').textContent = s.self || 'Pip has not written about himself yet.';
  fill($('favlist'), (s.favorites || []).length ? s.favorites.map((f) => el('li', `❤️ ${f.kind ? `${f.kind}: ` : ''}${f.what}`)) : empty('No favorites yet.'));
  fill($('ritlist'), (s.rituals || []).length ? s.rituals.map((r) => el('li', `🔁 ${r.text}${r.when ? ` (${r.when})` : ''}`)) : empty('No rituals yet.'));
  fill($('dreamlist'), (s.dreams || []).length ? [...s.dreams].reverse().slice(0, 8).map((d) => el('li', `🌙 ${new Date(d.at).toLocaleDateString([], { day: "numeric", month: "short" })}: ${d.text}`)) : empty('No dreams yet.'));
  fill($('pantrylist'), pantry.length ? pantry.map((p) => el('li', `${p.kind === 'dish' ? '🍲' : foodEmoji(p.name)} ${p.name} ×${p.qty}`)) : empty('The pantry is empty.'));
  const inChest = s.stored || [];
  fill($('chestlist'), inChest.length
    ? inChest.map((x) => entry([`put away ${when(x.storedAt)}`, `it was ${x.label}`], x.name))
    : empty('The chest is empty.'));
  const drawings = (s.art || []).slice().reverse();
  fill($('drawlist'), drawings.length
    ? drawings.map((a) => {
      const div = el('div', null, 'pic');
      const link2 = el('a');
      link2.href = a.file;
      link2.target = '_blank';
      link2.rel = 'noopener';
      const img = el('img');
      img.src = a.file;
      img.alt = a.name;
      link2.append(img);
      div.append(link2, el('div', a.name + (a.why ? ` — ${a.why}` : ''), 'note'));
      const up = (s.decor || []).find((d) => d.art === a.id);
      div.append(el('div', up ? `🖼️ ${up.label}` : 'in his album, not up', 'meta'));
      return div;
    })
    : [el('div', 'Pip has not drawn anything yet.', 'muted')]);
  const apps = (s.apps || []).slice().reverse();
  fill($('applist'), apps.length
    ? apps.map((a) => {
      const li = entry([when(a.createdAt)], `${a.name}${a.why ? ' — ' + a.why : ''}`);
      li.append(appButton(a));
      return li;
    })
    : empty('Pip has not written any apps yet.'));
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
    ? made.map((d) => entry([d.label, `made ${when(d.createdAt)}`, d.image ? '' : d.uses?.length ? `can: ${d.uses.map((u) => u.label).join(', ')}` : 'no use yet'].filter(Boolean), `${d.name}${d.why ? ' — ' + d.why : ''}`))
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

  renderStatus(s);
}

// Pip's plan: a few steps, spread over the time until his next wake-up. The page works out which step is happening now.
let plan = null;
let stepNow = -1;
function tickPlan() {
  if (!plan) return;
  const gone = Date.now() - plan.at;
  let i = plan.steps.length - 1;
  for (let k = 0; k < plan.steps.length; k++) {
    if (gone < plan.starts[k] + plan.lengths[k]) { i = k; break; }
  }
  if (i !== stepNow) {
    stepNow = i;
    startTask(plan.steps[i]);
    if (plan.steps[i]?.action === 'print_photo' && Date.now() - plan.at - plan.starts[i] < 5000) printerSound(); // only when the print just started
    renderNow();
    if (lastState) renderDay(lastState);
  }
}
function setPlan(last) {
  const steps = Array.isArray(last.steps) && last.steps.length ? last.steps : [last];
  const weights = steps.map((x) => (x.action === 'walk_to' ? 0.25 : 1)); // a walk is short, so it does not eat the plan
  const sum = weights.reduce((a, b) => a + b, 0);
  const total = (last.intervalMin || 12) * 60_000;
  const lengths = weights.map((w) => (w / sum) * total);
  const starts = lengths.map((_, k) => lengths.slice(0, k).reduce((a, b) => a + b, 0));
  plan = { at: Date.parse(last.at), total, lengths, starts, steps };
  stepNow = -1;
  tickPlan();
  renderNow();
}
setInterval(() => {
  tickPlan();
  updateDecor(lastState);
  syncClothes(lastState);
}, 1000);

let seenAt = null;
let waking = false;

// Local: the server gives live state. Online: Pip's saved files are read straight from GitHub,
// so his wake-ups never need a new deploy. If GitHub cannot be reached, the copy next to the page is used.
const RAW = 'https://raw.githubusercontent.com/Rellor/pip/main/web/';
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

// His pictures, drawings and apps are saved as files in the same place as his state.
function fromGithub(v) {
  if (typeof v === 'string') return /^(gifts|made|photos)\/[\w.-]+$/.test(v) ? RAW + v : v;
  if (Array.isArray(v)) return v.map(fromGithub);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fromGithub(x)]));
  return v;
}

let lastText = '';
async function loadState() {
  if (isLocal) { // only the local server has /api/state; the live site reads the saved file
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) return await r.json();
    } catch {}
  }
  if (!isLocal) {
    try {
      const r = await fetch(`${RAW}state.json?t=${Math.floor(Date.now() / 20_000)}`, { cache: 'no-store' }); // a new number every 20 seconds
      if (r.ok) {
        const text = await r.text();
        if (text === lastText && lastState) return { ...lastState, _same: true }; // nothing new: do not rebuild the page
        lastText = text;
        return { ...fromGithub(JSON.parse(text)), _static: true };
      }
    } catch {}
  }
  const r = await fetch(`state.json?t=${Date.now()}`, { cache: 'no-store' });
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
    if (!s._same) {
      lastState = s;
      isStatic = !!s._static;
      render(s);
      refreshNtfy();
    } else if (lastState) renderStatus(lastState);
    if (s._static) {
      delay = Date.now() < fastUntil ? 10_000 : 30_000;
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
const PHOTO = new URLSearchParams(location.search).get('photo');
// Photo mode: the camera Pip uses. A script opens the page like this, we draw one picture from Pip's eye and hand it back.
async function takeSnapshot() {
  try {
    const spec = JSON.parse(PHOTO);
    const s = await (await fetch(`state.json?t=${Date.now()}`, { cache: 'no-store' })).json();
    view.mode = 'photo';
    document.body.classList.add('photomode');
    lastState = s;
    updateDecor(s);
    syncClothes(s);
    for (const g of decorGroups.values()) {
      g.userData.born -= 5000;
      g.scale.setScalar(g.userData.scale);
    }
    await new Promise((r) => setTimeout(r, 1500)); // textures and pictures load
    const shot = photoCamera(String(spec.target || 'room'));
    renderer.setSize(960, 720, false);
    camera.aspect = 960 / 720;
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
    camera.position.copy(shot.from);
    camera.lookAt(shot.to);
    camera.updateMatrixWorld(true);
    renderer.render(scene, camera);
    window.__photo = renderer.domElement.toDataURL('image/jpeg', 0.88);
  } catch (e) {
    window.__photo = `error: ${e.message}`;
  }
}
// Where the camera stands and looks, for what Pip wants to photograph.
function photoCamera(target) {
  const t = target.toLowerCase();
  const V = (x, y, z) => new V3(x, y, z);
  if (/window|sky|outside|star|cloud|sun|moon/.test(t)) return { from: V(0.3, 2.9, -2.4), to: V(0.3, 2.9, -5), fov: 46 };
  if (/selfie|myself|\bme\b|\bpip\b/.test(t)) return { from: V(0.5, 1.25, 4.4), to: V(0, 0.75, 1.6), fov: 46 };
  const front = (center, size) => {
    const dir = V(0 - center.x, 0, 4.6 - center.z).normalize();
    const dist = Math.max(1.9, size * 2.3);
    const from = center.clone().addScaledVector(dir, dist);
    from.y = center.y + 0.5;
    from.x = clamp(from.x, -4.6, 4.6);
    from.z = clamp(from.z, -4.6, 4.8);
    return { from, to: center, fov: 50 };
  };
  for (const g of decorGroups.values()) {
    const name = String(g.userData.name || '').toLowerCase();
    if (name && (t.includes(name) || name.includes(t))) {
      const box = new THREE.Box3().setFromObject(g);
      return front(box.getCenter(new V3()), box.getSize(new V3()).length());
    }
  }
  const key = resolveSpot(t);
  if (key !== 'center' && SPOTS[key]) {
    const sp = SPOTS[key];
    const forward = V(Math.sin(sp.face), 0, Math.cos(sp.face));
    const center = sp.y ? sp.p.clone().setY(0.7) : sp.p.clone().addScaledVector(forward, 1.1).setY(1.1);
    return front(center, key === 'bed' ? 3 : 1.8);
  }
  return { from: V(4.4, 3.0, 4.3), to: V(-0.5, 1.2, -0.8), fov: 62 };
}

PHOTO ? takeSnapshot() : poll();

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
  const busy = $('replytext').value.trim() || chosenImage || $('send').disabled || view.mode === 'walk';
  if (away > 5 * 60_000 && !busy) location.reload();
  else refreshNow();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload(); // the browser put the whole page back from memory
});
window.addEventListener('online', refreshNow);

// A tab left open keeps its old code. Every 5 minutes, ask (a tiny request) whether main.js changed, and reload when it did and nothing is going on.
let codeTag = null;
setInterval(async () => {
  if (document.hidden || isLocal) return;
  try {
    const r = await fetch('main.js', { method: 'HEAD', cache: 'no-cache' });
    const tag = r.headers.get('etag') || r.headers.get('last-modified');
    if (!tag) return;
    if (codeTag && tag !== codeTag) {
      const busy = $('replytext').value.trim() || chosenImage || $('send').disabled || view.mode === 'walk';
      if (!busy) location.reload();
    }
    codeTag ??= tag;
  } catch {}
}, 5 * 60_000);
fetch('main.js', { method: 'HEAD' }).then((r) => { codeTag ??= r.headers.get('etag') || r.headers.get('last-modified'); }).catch(() => {});

$('wake').addEventListener('click', () => {
  $('wake').disabled = true;
  fetch('/api/wake', { method: 'POST' });
});

// handy for testing in the browser console: window.pipDo({action:'play_piano', ...})
window.pipGroup = (id) => decorGroups.get(id); // for testing
window.pipStep = (n, dt = 0.05) => { for (let i = 0; i < n; i++) updateBehaviors(performance.now() + i * dt * 1000, dt); }; // for testing without a visible page
let tickClock = 0;
window.pipTick = (n, dt = 0.05) => { tickClock ||= performance.now(); for (let i = 0; i < n; i++) { tickClock += dt * 1000; frame(tickClock, dt); updateBehaviors(tickClock, dt); } return tickClock; }; // for testing: run n frames by hand
window.pipPose = () => ({ rot: [pip.body.rotation.x, pip.body.rotation.y, pip.body.rotation.z].map((v) => +v.toFixed(2)), y: +pip.body.position.y.toFixed(2), at: [pip.group.position.x, pip.group.position.z].map((v) => +v.toFixed(2)), idle: task?.idle?.move?.id ?? null, anim: task?.anim });
window.pipRun = (id, does, motion) => { runBehavior(id, does, motion); return behaviors.get(id) ? { legs: behaviors.get(id).legs?.length ?? 0 } : null; };
window.pipBeh = behaviors;
window.pipFrame = (cam) => { if (cam) { camera.position.set(...cam.p); camera.lookAt(...cam.t); } renderer.render(scene, camera); }; // for testing: draw one frame by hand
window.pipDo = (last) => startTask({ at: String(Date.now()), thought: '(test)', details: {}, ...last });
window.__debug = { pip, getTask: () => task, decorGroups, view, setMode, pickAt, camera, openApp, playSong, getAudio: () => audio, getMaster: () => master };
