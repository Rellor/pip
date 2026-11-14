// Every move Pip can make, with its rules in code. The brain never sees rules: it sees only the 6 to 10 moves
// that make sense right now (availableMoves), each with one short line.
//
// A move: { name, line(s), when(s), score(s), maker }
//   line   one short line in his words, with the details it takes
//   when   true when the move can really work now (tools, limits, things in the room)
//   score  how much he would like it now (needs and drives). Repetition lowers it in availableMoves.
//   maker  true when a separate maker call fills in the details (things he designs). The brain only says what.
import { dayLimits } from './limits.js';
import { missingTool } from './tools.js';
import { kitchenIn } from './food.js';
import { notHungry as notHungryReason } from './feelings.js';
import { plantState, WATER_AGAIN_H, SLOTS_PER_GREENHOUSE } from './web/gardening.js';
import { kindOf } from './body.js';
import { missingForProject } from './projects.js';
import { hasTool } from './tools.js';

export const MIN_MOVES = 6;
export const MAX_MOVES = 10;
export const ASKS_PER_DAY = 2;
const DAY = 86_400_000;

const left = (s, action, now) => {
  const L = dayLimits(s, now)[action];
  return L ? L.max - L.used : Infinity;
};
const can = (s, action, now) => left(s, action, now) > 0 && !missingTool(s, action);
const names = (list, n = 3) => list.slice(0, n).map((x) => `"${x}"`).join(', ');
const own = (s) => (s.decor ?? []).filter((d) => !d.image);
const usable = (s) => own(s).filter((d) => (d.uses ?? []).length);
const plots = (s) => s.garden?.plots ?? [];
const thirsty = (s, now) => plots(s).filter((p) => plantState(p, now).moistLeft <= WATER_AGAIN_H);
const ripe = (s, now) => plots(s).filter((p) => plantState(p, now).ready);
const seeds = (s) => (s.garden?.seeds ?? []).filter((x) => x.qty > 0);
const greenhouse = (s) => own(s).some((d) => /greenhouse/i.test(d.name));
const food = (s) => (s.pantry ?? []).filter((p) => p.qty > 0);
const working = (s) => (s.projects ?? []).filter((p) => p.status === 'working');
const unplacedGifts = (s) => (s.pictures ?? []).filter((p) => p.by !== 'pip' && !(s.decor ?? []).some((d) => d.picture === p.id));
const daysSince = (iso, now) => (iso ? (now - Date.parse(iso)) / DAY : Infinity);
const lastFail = (s) => s.plan?.lastFail ?? null;

