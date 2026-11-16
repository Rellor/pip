// How Pip grows over time, in plain code (no extra model calls):
// A. Lessons: when a move fails, the reason becomes a lesson. He sees his lessons when he makes that kind of thing again,
//    so the same mistake does not happen ten times. A lesson he got past stays as something he learned.
// B. Recipe book: things he made that worked are kept as recipes. When he makes something like it again, he sees how he
//    did it before and builds on it, so he really gets better over weeks (things he is proud of come first).
// C. Something new: moves he has never or hardly done feel more inviting, and when one topic fills his thoughts all day,
//    he notices it and feels a gentle pull towards something else.
import { words } from './checkup.js';

const DAY = 86_400_000;
const MOVE_WORDS = { record_song: 'recording a song', change_thing: 'changing something I made', extend_thing: 'adding to something I made', decorate: 'making something', draw: 'drawing', make_app: 'writing a program', make_clothes: 'sewing', move_thing: 'moving something', plant: 'planting', cook: 'cooking', water: 'watering', harvest: 'harvesting', place_picture: 'hanging a picture', use: 'using something', eat: 'eating', search_web: 'looking something up', take_photo: 'taking a photo' };
const SKIP = ['walk_to', 'do', 'rest', 'tell', 'write_diary'];
// The reason without code examples meant for the old instructions.
const plain = (t) => String(t ?? '').replace(/[:\s]*[\[{][\s\S]*$/, '').replace(/\s+/g, ' ').trim().slice(0, 180);

// ---- A. Lessons
export function noteLesson(s, move, reason, at = new Date().toISOString()) {
  if (SKIP.includes(move)) return null;
  const text = plain(reason);
  if (!text) return null;
  s.lessons ??= [];
  let l = s.lessons.find((x) => x.move === move && x.text === text);
  if (l) Object.assign(l, { count: l.count + 1, at, solvedAt: null });
  else s.lessons.push((l = { move, text, count: 1, at, firstAt: at, solvedAt: null }));
  s.lessons = s.lessons.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 24);
  return l;
}
// The move worked: lessons for it count as learned (they stay, as something he knows now).
export function noteWorked(s, move, at = new Date().toISOString()) {
  for (const l of s.lessons ?? []) if (l.move === move && !l.solvedAt) l.solvedAt = at;
}
const lessonLine = (l) => `${MOVE_WORDS[l.move] ?? l.move.replace(/_/g, ' ')}: ${l.text}${l.count > 1 ? ` (this went wrong ${l.count} times)` : ''}${l.solvedAt ? ' (I got past this)' : ''}`;
// For the maker: what went wrong before with this kind of thing.
export function lessonsFor(s, move, now = Date.now()) {
  return (s.lessons ?? []).filter((l) => l.move === move && now - Date.parse(l.at) < 21 * DAY).sort((a, b) => Boolean(a.solvedAt) - Boolean(b.solvedAt) || b.count - a.count).slice(0, 3).map(lessonLine);
}
// For the brain: open lessons for the moves offered now (the ones he has not got past yet first).
export function lessonLines(s, offered = [], now = Date.now()) {
  const names = new Set(offered);
  return (s.lessons ?? []).filter((l) => names.has(l.move) && now - Date.parse(l.at) < 7 * DAY && (!l.solvedAt || l.count >= 3)).sort((a, b) => Boolean(a.solvedAt) - Boolean(b.solvedAt) || b.count - a.count).slice(0, 3).map(lessonLine);
}

// ---- B. Recipe book
const round = (v) => (Array.isArray(v) ? v.map(round) : typeof v === 'number' ? Math.round(v * 100) / 100 : v);
const compactParts = (parts) => (parts ?? []).slice(0, 40).map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => ['shape', 'size', 'pos', 'rot', 'color', 'glow'].includes(k)).map(([k, v]) => [k, round(v)])));
// kind: 'decorate' | 'record_song' | 'make_clothes'. data: { parts } or { song: "description" }.
export function saveRecipe(s, { kind, name, why = '', parts = null, song = null, proud = false, at = new Date().toISOString() }) {
  if (!name || (!parts?.length && !song)) return null;
  s.recipes ??= [];
  const old = s.recipes.find((r) => r.kind === kind && r.name.toLowerCase() === String(name).toLowerCase());
  const r = { kind, name: String(name).slice(0, 60), why: String(why ?? '').slice(0, 160), ...(parts ? { parts: compactParts(parts) } : {}), ...(song ? { song: String(song).slice(0, 900) } : {}), proud: proud || Boolean(old?.proud), at };
  if (old) s.recipes.splice(s.recipes.indexOf(old), 1);
  s.recipes.push(r);
  // Keep every proud recipe (up to 12) and the 10 newest others.
  const proudOnes = s.recipes.filter((x) => x.proud).slice(-12);
  const others = s.recipes.filter((x) => !x.proud).slice(-10);
  s.recipes = [...others, ...proudOnes].sort((a, b) => a.at.localeCompare(b.at));
  return r;
}
export function markProud(s, name) {
  const r = (s.recipes ?? []).find((x) => x.name.toLowerCase() === String(name ?? '').toLowerCase());
  if (r) r.proud = true;
  return r ?? null;
}
const SAME_KIND = { decorate: ['decorate'], change_thing: ['decorate'], extend_thing: ['decorate'], record_song: ['record_song'], make_clothes: ['make_clothes'] };
// For the maker: up to 2 recipes of the same kind, the most alike first (shared words), proud ones before others.
export function recipesFor(s, move, what = '') {
  const kinds = SAME_KIND[move];
  if (!kinds) return [];
  const want = new Set(words(what));
  const score = (r) => words(`${r.name} ${r.why}`).filter((w) => want.has(w)).length * 2 + (r.proud ? 1.5 : 0);
  return (s.recipes ?? []).filter((r) => kinds.includes(r.kind)).map((r) => ({ r, n: score(r) })).sort((a, b) => b.n - a.n || b.r.at.localeCompare(a.r.at)).slice(0, 2).map(({ r }) =>
    `"${r.name}"${r.proud ? ' (I am proud of this one)' : ''}${r.why ? `: ${r.why}` : ''}\n${r.parts ? `parts: ${JSON.stringify(r.parts).slice(0, 1400)}` : r.song}`);
}

