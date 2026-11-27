// The live feed: small timed moments between his steps. Pip wakes up once every few minutes, but a step is not one
// instant: he sets off, arrives, starts, thinks something, notices a thing or two, and finishes. At every wake-up the
// game writes those moments down with the time each one happens in the minutes ahead. The page shows each when its time
// has come, so his day moves by the half minute instead of once per wake-up. Plain code: no model is asked.
//
// A moment: { at (ISO), kind: 'beat' | 'think' | 'notice', icon, text }. The text is about him ("Sets off for the pond").
import { placeOf, isWet, isFrozen } from './web/world.js';
import { hourNL } from './web/street.js';

export const MOMENTS_KEPT = 90; // the newest moments stay in his state
const MIN = 60_000;
const clip = (t, n) => { const x = String(t ?? '').replace(/\s+/g, ' ').trim(); return x.length <= n ? x : `${x.slice(0, n).replace(/\s+\S*$/, '')}…`; };
const cap = (t) => String(t ?? '').replace(/^./, (c) => c.toUpperCase());
const his = (name) => String(name ?? '').replace(/^my /, 'his ');
// A number from 0 to 1 that is always the same for the same words (so a test, and a second run, give the same moments).
const dice = (seed) => { let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };

// Where he does a step when it is not in his room (the page walks him there, main.js STEP_PLACE): [the place in words, its notices].
const STEP_AT = {
  search_web: ['the internet café', 'cafe'], browse: ['the internet café', 'cafe'], make_site: ['the internet café', 'cafe'], update_site: ['the internet café', 'cafe'],
  read_book: ['the library', 'library'], draw: ['the art workshop', 'studio'], write_diary: ['the pond', 'pond'],
  decorate: ['the build workshop', 'build'], extend_thing: ['the build workshop', 'build'], make_clothes: ['the build workshop', 'build'], blueprint: ['the build workshop', 'build'],
};
// What he is seen doing in a step: [how it starts, what he is doing halfway (or null), how it ends when it worked (or null)].
function stepWords(e) {
  const name = e.name ? `“${clip(e.name, 40)}”` : 'something';
  switch (e.action) {
    case 'eat': return [`Eats ${clip(e.food ?? 'a snack', 30)}`, null, null];
    case 'cook': return [`Starts cooking ${clip(e.dish ?? e.name ?? 'something', 30)}`, 'Stirs, tastes, frowns, stirs again', 'The food is ready'];
    case 'harvest': return [`Picks ${clip(e.name ?? 'what is ripe', 30)} in his garden`, null, null];
    case 'water': return ['Waters his plants', null, null];
    case 'plant': return [`Plants ${clip(e.seed ?? e.name ?? 'seeds', 30)}`, 'Presses the earth down with one finger', null];
    case 'decorate': return [e.as === 'build_outside' ? `Starts building ${name} outside` : e.as === 'print_thing' ? `Designs ${name} for the printer` : `Starts building ${name}`, 'Fits the parts together', `${cap(name)} is done`];
    case 'change_thing': case 'extend_thing': return [`Works on ${name}`, 'Steps back to look at it', `${cap(name)} is better now`];
    case 'draw': return [e.as === 'paint_wall' ? `Sketches ${name} for a wall` : `Starts drawing ${name}`, 'Rubs out a line and draws it again', 'Puts his pencil down'];
    case 'make_app': case 'update_app': return ['Starts typing code', 'Runs it to see if it works', `${cap(name)} runs`];
    case 'make_site': case 'update_site': return ['Writes on his website', 'Reads his own sentence back, and changes it', 'Saves the page'];
    case 'make_clothes': return [`Starts sewing ${name}`, 'Threads the needle again', `${cap(name)} is done`];
    case 'play_piano': return [String(e.instrument ?? '').toLowerCase() === 'voice' ? 'Starts to sing' : `Picks up his ${clip(e.instrument ?? 'piano', 20)}`, e.style ? `Plays something ${clip(e.style, 20)}` : 'Plays', 'The last note fades'];
    case 'record_song': return [`Sets up to record ${name}`, 'Plays it through once more', 'Stops the recording'];
    case 'compose': return [`Hums a tune for ${name}`, 'Tries the same bar three ways', null];
    case 'search_web': return [`Types: “${clip(e.query ?? '', 50)}”`, 'Reads what he found', null];
    case 'browse': return ['Clicks from page to page', e.opened?.title ? `Stops at a page about ${clip(e.opened.title, 40)}` : 'Reads a page he did not look for', null];
    case 'read_book': return [`Opens a book about ${clip(e.opened?.title ?? e.topic ?? 'something', 40)}`, 'Turns a page', 'Closes the book'];
    case 'write_diary': return ['Opens his diary', 'Writes, stops, writes on', 'Closes his diary'];
    case 'rest': return ['Lies down for a bit', null, null];
    case 'move_thing': return [`Moves ${name}`, null, null];
    case 'remove_decoration': return [`Puts ${name} in his chest`, null, null];
    case 'take_out': return [`Takes ${name} out of his chest`, null, null];
    case 'use': return [`Uses ${name}`, null, null];
    case 'ask_for': return [`Writes ${clip(e.item ?? 'something', 40)} on his wants list`, null, null];
    case 'take_photo': return ['Looks for the right angle', null, 'Click'];
    case 'walk_to': return [`Walks to the ${clip(e.object ?? 'other side of his room', 30)}`, null, null];
    case 'buy': return [`Counts his coins for ${clip(e.item ?? 'something', 30)}`, null, null];
    case 'happened': return [clip(e.what, 140), null, null];
    case 'do': return [e.as === 'start_hobby' ? `Decides to try ${clip(String(e.what ?? '').replace(/^decide to try /, '').replace(/ as a hobby$/, ''), 40)} as a hobby` : cap(clip(String(e.what ?? 'Does something small').replace(/_/g, ' '), 90)), null, null];
    default: return [cap(String(e.action ?? 'does something').replace(/_/g, ' ')), null, null];
  }
}

