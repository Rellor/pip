// A thing takes a few sittings (sittings.js), and his world moves (story.js): people in the village do things, and he
// sees it happen.
import assert from 'node:assert/strict';
delete process.env.PIP_ONE_SITTING; delete process.env.PIP_NO_OUT; delete process.env.PIP_ROOM_ENOUGH; delete process.env.PIP_MAKES_PER_DAY;
const { sittingsFor, startSittings, buildOn, unfinished, sittingLines } = await import('../sittings.js');
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

// ---- a small thing is built in one go; a big thing takes three days, one sitting a day
{
  assert.deepEqual([2, 5, 7, 8, 20].map(sittingsFor), [1, 1, 1, 3, 3]);
  const s = fresh();
  const lamp = thing('lamp', 5), clock = thing('clock', 9, { createdAt: iso(now) });
  assert.deepEqual([startSittings(lamp, now), startSittings(clock, now)], [1, 3]);
  assert.ok(lamp.stages === undefined && clock.stage === 1 && clock.stages === 3);
  s.decor.push(lamp, clock);
  assert.deepEqual(unfinished(s).map((d) => d.name), ['clock']);
  assert.equal(Boolean(byName('decorate').when(s, now)), true, 'a big thing in progress never stops him from starting something else');
  assert.equal(Boolean(byName('build_on').when(s, now + HOUR)), false, 'not twice on one day');
  assert.match(buildOn(s, 'clock', now + HOUR).failed, /today already.*takes days/);
  assert.match(sittingLines(s, now + HOUR)[0], /clock \(day 1 of 3 done\).*tomorrow I go on/);
  const day2 = now + DAY + HOUR;
  assert.equal(Boolean(byName('build_on').when(s, day2)), true);
  assert.match(byName('build_on').line(s, day2), /"clock": day 1 of 3 done/);
  assert.match(sittingLines(s, day2)[0], /I can go on with it today/);
  const a = toAnswer({ moves: [{ move: 'build_on', details: { name: 'clock' } }], reason: 'r', mood: 'calm' });
  assert.deepEqual([a.steps[0].action, a.steps[0].as, a.steps[0].details.what], ['do', 'build_on', 'go on building clock']);
  const b1 = buildOn(s, 'my clock', day2);
  assert.deepEqual([b1.thing.name, b1.stage, b1.stages, b1.done], ['clock', 2, 3, false]);
  assert.ok(clock.updatedAt, 'the page builds it again, with more of its parts');
  assert.match(buildOn(s, 'clock', day2 + HOUR).failed, /today already/);
  const b2 = buildOn(s, 'clock', day2 + DAY);
  assert.ok(b2.done && clock.finishedAt && unfinished(s).length === 0);
  assert.match(buildOn(s, 'x', day2 + 2 * DAY).failed, /nothing half built/);
}
ok('a small thing is built in one go; a big thing takes three days, and nothing else has to wait for it');

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
