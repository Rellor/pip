// Pip's museum: an open hall with plinths, south of the pond. What he makes does not have to pile up in his room, and
// nothing has to be forbidden: a thing he is proud of, or has no room for, goes on a plinth, where everyone who visits
// his world can walk up to it and read what it is and why he made it.
// - He can carry a thing there himself, from his room or from his chest (show_in_museum).
// - When his room is full, a new thing he makes goes to the museum by itself at his next wake-up (it stands in his
//   room for a moment first, so he is seen making it).
// - The museum has 40 plinths. When all are taken, the oldest piece moves to the depot (kept, shown on his Made tab).
import { roomThings, ROOM_FULL } from './decor.js';

export const MUSEUM_MAX = 40; // plinths (web/town.js MUSEUM_SLOTS)
export const DEPOT_KEPT = 120;
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const canShow = (d) => d && !d.image && !d.art && d.kind !== 'outside' && Array.isArray(d.parts) && d.parts.length > 0;
const same = (a, b) => clip(a, 80).toLowerCase().replace(/^(my|the|a|an) /, '') === clip(b, 80).toLowerCase().replace(/^(my|the|a|an) /, '');

// One piece on a plinth: what the page needs to show it (its shapes), and what a visitor reads on its card.
function piece(d, now, from, why) {
  return { id: d.id, name: d.name, why: clip(d.why, 200), shown: clip(why, 200), parts: d.parts, roomScaled: Boolean(d.roomScaled), uses: (d.uses ?? []).map((u) => ({ label: u.label })).slice(0, 4), createdAt: d.createdAt ?? d.at, shownAt: new Date(now).toISOString(), from };
}
// Puts a piece in the museum. When every plinth is taken, the oldest piece goes to the depot.
function hang(s, p) {
  s.museum = [...(s.museum ?? []), p];
  while (s.museum.length > MUSEUM_MAX) s.depot = [...(s.depot ?? []), s.museum.shift()].slice(-DEPOT_KEPT);
  return p;
}
// How many things he carried there himself today (three a day is plenty: it is a walk each time).
export const carriedToday = (s, isToday, now) => (s.museum ?? []).filter((p) => p.from !== 'new' && !p.opening && isToday(p.shownAt, now)).length;
// Anything else of his that makes room somewhere (a plaything he no longer uses) can go on a plinth too.
export const toMuseum = (s, d, now = Date.now(), why = '') => hang(s, piece(d, now, 'room', why));
// What he could carry there now: the things in his room and in his chest (not pictures, not what stands outside).
export const showable = (s) => [...roomThings(s.decor).filter(canShow), ...(s.stored ?? []).filter(canShow)];
// He carries a thing to his museum. `name` is the thing; `why` is why this one (shown on its card). Returns { piece } or { failed }.
export function showInMuseum(s, name, why = '', now = Date.now(), { opening = false } = {}) {
  const inRoom = roomThings(s.decor).filter(canShow).find((d) => same(d.name, name)) ?? roomThings(s.decor).filter(canShow).find((d) => clip(name, 80).length > 3 && d.name.toLowerCase().includes(clip(name, 80).toLowerCase()));
  const inChest = inRoom ? null : (s.stored ?? []).filter(canShow).find((d) => same(d.name, name)) ?? (s.stored ?? []).filter(canShow).find((d) => clip(name, 80).length > 3 && d.name.toLowerCase().includes(clip(name, 80).toLowerCase()));
  const d = inRoom ?? inChest;
  if (!d) return { failed: `I have no thing called "${clip(name, 60)}" in my room or my chest to carry to my museum` };
  if (inRoom) {
    for (const x of s.decor) if (String(x.base ?? '').split('#')[0] === d.id) delete x.base; // what stood on it stays in his room
    s.decor = s.decor.filter((x) => x.id !== d.id);
  } else s.stored = s.stored.filter((x) => x.id !== d.id);
  return { piece: hang(s, { ...piece(d, now, inRoom ? 'room' : 'chest', why), ...(opening ? { opening: true } : {}) }), from: inRoom ? 'room' : 'chest' }; // (opening: put there when the museum opened, not carried by him that day)
}
// At the end of a wake-up: a thing he made just now for a room that is full is marked for the museum.
export function markForMuseum(s, sinceMs) {
  const marked = [];
  const fresh = roomThings(s.decor).filter((d) => canShow(d) && !d.forBoard && !d.forMuseum && Date.parse(d.createdAt ?? d.at ?? 0) >= sinceMs).reverse();
  for (const d of fresh) {
    if (roomThings(s.decor).filter((x) => !x.forMuseum && !x.forBoard).length <= ROOM_FULL) break;
    d.forMuseum = true;
    marked.push(d.name);
  }
  return marked;
}
// At every wake-up: what was marked, and has stood in his room for a moment, is carried to the museum. Returns their names.
export function carryToMuseum(s, now = Date.now()) {
  const going = (s.decor ?? []).filter((d) => d.forMuseum && now - Date.parse(d.createdAt ?? d.at ?? 0) > 5 * 60_000);
  if (!going.length) return [];
  const ids = new Set(going.map((d) => d.id));
  for (const x of s.decor) if (ids.has(String(x.base ?? '').split('#')[0])) delete x.base;
  s.decor = s.decor.filter((d) => !ids.has(d.id));
  for (const d of going) hang(s, piece(d, now, 'new', ''));
  return going.map((d) => d.name);
}
// For his prompt.
export function museumLines(s) {
  const n = (s.museum ?? []).length;
  const room = roomThings(s.decor).length;
  const out = [];
  if (room >= ROOM_FULL) out.push(`My room is full (${room} things), and that is fine: a new thing I make now goes on a plinth in my museum, where everyone can see it. I can also carry things from my room or my chest there myself (show_in_museum), so my room keeps what I really use.`);
  else if ((s.stored ?? []).filter(canShow).length >= 3 && n < MUSEUM_MAX) out.push(`In my chest lie ${s.stored.filter(canShow).length} things nobody sees. My museum has room: I can carry one there (show_in_museum).`);
  if (n) out.push(`My museum shows ${n} thing${n === 1 ? '' : 's'} I made (the newest: ${s.museum.slice(-2).map((p) => p.name).join(', ')}). I can walk through it (go_out to my museum).`);
  return out;
}
