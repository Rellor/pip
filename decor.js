import { cleanSong } from './songs.js';
import { storedUses } from './uses.js';
import { toolKind } from './tools.js';

// Pip's decorations.
// He designs objects from a few simple shapes. His design is plain data, never code, and everything is checked and
// limited here. He places things in named spots; this file works out the exact position, so nothing overlaps or
// ends up outside the room.

const SHAPES = { box: 3, sphere: 1, cylinder: 3, cone: 2, torus: 2, capsule: 2 }; // how many numbers each shape needs
// Biggest size by kind. Spots with less room (next to a wall, on a small table) have their own smaller `lim`.
const LIMITS = {
  floor: { w: 2.6, h: 3.2, d: 2.4 },
  surface: { w: 1.0, h: 0.9, d: 1.0 }, // on top of furniture
  wall: { w: 2.0, h: 1.6, d: 0.4 }, // flat things on a wall
};
export const MAX_PER_DAY = 6;
const MAX_PARTS = 40;
const MAX_DECOR = 30;
const STORAGE_WORDS = /shelf|shelves|closet|cabinet|wardrobe|drawer|dresser|rack|crate|storage|cupboard|bookcase|locker/i;
// Storage furniture makes room for more things.
export function capOf(decor) {
  return Math.min(60, MAX_DECOR + 6 * decor.filter((d) => !d.image && !d.art && STORAGE_WORDS.test(d.name)).length);
}
const FULL = 'his room is full. He can put things in his chest, build storage (a shelf or a closet makes room for more), or ask for more space';

// Spots: [x, y, z] in the room. For wall spots y is the height of the middle of the object.
// "off" is where Pip stands relative to the spot, rotY turns the object to face into the room.
export const ZONES = {
  floor_under_window: { label: 'on the floor under the window', kind: 'floor', lim: { d: 1.2 }, rotY: 0, off: [0, 1.1], slots: [[-1.0, 0, -4.4], [1.0, 0, -4.4]] },
  floor_left_wall: { label: 'on the floor by the left wall', kind: 'floor', lim: { w: 1.1, d: 1.4 }, rotY: Math.PI / 2, off: [1.2, 0], slots: [[-4.5, 0, -2.9], [-4.5, 0, -1.4]] },
  floor_middle: { label: 'on the floor in the middle of the room', kind: 'floor', rotY: 0, off: [0, 1.1], slots: [[-1.8, 0, 0.4], [1.8, 0, 0.0], [0.2, 0, -1.2]] },
  floor_front: { label: 'on the floor near the front of the room', kind: 'floor', rotY: 0, off: [0, 1.1], slots: [[-2.6, 0, 3.2], [-0.6, 0, 3.8], [1.2, 0, 3.4]] },
  floor_right: { label: 'on the floor on the right side of the room', kind: 'floor', lim: { w: 1.1, d: 1.4 }, rotY: -Math.PI / 2, off: [-1.2, 0], slots: [[4.4, 0, -1.6], [4.4, 0, -0.2]] },
  floor: { label: 'on the floor', kind: 'floor', rotY: 0, off: [0, 1.1], slots: [], free: true }, // anywhere on the floor that has room
  surface: { label: 'on furniture', kind: 'surface', rotY: 0, off: [0, 1.1], slots: [], free: true },
  wall_free: { label: 'on a wall', kind: 'wall', rotY: 0, side: null, slots: [], free: true },
  on_piano: { label: 'on top of the piano', kind: 'surface', lim: { w: 1.1, d: 0.8 }, rotY: 0, off: [0, 1.5], slots: [[-3.4, 1.4, -4.5], [-1.9, 1.4, -4.5]] },
  on_bookshelf: { label: 'on top of the bookshelf', kind: 'surface', lim: { w: 1.0, d: 0.55 }, rotY: 0, off: [0, 1.4], slots: [[2.0, 3.0, -4.65], [3.2, 3.0, -4.65]] },
  on_desk: { label: 'on the desk', kind: 'surface', lim: { w: 1.0, d: 1.3 }, rotY: Math.PI / 2, off: [1.5, 0], slots: [[-4.2, 0.85, 0.45], [-4.2, 0.85, 1.95]] },
  on_bed: { label: 'on the bed', kind: 'surface', lim: { w: 0.9, d: 0.9 }, rotY: 0, off: [-1.5, 0], slots: [[3.1, 0.7, 4.0], [3.9, 0.7, 3.4]] },
  wall_back: { label: 'on the back wall (left of the photo, above it, or above the bookshelf)', kind: 'wall', rotY: 0, side: 'back', slots: [[-4.2, 2.9, -4.97], [-2.2, 4.2, -4.97], [2.6, 3.9, -4.97]] },
  wall_desk: { label: 'on the photo wall above the desk', kind: 'wall', prints: true, rotY: Math.PI / 2, side: 'left', slots: [[-4.97, 2.35, 0.45], [-4.97, 2.35, 0.95], [-4.97, 2.35, 1.45], [-4.97, 2.35, 1.95], [-4.97, 2.85, 0.45], [-4.97, 2.85, 0.95], [-4.97, 2.85, 1.45], [-4.97, 2.85, 1.95]] }, // only for the small prints from his photo printer
  wall_left: { label: 'on the left wall', kind: 'wall', rotY: Math.PI / 2, side: 'left', slots: [[-4.97, 2.7, -3.0], [-4.97, 2.7, -1.2], [-4.97, 3.2, 1.2]] },
};

const num = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const r3 = (n) => Math.round(n * 1000) / 1000;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const triple = (v, lo, hi) => {
  const a = (Array.isArray(v) ? v : []).slice(0, 3).map((x) => num(x, lo, hi, 0));
  while (a.length < 3) a.push(0);
  return a;
};

// Turns whatever Pip wrote into a clean list of parts, or null when nothing usable is left.
export function cleanParts(raw) {
  if (!Array.isArray(raw)) return null;
  const parts = [];
  for (const p of raw.slice(0, MAX_PARTS)) {
    if (!p || typeof p !== 'object' || typeof p.shape !== 'string' || !Object.hasOwn(SHAPES, p.shape)) continue;
    const need = SHAPES[p.shape];
    const size = (Array.isArray(p.size) ? p.size : []).slice(0, need).map((v) => num(v, 0.02, 2, 0.1));
    while (size.length < need) size.push(size[0] ?? 0.1); // a missing number copies the first one
    parts.push({
      shape: p.shape,
      size,
      pos: triple(p.pos, -2, 3),
      rot: triple(p.rot, -360, 360),
      color: typeof p.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : '#cccccc',
      glow: p.glow === true,
    });
  }
  return parts.length ? parts : null;
}

// Half the size of a part in x, y, z (before it is turned).
function halfSize(p) {
  const [a, b, c] = p.size;
  switch (p.shape) {
    case 'box': return [a / 2, b / 2, c / 2];
    case 'sphere': return [a, a, a];
    case 'cylinder': return [Math.max(a, b), c / 2, Math.max(a, b)];
    case 'cone': return [a, b / 2, a];
    case 'torus': return [a + b, a + b, b];
    default: return [a, b / 2 + a, a]; // capsule
  }
}

