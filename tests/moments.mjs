// The live feed (moments.js): small timed moments between his steps, written by plain code at every wake-up.
import assert from 'node:assert/strict';
import { momentsFor, addMoments, sleepMoments, wakeMoments, MOMENTS_KEPT } from '../moments.js';

const ok = (name) => console.log(`ok  ${name}`);
const MIN = 60_000;
const t0 = Date.parse('2026-11-27T10:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const fresh = (more = {}) => ({ weather: { kind: 'clear', temp: 8 }, moments: [], where: null, ...more });

// ---- one step at home: it starts, he thinks, he notices something, it ends; all inside the 8 minutes, in order
{
  const s = fresh();
  const list = momentsFor(s, [{ at: iso(t0), action: 'cook', dish: 'mint soup', thought: 'Soup. Green soup.' }], t0, 8 * MIN);
  assert.ok(list.length >= 4, JSON.stringify(list));
  assert.match(list[0].text, /Starts cooking mint soup/);
  assert.ok(list.some((m) => m.kind === 'think' && /Green soup/.test(m.text)) && list.some((m) => m.kind === 'notice') && list.some((m) => /food is ready/.test(m.text)));
  const times = list.map((m) => Date.parse(m.at));
  assert.ok(times.every((t, i) => t >= t0 && t <= t0 + 8 * MIN && (i === 0 || t >= times[i - 1])), 'in order, inside the wake-up');
  assert.ok(new Set(times.map((t) => Math.round(t / 20_000))).size >= 4, 'spread over the minutes, not all at once');
  assert.deepEqual(momentsFor(s, [{ at: iso(t0), action: 'cook', dish: 'mint soup', thought: 'Soup. Green soup.' }], t0, 8 * MIN), list, 'the same wake-up gives the same moments');
  assert.ok(list.every((m) => m.text.length <= 161 && m.icon && ['beat', 'think', 'notice'].includes(m.kind)));
}
ok('a step becomes a handful of moments, spread over the minutes until he wakes again');

// ---- a step in the village: he walks there first and walks back; a failed step says so and has no happy ending
{
  const s = fresh();
  const list = momentsFor(s, [{ at: iso(t0), action: 'read_book', topic: 'herons', thought: 'Birds with knees.' }], t0, 8 * MIN).map((m) => m.text);
  assert.match(list[0], /Walks to the library/);
  assert.match(list.at(-1), /Walks back home/);
  assert.ok(list.some((t) => /Opens a book about herons/.test(t)));
  const bad = momentsFor(s, [{ at: iso(t0), action: 'decorate', name: 'a shelf', failed: 'no wood' }], t0, 8 * MIN).map((m) => m.text);
  assert.ok(bad.some((t) => /did not work/.test(t)) && !bad.some((t) => /is done|Walks to/.test(t)), bad.join(' | '));
  // two steps in one wake-up: each gets its own part of the time
  const two = momentsFor(s, [{ at: iso(t0), action: 'water' }, { at: iso(t0 + 4 * MIN), action: 'eat', food: 'basil' }], t0, 8 * MIN);
  const eat = two.find((m) => /Eats basil/.test(m.text));
  assert.ok(eat && Date.parse(eat.at) >= t0 + 4 * MIN && two.findIndex((m) => /Waters/.test(m.text)) < two.indexOf(eat));
}
ok('work in the village starts with the walk there; what failed is told as failed');

// ---- a walk: the whole of it is written when he leaves, and it stays while he is out
{
  const s = fresh({ where: { place: 'pond', words: 'feed the ducks', leftAt: iso(t0), arriveAt: iso(t0 + 8 * MIN), leaveAt: iso(t0 + 40 * MIN), homeAt: iso(t0 + 48 * MIN) } });
  const made = addMoments(s, [{ at: iso(t0), action: 'go_out', place: 'pond' }], t0, 8 * MIN);
  const texts = made.map((m) => m.text);
  assert.match(texts[0], /Sets off for the pond/);
  assert.ok(texts.some((t) => /Arrives at the pond.*to feed the ducks/.test(t)) && texts.some((t) => /Starts walking home/.test(t)));
  assert.ok(made.filter((m) => m.kind === 'notice').length >= 3, 'he notices things on the way and there');
  assert.ok(s.moments.filter((m) => m.far).length >= 3, 'what lies past this wake-up is marked');
  // home early: the next wake-up drops what did not happen
  s.where = null;
  addMoments(s, [{ at: iso(t0 + 20 * MIN), action: 'came_home', placeName: 'the pond in the park' }, { at: iso(t0 + 20 * MIN + 2000), action: 'eat', food: 'mint' }], t0 + 20 * MIN + 1000, 8 * MIN);
  assert.ok(!s.moments.some((m) => /Starts walking home/.test(m.text)), 'the walk home that was planned for later is gone');
  assert.ok(s.moments.some((m) => /Comes home from the pond/.test(m.text)) && s.moments.some((m) => /Eats mint/.test(m.text)));
}
ok('a walk is written down whole when he leaves, and cut short when he comes home early');

// ---- private wake-ups tell nothing; the list stays small; night and morning
{
  const s = fresh();
  addMoments(s, [{ at: iso(t0), action: 'write_diary', thought: 'a secret from Bas' }], t0, 8 * MIN, { quiet: true });
  assert.ok(s.moments.length === 1 && !/secret/.test(JSON.stringify(s.moments)));
  for (let i = 1; i < 40; i++) addMoments(s, [{ at: iso(t0 + i * 8 * MIN), action: 'cook', dish: 'soup', thought: 'x' }], t0 + i * 8 * MIN, 8 * MIN);
  assert.ok(s.moments.length <= MOMENTS_KEPT);
  const recent = s.moments.filter((m) => m.kind === 'notice').slice(-8).map((m) => m.text);
  assert.equal(new Set(recent).size, recent.length, 'he does not notice the same thing twice in a row');
  const night = t0 + 12 * 60 * MIN;
  sleepMoments(s, night);
  const ahead = s.moments.filter((m) => Date.parse(m.at) > night);
  assert.ok(ahead.length >= 5 && s.moments.some((m) => /Turns off the light/.test(m.text)));
  wakeMoments(s, night + 3 * 60 * MIN);
  assert.ok(!s.moments.some((m) => Date.parse(m.at) > night + 3 * 60 * MIN) && /Wakes up/.test(s.moments.at(-1).text));
}
ok('a private wake-up tells nothing, the night has its own slow moments, and waking up ends them');
