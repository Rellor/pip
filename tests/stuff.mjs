// No clutter: a new thing for his room is rare (one a day at most), his room has enough at a certain number of things
// (then one comes in only when one went out), big things outside come every other day, and making a new thing is no
// longer the most inviting thing he can do.
import assert from 'node:assert/strict';
import { MAX_PER_DAY, ROOM_ENOUGH, MAX_OUTSIDE, OUTSIDE_EVERY_DAYS, roomThings, roomIsEnough, builtOutsideLately, makeDecor } from '../decor.js';
import { preflight, dayLimits } from '../limits.js';
import { byName, availableMoves } from '../moves.js';
import { goalPrompt } from '../goals.js';
import { ensureIntentions } from '../intent.js';

const ok = (name) => console.log(`ok  ${name}`);
delete process.env.PIP_NO_OUT;
const now = Date.parse('2026-11-27T11:00:00Z'); // noon in the Netherlands
const DAY = 86_400_000, HOUR = 3_600_000;
const iso = (ms) => new Date(ms).toISOString();
const part = [{ shape: 'box', size: [0.3, 0.3, 0.3], pos: [0, 0.15, 0], rot: [0, 0, 0], color: '#a67' }];
const thing = (i, more = {}) => ({ id: `d${i}`, name: `thing number ${i}`, parts: part, pos: [(i % 6) - 3, 0, Math.floor(i / 6) - 2], zone: 'floor', kind: 'floor', createdAt: iso(now - (5 + i) * DAY), uses: [{ label: 'look at it', text: 'x' }], ...more });
const fresh = (n, more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 4, body: { creativity: 6, curiosity: 5, boredom: 4, loneliness: 3, tidiness: 5, coziness: 6 }, decor: Array.from({ length: n }, (_, i) => thing(i)), stored: [], tools: [], pantry: [], garden: { plots: [], seeds: [] }, projects: [], log: [], studio: { songs: [] }, art: [], apps: [], wardrobe: [], pictures: [], found: [], moves: [], cookedAt: [], asks: [], outings: [{ id: 'o1', place: 'pond', leftAt: iso(now - 2 * HOUR), homeAt: iso(now - HOUR) }], today: { done: {} }, curious: { sparks: [], interests: [] }, ...more });

// ---- one new thing a day, and a room that has enough
assert.equal(MAX_PER_DAY, 1);
assert.ok(ROOM_ENOUGH >= 12 && ROOM_ENOUGH <= 24 && MAX_OUTSIDE <= 15);
{
  const few = fresh(5);
  assert.equal(roomIsEnough(few, now), null);
  assert.equal(dayLimits(few, now).decorate.max, 1);
  const made = makeDecor(few.decor, { name: 'round clay cup', parts: part }, now, now);
  assert.ok(made.entry, JSON.stringify(made).slice(0, 200));
  few.decor.push({ ...made.entry, createdAt: iso(now) });
  assert.match(makeDecor(few.decor, { name: 'second cup of the day', parts: part }, now + HOUR, now + HOUR).failed, /already made enough for today/);
  assert.ok(makeDecor(few.decor, { name: 'cup for tomorrow', parts: part }, now + 22 * HOUR, now + 22 * HOUR).entry, 'the next morning he may again');
}
{
  const full = fresh(ROOM_ENOUGH, { decor: [...Array.from({ length: ROOM_ENOUGH }, (_, i) => thing(i)), { id: 'p1', name: 'a photo', image: 'photos/p1.jpg' }, thing(90, { kind: 'outside', name: 'tower outside' })] });
  assert.equal(roomThings(full.decor).length, ROOM_ENOUGH, 'pictures and what stands outside are not things in his room');
  const why = roomIsEnough(full, now);
  assert.match(why, new RegExp(`my room has ${ROOM_ENOUGH} things and that is enough`));
  assert.match(why, /put a thing I do not use in my chest first/);
  assert.equal(Boolean(byName('decorate').when(full, now)), false, 'not offered');
  assert.match(preflight(full, [{ action: 'decorate', details: { what: 'a small stool' } }], now)[0].why, /that is enough/);
  assert.deepEqual(preflight(full, [{ action: 'decorate', details: { what: 'a tower', where: 'outside on my field' } }], now), [], 'building outside is another matter');
  // one out, one in
  full.stored.push({ id: 's1', name: 'old box', parts: part, storedAt: iso(now - HOUR) });
  assert.equal(roomIsEnough(full, now), null, 'he put one away today: room for one new thing');
  full.decor.push(thing(50, { createdAt: iso(now) }));
  assert.match(roomIsEnough(full, now), /that is enough/, 'and that was the one');
  assert.match(roomIsEnough({ ...full, stored: [{ id: 's0', name: 'put away last week', storedAt: iso(now - 6 * DAY) }] }, now), /that is enough/, 'what went into the chest long ago does not count');
}
ok('one new thing a day, and when his room has enough, one comes in only when one goes out');