// Moves the parts so the object sits on its surface (or hangs flat on a wall) and works out how much to shrink it.
function fit(parts, kind, lim = {}) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    let e = halfSize(p);
    if (p.rot.some((r) => r)) e = e.map(() => Math.max(...e)); // turned parts: use their biggest size every way
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p.pos[i] - e[i]);
      max[i] = Math.max(max[i], p.pos[i] + e[i]);
    }
  }
  const [w, h, d] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const L = { ...LIMITS[kind], ...lim };
  const scale = Math.min(1, L.w / w, L.h / h, L.d / d);
  const cx = (min[0] + max[0]) / 2;
  const cy = kind === 'wall' ? (min[1] + max[1]) / 2 : min[1]; // wall things: middle at the spot; others: bottom on the surface
  const cz = kind === 'wall' ? min[2] : (min[2] + max[2]) / 2; // wall things: back against the wall
  for (const p of parts) p.pos = [r3(p.pos[0] - cx), r3(p.pos[1] - cy), r3(p.pos[2] - cz)];
  return Math.floor(scale * 1000) / 1000; // rounded down, so a limit is never exceeded by a hair
}

const usedSlots = (decor, zone) => new Set(decor.filter((d) => d.zone === zone).map((d) => d.slot));

export function freePlaces(decor) {
  return Object.entries(ZONES).filter(([, z]) => !z.prints).map(([zone, z]) => ({ zone, label: z.label, free: z.slots.length - usedSlots(decor, zone).size }));
}

// "on the piano", "piano" or "on_piano" all find the same spot.
function findZone(where) {
  const w = str(where, 80).toLowerCase().replace(/_/g, ' ');
  if (!w) return null;
  for (const [key, z] of Object.entries(ZONES)) if (w === key.replace(/_/g, ' ') || w === z.label) return key;
  const words = [
    ['piano', 'on_piano'], ['bookshelf', 'on_bookshelf'], ['shelf', 'on_bookshelf'], ['desk', 'on_desk'], ['computer', 'on_desk'], ['bed', 'on_bed'],
    ['photo wall', 'wall_desk'], ['printer', 'wall_desk'], ['left wall', 'wall_left'], ['back wall', 'wall_back'], ['wall', 'wall_back'], ['window', 'floor_under_window'],
    ['middle', 'floor_middle'], ['rug', 'floor_middle'], ['center', 'floor_middle'], ['centre', 'floor_middle'],
    ['front', 'floor_front'], ['right', 'floor_right'], ['corner', 'floor_left_wall'],
  ];
  return words.find(([k]) => w.includes(k))?.[1] ?? null;
}

// Puts a finished design into the room: his spot first, then another of the same kind, then anywhere with room.
// `spec` is { name, why, project, where, parts } with clean parts. Does not change `decor`.
function placeParts(decor, spec, atMs, now) {
  if (decor.length >= capOf(decor)) return { failed: FULL };
  const parts = spec.parts.map((p) => ({ ...p, size: [...p.size], pos: [...p.pos], rot: [...p.rot] })); // fit() moves things, so work on a copy
  const want = findZone(spec.where);
  const dest = placeWhere(decor, spec, parts, want, atMs, now);
  return dest;
}

// Pip's new object, made in one go, or the reason it did not work out. Does not change `decor`.
export function makeDecor(decor, details, atMs, now = Date.now()) {
  const d = details && typeof details === 'object' ? details : {};
  const name = str(d.name, 60);
  if (!name) return { failed: 'he did not give it a name' };
  if (decor.filter((x) => !x.image && now - Date.parse(x.createdAt) < 86_400_000).length >= MAX_PER_DAY) return { failed: 'he has already made enough for today' };
  if (decor.length >= capOf(decor)) return { failed: FULL };
  const parts = cleanParts(d.parts);
  if (!parts) return { failed: 'the shapes did not work out' };
  return placeParts(decor, { name, why: str(d.why, 200), project: str(d.project, 80), where: d.where, parts, song: cleanSong(d.song), uses: d.uses, tool: toolKind(d.tool), x: d.x, z: d.z, on: d.on, wall: d.wall, along: d.along, height: d.height }, atMs, now);
}

// ---- The chest: things he does not want in the room right now are kept, not deleted.
export const MAX_STORED = 20;

export function storeAway(decor, stored, name, now = Date.now()) {
  const n = str(name, 60).toLowerCase();
  const mine = (x) => !x.image;
  let i = n ? decor.findIndex((x) => mine(x) && x.name.toLowerCase() === n) : -1;
  if (i < 0 && n) i = decor.findIndex((x) => mine(x) && (x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())));
  if (i < 0) return { failed: 'there is nothing with that name in his room' };
  if (stored.length >= MAX_STORED) return { failed: 'his chest is full' };
  if (decor.some((x) => x.base === decor[i].id)) return { failed: 'there are still things standing on it. He takes them off first' };
  const [e] = decor.splice(i, 1);
  stored.push({ ...e, storedAt: new Date(now).toISOString() });
  return { stored: e.name };
}

export function takeOut(decor, stored, name, where, atMs, now = Date.now()) {
  const n = str(name, 60).toLowerCase();
  let i = n ? stored.findIndex((x) => x.name.toLowerCase() === n) : -1;
  if (i < 0 && n) i = stored.findIndex((x) => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()));
  if (i < 0) return { failed: 'there is nothing with that name in his chest' };
  const e = stored[i];
  const r = placeParts(decor, { name: e.name, why: e.why, project: e.project, where: where || e.zone, parts: e.parts, song: e.song, uses: e.uses, tool: e.tool }, atMs, now);
  if (r.entry) {
    r.entry.createdAt = e.createdAt; // it is still the thing he made back then
    stored.splice(i, 1);
  }
  return r;
}

// ---- Tools: they live in his inventory. He can stand one in his room, and take it back.
const PLAIN_TOOL = [{ shape: 'box', size: [0.22, 0.1, 0.16], pos: [0, 0.05, 0], color: '#c9a46a', rot: [0, 0, 0] }];
export function placeTool(decor, tools, name, where, atMs, now = Date.now()) {
  const n = str(name, 60).toLowerCase();
  const i = n ? tools.findIndex((x) => x.name.toLowerCase() === n || x.kind === n || x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())) : -1;
  if (i < 0) return { failed: 'there is no tool with that name in his inventory' };
  const t = tools[i];
  const parts = Array.isArray(t.parts) && t.parts.length ? t.parts : PLAIN_TOOL;
  const r = placeParts(decor, { name: t.name, why: t.why || '', project: '', where, parts, song: null, uses: [], tool: t.kind }, atMs, now);
  if (r.entry) tools.splice(i, 1);
  return r;
}

export function takeTool(decor, stored, tools, name, maxTools, now = Date.now()) {
  const n = str(name, 60).toLowerCase();
  if (!n) return { failed: 'he did not say which tool' };
  const match = (x) => x.tool && (x.name.toLowerCase() === n || x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()) || x.tool === n);
  if (tools.length >= maxTools) return { failed: 'his inventory is full' };
  let from = decor;
  let i = decor.findIndex(match);
  if (i < 0) {
    from = stored;
    i = stored.findIndex(match);
  }
  if (i < 0) return { failed: 'there is no tool with that name in his room or chest' };
  const [e] = from.splice(i, 1);
  tools.push({ id: `t${now.toString(36)}${tools.length}`, name: e.name, kind: e.tool, source: 'made', why: e.why || '', parts: e.parts ?? null, at: new Date(now).toISOString() });
  return { name: e.name, kind: e.tool };
}

