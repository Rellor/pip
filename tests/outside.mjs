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
const fresh = (more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 5, loneliness: 5, weather: { kind: 'clear', temp: 8, cloud: 0.2, wind: 0.2 }, tools: [], pantry: [], wardrobe: [], decor: [], garden: { seeds: [], plots: [] }, curious: { sparks: [], interests: [] }, log: [], ...more });
const iso = (ms) => new Date(ms).toISOString();

// ---- the places
assert.deepEqual(PLACES.map((p) => p.key), ['home', 'doorstep', 'shop', 'pond', 'library', 'field', 'stone', 'board', 'workshop', 'walls', 'drops', 'land']);
assert.ok(PLACES.length <= 12, 'a small world: a handful of places besides home');
for (const p of PLACES.filter((x) => x.key !== 'home' && !x.errand && !x.job)) assert.ok(p.things.length >= 1 && p.stay && p.blurb && p.walk > 0, p.key);
for (const p of PLACES.filter((x) => x.job)) assert.ok(!p.things && p.stay && p.blurb && p.walk > 0 && !p.locked, `${p.key}: a place he only goes to with something to make there`);
assert.equal(findPlace('the pond')?.key, 'pond');
assert.equal(findPlace('the park, to see the ducks')?.key, 'pond');
assert.equal(findPlace("Oma Jo's garden"), null, 'the garden is gone');
assert.equal(findPlace('the grocery store')?.key, 'shop');
assert.equal(findPlace('my doorstep')?.key, 'doorstep');
assert.equal(findPlace('the moon'), null);
assert.equal(hisWords('pond', 'sketch what I see'), 'sketch what he sees');
assert.deepEqual(placeOf('doorstep').things.map((t) => t.key), ['watch'], 'on his doorstep he watches the square: there is nobody to wait for');
ok('a small world of named places; he can say a place in his own words');

// ---- where he may go: anywhere, any time (there are no opening hours, no locked places, no weather rules, no limits)
const s = fresh();
assert.deepEqual(unlockedKeys(s), PLACES.map((p) => p.key), 'every place is open to him');
assert.deepEqual(goOptions(s, noon).map((o) => o.key).sort(), ['doorstep', 'field', 'library', 'pond', 'stone']);
assert.ok(goLine(s, noon).length <= 170, goLine(s, noon));
for (const [who, t] of [[fresh(), noon + 10 * 60 * MIN], [fresh({ energy: 2 }), noon], [fresh({ fullness: 2 }), noon], [fresh({ weather: { kind: 'storm', temp: -4 } }), noon + 7 * 60 * MIN], [fresh({ weather: { kind: 'rain', temp: 9 } }), noon]]) {
  for (const p of PLACES.filter((x) => x.key !== 'home')) assert.equal(canGo(who, p.key, t).ok, true, p.key);
}
assert.equal(gearWish(fresh({ weather: { kind: 'rain', temp: 9 } }), noon), null, 'he needs nothing special to go out');
assert.match(canGo({ ...fresh(), where: { place: 'pond' } }, 'library', noon).why, /out already/);
const cold = fresh({ weather: { kind: 'clear', temp: -3 } });
assert.ok(goOptions(cold, noon).find((o) => o.key === 'pond').words.includes('slide on the ice'), 'the pond freezes in real frost');
assert.equal(buy(fresh({ coins: 9 }), 'umbrella', noon + 10 * 60 * MIN).bought, 'umbrella', 'the corner shop is always open');
ok('he can go anywhere, at any hour, in any weather: he wants to, so he can');

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

