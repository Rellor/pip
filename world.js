// Pip's world outside his room: the rules. Plain code, no model.
// The brain only makes one choice, at home: "go out, to this place". Everything after that is the game's: it walks him
// there, lets a little time pass, decides what he saw and found, and brings him home again. So he always comes home:
// to sleep, to eat, when he is tired or hungry, when a storm comes, at dusk, and at the latest by half past nine.
// (Research: named places and one committed outing keep a small model on the rails; worlds where the model steered
// every step wandered into closed shops and walked in circles. Travel Frog and Finch showed how nice it is when a
// creature goes off by itself and comes back with something.)
import { PLACES, placeOf, findPlace, hoursOf, openNow, isFrozen, isWet, isStorm, FINDS } from './web/world.js';
import { hourNL, PEOPLE, moonPhase, moonWord } from './web/street.js';
import { seasonInfo } from './web/season.js';
import { noteSpark } from './curiosity.js';
import { warm } from './neighbours.js';
import { giveForAsk } from './gifts.js';

export const MAX_OUTINGS_PER_DAY = 2; // real outings; a quick errand to the shop is not counted
export const CURFEW = 21.5; // home by half past nine (Dutch time)
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
export function unlockedKeys(s) {
  const w = world(s);
  return PLACES.filter((p) => !p.locked || (p.key === 'library' ? owns(s, GEAR.card) : Boolean(w.open[p.key]))).map((p) => p.key);
}
export const knownKeys = (s) => PLACES.filter((p) => world(s).known[p.key] || world(s).open[p.key]).map((p) => p.key);
// New places open up as he lives: by friendship, by going out, by a gift. Returns what he hears about it (often nothing).
export function checkUnlocks(s, now = Date.now()) {
  const w = world(s);
  const at = new Date(now).toISOString();
  const said = [];
  if (!w.open.garden && (s.street?.people?.['Oma Jo']?.warmth ?? 0) >= 2) { w.open.garden = at; said.push('Oma Jo said I may come into her garden whenever I like. It is two minutes from my door, and she always has a job for me (go_out).'); }
  if (!w.known.library && w.count >= 2) { w.known.library = at; said.push('Mo told me there is a library ten minutes from here, with more books than I can count. To go in I need a library card. I can ask Bas for one (ask_for).'); }
  if (!w.open.library && owns(s, GEAR.card)) { w.open.library = at; w.known.library ??= at; said.push('I have a library card now. The library is open from Tuesday to Saturday, 10 to 17 (go_out).'); }
  if (!w.open.hill && w.count >= 4) { w.open.hill = at; said.push('By the pond I found a path that goes up the hill behind the houses. From up there I can see my whole street, and all of the sky (go_out).'); }
  return said;
}