// Pip takes something away. Returns the removed object, or null.
export function removeDecor(decor, name) {
  const n = str(name, 60).toLowerCase();
  if (!n) return null;
  const i = decor.findIndex((x) => x.name.toLowerCase() === n) >= 0 ? decor.findIndex((x) => x.name.toLowerCase() === n) : decor.findIndex((x) => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()));
  return i >= 0 ? decor.splice(i, 1)[0] : null;
}

// ---- Pictures from Bas. Pip decides if one goes on a wall or stands on a piece of furniture.
const PICTURE_MAX = { wall: [0.9, 0.7], surface: [0.45, 0.35] };
export const ART_MAX = { wall: [1.5, 1.2], surface: [0.5, 0.4] }; // Pip's own drawings may be bigger

export function placePicture(decor, pic, where, atMs, now = Date.now(), max = PICTURE_MAX) {
  if (!pic || !pic.image) return { failed: 'he does not have that picture' };
  if (decor.some((x) => x.picture === pic.id)) return { failed: 'that picture is already up' };
  if (decor.length >= capOf(decor)) return { failed: FULL };
  const usable = Object.keys(ZONES).filter((k) => !ZONES[k].prints && (ZONES[k].kind === 'wall' || ZONES[k].kind === 'surface'));
  const want = findZone(where);
  const first = want && usable.includes(want) ? want : null;
  const kind = first ? ZONES[first].kind : 'wall';
  const order = [...(first ? [first] : []), ...usable.filter((k) => k !== first && ZONES[k].kind === kind), ...usable.filter((k) => k !== first && ZONES[k].kind !== kind)];
  let zone = null;
  let slot = -1;
  for (const k of order) {
    const used = usedSlots(decor, k);
    const i = ZONES[k].slots.findIndex((_, n) => !used.has(n));
    if (i >= 0) {
      zone = k;
      slot = i;
      break;
    }
  }
  if (!zone) return { failed: 'there is no free spot left for it' };
  const Z = ZONES[zone];
  const [sx, sy, sz] = Z.slots[slot];
  const [maxW, maxH] = max[Z.kind];
  const aspect = pic.aspect > 0.2 && pic.aspect < 5 ? pic.aspect : 1.5;
  const w = Math.min(maxW, maxH * aspect);
  const h = w / aspect;
  const clampRoom = (v) => r3(Math.min(4.5, Math.max(-4.5, v)));
  const stand = Z.kind === 'wall' ? (Z.side === 'back' ? [sx, -3.7] : [-3.7, sz]) : [clampRoom(sx + Z.off[0]), clampRoom(sz + Z.off[1])];
  return {
    entry: {
      id: `p${now.toString(36)}${decor.length}`,
      name: str(pic.caption, 60).length <= 40 && str(pic.caption, 60) ? str(pic.caption, 60) : 'a picture', // a long message is not a good name for a frame
      why: '',
      project: '',
      zone,
      slot,
      label: Z.label,
      kind: Z.kind,
      pos: [sx, Z.kind === 'surface' ? sy + h / 2 + 0.03 : sy, sz],
      rotY: Z.rotY,
      scale: 1,
      parts: [],
      image: pic.image,
      size: [r3(w), r3(h)],
      picture: pic.id,
      stand,
      at: new Date(atMs + 6000).toISOString(),
      createdAt: new Date(now).toISOString(),
    },
  };
}

// A small paper print from his photo printer. It goes on the photo wall above his desk (8 places), or a small spot he names.
export const PRINT_MAX = { wall: [0.42, 0.42], surface: [0.3, 0.3] };
export const MAX_PRINTS = 8;
export function printPhoto(decor, pic, where, atMs, now = Date.now()) {
  if (!pic || !pic.image) return { failed: 'I do not have that picture' };
  const key = `print:${pic.id}`;
  if (decor.some((x) => x.picture === key)) return { failed: 'I already printed that one and it is still up' };
  if (decor.length >= capOf(decor)) return { failed: FULL };
  const usable = Object.keys(ZONES).filter((k) => ZONES[k].kind === 'wall' || ZONES[k].kind === 'surface');
  const want = findZone(where);
  // By default a print goes on the photo wall. A spot he names comes first; when the wall is full and he named nothing, he takes one down first.
  const named = want && want !== 'wall_desk' && usable.includes(want) ? want : null;
  const order = named ? [named, 'wall_desk'] : ['wall_desk'];
  let zone = null;
  let slot = -1;
  for (const k of order) {
    const used = usedSlots(decor, k);
    const i = ZONES[k].slots.findIndex((_, n) => !used.has(n));
    if (i >= 0) {
      zone = k;
      slot = i;
      break;
    }
  }
  if (!zone) return { failed: 'my photo wall is full: I can take a print down first (take_down_picture with its id)' };
  const Z = ZONES[zone];
  const [sx, sy, sz] = Z.slots[slot];
  const [maxW, maxH] = PRINT_MAX[Z.kind];
  const aspect = pic.aspect > 0.2 && pic.aspect < 5 ? pic.aspect : 1.33;
  const w = Math.min(maxW, maxH * aspect);
  const h = w / aspect;
  const clampRoom = (v) => r3(Math.min(4.5, Math.max(-4.5, v)));
  const stand = Z.kind === 'wall' ? (Z.side === 'back' ? [sx, -3.7] : [-3.7, sz]) : [clampRoom(sx + Z.off[0]), clampRoom(sz + Z.off[1])];
  const cap = str(pic.caption, 60);
  return {
    entry: {
      id: `p${now.toString(36)}${decor.length}`,
      name: cap && cap.length <= 40 ? cap : 'a small print',
      why: '',
      project: '',
      zone,
      slot,
      label: Z.label,
      kind: Z.kind,
      pos: [sx, Z.kind === 'surface' ? sy + h / 2 + 0.03 : sy, sz],
      rotY: Z.rotY,
      scale: 1,
      parts: [],
      image: pic.image,
      size: [r3(w), r3(h)],
      picture: key,
      print: true,
      stand,
      at: new Date(atMs + 6000).toISOString(),
      createdAt: new Date(now).toISOString(),
    },
  };
}

// Takes a picture down again (it stays in his album). Returns the removed frame or null.
export function removePicture(decor, id) {
  const i = decor.findIndex((x) => x.picture === id);
  return i >= 0 ? decor.splice(i, 1)[0] : null;
}

// Gives a thing he already made a song (or a new one). Returns { name } or { failed }.
export function composeSong(decor, name, rawSong) {
  const song = cleanSong(rawSong);
  if (!song) return { failed: 'the notes did not work out' };
  const n = str(name, 60).toLowerCase();
  const mine = (x) => !x.image;
  let e = n ? decor.find((x) => mine(x) && x.name.toLowerCase() === n) : null;
  if (!e && n) e = decor.find((x) => mine(x) && (x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())));
  if (!e) return { failed: 'there is nothing with that name in his room' };
  e.song = song;
  return { name: e.name, song };
}

// ---- Changing something he already made: new shapes (it keeps its place, uses and song), or a new reason.
export const MAX_UPDATES_PER_DAY = 6;

