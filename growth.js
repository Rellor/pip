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
// One lesson in one short line: the first sentence of what went wrong (the rest was the game's long explanation).
// The useful part of a lesson is what to do instead (it comes after the first sentence, which only says what went wrong).
// Research: showing a small model its failed action makes it more likely to repeat it; showing what works does not.
const firstSentence = (t, n = 170) => { const parts = String(t ?? '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter((x) => x.length > 12); const how = parts.slice(1).join(' '); const one = how.length >= 25 ? how : parts[0] ?? String(t ?? ''); return one.length <= n ? one : `${one.slice(0, n).replace(/\s+\S*$/, '')}…`; };
const lessonLine = (l) => `${MOVE_WORDS[l.move] ?? l.move.replace(/_/g, ' ')}: ${firstSentence(l.text)}${l.count > 1 ? ` (this went wrong ${l.count} times)` : ''}${l.solvedAt ? ' (I got past this)' : ''}`;
// For the maker: what went wrong before with this kind of thing.
export function lessonsFor(s, move, now = Date.now()) {
  return (s.lessons ?? []).filter((l) => l.move === move && now - Date.parse(l.at) < 21 * DAY).sort((a, b) => Boolean(a.solvedAt) - Boolean(b.solvedAt) || b.count - a.count).slice(0, 3).map(lessonLine);
}
// For the brain: open lessons for the moves offered now (the ones he has not got past yet first).
export function lessonLines(s, offered = [], now = Date.now()) {
  const names = new Set(offered);
  return (s.lessons ?? []).filter((l) => names.has(l.move) && now - Date.parse(l.at) < 7 * DAY && !l.solvedAt).sort((a, b) => b.count - a.count).slice(0, 2).map(lessonLine); // only what he has not got past yet (a short list is read; a long one is not)
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
export function darkSpots(s, now = Date.now(), o = {}) {
  if (s.last?.sleeping) return [];
  const spots = ['desk', 'bed', 'bookshelf', 'middle of the room'].map((w) => placeFor(s, w)).filter(Boolean);
  for (const d of (s.decor ?? []).filter((x) => handsOn(x) && x.pos)) spots.push({ name: d.name, x: d.pos[0], z: d.pos[2] });
  return spots.map((p) => ({ name: p.name.replace(/^the /, ''), level: lightAt(s, p.x, p.z, now, o).level, x: p.x, z: p.z })).filter((p) => p.level < DARK).sort((a, b) => a.level - b.level);
}
// Where a lamp is needed: places that stay dark even with every lamp he has switched on (the game knows how far each
// lamp reaches, on or off). A dark place that one of his lamps reaches only needs that lamp switched on (or moved), not a new one.
export const needLampSpots = (s, now = Date.now()) => darkSpots(s, now, { allOn: true });
export const roomIsDark = (s, now = Date.now()) => needLampSpots(s, now).length > 0;
const ownLamps = (s) => (s.decor ?? []).filter(isLamp).length;
export function darkLines(s, now = Date.now()) {
  const off = s.phone ? darkLampOff(s, now) : null;
  if (off) return [`It is dark at the ${off.spot.name} (${Math.round(off.spot.level * 100)}%), but my ${lampName(off.lamp)} is right there and off: I can switch it on with my phone.`];
  const need = needLampSpots(s, now);
  if (!need.length) {
    const dark = darkSpots(s, now);
    return dark.length >= 2 ? [`It is dark at the ${dark.slice(0, 2).map((p) => p.name).join(' and ')}, but my lamps reach there: I switch them on with my phone (or brighter). I do not need a new lamp.`] : [];
  }
  const where = need.slice(0, 2).map((p) => `the ${p.name}`).join(' and ');
  const research = lookedUpLight(s) ? '' : ' I could first look up how a standing lamp, a reading lamp or a lantern is made (search_web), so mine looks right and really gives light.';
  return [`It stays dark at ${where}, even with all my lamps on: ${ownLamps(s) ? 'none of them reaches there' : 'I have no lamp of my own yet'}. A lamp there (a new one, or one of mine moved there) would let me see and make it cozy.${research}`];
}

// ---- Notebook: what he looked up stays with him, so it helps when he makes something about it (learn, then make).
export function noteResearch(s, { query, page, at = new Date().toISOString(), project = null }) {
  const text = String(page?.text ?? '').replace(/\s+/g, ' ').trim();
  if (!query || !text) return null;
  s.notebook ??= [];
  const n = { at, query: String(query).slice(0, 100), title: String(page.title ?? '').slice(0, 80), text: text.slice(0, 500), ...(project ? { project: String(project).slice(0, 80) } : {}) };
  s.notebook = [...s.notebook.filter((x) => x.title !== n.title), n].slice(-20);
  return n;
}
// For the maker: up to 2 notes that share words with what he is making.
export function notesFor(s, what, project = null) {
  const want = new Set(words(`${what} ${project ?? ''}`));
  if (!want.size && !project) return [];
  return (s.notebook ?? []).map((n) => ({ n, k: words(`${n.query} ${n.title}`).filter((w) => want.has(w) || want.has(w.replace(/s$/, ''))).length + (project && n.project === project ? 5 : 0) })).filter((x) => x.k > 0).sort((a, b) => b.k - a.k || b.n.at.localeCompare(a.n.at)).slice(0, 2).map(({ n }) => `I looked up "${n.query}" and read about ${n.title}: ${n.text}`);
}
const lookedUpLight = (s) => (s.notebook ?? []).some((n) => /\b(lamp|lamps|lantern|light|lighting|candle)\b/i.test(`${n.query} ${n.title}`));

// ---- Room for his things: when the surfaces he can reach are full, he notices it, and that he can build storage.
import { supportsInfo, onDeskGear } from './decor.js';
const roomFor = (s) => {
  const info = supportsInfo(s.decor ?? []);
  return { full: info.filter((b) => b.full && !b.high), free: info.filter((b) => !b.full && !b.high && b.room > 0 && !/^(desk|piano)$/.test(b.label)) };
};
// Full surfaces, and nowhere else to put things: then building storage is the way.
export function storageFull(s) {
  const { full, free } = roomFor(s);
  return full.length && !free.length ? full : null;
}
export function storageLines(s) {
  const { full, free } = roomFor(s);
  if (!full.length) return [];
  const b = full[0];
  const what = `${[...(b.fixed ?? []), ...b.on].slice(0, 7).join(', ')}${(b.fixed ?? []).length + b.on.length > 7 ? ' and more' : ''}`;
  if (free.length) return [`My ${b.label} is full (${what}). My ${free[0].label.replace(/ \(level \d+\)$/, '')} has room: I can move some things there (move_thing, on: "${free[0].label.replace(/ \(level \d+\)$/, '')}").`];
  return [`My ${b.label} is full: ${what}. There is no room for anything else. A shelf within my reach, a small table or a stand would give my things a place (then I can move some there).`];
}

// ---- Things in the right place: he notices one thing that would be better somewhere else (his choice, but he likes it right).
import { allMisplaced } from './placement.js';
export function placeLines(s) {
  const first = allMisplaced(s)[0];
  if (!first) return [];
  const { e, m } = first;
  const how = m.kind === 'ceiling' ? '(move_thing with where: "ceiling")' : m.kind === 'wall' ? `(move_thing with wall${m.near ? ` near ${m.near}` : ''})` : m.kind === 'surface' ? `(move_thing with on: "${m.near && m.near !== 'bed' ? m.near : 'desk'}")` : `(move_thing with next_to: "${m.near ?? 'the wall'}")`;
  return [`My ${e.name} would be better ${m.better}: ${m.why}. I could move it there ${how}.`];
}

// ---- Dark, but a lamp of his is right there and off: switching it on (his phone) comes before making a new one.
import { lampsOf, lampName, lampNow } from './web/lights.js';
export function darkLampOff(s, now = Date.now()) {
  for (const spot of darkSpots(s, now)) {
    const p = placeFor(s, spot.name) ?? null;
    if (!p) continue;
    const lamp = lampsOf(s).find((e) => e.pos && !lampNow(e, now).on && Math.hypot(e.pos[0] - p.x, e.pos[2] - p.z) <= 3);
    if (lamp) return { spot, lamp };
  }
  return null;
}

// ---- What he sees around him: the furniture, what stands on it, his own things and the lamps (a few short lines).
import { lampsOf as allLamps, lampName as nameOfLamp, lampNow as lampStateNow } from './web/lights.js';
export function roomLines(s, now = Date.now()) {
  const gone = (k) => s.furniture?.[k]?.gone;
  const furniture = ['my bed', 'my desk (with my computer, the keyboard, a mug and the photo printer on it)', 'the big bookshelf full of books (its top is too high for me)', 'my chest', 'a big plant', 'a round rug', 'two windows with curtains', ...(gone('piano') ? [] : ['the piano'])];
  const lines = [`Furniture: ${furniture.join(', ')}.`];
  for (const b of supportsInfo(s.decor ?? []).filter((x) => x.on.length)) lines.push(`On ${b.label === 'desk' ? 'my desk' : `my ${b.label}`}: ${b.on.join(', ')}${b.full ? ' (full)' : ''}.`);
  for (const x of onDeskGear(s.decor)) lines.push(`My ${x.name} stands on ${x.on}: it is in the way when I work. I move it (move_thing).`);
  const mine = (s.decor ?? []).filter((d) => !d.image && d.kind !== 'surface').map((d) => `${d.name} (${String(d.label ?? '').replace(/ \(.*\)$/, '')})`);
  if (mine.length) lines.push(`My things: ${mine.slice(0, 8).join(', ')}${mine.length > 8 ? ' and more' : ''}.`);
  const pics = (s.decor ?? []).filter((d) => d.image).length;
  if (pics) lines.push(`On my walls: ${pics} picture${pics > 1 ? 's' : ''}.`);
  const lamps = allLamps(s).map((e) => { const st = lampStateNow(e, now); return `${nameOfLamp(e)} ${st.on ? `on${st.level < 100 ? ` ${st.level}%` : ''}` : 'off'}`; });
  if (lamps.length) lines.push(`Lamps: ${lamps.join(', ')}.`);
  return lines;
}

// ---- Less joy from repeating (like Pino's "it did less for you than it used to"): the more often he does the same
// thing in a day, the less it gives him. Needs (eating, resting, the garden) never wear off.
export const HABIT_FREE = ['eat', 'rest', 'water', 'harvest', 'walk_to', 'do', 'tell', 'ask_for', 'phone', 'plan_project', 'judge_project', 'start_project', 'work_on_project'];
const HABIT_WORDS = { decorate: 'making things', draw: 'drawing', play_piano: 'playing music', record_song: 'recording songs', search_web: 'looking things up', read_book: 'reading', browse: 'browsing', move_thing: 'moving things around', change_thing: 'changing my things', write_diary: 'writing in my diary', take_photo: 'taking photos', cook: 'cooking', make_app: 'writing programs', update_app: 'working on my programs', make_clothes: 'sewing', use: 'using my things', find_picture: 'finding pictures' };
export const timesToday = (s, move, now = Date.now()) => (s.log ?? []).filter((e) => (e.as ?? e.action) === move && !e.failed && !e.fallback && now - Date.parse(e.at) < 86_400_000 && Date.parse(e.at) <= now).length;
// The most it can still be worth today (10 is the best), from how often he already did it.
export const habitCap = (s, move, now = Date.now()) => (HABIT_FREE.includes(move) ? 10 : Math.max(3, 10 - Math.max(0, timesToday(s, move, now) - 2) * 1.5));
export function habitLines(s, offered = [], now = Date.now()) {
  const worn = offered.filter((m) => !HABIT_FREE.includes(m) && timesToday(s, m, now) >= 4).map((m) => `${HABIT_WORDS[m] ?? m.replace(/_/g, ' ')} (${timesToday(s, m, now)} times today)`);
  return worn.length ? [`${worn.slice(0, 2).join(' and ')} did less for me than it used to. Something I have not done today would feel better.`] : [];
}
