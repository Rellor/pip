// Pip's home: his bedroom (the original room, x -5 to 5), a hall in the middle (x 5.3 to 8.3) and a music studio (x 8.6 to 16.6).
// Doors in the walls between them, at z 0.4. The page draws it all and Pip walks through the doors; Node can use the routing and the move too.
export const DOOR_Z = 0.4;
export const DOOR_W = 1.2;
export const WALLS_X = [5.15, 8.45]; // the walls between bedroom and hall, and hall and studio
export const ROOM_X = { bedroom: [-5, 5], hall: [5.3, 8.3], studio: [8.6, 16.6] };
export const FOCUS_X = { bedroom: 0, hall: 6.8, studio: 12.6, house: 5.9 };
export const roomOf = (x) => (x < WALLS_X[0] ? 'bedroom' : x < WALLS_X[1] ? 'hall' : 'studio');

// Where a person can stand: inside a room (a little away from the walls) or in a doorway.
const FLOORS = [[-4.55, 4.55, -4.55, 4.55], [5.55, 8.05, -4.55, 4.55], [9.0, 16.2, -4.55, 4.55]];
export function walkable(x, z) {
  if (FLOORS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) return true;
  return WALLS_X.some((w) => x > w - 0.9 && x < w + 0.9 && Math.abs(z - DOOR_Z) < 0.5);
}

// Things in the studio and the hall that cannot be walked through: [minX, maxX, minZ, maxZ]. (The piano is furniture and is checked with the other furniture.)
export const HOUSE_BLOCKS = [
  [5.5, 6.2, -5, -4.25], // plant in the hall
  [7.6, 8.25, -5, -4.25], // coat rack
  [8.6, 9.1, -4.8, -2.85], // bookshelf with music books
  [8.6, 9.15, -2.85, -1.15], // sideboard
  [13.9, 16.5, -5, -3.9], // mixing desk
  [12.35, 13.85, -2.45, -1.95], // keyboard
  [8.6, 9.6, 1.95, 4.3], // sofa
  [9.8, 10.55, 2.55, 3.65], // coffee table
  [14.1, 16.3, 1.3, 3.7], // drum kit
];
export const blockedInHouse = (x, z, m = 0.28) => HOUSE_BLOCKS.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);

// The next place to walk to on the way from `from` to `to` (both { x, z }): through the doors when the rooms differ.
export function nextGoal(from, to) {
  const right = to.x > from.x;
  const walls = WALLS_X.filter((w) => (from.x < w) !== (to.x < w)).sort((a, b) => (right ? a - b : b - a));
  if (!walls.length) return to;
  const w = walls[0];
  const near = right ? w - 0.95 : w + 0.95;
  const far = right ? w + 0.95 : w - 0.95;
  const inDoor = Math.abs(from.z - DOOR_Z) < 0.5 && Math.abs(from.x - w) < 1.05;
  return { x: inDoor ? far : near, z: DOOR_Z };
}

// The piano and the music things move into the studio once. `s` is the saved state; returns true when something moved.
export const STUDIO_MOVE = { dx: 13.45, piano: { x: 10.85, z: -3.9 } };
export function moveMusicToStudio(s, now = Date.now()) {
  if (s.musicMoved) return false;
  s.musicMoved = true;
  const at = new Date(now).toISOString();
  s.furniture ??= {};
  s.furniture.piano = { x: STUDIO_MOVE.piano.x, z: STUDIO_MOVE.piano.z, rot: 0, at };
  for (const d of s.decor ?? []) {
    if (d.image || !d.pos) continue;
    if (d.zone === 'on_piano') d.pos = [d.pos[0] + STUDIO_MOVE.dx, d.pos[1], d.pos[2]];
    else if (/ambient sound box/i.test(d.name)) Object.assign(d, { pos: [8.9, 0.8, -2.2], zone: 'surface', base: null, label: 'on the sideboard in the music studio' });
    else if (/music box/i.test(d.name) && d.song) Object.assign(d, { pos: [8.9, 0.8, -1.6], zone: 'surface', base: null, label: 'on the sideboard in the music studio' });
  }
  return true;
}

// Wall things too close to a window (the bedroom's new side window, z 4.15 to 4.85) are moved along the wall, once.
export function keepWindowsClear(s) {
  if (s.windowsClear) return false;
  s.windowsClear = true;
  let moved = false;
  for (const d of s.decor ?? []) {
    if (d.kind !== 'wall' || !d.pos || !(d.side === 'left' || d.zone === 'wall_left' || d.zone === 'wall_free')) continue;
    if (!(d.pos[0] < -4.5)) continue;
    const hw = (d.size?.[0] ?? 0.6) / 2;
    if (d.pos[2] + hw > 3.8 && d.pos[2] - hw < 5.0) { d.pos = [d.pos[0], d.pos[1], Math.round((3.75 - hw) * 100) / 100]; moved = true; }
  }
  return moved;
}