export function updateDecor(decor, details, atMs, now = Date.now()) {
  const d = details && typeof details === 'object' ? details : {};
  const n = str(d.name, 60).toLowerCase();
  const mine = (x) => !x.image && !x.art && x.zone;
  let e = n ? decor.find((x) => mine(x) && x.name.toLowerCase() === n) : null;
  if (!e && n) e = decor.find((x) => mine(x) && (x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())));
  if (!e) return { failed: 'there is nothing with that name in his room' };
  if (decor.filter((x) => x.updatedAt && now - Date.parse(x.updatedAt) < 86_400_000).length >= MAX_UPDATES_PER_DAY) return { failed: 'he has already changed enough things today' };
  const parts = cleanParts(d.parts);
  const why = str(d.why, 200);
  const grow = Number(d.bigger ?? d.scale);
  const factor = !parts && Number.isFinite(grow) && grow > 0 ? Math.min(2, Math.max(0.5, grow)) : null; // "make it bigger" without drawing it again
  if (!parts && !why && !factor) return { failed: 'he did not say what to change' };
  let limited = false;
  if (parts || factor) {
    const Z = ZONES[e.zone];
    const before = { parts: e.parts, scale: e.scale };
    const next = parts ?? e.parts.map((p) => ({ ...p, size: p.size.map((v) => r3(v * factor)), pos: p.pos.map((v) => r3(v * factor)), rot: [...p.rot] }));
    e.scale = fit(next, Z.kind, Z.lim);
    e.parts = next;
    limited = e.scale < 1 && (Boolean(factor) && factor > 1);
    const hit = e.kind === 'floor' ? roomToGrow(decor, e) : null;
    if (hit) {
      Object.assign(e, before);
      return { failed: `there is not enough free floor around it (it would touch ${hit}). It needs a bigger spot` };
    }
  }
  if (why) e.why = why;
  e.updatedAt = new Date(atMs + 6000).toISOString(); // the page shows the change a few seconds into his step
  return { name: e.name, entry: e, reshaped: Boolean(parts || factor), grew: factor, limited, label: ZONES[e.zone].label };
}

// ---- Moving things. His chest is a piece of furniture he can move too (decor never overlaps it by much, but it is not checked).
export const CHEST_HOME = { x: -4.1, z: 3.9, rotY: 0 };
export const MAX_MOVES_PER_DAY = 8;
const CHEST_BOUNDS = { x: [-4.45, 4.45], z: [-4.4, 4.45] };
// Things stand square to the walls, never diagonal. Next to a wall they face into the room.
export function wallFacing(x, z) {
  if (x <= -3.9) return Math.PI / 2;
  if (x >= 3.9) return -Math.PI / 2;
  if (z >= 3.9) return Math.PI;
  return 0;
}
// Older saves have things at an angle: turn them square to the wall. Returns true when something changed.
export function squareUp(s, now = new Date().toISOString()) {
  let changed = false;
  for (const d of s.decor ?? []) {
    const z = ZONES[d.zone];
    if (z && z.kind !== 'wall' && !d.free && !d.image && Math.abs((d.rotY ?? 0) - z.rotY) > 0.01) {
      d.rotY = z.rotY;
      d.updatedAt = now;
      changed = true;
    }
  }
  if (s.chest && Math.abs((s.chest.rotY ?? 0) - wallFacing(s.chest.x, s.chest.z)) > 0.01) {
    s.chest.rotY = wallFacing(s.chest.x, s.chest.z);
    changed = true;
  }
  return changed;
}
const clampTo = ([lo, hi], v) => r3(Math.min(hi, Math.max(lo, v)));