// ---- outside: a big thing every other day
{
  const d = [thing(1, { kind: 'outside', name: 'giant clock', createdAt: iso(now - 20 * HOUR) })];
  assert.equal(builtOutsideLately(d, now), true);
  assert.equal(builtOutsideLately(d, now + (OUTSIDE_EVERY_DAYS * 24 - 19) * HOUR), false);
  assert.equal(builtOutsideLately([thing(1, { createdAt: iso(now - 20 * HOUR) })], now), false, 'a thing in his room is not outside');
  assert.equal(Boolean(byName('build_outside').when(fresh(3, { decor: d }), now)), false);
  assert.equal(Boolean(byName('build_outside').when(fresh(3), now)), true);
}
ok('a big thing outside every other day, not every day');

// ---- making a new thing is not what he reaches for first
{
  const s = fresh(ROOM_ENOUGH + 4);
  const offered = availableMoves(s, { now, random: () => 0.5 }).map((m) => m.name);
  assert.ok(!offered.includes('decorate'), offered.join(', '));
  const few = fresh(10);
  assert.ok(byName('use').score(s) > byName('use').score(few), 'with a lot of things, using them is more inviting');
  assert.ok(byName('change_thing').score(s) > byName('change_thing').score(few), 'and so is making one of them better');
  assert.ok(byName('decorate').score(fresh(2), now) > byName('decorate').score(few, now), 'a nearly empty room still wants a few things');
  assert.ok(byName('work_on_project').score(s) < byName('go_out').score(s, now + 6 * HOUR), 'after hours inside, going out beats working on a project');
  const hobby = fresh(10, { curious: { sparks: [], interests: [{ topic: 'graffiti', score: 6, own: true, moves: ['paint_wall'], practice: 0, since: iso(now - DAY), ideaAt: iso(now - DAY) }] } });
  const rank = (st) => availableMoves(st, { now, random: () => 0.5 }).findIndex((m) => m.name === 'paint_wall');
  assert.ok(rank(hobby) >= 0 && rank(hobby) <= rank(few), 'the move that does his hobby moves up');
}
ok('he is offered what he likes to do, not another small thing for his room');

// ---- his goals: a day does not need a new thing
assert.match(goalPrompt({ soul: 'x', feelings: [], projects: [], skills: '', interests: [] }), /Not every day needs a new thing\./);
{
  let make = 0;
  for (let i = 0; i < 30; i++) { const s = { projects: [], interests: [] }; ensureIntentions(s, now + i * DAY); if (s.intent.items.some((x) => x.cat === 'make')) make++; assert.ok(s.intent.items.some((x) => x.cat === 'outside')); }
  assert.ok(make >= 5 && make <= 15, `a goal to make something on ${make} of 30 days`);
}
ok('a goal to make something only now and then; a goal outside every day');
