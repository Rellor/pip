// Things that can never work are stopped early, and do not come back all day: one more of a kind he has enough of
// (decor.js), the breaker for a whole day (loops.js), goals he lets go (intent.js), and the one-time change that
// frees him from the fourth shelf.
import assert from 'node:assert/strict';
import { enoughOf, fullKinds, wantsOneMore, kindsWord, makeDecor, MAX_SAME } from '../decor.js';
import { noteFailures, offToday, offLines, FAIL_OFF } from '../loops.js';
import { letGoGoals, intentionsText, markIntentions } from '../intent.js';
import { goalPrompt } from '../goals.js';
import { CHANGES } from '../changes.js';

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-26T10:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const thing = (name, i) => ({ id: `d${i}`, name, parts: [{ shape: 'box', size: [0.2, 0.2, 0.2], pos: [0, 0.1, 0], rot: [0, 0, 0], color: '#a67' }], pos: [i, 0, 0], createdAt: iso(now - 5 * 86_400_000) });
const shelves = ['small wooden shelf', 'tiny wooden shelf for my bird', 'small clumsy shelf for the corner'].map(thing);

// ---- three of a kind is enough, and that is known before anything is designed
assert.equal(MAX_SAME, 3);
assert.equal(enoughOf(shelves.slice(0, 2), 'plain wooden shelf'), null);
const full = enoughOf(shelves, 'plain wooden wall shelf');
assert.ok(full && full.kind === 'shelf' && full.n === 3 && /I already have 3 things that are a shelf .*That is enough of those/.test(full.why), JSON.stringify(full));
assert.equal(enoughOf(shelves, 'round clay cup'), null);
assert.equal(makeDecor(shelves, { name: 'plain wooden shelf', parts: shelves[0].parts }, now, now).failed, full.why.replace('plain wooden wall shelf', 'plain wooden shelf'), 'the same words as when it is made');
assert.deepEqual(fullKinds(shelves), [{ kind: 'shelf', n: 3 }]);
assert.deepEqual(fullKinds([...shelves, thing('clay cup', 9), { id: 'p', name: 'photo shelf', image: 'x.jpg' }]), [{ kind: 'shelf', n: 3 }], 'pictures do not count');
assert.deepEqual(['shelf', 'box', 'lamp', 'body', 'bench'].map(kindsWord), ['shelves', 'boxes', 'lamps', 'bodies', 'benches']);
assert.equal(wantsOneMore(shelves, 'Build a plain wooden shelf')?.kind, 'shelf');
assert.equal(wantsOneMore(shelves, 'Make a plain wooden shelf so my room feels less bare.')?.kind, 'shelf');
assert.equal(wantsOneMore(shelves, 'Tidy my shelves'), null, 'only making one more');
assert.equal(wantsOneMore(shelves, 'Build a small boat'), null);
assert.equal(wantsOneMore(shelves.slice(0, 2), 'Build a plain wooden shelf'), null);
ok('three of a kind is enough: known from the name alone, for a thing, a goal and a project');