// details: { name, where, dx, dz }. `chest` is state.chest (or null). Returns { name, entry } for a thing, { name, chest } for the chest, or { failed }.
export function moveThing(decor, chest, details, atMs, now = Date.now()) {
  const d = details && typeof details === 'object' ? details : {};
  const n = str(d.name, 60).toLowerCase();
  if (!n) return { failed: 'he did not say what to move' };
  const dx = Math.min(2, Math.max(-2, Number(d.dx) || 0));
  const dz = Math.min(2, Math.max(-2, Number(d.dz) || 0));
  const want = findZone(d.where);
  const hasXZ = d.x !== undefined && d.z !== undefined && d.x !== null && d.z !== null && d.x !== '' && d.z !== '' && Number.isFinite(Number(d.x)) && Number.isFinite(Number(d.z));
  if (!want && !dx && !dz && !hasXZ && !d.on && !d.wall && num2(d.along) === null && num2(d.height) === null) return { failed: 'he did not say where to move it' };
  if ((chest?.moves ?? []).filter((m) => now - Date.parse(m) < 86_400_000).length + decor.filter((x) => x.movedAt && now - Date.parse(x.movedAt) < 86_400_000).length >= MAX_MOVES_PER_DAY) return { failed: 'he has already moved enough things today' };
  const at = new Date(atMs + 6000).toISOString();
  const floorBlocked = (x, z, skip) => decor.some((o) => o !== skip && o.kind === 'floor' && Math.hypot(o.pos[0] - x, o.pos[2] - z) < 0.8);

  if (/chest/.test(n)) {
    const cur = chest ?? CHEST_HOME;
    let { x, z, rotY } = cur;
    if (hasXZ) {
      const f = faceAndSnap(0.5, 0.3, clampTo(CHEST_BOUNDS.x, Number(d.x)), clampTo(CHEST_BOUNDS.z, Number(d.z)));
      const hit = blocker(rectAt([0.5, 0.3], f.x, f.z, f.rotY), obstacles(decor, null, false));
      if (hit) return { failed: `the chest does not fit there (it would touch ${hit})` };
      ({ x, z, rotY } = f);
      const moves = [...(chest?.moves ?? []).filter((m) => now - Date.parse(m) < 86_400_000), new Date(now).toISOString()];
      return { name: 'chest', chest: { x, z, rotY, at, moves } };
    }
    if (want && ZONES[want].kind === 'floor') {
      const used = usedSlots(decor, want);
      const i = ZONES[want].slots.findIndex((_, k) => !used.has(k));
      if (i < 0) return { failed: 'there is no free place there for the chest' };
      [x, , z] = ZONES[want].slots[i];
    } else if (want) return { failed: 'the chest can only stand on the floor' };
    x = clampTo(CHEST_BOUNDS.x, x + dx);
    z = clampTo(CHEST_BOUNDS.z, z + dz);
    if (floorBlocked(x, z, null)) return { failed: 'something is already standing there' };
    rotY = wallFacing(x, z);
    const hit = blocker(rectAt([0.5, 0.3], x, z, rotY), obstacles(decor, null, false));
    if (hit) return { failed: `the chest does not fit there (it would touch ${hit})` };
    const moves = [...(chest?.moves ?? []).filter((m) => now - Date.parse(m) < 86_400_000), new Date(now).toISOString()];
    return { name: 'chest', chest: { x, z, rotY, at, moves } };
  }

  const mine = (x) => !x.image && !x.art && x.zone;
  let e = decor.find((x) => mine(x) && x.name.toLowerCase() === n) ?? decor.find((x) => mine(x) && (x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())));
  if (!e) return { failed: 'there is nothing with that name in his room' };
  if (want && ZONES[want].kind !== e.kind) return { failed: `it cannot go there: it is a ${e.kind} thing` };
  const keep = (r) => {
    Object.assign(e, { ...r.entry, id: e.id, createdAt: e.createdAt, at: e.at, uses: e.uses, song: e.song, tool: e.tool, project: e.project, why: e.why });
    e.movedAt = at;
    e.updatedAt = at;
    return { name: e.name, entry: e, label: e.label };
  };
  const copy = () => e.parts.map((p) => ({ ...p, size: [...p.size], pos: [...p.pos], rot: [...p.rot] }));
  if (e.kind === 'wall' && (d.wall || num2(d.along) !== null || num2(d.height) !== null)) {
    const r = placeWall(decor.filter((o) => o !== e), e, copy(), sideOf(d.wall) ?? e.side ?? ZONES[e.zone]?.side ?? 'back', [num2(d.along) ?? (e.side === 'left' ? e.pos[2] : e.pos[0]), num2(d.height) ?? e.pos[1]], atMs, now, true);
    return r.failed ? r : keep(r);
  }
  if (e.kind === 'surface' && (d.on || hasXZ)) {
    const base = d.on ? findBase(decor, d.on) : baseByKey(decor, baseKeyOf(e));
    if (!base) return { failed: 'he cannot put it on that: the desk, piano, bookshelf, bed, or a thing he made on the floor will do' };
    const r = placeOn(decor.filter((o) => o !== e), e, copy(), base, hasXZ ? { x: Number(d.x), z: Number(d.z) } : null, atMs, now, true);
    return r.failed ? r : keep(r);
  }
  if (e.kind === 'floor' && (hasXZ || dx || dz || (want && ZONES[want].kind === 'floor'))) {
    const target = hasXZ ? { x: Number(d.x), z: Number(d.z) } : dx || dz ? { x: e.pos[0] + dx, z: e.pos[2] + dz } : null;
    const anchor = target ? [target.x, target.z] : (ZONES[want].slots[0] ?? [0, 0, 0]).filter((_, i) => i !== 1);
    const parts = e.parts.map((p) => ({ ...p, size: [...p.size], pos: [...p.pos], rot: [...p.rot] }));
    const r = placeFloor(decor.filter((o) => o !== e), { ...e, parts, name: e.name }, parts, target, anchor, atMs, now, true);
    if (r.failed) return r;
    const was = [...e.pos];
    Object.assign(e, { ...r.entry, id: e.id, createdAt: e.createdAt, at: e.at, uses: e.uses, song: e.song, tool: e.tool, project: e.project, why: e.why });
    for (const o of decor.filter((x) => x.base === e.id)) { // things standing on top of it go along
      o.pos = [r3(o.pos[0] + e.pos[0] - was[0]), o.pos[1], r3(o.pos[2] + e.pos[2] - was[2])];
      o.stand = [r3(o.stand[0] + e.pos[0] - was[0]), r3(o.stand[1] + e.pos[2] - was[2])];
      o.label = `on ${e.name} (x ${o.pos[0]}, z ${o.pos[2]})`;
      o.updatedAt = at;
    }
    e.movedAt = at;
    e.updatedAt = at;
    return { name: e.name, entry: e, label: e.label };
  }
  const clampRoom = (v) => r3(Math.min(4.5, Math.max(-4.5, v)));
  if (want && want !== e.zone) {
    const used = usedSlots(decor, want);
    const i = ZONES[want].slots.findIndex((_, k) => !used.has(k));
    if (i < 0) return { failed: 'there is no free spot there' };
    const Z = ZONES[want];
    const parts = e.parts.map((p) => ({ ...p, size: [...p.size], pos: [...p.pos], rot: [...p.rot] }));
    e.scale = fit(parts, Z.kind, Z.lim);
    e.parts = parts;
    const [sx, sy, sz] = Z.slots[i];
    Object.assign(e, { zone: want, slot: i, label: Z.label, pos: [sx, sy, sz], rotY: Z.rotY, stand: Z.kind === 'wall' ? (Z.side === 'back' ? [sx, -3.7] : [-3.7, sz]) : [clampRoom(sx + Z.off[0]), clampRoom(sz + Z.off[1])] });
  }
  if ((dx || dz) && e.kind === 'floor') {
    const nx = clampRoom(e.pos[0] + dx);
    const nz = clampRoom(e.pos[2] + dz);
    if (floorBlocked(nx, nz, e)) return { failed: 'something is already standing there' };
    e.pos = [nx, e.pos[1], nz];
    e.stand = [clampRoom(nx + (ZONES[e.zone]?.off?.[0] ?? 0)), clampRoom(nz + (ZONES[e.zone]?.off?.[1] ?? 1.1))];
  } else if (dx || dz) return { failed: 'only things on the floor can be moved a little' };
  e.movedAt = at;
  e.updatedAt = at;
  return { name: e.name, entry: e, label: e.label };
}

// ---- Building big things step by step: more parts are added to something he already made, a few wake-ups in a row.
export const MAX_TOTAL_PARTS = 160;

// How big a thing is now (width, height, depth), after it was scaled to fit its spot.
export function sizeOf(e) {
  if (!e?.parts?.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of e.parts) {
    const h = halfSize(p);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p.pos[i] - h[i]);
      max[i] = Math.max(max[i], p.pos[i] + h[i]);
    }
  }
  return [0, 1, 2].map((i) => r3((max[i] - min[i]) * (e.scale || 1)));
}

export function extendThing(decor, details, atMs, now = Date.now()) {
  const d = details && typeof details === 'object' ? details : {};
  const n = str(d.name, 60).toLowerCase();
  const mine = (x) => !x.image && !x.art && x.zone;
  const e = (n ? decor.find((x) => mine(x) && x.name.toLowerCase() === n) : null) ?? (n ? decor.find((x) => mine(x) && (x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()))) : null);
  if (!e) return { failed: 'there is nothing with that name in his room' };
  if (decor.filter((x) => x.updatedAt && now - Date.parse(x.updatedAt) < 86_400_000).length >= MAX_UPDATES_PER_DAY) return { failed: 'he has already changed enough things today' };
  const parts = cleanParts(d.parts);
  if (!parts) return { failed: 'the new shapes did not work out' };
  const room = MAX_TOTAL_PARTS - e.parts.length;
  if (room <= 0) return { failed: `it already has the most parts a thing can have (${MAX_TOTAL_PARTS})` };
  const added = parts.slice(0, room);
  const all = [...e.parts, ...added];
  const Z = ZONES[e.zone];
  const before = { parts: e.parts, scale: e.scale };
  e.scale = fit(all, Z.kind, Z.lim);
  e.parts = all;
  const hit = e.kind === 'floor' ? roomToGrow(decor, e) : null;
  if (hit) {
    Object.assign(e, before);
    return { failed: `there is not enough free floor around it (it would touch ${hit}). It needs a bigger spot` };
  }
  e.updatedAt = new Date(atMs + 6000).toISOString();
  return { name: e.name, entry: e, added: added.length, total: all.length };
}

// ---- Free floor space: Pip puts things where he wants. They only have to fit: not into furniture, not into each other, not through a wall.
export const FIXED = [
  { n: 'the piano', x0: -3.95, x1: -1.25, z0: -5, z1: -3.55 },
  { n: 'the piano stool', x0: -2.95, x1: -2.25, z0: -3.5, z1: -2.8 },
  { n: 'the bookshelf', x0: 1.55, x1: 3.65, z0: -5, z1: -4.3 },
  { n: 'the desk', x0: -5, x1: -3.6, z0: 0.1, z1: 2.3 },
  { n: 'the bed', x0: 2.2, x1: 4.6, z0: 1.3, z1: 4.7 },
  { n: 'the plant', x0: 3.6, x1: 4.6, z0: -4.6, z1: -3.6 },
];
const EDGE = 4.95;
let chestNow = null;
export const setChest = (c) => {
  chestNow = c;
};

