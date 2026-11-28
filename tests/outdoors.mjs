// Being outside, and not getting stuck inside: his own day for the daily limits (days.js), what he does when there is
// no model or nothing he planned can work (autopilot.js), the wish to go out that grows indoors, and the two places
// he can walk to by himself (his field, the green stone).
import assert from 'node:assert/strict';
import { isToday } from '../days.js';
import { dayLimits } from '../limits.js';
import { fallbackSteps } from '../autopilot.js';
import { startOuting, outingTick, wantsOut, hoursInside, outLines, goOptions, INSIDE_LONG_H } from '../world.js';
import { storeAway } from '../decor.js';
import { ensureIntentions, markIntentions } from '../intent.js';
import { KINDS, goalPrompt } from '../goals.js';
import { tiredLines } from '../loops.js';
import { TOWN_SPOTS, TOWN_FOR, ROUTES, townBlocked, TOWN_X } from '../web/town.js';

const ok = (name) => console.log(`ok  ${name}`);
delete process.env.PIP_NO_OUT;
const HOUR = 3_600_000, MIN = 60_000;
const at = (s) => Date.parse(s);
const iso = (ms) => new Date(ms).toISOString();
// (Dutch winter time is UTC+1)
const morning = at('2026-11-25T07:00:00Z'); // 08:00 in the Netherlands
const noon = at('2026-11-25T11:00:00Z'); // 12:00
const night = at('2026-11-25T22:30:00Z'); // 23:30
const fresh = (more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 6, loneliness: 5, body: { creativity: 6, boredom: 6 }, weather: { kind: 'clear', temp: 8 }, tools: [], pantry: [], decor: [], stored: [], log: [], outings: [], visitors: [], pictures: [], found: [], art: [], apps: [], wardrobe: [], moves: [], cookedAt: [], curious: { sparks: [], interests: [] }, ...more });

// ---- his own day: what he made yesterday does not count this morning
assert.equal(isToday('2026-11-24T12:26:00Z', morning), false, 'yesterday afternoon is not today');
assert.equal(isToday('2026-11-24T21:33:00Z', morning), false, 'late last night is not today when he wakes up');
assert.equal(isToday('2026-11-24T21:33:00Z', at('2026-11-24T23:30:00Z')), true, 'midnight does not hand him a fresh set');
assert.equal(isToday('2026-11-25T07:30:00Z', noon), true);
assert.equal(isToday(iso(noon + 2 * HOUR), noon), false, 'not something from the future');
assert.equal(isToday(noon - HOUR, noon), true, 'milliseconds work too');
{
  const made = ['2026-11-24T12:26:00Z', '2026-11-24T18:27:00Z', '2026-11-24T21:33:00Z'].map((t, i) => ({ id: `d${i}`, name: `thing ${i}`, createdAt: t, parts: [] }));
  const s = fresh({ decor: made });
  assert.equal(dayLimits(s, at('2026-11-24T21:40:00Z')).decorate.used, 3, 'that evening the three count');
  assert.equal(dayLimits(s, morning).decorate.used, 0, 'the next morning he can make things again');
}
ok('a day is his own day: three things made yesterday do not keep him from making one this morning');

// ---- no model, or nothing he planned can work: a quiet moment. He is never sent on a walk as a filler
{
  for (let i = 0; i < 30; i++) {
    const step = fallbackSteps(fresh(), [], noon)[0];
    assert.notEqual(step.action, 'go_out', 'a walk is always his own choice');
    assert.ok(['do', 'play_piano'].includes(step.action), JSON.stringify(step));
  }
  assert.ok(Array.from({ length: 40 }, () => fallbackSteps(fresh(), [], noon)[0]).some((x) => x.as === 'quiet'), 'quiet time is among it');
  assert.equal(fallbackSteps(fresh({ energy: 2.5 }), [], noon)[0].action, 'rest');
  assert.equal(fallbackSteps(fresh({ fullness: 3, pantry: [{ name: 'mint', qty: 1 }] }), [{ name: 'eat' }], noon)[0].action, 'eat', 'food still comes first');
  // he does not do the same quiet thing twice in a row
  const quiet = fresh({ log: [{ at: iso(night - 8 * MIN), action: 'do', what: 'sit by the window and watch the square' }] });
  for (let i = 0; i < 40; i++) assert.notEqual(fallbackSteps(quiet, [], night)[0].details.what, 'sit by the window and watch the square');
  // going out himself still works as before
  const s = fresh();
  assert.ok(startOuting(s, { place: 'the pond in the park', what: 'watch the ducks' }, noon).ok);
  const back = outingTick(s, Date.parse(s.where.homeAt) + MIN);
  assert.ok(back.home && back.outing.did.length > 20);
}
ok('with no model he has a quiet moment and never the same one twice in a row; a walk is only ever his own choice');

