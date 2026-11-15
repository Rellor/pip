// Pip's body: needs and feelings that change every tick, with no model call.
// The five bars (fullness, energy, wonder, joy, calm) live in feelings.js. This adds the drives that push him to do things:
//   creativity  the itch to make something. Grows with time, drops when he makes.
//   curiosity   the itch to find out. Grows with time, drops when he looks something up.
//   boredom     grows when he does the same kind of thing again and again. New kinds of things lower it.
//   loneliness  grows slowly, drops when someone writes or he writes to them.
//   tidiness    how tidy his room feels (10 is tidy). Falls when the room fills up, rises when he puts things away.
//   coziness    how much his room feels like his home (0 to 10), from what is in it (coziness() below). Never a must:
//               a bare room gives a small push to make things for it, a cozy one a little calm.
// It also remembers his last 15 moves and last 5 moods, and counts what he did today.
import { passTime } from './feelings.js';
import { isLamp } from './web/lighting.js';

const clamp = (n) => Math.round(Math.max(0, Math.min(10, Number.isFinite(n) ? n : 5)) * 100) / 100;
export const DRIVES = ['creativity', 'curiosity', 'boredom', 'loneliness', 'tidiness'];
export const RECENT_MOVES = 15;
export const RECENT_MOODS = 5;

// What kind of thing each move is. Doing the same kind again and again is what makes him bored.
export const KIND = {
  decorate: 'make', change_thing: 'make', extend_thing: 'make', draw: 'make', make_app: 'make', update_app: 'make', make_clothes: 'make', add_use: 'make', blueprint: 'make', make_move: 'make',
  play_piano: 'music', compose: 'music', record_song: 'music',
  search_web: 'learn', read_book: 'learn', find_picture: 'learn', measure: 'learn', check_light: 'learn',
  plant: 'garden', water: 'garden', harvest: 'garden',
  eat: 'food', cook: 'food',
  rest: 'rest',
  write_diary: 'write', tell: 'people', ask_for: 'people', plan_project: 'make', judge_project: 'make', start_project: 'make',
  take_photo: 'look', print_photo: 'look', place_picture: 'room', take_down_picture: 'room', take_down_print: 'room',
  move_thing: 'room', remove_decoration: 'room', take_out: 'room', place_tool: 'room', take_tool: 'room', lamp_auto: 'room',
  use: 'play', do: 'play', wear: 'clothes', take_off: 'clothes', walk_to: 'walk',
};
export const kindOf = (move) => KIND[move] ?? 'play';

// The day in his own time zone, like 2026-11-15.
export const dayOf = (now = Date.now(), tz = process.env.PIP_TZ || 'Europe/Amsterdam') => new Date(now).toLocaleDateString('en-CA', { timeZone: tz });

export function ensureBody(s, now = Date.now()) {
  s.body ??= {};
  s.body.creativity = clamp(s.body.creativity ?? 5);
  s.body.curiosity = clamp(s.body.curiosity ?? 5);
  s.body.boredom = clamp(s.body.boredom ?? s.boredom ?? 3);
  s.body.loneliness = clamp(s.body.loneliness ?? s.loneliness ?? 2);
  s.body.tidiness = clamp(s.body.tidiness ?? 7);
  s.body.at ??= new Date(now).toISOString();
  s.recent ??= {};
  s.recent.moves = Array.isArray(s.recent.moves) ? s.recent.moves.slice(-RECENT_MOVES) : [];
  s.recent.moods = Array.isArray(s.recent.moods) ? s.recent.moods.slice(-RECENT_MOODS) : [];
  const today = dayOf(now);
  if (s.today?.day !== today) s.today = { day: today, done: {}, tried: {}, kinds: {}, moods: {}, lift: {} };
}

// How full the room feels: things on the floor and on the walls, beyond what feels cosy.
export function clutter(s) {
  const own = (s.decor ?? []).filter((d) => !d.image).length;
  const pics = (s.decor ?? []).filter((d) => d.image).length;
  return Math.max(0, own - 6) * 0.6 + Math.max(0, pics - 4) * 0.4;
}

// How much the room feels like home, 0 to 10, from what is really in it. More is not always better: after about 6 things
// it stops rising, and clutter (too many things, see clutter) brings it down again.
//   things he made or hung up (up to 6)     0.6 each
//   variety: something on the floor, on a wall, on a surface, a light, a plant   0.8 each
//   a lamp of his that is on when it is dark   0.6
export function coziness(s, dark = false) {
  const items = (s.decor ?? []).filter((d) => d.pos);
  const own = items.filter((d) => !d.image);
  const kinds = [
    items.some((d) => !d.image && /floor/.test(d.zone ?? d.kind ?? '')),
    items.some((d) => d.image || d.kind === 'wall' || /^wall/.test(d.zone ?? '')),
    items.some((d) => !d.image && (d.kind === 'surface' || /^on_/.test(d.zone ?? ''))),
    own.some((d) => isLamp(d) || (d.parts ?? []).some((p) => p.glow)),
    own.some((d) => /plant|flower|greenhouse|herb|tree|fern|cactus|moss/i.test(d.name)) || (s.garden?.plots ?? []).length > 0,
  ].filter(Boolean).length;
  const lit = dark && own.some((d) => isLamp(d) && d.lit !== false) ? 0.6 : 0;
  const v = 1 + Math.min(items.length, 6) * 0.6 + kinds * 0.8 + lit - clutter(s) * 0.5;
  return clamp(v);
}

