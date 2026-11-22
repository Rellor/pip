// Not only making: pretending a project step makes it real, hunger comes first, and after hours of one kind of thing he wants something else.
import assert from 'node:assert/strict';
import { realProjectWork } from '../projects.js';
import { hungerFirst } from '../food.js';
import { tiredOf, tiredLines } from '../loops.js';
import { availableMoves } from '../moves.js';
import { kindOf } from '../body.js';
import fs from 'node:fs';
import { tickBody } from '../body.js';
const fresh = () => { const s = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8')); delete s.body; delete s.recent; delete s.today; delete s.plan; delete s.tired; tickBody(s); return s; };

const s = { projects: [{ title: 'Sculpt a tiny clay bird', status: 'working', steps: [{ text: 'Sketch the shape', done: true }, { text: 'Sculpt the body and wings', done: false }] }] };
const out = realProjectWork(s, [{ action: 'do', details: { what: 'Sculpt the body and wings of the tiny clay bird' } }, { action: 'do', details: { what: 'hum a little tune' } }]);
assert.deepEqual(out.map((x) => x.action), ['work_on_project', 'do']);
assert.equal(out[0].details.title, 'Sculpt a tiny clay bird');
console.log('ok  pretending to do a project step becomes the real step');

const h = { fullness: 1, pantry: [{ name: 'bread', kind: 'ingredient', qty: 2 }, { name: 'soup', kind: 'dish', qty: 1 }] };
assert.deepEqual(hungerFirst(h, [{ action: 'draw' }], [{ name: 'eat' }]).map((x) => [x.action, x.details?.food]), [['eat', 'soup'], ['draw', undefined]]);
assert.equal(hungerFirst({ ...h, fullness: 5 }, [{ action: 'draw' }], [{ name: 'eat' }]).length, 1);
console.log('ok  very hungry with food: he eats first');

const t = fresh();
const now = Date.now();
t.recent = { ...t.recent, moves: Array.from({ length: 8 }, (_, i) => ({ move: i % 2 ? 'decorate' : 'change_thing', kind: 'make', at: new Date(now - (8 - i) * 6e5).toISOString() })) };
assert.equal(tiredOf(t, now), 'make');
assert.ok(!availableMoves(t, { now }).some((m) => kindOf(m.name) === 'make'), 'no making for a while');
assert.match(tiredLines(t, now)[0], /something different/);
assert.equal(tiredOf(t, now + 2 * 3_600_000 + 1), 'make', 'still the same 8 moves: tired again');
t.recent.moves.push({ move: 'read_book', kind: 'learn' }, { move: 'water', kind: 'garden' }, { move: 'tell', kind: 'people' });
t.tired = null;
assert.equal(tiredOf(t, now), null, 'after other things, making is fine again');
console.log('ok  after hours of making, he wants something different for an hour');

import { noteChoice, choiceOf, dropRestingDo, restingMove } from '../loops.js';
const l = { recent: {} };
const doIt = { moves: [{ move: 'do', details: { what: 'Sculpt the body and wings' } }] };
for (let i = 0; i < 3; i++) noteChoice(l, choiceOf(doIt), false, 'it made nothing');
assert.equal(l.resting?.move, 'do');
assert.equal(restingMove(l), null, '"do" itself stays offered');
assert.deepEqual(dropRestingDo(l, [{ action: 'do', details: { what: 'Sculpt the body and wings' } }, { action: 'do', details: { what: 'hum' } }]).map((x) => x.details.what), ['hum']);
console.log('ok  the same pretend step 3 times: that one rests, other "do" steps are fine');
assert.equal(choiceOf({ moves: [{ move: 'decorate', details: { what: 'ceramic desk lamp' } }] }).key, choiceOf({ moves: [{ move: 'decorate', details: { what: 'ceramic base for the desk lamp' } }] }).key);
console.log('ok  making the same kind of thing under a new name is the same choice');
{
  const v = { recent: {} };
  const mv = { moves: [{ move: 'move_thing', details: { name: 'clay bird' } }] };
  const other = { moves: [{ move: 'play_piano', details: {} }] };
  noteChoice(v, choiceOf(mv), false); noteChoice(v, choiceOf(other), true); noteChoice(v, choiceOf(mv), false); noteChoice(v, choiceOf(other), true);
  const r = noteChoice(v, choiceOf(mv), false, 'the shelf is full');
  assert.equal(r?.move, 'move_thing', 'the same failure 3 times, with other moves in between, also rests');
  console.log('ok  the same thing failing 3 times with other moves in between: it rests too');
}
{
  const { workStep } = await import('../projects.js');
  const p = { title: 'Knit a small warm wool blanket', status: 'working', steps: [{ text: 'Knit a small warm wool blanket: a first version', done: false }], versions: [], notes: [], needs: [] };
  assert.equal(workStep({ projects: [p] }, p.title).action, 'decorate', 'a blanket is not clothes');
  console.log('ok  a knitted blanket is a thing for his room, not clothes');
}
{
  const { habitCap, habitLines } = await import('../growth.js');
  const now = Date.now();
  const h = { log: Array.from({ length: 5 }, (_, i) => ({ action: 'draw', at: new Date(now - (i + 1) * 600_000).toISOString() })) };
  assert.ok(habitCap(h, 'draw', now) < 6, 'the 6th drawing of the day gives less');
  assert.equal(habitCap(h, 'eat', now), 10, 'eating never wears off');
  assert.match(habitLines(h, ['draw', 'eat'], now)[0], /drawing \(5 times today\) did less for me than it used to/);
  console.log('ok  the more often today, the less it gives him, and he feels it');
}
