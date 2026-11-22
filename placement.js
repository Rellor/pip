// Where things belong. The game knows, like anyone who has lived in a home, that a ceiling lamp hangs from the ceiling,
// a reading light stands where he reads, a stove stands on the floor, plants want the window and a painting hangs on a
// wall. When Pip does not say where a new thing goes, it goes to its right place. He may put it somewhere else (it is his
// room), but then he notices it would be better elsewhere, and putting it right is offered to him.
import { placeFor } from './web/lighting.js';
import { supportsInfo, sizeOf, fitsOnATop, accessProblem, coverKind, coverTarget, freeSpaceOn, MIN_SHRINK } from './decor.js';
import { box, ROOM_SCALE } from './scale.js';
import { needLampSpots } from './growth.js';

// Checked in order: the first match wins, so "floor lamp" comes before "lamp".
const RULES = [
  { re: /\b(ceiling (lamp|light)|pendant|chandelier|hanging (lamp|light)|mobile|wind ?chime|dream ?catcher|paper lantern)\b/i, kind: 'ceiling', near: ['middle of the room', 'desk', 'bed'], why: 'it hangs from the ceiling' },
  { re: /\b(wall (lamp|light)|sconce|clock|mirror|painting|poster|calendar|coat hook|hooks?|wall shelf|banner|wreath|map)\b/i, kind: 'wall', near: ['desk', 'bed'], why: 'it hangs on a wall' },
  { re: /\b(floor lamp|standing lamp|standing light|tall lamp|lamp post|torchiere)\b/i, kind: 'floor', near: ['bed', 'bookshelf', 'desk'], why: 'a floor lamp stands on the floor where I sit or read' },
  { re: /\b(reading (lamp|light)|desk (lamp|light)|table lamp|bedside lamp|night ?light|lamp|lantern|candle)\b/i, kind: 'surface', near: ['desk', 'bed'], why: 'a lamp is needed where I read and write' },
  { re: /\b(stove|oven|kitchen|cooker|hob|counter|worktop|sink|fridge)\b/i, kind: 'floor', near: ['stove', 'kitchen'], why: 'cooking things stand together on the floor, where I cook' },
  { re: /\b(greenhouse|planter|flower ?pot|plant ?pot|seed tray|herb (box|garden)|window box|garden bed)\b/i, kind: 'floor', near: ['window'], why: 'plants need the light from the window' },
  { re: /\b(bookshelf|bookshelves|bookcase|cabinet|cupboard|dresser|wardrobe|closet|chest of drawers|sideboard)\b/i, kind: 'floor', near: ['bookshelf', 'desk'], why: 'big storage stands on the floor against a wall' },
  { re: /\b(shelf|shelves|rack)\b/i, kind: 'wall', near: ['desk', 'bed', 'stove'], why: 'a shelf hangs on a wall within reach, near where I use what is on it' },
  { re: /\b(rug|mat|carpet|doormat)\b/i, kind: 'floor', near: ['bed', 'desk'], why: 'a small rug lies beside the bed or by the desk (the big rug has the middle of the room)' },
  { re: /\b(cushion|pillow|beanbag|pouf)\b/i, kind: 'floor', near: ['middle of the room', 'bed'], why: 'it lies on the floor' },
  { re: /\b(chair|stool|seat|bench|armchair|sofa|couch)\b/i, kind: 'floor', near: ['desk', 'window'], why: 'a seat stands where I sit: at the desk or by the window' },
  { re: /\b(table|nightstand|bedside table|desk)\b/i, kind: 'floor', near: ['bed', 'desk'], why: 'a table stands on the floor' },
  { re: /\b(easel|loom|workbench|potter'?s wheel)\b/i, kind: 'floor', near: ['window'], why: 'I work at it in good light' },
  { re: /\b(pedestal|plinth|display stand|plant stand|stand for|perch for)\b/i, kind: 'floor', near: [], why: 'a stand stands on the floor by a wall and holds a thing on its top' },
  { re: /\b(music box|figurine|ornament|trinket|vase|cup|mug|jar|bowl|book|toy|model|globe|snow ?globe|frame|photo frame|box)\b/i, kind: 'surface', near: [], why: 'small things stand on a shelf, a table or the desk' },
];
const WORDS = { floor: 'on the floor', wall: 'on a wall', surface: 'on a shelf, a table or the desk', ceiling: 'hanging from the ceiling' };

// The right place for a thing: { kind, near, why, words } or null when the game has no rule for it (then anywhere is fine).
export function rightPlace(thing) {
  const name = String(thing?.name ?? '');
  const r = RULES.find((x) => x.re.test(name));
  return r ? { kind: r.kind, near: r.near, why: r.why, words: WORDS[r.kind] } : null;
}

const spotOf = (s, word) => placeFor(s, word);
// The nearest of the places it is needed (bed, desk, window...), as { name, x, z }, or null.
function nearestNeed(s, rp, from) {
  const spots = (rp?.near ?? []).map((w) => spotOf(s, w)).filter(Boolean);
  if (!spots.length) return null;
  return from ? spots.sort((a, b) => Math.hypot(a.x - from[0], a.z - from[1]) - Math.hypot(b.x - from[0], b.z - from[1]))[0] : spots[0];
}

// For a new thing he did not say a place for: where the game puts it (the details makeDecor understands).
// "on the floor" says nothing about WHERE on the floor: the game still finds it a good spot.
const GENERIC = /^\s*(on\s+)?(the\s+)?(floor|ground|floor_free|free)\s*$/i;
// A good free spot on the floor, the way people furnish a room: near where it is used, with its back to a wall, and not in
// the middle of the room (that stays free to walk, and for the rug). Returns { near_xz: [x, z] } (where the search starts).
export function floorSpot(s, spec, rp = rightPlace(spec)) {
  if (rp?.near?.[0] === 'middle of the room') return { near_xz: [0, 0.8] };
  const need = nearestNeed(s, rp);
  const busy = [...(s.decor ?? []).filter((d) => d.kind === 'floor' && d.pos).map((d) => [d.pos[0], d.pos[2]]), ...['desk', 'bed', 'bookshelf', 'chest', 'plant', 'piano'].map((w) => spotOf(s, w)).filter(Boolean).map((p) => [p.x, p.z])];
  const spots = [];
  for (let t = -3.9; t <= 3.91; t += 0.6) spots.push([-4.1, t], [4.1, t], [t, -4.1], [t, 4.1]);
  const score = ([x, z]) => (need ? Math.hypot(x - need.x, z - need.z) : 0) + busy.filter(([bx, bz]) => Math.hypot(bx - x, bz - z) < 1.4).length * 2;
  const best = spots.sort((a, b) => score(a) - score(b))[0];
  return { near_xz: best.map((v) => Math.round(v * 100) / 100) };
}

// A small thing (a figure, a model, a little box): it stands on a shelf, a table or the desk, not on the floor.
export const SMALL_THING = 0.5; // its biggest side in his design (everyday size), in metres
const smallThing = (spec) => { const b = box(spec?.parts); return Boolean(b) && Math.max(...b.size) < SMALL_THING; };
// A free top to put a small thing on: the desk if it has room, else one of his shelves or tables (near where it is needed).
function freeTop(s, rp) {
  const needs = (rp?.near ?? []).map((w) => spotOf(s, w)).filter(Boolean);
  const close = (b) => !needs.length || needs.some((n) => Math.hypot(n.x - b.cx, n.z - b.cz) <= 3);
  const free = supportsInfo(s.decor ?? []).filter((b) => !b.full && !b.high && b.room > 0 && !/^piano$/.test(b.label) && close(b));
  const pick = free.find((b) => b.label === 'desk') ?? free[0];
  return pick ? { on: pick.label.replace(/ \(level \d+\)$/, ''), ...(/level (\d+)/.test(pick.label) ? { level: pick.label.match(/level (\d+)/)[1] } : {}) } : null;
}
export function designate(s, spec) {
  const given = (k) => spec?.[k] !== undefined && spec?.[k] !== null && spec?.[k] !== '';
  if (coverKind(spec)) { // cloth: a blanket is spread over the bed, a tablecloth over a table (the game fits it)
    const host = coverTarget(s.decor ?? [], spec);
    if (host) return { on: host.name.replace(/^the /, '') };
  }
  const said = ['where', 'on', 'wall', 'x', 'z', 'next_to', 'along', 'height', 'ceiling'].some((k) => given(k) && !(k === 'where' && GENERIC.test(String(spec.where))));
  const rp = rightPlace(spec);
  const exact = ['on', 'wall', 'x', 'z', 'next_to', 'along', 'height', 'ceiling'].some(given);
  if (!exact && rp?.kind === 'surface' && /\b(lamp|light|lantern|candle)\b/i.test(String(spec?.name ?? ''))) { // a new lamp goes where it is dark (also when he only said "floor")
    const dark = needLampSpots(s)[0];
    if (dark) return freeTop(s, { near: [dark.name] }) ?? { next_to: dark.name.replace(/^the /, '') };
  }
  if (said) return exact ? {} : floorSpot(s, spec, rp); // his own choice. Only "where" without an exact spot: the search for room starts at a good spot, not the middle
  if (smallThing(spec) && (!rp || rp.kind === 'surface')) { const top = freeTop(s, rp); if (top) return top; } // small things stand on something
  if (!rp) return { where: 'floor', ...floorSpot(s, spec, null) }; // nothing known about it: a free spot by a wall
  if (rp.kind === 'floor' && !rp.near?.length) return { where: 'floor', ...floorSpot(s, spec, rp) };
  const at = nearestNeed(s, rp);
  if (rp.kind === 'ceiling') return { ceiling: true, x: at?.x ?? 0, z: at?.z ?? 0.8 };
  if (rp.kind === 'wall') {
    if (!at) return { where: 'wall_free' };
    const left = Math.abs(at.x + 4.97) < Math.abs(at.z + 4.97);
    return { wall: left ? 'left' : 'back', along: left ? at.z : at.x };
  }
  if (rp.kind === 'surface') { // the desk if it has room, else one of his shelves or tables with room, else the desk (and he hears it is full)
    const needs = (rp.near ?? []).map((w) => spotOf(s, w)).filter(Boolean);
    const close = (b) => !needs.length || needs.some((n) => Math.hypot(n.x - b.cx, n.z - b.cz) <= 3); // near where it is needed
    const free = supportsInfo(s.decor ?? []).filter((b) => !b.full && !b.high && b.room > 0 && !/^piano$/.test(b.label) && close(b));
    const pick = free.find((b) => b.label === 'desk') ?? free[0];
    return { on: pick ? pick.label.replace(/ \(level \d+\)$/, '') : 'desk', ...(pick && /level (\d+)/.test(pick.label) ? { level: pick.label.match(/level (\d+)/)[1] } : {}) };
  }
  const word = at?.name?.replace(/^the /, '');
  if (word === 'window') return { where: 'floor_under_window' };
  if (word === 'middle of the room') return { where: 'floor_middle' };
  if (!word) return { where: 'floor', ...floorSpot(s, spec, rp) };
  return { next_to: word };
}

// Is this thing somewhere it does not belong? { better, why } or null. Pip's own choice is allowed; this is what he notices.
// The middle of the room stays free to walk (the rug lies there). Things that belong there: a rug, a mat, a big table people sit around.
const MIDDLE_OK = /\b(rug|mat|carpet|cushion|pillow|beanbag|pouf|mobile|chandelier|(dining|long|big|large|round) table)\b/i;
export const inTheMiddle = (e) => e?.kind === 'floor' && e.pos && Math.abs(e.pos[0]) < 2 && Math.abs(e.pos[2] - 0.8) < 2 && !MIDDLE_OK.test(String(e.name ?? ''));
export function misplaced(s, e) {
  if (!e || e.image || e.art || !e.pos) return null;
  if (e.cover || coverKind(e)) return null; // cloth lies where he spread it
  const rp = rightPlace(e);
  const blocks = e.kind === 'floor' ? [accessProblem(s.decor ?? [], e)].find((t) => /where I stand/.test(t ?? '')) ?? null : null; // it stands where he needs to stand to use something (a planter by the window is fine)
  if (blocks) return { better: 'somewhere that is not in the way', why: blocks.split(',')[0], kind: 'floor', near: null };
  const sz = e.kind === 'floor' ? sizeOf(e) : null;
  if (sz && Math.max(...sz) < SMALL_THING * 1.6 && !rp && fitsOnATop(s.decor ?? [], e)) return { better: 'on a shelf, a table or the desk', why: 'it is small: on the floor it gets lost and is in the way', kind: 'surface', near: null }; // (built 1.6 times bigger)
  if (inTheMiddle(e) && rp?.near?.[0] !== 'middle of the room') { // in the way, wherever else it might go
    const at = nearestNeed(s, rp, [e.pos[0], e.pos[2]]);
    return { better: at ? `near ${at.name}, against a wall` : 'against a wall', why: 'it stands in the middle of the room, in the way where I walk', kind: 'floor', near: at?.name?.replace(/^the /, '') ?? null };
  }
  if (!rp) return null;
  const kind = e.kind ?? (/^on_|surface/.test(e.zone ?? '') ? 'surface' : /^wall/.test(e.zone ?? '') ? 'wall' : /^floor/.test(e.zone ?? '') ? 'floor' : e.zone);
  const sameKind = kind === rp.kind || (rp.kind === 'surface' && kind === 'wall' && /shelf/i.test(String(e.base ?? '') + e.label)) || (rp.kind === 'floor' && kind === 'floor');
  const at = nearestNeed(s, rp, [e.pos[0], e.pos[2]]);
  const far = kind !== 'wall' && at && Math.hypot(at.x - e.pos[0], at.z - e.pos[2]) > 3; // a wall thing hangs where the two walls have room: "too far" is no reason to move it
  if (sameKind && !far) return null;
  if (rp.kind === 'surface' && kind !== 'surface' && !fitsOnATop(s.decor ?? [], e)) return null; // no top could hold it: nothing better to offer
  if (rp.kind === 'surface' && at) { // a better top only counts when one near there has room (a full desk is no better place)
    const room = supportsInfo(s.decor ?? []).some((b) => b.key !== (e.base ?? '') && !b.full && !b.high && b.room > 0 && !/^piano$/.test(b.label) && Math.hypot(b.cx - at.x, b.cz - at.z) <= 3);
    if (!room) return null;
  }
  const where = !sameKind ? `${rp.words}${at ? ` near ${at.name}` : ''}` : `near ${at.name}`;
  return { better: where, why: rp.why, kind: rp.kind, near: at?.name?.replace(/^the /, '') ?? null };
}
export const allMisplaced = (s) => (s.decor ?? []).map((e) => ({ e, m: misplaced(s, e) })).filter((x) => x.m);

// ---- Before he designs a thing, he hears where it will go and how big that place is (research: a model that hears the
// size of the spot first makes things that fit; one that guesses is off by a third, and then things get shrunk or float).
// details: what the brain said ({ what, name, why, where, on }). Returns one short paragraph for the maker, or ''.
const CLOTH_WORD = /\b(blanket|quilt|duvet|bed ?spread|comforter|coverlet|table ?cloth|table ?runner)s?\b(?!\s+(box|rack|ladder|chest|basket|shelf|stand|holder|hook))/i;
const every = (v) => Math.round((v / ROOM_SCALE) * 20) / 20; // room size back to the everyday size he designs in, to 5 cm
export function spotNote(s, details = {}) {
  const decor = s.decor ?? [];
  const said = `${details.name ?? ''} ${details.what ?? ''}`.trim();
  if (!said) return '';
  const lines = [];
  const cloth = CLOTH_WORD.exec(said)?.[1];
  const host = cloth ? coverTarget(decor, { name: cloth, on: details.on }) : null;
  if (host) {
    lines.push(`WHERE IT WILL GO: spread over my ${host.name.replace(/^(the|my) /, '')}. The game lays it over the whole top (about ${every(host.W)} x ${every(host.D)} m in everyday size) and lets the edges hang down, so I do not have to hit the size exactly. I design how it looks from above: one flat layer about ${every(host.W)} m wide, ${every(host.D)} m long and 0.04 m thick, with stripes, patches, a border or a folded edge lying flat on it. Nothing sticks up.`);
    return lines.join('\n');
  }
  const rp = rightPlace({ name: said });
  const wantsTop = Boolean(details.on) || /\b(on (my|the) (desk|shelf|table|bookshelf))\b/i.test(`${details.where ?? ''} ${said}`) || rp?.kind === 'surface' || (!rp && /\b(tiny|small|little|mini)\b/i.test(said));
  if (wantsTop) {
    const tops = supportsInfo(decor).filter((b) => !b.full && !b.high && b.room > 0 && !/^piano$/.test(b.label)).map((b) => ({ b, f: freeSpaceOn(decor, b.key) })).filter((x) => x.f).sort((p, q) => q.f.w * q.f.d - p.f.w * p.f.d).slice(0, 3);
    if (tops.length) {
      const best = tops[0].f;
      lines.push(`WHERE IT WILL GO: on a top. The free tops in my room, in everyday size: ${tops.map(({ b, f }) => `${b.label} (${every(f.w)} x ${every(f.d)} m free, ${every(f.h)} m high)`).join('; ')}. So I design it at most ${every(best.w)} m wide and ${every(best.d)} m deep. A thing that is bigger does not fit on a top: the game then stands it on the floor.`);
    } else lines.push('WHERE IT WILL GO: every top in my room is full, so it will stand on the floor (or wait in my chest). Something for the floor is at least 0.45 m big in everyday size, so it does not get lost.');
  } else if (/\b(rug|carpet|doormat|floor mat|mat)\b/i.test(said) && rp?.kind === 'floor') lines.push('WHERE IT WILL GO: flat on the floor, beside my bed or by my desk (the big round rug already lies in the middle of my room). I walk over it and furniture may stand on it, so it lies flat: at most 0.05 m thick in everyday size, about 1.2 x 0.8 m. I design how it looks from above: a base layer with a border, stripes or a pattern lying flat on it.');
  else if (rp?.kind === 'wall') lines.push('WHERE IT WILL GO: on a wall. It hangs flat against it: at most 0.25 m deep, 1.25 m wide and 1 m high in everyday size. Its back is at z 0.');
  else if (rp?.kind === 'ceiling') lines.push('WHERE IT WILL GO: it hangs from the ceiling. I build it from its top down: the part that hangs highest is at the top.');
  // "a stand for my clay bird": what it is for, and how big that is
  const m = /\bfor (?:my |the |his )?([a-z][a-z ]{2,40})/i.exec(said);
  const forThing = m ? decor.filter((d) => !d.image && d.parts && d.pos).sort((a, b) => b.name.length - a.name.length).find((d) => m[1].toLowerCase().includes(d.name.toLowerCase()) || d.name.toLowerCase().split(' ').filter((w) => w.length > 3).every((w) => m[1].toLowerCase().includes(w))) : null;
  if (forThing) {
    const sz = sizeOf(forThing);
    lines.push(`IT IS FOR my ${forThing.name}, which is ${every(sz[0])} x ${every(sz[2])} m and ${every(sz[1])} m high in everyday size. If that has to stand on it, it needs a flat top at least ${Math.round((every(sz[0]) + 0.05) * 100) / 100} x ${Math.round((every(sz[2]) + 0.05) * 100) / 100} m, and it stands on the floor (a thing can only stand on something that stands on the floor or hangs on a wall).`);
  }
  return lines.join('\n');
}
// After it is made: what it is for, and the exact move that puts that on it (he said "a stand for my bird").
export function forHint(s, entry) {
  const m = /\bfor (?:my |the |his )?([a-z][a-z ]{2,40})/i.exec(String(entry?.name ?? ''));
  if (!m || !entry?.pos || entry.kind === 'surface') return null;
  const y = (s.decor ?? []).filter((d) => d !== entry && !d.image && d.parts && d.pos).sort((a, b) => b.name.length - a.name.length).find((d) => m[1].toLowerCase().includes(d.name.toLowerCase()) || d.name.toLowerCase().split(' ').filter((w) => w.length > 3).every((w) => m[1].toLowerCase().includes(w)));
  return y ? `it is for my ${y.name}: I put that on it with move_thing {name: "${y.name}", on: "${entry.name}"}` : null;
}
// Would this design fit where it is going? One fact in his words (for one retry by the maker), or null. parts: his design in everyday size.
export function fitFact(s, details = {}) {
  const b = box(details.parts);
  if (!b || coverKind(details)) return null;
  const placed = { ...details, ...designate(s, details) };
  if (!placed.on || placed.wall || placed.next_to) return null;
  const tops = supportsInfo(s.decor ?? []).filter((t) => !t.full && !t.high && t.room > 0 && !/^piano$/.test(t.label)).map((t) => ({ t, f: freeSpaceOn(s.decor ?? [], t.key) })).filter((x) => x.f);
  if (!tops.length) return null;
  const [w, h, d] = [b.size[0] * ROOM_SCALE, b.size[1] * ROOM_SCALE, b.size[2] * ROOM_SCALE];
  const fitsOne = tops.some(({ f }) => Math.min(f.w / w, f.d / d, f.h / h, 1) >= MIN_SHRINK);
  if (fitsOne) return null;
  const best = tops.sort((p, q) => q.f.w * q.f.d - p.f.w * p.f.d)[0];
  return `it is ${Math.round(b.size[0] * 100) / 100} x ${Math.round(b.size[2] * 100) / 100} m and ${Math.round(b.size[1] * 100) / 100} m high: too big for every top with room. The biggest free top is ${best.t.label}: ${every(best.f.w)} x ${every(best.f.d)} m free and ${every(best.f.h)} m high (everyday size). I make it fit that, or it has to stand on the floor`;
}
