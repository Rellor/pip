// The plan Bas and Pip agreed on, checked piece by piece: he decides his own day, quiet time is real, his pace follows
// his mood. (More pieces of the plan are checked in the tests of their own parts.)
import assert from 'node:assert/strict';
delete process.env.PIP_NO_OUT;
const { byName } = await import('../moves.js');
const { toAnswer } = await import('../brain.js');
const { paceMin, PACE } = await import('../pace.js');
const { kindOf, ensureBody } = await import('../body.js');

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-27T11:00:00Z');
const fresh = (more = {}) => { const s = { energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 4, loneliness: 4, emo: { excited: 0 }, decor: [], stored: [], log: [], outings: [], curious: { sparks: [], interests: [] }, ...more }; ensureBody(s, now); return s; };

// ---- quiet time is a real move of its own
{
  const s = fresh();
  assert.equal(Boolean(byName('quiet').when(s, now)), true);
  assert.equal(kindOf('quiet'), 'quiet');
  const a = toAnswer({ moves: [{ move: 'quiet', details: { where: 'by the window', what: 'watch the rain run down the glass' } }], reason: 'r', mood: 'calm' });
  assert.deepEqual([a.steps[0].action, a.steps[0].as, a.steps[0].details.what], ['do', 'quiet', 'watch the rain run down the glass']);
  assert.ok(byName('quiet').score(fresh({ calm: 3, energy: 4 }), now) > byName('quiet').score(s, now) + 1, 'restless and tired: quiet pulls more');
  const just = fresh(); just.recent.moves = [{ move: 'quiet', kind: 'quiet' }];
  assert.ok(byName('quiet').score(just, now) < byName('quiet').score(s, now), 'not one quiet moment after the other');
}
ok('quiet time is a real move: it pulls when he is restless or tired, and not twice in a row');

// ---- his pace follows his mood
{
  assert.equal(paceMin(fresh()), PACE.steady);
  assert.equal(paceMin(fresh({ emo: { excited: 6 } })), PACE.quick, 'excited: he thinks again sooner');
  assert.equal(paceMin(fresh({ plan: { queue: [{ action: 'go_out' }] } })), PACE.quick, 'in the middle of a plan too');
  assert.equal(paceMin(fresh({ energy: 2 })), PACE.slow, 'tired: later');
  const q = fresh(); q.recent.moves = [{ move: 'quiet', kind: 'quiet' }];
  assert.equal(paceMin(q), PACE.slow, 'after a quiet moment: later');
  assert.ok(PACE.quick < PACE.steady && PACE.steady < PACE.slow);
  assert.equal(paceMin(fresh(), 16), 16, 'a slower loop slows all of it');
}
ok('his pace follows his mood: sooner when excited or mid-plan, later when tired or quiet');

// ---- no money, easy food, a nap anywhere
{
  const { buy, canTake, shopLine } = await import('../shop.js');
  const { fallbackSteps } = await import('../autopilot.js');
  const { startOuting, outingTick } = await import('../world.js');
  const { passTime } = await import('../feelings.js');
  const { CHANGES } = await import('../changes.js');
  const s = fresh({ pantry: [], tools: [], garden: { seeds: [], beds: [] }, weather: { kind: 'clear', temp: 8 } });
  assert.equal(Boolean(byName('buy').when(s, now)), true, 'no coins needed to go to the store');
  assert.match(byName('buy').line(s, now), /nothing costs anything/);
  assert.ok(buy(s, 'bread', now).bought && canTake(s, now) && !/coin/.test(JSON.stringify(s)));
  // hungry with an empty house: he fetches food (a need, not a filler)
  const hungry = fresh({ fullness: 3, pantry: [] });
  assert.deepEqual([fallbackSteps(hungry, [{ name: 'buy' }], now)[0].action, fallbackSteps(hungry, [{ name: 'buy' }], now)[0].details.item], ['buy', 'bread']);
  assert.ok(byName('buy').score(hungry, now) > 3.5, 'and with a model he chooses it himself');
  // a full belly lasts most of a day
  const t = fresh({ fullness: 9, feelAt: new Date(now - 6 * 3_600_000).toISOString() });
  passTime(t, now);
  assert.ok(t.fullness > 4.5, `six hours later: ${t.fullness}`);
  // a nap outside gives him his energy back
  const n = fresh({ energy: 4, weather: { kind: 'clear', temp: 8 } });
  assert.ok(startOuting(n, { place: 'the pond in the park', what: 'take a nap on the bench' }, now).ok);
  assert.equal(n.where.thing, 'nap');
  const back = outingTick(n, Date.parse(n.where.homeAt) + 60_000);
  assert.ok(back.home && /nap|slept/i.test(back.outing.did) && n.energy >= 6.5, `${back.outing.did} (${n.energy})`);
  // the one-time change takes the coins away
  const old = fresh({ coins: 13, bought: [{ item: 'clay', price: 3, at: new Date(now).toISOString() }] });
  const said = CHANGES.find((c) => c.id === '2026-11-28 no money, and my house is my workshop').run(old, new Date(now).toISOString());
  assert.ok(old.coins === undefined && old.bought[0].price === undefined);
  assert.match(said, /Money is gone from my world.*My house is my workshop now.*rest anywhere/s);
}
ok('no money: he takes what he needs at the store, a full belly lasts, and he can nap anywhere');
