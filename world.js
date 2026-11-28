// Pip's world outside his room: the rules. Plain code, no model.
// The brain only makes one choice, at home: "go out, to this place". Everything after that is the game's: it walks him
// there, lets a little time pass, decides what he saw and found, and brings him home again. So he always comes home:
// to sleep, to eat, when he is tired or hungry, when a storm comes, at dusk, and at the latest by half past nine.
// (Research: named places and one committed outing keep a small model on the rails; worlds where the model steered
// every step wandered into closed shops and walked in circles. Travel Frog and Finch showed how nice it is when a
// creature goes off by itself and comes back with something.)
import { PLACES, placeOf, findPlace, isGone, hoursOf, openNow, isFrozen, isWet, isStorm, FINDS } from './web/world.js';
import { hourNL, moonPhase, moonWord } from './web/street.js';
import { seasonInfo } from './web/season.js';
import { noteSpark } from './curiosity.js';
import { giveForAsk } from './gifts.js';
import { readBoard } from './board.js';
import { playDone } from './play.js';
import { landDone } from './land.js';
import { dropFound } from './strangers.js';

// He can go anywhere in his world whenever he is awake: nothing is closed, nothing is locked, and nothing is counted.
// (Bas, 2026-11-23: "He wants to do it? He can.") The only things that send him home are his own body and his bedtime.
export const MAX_OUTINGS_PER_DAY = Infinity;
export const CURFEW = 22.75; // he is home by bedtime (Dutch time)
export const MAX_AWAY_MIN = 100;
const MIN = 60_000;
const HOUR = 60 * MIN;
const clamp = (v, a = 0, b = 10) => Math.max(a, Math.min(b, v));
const dayNL = (now) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
const hm = (ms) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' });
// The same outing always turns out the same way (so a test, and a wake-up that runs twice, tell one story).
function dice(seed) {
  let a = 0;
  for (const c of String(seed)) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

// ---- What he needs for some weather and some places. He can buy it, make it, or ask for it.
export const GEAR = { umbrella: /umbrella|rain ?coat/i, warm: /scarf|coat|mittens|gloves|wool(l?y|len)? hat|jumper|sweater|shawl/i, card: /library card/i, kite: /\bkite\b/i };
export const owns = (s, re) => (s.tools ?? []).some((t) => re.test(`${t.name ?? ''} ${t.kind ?? ''}`)) || (s.wardrobe ?? []).some((c) => re.test(c.name ?? '')) || (s.decor ?? []).some((d) => !d.image && re.test(d.name ?? ''));

// ---- Which places he knows and can go to
const world = (s) => { s.world ??= {}; s.world.open ??= {}; s.world.known ??= {}; s.world.count ??= 0; return s.world; };
export const unlockedKeys = () => PLACES.map((p) => p.key); // every place is open to him
export const knownKeys = () => PLACES.map((p) => p.key);
export const checkUnlocks = () => []; // (places used to open up one by one; now they are all his from the start)

const lastReal = (s) => (s.outings ?? []).filter((o) => !o.errand && !['drops', 'board'].includes(o.place)).at(-1) ?? null; // (a quick trip for a note or to the notice board is not "having been out")
const realToday = (s, now) => (s.outings ?? []).filter((o) => !o.errand && dayNL(Date.parse(o.leftAt)) === dayNL(now)).length + (s.where && !s.where.errand ? 1 : 0);
// May he go there now? { ok: true } or { why, gear } (gear: what would make it possible).
export function canGo(s, key) {
  const p = placeOf(key);
  if (!p || p.key === 'home' || isGone(p.key)) return { why: 'that is not a place I can go to' };
  if (s.where) return { why: 'I am out already' };
  return { ok: true };
}
// What there is to do at a place right now (the things that fit the weather and what he has). What only this moment
// offers (the frozen pond) comes first.
export const thingsNow = (s, p, now = Date.now()) => [...(p.things ?? [])].sort((a, b) => Boolean(b.when) - Boolean(a.when)).filter((t) => (t.when === 'frozen' ? isFrozen(s.weather, now) : true) && (!t.needs || owns(s, GEAR[t.needs])) && !(isFrozen(s.weather, now) && p.key === 'pond' && t.key === 'find' && /snow/.test(String(s.weather?.kind ?? ''))));
// The places he can go to now, the most inviting first: [{ key, name, words }].
export function goOptions(s, now = Date.now()) {
  if (process.env.PIP_NO_OUT) return []; // tests of other things keep him in
  const done = (key) => (s.outings ?? []).filter((o) => o.place === key).length;
  return PLACES.filter((p) => p.key !== 'home' && !p.errand && !p.job && canGo(s, p.key, now).ok)
    .sort((a, b) => done(a.key) - done(b.key) || a.walk - b.walk)
    .map((p) => ({ key: p.key, name: p.name, walk: p.walk, words: thingsNow(s, p, now).slice(0, 3).map((t) => t.words) }));
}
// The words of the go_out move (short: the brain reads this every time).
export function goLine(s, now = Date.now()) {
  const say = (list) => list.map((o) => `${o.name} (${o.walk} min: ${o.words.slice(0, o.walk >= 5 ? 3 : 1).join(', ')})`).join('; ');
  const all = goOptions(s, now).slice(0, 3);
  return say(all).length <= 170 ? say(all) : say(all.slice(0, 2)).slice(0, 170);
}
// How long he has been inside: the hours since he last came home from a real outing (not an errand). Never out: two days.
export function hoursInside(s, now = Date.now()) {
  if (s.where) return 0;
  const last = lastReal(s);
  return last ? Math.max(0, (now - Date.parse(last.homeAt ?? last.leftAt)) / HOUR) : 48;
}
// How much he feels like going out (for how inviting the move is). It grows with every hour he sits inside: after a
// morning at home, going out is the most inviting thing he can do.
export function wantsOut(s, now = Date.now()) {
  if (!goOptions(s, now).length) return 0;
  const inside = hoursInside(s, now);
  const nice = !isWet(s.weather) && (s.weather?.temp ?? 10) > 3 && (s.weather?.cloud ?? 0) < 0.7;
  return 0.5 + (s.body?.boredom ?? 0) / 5 + Math.min(2.4, inside / 2.2) + (nice ? 0.5 : 0) + (lastReal(s) ? 0 : 0.8); // (it grows a little faster than it did: after three hours inside it is hard to say no)
}
// For his prompt: after a few hours inside (by day) his legs want out, and he hears what there is to do out there.
export const INSIDE_LONG_H = 3;
export function outLines(s, now = Date.now()) {
  const inside = hoursInside(s, now), hour = hourNL(now);
  if (s.where || inside < INSIDE_LONG_H || hour < 8 || hour >= CURFEW - 1.5 || !goOptions(s, now).length) return [];
  const built = (s.decor ?? []).some((d) => d.kind === 'outside');
  return [`I have been inside for ${inside >= 20 ? 'a whole day' : `${Math.round(inside)} hours`}. My legs want out and my room feels small. Out there I can go for a walk (go_out), paint a wall, shape my land${built ? ', or build more on it' : ', or build the first big thing on my field: it is still empty'}.`];
}
// When the weather or a missing thing keeps him in, and he has not been out for a while: what he could ask for.
export const gearWish = () => null; // (he used to need an umbrella, a scarf or a library card to go out: not any more)

// ---- Going out
// details: { place, what } as the brain said it (or { place: 'shop', errand: 'clay' } for a quick errand). Returns { ok, ... } or { failed }.
export function startOuting(s, details = {}, now = Date.now()) {
  if (process.env.PIP_NO_OUT) return { failed: 'I stay in today' };
  const d = details && typeof details === 'object' ? details : {};
  const options = goOptions(s, now);
  const job = d.job && typeof d.job === 'object' && placeOf(d.job.place)?.job ? d.job : null; // something he designed, to be made there: a print, a painting on a wall
  const play = !job && d.play && typeof d.play === 'object' && placeOf(d.play.place) ? d.play : null; // out with something of his: his bike, his kite (play.js)
  let p = job ? placeOf(job.place) : play ? placeOf(play.place) : d.errand ? placeOf('shop') : findPlace(d.place) ?? findPlace(d.where) ?? findPlace(d.what) ?? findPlace(d.name);
  if (p?.job && !job) p = null; // nothing to do there without a design
  if (!p && !d.errand) p = options[0] ? placeOf(options[0].key) : null;
  if (!p) return { failed: `I cannot go out right now${options.length ? '' : ` (${canGo(s, 'pond', now).why ?? 'nowhere is open'})`}` };
  const may = canGo(s, p.key, now);
  if (!may.ok) return { failed: `${may.why}${may.gear ? `. ${may.gear[0].toUpperCase()}${may.gear.slice(1)} would help: I can put it on my wants list (want)` : ''}${options.length ? `. I could go to ${options.map((o) => o.name).join(' or ')} instead` : ''}`, hinted: true };
  const things = thingsNow(s, p, now);
  const said = String(d.what ?? '').toLowerCase();
  const before = (s.outings ?? []).filter((o) => o.place === p.key).map((o) => o.thing);
  const thing = p.errand || job || play ? null : things.find((t) => said && t.key === 'nap' && t.match.test(said)) ?? things.find((t) => said && t.key !== 'nap' && t.match.test(said)) ?? [...things].filter((t) => t.key !== 'nap' || (s.energy ?? 10) <= 4).sort((a, b) => before.filter((k) => k === a.key).length - before.filter((k) => k === b.key).length)[0] ?? null; // (a nap only when he says so, or when he is tired)
  const rnd = dice(`${p.key}${Math.floor(now / MIN)}`);
  const [a, b] = p.stay ?? [5, 5];
  let stay = Math.round(a + rnd() * (b - a));
  const latest = Math.max(CURFEW, hourNL(now) + (2 * p.walk + 6) / 60); // home by bedtime (and when it is late already, a short stay)
  const room = (latest - hourNL(now)) * 60 - 2 * p.walk;
  stay = Math.max(4, Math.min(stay, Math.floor(room), MAX_AWAY_MIN - 2 * p.walk));
  // On a trip he comes from the place he was at, not from home: the walk is as long as the two places lie apart.
  const from = s.onTheWay && now - Date.parse(s.onTheWay.at) < 12 * MIN && placeOf(s.onTheWay.from) ? placeOf(s.onTheWay.from) : null;
  const walkThere = from ? Math.max(2, Math.round(Math.abs((from.walk ?? 4) - p.walk) + 2)) : p.walk;
  s.onTheWay = null;
  const id = `o${Math.floor(now / 1000).toString(36)}`;
  s.where = { id, place: p.key, thing: thing?.key ?? null, words: job?.words ?? play?.words ?? thing?.words ?? (d.errand ? `buy ${d.errand}` : 'look around'), leftAt: new Date(now).toISOString(), arriveAt: new Date(now + walkThere * MIN).toISOString(), leaveAt: new Date(now + (walkThere + stay) * MIN).toISOString(), homeAt: new Date(now + (walkThere + p.walk + stay) * MIN).toISOString(), ...(from ? { from: from.key, trip: (s.tripN ?? 1) } : {}), ...(d.errand ? { errand: String(d.errand).slice(0, 40) } : {}), ...(job ? { job, ...(job.spot ? { spot: job.spot } : {}) } : {}), ...(play ? { play } : {}) };
  return { ok: true, place: p.key, name: p.name, words: s.where.words, back: s.where.homeAt, backWords: `around ${hm(now + (walkThere + p.walk + stay) * MIN)}` };
}

// ---- While he is out, and coming home. Called at every wake-up. Returns null (he is home), { away, phase, line, back }
// (still out: nothing else happens this wake-up), or { home: true, outing } (he came home just now).
export function outingTick(s, now = Date.now()) {
  if (process.env.PIP_NO_OUT) { s.where = null; return null; } // tests of other things keep him in, also when the saved state they start from has him out
  const w = s.where;
  if (!w || !placeOf(w.place) || w.place === 'home' || isGone(w.place)) { s.where = null; return null; }
  const p = placeOf(w.place);
  const t = (k) => Date.parse(w[k]);
  if (now < t('leaveAt') && !w.cut) { // homing: something sends him home early
    const why = (s.energy ?? 10) <= 2 ? 'I got very tired' : (s.fullness ?? 10) <= 1.3 ? 'I got very hungry' : hourNL(now) >= CURFEW - p.walk / 60 ? 'it got late' : null; // (rain and storms no longer send him home)
    if (why) {
      const walked = Math.min(p.walk * MIN, Math.max(0, now - t('leftAt'))); // he walks back the way he came
      Object.assign(w, { cut: why, reached: now >= t('arriveAt'), leaveAt: new Date(now).toISOString(), homeAt: new Date(now + walked).toISOString() });
    }
  }
  if (now >= t('homeAt') || now - t('leftAt') > 4 * HOUR) return { home: true, outing: finishOuting(s, now) };
  const phase = now < t('arriveAt') && !w.cut ? 'going' : now < t('leaveAt') ? 'there' : 'back';
  const line = phase === 'going' ? `I am walking to ${p.name}.` : phase === 'there' ? `I am at ${p.name}: ${w.errand ? `I ${w.words}` : `I ${w.words}`}.` : `I am walking home from ${p.name}${w.cut ? ` (${w.cut})` : ''}.`;
  return { away: true, phase, place: p.key, name: p.name, line, back: w.homeAt, backWords: `around ${hm(t('homeAt'))}` };
}
// He has to be home now (bedtime): wherever he is, he is brought home.
export function hurryHome(s, now = Date.now()) {
  if (!s.where) return null;
  s.where.cut ??= 'it was bedtime';
  s.where.reached ??= now >= Date.parse(s.where.arriveAt);
  return finishOuting(s, now);
}

const up = (s, key, by) => { if (Number.isFinite(s[key])) s[key] = Math.round(clamp(s[key] + by) * 100) / 100; if (Number.isFinite(s.body?.[key])) s.body[key] = Math.round(clamp(s.body[key] + by) * 100) / 100; }; // (boredom and loneliness live in his body, body.js: an outing changes them there too)

// What happened on the outing: decided here, once, when he comes home. Changes his state (how he feels, what he has)
// and returns the outing: { id, place, thing, leftAt, homeAt, did, found, met, gift, read, saw, cut, errand, weather }.
// (met is always null now: his neighbours moved away, and nobody he sees outside has a name.)
export function finishOuting(s, now = Date.now()) {
  const w = s.where;
  const p = placeOf(w.place);
  const rnd = dice(w.id);
  const at = new Date(now).toISOString();
  const se = seasonInfo(new Date(now));
  const month = Number(new Date(now).toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', month: 'numeric' }));
  const frozen = isFrozen(s.weather, now);
  const wet = isWet(s.weather);
  const o = { id: w.id, place: p.key, thing: w.thing, leftAt: w.leftAt, homeAt: at, weather: { kind: s.weather?.kind ?? null, temp: s.weather?.temp ?? null }, did: '', found: [], met: null, gift: null, read: null, saw: null, cut: w.cut ?? null, ...(w.errand ? { errand: w.errand } : {}) };
  const reached = w.cut ? Boolean(w.reached) : true;
  const find = (always) => {
    const table = (FINDS[p.key] ?? []).filter(([name, , months]) => (!months || months.includes(month)) && !(s.finds ?? []).some((f) => f.name === name));
    if (!table.length || (!always && rnd() > 0.4)) return;
    const [name, emoji, , topic] = pick(rnd, table);
    o.found.push({ name, emoji, topic });
  };
  if (w.errand) o.did = `I walked to the grocery store and came home with ${w.errand}.`;
  else if (!reached) o.did = `I was on my way to ${p.name}, but ${w.cut}, so I turned around.`;
  else if (w.thing === 'nap') { // he can rest anywhere: a nap outside gives him his energy back like one at home
    o.did = wet ? `I tried to nap at ${p.name}. It rained on my face. I slept anyway, a little.` : pick(rnd, [`I took a nap at ${p.name}. I woke up because a sparrow was looking at me from very close.`, `I slept at ${p.name} for a while, with the sun on my eyelids. I dreamt nothing at all, which was perfect.`, `A nap at ${p.name}. When I woke, the light had moved and I had a line of grass printed on my arm.`]);
    o.saw = `${p.name}, with my eyes closed`;
    up(s, 'energy', wet ? 2 : 3.5); up(s, 'calm', 1); up(s, 'boredom', -0.5);
  } else if (w.play) { // he was out with something of his (play.js tells how it went: it depends on how often he has done it)
    const r = playDone(s, w.play, rnd, { wet, frozen });
    o.did = r.did; o.saw = r.saw; o.played = { name: w.play.name, verb: w.play.verb, goes: r.goes, first: r.first };
    up(s, 'joy', r.first ? 1.6 : 1.2); up(s, 'calm', 0.4); up(s, 'wonder', r.first ? 1 : 0.3); up(s, 'boredom', -3); up(s, 'energy', -1.2); up(s, 'creativity', -1.5); // (it lets something out, like making does, and nothing is left standing)
    if (p.key === 'square') up(s, 'loneliness', -1);
  } else if (p.key === 'square') { // the middle of the village: people cross it all day
    o.did = wet ? 'I stood on the square in the rain. Everybody hurried. I did not.' : pick(rnd, ['I walked once round the square and nodded at everybody. Two nodded back. One was a dog.', 'I stood in the middle of the square for a while and let the village go round me.', 'I crossed the square the long way, corner to corner, counting my steps. One hundred and twelve.']);
    o.saw = 'the square, from the middle';
    find(false);
    up(s, 'calm', 0.5); up(s, 'joy', 0.5); up(s, 'loneliness', -1.5); up(s, 'boredom', -1.5); up(s, 'energy', -0.4);
  } else if (p.key === 'pond') {
    if (w.thing === 'ice') { o.did = 'The pond was frozen all the way across. I slid over the ice on my feet, there and back, and fell once.'; up(s, 'joy', 1.4); o.saw = 'the frozen pond'; }
    else if (w.thing === 'find') { find(true); o.did = o.found.length ? `I walked slowly around the pond with my eyes on the ground, and found ${o.found[0].name}.` : 'I walked slowly around the pond with my eyes on the ground. Nothing new today.'; }
    else if (w.thing === 'sketch') { o.saw = pick(rnd, frozen ? ['the ducks standing on the ice', 'the bare willow over the frozen pond'] : ['a duck asleep with its head under its wing', 'the willow hanging over the water', 'the bench by the pond with a coot walking past', 'reeds and their shadows on the water']); o.did = `I sat by the water and looked for a long time at ${o.saw}, to draw it when I am home.`; }
    else {
      const bread = (s.pantry ?? []).find((x) => /bread/.test(x.name ?? '') && x.qty > 0);
      if (bread && !frozen && rnd() < 0.7) { bread.qty -= 1; o.did = 'I sat on the bench under the willow and fed the ducks a little of my bread. They made a happy noise and wanted more.'; up(s, 'joy', 0.8); }
      else o.did = frozen ? 'The pond was frozen. The ducks stood on the ice and looked puzzled, and so did I.' : wet ? 'I stood under my umbrella by the pond. The rain made a thousand little rings on the water, and the ducks did not mind at all.' : pick(rnd, ['I sat on the bench under the willow and watched the ducks. One of them slept with its head under its wing.', 'I watched two ducks argue about a piece of reed, and a coot dive for a very long time.', 'The ducks came close to see if I had bread. I had none, and they stayed anyway.']);
      o.saw = 'the ducks on the pond';
      find(false);
    }
    up(s, 'calm', 1.2); up(s, 'joy', 0.7); up(s, 'wonder', 0.5); up(s, 'boredom', -2); up(s, 'energy', -0.8);
  } else if (p.key === 'doorstep') {
    o.did = wet ? 'I sat in my doorway and listened to the rain on the roofs. The gutter sang.' : pick(rnd, ['I sat on my doorstep and watched the square. A sparrow took a bath in a puddle, very seriously.', 'I sat on my doorstep. Someone pinned a note on the notice board and walked on, whistling.', 'I sat on my doorstep and counted the people crossing the square. Eleven, and one with a dog.', 'I sat on my doorstep until a grey cat came and sat next to me, as if we had agreed to meet.', 'I sat on my doorstep. A traveller crossed the square with a rattling suitcase, looked at my house for a moment, and went on.', 'I sat on my doorstep and watched the door of the grocery store. Nobody went in and nobody came out. I found that restful.']);
    find(false);
    o.saw = 'the square from my doorstep';
    up(s, 'calm', 0.8); up(s, 'joy', 0.5); up(s, 'loneliness', -1.5); up(s, 'boredom', -1); up(s, 'energy', -0.2);
  } else if (p.key === 'field') { // his own land beside the square
    const mine = (s.decor ?? []).filter((d) => d.kind === 'outside').length, shapes = (s.land ?? []).length;
    const have = mine || shapes ? `${[mine ? `${mine} thing${mine === 1 ? '' : 's'} of mine` : '', shapes ? `${shapes} hill${shapes === 1 ? '' : 's'} or hole${shapes === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')} on it so far.` : 'It is empty. That is nobody’s fault but mine.';
    if (w.thing === 'clouds') { o.did = wet ? 'I lay in the wet grass of my field and let the rain fall on my face. It was a bad idea and I liked it.' : pick(rnd, ['I lay on my back in the grass of my field and watched the clouds. One looked like a shoe. Most looked like clouds.', 'I lay in the grass of my field and did nothing at all. A beetle walked over my hand as if I was not there.', 'I lay in my field and looked up. The sky was very big and did not care. That was restful.']); o.saw = 'the sky over my field'; up(s, 'calm', 1.3); }
    else { const a = 4 + Math.floor(rnd() * 9), b = 3 + Math.floor(rnd() * 7); o.did = `I walked all the way around my field. ${have} I paced out a spot of ${a} by ${b} steps and stood in the middle of it: something big could stand right here.`; o.saw = mine ? 'my field with what I built on it' : 'my empty field'; up(s, 'wonder', 0.6); }
    find(false);
    up(s, 'calm', 0.6); up(s, 'joy', 0.6); up(s, 'boredom', -2); up(s, 'energy', -0.6);
  } else if (p.key === 'museum') { // his own museum: the things he made, on plinths (museum.js)
    const pieces = s.museum ?? [];
    const one = pieces.length ? pieces[Math.floor(rnd() * pieces.length)] : null;
    if (!one) { o.did = 'I walked through my museum. Forty plinths and nothing on them. It echoes. It is waiting for me.'; o.saw = 'my empty museum'; up(s, 'wonder', 0.6); }
    else if (w.thing === 'dust') { o.did = `I dusted the plinths in my museum and set ${one.name} straight. ${pieces.length} thing${pieces.length === 1 ? '' : 's'} of mine stand${pieces.length === 1 ? 's' : ''} there now. Somebody has to look after them, and it is me.`; o.saw = 'my museum, dusted'; up(s, 'calm', 0.8); }
    else { o.did = pick(rnd, [`I walked past my things in my museum and stopped at ${one.name}. I remember making it. I would do one thing differently now, and I am not telling which.`, `I walked through my museum. ${pieces.length} thing${pieces.length === 1 ? '' : 's'} I made, each on its own plinth. I stood longest at ${one.name}.`, `In my museum I looked at ${one.name} as if somebody else had made it. Not bad. Whoever made it had patience.`]); o.saw = `${one.name} in my museum`; up(s, 'joy', 0.9); }
    find(false);
    up(s, 'calm', 0.6); up(s, 'joy', 0.5); up(s, 'boredom', -1.5); up(s, 'energy', -0.5);
  } else if (p.key === 'stone') { // the green stone, far out in the grass
    o.did = w.thing === 'listen'
      ? pick(rnd, ['I walked out to the green stone and put my ear against it. It hums, very low. Or my ear does. One of us.', 'I pressed my ear to the green stone. Nothing. Then something, like a fridge far away. I do not trust it.', 'I listened at the green stone for a long time. It said nothing useful, which is still more than most stones.'])
      : pick(rnd, ['I sat with my back against the green stone. It was warmer than a stone should be. Nobody knows who put it there, and it is not telling.', 'I sat by the green stone and looked back at the village. From here my house is the size of my thumb.', 'I walked all the way out to the green stone and sat down. It is a long walk for a stone. I would do it again.']);
    o.saw = 'the green stone';
    find(false);
    up(s, 'wonder', 1.4); up(s, 'calm', 0.7); up(s, 'boredom', -2); up(s, 'energy', -1);
  } else if (p.key === 'library') {
    const topic = (s.curious?.interests ?? [])[0]?.topic ?? (s.curious?.sparks ?? []).at(-1)?.topic ?? pick(rnd, ['Constellation', 'Origami', 'Lighthouse', 'Hedgehog', 'Kite', 'Clockwork']);
    o.read = topic;
    o.did = `At the library I found a book about ${topic.toLowerCase()} and read it at the big table by the window. It was so quiet I could hear the pages.`;
    o.saw = 'the reading table at the library';
    up(s, 'wonder', 1.5); up(s, 'calm', 0.8); up(s, 'energy', -0.6); up(s, 'boredom', -2); up(s, 'loneliness', -1.5); // (people read at the other tables: he is not alone there)
  } else if (p.key === 'board') { // he reads what people pinned on the notice board
    o.did = readBoard(s, now);
    o.saw = 'the notice board on the square';
    up(s, 'boredom', -0.8); up(s, 'wonder', 0.4); up(s, 'loneliness', -0.8); // (other people's doings: he is part of a village)
  } else if (p.key === 'workshop') { // his design is printed and stays on the shelf there
    const j = w.job ?? {};
    (s.prints ??= []).push({ id: `pr${w.id}`, name: String(j.name ?? 'a small thing').slice(0, 60), why: String(j.why ?? '').slice(0, 200), parts: Array.isArray(j.parts) ? j.parts : [], at: w.arriveAt });
    s.prints = s.prints.slice(-60);
    o.made = { kind: 'print', name: j.name };
    o.did = `At the print workshop I watched the printer build my ${j.name}, one thin layer on top of the other. It is small and still warm. I put it on the shelf by the door, with my other prints.`;
    o.saw = 'the printer at work';
    up(s, 'joy', 1.3); up(s, 'wonder', 0.9); up(s, 'calm', 0.4); up(s, 'energy', -0.6);
  } else if (p.key === 'walls') { // the painting he designed is on the wall now, for everyone to see
    const j = w.job ?? {};
    o.made = { kind: 'paint', name: j.name, wall: j.wall, on: j.wallName };
    o.did = `I painted "${j.name}" on ${j.wallName ?? 'a wall'}, big, with my whole arm. ${pick(rnd, ['My hands are full of paint.', 'I stepped back three times to look at it.', 'A sparrow watched me the whole time.', 'The paint ran a little, and I let it.', 'Someone passing through stopped to look, said nothing, and walked on.'])}`;
    o.saw = `my painting on ${j.wallName ?? 'the wall'}`;
    up(s, 'joy', 1.5); up(s, 'calm', 0.6); up(s, 'energy', -1);
  } else if (p.key === 'drops') { // a note someone left for him: he has it now, and reads it
    o.did = dropFound(s, w.job?.drop, now);
    o.saw = 'a note that lay waiting for me';
    up(s, 'wonder', 0.6); up(s, 'loneliness', -2.5); // somebody thought of him
  } else if (p.key === 'land') { // he shaped the ground with the land tool: a hill, a hole, or flat again
    const j = w.job ?? {};
    o.made = { kind: 'land', name: j.name };
    o.did = landDone(s, j, at);
    o.saw = j.name ? `my ${j.name}` : 'the land tools';
    up(s, 'joy', 1.2); up(s, 'wonder', 0.8); up(s, 'energy', -1.4);
  }
  if (w.cut && reached && !w.errand) o.did += ` I went home early, because ${w.cut}.`;
  if (!reached && w.job?.kind === 'paint') for (const list of [s.art, s.gallery]) { const a = (list ?? []).find((x) => x.id === w.job.art); if (a) delete a.wall; } // he never got to the wall: it stays a drawing in his album
  up(s, 'boredom', -2.5);
  for (const f of o.found) { (s.finds ??= []).push({ name: f.name, emoji: f.emoji, from: p.key, at }); if (f.topic) noteSpark(s, { topic: f.topic, text: `I found ${f.name} at ${p.name}.`, from: 'outing' }, now); }
  s.finds = (s.finds ?? []).slice(-60);
  s.outings = [...(s.outings ?? []), o].slice(-30);
  if (!w.errand && reached) world(s).count += 1;
  s.where = null;
  return o;
}
// The outing in one breath, in his words (for his memory and for the brain's next thought).
export const homeLine = (o) => [`I am home again from ${placeOf(o.place)?.name ?? 'outside'}.`, o.did.trim(), o.found.length && !/found /.test(o.did) ? `I brought home ${o.found.map((f) => f.name).join(' and ')}.` : ''].filter(Boolean).join(' ');

// His time at a place is over, and he goes straight on to the next place of his plan instead of home. Returns what
// he did there (like finishOuting), or null when he is not at that point (still there, on his way, or home already).
export function goOn(s, now = Date.now()) {
  const w = s.where;
  if (!w || w.cut || w.errand || now < Date.parse(w.leaveAt) || now >= Date.parse(w.homeAt)) return null;
  const from = w.place;
  const o = finishOuting(s, now);
  s.onTheWay = { from, at: new Date(now).toISOString() };
  s.tripN = (w.trip ?? 1) + 1;
  return { ...o, wentOn: true };
}