// ---- nobody he sees outside has a name: his five neighbours moved away, and he meets none of them at the pond, on his doorstep or at a wall
{
  const FIVE = /\b(Mo|Lina|Oma Jo|Dot|Kees)\b/;
  const told = new Set();
  const trips = [...['ducks', 'find', 'sketch', 'ice'].map((thing) => ['pond', thing]), ['doorstep', 'watch'], ['doorstep', 'chat'], ['walls', null], ['library', 'read'], ['board', null]];
  for (let seed = 0; seed < 60; seed++) for (const [place, thing] of trips) for (const weather of [{ kind: 'clear', temp: 8 }, { kind: 'rain', temp: 9 }, { kind: 'clear', temp: -3 }]) {
    const t = noon + seed * 37 * MIN; // other minutes: other dice, other hours of the day
    const x = fresh({ weather, wishes: [], pantry: seed % 2 ? [{ name: 'bread', qty: 2 }] : [], street: { people: { Mo: { warmth: 9 }, Dot: { warmth: 9 }, Lina: { warmth: 9 }, 'Oma Jo': { warmth: 9 }, Kees: { warmth: 9 } } } }); // however fond they once were
    const went = startOuting(x, place === 'walls' ? { job: { place: 'walls', kind: 'paint', art: 'a1', name: 'giant fox', wall: 'wall_2', wallName: 'the wall in the park', words: 'paint "giant fox" on the wall in the park' } } : place === 'board' ? { job: { place: 'board', words: 'read the notice board' } } : { place, what: thing }, t);
    assert.ok(went.ok, `${place} ${thing}: ${went.failed}`);
    if (thing) x.where.thing = thing; // (also the old "chat" of an outing that was under way when they left)
    const o = outingTick(x, Date.parse(x.where.homeAt) + MIN).outing;
    assert.ok(o.did.length > 20 && !FIVE.test(`${o.did} ${o.saw} ${homeLine(o)}`) && !/neighbou?r/i.test(o.did), `${place} ${thing}: ${o.did}`);
    assert.equal(o.met, null, `${place} ${thing}: he meets nobody with a name`);
    assert.ok(x.curious.sparks.every((sp) => !FIVE.test(`${sp.topic} ${sp.text}`)));
    assert.deepEqual(Object.values(x.street.people).map((p) => p.warmth), [9, 9, 9, 9, 9], 'and no friendship is counted any more');
    told.add(o.did);
  }
  assert.ok(told.size >= 20, `the outings still turn out in many ways (${told.size})`);
  assert.ok([...told].some((d) => /sat on my doorstep/.test(d)) && [...told].some((d) => /I painted "giant fox" on the wall in the park/.test(d)) && [...told].some((d) => /ducks/.test(d)));
  ok('at the pond, on his doorstep and at the walls nobody is named, over many outings');
}

// ---- he always comes home
assert.equal(canGo(s, 'pond', noon + 3 * 60 * MIN).ok, true, 'the same place again the same day');
assert.equal(canGo(s, 'doorstep', noon + 70 * MIN).ok, true, 'and right after he came home');
startOuting(s, { place: 'doorstep' }, noon + 3 * 60 * MIN);
outingTick(s, noon + 4 * 60 * MIN);
assert.ok(goOptions(s, noon + 6 * 60 * MIN).length >= 3, 'there is no limit to how often he goes out in a day');
for (const [why, change] of [['very tired', { energy: 1.5 }], ['very hungry', { fullness: 1.5 }]]) {
  const x = fresh();
  startOuting(x, { place: 'pond' }, noon);
  Object.assign(x, change);
  const t = outingTick(x, noon + 15 * MIN);
  assert.equal(t.phase, 'back', why);
  assert.match(t.line, new RegExp(why));
  assert.ok(Date.parse(x.where.homeAt) <= noon + 24 * MIN, `${why}: he is home within the walk back`);
  assert.match(outingTick(x, noon + 30 * MIN).outing.did, /went home early/);
}
for (const weather of [{ kind: 'storm', temp: 9 }, { kind: 'rain', temp: 9 }]) { const x = fresh(); startOuting(x, { place: 'pond' }, noon); x.weather = weather; assert.equal(outingTick(x, noon + 15 * MIN).phase, 'there', `${weather.kind} does not send him home`); }
const turned = fresh();
startOuting(turned, { place: 'pond' }, noon);
turned.energy = 1.5;
outingTick(turned, noon + 3 * MIN);
assert.match(outingTick(turned, noon + 7 * MIN).outing.did, /on my way to the pond.*turned around/);
assert.equal(turned.world?.count ?? 0, 0, 'an outing he turned back from does not count');
const late = fresh();
const evening = Date.parse('2026-06-15T18:45:00Z'); // 20:45 on a June evening: light, but nearly curfew
const lr = startOuting(late, { place: 'doorstep' }, evening);
assert.ok(lr.ok && (Date.parse(late.where.homeAt) - evening) / MIN <= (CURFEW - 20.75) * 60 + 1, 'he is home before bedtime');
const bed = fresh();
startOuting(bed, { place: 'pond' }, noon);
const hurried = hurryHome(bed, noon + 5 * MIN);
assert.ok(bed.where === null && /bedtime/.test(hurried.did), 'at bedtime he is home, whatever happened');
const stale = fresh();
startOuting(stale, { place: 'pond' }, noon);
assert.equal(outingTick(stale, noon + 30 * 60 * 60 * MIN).home, true, 'a loop that stood still for a day does not leave him outside');
ok('he comes home: when very tired or hungry, at bedtime, always');