// Why an ask would make sense now, or null. At most ASKS_PER_DAY a day.
export function askReason(s, now = Date.now()) {
  if ((s.today?.done?.ask_for ?? 0) >= ASKS_PER_DAY) return null;
  if (s.fullness <= 3 && !food(s).length && !ripe(s, now).length) return 'I am hungry and I have nothing left to eat or harvest (seeds would help)';
  const need = missingForProject(s, (n) => hasTool(s, n) || (s.tools ?? []).some((t) => String(t.name).toLowerCase().includes(String(n).toLowerCase())));
  if (need) return `my project "${need.project}" needs ${need.tool}, and I looked into how it is done`;
  const f = lastFail(s);
  if (f && /need|missing|do not have|don't have|ask for|no tool|nothing called/i.test(f.why)) return `my last try failed: ${f.why}`;
  const stuck = working(s).find((p) => daysSince(p.updatedAt ?? p.since, now) >= 2);
  if (stuck) return `my project "${stuck.title}" has been stuck for days`;
  const proud = (s.projects ?? []).find((p) => p.status === 'done' && p.proud && !p.shown);
  if (proud) return `I finished "${proud.title}" and I am proud of it`;
  return null;
}

export const MOVES = [
  // --- making (a maker fills in the design) ---
  { name: 'decorate', maker: true, line: (s) => `make something new for my room from simple shapes: {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'decorate', n), score: (s) => 1 + s.body.creativity / 3 },
  { name: 'draw', maker: true, line: (s) => `draw a picture: {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'draw', n), score: (s) => 0.8 + s.body.creativity / 4 },
  { name: 'record_song', maker: true, line: (s) => `write and record a song with a few instruments: {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'record_song', n), score: (s) => 0.8 + s.body.creativity / 4 },
  { name: 'make_app', maker: true, line: (s) => `write a little program on my computer: {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'make_app', n), score: (s) => 0.4 + s.body.creativity / 6 },
  { name: 'make_clothes', maker: true, line: (s) => `sew something to wear: {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'make_clothes', n), score: (s) => 0.4 + s.body.creativity / 6 },
  { name: 'change_thing', maker: true, line: (s) => `change or improve something I made (${names(own(s).map((d) => d.name))}): {name, change${working(s).length ? ', project' : ''}}`, when: (s, n) => own(s).length > 0 && can(s, 'change_thing', n), score: (s) => 0.5 + working(s).length * 0.5 },
  { name: 'extend_thing', maker: true, line: (s) => `add more parts to something I made (${names(own(s).map((d) => d.name))}): {name, add}`, when: (s, n) => own(s).length > 0 && can(s, 'extend_thing', n), score: () => 0.4 },
  // --- music ---
  { name: 'play_piano', line: (s) => `play music: {notes like "C4 E4 G4:2 C3+E3+G3:4", instrument: ${['piano', ...(s.tools ?? []).filter((t) => /guitar|harp|kalimba|flute|violin/i.test(t.kind ?? t.name)).map((t) => t.kind ?? t.name)].join(' or ')}}`, when: () => true, score: (s) => 0.8 + s.calm / 10 },
  // --- learning ---
  { name: 'search_web', line: () => 'look something up online: {query}', when: () => true, score: (s) => 0.8 + s.body.curiosity / 3 },
  { name: 'read_book', line: () => 'read about something: {topic}', when: () => true, score: (s) => 0.5 + s.body.curiosity / 4 },
  { name: 'find_picture', line: () => 'find a picture of something online: {query}', when: (s, n) => left(s, 'find_picture', n) > 0, score: (s) => 0.3 + s.body.curiosity / 6 },
  // --- garden and food ---
  { name: 'water', line: (s, n) => `water my plants (${names([...new Set(thirsty(s, n).map((p) => p.plant))])} are dry): {plant}`, when: (s, n) => thirsty(s, n).length > 0 && !missingTool(s, 'water'), score: () => 3 },
  { name: 'harvest', line: (s, n) => `harvest what is ripe (${names([...new Set(ripe(s, n).map((p) => p.plant))])}): {plant}`, when: (s, n) => ripe(s, n).length > 0, score: (s) => 2 + (10 - s.fullness) / 3 },
  { name: 'plant', line: (s) => `plant seeds (${names(seeds(s).map((x) => x.name))}): {seed}`, when: (s) => seeds(s).length > 0 && greenhouse(s) && plots(s).length < SLOTS_PER_GREENHOUSE && !missingTool(s, 'plant'), score: () => 1.5 },
  { name: 'eat', line: (s) => `eat something (${names(food(s).map((p) => p.name), 4)}): {food}`, when: (s, n) => food(s).length > 0 && !notHungryReason(s, n), score: (s) => 1 + (10 - s.fullness) / 2 },
  { name: 'cook', line: () => 'cook a dish from my pantry: {dish, ingredients: [1 to 4]}', when: (s, n) => food(s).length > 0 && kitchenIn(s.decor) && can(s, 'cook', n) && s.fullness < 7, score: (s) => 1 + (10 - s.fullness) / 3 },
  // --- body ---
  { name: 'rest', line: () => 'rest for a while: {}', when: () => true, score: (s) => 0.2 + (10 - s.energy) / 2 },
  { name: 'do', line: () => 'do anything else I can think of, in my own words: {what}', when: () => true, score: () => 1 },
  // --- my things ---
  { name: 'use', line: (s) => `use one of my things (${usable(s).slice(0, 3).map((d) => `"${d.name}": ${(d.uses ?? []).map((u) => u.label).slice(0, 2).join(' / ')}`).join('; ')}): {name, label}`, when: (s) => usable(s).length > 0, score: () => 0.8 },
  { name: 'take_photo', line: () => 'take a photo: {target: window, room, myself or a thing, caption}', when: (s, n) => left(s, 'take_photo', n) > 0, score: () => 0.5 },
  { name: 'place_picture', line: (s) => `hang a picture I was given (${names(unplacedGifts(s).map((p) => p.id))}): {id, wall}`, when: (s) => unplacedGifts(s).length > 0, score: () => 1.5 },
  { name: 'move_thing', line: (s) => `move something in my room (${names(own(s).map((d) => d.name))}): {name, next_to}`, when: (s, n) => own(s).length > 0 && left(s, 'move_thing', n) > 0, score: (s) => 0.3 + (s.tasks ?? []).filter((t) => t.status === 'accepted').length },
  { name: 'remove_decoration', line: (s) => `put something away in my chest (${names(own(s).map((d) => d.name))}): {name}`, when: (s) => own(s).length > 0, score: (s) => (10 - s.body.tidiness) / 3 },
  { name: 'take_out', line: (s) => `take something out of my chest (${names((s.stored ?? []).map((d) => d.name))}): {name}`, when: (s) => (s.stored ?? []).length > 0, score: () => 0.3 },
  { name: 'take_tool', line: () => 'pick up a tool or instrument so I can use it: {name}', when: (s) => /take_tool|inventory/.test(lastFail(s)?.why ?? ''), score: () => 3 },
  { name: 'wear', line: (s) => `wear something (${names((s.wardrobe ?? []).filter((c) => !c.worn).map((c) => c.name))}): {name}`, when: (s) => (s.wardrobe ?? []).some((c) => !c.worn), score: () => 0.3 },
  // --- writing and people ---
  { name: 'write_diary', line: () => 'write in my diary: {text}', when: () => true, score: (s, n) => 0.3 + (new Date(n).getHours() >= 20 ? 1 : 0) },
  { name: 'tell', line: () => 'write a message to Bas: {text}', when: (s, n) => s.plan?.unread > 0 || (s.body.loneliness >= 7 && daysSince(s.outbox?.filter((m) => m.kind === 'tell').at(-1)?.at, n) >= 1), score: (s) => (s.plan?.unread ? 5 : 1) },
  { name: 'ask_for', line: (s, n) => `ask Bas for something (because ${askReason(s, n)}): {item, why}`, when: (s, n) => Boolean(askReason(s, n)), score: () => 2 },
  // --- projects ---
  { name: 'dream', line: () => 'tell Bas about a big dream, something far too big to make myself (he might build it): {what, why}', when: (s, n) => daysSince(s.bigDreamAt, n) >= 3 && s.body.creativity >= 6, score: () => 0.8 },
  { name: 'judge_project', line: (s) => `look at my project (${names(working(s).filter((p) => (p.versions ?? []).length).map((p) => p.title))}) and say if I am proud of it: {title, proud: "yes" or "no", why}`, when: (s) => working(s).some((p) => (p.versions ?? []).length), score: (s) => 0.6 + working(s).filter((p) => (p.versions ?? []).length >= 2).length },
  { name: 'start_project', line: () => 'start a project, something to make or learn over days: {title, why, steps: [3 to 6 short steps], needs: [tools it needs, if any]}', when: (s) => working(s).length < 2, score: (s) => 0.5 + s.body.creativity / 5 + (working(s).length ? 0 : 1) },
];
export const MOVE_NAMES = MOVES.map((m) => m.name);
export const MAKER_MOVES = MOVES.filter((m) => m.maker).map((m) => m.name);
export const byName = (name) => MOVES.find((m) => m.name === name) ?? null;

// The moves that make sense now: 6 to 10, best first, each with one line.
// Repetition lowers a move: each time in his last 15 moves halves it, and 4 or more times today cuts it hard.
export function availableMoves(s, { now = Date.now(), random = Math.random } = {}) {
  const recent = (s.recent?.moves ?? []).map((m) => m.move);
  const recentKinds = (s.recent?.moves ?? []).slice(-5).map((m) => m.kind);
  const scored = [];
  for (const m of MOVES) {
    let ok = false;
    try { ok = Boolean(m.when(s, now)); } catch { ok = false; }
    if (!ok) continue;
    let score = m.score(s, now);
    score *= 0.5 ** recent.filter((x) => x === m.name).length;
    if ((s.today?.done?.[m.name] ?? 0) >= 4 && !['eat', 'rest', 'water', 'harvest'].includes(m.name)) score *= 0.2;
    score *= 0.8 ** recentKinds.filter((k) => k === kindOf(m.name)).length;
    scored.push({ m, score: score * (0.75 + random() * 0.5) });
  }
  scored.sort((a, b) => b.score - a.score);
  const pick = scored.slice(0, MAX_MOVES);
  for (const must of ['do', 'tell', 'ask_for']) { // always a free move; and when someone wrote or something is missing, a way to say so
    const hit = scored.find((x) => x.m.name === must);
    if (hit && !pick.includes(hit)) pick[pick.length - 1] = hit;
  }
  while (pick.length < MIN_MOVES && scored.length > pick.length) pick.push(scored[pick.length]);
  return pick.map(({ m }) => ({ name: m.name, line: m.line(s, now), maker: Boolean(m.maker) }));
}