// Small things he notices: by where he is, and by the weather and the hour. Each is one short sentence.
const NOTICES = {
  room: ['The floor creaks where it always creaks', 'Dust turns in the light from the window', 'Something small falls over on a shelf', 'The lamp hums, very quietly', 'A fly walks across the desk as if it owns it', 'The clock in his head says it is later than he thought', 'His chair is not where he left it. It is exactly where he left it', 'The basil smells stronger than it should', 'A draught moves the corner of a drawing on the wall', 'He straightens a thing that was already straight'],
  cafe: ['The screen flickers once and thinks about it', 'Someone left a tab open about trains', 'The keyboard has one key that sticks', 'A cable hangs where a cable should not hang', 'The café smells of dust and warm plastic', 'The chair turns on its own when he gets off it'],
  library: ['Somewhere a book falls flat on its side', 'It is so quiet he can hear a page turn two rows away', 'A book on the wrong shelf. He leaves it there', 'The big table has a new scratch', 'The light through the tall window lands on one book only'],
  studio: ['His hands are grey from the pencil', 'A drawing from last week looks worse than he remembered', 'The paper curls at one corner', 'He tilts his head. It does not help'],
  build: ['Sawdust everywhere, also where he did not saw', 'A screw rolls off the bench and is never seen again', 'The glue is not dry. He checks again. Still not dry', 'One part is left over. That is never a good sign'],
  pond: ['A duck lands with far too much noise', 'The willow touches the water and lets go again', 'Rings on the water from something he did not see', 'Two ducks disagree about a piece of nothing', 'The bench is cold through and through'],
  doorstep: ['A sparrow hops along the edge of the square', 'Someone crosses the square and does not look up', 'The notice board has a note that hangs crooked', 'His own doorstep has a chip in it he never saw'],
  field: ['The grass is higher than last time', 'A beetle crosses his field without asking', 'From the middle of his field the village looks small', 'The wind lays the grass flat in one line and lifts it again'],
  stone: ['The green stone is warmer than a stone should be', 'From here his house is the size of his thumb', 'Something hums. The stone, or his ear', 'Moss on the north side only'],
  board: ['A new note on the board, in handwriting he does not know', 'One note is pinned over another. Rude', 'The board smells of rain and old paper'],
  shop: ['The grocery store has moved the seeds again', 'The awning flaps once', 'Apples in a row, one facing the wrong way'],
  walls: ['Paint on his fingers already', 'The wall is rougher than it looked', 'He steps back three steps to see it whole', 'A drip runs down. He lets it'],
  land: ['The spade is heavier than it looks', 'Earth under his nails', 'A worm, surprised'],
  outside: ['Wind from the west', 'A cloud the shape of nothing in particular', 'His own footsteps sound loud out here', 'Far off, a door closes'],
};
const WEATHER = {
  wet: ['Rain on the roofs, steady', 'A drop runs down the window and takes another one with it', 'The gutter sings'],
  frozen: ['His breath makes a small cloud', 'Frost on the edges of everything', 'Thin ice on every puddle'],
  dark: ['It is dark outside now. The windows are lit', 'One star, then two', 'The street lamp on the square comes on'],
  early: ['The light is thin and new', 'Dew on everything'],
};
function noticePool(s, where, now) {
  const pool = [...(NOTICES[where] ?? NOTICES.outside)];
  const hour = hourNL(now);
  if (isWet(s.weather)) pool.push(...WEATHER.wet);
  if (isFrozen(s.weather, now)) pool.push(...WEATHER.frozen);
  if (hour >= 17.5 || hour < 7) pool.push(...WEATHER.dark);
  if (hour >= 7 && hour < 9) pool.push(...WEATHER.early);
  return pool;
}
// One thing he notices there, not one he noticed a little while ago.
function notice(s, where, at, rnd, taken) {
  const pool = noticePool(s, where, at).filter((t) => !taken.has(t));
  if (!pool.length) return null;
  const text = pool[Math.floor(rnd() * pool.length) % pool.length];
  taken.add(text);
  return { at: new Date(at).toISOString(), kind: 'notice', icon: '👀', text };
}