// ---- every place is his from the start
const g = fresh({ world: { count: 1 } });
assert.deepEqual(checkUnlocks(g, noon), [], 'nothing has to be unlocked');
assert.ok(!goOptions(g, noon).some((x) => x.key === 'garden' || x.key === 'hill'), 'the garden and the hill are gone');
assert.match(canGo(g, 'hill', noon).why, /not a place/);
{ const old = fresh({ where: { id: 'o1', place: 'hill', leftAt: iso(noon), arriveAt: iso(noon + 14 * MIN), leaveAt: iso(noon + 40 * MIN), homeAt: iso(noon + 54 * MIN) } }); assert.equal(outingTick(old, noon + 5 * MIN), null, 'he was on his way to a place that is gone: he is simply home'); assert.equal(old.where, null); }
assert.equal(placeOf('garden')?.title, 'Oma Jo’s garden', 'the page can still show his old outings there');
g.curious.interests = [{ topic: 'Lighthouse' }];
assert.ok(startOuting(g, { place: 'library' }, noon + 3 * 60 * MIN).ok, 'the library, on a Monday, without a card');
const read = outingTick(g, noon + 6 * 60 * MIN).outing;
assert.deepEqual([read.read, /book about lighthouse/.test(read.did)], ['Lighthouse', true]);
ok('the library is open to him from the first day; the garden and the hill are gone');

// ---- he wants to go out, but not all the time
const keen = fresh({ body: { boredom: 6, curiosity: 5 } });
assert.ok(wantsOut(keen, noon) > 2, 'never been out: inviting');
startOuting(keen, { place: 'pond' }, noon);
outingTick(keen, noon + 2 * 60 * MIN);
assert.ok(wantsOut(keen, noon + 3 * 60 * MIN) < wantsOut(fresh({ body: { boredom: 6 } }), noon), 'just been: less so');
const live = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
delete live.recent; delete live.today; delete live.tired; delete live.resting; delete live.where;
Object.assign(live, { energy: 8, fullness: 8, outings: [], weather: { kind: 'clear', temp: 8, cloud: 0.1 } }); // (his real outings of today would keep him in at the hour this test asks about)
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
    assert.ok(availableMoves(live, { now: noon + 10 * 60 * MIN, random: () => 0.99 }).some((x) => x.name === name), `${name}: at any hour he is awake`);
  }
  delete process.env.PIP_FAKE_MOVE;
  const a = toAnswer({ moves: [{ move: 'paint_wall', details: { what: 'a giant fox', why: 'I want the street to see it', wall: 'the back wall of the library' }, thought: 'x' }, { move: 'print_thing', details: { what: 'a tiny lighthouse', why: 'for my shelf' }, thought: 'y' }], reason: 'r', mood: 'calm' }, ['paint_wall', 'print_thing']);
  assert.deepEqual(a.steps.map((st) => [st.action, st.as, st.make]), [['draw', 'paint_wall', true], ['decorate', 'print_thing', true]]);
  assert.equal(a.steps[0].details.wall, 'the back wall of the library');
  assert.equal(a.steps[1].details.print, true);
  ok('painting a wall and printing are moves of his own: a drawing and a small thing, made somewhere else');
}

