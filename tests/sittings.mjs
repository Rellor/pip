// A thing takes a few sittings (sittings.js), and his world moves (story.js): people in the village do things, and he
// sees it happen.
import assert from 'node:assert/strict';
delete process.env.PIP_ONE_SITTING; delete process.env.PIP_NO_OUT; delete process.env.PIP_ROOM_ENOUGH; delete process.env.PIP_MAKES_PER_DAY;
const { sittingsFor, startSittings, buildOn, unfinished, sittingLines, IN_PROGRESS_MAX } = await import('../sittings.js');
const { byName } = await import('../moves.js');
const { toAnswer } = await import('../brain.js');
const { storyTick, SMALL_PER_DAY } = await import('../story.js');
const { hobbyMoves } = await import('../curiosity.js');
const { ensureBody } = await import('../body.js');

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-25T11:00:00Z'); // a Wednesday, noon in the Netherlands
const HOUR = 3_600_000, DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();
const part = (y) => ({ shape: 'box', size: [0.3, 0.1, 0.3], pos: [0, y, 0], rot: [0, 0, 0], color: '#a67' });
const thing = (name, n, more = {}) => ({ id: `d${name}`, name, parts: Array.from({ length: n }, (_, i) => part(i * 0.1)), kind: 'floor', createdAt: iso(now - DAY), ...more });
const fresh = (more = {}) => { const s = { energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 4, loneliness: 4, weather: { kind: 'clear', temp: 8 }, tools: [], pantry: [], decor: [], stored: [], log: [], outings: [], visitors: [], pictures: [], found: [], art: [], apps: [], wardrobe: [], moves: [], cookedAt: [], asks: [], projects: [], wishes: [], curious: { sparks: [], interests: [] }, ...more }; ensureBody(s, now); s.body.creativity = 7; return s; };

// ---- a thing takes two or three sittings, and at most two are in progress
{
  assert.deepEqual([2, 3, 4, 6, 7, 20].map(sittingsFor), [1, 1, 2, 2, 3, 3]);
  const s = fresh();
  const lamp = thing('lamp', 3), shelf = thing('shelf', 5), clock = thing('clock', 9);
  assert.deepEqual([startSittings(lamp), startSittings(shelf), startSittings(clock)], [1, 2, 3]);
  assert.ok(lamp.stages === undefined && shelf.stage === 1 && clock.stages === 3);
  s.decor.push(lamp, shelf);
  assert.deepEqual(unfinished(s).map((d) => d.name), ['shelf']);
  assert.equal(Boolean(byName('decorate').when(s, now)), true, 'one thing in progress: he may start another');
  assert.match(byName('build_on').line(s, now), /"shelf": sitting 1 of 2 done/);
  assert.match(sittingLines(s)[0], /Half built in my room: shelf \(sitting 1 of 2 done\)\. I can go on with it/);
  s.decor.push(clock);
  assert.equal(unfinished(s).length, IN_PROGRESS_MAX);
  assert.equal(Boolean(byName('decorate').when(s, now)), false, 'two things in progress: first he finishes one');
  assert.match(sittingLines(s)[0], /Two things in progress is enough: I finish one/);
  assert.ok(byName('build_on').score(s, now) > byName('change_thing').score(s, now), 'finishing what he started pulls');
  const a = toAnswer({ moves: [{ move: 'build_on', details: { name: 'clock' } }], reason: 'r', mood: 'calm' });
  assert.deepEqual([a.steps[0].action, a.steps[0].as, a.steps[0].details.what], ['do', 'build_on', 'go on building clock']);
  const b1 = buildOn(s, 'my clock', now);
  assert.deepEqual([b1.thing.name, b1.stage, b1.stages, b1.done], ['clock', 2, 3, false]);
  assert.ok(clock.updatedAt, 'the page builds it again, with more of its parts');
  const b2 = buildOn(s, 'clock', now);
  assert.ok(b2.done && clock.finishedAt && unfinished(s).length === 1);
  assert.equal(Boolean(byName('decorate').when(s, now)), true);
  assert.equal(buildOn(s, 'something else', now).thing.name, 'shelf', 'no name that fits: he goes on with what is there');
  assert.match(buildOn(s, 'x', now).failed, /nothing half built/);
  assert.equal(Boolean(byName('build_on').when(s, now)), false);
}
ok('a thing is built over two or three sittings; with two in progress he finishes one first');

// ---- his world moves: a handful of small things a day, many of them people doing something
{
  const s = fresh({ last: {} });
  const seen = [];
  for (let d = 0; d < 6; d++) for (let h = 0; h < 14; h++) { const t = now - 4 * HOUR + d * DAY + h * HOUR; for (const ev of storyTick(s, t)) seen.push({ day: d, key: ev.key, text: ev.text }); }
  const perDay = [0, 1, 2, 3, 4, 5].map((d) => seen.filter((e) => e.day === d).length);
  assert.ok(perDay.every((n) => n >= 3 && n <= SMALL_PER_DAY + 1), `per day: ${perDay}`);
  assert.ok(new Set(seen.map((e) => e.key)).size >= 12, 'many different things happen in a week');
  const doing = seen.filter((e) => /bike|plane|ball|boat|skateboard|juggler|chess|runner|easel|stilts|balloon|drums|fishing rod|hopscotch|telescope|kite/.test(e.text));
  assert.ok(doing.length >= 6, `people do things: ${doing.length} of ${seen.length}`);
  assert.ok(s.curious.sparks.length > 0, 'what he sees can catch him');
  for (const topic of ['Cycling', 'Model aircraft', 'Skateboarding', 'Juggling', 'Chess', 'Fishing', 'Stilts', 'Hot air balloon']) assert.ok(hobbyMoves(topic).includes('play'), `${topic}: something he could do himself`);
}
ok('something small happens in the village every few hours, and much of it is people doing things he could do too');
