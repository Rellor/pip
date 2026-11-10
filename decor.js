import { cleanSong } from './songs.js';
import { storedUses } from './uses.js';

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

// Spots: [x, y, z] in the room. For wall spots y is the height of the middle of the object.
// "off" is where Pip stands relative to the spot, rotY turns the object to face into the room.
export const ZONES = {
  floor_under_window: { label: 'on the floor under the window', kind: 'floor', lim: { d: 1.2 }, rotY: 0, off: [0, 1.1], slots: [[-1.0, 0, -4.4], [1.0, 0, -4.4]] },
  floor_left_wall: { label: 'on the floor by the left wall', kind: 'floor', lim: { w: 1.1, d: 1.4 }, rotY: 0.8, off: [1.2, 0], slots: [[-4.5, 0, -2.9], [-4.5, 0, -1.4]] },
  floor_middle: { label: 'on the floor in the middle of the room', kind: 'floor', rotY: 0, off: [0, 1.1], slots: [[-1.8, 0, 0.4], [1.8, 0, 0.0], [0.2, 0, -1.2]] },
  floor_front: { label: 'on the floor near the front of the room', kind: 'floor', rotY: 0, off: [0, 1.1], slots: [[-2.6, 0, 3.2], [-0.6, 0, 3.8], [1.2, 0, 3.4]] },
  floor_right: { label: 'on the floor on the right side of the room', kind: 'floor', lim: { w: 1.1, d: 1.4 }, rotY: -0.6, off: [-1.2, 0], slots: [[4.4, 0, -1.6], [4.4, 0, -0.2]] },
  on_piano: { label: 'on top of the piano', kind: 'surface', lim: { w: 1.1, d: 0.8 }, rotY: 0, off: [0, 1.5], slots: [[-3.4, 1.4, -4.5], [-1.9, 1.4, -4.5]] },
  on_bookshelf: { label: 'on top of the bookshelf', kind: 'surface', lim: { w: 1.0, d: 0.55 }, rotY: 0, off: [0, 1.4], slots: [[2.0, 3.0, -4.65], [3.2, 3.0, -4.65]] },
  on_desk: { label: 'on the desk', kind: 'surface', lim: { w: 1.0, d: 1.3 }, rotY: 1.2, off: [1.5, 0], slots: [[-4.2, 0.85, 0.45], [-4.2, 0.85, 1.95]] },
  on_bed: { label: 'on the bed', kind: 'surface', lim: { w: 0.9, d: 0.9 }, rotY: 0, off: [-1.5, 0], slots: [[3.1, 0.7, 4.0], [3.9, 0.7, 3.4]] },
  wall_back: { label: 'on the back wall (left of the photo, above it, or above the bookshelf)', kind: 'wall', rotY: 0, side: 'back', slots: [[-4.2, 2.9, -4.97], [-2.2, 4.2, -4.97], [2.6, 3.9, -4.97]] },
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
  return Object.entries(ZONES).map(([zone, z]) => ({ zone, label: z.label, free: z.slots.length - usedSlots(decor, zone).size }));
}

// "on the piano", "piano" or "on_piano" all find the same spot.
function findZone(where) {
  const w = str(where, 80).toLowerCase().replace(/_/g, ' ');
  if (!w) return null;
  for (const [key, z] of Object.entries(ZONES)) if (w === key.replace(/_/g, ' ') || w === z.label) return key;
  const words = [
    ['piano', 'on_piano'], ['bookshelf', 'on_bookshelf'], ['shelf', 'on_bookshelf'], ['desk', 'on_desk'], ['computer', 'on_desk'], ['bed', 'on_bed'],
    ['left wall', 'wall_left'], ['back wall', 'wall_back'], ['wall', 'wall_back'], ['window', 'floor_under_window'],
    ['middle', 'floor_middle'], ['rug', 'floor_middle'], ['center', 'floor_middle'], ['centre', 'floor_middle'],
    ['front', 'floor_front'], ['right', 'floor_right'], ['corner', 'floor_left_wall'],
  ];
  return words.find(([k]) => w.includes(k))?.[1] ?? null;
}