// ---- places with a job: he designs something first, then goes there and it is made (the print workshop, the walls)
{
  const j = fresh();
  assert.ok(!goOptions(j, noon).some((o) => ['workshop', 'walls'].includes(o.key)), 'he does not just wander there');
  assert.notEqual(startOuting(fresh(), { place: 'the walls' }, noon).place, 'walls', 'without a design there is nothing to do at a wall');
  // a painting on a wall
  j.art = [{ id: 'artx1', name: 'giant fox', file: 'made/artx1.svg', aspect: 1.33, createdAt: iso(noon), wall: 'back_library' }];
  j.gallery = [{ id: 'artx1', name: 'giant fox', file: 'made/artx1.svg', aspect: 1.33, at: iso(noon), wall: 'back_library' }];
  const went = startOuting(j, { job: { place: 'walls', kind: 'paint', art: 'artx1', name: 'giant fox', wall: 'back_library', wallName: 'the back wall of the library', spot: 'paint_back_library', words: 'paint "giant fox" on the back wall of the library' } }, noon);
  assert.ok(went.ok && j.where.place === 'walls' && j.where.spot === 'paint_back_library' && j.where.job.art === 'artx1', JSON.stringify(went));
  assert.match(outingTick(j, noon + 15 * MIN).line, /I am at the walls: I paint "giant fox" on the back wall of the library/);
  const back = outingTick(j, Date.parse(j.where.homeAt) + MIN);
  assert.ok(back.home && /I painted "giant fox" on the back wall of the library/.test(back.outing.did) && back.outing.made.wall === 'back_library', back.outing.did);
  assert.equal(j.gallery[0].wall, 'back_library', 'it stays on that wall');
  assert.equal(canGo(j, 'walls', noon + 3 * 60 * MIN).ok, true, 'and he can go and paint again');
  // a print: it is on the shelf when he has been there, with its shapes
  const k = fresh();
  const parts = [{ shape: 'box', size: [0.2, 0.2, 0.2], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#c08040' }];
  assert.ok(startOuting(k, { job: { place: 'workshop', kind: 'print', name: 'tiny lighthouse', why: 'x', parts, words: 'print my tiny lighthouse' } }, noon).ok);
  assert.equal((k.prints ?? []).length, 0, 'not printed before he is there');
  const done = outingTick(k, Date.parse(k.where.homeAt) + MIN);
  assert.ok(done.home && /printer build my tiny lighthouse/.test(done.outing.did));
  assert.deepEqual(k.prints.map((x) => [x.name, x.parts.length]), [['tiny lighthouse', 1]]);
  assert.ok(Date.parse(k.prints[0].at) < Date.parse(done.outing.homeAt));
  assert.equal(startOuting(fresh(), { job: { place: 'workshop', kind: 'print', name: 'late thing', parts, words: 'print' } }, noon + 7 * 60 * MIN).ok, true, 'the workshop is open in the evening too');
  // he gets too tired before he reaches the wall: nothing is painted, the picture stays a drawing in his album
  const c = fresh();
  c.gallery = [{ id: 'arty', name: 'rain cat', file: 'made/arty.svg', aspect: 1, at: iso(noon), wall: 'wall_2' }];
  c.art = [{ ...c.gallery[0] }];
  startOuting(c, { job: { place: 'walls', kind: 'paint', art: 'arty', name: 'rain cat', wall: 'wall_2', wallName: 'the wall in the park', spot: 'paint_wall_2', words: 'paint' } }, noon);
  c.energy = 1.5;
  let home = null;
  for (let t = noon + MIN; t < noon + 3 * 60 * MIN && !home; t += 4 * MIN) { const r = outingTick(c, t); if (r?.home) home = r.outing; }
  assert.ok(home && home.cut && !c.gallery[0].wall && !c.art[0].wall, JSON.stringify(home));
  ok('he walks to a wall with his design and paints it there, and to the print workshop to print; cut short, nothing is made');
}

// ---- the page
for (const o2 of [{}, { now: noon, where: 'pond', phase: 'there', unlocked: ['home', 'doorstep', 'shop', 'pond'], known: ['library'], weather: { kind: 'snow', temp: -2 } }, { now: noon + 11 * 60 * MIN, where: 'library', phase: 'going', open: { pond: false } }, { where: 'pond', phase: 'back' }]) {
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
assert.ok(openNow(placeOf('shop'), noon) && openNow(placeOf('library'), noon) && openNow(placeOf('library'), noon + 12 * 60 * MIN));
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
const run = (shift, more = {}) => execFileSync('node', ['pip.js'], { cwd: work, encoding: 'utf8', env: { ...process.env, PIP_FAKE: '1', PIP_AWAKE: '1', PIP_NO_PHOTO: '1', PIP_NO_STORY: '1', PIP_CLOCK_SHIFT_MIN: String(toNoon + shift), ...more }, timeout: 120_000 });
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
const came = c.log.findLast((e) => e.action === 'came_home'); // (the newest: the saved day this test starts from may hold older ones)
assert.ok(came && came.card.place === 'pond' && came.did.length > 20, JSON.stringify(came));
assert.equal(c.outings.length, 1);
assert.ok(c.memories.some((m) => /home again from the pond/.test(m.text)), 'he remembers it');
assert.equal(c.last.via === 'outside', false, 'and then he thinks again');
ok('through his real wake-up: out, quiet while he is away, home with a postcard, and on with his day');
