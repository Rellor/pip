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