// Once per tick: the bars from feelings.js, then the drives.
export function tickBody(s, now = Date.now()) {
  ensureBody(s, now);
  passTime(s, now);
  const hours = Math.min(3, Math.max(0, (now - Date.parse(s.body.at)) / 3_600_000));
  const b = s.body;
  b.creativity = clamp(b.creativity + hours * 0.6);
  b.curiosity = clamp(b.curiosity + hours * 0.5);
  b.loneliness = clamp(b.loneliness + hours * 0.25);
  b.boredom = clamp(b.boredom + (sameKindRun(s) >= 3 ? hours * 0.8 : -hours * 0.3));
  b.tidiness = clamp(10 - clutter(s));
  const h = Number(new Date(now).toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: process.env.PIP_TZ || 'Europe/Amsterdam' }));
  b.coziness = coziness(s, h >= 18 || h < 8);
  if (b.coziness >= 7) s.calm = clamp((s.calm ?? 5) + hours * 0.2); // a cozy room settles him a little
  b.at = new Date(now).toISOString();
  s.boredom = b.boredom; // older fields the site and feelings.js still read
  s.loneliness = b.loneliness;
}

// How many of his last moves in a row were the same kind (walks do not count).
export function sameKindRun(s) {
  const list = (s.recent?.moves ?? []).filter((m) => m.kind !== 'walk' && m.kind !== 'rest');
  if (!list.length) return 0;
  const last = list[list.length - 1].kind;
  let n = 0;
  for (let i = list.length - 1; i >= 0 && list[i].kind === last; i--) n++;
  return n;
}

// After each move: remember it, count it, and let it change the drives.
export function noteMove(s, move, { failed = false, mood = null, now = Date.now() } = {}) {
  ensureBody(s, now);
  const kind = kindOf(move);
  s.today.tried[move] = (s.today.tried[move] ?? 0) + 1;
  if (!failed) {
    s.today.done[move] = (s.today.done[move] ?? 0) + 1;
    s.today.kinds[kind] = (s.today.kinds[kind] ?? 0) + 1;
  }
  s.recent.moves = [...s.recent.moves, { move, kind, at: new Date(now).toISOString(), ...(failed ? { failed: true } : {}) }].slice(-RECENT_MOVES);
  if (mood) s.recent.moods = [...s.recent.moods, mood].slice(-RECENT_MOODS);
  if (failed) return;
  const b = s.body;
  const fresh = !s.recent.moves.slice(0, -1).some((m) => m.kind === kind);
  if (kind === 'make') b.creativity = clamp(b.creativity - 4);
  if (kind === 'music') b.creativity = clamp(b.creativity - 2);
  if (kind === 'learn') b.curiosity = clamp(b.curiosity - 3);
  if (kind === 'people') b.loneliness = clamp(b.loneliness - 3);
  if (move === 'remove_decoration' || move === 'take_down_picture') b.tidiness = clamp(b.tidiness + 1);
  b.boredom = clamp(b.boredom + (fresh ? -2 : sameKindRun(s) >= 3 ? 1 : 0));
  if (sameKindRun(s) >= 4) s.joy = clamp((s.joy ?? 5) - 0.3); // the same thing again and again feels flat
  if (fresh) s.wonder = clamp((s.wonder ?? 5) + 0.5);
}

// His mood after a tick: the last 5 are kept, so code can see when he is stuck in one mood.
export function noteMood(s, mood, now = Date.now()) {
  ensureBody(s, now);
  if (!mood) return;
  s.recent.moods = [...s.recent.moods, String(mood)].slice(-RECENT_MOODS);
  s.today.moods ??= {};
  s.today.moods[mood] = (s.today.moods[mood] ?? 0) + 1;
}

// Someone wrote to him.
export function heardFrom(s) {
  ensureBody(s);
  s.body.loneliness = clamp(s.body.loneliness - 4);
}

const level = (v, low, high) => (v >= 7 ? high : v <= 3 ? low : null);
// Short lines for the brain: only what stands out, plus what he keeps repeating.
export function bodyText(s) {
  const b = s.body;
  const lines = [
    level(s.energy, 'I am tired', 'I am full of energy'),
    s.fullness <= 2 ? 'I am very hungry, and food does not appear by itself: I grow it, cook it, or ask for it' : level(s.fullness, 'I am hungry', null),
    level(b.creativity, null, 'my hands itch to make something'),
    level(b.curiosity, null, 'I want to find something out'),
    level(b.boredom, null, 'I am bored of doing the same things'),
    level(b.loneliness, null, 'I feel a bit lonely'),
    b.tidiness <= 4 ? 'my room feels too full' : null,
    (b.coziness ?? 5) <= 3 ? 'my room feels bare, not quite mine yet' : (b.coziness ?? 5) >= 7 ? 'my room feels cozy, like home' : null,
    level(s.wonder, 'nothing feels new', 'everything feels full of wonder'),
    level(s.joy, 'I feel low', 'I feel happy'),
  ].filter(Boolean);
  const often = Object.entries(s.today?.done ?? {}).filter(([m, n]) => n >= 4 && !['walk_to', 'rest', 'eat'].includes(m)).map(([m, n]) => `I did ${m.replace(/_/g, ' ')} ${n} times today`);
  const moods = s.recent?.moods ?? [];
  const sameMood = moods.length >= 4 && moods.every((m) => m === moods[0]) ? `I have felt ${moods[0]} ${moods.length} times in a row` : null;
  return [...lines, ...often, sameMood].filter(Boolean);
}
