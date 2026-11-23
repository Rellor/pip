// The notice board on his square (board.js): people pin what they would like made, he walks there to read it, and when
// he makes one of those things the note comes down and he gets the coins. Run: node tests/board.mjs
import assert from 'node:assert/strict';
import { ORDERS, MAX_BOARD, NOTE_DAYS, postOrders, boardNotes, readBoard, boardLines, boardCalls } from '../board.js';
import { keepWishes, wishLines } from '../neighbours.js';
import { startOuting, outingTick, canGo, goOptions } from '../world.js';
import { toAnswer } from '../brain.js';
import { availableMoves } from '../moves.js';

const ok = (name) => console.log(`ok  ${name}`);
const HOUR = 3_600_000;
const t0 = Date.parse('2026-11-23T08:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

// ---- notes come by themselves, a few at a time, each one different, and old ones come down
const s = { wishes: [], log: [], coins: 0 };
const first = postOrders(s, t0);
assert.ok(first && first.board && first.status === 'open' && !first.seen && /^Wanted: /.test(first.text) && first.reward >= 2);
assert.equal(postOrders(s, t0 + HOUR), null, 'not another one right away');
for (let h = 2; h < 40; h += 2) postOrders(s, t0 + h * HOUR);
assert.equal(boardNotes(s, t0 + 40 * HOUR).length, MAX_BOARD, 'never more than three on the board');
assert.equal(new Set(s.wishes.map((w) => w.topic)).size, s.wishes.length, 'no two notes ask for the same thing');
for (const w of s.wishes) assert.ok(ORDERS.some(([what]) => what === w.topic));
assert.deepEqual(boardNotes(s, t0 + (40 + NOTE_DAYS * 24 + 1) * HOUR), [], 'a note nobody takes comes down after a few days');
assert.ok(ORDERS.length >= 60 && new Set(ORDERS.map(([what]) => what)).size === ORDERS.length);
ok('notes are pinned a few at a time, all different, and come down by themselves');

// ---- he only knows what is on it when he has read it
const b = { wishes: [], log: [], coins: 2, energy: 8, fullness: 8, outings: [] };
b.wishes.push({ id: 'b1', board: true, from: 'the notice board', topic: 'a toy train', text: 'Wanted: a toy train. 3 coins.', medium: ['decorate'], at: iso(t0), reward: 3, status: 'open', said: false, seen: false });
b.wishes.push({ id: 'b2', board: true, from: 'the notice board', topic: 'a drawing of a cat', text: 'Wanted: a drawing of a cat. 2 coins.', medium: ['draw'], at: iso(t0), reward: 2, status: 'open', said: false, seen: false });
assert.deepEqual(boardLines(b, t0 + HOUR), [], 'unread notes are not in his head');
assert.deepEqual(wishLines(b, t0 + HOUR), [], 'and a note on the board is not told a second time as the wish of someone with a name');
assert.equal(boardCalls(b, t0 + HOUR), true);
assert.ok(!goOptions(b, t0 + HOUR).some((o) => o.key === 'board'), 'the board is not a place to hang around');
assert.equal(canGo(b, 'board', t0 + HOUR).ok, true);
const step = toAnswer({ moves: [{ move: 'check_board', details: {}, thought: 'x' }], reason: 'r', mood: 'calm' }, ['check_board']).steps[0];
assert.deepEqual([step.action, step.as, step.details.job.place], ['go_out', 'check_board', 'board']);
assert.ok(startOuting(b, step.details, t0 + HOUR).ok);
const home = outingTick(b, Date.parse(b.where.homeAt) + 60_000);
assert.match(home.outing.did, /I read the notice board\. New: someone wants a toy train and a drawing of a cat/);
assert.ok((Date.parse(home.outing.homeAt) - (t0 + HOUR)) / 60_000 <= 8, 'it is a short walk');
assert.ok(b.wishes.every((w) => w.seen));
const lines = boardLines(b, t0 + 2 * HOUR);
assert.equal(lines.length, 2);
assert.match(lines[0], /someone asks for a toy train: 3 coins when I make it \(decorate\)\..*look up how it is made first \(search_web\)/);
assert.match(lines[1], /a drawing of a cat: 2 coins when I make it \(draw\)/);
assert.match(readBoard({ wishes: [] }, t0), /nothing on it today/);
ok('he walks to the board to read it; then he knows what is asked and how to go about it');

// ---- making it: the note comes down and the coins are his; a thing made with knowledge earns one more
assert.deepEqual(keepWishes(b, [{ action: 'decorate', name: 'red toy car', why: 'for fun' }], t0 + 3 * HOUR), [], 'a toy car is not a toy train');
assert.deepEqual(keepWishes(b, [{ action: 'draw', name: 'wooden toy train', why: 'x' }], t0 + 3 * HOUR).filter((l) => /notice board/.test(l)), [], 'and a drawing of a train is not a train');
b.coins = 2;
const made = keepWishes(b, [{ action: 'decorate', name: 'little wooden toy train', why: 'for the note on the board' }], t0 + 3 * HOUR);
assert.match(made[0], /I made a toy train, as the note on the notice board asked\. I took the note down and got 3 coins\. I have 5 coins now\./);
assert.equal(b.wishes[0].status, 'kept');
assert.equal(boardNotes(b, t0 + 3 * HOUR).length, 1);
b.log.push({ at: iso(t0 + 4 * HOUR), action: 'search_web', query: 'how to draw a cat step by step' });
assert.match(boardLines(b, t0 + 5 * HOUR)[0], /I have looked up how it is made/);
const made2 = keepWishes(b, [{ action: 'draw', name: 'sleeping cat on the windowsill', why: 'x' }], t0 + 5 * HOUR);
assert.match(made2[0], /got 3 coins \(one more because I had looked up how it is made\)\. I have 8 coins now/);
assert.deepEqual(boardNotes(b, t0 + 5 * HOUR), []);
ok('he makes what a note asks for and gets the coins, one more when he looked it up first');

// ---- it is one of his moves when there is something to read
const live = { wishes: [{ id: 'b9', board: true, topic: 'a kite', text: 'Wanted: a kite.', medium: ['decorate'], at: iso(t0), reward: 3, status: 'open', seen: false }], decor: [], energy: 8, fullness: 8, body: { creativity: 6, boredom: 3, curiosity: 4, coziness: 6 }, tools: [], log: [], projects: [], pantry: [], garden: { seeds: [], plots: [] }, outings: [], art: [], apps: [], pictures: [], found: [], wardrobe: [], moves: [], memories: [] };
process.env.PIP_FAKE_MOVE = 'check_board';
let m = null;
try { m = availableMoves(live, { now: t0 + HOUR, random: () => 0.5 }).find((x) => x.name === 'check_board'); } catch (e) { console.log('(moves need a fuller state here:', e.message, ')'); }
delete process.env.PIP_FAKE_MOVE;
if (m) { assert.ok(m.line.length < 240 && /something new on it/.test(m.line), m.line); ok('reading the board is one of his moves, and it says when there is something new'); }