const lastReal = (s) => (s.outings ?? []).filter((o) => !o.errand).at(-1) ?? null;
const realToday = (s, now) => (s.outings ?? []).filter((o) => !o.errand && dayNL(Date.parse(o.leftAt)) === dayNL(now)).length + (s.where && !s.where.errand ? 1 : 0);
// May he go there now? { ok: true } or { why, gear } (gear: what would make it possible).
export function canGo(s, key, now = Date.now()) {
  const p = placeOf(key);
  if (!p || p.key === 'home') return { why: 'that is not a place I can go to' };
  if (s.where) return { why: 'I am out already' };
  if (!unlockedKeys(s).includes(p.key)) return { why: p.key === 'library' ? 'I need a library card to go into the library' : `I cannot go to ${p.name} yet`, ...(p.key === 'library' ? { gear: 'a library card' } : {}) };
  const h = hourNL(now);
  const [from, to] = hoursOf(p, now);
  if (!openNow(p, now)) return { why: p.days && !p.days.includes(new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getDay()) ? `${p.name} is closed today` : h < from ? `it is too early for ${p.name}` : `it is too late for ${p.name} today` };
  const need = (2 * p.walk + (p.stay?.[0] ?? 5)) / 60;
  if (h + need > Math.min(CURFEW, to + p.walk / 60 + 0.2)) return { why: `it is too late to get to ${p.name} and back before dark` };
  if (isStorm(s.weather)) return { why: 'there is a storm outside' };
  const far = p.walk >= 5;
  if (isWet(s.weather) && p.key !== 'doorstep' && !owns(s, GEAR.umbrella)) return { why: 'it is raining and I have no umbrella', gear: 'an umbrella' };
  if (far && Number.isFinite(s.weather?.temp) && s.weather.temp <= 0 && !owns(s, GEAR.warm)) return { why: 'it is freezing and I have nothing warm to wear outside', gear: 'a warm scarf (I can make one with make_clothes, or ask)' };
  if (p.errand) return { ok: true };
  if ((s.energy ?? 10) < 3.5) return { why: 'I am too tired to go out' };
  if ((s.fullness ?? 10) < 3.5) return { why: 'I am too hungry to go out: I eat first' };
  if (realToday(s, now) >= MAX_OUTINGS_PER_DAY) return { why: 'I have been out twice today already' };
  const last = lastReal(s);
  if (last && last.place === p.key && dayNL(Date.parse(last.leftAt)) === dayNL(now)) return { why: `I was at ${p.name} already today` };
  if (last && now - Date.parse(last.homeAt ?? last.leftAt) < 90 * MIN) return { why: 'I only just came home' };
  return { ok: true };
}
// What there is to do at a place right now (the things that fit the weather and what he has). What only this moment
// offers (the frozen pond) comes first.
export const thingsNow = (s, p, now = Date.now()) => [...(p.things ?? [])].sort((a, b) => Boolean(b.when) - Boolean(a.when)).filter((t) => (t.when === 'frozen' ? isFrozen(s.weather, now) : true) && (!t.needs || owns(s, GEAR[t.needs])) && !(isFrozen(s.weather, now) && p.key === 'pond' && t.key === 'find' && /snow/.test(String(s.weather?.kind ?? ''))));
// The places he can go to now, the most inviting first: [{ key, name, words }].
export function goOptions(s, now = Date.now()) {
  const done = (key) => (s.outings ?? []).filter((o) => o.place === key).length;
  return PLACES.filter((p) => p.key !== 'home' && !p.errand && canGo(s, p.key, now).ok)
    .sort((a, b) => done(a.key) - done(b.key) || a.walk - b.walk)
    .map((p) => ({ key: p.key, name: p.name, walk: p.walk, words: thingsNow(s, p, now).slice(0, 3).map((t) => t.words) }));
}
// The words of the go_out move (short: the brain reads this every time).
export function goLine(s, now = Date.now()) {
  const say = (list) => list.map((o) => `${o.name} (${o.walk} min: ${o.words.slice(0, o.walk >= 5 ? 3 : 1).join(', ')})`).join('; ');
  const all = goOptions(s, now).slice(0, 3);
  return say(all).length <= 170 ? say(all) : say(all.slice(0, 2)).slice(0, 170);
}
// How much he feels like going out (for how inviting the move is).
export function wantsOut(s, now = Date.now()) {
  if (!goOptions(s, now).length) return 0;
  const last = lastReal(s);
  const since = last ? (now - Date.parse(last.homeAt ?? last.leftAt)) / HOUR : 48;
  const nice = !isWet(s.weather) && (s.weather?.temp ?? 10) > 3 && (s.weather?.cloud ?? 0) < 0.7;
  return 0.5 + (s.body?.boredom ?? 0) / 5 + Math.min(1.6, since / 14) + (nice ? 0.5 : 0) + (last ? 0 : 0.8);
}
// When the weather or a missing thing keeps him in, and he has not been out for a while: what he could ask for.
export function gearWish(s, now = Date.now()) {
  if (world(s).known.library && !owns(s, GEAR.card) && !(s.asks ?? []).some((a) => a.status === 'open' && GEAR.card.test(a.item))) return 'I would like a library card, so I can read at the library';
  const last = lastReal(s);
  if (last && now - Date.parse(last.homeAt ?? last.leftAt) < 20 * HOUR) return null; // the weather only bothers him when he has been in for a day
  const h = hourNL(now);
  if (h < 9 || h > 18 || s.where) return null;
  const why = canGo(s, 'pond', now);
  if (!why.gear) return null;
  const re = /umbrella/.test(why.gear) ? GEAR.umbrella : GEAR.warm;
  return (s.asks ?? []).some((a) => a.status === 'open' && re.test(a.item)) ? null : `${why.why}, so I cannot go out (${why.gear} would help)`;
}