// The moments of one wake-up. `entries` are the log entries this wake-up made (each with its own start time), `startMs`
// when it began and `intervalMs` how long until the next one. Returns the new moments, oldest first.
export function momentsFor(s, entries = [], startMs = Date.now(), intervalMs = 8 * MIN) {
  const out = [];
  const end = startMs + intervalMs;
  const rnd = dice(`${startMs}|${entries.map((e) => e.action).join(',')}`);
  const taken = new Set((s.moments ?? []).filter((m) => m.kind === 'notice').slice(-8).map((m) => m.text)); // not what he noticed a little while ago
  const put = (at, kind, icon, text) => { if (text) out.push({ at: new Date(Math.round(at)).toISOString(), kind, icon, text: clip(text, 160) }); };
  const real = entries.filter((e) => e?.at && e.action !== 'came_home' && !(e.action === 'happened')).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const e of entries.filter((x) => x?.action === 'came_home')) put(Date.parse(e.at), 'beat', '🏠', e.on ? `Goes straight on from ${his(e.placeName ?? 'there')}` : `Comes home from ${his(e.placeName ?? 'outside')}`);
  for (const e of entries.filter((x) => x?.action === 'happened')) put(Date.parse(e.at) + 20_000, 'notice', e.emoji ?? '🌤️', e.what);
  real.forEach((e, i) => {
    const t0 = Math.max(startMs, Date.parse(e.at));
    const t1 = Math.min(end, real[i + 1] ? Date.parse(real[i + 1].at) : end);
    const len = Math.max(20_000, t1 - t0);
    if (e.action === 'go_out') { // a walk: the whole of it is known the moment he leaves (world.js), so it is written down at once
      const w = s.where;
      if (e.failed || !w) { put(t0, 'beat', '🚪', 'Wants to go out, and stays in after all'); return; }
      const p = placeOf(w.place);
      const name = his(p?.name ?? 'outside');
      const [left, arrive, leave, home] = ['leftAt', 'arriveAt', 'leaveAt', 'homeAt'].map((k) => Date.parse(w[k]));
      put(left, 'beat', '🚪', `Sets off for ${name}`);
      if (arrive - left > 3 * MIN) { const n = notice(s, 'outside', left + (arrive - left) / 2, rnd, taken); if (n) out.push(n); }
      const plan = clip(String(w.words ?? '').replace(/\bmy\b/g, 'his').replace(/\bI\b/g, 'he'), 70);
      put(arrive, 'beat', p?.emoji ?? '📍', `Arrives at ${name}${plan ? `, to ${plan.replace(/^to /, '')}` : ''}`);
      for (let t = arrive + (3 + rnd() * 2) * MIN; t < leave - 2 * MIN; t += (5 + rnd() * 4) * MIN) { const n = notice(s, NOTICES[w.place] ? w.place : 'outside', t, rnd, taken); if (n) out.push(n); }
      put(leave, 'beat', '🚶', 'Starts walking home');
      if (home - leave > 3 * MIN) { const n = notice(s, 'outside', leave + (home - leave) / 2, rnd, taken); if (n) out.push(n); }
      return;
    }
    const [start, mid, done] = stepWords(e);
    const at = STEP_AT[e.action] && !e.failed && !e.planFail && len > 2 * MIN && e.as !== 'build_outside' ? STEP_AT[e.action] : null; // he walks to a place in the village for it
    const where = at ? at[1] : 'room';
    const a = at ? t0 + len * 0.16 : t0; // when the work itself starts
    const z = at ? t0 + len * 0.86 : t0 + len * 0.92; // and when it ends
    if (at) put(t0, 'beat', '🚶', `Walks to ${at[0]}`);
    put(a, 'beat', '▶️', start);
    if (e.thought && len > 90_000) put(a + (z - a) * 0.3, 'think', '💭', `“${clip(e.thought, 130)}”`);
    if (mid && !e.failed && len > 3 * MIN) put(a + (z - a) * 0.55, 'beat', '⏳', mid);
    if (len > 2.5 * MIN) { const n = notice(s, where, a + (z - a) * (0.72 + rnd() * 0.12), rnd, taken); if (n) out.push(n); }
    if (e.failed) put(z, 'beat', '✖️', 'That did not work');
    else if (done && len > 2 * MIN) put(z, 'beat', '✔️', done);
    if (at) put(t0 + len * 0.93, 'beat', '🚶', 'Walks back home');
  });
  return out.filter((m) => m.icon === '🏠' || Date.parse(m.at) >= startMs - 5_000).sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
}

