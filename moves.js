// Every move Pip can make, with its rules in code. The brain never sees rules: it sees only the 6 to 10 moves
// that make sense right now (availableMoves), each with one short line.
//
// A move: { name, line(s), when(s), score(s), maker }
//   line   one short line in his words, with the details it takes
//   when   true when the move can really work now (tools, limits, things in the room)
//   score  how much he would like it now (needs and drives). Repetition lowers it in availableMoves.
//   maker  true when a separate maker call fills in the details (things he designs). The brain only says what.
import { dayLimits } from './limits.js';
import { missingTool, NEEDS } from './tools.js';
import { kitchenIn } from './food.js';
import { supportsInfo, onDeskGear } from './decor.js';
import { allMisplaced } from './placement.js';
import { notHungry as notHungryReason } from './feelings.js';
import { plantState, WATER_AGAIN_H, SLOTS_PER_GREENHOUSE, isGreenhouse } from './web/gardening.js';
import { kindOf } from './body.js';
import { noveltyBoost, roomIsDark, needLampSpots, storageFull, darkLampOff } from './growth.js';
import { restingMove, tiredOf } from './loops.js';
import { canBrowse, interests, HOBBY_AT } from './curiosity.js';
import { shopLine, shopOpen, wantsToBuy } from './shop.js';
import { goOptions, goLine, wantsOut, gearWish, canGo } from './world.js';
import { boardNotes, boardCalls } from './board.js';
import { lampsOf, lampName, lampNow } from './web/lights.js';
import { missingForProject, workStep } from './projects.js';
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
const greenhouse = (s) => own(s).some(isGreenhouse); // a greenhouse or a planter
const food = (s) => (s.pantry ?? []).filter((p) => p.qty > 0);
const working = (s) => (s.projects ?? []).filter((p) => p.status === 'working');
// He has ingredients or a food project, but nothing to cook on: building a stove is the way forward.
const needsKitchen = (s) => !kitchenIn(s.decor) && (food(s).some((p) => p.kind === 'ingredient') || working(s).some((p) => /bread|bake|cook|soup|kitchen|food|meal/i.test(p.title)));
// Projects whose next step he can do now (a step that needs a tool he lacks waits for the tool).
const stuckStep = (p) => p.stuck?.n >= 2 && Date.now() - Date.parse(p.stuck.at ?? 0) < 12 * 3_600_000 && (p.steps ?? []).find((x) => !x.done)?.text === p.stuck.text; // stuck for 12 hours at most // the game's way failed twice: he plans it again
export const workable = (s) => working(s).filter((p) => { const st = workStep(s, p.title); return st && !stuckStep(p) && can(s, st.action, Date.now()) && findProjectTitle(st) === p.title; }); // not when the step's move is used up for today or needs a tool he lacks
const findProjectTitle = (st) => st.forStep?.project;
// A surface with too much on it, and a place of his with room: what to move where (or null).
const tidyUp = (s) => {
  const info = supportsInfo(s.decor ?? []);
  const free = info.find((b) => !b.full && !b.high && b.room > 0 && !/^(desk|piano)$/.test(b.label));
  const messy = onDeskGear(s.decor)[0]; // something standing on his keyboard or screen is in the way, however few things are on the desk
  if (messy && free) return { full: 'desk', thing: messy.name, to: free.label.replace(/ \(level \d+\)$/, ''), why: `stands on ${messy.on}` };
  const full = info.find((b) => !b.high && b.on.length > (b.label === 'desk' ? 2 : 4)); // the desk: his computer, keyboard, mug and printer take most of it
  return full && free ? { full: full.label, thing: full.on[full.on.length - 1], to: free.label.replace(/ \(level \d+\)$/, '') } : null;
};
const unplanned = (s) => working(s).filter((p) => !(p.steps ?? []).length || stuckStep(p)); // a project with no steps has no next step, so he goes round in circles
const unplacedGifts = (s) => (s.pictures ?? []).filter((p) => p.by !== 'pip' && !(s.decor ?? []).some((d) => d.picture === p.id));
const daysSince = (iso, now) => (iso ? (now - Date.parse(iso)) / DAY : Infinity);
const lastFail = (s) => s.plan?.lastFail ?? null;
const HELD_KINDS = ['guitar', 'violin', 'flute', 'clarinet', 'kalimba', 'harp'];
// What he can make music on now: the piano when it is in his room (or was given back), and held instruments he owns.
export const instruments = (s) => ['voice', ...(!s.furniture?.piano?.gone || (s.tools ?? []).some((t) => /piano/i.test(`${t.kind} ${t.name}`)) ? ['piano'] : []), ...new Set((s.tools ?? []).map((t) => String(t.kind ?? '').toLowerCase()).filter((k) => HELD_KINDS.includes(k)))];