function halfFoot(parts, scale = 1) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of parts) {
    let e = halfSize(p);
    if (p.rot.some((r) => r)) e = e.map(() => Math.max(...e));
    x0 = Math.min(x0, p.pos[0] - e[0]); x1 = Math.max(x1, p.pos[0] + e[0]);
    z0 = Math.min(z0, p.pos[2] - e[2]); z1 = Math.max(z1, p.pos[2] + e[2]);
  }
  return [((x1 - x0) / 2) * scale, ((z1 - z0) / 2) * scale];
}
const footOf = (e) => (e.parts?.length ? halfFoot(e.parts, e.scale || 1) : [0.3, 0.3]);
export function rectAt([hw, hd], x, z, rotY) {
  const turned = Math.abs(Math.sin(rotY || 0)) > 0.7;
  const [a, b] = turned ? [hd, hw] : [hw, hd];
  return { x0: x - a, x1: x + a, z0: z - b, z1: z + b };
}
export function obstacles(decor, skip = null, withChest = true) {
  const list = [...FIXED, ...decor.filter((o) => o !== skip && o.kind === 'floor' && !o.image && o.pos).map((o) => ({ n: o.name, ...rectAt(footOf(o), o.pos[0], o.pos[2], o.rotY) }))];
  if (withChest) {
    const c = chestNow ?? CHEST_HOME;
    list.push({ n: 'the chest', ...rectAt([0.5, 0.3], c.x, c.z, c.rotY) });
  }
  return list;
}
export function blocker(r, obs, gap = 0.2) {
  if (r.x0 < -EDGE || r.x1 > EDGE || r.z0 < -EDGE || r.z1 > EDGE) return 'the wall';
  return obs.find((o) => r.x0 < o.x1 + gap && r.x1 + gap > o.x0 && r.z0 < o.z1 + gap && r.z1 + gap > o.z0)?.n ?? null;
}
// Next to a wall a thing turns to face into the room and stands flush against it. In the middle it faces the front.
function faceAndSnap(hw, hd, x, z) {
  const dist = { left: x + 5, right: 5 - x, back: z + 5, front: 5 - z };
  const [wall, d] = Object.entries(dist).sort((a, b) => a[1] - b[1])[0];
  const near = d <= 1.6;
  const rotY = near ? { left: Math.PI / 2, right: -Math.PI / 2, back: 0, front: Math.PI }[wall] : 0;
  const r = rectAt([hw, hd], x, z, rotY);
  const gap = { left: r.x0 + 5, right: 5 - r.x1, back: r.z0 + 5, front: 5 - r.z1 }[wall];
  if (near && gap > 0 && gap <= 0.6) {
    const s = gap - 0.06;
    if (wall === 'left') x -= s;
    if (wall === 'right') x += s;
    if (wall === 'back') z -= s;
    if (wall === 'front') z += s;
  }
  return { rotY, x: r3(x), z: r3(z) };
}
// Is there room for e as it is now (after it got bigger)?
function roomToGrow(decor, e) {
  if (e.kind === 'floor') {
    const [hw, hd] = footOf(e);
    return blocker(rectAt([hw, hd], e.pos[0], e.pos[2], e.rotY), obstacles(decor, e));
  }
  if (!e.free) return null;
  if (e.kind === 'wall') {
    const [hw, hh] = halfWall(e.parts, e.scale || 1);
    const a = e.side === 'back' ? e.pos[0] : e.pos[2];
    return wallBlocker({ a0: a - hw, a1: a + hw, y0: e.pos[1] - hh, y1: e.pos[1] + hh }, wallObstacles(decor, e.side, e));
  }
  if (e.kind === 'surface') {
    const base = baseByKey(decor, e.base);
    if (!base) return null;
    const r = rectAt(footOf(e), e.pos[0], e.pos[2], e.rotY);
    if (r.x0 < base.x0 || r.x1 > base.x1 || r.z0 < base.z0 || r.z1 > base.z1) return `the edge of ${base.n}`;
    return surfaceOthers(decor, base.key, e).find((o) => r.x0 < o.x1 + 0.05 && r.x1 + 0.05 > o.x0 && r.z0 < o.z1 + 0.05 && r.z1 + 0.05 > o.z0)?.n ?? null;
  }
  return null;
}
function spotLabel(x, z) {
  const side = { 'the left wall': x + 5, 'the right wall': 5 - x, 'the back wall': z + 5, 'the front wall': 5 - z };
  const [name, d] = Object.entries(side).sort((a, b) => a[1] - b[1])[0];
  return d <= 1.6 ? `on the floor by ${name} (x ${r3(x)}, z ${r3(z)})` : `on the floor (x ${r3(x)}, z ${r3(z)})`;
}

// Finds a place on the floor: exactly where he said, else the nearest free place (within 1.5 m when he named a spot, anywhere when he did not).
function placeFloor(decor, spec, parts, want, anchor, atMs, now, moving = false) {
  const scale = fit(parts, 'floor', {});
  const [hw, hd] = halfFoot(parts, scale);
  const obs = obstacles(decor, null, true);
  const tryAt = (x, z) => {
    const f = faceAndSnap(hw, hd, Math.min(EDGE, Math.max(-EDGE, x)), Math.min(EDGE, Math.max(-EDGE, z)));
    return blocker(rectAt([hw, hd], f.x, f.z, f.rotY), obs) ? null : f;
  };
  const [tx, tz] = want ? [want.x, want.z] : anchor;
  let found = tryAt(tx, tz);
  let moved = false;
  if (!found) {
    const grid = [];
    for (let gx = -4.9; gx <= 4.91; gx += 0.25) for (let gz = -4.9; gz <= 4.91; gz += 0.25) grid.push([gx, gz, Math.hypot(gx - tx, gz - tz)]);
    grid.sort((a, b) => a[2] - b[2]);
    for (const [gx, gz, dist] of grid) {
      if (want && dist > 1.5) break;
      found = tryAt(gx, gz);
      if (found) {
        moved = true;
        break;
      }
    }
  }
  if (!found) {
    const f = faceAndSnap(hw, hd, Math.min(EDGE, Math.max(-EDGE, tx)), Math.min(EDGE, Math.max(-EDGE, tz)));
    const hit = want ? blocker(rectAt([hw, hd], f.x, f.z, f.rotY), obs) : null;
    return { failed: want ? `it does not fit there: it is about ${r3(hw * 2)} x ${r3(hd * 2)} m and would touch ${hit}, and there is no free place close by` : `there is no free floor space for something about ${r3(hw * 2)} x ${r3(hd * 2)} m. He can put things in his chest, make something smaller, build storage, or ask for more space` };
  }
  const front = Math.abs(Math.sin(found.rotY)) > 0.7 ? hw : hd; // half depth along the way it faces
  const sx = Math.sin(found.rotY);
  const sz = Math.cos(found.rotY);
  const clampRoom = (v) => r3(Math.min(4.5, Math.max(-4.5, v)));
  return {
    moved,
    entry: {
      id: `d${now.toString(36)}${decor.length}`,
      name: spec.name,
      why: spec.why,
      project: spec.project,
      song: spec.song ?? null,
      uses: moving ? spec.uses : storedUses(spec.uses),
      tool: spec.tool ?? null,
      zone: 'floor',
      slot: null,
      free: true,
      label: spotLabel(found.x, found.z),
      kind: 'floor',
      pos: [found.x, 0, found.z],
      rotY: found.rotY,
      scale,
      parts,
      stand: [clampRoom(found.x + sx * (front + 0.9)), clampRoom(found.z + sz * (front + 0.9))],
      at: new Date(atMs + 6000).toISOString(),
      createdAt: new Date(now).toISOString(),
    },
  };
}

