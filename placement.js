// Where things belong. The game knows, like anyone who has lived in a home, that a ceiling lamp hangs from the ceiling,
// a reading light stands where he reads, a stove stands on the floor, plants want the window and a painting hangs on a
// wall. When Pip does not say where a new thing goes, it goes to its right place. He may put it somewhere else (it is his
// room), but then he notices it would be better elsewhere, and putting it right is offered to him.
import { placeFor } from './web/lighting.js';
import { supportsInfo } from './decor.js';

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
  { re: /\b(rug|mat|carpet|cushion|pillow|beanbag|pouf)\b/i, kind: 'floor', near: ['middle of the room', 'bed'], why: 'it lies on the floor' },
  { re: /\b(chair|stool|seat|bench|armchair|sofa|couch)\b/i, kind: 'floor', near: ['desk', 'window'], why: 'a seat stands where I sit: at the desk or by the window' },
  { re: /\b(table|nightstand|bedside table|desk)\b/i, kind: 'floor', near: ['bed', 'desk'], why: 'a table stands on the floor' },
  { re: /\b(easel|loom|workbench|potter'?s wheel)\b/i, kind: 'floor', near: ['window'], why: 'I work at it in good light' },
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
export function designate(s, spec) {
  const said = ['where', 'on', 'wall', 'x', 'z', 'next_to', 'along', 'height', 'ceiling'].some((k) => spec?.[k] !== undefined && spec?.[k] !== null && spec?.[k] !== '');
  const rp = rightPlace(spec);
  if (said || !rp) return {};
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
  if (word === 'middle of the room' || !word) return { where: rp.near?.[0] === 'middle of the room' ? 'floor_middle' : 'floor' };
  return { next_to: word };
}

// Is this thing somewhere it does not belong? { better, why } or null. Pip's own choice is allowed; this is what he notices.
export function misplaced(s, e) {
  if (!e || e.image || e.art || !e.pos) return null;
  const rp = rightPlace(e);
  if (!rp) return null;
  const kind = e.kind ?? (/^on_|surface/.test(e.zone ?? '') ? 'surface' : /^wall/.test(e.zone ?? '') ? 'wall' : /^floor/.test(e.zone ?? '') ? 'floor' : e.zone);
  const sameKind = kind === rp.kind || (rp.kind === 'surface' && kind === 'wall' && /shelf/i.test(String(e.base ?? '') + e.label)) || (rp.kind === 'floor' && kind === 'floor');
  const at = nearestNeed(s, rp, [e.pos[0], e.pos[2]]);
  const far = at && Math.hypot(at.x - e.pos[0], at.z - e.pos[2]) > 3;
  if (sameKind && !far) return null;
  const where = !sameKind ? `${rp.words}${at ? ` near ${at.name}` : ''}` : `near ${at.name}`;
  return { better: where, why: rp.why, kind: rp.kind, near: at?.name?.replace(/^the /, '') ?? null };
}
export const allMisplaced = (s) => (s.decor ?? []).map((e) => ({ e, m: misplaced(s, e) })).filter((x) => x.m);