// Adds the moments of this wake-up to his state, and drops what is old. Returns what was added.
// `quiet`: he read something private this time, so nothing of what he thought or did is told.
export function addMoments(s, entries, startMs, intervalMs, { quiet = false } = {}) {
  const fresh = quiet ? [{ at: new Date(startMs).toISOString(), kind: 'beat', icon: '✉️', text: 'Reads a letter that is only for him' }] : momentsFor(s, entries, startMs, intervalMs);
  // What was written ahead (a walk, a night) stays only while it is still true: he is still out, or still asleep.
  const kept = (s.moments ?? []).filter((m) => Date.parse(m.at) < startMs - 1000 || (m.far && s.where));
  const have = new Set(kept.map((m) => `${m.at}|${m.text}`));
  for (const m of fresh) if (Date.parse(m.at) > startMs + intervalMs) m.far = true; // reaches past this wake-up
  s.moments = [...kept, ...fresh.filter((m) => !have.has(`${m.at}|${m.text}`))].sort((x, y) => Date.parse(x.at) - Date.parse(y.at)).slice(-MOMENTS_KEPT);
  return fresh;
}

// The night: written once, when he falls asleep. A few slow moments until morning (they go when he wakes).
const NIGHT = ['Turns over', 'Breathes slowly', 'Dreams something, and frowns at it', 'Pulls the blanket over one ear', 'Mumbles a word nobody knows', 'Sleeps on', 'One foot sticks out of the bed', 'The house ticks as it cools', 'Rain on the roof. He does not hear it', 'Somewhere far off, a train'];
export function sleepMoments(s, now = Date.now(), hours = 9) {
  const rnd = dice(`night|${Math.floor(now / 3_600_000)}`);
  const iso = (ms) => new Date(Math.round(ms)).toISOString();
  const fresh = [{ at: iso(now), kind: 'beat', icon: '🌙', text: 'Turns off the light' }, { at: iso(now + 4 * MIN), kind: 'beat', icon: '💤', text: 'Falls asleep', far: true }];
  const pool = NIGHT.filter((t) => !/Rain/.test(t) || isWet(s.weather));
  for (let t = now + (35 + rnd() * 30) * MIN; t < now + hours * 60 * MIN; t += (40 + rnd() * 50) * MIN) fresh.push({ at: iso(t), kind: 'notice', icon: '💤', text: pool.splice(Math.floor(rnd() * pool.length) % pool.length, 1)[0] ?? 'Sleeps on', far: true });
  s.moments = [...(s.moments ?? []).filter((m) => Date.parse(m.at) < now - 1000), ...fresh].slice(-MOMENTS_KEPT);
  return fresh;
}
// When he wakes up: what was written ahead for the night goes, and the morning starts.
export function wakeMoments(s, now = Date.now()) {
  s.moments = [...(s.moments ?? []).filter((m) => Date.parse(m.at) < now), { at: new Date(now).toISOString(), kind: 'beat', icon: '🌅', text: 'Wakes up' }].slice(-MOMENTS_KEPT);
}