// A picture of the room in text, so he can see what stands where. Every character is half a metre.
export function roomMap(decor) {
  const symbols = { 'the piano': 'P', 'the piano stool': 'o', 'the bookshelf': 'B', 'the desk': 'D', 'the bed': 'E', 'the plant': 'L', 'the chest': 'C' };
  const mine = decor.filter((o) => o.kind === 'floor' && !o.image && o.pos);
  const marks = '123456789abcdefghijklmnopqrstuvwxyz';
  const obs = obstacles(decor, null, true);
  const legend = [];
  mine.forEach((o, i) => {
    const sym = marks[i] ?? '#';
    symbols[o.name + '#' + i] = sym;
    legend.push(`${sym} = ${o.name}`);
  });
  const named = obs.map((o, i) => ({ ...o, sym: i < FIXED.length ? symbols[o.n] : o.n === 'the chest' ? 'C' : symbols[`${o.n}#${i - FIXED.length}`] ?? '#' }));
  const rows = [];
  for (let z = -4.75; z < 5; z += 0.5) {
    let row = '';
    for (let x = -4.75; x < 5; x += 0.5) row += named.find((o) => x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1)?.sym ?? '.';
    rows.push(row);
  }
  return { rows, legend };
}
// How full his room is.
export function crowding(decor) {
  const cap = capOf(decor);
  const used = obstacles(decor, null, true).slice(FIXED.length).reduce((a, o) => a + (o.x1 - o.x0) * (o.z1 - o.z0), 0);
  const fixed = FIXED.reduce((a, o) => a + (o.x1 - o.x0) * (o.z1 - o.z0), 0);
  const free = Math.max(0, 1 - used / (9.9 * 9.9 - fixed));
  return { count: decor.length, cap, free: Math.round(free * 100) };
}

// ---- Walls and furniture tops: free too.
const WALL_FIXED = {
  back: [
    { n: 'the window', a0: -0.95, a1: 1.55, y0: 1.7, y1: 4.1 },
    { n: 'the framed photo', a0: -3.1, a1: -1.3, y0: 2.1, y1: 3.4 },
    { n: 'the piano', a0: -3.95, a1: -1.25, y0: 0, y1: 1.5 },
    { n: 'the bookshelf', a0: 1.55, a1: 3.65, y0: 0, y1: 3.1 },
    { n: 'the plant', a0: 3.6, a1: 4.6, y0: 0, y1: 1.6 },
  ],
  left: [{ n: 'the desk and screen', a0: 0.1, a1: 2.3, y0: 0, y1: 1.95 }],
};
const WALL_TOP = 4.8;
function halfWall(parts, scale = 1) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of parts) {
    let e = halfSize(p);
    if (p.rot.some((r) => r)) e = e.map(() => Math.max(...e));
    x0 = Math.min(x0, p.pos[0] - e[0]); x1 = Math.max(x1, p.pos[0] + e[0]);
    y0 = Math.min(y0, p.pos[1] - e[1]); y1 = Math.max(y1, p.pos[1] + e[1]);
  }
  return [((x1 - x0) / 2) * scale, ((y1 - y0) / 2) * scale];
}
function wallObstacles(decor, side, skip = null) {
  const list = [...(WALL_FIXED[side] ?? [])];
  for (const o of decor) {
    if (o === skip || !o.pos) continue;
    if (o.kind === 'wall') {
      const s = o.side ?? ZONES[o.zone]?.side;
      if (s !== side) continue;
      const [hw, hh] = o.parts?.length ? halfWall(o.parts, o.scale || 1) : o.image ? [0.5, 0.4] : [0.3, 0.3];
      const a = side === 'back' ? o.pos[0] : o.pos[2];
      list.push({ n: o.name, a0: a - hw, a1: a + hw, y0: o.pos[1] - hh, y1: o.pos[1] + hh });
    } else if (o.kind === 'floor' && !o.image) {
      const r = rectAt(footOf(o), o.pos[0], o.pos[2], o.rotY);
      const h = sizeOf(o)?.[1] ?? 1;
      if (side === 'back' && r.z0 <= -4.7) list.push({ n: o.name, a0: r.x0, a1: r.x1, y0: 0, y1: h });
      if (side === 'left' && r.x0 <= -4.7) list.push({ n: o.name, a0: r.z0, a1: r.z1, y0: 0, y1: h });
    }
  }
  return list;
}
function wallBlocker(r, obs, gap = 0.1) {
  if (r.a0 < -4.9 || r.a1 > 4.9 || r.y0 < 0.2 || r.y1 > WALL_TOP) return 'the edge of the wall';
  return obs.find((o) => r.a0 < o.a1 + gap && r.a1 + gap > o.a0 && r.y0 < o.y1 + gap && r.y1 + gap > o.y0)?.n ?? null;
}
function placeWall(decor, spec, parts, side, want, atMs, now, moving = false) {
  const scale = fit(parts, 'wall', {});
  const [hw, hh] = halfWall(parts, scale);
  const obs = wallObstacles(decor, side);
  const [ta, th] = want ?? [side === 'back' ? 0 : 0, 2.6];
  const ok = (a, y) => !wallBlocker({ a0: a - hw, a1: a + hw, y0: y - hh, y1: y + hh }, obs);
  let found = ok(ta, th) ? [ta, th] : null;
  let moved = false;
  if (!found) {
    const grid = [];
    for (let a = -4.9; a <= 4.91; a += 0.25) for (let y = 0.3; y <= WALL_TOP; y += 0.25) grid.push([a, y, Math.hypot(a - ta, y - th)]);
    grid.sort((p, q) => p[2] - q[2]);
    for (const [a, y, dist] of grid) {
      if (want && dist > 1.5) break;
      if (ok(a, y)) {
        found = [a, y];
        moved = true;
        break;
      }
    }
  }
  if (!found) return { failed: `there is no free place on the ${side} wall for something about ${r3(hw * 2)} x ${r3(hh * 2)} m. He can use the other wall, make it smaller, or take something down` };
  const [a, y] = found.map(r3);
  return {
    moved,
    entry: {
      id: `d${now.toString(36)}${decor.length}`,
      name: spec.name,
      why: spec.why,
      project: spec.project,
      song: spec.song ?? null,
      uses: moving ? spec.uses : storedUses(spec.uses),
      tool: spec.tool ?? null,
      zone: 'wall_free',
      slot: null,
      free: true,
      side,
      label: `on the ${side} wall (${side === 'back' ? 'x' : 'z'} ${a}, height ${y})`,
      kind: 'wall',
      pos: side === 'back' ? [a, y, -4.97] : [-4.97, y, a],
      rotY: side === 'back' ? 0 : Math.PI / 2,
      scale,
      parts,
      stand: side === 'back' ? [Math.min(4.5, Math.max(-4.5, a)), -3.7] : [-3.7, Math.min(4.5, Math.max(-4.5, a))],
      at: new Date(atMs + 6000).toISOString(),
      createdAt: new Date(now).toISOString(),
    },
  };
}

