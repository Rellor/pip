// Plan first, then build ("measure twice, cut once"). The smart model that designs a thing can only be asked a few dozen
// times a day, and a design that turns out not to fit where it should go is a call thrown away. So before it is asked:
//   1. the small model (which is never short) says how big the thing will be: a quick sketch, wide x high x deep;
//   2. the game tries a plain box of that size in the real place, with the real rules (a dry run on a copy of his things);
//      when it does not fit, it tries smaller boxes;
//   3. nothing fits: he hears why at once, and the smart model is not asked at all. Something fits: the smart model gets
//      that size as its budget, and afterwards the design is shrunk to it when it still came out bigger.
// Plain code apart from the one small call. (Bas, 2026-11-23: "first plan in the simple model to see if it will fail and
// then use the smarter one, to make each use count".)
import { makeDecor, isOutside } from './decor.js';
import { designate } from './placement.js';
import { settle } from './build.js';
import { box as boxOf, sizeWords, roomScale, scaleParts, ROOM_SCALE } from './scale.js';

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.max(lo, Math.min(hi, Number(v))) : d);
const r2 = (v) => Math.round(v * 20) / 20; // to 5 cm
export const SHRINK = [1, 0.8, 0.62, 0.48]; // the sizes the dry run tries, biggest first

export const sketchSchema = { type: 'OBJECT', properties: { wide: { type: 'NUMBER' }, high: { type: 'NUMBER' }, deep: { type: 'NUMBER' } }, required: ['wide', 'high', 'deep'] };
// What the small model is asked: only the size, as a person would guess it.
export function sketchPrompt(details = {}) {
  return `I am about to make this: ${clip(details.what || details.name, 160) || 'something new'}${details.name && details.what ? ` (${clip(details.name, 60)})` : ''}.${details.where ? ` Where I want it: ${clip(details.where, 80)}.` : ''}${Number(details.metres) > 0 ? ` I said its longest side is ${details.metres} m.` : ''}
Before I design it I guess how big it will be in real life, the way a person would: its width, height and depth in metres. A thing that hangs on a wall is flat (depth 0.05 to 0.25). A thing for a table top is small (under 0.5). A chair is about 0.5 x 0.9 x 0.5, a bookcase 0.9 x 1.8 x 0.35, a mug 0.09 x 0.1 x 0.09.
Answer in JSON: {"wide": 0.6, "high": 0.4, "deep": 0.3}`;
}
// A guess from his words alone, for tests and for when the small model does not answer.
export function fakeSketch(details = {}) {
  const t = `${details.what ?? ''} ${details.name ?? ''} ${details.where ?? ''}`.toLowerCase();
  if (Number(details.metres) > 0) return { wide: Number(details.metres), high: Number(details.metres), deep: Number(details.metres) * 0.7 };
  if (/\b(wall|poster|painting|picture|map|mirror|clock|sign|tapestry)\b/.test(t)) return { wide: 1.2, high: 0.9, deep: 0.08 };
  if (/\b(tiny|small|little|mini|cup|mug|vase|box|figure|lamp)\b/.test(t)) return { wide: 0.25, high: 0.3, deep: 0.25 };
  return { wide: 0.7, high: 0.8, deep: 0.5 };
}
export const cleanSketch = (reply, details = {}) => { const f = fakeSketch(details); return { wide: num(reply?.wide, 0.03, 20, f.wide), high: num(reply?.high, 0.03, 18, f.high), deep: num(reply?.deep, 0.02, 20, f.deep) }; };

// One try: would a plain box of this everyday size (metres) get a place, with the same rules the real thing will meet?
// Returns { entry, fit: [w, h, d] in room size } or { failed }.
function tryBox(state, details, [w, h, d], atMs) {
  const out = isOutside(details.where);
  const spec = { ...details, name: clip(details.name || details.what, 60) || 'a new thing', ...(out ? { metres: Number(details.metres) > 0 ? details.metres : Math.max(w, h, d) } : {}) };
  const placed = designate({ ...state, decor: state.decor }, spec);
  const built = settle(sizeWords([{ shape: 'box', size: [w, h, d], pos: [0, h / 2, 0], rot: [0, 0, 0], color: '#888888' }], spec.name), { kind: undefined });
  const sized = out ? built.parts : roomScale(built.parts, spec);
  const r = makeDecor(structuredClone(state.decor ?? []), { ...spec, ...placed, parts: sized, uses: [] }, atMs, atMs);
  if (!r.entry) return { failed: r.failed ?? 'it does not fit' };
  const size = boxOf(r.entry.parts ?? sized)?.size ?? [w, h, d];
  return { entry: r.entry, fit: size.map((v) => v * (r.entry.scale ?? 1)), scale: Math.min(1, r.entry.scale ?? 1) }; // (the placing itself may have made it smaller to get it in)
}
// The dry run: the sketched size, and smaller ones when that does not fit. Returns
//   { ok: true, fit (room size that was shown to fit), budget (the same in everyday metres), shrunk (1 = as sketched), label }
//   { ok: false, why } when no size got a place.
export function dryRun(state, details = {}, sketch, atMs = Date.now()) {
  const s = cleanSketch(sketch, details);
  let first = null;
  for (const k of SHRINK) {
    const r = tryBox(state, details, [s.wide * k, s.high * k, s.deep * k], atMs);
    if (r.entry) return { ok: true, fit: r.fit, budget: isOutside(details.where) ? r.fit.map(r2) : r.fit.map((v) => r2(v / ROOM_SCALE)), shrunk: Math.round(k * r.scale * 100) / 100, label: r.entry.label ?? '' };
    first ??= r.failed;
    if (/enough for today|one new thing|did not give it a name|things of mine outside|is full/i.test(r.failed)) break; // not about its size: a smaller one will not help
  }
  return { ok: false, why: first };
}
// For the maker: the size it has to stay within, in his words.
export const budgetNote = (plan) => (plan?.ok ? `SIZE (I measured the place before I started): it fits when it is at most ${plan.budget[0]} m wide, ${plan.budget[1]} m high and ${plan.budget[2]} m deep in everyday size${plan.shrunk < 1 ? '. That is smaller than I first thought: there is not more room there' : ''}. I design it within that. Bigger does not fit.` : '');
// After the design: when it still came out bigger than what was shown to fit, the whole thing is made smaller to that
// size (its shape stays). parts and fit are in room size. Returns the parts to place.
export function keepWithin(parts, fit) {
  const b = boxOf(parts)?.size;
  if (!b || !fit) return parts;
  const flat = (v) => [Math.max(v[0], v[2]), v[1], Math.min(v[0], v[2])]; // (it may stand turned: the long side against the long side)
  const [bw, bh, bd] = flat(b), [fw, fh, fd] = flat(fit);
  const k = Math.min(1, bw > 0 ? fw / bw : 1, bh > 0 ? fh / bh : 1, bd > 0 ? Math.max(fd, 0.04) / bd : 1);
  return k < 0.97 ? scaleParts(parts, Math.max(0.3, k)) : parts;
}
