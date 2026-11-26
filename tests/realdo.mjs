// A free "do" that is really one of his real moves is done for real (loops.js), and a note on the notice board is
// only done by the thing it asks for (neighbours.js).
import assert from 'node:assert/strict';
import { realDo, tuneFor } from '../loops.js';
import { keepWishes } from '../neighbours.js';

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-26T18:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const st = (what, more = {}) => ({ action: 'do', details: { what }, thought: 'x', ...more });
const has = ['voice', 'guitar', 'flute'];
const one = (what, opts = { has }) => realDo([st(what)], opts)[0];

// ---- playing an instrument he has
const flute = one('play a quiet song on my flute');
assert.deepEqual([flute.action, flute.details.instrument, flute.details.style, flute.thought], ['play_piano', 'flute', 'quiet', 'x']);
assert.match(flute.details.notes, /^([A-G][3-5](:2)? ?){8}$/, flute.details.notes);
assert.ok(flute.details.notes.split(' ').every((n) => /[34]/.test(n)), 'a quiet tune sits low');
assert.equal(one('Play my new silver flute to try the sound').details.instrument, 'flute');
assert.equal(one('strum something noisy on the old guitar').details.instrument, 'guitar');
assert.equal(one('strum something noisy on the old guitar').details.style, undefined);
assert.equal(one('hum a little').details.instrument, 'voice');
assert.equal(tuneFor('play a quiet song on my flute'), tuneFor('play a quiet song on my flute'), 'the same words, the same tune');
assert.notEqual(tuneFor('play a quiet song on my flute'), tuneFor('strum something noisy'));
// not what he cannot do, and not what is something else
assert.equal(one('play the violin').action, 'do', 'he has no violin');
assert.equal(one('play with a ball').action, 'do');
assert.equal(one('say hello to my plants through the glass').action, 'do');
assert.equal(one('look at my flute').action, 'do', 'looking is not playing');
assert.equal(one('play a quiet song on my flute', { has, canPlay: false }).action, 'do', 'not when the move is not his to choose now');
assert.equal(realDo([st('plan the steps of my project', { as: 'plan_project' })], { has })[0].as, 'plan_project', 'a "do" that stands for something else is left alone');
assert.equal(realDo([st('play a quiet song on my flute', { fallback: true })], { has })[0].action, 'do');
ok('"play a quiet song on my flute" as a free do really plays the flute');

// ---- going out
const out = one('walk to the pond and sit');
assert.deepEqual([out.action, out.details.place], ['go_out', 'walk to the pond and sit']);
assert.equal(one('go outside for a bit').action, 'go_out');
assert.equal(one('walk three slow rounds through my room').action, 'do', 'a walk in his room is not going out');
assert.equal(one('walk to the pond and sit', { has, canGo: false }).action, 'do');
ok('"walk to the pond" as a free do really goes out');

// ---- a note on the board is done by the thing itself, not by a thing that only talks about it
{
  const board = () => ({ coins: 0, log: [], wishes: [{ id: 'b1', board: true, from: 'the notice board', topic: 'a drawing of a cat', text: 'Wanted: a drawing of a cat. 2 coins.', medium: ['draw'], at: iso(now - 3_600_000), reward: 2, status: 'open', said: false }] });
  const s = board();
  const shelf = { at: iso(now), action: 'draw', name: 'plain wooden shelf', why: 'Someone wants a cat on the notice board, but I drew enough animals. I made a plain wooden shelf instead.' };
  assert.deepEqual(keepWishes(s, [shelf], now), [], 'a shelf is not a cat, whatever he says about it');
  assert.ok(s.wishes[0].status === 'open' && s.coins === 0);
  const cat = { at: iso(now), action: 'draw', name: 'fat cat on a windowsill', why: 'for the notice board' };
  const lines = keepWishes(s, [cat], now);
  assert.ok(lines.length === 1 && /I made a drawing of a cat, as the note on the notice board asked/.test(lines[0]) && s.wishes[0].status === 'kept' && s.wishes[0].with === 'fat cat on a windowsill' && s.coins >= 2, JSON.stringify([lines, s.wishes[0]]));
}
ok('the note for a cat is done by a drawing of a cat, not by a shelf with a story');
