// His room is built bigger than a normal home: the bed is 3.4 m long, the desk 2.2 m, the bookshelf 3.1 m tall, the plant
// 1.6 m (about 1.6 times everyday sizes). Pip designs things in everyday sizes, so they looked tiny next to the furniture.
// The game builds what he makes at the room's size. He himself keeps his size (1.35 m).
// Three general rules, so they also work for things nobody thought of:
// 1. Everything is built 1.6 times bigger.
// 2. A thing he sits on or works at keeps its seat or work top where his body fits: the game finds its flat top part
//    (a seat, a table top, a cooktop) and keeps that at sitting height (0.6 m) or desk height (0.95 m). The rest (a chair
//    back, a chimney) may be as tall as it likes.
// 3. Nothing is so small that it gets lost in the big room: a minimum size for where it goes (floor, wall, surface, ceiling).
import { handsOn } from './sizes.js';
import { rightPlace } from './placement.js';

export const ROOM_SCALE = 1.6;
export const SEAT_H = 0.6; // about half his height
export const WORK_H = 0.95; // a little above his desk (0.85)
export const MIN_SIZE = { floor: 0.7, wall: 0.45, surface: 0.28, ceiling: 0.45 }; // its biggest side, in metres
const SIT = /\b(sit|seat|chair|stool|bench|sofa|couch|armchair|pouf)\b/i;

const r3 = (n) => Math.round(n * 1000) / 1000;
const half = (p) => (p.shape === 'sphere' ? [p.size[0], p.size[0], p.size[0]] : p.shape === 'cylinder' || p.shape === 'cone' ? [p.size[0], (p.size[2] ?? p.size[1]) / 2, p.size[0]] : p.shape === 'torus' ? [p.size[0] + p.size[1], p.size[1], p.size[0] + p.size[1]] : [p.size[0] / 2, (p.size[1] ?? p.size[0]) / 2, (p.size[2] ?? p.size[0]) / 2]);
export function box(parts) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts ?? []) {
    const e = half(p);
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.pos[i] - e[i]); hi[i] = Math.max(hi[i], p.pos[i] + e[i]); }
  }
  return Number.isFinite(lo[0]) ? { lo, hi, size: hi.map((v, i) => v - lo[i]) } : null;
}
// The height of its flat top part (a seat, a table top, a cooktop) above its bottom, or null when it has none.
export function workTop(parts) {
  const b = box(parts);
  if (!b) return null;
  const flat = (parts ?? []).filter((p) => {
    const [x, y, z] = half(p);
    return y * 2 <= 0.15 && x * 2 >= 0.2 && z * 2 >= 0.15; // thin and wide: something you put things on or sit on
  });
  if (!flat.length) return null;
  return Math.max(...flat.map((p) => p.pos[1] + half(p)[1])) - b.lo[1];
}
// Where it goes, in the words of the size rule.
export const placeKind = (spec = {}) => (MIN_SIZE[spec.kind] ? spec.kind : spec.ceiling ? 'ceiling' : spec.on ? 'surface' : spec.wall ? 'wall' : spec.x !== undefined || spec.next_to || /floor/.test(String(spec.where ?? '')) ? 'floor' : rightPlace(spec)?.kind ?? 'floor');

// How much bigger this thing is built: { wide, high }. Usually both 1.6; a seat or work top grows wide and deep like the
// room, but only as high as his body fits.
export function roomFactors(parts, spec = {}) {
  const b = box(parts);
  if (!b) return { wide: ROOM_SCALE, high: ROOM_SCALE };
  let k = ROOM_SCALE;
  const biggest = Math.max(...b.size);
  const min = MIN_SIZE[placeKind(spec)] ?? MIN_SIZE.floor;
  if (biggest * k < min) k = min / biggest; // rule 3: not lost in the room
  let high = k;
  if (handsOn(spec)) { // rule 2: the seat or work top stays where his body fits
    const top = workTop(parts) ?? b.size[1];
    const limit = SIT.test(`${spec.name ?? ''} ${(spec.uses ?? []).map((u) => u?.label ?? '').join(' ')}`) ? SEAT_H : WORK_H;
    if (top * high > limit) high = Math.max(1, limit / top);
  }
  return { wide: k, high };
}
export const roomFactor = (parts, spec = {}) => roomFactors(parts, spec).wide;
// Grows parts: across (x, z) by wide, up (y) by high. Round shapes use wide for their radius and high for their length.
export function scaleParts(parts, wide, high = wide) {
  return (parts ?? []).map((p) => {
    const s = p.size;
    const size = p.shape === 'sphere' ? [s[0] * Math.min(wide, high)]
      : p.shape === 'cylinder' ? [s[0] * wide, (s[1] ?? s[0]) * wide, (s[2] ?? 0.1) * high]
      : p.shape === 'cone' || p.shape === 'capsule' ? [s[0] * wide, (s[1] ?? 0.1) * high]
      : p.shape === 'torus' ? [s[0] * wide, (s[1] ?? 0.02) * Math.min(wide, high)]
      : [s[0] * wide, (s[1] ?? s[0]) * high, (s[2] ?? s[0]) * wide];
    return { ...p, size: size.map(r3), pos: [r3(p.pos[0] * wide), r3(p.pos[1] * high), r3(p.pos[2] * wide)] };
  });
}
// A new design at the room's size.
export function roomScale(parts, spec = {}) {
  const f = roomFactors(parts, spec);
  return scaleParts(parts, f.wide, f.high);
}
