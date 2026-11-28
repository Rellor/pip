// Not a room full of small things. The game steers (this file); when his room is full, what he makes goes to his museum (tests/full.mjs). His urge to
// make (body.js: it grows by the hour and drops when he has made something) decides how inviting making is, a room with
// plenty of things pulls a little less, and using or improving what he has, his hobby and going out pull more.
import assert from 'node:assert/strict';
import { MAX_PER_DAY, MAX_OUTSIDE, ROOM_PLENTY, roomThings, roomHasPlenty } from '../decor.js';
import { preflight, dayLimits } from '../limits.js';
import { byName, availableMoves } from '../moves.js';
import { bodyText, noteMove, ensureBody } from '../body.js';
import { goalPrompt } from '../goals.js';
import { ensureIntentions } from '../intent.js';

const ok = (name) => console.log(`ok  ${name}`);
delete process.env.PIP_NO_OUT;
const now = Date.parse('2026-11-27T11:00:00Z'); // noon in the Netherlands
const DAY = 86_400_000, HOUR = 3_600_000;
const iso = (ms) => new Date(ms).toISOString();
const part = [{ shape: 'box', size: [0.3, 0.3, 0.3], pos: [0, 0.15, 0], rot: [0, 0, 0], color: '#a67' }];
const thing = (i, more = {}) => ({ id: `d${i}`, name: `thing number ${i}`, parts: part, pos: [(i % 6) - 3, 0, Math.floor(i / 6) - 2], zone: 'floor', kind: 'floor', createdAt: iso(now - (5 + i) * DAY), uses: [{ label: 'look at it', text: 'x' }], ...more });
const fresh = (n, urge = 5, more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 4, body: { creativity: urge, curiosity: 5, boredom: 4, loneliness: 3, tidiness: 5, coziness: 6 }, decor: Array.from({ length: n }, (_, i) => thing(i)), stored: [], tools: [], pantry: [], garden: { plots: [], seeds: [] }, projects: [], log: [], studio: { songs: [] }, art: [], apps: [], wardrobe: [], pictures: [], found: [], moves: [], cookedAt: [], asks: [], outings: [{ id: 'o1', place: 'pond', leftAt: iso(now - 2 * HOUR), homeAt: iso(now - HOUR) }], today: { done: {} }, curious: { sparks: [], interests: [] }, ...more });

// ---- his room: plenty is a nudge; full means the museum (tests/full.mjs)
{
  assert.equal(MAX_PER_DAY, 12);
  assert.equal(MAX_OUTSIDE, 40);
  const many = fresh(ROOM_PLENTY + 4, 8, { decor: [...Array.from({ length: ROOM_PLENTY + 4 }, (_, i) => thing(i)), { id: 'p1', name: 'a photo', image: 'photos/p1.jpg' }, thing(90, { kind: 'outside', name: 'tower outside' })] });
  assert.equal(roomThings(many.decor).length, ROOM_PLENTY + 4, 'pictures and what stands outside are not things in his room');
  assert.ok(roomHasPlenty(many.decor) && !roomHasPlenty(fresh(5).decor));
  assert.equal(Boolean(byName('decorate').when(many, now)), true, 'with plenty, but not full, he may still make a new thing');
  assert.deepEqual(preflight(many, [{ action: 'decorate', details: { what: 'a small stool' } }], now), []);
  assert.equal(dayLimits(many, now).decorate.max, 12);
  assert.equal(Boolean(byName('build_outside').when(fresh(3, 5, { decor: [thing(1, { kind: 'outside', createdAt: iso(now - 20 * HOUR) })] }), now)), true, 'and build outside the day after he built there');
}
ok('a room with plenty still takes a new thing; in a full room it goes to his museum (tests/full.mjs)');

// ---- his urge to make steers
{
  const calm = fresh(10, 1), keen = fresh(10, 9);
  for (const name of ['decorate', 'work_on_project', 'start_project', 'change_thing', 'build_outside']) assert.ok(byName(name).score(keen, now) > byName(name).score(calm, now) + 0.5, `${name}: the urge makes it more inviting`);
  assert.ok(byName('decorate').score(calm, now) < byName('read_book').score(calm), 'with the urge quiet, reading is more inviting than making');
  assert.ok(byName('decorate').score(calm, now) < byName('use').score(calm), 'and so is using what he has');
  assert.ok(byName('decorate').score(keen, now) > byName('read_book').score(keen), 'when his hands itch, making wins');
  // making something quiets the urge, so the next thing he feels like is something else
  const s = fresh(10, 8);
  ensureBody(s, now);
  const before = byName('decorate').score(s, now);
  noteMove(s, 'decorate', { now });
  assert.ok(s.body.creativity <= 4.5 && byName('decorate').score(s, now) < before - 1, `after making: urge ${s.body.creativity}`);
  assert.match(bodyText({ ...fresh(10, 1), energy: 6 }).join(' | '), /I have made enough for now: my hands are quiet, something else can have its turn/);
  assert.match(bodyText({ ...fresh(10, 9), energy: 6 }).join(' | '), /my hands itch to make something/);
}
ok('the urge to make steers: quiet right after making, pulling hours later');

// ---- a room with plenty: using and improving pull more, a new thing a little less
{
  const few = fresh(10, 6), many = fresh(ROOM_PLENTY + 4, 6);
  assert.ok(byName('use').score(many) > byName('use').score(few));
  assert.ok(byName('change_thing').score(many) > byName('change_thing').score(few));
  assert.ok(byName('decorate').score(many, now) < byName('decorate').score(few, now));
  assert.ok(byName('decorate').score(fresh(2, 6), now) > byName('decorate').score(few, now), 'a nearly empty room still wants a few things');
  assert.ok(byName('work_on_project').score(many) < byName('go_out').score(many, now + 6 * HOUR), 'after hours inside, going out beats working on a project');
  const hobby = fresh(10, 5, { curious: { sparks: [], interests: [{ topic: 'graffiti', score: 6, own: true, moves: ['paint_wall'], practice: 0, since: iso(now - DAY), ideaAt: iso(now - DAY) }] } });
  const rank = (st) => availableMoves(st, { now, random: () => 0.5 }).findIndex((m) => m.name === 'paint_wall');
  assert.ok(rank(hobby) >= 0 && rank(hobby) <= rank(few), 'the move that does his hobby moves up');
}
ok('with plenty of things he is nudged to use and improve them; his hobby moves up');

// ---- his goals: a day does not need a new thing
assert.match(goalPrompt({ soul: 'x', feelings: [], projects: [], skills: '', interests: [] }), /Not every day needs a new thing\./);
{
  let make = 0;
  for (let i = 0; i < 30; i++) { const s = { projects: [], interests: [] }; ensureIntentions(s, now + i * DAY); if (s.intent.items.some((x) => x.cat === 'make')) make++; assert.ok(s.intent.items.some((x) => x.cat === 'outside')); }
  assert.ok(make >= 5 && make <= 15, `a goal to make something on ${make} of 30 days`);
}
ok('a goal to make something only now and then; a goal outside every day');