// A project whose next step needs a tool he does not have (and has not asked for yet): it cannot go on without it.
export function blockedProject(s) {
  for (const p of working(s)) {
    const st = workStep(s, p.title);
    const need = st && missingTool(s, st.action) ? NEEDS[st.action] : null;
    if (need && !(s.asks ?? []).some((a) => a.status === 'open' && a.item.toLowerCase().includes(need.split(' ')[0]))) return { project: p.title, tool: need, step: st.forStep.text };
  }
  return null;
}
// Why an ask would make sense now, or null. At most ASKS_PER_DAY a day, plus one more for a project that is stuck without a tool.
export function askReason(s, now = Date.now()) {
  const asked = s.today?.done?.ask_for ?? 0;
  const blocked = blockedProject(s);
  if (blocked && asked < ASKS_PER_DAY + 1) return `my project "${blocked.project}" cannot go on: "${blocked.step}" needs ${blocked.tool}, and I do not have any`;
  if (asked >= ASKS_PER_DAY) return null;
  const askedForMusic = (s.asks ?? []).some((a) => a.status === 'open' && /piano|guitar|violin|flute|clarinet|kalimba|harp|instrument|ukulele|drum/i.test(a.item));
  if (instruments(s).length === 1 && !askedForMusic && (s.today?.done?.play_piano ?? 0) >= 2) return 'I can only hum and sing, and I would like an instrument'; // he sang today and wants more
  if (s.fullness <= 3 && !food(s).length && !ripe(s, now).length) return 'I am hungry and I have nothing left to eat or harvest (seeds would help)';
  const need = missingForProject(s, (n) => hasTool(s, n) || (s.tools ?? []).some((t) => String(t.name).toLowerCase().includes(String(n).toLowerCase())));
  if (need) return `my project "${need.project}" needs ${need.tool}, and I looked into how it is done`;
  const gear = gearWish(s, now); // the rain, the frost or a missing library card keeps him in (world.js)
  if (gear) return gear;
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
  { name: 'decorate', maker: true, line: (s, n) => `make a sculpture, a piece of furniture or a thing for my room from simple shapes${needsKitchen(s) ? ' (I have no kitchen yet: a small stove or oven would let me cook)' : storageFull(s) ? ' (my desk is full: a shelf within reach, a small table or a stand would give my things a place)' : roomIsDark(s, n) ? ` (no lamp of mine reaches the ${needLampSpots(s, n)[0].name}: a lamp there would help)` : ' (a big thing, even bigger than a house, can stand outside at a place I pick: where "outside by the pond")'}: {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'decorate', n), score: (s, n) => 1 + s.body.creativity / 3 + (needsKitchen(s) ? 1.5 : 0) + (roomIsDark(s, n) ? 0.6 : 0) + (storageFull(s) ? 1 : 0) },
  { name: 'draw', maker: true, line: (s) => `draw a picture: {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'draw', n), score: (s) => 0.8 + s.body.creativity / 4 },
  { name: 'record_song', maker: true, line: (s) => `write and record a song (with ${instruments(s).join(', ')}${instruments(s).length ? ' and drums' : ''}): {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'record_song', n) && instruments(s).length > 0, score: (s) => 0.8 + s.body.creativity / 4 },
  { name: 'make_app', maker: true, line: (s) => `write a little program or game on my computer (start small: a game I can grow a bit every day as a project): {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'make_app', n), score: (s) => 0.4 + s.body.creativity / 6 },
  { name: 'update_app', maker: true, line: (s) => `add one new thing to a program I made (${names((s.apps ?? []).slice(-3).reverse().map((a) => `${a.name}${a.v ? ` v${a.v}` : ''}`))}): {name, change}`, when: (s, n) => (s.apps ?? []).length > 0 && can(s, 'update_app', n), score: (s) => 0.4 + s.body.creativity / 6 + ((s.apps ?? []).some((a) => (s.projects ?? []).some((p) => p.status === 'working' && (p.versions ?? []).some((v) => v.name === a.name))) ? 0.8 : 0) },
  { name: 'make_clothes', maker: true, line: (s) => `sew something to wear: {what, why${working(s).length ? ', project' : ''}}`, when: (s, n) => can(s, 'make_clothes', n), score: (s) => 0.4 + s.body.creativity / 6 },
  { name: 'change_thing', maker: true, line: (s) => `change or improve something I made (${names(own(s).map((d) => d.name))}): {name, change${working(s).length ? ', project' : ''}}`, when: (s, n) => own(s).length > 0 && can(s, 'change_thing', n), score: (s) => 0.5 + working(s).length * 0.5 },
  { name: 'extend_thing', maker: true, line: (s) => `add more parts to something I made (${names(own(s).map((d) => d.name))}): {name, add}`, when: (s, n) => own(s).length > 0 && can(s, 'extend_thing', n), score: () => 0.4 },
  // --- music ---
  { name: 'revise_song', maker: true, line: (s) => `rewrite one section of a song I made (${names((s.studio?.songs ?? []).filter((x) => x.pattern).slice(-3).map((x) => x.name))}): {name, section, why}`, when: (s, n) => (s.studio?.songs ?? []).some((x) => x.pattern) && can(s, 'record_song', n) && instruments(s).length > 0, score: (s) => 0.5 + s.body.creativity / 6 },
  { name: 'play_piano', line: (s) => `${instruments(s).length === 1 ? 'hum or sing a tune' : 'make music'}: {notes like "C4 E4 G4:2 E4:4", instrument: ${instruments(s).join(' or ')}}`, when: (s) => instruments(s).length > 0, score: (s) => 0.8 + s.calm / 10 },
  // --- learning ---
  { name: 'search_web', line: () => 'look something up online: {query}', when: () => true, score: (s) => 0.8 + s.body.curiosity / 3 },
  { name: 'browse', line: (s) => `browse the web for a while: the game opens something for me (today's news, a page near what I like, or something new): {}`, when: (s, n) => canBrowse(s, n), score: (s) => 0.7 + s.body.curiosity / 3 + s.body.boredom / 6 + (interests(s).length ? 0 : 1) },
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
  // A free move in his own words. It leaves nothing behind, so it is offered, but less than the moves that really make or grow something.
  { name: 'do', line: () => 'do something small in my own words, only when no other move fits; not for planning, judging, cooking or anything that has its own move above (it does not make anything): {what}', when: () => true, score: () => 0.4 },
  // --- my things ---
  { name: 'phone', line: (s) => `use my phone: Lights (${lampsOf(s).slice(0, 3).map((e) => `"${lampName(e)}" ${lampNow(e).on ? `on ${lampNow(e).level}%` : 'off'}`).join(', ')}) or an app: {lamp, switch, level 25/50/75/100, color, name, timer: {at, do}} or {app}`, when: (s) => Boolean(s.phone) && (lampsOf(s).length > 0 || (s.apps ?? []).length > 0), score: (s, n) => 0.5 + (darkLampOff(s, n) ? 2.5 : 0) },
  { name: 'use', line: (s) => `use one of my things (${usable(s).slice(0, 3).map((d) => `"${d.name}": ${(d.uses ?? []).map((u) => u.label).slice(0, 2).join(' / ')}`).join('; ')}): {name, label}`, when: (s) => usable(s).length > 0, score: () => 0.8 },
  { name: 'take_photo', line: () => 'take a photo of something that matters to me: {target: window, room, myself or one of my things, why, camera: close, wide, low or high, caption}', when: (s, n) => left(s, 'take_photo', n) > 0, score: () => 0.5 },
  { name: 'place_picture', line: (s) => `hang a picture I was given (${names(unplacedGifts(s).map((p) => p.id))}): {id, wall}`, when: (s) => unplacedGifts(s).length > 0, score: () => 1.5 },
  { name: 'move_thing', line: (s) => { const t = tidyUp(s); const p = allMisplaced(s)[0]; return `move something in my room (${names(own(s).map((d) => d.name))})${t ? (t.why ? ` (my ${t.thing} ${t.why}: I can put it on my ${t.to})` : ` (my ${t.full} is too full: I can put ${t.thing} on my ${t.to})`) : p ? ` (my ${p.e.name} would be better ${p.m.better})` : ''}: {name, next_to / on / wall / where: "ceiling" or "outside by the pond"}`; }, when: (s, n) => own(s).length > 0 && left(s, 'move_thing', n) > 0, score: (s) => 0.3 + (s.tasks ?? []).filter((t) => t.status === 'accepted').length + (tidyUp(s) ? 2.5 : allMisplaced(s).length ? 1.5 : 0) },
  { name: 'remove_decoration', line: (s) => `put something away in my chest (${names(own(s).map((d) => d.name))}): {name}`, when: (s) => own(s).length > 0, score: (s) => (10 - s.body.tidiness) / 3 },
  { name: 'take_out', line: (s) => `take something out of my chest (${names((s.stored ?? []).map((d) => d.name))}): {name}`, when: (s) => (s.stored ?? []).length > 0, score: () => 0.3 },
  { name: 'take_tool', line: () => 'pick up a tool or instrument so I can use it: {name}', when: (s) => /take_tool|inventory/.test(lastFail(s)?.why ?? ''), score: () => 3 },
  { name: 'wear', line: (s) => `wear something (${names((s.wardrobe ?? []).filter((c) => !c.worn).map((c) => c.name))}): {name}`, when: (s) => (s.wardrobe ?? []).some((c) => !c.worn), score: () => 0.3 },
  // --- writing and people ---
  { name: 'write_diary', line: () => 'write in my diary: {text}', when: () => true, score: (s, n) => 0.3 + (new Date(n).getHours() >= 20 ? 1 : 0) },
  { name: 'tell', line: () => 'write a message to Bas: {text}', when: (s, n) => s.plan?.unread > 0 || (s.body.loneliness >= 7 && daysSince(s.outbox?.filter((m) => m.kind === 'tell').at(-1)?.at, n) >= 1), score: (s) => (s.plan?.unread ? 5 : 1) },
  { name: 'answer_visitor', line: (s) => `answer a visitor's or a neighbour's note (${names((s.visitors ?? []).filter((v) => !v.answer).slice(-2).map((v) => v.id))}): {id, text}`, when: (s) => (s.visitors ?? []).some((v) => !v.answer), score: () => 2 },
  { name: 'buy', line: (s) => `buy something at the corner shop with my coins (I have ${s.coins ?? 0}): ${shopLine(s)}: {item}`, when: (s, n) => (s.coins ?? 0) >= 1 && shopOpen(n), score: (s) => 0.4 + (wantsToBuy(s) ? 1.2 : 0) + ((s.fullness ?? 10) <= 4 && !(s.pantry ?? []).some((p) => p.qty > 0) ? 3 : 0) },
  { name: 'check_board', line: (s, n) => `walk to the notice board in my street and read what people ask for${boardNotes(s, n).some((w) => !w.seen) ? ' (there is something new on it)' : ''}: I earn coins by making it: {}`, when: (s, n) => !process.env.PIP_NO_OUT && Boolean(canGo(s, 'board', n).ok) && boardCalls(s, n), score: (s, n) => (boardNotes(s, n).some((w) => !w.seen) ? 1.6 : 0.7) },
  { name: 'paint_wall', line: () => 'paint something big on a wall outside in my world, for everyone to see (no paper or supplies needed): {what, why, wall: "any wall", or one I pick like "the wall by the corner shop" or "the back wall of the bakery"}', when: (s, n) => !process.env.PIP_NO_OUT && left(s, 'draw', n) > 0 && Boolean(canGo(s, 'walls', n).ok), score: (s) => 0.9 + s.body.creativity / 4 },
  { name: 'print_thing', line: () => 'design a small 3D model and print it at the print workshop (it stays there on my shelf of prints): {what, why}', when: (s, n) => !process.env.PIP_NO_OUT && Boolean(canGo(s, 'workshop', n).ok) && (s.prints ?? []).filter((x) => n - Date.parse(x.at) < 86_400_000).length < 3, score: (s) => 0.7 + s.body.creativity / 4 },
  { name: 'go_out', line: (s, n) => `go outside for a while (I come home by myself): ${goLine(s, n)}: {place, what}`, when: (s, n) => goOptions(s, n).length > 0, score: (s, n) => wantsOut(s, n) },
  { name: 'ask_for', line: (s, n) => `ask Bas for something (because ${askReason(s, n)}): {item, why}`, when: (s, n) => Boolean(askReason(s, n)), score: () => 2 },
  // --- projects ---
  { name: 'dream', line: () => 'tell Bas about a big dream, something far too big to make myself (he might build it): {what, why}', when: (s, n) => daysSince(s.bigDreamAt, n) >= 3 && s.body.creativity >= 6, score: () => 0.8 },
  { name: 'work_on_project', line: (s) => `work on my project: the game does its next step the right way (${workable(s).slice(0, 2).map((p) => `"${p.title.slice(0, 40)}", next: ${p.steps.find((x) => !x.done).text.slice(0, workable(s).length > 1 ? 26 : 40)}`).join('; ')}): {title}`, when: (s) => workable(s).length > 0, score: () => 2.2 },
  { name: 'plan_project', line: (s) => `plan my project ${names(unplanned(s).map((p) => p.title))} in 3 to 5 small steps I can really do with my moves: {title, steps: [3 to 5 short steps]}`, when: (s) => unplanned(s).length > 0, score: () => 4 },
  { name: 'judge_project', line: (s) => `look at my project (${names(working(s).filter((p) => (p.versions ?? []).length).slice(0, 2).map((p) => (p.title.length > 34 ? `${p.title.slice(0, 32)}…` : p.title)))}) and say if I am proud of it. Good enough is fine: a first version that works is done: {title, proud: "yes" or "no", why}`, when: (s) => working(s).some((p) => (p.versions ?? []).length && (p.steps ?? []).filter((x) => !x.done).length <= (p.steps ?? []).length / 2), score: (s) => Math.min(5, 0.6 + Math.max(0, ...working(s).map((p) => (p.versions ?? []).length)) * 0.9 + (working(s).some((p) => (p.steps ?? []).length && p.steps.every((x) => x.done)) ? 3 : 0)) },
  { name: 'start_project', line: () => 'start a project to make or learn over days: {title, why, steps: [3 to 6 short steps], needs: [tools]} (a program or game: small tickets, a tiny working version first, then one feature each)', when: (s) => working(s).length < 2, score: (s) => 0.5 + s.body.creativity / 5 + (working(s).length ? 0 : 1) + (interests(s).some((i) => i.score >= HOBBY_AT) ? 2 : 0) }, // a hobby calling makes starting one inviting
];
export const MOVE_NAMES = MOVES.map((m) => m.name);
export const MAKER_MOVES = MOVES.filter((m) => m.maker).map((m) => m.name);
export const byName = (name) => MOVES.find((m) => m.name === name) ?? null;

