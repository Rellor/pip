// The notice board: no orders, no coins. It shows what people in the village are up to, and reading it may give him an
// idea. A note is never a task.
import assert from 'node:assert/strict';
import { DOINGS, MAX_BOARD, NOTE_DAYS, postNote, boardNotes, readBoard, boardCalls, boardLines } from '../board.js';
import { byName } from '../moves.js';
import { keepWishes } from '../neighbours.js';
import { CHANGES } from '../changes.js';

const ok = (name) => console.log(`ok  ${name}`);
delete process.env.PIP_NO_OUT;
const HOUR = 3_600_000;
const t0 = Date.parse('2026-11-27T09:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

// ---- notes come a few at a time, all different, and come down by themselves
{
  const s = { curious: { sparks: [], interests: [] } };
  assert.ok(DOINGS.length >= 30 && new Set(DOINGS.map(([key]) => key)).size === DOINGS.length);
  assert.ok(DOINGS.every(([, thing, hobby, text]) => hobby && text.length > 20 && text.length < 160 && !/coin|wanted:|reward/i.test(text) && (thing === null || /^(a|an|three) /.test(thing))), 'a note is something people do, never an order');
  const first = postNote(s, t0);
  assert.ok(first && !first.seen && first.text);
  assert.equal(postNote(s, t0 + HOUR), null, 'not a new note every hour');
  for (let h = 7; h < 60; h += 7) postNote(s, t0 + h * HOUR);
  assert.equal(boardNotes(s, t0 + 60 * HOUR).length, MAX_BOARD, 'never more than three hang there');
  assert.equal(new Set(s.board.map((n) => n.key)).size, s.board.length, 'no two notes about the same thing');
  assert.deepEqual(boardNotes(s, t0 + (60 + NOTE_DAYS * 24 + 1) * HOUR), [], 'a note comes down after a few days');
}
ok('notes are pinned a few at a time, all different, and come down by themselves');

// ---- reading it gives him an idea, and never a task or a coin
{
  const s = { curious: { sparks: [], interests: [] }, coins: 2, energy: 8, fullness: 8, outings: [], weather: { kind: 'clear', temp: 8 }, log: [], decor: [], wishes: [] };
  s.board = [{ id: 'b1', key: 'kite', thing: 'a kite', hobby: 'flying kites', text: 'Kite day on the field this week. Bring one, or make one. Wind is promised.', at: iso(t0), seen: false }];
  assert.equal(boardCalls(s, t0 + HOUR), true);
  assert.deepEqual(boardLines(s, t0 + HOUR), [], 'he only knows what hangs there when he has read it');
  assert.match(byName('check_board').line(s, t0 + HOUR), /what people in the village are up to \(there is something new on it\)\. Nobody asks me for anything/);
  const read = readBoard(s, t0 + HOUR);
  assert.match(read, /Kite day on the field.*Nobody asks me for anything/);
  assert.ok(s.board[0].seen && s.curious.sparks.some((x) => x.topic === 'flying kites' && x.from === 'board'), 'what he read can catch him');
  const line = boardLines(s, t0 + 2 * HOUR)[0];
  assert.match(line, /Kite day.*Nobody asks me for anything.*build a kite myself and say how I use it \(make_plaything\).*wants list.*flying kites as a hobby \(start_hobby\)/);
  assert.match(readBoard(s, t0 + 3 * HOUR), /Nothing new/);
  s.decor.push({ id: 'k', name: 'kite', parts: [] });
  assert.deepEqual(keepWishes(s, [{ at: iso(t0 + 4 * HOUR), action: 'decorate', name: 'kite' }], t0 + 4 * HOUR), [], 'making it pays nothing');
  assert.equal(s.coins, 2);
}
ok('reading the board gives him an idea he may take or leave; nothing is asked and nothing is paid');

// ---- the one-time change takes the old orders down
{
  const s = { wishes: [{ id: 'w1', board: true, topic: 'a model lighthouse', status: 'open', reward: 3 }, { id: 'w2', board: true, topic: 'a fruit bowl', status: 'kept', reward: 3 }], board: [{ id: 'x' }] };
  const said = CHANGES.find((c) => c.id === '2026-11-28 nobody orders anything').run(s, iso(t0));
  assert.deepEqual(s.wishes.map((w) => w.status), ['gone', 'kept']);
  assert.deepEqual(s.board, []);
  assert.match(said, /Nobody asks me to make things for coins any more/);
}
ok('the orders come down from the board');