const SURFACES = {
  desk: { n: 'the desk', x0: -4.95, x1: -3.65, z0: 0.2, z1: 2.2, y: 0.85, rotY: Math.PI / 2, off: [1.5, 0] },
  piano: { n: 'the piano', x0: -3.95, x1: -1.25, z0: -5, z1: -4.05, y: 1.4, rotY: 0, off: [0, 1.5] },
  bookshelf: { n: 'the bookshelf', x0: 1.6, x1: 3.6, z0: -4.95, z1: -4.4, y: 3.0, rotY: 0, off: [0, 1.4] },
  bed: { n: 'the bed', x0: 2.5, x1: 4.5, z0: 2.4, z1: 4.7, y: 0.7, rotY: 0, off: [-1.5, 0] },
};
const ZONE_BASE = { on_desk: 'desk', on_piano: 'piano', on_bookshelf: 'bookshelf', on_bed: 'bed' };
const baseKeyOf = (o) => o.base ?? ZONE_BASE[o.zone];

// What he can put things on: the furniture, or a thing he made on the floor (a shelf, a closet, a table).
function baseByKey(decor, key) {
  if (SURFACES[key]) return { key, ...SURFACES[key] };
  const o = decor.find((x) => x.id === key && x.kind === 'floor' && x.pos);
  if (!o) return null;
  const r = rectAt(footOf(o), o.pos[0], o.pos[2], o.rotY);
  return { key: o.id, n: o.name, ...r, y: sizeOf(o)?.[1] ?? 1, rotY: o.rotY || 0, stand: o.stand, from: o.pos };
}
function findBase(decor, on) {
  const w = str(on, 60).toLowerCase().replace(/_/g, ' ').replace(/^(on |the )+/, '').trim();
  if (!w) return null;
  const mine = decor.find((x) => x.kind === 'floor' && !x.image && x.pos && x.name.toLowerCase() === w) ?? decor.find((x) => x.kind === 'floor' && !x.image && x.pos && (x.name.toLowerCase().includes(w) || w.includes(x.name.toLowerCase())));
  if (mine) return baseByKey(decor, mine.id);
  const k = /desk|computer|table/.test(w) ? 'desk' : /piano/.test(w) ? 'piano' : /book/.test(w) ? 'bookshelf' : /bed/.test(w) ? 'bed' : null;
  return k ? baseByKey(decor, k) : null;
}
const surfaceOthers = (decor, key, skip) => decor.filter((o) => o !== skip && o.kind === 'surface' && o.pos && baseKeyOf(o) === key).map((o) => ({ n: o.name, ...rectAt(footOf(o), o.pos[0], o.pos[2], o.rotY) }));

function placeOn(decor, spec, parts, base, want, atMs, now, moving = false) {
  const sq = Math.max(0.15, Math.min(base.x1 - base.x0, base.z1 - base.z0) - 0.1);
  const scale = fit(parts, 'surface', { w: sq, d: sq });
  const [hw, hd] = halfFoot(parts, scale);
  const others = surfaceOthers(decor, base.key, null);
  const fitsAt = (x, z) => {
    const r = rectAt([hw, hd], x, z, base.rotY);
    return r.x0 >= base.x0 && r.x1 <= base.x1 && r.z0 >= base.z0 && r.z1 <= base.z1 && !others.some((o) => r.x0 < o.x1 + 0.05 && r.x1 + 0.05 > o.x0 && r.z0 < o.z1 + 0.05 && r.z1 + 0.05 > o.z0);
  };
  const cx = (base.x0 + base.x1) / 2;
  const cz = (base.z0 + base.z1) / 2;
  const [tx, tz] = want ? [want.x, want.z] : [cx, cz];
  let found = fitsAt(tx, tz) ? [tx, tz] : null;
  let moved = false;
  if (!found) {
    const grid = [];
    for (let x = base.x0; x <= base.x1 + 0.001; x += 0.1) for (let z = base.z0; z <= base.z1 + 0.001; z += 0.1) grid.push([x, z, Math.hypot(x - tx, z - tz)]);
    grid.sort((p, q) => p[2] - q[2]);
    for (const [x, z] of grid) {
      if (fitsAt(x, z)) {
        found = [x, z];
        moved = true;
        break;
      }
    }
  }
  if (!found) return { failed: `there is no room left on ${base.n} for something about ${r3(hw * 2)} x ${r3(hd * 2)} m. He can use another surface, make it smaller, or build a shelf` };
  const [x, z] = found.map(r3);
  const stand = base.stand ? [r3(x + (base.stand[0] - base.from[0])), r3(z + (base.stand[1] - base.from[2]))] : [r3(x + SURFACES[base.key].off[0]), r3(z + SURFACES[base.key].off[1])];
  const clampRoom = (v) => r3(Math.min(4.5, Math.max(-4.5, v)));
  return {
    moved,
    entry: {
      id: `d${now.toString(36)}${decor.length}`,
      name: spec.name,
      why: spec.why,
      project: spec.project,
      song: spec.song ?? null,
      uses: moving ? spec.uses : storedUses(spec.uses),
      tool: spec.tool ?? null,
      zone: 'surface',
      slot: null,
      free: true,
      base: base.key,
      label: `on ${base.n} (x ${x}, z ${z})`,
      kind: 'surface',
      pos: [x, base.y, z],
      rotY: base.rotY,
      scale,
      parts,
      stand: [clampRoom(stand[0]), clampRoom(stand[1])],
      at: new Date(atMs + 6000).toISOString(),
      createdAt: new Date(now).toISOString(),
    },
  };
}

const num2 = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const sideOf = (s) => (/left/i.test(String(s)) ? 'left' : /back|window|north/i.test(String(s)) ? 'back' : null);
// Where does it go: a wall, the top of something, or the floor. Whatever he gave: coordinates, a name, or nothing (then the nearest free place).
function placeWhere(decor, spec, parts, want, atMs, now) {
  const x = num2(spec.x);
  const z = num2(spec.z);
  const wallSide = sideOf(spec.wall) ?? (want && ZONES[want].kind === 'wall' && !ZONES[want].prints ? (ZONES[want].side === 'left' ? 'left' : 'back') : null);
  if (wallSide || num2(spec.along) !== null || num2(spec.height) !== null) {
    const side = wallSide ?? 'back';
    const slot = want && ZONES[want].kind === 'wall' ? ZONES[want].slots[0] : null;
    const along = num2(spec.along) ?? (slot ? (side === 'back' ? slot[0] : slot[2]) : null);
    const height = num2(spec.height) ?? (slot ? slot[1] : null);
    return placeWall(decor, spec, parts, side, along !== null || height !== null ? [along ?? 0, height ?? 2.6] : null, atMs, now);
  }
  const onWhat = spec.on || (want && ZONES[want].kind === 'surface' ? Object.entries(ZONE_BASE).find(([k]) => k === want)?.[1] ?? 'desk' : '');
  if (onWhat) {
    const base = findBase(decor, onWhat);
    if (!base) return { failed: `he cannot put anything on "${str(onWhat, 40)}": the desk, piano, bookshelf, bed, or a thing he made on the floor will do` };
    return placeOn(decor, spec, parts, base, x !== null && z !== null ? { x, z } : null, atMs, now);
  }
  const anchor = x !== null && z !== null ? [x, z] : want && ZONES[want].kind === 'floor' && ZONES[want].slots[0] ? [ZONES[want].slots[0][0], ZONES[want].slots[0][2]] : [0, 0];
  return placeFloor(decor, spec, parts, x !== null && z !== null ? { x, z } : null, anchor, atMs, now);
}