// Puts a finished design into the room: his spot first, then another of the same kind, then anywhere with room.
// `spec` is { name, why, project, where, parts } with clean parts. Does not change `decor`.
function placeParts(decor, spec, atMs, now) {
  if (decor.length >= MAX_DECOR) return { failed: 'his room is full' };
  const parts = spec.parts.map((p) => ({ ...p, size: [...p.size], pos: [...p.pos], rot: [...p.rot] })); // fit() moves things, so work on a copy
  const want = findZone(spec.where);
  const keys = Object.keys(ZONES);
  const order = [...(want ? [want] : []), ...keys.filter((k) => k !== want && want && ZONES[k].kind === ZONES[want].kind), ...keys];
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
  if (!zone) return { failed: 'there is no free spot left' };

  const Z = ZONES[zone];
  const [sx, sy, sz] = Z.slots[slot];
  const scale = fit(parts, Z.kind, Z.lim);
  const clampRoom = (v) => r3(Math.min(4.5, Math.max(-4.5, v)));
  const stand = Z.kind === 'wall' ? (Z.side === 'back' ? [sx, -3.7] : [-3.7, sz]) : [clampRoom(sx + Z.off[0]), clampRoom(sz + Z.off[1])];
  return {
    entry: {
      id: `d${now.toString(36)}${decor.length}`,
      name: spec.name,
      why: spec.why,
      project: spec.project,
      song: spec.song ?? null,
      uses: storedUses(spec.uses),
      zone,
      slot,
      label: Z.label,
      kind: Z.kind,
      pos: [sx, sy, sz],
      rotY: Z.rotY,
      scale,
      parts,
      stand,
      at: new Date(atMs + 6000).toISOString(), // appears a few seconds into his step, when he has walked there
      createdAt: new Date(now).toISOString(),
    },
  };
}

// Pip's new object, made in one go, or the reason it did not work out. Does not change `decor`.
export function makeDecor(decor, details, atMs, now = Date.now()) {
  const d = details && typeof details === 'object' ? details : {};
  const name = str(d.name, 60);
  if (!name) return { failed: 'he did not give it a name' };
  if (decor.filter((x) => !x.image && now - Date.parse(x.createdAt) < 86_400_000).length >= MAX_PER_DAY) return { failed: 'he has already made enough for today' };
  if (decor.length >= MAX_DECOR) return { failed: 'his room is full' };
  const parts = cleanParts(d.parts);
  if (!parts) return { failed: 'the shapes did not work out' };
  return placeParts(decor, { name, why: str(d.why, 200), project: str(d.project, 80), where: d.where, parts, song: cleanSong(d.song), uses: d.uses }, atMs, now);
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
  const r = placeParts(decor, { name: e.name, why: e.why, project: e.project, where: where || e.zone, parts: e.parts, song: e.song, uses: e.uses }, atMs, now);
  if (r.entry) {
    r.entry.createdAt = e.createdAt; // it is still the thing he made back then
    stored.splice(i, 1);
  }
  return r;
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
  if (decor.length >= MAX_DECOR) return { failed: 'his room is full' };
  const usable = Object.keys(ZONES).filter((k) => ZONES[k].kind === 'wall' || ZONES[k].kind === 'surface');
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
      name: str(pic.caption, 60).length <= 40 && str(pic.caption, 60) ? str(pic.caption, 60) : 'a picture from Bas', // a long message is not a good name for a frame
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
  if (!parts && !why) return { failed: 'he did not say what to change' };
  if (parts) {
    const Z = ZONES[e.zone];
    e.scale = fit(parts, Z.kind, Z.lim);
    e.parts = parts;
  }
  if (why) e.why = why;
  e.updatedAt = new Date(atMs + 6000).toISOString(); // the page shows the change a few seconds into his step
  return { name: e.name, entry: e, reshaped: Boolean(parts) };
}