// The moves that make sense now: 6 to 10, best first, each with one line.
// Repetition lowers a move: each time in his last 15 moves halves it, and 4 or more times today cuts it hard.
export function availableMoves(s, { now = Date.now(), random = Math.random } = {}) {
  const tired = tiredOf(s, now); // after hours of one kind of thing, that kind rests for an hour (loops.js)
  const recent = (s.recent?.moves ?? []).map((m) => m.move);
  const recentKinds = (s.recent?.moves ?? []).slice(-5).map((m) => m.kind);
  const scored = [];
  for (const m of MOVES) {
    let ok = false;
    try { ok = Boolean(m.when(s, now)) && m.name !== restingMove(s, now) && !(tired && kindOf(m.name) === tired && !['do', 'tell', 'ask_for'].includes(m.name)); } catch { ok = false; } // a move he looped on rests for a while (loops.js)
    if (!ok) continue;
    let score = m.score(s, now);
    if (process.env.PIP_FAKE_MOVE === m.name) score = 99; // tests: the move a test wants is always among the offered ones
    score *= 0.5 ** recent.filter((x) => x === m.name).length;
    if ((s.today?.done?.[m.name] ?? 0) >= 4 && !['eat', 'rest', 'water', 'harvest'].includes(m.name)) score *= 0.2;
    score *= 0.8 ** recentKinds.filter((k) => k === kindOf(m.name)).length;
    score *= noveltyBoost(s, m.name); // something he has never (or hardly) done is more inviting
    if (['decorate', 'draw', 'place_picture', 'move_thing'].includes(m.name)) score += Math.max(0, 5 - (s.body?.coziness ?? 5)) * 0.15; // a bare room: a small push to make it his
    scored.push({ m, score: score * (0.75 + random() * 0.5) });
  }
  scored.sort((a, b) => b.score - a.score);
  const pick = scored.slice(0, MAX_MOVES);
  const MUST = ['do', 'tell', 'ask_for']; // always a free move; and when someone wrote or something is missing, a way to say so
  for (const must of MUST) {
    const hit = scored.find((x) => x.m.name === must);
    if (!hit || pick.includes(hit)) continue;
    const out = pick.findLastIndex((x) => !MUST.includes(x.m.name)); // one must-have never pushes out another
    if (out >= 0) pick[out] = hit;
    else pick.push(hit);
  }
  while (pick.length < MIN_MOVES && scored.length > pick.length) pick.push(scored[pick.length]);
  return pick.map(({ m }) => ({ name: m.name, line: m.line(s, now), maker: Boolean(m.maker) }));
}
