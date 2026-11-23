// Pip's world outside his room (world.js, web/world.js): named places, clear rules, and he always comes home.
// Run: node tests/outside.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { canGo, goOptions, goLine, wantsOut, gearWish, startOuting, outingTick, hurryHome, homeLine, checkUnlocks, unlockedKeys, MAX_OUTINGS_PER_DAY, CURFEW } from '../world.js';
import { PLACES, placeOf, findPlace, openNow, worldMapSvg, postcardSvg, hisWords } from '../web/world.js';
import { availableMoves } from '../moves.js';
import { toAnswer } from '../brain.js';
import { giveForAsk } from '../gifts.js';
import { buy } from '../shop.js';
import { tickBody } from '../body.js';

const ok = (name) => console.log(`ok  ${name}`);
const MIN = 60_000;
const noon = Date.parse('2026-11-23T11:00:00Z'); // Monday 12:00 in Amsterdam (the library is closed on Mondays)
const tuesday = noon + 24 * 60 * MIN;
const fresh = (more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 5, loneliness: 5, weather: { kind: 'clear', temp: 8, cloud: 0.2, wind: 0.2 }, tools: [], pantry: [], wardrobe: [], decor: [], garden: { seeds: [], plots: [] }, curious: { sparks: [], interests: [] }, street: { people: {} }, log: [], ...more });
const iso = (ms) => new Date(ms).toISOString();

// ---- the places
assert.deepEqual(PLACES.map((p) => p.key), ['home', 'doorstep', 'shop', 'pond', 'garden', 'library', 'hill', 'workshop', 'walls']);
assert.ok(PLACES.length <= 10, 'a small world: a handful of places besides home');
for (const p of PLACES.filter((x) => x.key !== 'home' && !x.errand && !x.job)) assert.ok(p.things.length >= 1 && p.stay && p.blurb && p.walk > 0, p.key);
for (const p of PLACES.filter((x) => x.job)) assert.ok(!p.things && p.stay && p.blurb && p.walk > 0 && !p.locked, `${p.key}: a place he only goes to with something to make there`);
assert.equal(findPlace('the pond')?.key, 'pond');
assert.equal(findPlace('the park, to see the ducks')?.key, 'pond');
assert.equal(findPlace("Oma Jo's garden")?.key, 'garden');
assert.equal(findPlace('my doorstep')?.key, 'doorstep');
assert.equal(findPlace('the moon'), null);
assert.equal(hisWords('pond', 'sketch what I see'), 'sketch what he sees');
ok('a small world of named places; he can say a place in his own words');

