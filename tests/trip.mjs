// A longer plan and a trip outside: up to five moves, the rest waits in his queue; from one place he goes straight on
// to the next when the next step of his plan is outside too.
import assert from 'node:assert/strict';
delete process.env.PIP_NO_OUT;
const { MAX_PICK, toAnswer, brainPrompt } = await import('../brain.js');
const { decided, nextQueued, wakeReasons, nextOutside, ensurePlan, DECIDE_EVERY_MIN, PLAN_LASTS_MIN, TRIP_MAX } = await import('../autopilot.js');
const { startOuting, outingTick, goOn, wantsOut } = await import('../world.js');
const { momentsFor } = await import('../moments.js');

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-27T10:00:00Z'); // 11:00 in the Netherlands
const MIN = 60_000, HOUR = 60 * MIN;
const iso = (ms) => new Date(ms).toISOString();
const fresh = (more = {}) => ({ energy: 9, fullness: 9, joy: 5, calm: 5, wonder: 5, boredom: 5, loneliness: 5, body: { boredom: 5, loneliness: 5, creativity: 5, curiosity: 5 }, weather: { kind: 'clear', temp: 8 }, outings: [], log: [], decor: [], museum: [], curious: { sparks: [], interests: [] }, ...more });

// ---- five moves: the first now, the rest in his queue, and the queue is not thrown away after half an hour
{
  assert.equal(MAX_PICK, 5);
  const a = toAnswer({ moves: [{ move: 'go_out', details: { place: 'the square' } }, { move: 'go_out', details: { place: 'the pond in the park' } }, { move: 'go_out', details: { place: 'my museum' } }, { move: 'play_piano', details: { notes: 'C4 E4' } }, { move: 'write_diary', details: { text: 'x' } }, { move: 'rest', details: {} }], reason: 'a whole trip', mood: 'calm' });
  assert.equal(a.steps.length, 5, 'at most five');
  const s = fresh();
  const first = decided(s, a.steps, now);
  assert.deepEqual([first.length, first[0].action, s.plan.queue.length], [1, 'go_out', 4]);
  assert.equal(nextOutside(s).details.place, 'the pond in the park');
  s.plan.seen = null;
  assert.deepEqual(wakeReasons(s, { now: now + (DECIDE_EVERY_MIN + 15) * MIN }), [], 'with steps left he carries on with his plan');
  assert.ok(wakeReasons(s, { now: now + (PLAN_LASTS_MIN + 1) * MIN }).some((r) => /minutes passed/.test(r)), 'but not for ever');
  nextQueued(s); nextQueued(s);
  assert.equal(nextOutside(s), null, 'the next step is at home: he goes home first');
  s.plan.queue = [];
  assert.ok(wakeReasons(s, { now: now + (DECIDE_EVERY_MIN + 1) * MIN }).length > 0);
  assert.match(brainPrompt({ soul: 'x', now: 'noon', doing: [], events: [], moves: [{ name: 'do', line: 'x' }], feelings: [], memories: [], projects: [], goals: [], room: [], fresh: [], lessons: [], messages: [], skills: '' }), /1 to 5 moves.*wait in my queue.*whole trip.*do not have to come home in between/s);
}
ok('he may plan five moves: one now, four in his queue, and the plan is kept while steps are left');

// ---- from one place straight on to the next
{
  const s = fresh();
  ensurePlan(s);
  s.plan.queue = [{ action: 'go_out', details: { place: 'my museum', what: 'walk past my things' } }, { action: 'rest', details: {} }];
  assert.ok(startOuting(s, { place: 'the pond in the park', what: 'watch the ducks' }, now).ok);
  assert.equal(goOn(s, now + 5 * MIN), null, 'not while he is still on his way');
  assert.equal(goOn(s, Date.parse(s.where.leaveAt) - MIN), null, 'not while he is still there');
  const leave = Date.parse(s.where.leaveAt);
  const o = goOn(s, leave + MIN);
  assert.ok(o.wentOn && o.place === 'pond' && /duck/i.test(o.did) && s.where === null && s.onTheWay.from === 'pond');
  const went = startOuting(s, nextQueued(s)[0].details, leave + MIN);
  assert.ok(went.ok && s.where.place === 'museum' && s.where.from === 'pond' && s.where.trip === 2);
  const walk = (Date.parse(s.where.arriveAt) - Date.parse(s.where.leftAt)) / MIN;
  assert.ok(walk >= 2 && walk <= 4, `from the pond to the museum next to it is a short walk: ${walk} min`);
  assert.equal(nextOutside(s), null);
  const back = outingTick(s, Date.parse(s.where.homeAt) + MIN);
  assert.ok(back.home && back.outing.place === 'museum', 'after the last place he walks home');
  assert.equal(s.outings.length, 2);
  assert.equal(TRIP_MAX, 3);
  // an errand to the shop, or a walk cut short, is not a point to go on from
  const t = fresh();
  startOuting(t, { errand: 'bread' }, now);
  assert.equal(goOn(t, Date.parse(t.where.leaveAt) + 1000), null);
  // the live feed says he went on
  assert.match(momentsFor({ moments: [] }, [{ at: iso(now), action: 'came_home', placeName: 'the pond in the park', on: true }], now, 8 * MIN)[0].text, /Goes straight on from the pond in the park/);
}
ok('his time at a place is over and the next step is outside: he goes straight on, with a short walk between the two');

// ---- the pull outside grows faster than it did
{
  const s = fresh({ outings: [{ id: 'o1', place: 'pond', leftAt: iso(now - 4 * HOUR), homeAt: iso(now - 3 * HOUR) }] });
  assert.ok(wantsOut(s, now) > 2.7, `three hours inside: ${wantsOut(s, now)}`);
}
ok('after three hours inside, going out is the most inviting thing there is');
