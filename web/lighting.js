// How bright it is at a place in Pip's room, from the real time and weather in Purmerend plus the lamps that are on.
// The page uses it to switch lamps that are set to "dark" by themselves, and Pip's light meter (check_light) reads it.
// Numbers are 0 (pitch dark) to 1 (bright). Dark is fine: dim is cozy.
import { FURNITURE, MOVABLE, furnRects } from './furniture.js';
import { seasonInfo } from './season.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ROOM_LAMP = { x: -2, z: -1 }; // the big lamp that is always on
const LAMP_RANGE = 4;
export const DARK_BELOW = 0.3; // lamps on "dark" switch on when their place is darker than this

function amsterdamHour(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Amsterdam' }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get('hour') % 24) + get('minute') / 60;
}

export const isLamp = (d) => !d.image && (d.parts ?? []).some((p) => p.glow) && (d.uses ?? []).some((u) => u.does === 'light');
const litNow = (l, now) => (l.litAt && Date.parse(l.litAt) > now ? l.lit === false : l.lit !== false); // a switch shows its old state until it is done

// What the weather does to the daylight.
const GLOOM = { storm: 0.6, rain: 0.45, snow: 0.3, fog: 0.4 };

// The light that is there without any lamp of his: the daylight (through the window and the walls) and the big room lamp.
function base(s, x, z, ctx) {
  const wd = Math.hypot(x - 0.3, z + 5);
  const window = ctx.sky * 0.9 * Math.pow(clamp(1 - wd / 7, 0, 1), 1.3);
  const roomLamp = 0.5 * Math.pow(clamp(1 - Math.hypot(x - ROOM_LAMP.x, z - ROOM_LAMP.z) / 6, 0, 1), 1.4);
  return { window, roomLamp, ambient: ctx.sky * 0.25 + 0.04 };
}

// o: { hour, weather, lampOverride: { id, on }, skipAuto }
export function lightAt(s, x, z, now = Date.now(), o = {}) {
  const date = new Date(now);
  const h = o.hour ?? amsterdamHour(date);
  const se = seasonInfo(date);
  const day = clamp((h - (se.sunrise - 0.5)) / 1.5, 0, 1) * clamp((se.sunset + 0.5 - h) / 1.5, 0, 1);
  const w = o.weather ?? s.weather;
  const kind = w?.kind ?? 'clear';
  const gloom = GLOOM[kind] ?? (kind === 'cloudy' ? 0.12 + 0.3 * (w?.cloud ?? 0.5) : 0);
  const ctx = { sky: day * (1 - gloom * 0.6), day, kind, h };
  const b = base(s, x, z, ctx);
  let level = b.window + b.roomLamp + b.ambient;
  const helped = [];
  for (const l of s.decor ?? []) {
    if (!isLamp(l) || !l.pos) continue;
    let on;
    if (o.lampOverride?.id === l.id) on = o.lampOverride.on;
    else if (l.auto === 'dark') {
      const lb = base(s, l.pos[0], l.pos[2], ctx);
      on = !s.last?.sleeping && lb.window + lb.roomLamp + lb.ambient < DARK_BELOW;
    } else on = litNow(l, now);
    if (!on) continue;
    const add = 0.5 * Math.pow(clamp(1 - Math.hypot(x - l.pos[0], z - l.pos[2]) / LAMP_RANGE, 0, 1), 1.3);
    if (add > 0.02) { level += add; helped.push(l.name); }
  }
  return { level: clamp(level, 0, 1), window: b.window, roomLamp: b.roomLamp, lamps: helped, day, kind, hour: h };
}

// Is this lamp (set to "dark") on right now? The page asks this every few seconds.
export function autoLampOn(s, l, now = Date.now(), o = {}) {
  if (s.last?.sleeping) return false;
  const date = new Date(now);
  const h = o.hour ?? amsterdamHour(date);
  const se = seasonInfo(date);
  const day = clamp((h - (se.sunrise - 0.5)) / 1.5, 0, 1) * clamp((se.sunset + 0.5 - h) / 1.5, 0, 1);
  const w = o.weather ?? s.weather;
  const kind = w?.kind ?? 'clear';
  const gloom = GLOOM[kind] ?? (kind === 'cloudy' ? 0.12 + 0.3 * (w?.cloud ?? 0.5) : 0);
  const b = base(s, l.pos[0], l.pos[2], { sky: day * (1 - gloom * 0.6) });
  return b.window + b.roomLamp + b.ambient < DARK_BELOW;
}