// ---- Going out
// details: { place, what } as the brain said it (or { place: 'shop', errand: 'clay' } for a quick errand). Returns { ok, ... } or { failed }.
export function startOuting(s, details = {}, now = Date.now()) {
  const d = details && typeof details === 'object' ? details : {};
  const options = goOptions(s, now);
  let p = d.errand ? placeOf('shop') : findPlace(d.place) ?? findPlace(d.where) ?? findPlace(d.what) ?? findPlace(d.name);
  if (!p && !d.errand) p = options[0] ? placeOf(options[0].key) : null;
  if (!p) return { failed: `I cannot go out right now${options.length ? '' : ` (${canGo(s, 'pond', now).why ?? 'nowhere is open'})`}` };
  const may = canGo(s, p.key, now);
  if (!may.ok) return { failed: `${may.why}${may.gear ? `. ${may.gear[0].toUpperCase()}${may.gear.slice(1)} would help: I can ask for it (ask_for)` : ''}${options.length ? `. I could go to ${options.map((o) => o.name).join(' or ')} instead` : ''}`, hinted: true };
  const things = thingsNow(s, p, now);
  const said = String(d.what ?? '').toLowerCase();
  const before = (s.outings ?? []).filter((o) => o.place === p.key).map((o) => o.thing);
  const thing = p.errand ? null : things.find((t) => said && t.match.test(said)) ?? [...things].sort((a, b) => before.filter((k) => k === a.key).length - before.filter((k) => k === b.key).length)[0] ?? null;
  const rnd = dice(`${p.key}${Math.floor(now / MIN)}`);
  const [a, b] = p.stay ?? [5, 5];
  let stay = Math.round(a + rnd() * (b - a));
  const latest = Math.min(CURFEW, hoursOf(p, now)[1] + p.walk / 60 + 0.2); // home by then
  const room = (latest - hourNL(now)) * 60 - 2 * p.walk;
  stay = Math.max(4, Math.min(stay, Math.floor(room), MAX_AWAY_MIN - 2 * p.walk));
  const id = `o${Math.floor(now / 1000).toString(36)}`;
  s.where = { id, place: p.key, thing: thing?.key ?? null, words: thing?.words ?? (d.errand ? `buy ${d.errand}` : 'look around'), leftAt: new Date(now).toISOString(), arriveAt: new Date(now + p.walk * MIN).toISOString(), leaveAt: new Date(now + (p.walk + stay) * MIN).toISOString(), homeAt: new Date(now + (2 * p.walk + stay) * MIN).toISOString(), ...(d.errand ? { errand: String(d.errand).slice(0, 40) } : {}) };
  return { ok: true, place: p.key, name: p.name, words: s.where.words, back: s.where.homeAt, backWords: `around ${hm(now + (2 * p.walk + stay) * MIN)}` };
}