// ---- where he may go
const s = fresh();
assert.deepEqual(unlockedKeys(s), ['home', 'doorstep', 'shop', 'pond', 'workshop', 'walls'], 'the world starts small');
assert.deepEqual(goOptions(s, noon).map((o) => o.key), ['doorstep', 'pond']);
assert.ok(goLine(s, noon).length <= 170, goLine(s, noon));
assert.match(goLine(s, noon), /the pond in the park \(8 min: watch the ducks/);
assert.match(canGo(s, 'library', noon).why, /library card/);
assert.match(canGo(s, 'hill', noon).why, /cannot go to the hill/);
assert.match(canGo(s, 'pond', noon + 7 * 60 * MIN).why, /too late/, 'the pond is for daylight');
assert.match(canGo(s, 'doorstep', noon + 10 * 60 * MIN).why, /too late/);
assert.match(canGo(fresh({ energy: 2 }), 'pond', noon).why, /too tired/);
assert.match(canGo(fresh({ fullness: 2 }), 'pond', noon).why, /hungry/);
assert.match(canGo(fresh({ weather: { kind: 'storm', temp: 9 } }), 'doorstep', noon).why, /storm/);
ok('opening hours, daylight, hunger, tiredness and storms decide where he can go');

// ---- what he needs, he can ask for (or buy, or make)
const rainy = fresh({ weather: { kind: 'rain', temp: 9 } });
assert.deepEqual([canGo(rainy, 'pond', noon).why, canGo(rainy, 'pond', noon).gear], ['it is raining and I have no umbrella', 'an umbrella']);
assert.equal(canGo(rainy, 'doorstep', noon).ok, true, 'his own doorstep is dry');
assert.match(gearWish(rainy, noon), /raining and I have no umbrella.*an umbrella would help/);
rainy.asks = [{ status: 'open', item: 'an umbrella' }];
assert.equal(gearWish(rainy, noon), null, 'he does not ask twice');
assert.deepEqual(giveForAsk(rainy, 'an umbrella'), ['a umbrella'.replace('a u', 'a u')]);
assert.equal(canGo(rainy, 'pond', noon).ok, true);
const cold = fresh({ weather: { kind: 'clear', temp: -3 } });
assert.match(canGo(cold, 'pond', noon).why, /freezing/);
cold.wardrobe.push({ name: 'red woolly scarf', worn: true });
assert.equal(canGo(cold, 'pond', noon).ok, true, 'a scarf he made himself is enough');
assert.ok(goOptions(cold, noon).find((o) => o.key === 'pond').words.includes('slide on the ice'), 'the pond freezes in real frost');
const rich = fresh({ coins: 9 });
assert.equal(buy(rich, 'umbrella', noon).bought, 'umbrella');
assert.equal(canGo({ ...rich, weather: { kind: 'rain', temp: 8 } }, 'pond', noon).ok, true, 'or he buys one at the corner shop');
ok('rain needs an umbrella and frost something warm: he can ask, buy or make it');

// ---- an outing is one block: there, a while, and home again
const r = startOuting(s, { place: 'the pond', what: 'look for something to bring home' }, noon);
assert.deepEqual([r.ok, r.place, r.words], [true, 'pond', 'look for something to bring home']);
const stay = (Date.parse(s.where.leaveAt) - Date.parse(s.where.arriveAt)) / MIN;
assert.ok(stay >= 30 && stay <= 50 && Date.parse(s.where.arriveAt) - noon === 8 * MIN && Date.parse(s.where.homeAt) - Date.parse(s.where.leaveAt) === 8 * MIN, JSON.stringify(s.where));
assert.match(startOuting(s, { place: 'doorstep' }, noon + MIN).failed, /out already/);
assert.deepEqual(outingTick(s, noon + 3 * MIN).phase, 'going');
assert.match(outingTick(s, noon + 20 * MIN).line, /^I am at the pond in the park: I look for something/);
assert.equal(outingTick(s, Date.parse(s.where.leaveAt) + MIN).phase, 'back');
const before = { calm: s.calm, energy: s.energy, boredom: s.boredom };
const home = outingTick(s, Date.parse(s.where.homeAt) + MIN);
assert.equal(home.home, true);
const o = home.outing;
assert.equal(s.where, null);
assert.equal(o.found.length, 1, 'he looked for something, so he found something');
assert.match(o.did, /walked slowly around the pond.*found/);
assert.match(homeLine(o), /^I am home again from the pond in the park\. I walked/);
assert.ok(s.calm > before.calm && s.energy < before.energy && s.boredom < before.boredom, 'it calmed him, tired him a little, and he is less bored');
assert.deepEqual(s.finds.map((f) => f.from), ['pond']);
assert.equal(s.curious.sparks.length, 1, 'what he found makes him curious');
assert.equal(s.world.count, 1);
assert.equal(outingTick(s, noon + 3 * 60 * MIN), null, 'at home nothing happens');
ok('there, a while, home again: what he saw, what he found, how he feels');

// the same outing always tells the same story
const twice = () => { const x = fresh(); startOuting(x, { place: 'pond', what: 'watch the ducks' }, noon); return outingTick(x, noon + 2 * 60 * MIN).outing.did; };
assert.equal(twice(), twice());
ok('an outing turns out the same way when it is told twice');

// ---- he always comes home
assert.match(canGo(s, 'pond', noon + 3 * 60 * MIN).why, /already today/);
assert.match(canGo(s, 'doorstep', noon + 70 * MIN).why, /only just came home/);
assert.equal(canGo(s, 'doorstep', noon + 3 * 60 * MIN).ok, true);
startOuting(s, { place: 'doorstep' }, noon + 3 * 60 * MIN);
outingTick(s, noon + 4 * 60 * MIN);
assert.equal(MAX_OUTINGS_PER_DAY, 2);
assert.match(canGo(s, 'doorstep', noon + 6 * 60 * MIN).why, /twice today/);
assert.deepEqual(goOptions(s, noon + 6 * 60 * MIN), []);
assert.equal(availableMoves({ ...s, body: { boredom: 9, curiosity: 5 } }, { now: noon + 6 * 60 * MIN }).some((m) => m.name === 'go_out'), false, 'a place he cannot go to is never offered');
for (const [why, change] of [['very tired', { energy: 1.5 }], ['very hungry', { fullness: 1.5 }], ['storm', { weather: { kind: 'storm', temp: 9 } }], ['started to rain', { weather: { kind: 'rain', temp: 9 } }]]) {
  const x = fresh();
  startOuting(x, { place: 'pond' }, noon);
  Object.assign(x, change);
  const t = outingTick(x, noon + 15 * MIN);
  assert.equal(t.phase, 'back', why);
  assert.match(t.line, new RegExp(why));
  assert.ok(Date.parse(x.where.homeAt) <= noon + 24 * MIN, `${why}: he is home within the walk back`);
  assert.match(outingTick(x, noon + 30 * MIN).outing.did, /went home early/);
}
const turned = fresh();
startOuting(turned, { place: 'pond' }, noon);
turned.weather = { kind: 'storm', temp: 9 };
outingTick(turned, noon + 3 * MIN);
assert.match(outingTick(turned, noon + 7 * MIN).outing.did, /on my way to the pond.*turned around/);
assert.equal(turned.world.count, 0, 'an outing he turned back from does not count');
const late = fresh();
const evening = Date.parse('2026-06-15T18:45:00Z'); // 20:45 on a June evening: light, but nearly curfew
const lr = startOuting(late, { place: 'doorstep' }, evening);
assert.ok(lr.ok && (Date.parse(late.where.homeAt) - evening) / MIN <= (CURFEW - 20.75) * 60 + 1, 'he is home before half past nine');
const bed = fresh();
startOuting(bed, { place: 'pond' }, noon);
const hurried = hurryHome(bed, noon + 5 * MIN);
assert.ok(bed.where === null && /bedtime/.test(hurried.did), 'at bedtime he is home, whatever happened');
const stale = fresh();
startOuting(stale, { place: 'pond' }, noon);
assert.equal(outingTick(stale, noon + 30 * 60 * 60 * MIN).home, true, 'a loop that stood still for a day does not leave him outside');
ok('he comes home: when tired, hungry, in rain or storm, before curfew, at bedtime, always');

// ---- the world opens up
const g = fresh({ world: { count: 1 } });
assert.deepEqual(checkUnlocks(g, noon), []);
g.street.people['Oma Jo'] = { warmth: 2.1 };
assert.match(checkUnlocks(g, noon)[0], /Oma Jo said I may come into her garden/);
assert.deepEqual(checkUnlocks(g, noon), [], 'he hears it once');
assert.ok(goOptions(g, noon).some((x) => x.key === 'garden'));
startOuting(g, { place: "Oma Jo's garden" }, noon);
const visit = outingTick(g, noon + 2 * 60 * MIN).outing;
assert.ok(visit.met === 'Oma Jo' && visit.gift && g.street.people['Oma Jo'].warmth > 2.4, JSON.stringify(visit));
assert.ok(g.garden.seeds.length + g.pantry.length >= 1, 'what she gives him is real');
assert.match(checkUnlocks(g, noon)[0], /there is a library.*library card.*ask Bas/);
assert.match(gearWish(g, tuesday + 3 * 24 * 60 * MIN), /library card/);
giveForAsk(g, 'a library card');
assert.match(checkUnlocks(g, tuesday)[0], /I have a library card now/);
assert.match(canGo(g, 'library', noon + 4 * 60 * MIN).why, /closed today/, 'not on a Monday');
assert.equal(canGo(g, 'library', tuesday).ok, true);
g.curious.interests = [{ topic: 'Lighthouse' }];
startOuting(g, { place: 'library' }, tuesday);
const read = outingTick(g, tuesday + 2 * 60 * MIN).outing;
assert.deepEqual([read.read, /book about lighthouse/.test(read.did)], ['Lighthouse', true]);
g.world.count = 4;
assert.match(checkUnlocks(g, tuesday)[0], /path that goes up the hill/);
assert.deepEqual(unlockedKeys(g), PLACES.map((p) => p.key));
ok('new places open by friendship, by going out, and by a library card he asks for');

// ---- he wants to go out, but not all the time
const keen = fresh({ body: { boredom: 6, curiosity: 5 } });
assert.ok(wantsOut(keen, noon) > 2, 'never been out: inviting');
startOuting(keen, { place: 'pond' }, noon);
outingTick(keen, noon + 2 * 60 * MIN);
assert.ok(wantsOut(keen, noon + 3 * 60 * MIN) < wantsOut(fresh({ body: { boredom: 6 } }), noon), 'just been: less so');
const live = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
delete live.recent; delete live.today; delete live.tired; delete live.resting; delete live.where;
Object.assign(live, { energy: 8, fullness: 8, weather: { kind: 'clear', temp: 8, cloud: 0.1 } });
tickBody(live);
const line = availableMoves(live, { now: noon, random: () => 0.99 }).find((m) => m.name === 'go_out')?.line ?? '';
assert.ok(line.length > 60 && line.length < 240 && /\{place, what\}$/.test(line), line);
ok('going out is one of his moves, with a short line that names where he can go');
{
  live.outings = [];
  for (const name of ['paint_wall', 'print_thing']) { // (the list offers only the most inviting moves: the test asks for this one)
    process.env.PIP_FAKE_MOVE = name;
    const m = availableMoves(live, { now: noon, random: () => 0.99 }).find((x) => x.name === name);
    assert.ok(m && m.line.length > 40 && m.line.length < 240, `${name}: ${m?.line}`);
    assert.ok(!availableMoves({ ...live, where: { place: 'pond' } }, { now: noon, random: () => 0.99 }).some((x) => x.name === name), `${name}: not while he is out`);
    assert.ok(!availableMoves(live, { now: noon + 10 * 60 * MIN, random: () => 0.99 }).some((x) => x.name === name), `${name}: not at night`);
  }
  delete process.env.PIP_FAKE_MOVE;
  const a = toAnswer({ moves: [{ move: 'paint_wall', details: { what: 'a giant fox', why: 'I want the street to see it', wall: 'the back wall of the bakery' }, thought: 'x' }, { move: 'print_thing', details: { what: 'a tiny lighthouse', why: 'for my shelf' }, thought: 'y' }], reason: 'r', mood: 'calm' }, ['paint_wall', 'print_thing']);
  assert.deepEqual(a.steps.map((st) => [st.action, st.as, st.make]), [['draw', 'paint_wall', true], ['decorate', 'print_thing', true]]);
  assert.equal(a.steps[0].details.wall, 'the back wall of the bakery');
  assert.equal(a.steps[1].details.print, true);
  ok('painting a wall and printing are moves of his own: a drawing and a small thing, made somewhere else');
}

// ---- places with a job: he designs something first, then goes there and it is made (the print workshop, the walls)
{
  const j = fresh();
  assert.ok(!goOptions(j, noon).some((o) => ['workshop', 'walls'].includes(o.key)), 'he does not just wander there');
  assert.notEqual(startOuting(fresh(), { place: 'the walls' }, noon).place, 'walls', 'without a design there is nothing to do at a wall');
  // a painting on a wall
  j.art = [{ id: 'artx1', name: 'giant fox', file: 'made/artx1.svg', aspect: 1.33, createdAt: iso(noon), wall: 'back_bakery' }];
  j.gallery = [{ id: 'artx1', name: 'giant fox', file: 'made/artx1.svg', aspect: 1.33, at: iso(noon), wall: 'back_bakery' }];
  const went = startOuting(j, { job: { place: 'walls', kind: 'paint', art: 'artx1', name: 'giant fox', wall: 'back_bakery', wallName: 'the back wall of the bakery', spot: 'paint_back_bakery', words: 'paint "giant fox" on the back wall of the bakery' } }, noon);
  assert.ok(went.ok && j.where.place === 'walls' && j.where.spot === 'paint_back_bakery' && j.where.job.art === 'artx1', JSON.stringify(went));
  assert.match(outingTick(j, noon + 15 * MIN).line, /I am at the walls: I paint "giant fox" on the back wall of the bakery/);
  const back = outingTick(j, Date.parse(j.where.homeAt) + MIN);
  assert.ok(back.home && /I painted "giant fox" on the back wall of the bakery/.test(back.outing.did) && back.outing.made.wall === 'back_bakery', back.outing.did);
  assert.equal(j.gallery[0].wall, 'back_bakery', 'it stays on that wall');
  assert.match(canGo(j, 'walls', noon + 3 * 60 * MIN).why ?? '', /already today/, 'one wall a day');
  // a print: it is on the shelf when he has been there, with its shapes
  const k = fresh();
  const parts = [{ shape: 'box', size: [0.2, 0.2, 0.2], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#c08040' }];
  assert.ok(startOuting(k, { job: { place: 'workshop', kind: 'print', name: 'tiny lighthouse', why: 'x', parts, words: 'print my tiny lighthouse' } }, noon).ok);
  assert.equal((k.prints ?? []).length, 0, 'not printed before he is there');
  const done = outingTick(k, Date.parse(k.where.homeAt) + MIN);
  assert.ok(done.home && /printer build my tiny lighthouse/.test(done.outing.did));
  assert.deepEqual(k.prints.map((x) => [x.name, x.parts.length]), [['tiny lighthouse', 1]]);
  assert.ok(Date.parse(k.prints[0].at) < Date.parse(done.outing.homeAt));
  assert.equal(startOuting(fresh(), { job: { place: 'workshop', kind: 'print', name: 'late thing', parts, words: 'print' } }, noon + 7 * 60 * MIN).ok, undefined, 'the workshop closes at six');
  // a storm before he gets to the wall: nothing is painted, the picture stays a drawing in his album
  const c = fresh();
  c.gallery = [{ id: 'arty', name: 'rain cat', file: 'made/arty.svg', aspect: 1, at: iso(noon), wall: 'wall_2' }];
  c.art = [{ ...c.gallery[0] }];
  startOuting(c, { job: { place: 'walls', kind: 'paint', art: 'arty', name: 'rain cat', wall: 'wall_2', wallName: 'the wall in the park', spot: 'paint_wall_2', words: 'paint' } }, noon);
  c.weather = { kind: 'storm', temp: 8 };
  let home = null;
  for (let t = noon + MIN; t < noon + 3 * 60 * MIN && !home; t += 4 * MIN) { const r = outingTick(c, t); if (r?.home) home = r.outing; }
  assert.ok(home && home.cut && !c.gallery[0].wall && !c.art[0].wall, JSON.stringify(home));
  ok('he walks to a wall with his design and paints it there, and to the print workshop to print; cut short, nothing is made');
}

// ---- the page
for (const o2 of [{}, { now: noon, where: 'pond', phase: 'there', unlocked: ['home', 'doorstep', 'shop', 'pond'], known: ['library'], weather: { kind: 'snow', temp: -2 } }, { now: noon + 11 * 60 * MIN, where: 'hill', phase: 'going', open: { pond: false } }, { where: 'garden', phase: 'back' }]) {
  const svg = worldMapSvg(o2);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>') && !/NaN|undefined/.test(svg), svg.match(/.{40}(NaN|undefined).{20}/)?.[0]);
  assert.equal((svg.match(/<g/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length);
  for (const p of PLACES.filter((x) => x.key !== 'doorstep')) assert.ok(svg.includes(`data-place="${p.key}"`));
}
assert.match(worldMapSvg({ unlocked: ['home', 'doorstep', 'shop', 'pond'], known: ['library'] }), /🔒 The library[\s\S]*>\?<\/text>/); // what he has not heard of is only a question mark
for (const p of PLACES) for (const weather of [{ kind: 'clear', temp: 12 }, { kind: 'rain', temp: 8 }, { kind: 'snow', temp: -4 }]) for (const at of [iso(noon), iso(noon + 6 * 60 * MIN), iso(Date.parse('2027-06-20T19:30:00Z'))]) {
  const svg = postcardSvg({ place: p.key, at, weather, found: [{ emoji: '🪶' }] });
  assert.ok(svg.includes('</svg>') && !/NaN|undefined/.test(svg), `${p.key} ${weather.kind}`);
}
assert.ok(openNow(placeOf('shop'), noon) && !openNow(placeOf('library'), noon) && openNow(placeOf('library'), tuesday));
ok('the page: where he is, the map, the places he knows, postcards for every place and weather');

// ---- the whole thing through pip.js (no model): he goes, nothing is thought while he is out, he comes home
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-out-'));
fs.cpSync(root, work, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) && !p.includes('node_modules') && !p.includes(`${path.sep}web${path.sep}archive`) && !p.includes(`${path.sep}web${path.sep}photos`) });
fs.mkdirSync(path.join(work, 'web/archive'), { recursive: true });
const file = path.join(work, 'web/state.json');
const st = JSON.parse(fs.readFileSync(file, 'utf8'));
const nowReal = Date.now();
const toNoon = Math.round((Date.parse(`${new Date(nowReal + 36 * 60 * MIN).toISOString().slice(0, 10)}T11:00:00Z`) - nowReal) / MIN); // the next noon that is at least a day away (so the day is fresh)
Object.assign(st, { energy: 8, fullness: 9, where: null, outings: [], weather: { at: iso(nowReal + (toNoon + 600) * MIN), kind: 'clear', code: 0, temp: 9, cloud: 0.1, wind: 0.2 } });
st.inbox = (st.inbox ?? []).map((m) => ({ ...m, read: true }));
st.memories = (st.memories ?? []).slice(-40); // room in his memory: when it is full the lightest memory goes, and this test is about the outing, not about forgetting
fs.writeFileSync(file, JSON.stringify(st));
const run = (shift, more = {}) => execFileSync('node', ['pip.js'], { cwd: work, encoding: 'utf8', env: { ...process.env, PIP_FAKE: '1', PIP_AWAKE: '1', PIP_NO_PHOTO: '1', PIP_NO_NEIGHBOURS: '1', PIP_NO_STORY: '1', PIP_CLOCK_SHIFT_MIN: String(toNoon + shift), ...more }, timeout: 120_000 });
const read1 = () => JSON.parse(fs.readFileSync(file, 'utf8'));
run(0, { PIP_FAKE_MOVE: 'go_out', PIP_FAKE_WHAT: 'the pond' });
const a = read1();
assert.equal(a.where?.place, 'pond', JSON.stringify(a.log.at(-1)));
assert.deepEqual([a.log.at(-1).action, a.log.at(-1).placeName], ['go_out', 'the pond in the park']);
const out1 = run(20);
const b = read1();
assert.match(out1, /🚶 I am at the pond in the park/);
assert.deepEqual([b.last.via, b.last.away.place, b.last.away.phase, b.log.length], ['outside', 'pond', 'there', a.log.length], 'while he is out nothing is thought and nothing is added to his day');
const out2 = run(90, { PIP_FAKE_MOVE: 'rest' });
const c = read1();
assert.match(out2, /🏠 home from the pond in the park/);
assert.equal(c.where, null);
const came = c.log.find((e) => e.action === 'came_home');
assert.ok(came && came.card.place === 'pond' && came.did.length > 20, JSON.stringify(came));
assert.equal(c.outings.length, 1);
assert.ok(c.memories.some((m) => /home again from the pond/.test(m.text)), 'he remembers it');
assert.equal(c.last.via === 'outside', false, 'and then he thinks again');
ok('through his real wake-up: out, quiet while he is away, home with a postcard, and on with his day');