// Where is "the piano", "my desk", "the window"...? Returns { name, x, z } or null.
const WORDS = { piano: /piano|keys/, bookshelf: /book|shelf|dresser|drawers/, desk: /desk|computer|laptop|screen/, bed: /\bbed\b|pillow/, plant: /plant/, rug: /\brug\b|carpet/ };
export function placeFor(s, name) {
  const n = String(name ?? '').toLowerCase().trim() || 'center';
  if (/window|sky|outside|curtain/.test(n)) return { name: 'the window', x: 0.3, z: -4.5 };
  for (const key of MOVABLE) {
    if (!WORDS[key]?.test(n) || FURNITURE[key].flat) continue;
    const rs = furnRects(s.furniture, key);
    const x = (Math.min(...rs.map((r) => r.x0)) + Math.max(...rs.map((r) => r.x1))) / 2;
    const z = (Math.min(...rs.map((r) => r.z0)) + Math.max(...rs.map((r) => r.z1))) / 2;
    return { name: `the ${key === 'bookshelf' ? 'bookshelf' : key === 'desk' ? 'desk' : key}`, x, z };
  }
  if (/chest/.test(n)) return { name: 'the chest', x: s.chest?.x ?? -4.1, z: s.chest?.z ?? 4.6 };
  const thing = (s.decor ?? []).find((d) => !d.image && d.pos && (d.name.toLowerCase() === n || d.name.toLowerCase().includes(n) || n.includes(d.name.toLowerCase())));
  if (thing) return { name: thing.name, x: thing.pos[0], z: thing.pos[2] };
  if (/center|middle|rug|room|here/.test(n)) return { name: 'the middle of the room', x: 0, z: 0.8 };
  return null;
}

export const levelWord = (v) => (v < 0.12 ? 'pitch dark' : v < 0.3 ? 'dark' : v < 0.5 ? 'dim and cozy' : v < 0.75 ? 'nicely lit' : 'bright');

const LINES = [
  ['BLOOP BLOOP! {n}%. Darker than a cat in a coal cellar.', 'Zzzt! {n}%. My eyes just filed a complaint.', '{n}%?! The Lux-O-Matic is whispering so it does not wake the dark.'],
  ['Boop. {n}%. Moody. A bit like the inside of a sock.', 'Bzzt. {n}%. Dark enough for secrets.', 'Hmmm-beep. {n}%. Even my shadow is having a nap.'],
  ['Beep! {n}%. Dim and cozy, like a hug in candlelight.', 'Boing! {n}%. Slippers-and-tea light.', 'Blip. {n}%. Very blanket-weather.'],
  ['Ding! {n}%. Nicely lit. My whiskers approve.', 'Ting-a-ling! {n}%. Good light for reading and cookies.', 'Chirp! {n}%. A comfortable glow.'],
  ['WHEEEE! {n}%. So bright my ears are squinting.', 'KA-CHING! {n}%. Sunshine soup!', 'Pip-pip-hooray! {n}%. I could read the fine print on a raisin.'],
];

// What Pip's light meter says: a silly line, the number, why, and what to do.
export function checkLight(s, where, now = Date.now(), o = {}) {
  const p = placeFor(s, where);
  if (!p) return { failed: `I do not know where "${String(where ?? '').slice(0, 40)}" is. I can check the piano, the desk, the bed, the bookshelf, the window, the plant, the middle of the room, or something I made` };
  const r = lightAt(s, p.x, p.z, now, o);
  const band = r.level < 0.12 ? 0 : r.level < 0.3 ? 1 : r.level < 0.5 ? 2 : r.level < 0.75 ? 3 : 4;
  const lines = LINES[band];
  const silly = lines[(Math.floor(now / 60_000) + p.name.length) % lines.length].replace('{n}', String(Math.round(r.level * 100)));
  const why = r.day > 0.3 ? (r.window > 0.15 ? 'daylight comes in through the window' : 'there is daylight, but it is far from the window') : 'it is night outside';
  const weather = r.kind !== 'clear' && r.day > 0.3 ? `, and ${r.kind === 'cloudy' ? 'the clouds make' : `the ${r.kind} makes`} it dimmer` : '';
  const lamps = r.lamps.length ? ` ${r.lamps.slice(0, 2).join(' and ')} ${r.lamps.length > 1 ? 'are' : 'is'} lighting it.` : '';
  const tip = r.level < 0.3 ? ' Dark can be cozy. To read or write here I want a lamp near it.' : '';
  return { ok: true, level: r.level, where: p.name, text: `At ${p.name} the Lux-O-Matic 3000 says: "${silly}" (${levelWord(r.level)}; ${why}${weather}.${lamps})${tip}` };
}

// Reading or writing where it is very dark: how much it costs him (a little calm) and what he is told.
export function darkNote(s, action, now = Date.now(), o = {}) {
  const spot = action === 'read_book' ? 'the bookshelf' : action === 'write_diary' ? 'the middle of the room' : null;
  if (!spot) return null;
  const p = placeFor(s, spot);
  const r = p ? lightAt(s, p.x, p.z, now, o) : null;
  return r && r.level < 0.15 ? { level: r.level, text: `It was too dark to ${action === 'read_book' ? 'read' : 'write'} well at ${p.name}. A lamp nearby would help.` } : null;
}