// ---- While he is out, and coming home. Called at every wake-up. Returns null (he is home), { away, phase, line, back }
// (still out: nothing else happens this wake-up), or { home: true, outing } (he came home just now).
export function outingTick(s, now = Date.now()) {
  const w = s.where;
  if (!w || !placeOf(w.place) || w.place === 'home') { s.where = null; return null; }
  const p = placeOf(w.place);
  const t = (k) => Date.parse(w[k]);
  if (now < t('leaveAt') && !w.cut) { // homing: something sends him home early
    const why = isStorm(s.weather) ? 'a storm came up' : (s.energy ?? 10) <= 2 ? 'I got very tired' : (s.fullness ?? 10) <= 2 ? 'I got very hungry' : isWet(s.weather) && !w.errand && p.key !== 'doorstep' && !owns(s, GEAR.umbrella) ? 'it started to rain and I have no umbrella' : hourNL(now) >= CURFEW - p.walk / 60 ? 'it got late' : null;
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

const up = (s, key, by) => { if (Number.isFinite(s[key])) s[key] = Math.round(clamp(s[key] + by) * 100) / 100; };
const LIKE_TOPIC = { trains: 'Steam locomotive', maps: 'Cartography', 'old machines': 'Steam engine', tea: 'Tea', synthesizers: 'Synthesizer', 'electronic music': 'Electronic music', 'video games': 'Pixel art', 'neon colours': 'Neon lighting', vegetables: 'Kitchen garden', flowers: 'Flower', knitting: 'Knitting', 'baking bread': 'Sourdough', cats: 'Cat', drawing: 'Sketch (drawing)', dinosaurs: 'Dinosaur', stars: 'Constellation', puzzles: 'Mechanical puzzle', clocks: 'Clockwork', woodwork: 'Woodworking', riddles: 'Riddle' };
const awake = (n, h) => h >= n.up[0] && h < n.up[1];

// What happened on the outing: decided here, once, when he comes home. Changes his state (how he feels, what he has,
// who likes him) and returns the outing: { id, place, thing, leftAt, homeAt, did, found, met, gift, read, saw, cut, errand, weather }.
export function finishOuting(s, now = Date.now()) {
  const w = s.where;
  const p = placeOf(w.place);
  const rnd = dice(w.id);
  const at = new Date(now).toISOString();
  const h = hourNL(Date.parse(w.arriveAt));
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
  const meet = (who, line, by = 0.2) => { o.met = who; o.did += ` ${line}`; warm(s, who, by); };
  if (w.errand) o.did = `I walked to the corner shop and came home with ${w.errand}.`;
  else if (!reached) o.did = `I was on my way to ${p.name}, but ${w.cut}, so I turned around.`;
  else if (p.key === 'pond') {
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
    if (!o.met && rnd() < 0.35) { const who = PEOPLE.filter((n) => awake(n, h) && n.name !== 'Lina' && (h < 12 ? n.name !== 'Dot' : true)); if (who.length) { const n = pick(rnd, who); meet(n.name, n.name === 'Oma Jo' ? 'Oma Jo was there too, with a bag of old bread for the ducks. We stood together for a while.' : n.name === 'Dot' ? 'Dot was on the swing by the pond and showed me how high she can go.' : n.name === 'Mo' ? 'Mo sat on the other bench with a flask of tea, and waved.' : 'Kees walked past, counting his steps out loud, and nodded to me.'); } }
    up(s, 'calm', 1.2); up(s, 'joy', 0.7); up(s, 'wonder', 0.5); up(s, 'energy', -0.8);
  } else if (p.key === 'doorstep') {
    const home = PEOPLE.filter((n) => awake(n, h));
    if ((w.thing === 'chat' || rnd() < 0.45) && home.length) {
      const n = [...home].sort((a, b) => (s.street?.people?.[b.name]?.warmth ?? 0) - (s.street?.people?.[a.name]?.warmth ?? 0))[w.thing === 'chat' ? 0 : Math.floor(rnd() * home.length)];
      const like = pick(rnd, n.likes);
      o.did = `I sat on my doorstep. ${n.name} came by and stopped to talk, mostly about ${like}.`;
      o.met = n.name;
      warm(s, n.name, 0.3);
      o.spark = { topic: LIKE_TOPIC[like] ?? like, text: `${n.name} told me about ${like} on my doorstep.` };
    } else {
      o.did = wet ? 'I sat in my doorway and listened to the rain on the roofs. The gutter sang.' : pick(rnd, ['I sat on my doorstep and watched the street. A sparrow took a bath in a puddle, very seriously.', 'I sat on my doorstep. The baker carried trays past, and the whole street smelled of bread.', 'I sat on my doorstep and counted bicycles. Eleven, and one with a dog in the basket.', 'I sat on my doorstep until a grey cat came and sat next to me, as if we had agreed to meet.']);
      find(false);
    }
    o.saw = 'my street from my doorstep';
    up(s, 'calm', 0.8); up(s, 'joy', 0.5); up(s, 'loneliness', -1.5); up(s, 'energy', -0.2);
  } else if (p.key === 'garden') {
    const job = se.name === 'winter' ? 'spread straw over the beds for the cold' : se.name === 'spring' ? 'sow peas in a long straight row' : se.name === 'summer' ? 'tie up the tomato plants and water everything' : 'pull up the last carrots and turn the compost';
    if (w.thing === 'learn') { const tip = pick(rnd, [['Compost', 'how old leaves and peels turn into earth again'], ['Companion planting', 'which plants like to stand next to each other'], ['Crop rotation', 'why she never grows the same thing twice in one bed'], ['Seed saving', 'how she keeps seeds of her best plants for next year']]); o.did = `I asked Oma Jo how she grows things. She showed me ${tip[1]}.`; o.spark = { topic: tip[0], text: `Oma Jo showed me ${tip[1]}.` }; up(s, 'wonder', 1); }
    else { o.did = `I helped Oma Jo ${job}. My hands smell of earth.`; up(s, 'energy', -0.6); }
    const given = month >= 6 && month <= 11 && rnd() < 0.6 ? giveForAsk(s, pick(rnd, ['carrots', 'tomatoes', 'apples'])) : giveForAsk(s, `${pick(rnd, ['pea', 'lettuce', 'sunflower', 'carrot'])} seeds`);
    if (given.length) { o.gift = given.join(', '); o.did += ` She gave me ${o.gift} to take home, and a slice of bread with butter.`; up(s, 'fullness', 1); }
    find(false);
    o.met = 'Oma Jo';
    o.saw = 'Oma Jo’s garden';
    warm(s, 'Oma Jo', 0.4);
    up(s, 'joy', 1); up(s, 'calm', 0.6); up(s, 'loneliness', -2); up(s, 'energy', -0.8);
  } else if (p.key === 'library') {
    const topic = (s.curious?.interests ?? [])[0]?.topic ?? (s.curious?.sparks ?? []).at(-1)?.topic ?? pick(rnd, ['Constellation', 'Origami', 'Lighthouse', 'Hedgehog', 'Kite', 'Clockwork']);
    o.read = topic;
    o.did = `At the library I found a book about ${topic.toLowerCase()} and read it at the big table by the window. It was so quiet I could hear the pages.`;
    o.saw = 'the reading table at the library';
    up(s, 'wonder', 1.5); up(s, 'calm', 0.8); up(s, 'energy', -0.6); up(s, 'boredom', -2);
  } else if (p.key === 'hill') {
    const late = h >= se.sunset - 0.6;
    if (w.thing === 'kite') { o.did = 'I flew my kite from the top of the hill. It pulled on the string like something alive.'; up(s, 'joy', 1.6); o.saw = 'my kite over the hill'; }
    else if (late) { o.did = `I sat on the bench on the hill and watched the sun go down behind the roofs. My whole street turned orange, and then the first star came. Tonight: ${moonWord(moonPhase(now))}.`; o.saw = 'the sunset over my street'; o.spark = { topic: 'Sunset', text: 'I watched the sun go down from the hill.' }; }
    else { o.did = wet ? 'From the hill I watched the rain walk across the fields like a grey curtain.' : pick(rnd, ['I lay on my back on the hill and watched the clouds. One looked like a whale, and then like a teapot.', 'From the hill I could see every roof of my street, and the smoke from the bakery going straight up.', 'On the hill the wind was so strong I had to lean into it. A hawk hung in the air without moving.']); o.saw = 'my street seen from the hill'; }
    find(false);
    up(s, 'wonder', 1.8); up(s, 'calm', 1); up(s, 'joy', 0.6); up(s, 'energy', -1.3);
  }
  if (w.cut && reached && !w.errand) o.did += ` I went home early, because ${w.cut}.`;
  up(s, 'boredom', -2.5);
  for (const f of o.found) { (s.finds ??= []).push({ name: f.name, emoji: f.emoji, from: p.key, at }); if (f.topic) noteSpark(s, { topic: f.topic, text: `I found ${f.name} at ${p.name}.`, from: 'outing' }, now); }
  s.finds = (s.finds ?? []).slice(-60);
  if (o.spark) noteSpark(s, { ...o.spark, from: 'outing' }, now);
  delete o.spark;
  s.outings = [...(s.outings ?? []), o].slice(-30);
  if (!w.errand && reached) world(s).count += 1;
  s.where = null;
  return o;
}
// The outing in one breath, in his words (for his memory and for the brain's next thought).
export const homeLine = (o) => [`I am home again from ${placeOf(o.place)?.name ?? 'outside'}.`, o.did.trim(), o.found.length && !/found /.test(o.did) ? `I brought home ${o.found.map((f) => f.name).join(' and ')}.` : ''].filter(Boolean).join(' ');
