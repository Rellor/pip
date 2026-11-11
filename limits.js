// Can a planned step work? Checked BEFORE the plan is used, so a step that would fail (a daily limit is used up, the thing it names
// is not in his room) is not wasted: he gets one chance to plan something else instead. Same numbers as the places that do the work.
import { MAX_COOKS_PER_DAY } from './food.js';
import { MAX_ART_PER_DAY } from './art.js';
import { MAX_APPS_PER_DAY } from './apps.js';
import { MAX_CLOTHES_PER_DAY } from './clothes.js';
import { MAX_MOVES_PER_DAY as MAX_NEW_MOVES_PER_DAY } from './moves.js';
import { MAX_PER_DAY, MAX_UPDATES_PER_DAY, MAX_MOVES_PER_DAY, capOf } from './decor.js';
import { furnitureKey } from './decor.js';

export const MAX_PHOTOS = 4;
export const MAX_FOUND = 6;
export const MAX_APP_UPDATES_PER_DAY = 4;
export const MAX_PRINTS_PER_DAY = 6;
const DAY = 86_400_000;
const within = (iso, now) => now - Date.parse(iso) < DAY && Date.parse(iso) <= now + 3600_000;

// action -> { max, used, what } for everything that has a daily limit.
export function dayLimits(s, now = Date.now()) {
  const logN = (act) => s.log.filter((e) => e.action === act && !e.failed && now - Date.parse(e.at) < DAY).length;
  const moved = s.decor.filter((x) => x.movedAt && within(x.movedAt, now)).length + (s.chest?.moves ?? []).filter((m) => within(m, now)).length + (s.furniture?.moves ?? []).filter((m) => within(m, now)).length;
  const updates = s.decor.filter((x) => x.updatedAt && within(x.updatedAt, now)).length;
  return {
    cook: { max: MAX_COOKS_PER_DAY, used: (s.cookedAt ?? []).filter((t) => within(t, now)).length, what: 'cook' },
    take_photo: { max: MAX_PHOTOS, used: s.pictures.filter((p) => p.by === 'pip' && within(p.at, now)).length, what: 'take photos' },
    find_picture: { max: MAX_FOUND, used: s.found.filter((f) => within(f.at, now)).length, what: 'find pictures' },
    draw: { max: MAX_ART_PER_DAY, used: s.art.filter((a) => within(a.createdAt, now)).length, what: 'draw' },
    make_app: { max: MAX_APPS_PER_DAY, used: s.apps.filter((a) => within(a.createdAt, now)).length, what: 'write apps' },
    update_app: { max: MAX_APP_UPDATES_PER_DAY, used: s.apps.filter((a) => a.updatedAt && within(a.updatedAt, now)).length, what: 'change apps' },
    decorate: { max: MAX_PER_DAY, used: s.decor.filter((x) => !x.image && within(x.createdAt, now)).length, what: 'make things for my room' },
    make_clothes: { max: MAX_CLOTHES_PER_DAY, used: s.wardrobe.filter((x) => within(x.madeAt || x.createdAt, now)).length, what: 'make clothes' },
    make_move: { max: MAX_NEW_MOVES_PER_DAY, used: s.moves.filter((m) => within(m.createdAt, now)).length, what: 'design new moves' },
    change_thing: { max: MAX_UPDATES_PER_DAY, used: updates, what: 'change things' },
    extend_thing: { max: MAX_UPDATES_PER_DAY, used: updates, what: 'extend things' },
    move_thing: { max: MAX_MOVES_PER_DAY, used: moved, what: 'move things' },
    print_photo: { max: MAX_PRINTS_PER_DAY, used: logN('print_photo'), what: 'print photos' },
  };
}

// Actions that share one daily count, and actions that may only happen once in one plan.
const SHARED = { extend_thing: 'change_thing' };
const ONCE_PER_PLAN = ['decorate', 'draw', 'make_app', 'update_app'];
const NEEDS_NAME = ['use', 'add_use', 'compose', 'change_thing', 'extend_thing', 'remove_decoration', 'move_thing'];

// What in the plan cannot work, with the reason. Steps are checked in order, and what an earlier step makes counts for later ones.
export function preflight(s, steps, now = Date.now()) {
  const lim = dayLimits(s, now);
  const used = {};
  const once = new Set();
  const made = [];
  const bad = [];
  for (const st of steps) {
    const a = st.action;
    const key = SHARED[a] ?? a;
    let why = null;
    const L = lim[a];
    if (L) {
      const u = lim[key].used + (used[key] ?? 0);
      if (u >= L.max) why = `I already used up my ${L.max} a day: I cannot ${L.what} again today`;
    }
    if (!why && ONCE_PER_PLAN.includes(a) && once.has(a)) why = 'I only do one of these per wake-up';
    if (!why && a === 'decorate' && s.decor.length + made.length >= capOf(s.decor)) why = 'my room is full (chest, or storage, makes room)';
    const name = String(st.details?.name ?? '').trim().toLowerCase();
    if (!why && NEEDS_NAME.includes(a) && name) {
      const here = [...s.decor.filter((d) => !d.image && !d.art).map((d) => d.name.toLowerCase()), ...made, ...(a === 'move_thing' ? ['chest'] : [])];
      const ok = here.some((n) => n === name || n.includes(name) || name.includes(n)) || (a === 'move_thing' && (furnitureKey(name) || s.decor.some((d) => d.image && d.name.toLowerCase().includes(name))));
      if (!ok) why = `there is nothing called "${st.details.name}" in my room (yet)`;
    }
    if (why) {
      bad.push({ st, why });
      continue;
    }
    if (L) used[key] = (used[key] ?? 0) + 1;
    if (ONCE_PER_PLAN.includes(a)) once.add(a);
    if (a === 'decorate' && name) made.push(name);
  }
  return bad;
}

// For his prompt: what is used up today or nearly.
export function limitsText(s, now = Date.now()) {
  const rows = Object.entries(dayLimits(s, now)).filter(([k]) => k !== 'extend_thing');
  const gone = rows.filter(([, l]) => l.used >= l.max).map(([, l]) => l.what);
  const last = rows.filter(([, l]) => l.max - l.used === 1).map(([, l]) => l.what);
  if (!gone.length && !last.length) return '';
  return `WHAT I CAN STILL DO TODAY\n${gone.length ? `Used up for today (a step with these would fail, so I plan something else): ${gone.join(', ')}.\n` : ''}${last.length ? `One left today: ${last.join(', ')}.\n` : ''}\n`;
}
