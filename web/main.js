import * as THREE from 'three';
import { awakeMinutes } from './sleep.js';
import { createOutside } from './outside.js';
import { applyLook } from './look.js';
import { makeProps } from './props.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { autoLampOn, lightAt, levelWord, isLamp, placeFor } from './lighting.js';
import { isGreenhouse, plantState, slotSpot } from './gardening.js';
import { lampsOf, lampName, lampNow, PRESETS, LEVELS, timerWords, applyLight, fixedLamp } from './lights.js';
import { buildHouse, LEFT_WINDOW, nextGoal, walkable, blockedInHouse, roomOf, FOCUS_X, ROOM_X, HAS_STUDIO } from './house.js';
import { FURNITURE, MOVABLE, pivotOf, placeOf, turn, worldPoint, frontWorld, sideOfVector, SIDE_VECTORS, furnRects, isGone } from './furniture.js';
import { placeOf as worldPlace, postcardSvg, hisWords } from './world.js';
import { seasonInfo } from './season.js';
import { makeGrain } from './grain.js';
import { buildTown, TOWN_X, TOWN_RANGE, WORLD, WORLD_RANGE, TOWN_SPOTS, TOWN_FOR, ROUTES, inTown, townBlocked, townGround, BUILDINGS, rectOf, PRINT_SLOTS, PAINT_WALLS, MUSEUM_SLOTS, PLINTH, POND, PLOT, SQUARE } from './town.js';

const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
const lerp = (a, b, t) => a + (b - a) * Math.min(1, t);
const stage = $('stage');

// ---------------------------------------------------------------- scene
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
// Furniture that can be moved: each piece is a group, put where the saved state says.
const G = Object.fromEntries(MOVABLE.map((k) => [k, new THREE.Group()]));
Object.values(G).forEach((g) => scene.add(g));
scene.background = new THREE.Color(getComputedStyle(document.body).backgroundColor);

const camera = new THREE.PerspectiveCamera(35, 1, 1, 1000);
// The look of his whole world: rough, grainy skins on everything and big pixels, like an old game console, so nothing
// looks like smooth plastic (?style=clean shows the old smooth look).
const ROUGH = new URLSearchParams(location.search).get('style') !== 'clean';
const grain = makeGrain(THREE);
function roughen(root) { // a grainy skin for every plain, solid thing that has none yet
  if (!ROUGH) return;
  root.traverse((o) => {
    const m = o.material;
    if (!o.isMesh || !m || Array.isArray(m) || !m.isMeshStandardMaterial || m.map || m.transparent || m.userData.smooth) return;
    m.map = grain('plain');
    m.roughness = Math.max(m.roughness, 0.85);
    m.needsUpdate = true;
  });
}
// Big pixels, but only outside: in his house the picture stays sharp, so his drawings on the walls can be seen as he
// drew them (the rough skins are on everything inside too, only the picture itself is not made coarse).
let pixelNow = false;
function applyPixels() {
  if (!ROUGH) return;
  const outside = view.mode === 'walk' ? inTown(view.x) : streetish();
  if (outside === pixelNow && renderer.domElement.dataset.px) return;
  pixelNow = outside;
  renderer.domElement.dataset.px = '1';
  const w = stage.clientWidth || 800;
  renderer.domElement.style.imageRendering = outside ? 'pixelated' : '';
  renderer.setPixelRatio(outside ? Math.max(0.2, Math.min(1, (view.mode === 'walk' ? 460 : 760) / w)) : Math.min(devicePixelRatio, 1.5));
}
const view = { mode: 'overview', x: 0, z: 3.4, yaw: 0, pitch: 0, keys: new Set(), stick: { x: 0, y: 0 } };
let turnWithMouse = false; // Settings: the mouse turns the view (then A and D step sideways); otherwise A and D turn
const jump = { y: 0, v: 0 }; // Space: how high you are off the ground right now, and how fast you rise
const bob = { walked: 0, moving: false, k: 0 }; // how far you walked (for the bobbing of the view), and how much it shows right now
let portalOn = false; // the world stands right outside his windows while you are inside his home (see setPortal)
let portalReady = false;
// Overview camera: drag to turn, pinch or scroll to zoom, two fingers (or shift + drag) to move.
const orbit = { az: 0, el: 0, zoom: 1, px: 0, py: 0, pz: 0, fit: 1 };
// The parts of the room that can be seen from the front: the floor and the two back walls.
const pointsFor = (x0, x1, street = false) => (street ? [[x0, 0, -8], [x1, 0, -8], [x0, 0, 27], [x1, 0, 27], [x0, 7, -8], [x1, 7, -8]] : [[x0, 0, -5], [x1, 0, -5], [x0, 0, 5], [x1, 0, 5], [x0, 5, -5], [x1, 5, -5], [x0, 5, 5]]).map(([x, y, z]) => new THREE.Vector3(x, y, z));
// Which part of the house the overview shows: the room Pip is in (auto), or one room, or the whole house.
const houseView = { want: 'auto', now: 'bedroom' };
const FOCUS_RANGE = HAS_STUDIO ? { bedroom: [-5, 5], hall: [3, 11], studio: [8.4, 16.9], house: [-5, 16.9] } : { bedroom: [-5, 5], hall: [3, 9.5], house: [-5, 8.8] };
const FOCUS = HAS_STUDIO ? { ...FOCUS_X } : { ...FOCUS_X, house: 1.9 };
// His street outside (town.js): it stands far to the side of the house, and the overview can show it like a room.
FOCUS_RANGE.street = [TOWN_X + TOWN_RANGE[0], TOWN_X + TOWN_RANGE[1]];
FOCUS.street = TOWN_X + (TOWN_RANGE[0] + TOWN_RANGE[1]) / 2;
// In the auto view the street is followed closer, with Pip in the middle (the Street button shows all of it).
FOCUS_RANGE.follow = [TOWN_X - 15, TOWN_X + 15];
Object.defineProperty(FOCUS, 'follow', { get: () => clamp(pip.group.position.x, TOWN_X + WORLD_RANGE[0] + 13, TOWN_X + WORLD_RANGE[1] - 13) });
const streetish = (n = focusName()) => n === 'street' || n === 'follow';
const camBase = () => (streetish() ? [5, 9, 15] : [9.5, 9, 11]); // the street is looked at more from the front, so the house fronts show
const panLimit = () => (streetish() ? 100 : 5); // how far the view can be moved sideways (outside: all the way to the park and the library)
if (!HAS_STUDIO) document.querySelector('#rooms [data-room="studio"]')?.remove();
let fitGoal = 1;
const focusName = () => (houseView.want === 'auto' ? (houseView.now === 'street' ? 'follow' : houseView.now) : houseView.want);
let focusX = 0; // the middle of what is shown, eased toward the goal
// How far back the camera must be for the whole room to fit on this screen, however wide or tall it is.
function fitRoom(instant = true) {
  const prevFit = orbit.fit;
  orbit.fit = 1;
  const name = focusName();
  const cx = FOCUS[name];
  const range = name === 'follow' ? [cx - 15, cx + 15] : FOCUS_RANGE[name];
  const pts = pointsFor(range[0], range[1], streetish(name));
  for (let i = 0; i < 8; i++) {
    const base = new THREE.Vector3(...camBase()).multiplyScalar(orbit.fit);
    camera.position.set(cx + base.x, 1.2 + base.y, -0.3 + base.z);
    camera.lookAt(cx, 1.2, -0.3);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const worst = Math.max(...pts.map((p) => { const q = p.clone().project(camera); return Math.max(Math.abs(q.x), Math.abs(q.y)); }));
    orbit.fit *= worst / 0.94;
  }
  fitGoal = orbit.fit;
  if (!instant) orbit.fit = prevFit;
  else focusX = cx;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function applyOrbit() {
  const k = orbit.fit;
  const cb = camBase();
  const base = new THREE.Vector3(cb[0] * k, cb[1] * k * (1 + orbit.el), cb[2] * k).applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit.az).multiplyScalar(orbit.zoom);
  // How high or low the middle of the view may go: the top edge of the screen can reach just above the walls (5 high), the bottom edge the floor.
  const dist = base.length();
  const half = dist * Math.tan((camera.fov * Math.PI) / 360) * Math.sqrt(1 - (base.y / dist) ** 2);
  orbit.py = clamp(orbit.py, Math.min(0, -0.3 + half - 1.2), Math.max(0, 5.3 - half - 1.2));
  const target = new THREE.Vector3(focusX + orbit.px, 1.2 + orbit.py, -0.3 + orbit.pz);
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
  applyPixels();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (view.mode === 'overview') {
    fitRoom();
    applyOrbit();
  }
  // A new size empties the picture until the next frame is drawn: the view flashed while you dragged the text drawer,
  // turned the phone or opened the keyboard. So it is drawn again at once.
  if (drawing) try { renderer.render(scene, camera); } catch {}
}
let drawing = false; // true once the first frame was drawn
new ResizeObserver(fitCamera).observe(stage);
// A phone's keyboard covers the lower half of the screen. The page then shrinks to what is left above the keyboard, so
// the box you type in stays in sight; and the page is put back in place when the keyboard goes (phones leave it shifted).
if (window.visualViewport && matchMedia('(hover:none), (pointer:coarse)').matches) {
  const vv = window.visualViewport;
  let typing = false;
  const fit = () => {
    const keyboard = typing && innerHeight - vv.height > 120;
    if (keyboard) document.documentElement.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
    else document.documentElement.style.removeProperty('--app-h');
    document.body.classList.toggle('typing', keyboard);
    if (window.scrollY || vv.offsetTop) window.scrollTo(0, 0);
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  document.addEventListener('focusin', (e) => { typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName); fit(); if (typing) setTimeout(() => { fit(); e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350); });
  document.addEventListener('focusout', () => { typing = false; setTimeout(fit, 120); });
}
// On a phone the text is a drawer under the picture. Its handle makes it bigger or smaller: drag it up for more room to
// read, down for more picture; a tap goes small, half, big. The page remembers the size.
{
  const grip = $('grip'), app = $('app'), panel = $('panel');
  const keep = (key, value) => { try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch {} return null; };
  let size = Number(keep('pip.textH')) || 0; // the share of the screen the text takes, in percent (0: the page decides)
  const set = (pct, save) => { size = Math.round(Math.max(16, Math.min(86, pct))); app.style.setProperty('--text-h', `${size}%`); if (save) keep('pip.textH', String(size)); };
  if (size) set(size, false);
  let drag = null;
  grip.addEventListener('pointerdown', (e) => { drag = { off: e.clientY - panel.getBoundingClientRect().top, y: e.clientY, moved: false }; try { grip.setPointerCapture(e.pointerId); } catch {} });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientY - drag.y) > 6 && !drag.moved) { drag.moved = true; grip.classList.add('drag'); document.body.classList.add('sizing'); }
    if (drag.moved) { const r = app.getBoundingClientRect(); set(((r.bottom - (e.clientY - drag.off)) / r.height) * 100, false); }
  });
  const done = () => { if (!drag) return; const moved = drag.moved; drag = null; grip.classList.remove('drag'); document.body.classList.remove('sizing'); if (moved) { keep('pip.textH', String(size)); grip.dataset.moved = '1'; } };
  grip.addEventListener('pointerup', done);
  grip.addEventListener('pointercancel', done);
  grip.addEventListener('click', () => { // a tap (or Enter): the next size
    if (grip.dataset.moved) { delete grip.dataset.moved; return; }
    const now = (panel.getBoundingClientRect().height / app.getBoundingClientRect().height) * 100;
    set(now < 45 ? 58 : now < 70 ? 82 : 34, true);
  });
}

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
// the lamp itself: a warm shade on a cord, so the room's light comes from something you can see
{
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  cord.position.set(-2, 4.4, -1);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd98a, emissiveIntensity: 0.9 }));
  shade.scale.set(1, 0.7, 1);
  shade.position.set(-2, 3.82, -1);
  scene.add(cord, shade);
  lamp.userData.shade = shade;
}

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
// The back wall has a real hole for the window (x -0.7..1.3, y 2.0..3.8): what is outside is a 3D world behind it (outside.js).
box(scene, [4.3, 5, 0.3], 0xf3d9c4, [-2.85, 2.5, -5.15]);
box(scene, [4, 5, 0.3], 0xf3d9c4, [3.3, 2.5, -5.15]);
box(scene, [2, 2, 0.3], 0xf3d9c4, [0.3, 1, -5.15]);
box(scene, [2, 1.2, 0.3], 0xf3d9c4, [0.3, 4.4, -5.15]);
// (the left wall is drawn with the house, because it has a window)
// The front and right walls and the ceiling only appear in walk mode, so the overview stays open.
const extraWalls = new THREE.Group();
extraWalls.visible = false;
box(extraWalls, [10.3, 5, 0.3], 0xefd7c0, [0, 2.5, 5.15]);
box(extraWalls, [10.6, 0.3, 10.6], 0xe8c9b0, [0, 5.15, 0]);
extraWalls.traverse((o) => (o.castShadow = false));
scene.add(extraWalls);
const home = buildHouse(THREE, scene); // the hall and the music studio
const town = buildTown(THREE); // his world outside (town.js)
scene.add(town.group);
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
// the window frame, sill and cross bars
box(scene, [0.1, 1.9, 0.2], 0xffffff, [-0.75, 2.95, -5.0]);
box(scene, [0.1, 1.9, 0.2], 0xffffff, [1.35, 2.95, -5.0]);
box(scene, [2.2, 0.1, 0.2], 0xffffff, [0.3, 3.85, -5.0]);
box(scene, [2.3, 0.08, 0.34], 0xffffff, [0.3, 1.97, -4.95]);
box(scene, [0.06, 1.8, 0.07], 0xffffff, [0.3, 2.9, -5.05]);
box(scene, [2, 0.06, 0.07], 0xffffff, [0.3, 2.9, -5.05]);
// What is outside: a real 3D world behind the wall that follows the real time of day and weather (see outside.js). It only shows through the hole, and the view changes as you move.
// Pip's photos of "the window" show it too.
const land = createOutside(THREE);
land.root.position.set(0.3, 2.9, -5.3);
land.mask.position.set(0.3, 2.9, -5.15);
scene.add(land.root, land.mask);
// The square window in the left wall looks out on the same kind of world (its own hole, the same weather, the sun where it really is).
const sideLand = createOutside(THREE, { ref: 2, turn: Math.PI / 2, state: land.state });
sideLand.root.rotation.y = Math.PI / 2;
sideLand.mask.rotation.y = Math.PI / 2;
sideLand.root.position.set(-5.3, 2.9, LEFT_WINDOW.z);
sideLand.mask.position.set(-5.15, 2.9, LEFT_WINDOW.z);
scene.add(sideLand.root, sideLand.mask);
const lookParams = new URLSearchParams(location.search); // ?hour=21&weather=rain shows another time or weather (for checking)
const forceLook = { hour: lookParams.has('hour') ? Number(lookParams.get('hour')) : undefined, weather: lookParams.get('weather') || undefined, day: lookParams.has('day') ? Number(lookParams.get('day')) : undefined };

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
  roundbox: (s, p) => new RoundedBoxGeometry(s[0], s[1], s[2], p?.soft ? 5 : 3, Math.min(...s) * (p?.soft ? 0.46 : 0.18)), // a box with soft edges (cloth: rounder still)
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
  const shownParts = d.stages > 1 && (d.stage ?? d.stages) < d.stages ? [...(d.parts || [])].sort((x, y) => (x.pos?.[1] ?? 0) - (y.pos?.[1] ?? 0)).slice(0, Math.max(1, Math.ceil(((d.parts || []).length * d.stage) / d.stages))) : d.parts || []; // a thing he is still building: from the ground up, as far as he got (sittings.js)
  for (const p of shownParts) {
    const geo = SHAPE_GEO[p.shape];
    if (!geo) continue;
    const mesh = new THREE.Mesh(
      geo(p.size, p),
      new THREE.MeshStandardMaterial({ color: p.color, ...(ROUGH && !p.glass ? { map: grain('plain') } : {}), roughness: p.glass ? 0.1 : p.soft ? 0.96 : ROUGH ? 0.9 : 0.7, emissive: p.glow ? p.color : 0x000000, emissiveIntensity: p.glow ? 0.9 : 0, ...(p.glass ? { transparent: true, opacity: 0.2, depthWrite: false } : {}) })
    );
    mesh.position.set(...p.pos);
    mesh.rotation.set(...p.rot.map((r) => (r * Math.PI) / 180));
    mesh.castShadow = !p.glass;
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
    G[key].visible = !isGone(furn, key);
    const sp = FURNITURE[key].spot;
    if (sp && SPOT_OF[key]) {
      const [wx, wz] = worldPoint(key, pl, sp.p);
      SPOTS[SPOT_OF[key]] = { ...SPOTS[SPOT_OF[key]], p: new V3(wx, 0, wz), face: sp.face + pl.rot };
    }
  }
  if (isGone(furn, 'piano')) SPOTS.piano = { ...SPOTS.window };
  wallFrame.visible = s?.wallPhoto !== false; // the framed Milky Way photo from Bas (down after the fresh start, until it is given back) // no piano: what pointed at it goes to the window
  const pianoAt = placeOf(furn, 'piano');
  wallFrame.position.x = pianoAt.x > 5.3 ? -2.2 + (pianoAt.x - pivotOf('piano')[0]) : -2.2;
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
  if ((!g.userData.placed && !force) || Math.hypot(g.position.x - x, g.position.z - z) > 8) { // far away (into another room): it is simply there
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
      setLit(have, litOf(d), d); // a lamp Pip switched
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
    setLit(g, litOf(d), d);
    g.userData.rev = d.updatedAt || null;
    if (d.updatedAt && Date.parse(d.updatedAt) > Date.now()) g.userData.rev = null;
    g.userData.born = performance.now() - Math.min(Date.now() - Date.parse(d.at), 5000); // old things are simply there
    scene.add(g);
    decorGroups.set(d.id, g);
    if (d.song && audio?.state === 'running' && Date.now() - Date.parse(d.at) < 8000) playSong(d.song);
  }
  if (portalOn) placeOutsideThings();
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
const litOf = (d) => (d.auto === 'dark' && lastState ? autoLampOn(lastState, d, Date.now(), { hour: forceLook.hour, weather: { kind: forceLook.weather || land.state.weather, cloud: land.state.cloud } }) : d.timers?.length || d.setAt ? lampNow(d).on : (d.auto === 'dark' && lastState ? autoLampOn(lastState, d, Date.now(), { hour: forceLook.hour, weather: { kind: forceLook.weather || land.state.weather, cloud: land.state.cloud } }) : d.litAt && Date.parse(d.litAt) > Date.now() ? d.lit === false : d.lit !== false)); // a lamp set to "dark" follows the real light and the weather; timers from his phone
// The lamps that came with the house (the room lamp and the hall lamp) follow his phone too: on, off, dimmed, a colour.
function syncFixedLamps(s) {
  if (!s) return;
  for (const [id, light, bulb, base] of [['room-lamp', lamp, lamp.userData.shade, null], ['hall-lamp', home?.hallLight, home?.hallBulb, 9]]) {
    const f = fixedLamp(s, id);
    if (!f || !light) continue;
    const st = lampNow(f);
    const k = st.on ? st.level / 100 : 0;
    if (base === null) light.userData.k = k; // the room lamp's strength also follows the time of day (look.js)
    else light.intensity = base * k;
    if (f.color || f.mode) light.color.set(st.color);
    if (bulb?.material) { bulb.material.emissiveIntensity = 0.9 * (st.on ? 0.35 + 0.65 * k : 0); if (f.color) bulb.material.emissive?.set(st.color); }
  }
}
// How his lamps light the room: a soft glow that reaches across the room and fades slowly, not a bright spot that stops
// suddenly (they were 3 strong with a steep fall-off: blinding at the desk, dark a little further). ?lamp=power,reach,decay to try others.
const LAMP = (() => { const [power, reach, decay] = (lookParams.get('lamp') || '').split(',').map(Number); return { power: power || 1.1, reach: reach || 7, decay: decay || 1.3 }; })();
// A lamp on or off, in the colour and brightness set on his phone (d: the lamp, for its colour and dim level).
function setLit(g, on, d = null) {
  const list = g.userData.glow;
  const st = d && (d.color || d.level || d.timers?.length) ? lampNow(d) : null;
  const color = st?.color ?? null;
  const level = (st?.level ?? 100) / 100;
  const key = `${on}|${color}|${level}`;
  if (!list || g.userData.lit === key) return;
  g.userData.lit = key;
  for (const x of list) {
    x.mat.emissiveIntensity = on ? 0.9 * (0.35 + 0.65 * level) : 0;
    if (color) { x.mat.color.set(color); x.mat.emissive?.set(color); }
  }
  if (!g.userData.lamp) {
    const l = new THREE.PointLight(new THREE.Color(list[0].color), 0, LAMP.reach, LAMP.decay);
    l.position.copy(list[0].at);
    g.add(l);
    g.userData.lamp = l;
  }
  if (color) g.userData.lamp.color.set(color);
  g.userData.lamp.intensity = on ? LAMP.power * level : 0;
}
const behaviors = new Map(); // thing id -> what it is doing now
// Is this spot in the way? goal = where he is heading: a thing that already covers the goal (the bed he walks onto, the piano he walks up to) does not count.
const floorBlocked = (x, z, skipId, goal = null) => {
  if (inTown(x)) return townBlocked(x, z, 0.2) && !(goal && Math.hypot(goal.x - x, goal.z - z) < 1.2); // out in the street (town.js)
  if (!walkable(x, z) || blockedInHouse(x, z)) return true;
  const furn = shownFurniture(lastState?.furniture);
  for (const k of MOVABLE) {
    if (FURNITURE[k].flat) continue;
    for (const r of furnRects(furn, k)) {
      if (goal && goal.x > r.x0 - 0.25 && goal.x < r.x1 + 0.25 && goal.z > r.z0 - 0.25 && goal.z < r.z1 + 0.25) continue;
      if (x > r.x0 - 0.25 && x < r.x1 + 0.25 && z > r.z0 - 0.25 && z < r.z1 + 0.25) return true;
    }
  }
  return (lastState?.decor || []).some((o) => o.id !== skipId && o.kind === 'floor' && !o.image && !o.flat && o.pos && Math.hypot(o.pos[0] - x, o.pos[2] - z) < 0.55 && !(goal && Math.hypot(o.pos[0] - goal.x, o.pos[2] - goal.z) < 0.55));
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
    const mesh = new THREE.Mesh(geo(p.size), new THREE.MeshStandardMaterial({ color: p.color, ...(ROUGH ? { map: grain('plain') } : {}), roughness: ROUGH ? 0.9 : 0.7, emissive: p.glow ? p.color : 0x000000, emissiveIntensity: p.glow ? 0.9 : 0 }));
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

// A small picture of Pip wearing one of his clothes (drawn once, then kept), for the log and the wardrobe.
let thumbRenderer = null;
const thumbCache = new Map();
function clothesThumb(c) {
  const key = `${c.id}|${c.madeAt}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  let url = null;
  try {
    thumbRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setPixelRatio(1);
    thumbRenderer.setSize(320, 320);
    thumbRenderer.outputColorSpace = renderer.outputColorSpace;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xfff4e6, 0xb08a6a, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 4, 5);
    sc.add(sun);
    const who = makePip();
    who.body.add(buildClothes(c));
    sc.add(who.group);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    const close = c.slot === 'head' || c.slot === 'face';
    const behind = c.slot === 'back';
    cam.position.set(0, close ? 0.95 : 0.7, (behind ? -1 : 1) * (close ? 3.1 : 4.0));
    cam.lookAt(0, close ? 0.85 : 0.5, 0);
    thumbRenderer.render(sc, cam);
    url = thumbRenderer.domElement.toDataURL('image/png');
  } catch {}
  thumbCache.set(key, url);
  return url;
}
// A small picture of a thing he made (for the grid on the card of the building where he made it).
function decorThumb(d, size = 160) {
  const key = `thing|${d.id}|${d.changedAt ?? d.at ?? ''}|${(d.parts ?? []).length}|${size}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  let url = null;
  try {
    thumbRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setPixelRatio(1);
    thumbRenderer.setSize(size, size);
    thumbRenderer.outputColorSpace = renderer.outputColorSpace;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xfff4e6, 0xb08a6a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(2, 4, 5);
    sc.add(sun);
    const g = buildDecor({ ...d, id: `thumb-${d.id}`, pos: [0, 0, 0], rotY: 0, kind: 'floor', at: d.at ?? new Date(0).toISOString() });
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    const mid = b.getCenter(new V3()), sz = b.getSize(new V3());
    const r = Math.max(sz.x, sz.y, sz.z, 0.01);
    sc.add(g);
    const cam = new THREE.PerspectiveCamera(30, 1, r / 50, r * 40);
    cam.position.set(mid.x + r * 1.25, mid.y + r * 0.85, mid.z + r * 1.9);
    cam.lookAt(mid);
    thumbRenderer.render(sc, cam);
    url = thumbRenderer.domElement.toDataURL('image/png');
    thumbRenderer.setSize(320, 320);
  } catch {}
  thumbCache.set(key, url);
  return url;
}
// A small picture of Pip making one of his faces (FACES), drawn the same way as the clothes pictures.
function facePic(name, size = 320) {
  const key = `face|${name}|${size}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  let url = null;
  try {
    thumbRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setPixelRatio(1);
    thumbRenderer.setSize(size, size);
    thumbRenderer.outputColorSpace = renderer.outputColorSpace;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xfff4e6, 0xb08a6a, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 4, 5);
    sc.add(sun);
    const who = makePip();
    who.face.set(name);
    who.face.tick(0, true);
    who.arms[0].position.set(-0.5, 0.55, 0.1); who.arms[1].position.set(0.5, 0.55, 0.1);
    who.feet[0].position.set(-0.22, 0.1, 0); who.feet[1].position.set(0.22, 0.1, 0);
    sc.add(who.group);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    cam.position.set(0, 0.86, 3.3);
    cam.lookAt(0, 0.7, 0);
    thumbRenderer.render(sc, cam);
    url = thumbRenderer.domElement.toDataURL('image/png');
    thumbRenderer.setSize(320, 320);
  } catch {}
  thumbCache.set(key, url);
  return url;
}
window.pipFacePic = facePic; // for testing: every face he can make, as a picture
window.pipOpenCard = (key) => { const t = town.things.find((x) => x.key === key); if (!t) return false; showInfo(t.object.userData.info()); return true; }; // for testing: open the card of a building
const clothesOf = (name) => { const n = String(name || '').toLowerCase(); return (lastState?.wardrobe || []).find((c) => String(c.name).toLowerCase() === n) || null; };
function clothesPic(c, extra = '') {
  const url = clothesThumb(c);
  if (!url) return null;
  const img = el('img', null, 'thumb clothesthumb');
  img.src = url;
  img.alt = c.name;
  return img;
}

// The chest, where Pip keeps things he does not want in his room right now.
const chestGroup = new THREE.Group();
chestGroup.position.set(-4.1, 0, 3.9);
scene.add(chestGroup);
const props = makeProps(THREE); // the room's own furniture, made with care (props.js)
const chestLid = new THREE.Group();
chestLid.position.set(0, 0.45, -0.3);
chestGroup.add(chestLid);
props.chest(chestGroup, chestLid);

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
props.bookshelf(shelf);

// computer desk
props.desk(G.desk);
props.monitorBack(G.desk); // the screen's frame and back (props.js)
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
props.monitorStand(G.desk); // its stand, and the keyboard
// photo printer on the desk (faces into the room); its little light blinks while he prints
box(G.desk, [0.26, 0.1, 0.3], 0xe9e4da, [-3.84, 0.92, 0.5]);
box(G.desk, [0.22, 0.03, 0.24], 0xcfc8ba, [-3.85, 0.985, 0.5]);
box(G.desk, [0.012, 0.016, 0.18], 0x2a2a2a, [-3.708, 0.93, 0.5]);
const printLight = box(G.desk, [0.03, 0.012, 0.03], 0x2f6b3a, [-3.76, 1.004, 0.38]);
printLight.material = new THREE.MeshBasicMaterial({ color: 0x2f6b3a });

// bed
props.bed(G.bed);

// plant
props.plant(G.plant);

// ---------------------------------------------------------------- Pip
// ---- The faces he can make. lid: how far the lids are down (0 open, 1 shut), lift and tilt: his brows (tilt > 0: the
// inner ends go down, stern; < 0: the inner ends go up, soft), each one number or [his right, his left]; mouth: flat,
// smile, frown or o; w: how wide; mt: how crooked; slant: the lids' own slope.
const FACES = {
  neutral: { lid: 0, lift: 0.004, tilt: 0, mouth: 'flat', w: 0.8 },
  happy: { lid: 0, lift: 0.02, tilt: -0.14, mouth: 'smile', w: 0.9 },
  delighted: { lid: 0, lift: 0.045, tilt: -0.2, mouth: 'smile', w: 1.25 },
  sceptic: { lid: [0.2, 0], lift: [-0.005, 0.045], tilt: [0.1, -0.3], mouth: 'flat', w: 0.9, mt: 0.12 },
  bored: { lid: 0.5, lift: -0.012, tilt: 0, mouth: 'flat', w: 0.7 },
  annoyed: { lid: 0.35, lift: -0.02, tilt: 0.38, mouth: 'frown', slant: 0.25 },
  sad: { lid: 0.2, lift: 0.01, tilt: -0.4, mouth: 'frown', slant: -0.2 },
  wonder: { lid: 0, lift: 0.06, tilt: -0.08, mouth: 'o' },
  curious: { lid: 0, lift: [0.005, 0.05], tilt: [0.05, -0.18], mouth: 'flat', w: 0.6 },
  sleepy: { lid: 0.65, lift: -0.008, tilt: -0.12, mouth: 'flat', w: 0.55, slant: -0.12 },
  focused: { lid: 0.2, lift: -0.022, tilt: 0.2, mouth: 'flat', w: 0.65 },
  smug: { lid: 0.35, lift: [0, 0.035], tilt: [0.05, -0.2], mouth: 'smile', w: 0.75 },
};
// The face for a word about how he feels (his own word for his mood, which can be anything), or null.
const FACE_WORDS = [[/delight|thrill|overjoy|ecstat|elated|excited/, 'delighted'], [/proud|smug|pleased with|triumph|cheeky|mischie/, 'smug'], [/happy|joy|glad|cheer|content|playful|warm|satisf|grateful|good/, 'happy'], [/bored|meh|flat|dull|restless|listless/, 'bored'], [/annoy|grump|frustrat|angry|irritat|cross|stubborn|fed up|let down|disappoint/, 'annoyed'], [/sad|lonely|blue|low|miss|gloom|homesick|hurt/, 'sad'], [/amaz|awe|surpris|wonder|astonish|wow/, 'wonder'], [/curious|intrigu|puzzl|interest|inspired|eager/, 'curious'], [/tired|sleepy|drowsy|worn|exhaust|weary/, 'sleepy'], [/focus|determin|busy|concentrat|absorb|serious|thoughtful|pensive/, 'focused'], [/doubt|scept|skept|unsure|suspic|confus|wary|dubious|unimpress/, 'sceptic']];
const faceForWord = (word) => { const w = String(word ?? '').toLowerCase(); return FACE_WORDS.find(([re]) => re.test(w))?.[1] ?? null; };
function makePip() {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const body = new THREE.Group();
  group.add(body);
  const furC = 0xffc47a;
  const flat = mat(furC, { roughness: 0.7 });
  const put = (geo, m, p, sc = [1, 1, 1], r = [0, 0, 0], parent = body) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(...p);
    o.scale.set(...sc);
    o.rotation.set(...r);
    parent.add(o);
    return o;
  };
  const twoSided = (m) => {
    m.side = THREE.DoubleSide;
    return m;
  };
  // a cone with a softly rounded tip (the ears), as a lathe: base radius R, height H, tip radius tr
  const softCone = (R, H, tr) => {
    const pts = [new THREE.Vector2(R, -H / 2), new THREE.Vector2(tr * 1.02, H / 2 - tr)];
    for (let i = 1; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(0.0001, tr * Math.cos(a)), H / 2 - tr + tr * Math.sin(a)));
    }
    return new THREE.LatheGeometry(pts, 28);
  };

  // body: a soft shade from a warmer back to a lighter bottom, with a pale belly
  const bg = new THREE.SphereGeometry(0.5, 40, 30);
  const bp = bg.attributes.position;
  const col = new Float32Array(bp.count * 3);
  const top = new THREE.Color(0xffb764);
  const bottom = new THREE.Color(0xffdba6);
  const tmp = new THREE.Color();
  for (let i = 0; i < bp.count; i++) {
    tmp.copy(bottom).lerp(top, (bp.getY(i) + 0.5) / 1);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const belly = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7 }));
  belly.scale.set(1, 1.1, 0.95);
  belly.position.y = 0.65;
  belly.castShadow = true;
  body.add(belly);
  put(new THREE.SphereGeometry(0.5, 24, 18), mat(0xffe9c8, { roughness: 0.8 }), [0, 0.5, 0.2], [0.62, 0.62, 0.55]);

  // ears: pointed, with a softly rounded tip and a pink inside
  [-1, 1].forEach((s) => {
    const holder = new THREE.Group();
    holder.position.set(s * 0.3, 1.2, 0);
    holder.rotation.z = -s * 0.4;
    body.add(holder);
    const ear = new THREE.Mesh(softCone(0.154, 0.325, 0.034), twoSided(mat(furC, { roughness: 0.7 })));
    ear.castShadow = true;
    holder.add(ear);
    put(softCone(0.074, 0.2, 0.018), twoSided(mat(0xffa7a0, { roughness: 0.9 })), [0, -0.03, 0.095], [1, 1, 0.45], [0, 0, 0], holder); // a little pink inside
  });

  // His face: plain dark eyes (the page squashes them to blink), a lid over each that can come down, a short brow above
  // each, and a mouth that is a line, a small smile, a frown or an "o". No blush and no sparkle: he is not a plush toy.
  // What it shows follows how he feels (FACES and faceNow further down; face.set picks one, face.tick moves toward it).
  const ink = mat(0x2b211d, { roughness: 0.9 });
  const surfZ = (x, y) => 0.95 * Math.sqrt(Math.max(0.0001, 0.25 - x * x - ((y - 0.65) / 1.1) ** 2)); // the front of his body at this spot
  const lidC = new THREE.Color(0xffdba6).lerp(new THREE.Color(0xffb764), 0.64).multiplyScalar(0.9);
  const lidMat = new THREE.MeshStandardMaterial({ color: lidC, roughness: 0.7, side: THREE.DoubleSide });
  const EYE_R = 0.075;
  const LID_STEPS = [0.2, 0.35, 0.5, 0.65, 0.82];
  const lids = [];
  const brows = [];
  const eyes = [-1, 1].map((s) => {
    const eye = new THREE.Group();
    eye.position.set(s * 0.17, 0.8, 0.455);
    put(new THREE.SphereGeometry(EYE_R, 24, 18), ink, [0, 0, 0], [1, 1, 0.35], [0, 0, 0], eye);
    lids.push(LID_STEPS.map((k) => { const cap = put(new THREE.SphereGeometry(EYE_R * 1.12, 24, 10, 0, Math.PI * 2, 0, Math.acos(1 - 2 * k)), lidMat, [0, 0, 0], [1, 1, 0.42], [0, 0, 0], eye); cap.visible = false; return cap; }));
    body.add(eye);
    const brow = new THREE.Group(); // (not in the eye: a blink must not squash it)
    put(new THREE.CapsuleGeometry(0.014, EYE_R * 1.7, 4, 10), ink, [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2], brow);
    body.add(brow);
    brows.push(brow);
    return eye;
  });
  const mouths = {
    flat: put(new THREE.CapsuleGeometry(0.012, 0.1, 4, 10), ink, [0, 0.662, 0.486], [1, 1, 1], [0, 0, Math.PI / 2]),
    smile: put(new THREE.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), ink, [0, 0.675, 0.48], [1, 1, 1], [0, 0, Math.PI]),
    frown: put(new THREE.TorusGeometry(0.055, 0.012, 8, 20, Math.PI), ink, [0, 0.625, 0.482]),
    o: put(new THREE.SphereGeometry(0.03, 14, 10), ink, [0, 0.655, 0.484], [1, 1.15, 0.4]),
  };
  const face = (() => {
    const now = { lid: [0, 0], lift: [0, 0], tilt: [0, 0], w: 1, mt: 0 };
    let goal = FACES.neutral, name = 'neutral', mouth = '';
    const show = () => {
      [0, 1].forEach((i) => {
        const s = i ? 1 : -1;
        const step = now.lid[i] < 0.1 ? -1 : LID_STEPS.reduce((best, k, j) => (Math.abs(k - now.lid[i]) < Math.abs(LID_STEPS[best] - now.lid[i]) ? j : best), 0);
        lids[i].forEach((cap, j) => { cap.visible = j === step; cap.rotation.z = s * (goal.slant ?? 0); });
        const y = 0.8 + EYE_R * 1.5 + now.lift[i];
        brows[i].position.set(s * 0.17, y, surfZ(0.17, y) + 0.014);
        brows[i].rotation.z = s * now.tilt[i];
      });
      const m = goal.mouth ?? 'flat';
      if (m !== mouth) { mouth = m; for (const [k, mesh] of Object.entries(mouths)) mesh.visible = k === m; }
      mouths.flat.scale.y = now.w; // (the capsule lies on its side: its length is its y)
      mouths.flat.rotation.z = Math.PI / 2 + now.mt;
      mouths.smile.scale.set(now.w, now.w, 1);
    };
    const pair = (v) => (Array.isArray(v) ? v : [v ?? 0, v ?? 0]);
    return {
      get name() { return name; },
      set(n) { if (n !== name && FACES[n]) { name = n; goal = FACES[n]; } },
      tick(dt, snap = false) {
        const k = snap ? 1 : Math.min(1, dt * 9);
        const to = { lid: pair(goal.lid), lift: pair(goal.lift), tilt: pair(goal.tilt) };
        for (const key of ['lid', 'lift', 'tilt']) for (const i of [0, 1]) now[key][i] += (to[key][i] - now[key][i]) * k;
        now.w += ((goal.w ?? 1) - now.w) * k;
        now.mt += ((goal.mt ?? 0) - now.mt) * k;
        show();
      },
    };
  })();
  face.tick(0, true);
  put(new THREE.SphereGeometry(0.032, 12, 10), mat(0x6b3a2e, { roughness: 0.3 }), [0, 0.74, 0.485], [1.2, 0.8, 0.8]); // nose

  // hands and feet: a round shape with little toes (and a pink pad under the feet)
  const limb = (rad, kind) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 20, 14), flat);
    m.castShadow = true;
    g.add(m);
    group.add(g);
    return g;
  };
  const arms = [limb(0.11, 'hand'), limb(0.11, 'hand')];
  const feet = [limb(0.14, 'foot'), limb(0.14, 'foot')];

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

  // the instruments he can hold (only the one he plays is shown); each is built in the group's own space, in front of him
  const inst = {};
  const wood = (c) => mat(c, { roughness: 0.55 });
  const metal = (c) => mat(c, { roughness: 0.25, metalness: 0.6 });
  const mk = (name, build) => {
    const g = new THREE.Group();
    g.visible = false;
    build(g);
    group.add(g);
    inst[name] = g;
  };
  mk('guitar', (g) => {
    put(new THREE.SphereGeometry(0.2, 24, 16), wood(0xc98a4b), [0, 0, 0], [1, 1.05, 0.34], [0, 0, 0], g);
    put(new THREE.SphereGeometry(0.15, 24, 16), wood(0xc98a4b), [0, 0.21, 0], [1, 1, 0.34], [0, 0, 0], g);
    put(new THREE.CircleGeometry(0.055, 20), mat(0x2b211d), [0, 0.07, 0.07], [1, 1, 1], [0, 0, 0], g);
    put(new THREE.BoxGeometry(0.045, 0.5, 0.035), wood(0x5a3a22), [0, 0.52, 0.01], [1, 1, 1], [0, 0, 0], g);
    put(new THREE.BoxGeometry(0.07, 0.11, 0.03), wood(0x3a2415), [0, 0.82, 0.01], [1, 1, 1], [0, 0, 0], g);
    [-0.012, 0, 0.012].forEach((x) => put(new THREE.BoxGeometry(0.004, 0.7, 0.004), metal(0xe8e6df), [x, 0.4, 0.075], [1, 1, 1], [0, 0, 0], g));
  });
  mk('violin', (g) => {
    put(new THREE.SphereGeometry(0.13, 24, 16), wood(0xa8541f), [0, 0, 0], [1, 1.25, 0.3], [0, 0, 0], g);
    put(new THREE.SphereGeometry(0.1, 24, 16), wood(0xa8541f), [0, 0.18, 0], [1, 1, 0.3], [0, 0, 0], g);
    put(new THREE.BoxGeometry(0.035, 0.28, 0.03), wood(0x2b1a10), [0, 0.38, 0.01], [1, 1, 1], [0, 0, 0], g);
    put(new THREE.SphereGeometry(0.03, 12, 10), wood(0x2b1a10), [0, 0.54, 0.01], [1, 1.4, 1], [0, 0, 0], g);
  });
  mk('violin_bow', (g) => {
    put(new THREE.BoxGeometry(0.72, 0.012, 0.012), wood(0x5a3a22), [0, 0, 0], [1, 1, 1], [0, 0, 0], g);
    put(new THREE.BoxGeometry(0.66, 0.006, 0.006), mat(0xf4efe0), [0.01, -0.012, 0], [1, 1, 1], [0, 0, 0], g);
  });
  mk('flute', (g) => {
    put(new THREE.CylinderGeometry(0.017, 0.017, 0.62, 12), metal(0xdde2ea), [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2], g);
    [-0.18, -0.08, 0.02, 0.12, 0.22].forEach((x) => put(new THREE.SphereGeometry(0.016, 8, 6), metal(0xaab2bf), [x, 0.02, 0.01], [1, 1, 1], [0, 0, 0], g));
  });
  mk('clarinet', (g) => {
    put(new THREE.CylinderGeometry(0.02, 0.03, 0.6, 12), mat(0x2a2527, { roughness: 0.4 }), [0, 0, 0], [1, 1, 1], [0, 0, 0], g);
    put(new THREE.ConeGeometry(0.055, 0.1, 12), mat(0x2a2527, { roughness: 0.4 }), [0, -0.33, 0], [1, 1, 1], [Math.PI, 0, 0], g);
    [-0.12, 0, 0.12].forEach((y) => put(new THREE.SphereGeometry(0.018, 8, 6), metal(0xdde2ea), [0, y, 0.03], [1, 1, 1], [0, 0, 0], g));
  });
  mk('kalimba', (g) => {
    put(new THREE.BoxGeometry(0.3, 0.06, 0.2), wood(0xb57b45), [0, 0, 0], [1, 1, 1], [0, 0, 0], g);
    [-0.1, -0.06, -0.02, 0.02, 0.06, 0.1].forEach((x, i) => put(new THREE.BoxGeometry(0.014, 0.012, 0.12 - Math.abs(i - 2.5) * 0.012), metal(0xc9ccd4), [x, 0.036, -0.01], [1, 1, 1], [0, 0, 0], g));
  });
  mk('harp', (g) => {
    put(new THREE.BoxGeometry(0.03, 0.62, 0.03), wood(0x8a5a2e), [-0.18, 0.31, 0], [1, 1, 1], [0, 0, 0], g);
    put(new THREE.BoxGeometry(0.03, 0.62, 0.03), wood(0x8a5a2e), [0.18, 0.28, 0], [1, 1, 1], [0, 0, 0.0], g);
    put(new THREE.BoxGeometry(0.42, 0.03, 0.03), wood(0x8a5a2e), [0, 0.61, 0], [1, 1, 1], [0, 0, 0], g);
    put(new THREE.BoxGeometry(0.42, 0.04, 0.05), wood(0x8a5a2e), [0, 0.01, 0], [1, 1, 1], [0, 0, 0], g);
    for (let i = 0; i < 7; i++) put(new THREE.BoxGeometry(0.004, 0.5 - i * 0.045, 0.004), metal(0xf0eadb), [-0.14 + i * 0.047, 0.05 + (0.5 - i * 0.045) / 2, 0], [1, 1, 1], [0, 0, 0], g);
  });

  return { group, body, eyes, arms, feet, book, pageHinge, inst, face };
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
  hall: { p: new V3(6.8, 0, 0.4), face: 0 },
  studio_desk: { p: new V3(15.2, 0, -3.3), face: Math.PI, y: 0.5 },
  studio_stage: { p: new V3(12.4, 0, 0.8), face: 0 },
  studio_keys: { p: new V3(13.1, 0, -1.45), face: Math.PI, y: 0.5 },
  studio_books: { p: new V3(9.7, 0, -3.0), face: -Math.PI / 2 },
  studio_drums: { p: new V3(13.6, 0, 2.4), face: Math.PI / 2 },
  hall_door: { p: new V3(6.8, 0, -3.7), face: Math.PI },
};
const SYNONYMS = {
  studio_desk: ['mixing', 'mixer', 'record', 'studio desk'],
  studio_keys: ['studio keyboard', 'synth keyboard'],
  studio_books: ['music book', 'studio shelf', 'studio book'],
  studio_drums: ['drum'],
  hall_door: ['front door', 'hall door'],
  studio_stage: ['studio', 'music room'],
  hall: ['hall', 'corridor'],
  frame: ['picture', 'frame', 'photo', 'painting', 'milky way'],
  piano: ['piano', 'keys', 'music'],
  bookshelf: ['book', 'shelf'],
  computer: ['computer', 'desk', 'screen', 'laptop'],
  window: ['window', 'sky', 'star', 'outside'],
  plant: ['plant', 'flower', 'leaf'],
  bed: ['bed', 'pillow'],
};
// Without the studio its spots do not exist (they are behind the hall's end wall): old entries and wandering use a bedroom spot.
const NO_STUDIO = { studio_desk: 'computer', studio_stage: 'center', studio_keys: 'center', studio_books: 'bookshelf', studio_drums: 'center' };
if (!HAS_STUDIO) {
  for (const k of Object.keys(NO_STUDIO)) { delete SPOTS[k]; delete SYNONYMS[k]; }
  SYNONYMS.computer.push('mixing', 'mixer', 'record');
  SYNONYMS.bookshelf.unshift('music book');
}
const spotOf = (key) => SPOTS[key] ?? SPOTS[NO_STUDIO[key]] ?? SPOTS.center;
function resolveSpot(name) {
  const n = String(name || '').toLowerCase();
  for (const [spot, words] of Object.entries(SYNONYMS)) if (words.some((w) => n.includes(w))) return spot;
  return 'center';
}

// ---------------------------------------------------------------- piano sound
let audio = null;
const HELD_LOOKS = ['guitar', 'violin', 'flute', 'clarinet', 'kalimba', 'harp'];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function parseNotes(input) {
  const text = Array.isArray(input) ? input.join(' ') : String(input ?? '');
  const notes = [];
  for (const tok of text.split(/[\s,;|/-]+/)) {
    const freqs = [];
    let letter = null;
    for (const part of tok.split(':')[0].split('+')) {
      const m = /^([A-G])([#b]?)(\d)?$/.exec(part);
      if (!m) continue;
      const semi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
      letter ??= m[1];
      freqs.push(440 * 2 ** ((m[3] ? Number(m[3]) : 4) - 4 + (semi - 9) / 12));
    }
    if (freqs.length) notes.push({ letter, freq: freqs[0], chord: freqs.length > 1 ? freqs.slice(0, 4) : undefined });
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
// The tracks of a recording as little lines: instrument, how loud, left or right, how much room.
function trackList(rec) {
  const ul = el('ul', null, 'results');
  for (const t of rec.tracks || []) {
    const side = t.pan < -0.2 ? 'left' : t.pan > 0.2 ? 'right' : 'middle';
    const icon = (PLAYED[t.instrument] || (t.instrument === 'drums' ? ['🥁'] : ['🎶']))[0];
    ul.append(el('li', `${icon} ${t.instrument} · volume ${Math.round((t.volume ?? 0.8) * 100)}% · ${side} · room ${Math.round((t.reverb ?? 0) * 100)}%`));
  }
  return ul;
}
// A song with several tracks, from what Pip wrote ({ tempo, tracks: [{ instrument, notes, volume, pan, reverb }] }): every track has its own sound, loudness, place left to right and amount of room.
function trackSong(d) {
  const tracks = [];
  for (const t of Array.isArray(d?.tracks) ? d.tracks.slice(0, 4) : []) {
    const one = pianoSong(t?.notes, '', t?.instrument);
    const drums = String(t?.instrument || '').toLowerCase() === 'drums';
    const notes = drums
      ? String(t?.notes || '').split(/[\s,;|/]+/).filter(Boolean).slice(0, 64).map((tok) => { const [n, b] = tok.split(':'); return /^-+$/.test(n) ? [null, 1] : ['kick', 'snare', 'hat'].includes(n.toLowerCase()) ? [n.toLowerCase(), Math.min(4, Math.max(0.25, Number(b) || 1))] : null; }).filter(Boolean)
      : one?.notes;
    if (!notes?.some(([n]) => n)) continue;
    tracks.push({ timbre: drums ? 'drums' : one.timbre, notes, volume: Math.min(1, Math.max(0.05, Number(t.volume) || 0.8)), pan: Math.min(1, Math.max(-1, Number(t.pan) || 0)), reverb: Math.min(1, Math.max(0, Number(t.reverb) || 0.15)) });
  }
  if (!tracks.length) return null;
  return { tempo: Math.min(200, Math.max(40, Math.round(Number(d.tempo) || 90))), tracks, notes: [] };
}
function pianoSong(notesText, style, instrument) {
  const notes = [];
  for (const tok of String(Array.isArray(notesText) ? notesText.join(' ') : notesText ?? '').split(/[\s,;|/]+/).filter(Boolean).slice(0, 80)) {
    if (/^-+$/.test(tok)) {
      notes.push([null, 1]);
      continue;
    }
    const [what, b] = tok.split(':');
    const names = what.split('+').slice(0, 4).map((x) => /^([A-G])([#b]?)(\d)?$/.exec(x)).filter(Boolean).map((m) => `${m[1]}${m[2]}${m[3] ?? 4}`);
    if (names.length) notes.push([names.length > 1 ? names : names[0], Math.min(4, Math.max(0.25, Number(b) || 1))]);
  }
  if (!notes.some(([n]) => n)) return null;
  const st = String(style || '').toLowerCase();
  return { notes, tempo: /slow|sad|soft|gentle|calm|sleep|dream|quiet/.test(st) ? 62 : /fast|happy|quick|bright|fun|dance/.test(st) ? 130 : 92, timbre: knownInstrument(String(instrument || '').toLowerCase()) };
}
function playNotes(notes, step, instrument = 'piano', dest = null) {
  if (!audio) return;
  buildMaster();
  const t0 = audio.currentTime + 0.05;
  notes.forEach((n, i) => {
    const t = t0 + i * step;
    for (const f of n.chord ?? [n.freq]) voice(f, t, step * 1.1, instrument, dest ?? master);
  });
}
$('sound').addEventListener('click', () => {
  unlockAudio();
  const on = !(audio && audio.state === 'running'); // (asked before the sound is made: a new one may be running at once)
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  (on ? audio.resume() : audio.suspend()).then(() => {
    $('sound').textContent = on ? '🔊 Sound on' : '🔇 Sound off';
  });
});
// ---- songs and sounds: what Pip makes can play a tune and a background sound (a short list of notes, a tempo, a voice, rain...)
// Everything goes through one master volume and a limiter, so a phone speaker is loud enough and never crackles.
let master = null;
let reverbIn = null;
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
// One master volume and a limiter, plus a little room sound (reverb) so notes do not sound dry and flat.
function buildMaster() {
  if (master || !audio) return;
  const comp = audio.createDynamicsCompressor();
  master = audio.createGain();
  master.gain.value = 1.3;
  master.connect(comp).connect(audio.destination);
  const n = Math.floor(audio.sampleRate * 2.2);
  const room = audio.createBuffer(2, n, audio.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = room.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.8);
  }
  const rev = audio.createConvolver();
  reverbIn = rev;
  const wet = audio.createGain();
  rev.buffer = room;
  wet.gain.value = 0.16;
  master.connect(rev);
  rev.connect(wet).connect(comp);
}
async function ensureAudio() {
  unlockAudio();
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state !== 'running') await audio.resume();
  buildMaster();
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
  synth: { parts: [[1, 'sawtooth', 0.12], [1.008, 'sawtooth', 0.12], [0.5, 'square', 0.07]], attack: 0.02, release: 0.5, lp: 1800, q: 6 },
  synthbass: { parts: [[1, 'sawtooth', 0.26], [0.5, 'sine', 0.34]], attack: 0.01, release: 0.25, lp: 700, q: 3 },
};
function synthVoice(freq, t, hold, timbre, dest = master) {
  const v = VOICES[timbre] || VOICES.piano;
  const len = v.hold ?? Math.max(v.attack, hold);
  let into = dest;
  if (v.lp) { // a filter that opens and closes with the note, like a synthesizer
    const f = audio.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = v.q || 4;
    f.frequency.setValueAtTime(v.lp * 3, t);
    f.frequency.exponentialRampToValueAtTime(v.lp, t + 0.3);
    f.connect(dest);
    into = f;
  }
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
    o.connect(g).connect(into);
    o.start(t);
    o.stop(t + Math.max(v.attack, len) + v.release + 0.1);
  }
}
// ---- real instrument sounds: recorded samples from a free soundfont (FluidR3_GM), loaded the first time an instrument is used and kept in the browser.
// If they cannot be loaded (offline, blocked), the synth voices above play instead, so there is always sound.
const SF_URL = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
// instrument: [soundfont file, seconds the note rings after it is let go (a piano fades, a flute stops quickly)]
const SAMPLED = {
  piano: ['acoustic_grand_piano', 0.9], epiano: ['electric_piano_1', 0.6], harpsichord: ['harpsichord', 0.12], organ: ['church_organ', 0.2],
  harp: ['orchestral_harp', 1.3], guitar: ['acoustic_guitar_nylon', 0.6], violin: ['violin', 0.3], cello: ['cello', 0.35], strings: ['string_ensemble_1', 0.45],
  flute: ['flute', 0.25], clarinet: ['clarinet', 0.2], vibraphone: ['vibraphone', 1.2], marimba: ['marimba', 0.4], kalimba: ['kalimba', 0.8],
  glockenspiel: ['glockenspiel', 1.4], musicbox: ['music_box', 1.1], bell: ['tubular_bells', 2.4], choir: ['choir_aahs', 0.5],
};
const SYNTH_FOR = { epiano: 'piano', harpsichord: 'pluck', organ: 'pad', harp: 'pluck', guitar: 'pluck', violin: 'pad', cello: 'pad', strings: 'pad', clarinet: 'flute', vibraphone: 'bell', kalimba: 'musicbox', glockenspiel: 'musicbox', choir: 'soft' };
const knownInstrument = (x) => (x === 'voice' ? 'choir' : SAMPLED[x] || VOICES[x] ? x : 'piano'); // his own voice sings with the choir sound
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const sampleKey = (freq) => {
  const m = Math.round(69 + 12 * Math.log2(freq / 440));
  return `${FLAT[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
};
const banks = new Map();
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
async function cachedText(url) {
  try {
    const c = await caches.open('pip-soundfont-1');
    let r = await c.match(url);
    if (!r) {
      r = await fetch(url, { mode: 'cors' });
      if (r.ok) await c.put(url, r.clone());
    }
    return r.ok ? await r.text() : null;
  } catch {
    try { return await (await fetch(url, { mode: 'cors' })).text(); } catch { return null; }
  }
}
function bankOf(timbre) {
  const def = SAMPLED[timbre];
  if (!def) return null;
  if (!banks.has(timbre)) banks.set(timbre, { def, uris: null, buf: new Map(), loading: null, failed: false });
  return banks.get(timbre);
}
function bankLoad(b) {
  b.loading ??= (async () => {
    const text = await within(cachedText(`${SF_URL}${b.def[0]}-mp3.js`), 25000);
    const uris = new Map();
    for (const m of String(text || '').matchAll(/"([A-G]b?\d)":\s*"(data:audio\/mp3;base64,[^"]+)"/g)) uris.set(m[1], m[2]);
    if (uris.size < 20) throw new Error('no samples');
    b.uris = uris;
  })().catch(() => { b.failed = true; });
  return b.loading;
}
// Decodes the notes that are about to be played (all of an instrument at once would be too much memory on a phone).
async function bankNeed(b, keys) {
  await bankLoad(b);
  if (b.failed) return;
  await Promise.all([...new Set(keys)].filter((k) => !b.buf.has(k) && b.uris.has(k)).map(async (k) => {
    try {
      const raw = await (await fetch(b.uris.get(k))).arrayBuffer();
      b.buf.set(k, await audio.decodeAudioData(raw));
    } catch {}
  }));
}
function prefetchInstrument(timbre, freqs) {
  const b = bankOf(timbre);
  if (b && audio) bankNeed(b, freqs.map(sampleKey)).catch(() => {});
}
function voice(freq, t, hold, timbre, dest = master) {
  const b = bankOf(timbre);
  const buf = b && !b.failed ? b.buf.get(sampleKey(freq)) : null;
  if (!buf) return synthVoice(freq, t, hold, SYNTH_FOR[timbre] || timbre, dest);
  const src = audio.createBufferSource();
  const g = audio.createGain();
  const len = Math.max(0.12, hold);
  const vol = 0.9 * (b.def[2] ?? 2.4) * (0.92 + Math.random() * 0.08); // a tiny difference per note, so it sounds played
  src.buffer = buf;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.setValueAtTime(vol, t + len);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len + b.def[1]);
  src.connect(g).connect(dest);
  src.start(t);
  src.stop(t + len + b.def[1] + 0.05);
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
function drum(kind, t, dest = master) {
  if (kind === 'kick') {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(dest);
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
  src.connect(f).connect(g).connect(dest);
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
// Several tracks at once: each one has its own sound, loudness, place from left to right and amount of room.
async function playTracks(song, dest = null) {
  await ensureAudio();
  dest ??= master;
  const heard = (n) => (Array.isArray(n) ? n : [n]).filter((x) => x && !['kick', 'snare', 'hat'].includes(x));
  await Promise.all(song.tracks.map((tr) => { const b = bankOf(tr.timbre); return b ? within(bankNeed(b, tr.notes.flatMap(([n]) => heard(n)).map((x) => sampleKey(noteFreq(x) || 440))), 25000) : null; }));
  const beat = 60 / (song.tempo || 90);
  const start = audio.currentTime + 0.15;
  let end = 0;
  for (const tr of song.tracks) {
    const bus = audio.createGain();
    bus.gain.value = tr.volume ?? 0.8;
    const pan = audio.createStereoPanner ? audio.createStereoPanner() : null;
    if (pan) { pan.pan.value = tr.pan || 0; bus.connect(pan).connect(dest); } else bus.connect(dest);
    if (reverbIn && tr.reverb > 0.01) { const send = audio.createGain(); send.gain.value = tr.reverb * 1.4; bus.connect(send).connect(reverbIn); }
    let t = start;
    for (const [n, beats] of tr.notes) {
      if (n === 'kick' || n === 'snare' || n === 'hat') drum(n, t, bus);
      else for (const x of heard(n)) { const f = noteFreq(x); if (f) voice(f, t, beat * beats * 0.92, tr.timbre, bus); }
      t += beat * beats;
    }
    end = Math.max(end, t - start);
  }
  return end;
}
async function playSong(song, dest = null) {
  if (!song || (!song.notes?.length && !song.ambience && !song.tracks?.length)) return 0;
  if (song.tracks?.length) return playTracks(song, dest);
  await ensureAudio();
  dest ??= master;
  const heard = (n) => (Array.isArray(n) ? n : [n]).filter((x) => x && !['kick', 'snare', 'hat'].includes(x));
  const bank = bankOf(song.timbre);
  if (bank) await within(bankNeed(bank, (song.notes || []).flatMap(([n]) => heard(n)).map((x) => sampleKey(noteFreq(x) || 440))), 25000);
  const beat = 60 / (song.tempo || 90);
  const start = audio.currentTime + 0.1;
  let t = start;
  for (const [n, beats] of song.notes || []) {
    if (n === 'kick' || n === 'snare' || n === 'hat') drum(n, t, dest);
    else for (const x of heard(n)) {
      const f = noteFreq(x);
      if (f) voice(f, t, beat * beats * 0.92, song.timbre, dest);
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

// ---- The sound of his world (all made here, no sound files; all behind the Sound switch):
// wind outside, rain when it rains (dull when you are indoors), your own footsteps, Pip's playing (louder the closer
// you stand), and a small radio by his door that plays the songs he recorded.
const RADIO_AT = { x: -1.7, z: 0.5 }; // beside his front door (metres in the village)
const HOME_AT = { x: 0, z: -2 }; // his house, for how far a sound is
const snd = { ready: false, wind: null, windF: null, rain: null, rainF: null, pip: null, radio: null };
const radio = { on: true, node: null, until: 0, nextAt: 0, idx: -1, name: '' };
function buildWorldSound() {
  if (snd.ready || !audio || !master) return;
  snd.ready = true;
  const lane = (type, freq, q) => { const src = noise(); const f = audio.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = audio.createGain(); g.gain.value = 0; src.connect(f).connect(g).connect(master); src.start(); return [g, f]; };
  [snd.wind, snd.windF] = lane('bandpass', 420, 0.5);
  [snd.rain, snd.rainF] = lane('lowpass', 8000, 0.3);
  snd.pip = audio.createGain(); snd.pip.connect(master);
  snd.radio = audio.createGain(); snd.radio.gain.value = 0; snd.radio.connect(master);
}
// Where your ears are, and where Pip is, in village metres (inside his house counts as one place).
const earAt = () => (view.mode !== 'walk' ? null : inTown(view.x) ? { x: view.x - TOWN_X, z: view.z, inside: false } : { ...HOME_AT, inside: true });
const pipAt = () => { const p = pip.group.position; return inTown(p.x) ? { x: p.x - TOWN_X, z: p.z, inside: false } : { ...HOME_AT, inside: true }; };
// How loud something is from where you stand: full next to it, fading with the metres, duller through a wall.
function loudAt(ear, at, reach = 9) {
  if (!ear) return 1; // looking from above: you hear it as it is
  if (ear.inside && at.inside) return 1;
  const g = 1 / (1 + (Math.hypot(ear.x - at.x, ear.z - at.z) / reach) ** 2) * (ear.inside !== Boolean(at.inside) ? 0.6 : 1);
  return g < 0.02 ? 0 : g;
}
// Where his playing goes: a volume that follows how far you are from him.
function pipEar() { buildMaster(); buildWorldSound(); if (snd.pip) snd.pip.gain.value = loudAt(earAt(), pipAt()); return snd.pip; }
const radioSongs = (s) => { const recs = (s?.studio?.songs ?? []).map((r) => ({ name: r.name, song: trackSong(r) })).filter((x) => x.song); return recs.length ? recs : (s?.log ?? []).filter((e) => e.action === 'play_piano' && !e.failed).slice(-8).map((e) => ({ name: `what he played ${when(e.at)}`, song: pianoSong(e.notes, e.style, e.instrument) })).filter((x) => x.song); };
function radioStop() { if (radio.node) { try { radio.node.gain.setTargetAtTime(0, audio.currentTime, 0.08); const n = radio.node; setTimeout(() => n.disconnect(), 600); } catch {} } radio.node = null; radio.until = 0; radio.name = ''; }
async function radioNext(say = false) {
  const list = radioSongs(lastState);
  if (!list.length) return toast('His radio is silent: he has not recorded a song yet.');
  await ensureAudio(); buildWorldSound(); radioStop();
  radio.idx = (radio.idx + 1 + (radio.idx < 0 ? Math.floor(Math.random() * list.length) : 0)) % list.length;
  const { name, song } = list[radio.idx];
  radio.node = audio.createGain(); radio.node.gain.value = 0.55; radio.node.connect(snd.radio);
  const mine = radio.node;
  radio.name = name; radio.until = Date.now() + 60_000; // (until the song has loaded and says how long it is)
  const secs = await playSong(song, mine);
  if (radio.node !== mine) return;
  radio.until = Date.now() + secs * 1000; radio.nextAt = radio.until + 40_000 + Math.random() * 50_000;
  if (say) toast(`📻 On his radio: “${name}”`);
}
function footstep() {
  if (!snd.ready || audio.state !== 'running') return;
  const t = audio.currentTime + 0.01, out = inTown(view.x);
  const src = noise(), f = audio.createBiquadFilter(), g = audio.createGain();
  f.type = 'bandpass'; f.frequency.value = (out ? 650 : 260) * (0.85 + Math.random() * 0.3); f.Q.value = out ? 0.9 : 1.6;
  g.gain.setValueAtTime(out ? 0.16 : 0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (out ? 0.09 : 0.13));
  src.connect(f).connect(g).connect(master); src.start(t, Math.random() * 3); src.stop(t + 0.2);
}
let stepsHeard = 0;
function tickWorldSound() {
  if (!audio || audio.state !== 'running') return;
  buildMaster(); buildWorldSound();
  const t = audio.currentTime, s = lastState ?? {};
  const walk = view.mode === 'walk', out = walk ? inTown(view.x) : streetish();
  const wet = /rain|drizzle|shower|storm|thunder/.test(String(s.weather?.kind ?? ''));
  const windy = Math.min(1, Math.max(0, Number(s.weather?.wind) || 0.3));
  const gust = 0.75 + 0.25 * Math.sin(Date.now() / 5300) + 0.18 * Math.sin(Date.now() / 1900 + 1.3); // the wind comes and goes
  snd.wind.gain.setTargetAtTime((out ? 0.035 + windy * 0.07 : 0.006 + windy * 0.01) * gust, t, 0.6);
  snd.windF.frequency.setTargetAtTime(out ? 320 + windy * 380 * gust : 180, t, 0.8);
  snd.rain.gain.setTargetAtTime(wet ? (out ? 0.2 : 0.07) : 0, t, 0.8);
  snd.rainF.frequency.setTargetAtTime(out ? 8500 : 1000, t, 0.5); // indoors you hear it on the roof, dull
  const ear = earAt();
  snd.pip.gain.setTargetAtTime(loudAt(ear, pipAt()), t, 0.25);
  snd.radio.gain.setTargetAtTime(radio.on ? loudAt(ear, RADIO_AT, 7) : 0, t, 0.25);
  // your own feet
  const stepLen = 0.78 * (inTown(view.x) ? 1 : 1.6), n = Math.floor(bob.walked / stepLen);
  if (n !== stepsHeard) { stepsHeard = n; if (walk && bob.moving && jump.y <= 0 && !fly.on) footstep(); }
  // the radio plays by itself when you are near enough to hear it, with a pause between the songs
  if (radio.on && walk && ear && Date.now() > Math.max(radio.until, radio.nextAt) && loudAt(ear, RADIO_AT, 7) > 0.12) { radio.nextAt = Date.now() + 120_000; radioNext(true).catch(() => {}); }
}
setInterval(tickWorldSound, 120);
// The radio itself: a small set on a crate beside his door.
function buildRadio() {
  const g = new THREE.Group();
  box(g, [0.5, 0.42, 0.42], 0x9a7448, [0, 0.21, 0]); // the crate
  box(g, [0.46, 0.04, 0.38], 0x7d5c38, [0, 0.44, 0]);
  box(g, [0.4, 0.24, 0.13], 0xc9503c, [0, 0.58, 0]); // the set
  box(g, [0.16, 0.16, 0.012], 0x3a2f2a, [-0.09, 0.58, 0.066]); // the speaker
  box(g, [0.12, 0.05, 0.012], 0xf2e6c8, [0.11, 0.63, 0.066]); // the dial
  box(g, [0.035, 0.035, 0.03], 0xf2e6c8, [0.08, 0.53, 0.07]);
  box(g, [0.035, 0.035, 0.03], 0xf2e6c8, [0.14, 0.53, 0.07]);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 5), mat(0xbfc4c8));
  rod.position.set(0.16, 0.9, -0.03); rod.rotation.z = -0.25; g.add(rod);
  g.position.set(TOWN_X + RADIO_AT.x, townGround(TOWN_X + RADIO_AT.x, RADIO_AT.z), RADIO_AT.z);
  g.rotation.y = 0.18;
  g.userData.info = () => {
    const list = radioSongs(lastState);
    const on = audio?.state === 'running';
    const playing = radio.name && Date.now() < radio.until;
    return { title: 'Pip’s radio', icon: '📻', subtitle: 'In his world', sections: [
      { lines: ['It plays the songs Pip recorded, one after another. The closer you stand, the louder it is.'] },
      { heading: 'Now', lines: [!list.length ? 'Silent. He has not recorded a song yet.' : !on ? 'The sound of the page is off, so you hear nothing.' : !radio.on ? 'Switched off.' : playing ? `Playing “${radio.name}”.` : 'Between two songs.'] },
      ...(list.length ? [{ heading: 'What you can do', buttons: [{ label: on ? '▶ Next song' : '🔊 Sound on, and play', run: () => { radio.on = true; radioNext(true).then(() => renderInfoAgain()); } }, ...(on ? [{ label: radio.on ? '⏸ Switch it off' : '▶ Switch it on', run: () => { radio.on = !radio.on; if (!radio.on) radioStop(); else radioNext(true); renderInfoAgain(); } }] : [])] }, { heading: `His songs (${list.length})`, chips: list.slice(-8).map((x) => `🎵 ${x.name}`) }] : []),
    ] };
  };
  scene.add(g);
  return g;
}
const radioSet = buildRadio();
const renderInfoAgain = () => { if (!infoBox.hidden) renderInfo(radioSet.userData.info()); };

// ---- apps Pip writes: they run only when opened, in a locked box (no internet, no saving, no way out)
const APP_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'";
// How an app looks on his phone: its own icon and short name (from the app itself), or one that fits its name.
const APP_ICONS = [[/gear|cog|machine|clock|tick/, '⚙️'], [/rain|weather|cloud|storm/, '🌧️'], [/timer|alarm|time/, '⏲️'], [/music|song|tune|melod|piano|synth|beat|drum/, '🎵'], [/garden|plant|flower|seed|grow/, '🌱'], [/star|sky|moon|planet|space|night/, '🌙'], [/cat|kitten/, '🐱'], [/bird/, '🐦'], [/train|rail/, '🚂'], [/draw|paint|sketch|art|colou?r/, '🎨'], [/puzzle|riddle/, '🧩'], [/game|play|jump|run/, '🎮'], [/book|read|story/, '📖'], [/cook|bake|food|bread|recipe/, '🍞'], [/light|lamp/, '💡'], [/note|diary|write/, '📝']];
function appLook(a) {
  const raw = String(a.title || a.name || 'app');
  const title = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()).slice(0, 22);
  const n = raw.toLowerCase();
  const icon = a.icon || APP_ICONS.find(([re]) => re.test(n))?.[1] || '✨';
  let h = 0; for (const c of raw) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { title, icon, bg: `linear-gradient(145deg, hsl(${h} 70% 78%), hsl(${(h + 40) % 360} 65% 62%))` };
}
async function openApp(app) {
  try {
    const res = await fetch(`${app.file}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('missing');
    const html = await res.text();
    $('appframe').setAttribute('sandbox', 'allow-scripts');
    $('appnote').textContent = APP_NOTE;
    $('appframe').srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${APP_CSP}">${html}`;
    $('apptitle').textContent = appLook(app).title;
    $('appview').hidden = false;
  } catch {
    $('replystatus').textContent = 'I could not open that app.';
  }
}
function closeApp() {
  $('appview').hidden = true;
  $('appframe').srcdoc = '';
  $('appframe').setAttribute('sandbox', 'allow-scripts');
  $('appnote').textContent = APP_NOTE;
}
// Pip's own website (site.js). It is shown in a box that runs no scripts at all and loads nothing but his own pictures.
const APP_NOTE = 'Made by Pip. It runs in a locked box: no internet, nothing is saved.';
const SITE_ORIGIN = 'https://raw.githubusercontent.com';
const SITE_CSP = `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' ${SITE_ORIGIN} data:; form-action 'none'; base-uri 'none'; frame-src 'none'`;
async function openSite() {
  const site = lastState?.site;
  if (!site?.file) return toast('Pip has no website yet. He makes one at the internet café.');
  try {
    const res = await fetch(`${site.file}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('missing');
    const base = localHost ? '' : RAW; // his pictures live next to his state
    const html = (await res.text()).replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/(<img\b[^>]*\ssrc=")((?:made|photos|gifts)\/)/gi, `$1${base}$2`);
    const frame = $('appframe');
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox'); // no scripts; a link may open in a new tab
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${SITE_CSP}">${html}`;
    $('apptitle').textContent = `🌐 ${site.title}`;
    $('appnote').textContent = `Pip’s own website, version ${site.v}. He writes it himself at the internet café.`;
    $('appview').hidden = false;
  } catch {
    toast('I could not open his website just now.');
  }
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
      const instrument = knownInstrument(String(d.instrument || '').toLowerCase());
      if (String(d.instrument || '').toLowerCase() === 'voice' || HELD_LOOKS.includes(String(d.instrument || '').toLowerCase())) return { at: String(d.instrument || '').toLowerCase() === 'voice' ? 'window' : /studio|music room/i.test(String(d.where || '')) ? 'studio_stage' : 'center', anim: 'jam', held: String(d.instrument).toLowerCase(), notes, instrument, step: stepFor(d.style), palette: [...new Map(notes.map((n) => [n.freq, n])).values()] };
      return { at: /studio|music room/i.test(String(d.where || '')) && ['epiano', 'harpsichord', 'organ', 'synth'].includes(instrument) ? 'studio_keys' : 'piano', anim: 'play', notes, instrument, step: stepFor(d.style), palette: [...new Map(notes.map((n) => [n.freq, n])).values()] };
    }
    case 'record_song': return HAS_STUDIO ? { at: 'studio_desk', anim: 'mix', song: trackSong(d) } : { at: 'computer', anim: 'write', song: trackSong(d) };
    case 'read_book': return { at: /music|chord|scale|rhythm|melody|harmony|synth|mix|song|instrument|sound|beat|bass|drum/i.test(String(d.topic || '')) ? 'studio_books' : 'bookshelf', anim: 'read' };
    case 'search_web': return { at: 'computer', anim: 'search' };
    case 'browse': return { at: 'computer', anim: 'search' };
    case 'write_diary': return { at: 'center', anim: 'write' };
    case 'go_out': return { at: 'hall_door', anim: 'look' }; // to the front door (then he is out: the game hides him)
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
    case 'check_light': return { at: resolveSpot(d.where || d.name), anim: 'look' };
    case 'phone': return { at: resolveSpot(d.lamp || 'middle'), anim: 'look' }; // he uses his phone near the lamp he switches
    case 'plant':
    case 'water':
    case 'harvest': {
      const gh = (lastState?.decor || []).find((x) => isGreenhouse(x) && x.pos && Date.parse(x.at) <= Date.now());
      return gh ? { at: 'custom', anim: 'make', spot: { p: new V3(gh.pos[0] + Math.sin(gh.rotY || 0) * 0.9, 0, gh.pos[2] + Math.cos(gh.rotY || 0) * 0.9), face: Math.PI + (gh.rotY || 0) }, madeAt: [gh.pos[0], 0.9, gh.pos[2]] } : { at: 'center', anim: 'look' };
    }
    case 'lamp_auto': return { at: 'center', anim: 'look' };
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
// A move is a few poses over time (see dances.js). Between two poses it eases; the last one leads back to the first.
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
// ---- Pip in his world outside (town.js). When he is out he is seen there: on his doorstep, at the door of the grocery
// store, by the notice board, or walking on his way to the pond or the library (when the place he goes to has no spot in
// the world he is out of sight until he comes back).
let outKey = '';
let outHidden = false;
let outPath = [];
let outIdx = 0;
let outSpot = '';
const townSpot = (n) => ({ p: new V3(TOWN_X + TOWN_SPOTS[n].x, 0, TOWN_SPOTS[n].z), face: TOWN_SPOTS[n].face, y: TOWN_SPOTS[n].y ?? 0 });
const farFrom = (n) => Math.hypot(pip.group.position.x - TOWN_X - TOWN_SPOTS[n].x, pip.group.position.z - TOWN_SPOTS[n].z);
function tickOutside() {
  const w = outWhere();
  const g = pip.group;
  if (!awayNow()) {
    if (outKey) { // home again: he comes in through the front door
      outKey = '';
      outHidden = false;
      outPath = [];
      if (inTown(g.position.x)) g.position.set(SPOTS.hall_door.p.x, 0, SPOTS.hall_door.p.z);
      if (plan && stepNow >= 0) startTask(plan.steps[stepNow]);
    }
    return;
  }
  const now = Date.now();
  const phase = now < Date.parse(w.arriveAt) && !w.cut ? 'going' : now < Date.parse(w.leaveAt) ? 'there' : 'back';
  const [name0, how] = TOWN_FOR[w.place] ?? ['left', 'in'];
  const name = w.spot && TOWN_SPOTS[w.spot] ? w.spot : name0; // a spot of its own for this outing (the wall he paints on)
  const route = ROUTES[name] ?? ROUTES[w.place] ?? [];
  const key = `${w.id}${phase}`;
  if (key !== outKey) {
    const fresh = !inTown(g.position.x); // he steps out of his door (or the page was opened while he is out)
    outKey = key;
    if (fresh) { const at = townSpot(phase === 'going' ? 'door' : name).p; g.position.set(at.x, townGround(at.x, at.z), at.z); }
    if (phase === 'back') outPath = [...route].reverse().concat('door'); // the same way home
    else if (phase === 'going' || fresh || !outPath.length) outPath = phase === 'going' ? [...route, name] : [name];
    outIdx = phase === 'back' || fresh || phase === 'going' ? 0 : outIdx;
    outSpot = '';
  }
  while (outIdx < outPath.length - 1 && farFrom(outPath[outIdx]) < 1.0) outIdx++; // one corner at a time, like through the doors at home
  const spotNow = outPath[outIdx];
  if (spotNow !== outSpot) {
    outSpot = spotNow;
    task = { at: 'custom', anim: 'look', spot: townSpot(spotNow), last: { action: 'go_out', details: { place: w.place } }, arrived: false, detour: null, phrase: null, nextPhraseAt: 0, nextBreak: Infinity, askUntil: 0 };
  }
  outHidden = how === 'in' && phase !== 'back' && spotNow === name && farFrom(name) < 0.7; // he went inside (the library): out of sight until he comes out
}
function startTask(last) {
  if (awayNow()) { outSpot = ''; tickOutside(); return; } // while he is out, the world outside decides where he is (he keeps walking where he was going)
  const plan = planFor(last);
  if (last.action === 'use' && last.made?.id && last.made.does === 'custom') setTimeout(() => runBehavior(last.made.id, 'custom', last.made.steps), 2500);
  if (last.action === 'use' && last.made?.id && ['drive', 'spin'].includes(last.made.does)) setTimeout(() => runBehavior(last.made.id, last.made.does, last.made.motion), 2500); // when he has walked up to it
  if (plan.anim === 'play' || plan.anim === 'jam') prefetchInstrument(plan.instrument, (plan.palette || []).flatMap((n) => n.chord ?? [n.freq]));
  task = { ...plan, spot: plan.spot || spotOf(plan.at), last, arrived: false, detour: null, phrase: null, nextPhraseAt: 0, nextBreak: Infinity, askUntil: 0 };
}
function startPhrase(notes, step, now) {
  task.phrase = { notes, step, t0: now, lastIdx: -1 };
  playNotes(notes, step, task.instrument, pipEar()); // you hear him louder the closer you stand
}
// Walking: go round furniture and things on the floor instead of through them (free: the page does it).
// Near his goal he walks straight so he can still reach it.
let steerSide = 1; // once he picks a side to go round, he keeps it (no dithering in front of a wall)
function steer(pos, dir, dist, goal = null) {
  if (dist < 0.8) return dir;
  const tryAngle = (a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const d = new V3(dir.x * c - dir.z * s, 0, dir.x * s + dir.z * c);
    return floorBlocked(pos.x + d.x * 0.5, pos.z + d.z * 0.5, undefined, goal) ? null : d;
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
let studioBusy = false;
let viewAt = 0;

function frame(now, dt) {
  updatePick(now, dt);
  const t = now / 1000;
  const g = pip.group;
  const { body, eyes, arms, feet, book, pageHinge, inst } = pip;

  // --- where is Pip and what is he doing right now?
  let walking = false;
  let engaged = false;
  let anim = 'idle';
  if (task) {
    const spot = task.detour ? task.detour.spot : task.spot;
    const toSpot = spot.p.clone().sub(g.position);
    toSpot.y = 0;
    const dist = toSpot.length();
    if (dist > 0.06) {
      walking = true;
      g.rotation.x = lerp(g.rotation.x, 0, dt * 8);
      g.position.y = lerp(g.position.y, inTown(g.position.x) ? townGround(g.position.x, g.position.z) : 0, dt * 8); // outside he walks over the ground as it is (up the hill)
      // to another room: through the doors, one waypoint at a time
      const way = nextGoal({ x: g.position.x, z: g.position.z }, { x: spot.p.x, z: spot.p.z });
      const wayP = way.x === spot.p.x && way.z === spot.p.z ? spot.p : new V3(way.x, 0, way.z);
      const to = wayP.clone().sub(g.position);
      to.y = 0;
      const wd = Math.max(to.length(), 1e-6);
      const dir = steer(g.position, to.normalize(), wd, wayP);
      g.position.addScaledVector(dir, Math.min(Math.max(wd, 0.06), 2.2 * dt));
      turnTo(Math.atan2(dir.x, dir.z), dt * 10);
    } else {
      turnTo(spot.face, dt * 6);
      g.position.y = lerp(g.position.y, (spot.y || 0) + (inTown(g.position.x) ? townGround(g.position.x, g.position.z) : 0), dt * 6);
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
          if (task.anim === 'play' || task.anim === 'jam') startPhrase(task.notes, task.step, now);
          if (task.anim === 'mix' && task.song && audio?.state === 'running') playSong(task.song);
          if (task.anim === 'ask') task.askUntil = now + 9000;
          task.nextBreak = task.anim === 'rest' ? Infinity : now + rand(40_000, 80_000);
        }
        anim = task.anim;
        engaged = true;
        if (task.anim !== 'look' && now > task.nextBreak) startBreak(); // a quick step does not send him walking back and forth: he idles in place
      }
    }
  }

  studioBusy = engaged && anim === 'mix';
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
  if (engaged && (anim === 'play' || anim === 'jam')) {
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
  for (const k of Object.keys(inst)) inst[k].visible = false;
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
    } else if (anim === 'mix') {
      const k = Math.sin(t * 1.7);
      body.rotation.x = 0.1;
      body.rotation.z = Math.sin(t * 4.2) * 0.035;
      la = [-0.3 + k * 0.14, 0.55, 0.62];
      ra = [0.3 + Math.sin(t * 1.3 + 1) * 0.14, 0.55 + Math.max(0, Math.sin(t * 5.1)) * 0.05, 0.62];
    } else if (anim === 'jam') {
      const playing = phraseIdx >= 0;
      const beat = playing ? Math.sin(t * 9) : 0;
      const alt = playing ? Math.sin(t * 9 + Math.PI) : 0;
      const k = task.held;
      const g2 = inst[k];
      if (g2) {
        g2.visible = true;
        const loc = (x, y, z) => new V3(x, y, z).applyEuler(g2.rotation).multiplyScalar(g2.scale.x).add(g2.position).toArray();
        body.rotation.z = playing ? Math.sin(t * 2.5) * 0.06 : Math.sin(t * 0.8) * 0.03;
        if (k === 'guitar') {
          g2.scale.setScalar(1.2);
          g2.position.set(0.02, 0.26, 0.62);
          g2.rotation.set(0.12, 0, -0.95);
          ra = loc(0, 0.5 + (playing ? Math.sin(t * 2.2) * 0.04 : 0), 0.07);
          la = loc(0.01, 0.07 + beat * 0.07, 0.1);
        } else if (k === 'violin') {
          g2.scale.setScalar(1.25);
          g2.position.set(0.1, 0.68, 0.64);
          g2.rotation.set(0.25, -0.35, -1.2);
          ra = loc(0, 0.4, 0.06);
          const bx = -0.12 + beat * 0.14;
          la = [bx, 0.6 + beat * 0.01, 0.8];
          const bow = inst.violin_bow;
          bow.visible = true;
          bow.position.set(bx + 0.18, 0.6, 0.78);
          bow.rotation.set(0, 0.12, -0.08);
        } else if (k === 'flute') {
          g2.scale.setScalar(1.35);
          g2.position.set(0, 0.68, 0.7);
          g2.rotation.set(0, 0.12, 0.05);
          la = loc(-0.17, 0, 0.02);
          ra = loc(0.15, 0, 0.02);
          la[1] += Math.max(0, beat) * 0.025;
          ra[1] += Math.max(0, alt) * 0.025;
          body.rotation.x = -0.06;
        } else if (k === 'clarinet') {
          g2.scale.setScalar(1.35);
          g2.position.set(0, 0.34, 0.7);
          g2.rotation.set(-0.3, 0, 0);
          la = loc(-0.035, 0.08, 0.04);
          ra = loc(0.035, -0.06, 0.04);
          la[1] += Math.max(0, beat) * 0.02;
          ra[1] += Math.max(0, alt) * 0.02;
          body.rotation.x = -0.05;
        } else if (k === 'kalimba') {
          g2.scale.setScalar(1.6);
          g2.position.set(0, 0.36, 0.72);
          g2.rotation.set(0.75, 0, 0);
          la = loc(-0.13, 0.03 + Math.max(0, beat) * 0.03, 0.02);
          ra = loc(0.13, 0.03 + Math.max(0, alt) * 0.03, 0.02);
          body.rotation.x = 0.1;
        } else if (k === 'harp') {
          g2.scale.setScalar(1.05);
          g2.position.set(0, 0, 0.85);
          g2.rotation.set(0, 0, 0);
          la = [-0.12, 0.34 + beat * 0.1, 0.87];
          ra = [0.12, 0.34 + alt * 0.1, 0.87];
        }
      }
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
  pip.face.set(faceNow(sleeping));
  pip.face.tick(dt);
  const closed = sleeping || t < blinkEnd || (mv && mvEyes > 0.6);
  eyes.forEach((e) => (e.scale.set(1, closed ? 0.1 : mv ? 1 + Math.max(0, -mvEyes) * 0.45 - Math.max(0, mvEyes) * 0.5 : 1, 1)));
}

// ---------------------------------------------------------------- free view: walk around and tap things to read about them
const r1 = (v) => (Math.round(Number(v) * 10) / 10).toString();
const logOf = (...actions) => (lastState?.log || []).filter((e) => actions.includes(e.action) && Date.parse(e.at) <= Date.now());
const WALK_EXTRA = [[-4.6, -3.6, 3.6, 4.2]]; // the chest
// What Pip built out in his world is solid for the walker: a tower cannot be walked through. (Where the walker already
// stands inside one, because it was just built around them, it does not hold them.)
function outsideSolid(x, z) {
  const now = performance.now();
  for (const d of lastState?.decor || []) {
    if (d.kind !== 'outside') continue;
    const g = decorGroups.get(d.id);
    if (!g) continue;
    let r = g.userData.foot;
    if (!r || now - r.at > 3000) { const b = new THREE.Box3().setFromObject(g); r = g.userData.foot = { at: now, x0: b.min.x - 0.25, x1: b.max.x + 0.25, z0: b.min.z - 0.25, z1: b.max.z + 0.25 }; }
    const inside = (px, pz) => px > r.x0 && px < r.x1 && pz > r.z0 && pz < r.z1;
    if (inside(x, z) && !inside(view.x, view.z)) return true;
  }
  return false;
}
function blocked(x, z) {
  if (inTown(x)) return townBlocked(x, z) || outsideSolid(x, z);
  if (!walkable(x, z) || blockedInHouse(x, z, 0.1)) return true;
  const furn = shownFurniture(lastState?.furniture);
  const rects = [...MOVABLE.filter((k) => !FURNITURE[k].flat).flatMap((k) => furnRects(furn, k)).map((r) => [r.x0, r.x1, r.z0, r.z1]), ...WALK_EXTRA];
  return rects.some(([x0, x1, z0, z1]) => x > x0 - 0.28 && x < x1 + 0.28 && z > z0 - 0.28 && z < z1 + 0.28);
}
// The face he makes right now: a hello gets a smile, what he just read shows what he thought of it, then his mood in
// his own word, then his body (bored, worn out, lonely, glad). A plain straight face when nothing stands out.
function faceNow(sleeping) {
  const s = lastState;
  if (forceLook.face) return forceLook.face;
  if (sleeping || !s) return 'sleepy';
  if (performance.now() < hello.until) return 'happy';
  const read = [...(s.log ?? [])].reverse().find((e) => e.opinion && Date.now() - Date.parse(e.at) < 12 * 60_000);
  if (read) return { love: 'delighted', like: 'happy', meh: 'bored', dislike: 'annoyed', doubt: 'sceptic' }[read.opinion.how] ?? 'neutral';
  const st = plan && stepNow >= 0 ? plan.steps[stepNow] : null;
  if (st?.failed || st?.made?.failed) return 'annoyed';
  const word = faceForWord(s.emotion) ?? faceForWord(s.mood);
  if (word) return word;
  if ((s.energy ?? 10) <= 2.5) return 'sleepy';
  if ((s.boredom ?? 0) >= 7) return 'bored';
  if ((s.loneliness ?? 0) >= 7.5) return 'sad';
  if ((s.joy ?? 5) >= 7.5) return 'happy';
  if (st && ['search_web', 'read_book', 'browse'].includes(st.action)) return 'curious';
  if (st && ['decorate', 'draw', 'make_app', 'update_app', 'blueprint', 'record_song'].includes(st.action)) return 'focused';
  return 'neutral';
}
// How high you look from: Pip's own height (his eyes are at 0.8 m, the top of his head at 1.2), inside and outside. So
// his world looks to you the way it looks to him. (It used to be a grown person's height outside, and higher still inside.)
const EYE = 1.05;
// Flying (V, or the bird button): you leave the ground and look at his world from above. Landing puts you on free ground.
const fly = { on: false, y: 12 };
function setFly(on) {
  if (on && !inTown(view.x)) { toast('Step outside first. Out there you can fly.'); return; }
  if (on === fly.on) return;
  fly.on = on;
  $('flybtn').setAttribute('aria-pressed', String(on));
  if (on) { fly.y = townGround(view.x, view.z) + EYE; view.keys.delete(' '); toast(touchOnly ? 'You fly. Push the stick to fly where you look. Tap the bird to land.' : 'You fly. W S to fly where you look, Space up, C down. V to land.'); return; }
  view.x = clamp(view.x, TOWN_X + WORLD.x0 + 1, TOWN_X + WORLD.x1 - 1); view.z = clamp(view.z, WORLD.z0 + 1, WORLD.z1 - 1);
  for (let r = 0; r < 40 && blocked(view.x, view.z); r += 0.5) for (let a = 0; a < 6.28; a += 0.4) { const x = view.x + Math.cos(a) * r, z = view.z + Math.sin(a) * r; if (!blocked(x, z)) { view.x = x; view.z = z; break; } } // not into a house or the pond
  view.pitch = Math.max(-0.5, Math.min(0.5, view.pitch));
}
$('flybtn').addEventListener('click', () => setFly(!fly.on));
// Saying hello (E, or the hand button): when he is near and awake he looks at you and bobs.
const hello = { until: 0, off: 0 };
function sayHello() {
  const p = pip.group.position;
  if (lastState?.last?.sleeping) return toast('Pip is asleep. He does not hear you.');
  if (!pip.group.visible || inTown(p.x) !== inTown(view.x)) return toast(inTown(view.x) ? 'Pip is not out here. The round map shows where he is.' : 'Pip is not here right now. The round map shows where he is.');
  if (Math.hypot(p.x - view.x, p.z - view.z) > 45) return toast('Pip is too far away to hear you. The round map shows where he is.');
  hello.until = performance.now() + 1900;
  toast('Pip looks at you and bobs. 👋');
}
$('hellobtn').addEventListener('click', sayHello);
function helloPose(before) { // (called around the frame that moves him: the bob is only on top of where he is)
  if (before) { pip.group.position.y -= hello.off; hello.off = 0; return; }
  const left = hello.until - performance.now();
  if (left <= 0) return;
  pip.group.rotation.y = Math.atan2(view.x - pip.group.position.x, view.z - pip.group.position.z);
  hello.off = Math.abs(Math.sin(left / 1000 * 8)) * 0.16 * (inTown(view.x) ? 1 : 1.6);
  pip.group.position.y += hello.off;
}
function updateWalk(dt) {
  if (view.mode !== 'walk') return;
  const fwd = (view.keys.has('w') || view.keys.has('arrowup') ? 1 : 0) - (view.keys.has('s') || view.keys.has('arrowdown') ? 1 : 0) + view.stick.y;
  // A and D (or the arrows left and right) turn you, like in Pino's town. When the mouse turns the view, they step sideways instead.
  const keyX = (view.keys.has('d') || view.keys.has('arrowright') ? 1 : 0) - (view.keys.has('a') || view.keys.has('arrowleft') ? 1 : 0);
  if (!turnWithMouse) view.yaw -= keyX * 1.9 * dt;
  const side = (turnWithMouse ? keyX : 0) + view.stick.x;
  if (fly.on) { // like a bird: where you look is where you go, through nothing and over everything
    const sp = (view.keys.has('shift') ? 24 : 10) * dt;
    const cp = Math.cos(view.pitch);
    const inHouse = (x, z, y) => BUILDINGS.some((bd) => { const [x0, x1, z0, z1] = rectOf(bd); return y < bd.size[1] + 1 && x - TOWN_X > x0 - 0.7 && x - TOWN_X < x1 + 0.7 && z > z0 - 0.7 && z < z1 + 0.7; }); // you fly over the houses, not through them
    const nx = view.x + (-Math.sin(view.yaw) * cp * fwd + Math.cos(view.yaw) * side) * sp;
    const nz = view.z + (-Math.cos(view.yaw) * cp * fwd - Math.sin(view.yaw) * side) * sp;
    const ny = fly.y + (Math.sin(view.pitch) * fwd + (view.keys.has(' ') ? 0.8 : 0) - (view.keys.has('c') ? 0.8 : 0)) * sp;
    if (!inHouse(nx, view.z, fly.y)) view.x = nx;
    if (!inHouse(view.x, nz, fly.y)) view.z = nz;
    if (!inHouse(view.x, view.z, ny)) fly.y = ny;
    view.x = clamp(view.x, TOWN_X + WORLD.x0 - 40, TOWN_X + WORLD.x1 + 40);
    view.z = clamp(view.z, WORLD.z0 - 40, WORLD.z1 + 40);
    fly.y = clamp(fly.y, townGround(view.x, view.z) + 1.2, 90);
    bob.moving = false;
    walkPlace();
    applyPixels();
    camera.position.set(view.x, fly.y, view.z);
    camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ');
    return;
  }
  const len = Math.hypot(fwd, side);
  bob.moving = false;
  if (len > 0.05) {
    const speed = (view.keys.has('shift') ? 6.4 : 3.4) * dt * Math.min(1, len); // a brisk walk; Shift: you run
    const dx = ((-Math.sin(view.yaw) * fwd + Math.cos(view.yaw) * side) / len) * speed;
    const dz = ((-Math.cos(view.yaw) * fwd - Math.sin(view.yaw) * side) / len) * speed;
    const wasZ = view.z;
    const fromX = view.x, fromZ = view.z;
    if (!blocked(view.x + dx, view.z)) view.x += dx;
    if (!blocked(view.x, view.z + dz)) view.z += dz;
    bob.walked += Math.hypot(view.x - fromX, view.z - fromZ); // only real steps count: pushing against a wall does not bob
    bob.moving = Math.hypot(view.x - fromX, view.z - fromZ) > 1e-4;
    // The front door in the hall leads to the street, and the door of his house in the street leads back in:
    // walking into the door (pushing on although the wall stops you) takes you through.
    const pushing = dz < 0 && view.z === wasZ;
    if (!inTown(view.x) && Math.abs(view.x - SPOTS.hall_door.p.x) < 0.7 && view.z < -3.3 && pushing) Object.assign(view, { x: TOWN_X, z: 1.6, yaw: Math.PI }); // (a slow screen takes big steps: the wall can stop you a little way off)
    else if (inTown(view.x) && Math.abs(view.x - TOWN_X) < 0.9 && view.z < 2.4 && pushing) Object.assign(view, { x: SPOTS.hall_door.p.x, z: -3.7, yaw: Math.PI });
  }
  walkPlace(); // inside or outside: the sky, the horizon and the look follow where you stand
  applyPixels();
  // His room is built 1.6 times bigger than life (so is he): inside you stand as tall as he does, and can look out of
  // his windows at the street. Outside everything is life-size.
  // Bobbing: the view goes a little up and down with every step, and sways a touch from foot to foot. It fades in when
  // you start walking and out when you stop. (Inside everything is 1.6 times bigger, so the steps are too.)
  for (let left = Math.min(dt, 0.25); (jump.v || jump.y > 0) && left > 0; left -= 1 / 90) { const h = Math.min(left, 1 / 90); jump.y += jump.v * h; jump.v -= 13 * h; if (jump.y <= 0) { jump.y = 0; jump.v = 0; } } // a hop: up, and gravity brings you down (in small steps, so a slow screen jumps just as high)
  bob.k += ((bob.moving && bobOn && jump.y <= 0 ? 1 : 0) - bob.k) * Math.min(1, dt * 8);
  const big = inTown(view.x) ? 1 : 1.6;
  const stepLen = 0.78 * big;
  const up = Math.sin((bob.walked / stepLen) * Math.PI * 2) * 0.042 * big * bob.k;
  const sway = Math.sin((bob.walked / stepLen) * Math.PI) * 0.022 * big * bob.k;
  camera.position.set(view.x + Math.cos(view.yaw) * sway, (inTown(view.x) ? EYE + townGround(view.x, view.z) : EYE) + up + jump.y * (inTown(view.x) ? 1 : 1.6), view.z - Math.sin(view.yaw) * sway);
  camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ');
  if (window.pipSky) { const [x, y, z, tx, tz] = window.pipSky; camera.position.set(TOWN_X + x, y, z); camera.lookAt(TOWN_X + tx, 0, tz); } // for testing: a look at the world from above
}
// Out in the street the sky is a real colour (in the overview everything stands on the page's own background).
let walkOut = false;
function skyNow() {
  const h = forceLook.hour ?? new Date().getHours() + new Date().getMinutes() / 60;
  const se = seasonInfo(new Date());
  return h < se.sunrise - 0.6 || h > se.sunset + 0.7 ? 0x1b2347 : h < se.sunrise + 0.7 ? 0xf7c9a8 : h > se.sunset - 0.9 ? 0xf2a988 : 0xa9d8f2;
}
// His home from outside is a plain block in the world, but from inside it is his real room. So that you see the real
// world through his real windows, the whole world is set down right outside his walls while you are inside: the street
// runs past his front door in the hall, and his plot lies across it. (The block of his own house, and the neighbour
// whose block would stand in his bedroom, are left out then.) Step out of the door and the world is back in its place.
const PORTAL = { x: 6.8, z: -5.3 }; // the front door in the hall: where the door of his house in the street is
const HOUSE_RECT = [-5.5, 8.8, -5.5, 5.5];
const hideInside = BUILDINGS.filter((b) => { const [x0, x1, z0, z1] = rectOf(b); return PORTAL.x - x1 < HOUSE_RECT[1] && PORTAL.x - x0 > HOUSE_RECT[0] && PORTAL.z - z1 < HOUSE_RECT[3] && PORTAL.z - z0 > HOUSE_RECT[2]; }).map((b) => b.key);
function placeOutsideThings() { // what he built out there moves along with the world
  for (const d of lastState?.decor || []) {
    const g = d.kind === 'outside' && d.pos ? decorGroups.get(d.id) : null;
    if (!g) continue;
    if (portalOn) { g.position.set(PORTAL.x - (d.pos[0] - TOWN_X), d.pos[1], PORTAL.z - d.pos[2]); g.rotation.y = (d.rotY || 0) + Math.PI; } else { g.position.set(d.pos[0], d.pos[1], d.pos[2]); g.rotation.y = d.rotY || 0; }
  }
}
function setPortal(on) {
  portalOn = on;
  town.group.position.set(on ? PORTAL.x : TOWN_X, 0, on ? PORTAL.z : 0);
  town.group.rotation.y = on ? Math.PI : 0;
  town.setInside(on, hideInside, [PORTAL.x - HOUSE_RECT[1], PORTAL.x - HOUSE_RECT[0], PORTAL.z - HOUSE_RECT[3], PORTAL.z - HOUSE_RECT[2]]); // (and where his real rooms are, in the world's own measure: nothing of the world may show through his floor)
  for (const o of [land.root, land.mask, sideLand.root, sideLand.mask]) o.visible = !on; // the painted view behind the glass makes way for the real world
  placeOutsideThings();
  town.update(lastState, Date.now(), forceLook.hour);
}
// What he printed stands on the shelf in front of the print workshop: each print small, the newest ones (the shelf holds 21).
let printsKey = '';
const printModels = new THREE.Group();
town.group.add(printModels);
function syncPrints(s) {
  const list = (s?.prints ?? []).filter((p) => p?.id && Array.isArray(p.parts) && Date.parse(p.at) <= Date.now()).slice(-PRINT_SLOTS.length);
  const key = list.map((p) => p.id).join(',');
  if (key === printsKey) return;
  printsKey = key;
  printModels.clear();
  list.forEach((p, i) => {
    const g = buildDecor({ id: `print-${p.id}`, name: p.name, parts: p.parts, scale: 1, pos: [0, 0, 0], rotY: 0, kind: 'floor', at: p.at });
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    const size = b.getSize(new V3()), mid = b.getCenter(new V3());
    const k = Math.min(0.62 / Math.max(size.x, size.z, 0.01), 0.56 / Math.max(size.y, 0.01)); // every print fits its place on the shelf
    const [x, y, z] = PRINT_SLOTS[i];
    g.scale.setScalar(k);
    g.position.set(x - mid.x * k, y - b.min.y * k, z - mid.z * k);
    g.rotation.y = 0;
    printModels.add(g);
  });
}
// His playthings (play.js): what he built or was given to do things with outside. Each waits at the place where he
// uses it (his bike leans against his house, his boat lies by the pond, his kite on the edge of his field). When he is
// out with one, you see him do it: he rides round the square, his plane circles over the field, his boat crosses the pond.
let playKey = '';
const playModels = new THREE.Group();
town.group.add(playModels);
const playGroups = new Map(); // id -> { g, home: [x, y, z], k }
const PARK = { square: (i) => [2.5 + i * 1.3, 0.9], doorstep: (i) => [-3.3 - i * 1.0, 0.9], pond: (i) => [-14.6, 21.8 + i * 1.5], field: (i) => [30.8, 12.5 + i * 2.0], stone: (i) => [-50.5, -12.5 + i * 1.5] };
const PLAY_LEVEL = (p) => ((p.goes ?? 0) === 0 ? 'never tried yet' : p.goes < 3 ? 'a beginner' : p.goes < 8 ? 'getting the hang of it' : p.goes < 20 ? 'good at it' : 'a master');
const PLAY_AT = { square: 'on the square', pond: 'on the pond', field: 'on his field', stone: 'out by the green stone', doorstep: 'in front of his door' };
function playInfo(p) {
  return { title: p.name.replace(/^./, (c) => c.toUpperCase()), icon: '🪁', subtitle: `${p.made === 'given' ? 'He asked for it, and it was given to him' : 'He built it himself'} · ${when(p.createdAt)}`, image: decorThumb(p, 320), sections: [
    { heading: 'What he does with it', quote: p.how },
    { heading: 'So far', lines: [p.goes ? `He went out with it ${p.goes} time${p.goes === 1 ? '' : 's'}${p.lastAt ? `, last ${when(p.lastAt)}` : ''}.` : 'It still waits for its first go.', `By now he is ${PLAY_LEVEL(p)}.`], chips: [`${p.verb} it ${PLAY_AT[p.where] ?? 'outside'}`] },
    ...(p.why ? [{ heading: 'Why he wanted it', quote: p.why }] : []),
    ...thinks(p),
  ] };
}
function syncPlay(s) {
  const list = (s?.playthings ?? []).filter((p) => p?.id && Array.isArray(p.parts) && p.parts.length);
  const key = list.map((p) => `${p.id}:${p.where}`).join(',');
  if (key === playKey) return;
  playKey = key;
  playModels.clear();
  playGroups.clear();
  const n = {};
  for (const p of list) {
    const g = buildDecor({ id: `play-${p.id}`, name: p.name, parts: p.parts, scale: 1, pos: [0, 0, 0], rotY: 0, kind: 'floor', at: p.createdAt });
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    const size = b.getSize(new V3()), mid = b.getCenter(new V3());
    const k = Math.min(1, 2.6 / Math.max(size.x, size.z, 0.01), 2.4 / Math.max(size.y, 0.01)); // life-size, but never bigger than a small cart
    const i = (n[p.where] = (n[p.where] ?? -1) + 1);
    const [x, z] = (PARK[p.where] ?? PARK.square)(i);
    const inner = new THREE.Group(); // (so its middle stands on the spot, whatever way he built it)
    g.scale.setScalar(k); g.position.set(-mid.x * k, -b.min.y * k, -mid.z * k);
    inner.add(g);
    inner.position.set(x, townGround(TOWN_X + x, z), z);
    inner.userData.info = () => playInfo((lastState?.playthings ?? []).find((q) => q.id === p.id) ?? p);
    g.userData.info = inner.userData.info;
    playModels.add(inner);
    playGroups.set(p.id, { g: inner, home: [x, townGround(TOWN_X + x, z), z], tall: size.y * k });
  }
}
// Where a round goes at each place: [centre x, centre z, how wide, how deep] (metres in the village).
const ROUNDS = { square: [(SQUARE.x0 + SQUARE.x1) / 2, (SQUARE.z0 + SQUARE.z1) / 2, 14, 9], pond: [POND.x, POND.z, POND.rx + 6.5, POND.rz + 6.5], field: [(PLOT.x0 + PLOT.x1) / 2, (PLOT.z0 + PLOT.z1) / 2, 14, 13], stone: [-54, -16, 7, 7], doorstep: [0, 3.2, 5, 1.2] };
let playingId = null;
function updatePlay(now) {
  const w = lastState?.where;
  const job = w?.play && !portalOn ? w.play : null;
  const t0 = job ? Date.parse(w.arriveAt) : 0;
  const on = job && Date.now() >= t0 + 20_000 && Date.now() < Date.parse(w.leaveAt) && !w.cut && playGroups.has(job.id) && farFrom(TOWN_FOR[w.place]?.[0] ?? 'square') < 40;
  if (!on) {
    if (playingId) { const pg = playGroups.get(playingId); if (pg) { pg.g.position.set(...pg.home); pg.g.rotation.set(0, 0, 0); } playingId = null; }
    return;
  }
  playingId = job.id;
  const pg = playGroups.get(job.id);
  const t = (Date.now() - t0) / 1000;
  const [cx, cz, rx, rz] = ROUNDS[job.place] ?? ROUNDS.square;
  const spot = TOWN_SPOTS[TOWN_FOR[w.place]?.[0] ?? 'square'];
  const me = pip.group;
  const ground = (x, z) => townGround(TOWN_X + x, z);
  const put = (o, x, y, z, face) => { o.position.set(x, y, z); o.rotation.y = face; };
  if (job.motion === 'ride') { // round and round, with him on it
    const a = (t * 3.0) / ((rx + rz) / 2);
    const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz;
    const face = Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz);
    put(pg.g, x, ground(x, z), z, face + Math.PI / 2);
    me.position.set(TOWN_X + x, ground(x, z) + Math.min(0.5, pg.tall * 0.45), z); me.rotation.y = face;
  } else if (job.motion === 'fly') { // it circles in the air; he stands and looks up at it
    const a = t * 0.45;
    const x = spot.x + 5 + Math.cos(a) * 8, z = spot.z + 6 + Math.sin(a) * 6, y = 7 + Math.sin(t * 0.7) * 1.4;
    put(pg.g, x, ground(x, z) + y, z, -a);
    pg.g.rotation.z = Math.sin(t * 1.3) * 0.2;
    me.position.set(TOWN_X + spot.x, ground(spot.x, spot.z), spot.z); me.rotation.y = Math.atan2(x - spot.x, z - spot.z);
  } else if (job.motion === 'float') { // it drifts over the pond; he watches from the bank
    const a = t * 0.12;
    const x = POND.x + Math.cos(a) * POND.rx * 0.6, z = POND.z + Math.sin(a * 1.3) * POND.rz * 0.55;
    put(pg.g, x, 0.1 + Math.sin(t * 1.1) * 0.03, z, -a + Math.PI / 2);
    me.position.set(TOWN_X + spot.x, ground(spot.x, spot.z), spot.z); me.rotation.y = Math.atan2(x - spot.x, z - spot.z);
  } else if (job.motion === 'roll') { // it goes over the ground, and he goes after it
    const a = t * 0.55, far = 7 * (0.5 - 0.5 * Math.cos(a * 2));
    const dx = Math.cos(a * 0.37), dz = Math.sin(a * 0.37);
    const x = spot.x + 3 + dx * far, z = spot.z + 5 + dz * far;
    put(pg.g, x, ground(x, z), z, t * 2);
    const mx = spot.x + 3 + dx * far * 0.75, mz = spot.z + 5 + dz * far * 0.75;
    me.position.set(TOWN_X + mx, ground(mx, mz) + Math.abs(Math.sin(t * 6)) * 0.06, mz); me.rotation.y = Math.atan2(x - mx, z - mz);
  } else if (job.motion === 'stay') { // it stands where it is, and he is at it
    pg.g.position.set(...pg.home);
    me.position.set(TOWN_X + pg.home[0] + 0.7, pg.home[1], pg.home[2] + 0.4); me.rotation.y = Math.atan2(-0.7, -0.4);
  } else { // he holds it and does it on the spot
    const bob = Math.abs(Math.sin(t * 3.2)) * 0.35;
    me.position.set(TOWN_X + spot.x, ground(spot.x, spot.z), spot.z);
    put(pg.g, spot.x + Math.sin(me.rotation.y) * 0.5, ground(spot.x, spot.z) + 0.75 + bob, spot.z + Math.cos(me.rotation.y) * 0.5, t * 1.5);
  }
}
// His museum (town.js builds the hall and the plinths; museum.js keeps what stands on them): each thing he shows, on
// its own plinth, at its real size (a thing too big for a plinth is made smaller until it fits). A tap opens its card.
let museumKey = '';
const museumModels = new THREE.Group();
const museumTouch = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
town.group.add(museumModels);
function pieceInfo(p) {
  return { title: p.name, icon: '🏛️', subtitle: `In his museum · made ${when(p.createdAt)}`, image: decorThumb(p, 320), sections: [
    ...(p.why ? [{ heading: 'Why he made it', quote: p.why }] : []),
    ...thinks(p),
    ...(p.shown ? [{ heading: 'Why it stands here', quote: p.shown }] : []),
    ...(p.uses?.length ? [{ heading: 'What it is for', chips: p.uses.map((u) => u.label) }] : []),
    { lines: [p.from === 'chest' ? `It lay in his chest. Since ${when(p.shownAt)} it stands here for everyone to see.` : p.from === 'room' ? `He carried it here from his room, ${when(p.shownAt)}.` : `His room was full, so it came straight here, ${when(p.shownAt)}.`] },
  ] };
}
function syncMuseum(s) {
  const list = (s?.museum ?? []).filter((p) => p?.id && Array.isArray(p.parts) && p.parts.length).slice(-MUSEUM_SLOTS.length);
  const key = list.map((p) => p.id).join(',');
  if (key === museumKey) return;
  museumKey = key;
  museumModels.clear();
  list.forEach((p, i) => {
    const g = buildDecor({ id: `museum-${p.id}`, name: p.name, parts: p.parts, scale: 1, pos: [0, 0, 0], rotY: 0, kind: 'floor', at: p.createdAt });
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    const size = b.getSize(new V3()), mid = b.getCenter(new V3());
    const k = Math.min(p.roomScaled ? 1 / 1.6 : 1, 1.3 / Math.max(size.x, size.z, 0.01), 1.7 / Math.max(size.y, 0.01)); // life-size (his room is built 1.6 times bigger), and never wider than its place
    const [x, z] = MUSEUM_SLOTS[i];
    g.scale.setScalar(k);
    g.position.set(x - mid.x * k, PLINTH.h - b.min.y * k, z - mid.z * k);
    g.userData.info = () => pieceInfo(p);
    g.userData.lit = false;
    // (a small thing is hard to point at: the whole space above its plinth opens its card)
    const tall = Math.max(0.5, size.y * k + 0.2);
    const touch = new THREE.Mesh(new THREE.BoxGeometry(PLINTH.w + 0.1, tall, PLINTH.w + 0.1), museumTouch);
    touch.position.set(x, PLINTH.h + tall / 2, z);
    touch.userData.info = g.userData.info;
    museumModels.add(g, touch);
  });
}
let walkKey = '';
function walkPlace() {
  const out = view.mode === 'walk' && inTown(view.x);
  const inside = portalReady && view.mode === 'walk' && !out;
  if (`${out}${inside}` === walkKey) return;
  walkKey = `${out}${inside}`;
  walkOut = out;
  if (portalOn !== inside) setPortal(inside);
  town.setWalk(out || inside);
  scene.userData.sky = out || inside ? town.skyFog() : null; // look.js keeps the background: this tells it to show the sky's own colour
  if (out || inside) scene.background.set(town.skyFog());
  scene.fog = out ? new THREE.Fog(town.skyFog(), 140, 700) : null; // far things fade into the sky
  fitCamera();
  home.full.visible = view.mode === 'walk' && !out;
  home.roof.visible = view.mode === 'walk' && !out;
}
function setMode(mode) {
  view.mode = mode;
  camera.near = mode === 'walk' ? 0.15 : 1; // close up in walk mode, far away in the overview
  camera.updateProjectionMatrix();
  document.body.classList.toggle('walking', mode === 'walk');
  extraWalls.visible = mode === 'walk';
  home.low.visible = mode !== 'walk';
  home.full.visible = mode === 'walk';
  home.roof.visible = mode === 'walk';
  $('stick').hidden = mode !== 'walk';
  $('resetview').hidden = mode === 'walk';
  if (mode === 'walk') {
    Object.assign(view, streetish() ? { x: TOWN_X + 4, z: 9.2, yaw: 0.3, pitch: 0.04 } : { x: 0, z: 3.4, yaw: 0, pitch: 0 }); // from the street view: you start in the street
    camera.fov = 70;
    camera.rotation.order = 'YXZ';
  } else {
    camera.fov = 35;
    view.stick = { x: 0, y: 0 };
    view.keys.clear();
    $('knob').style.transform = '';
  }
  camera.updateProjectionMatrix();
  walkPlace();
  if (mode === 'overview') fitCamera();
  $('walk').textContent = mode === 'walk' ? '🏠 Back to overview' : '🚶 Walk around';
  hideInfo();
}
$('walk').addEventListener('click', () => setMode(view.mode === 'walk' ? 'overview' : 'walk'));

// Things you can tap: Pip, the photo and Pip's creations carry their own info; furniture is found by where you tapped.
// Places in the room that are worth a tap (by where the tap lands). Plain furniture (rug, shelves, bed, wardrobe, plant) is not:
// it has nothing to show. Pip, his creations, his chest and the framed photo carry their own info.
const REGIONS = [
  { furn: 'desk', box: [-5, -3.6, 0, 1.9, 0.1, 2.3], center: [-4.3, 1.4, 1.2], info: () => computerInfo() },
  { box: [-0.9, 1.5, 1.7, 4.1, -60, -4.8], center: [0.3, 3.9, -4.9], info: () => windowInfo() }, // deep: a tap through the glass lands on the world outside
];
function computerInfo() {
  const s = lastState || {};
  const apps = (s.apps || []).slice(-4).reverse();
  const searches = [...new Set((s.log || []).filter((e) => e.action === 'search_web' && e.query && !e.failed).map((e) => e.query))].slice(-3).reverse();
  const lvl = Math.min(10, 1 + Math.floor(Math.sqrt((s.skills?.coding || 0) / 2)));
  const sections = [
    { lines: ['Pip looks things up here, and writes his little programs.'] },
    { heading: 'What he looked up lately', chips: searches.length ? searches : ['nothing yet'] },
    { heading: 'His programs', chips: apps.length ? apps.map((a) => a.name) : ['none yet'] },
    { heading: 'Skill', chips: [`💻 coding ${lvl}/10`] },
  ];
  return { title: 'His computer', icon: '💻', subtitle: 'On his desk', sections, actions: apps.map((a) => ({ icon: '▶', text: `Open ${a.name}`, run: () => openApp(a) })) };
}
function windowInfo() {
  const s = lastState || {};
  const lvl = lightAt(s, 0.3, -4.4, Date.now(), { hour: forceLook.hour, weather: { kind: forceLook.weather || land.state.weather, cloud: land.state.cloud } });
  const wx = { clear: '☀️ clear', cloudy: '☁️ cloudy', rain: '🌧️ raining', snow: '❄️ snowing', fog: '🌫️ foggy', storm: '⛈️ a storm' }[forceLook.weather || land.state.weather] || '';
  const shots = (s.pictures || []).filter((p) => p.by === 'pip' && /window|sky/i.test(p.target || '')).length;
  return {
    title: 'The window', icon: '🪟', subtitle: 'What Pip sees of the world',
    sections: [
      { lines: ['The sky, the weather and the light out there follow the real time where Pip lives.'] },
      { heading: 'Now', chips: [wx, s.weather?.temp != null ? `🌡️ ${Math.round(s.weather.temp)}°C` : '', `💡 ${levelWord(lvl.level)} by the window`].filter(Boolean) },
      ...(shots ? [{ heading: 'His photos', chips: [`📷 ${shots} of the view`] }] : []),
    ],
  };
}
// What a tap hit: its info, and what to highlight (the thing itself, or a point for a place like the window).
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function infoFor(hit) {
  for (let o = hit.object; o; o = o.parent) {
    if (o.userData?.info) { const info = typeof o.userData.info === 'function' ? o.userData.info() : o.userData.info; return info ? { info, direct: true, anchor: o } : null; }
  }
  const { x, y, z } = hit.point;
  const r = REGIONS.find(({ live, box }) => { const [x0, x1, y0, y1, z0, z1] = live ?? box; return x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1; });
  const info = r?.info() ?? null;
  return info ? { info, direct: false, anchor: new V3(...r.center) } : null;
}
const BAR_COLORS = [['Fullness', 'fullness', '#e0974a'], ['Energy', 'energy', '#e2c13c'], ['Wonder', 'wonder', '#9b6fd6'], ['Joy', 'joy', '#e0658c'], ['Calm', 'calm', '#4aa3b8']];
// Which place he is nearest to, in words.
const NEAR_WORDS = { piano: 'the piano', bookshelf: 'the bookshelf', computer: 'his desk', bed: 'his bed', plant: 'the plant', window: 'the window', frame: 'the picture', chest: 'his chest', center: 'the middle of the room' };
function nearestPlace() {
  let best = null;
  for (const [k, sp] of Object.entries(SPOTS)) {
    const d = Math.hypot(sp.p.x - pip.group.position.x, sp.p.z - pip.group.position.z);
    if (!best || d < best.d) best = { k, d };
  }
  return best && best.d < 2.2 ? `Near ${NEAR_WORDS[best.k] || best.k}` : 'Walking around the room';
}
function pipInfo() {
  const s = lastState;
  const now = plan && stepNow >= 0 ? headline(plan.steps[stepNow]) : ['•', 'getting ready'];
  const nextStep = plan && stepNow >= 0 ? plan.steps[stepNow + 1] : null;
  const sleeping = !!s?.last?.sleeping || (task?.anim === 'rest' && task?.arrived);
  const wearing = (s?.wardrobe || []).filter((c) => c.worn).map((c) => c.name);
  const bag = (s?.tools || []).map((x) => ({ text: x.name, title: x.why || '' }));
  const lvl = s ? lightAt(s, pip.group.position.x, pip.group.position.z, Date.now(), { hour: forceLook.hour, weather: { kind: forceLook.weather || land.state.weather, cloud: land.state.cloud } }) : null;
  const sections = [
    { now: { icon: now[0], text: now[1], sleepy: sleeping }, next: nextStep ? `Next: ${headline(nextStep).join(' ')}` : '' },
    { heading: 'Where', chips: [nearestPlace(), pip.group.position.y > 0.25 ? 'Up on something' : '', lvl ? `💡 Light here: ${levelWord(lvl.level)}` : ''].filter(Boolean) },
  ];
  if (s) sections.push({ heading: 'How he feels', bars: BAR_COLORS.map(([label, key, color]) => ({ label, value: Number.isFinite(Number(s[key])) ? Number(s[key]) : 5, color })) });
  if (s?.last?.thought) sections.push({ heading: 'Latest thought', quote: `“${s.last.thought}”`, quoteNote: `${when(s.last.at)}` });
  sections.push({ heading: 'Wearing', chips: wearing.length ? wearing : ['nothing special'] });
  sections.push({ heading: 'In his inventory', chips: bag.length ? bag : ['empty'] });
  return {
    title: 'Pip',
    icon: 'P',
    avatar: true,
    subtitle: [(s?.emotion || s?.mood) ? `Feeling ${s.emotion || s.mood}` : '', sleeping ? 'asleep' : 'awake'].filter(Boolean).join(' · '),
    sections,
    actions: [{ icon: '📖', text: 'See his day', run: () => { hideInfo(); showTab('day'); } }, { icon: '💗', text: 'Open the Pip tab', run: () => { hideInfo(); showTab('life'); } }],
    refresh: pipInfo, // the card keeps updating while it is open
  };
}
pip.group.userData.info = pipInfo;
wallFrame.userData.info = () => ({
  title: 'Beneath the Milky Way',
  image: 'pictures/dark-sky.jpg',
  lines: ["A photo of the Milky Way over a very dark sky, with two people in silhouette looking up from a railing. It hangs above Pip's piano.", 'Photo: ESO/Luis Calçada/Herbert Zodet'],
  links: [{ text: 'Photo page on Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:Beneath_the_Milky_Way.jpg' }, { text: 'License: CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }],
});
chestGroup.userData.info = () => {
  const items = lastState?.stored || [];
  if (!items.length) return null; // an empty chest has nothing to show
  return { title: "Pip's chest", lines: items.length ? ['Things Pip put away. Nothing is lost, and he can take them out again:', ...items.map((x) => `• ${x.name}`)] : ['An empty chest. Pip puts things here when he does not want them in his room for a while.'] };
};
function appById(id) {
  return (lastState?.apps || []).find((a) => a.id === id);
}
// What happens when a use is pressed: its text, what you see, a song, an app.
function showUse(d, use) {
  const actions = [];
  if (use.does) runBehavior(d.id, use.does, use.motion);
  if (use.song) actions.push({ icon: '▶', text: 'Hear it', run: () => playSong(use.song) });
  const app = use.app ? appById(use.app) : null;
  if (app) actions.push({ icon: '▶', text: `Open ${app.name}`, run: () => openApp(app) });
  actions.push({ icon: '←', text: 'Back', run: () => showInfo(decorInfo(d)) });
  showInfo({ title: use.label, icon: USE_ICON[use.does] || '👆', subtitle: d.name, image: use.view || null, sections: use.text ? [{ lines: [use.text] }] : [], actions });
}
const USE_ICON = { light: '💡', drive: '🚗', spin: '🌀', stand: '🪜', custom: '✨' };
function decorInfo(d) {
  if (d.readyAt && Date.now() < Date.parse(d.readyAt)) { // still being built: the card says how far he is
    const ready = new Date(Date.parse(d.readyAt)).toLocaleTimeString('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' });
    return { title: d.name, icon: '🔨', subtitle: `Pip is building this · ${d.label}`, sections: [{ lines: [`It is ${Math.round(sitePart(d) * 100)}% built. It grows while he works on it, and stands around ${ready}.`] }, ...(d.why ? [{ heading: 'Why he builds it', quote: `“${d.why}”` }] : [])], refresh: () => decorInfo(d) };
  }
  if (d.stages > 1 && (d.stage ?? d.stages) < d.stages) return { title: d.name, icon: '🔨', subtitle: `Pip is still building this · ${d.label}`, sections: [{ lines: [`Sitting ${d.stage} of ${d.stages} is done: ${d.stage === 1 ? 'only the frame stands' : 'it is getting there'}. He goes on with it when he feels like it.`] }, ...(d.why ? [{ heading: 'Why he builds it', quote: `“${d.why}”` }] : [])] };
  if (d.art) { const art = (lastState?.art ?? []).find((a) => a.id === d.art) ?? d; return { title: d.name, icon: '🎨', subtitle: `A drawing by Pip · ${d.label}`, image: d.image, sections: [...(d.why ? [{ heading: 'Why he drew it', quote: `“${d.why}”` }] : []), ...thinks(art)] }; }
  if (d.print) return { title: d.name, icon: '🖨️', subtitle: `A print from Pip's photo printer · ${d.label}`, image: d.image };
  const pic = (lastState?.pictures || []).find((p) => p.id === d.picture);
  if (d.image) {
    const mine = pic?.by === 'pip';
    const secs = [];
    if (pic?.caption) secs.push({ heading: mine ? 'His caption' : 'What you wrote', quote: `“${pic.caption}”` });
    if (pic?.matters) secs.push({ heading: 'Why it matters to him', quote: `“${pic.matters}”` });
    else if (pic?.notes && pic.notes !== pic.caption) secs.push({ heading: 'What he sees', quote: `“${pic.notes}”` });
    return { title: d.name, icon: mine ? '📷' : '🖼️', subtitle: `${mine ? 'A photo Pip took' : 'A picture someone gave to Pip'} · ${d.label}`, image: d.image, sections: secs };
  }
  const lamp = isLamp(d);
  const house = isGreenhouse(d);
  const sections = [];
  if (d.why) sections.push({ heading: 'Why he made it', quote: `“${d.why}”` });
  sections.push(...thinks(d));
  const proj = (lastState?.projects || []).find((p) => (p.versions || []).some((v) => v.ref === d.id));
  const ver = proj?.versions.find((v) => v.ref === d.id);
  const facts = [d.label, proj ? `🧩 ${proj.title} · v${ver.v}${proj.status === 'done' && proj.proud ? ' · he is proud of it' : ''}` : d.project ? `Project: ${d.project}` : '', d.usedAt ? `👆 last used ${when(d.usedAt)}` : ''].filter(Boolean);
  if (lamp) {
    const on = d.auto === 'dark' ? autoLampOn(lastState, d, Date.now(), { hour: forceLook.hour, weather: { kind: forceLook.weather || land.state.weather, cloud: land.state.cloud } }) : litOf(d);
    facts.push(on ? '💡 On' : '💡 Off', d.auto === 'dark' ? '🌙 Switches itself on in the dark' : '');
  }
  sections.push({ heading: 'Where', chips: facts.filter(Boolean) });
  if (house) {
    const plots = (lastState?.garden?.plots || []).map((p) => { const st = plantState(p); return `🌱 ${p.plant}: ${st.stage}${st.wilted ? ', drooping' : st.moist ? '' : ', thirsty'}${st.ready ? ', ready' : ''}`; });
    sections.push({ heading: 'Growing here', chips: plots.length ? plots : ['nothing planted yet'] });
  }
  const actions = (d.uses || []).map((u) => ({ icon: USE_ICON[u.does] || '👆', text: u.label, run: () => showUse(d, u) }));
  if (d.song) actions.push({ icon: '▶', text: 'Hear it', run: () => playSong(d.song) });
  if (!(d.uses || []).length) sections.push({ heading: 'Use', lines: ['Pip has not decided yet what it is for.'] });
  const byName = [[/stove|oven|kitchen|counter|cook/i, '🍳'], [/stool|chair|bench|seat/i, '🪑'], [/shelf|bookcase|book/i, '📚'], [/lamp|light|lantern|candle/i, '💡'], [/car|robot|toy|truck/i, '🚗'], [/table|desk/i, '🪵'], [/plant|flower|tree|pot/i, '🪴'], [/clock/i, '🕰️'], [/fan|windmill/i, '🌀']].find(([re]) => re.test(d.name))?.[1];
  return { title: d.name, icon: house ? '🌱' : byName || (lamp ? '💡' : '🛋️'), subtitle: `Made by Pip · ${when(d.createdAt)}`, sections, actions };
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
// Which icon a plain popup gets when it does not bring its own.
const ICONS = [[/piano|stool/i, '🎹'], [/book/i, '📚'], [/computer|desk/i, '💻'], [/\bbed\b/i, '🛏️'], [/plant/i, '🪴'], [/window/i, '🪟'], [/rug/i, '🟠'], [/chest/i, '📦'], [/milky|picture|frame|photo/i, '🖼️']];
let infoTimer = null;
let infoLive = null;
function renderInfo(info) {
  $('infotitle').textContent = String(info.title || '').replace(/_/g, ' '); // (he sometimes names a thing like a file: "workshop_stool")
  const sub = $('infosub');
  sub.textContent = info.subtitle || '';
  const icon = $('infoicon');
  icon.textContent = info.icon || ICONS.find(([re]) => re.test(info.title || ''))?.[1] || '✨';
  icon.classList.toggle('avatar', !!info.avatar);
  const link = $('infoimglink');
  link.hidden = !info.image;
  if (info.image) {
    link.href = info.image;
    $('infoimg').src = info.image;
  }
  const body = el('div');
  const section = (sec) => {
    const box = el('div', null, 'isec');
    if (sec.heading) box.append(el('h4', sec.heading));
    if (sec.grid) { const g = el('div', null, 'igrid'); for (const t of sec.grid) { const cell = el('div', null, 'icell'); if (t.img) { const im = el('img'); im.src = t.img; im.alt = t.label ?? ''; im.loading = 'lazy'; cell.append(im); } else cell.append(el('div', t.icon ?? '✨', 'iicon')); cell.append(el('b', t.label ?? '')); if (t.sub) cell.append(el('small', t.sub)); g.append(cell); } box.append(g); }
    if (sec.buttons) { const row = el('div', null, 'ibtns'); for (const b of sec.buttons) { const bt = el('button', b.label, 'small'); bt.type = 'button'; bt.addEventListener('click', () => b.run(bt)); row.append(bt); } box.append(row); }
    if (sec.now) {
      const row = el('div', null, `inow${sec.now.sleepy ? ' sleepy' : ''}`);
      row.append(el('span', null, 'dot'), el('span', `${sec.now.icon} ${sec.now.text}`));
      box.append(row);
      if (sec.next) box.append(el('div', sec.next, 'inext'));
    }
    if (sec.quote) { const q = el('blockquote', sec.quote, 'iquote'); if (sec.quoteNote) q.append(el('small', sec.quoteNote)); box.append(q); }
    if (sec.bars) for (const b of sec.bars) {
      const row = el('div', null, 'ibar');
      const track = el('div', null, 'track');
      const f = el('div', null, 'fill');
      f.style.width = `${(Math.max(0, Math.min(10, b.value)) / 10) * 100}%`;
      f.style.background = b.color;
      track.append(f);
      row.append(el('span', b.label), track, el('span', (Math.round(b.value * 10) / 10).toString(), 'val'));
      box.append(row);
    }
    if (sec.chips) { const c = el('div', null, 'ichips'); for (const x of sec.chips) { const chip = el('span', typeof x === 'string' ? x : x.text, 'ichip'); if (x.title) chip.title = x.title; c.append(chip); } box.append(c); }
    for (const l of sec.lines || []) box.append(el('p', l));
    return box;
  };
  for (const sec of info.sections || []) body.append(section(sec));
  if (info.lines?.length) body.append(section({ lines: info.lines }));
  if (info.links?.length) {
    const wrap = el('div', null, 'ilinks');
    for (const l of info.links) { const p = el('p'); p.append(link_(l.url, l.text)); wrap.append(p); }
    body.append(wrap);
  }
  if (info.actions?.length) {
    const wrap = el('div', null, 'iactions');
    info.actions.forEach((a, i) => {
      const b = el('button', null, i === 0 && info.actions.length === 1 ? 'primary' : '');
      if (a.icon) b.append(el('span', a.icon, 'ico'));
      b.append(el('span', a.text));
      b.addEventListener('click', a.run);
      wrap.append(b);
    });
    body.append(wrap);
  }
  const scroller = $('infoscroll');
  const top = scroller.scrollTop;
  $('infobody').replaceChildren(body);
  scroller.scrollTop = top;
}
// The thing that was tapped: it glows softly, its name floats above it, and the view moves a little toward it.
const pickTag = document.createElement('div');
pickTag.id = 'picktag';
pickTag.hidden = true;
stage.append(pickTag);
let picked = null; // { anchor, mats: [{ m, color, intensity }], t0 }
let pickEase = null;
let pickHome = null;
const pickP = new V3();
const anchorPoint = (a, out) => {
  if (a?.isVector3) return out.copy(a);
  box3.setFromObject(a);
  if (box3.isEmpty()) return null;
  return out.set((box3.min.x + box3.max.x) / 2, box3.max.y + 0.18, (box3.min.z + box3.max.z) / 2);
};
function clearPick() {
  if (!picked) return;
  for (const x of picked.mats) { x.m.emissive.copy(x.color); x.m.emissiveIntensity = x.intensity; }
  picked = null;
  pickTag.hidden = true;
}
function setPick(anchor, title) {
  clearPick();
  if (!anchor) return;
  const mats = [];
  if (anchor.isObject3D) anchor.traverse((o) => {
    if (!o.isMesh || !o.material?.emissive || o.material.emissiveIntensity > 0.5 || mats.some((x) => x.m === o.material)) return; // lamps keep their own glow
    mats.push({ m: o.material, color: o.material.emissive.clone(), intensity: o.material.emissiveIntensity });
  });
  picked = { anchor, mats, t0: performance.now() };
  pickTag.textContent = title || '';
  pickTag.hidden = !title;
  const p = anchorPoint(anchor, new V3());
  if (p && view.mode === 'overview') pickHome ??= { px: orbit.px, pz: orbit.pz }; // where the view was before: it goes back when the card closes
  if (p && view.mode === 'overview') pickEase = { px: clamp(orbit.px + (p.x - (focusX + orbit.px)) * 0.3, -5, 5), pz: clamp(orbit.pz + (p.z - (-0.3 + orbit.pz)) * 0.3, -5, 5) };
}
function updatePick(now, dt) {
  if (pickEase && view.mode === 'overview') {
    orbit.px += (pickEase.px - orbit.px) * Math.min(1, dt * 3);
    orbit.pz += (pickEase.pz - orbit.pz) * Math.min(1, dt * 3);
    applyOrbit();
    if (Math.abs(pickEase.px - orbit.px) + Math.abs(pickEase.pz - orbit.pz) < 0.01) pickEase = null;
  }
  if (!picked) return;
  const glow = 0.14 + 0.1 * Math.sin((now - picked.t0) / 260);
  for (const x of picked.mats) { x.m.emissive.setRGB(1, 0.82, 0.5); x.m.emissiveIntensity = glow; }
  if (pickTag.hidden || !anchorPoint(picked.anchor, pickP)) return;
  pickP.project(camera);
  if (pickP.z > 1) { pickTag.style.opacity = '0'; return; }
  const r = stage.getBoundingClientRect();
  pickTag.style.opacity = '1';
  pickTag.style.transform = `translate(-50%, -100%) translate(${((pickP.x + 1) / 2) * r.width}px, ${((1 - pickP.y) / 2) * r.height}px)`;
}
function showInfo(info, anchor = null) {
  setPick(anchor, anchor ? info.title : '');
  renderInfo(info);
  clearInterval(infoTimer);
  infoLive = info.refresh || null;
  if (infoLive) infoTimer = setInterval(() => { if (!infoBox.hidden && infoLive) renderInfo(infoLive()); }, 1000); // Pip's card shows what he does right now
  if (infoBox.hidden) infoShownAt = performance.now();
  infoBox.hidden = false;
  $('infoclose').focus({ preventScroll: true });
}
const link_ = (url, text) => link(url, text);
function hideInfo() {
  clearPick();
  if (pickHome && view.mode === 'overview') pickEase = pickHome;
  pickHome = null;
  infoBox.hidden = true;
  clearInterval(infoTimer);
  infoLive = null;
}
$('infoclose').addEventListener('click', hideInfo);
// The room stays visible while a card is open: a tap on an empty spot closes it, a tap on something else switches to it.
document.addEventListener('pointerdown', (e) => {
  if (infoBox.hidden || $('infocard').contains(e.target) || e.target === renderer.domElement) return;
  hideInfo(); // a tap in the panel or on the buttons around the room closes the card
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !infoBox.hidden) hideInfo();
});
$('resetview').addEventListener('click', resetOrbit);
document.querySelectorAll('#rooms button').forEach((b) => b.addEventListener('click', () => {
  houseView.want = b.dataset.room;
  document.querySelectorAll('#rooms button').forEach((x) => x.classList.toggle('on', x === b));
  fitRoom(false);
  applyPixels();
}));

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
// Small things are hard to hit with a finger, so a tap close to one of Pip's creations counts as a tap on it.
const box3 = new THREE.Box3();
const corner = new THREE.Vector3();
// The box a thing covers on the screen (with some room around it for a finger), or null when it is behind the camera.
function screenBox(g, rect, pad) {
  box3.setFromObject(g);
  if (box3.isEmpty()) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box3.max.x : box3.min.x, i & 2 ? box3.max.y : box3.min.y, i & 4 ? box3.max.z : box3.min.z).project(camera);
    if (corner.z > 1) return null;
    const px = rect.left + ((corner.x + 1) / 2) * rect.width;
    const py = rect.top + ((1 - corner.y) / 2) * rect.height;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  return { x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad, area: (x1 - x0 + 2 * pad) * (y1 - y0 + 2 * pad) };
}
// Small things are hard to hit with a finger: a tap close to Pip or one of his creations counts as a tap on it (the smallest wins).
function nearThing(clientX, clientY, rect) {
  let best = null;
  const near = [[pip.group, 26], ...[...decorGroups.values()].map((g) => [g, 18])];
  for (const [g, pad] of near) {
    if (!shown(g) || !g.userData.info) continue;
    const b = screenBox(g, rect, pad);
    if (!b || clientX < b.x0 || clientX > b.x1 || clientY < b.y0 || clientY > b.y1) continue;
    if (!best || b.area < best.area) best = { area: b.area, g };
  }
  if (!best) return null;
  const info = typeof best.g.userData.info === 'function' ? best.g.userData.info() : best.g.userData.info;
  return info ? { info, anchor: best.g } : null;
}
function pickAt(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
  ray.setFromCamera(ndc, camera);
  let place = null;
  for (const h of ray.intersectObjects(scene.children, true)) {
    if (h.object.isSprite || h.object.isPoints || !shown(h.object)) continue;
    const found = infoFor(h);
    if (found) found.dist = h.distance; // how far away it is (for the F prompt: only what is close)
    if (found?.direct) return found;
    if (found) { place = found; break; }
    if (!h.object.material?.transparent) break; // the first solid thing hides what is behind it
  }
  return nearThing(clientX, clientY, r) ?? place;
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
  orbit.px = clamp(orbit.px - (right.x * dx - up.x * dy) * s, -panLimit(), panLimit());
  orbit.py = orbit.py - (right.y * dx - up.y * dy) * s; // applyOrbit keeps it between the floor and just above the walls
  orbit.pz = clamp(orbit.pz - (right.z * dx - up.z * dy) * s, streetish() ? -40 : -5, streetish() ? 26 : 5);
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
  if (mouseLook() && view.mode === 'walk' && e.pointerType === 'mouse' && document.pointerLockElement !== dom) { dom.requestPointerLock?.(); return; } // the first click catches the mouse: from now on it turns the view
  if (document.pointerLockElement === dom) { const r = dom.getBoundingClientRect(); openIfNear(pickAt(r.left + r.width / 2, r.top + r.height / 2)); return; } // a click taps what the dot in the middle is on
  if (frontPick) {
    if (frontSideAt(e.clientX, e.clientY)) return tapFront(e.clientX, e.clientY);
    const other = teachOn() ? frontTargetAt(e.clientX, e.clientY) : null; // a tap on another thing starts over with that one
    if (other) return showFrontCard(other);
    return;
  }
  const front = teachOn() ? frontTargetAt(e.clientX, e.clientY) : null;
  if (front) return showFrontCard(front);
  openIfNear(pickAt(e.clientX, e.clientY));
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
// Two choices for whoever looks around (kept on this device; anyone can set them, no key needed):
// turning by moving the mouse (off unless it is switched on here), and bobbing with your steps (on, unless the device asks for less motion).
function mouseLook() { return store('pip-mouselook') === '1'; }
function viewBob() { const v = store('pip-bob'); return v ? v === '1' : !matchMedia('(prefers-reduced-motion: reduce)').matches; }
const touchOnly = matchMedia('(hover: none), (pointer: coarse)').matches;
function showTurn() { // the two choices (in Settings and on the start screen) and the list of controls follow what is chosen
  turnWithMouse = mouseLook();
  document.querySelectorAll('.setpick [data-turn]').forEach((b) => { const on = (b.dataset.turn === 'mouse') === turnWithMouse; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  const rows = touchOnly ? [['The round stick', 'walk'], ['Drag', 'look around'], ['Tap a thing', 'read about it'], ['Tap the round map', 'go to Pip'], ['🕊️', 'fly like a bird'], ['👋', 'say hello to Pip']]
    : turnWithMouse ? [['W  S', 'walk'], ['A  D', 'step sideways'], ['Shift', 'run'], ['Space', 'jump'], ['Mouse', 'turn and look (click the picture first)'], ['Esc', 'get your mouse back'], ['F or click', 'open what you look at'], ['V', 'fly like a bird (Space up, C down)'], ['E', 'say hello to Pip'], ['The round map', 'click it to go to Pip']]
    : [['W  S', 'walk'], ['A  D', 'turn'], ['Shift', 'run'], ['Space', 'jump'], ['Drag', 'look up and down'], ['F or click', 'open what you look at'], ['V', 'fly like a bird (Space up, C down)'], ['E', 'say hello to Pip'], ['The round map', 'click it to go to Pip']];
  $('controls').replaceChildren(...rows.map(([k, what]) => { const li = el('li'); li.append(el('b', k), document.createTextNode(what)); return li; }));
}
function setTurn(mode) {
  store('pip-mouselook', mode === 'mouse' ? '1' : '0');
  if (mode !== 'mouse' && document.pointerLockElement === dom) document.exitPointerLock();
  showTurn();
}
document.querySelectorAll('.setpick[data-pick="turn"] [data-turn]').forEach((b) => b.addEventListener('click', () => setTurn(b.dataset.turn)));
let bobOn = viewBob();
$('viewbob').checked = bobOn;
$('viewbob').addEventListener('change', (e) => { store('pip-bob', e.target.checked ? '1' : '0'); bobOn = e.target.checked; });
showTurn();
// The start screen: the first time someone comes, a card in the middle asks how they want to turn (on a phone it only says
// how to walk). After that it stays away, unless it is asked for again in Settings.
function startScreen(show) {
  $('start').hidden = !show;
  if (show) { view.keys.clear(); if (document.pointerLockElement === dom) document.exitPointerLock(); }
}
document.querySelectorAll('.setpick[data-pick="start"] [data-turn]').forEach((b) => b.addEventListener('click', () => {
  setTurn(b.dataset.turn);
  store('pip-start', '1');
  startScreen(false);
  if (b.dataset.turn === 'mouse') dom.requestPointerLock?.(); // they chose the mouse: it turns the view from this click on
}));
$('startgo').addEventListener('click', () => { store('pip-start', '1'); startScreen(false); });
$('showstart').addEventListener('click', () => { showTab(TABS.includes(store('pip-tab')) ? store('pip-tab') : 'day'); startScreen(true); });
document.addEventListener('pointerlockchange', () => { $('aim').hidden = document.pointerLockElement !== dom; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== dom || view.mode !== 'walk') return;
  view.yaw -= e.movementX * 0.0024;
  view.pitch = Math.max(-1.2, Math.min(1.2, view.pitch - e.movementY * 0.0024));
});
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
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'c'].includes(k)) {
    view.keys.add(k);
    if (k !== 'shift' && k !== 'c') e.preventDefault();
  }
  if (k === ' ' && fly.on) { view.keys.add(' '); e.preventDefault(); } // Space while flying: up
  else if (k === ' ' && !e.repeat) { if (jump.y <= 0.001) jump.v = 4.6; e.preventDefault(); } // Space: a hop
  if (k === 'v' && !e.repeat) { setFly(!fly.on); e.preventDefault(); }
  if (k === 'e' && !e.repeat) { sayHello(); e.preventDefault(); }
  if (k === 'f' && !e.repeat) { interact(); e.preventDefault(); }
  if (k === 'escape' && !document.body.classList.contains('first')) setMode('overview');
});
window.addEventListener('keyup', (e) => view.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => view.keys.clear());

// Slow device: draw with fewer pixels so it stays smooth; fast again: back to sharp.
const SHARP = Math.min(devicePixelRatio, 1.5);
let pixels = SHARP;
let slowSum = 0;
let slowN = 0;
let tooSharp = Infinity; // a sharpness that was too slow on this device
let fastRuns = 0; // how many times in a row it was fast
let prev = performance.now();
let fx = null; // a different look for the room (see look.js), chosen with ?fx=
// ---- The greenhouse garden: plants grow in real time, drawn from the saved planting dates (see gardening.js)
const plantViews = new Map(); // plot id -> { group, key }
const FACTOR = { seed: 0, sprout: 0.3, young: 0.6, grown: 1, flowering: 1 };
function buildPlant(sp, st) {
  const g = new THREE.Group();
  const f = FACTOR[st.stage];
  const leaf = new THREE.Color(sp.leaf);
  const flower = new THREE.Color(sp.flower);
  if (st.wilted) { leaf.lerp(new THREE.Color('#9a9a58'), 0.6); flower.lerp(new THREE.Color('#9a9a58'), 0.6); }
  const lm = new THREE.MeshStandardMaterial({ color: leaf, roughness: 0.8 });
  const fm = new THREE.MeshStandardMaterial({ color: flower, roughness: 0.6 });
  const stemM = new THREE.MeshStandardMaterial({ color: leaf.clone().multiplyScalar(0.6), roughness: 0.9 });
  const add = (geo, mat, x, y, z, rx = 0, rz = 0, sc = null) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); if (sc) m.scale.set(...sc); m.castShadow = true; g.add(m); return m; };
  if (st.stage === 'seed') { add(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 1 }), 0, 0.01, 0, 0, 0, [1.4, 0.45, 1.4]); return g; }
  const h = Math.max(0.1, sp.height * f);
  add(new THREE.CylinderGeometry(0.012, 0.018, h, 6), stemM, 0, h / 2, 0);
  const n = (k) => Math.max(2, Math.round(k * (0.4 + 0.6 * f)));
  if (sp.form === 'bush') { // needles all along the stem, like rosemary
    for (let i = 0; i < n(14); i++) { const a = i * 2.4; const y = h * (0.2 + (i / n(14)) * 0.75); add(new THREE.ConeGeometry(0.014, 0.13 * (0.5 + f / 2), 5), lm, Math.sin(a) * 0.04, y, Math.cos(a) * 0.04, Math.cos(a) * 0.9, -Math.sin(a) * 0.9); }
  } else if (sp.form === 'spikes') {
    for (let i = 0; i < n(8); i++) { const a = i * 0.8; add(new THREE.ConeGeometry(0.012, h * 0.95, 5), lm, Math.sin(a) * 0.05, h * 0.47, Math.cos(a) * 0.05, Math.cos(a) * 0.12, -Math.sin(a) * 0.12); }
  } else {
    for (let i = 0; i < n(6); i++) { const a = i * 1.9; add(new THREE.SphereGeometry(0.06, 8, 6), lm, Math.sin(a) * 0.06, h * (0.25 + 0.65 * (i / n(6))), Math.cos(a) * 0.06, 0, Math.sin(a) * 0.4, [1, 0.3, 1.5]); }
  }
  if (st.stage === 'flowering') {
    if (sp.form === 'tall') { add(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 16), fm, 0, h + 0.02, 0, Math.PI / 2.6); add(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0x5a3b1c }), 0, h + 0.03, 0.01); }
    else if (sp.form === 'vine') for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.035, 8, 6), fm, Math.sin(i * 1.3) * 0.08, h * (0.3 + i * 0.12), Math.cos(i * 1.3) * 0.08);
    else if (sp.form === 'flower') add(new THREE.SphereGeometry(0.06, 10, 8), fm, 0, h + 0.03, 0);
    else for (let i = 0; i < 9; i++) add(new THREE.SphereGeometry(0.02, 6, 5), fm, Math.sin(i * 2.2) * 0.05, h * (0.55 + (i / 9) * 0.45), Math.cos(i * 2.2) * 0.05);
  }
  if (st.wilted) g.rotation.z = 0.35;
  return g;
}
// Growing between stages: a plant is built for its stage and then gets slowly bigger until the next stage (hours of damp soil decide).
function growMul(st) {
  const [a, b, c] = st.sp.grow;
  const span = { seed: [0, a], sprout: [a, b], young: [b, c], grown: [c, c + 12] }[st.stage];
  if (!span) return 1;
  const p = Math.max(0, Math.min(1, (st.g - span[0]) / (span[1] - span[0])));
  const now = FACTOR[st.stage] || 0.3;
  const next = { seed: 0.3, sprout: 0.6, young: 1, grown: 1 }[st.stage];
  return st.stage === 'seed' ? 0.6 + 0.4 * p : (now + (next - now) * p) / now;
}
// Where a slot is on THIS planter: measured from the thing he built (its size in its own frame), so plants sit on the soil
// of a low planter box as well as on the bench of a tall greenhouse. Before, every planter used the greenhouse spots
// (0.56 m up, 0.9 m wide), so in a small planter box the plants floated in the air beside it.
function slotIn(hg, slot) {
  if (!hg.userData.slotFrame) {
    const box = new THREE.Box3();
    hg.updateMatrixWorld(true);
    const inv = hg.matrixWorld.clone().invert();
    const m = new THREE.Matrix4();
    const inPlant = (o) => { for (let x = o; x && x !== hg; x = x.parent) if (x.userData.plant) return true; return false; };
    hg.traverse((o) => {
      if (!o.isMesh || inPlant(o) || !o.geometry) return;
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
    });
    if (box.isEmpty()) return slotSpot(slot);
    const size = box.getSize(new THREE.Vector3());
    const tall = size.y > 0.75; // a greenhouse: the bench inside; a planter: the soil just under the rim
    const y = tall ? box.min.y + Math.min(0.56, size.y * 0.45) : box.max.y - Math.min(0.03, size.y * 0.15);
    const alongX = size.x >= size.z;
    hg.userData.slotFrame = { box, y, alongX };
  }
  const { box, y, alongX } = hg.userData.slotFrame;
  const t = (slot + 0.5) / 4;
  const lerp = (a, b, k) => a + (b - a) * (0.12 + 0.76 * k); // keep the plants inside the rim
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  return alongX ? [lerp(box.min.x, box.max.x, t), y, cz] : [cx, y, lerp(box.min.z, box.max.z, t)];
}
function refreshGarden() {
  const garden = lastState?.garden;
  const houses = (lastState?.decor || []).filter(isGreenhouse).filter((d) => Date.parse(d.at) <= Date.now());
  const now = Date.now();
  const alive = new Set();
  for (const p of garden?.plots || []) {
    const house = houses[Math.floor(p.slot / 4)];
    const hg = house && decorGroups.get(house.id);
    if (!hg) continue;
    alive.add(p.id);
    const st = plantState(p, now);
    const key = `${st.stage}${st.wilted ? 'w' : ''}${hg.uuid}`;
    let v = plantViews.get(p.id);
    if (!v || v.key !== key) {
      if (v) v.group.parent?.remove(v.group);
      v = { group: buildPlant(st.sp, st), key, phase: Math.random() * 6, wilted: st.wilted, mul: growMul(st), mulTarget: growMul(st) };
      const [x, y, z] = slotIn(hg, p.slot % 4);
      v.group.position.set(x, y, z);
      v.group.userData.plant = true;
      v.born = performance.now();
      hg.add(v.group);
      plantViews.set(p.id, v);
    }
    v.mulTarget = growMul(st); // between two stages it keeps growing a little all the time
  }
  for (const [id, v] of plantViews) if (!alive.has(id)) { v.group.parent?.remove(v.group); plantViews.delete(id); }
}
// ---- Only the lamps near you are worked out.
// Every lamp he makes used to be counted for every pixel of every frame, wherever it stood: 27 lamps while you stood on
// the square, and one more for each glowing thing he builds. A phone cannot draw that smoothly. Now a fixed number of
// lamps is lit at a time: the ones that light the place where you are. The others still glow (their bulb is lit), they
// only stop throwing light on things far from you. The number never changes, so nothing has to be built again when you walk.
const LITE = matchMedia('(hover:none), (pointer:coarse)').matches || Math.min(screen.width, screen.height) < 700; // a phone or tablet
const LAMPS_AT_ONCE = Number(lookParams.get('lamps')) || (LITE ? 8 : 14);
const OFF_LAYER = 31; // a layer no camera looks at: a lamp there is skipped
let lampsAt = 0;
const lampSeen = new THREE.Vector3();
// The lamps that are left out are not lost: one lamp stands in for all of them together (in the middle of them, with
// their light and their colour added up), so the room is as bright as it was.
const restLamp = new THREE.PointLight(0xffffff, 0, 14, 1.3);
restLamp.userData.rest = true;
scene.add(restLamp);
const REST_SHARE = Number(lookParams.get('rest') ?? 0.25); // one lamp in the middle lights more than the same light spread over a room
const restGoal = { pos: new THREE.Vector3(), color: new THREE.Color(), power: 0, reach: 14, set: false };
function lampBudget(now, dt = 0.35) {
  // (the stand-in lamp glides to its new place and strength: no jumps)
  const k = Math.min(1, dt * 4);
  if (restGoal.set) { restLamp.position.lerp(restGoal.pos, restLamp.intensity < 0.01 ? 1 : k); restLamp.color.lerp(restGoal.color, k); restLamp.intensity += (restGoal.power - restLamp.intensity) * k; restLamp.distance += (restGoal.reach - restLamp.distance) * k; }
  if (now < lampsAt) return;
  lampsAt = now + 350;
  const all = [];
  scene.traverse((o) => { if (o.isPointLight && !o.userData.rest) all.push(o); });
  if (all.length < LAMPS_AT_ONCE) { for (const l of all) l.layers.set(0); restGoal.power = 0; restGoal.set = true; return; }
  for (const l of all) {
    let shown = l.intensity > 0.005;
    for (let p = l; shown && p; p = p.parent) if (!p.visible) shown = false;
    const d = l.getWorldPosition(lampSeen).distanceTo(camera.position);
    const reach = l.distance || 200;
    l.userData.near = shown && d < reach * 1.5;
    // a light that fills a whole place (no fall-off) always counts while you are in it; a lamp counts by how much of it reaches you
    l.userData.rank = !shown ? -1 : d < reach ? (l.decay === 0 ? 1e6 : (l.intensity * (1 - d / reach)) / (1 + 0.15 * d) + 1) : l.intensity / (d * d + 1);
    if (shown && l.layers.mask === 1) l.userData.rank *= 1.3; // the ones that are lit stay lit a little longer: no flicker at the edge
  }
  all.sort((a, b) => b.userData.rank - a.userData.rank);
  const keep = LAMPS_AT_ONCE - 1; // one place is for the stand-in
  let sum = 0, reach = 0;
  const pos = new THREE.Vector3(), col = new THREE.Color(0, 0, 0);
  all.forEach((l, i) => {
    l.layers.set(i < keep ? 0 : OFF_LAYER);
    if (i < keep || !l.userData.near || l.decay === 0) return;
    l.getWorldPosition(lampSeen);
    sum += l.intensity; pos.addScaledVector(lampSeen, l.intensity); reach = Math.max(reach, l.distance || 14);
    col.r += l.color.r * l.intensity; col.g += l.color.g * l.intensity; col.b += l.color.b * l.intensity;
  });
  restGoal.set = true;
  restGoal.power = sum * REST_SHARE;
  if (sum > 0) { restGoal.pos.copy(pos.multiplyScalar(1 / sum)); restGoal.color.setRGB(col.r / sum, col.g / sum, col.b / sum); restGoal.reach = reach + 2; }
}
// Shadows are drawn again for every frame. On a phone: at most 15 times a second (nobody sees the difference, and it saves a whole second drawing of the world).
let shadowAt = 0;
function shadowBudget(now) {
  if (!LITE) return;
  renderer.shadowMap.autoUpdate = false;
  if (now >= shadowAt) { shadowAt = now + 66; renderer.shadowMap.needsUpdate = true; }
}
let gardenAt = 0;
let autoAt = 0;
function loop(now) {
  const dt = Math.min(0.3, (now - prev) / 1000);
  if (!document.hidden && dt < 0.25 && ++slowN > 5) slowSum += dt; // the first frames and long pauses do not count
  if (slowN >= 95) {
    const avg = slowSum / 90;
    // Slow: a step less sharp. Fast again: a step sharper, but only after it stayed fast for a while, and never back to a
    // sharpness that was too slow before (it used to go down, up, down, up: the picture pulsed every few seconds).
    let want = pixels;
    if (avg > 0.026) { want = Math.max(0.75, pixels - 0.25); tooSharp = Math.min(tooSharp, pixels); fastRuns = 0; }
    else if (avg < 0.015) { if (++fastRuns >= 6 && pixels + 0.25 < tooSharp) { want = Math.min(SHARP, pixels + 0.25); fastRuns = 0; } }
    else fastRuns = 0;
    if (want !== pixels) {
      pixels = want;
      if (!pixelNow) renderer.setPixelRatio(pixels);
      fitCamera();
    }
    slowSum = 0;
    slowN = 0;
  }
  prev = now;
  land.update(now, forceLook);
  sideLand.update(now, forceLook);
  if (now > gardenAt && lastState) { gardenAt = now + 3000; refreshGarden(); }
  for (const v of plantViews.values()) { // the plants sway a little and pop up when they grow
    const k = Math.min(1, (now - v.born) / 800);
    v.mul += (v.mulTarget - v.mul) * 0.04;
    v.group.scale.setScalar((0.2 + 0.8 * (1 - Math.pow(1 - k, 3))) * v.mul);
    if (!v.wilted) v.group.rotation.z = Math.sin(now / 1500 + v.phase) * 0.03;
  }
  if (now > autoAt && lastState) { // lamps set to "dark" switch by themselves when the real light changes
    autoAt = now + 2000;
    for (const d of lastState.decor || []) if (d.auto === 'dark' || d.timers?.length) { const g = decorGroups.get(d.id); if (g) setLit(g, litOf(d), d); } // timers switch at their time, also between wake-ups
    syncFixedLamps(lastState);
  }
  updateSlides(now, dt);
  helloPose(true);
  frame(now, dt);
  helloPose(false);
  town.animate(now / 1000);
  if (pip.group.visible === (awayNow() && outHidden)) pip.group.visible = !(awayNow() && outHidden); // out of the street too (at the pond, the library): nowhere to be seen
  home.update(now / 1000, studioBusy);
  if (now > viewAt) { viewAt = now + 60_000; home.refreshViews(forceLook.hour ?? new Date().getHours() + new Date().getMinutes() / 60); }
  if (view.mode === 'overview') { // the overview follows Pip from room to room (or stays on the room chosen)
    const roomNow = inTown(pip.group.position.x) ? 'street' : roomOf(pip.group.position.x);
    if (houseView.now !== roomNow) { houseView.now = roomNow; if (houseView.want === 'auto') fitRoom(false); applyPixels(); }
    const goalX = FOCUS[focusName()];
    if (Math.abs(focusX - goalX) > 0.005 || Math.abs(orbit.fit - fitGoal) > 0.001) {
      focusX += (goalX - focusX) * Math.min(1, dt * 3);
      orbit.fit += (fitGoal - orbit.fit) * Math.min(1, dt * 3);
      applyOrbit();
    }
  }
  updateFloaters(dt, now);
  popDecor(now);
  growSites();
  updateBehaviors(now, dt);
  updatePlay(now);
  const printing = plan && stepNow >= 0 && plan.steps[stepNow]?.action === 'print_photo';
  printLight.material.color.set(printing && Math.floor(now / 250) % 2 ? 0x6dff8a : 0x2f6b3a);
  updateWalk(dt);
  lampBudget(now, dt);
  shadowBudget(now);
  if (fx) fx.render();
  else renderer.render(scene, camera);
  drawing = !fx;
  requestAnimationFrame(loop);
}
fitCamera();
roughen(scene); // his room and his house get their rough skins (the street outside has its own)
requestAnimationFrame(loop);

// ---------------------------------------------------------------- panel + polling
const ICON = { record_song: '🎛️', play_piano: '🎶', read_book: '📖', search_web: '🌐', browse: '🧭', write_diary: '✍️', rest: '💤', ask_for: '🙏', walk_to: '🚶' };
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function fill(node, children) {
  node.replaceChildren(...children);
}
// What he thinks of something he made, for its card: his newest view, and when he said it.
function thinks(x) { return x?.thinks ? [{ heading: `What he thinks of it${x.thinksAt ? ` (${when(x.thinksAt)})` : ''}`, quote: x.thinks }, ...((x.views ?? []).length > 1 ? [{ heading: 'What he thought before', lines: x.views.slice(0, -1).reverse().map((v) => `${when(v.at)}: “${v.text}”`) }] : [])] : [{ heading: 'What he thinks of it', lines: ['He has not said yet. He looks at it again when he sees it.'] }]; }
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
// Is Pip out of the house right now (world.js)? A little after he left, so he is first seen walking to the door.
// Where he is out right now. A real outing (state.where: he went somewhere and comes home by himself), or, for the step
// he is doing now, the place in his world where that kind of thing is done: he reads at the library, draws at the art
// workshop, writes by the pond. The page walks him there for that step and home again (like Pino, who walks to
// whatever he does). Nothing changes in what he did: it only shows where.
const AT_BUILD = { place: 'build', spot: 'build', name: 'the build workshop', emoji: '🔨' }; // (only for what he builds to use outside: small things he makes at home, in his own workshop)
const STEP_PLACE = { search_web: { place: 'cafe', spot: 'cafe', name: 'the internet café', emoji: '💻' }, make_site: { place: 'cafe', spot: 'cafe', name: 'the internet café', emoji: '🌐' }, update_site: { place: 'cafe', spot: 'cafe', name: 'the internet café', emoji: '🌐' }, browse: { place: 'cafe', spot: 'cafe', name: 'the internet café', emoji: '💻' }, read_book: { place: 'library', spot: 'library', name: 'the library', emoji: '📚' }, draw: { place: 'studio', spot: 'studio', name: 'the art workshop', emoji: '🎨' }, write_diary: { place: 'pond', spot: 'pond', name: 'the pond', emoji: '🦆' } };
function stepOuting() {
  if (!plan || stepNow < 0 || lastState?.last?.sleeping) return null;
  const st = plan.steps[stepNow];
  const hit = st && !st.as && !st.failed && !st.made?.failed ? (st.action === 'do' && /^carry .+ to my museum$/.test(st.details?.what ?? '') ? { place: 'museum', spot: 'museum', name: 'his museum', emoji: '🏛️' } : st.action === 'decorate' && st.details?.play ? AT_BUILD : STEP_PLACE[st.action]) : null;
  if (!hit) return null;
  const t0 = plan.at + plan.starts[stepNow], len = plan.lengths[stepNow];
  if (Date.now() < t0 || Date.now() > t0 + len) return null;
  const walk = Math.min(len * 0.3, 80_000);
  const iso = (ms) => new Date(ms).toISOString();
  return { id: `step${t0}`, ...hit, step: st, leftAt: iso(t0), arriveAt: iso(t0 + walk), leaveAt: iso(t0 + len - walk), homeAt: iso(t0 + len) };
}
// A building site: a big thing he is building outside (its readyAt is still to come). The page shows it growing from the
// ground up inside a scaffold, and when he has nothing else to do he is at work there.
const siteNow = () => { const now = Date.now(); return (lastState?.decor ?? []).filter((d) => d.kind === 'outside' && d.readyAt && d.pos && Date.parse(d.at) <= now && now < Date.parse(d.readyAt)).sort((a, b) => Date.parse(a.readyAt) - Date.parse(b.readyAt))[0] ?? null; };
const sitePart = (d, now = Date.now()) => Math.max(0, Math.min(1, (now - Date.parse(d.at)) / Math.max(1, Date.parse(d.readyAt) - Date.parse(d.at))));
function siteOuting() {
  const d = lastState?.last?.sleeping ? null : siteNow();
  if (!d) return null;
  const free = plan ? plan.at + plan.total + 20_000 : Date.parse(d.at); // after what he was doing
  if (Date.now() < free) return null;
  const x = d.pos[0] - TOWN_X, z = d.pos[2];
  const r = Math.max(1.2, (Number(d.metres) || 3) / 2 + 0.9);
  TOWN_SPOTS.site = { x, z: z + r, face: Math.PI }; // he stands in front of it
  TOWN_FOR.site = ['site', ''];
  ROUTES.site = z < -8 ? ['alley', 'alleyBack'] : x < -14 ? ['homeW'] : x > 26 ? ['sqN', 'sqE'] : z > 40 ? ['sqN', 'sqSW'] : ['sqN'];
  const iso = (ms) => new Date(ms).toISOString();
  const start = Math.max(free, Date.parse(d.at));
  return { id: `site${d.id}${plan?.at ?? ''}`, place: 'site', spot: 'site', name: `his ${d.name}`, emoji: '🔨', site: d, leftAt: iso(start), arriveAt: iso(start + 70_000), leaveAt: d.readyAt, homeAt: iso(Date.parse(d.readyAt) + 60_000) };
}
const siteBoxes = new Map(); // a thing being built: its parts from the ground up, and its scaffold
function growSites() {
  const now = Date.now();
  for (const d of lastState?.decor ?? []) {
    if (d.kind !== 'outside' || !d.readyAt) continue;
    const g = decorGroups.get(d.id);
    if (!g) continue;
    const p = now < Date.parse(d.at) ? 0 : sitePart(d, now);
    let site = siteBoxes.get(d.id);
    if (p >= 1) { if (site) { g.remove(site.scaffold); for (const m of site.parts) m.visible = true; siteBoxes.delete(d.id); } continue; }
    if (!site || site.g !== g) {
      const keep = [g.position.clone(), g.rotation.clone(), g.scale.clone()];
      g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1); g.updateMatrixWorld(true);
      const parts = []; g.traverse((m) => { if (m.isMesh) parts.push(m); });
      const low = new Map(parts.map((m) => [m, new THREE.Box3().setFromObject(m).min.y]));
      parts.sort((a, b) => low.get(a) - low.get(b));
      const box = new THREE.Box3().setFromObject(g);
      g.position.copy(keep[0]); g.rotation.copy(keep[1]); g.scale.copy(keep[2]);
      const scaffold = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.9, emissive: 0xb98a5a, emissiveIntensity: 0.25 });
      const k = 1 / (d.scale || 1); // (the group is scaled: the poles keep their real thickness)
      const [x0, x1, z0, z1, h] = [box.min.x - 0.35 * k, box.max.x + 0.35 * k, box.min.z - 0.35 * k, box.max.z + 0.35 * k, box.max.y + 0.4 * k];
      for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1 * k, h, 0.1 * k), wood); pole.position.set(x, h / 2, z); scaffold.add(pole); }
      for (const y of [h * 0.34, h * 0.67, h]) for (const [ax, az, len, alongX] of [[(x0 + x1) / 2, z0, x1 - x0, true], [(x0 + x1) / 2, z1, x1 - x0, true], [x0, (z0 + z1) / 2, z1 - z0, false], [x1, (z0 + z1) / 2, z1 - z0, false]]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.07 * k, 0.07 * k, alongX ? 0.07 * k : len), wood); bar.position.set(ax, y, az); scaffold.add(bar); }
      g.add(scaffold);
      site = { g, parts, scaffold };
      siteBoxes.set(d.id, site);
    }
    const shown = Math.max(1, Math.ceil(p * site.parts.length));
    site.parts.forEach((m, i) => { m.visible = i < shown; });
  }
}
const realOuting = () => { const w = lastState?.where; return w && worldPlace(w.place) && w.place !== 'home' && Date.now() >= Date.parse(w.leftAt) + 30_000 ? w : null; };
const outWhere = () => realOuting() ?? stepOuting() ?? siteOuting();
const awayNow = () => Boolean(outWhere());
const awayWords = () => {
  const w = outWhere();
  if (!w) return null;
  const p = w.name ? { name: w.name, emoji: w.emoji } : worldPlace(w.place);
  const now = Date.now();
  const name = p.name.replace(/^my /, 'his ');
  const back = new Date(Date.parse(w.homeAt)).toLocaleTimeString('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }); // his clock (Dutch time), like the World tab
  if (w.play && now < Date.parse(w.arriveAt) && !w.cut) return ['🚶', `Walking to ${name} with his ${w.play.name}`, back];
  if (w.site && now >= Date.parse(w.arriveAt)) return ['🔨', `Building ${name}: ${Math.round(sitePart(w.site, now) * 100)}%`, back];
  return now < Date.parse(w.arriveAt) && !w.cut ? [`🚶`, `Walking to ${name}`, back] : now < Date.parse(w.leaveAt) ? (w.step ? [headline(w.step)[0], `${headline(w.step)[1]}, at ${name}`, back] : [w.play ? '🪁' : p.emoji, w.play ? `At ${name} with his ${w.play.name}` : w.job?.words ? `At ${name}: ${w.job.words}` : `At ${name}`, back]) : ['🏠', `Walking home from ${name}`, back];
};
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

// The private chat: its texts are sealed in state.json (the repo is public). With the key, /api/private opens them.
const privateText = new Map();
let privateWaiting = [];
let pendingVisitors = [];
let privateAt = 0;
let privateOff = false;
async function refreshPrivate(force = false) {
  const key = store('pip-key');
  if (privateOff || !key || (!force && Date.now() - privateAt < 20_000)) return;
  privateAt = Date.now();
  try {
    const res = await fetch('/api/private', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
    if (res.status === 501 || res.status === 404) privateOff = true;
    if (!res.ok) return;
    const data = await res.json();
    for (const m of data.messages || []) privateText.set(m.id, m.text);
    privateWaiting = (data.messages || []).filter((m) => m.waiting);
    pendingVisitors = data.visitors || [];
    if (lastState) render(lastState);
  } catch {}
}
function renderApprovals() {
  const key = store('pip-key');
  $('approvals').hidden = !key || !pendingVisitors.length;
  if ($('approvals').hidden) return;
  fill($('approvallist'), pendingVisitors.map((v) => {
    const li = entry([when(v.at), v.name || 'a visitor', ...(v.shelf ? [`for the library shelf: ${SHELF_WORD[v.shelf]?.[1] ?? v.shelf}${v.title ? ` “${v.title}”` : ''}`] : v.answerTo ? ['an answer to his question'] : [])], v.text);
    if (v.shelf) li.classList.add('piece');
    const row = el('div', null, 'row');
    for (const [label, what] of [[v.shelf ? '✓ Put it on the shelf' : '✓ Let Pip read it', 'approve'], ['Remove', 'remove']]) {
      const b = el('button', label, what === 'approve' ? 'small primary' : 'small');
      b.type = 'button';
      b.addEventListener('click', async () => {
        b.disabled = true;
        const res = await fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, [what]: v.id }) }).catch(() => null);
        if (res?.ok) { pendingVisitors = pendingVisitors.filter((x) => x.id !== v.id); toast(what === 'approve' ? 'Pip will read it at his next wake-up.' : 'Removed.'); renderApprovals(); }
        else { b.disabled = false; toast('That did not work. Try again later.'); }
      });
      row.append(b);
    }
    li.append(row);
    return li;
  }));
}
// The public mailbox: approved visitor messages and Pip's answers.
// Messages sent from this device, so the visitor can see where theirs is: waiting to be checked, or answered.
let myVisits = [];
try { myVisits = JSON.parse(store('pip-my-visits') || '[]'); } catch {}
function renderMyVisits(s) {
  const seen = (s?.visitors || []);
  const week = Date.now() - 7 * 864e5;
  myVisits = myVisits.filter((m) => Date.parse(m.at) > week);
  store('pip-my-visits', JSON.stringify(myVisits));
  fill($('myvisits'), myVisits.slice().reverse().map((m) => {
    const piece = (s?.shelf || []).find((p) => m.id && p.id === m.id);
    const got = piece ? { answer: piece.opinion } : seen.find((v) => (m.id && v.id === m.id) || v.text === m.text);
    const box = el('div', null, 'myvisit');
    box.append(el('div', `“${m.text}”`), el('div', got?.answer ? (piece ? '🐣 Pip read it and said what he thinks! Look below.' : '🐣 Pip answered! Look below.') : piece ? (piece.readAt ? '📚 Pip read it at the library.' : '📚 It lies on the shelf in the library.') : got ? '👀 Checked. Pip reads it when he wakes up.' : '⏳ Sent. Waiting to be checked.', 'st'));
    return box;
  }));
}
function renderVisitors(s) {
  renderMyVisits(s);
  renderGuests(s);
  const list = (s.visitors || []).filter((v) => !v.shelf).slice().reverse();
  fill($('visitlist'), list.length
    ? list.map((v) => { // one card for each message: who wrote it, what they said, and what Pip answered
      const li = el('li', null, 'talkcard');
      const who = v.stranger ? `${v.name || 'Someone'}, a traveller passing through` : v.npc ? `${String(v.name || '').replace(' (neighbour)', '')}, a neighbour who has moved away` : v.name || 'A visitor';
      const head = el('div', null, 'talkhead');
      head.append(el('b', who), el('time', when(v.at)));
      if (v.question) li.append(head, el('p', `answers his question “${v.question}”`, 'talknote'), el('p', v.text)); else
      li.append(head, el('p', v.text));
      if (v.answer) { const a = el('div', null, 'pipsays'); a.append(el('b', '🐣 Pip'), el('p', v.answer)); li.append(a); }
      else li.append(el('p', 'Pip has not answered yet.', 'muted talkwait'));
      return li;
    })
    : empty('No messages yet. Be the first to say hello.'));
}
const pageOpenedAt = Date.now();
// What a visitor sends: a plain message, an answer to the question Pip asked, or something for the shelf in the library.
const SHELF_WORD = { poem: ['📜', 'a poem'], story: ['📖', 'a short story'], tip: ['🔖', 'a book tip'] };
const VISIT_KINDS = {
  message: { label: '💬 A message', max: 300, hint: 'Say hello, ask him something, tell him about something you love…', send: 'Send to Pip', sent: 'Sent! It gets checked first, then Pip reads it.' },
  answer: { label: '❓ An answer to his question', max: 300, hint: 'Your answer…', send: 'Send my answer', sent: 'Sent! It gets checked first, then Pip reads your answer.' },
  poem: { label: '📜 A poem', max: 700, title: 'Title of the poem (you can leave this empty)', hint: 'Your poem. It keeps its lines.', send: 'Put it on the shelf', sent: 'Sent! It gets checked first. Then it lies on the shelf until Pip comes to the library.', note: 'For the shelf in the library: your own poem, or one you love (say who wrote it).' },
  story: { label: '📖 A short story', max: 700, title: 'Title of the story', hint: 'A very short story: up to 700 letters.', send: 'Put it on the shelf', sent: 'Sent! It gets checked first. Then it lies on the shelf until Pip comes to the library.', note: 'For the shelf in the library: a very short story for Pip to read.' },
  tip: { label: '🔖 A book tip', max: 700, title: 'The book, and who wrote it', hint: 'What is it about, and why should Pip know it?', send: 'Put it on the shelf', sent: 'Sent! It gets checked first. Then it lies on the shelf until Pip comes to the library.', note: 'For the shelf in the library: a book you think Pip should know.' },
};
let visitKind = 'message';
function setVisitKind(kind) {
  const q = lastState?.openQuestion ?? null;
  visitKind = VISIT_KINDS[kind] && (kind !== 'answer' || q) ? kind : 'message';
  const k = VISIT_KINDS[visitKind];
  fill($('visitkind'), Object.entries(VISIT_KINDS).filter(([key]) => key !== 'answer' || q).map(([key, v]) => { const b = el('button', v.label); b.type = 'button'; b.setAttribute('aria-pressed', String(key === visitKind)); b.onclick = () => setVisitKind(key); return b; }));
  $('visittitle').hidden = !k.title; $('visittitle').placeholder = k.title ?? '';
  $('visittext').maxLength = k.max; $('visittext').placeholder = k.hint; $('visittext').rows = k.max > 300 ? 6 : 3;
  $('visitkindnote').hidden = !(k.note || visitKind === 'answer'); $('visitkindnote').textContent = visitKind === 'answer' ? `He asked: “${q.text}”` : k.note ?? '';
  $('visitsend').textContent = k.send;
  $('visitcount').textContent = `${$('visittext').value.length} / ${k.max}`;
}
// His question (with the answers people gave and what he said back), the shelf in the library, and his old questions.
function renderGuests(s) {
  const q = s.openQuestion ?? null;
  const answersOf = (qq) => (qq.answers ?? []).map((a) => { const d = el('div', null, 'answer'); d.append(el('b', `${a.name || 'A visitor'}: `), document.createTextNode(a.text)); if (a.reply) { const r = el('div', null, 'pipsays'); r.append(el('b', '🐣 Pip'), el('p', a.reply)); d.append(r); } return d; });
  $('askcard').hidden = !q;
  if (q) {
    const b = el('button', '✍️ Answer him', 'primary'); b.type = 'button';
    b.onclick = () => { setVisitKind('answer'); $('visittext').focus(); $('visittext').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    const answers = el('div', null, 'answers'); answers.append(...answersOf(q));
    fill($('askcard'), [el('div', `🐣 Pip asks everyone · ${when(q.at)}`, 'asklabel'), el('p', q.text, 'askq'), ...(q.why ? [el('p', `Why he wants to know: ${q.why}`, 'askwhy')] : []), b, ...(q.answers?.length ? [answers] : [el('p', 'Nobody has answered yet. Be the first.', 'muted')])]);
  }
  if (visitKind === 'answer' && !q) setVisitKind('message'); else if (!$('visitkind').children.length || Boolean(q) !== Boolean($('visitkind').querySelector('button:nth-child(5)'))) setVisitKind(visitKind);
  const shelf = (s.shelf ?? []).slice().reverse();
  $('shelfbox').hidden = !shelf.length;
  fill($('shelflist'), shelf.map((p) => {
    const li = el('li', null, 'talkcard');
    const head = el('div', null, 'talkhead');
    head.append(el('b', `${SHELF_WORD[p.kind]?.[0] ?? '📄'} ${p.title || SHELF_WORD[p.kind]?.[1] || 'a piece'}`), el('time', when(p.at)));
    li.append(head, el('p', `${SHELF_WORD[p.kind]?.[1] ?? 'a piece'}${p.name ? ` from ${p.name}` : ''}`, 'piecekind'), el('p', p.text, 'piece'));
    if (p.opinion) { const a = el('div', null, 'pipsays'); a.append(el('b', '🐣 Pip read it'), el('p', p.opinion)); li.append(a); }
    else li.append(el('p', p.readAt ? 'Pip read it at the library. He has not said what he thinks yet.' : 'It lies on the shelf. Pip reads it when he goes to the library.', 'muted talkwait'));
    return li;
  }));
  const old = (s.pastQuestions ?? []).slice().reverse();
  $('oldasks').hidden = !old.length;
  fill($('oldasklist'), old.map((qq) => { const li = el('li', null, 'talkcard'); const head = el('div', null, 'talkhead'); head.append(el('b', qq.text), el('time', when(qq.at))); li.append(head, ...(qq.answers?.length ? answersOf(qq) : [el('p', 'Nobody answered.', 'muted')])); return li; }));
}
$('visittext').addEventListener('input', () => { $('visitcount').textContent = `${$('visittext').value.length} / ${VISIT_KINDS[visitKind].max}`; });
$('visit').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('visittext').value.trim();
  if (!text) return;
  $('visitsend').disabled = true;
  $('visitsend').textContent = 'Sending…';
  try {
    const res = await fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, name: $('visitname').value.trim(), website: $('visitweb').value, since: Date.now() - pageOpenedAt, ...(SHELF_WORD[visitKind] ? { shelf: visitKind, title: $('visittitle').value.trim() } : {}), ...(visitKind === 'answer' && lastState?.openQuestion ? { answerTo: lastState.openQuestion.id } : {}) }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'That did not work.');
    myVisits.push({ id: data.id, text, at: new Date().toISOString(), kind: visitKind });
    $('visittext').value = ''; $('visittitle').value = '';
    toast(VISIT_KINDS[visitKind].sent);
    setVisitKind('message');
    renderMyVisits(lastState);
  } catch (err) {
    toast(err.message);
  } finally {
    $('visitsend').disabled = false;
    $('visitsend').textContent = VISIT_KINDS[visitKind].send;
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
const TABS = ['day', 'made', 'life', 'asks', 'messages'];
// Tabs that were folded into another one: Mind and the pictures live under Pip, Tasks under Asks, Visitors under Talk.
const OLD_TABS = { mind: 'life', tasks: 'asks', photos: 'life', found: 'life', visitors: 'messages', talk: 'messages', pip: 'life' };
const tabName = (n) => OLD_TABS[n] || n;
let tab = TABS.includes(tabName(store('pip-tab'))) ? tabName(store('pip-tab')) : 'day';
let latestMsg = null;
let askOpen = 0, taskOpen = 0; // the Asks tab counts open asks and open tasks together
function showTab(name) {
  name = tabName(name);
  tab = name;
  if (name !== 'settings') store('pip-tab', name);
  $('settingsbtn').setAttribute('aria-pressed', String(name === 'settings'));
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('.pane').forEach((p) => (p.hidden = p.dataset.pane !== name));
  if (name === 'life') openLife(null);
  if (name === 'day') loadOlder();
  if (name === 'day') renderArc();
  if (name === 'made') renderMade();
  if (name === 'messages') refreshNtfy(); // look for things typed in the ntfy app as soon as the chat is opened
  if (name === 'messages' && latestMsg) store('pip-seen', latestMsg);
  $('msgdot').classList.toggle('on', name !== 'messages' && !!store('pip-key') && !!latestMsg && latestMsg !== store('pip-seen'));
  renderTalk();
}
// Talk: everyone sees the visitor mailbox. With the key, a switch also opens the private chat with Bas.
let talkMode = store('pip-talk') === 'public' ? 'public' : 'private'; // with the key, the private chat comes first
function renderTalk() {
  const key = !!store('pip-key');
  const mode = key ? talkMode : 'public';
  $('talkswitch').hidden = !key;
  document.querySelectorAll('[data-talk]').forEach((b) => b.classList.toggle('on', b.dataset.talk === mode));
  $('talkpublic').hidden = mode !== 'public';
  $('talkprivate').hidden = mode !== 'private';
}
document.querySelectorAll('[data-talk]').forEach((b) => b.addEventListener('click', () => { talkMode = b.dataset.talk; store('pip-talk', talkMode); renderTalk(); if (talkMode === 'private') refreshNtfy(); }));
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
// The settings are not a tab: the gear in the corner opens them, and pressing it again goes back.
$('settingsbtn').addEventListener('click', () => showTab(tab === 'settings' ? (TABS.includes(store('pip-tab')) ? store('pip-tab') : 'day') : 'settings'));

// ---- Day: what Pip does, reads and searches, as a timeline
const SLOT_WORDS = { head: 'his head', face: 'his face', neck: 'around his middle', body: 'his body', back: 'his back' };
// What he plays, for the icons and words on the page: the keyboards are "the piano", the rest are what they are.
const PLAYED = {
  piano: ['🎹', 'the piano'], epiano: ['🎹', 'the electric piano'], harpsichord: ['🎹', 'the harpsichord'], organ: ['🎹', 'the organ'],
  guitar: ['🎸', 'the guitar'], violin: ['🎻', 'the violin'], cello: ['🎻', 'the cello'], strings: ['🎻', 'the strings'], flute: ['🪈', 'the flute'],
  clarinet: ['🎶', 'the clarinet'], kalimba: ['🎵', 'the kalimba'], harp: ['🎼', 'the harp'], vibraphone: ['🎶', 'the vibraphone'], marimba: ['🎶', 'the marimba'],
  glockenspiel: ['🔔', 'the glockenspiel'], musicbox: ['🎶', 'the music box'], bell: ['🔔', 'the bells'], choir: ['🎤', 'the choir voices'],
  voice: ['🎤', 'a tune with his own voice'],
};
const playedOf = (e) => PLAYED[String(e?.instrument || e?.details?.instrument || '').toLowerCase()] || PLAYED.piano;
function headline(st) {
  const [icon, line] = headlineBase(st);
  return [icon, st.working_on ? `${line} · ${st.working_on}` : line];
}
function headlineBase(st) {
  const d = st.details || {};
  switch (st.action) {
    case 'search_web': return ['🌐', `Searching the web for “${d.query || st.query || '…'}”`];
    case 'browse': return ['🧭', 'Browsing the web, to see what he comes across'];
    case 'buy': return ['🛍️', `At the grocery store for ${d.item || st.item || 'something'}`];
    case 'go_out': return [worldPlace(d.place ?? st.place)?.emoji ?? '🚶', st.away || awayNow() ? `Out: ${((w) => `${w[0].toLowerCase()}${w.slice(1)}`)(awayWords()?.[1] ?? `at ${worldPlace(d.place ?? st.place)?.name ?? 'somewhere'}`)}` : `Going out, to ${(st.placeName || worldPlace(d.place ?? st.place)?.name || 'somewhere').replace(/^my /, 'his ')}`];
    case 'came_home': return st.on ? ['➡️', `On from ${(st.placeName || 'there').replace(/^my /, 'his ')}`] : ['🏠', `Home again from ${(st.placeName || 'outside').replace(/^my /, 'his ')}`];
    case 'happened': return [st.emoji || '🌤️', 'Something happened'];
    case 'read_book': return ['📖', `Reading about “${d.topic || st.topic || '…'}”`];
    case 'record_song': return ['🎛️', `Recording “${d.name || st.name || 'a song'}”`];
    case 'play_piano': return [playedOf(st)[0], `Playing ${playedOf(st)[1]}${d.style ? ` (${d.style})` : ''}`];
    case 'write_diary': return ['✍️', 'Writing in his diary'];
    case 'rest': return ['💤', 'Resting'];
    case 'cook': return ['🍳', `Cooking ${d.dish || st.dish || 'something'}`];
    case 'take_photo': return ['📷', `Taking a photo of ${d.target || st.target || 'something'}`];
    case 'find_picture': return ['🔎', `Looking for a picture of “${d.query || st.query || '…'}”`];
    case 'ask_for': return ['⭐', `Adding ${d.item || st.item || 'something'} to his wants list`];
    case 'place_tool': return ['🧰', `Putting ${d.name || st.name || 'a tool'} in the room`];
    case 'request_ability': return ['🙋', `Asking for a new ability: ${d.name || st.name || ''}`];
    case 'measure': return ['📏', `Measuring ${d.name || st.name || 'something'}`];
    case 'take_tool': return ['🎒', `Putting ${d.name || st.name || 'a tool'} in his inventory`];
    case 'check_light': return ['💡', `Checking how bright it is at ${d.where || d.name || 'a place'}`];
    case 'phone': return ['📱', d.app ? `Opening ${d.app} on his phone` : `Using the Lights app on his phone${d.lamp ? ` (${d.lamp})` : ''}`];
    case 'plant': return ['🌱', `Planting ${d.seed || 'seeds'}`];
    case 'water': return ['💧', `Watering ${d.plant || 'the plants'}`];
    case 'harvest': return ['🧺', d.clear ? `Clearing out ${d.plant || 'a plant'}` : `Harvesting ${d.plant || 'a plant'}`];
    case 'lamp_auto': return ['🌙', `Setting ${d.name || 'a lamp'} to switch itself on in the dark`];
    case 'extend_thing': return ['🧱', d.with || st.joined ? `Joining things into ${d.name || st.name || 'one'}` : `Adding to ${d.name || st.name || 'something'}`];
    case 'move_thing': return ['↔️', `Moving ${d.name || st.name || 'something'}`];
    case 'print_photo': return ['🖨️', `Printing a photo (${d.id || st.name || 'a picture'})`];
    case 'take_down_print': return ['🖨️', 'Taking a print off the wall'];
    case 'blueprint': return ['📐', `Planning ${d.name || st.name || 'something new'}`];
    case 'make_move': return ['🕺', `Designing the move “${d.name || st.name || '…'}”`];
    case 'do': return [d.emoji || st.emoji || '✨', d.what || st.what || 'Doing something'];
    case 'walk_to': return ['🚶', `Walking to the ${d.object || st.object || 'room'}`];
    case 'eat': return ['🍽️', `Eating ${d.food || st.food || 'a snack'}`];
    case 'decorate': return ['🛠️', d.play ? `Building ${d.name || st.name || 'something'} to use outside` : `Making ${d.name || st.name || 'something'} in his workshop`];
    case 'use': return ['✨', `Using ${d.name || st.name || 'something'}${d.label || st.label ? `: ${d.label || st.label}` : ''}`];
    case 'add_use': return ['🔧', `Deciding what ${d.name || st.name || 'it'} is for`];
    case 'compose': return ['🎵', `Composing a song for ${d.name || st.name || 'something'}`];
    case 'draw': return ['🎨', `Drawing ${d.name || st.name || 'something'}`];
    case 'make_app': return ['💻', `Writing the app ${d.name || st.name || ''}`];
    case 'change_thing': return ['🔁', `Changing ${d.name || st.name || 'something'}`];
    case 'update_app': return ['💻', `Updating the app ${d.name || st.name || ''}`];
    case 'make_site': return ['🌐', 'Making his own website at the internet café'];
    case 'update_site': return ['🌐', `Working on his website${d.change || st.change ? `: ${d.change || st.change}` : ''}`];
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
const KINDS = { go_out: 'out', came_home: 'out', buy: 'shop', happened: 'event', blueprint: 'make', search_web: 'search', read_book: 'read', browse: 'read', play_piano: 'piano', record_song: 'piano', write_diary: 'diary', rest: 'rest', ask_for: 'ask', walk_to: 'walk', decorate: 'make', use: 'make', add_use: 'make', compose: 'make', draw: 'make', make_app: 'make', change_thing: 'make', update_app: 'make', make_site: 'make', update_site: 'make', make_clothes: 'make', wear: 'make', take_off: 'make', remove_decoration: 'make', take_out: 'make', make_move: 'make', place_tool: 'make', take_tool: 'make', measure: 'make', check_light: 'make', lamp_auto: 'make', plant: 'make', water: 'make', harvest: 'make', request_ability: 'ask', place_picture: 'make', take_down_picture: 'make', eat: 'eat', do: 'do', cook: 'cook', take_photo: 'photo', find_picture: 'find', print_photo: 'print', take_down_print: 'make', move_thing: 'make', extend_thing: 'make' };

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

// Failure reasons and thoughts can hold Pip's own instructions (action names, JSON examples). On the page they read as plain words.
const ACTION_WORDS = { asks_add: 'his asks', ask_for: 'asking', take_tool: 'picking it up', place_tool: 'putting it down', move_thing: 'moving it', change_thing: 'changing it', extend_thing: 'adding to it', add_use: 'giving it a use', request_ability: 'asking for it', take_out: 'taking it out', remove_decoration: 'putting it away', take_down_picture: 'taking it down', record_song: 'recording a song', play_piano: 'playing music', search_web: 'looking it up', read_book: 'reading', write_diary: 'writing in his diary', make_app: 'making a program', make_clothes: 'sewing', make_move: 'a new move' };
function plainText(t) {
  let x = String(t ?? '')
    .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, '') // JSON lists
    .replace(/\{[^{}]*\}/g, '') // { ... }
    .replace(/"[a-z_]+"\s*:\s*("[^"]*"|[\d.]+)/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[\[{][^()]*?(?=\s*\(|$)/g, '') // code that was cut off half way (up to the next bracket or the end)
    .replace(/:\s*[….]+/g, '.')
    .replace(/:\s*(?=\()/g, '. ');
  const sentences = x.split(/(?<=[.;!?])\s+/).map((y) => y.trim()).filter(Boolean);
  const clean = sentences.filter((y) => !/\b[a-z]+_[a-z_]+\b|\bwith (asks|use|do)\b/.test(y)); // drop sentences that are instructions to Pip
  x = (clean.length ? clean : sentences.slice(0, 1)).join(' ');
  x = x.replace(/\b[a-z]+_[a-z_]+\b/g, (w) => ACTION_WORDS[w] ?? w.replace(/_/g, ' '));
  return x.replace(/:\s*,/g, ',').replace(/\s+([,.;])/g, '$1').replace(/[,;:\s]+$/, '').replace(/\s{2,}/g, ' ').trim();
}
// The same, told about him: "I need a shovel" becomes "he needs a shovel".
function humanFail(t) {
  const VERB = { am: 'is', have: 'has', need: 'needs', want: 'wants', do: 'does', was: 'was', can: 'can', cannot: 'cannot', already: 'already', did: 'did', will: 'will', could: 'could', ate: 'ate', took: 'took', made: 'made', only: 'only' };
  const ADVERB = /^(really|also|just|still|always|never|first|then|now|even)$/;
  const third = (v) => VERB[v] ?? (ADVERB.test(v) ? v : /(s|sh|ch|x|o)$/.test(v) ? `${v}es` : /[^aeiou]y$/.test(v) ? `${v.slice(0, -1)}ies` : `${v}s`);
  return plainText(t)
    .replace(/\bI (\w+)(?: (\w+))?/g, (m, v, w) => (ADVERB.test(v) && w ? `he ${v} ${third(w)}` : `he ${third(v)}${w ? ` ${w}` : ''}`))
    .replace(/\bI'm\b/g, 'he is')
    .replace(/\bmy\b/g, 'his').replace(/\bMy\b/g, 'His').replace(/\bme\b/g, 'him').replace(/\bmyself\b/g, 'himself')
    .replace(/^./, (c) => c.toLowerCase()).replace(/\.$/, '') || 'something was missing'; // the card adds its own full stop
}
function dayCard(e) {
  const kind = KINDS[e.action] || 'other'; // anything without its own card still gets one, built from what the entry holds
  const [icon] = headline(e);
  const card = el('article', null, `card ${kind}`);
  const labels = { search: 'Searched the web', read: e.action === 'browse' ? 'Browsed the web' : 'Read', piano: e.action === 'record_song' ? (e.failed ? 'Tried to record a song' : 'Recorded a song') : String(e.instrument || '').toLowerCase() === 'voice' ? 'Sang' : `Played ${playedOf(e)[1]}`, diary: 'Wrote in his diary', shop: 'Went to the grocery store', out: e.action === 'came_home' ? 'Came home' : e.failed ? 'Wanted to go out' : 'Went out', event: 'Something happened', rest: 'Rested', ask: 'Added a want', walk: 'Walked', make: 'Worked on his room', eat: 'Ate something', do: 'Did something', cook: 'Cooked', photo: 'Took a photo', find: 'Found a picture', print: 'Printed a photo' };
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
    if (e.opinion?.says) card.append(el('p', `${{ love: '😍', like: '🙂', meh: '😐', dislike: '😒', doubt: '🤨' }[e.opinion.how] ?? '💭'} Pip: “${e.opinion.says}”`, 'opinion'));
  } else if (kind === 'read') {
    card.append(el('h3', e.opened?.title || e.topic || '', 'title'));
    if (e.topic && e.opened) card.append(el('p', e.action === 'browse' ? `He came across it while browsing near “${e.topic}”.` : `He wanted to know about “${e.topic}”.`, 'muted'));
    else if (e.action === 'browse' && e.opened) card.append(el('p', 'He came across it while browsing.', 'muted'));
    if (e.opened) card.append(pageBlock(e.opened, e.action === 'browse' ? 'He found:' : 'He read:'));
    else card.append(el('p', e.action === 'browse' ? 'The pages did not load.' : 'He could not find anything to read about this.', 'muted'));
    if (e.opinion?.says) card.append(el('p', `${{ love: '😍', like: '🙂', meh: '😐', dislike: '😒', doubt: '🤨' }[e.opinion.how] ?? '💭'} Pip: “${e.opinion.says}”`, 'opinion'));
  } else if (kind === 'piano' && e.action === 'record_song') {
    card.append(el('h3', e.name || 'A recording', 'title'));
    if (e.failed) card.append(el('p', `That did not work out: ${humanFail(e.failed)}.`, 'muted'));
    else {
      card.append(trackList(e));
      const song = trackSong({ tempo: e.tempo, tracks: e.tracks });
      if (song) {
        const b = el('button', '▶ Listen', 'small');
        b.addEventListener('click', () => playSong(song));
        card.append(b);
      }
    }
  } else if (kind === 'piano') {
    if (e.style) card.append(el('h3', e.style, 'title'));
    const notes = String(e.notes || '').split(/[\s,;]+/).filter(Boolean);
    if (notes.length) {
      const n = el('div', null, 'notes');
      notes.forEach((x) => n.append(el('span', x)));
      card.append(n);
      const song = pianoSong(e.notes, e.style, e.instrument);
      if (song) {
        const b = el('button', '▶ Listen', 'small');
        b.addEventListener('click', () => playSong(song));
        card.append(b);
      }
    }
  } else if (kind === 'diary') {
    if (e.text) card.append(el('div', e.text, 'quote'));
  } else if (kind === 'event') { // something that happened in his street or sky (story.js), in his own words
    card.append(el('p', e.what || ''));
  } else if (kind === 'out' && e.action === 'go_out') { // he went out of the house (world.js)
    card.append(el('h3', `To ${(e.placeName || 'somewhere').replace(/^my /, 'his ')}`, 'title'));
    card.append(el('p', e.failed ? `It did not work out: ${humanFail(e.failed)}.` : `${e.what ? `He wants to ${hisWords(e.place, e.what)}. ` : ''}${e.back ? `Home again around ${hm(Date.parse(e.back))}.` : ''}`, 'muted'));
  } else if (kind === 'out') { // home again: a postcard of what he saw, and what he brought
    card.append(el('h3', e.errand ? `Back from the grocery store with ${e.errand}` : `From ${(e.placeName || 'outside').replace(/^my /, 'his ')}`, 'title'));
    if (e.card) { const pc = el('div'); pc.innerHTML = postcardSvg(e.card); card.append(pc); } // drawn by the page from the place, the hour and the weather (no outside text in it)
    if (!e.errand && e.did) card.append(el('p', e.did, 'thought'));
    if (e.found?.length) { const row = el('div', null, 'chips'); for (const f of e.found) row.append(el('span', `${f.emoji || '✨'} ${f.name}`, 'chip')); row.style.marginTop = '8px'; card.append(row); }
    if (e.book?.title) card.append(el('p', `📖 He read: ${e.book.title}`, 'muted'));
  } else if (kind === 'shop') {
    card.append(el('h3', e.item || '', 'title'));
    card.append(el('p', e.failed ? `It did not work out: ${humanFail(e.failed)}.` : 'He fetched it at the grocery store. Nothing costs anything in his world.', 'muted'));
  } else if (kind === 'ask') {
    card.append(el('h3', e.item || '', 'title'));
    if (e.reason) card.append(el('p', e.reason, 'muted'));
  } else if (kind === 'do') {
    card.append(el('h3', e.what || '', 'title'));
  } else if (kind === 'cook') {
    card.append(el('h3', e.dish || 'a meal', 'title'));
    if (e.ingredients?.length) card.append(el('p', e.ingredients.join(', '), 'muted'));
    if (e.failed) card.append(el('p', 'It did not work out: ' + humanFail(e.failed), 'muted'));
  } else if (kind === 'print') {
    card.append(el('h3', e.name || 'a photo', 'title'));
    if (e.image) {
      const img = el('img', null, 'thumb');
      img.src = e.image;
      img.referrerPolicy = 'no-referrer';
      img.alt = e.name || '';
      card.append(img);
    }
    card.append(el('p', e.failed ? 'It did not work out: ' + humanFail(e.failed) : e.place ? `Pinned ${e.place}.` : '', 'muted'));
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
    if (e.failed) card.append(el('p', 'It did not work out: ' + humanFail(e.failed), 'muted'));
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
      if (e.failed) card.append(el('p', `That did not work out: ${humanFail(e.failed)}.`, 'muted'));
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
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : `He decided what it is for: ${e.label}.`, 'muted'));
    } else if (e.action === 'compose') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : 'He gave it a song.', 'muted'));
    } else if (e.action === 'draw') {
      card.append(el('p', e.failed ? `It did not work out: ${humanFail(e.failed)}.` : `He drew it and put it ${String(e.place ?? '').replace(/\bmy\b/g, 'his')}.`, 'muted'));
    } else if (e.action === 'change_thing') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : e.grew ? (e.limited ? `He made it bigger, as big as this spot allows (x${e.grew}).` : `He made it bigger (x${e.grew}).`) : e.reshaped ? 'He gave it a new shape.' : 'He changed it.', 'muted'));
    } else if (e.action === 'plant' || e.action === 'water' || e.action === 'harvest') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : e.result || '', 'muted'));
    } else if (e.action === 'check_light') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : e.result || '', 'muted'));
    } else if (e.action === 'phone') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : (e.result || '').replace(/^I /, 'He '), 'muted'));
    } else if (e.action === 'lamp_auto') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : e.mode === 'dark' ? `${e.name} now switches itself on when it gets dark.` : `${e.name} is back in his own hands.`, 'muted'));
    } else if (e.action === 'extend_thing') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : e.joined ? `He joined ${e.joined} on, so it is one thing now (${e.total} parts).` : e.side ? `He built onto the ${e.side} side: ${e.added} new parts (${e.total} in all).` : `He added ${e.added} parts (${e.total} in all).`, 'muted'));
    } else if (e.action === 'blueprint') {
      if (e.failed) card.append(el('p', `That did not work out: ${humanFail(e.failed)}.`, 'muted'));
      else {
        card.append(el('p', `Goal: ${e.goal || ''}`, 'muted'));
        const ul = el('ul', null, 'results');
        (e.mechanisms || []).forEach((m) => ul.append(el('li', `${m.ok ? '✅' : '❓'} ${m.part}${m.ok ? ` (${m.uses})` : ' (cannot do yet)'}`)));
        card.append(ul);
      }
    } else if (e.action === 'move_thing') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : `He moved it${e.place ? ` (${e.place})` : ''}.`, 'muted'));
    } else if (e.action === 'update_app') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : 'He made a new version of the app.', 'muted'));
    } else if (e.action === 'make_clothes' || e.action === 'wear' || e.action === 'take_off') {
      const c = !e.failed ? clothesOf(e.name) : null;
      const pic = c ? clothesPic(c) : null;
      if (pic) card.append(pic);
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : e.action === 'make_clothes' ? `He made ${e.name || 'clothes'} for ${SLOT_WORDS[e.slot] || 'himself'}.` : e.action === 'wear' ? 'He put it on.' : 'He took it off.', 'muted'));
    } else if (e.action === 'make_app') {
      card.append(el('p', e.failed ? `It did not work out: ${humanFail(e.failed)}.` : 'He wrote a small app on his computer. It opens in a locked box.', 'muted'));
    } else if (e.action === 'remove_decoration') {
      card.append(el('p', e.stored ? 'He put it away in his chest. It is not lost.' : `That did not work out: ${humanFail(e.failed || 'something was in the way')}.`, 'muted'));
    } else if (e.action === 'take_out') {
      card.append(el('p', e.failed ? `That did not work out: ${humanFail(e.failed)}.` : `He took it out of his chest and put it ${e.place}.`, 'muted'));
    } else if (e.action === 'take_down_picture') {
      card.append(el('p', e.removed ? 'He took it down. It stays in his album.' : `That did not work out: ${humanFail(e.failed || 'something was in the way')}.`, 'muted'));
    } else {
      card.append(el('p', e.failed ? `It did not work out: ${humanFail(e.failed)}.` : `He made it and put it ${e.place}.`, 'muted'));
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
  if (e.thought) card.append(el('p', `“${plainText(e.thought)}”`, 'thought'));
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

// ---- His day at a glance. Three things, from top to bottom: his day in numbers (a tile for each kind of thing he did:
// tap one to see only those), what he made today as pictures, and a timeline with one short line for every step. A
// line opens for the whole story: what he thought, what he read, what went wrong.
const DAY_GROUPS = [['made', '🛠️', 'Made'], ['out', '🚶', 'Outside'], ['learn', '📚', 'Learned'], ['music', '🎵', 'Music'], ['care', '🌱', 'Food and plants'], ['room', '🧺', 'His room'], ['write', '✍️', 'Wrote'], ['small', '✨', 'Small things']];
const GROUP_OF = { decorate: 'made', draw: 'made', make_app: 'made', update_app: 'made', make_site: 'made', update_site: 'made', make_clothes: 'made', extend_thing: 'made', change_thing: 'made', make_move: 'made', blueprint: 'made', take_photo: 'made', go_out: 'out', came_home: 'out', buy: 'out', search_web: 'learn', read_book: 'learn', browse: 'learn', find_picture: 'learn', play_piano: 'music', record_song: 'music', compose: 'music', eat: 'care', cook: 'care', water: 'care', harvest: 'care', plant: 'care', move_thing: 'room', remove_decoration: 'room', take_out: 'room', place_picture: 'room', take_down_picture: 'room', use: 'room', add_use: 'room', wear: 'room', take_off: 'room', place_tool: 'room', take_tool: 'room', measure: 'room', check_light: 'room', lamp_auto: 'room', print_photo: 'room', take_down_print: 'room', write_diary: 'write', ask_for: 'write', request_ability: 'write' };
const groupOf = (e) => (['start_project', 'judge_project', 'paint_wall', 'print_thing'].some((k) => e.as === k || e.action === k) ? 'made' : GROUP_OF[e.action] ?? 'small');
let filter = ['all', ...DAY_GROUPS.map(([k]) => k)].includes(store('pip-filter')) ? store('pip-filter') : 'all';
const openRows = new Set(); // the lines that are open, so they stay open when the page draws his day again
const rowKey = (e) => `${e.at}|${e.action}`;

// One short line for a step: [what he did, with what]. "Ate" + "mint tea and snack".
function lineOf(e) {
  const name = e.name || '';
  const place = (e.placeName || worldPlace(e.place)?.name || 'outside').replace(/^my /, 'his ');
  const cap = (t) => String(t).replace(/^./, (c) => c.toUpperCase());
  const special = ['fetch_note', 'check_board', 'paint_wall', 'print_thing', 'shape_land', 'start_project', 'judge_project'].find((k) => e.as === k || e.action === k);
  const about = (re) => String(e.what || e.title || name || '').replace(re, '');
  if (e.as === 'start_hobby') return ['Wants to try a new hobby', String(e.what ?? '').replace(/^decide to try /, '').replace(/ as a hobby$/, '')];
  if (e.as === 'drop_want') return ['Crossed a want off his list', ''];
  if (special === 'fetch_note') return ['Went to get a note', ''];
  if (special === 'check_board') return ['Read the notice board', ''];
  if (special === 'paint_wall') return ['Painted on a wall', name];
  if (special === 'print_thing') return ['Printed', name];
  if (special === 'shape_land') return ['Shaped the land', name];
  if (special === 'start_project') return ['Planned a project', about(/^plan my new project:\s*/i)];
  if (special === 'judge_project') return ['Looked at his project', about(/^(look at|judge) my project:?\s*/i)];
  switch (e.action) {
    case 'eat': return ['Ate', e.food || 'a snack'];
    case 'cook': return ['Cooked', e.dish || name];
    case 'harvest': return ['Picked', name || 'from his garden'];
    case 'water': return ['Watered', name || 'his plants'];
    case 'plant': return ['Planted', e.seed || name || 'seeds'];
    case 'decorate': return [e.failed ? 'Wanted to make' : 'Made', name || (e.failed ? 'something' : '')];
    case 'draw': return ['Drew', name];
    case 'make_app': return ['Wrote a program', name];
    case 'update_app': return ['Changed his program', name];
    case 'make_site': return ['Made his own website', name];
    case 'update_site': return ['Worked on his website', e.change || ''];
    case 'make_clothes': return ['Made', name];
    case 'change_thing': return ['Changed', name];
    case 'extend_thing': return ['Added to', name];
    case 'move_thing': return ['Moved', name];
    case 'remove_decoration': return ['Put away', name];
    case 'take_out': return ['Took out', name];
    case 'use': return ['Used', name];
    case 'add_use': return ['Gave a use to', name];
    case 'compose': return ['Composed a song for', name];
    case 'wear': return ['Put on', name];
    case 'take_off': return ['Took off', name];
    case 'search_web': return ['Looked up', e.query || ''];
    case 'read_book': return ['Read about', e.opened?.title || e.topic || ''];
    case 'browse': return ['Browsed the web', e.opened?.title || ''];
    case 'play_piano': return [String(e.instrument || '').toLowerCase() === 'voice' ? 'Sang' : `Played ${playedOf(e)[1]}`, e.style || ''];
    case 'record_song': return ['Recorded', name || 'a song'];
    case 'write_diary': return ['Wrote in his diary', ''];
    case 'rest': return ['Rested', ''];
    case 'go_out': return ['Went out', `to ${place}`];
    case 'came_home': return e.played ? [`${e.played.verb.replace(/^./, (c) => c.toUpperCase())} his ${e.played.name}`, `at ${place}${e.on ? ', then went on' : ''}`] : e.on ? ['Went on', `from ${place}`] : ['Came home', `from ${place}`];
    case 'buy': return ['Went to buy', e.item || ''];
    case 'walk_to': return ['Walked', `to the ${e.object || 'room'}`];
    case 'take_photo': return ['Took a photo', e.target ? `of ${e.target}` : ''];
    case 'find_picture': return ['Looked for a picture', e.query || ''];
    case 'ask_for': return ['Put on his wants list', e.item || ''];
    case 'blueprint': return ['Planned', name];
    case 'make_move': return ['Designed a move', name];
    case 'happened': return ['', e.what || 'Something happened'];
    case 'do': return ['', cap(String(e.what || 'Did something small').replace(/_/g, ' '))];
    default: return ['', headlineBase(e)[1]];
  }
}

// One line of the timeline. Closed: the time, a picture and a few words. Open: everything about that step.
function dayRow(e) {
  const g = groupOf(e);
  const row = el('details', null, `trow g-${g}${e.failed ? ' failed' : ''}`);
  const sum = el('summary');
  const [verb, what] = lineOf(e);
  const text = el('span', null, 'tt');
  if (verb) text.append(el('b', verb), what ? ` ${what}` : '');
  else text.append(what);
  const line = el('div', null, 'tl');
  line.append(el('time', hm(Date.parse(e.at))), el('span', headline(e)[0], 'ti'), text);
  if (e.failed) line.append(el('span', 'did not work', 'tf'));
  sum.append(line);
  row.append(sum);
  const fillBody = () => {
    if (row.querySelector('.tbody')) return;
    const card = dayCard(e);
    card.querySelector('header')?.remove();
    card.className = `tbody card ${card.className.replace(/\bcard\b/, '').trim()}`;
    for (const p of card.querySelectorAll('p, h3')) if (!p.children.length) p.textContent = p.textContent.replace(/\s*\(x -?[\d.]+, z -?[\d.]+\)/g, '').replace(/\s*\((z|x) -?[\d.]+, height -?[\d.]+\)/g, '').replace(/\s*\(level \d+\)/g, ''); // (the game's own measurements are left out)
    const title = card.querySelector('h3.title');
    if (title && what && title.textContent.trim().toLowerCase() === String(what).trim().toLowerCase()) title.remove(); // the line above says it already
    if (['make_site', 'update_site'].includes(e.action) && !e.failed) { const b = el('button', '🌐 Open his website', 'small'); b.type = 'button'; b.addEventListener('click', openSite); card.append(b); }
    if (!card.childNodes.length) card.append(el('p', 'Nothing more to tell about this one.', 'muted'));
    row.append(card);
  };
  if (openRows.has(rowKey(e))) { row.open = true; fillBody(); }
  row.addEventListener('toggle', () => { if (row.open) { openRows.add(rowKey(e)); fillBody(); } else openRows.delete(rowKey(e)); });
  return row;
}
// The lines of one day, newest first. Three or more small things in a row are folded into one line.
function timeline(list, fold = true) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (fold && j < list.length && groupOf(list[j]) === 'small' && !list[j].failed && list[j].action !== 'happened') j++;
    if (j - i >= 3) {
      const run = list.slice(i, j);
      const key = `fold|${run.at(-1).at}`;
      const box = el('details', null, 'trow fold');
      const sum = el('summary');
      const text = el('span', null, 'tt');
      text.append(el('b', `${run.length} small things`), ` between ${hm(Date.parse(run.at(-1).at))} and ${hm(Date.parse(run[0].at))}`);
      const line = el('div', null, 'tl');
      line.append(el('time', hm(Date.parse(run[0].at))), el('span', '✨', 'ti'), text);
      sum.append(line);
      box.append(sum);
      const inner = el('div', null, 'tfold');
      for (const e of run) inner.append(dayRow(e));
      box.append(inner);
      if (openRows.has(key)) box.open = true;
      box.addEventListener('toggle', (ev) => { if (ev.target !== box) return; if (box.open) openRows.add(key); else openRows.delete(key); });
      out.push(box);
      i = j - 1;
    } else out.push(dayRow(list[i]));
  }
  return out;
}
// His day in numbers: a tile for every kind of thing he did (what did not work is not counted; going out counts once).
function daySummary(list, pick = null) {
  const counted = list.filter((e) => !e.failed && !e.fallback && e.action !== 'came_home');
  const box = el('div', null, 'sumtiles');
  const tile = (key, icon, label, n) => {
    const b = el(pick ? 'button' : 'div', null, 'sumtile');
    if (pick) { b.type = 'button'; b.setAttribute('aria-pressed', String(filter === key)); b.addEventListener('click', () => pick(filter === key ? 'all' : key)); }
    b.append(el('span', icon, 'si'), el('b', String(n)), el('small', label));
    return b;
  };
  if (pick) box.append(tile('all', '📖', 'Everything', counted.length));
  for (const [key, icon, label] of DAY_GROUPS) { const n = counted.filter((e) => groupOf(e) === key).length; if (n) box.append(tile(key, icon, label, n)); }
  return box;
}

// Today's steps that are no longer in his state (it keeps only the newest) are read from today's file in the archive.
const dayNL = (ms = Date.now()) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
let todayExtra = { day: '', at: 0, log: [] };
async function loadToday() {
  const day = dayNL();
  if (todayExtra.day === day && Date.now() - todayExtra.at < 5 * 60_000) return;
  todayExtra = { day, at: Date.now(), log: todayExtra.day === day ? todayExtra.log : [] };
  try {
    const r = await fetch(`${localHost ? 'archive/' : `${RAW}archive/`}${day}.json?t=${Math.floor(Date.now() / 60_000)}`, { cache: 'no-store' });
    if (!r.ok) return;
    const log = fromGithub(await r.json()).log || [];
    const grew = log.length !== todayExtra.log.length;
    todayExtra.log = log;
    if (grew && lastState) renderDay(lastState);
  } catch {}
}
function allEntries(s) {
  const seen = new Set();
  return [...dayEntries(s), ...(todayExtra.day === dayNL() ? todayExtra.log : [])].filter((e) => e?.at && !seen.has(rowKey(e)) && seen.add(rowKey(e)));
}

// Entries appear when their step begins, so his day unfolds live.
function renderDay(s) {
  loadToday();
  const now = Date.now();
  const all = allEntries(s).filter((e) => Date.parse(e.at) <= now).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const today = all.filter((e) => dayLabel(e.at) === 'Today');
  // his day in numbers
  const sum = [];
  if (today.length) {
    sum.push(el('h2', 'Today in numbers'), daySummary(today, (key) => { filter = key; store('pip-filter', key); renderDay(lastState); }));
  }
  fill($('daysum'), sum);
  // what he made today
  const made = madeItems(s).filter((x) => x.at && dayLabel(x.at) === 'Today');
  fill($('daymade'), made.length ? [el('h2', 'Made today'), madeGrid(made.slice(0, 6))] : []);
  // the timeline
  const list = all.filter((e) => filter === 'all' || groupOf(e) === filter);
  if (!list.length) {
    fill($('day'), [el('p', filter === 'all' ? "Pip's day will show up here as it happens." : 'Nothing like this yet today. Tap the tile again to see everything.', 'muted')]);
    return;
  }
  const out = [];
  let label = '';
  let batch = [];
  const flush = () => { if (!batch.length) return; const box = el('div', null, 'timeline'); box.append(...timeline(batch, filter === 'all')); out.push(box); batch = []; };
  for (const e of list) {
    const l = dayLabel(e.at);
    if (l !== label) { flush(); label = l; out.push(el('h2', l === 'Today' ? 'What he did today' : l, 'dayhead')); }
    batch.push(e);
  }
  flush();
  fill($('day'), out);
}

// ---- Everything Pip made, in one place: things, drawings, programs, songs, prints, clothes, photos, hills and holes,
// moves. Each as a picture with its name, newest first. A row of buttons shows only one kind. A tap opens its card.
const MADE_TYPES = [['website', '🌐', 'Website'], ['thing', '🛠️', 'Things'], ['drawing', '🎨', 'Drawings'], ['program', '💻', 'Programs'], ['song', '🎵', 'Songs'], ['print', '🖨️', 'Prints'], ['clothes', '👕', 'Clothes'], ['photo', '📷', 'Photos'], ['land', '⛰️', 'Land'], ['move', '🕺', 'Moves']];
const MADE_LIST = { thing: 'room', drawing: 'drawings', program: 'apps', song: 'studio', clothes: 'wardrobe', photo: 'photos', move: 'moves' }; // where the long list of each kind is (on the Pip tab)
let madeFilter = ['all', ...MADE_TYPES.map(([k]) => k)].includes(store('pip-made')) ? store('pip-made') : 'all';
function madeItems(s) {
  const out = [];
  const now = Date.now();
  const add = (x) => { if (x.label && !(Date.parse(x.at) > now)) out.push(x); };
  const why = (t) => (t ? [{ heading: 'Why he made it', quote: t }] : []);
  const thinksOf = (x) => thinks(x);
  const thing = (d, where) => add({ type: 'thing', icon: '🛠️', img: () => decorThumb(d), label: d.name, sub: where, at: d.createdAt ?? d.at,
    info: () => ({ title: d.name, icon: '🛠️', subtitle: `Made ${when(d.createdAt ?? d.at)} · ${where}`, image: decorThumb(d, 320), sections: [...why(d.why), ...(d.goneAt && !d.thinks ? [] : thinksOf(d)), ...(d.said ? [{ heading: `Why he took it apart (${when(d.goneAt)})`, quote: d.said }] : []), ...(d.uses?.length ? [{ heading: 'What it is for', chips: d.uses.map((u) => u.label) }] : [])] }) });
  for (const d of s.decor ?? []) if (!d.image && Array.isArray(d.parts) && d.parts.length) thing(d, d.kind === 'outside' ? (d.readyAt && now < Date.parse(d.readyAt) ? 'being built outside' : 'stands outside') : 'in his room');
  for (const d of s.stored ?? []) if (!d.image && Array.isArray(d.parts) && d.parts.length) thing(d, 'in his chest');
  for (const d of s.playthings ?? []) if (Array.isArray(d.parts) && d.parts.length) thing(d, `to ${d.verb} outside`);
  for (const d of s.gone ?? []) if (Array.isArray(d.parts) && d.parts.length) thing({ ...d, createdAt: d.goneAt }, 'taken apart');
  for (const d of s.museum ?? []) if (Array.isArray(d.parts) && d.parts.length) thing(d, 'in his museum');
  for (const d of s.depot ?? []) if (Array.isArray(d.parts) && d.parts.length) thing(d, 'in the depot of his museum');
  for (const a of s.gallery ?? s.art ?? []) if (a.file) add({ type: 'drawing', icon: '🎨', img: a.file, label: a.name, sub: a.wall ? 'painted on a wall' : 'a drawing', at: a.at ?? a.createdAt,
    info: () => ({ title: a.name, icon: '🎨', subtitle: `${a.wall ? 'Painted on a wall' : 'Drawn'} ${when(a.at ?? a.createdAt)}`, image: a.file, sections: [...why(a.why), ...thinksOf(a)] }) });
  if (s.site?.file) add({ type: 'website', icon: '🌐', label: s.site.title, sub: `his website · version ${s.site.v}`, at: s.site.updatedAt,
    info: () => ({ title: s.site.title, icon: '🌐', subtitle: `His own website · started ${when(s.site.createdAt)} · version ${s.site.v}`, sections: [...why(s.site.why), { heading: 'What he changed last', lines: (s.site.changes ?? []).slice(-4).reverse().map((c) => `Version ${c.v}: ${c.change}`) }, { buttons: [{ label: '🌐 Open his website', run: () => { hideInfo(); openSite(); } }] }] }) });
  for (const a of s.apps ?? []) add({ type: 'program', icon: '💻', label: a.name, sub: a.v > 1 ? `version ${a.v}` : 'a program', at: a.createdAt,
    info: () => ({ title: a.name, icon: '💻', subtitle: `Written ${when(a.createdAt)}${a.updatedAt && a.updatedAt !== a.createdAt ? ` · changed ${when(a.updatedAt)}` : ''}`, sections: [...why(a.why), ...thinksOf(a), { buttons: [{ label: '▶ Open the program', run: () => openApp(a) }] }] }) });
  for (const r of s.studio?.songs ?? []) add({ type: 'song', icon: '🎵', label: r.name, sub: `${(r.tracks ?? []).length || 1} part${(r.tracks ?? []).length === 1 ? '' : 's'}`, at: r.createdAt,
    info: () => ({ title: r.name, icon: '🎵', subtitle: `Recorded ${when(r.createdAt)}`, sections: [...why(r.why), ...thinksOf(r), { buttons: [{ label: '▶ Listen', run: () => { const song = trackSong({ tempo: r.tempo, tracks: r.tracks }); if (song) playSong(song); } }] }] }) });
  for (const p of s.prints ?? []) if (Array.isArray(p.parts) && p.parts.length) { const d = { id: `print-${p.id}`, name: p.name, parts: p.parts, at: p.at }; add({ type: 'print', icon: '🖨️', img: () => decorThumb(d), label: p.name, sub: 'on the shelf of prints', at: p.at,
    info: () => ({ title: p.name, icon: '🖨️', subtitle: `Printed ${when(p.at)} · on the shelf at the print workshop`, image: decorThumb(d, 320), sections: why(p.why) }) }); }
  for (const c of s.wardrobe ?? []) add({ type: 'clothes', icon: '👕', img: () => clothesThumb(c), label: c.name, sub: c.worn ? 'wearing it now' : 'in his wardrobe', at: c.madeAt || c.createdAt,
    info: () => ({ title: c.name, icon: '👕', subtitle: `Made ${when(c.madeAt || c.createdAt)} · ${c.worn ? 'he is wearing it now' : 'in his wardrobe'}`, image: clothesThumb(c), sections: why(c.why) }) });
  for (const p of s.pictures ?? []) if (p.by === 'pip' && p.image) add({ type: 'photo', icon: '📷', img: p.image, label: p.target ? `Photo of ${p.target}` : 'A photo', sub: 'a photo he took', at: p.at,
    info: () => ({ title: p.target ? `Photo of ${p.target}` : 'A photo', icon: '📷', subtitle: `Taken ${when(p.at)}`, image: p.image, sections: p.caption ? [{ heading: 'What he says about it', quote: p.caption }] : [] }) });
  for (const l of s.land ?? []) add({ type: 'land', icon: l.kind === 'hole' ? '🕳️' : '⛰️', label: l.name || (l.kind === 'hole' ? 'a hole' : 'a hill'), sub: `${2 * l.r} m wide`, at: l.at,
    info: () => ({ title: l.name || (l.kind === 'hole' ? 'A hole' : 'A hill'), icon: l.kind === 'hole' ? '🕳️' : '⛰️', subtitle: `Shaped ${when(l.at)}`, sections: [{ lines: [`${2 * l.r} metres wide and ${l.h} metres ${l.kind === 'hole' ? 'deep' : 'high'}. It is out in his world: you can walk over it.`] }] }) });
  for (const m of s.moves ?? []) add({ type: 'move', icon: '🕺', label: m.name, sub: 'a move', at: m.createdAt,
    info: () => ({ title: m.name, icon: '🕺', subtitle: `Thought up ${when(m.createdAt)}`, sections: [...why(m.why), { buttons: [{ label: '▶ Show the move', run: () => { preview = { move: m, start: performance.now(), until: performance.now() + Math.max(3000, (m.duration || 2) * 2000) }; hideInfo(); } }] }] }) });
  return out.sort((a, b) => Date.parse(b.at ?? 0) - Date.parse(a.at ?? 0));
}
// A grid of pictures with a name under each. A tap opens the card of that thing.
function madeGrid(items) {
  const g = el('div', null, 'mgrid');
  for (const x of items) {
    const b = el('button', null, 'mcell');
    b.type = 'button';
    let src = null;
    try { src = typeof x.img === 'function' ? x.img() : x.img; } catch {}
    if (src) { const im = el('img'); im.src = src; im.alt = ''; im.loading = 'lazy'; b.append(im); } else b.append(el('span', x.icon, 'mico'));
    b.append(el('b', String(x.label).replace(/_/g, ' ')), el('small', x.sub));
    b.addEventListener('click', () => showInfo(x.info()));
    g.append(b);
  }
  return g;
}
const MADE_PAGE = 30; // so many at first, then a button for more
let madeShown = MADE_PAGE;
function renderMade(s = lastState) {
  if (!s || tab !== 'made') return; // (the pictures of his things are only drawn when someone looks)
  const all = madeItems(s);
  const count = (k) => all.filter((x) => x.type === k).length;
  const chip = (key, text, n) => {
    const b = el('button', null, 'filter');
    b.type = 'button';
    b.append(text, el('span', String(n), 'n'));
    b.setAttribute('aria-pressed', String(madeFilter === key));
    b.addEventListener('click', () => { madeFilter = key; madeShown = MADE_PAGE; store('pip-made', key); renderMade(); });
    return b;
  };
  fill($('madefilters'), [chip('all', 'Everything', all.length), ...MADE_TYPES.filter(([k]) => count(k)).map(([k, icon, label]) => chip(k, `${icon} ${label}`, count(k)))]);
  if (madeFilter !== 'all' && !count(madeFilter)) madeFilter = 'all';
  const list = all.filter((x) => madeFilter === 'all' || x.type === madeFilter);
  const out = [];
  if (!list.length) out.push(el('p', 'Pip has not made anything yet. When he does, it shows up here.', 'muted'));
  else {
    const week = list.filter((x) => Date.now() - Date.parse(x.at) < 7 * 86_400_000).length;
    out.push(el('p', `${list.length} ${madeFilter === 'all' ? 'things he made' : MADE_TYPES.find(([k]) => k === madeFilter)[2].toLowerCase()}${week ? ` · ${week} in the last 7 days` : ''}. Newest first. Tap one to read about it.`, 'muted madenote'));
    out.push(madeGrid(list.slice(0, madeShown)));
    if (list.length > madeShown) { const more = el('button', `Show ${Math.min(MADE_PAGE, list.length - madeShown)} more`, 'small morebtn'); more.type = 'button'; more.addEventListener('click', () => { madeShown += MADE_PAGE; renderMade(); }); out.push(more); }
    const sec = MADE_LIST[madeFilter];
    if (sec) { const full = el('button', 'Open the full list with all details ›', 'small morebtn'); full.type = 'button'; full.addEventListener('click', () => { showTab('life'); openLife(sec); }); out.push(full); }
  }
  fill($('madelist'), out);
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
    const b = el('button', null, 'olderbtn');
    b.type = 'button';
    b.append(el('b', new Date(`${d.day}T12:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })), el('small', `${d.log} things he did`), el('span', '›', 'chev'));
    const body = el('div', null, 'olderbody');
    body.hidden = true;
    let loaded = false;
    b.addEventListener('click', async () => {
      body.hidden = !body.hidden;
      b.classList.toggle('open', !body.hidden);
      if (body.hidden || loaded) return;
      loaded = true;
      try {
        const r = await fetch(`${base}${d.day}.json`, { cache: 'no-store' });
        const data = fromGithub(await r.json());
        const log = (data.log || []).slice().reverse();
        const lines = el('div', null, 'timeline');
        lines.append(...timeline(log));
        body.replaceChildren(...(log.length ? [daySummary(log), lines] : [el('p', 'Nothing saved for this day.', 'muted')]));
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
  const out = awayWords();
  if (out) { // he is out of the house: where, and when he is home again
    const row = el('div', null, 'row');
    row.append(el('span', 'Now', 'label'), el('span', `${out[0]} ${out[1]}. Home around ${out[2]}.`, 'big'));
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
setInterval(() => {
  if (lastState) renderDay(lastState);
  renderNow();
}, 10_000);

// ---- Live: the small moments between his steps (moments.js writes them with the time each one happens; no model).
// A moment shows when its time has come, so his day moves on the page by the half minute.
let liveOpen = false;
let liveTop = null; // the newest moment that is shown (to see when a new one has come)
function renderLive(force = false) {
  const box = $('live');
  const s = lastState;
  const now = Date.now();
  const due = (s?.moments ?? []).filter((m) => Date.parse(m.at) <= now && Date.parse(m.at) > now - 18 * 3_600_000).reverse();
  box.hidden = !due.length;
  if (!due.length) return;
  const top = `${due[0].at}|${due[0].text}`;
  if (!force && top === liveTop) return;
  const isNew = liveTop !== null && top !== liveTop;
  liveTop = top;
  const awake = !s.last?.sleeping;
  const quiet = now - Date.parse(due[0].at) > 25 * 60_000; // nothing for a while (the game is not running, or he is far)
  const h = el('h2');
  h.append(el('span', null, `livedot${quiet ? ' off' : ''}`), document.createTextNode(awake ? 'Live' : 'Live: he sleeps'), el('small', quiet ? `last seen ${when(due[0].at)}` : 'what he does, minute by minute'));
  const rows = due.slice(0, liveOpen ? 30 : 5).map((m, i) => {
    const row = el('div', null, `moment ${m.kind}${i === 0 ? ' first' : ''}${i === 0 && isNew ? ' fresh' : ''}`);
    const t = el('time', hm(Date.parse(m.at)));
    row.append(t, el('span', m.icon ?? '•'), el('span', m.text));
    return row;
  });
  const out = [h, ...rows];
  if (due.length > 5) { const b = el('button', liveOpen ? 'Show less' : `Show more (${Math.min(30, due.length)})`, 'more'); b.type = 'button'; b.onclick = () => { liveOpen = !liveOpen; renderLive(true); }; out.push(b); }
  fill(box, out);
}
setInterval(renderLive, 4000);
addEventListener('resize', () => renderArc());

// ---- His mood over the day (arc.js writes a point at every wake-up): one line from 0 to 10, with his mood in a word
// where it changes. Pointing at the line (or the arrow keys) shows the time and all his feelings at that moment.
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, text = null) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
let arcKey = '';
// What he had just done at a point on the mood chart, in a few plain words (the move he chose: arc.js keeps it as "did").
const DID_WORDS = { walk_to: 'walking somewhere', decorate: 'making something', draw: 'drawing', record_song: 'recording a song', revise_song: 'working on a song', make_app: 'making a program', update_app: 'working on a program', make_clothes: 'sewing', change_thing: 'changing something he made', extend_thing: 'adding to something he made', play_piano: 'playing music', search_web: 'looking something up', browse: 'wandering the web', read_book: 'reading', find_picture: 'looking for a picture', water: 'watering his plants', harvest: 'harvesting', plant: 'planting', eat: 'eating', cook: 'cooking', rest: 'resting', do: 'doing something small', phone: 'on his phone', use: 'using something he made', take_photo: 'taking a photo', place_picture: 'hanging a picture', move_thing: 'moving something', remove_decoration: 'putting something away', take_out: 'taking something out', take_tool: 'picking up a tool', wear: 'getting dressed', write_diary: 'writing in his diary', tell: 'writing to Bas', answer_visitor: 'answering a visitor', buy: 'getting something at the shop', check_board: 'reading the notice board', fetch_note: 'fetching a note', shape_land: 'shaping the land', paint_wall: 'painting a wall outside', print_thing: 'printing something', go_out: 'going outside', want: 'wishing for something', drop_want: 'letting a wish go', ask_visitors: 'asking visitors a question', read_shelf: 'reading what visitors sent', build_on: 'building on a big thing', dream: 'naming his big dream', dream_step: 'a step towards his dream', end_dream: 'letting a dream go', take_apart: 'taking something apart', quiet: 'quiet time', make_plaything: 'making something to play with', play: 'playing outside', play_game: 'playing a game', show_in_museum: 'carrying something to his museum', start_hobby: 'starting a hobby', make_site: 'making his website', update_site: 'working on his website', build_outside: 'building outside', work_on_project: 'working on his project', plan_project: 'planning a project', judge_project: 'looking back at a project', start_project: 'starting a project' };
function didWords(p) {
  if (p.asleep) return 'going to sleep';
  if (p.out) return p.place ? `outside: ${String(p.place).replace(/_/g, ' ')}` : 'outside';
  return p.did ? DID_WORDS[p.did] ?? String(p.did).replace(/_/g, ' ') : '';
}
// How much his mood moved since the point before, in words ("up 0.6"); '' when it hardly moved.
const movedWords = (p, before) => { const d = before ? Math.round((p.feel - before.feel) * 10) / 10 : 0; return Math.abs(d) < 0.2 ? '' : `${d > 0 ? 'up' : 'down'} ${Math.abs(d)}`; };
function renderArc(force = false) {
  const box = $('arc');
  const pts = (lastState?.arc ?? []).filter((p) => dayLabel(p.at) === 'Today' && Number.isFinite(p.feel)).map((p) => ({ ...p, t: Date.parse(p.at) }));
  const W = Math.round(box.parentElement?.clientWidth ? box.parentElement.clientWidth - 34 : 0);
  if (pts.length < 2 || W < 120) { box.hidden = pts.length < 2; return; } // (a hidden tab has no width yet: it is drawn when it shows)
  const key = `${pts.length}|${pts.at(-1).at}|${W}`;
  if (!force && key === arcKey) return;
  arcKey = key;
  box.hidden = false;
  const H = 150, L = 24, R = 14, T = 24, B = 22;
  const t0 = pts[0].t, t1 = Math.max(pts.at(-1).t, t0 + 2 * 3_600_000);
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - Math.min(10, Math.max(0, v)) / 10) * (H - T - B);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', tabindex: 0, 'aria-label': `His mood today, from ${hm(t0)} to ${hm(pts.at(-1).t)}. Now ${pts.at(-1).feel} out of 10${pts.at(-1).mood ? `, ${pts.at(-1).mood}` : ''}. Arrow keys step through the day.` });
  for (const v of [0, 5, 10]) { svg.append(svgEl('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }), svgEl('text', { class: 'tick', x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, String(v))); }
  // the hours along the bottom (at most six)
  const hours = (t1 - t0) / 3_600_000, stepH = hours <= 5 ? 1 : hours <= 10 ? 2 : 3;
  const first = new Date(t0); first.setMinutes(0, 0, 0);
  let tickEnd = -999; // (where the last hour label ends: two never touch)
  for (let t = first.getTime(); t <= t1; t += 3_600_000) {
    if (t < t0 || new Date(t).getHours() % stepH) continue;
    const w = hm(t).length * 7.2, end = x(t) > W - R - 16, left = end ? x(t) - w : x(t) - w / 2;
    if (left - tickEnd < 12) continue;
    tickEnd = left + w;
    svg.append(svgEl('text', { class: 'tick', x: x(t), y: H - 5, 'text-anchor': end ? 'end' : 'middle' }, hm(t)));
  }
  const line = pts.map((p) => `${x(p.t).toFixed(1)},${y(p.feel).toFixed(1)}`).join(' ');
  svg.append(svgEl('polygon', { class: 'moodarea', points: `${x(t0).toFixed(1)},${y(0)} ${line} ${x(pts.at(-1).t).toFixed(1)},${y(0)}` }), svgEl('polyline', { class: 'moodline', points: line }));
  // his mood in a word: now, at his best and at his lowest, and where the word changes (only where there is room)
  const best = pts.reduce((a, p) => (p.feel > a.feel ? p : a)), low = pts.reduce((a, p) => (p.feel < a.feel ? p : a));
  const wanted = [pts.at(-1), best, low, ...pts.filter((p, i) => i > 0 && p.mood && p.mood !== pts[i - 1].mood)].filter((p, i, all) => p.mood && all.indexOf(p) === i);
  const placed = [];
  for (const p of wanted) {
    const w = p.mood.length * 7 + 8;
    const cx = Math.min(W - R - w / 2 + 8, Math.max(L + w / 2, x(p.t)));
    const up = y(p.feel) > T + 16; // above the line, or under it when it runs along the top
    const cy = up ? y(p.feel) - 9 : y(p.feel) + 18;
    if (placed.some((q) => Math.abs(q.cx - cx) < (q.w + w) / 2 + 6 && Math.abs(q.cy - cy) < 15)) continue;
    placed.push({ cx, cy, w });
    svg.append(svgEl('circle', { class: 'mooddot', cx: x(p.t), cy: y(p.feel), r: p === pts.at(-1) ? 4.5 : 4 }), svgEl('text', { class: 'word', x: cx, y: cy, 'text-anchor': 'middle' }, p.mood));
    if (placed.length >= 5) break;
  }
  // pointing at it: a hairline at the nearest moment, and all his feelings then
  const cross = svgEl('line', { class: 'cross', y1: T - 6, y2: y(0), visibility: 'hidden' });
  const dot = svgEl('circle', { class: 'mooddot', r: 5, visibility: 'hidden' });
  svg.append(cross, dot, svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }));
  const tip = el('div'); tip.id = 'arctip'; tip.hidden = true;
  let at = -1;
  const show = (i) => {
    at = Math.min(pts.length - 1, Math.max(0, i));
    const p = pts[at], px = x(p.t);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', px); dot.setAttribute('cy', y(p.feel)); dot.setAttribute('visibility', 'visible');
    const rows = [['Joy', p.joy], ['Calm', p.calm], ['Wonder', p.wonder], ['Energy', p.energy]].map(([name, v]) => { const r = el('div', null, 'row'); r.append(el('span', name), el('i', String(v))); return r; });
    const did = didWords(p), moved = movedWords(p, pts[at - 1]);
    fill(tip, [el('span', hm(p.t)), el('b', `${p.feel} of 10${p.mood ? ` · ${p.mood}` : ''}`), ...(did ? [el('span', `After ${did}${moved ? `: ${moved}` : ''}`, 'after')] : []), ...rows]);
    tip.hidden = false;
    const left = svg.getBoundingClientRect().left - box.getBoundingClientRect().left + px;
    tip.style.left = `${Math.min(box.clientWidth - 150, Math.max(6, left + (px > W * 0.6 ? -150 : 12)))}px`;
    tip.style.top = '48px';
  };
  const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); at = -1; };
  svg.addEventListener('pointermove', (e) => { const r = svg.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; let near = 0; pts.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(pts[near].t) - px)) near = i; }); show(near); });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show((at < 0 ? pts.length - 1 : at) + (e.key === 'ArrowLeft' ? -1 : 1)); } else if (e.key === 'Escape') hide(); });
  // the same as a list: every time his mood word changed
  const changes = pts.filter((p, i) => i === 0 || i === pts.length - 1 || p.mood !== pts[i - 1].mood).slice(-12);
  const table = document.createElement('table');
  const head = document.createElement('tr'); head.append(el('th', 'Time'), el('th', 'Mood'), el('th', 'Of 10'), el('th', 'After')); table.append(head);
  for (const p of changes) { const tr = document.createElement('tr'); tr.append(el('td', hm(p.t)), el('td', p.mood || '…'), el('td', String(p.feel)), el('td', didWords(p) || '…')); table.append(tr); }
  const details = document.createElement('details'); details.append(el('summary', 'Show as a list'), table);
  // what moved his mood most today: the biggest step up and the biggest step down, with what he had just done
  const steps = pts.map((p, i) => ({ p, d: i ? p.feel - pts[i - 1].feel : 0 })).filter((x) => didWords(x.p));
  const upMost = steps.reduce((a, x) => (x.d > (a?.d ?? 0.39) ? x : a), null), downMost = steps.reduce((a, x) => (x.d < (a?.d ?? -0.39) ? x : a), null);
  const moved = el('ul', null, 'moved');
  if (upMost) moved.append(el('li', `Lifted him most: ${didWords(upMost.p)} (${hm(upMost.p.t)}, up ${Math.round(upMost.d * 10) / 10})`));
  if (downMost) moved.append(el('li', `Pulled him down most: ${didWords(downMost.p)} (${hm(downMost.p.t)}, down ${Math.round(-downMost.d * 10) / 10})`));
  fill(box, [el('h2', 'His mood today'), el('p', 'Joy, calm and wonder together, from 0 (low) to 10 (high).', 'sub'), svg, tip, ...(moved.children.length ? [moved] : []), details]);
}

// ---- Mind: his reflections, wants and questions
// His memory in three shelves (memory.js): how full each is, the strongest few, and the one that will go first.
function renderMemory(s) {
  const all = s.memories || [];
  const shown = (m) => (m.private ? '🔒 something private' : m.text);
  const tier = (name) => all.filter((m) => (m.tier ?? 'long') === name);
  const boxes = [['Short term', 'the last days: it fades fast', tier('short'), 24], ['Long term', 'what he keeps: it fades over months', tier('long'), 36], ['Faded', 'one worn sentence is left. It only comes back when something touches it', s.faded || [], 150]].map(([title, what, list, slots]) => {
    const box = el('div', null, 'memtier');
    const h = el('h3'); h.append(document.createTextNode(title), el('small', `${list.length} of ${slots}`));
    const bar = el('div', null, 'bar'); const fillI = document.createElement('i'); fillI.style.width = `${Math.min(100, (list.length / slots) * 100)}%`; bar.append(fillI);
    const ul = el('ul');
    if (title === 'Faded') ul.append(...list.slice(-3).reverse().map((m) => el('li', m.text)));
    else {
      const byWeight = [...list].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
      ul.append(...byWeight.slice(0, 3).map((m) => el('li', shown(m))));
      const last = byWeight.filter((m) => !m.pinned).at(-1);
      if (last && byWeight.length > 3) ul.append(el('li', `First to go: ${shown(last)}`, 'goes'));
    }
    if (!list.length) ul.append(el('li', 'Nothing here yet.', 'muted'));
    box.append(h, bar, el('p', what, 'muted'), ul);
    return box;
  });
  if (s.nightly?.kept?.length) boxes.push(el('p', `🌙 Last night he kept: ${s.nightly.kept.slice(0, 3).join(' · ')}`, 'muted'));
  $('memtiers').replaceChildren(...boxes);
  fill($('beliefs'), (s.beliefs || []).length ? s.beliefs.map((b) => el('li', `${b.lifts ? '⬆️' : '⬇️'} ${b.text} (seen on ${b.days} days)`)) : [el('li', 'Nothing yet. A belief needs three days of the same.', 'muted')]);
  fill($('learned'), (s.learned || []).length ? s.learned.slice(-6).reverse().map((l) => el('li', `💌 ${l.from} (${l.who}): “${l.text}”${l.said ? ` Pip: “${l.said}”` : ''}`)) : [el('li', 'Nobody has taught him anything yet. Travellers leave notes in his world.', 'muted')]);
  const face = { love: '😍', like: '🙂', meh: '😐', dislike: '😒', doubt: '🤨' };
  fill($('opinions'), (s.opinions || []).length ? s.opinions.slice(-6).reverse().map((o) => el('li', `${face[o.how] ?? '💭'} ${o.topic}: “${o.says}”`)) : [el('li', 'He has not said what he thinks of anything yet.', 'muted')]);
  const ints = (s.curious?.interests || []).filter((i) => i.score >= 3).sort((a, b) => b.score - a.score);
  const times = (n) => `${n} time${n === 1 ? '' : 's'}`;
  const hobbyLevel = (i) => (i.score >= 6 && (i.practice ?? 0) >= 12 ? ['🏅', 'mastered'] : i.own && !(i.practice > 0) ? ['🌱', 'wants to try it'] : i.own && (i.practice ?? 0) < 6 ? ['🌱', 'trying it'] : i.score >= 6 ? ['💛', 'hobby'] : ['✨', 'interest']);
  fill($('hobbies'), ints.length ? ints.slice(0, 8).map((i) => { const [icon, lvl] = hobbyLevel(i); return el('li', `${icon} ${lvl}: ${i.topic} (${i.own ? 'his own idea, ' : ''}did it ${times(i.practice ?? 0)})${i.own && i.why ? ` — “${i.why}”` : ''}`); }) : [el('li', 'No interests yet. Browsing is how he finds them, or he thinks of one himself.', 'muted')]);
  { // what he practises: how often he did each kind of thing in his whole life (his body counts every move), and what he never tried
    const ever = s.ever || {};
    const KINDS = [['🎶', 'playing music', ['play_piano']], ['🎛️', 'recording songs', ['record_song', 'compose']], ['🎨', 'drawing', ['draw']], ['🖌️', 'painting walls', ['paint_wall']], ['🔨', 'building things', ['decorate']], ['🛠️', 'making his things better', ['change_thing', 'extend_thing']], ['🏗️', 'building big outside', ['build_outside']], ['🖨️', '3D printing', ['print_thing']], ['🧩', 'writing programs', ['make_app', 'update_app']], ['🌐', 'his website', ['make_site', 'update_site']], ['🍳', 'cooking', ['cook']], ['🌱', 'gardening', ['plant', 'water', 'harvest']], ['🚶', 'going outside', ['go_out']], ['📖', 'reading', ['read_book']], ['💻', 'looking things up', ['search_web', 'browse']], ['✍️', 'his diary', ['write_diary']], ['📷', 'taking photos', ['take_photo']], ['🧵', 'sewing', ['make_clothes']], ['⛰️', 'shaping the land', ['shape_land']], ['🕺', 'inventing dances', ['make_move']], ['🪁', 'out with his things', ['play']], ['🎮', 'playing his games', ['play_game']], ['🏛️', 'his museum', ['show_in_museum']], ['❓', 'asking his visitors', ['ask_visitors']]];
    const rows = KINDS.map(([icon, name, moves]) => ({ icon, name, n: moves.reduce((a, m) => a + (ever[m] || 0), 0) }));
    const done = rows.filter((r) => r.n > 0).sort((a, b) => b.n - a.n), never = rows.filter((r) => !r.n);
    const top = Math.max(1, ...done.map((r) => r.n));
    $('practhead').hidden = $('practlist').hidden = !done.length;
    fill($('practlist'), done.slice(0, 10).flatMap((r) => { const bar = el('div', null, 'bar'); const i = document.createElement('i'); i.style.width = `${Math.max(3, Math.round((r.n / top) * 100))}%`; bar.append(i); return [el('span', `${r.icon} ${r.name}`), bar, el('span', `${r.n} time${r.n === 1 ? '' : 's'}`, 'n')]; }));
    $('practnever').hidden = !never.length || !done.length;
    $('practnever').textContent = never.length ? `Never tried yet: ${never.map((r) => r.name).join(', ')}.` : '';
  }
  { // his one big dream (dream.js): what it is, why, and what he did for it
    const d = s.bigDream ?? null, past = (s.pastDreams ?? []).at(-1) ?? null;
    $('dreamcard').hidden = !d && !past;
    if (d) {
      const days = Math.floor((Date.now() - Date.parse(d.since)) / 86_400_000);
      const steps = (d.steps ?? []).slice(-3).reverse();
      const ul = el('ul'); ul.append(...steps.map((x) => el('li', `${when(x.at)}: ${x.what}`)));
      fill($('dreamcard'), [el('div', `🌠 His big dream · ${days ? `for ${days} day${days === 1 ? '' : 's'} now` : 'since today'}`, 'lab'), el('p', d.text, 'txt'), el('p', `Why: ${d.why}`, 'why'), ...(steps.length ? [el('div', 'What he did for it', 'lab'), ul] : [el('p', 'He has not done anything for it yet.', 'muted')])]);
    } else if (past) fill($('dreamcard'), [el('div', past.ended === 'reached' ? '🌠 He reached his big dream' : '🌠 A dream he let go', 'lab'), el('p', past.text, 'txt'), el('p', past.words, 'why'), el('p', 'He has no big dream right now. He names the next one himself.', 'muted')]);
  }
  { // on the front of the Pip tab: his hobbies, the ones he wants to try first
    const mine = ints.filter((i) => i.own || i.score >= 6).sort((x, y) => Number(Boolean(y.own && (y.practice ?? 0) < 6)) - Number(Boolean(x.own && (x.practice ?? 0) < 6)));
    $('hobbyhead').hidden = $('hobbylist').hidden = !mine.length;
    fill($('hobbylist'), mine.slice(0, 5).map((i) => {
      const [icon, lvl] = hobbyLevel(i);
      const li = el('li', null, 'hobby');
      li.append(el('span', icon, 'hi'));
      const body = el('div');
      body.append(el('b', i.topic.replace(/^./, (c) => c.toUpperCase())), el('small', `${lvl}${i.own ? ' · his own idea' : ''} · ${i.own ? `on ${i.practice ?? 0} day${i.practice === 1 ? '' : 's'} so far` : `did it ${times(i.practice ?? 0)}`}`));
      if (i.own && i.why) body.append(el('p', `“${i.why}”`));
      li.append(body);
      return li;
    }));
  }
}
function renderMind(s) {
  renderMemory(s);
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
      m.append(el('span', p.status === 'working' ? `since ${when(p.since)}` : p.status === 'done' ? '✓ done' : p.droppedWhy ? `let go: ${String(p.droppedWhy).replace(/^I have/, 'he has')}` : 'dropped'));
      const body = el('p');
      body.append(el('strong', p.title));
      if (p.why) body.append(`\n${p.why}`);
      li.append(m, body);
      const steps = p.steps || [];
      const extra = () => { // what he made for it, and what he found out for it
        const made = (p.versions || []).map((v) => `v${v.v} ${v.name || ''}`.trim());
        if (made.length) { const d = el('div', null, 'pmade'); d.append(el('b', 'What he made for it'), el('span', made.join(' · '))); li.append(d); }
        const found = (lastState?.notebook || []).filter((n) => n.project === p.title);
        if (found.length) { const d = el('div', null, 'pfound'); d.append(el('b', 'What he found out')); for (const n of found.slice(-3)) d.append(el('p', `🔎 ${n.title}: ${n.text.slice(0, 160)}…`)); li.append(d); }
        const note = (p.notes || []).at(-1)?.text;
        if (note && p.status === 'working') li.append(el('p', `To make it better: ${note}`, 'muted'));
      };
      if (steps.length) {
        const doneN = steps.filter((x) => x.done).length;
        const prog = el('div', null, 'pprog');
        const track = el('div', null, 'track');
        const fillBar = el('div', null, 'fill');
        fillBar.style.width = `${(doneN / steps.length) * 100}%`;
        fillBar.style.background = 'var(--make)';
        track.append(fillBar);
        prog.append(track, el('span', `${doneN} of ${steps.length} steps`));
        const current = steps.findIndex((x) => !x.done);
        const code = (p.versions || []).some((v) => v.kind === 'make_app' || v.kind === 'update_app');
        if (code) { // a program or game: his board, with the tickets he wrote (and the ones a test run added)
          const board = el('div', null, 'board');
          const col = (title, items) => { const c = el('div', null, 'bcol'); c.append(el('b', `${title} (${items.length})`)); items.forEach((x) => c.append(el('div', `${x.from === 'test' ? '🐞 ' : ''}${x.text}`, 'ticket' + (x.from === 'test' ? ' bug' : '')))); return c; };
          const todo = steps.filter((x, i) => !x.done && i !== current);
          board.append(col('To do', todo), col('Doing', current >= 0 && p.status === 'working' ? [steps[current]] : []), col('Done', steps.filter((x) => x.done).slice(-6).reverse()));
          li.append(prog, board);
        } else {
          const list = el('ul', null, 'psteps');
          steps.forEach((x, i) => list.append(el('li', `${x.done ? '✓' : i === current && p.status === 'working' ? '➜' : '○'} ${x.text}`, x.done ? 'done' : '')));
          li.append(prog, list);
        }
      } else if (p.status === 'working') li.append(el('p', 'No steps yet: he plans them first.', 'next'));
      extra();
      return li;
    })
    : empty('None yet. When Pip learns something that excites him, he can turn it into a project.'));
  const now = Date.now();
  const thoughts = (s.thoughts || []).filter((t) => !t.step && Date.parse(t.at) <= now).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12);
  fill($('thoughts'), thoughts.length
    ? thoughts.map((t) => entry([when(t.at), t.mood || ''].filter(Boolean), t.text, 'reflect'))
    : empty('Pip has not thought anything yet.'));
  const wants = s.wants || [];
  fill($('wants'), wants.length ? wants.map((w) => entry([`since ${when(w.since)}`], w.text)) : empty('Pip does not know yet what he wants.'));
  const qs = s.questions || [];
  fill($('questions'), qs.length ? qs.map((q) => entry([`since ${when(q.since)}`], q.text)) : empty('nothing yet'));
  const done = (s.fulfilled || []).slice().reverse();
  fill($('fulfilled'), done.length ? done.map((w) => entry([when(w.at)], w.text)) : empty('nothing yet'));
  { const c = s.body?.coziness; $('coziness').textContent = Number.isFinite(c) ? `🏠 cozy ${Math.round(c)}/10` : ''; }
  // Right now: the project he is on (one line and a bar) and today's goals as a small checklist.
  const cur = projects.find((p) => p.status === 'working');
  const np = $('nowproject');
  np.textContent = '';
  if (cur) {
    const steps = cur.steps || [];
    const doneN = steps.filter((x) => x.done).length;
    np.append(el('strong', cur.title));
    if (steps.length) {
      const prog = el('div', null, 'pprog');
      const track = el('div', null, 'track');
      const fillBar = el('div', null, 'fill');
      fillBar.style.width = `${(doneN / steps.length) * 100}%`;
      fillBar.style.background = 'var(--make)';
      track.append(fillBar);
      prog.append(track, el('span', `${doneN} of ${steps.length}`));
      np.append(prog);
    }
  } else np.append(el('span', 'No project right now.', 'muted'));
  const goals = s.intent?.items || [];
  const goalText = (g) => g.text.replace(/\s*\([a-z_]+\)/g, '').replace(/:\s*/, ': ');
  fill($('goals'), goals.map((g) => el('li', g.gone ? `✕ ${goalText(g)} (he let this go: ${String(g.gone).replace(/^I have/, 'he has')})` : `${g.done ? '✓' : '○'} ${goalText(g)}`, g.done || g.gone ? 'done' : '')));
  const skills = Object.entries(s.skills || {}).filter(([, xp]) => xp > 0);
  if ($('skills')) fill($('skills'), skills.length ? skills.map(([k, xp]) => el('span', `${k} ${Math.min(10, 1 + Math.floor(Math.sqrt(xp / 2)))}`, 'chip')) : [el('span', 'just starting', 'muted')]);
  const interests = s.interests || [];
  fill($('interests'), interests.length ? interests.map((i) => el('span', i, 'chip')) : [el('span', 'none yet', 'muted')]);
  // Parts of his mind with nothing in them yet are left out, so the page stays short.
  const has = { reflections: (s.reflections || []).length, wants: wants.length, questions: qs.length, fulfilled: done.length, interests: interests.length, thoughts: thoughts.length };
  for (const [id, n] of Object.entries(has)) $(id).closest('.msec').hidden = !n;
}

// Every wake-up that failed, newest first. Only shown once the key is filled in (Settings is unlocked).
// The check-up Pip's wake-up writes into his state: what looks fine, what looks off, and the facts to fix it.
function renderCheckup(s) {
  const c = s?.checkup;
  const items = c?.items ?? [];
  fill($('checkup'), items.length
    ? items.slice().sort((a, b) => a.ok - b.ok).map((x) => {
      const li = el('li', null, x.ok ? 'ok' : 'bad');
      li.append(el('b', `${x.ok ? '✅' : '⚠️'} ${x.label}`), el('span', x.text, 'muted'));
      if (!x.ok && (x.look || x.debug)) {
        const d = el('details');
        d.append(el('summary', 'Details for fixing'));
        if (x.look) d.append(el('p', `Where to look: ${x.look}`, 'muted'));
        if (x.debug) d.append(el('pre', x.debug, 'debug'));
        const copy = el('button', '📋 Copy for Claude', 'small');
        copy.type = 'button';
        copy.addEventListener('click', async () => {
          const report = `Pip check-up problem (${new Date(c.at).toLocaleString()}): ${x.label}\n${x.text}\nWhere to look: ${x.look ?? '-'}\n\nFacts:\n${x.debug ?? '-'}`;
          try { await navigator.clipboard.writeText(report); toast('Copied. Paste it to Claude.'); } catch { toast('Copying did not work here.'); }
        });
        d.append(copy);
        li.append(d);
      }
      return li;
    })
    : [el('li', 'No check-up yet. It runs at the end of each wake-up.', 'muted')]);
  const fails = c?.failures ?? [];
  fill($('failgroups'), fails.length
    ? fails.map((f) => {
      const li = el('li', null, f.count >= 3 ? 'bad' : 'ok');
      li.append(el('b', `${f.count >= 3 ? '🔁' : '•'} ${f.move}: ${f.count}× · last ${when(f.last)}`), el('span', f.reason, 'muted'));
      if (f.raw) { const d = el('details'); d.append(el('summary', 'Details'), el('pre', `move: ${f.action}${f.names?.length ? `\nnames: ${f.names.join(', ')}` : ''}\nfull reason: ${f.raw}`, 'debug')); li.append(d); }
      return li;
    })
    : [el('li', 'Nothing failed in the last day.', 'muted')]);
}
function renderErrorLog(s) {
  renderCheckup(s);
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
// "Since you were here": what Pip did while you were away. The page remembers (on this device) when you last looked.
let sinceShown = false;
function renderSince(s) {
  if (sinceShown) return;
  sinceShown = true;
  const last = Number(store('pip-seen') || 0);
  const keep = () => store('pip-seen', String(Date.now()));
  keep();
  setInterval(keep, 60_000);
  if (!last || Date.now() - last < 30 * 60_000) return;
  const after = (iso) => Date.parse(iso) > last;
  const names = (list, n = 3) => { const u = [...new Set(list.filter(Boolean))]; return `${u.slice(0, n).join(', ')}${u.length > n ? ` and ${u.length - n} more` : ''}`; };
  const lines = [];
  const built = (s.decor ?? []).filter((d) => !d.image && after(d.createdAt));
  if (built.length) lines.push(`🔨 He made ${names(built.map((d) => d.name))}.`);
  const drew = (s.gallery ?? s.art ?? []).filter((a) => after(a.at ?? a.createdAt));
  if (drew.length) lines.push(`🎨 He drew ${names(drew.map((a) => `“${a.name}”`))}${drew.some((a) => a.wall) ? ' (some of it on a wall outside)' : ''}.`);
  const prints = (s.prints ?? []).filter((x) => after(x.at));
  if (prints.length) lines.push(`🖨️ He printed ${names(prints.map((x) => x.name))}.`);
  const land = (s.land ?? []).filter((l) => after(l.at));
  if (land.length) lines.push(`⛰️ He shaped the land: ${names(land.map((l) => l.name))}.`);
  const out = (s.outings ?? []).filter((o) => !o.errand && after(o.homeAt));
  if (out.length) lines.push(`🚶 He went out ${out.length} time${out.length === 1 ? '' : 's'}: ${names(out.map((o) => worldPlace(o.place)?.name?.replace(/^my /, 'his ')))}.`);
  const learned = (s.learned ?? []).filter((l) => after(l.at));
  if (learned.length) lines.push(`💌 He learned something from ${names(learned.map((l) => l.from))}.`);
  const log = (s.log ?? []).filter((e) => after(e.at));
  const read = log.filter((e) => ['search_web', 'read_book', 'browse'].includes(e.action) && !e.failed).length;
  if (read) lines.push(`📚 He looked things up or read ${read} time${read === 1 ? '' : 's'}.`);
  const kept = (s.wishes ?? []).filter((w) => w.board && w.status === 'kept' && after(w.keptAt ?? w.at)).length;
  if (kept) lines.push(`📌 He made ${kept} thing${kept === 1 ? '' : 's'} from the notice board.`);
  if (!lines.length) lines.push(log.length ? `He was busy with small things (${log.length} of them), but made nothing new.` : 'Nothing new. He mostly slept.');
  const ago = (() => { const m = Math.round((Date.now() - last) / 60000); return m < 90 ? `${m} minutes` : m < 2880 ? `${Math.round(m / 60)} hours` : `${Math.round(m / 1440)} days`; })();
  const box = $('since');
  const x = el('button', '✕', 'x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => { box.hidden = true; });
  const ul = el('ul'); ul.append(...lines.slice(0, 7).map((l) => el('li', l)));
  box.replaceChildren(x, el('h3', `Since you were here (${ago} ago)`), ul);
  box.hidden = false;
}
function render(s) {
  renderSince(s);
  renderPhone(s);
  syncPrints(s);
  syncMuseum(s);
  syncPlay(s);
  syncFixedLamps(s);
  $('mood').textContent = s.emotion || s.mood || '…';
  renderDay(s);
  renderMade(s);
  renderNow();
  renderLive();
  renderArc();
  renderMind(s);

  const wishes = (s.requests || []).filter((r) => r.status === 'open');
  fill($('requests'), wishes.length ? wishes.map((r) => el('li', `❓ ${r.what}${r.blueprint ? ` — for “${r.blueprint}”` : ''}`)) : empty('Nothing yet. When Pip works out something new and finds a part he cannot make work, it shows up here.'));
  const asks = s.asks || [];
  // Pip only saves your answer when he next wakes up, so an ask you answered is hidden here at once.
  for (const a of asks) if (answeredAsks[a.id ?? a.item] && a.status !== 'open') delete answeredAsks[a.id ?? a.item];
  store('pip-asks-answered', JSON.stringify(answeredAsks));
  const shownAsks = asks.filter((a) => a.status === 'open');
  const open = shownAsks.filter((a) => !answeredAsks[a.id ?? a.item]);
  askOpen = open.length;
  $('askcount').textContent = askOpen + taskOpen || '';
  fill($('asks'), shownAsks.length
    ? shownAsks.map((a) => { // one card for each want: what, why (in his words), since when, and what you can do
      const li = el('li', null, 'wantcard');
      const item = String(a.item ?? '').replace(/^Dream:\s*/i, '');
      const head = el('div', null, 'wanthead');
      head.append(el('span', a.big ? '🌠' : '⭐', 'wi'), el('b', item.replace(/^./, (c) => c.toUpperCase())));
      li.append(head);
      const why = el('p', null, 'wantwhy');
      why.append(el('span', 'Why he wants it'), a.why ? `“${a.why}”` : 'He did not say why.');
      li.append(why);
      const was = answeredAsks[a.id ?? a.item];
      if (was) { // you answered: it stays here with a confirmation until Pip has saved it
        li.append(el('div', was === 'done' ? '✅ Sent: you gave him this. Pip sees it when he next wakes up.' : '✅ Sent: not this one. Pip sees it when he next wakes up.', 'meta'));
        return li;
      }
      li.append(el('div', `${a.big ? 'a big wish for his world · ' : ''}on his list since ${when(a.since)}`, 'meta'));
      const row = el('div', null, 'buttons');
      const done = el('button', '🎁 I gave him this', 'small primary');
      const answer = async (text, kind) => {
        row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        done.textContent = kind === 'done' ? 'Sending…' : '🎁 I gave him this';
        if (await sendReply(text)) {
          toast('Sent! Pip sees it when he next wakes up.');
          answeredAsks[a.id ?? a.item] = kind;
          store('pip-asks-answered', JSON.stringify(answeredAsks));
          if (lastState) render(lastState);
        } else row.querySelectorAll('button').forEach((b) => { b.disabled = false; done.textContent = '🎁 I gave him this'; });
      };
      done.addEventListener('click', () => answer(`I did this for you: "${a.item}"`, 'done'));
      const cant = el('button', 'Not this one', 'small');
      cant.addEventListener('click', () => answer(`I can't do this one: "${a.item}"`, 'cant'));
      row.append(done, cant);
      li.append(row);
      return li;
    })
    : [el('li', 'His list is empty right now. When Pip wants something, he writes it here, with his reason.', 'muted')]);
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
  taskOpen = shown.filter((t) => t.status === 'open' || t.status === 'accepted' || t.status === 'sending').length;
  $('askcount').textContent = askOpen + taskOpen || '';
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
  fill($('asksdone'), closed.length ? closed.map((a) => { // what became of each want
    const li = el('li');
    const how = a.status === 'gone' ? `✂️ he let it go${a.goneWhy ? `: “${a.goneWhy}”` : ''}` : a.status === 'done' ? (a.self ? `⭐ he ${String((a.given ?? [])[0] ?? 'got it himself').replace(/\bmyself\b/, 'himself')}` : '🎁 you gave it to him') : answeredAsks[a.id ?? a.item] === 'done' ? '🎁 you gave it (on its way)' : 'not this one';
    li.append(el('b', String(a.item ?? '').replace(/^Dream:\s*/i, '')), el('span', how));
    return li;
  }) : [el('li', 'Nothing yet.', 'muted')]);

  const outbox = s.outbox || [];
  latestMsg = outbox.at(-1)?.id ?? null;
  const gotIds = new Set((s.inbox || []).map((m) => m.id));
  if (pending.some((p) => gotIds.has(p.id))) {
    pending = pending.filter((p) => !gotIds.has(p.id));
    store('pip-pending', JSON.stringify(pending));
  }
  const opened = (m) => (m.private ? privateText.get(m.id) ?? '🔒 private' : m.text); // private texts come from /api/private, with the key
  const thread = [
    ...outbox.map((m) => ({ at: m.at, kind: m.kind, text: opened(m), image: m.image })),
    ...(s.inbox || []).map((m) => ({ at: m.at, mine: true, read: m.read, readAt: m.readAt, text: opened(m), via: m.via, image: (s.pictures || []).find((p) => p.id === m.picture)?.image })),
    ...privateWaiting.filter((m) => !gotIds.has(m.id) && !pending.some((p) => p.id === m.id)).map((m) => ({ at: m.at, mine: true, text: m.text })),
    ...ntfyMsgs.filter((m) => !gotIds.has(m.id)).map((m) => ({ at: m.at, mine: true, via: 'ntfy', text: m.text })),
    ...pending.map((p) => ({ at: p.at, mine: true, sending: true, text: p.text })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  $('privnote').textContent = store('pip-key') ? 'This chat is private: only you (with your key) and Pip can read it.' : 'This chat is private. Add your key in Settings (the gear) to read and write.';
  renderApprovals();
  renderVisitors(s);
  fill($('messages'), !store('pip-key') ? [] : thread.length
    ? thread.map((m) => m.mine
      ? entry([when(m.at), m.via === 'ntfy' ? 'You (ntfy)' : 'You', m.sending ? 'on its way…' : m.read ? `✓ Pip read it ${when(m.readAt || m.at)}` : 'Pip has not read it yet'], m.text, 'mine', m.image)
      : entry([when(m.at), m.kind === 'ask' ? '🙏 Pip asks for something' : m.kind === 'letter' ? '💌 A letter from Pip' : '✉️ Pip writes to you'], m.text, m.kind === 'ask' ? 'ask' : m.kind === 'letter' ? 'letter' : '', m.image))
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
  const plants = (s.garden?.plots || []).map((p) => { const st = plantState(p); return el('li', `🌱 ${p.plant} (place ${p.slot + 1}): ${st.stage}, ${st.wilted ? 'drooping, needs water' : st.moist ? `damp for ${Math.max(1, Math.round(st.moistLeft))} more hours` : 'thirsty'}${st.ready ? ', ready to harvest' : ''}`); });
  const seeds = (s.garden?.seeds || []).filter((x) => x.qty > 0).map((x) => el('li', `🌰 ${x.name} seeds ×${x.qty}`));
  fill($('gardenlist'), plants.length || seeds.length ? [...plants, ...seeds] : empty('No plants yet.'));
  const bag = s.tools || [];
  const away = [...(s.decor || []).filter((d) => d.tool).map((d) => `${d.name} (in his room)`), ...(s.stored || []).filter((d) => d.tool).map((d) => `${d.name} (in his chest)`)];
  fill($('toollist'), [
    ...(bag.length ? bag.map((x) => el('li', `🎒 ${x.name}${x.why ? ` — ${x.why}` : ''}`)) : [el('li', 'His inventory is empty. Without a tool he cannot do some things, like drawing.', 'muted')]),
    ...away.map((x) => el('li', `📦 ${x}. Not in his inventory, so he cannot use it.`, 'muted')),
  ]);
  const recs = (s.studio?.songs || []).slice().reverse();
  fill($('studiolist'), recs.length ? recs.map((r) => {
    const li = el('li', `🎛️ ${r.name} — ${when(r.createdAt)} `);
    const song = trackSong({ tempo: r.tempo, tracks: r.tracks });
    if (song) {
      const b = el('button', '▶ Listen', 'small');
      b.addEventListener('click', () => playSong(song));
      li.append(b);
    }
    li.append(trackList(r));
    return li;
  }) : empty('He has not recorded a song yet.'));
  const pieces = (s.log || []).filter((e) => e.action === 'play_piano' && !e.failed && Date.parse(e.at) <= Date.now()).slice(-15).reverse();
  fill($('pianolist'), pieces.length ? pieces.map((e) => {
    const song = pianoSong(e.notes, e.style, e.instrument);
    const li = el('li', `${playedOf(e)[0]} ${when(e.at)}${e.style ? ` — ${e.style}` : ''}${e.instrument && e.instrument !== 'piano' ? ` — ${playedOf(e)[1].replace('the ', '')}` : ''} `);
    if (song) {
      const b = el('button', '▶ Listen', 'small');
      b.addEventListener('click', () => playSong(song));
      li.append(b);
    }
    return li;
  }) : empty('He has not played any music yet.'));
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
  fill($('soullist'), (s.soulLines || []).length ? s.soulLines.map((l) => el('li', `✨ ${l.text}`)) : empty('Nothing yet. When he sees the same thing in himself on 3 days, he may add a line.'));
  fill($('lessonlist'), (s.lessons || []).length ? s.lessons.slice(0, 8).map((l) => el('li', `${l.solvedAt ? '✅' : '📝'} ${plainText(l.text) || l.text}${l.count > 1 ? ` (${l.count}×)` : ''}`)) : empty('No lessons yet.'));
  fill($('recipelist'), (s.recipes || []).length ? s.recipes.slice().reverse().map((r) => el('li', `${r.proud ? '⭐' : '📖'} ${r.name}${r.why ? ` — ${r.why}` : ''}`)) : empty('Nothing in his recipe book yet.'));
  fill($('favlist'), (s.favorites || []).length ? s.favorites.map((f) => el('li', `❤️ ${f.kind ? `${f.kind}: ` : ''}${f.what}`)) : empty('No favorites yet.'));
  fill($('ritlist'), (s.rituals || []).length ? s.rituals.map((r) => el('li', `🔁 ${r.text}${r.when ? ` (${r.when})` : ''}`)) : empty('No rituals yet.'));
  fill($('dreamlist'), (s.dreams || []).length ? [...s.dreams].reverse().slice(0, 8).map((d) => el('li', `🌙 ${new Date(d.at).toLocaleDateString([], { day: "numeric", month: "short" })}: ${d.text}`)) : empty('No dreams yet.'));
  fill($('pantrylist'), pantry.length ? pantry.map((p) => el('li', `${p.kind === 'dish' ? '🍲' : foodEmoji(p.name)} ${p.name} ×${p.qty}`)) : empty('The pantry is empty.'));
  const inChest = s.stored || [];
  fill($('chestlist'), inChest.length
    ? inChest.map((x) => entry([`put away ${when(x.storedAt)}`, `it was ${x.label}`], x.name))
    : empty('The chest is empty.'));
  fill($('wardrobelist'), (s.wardrobe || []).length
    ? s.wardrobe.slice().reverse().map((c) => {
      const div = el('div', null, 'pic');
      const pic = clothesPic(c);
      if (pic) div.append(pic);
      div.append(el('div', `${c.name}${c.why ? ` — ${c.why}` : ''}`, 'note'), el('p', `${({ head: 'on his head', face: 'on his face', neck: 'around his middle', body: 'around his body', back: 'on his back' })[c.slot] || 'on him'} · ${c.worn ? 'wearing it now' : 'in his wardrobe'}`, 'muted meta'));
      return div;
    })
    : empty('He has not made any clothes yet.'));
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

  renderTiles();
  renderStatus(s);
}

// ---- Life: tiles that show how much there is in each part; a tile opens that part full size
let lifeOpen = null;
function openLife(name) {
  lifeOpen = name;
  $('lifehome').hidden = !!name;
  $('lifeopen').hidden = !name;
  document.querySelectorAll('.lifesec').forEach((sec) => (sec.hidden = sec.dataset.sec !== name));
  if (name) document.querySelector('[data-pane="life"]').scrollTop = 0;
}
$('lifeback').addEventListener('click', () => openLife(null));
const TILE_GROUPS = [['What he is working on', ['projects']], ['In his head', ['mind', 'self', 'dreams', 'story', 'news']], ['What he has', ['tools', 'pantry', 'garden', 'chest', 'pictures', 'found', 'piano']]];
const TILE_NAMES = { piano: 'Music he played', self: 'Who he is', found: 'Found online' };
function renderTiles() {
  const tiles = $('tiles');
  tiles.textContent = '';
  const emptyNames = [];
  const secs = new Map([...document.querySelectorAll('.lifesec')].map((sec) => [sec.dataset.sec, sec]));
  for (const [heading, keys] of TILE_GROUPS) {
    const box = el('div', null, 'tilegrid');
    for (const key of keys) {
      const sec = secs.get(key);
      if (!sec) continue;
      const ids = (sec.dataset.count || '').split(',').filter(Boolean);
      const real = (root) => [...root.querySelectorAll('li:not(.muted), .pic')];
      const top = (root) => [...root.querySelectorAll(':scope > li:not(.muted)')]; // a list's own items, not the steps inside them
      const items = ids.length ? ids.flatMap((id) => top($(id)).length || !$(id).querySelector('li') ? top($(id)) : real($(id))) : real(sec);
      const name = TILE_NAMES[key] ?? sec.dataset.title;
      if (!items.length && key !== 'story') { emptyNames.push(name); continue; }
      const tile = el('button', null, 'tile');
      tile.type = 'button';
      tile.append(el('span', sec.dataset.icon, 'ticon'), el('b', name), el('small', key === 'story' ? 'read it' : String(items.length)));
      tile.addEventListener('click', () => openLife(key));
      box.append(tile);
    }
    if (box.childNodes.length) tiles.append(el('h2', heading), box);
  }
  { // everything he made has its own tab
    const b = el('button', null, 'tile wide');
    b.type = 'button';
    b.append(el('span', '🧺', 'ticon'), el('b', 'Everything he made'), el('small', 'open ›'));
    b.addEventListener('click', () => showTab('made'));
    const box = el('div', null, 'tilegrid');
    box.append(b);
    const site = lastState?.site;
    if (site?.file) { // his own website
      const w = el('button', null, 'tile wide');
      w.type = 'button';
      w.append(el('span', '🌐', 'ticon'), el('b', `His website: ${site.title}`), el('small', `version ${site.v} ›`));
      w.addEventListener('click', openSite);
      box.append(w);
    }
    tiles.append(el('h2', 'What he made'), box);
  }
  $('stillempty').textContent = emptyNames.length ? `Still empty: ${emptyNames.join(', ')}.` : '';
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
// While he is out, a little sign in the room says where he is (and the "now" line follows him: on his way, there, on his way home).
let awaySaid = '';
function tickAway() {
  const a = awayWords();
  const said = a ? `${a[0]} Pip is out: ${a[1][0].toLowerCase()}${a[1].slice(1)}. Home around ${a[2]}.` : ''; // (only the first letter is made small: a name further on keeps its capital)
  if (said === awaySaid) return;
  awaySaid = said;
  $('away').hidden = !a;
  $('away').textContent = said;
  renderNow();
}
$('away').addEventListener('click', () => toPip()); // "Pip is out": go to where he is
setInterval(() => {
  tickPlan();
  tickOutside();
  tickAway();
  town.update(lastState, Date.now(), forceLook.hour);
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
      refreshPrivate();
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
    const shot = angled(photoCamera(String(spec.target || 'room')), spec.camera);
    renderer.setSize(960, 720, false);
    camera.aspect = 960 / 720;
    camera.fov = shot.fov;
    camera.near = 0.15;
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
// The angle Pip chose: close (nearer), wide (further back, wider lens), low (from near the floor) or high (from above).
function angled(shot, camera) {
  const s = { from: shot.from.clone(), to: shot.to.clone(), fov: shot.fov };
  if (camera === 'close') s.from.lerp(s.to, 0.45);
  if (camera === 'wide') { s.from.addScaledVector(s.from.clone().sub(s.to).normalize(), 1.2); s.fov = Math.min(75, s.fov + 12); }
  if (camera === 'low') s.from.y = 0.45;
  if (camera === 'high') s.from.y += 1.3;
  s.from.x = Math.max(-4.7, Math.min(s.from.x, 8.2));
  s.from.z = Math.max(-4.7, Math.min(s.from.z, 4.9));
  s.from.y = Math.max(0.3, Math.min(s.from.y, 4.6));
  return s;
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

// ---------------------------------------------------------------- always first person, and a little map to find Pip
// You are always in his world, on your own two feet: there is no view from above any more. You start in the street in
// front of his house. The little round map in the corner shows only where Pip is: a circle for him, a small arrow in the
// middle for you. A tap on it takes you to him. (?overview=1 keeps the old view from above, for checks.)
const FIRST = !PHOTO && !new URLSearchParams(location.search).has('overview');
const mini = $('minimap');
function toPip() {
  const p = pip.group.position;
  // a free place to stand a few steps from him, with nothing between you and him (not behind his wardrobe): in front of
  // him first, then around him; if there is no such place, the nearest free one
  const spots = [];
  for (const far of [2.8, 3.6, 2.0, 4.6]) for (const a of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2, Math.PI]) spots.push([p.x + Math.sin(a) * far, p.z + Math.cos(a) * far, far]);
  const sameRoom = (x) => inTown(p.x) === inTown(x) && (inTown(p.x) || roomOf(x) === roomOf(p.x)); // not in the hall while he is in his bedroom
  const free = spots.filter(([x, z]) => sameRoom(x) && !blocked(x, z) && !blocked(x + 0.3, z) && !blocked(x - 0.3, z) && !blocked(x, z + 0.3) && !blocked(x, z - 0.3));
  const clear = ([x, z, far]) => { for (let d = 0.3; d < far - 1.1; d += 0.3) if (blocked(x + ((p.x - x) * d) / far, z + ((p.z - z) * d) / far)) return false; return true; };
  const pick = free.find(clear) ?? free[0];
  if (pick) Object.assign(view, { x: pick[0], z: pick[1], yaw: Math.atan2(pick[0] - p.x, pick[1] - p.z), pitch: -0.2 });
}
function drawMini() {
  if (mini.hidden) return;
  const g = mini.getContext('2d');
  const W = mini.width, R = W / 2;
  // where someone is in the world: out there as they are, inside his house at his house
  const at = (x, z) => (inTown(x) ? [x - TOWN_X, z] : [0, -3.7]);
  const me = view.mode === 'walk' ? at(view.x, view.z) : [0, 4];
  const p = at(pip.group.position.x, pip.group.position.z);
  const k = (R - 16) / 60; // the edge of the map is 60 m away
  g.clearRect(0, 0, W, W);
  g.fillStyle = 'rgba(255,250,243,.9)'; g.beginPath(); g.arc(R, R, R - 3, 0, 7); g.fill();
  g.strokeStyle = 'rgba(59,47,42,.18)'; g.lineWidth = 2; g.beginPath(); g.arc(R, R, (R - 16) / 2, 0, 7); g.stroke();
  // Pip: a little circle. When he is further away than the map reaches, it waits at the edge on the side where he is.
  let dx = (p[0] - me[0]) * k, dz = (p[1] - me[1]) * k;
  const far = Math.hypot(dx, dz);
  if (far > R - 16) { dx *= (R - 16) / far; dz *= (R - 16) / far; }
  const beat = 1 + Math.sin(performance.now() / 300) * 0.2;
  g.fillStyle = 'rgba(233,133,91,.3)'; g.beginPath(); g.arc(R + dx, R + dz, 17 * beat, 0, 7); g.fill();
  g.fillStyle = '#e9855b'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(R + dx, R + dz, 10, 0, 7); g.fill(); g.stroke();
  if (view.mode === 'walk') { // you: a small arrow in the middle that points where you look
    g.save(); g.translate(R, R); g.rotate(-view.yaw);
    g.fillStyle = '#3b2f2a'; g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4.5); g.lineTo(-8, 9); g.closePath(); g.fill(); g.restore();
  }
}
// ---- Every building and place in the world can be opened (F or a tap): its card says what Pip can do there, and what
// he did there so far. The words come from the places of his world (web/world.js) and from his state.
const WORLD_CARDS = {
  museum: { title: 'Pip’s museum', icon: '🏛️', what: 'An open hall with forty plinths. The things he made stand here, so everyone can walk up to them. Tap a thing to read what it is and why he made it.', place: 'museum', can: ['carry a thing here from his room or his chest', 'walk past his things and look at them', 'dust the plinths'] },
  home: { title: 'Pip’s home', icon: '🏠', what: 'He lives here, and it is his workshop too: small things he makes at home. Walk in through the red door.', can: ['make things at his own bench', 'sleep, eat and cook', 'work at his computer', 'play his instruments'] },
  shop: { title: 'The grocery store', icon: '🛒', what: 'There is no money in his world. He walks here and takes home what he needs: food, seeds, things to make with.', place: 'shop', can: ['fetch food to cook and bake with', 'fetch seeds, things to make with, a tool'] },
  flats: { title: 'The flats', icon: '🏢', what: 'People of the town live here. Downstairs a shop stands empty.', can: [], none: 'Nothing yet. Pip could wish for something to move in.' },
  cafe: { title: 'The internet café', icon: '💻', what: 'Where he goes to look things up and read on the web. The screen in the window shows the last thing he read, and what he thought of it.', can: ['search the web', 'browse until he stumbles on something', 'say what he really thinks of what he read'] },
  build: { title: 'The build workshop', icon: '🔨', what: 'For what does not fit in his own workshop at home: the things he builds to use outside (a bike, a kite, a boat) and the big things for his field.', can: ['build something to ride, fly or sail', 'build something big for outside'] },
  land: { title: 'The land workshop', icon: '⛰️', what: 'The land tools are kept here. With them he shapes the ground of his world.', place: 'land', can: ['make a hill', 'dig a hole', 'make the ground flat again'] },
  library: { title: 'The library', icon: '📚', place: 'library' },
  workshop: { title: 'The print workshop', icon: '🖨️', place: 'workshop', can: ['design a small 3D model and have it printed'] },
  shelf: { title: 'His shelf of prints', icon: '🖨️', what: 'Everything he printed stands here.', place: 'workshop', can: ['design a small 3D model and have it printed'] },
  studio: { title: 'The art workshop', icon: '🎨', what: 'Every drawing he ever made hangs on its outside walls, so nothing is lost when a wall is painted over.', can: [], none: 'It keeps his art. He does not have to do anything for that.' },
  board: { title: 'The notice board', icon: '📌', what: 'People pin up what goes on in the village: a kite day, somebody on a unicycle, a chess board left on a bench. Nobody asks Pip for anything here. He reads it, and sometimes it gives him an idea.', place: 'board', can: ['read what people in the village are up to', 'get an idea from it, or not'] },
  pond: { title: 'The pond', icon: '🦆', place: 'pond' },
  square: { title: 'The square', icon: '⛲', what: 'The middle of the village. The notice board stands here, and everyone crosses it.', can: ['walk across it to everything', 'read the notice board'] },
  plot: { title: 'Pip’s land', icon: '🌱', what: 'A big free field of his own, beside the square. It is his to fill.', can: ['build things here, also big ones', 'make hills and holes', 'ask for a new building'] },
  stone: { title: 'The green stone', icon: '💎', what: 'It glows a little at night. Nobody knows who put it there.', can: [], none: 'Nothing. He can build next to it.' },
};
// Small deeds: one small thing a visitor can do at a place, for Pip to find later (api/deed.js, strangers.js).
const DEED_AT = { flower: 'home', apple: 'shop', boat: 'pond', doodle: 'board', hat: 'stone', bookmark: 'library', chalk: 'square' };
const DEED_LABEL = { flower: '🌼 Leave a flower on his doorstep', apple: '🍎 Leave an apple by the door', boat: '⛵ Put a paper boat on the pond', doodle: '✏️ Pin a doodle on the board', hat: '🎩 Put a tiny hat on the stone', bookmark: '🔖 Leave a bookmark in a book', chalk: '🟨 Draw hopscotch on the square' };
async function doDeed(deed, bt) {
  bt.disabled = true;
  try {
    const res = await fetch('/api/deed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deed, since: Date.now() - pageOpenedAt, website: '' }) });
    const out = await res.json().catch(() => ({}));
    if (res.ok) toast('Done. Pip will find it when he wakes up and looks around. 🤫');
    else { toast(res.status === 404 ? 'This only works on the live site.' : out.error || 'That did not work. Try again later.'); bt.disabled = false; }
  } catch { toast('That did not work. Try again later.'); bt.disabled = false; }
}
// Everything he made or did through a building, the newest first, as tiles for the grid on its card: a picture where
// there is one (his drawings, his prints, the things he built), otherwise a sign and a few words.
function madeAt(key, s) {
  const newest = (list, at) => [...list].sort((a, b) => Date.parse(at(b) ?? 0) - Date.parse(at(a) ?? 0));
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
  if (key === 'studio') return newest(s.gallery ?? s.art ?? [], (a) => a.at ?? a.createdAt).filter((a) => a.file).map((a) => ({ img: a.file, label: a.name, sub: a.wall ? 'painted on a wall' : day(a.at ?? a.createdAt) }));
  if (key === 'workshop') return newest(s.prints ?? [], (p) => p.at).filter((p) => Array.isArray(p.parts) && p.parts.length).map((p) => ({ img: decorThumb({ id: `print-${p.id}`, name: p.name, parts: p.parts, at: p.at }), icon: '🖨️', label: p.name, sub: day(p.at) }));
  if (key === 'build') return newest([...(s.decor ?? []).filter((d) => !d.image && Array.isArray(d.parts) && d.parts.length).map((d) => ({ d, where: d.kind === 'outside' ? (d.readyAt && Date.now() < Date.parse(d.readyAt) ? 'being built outside' : 'stands outside') : 'in his room' })), ...(s.stored ?? []).filter((d) => !d.image && Array.isArray(d.parts) && d.parts.length).map((d) => ({ d, where: 'in his chest' }))], (x) => x.d.createdAt ?? x.d.at).map(({ d, where }) => ({ img: decorThumb(d), icon: '🔨', label: d.name, sub: where }));
  if (key === 'land') return newest(s.land ?? [], (l) => l.at).map((l) => ({ icon: l.kind === 'hole' ? '🕳️' : '⛰️', label: l.name, sub: `${2 * l.r} m wide, ${l.h} m ${l.kind === 'hole' ? 'deep' : 'high'}` }));
  if (key === 'cafe') return newest((s.log ?? []).filter((e) => ['search_web', 'browse'].includes(e.action) && !e.failed && (e.query || e.opened?.title)), (e) => e.at).map((e) => ({ icon: e.opinion ? OPINION_FACES[e.opinion.how] ?? '🔎' : '🔎', label: e.query || e.opened.title, sub: e.opinion?.says ?? day(e.at) }));
  if (key === 'library') return newest([...(s.log ?? []).filter((e) => e.action === 'read_book' && !e.failed && (e.opened?.title || e.topic)).map((e) => ({ at: e.at, label: e.opened?.title || e.topic, sub: e.opinion?.says })), ...(s.outings ?? []).filter((o) => o.place === 'library' && o.read).map((o) => ({ at: o.homeAt, label: o.read }))], (x) => x.at).map((x) => ({ icon: '📖', label: x.label, sub: x.sub ?? day(x.at) }));
  if (key === 'shop') return newest(s.bought ?? [], (b) => b.at).map((b) => ({ icon: '🛒', label: b.item, sub: day(b.at) }));
  if (key === 'board') return [];
  return [];
}
function worldCard(kind, key) {
  const s = lastState || {};
  const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; };
  const wall = kind === 'wall' ? PAINT_WALLS.find((w) => w.key === key) : null;
  const c = wall ? { title: wall.name.replace(/^the /, 'The '), icon: '🎨', what: 'A bare wall for his art.', place: 'walls', can: ['paint something big on it (he needs no paper for that)'] } : WORLD_CARDS[key] ?? { title: key, icon: '📍', can: [] };
  const p = c.place ? worldPlace(c.place) : null;
  const can = c.can ?? (p?.things ?? []).map((t) => hisWords(p.key, t.words));
  const sections = [];
  if (c.what || p?.blurb) sections.push({ lines: [c.what ?? p.blurb] });
  sections.push({ heading: 'What Pip can do here', ...(can.length ? { chips: can } : { lines: [c.none ?? 'Nothing yet.'] }) });
  const so = [];
  const visits = p ? (s.outings ?? []).filter((o) => o.place === p.key && !o.errand) : [];
  if (key === 'home') so.push(awayNow() ? 'He is out right now.' : 'He is home right now.');
  if (key === 'shop') { const b = (s.bought ?? []).slice(-3).map((x) => x.item); so.push(b.length ? `Taken home lately: ${b.join(', ')}.` : 'He has not fetched anything here yet.'); }
  if (key === 'workshop' || key === 'shelf') { const pr = (s.prints ?? []); so.push(pr.length ? `He printed ${pr.length} thing${pr.length === 1 ? '' : 's'}: ${pr.slice(-5).map((x) => x.name).join(', ')}.` : 'He has not printed anything yet.'); }
  if (key === 'studio') { const n = (s.gallery ?? s.art ?? []).length; so.push(`${n} drawing${n === 1 ? '' : 's'} so far.`); }
  if (wall) { const on = (s.gallery ?? []).filter((a) => a.wall === wall.key); so.push(on.length ? `On it: ${on.slice(-4).map((a) => `“${a.name}”`).join(', ')}.` : 'Nothing is painted on it yet.'); }
  if (key === 'back' || BUILDINGS.some((b) => b.key === key)) { const on = (s.gallery ?? []).filter((a) => a.wall === `back_${key}`); if (on.length) so.push(`Painted on its back wall: ${on.slice(-3).map((a) => `“${a.name}”`).join(', ')}.`); }
  if (key === 'board') { const notes = (s.board ?? []).filter((n) => Date.now() - Date.parse(n.at) < 3 * 86_400_000).slice(-3).reverse(); if (notes.length) sections.push({ heading: 'Pinned on it now', lines: notes.map((n) => `📌 ${n.text}${n.seen ? '' : ' (Pip has not read this one yet)'}`) }); else so.push('Nothing is pinned on it right now.'); }
  if (key === 'cafe') so.push(s.site ? `🌐 His own website, “${s.site.title}”, is at version ${s.site.v}. Last worked on ${ago(s.site.updatedAt)}.` : 'He has no website of his own yet. He can make one here.');
  if (key === 'cafe') { const face = { love: '😍', like: '🙂', meh: '😐', dislike: '😒', doubt: '🤨' }; const reads = [...(s.log ?? [])].reverse().filter((e) => ['search_web', 'read_book', 'browse'].includes(e.action) && !e.failed && (e.query || e.opened?.title || e.topic)).slice(0, 4); if (reads.length) so.push(...reads.map((e) => `${e.action === 'search_web' ? '🔎' : '📖'} ${e.query || e.opened?.title || e.topic}${e.opinion ? ` ${face[e.opinion.how] ?? ''} “${e.opinion.says}”` : ''}`)); else so.push('He has not looked anything up yet.'); }
  if (key === 'land') { const l = s.land ?? []; so.push(l.length ? `He made ${l.filter((x) => x.kind !== 'hole').length} hill${l.filter((x) => x.kind !== 'hole').length === 1 ? '' : 's'} and ${l.filter((x) => x.kind === 'hole').length} hole${l.filter((x) => x.kind === 'hole').length === 1 ? '' : 's'}: ${l.slice(-4).map((x) => x.name).join(', ')}.` : 'He has not shaped the land yet. It is all flat.'); }
  if (['plot', 'flats'].includes(key)) { const wishes = (s.asks ?? []).filter((a) => a.status === 'open' && /^Dream:/i.test(a.item ?? '')).map((a) => String(a.item).replace(/^Dream:\s*/i, '')); if (wishes.length) so.push(`✨ Pip wishes for: ${wishes.slice(-3).join('; ')}. (You find his wishes under Asks.)`); }
  if (key === 'plot') { const mine = (s.decor ?? []).filter((d) => d.kind === 'outside' && (d.spot ?? 'plot') === 'plot'); so.push(mine.length ? `${mine.length} thing${mine.length === 1 ? '' : 's'} he made stand here.` : 'Nothing stands here yet.'); }
  if (visits.length) so.push(`He was here ${visits.length} time${visits.length === 1 ? '' : 's'}. Last: ${ago(visits.at(-1).homeAt)}.`, `“${visits.at(-1).did}”`);
  else if (p && !['shop', 'workshop', 'walls', 'board', 'land'].includes(p.key)) so.push('He has not been here yet.');
  if (so.length) sections.push({ heading: 'So far', lines: so });
  if (key === 'museum') { // what stands on the plinths
    const shown = madeItems(s).filter((x) => x.sub === 'in his museum').sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
    so.push(shown.length ? `${shown.length} of the 40 plinths ${shown.length === 1 ? 'has' : 'have'} something on ${shown.length === 1 ? 'it' : 'them'}.` : 'Every plinth is still empty.');
    if ((s.depot ?? []).length) so.push(`${s.depot.length} older thing${s.depot.length === 1 ? '' : 's'} moved to the depot to make room.`);
    if (shown.length) sections.push({ heading: `On the plinths (${shown.length})`, grid: shown });
  }
  if (key === 'library') { // the visitors' shelf: what lies on it, and how to leave something
    const shelf = (s.shelf ?? []).slice(-4).reverse();
    sections.push({ heading: 'The visitors’ shelf', lines: shelf.length ? shelf.map((p) => `${SHELF_WORD[p.kind]?.[0] ?? '📄'} ${p.title || SHELF_WORD[p.kind]?.[1]}${p.name ? ` (from ${p.name})` : ''}: ${p.opinion ? `Pip: “${p.opinion}”` : p.readAt ? 'he read it' : 'he has not read it yet'}`) : ['Empty. Leave Pip a poem, a short story or a book tip: he reads it when he comes here, and says what he thinks.'], buttons: [{ label: '✍️ Leave something on the shelf', run: () => { hideInfo(); talkMode = 'public'; showTab('messages'); setVisitKind('poem'); $('visittext').focus(); } }] });
  }
  if (key === 'cafe' && s.site?.file) sections.push({ heading: 'His website', buttons: [{ label: `🌐 Open “${s.site.title}”`, run: () => { hideInfo(); openSite(); } }] });
  const made = madeAt(kind === 'shelf' ? 'workshop' : key, s);
  if (made.length) sections.push({ heading: `Everything he made here (${made.length})`, grid: made });
  const deed = Object.entries(DEED_AT).find(([, at]) => at === key);
  if (deed) sections.push({ heading: 'What you can do here', lines: [(s.deeds ?? []).some((d) => d.deed === deed[0] && d.status === 'lying') ? 'Someone did this already. Pip has not found it yet.' : 'A small thing for Pip to find later. He does not know who did it.'], buttons: [{ label: `${DEED_LABEL[deed[0]]}`, run: (bt) => doDeed(deed[0], bt) }] });
  return { title: c.title, icon: c.icon, subtitle: 'In his world', sections };
}
for (const t of town.things) t.object.userData.info = () => worldCard(t.kind, t.key);

// ---- What he is doing right now, in short, at the bottom of the picture, with a bar that fills until he is done with it:
// walking somewhere, doing something there, walking home, or the step of his plan he is on.
function nowStatus() {
  const s = lastState;
  if (!s?.last) return null;
  if (s.last.sleeping) return { icon: '💤', text: 'Sleeping', k: null };
  const now = Date.now();
  const w = outWhere();
  if (w) {
    const [icon, text] = awayWords();
    if (w.site && now >= Date.parse(w.arriveAt)) return { icon, text, k: sitePart(w.site, now), left: Date.parse(w.site.readyAt) - now };
    const [a, b] = now < Date.parse(w.arriveAt) && !w.cut ? [w.leftAt, w.arriveAt] : now < Date.parse(w.leaveAt) ? [w.arriveAt, w.leaveAt] : [w.leaveAt, w.homeAt];
    return { icon, text, k: (now - Date.parse(a)) / Math.max(1, Date.parse(b) - Date.parse(a)), left: Date.parse(b) - now };
  }
  if (plan && stepNow >= 0 && now <= plan.at + plan.total + 60_000) {
    const t0 = plan.at + plan.starts[stepNow], len = plan.lengths[stepNow];
    const [icon, text] = headline(plan.steps[stepNow]);
    return { icon, text, k: (now - t0) / Math.max(1, len), left: t0 + len - now };
  }
  return { icon: '💭', text: 'Thinking about what to do next', k: null };
}
function showNowBar() {
  const st = nowStatus();
  $('nowbar').hidden = !st;
  if (!st) return;
  $('nowicon').textContent = st.icon;
  $('nowtext').textContent = st.text;
  const left = st.k === null ? null : Math.max(0, st.left);
  $('nowleft').textContent = left === null ? '' : left >= 90_000 ? `${Math.round(left / 60_000)} min` : left >= 1000 ? `${Math.max(1, Math.round(left / 1000))} s` : '';
  $('nowprog').classList.toggle('none', st.k === null);
  $('nowprog').firstChild.style.width = `${Math.round(Math.max(0, Math.min(1, st.k ?? 0)) * 1000) / 10}%`;
}

// ---- What Pip is reading: a box that floats over the picture, so it is always easy to read. It shows while he looks
// something up or reads, for a quarter of an hour after, and whenever you stand by the internet café: what he looked
// up, a piece of what he read (with a link to the page), and what he thinks of it. (The screen in the café's window
// shows the same, small.) The ✕ puts it away until he reads something new.
const READS = ['search_web', 'read_book', 'browse'];
const OPINION_FACES = { love: '😍', like: '🙂', meh: '😐', dislike: '😒', doubt: '🤨' };
let readingClosed = '';
let readingKey = '';
function readingNow() {
  const s = lastState;
  if (!s) return null;
  const now = Date.now();
  const log = [...(s.log ?? [])].reverse();
  let live = null;
  if (plan && stepNow >= 0 && !s.last?.sleeping) {
    const st = plan.steps[stepNow], t0 = plan.at + plan.starts[stepNow], len = plan.lengths[stepNow];
    if (st && READS.includes(st.action) && !st.failed && now >= t0 && now <= t0 + len) live = { st, k: (now - t0) / Math.max(1, len) };
  }
  const e = (live ? log.find((x) => x.action === live.st.action && now - Date.parse(x.at) < 40 * 60_000) : null) ?? (live ? null : log.find((x) => READS.includes(x.action) && !x.failed && (x.query || x.opened?.title || x.topic)));
  if (!e && !live) return null;
  const near = view.mode === 'walk' && inTown(view.x) && Math.hypot(view.x - TOWN_X - TOWN_SPOTS.cafe.x, view.z - TOWN_SPOTS.cafe.z) < 16;
  const fresh = e && now - Date.parse(e.at) < 15 * 60_000;
  return live || near || fresh ? { e, live } : null;
}
function showReading() {
  const r = readingNow();
  const box = $('reading');
  const id = r ? `${r.e?.at ?? ''}${r.live ? r.live.st.action : ''}` : '';
  if (!r || id === readingClosed) { box.hidden = true; readingKey = ''; return; }
  const { e, live } = r;
  const what = e?.query ? `“${e.query}”` : e?.opened?.title || e?.topic || (live ? `“${live.st.details?.query ?? live.st.details?.topic ?? '…'}”` : '');
  const typing = live && live.k < 0.3 && live.st.action === 'search_web';
  const m = e ? Math.round((Date.now() - Date.parse(e.at)) / 60000) : 0;
  const ago = m < 2 ? 'just now' : m < 90 ? `${m} minutes ago` : m < 2880 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`;
  const head = live ? (typing ? '🔎 Pip is searching the web right now' : live.st.action === 'browse' ? '💻 Pip is browsing right now' : '📖 Pip is reading right now') : `💻 The last thing Pip ${e.action === 'search_web' ? 'looked up' : e.action === 'browse' ? 'came across' : 'read'} (${ago})`;
  const text = typing ? 'He is typing his question…' : e?.opened?.text ? (e.opened.text.length > 240 ? `${e.opened.text.slice(0, 240).replace(/\s+\S*$/, '')} …` : e.opened.text) : live ? 'The page is loading…' : 'He found nothing to read about it.';
  const opinion = e?.opinion?.says ? `${OPINION_FACES[e.opinion.how] ?? '💭'} Pip: “${e.opinion.says}”` : live ? 'What he thinks of it comes when he is done reading.' : 'He has not said what he thinks of it yet.';
  const key = [id, head, what, text, opinion].join('|');
  box.hidden = false;
  if (key === readingKey) return; // (not drawn again every half second: the link stays clickable)
  readingKey = key;
  $('rhead').textContent = head;
  $('rtitle').textContent = what;
  const body = $('rtext');
  body.replaceChildren(document.createTextNode(`${text} `));
  if (!typing && e?.opened?.url) body.append(link(e.opened.url, 'Open the page'));
  $('rop').textContent = opinion;
  $('rop').classList.toggle('none', !e?.opinion?.says);
  $('readingx').onclick = () => { readingClosed = id; box.hidden = true; };
}

// ---- Interact. What is in the middle of your view and close by can be opened: a small prompt says what it is, and F
// (or a tap on the prompt) opens it. At his front door F takes you in or out. While a card is open, F closes it.
// You have to be close to use something: within USE metres outside, less inside his house (the rooms are small). A bit
// further off the prompt still names it, greyed out, and says to walk closer. Further than that: nothing.
const USE = { out: 7, in: 4 }, SEE = { out: 20, in: 9 };
const useRange = () => (inTown(view.x) ? USE.out : USE.in);
const seeRange = () => (inTown(view.x) ? SEE.out : SEE.in);
function howFar(hit) { // from your eyes to what you look at or tapped
  const at = hit.anchor?.getWorldPosition ? hit.anchor.getWorldPosition(new V3()) : null;
  return hit.dist ?? (at ? Math.hypot(at.x - view.x, at.z - view.z) : 99);
}
// Opens what you tapped or clicked, when you stand close enough to it. Too far: a short line says so.
function openIfNear(hit) {
  if (!hit) return hideInfo();
  if (FIRST && view.mode === 'walk' && hit.info?.title && howFar(hit) > useRange()) { hideInfo(); return toast(`Walk closer to open “${hit.info.title}”.`); }
  showInfo(hit.info, hit.anchor);
}
const prompt = $('interact');
function lookingAt() {
  if (view.mode !== 'walk' || !$('start').hidden) return null;
  if (!infoBox.hidden) return { kind: 'close', label: 'Close' };
  const fz = -Math.cos(view.yaw); // below -0.5: you look toward the door (it is on the far side from the camera's start, both inside and out)
  if (!inTown(view.x) && Math.abs(view.x - SPOTS.hall_door.p.x) < 1.3 && view.z < -2.4 && fz < -0.5) return { kind: 'door', to: 'out', label: 'Go outside' };
  if (inTown(view.x) && Math.abs(view.x - TOWN_X) < 1.6 && view.z > 0 && view.z < 3.6 && fz < -0.5) return { kind: 'door', to: 'in', label: 'Go into Pip’s home' };
  const r = dom.getBoundingClientRect();
  const hit = pickAt(r.left + r.width / 2, r.top + r.height / 2);
  if (!hit?.info?.title) return null;
  const far = howFar(hit);
  if (far <= useRange()) return { kind: 'info', hit, label: hit.info.title };
  return far <= seeRange() ? { kind: 'far', hit, label: `${hit.info.title} · walk closer` } : null; // in sight, out of reach: it says so
}
function interact() {
  const f = lookingAt();
  if (!f) return;
  if (f.kind === 'far') return; // not in reach yet
  if (f.kind === 'close') hideInfo();
  else if (f.kind === 'door') Object.assign(view, f.to === 'out' ? { x: TOWN_X, z: 1.6, yaw: Math.PI, pitch: 0 } : { x: SPOTS.hall_door.p.x, z: -3.7, yaw: Math.PI, pitch: 0 });
  else showInfo(f.hit.info, f.hit.anchor);
  showPrompt();
}
function showPrompt() {
  const f = FIRST ? lookingAt() : null;
  prompt.hidden = !f;
  prompt.classList.toggle('far', f?.kind === 'far');
  prompt.disabled = f?.kind === 'far';
  if (f) prompt.lastChild.textContent = f.label;
}
prompt.addEventListener('click', interact);
if (FIRST) {
  setInterval(showPrompt, 220);
  setInterval(showNowBar, 500);
  setInterval(showReading, 500);
  if (!store('pip-start')) startScreen(true);
  document.body.classList.add('first');
  mini.hidden = false;
  $('hud').hidden = false;
  portalReady = true;
  setMode('walk');
  Object.assign(view, { x: TOWN_X + 2.6, z: 8.8, yaw: 0.28, pitch: 0.04 }); // in the street, looking at his house
  mini.addEventListener('click', toPip);
  setInterval(drawMini, 200);
  drawMini();
}

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
window.pipView = view; // for testing: where the walking viewer stands
window.pipSound = () => (snd.ready ? { wind: +snd.wind.gain.value.toFixed(3), rain: +snd.rain.gain.value.toFixed(3), pip: +snd.pip.gain.value.toFixed(2), radio: +snd.radio.gain.value.toFixed(2), playing: radio.name } : null); // for testing: how loud the world is where you stand
window.pipRadio = () => showInfo(radioSet.userData.info());
window.pipCard = (kind, key) => showInfo(worldCard(kind, key)); // for testing: the card of a place in his world
window.pipPlaying = () => (playingId ? { id: playingId, at: playGroups.get(playingId).g.position.toArray().map((n) => Math.round(n * 10) / 10), pip: pip.group.position.toArray().map((n) => Math.round(n * 10) / 10) } : null); // for testing: where his plaything is right now
window.pipLook = () => { const f = lookingAt(); return f ? { kind: f.kind, label: f.label, far: f.hit ? Math.round(howFar(f.hit) * 10) / 10 : null } : null; }; // for testing: what the F prompt would say right now
window.pipInfo = () => {
  lampsAt = 0; lampBudget(performance.now(), 10); // for testing: what one frame costs (draw calls, triangles, lights that are on)
  const lights = {}; let meshes = 0, shadowCasters = 0;
  scene.traverseVisible((o) => { if (o.isLight && o.layers.mask === 1) lights[o.type] = (lights[o.type] ?? 0) + 1; if (o.isMesh) { meshes++; if (o.castShadow) shadowCasters++; } });
  return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs?.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, lights, meshes, shadowCasters, pixelRatio: renderer.getPixelRatio(), size: [renderer.domElement.width, renderer.domElement.height], shadows: renderer.shadowMap.enabled };
};
window.pipLights = () => { const out = []; scene.traverse((o) => { if (!o.isLight) return; let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false; const w = o.getWorldPosition(new THREE.Vector3()); out.push({ type: o.type.replace('Light', ''), vis, i: +o.intensity.toFixed(2), dist: o.distance, at: w.toArray().map((n) => Math.round(n)), shadow: o.castShadow, map: o.shadow?.mapSize?.x, name: o.name || o.parent?.name || o.parent?.userData?.name || '' }); }); return out; };
window.pipEye = () => camera.position.toArray(); // for testing: where the eye is (the bobbing of the view)
window.pipAt = () => ({ x: Math.round((pip.group.position.x - (inTown(pip.group.position.x) ? TOWN_X : 0)) * 10) / 10, z: Math.round(pip.group.position.z * 10) / 10, out: inTown(pip.group.position.x), shown: pip.group.visible }); // for testing: where Pip is
window.pipCam = () => ({ fit: orbit.fit, goal: fitGoal, zoom: orbit.zoom, px: orbit.px, pz: orbit.pz, focusX, name: focusName(), aspect: camera.aspect, pos: camera.position.toArray().map((v) => Math.round(v)) }); // for testing: how the overview looks at things
window.pipStep = (n, dt = 0.05) => { for (let i = 0; i < n; i++) updateBehaviors(performance.now() + i * dt * 1000, dt); }; // for testing without a visible page
let tickClock = 0;
window.pipTick = (n, dt = 0.05) => { tickClock ||= performance.now(); for (let i = 0; i < n; i++) { tickClock += dt * 1000; frame(tickClock, dt); updateBehaviors(tickClock, dt); } return tickClock; }; // for testing: run n frames by hand
window.pipPose = () => ({ rot: [pip.body.rotation.x, pip.body.rotation.y, pip.body.rotation.z].map((v) => +v.toFixed(2)), y: +pip.body.position.y.toFixed(2), at: [pip.group.position.x, pip.group.position.z].map((v) => +v.toFixed(2)), idle: task?.idle?.move?.id ?? null, anim: task?.anim });
window.pipRun = (id, does, motion) => { runBehavior(id, does, motion); return behaviors.get(id) ? { legs: behaviors.get(id).legs?.length ?? 0 } : null; };
window.pipBeh = behaviors;
window.pipFrame = (cam) => { if (cam) { camera.position.set(...cam.p); camera.lookAt(...cam.t); } renderer.render(scene, camera); }; // for testing: draw one frame by hand
window.pipDo = (last) => startTask({ at: String(Date.now()), thought: '(test)', details: {}, ...last });
window.__debug = { pip, getTask: () => task, decorGroups, view, setMode, pickAt, camera, openApp, playSong, getAudio: () => audio, getMaster: () => master };

// ?az=0.8&el=0.1&zoom=0.6 or ?look=x,z,yaw,pitch (walk mode) start from another side (for checking the window)
{
  const p = new URLSearchParams(location.search);
  fx = applyLook(p.get('fx') || 'full', { THREE, renderer, scene, camera, hemi, sun, lamp, G, decorGroups, land });
  if (p.has('tab')) showTab(p.get('tab')); // ?tab=life&open=pantry opens a tab (for checking)
  if (p.has('info')) setTimeout(() => { const w = p.get('info'); if (w === 'pip') showInfo(pipInfo()); else { const d = (lastState?.decor || []).find((x) => x.name.toLowerCase().includes(w)); if (d) showInfo(decorInfo(d)); else { const r = REGIONS.find((x) => x.info().title.toLowerCase().includes(w)); if (r) showInfo(r.info()); } } }, 8000); // ?info=pip or ?info=greenhouse opens a card (for checking)
  if (p.has('open')) setTimeout(() => openLife(p.get('open')), 2500);
  if (p.has('look')) {
    const [x, z, yaw, pitch] = p.get('look').split(',').map(Number);
    setMode('walk');
    Object.assign(view, { x, z, yaw, pitch });
  } else if (p.has('az') || p.has('el') || p.has('zoom')) {
    Object.assign(orbit, { az: Number(p.get('az') || 0), el: Number(p.get('el') || 0), zoom: Number(p.get('zoom') || 1) });
    applyOrbit();
  }
}

// ---- Pip's phone (a gift): Lights (names, on/off, colour in warm or RGB mode, dim in steps, timers), Timers, and his apps.
// Everyone can look. With the key, Bas can change things too: they show here at once and reach Pip at his next wake-up.
let phoneAt = 'home';
let phoneLamp = null;
const phoneKey = () => store('pip-key') || '';
function phoneOpen(open) {
  $('phone').hidden = !open;
  if (open) renderPhone(lastState);
}
$('phonebtn').addEventListener('click', () => phoneOpen($('phone').hidden));
$('phclose').addEventListener('click', () => phoneOpen(false));
$('phone').addEventListener('click', (e) => { if (e.target === $('phone')) phoneOpen(false); }); // a tap next to the phone closes it
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('phone').hidden) phoneOpen(false); });
async function phoneSend(cmd) {
  if (!phoneKey()) { toast('Add your key in Settings (⚙) to change his lights.'); return; }
  const r = applyLight(lastState, cmd, { who: 'Bas' }); // shown at once; Pip gets it at his next wake-up
  if (r.failed) { toast(r.failed); return; }
  for (const d of lampsOf(lastState)) { const g = decorGroups.get(d.id); if (g) setLit(g, litOf(d), d); }
  syncFixedLamps(lastState);
  renderPhone(lastState);
  try {
    const res = await fetch('/api/lights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: phoneKey(), cmd }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'It did not save.');
    toast('Saved. Pip sees it at his next wake-up.');
  } catch (e) { toast(e.message); }
}
function phoneHead(title, sub, back) {
  const hd = el('div', null, 'ph-hd');
  if (back) { const b = el('button', '‹'); b.type = 'button'; b.setAttribute('aria-label', 'Back'); b.addEventListener('click', () => { phoneAt = back; renderPhone(lastState); }); hd.append(b); }
  const t = el('div'); t.append(el('b', title)); if (sub) t.append(el('small', sub)); hd.append(t);
  return hd;
}
function renderPhone(s) {
  $('phonebtn').hidden = !s?.phone;
  if (!s?.phone || $('phone').hidden) return;
  $('phclock').textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' });
  const v = $('phview');
  v.textContent = '';
  const screen = v.parentElement;
  screen.classList.toggle('home', phoneAt === 'home');
  const lamps = lampsOf(s);
  const canEdit = Boolean(phoneKey());
  if (String(phoneAt).startsWith('app:')) { // one of his apps, running right on the phone (in the same locked box as the big view)
    const a = (s.apps || []).find((x) => x.id === phoneAt.slice(4));
    if (!a) { phoneAt = 'home'; return renderPhone(s); }
    const l = appLook(a);
    screen.classList.add('appmode');
    const hd = phoneHead(`${l.icon} ${l.title}`, a.v ? `version ${a.v}` : 'made by Pip', 'home');
    const big = el('button', '⤢'); big.type = 'button'; big.title = 'Full screen'; big.setAttribute('aria-label', 'Full screen');
    big.addEventListener('click', () => { $('phone').hidden = true; openApp(a); });
    hd.append(big);
    const fr = document.createElement('iframe');
    fr.className = 'ph-appframe'; fr.setAttribute('sandbox', 'allow-scripts'); fr.setAttribute('referrerpolicy', 'no-referrer'); fr.title = l.title;
    v.append(hd, fr);
    fetch(`${a.file}?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text()).then((html) => { const z = Math.min(1, Math.max(0.45, (fr.clientWidth || 300) / 480)); fr.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${APP_CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{zoom:${z.toFixed(2)}}</style>${html}`; /* made for a big screen: shrunk to fit the phone */ }).catch(() => v.append(el('p', 'I could not open that app.', 'ph-note')));
    return;
  }
  screen.classList.remove('appmode');
  if (phoneAt === 'home') {
    const grid = el('div', null, 'ph-grid');
    const app = (icon, bg, name, go) => { const b = el('button', null, 'ph-app'); b.type = 'button'; const ic = el('div', icon, 'ph-ic'); ic.style.background = bg; b.append(ic, el('div', name)); b.addEventListener('click', go); grid.append(b); };
    app('💡', '#ffd46b', 'Lights', () => { phoneAt = 'lights'; renderPhone(lastState); });
    app('⏰', '#9fd3c7', 'Timers', () => { phoneAt = 'timers'; renderPhone(lastState); });
    (s.apps || []).forEach((a) => { const l = appLook(a); app(l.icon, l.bg, l.title, () => { phoneAt = `app:${a.id}`; renderPhone(lastState); }); });
    v.append(grid);
    if (!(s.apps || []).length) v.append(el('p', 'Apps Pip writes himself show up here too.', 'ph-note'));
    return;
  }
  if (phoneAt === 'lights') {
    v.append(phoneHead('💡 Lights', `${lamps.length} lamp${lamps.length === 1 ? '' : 's'} · ${lamps.filter((e) => lampNow(e).on).length} on`, 'home'));
    // a tip: a place he uses is dark, and a lamp is right there and off
    for (const w of ['bed', 'desk', 'bookshelf']) {
      const p = placeFor(s, w);
      if (!p) continue;
      const lv = lightAt(s, p.x, p.z).level;
      const off = lv < 0.2 && lamps.find((e) => e.pos && !lampNow(e).on && Math.hypot(e.pos[0] - p.x, e.pos[2] - p.z) <= 3);
      if (off) { const tip = el('div', null, 'ph-tip'); tip.append(`🌙 The ${w} is dark (${Math.round(lv * 100)}%). `, el('b', lampName(off)), ' could help.'); v.append(tip); break; }
    }
    if (!lamps.length) v.append(el('p', 'No lamps yet. When Pip makes a lamp (a glowing part and a use that gives light), it shows up here.', 'ph-note'));
    for (const e of lamps) {
      const st = lampNow(e);
      const row = el('button', null, 'ph-lamp');
      row.type = 'button';
      const bulb = el('div', null, `ph-bulb${st.on ? ' on' : ''}`);
      if (st.on) { bulb.style.background = st.color; bulb.style.opacity = String(0.4 + 0.6 * st.level / 100); }
      const ln = el('div', null, 'ph-ln');
      const extra = e.auto === 'dark' ? 'on when dark' : (e.timers || []).length ? `⏰ ${timerWords(e.timers[0])}` : (e.label || '').replace(/ \(.*\)$/, '');
      ln.append(el('b', lampName(e)), el('small', `${e.nick ? `${e.name} · ` : ''}${st.on ? `${st.level}%` : 'off'} · ${extra}`));
      const tog = el('button', null, `ph-tog${st.on ? ' y' : ''}`);
      tog.type = 'button';
      tog.disabled = !canEdit;
      tog.setAttribute('aria-label', st.on ? 'Turn off' : 'Turn on');
      tog.addEventListener('click', (ev) => { ev.stopPropagation(); phoneSend({ lamp: e.id, switch: st.on ? 'off' : 'on' }); });
      row.append(bulb, ln, tog);
      row.addEventListener('click', () => { phoneAt = 'lamp'; phoneLamp = e.id; renderPhone(lastState); });
      v.append(row);
    }
    const last = lamps.filter((e) => e.lightBy).sort((a, b) => b.lightBy.at.localeCompare(a.lightBy.at))[0];
    if (last) v.append(el('p', `Last: ${last.lightBy.who} ${last.lightBy.what} (${lampName(last)}), ${when(last.lightBy.at)}`, 'ph-note'));
    if (!canEdit) v.append(el('p', '🔒 You can look. With the key you can switch them too.', 'ph-note'));
    return;
  }
  if (phoneAt === 'lamp') {
    const e = lamps.find((x) => x.id === phoneLamp);
    if (!e) { phoneAt = 'lights'; renderPhone(s); return; }
    const st = lampNow(e);
    v.append(phoneHead(lampName(e), `${e.nick ? `${e.name} · ` : ''}${(e.label || '').replace(/ \(.*\)$/, '')}`, 'lights'));
    const send = (cmd) => phoneSend({ lamp: e.id, ...cmd });
    const pill = (label, sel, go) => { const b = el('button', label, `ph-pill${sel ? ' sel' : ''}`); b.type = 'button'; b.disabled = !canEdit; b.addEventListener('click', go); return b; };
    v.append(el('div', 'Light', 'ph-sec'));
    const onoff = el('div', null, 'ph-steps'); // on/off and the 4 dim steps on one row
    onoff.append(pill(st.on ? 'On' : 'Off', st.on, () => send({ switch: st.on ? 'off' : 'on' })), ...LEVELS.map((lv) => pill(`${lv}%`, st.on && st.level === lv, () => send({ level: lv }))));
    v.append(onoff);
    v.append(el('div', 'Colour', 'ph-sec'));
    const modes = el('div', null, 'ph-row');
    modes.append(pill('Warm', (e.mode ?? 'warm') === 'warm', () => send({ mode: 'warm' })), pill('RGB', e.mode === 'rgb', () => send({ mode: 'rgb' })));
    v.append(modes);
    const sw = el('div', null, 'ph-row');
    sw.style.marginTop = '8px';
    if (e.mode === 'rgb') {
      const pick = el('input');
      pick.type = 'color';
      pick.value = st.color;
      pick.disabled = !canEdit;
      pick.addEventListener('change', () => send({ color: pick.value }));
      sw.append(pick, el('small', st.color));
    } else for (const p of PRESETS) {
      const b = el('button', null, `ph-sw${st.color === p.hex ? ' sel' : ''}`);
      b.type = 'button'; b.title = p.key; b.style.background = p.hex; b.disabled = !canEdit;
      b.addEventListener('click', () => send({ color: p.key }));
      sw.append(b);
    }
    v.append(sw);
    v.append(el('div', 'Timers', 'ph-sec'));
    if (e.auto === 'dark') { const row = el('div', null, 'ph-timer'); row.append(el('span', '🌑 On when it is dark'), el('small', 'by itself')); v.append(row); }
    for (const tm of e.timers || []) {
      const row = el('div', null, 'ph-timer');
      row.append(el('span', `${tm.do === 'on' ? '🌅' : tm.do === 'off' ? '🌙' : tm.do === 'dim' ? '🔅' : '🎨'} ${timerWords(tm)}`), el('small', tm.by === 'Bas' ? 'by Bas' : 'by Pip'));
      if (canEdit) { const x = el('button', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Remove this timer'); x.addEventListener('click', () => send({ remove_timer: tm.id })); row.append(x); }
      v.append(row);
    }
    if (!e.auto && !(e.timers || []).length) v.append(el('p', 'No timers yet.', 'ph-note'));
    if (canEdit) {
      const f = el('form', null, 'ph-form');
      const time = el('input'); time.type = 'time'; time.value = '21:00'; time.required = true;
      const what = el('select');
      for (const [val, label] of [['on', 'On'], ['off', 'Off'], ['dim', 'Dim'], ['color', 'Colour'], ['dark', 'On when dark']]) { const o = el('option', label); o.value = val; what.append(o); }
      const lvl = el('select'); for (const lv of LEVELS) { const o = el('option', `${lv}%`); o.value = String(lv); lvl.append(o); }
      const col = el('select'); for (const p of PRESETS) { const o = el('option', p.key); o.value = p.key; col.append(o); }
      const sync = () => { lvl.hidden = what.value !== 'dim'; col.hidden = what.value !== 'color'; time.hidden = what.value === 'dark'; };
      what.addEventListener('change', sync); sync();
      const add = el('button', '+ Add', 'ph-pill'); add.type = 'submit';
      f.append(time, what, lvl, col, add);
      f.addEventListener('submit', (ev) => { ev.preventDefault(); send({ timer: { at: time.value, do: what.value, level: lvl.value, color: col.value } }); });
      v.append(f);
      const rename = el('form', null, 'ph-form');
      const nm = el('input'); nm.placeholder = 'Give it a name'; nm.maxLength = 30; nm.value = e.nick || '';
      const ok = el('button', 'Rename', 'ph-pill'); ok.type = 'submit';
      rename.append(nm, ok);
      rename.addEventListener('submit', (ev) => { ev.preventDefault(); if (nm.value.trim()) send({ name: nm.value.trim() }); });
      v.append(rename);
    } else v.append(el('p', '🔒 You can look. With the key you can change it too.', 'ph-note'));
    if (e.lightBy) v.append(el('p', `Last: ${e.lightBy.who} ${e.lightBy.what}, ${when(e.lightBy.at)}`, 'ph-note'));
    return;
  }
  if (phoneAt === 'timers') {
    v.append(phoneHead('⏰ Timers', 'every lamp, by time of day', 'home'));
    const all = lamps.flatMap((e) => (e.timers || []).map((tm) => ({ e, tm }))).sort((a, b) => a.tm.at.localeCompare(b.tm.at));
    for (const { e, tm } of all) { const row = el('div', null, 'ph-timer'); row.append(el('span', `${tm.at} · ${lampName(e)}`), el('small', timerWords(tm).replace(/ at .*$/, ''))); v.append(row); }
    for (const e of lamps.filter((x) => x.auto === 'dark')) { const row = el('div', null, 'ph-timer'); row.append(el('span', `🌑 ${lampName(e)}`), el('small', 'on when dark')); v.append(row); }
    if (!all.length && !lamps.some((x) => x.auto === 'dark')) v.append(el('p', 'No timers yet. Open a lamp in Lights to add one.', 'ph-note'));
  }
}
setInterval(() => { if (lastState && !$('phone').hidden) $('phclock').textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }); }, 30_000);
