// Clothes Pip can make and wear. Like his other things, they are plain data: a few simple shapes on a spot of his body.
// The code checks everything: the spot, the size, how many he can have.
import { cleanParts } from './decor.js';

export const MAX_CLOTHES = 12;
export const MAX_CLOTHES_PER_DAY = 3;
// Where on his body (x sideways, y up, z toward the front). `at` is where the middle of the clothes sits; a hat sits with its bottom there.
export const SLOTS = {
  head: { label: 'on his head (a hat, a crown, a bow)', at: [0, 1.05, 0], bottom: true, lim: { w: 0.8, h: 0.7, d: 0.8 } },
  face: { label: 'on his face (glasses, a mask)', at: [0, 0.78, 0.47], lim: { w: 0.6, h: 0.3, d: 0.25 } },
  neck: { label: 'around his middle, low (a scarf, a bow tie)', at: [0, 0.4, 0], lim: { w: 1.1, h: 0.35, d: 1.05 } },
  body: { label: 'around his body (a sweater, a vest, a coat)', at: [0, 0.62, 0], lim: { w: 1.15, h: 1.0, d: 1.05 } },
  back: { label: 'on his back (a cape, a backpack, wings)', at: [0, 0.7, -0.55], lim: { w: 1.1, h: 1.1, d: 0.6 } },
};
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const r3 = (n) => Math.round(n * 1000) / 1000;

// Moves the parts so the middle (or the bottom, for a hat) is at 0, and shrinks them when they are too big. Returns the scale.
function fitWorn(parts, { w, h, d }, bottom) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const s = p.shape;
    let e = s === 'box' ? p.size.map((v) => v / 2) : s === 'sphere' ? [p.size[0], p.size[0], p.size[0]] : s === 'cylinder' ? [Math.max(p.size[0], p.size[1]), p.size[2] / 2, Math.max(p.size[0], p.size[1])] : s === 'cone' ? [p.size[0], p.size[1] / 2, p.size[0]] : s === 'torus' ? [p.size[0] + p.size[1], p.size[0] + p.size[1], p.size[1]] : [p.size[0], p.size[1] / 2 + p.size[0], p.size[0]];
    if (p.rot.some((r) => r)) e = e.map(() => Math.max(...e));
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p.pos[i] - e[i]);
      max[i] = Math.max(max[i], p.pos[i] + e[i]);
    }
  }
  const scale = Math.min(1, w / (max[0] - min[0]), h / (max[1] - min[1]), d / (max[2] - min[2]));
  const c = [(min[0] + max[0]) / 2, bottom ? min[1] : (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  for (const p of parts) p.pos = [r3(p.pos[0] - c[0]), r3(p.pos[1] - c[1]), r3(p.pos[2] - c[2])];
  return Math.floor(scale * 1000) / 1000;
}

const find = (wardrobe, name) => {
  const n = str(name, 60).toLowerCase();
  if (!n) return null;
  return wardrobe.find((x) => x.name.toLowerCase() === n) ?? wardrobe.find((x) => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())) ?? null;
};

// He makes something to wear (or makes an old one again, differently), and wears it unless he says not to.
// Returns { entry } or { failed }. Changes `wardrobe`.
export function makeClothes(wardrobe, details, atMs, now = Date.now()) {
  const d = details && typeof details === 'object' ? details : {};
  const name = str(d.name, 60);
  if (!name) return { failed: 'he did not give it a name' };
  const slot = Object.hasOwn(SLOTS, d.slot) ? d.slot : null;
  if (!slot) return { failed: `it needs a place on his body: ${Object.keys(SLOTS).join(', ')}` };
  const parts = cleanParts(d.parts);
  if (!parts) return { failed: 'the shapes did not work out' };
  const old = wardrobe.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!old && wardrobe.length >= MAX_CLOTHES) return { failed: 'his wardrobe is full' };
  if (wardrobe.filter((x) => now - Date.parse(x.madeAt || x.createdAt) < 86_400_000).length >= MAX_CLOTHES_PER_DAY) return { failed: 'he has already made enough clothes for today' };
  const S = SLOTS[slot];
  const scale = fitWorn(parts, S.lim, S.bottom === true);
  const wear = d.wear !== false;
  const entry = {
    id: old?.id ?? `c${now.toString(36)}${wardrobe.length}`,
    name,
    slot,
    why: str(d.why, 200),
    parts,
    scale,
    at: S.at,
    worn: wear || (old?.worn ?? false),
    wornAt: new Date(atMs + 6000).toISOString(),
    createdAt: old?.createdAt ?? new Date(now).toISOString(),
    madeAt: new Date(now).toISOString(),
  };
  if (entry.worn) for (const x of wardrobe) if (x.slot === slot && x.id !== entry.id) x.worn = false;
  if (old) Object.assign(old, entry);
  else wardrobe.push(entry);
  return { entry: old ?? entry };
}

// He puts something on (what he wore in that place before comes off).
export function wear(wardrobe, name, atMs) {
  const e = find(wardrobe, name);
  if (!e) return { failed: 'he does not have clothes with that name' };
  for (const x of wardrobe) if (x.slot === e.slot) x.worn = false;
  e.worn = true;
  e.wornAt = new Date(atMs + 3000).toISOString();
  return { name: e.name, slot: e.slot };
}

// He takes something off: by name, or by place on his body ("head").
export function takeOff(wardrobe, nameOrSlot) {
  const key = str(nameOrSlot, 60).toLowerCase();
  const e = (Object.hasOwn(SLOTS, key) ? wardrobe.find((x) => x.slot === key && x.worn) : null) ?? find(wardrobe, key);
  if (!e) return { failed: 'he does not have clothes with that name' };
  if (!e.worn) return { failed: 'he is not wearing that' };
  e.worn = false;
  return { name: e.name, slot: e.slot };
}

export const wornNow = (wardrobe) => wardrobe.filter((x) => x.worn);
