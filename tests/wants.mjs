// His list of wants (it replaces the list of asks to Bas), and building out in his world as a move of its own.
import assert from 'node:assert/strict';
import { toAnswer } from '../brain.js';
import { byName, availableMoves, WANTS_MAX, MOVE_NAMES, MAKER_MOVES } from '../moves.js';

const ok = (name) => console.log(`ok  ${name}`);
delete process.env.PIP_NO_OUT;
const now = Date.parse('2026-11-27T11:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const fresh = (more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 5, loneliness: 5, body: { creativity: 6, curiosity: 5, boredom: 5, loneliness: 3, tidiness: 5, coziness: 5 }, weather: { kind: 'clear', temp: 8 }, tools: [], pantry: [], decor: [], stored: [], log: [], outings: [], asks: [], projects: [], pictures: [], found: [], art: [], apps: [], wardrobe: [], moves: [], cookedAt: [], garden: { plots: [], seeds: [] }, studio: { songs: [] }, today: { done: {} }, curious: { sparks: [], interests: [] }, ...more });
const want = (item, i = 0, more = {}) => ({ id: `w${i}`, item, why: 'because I really would like to have it', since: iso(now - 3_600_000), status: 'open', ...more });

// ---- the move: a want with a why
assert.ok(MOVE_NAMES.includes('want') && !MOVE_NAMES.includes('ask_for'), 'the list of asks is a list of wants now');
const move = byName('want');
const line = move.line(fresh(), now);
assert.ok(line.length < 240 && /wants list/.test(line) && /why in one honest sentence/.test(line) && /no reason, no want/.test(line), line);
assert.equal(Boolean(move.when(fresh(), now)), true);
assert.equal(Boolean(move.when(fresh({ asks: Array.from({ length: WANTS_MAX }, (_, i) => want(`thing ${i}`, i)) }), now)), false, 'the list is full');
assert.equal(Boolean(move.when(fresh({ today: { done: { ask_for: 2 } } }), now)), false, 'two new wants a day');
assert.ok(availableMoves(fresh(), { now, random: () => 0.5 }).some((m) => m.name === 'want'), 'it is always among what he can do');
const a = toAnswer({ moves: [{ move: 'want', details: { what: 'a telescope', why: 'I draw the night sky from memory and want to see if I got it right' }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['want']);
assert.deepEqual([a.steps[0].action, a.steps[0].details.item, a.steps[0].details.reason], ['ask_for', 'a telescope', 'I draw the night sky from memory and want to see if I got it right']);
assert.equal(toAnswer({ moves: [{ move: 'ask_for', details: { item: 'clay', why: 'for a cup' }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['ask_for']).steps[0].details.item, 'clay', 'the old name still works');
ok('want: he puts a thing on his list and says why');

// ---- crossing a want off
const drop = byName('drop_want');
assert.equal(Boolean(drop.when(fresh({ asks: [want('a kite', 1)] }), now)), false, 'only with a few wants on the list');
const three = fresh({ asks: [want('a kite', 1), want('a drum kit', 2), want('a telescope', 3), want('old one', 4, { status: 'done' })] });
assert.ok(drop.when(three, now) && drop.line(three).length < 240 && /a kite/.test(drop.line(three)) && !/old one/.test(drop.line(three)), drop.line(three));
const d = toAnswer({ moves: [{ move: 'drop_want', details: { what: 'a drum kit', why: 'the guitar is loud enough' }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['drop_want']).steps[0];
assert.deepEqual([d.action, d.as, d.details.want, d.details.why], ['do', 'drop_want', 'a drum kit', 'the guitar is loud enough']);
ok('drop_want: he crosses a want off his list himself');

// ---- building out in his world is a move of its own
const build = byName('build_outside');
assert.ok(MAKER_MOVES.includes('build_outside'));
const empty = build.line(fresh());
assert.ok(empty.length < 240 && /nothing of mine stands there yet/.test(empty) && /on my field/.test(empty) && /metres/.test(empty), empty);
assert.doesNotMatch(build.line(fresh({ decor: [{ kind: 'outside', name: 'tower' }] })), /nothing of mine/);
assert.ok(build.when(fresh(), now) && build.score(fresh()) > build.score(fresh({ decor: [{ kind: 'outside', name: 'tower' }] })), 'an empty world invites more');
const b = toAnswer({ moves: [{ move: 'build_outside', details: { what: 'a giant wooden clock', why: 'I dreamed of it', where: 'by the pond', metres: 6 }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['build_outside']).steps[0];
assert.deepEqual([b.action, b.as, b.make, b.details.where, b.details.metres, b.details.what], ['decorate', 'build_outside', true, 'outside by the pond', 6, 'a giant wooden clock']);
const plain = toAnswer({ moves: [{ move: 'build_outside', details: { what: 'a big piano' }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['build_outside']).steps[0];
assert.deepEqual([plain.details.where, plain.details.metres], ['outside on my field', 4], 'no place named: his own field, a few metres big');
assert.equal(toAnswer({ moves: [{ move: 'build_outside', details: { what: 'a bench', where: 'outside in front of my house' }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['build_outside']).steps[0].details.where, 'outside in front of my house');
// a wall nobody has painted yet is more inviting
const paint = byName('paint_wall');
assert.ok(paint.score(fresh()) > paint.score(fresh({ gallery: [{ id: 'a1', wall: 'wall_1' }] })));
for (const n of ['want', 'drop_want', 'build_outside']) assert.ok(MOVE_NAMES.includes(n), n);
ok('build_outside: a thing made out in his world, at a place he names (his field when he names none)');