// ---- the wish to go out grows with every hour inside, and he hears it
{
  const s = fresh({ outings: [{ id: 'o1', place: 'pond', leftAt: iso(noon - 2 * HOUR), homeAt: iso(noon - HOUR) }] });
  assert.ok(Math.abs(hoursInside(s, noon) - 1) < 0.01);
  const soon = wantsOut(s, noon), later = wantsOut(s, noon + 5 * HOUR);
  assert.ok(later > soon + 1.4, `${soon} -> ${later}`);
  assert.ok(wantsOut(s, noon + 5 * HOUR) > 2.2, 'after an afternoon inside, going out beats working on a project');
  assert.deepEqual(outLines(s, noon), [], 'not when he has just been out');
  const line = outLines(s, noon + (INSIDE_LONG_H + 0.5) * HOUR)[0];
  assert.match(line, /I have been inside for \d+ hours.*go_out.*paint a wall.*shape my land.*still empty/);
  assert.match(outLines(fresh({ decor: [{ kind: 'outside', name: 'tower' }] }), noon)[0], /a whole day.*build more on it/);
  assert.deepEqual(outLines(fresh(), night), [], 'not at night');
  assert.deepEqual(outLines(fresh({ where: { place: 'pond' } }), noon), [], 'not while he is out');
  assert.match(tiredLines({ tired: { kind: 'make', until: iso(Date.now() + HOUR) } })[0], /I go outside/);
}
ok('every hour inside makes going out more inviting, and after three hours he hears that his legs want out');

// ---- two places he walks to by himself: his field and the green stone
{
  assert.ok(['field', 'stone'].every((k) => goOptions(fresh(), noon).some((o) => o.key === k)));
  for (const [place, what, re] of [['my field', 'pick a spot to build on', /walked all the way around my field.*It is empty.*paced out a spot/], ['my field', 'lie in the grass', /grass of my field|lay in my field/], ['the green stone', 'sit by it', /green stone/], ['the green stone', 'listen if it hums', /ear/]]) {
    const s = fresh({ boredom: 6 });
    const went = startOuting(s, { place, what }, noon);
    assert.ok(went.ok && ['field', 'stone'].includes(s.where.place), `${place}: ${JSON.stringify(went)}`);
    const back = outingTick(s, Date.parse(s.where.homeAt) + MIN);
    assert.ok(back.home && re.test(back.outing.did), back.outing.did);
    assert.ok(s.boredom < 6 && back.outing.saw, 'being outside takes the dullness off');
  }
  const built = fresh({ decor: [{ kind: 'outside', name: 'tower' }], land: [{ kind: 'hill', at: iso(noon - HOUR) }] });
  startOuting(built, { place: 'my field', what: 'walk around' }, noon);
  assert.match(outingTick(built, Date.parse(built.where.homeAt) + MIN).outing.did, /1 thing of mine and 1 hill or hole on it so far/);
  for (const key of ['field', 'stone']) { // he is seen there, and the way is free
    const [spot] = TOWN_FOR[key];
    const pts = ['door', ...ROUTES[key], spot].map((k) => TOWN_SPOTS[k]);
    assert.ok(pts.every(Boolean), key);
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4); for (let k = 0; k <= n; k++) assert.equal(townBlocked(TOWN_X + a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n, 0.2), false, `${key}: the way there is blocked between corner ${i - 1} and ${i}`); }
  }
}
ok('his field and the green stone are places he walks to by himself, and each has a free way to it');

// ---- putting a thing away that has things on it: they are taken off, it does not fail
{
  const decor = [{ id: 'shelf1', name: 'small wooden shelf', parts: [] }, { id: 'lamp1', name: 'desk lamp', base: 'shelf1', parts: [] }, { id: 'cup1', name: 'clay cup', base: 'shelf1#2', parts: [] }];
  const stored = [];
  const r = storeAway(decor, stored, 'small wooden shelf');
  assert.ok(!r.failed && r.stored === 'small wooden shelf', JSON.stringify(r));
  assert.deepEqual(r.tookOff, ['desk lamp', 'clay cup']);
  assert.deepEqual([decor.map((d) => d.name), stored.map((d) => d.name)], [['desk lamp', 'clay cup'], ['small wooden shelf']]);
  assert.equal(storeAway(decor, stored, 'desk lamp').tookOff, undefined);
}
ok('a thing with things on it can be put away: what stood on it is taken off first');

// ---- every day one of his goals takes him outside
{
  assert.ok(KINDS.includes('outside'));
  assert.match(goalPrompt({ soul: 'x', feelings: [], projects: [], skills: '', interests: [] }), /One of them takes me outside \(kind "outside"\)/);
  const s = fresh({ projects: [], interests: [] });
  ensureIntentions(s, noon);
  const out = s.intent.items.find((i) => i.cat === 'outside');
  assert.ok(out && /go outside/.test(out.text) && s.intent.items.length === 4);
  assert.deepEqual(markIntentions(s, [{ action: 'go_out', as: 'fetch_note', place: 'drops' }, { action: 'go_out', place: 'shop' }]), [], 'a quick errand is not a day outside');
  assert.deepEqual(markIntentions(s, [{ action: 'go_out', place: 'stone' }]).map((i) => i.cat), ['outside']);
  const t = fresh({ projects: [], interests: [] });
  ensureIntentions(t, noon);
  assert.deepEqual(markIntentions(t, [{ action: 'draw', as: 'paint_wall' }]).map((i) => i.cat).filter((c) => c === 'outside'), ['outside'], 'painting a wall counts as being outside');
}
ok('one goal a day is outside: a walk, a painting on a wall, or his land (an errand does not count)');