// ---------------------------------------------------------------- drawing
export function buildHouse(THREE, scene) {
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  const put = (parent, geo, mat, [x, y, z], rot = [0, 0, 0], shadow = false) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(...rot);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const B = (parent, [w, h, d], color, pos, o, rot) => put(parent, new THREE.BoxGeometry(w, h, d), M(color, o), pos, rot);
  const C = (parent, [rt, rb, h], color, pos, o, rot) => put(parent, new THREE.CylinderGeometry(rt, rb, h, 24), M(color, o), pos, rot);
  const S = (parent, r, color, pos, o, sc = [1, 1, 1]) => { const m = put(parent, new THREE.SphereGeometry(r, 18, 12), M(color, o), [0, 0, 0]); m.position.set(...pos); m.scale.set(...sc); return m; };
  const glow = (color, k = 0.9) => ({ emissive: color, emissiveIntensity: k });
  const brass = { metalness: 0.7, roughness: 0.3 };

  const house = new THREE.Group(); // always there
  const low = new THREE.Group(); // walls between rooms and the far right wall, low in the overview so you can see in
  const full = new THREE.Group(); // the same walls full height, with what hangs on them (walk mode only)
  const roof = new THREE.Group(); // front walls and ceilings (walk mode only)
  full.visible = false;
  roof.visible = false;
  scene.add(house, low, full, roof);

  const dz0 = DOOR_Z - DOOR_W / 2;
  const dz1 = DOOR_Z + DOOR_W / 2;
  const WALL = { hall: 0xe3dccb, studio: 0x7d9487, studioLow: 0x5f7568, wood: 0x6b4a33 };

  // ---- a floor of wooden planks (the same kind as the bedroom's, a little darker in the studio)
  const planks = (tint, seed) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const x = cv.getContext('2d');
    x.fillStyle = `rgb(${tint[0] * 0.8},${tint[1] * 0.8},${tint[2] * 0.8})`;
    x.fillRect(0, 0, 512, 512);
    let r = seed;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let row = 0; row < 8; row++) {
      const off = rnd() * 200;
      for (let k = -1; k < 4; k++) {
        const w = 130 + rnd() * 80;
        const v = 0.88 + rnd() * 0.2;
        x.fillStyle = `rgb(${Math.round(tint[0] * v)},${Math.round(tint[1] * v)},${Math.round(tint[2] * v)})`;
        x.fillRect(k * 170 + off, row * 64, w, 62);
        x.fillStyle = 'rgba(60,35,15,.25)';
        x.fillRect(k * 170 + off, row * 64 + 62, w, 2);
        x.fillRect(k * 170 + off + w - 1, row * 64, 2, 62);
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const floor = (w, d, cx, cz, tint, seed) => {
    B(house, [w, 0.3, d], 0x8a6a4a, [cx, -0.15, cz]);
    const t = planks(tint, seed);
    t.repeat.set(w / 2.2, d / 2.2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.002, cz);
    m.receiveShadow = true;
    house.add(m);
  };
  floor(3.3, 10, 6.8, 0, [205, 165, 120], 11);
  floor(8.4, 10, 12.65, 0, [175, 130, 88], 29);

  // ---- views through the windows: a painted sky and hills that follow the time of day
  const views = [];
  const paintView = (cv, hour) => {
    const x = cv.getContext('2d');
    const w = cv.width;
    const h = cv.height;
    const day = hour >= 7.5 && hour < 17;
    const dusk = (hour >= 5.5 && hour < 7.5) || (hour >= 17 && hour < 20);
    const [top, bot] = day ? ['#78b6ea', '#d3eaf8'] : dusk ? (hour < 12 ? ['#8fa8d8', '#f6cfa6'] : ['#5c6aa8', '#f4a874']) : ['#0b1230', '#27356a'];
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    if (!day && !dusk) {
      x.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) x.fillRect((i * 97) % w, (i * 53) % (h * 0.6), 1.5, 1.5);
    }
    x.fillStyle = day ? '#fff6c8' : dusk ? '#ffd9a0' : '#f0f0ff';
    x.beginPath();
    x.arc(w * 0.72, h * (day ? 0.22 : dusk ? 0.5 : 0.2), day ? 18 : 12, 0, 7);
    x.fill();
    x.fillStyle = day ? '#8cc07a' : dusk ? '#6f8a62' : '#1c2c3a';
    x.beginPath();
    x.moveTo(0, h * 0.72);
    x.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.55, h * 0.7);
    x.quadraticCurveTo(w * 0.8, h * 0.82, w, h * 0.66);
    x.lineTo(w, h);
    x.lineTo(0, h);
    x.fill();
    x.fillStyle = day ? '#3f8a4a' : dusk ? '#34543a' : '#10202a';
    for (const [tx, ty] of [[0.18, 0.78], [0.3, 0.82], [0.8, 0.8]]) { x.beginPath(); x.moveTo(w * tx, h * ty - 26); x.lineTo(w * tx - 11, h * ty + 4); x.lineTo(w * tx + 11, h * ty + 4); x.fill(); }
  };
  // a window in a wall: side is 'back' (the back wall, along x), 'left' (the bedroom's left wall, along z) or 'right' (the studio's right wall, along z)
  const WALLS = { back: { f: -5.0, sgn: 1 }, left: { f: -5.0, sgn: 1 }, right: { f: 16.6, sgn: -1 } };
  const windowOn = (side, c, y0, y1, w, group = house) => {
    const { f, sgn } = WALLS[side];
    const at = (a, y, t) => (side === 'back' ? [a, y, f + sgn * t] : [f + sgn * t, y, a]);
    const sz = (A, H, D) => (side === 'back' ? [A, H, D] : [D, H, A]);
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 160;
    paintView(cv, 13);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    views.push({ cv, tex });
    const h = y1 - y0;
    const cy = (y0 + y1) / 2;
    const view = put(group, new THREE.PlaneGeometry(w + 0.1, h + 0.1), new THREE.MeshBasicMaterial({ map: tex }), at(c, cy, -0.32));
    view.rotation.y = side === 'back' ? 0 : side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    const fr = 0xffffff;
    B(group, sz(0.08, h + 0.16, 0.2), fr, at(c - w / 2 - 0.04, cy, -0.07));
    B(group, sz(0.08, h + 0.16, 0.2), fr, at(c + w / 2 + 0.04, cy, -0.07));
    B(group, sz(w + 0.16, 0.08, 0.2), fr, at(c, y1 + 0.04, -0.07));
    B(group, sz(w + 0.28, 0.07, 0.34), fr, at(c, y0 - 0.035, 0.0));
    B(group, sz(0.05, h, 0.06), fr, at(c, cy, -0.12));
    B(group, sz(w, 0.05, 0.06), fr, at(c, cy + h * 0.1, -0.12));
  };
  const windowAt = (cx, y0, y1, w) => windowOn('back', cx, y0, y1, w);
  // a wall along z (x = wx) in pieces with window holes; `holes` are { a0, a1, y0, y1 } along z
  const sideWall = (group, wx, z0, z1, color, holes) => {
    let cur = z0;
    const seg = (a, b, y0, y1) => { if (b - a > 0.001 && y1 - y0 > 0.001) B(group, [0.3, y1 - y0, b - a], color, [wx, (y0 + y1) / 2, (a + b) / 2]); };
    for (const hl of holes) {
      seg(cur, hl.a0, 0, 5);
      seg(hl.a0, hl.a1, 0, hl.y0);
      seg(hl.a0, hl.a1, hl.y1, 5);
      cur = hl.a1;
    }
    seg(cur, z1, 0, 5);
  };

  // ---- back wall in pieces, with holes where windows are
  const backWall = (x0, x1, color, holes) => {
    let cur = x0;
    const seg = (a, b, y0, y1) => { if (b - a > 0.001 && y1 - y0 > 0.001) B(house, [b - a, y1 - y0, 0.3], color, [(a + b) / 2, (y0 + y1) / 2, -5.15]); };
    for (const hl of holes) {
      seg(cur, hl.x0, 0, 5);
      seg(hl.x0, hl.x1, 0, hl.y0);
      seg(hl.x0, hl.x1, hl.y1, 5);
      cur = hl.x1;
    }
    seg(cur, x1, 0, 5);
  };
  // the hall: tall windows on both sides of the front door
  backWall(5.3, 8.3, WALL.hall, [{ x0: 5.45, x1: 5.85, y0: 0.9, y1: 3.3 }, { x0: 7.75, x1: 8.15, y0: 0.9, y1: 3.3 }]);
  windowAt(5.65, 0.9, 3.3, 0.4);
  windowAt(7.95, 0.9, 3.3, 0.4);
  // the studio: a wide window between the piano and the desk, and a tall one at the left end
  backWall(8.3, 16.9, WALL.studio, [{ x0: 8.75, x1: 9.35, y0: 1.3, y1: 3.6 }, { x0: 12.55, x1: 13.75, y0: 1.9, y1: 3.7 }, { x0: 15.75, x1: 16.35, y0: 1.3, y1: 3.6 }]);
  windowAt(9.05, 1.3, 3.6, 0.6);
  windowAt(13.15, 1.9, 3.7, 1.2);
  windowAt(16.05, 1.3, 3.6, 0.6);
  // a dark wooden wainscot and rail along the studio's back wall, white panelling in the hall
  B(house, [8.4, 1.0, 0.05], WALL.wood, [12.65, 0.5, -4.98]);
  B(house, [8.4, 0.06, 0.08], 0x3f2c1f, [12.65, 1.02, -4.96]);
  B(house, [3.3, 1.0, 0.05], 0xf5f1e6, [6.8, 0.5, -4.98]);

  // ---- walls between the rooms: low for the overview, full height for walk mode
  const partition = (x, color, colorLow) => {
    const t = 0.3;
    const piece = (grp, h, z0, z1, y0 = 0, c = color) => B(grp, [t, h, z1 - z0], c, [x, y0 + h / 2, (z0 + z1) / 2]);
    piece(low, 0.45, -5.3, dz0, 0, colorLow);
    piece(low, 0.45, dz1, 5.3, 0, colorLow);
    B(low, [t + 0.06, 0.05, dz0 + 5.3], 0xffffff, [x, 0.47, (-5.3 + dz0) / 2]);
    B(low, [t + 0.06, 0.05, 5.3 - dz1], 0xffffff, [x, 0.47, (dz1 + 5.3) / 2]);
    piece(full, 5, -5.3, dz0);
    piece(full, 5, dz1, 5.3);
    piece(full, 2.6, dz0, dz1, 2.4);
  };
  partition(WALLS_X[0], 0xefcfb6, 0xdcb99c);
  partition(WALLS_X[1], WALL.studio, WALL.studioLow);
  // the far right wall of the studio
  B(low, [0.3, 0.45, 10.6], WALL.studioLow, [16.75, 0.225, 0]);
  B(low, [0.36, 0.05, 10.6], 0xffffff, [16.75, 0.47, 0]);
  sideWall(full, 16.75, -5.3, 5.3, WALL.studio, [{ a0: -3.1, a1: -1.7, y0: 1.4, y1: 3.4 }, { a0: 0.9, a1: 2.3, y0: 1.4, y1: 3.4 }]);
  windowOn('right', -2.4, 1.4, 3.4, 1.4, full);
  windowOn('right', 1.6, 1.4, 3.4, 1.4, full);

  // ---- doors: a frame and a leaf swung open into the room, always visible
  const doorway = (x, leafColor) => {
    B(house, [0.38, 2.4, 0.07], 0xffffff, [x, 1.2, dz0 - 0.035]);
    B(house, [0.38, 2.4, 0.07], 0xffffff, [x, 1.2, dz1 + 0.035]);
    B(house, [0.38, 0.09, DOOR_W + 0.14], 0xffffff, [x, 2.44, DOOR_Z]);
    const hinge = new THREE.Group();
    hinge.position.set(x + 0.18, 0, dz0 + 0.05);
    hinge.rotation.y = -1.38;
    B(hinge, [0.05, 2.3, DOOR_W - 0.1], leafColor, [0, 1.15, (DOOR_W - 0.1) / 2]);
    B(hinge, [0.07, 0.9, 0.34], leafColor, [0, 1.65, (DOOR_W - 0.1) / 2]);
    S(hinge, 0.04, 0xd4af37, [0.06, 1.05, DOOR_W - 0.2], brass);
    house.add(hinge);
  };
  doorway(WALLS_X[0], 0xb98a5b);
  doorway(WALLS_X[1], 0xa97a4d);

  // ---- walk-mode walls and ceilings: the front of the hall and studio, and a ceiling over everything
  B(roof, [3.3, 5, 0.3], WALL.hall, [6.8, 2.5, 5.15]);
  B(roof, [8.4, 5, 0.3], WALL.studio, [12.65, 2.5, 5.15]);
  B(roof, [3.3, 0.3, 10.6], 0xf1ebdd, [6.8, 5.15, 0]);
  B(roof, [8.4, 0.3, 10.6], 0xe5ddcc, [12.65, 5.15, 0]);

  // ---------------------------------------------------------------- the hall
  const hall = new THREE.Group();
  house.add(hall);
  B(hall, [1.5, 0.03, 9.2], 0x7a3030, [6.8, 0.025, 0]); // runner
  B(hall, [1.3, 0.035, 9.0], 0xa84a44, [6.8, 0.04, 0]);
  B(hall, [1.3, 0.04, 0.12], 0xe3c98a, [6.8, 0.045, -3.0]);
  B(hall, [1.3, 0.04, 0.12], 0xe3c98a, [6.8, 0.045, 3.0]);
  // the front door of the house in the back wall, with a little window in it
  B(hall, [1.5, 0.12, 0.2], 0xffffff, [6.8, 2.45, -4.95]);
  B(hall, [0.1, 2.45, 0.2], 0xffffff, [6.1, 1.225, -4.95]);
  B(hall, [0.1, 2.45, 0.2], 0xffffff, [7.5, 1.225, -4.95]);
  B(hall, [1.3, 2.3, 0.08], 0x2f5d50, [6.8, 1.15, -4.98]);
  [[-0.27, 0.55], [-0.27, -0.1], [0.27, 0.55], [0.27, -0.1]].forEach(([dx, dy]) => B(hall, [0.46, 0.5, 0.02], 0x264c42, [6.8 + dx, 0.95 + dy, -4.93]));
  B(hall, [0.6, 0.5, 0.02], 0xcfe4ee, [6.8, 1.95, -4.93], glow(0xcfe4ee, 0.25));
  S(hall, 0.05, 0xd4af37, [7.3, 1.05, -4.92], brass);
  // a plant in the corner, a coat rack, a pendant lamp
  C(hall, [0.2, 0.15, 0.32], 0xb5651d, [5.85, 0.16, -4.55]);
  [[-0.1, 0.75, 0], [0.12, 0.65, 0.05], [0, 0.95, -0.05]].forEach(([dx, y, dz], i) => S(hall, 0.22 - i * 0.03, 0x4f8f4d, [5.85 + dx, y, -4.55 + dz], {}, [1, 1.3, 1]));
  C(hall, [0.02, 0.02, 1.7], 0x4a3320, [7.95, 0.85, -4.55]);
  C(hall, [0.18, 0.2, 0.04], 0x4a3320, [7.95, 0.02, -4.55]);
  [[-0.1, 1.6], [0.1, 1.6], [0, 1.45]].forEach(([dx, y]) => B(hall, [0.1, 0.03, 0.03], 0xd4af37, [7.95 + dx, y, -4.55]));
  B(hall, [0.14, 0.45, 0.1], 0x3b5bdb, [7.85, 1.3, -4.55]);
  S(hall, 0.12, 0xd9534f, [8.07, 1.62, -4.55], {}, [1.2, 0.6, 1.2]);
  C(hall, [0.01, 0.01, 1.2], 0x222222, [6.8, 4.4, 0]);
  S(hall, 0.28, 0xfff1d0, [6.8, 3.75, 0], glow(0xffd98a, 0.9), [1, 0.7, 1]);
  const hallLight = new THREE.PointLight(0xffe2b8, 9, 9);
  hallLight.position.set(6.8, 3.6, 0);
  house.add(hallLight);
  // what hangs on the hall's side walls (only when the walls are full height)
  [-3.4, -3.0, -2.6].forEach((z) => B(full, [0.1, 0.05, 0.05], 0xd4af37, [5.38, 1.8, z]));
  B(full, [0.1, 0.9, 0.38], 0x3b5bdb, [5.42, 1.3, -3.0]);
  B(full, [0.06, 2.2, 1.0], 0x6d8a6d, [5.36, 1.1, -1.7]); // a closed door: a room that is not built yet
  B(full, [0.08, 0.1, 1.1], 0xffffff, [5.37, 2.25, -1.7]);
  S(full, 0.035, 0xd4af37, [5.4, 1.05, -1.4], brass);
  B(full, [0.5, 0.08, 1.6], 0x8a5a2e, [8.05, 0.85, 2.8]); // a console table against the studio wall
  [2.1, 3.5].forEach((z) => B(full, [0.5, 0.85, 0.08], 0x6b4524, [8.05, 0.425, z]));
  B(full, [0.05, 0.6, 0.45], 0xe3b269, [8.25, 1.9, 2.4]);
  B(full, [0.05, 0.6, 0.45], 0x7aa6c2, [8.25, 1.9, 3.2]);

  // ---------------------------------------------------------------- the music studio
  const studio = new THREE.Group();
  house.add(studio);
  const warm = 0xffd9a0;
  // a rug, a Persian-style one
  B(studio, [4.6, 0.04, 3.4], 0x7d2e2a, [12.5, 0.03, 0.4]);
  B(studio, [4.2, 0.05, 3.0], 0xd9b97a, [12.5, 0.04, 0.4]);
  B(studio, [3.9, 0.06, 2.7], 0x8f3b32, [12.5, 0.05, 0.4]);
  B(studio, [2.6, 0.065, 1.5], 0x5e2a2a, [12.5, 0.055, 0.4]);
  B(studio, [1.4, 0.07, 0.7], 0xd9b97a, [12.5, 0.06, 0.4]);
  // acoustic panels: charcoal and mustard felt, and a strip of wooden slats, on the back wall above the desk
  [0x3a3d42, 0xc9a24a, 0x3a3d42].forEach((c, i) => B(studio, [0.4, 1.0, 0.08], c, [14.35 + i * 0.46, 2.45, -4.95]));
  for (let i = 0; i < 14; i++) B(studio, [0.05, 0.5, 0.08], 0xb98a5b, [14.25 + i * 0.07, 3.6, -4.95]);
  // the mixing desk: a wooden desk with a mixer, a screen showing the sound wave, two monitor speakers
  B(studio, [2.6, 0.06, 1.0], 0x7a5434, [15.15, 0.76, -4.45]);
  [[-1.2, -0.42], [1.2, -0.42], [-1.2, 0.42], [1.2, 0.42]].forEach(([dx, dz]) => B(studio, [0.07, 0.76, 0.07], 0x4a3320, [15.15 + dx, 0.38, -4.45 + dz]));
  B(studio, [2.4, 0.5, 0.04], 0x4a3320, [15.15, 0.45, -4.9]);
  B(studio, [0.6, 0.55, 0.85], 0x6a4a2e, [16.0, 0.4, -4.45]);
  const mixer = new THREE.Group();
  mixer.position.set(15.0, 0.84, -4.35);
  mixer.rotation.x = -0.14;
  studio.add(mixer);
  B(mixer, [1.5, 0.1, 0.6], 0x2b2c31, [0, 0, 0]);
  const faders = [];
  const knobs = [];
  const leds = [];
  for (let i = 0; i < 8; i++) {
    const x = -0.63 + i * 0.18;
    B(mixer, [0.02, 0.012, 0.26], 0x0c0c10, [x, 0.056, 0.05]);
    const cap = B(mixer, [0.06, 0.04, 0.045], [0xd9534f, 0xe3b269, 0x7ac0a8, 0x8a9fc9][i % 4], [x, 0.08, 0.05]);
    cap.userData.baseZ = 0.05;
    faders.push(cap);
    knobs.push(C(mixer, [0.03, 0.03, 0.04], 0xd8d4c8, [x, 0.075, -0.2]));
    leds.push(B(mixer, [0.04, 0.015, 0.04], 0x2a6a3a, [x, 0.058, -0.1], glow(0x33dd66, 0.2)));
  }
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const draw = (t, active) => {
    ctx.fillStyle = '#10151a';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = active ? '#6fe0b8' : '#2d4a46';
    for (let x = 0; x < 256; x += 6) {
      const h = active ? 8 + Math.abs(Math.sin(x * 0.07 + t * 5) * Math.cos(x * 0.031 - t * 2.1)) * 44 : 4 + Math.abs(Math.sin(x * 0.2)) * 6;
      ctx.fillRect(x, 64 - h, 4, h * 2);
    }
    ctx.fillStyle = '#e07a5a';
    ctx.fillRect(0, 118, 256 * (active ? (t * 0.07) % 1 : 0), 4);
    tex.needsUpdate = true;
  };
  draw(0, false);
  B(studio, [1.0, 0.62, 0.04], 0x1a1a20, [15.15, 1.42, -4.8]);
  const screen = put(studio, new THREE.PlaneGeometry(0.94, 0.56), new THREE.MeshBasicMaterial({ map: tex }), [15.15, 1.42, -4.77]);
  B(studio, [0.08, 0.3, 0.08], 0x1a1a20, [15.15, 1.0, -4.8]);
  B(studio, [0.6, 0.02, 0.2], 0x2b2c31, [15.15, 0.8, -4.0]); // a computer keyboard
  [14.0, 16.3].forEach((x) => {
    B(studio, [0.3, 0.42, 0.3], 0x25262b, [x, 1.0, -4.65]);
    put(studio, new THREE.CircleGeometry(0.1, 20), M(0x3a3b42), [x, 0.95, -4.49]);
    put(studio, new THREE.CircleGeometry(0.035, 12), M(0x3a3b42), [x, 1.13, -4.49]);
  });
  S(studio, 0.07, 0x333338, [14.3, 0.86, -4.1], {}, [1.2, 0.5, 1]); // headphones
  C(studio, [0.05, 0.045, 0.1], 0xf0ebe0, [16.2, 0.84, -4.2]); // a mug
  // a stool for Pip at the desk
  C(studio, [0.28, 0.28, 0.5], 0x8a5a3a, [15.2, 0.25, -3.3]);
  C(studio, [0.3, 0.3, 0.07], 0x9b5a34, [15.2, 0.52, -3.3]);
  // the keyboard: a stage piano on a stand, keys toward the room, and its stool
  B(studio, [1.5, 0.07, 0.45], 0x1b1b20, [13.1, 0.86, -2.2]);
  for (let i = 0; i < 14; i++) B(studio, [0.09, 0.03, 0.3], 0xfafaf2, [12.45 + i * 0.1, 0.915, -2.12]);
  [0, 1, 3, 4, 5, 7, 8, 10, 11].forEach((i) => B(studio, [0.06, 0.04, 0.18], 0x15151c, [12.5 + i * 0.1, 0.945, -2.2]));
  [12.5, 13.7].forEach((x) => { C(studio, [0.025, 0.025, 0.85], 0x15151c, [x, 0.43, -2.2]); B(studio, [0.06, 0.02, 0.5], 0x15151c, [x, 0.01, -2.2]); });
  C(studio, [0.2, 0.2, 0.5], 0x8a5a3a, [13.1, 0.25, -1.45]);
  // a bookshelf of music books against the left wall, facing the room
  B(studio, [0.45, 2.4, 1.9], 0x6b4524, [8.85, 1.2, -3.8]);
  const spines = [0xd9534f, 0x4a90a4, 0xe3b269, 0x5c8f5c, 0x8a5fd0, 0xc98a4b, 0x7a8fa8];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) B(studio, [0.3, 0.38, 0.09], spines[(i * 3 + r) % 7], [8.97, 0.45 + r * 0.55, -4.65 + i * 0.205]);
  for (let r = 0; r < 5; r++) B(studio, [0.4, 0.04, 1.85], 0x4a3320, [8.97, 0.2 + r * 0.55, -3.8]);
  // a sideboard with a record player (the music box and the sound box stand on it)
  B(studio, [0.5, 0.8, 1.7], 0x7a5434, [8.9, 0.4, -2.0]);
  B(studio, [0.4, 0.06, 0.5], 0x2b2c31, [8.9, 0.83, -1.35]);
  C(studio, [0.17, 0.17, 0.02], 0x111111, [8.9, 0.87, -1.35]);
  C(studio, [0.05, 0.05, 0.022], 0xd9534f, [8.9, 0.88, -1.35]);
  // a sofa against the left wall, a coffee table and a floor lamp
  B(studio, [0.95, 0.42, 2.3], 0x9b5a34, [9.12, 0.21, 3.1]);
  B(studio, [0.28, 0.85, 2.3], 0x8a4a2a, [8.82, 0.62, 3.1]);
  [[2.15, 0xe3b269], [4.05, 0x7a8fa8]].forEach(([z, c]) => B(studio, [0.2, 0.36, 0.38], c, [9.0, 0.6, z], {}, [0, 0, -0.25]));
  B(studio, [0.75, 0.04, 1.1], 0x7a5434, [10.15, 0.4, 3.1]);
  [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.45], [0.3, 0.45]].forEach(([dx, dz]) => B(studio, [0.05, 0.4, 0.05], 0x4a3320, [10.15 + dx, 0.2, 3.1 + dz]));
  C(studio, [0.05, 0.045, 0.1], 0xf0ebe0, [10.1, 0.47, 2.9]);
  C(studio, [0.02, 0.02, 1.5], 0x333338, [9.6, 0.75, 4.2]);
  S(studio, 0.2, warm, [9.6, 1.55, 4.2], glow(warm, 0.8), [1, 0.8, 1]);
  // a drum kit in the corner on its own little rug
  const kit = new THREE.Group();
  studio.add(kit);
  B(kit, [2.2, 0.03, 2.4], 0x4a4f55, [15.2, 0.05, 2.5]);
  C(kit, [0.36, 0.36, 0.42], 0x7a2e2a, [15.5, 0.38, 2.5], {}, [0, 0, Math.PI / 2]);
  C(kit, [0.2, 0.2, 0.14], 0xf0efe8, [15.0, 0.75, 1.9]);
  C(kit, [0.015, 0.015, 0.75], 0xaaaaaa, [15.0, 0.37, 1.9]);
  [[15.0, 1.0, 2.55], [15.0, 1.0, 3.1]].forEach((p) => { C(kit, [0.16, 0.16, 0.2], 0x7a2e2a, p); C(kit, [0.012, 0.012, 0.35], 0xaaaaaa, [p[0], 0.8, p[2]]); });
  C(kit, [0.26, 0.26, 0.4], 0x7a2e2a, [15.8, 0.45, 3.4]);
  C(kit, [0.01, 0.01, 1.3], 0xaaaaaa, [14.6, 0.65, 3.1]);
  C(kit, [0.17, 0.17, 0.02], 0xd4af37, [14.6, 1.3, 3.1], brass);
  C(kit, [0.01, 0.01, 1.5], 0xaaaaaa, [14.5, 0.75, 1.5]);
  C(kit, [0.28, 0.28, 0.02], 0xd4af37, [14.5, 1.5, 1.5], brass);
  C(kit, [0.18, 0.18, 0.1], 0x2a2a30, [14.4, 0.28, 2.4]);
  // a microphone on a stand with a pop filter
  C(studio, [0.18, 0.2, 0.03], 0x15151c, [11.2, 0.015, 0.0]);
  C(studio, [0.012, 0.012, 1.45], 0x15151c, [11.2, 0.75, 0.0]);
  S(studio, 0.05, 0x888890, [11.2, 1.5, 0.0], { metalness: 0.7, roughness: 0.3 }, [1, 1.4, 1]);
  put(studio, new THREE.CircleGeometry(0.11, 20), M(0x222222, { transparent: true, opacity: 0.6 }), [11.2, 1.5, 0.15]);
  // an acoustic guitar on a stand, plants, posters
  const gx = 16.0;
  C(studio, [0.02, 0.02, 0.6], 0x15151c, [gx, 0.3, -0.9]);
  B(studio, [0.5, 0.03, 0.03], 0x15151c, [gx, 0.02, -0.9]);
  S(studio, 0.18, 0xc98a4b, [gx, 0.62, -0.9], {}, [0.4, 1.05, 1]);
  S(studio, 0.13, 0xc98a4b, [gx, 0.9, -0.9], {}, [0.4, 1, 1]);
  B(studio, [0.04, 0.55, 0.03], 0x5a3a22, [gx, 1.2, -0.9]);
  [[16.15, -1.4], [9.1, 4.45]].forEach(([x, zz]) => {
    C(studio, [0.2, 0.16, 0.32], 0xb5651d, [x, 0.16, zz]);
    [[-0.1, 0.7], [0.12, 0.62], [0, 0.95]].forEach(([dx, y], k) => S(studio, 0.22 - k * 0.04, 0x4f8f4d, [x + dx, y, zz], {}, [1, 1.3, 1]));
  });
  [[9.9, 2.75, 0xe3b269], [9.9, 2.0, 0x7aa6c2]].forEach(([x, y, c]) => { B(studio, [0.44, 0.56, 0.04], 0x3f2c1f, [x, y, -4.97]); B(studio, [0.36, 0.48, 0.05], c, [x, y, -4.96]); }); // two small pictures between the tall window and the photo
  // the REC light above the desk: small and red, lit only while he records
  const recMat = new THREE.MeshStandardMaterial({ color: 0x5a1010, emissive: 0xff2a1a, emissiveIntensity: 0.1 });
  put(studio, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), recMat, [14.8, 4.15, -4.95], [Math.PI / 2, 0, 0]);
  // warm ceiling lamps
  [[10.8, 0.0], [14.6, 0.6]].forEach(([x, z]) => {
    C(studio, [0.01, 0.01, 1.0], 0x222222, [x, 4.5, z]);
    S(studio, 0.24, warm, [x, 3.95, z], glow(warm, 0.85), [1, 0.6, 1]);
    const l = new THREE.PointLight(warm, 11, 12);
    l.position.set(x, 3.8, z);
    house.add(l);
  });
  const studioLight = new THREE.PointLight(0xfff2dd, 7, 16);
  studioLight.position.set(12.6, 4.6, 0);
  house.add(studioLight);

  // the bedroom's left wall has a window too (the wall itself is drawn here, with the hole)
  sideWall(house, -5.15, -5.0, 5.0, 0xefcfb6, [{ a0: 4.15, a1: 4.85, y0: 1.3, y1: 3.5 }]);
  windowOn('left', 4.5, 1.3, 3.5, 0.7);
  const refreshViews = (hour) => views.forEach((v) => { paintView(v.cv, hour); v.tex.needsUpdate = true; });
  refreshViews(13);
  return {
    house, low, full, roof, hall, studio,
    faders, knobs, leds, screen, drawScreen: draw, recMat, kit, refreshViews,
    // call each frame with the time, and whether he is mixing: the faders slide, the lights blink and the red light glows
    update(t, active) {
      faders.forEach((f, i) => { f.position.z = f.userData.baseZ + (active ? Math.sin(t * (1.2 + i * 0.37) + i) * 0.1 : 0); });
      knobs.forEach((k, i) => { if (active) k.rotation.y = t * (0.8 + i * 0.1); });
      leds.forEach((l, i) => { l.material.emissiveIntensity = active ? 0.3 + Math.max(0, Math.sin(t * 6 + i * 1.7)) * 0.9 : 0.15; });
      recMat.emissiveIntensity = active ? 0.9 + Math.sin(t * 4) * 0.25 : 0.08;
      if (active || !draw.idle) { draw(t, active); draw.idle = !active; }
    },
  };
}