// ---- the breaker for a whole day: the same thing failed three times, so it is off until tomorrow
{
  const s = { log: [] };
  const fail = (name, at) => ({ at: iso(at), action: 'decorate', name, failed: 'I already have 3 things that are a shelf' });
  assert.deepEqual(noteFailures(s, [fail('plain wooden shelf', now)], now), []);
  assert.deepEqual(noteFailures(s, [fail('plain wooden wall shelf', now + 1), { at: iso(now), action: 'do', what: 'stomp around', fallback: true, failed: null }], now), [], 'two is not three');
  assert.equal(offToday(s, { action: 'decorate', details: { what: 'another shelf' } }, now), null);
  const off = noteFailures(s, [fail('simple pine shelf', now + 2)], now);
  assert.ok(off.length === 1 && off[0].key === 'decorate:shelf' && off[0].move === 'decorate', JSON.stringify(off));
  assert.equal(FAIL_OFF, 3);
  assert.ok(offToday(s, { action: 'decorate', details: { what: 'a nice oak shelf' } }, now), 'a new name for the same idea does not get around it');
  assert.equal(offToday(s, { action: 'decorate', details: { what: 'a paper kite' } }, now), null, 'other things are still fine');
  assert.equal(offToday(s, { action: 'draw', details: { name: 'shelf' } }, now), null, 'and so are other moves');
  assert.match(offLines(s, now)[0], /did not work 3 times today.*until tomorrow.*decorate "simple pine shelf"/);
  assert.deepEqual(noteFailures(s, [fail('one more shelf', now + 3)], now), [], 'told once');
  const tomorrow = now + 20 * 3_600_000;
  assert.equal(offToday(s, { action: 'decorate', details: { what: 'a nice oak shelf' } }, tomorrow), null, 'a new day, a new chance');
  assert.deepEqual(offLines(s, tomorrow), []);
  // a move that fails without a thing it is about, and the needs, never go off
  const t = { log: [] };
  for (let i = 0; i < 4; i++) noteFailures(t, [{ at: iso(now), action: 'eat', food: 'bread', failed: 'no bread' }, { at: iso(now), action: 'rest', failed: 'x' }], now);
  assert.deepEqual(t.recent.off, []);
  // the lamp he keeps moving to a full desk
  const u = { log: [] };
  for (let i = 0; i < 3; i++) noteFailures(u, [{ at: iso(now), action: 'move_thing', name: 'ceramic desk lamp base', failed: 'there was no room left on the desk, so it stays where it was' }], now);
  assert.ok(offToday(u, { action: 'move_thing', details: { name: 'ceramic desk lamp base' } }, now));
}
ok('what failed three times in one day is off until tomorrow, whatever he calls it');

// ---- a goal that cannot work is let go, and he sets no such goal
{
  const s = { intent: { day: '2026-11-26', streak: 2, items: [{ cat: 'tend', text: 'Cook something big.', done: true }, { cat: 'make', text: 'Make a plain wooden shelf so my room feels less bare.', done: false }, { cat: 'music', text: 'Play a quiet song.', done: false }] } };
  const gone = letGoGoals(s, (t) => /\bshel(f|ves)\b/i.test(t), 'I have enough shelves');
  assert.ok(gone.length === 1 && s.intent.items[1].gone === 'I have enough shelves' && !s.intent.items[2].gone);
  assert.match(intentionsText(s), /- \[-\] Make a plain wooden shelf.*\(I let this one go: I have enough shelves\)/);
  assert.deepEqual(markIntentions(s, [{ action: 'decorate', name: 'cup' }]), [], 'a goal he let go is not ticked later');
  assert.match(goalPrompt({ soul: 'x', feelings: [], projects: [], skills: '', interests: [], enough: '3 shelves' }), /I have enough of these in my room, so no goal to make one more of them: 3 shelves\./);
  assert.doesNotMatch(goalPrompt({ soul: 'x', feelings: [], projects: [], skills: '', interests: [] }), /enough of these/);
}
ok('a goal for one more shelf is let go, and the morning goals know what he has enough of');

// ---- the one-time change: the project for a fourth shelf is let go
{
  const change = CHANGES.find((c) => c.id === '2026-11-26 no fourth shelf');
  const s = { decor: shelves, projects: [{ title: 'Build a plain wooden shelf', status: 'working', steps: [] }, { title: 'Build a little simulation of night sky', status: 'working', steps: [] }], intent: { items: [{ cat: 'make', text: 'Make a plain wooden shelf so my room feels less bare.', done: false }] }, resting: { move: 'work_on_project', why: 'decorate: I already have 3 things that are a shelf. That is enough of those' } };
  const note = change.run(s, iso(now));
  assert.match(note, /one more of something I have enough of: "Build a plain wooden shelf" \(I have 3 shelves\)/);
  assert.deepEqual(s.projects.map((p) => p.status), ['dropped', 'working']);
  assert.ok(s.projects[0].droppedWhy === 'I have enough shelves already' && s.intent.items[0].gone && s.resting === null);
  assert.equal(change.run({ decor: shelves.slice(0, 1), projects: [{ title: 'Build a plain wooden shelf', status: 'working' }] }, iso(now)), null, 'nothing to let go: no memory');
}
ok('the one-time change lets the fourth shelf go');