// ---- C. Something new
export function noteEver(s, move) {
  s.ever ??= {};
  s.ever[move] = (s.ever[move] ?? 0) + 1;
}
// A move he has never done is more inviting; one he did only a few times a little.
export const noveltyBoost = (s, move) => {
  if (SKIP.includes(move)) return 1;
  const n = s.ever?.[move] ?? 0;
  return n === 0 ? 1.6 : n < 3 ? 1.25 : 1;
};
// One word filling most of his recent thoughts: he has been going round one topic.
export function topicLoop(s, now = Date.now()) {
  const recent = (s.thoughts ?? []).filter((t) => !t.private && !t.sealed && now - Date.parse(t.at) < 6 * 3_600_000).slice(-12);
  if (recent.length < 8) return null;
  const count = {};
  for (const t of recent) for (const w of words(t.text)) count[w] = (count[w] ?? 0) + 1;
  const [w, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0] ?? [];
  return n >= recent.length * 0.6 ? w : null;
}
// Lines for the brain: the topic he keeps circling, and something on the list he has never tried.
export function freshLines(s, offered = [], now = Date.now()) {
  const out = [];
  const loop = topicLoop(s, now);
  if (loop) out.push(`I have been thinking about "${loop}" for hours now. Something different would feel fresh, and I can come back to it later.`);
  const never = offered.filter((m) => !SKIP.includes(m) && !(s.ever?.[m] ?? 0) && MOVE_WORDS[m]);
  if (never.length) out.push(`Something I have never tried: ${MOVE_WORDS[never[0]]}. I wonder what it is like.`);
  return out;
}

// ---- Light: he notices when the places he uses are dark (evening, a grey day), and that a lamp of his own would help.
// Plain code from the light model (real time, weather, windows, his lamps). Dim is cozy; only really dark places count.
import { lightAt, placeFor, isLamp, levelWord } from './web/lighting.js';
import { handsOn } from './sizes.js';
const DARK = 0.2;
export function darkSpots(s, now = Date.now()) {
  if (s.last?.sleeping) return [];
  const spots = ['desk', 'bed', 'bookshelf', 'middle of the room'].map((w) => placeFor(s, w)).filter(Boolean);
  for (const d of (s.decor ?? []).filter((x) => handsOn(x) && x.pos)) spots.push({ name: d.name, x: d.pos[0], z: d.pos[2] });
  return spots.map((p) => ({ name: p.name.replace(/^the /, ''), level: lightAt(s, p.x, p.z, now).level })).filter((p) => p.level < DARK).sort((a, b) => a.level - b.level);
}
export const roomIsDark = (s, now = Date.now()) => darkSpots(s, now).length >= 2;
export function darkLines(s, now = Date.now()) {
  const dark = darkSpots(s, now);
  if (dark.length < 2) return [];
  const lamps = (s.decor ?? []).filter(isLamp).length;
  const where = dark.slice(0, 3).map((p) => `${p.name} is ${levelWord(p.level)} (${Math.round(p.level * 100)}%)`).join(', ');
  return [`It is dark in my room: ${where}. ${lamps ? 'My lamps do not reach there.' : 'I have no lamp of my own yet.'} A lamp I make myself (a part that glows, and a use that does light) would let me see and make it cozy.`];
}
