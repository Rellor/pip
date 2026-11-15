// Phase 4: body, moves, brain and autopilot, without a model.
// Run: node tests/brain.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tickBody, noteMove, noteMood, bodyText, ensureBody } from '../body.js';
import { availableMoves, MIN_MOVES, MAX_MOVES, askReason } from '../moves.js';
import { toAnswer, brainPrompt, brainSchema } from '../brain.js';
import { wakeReasons, decided, nextQueued, ensurePlan, fallbackSteps } from '../autopilot.js';

const fresh = () => {
  const s = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
  delete s.body; delete s.recent; delete s.today; delete s.plan;
  tickBody(s);
  return s;
};
const ok = (name, fn) => { fn(); console.log(`ok  ${name}`); };
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

ok('6 to 10 moves, each with one short line, always a free move', () => {
  const s = fresh();
  const m = availableMoves(s, { random: seeded(1) });
  assert.ok(m.length >= MIN_MOVES && m.length <= MAX_MOVES, `${m.length} moves`);
  assert.ok(m.some((x) => x.name === 'do'));
  for (const x of m) assert.ok(!x.line.includes('\n') && x.line.length < 240, x.line);
});

ok('a move he just did is offered less', () => {
  const runs = 300;
  const rate = (s) => { let n = 0; for (let i = 0; i < runs; i++) if (availableMoves(s, { random: seeded(i + 7) }).some((x) => x.name === 'search_web')) n++; return n / runs; };
  const a = fresh();
  const b = fresh();
  for (let i = 0; i < 4; i++) noteMove(b, 'search_web');
  assert.ok(rate(b) < rate(a), `${rate(b)} < ${rate(a)}`);
});

ok('"I did X 4 times today" and the same mood again show up in his feelings', () => {
  const s = fresh();
  for (let i = 0; i < 4; i++) { noteMove(s, 'play_piano'); noteMood(s, 'peaceful'); }
  const t = bodyText(s).join('; ');
  assert.match(t, /play piano 4 times today/);
  assert.match(t, /peaceful 4 times in a row/);
});

ok('making lowers creativity, the same kind again and again raises boredom', () => {
  const s = fresh();
  s.body.creativity = 9;
  noteMove(s, 'decorate');
  assert.ok(s.body.creativity <= 5);
  const before = s.body.boredom;
  for (let i = 0; i < 4; i++) noteMove(s, 'play_piano');
  assert.ok(s.body.boredom >= before);
});

ok('the brain wakes only for a reason; otherwise autopilot takes the next queued move', () => {
  const s = fresh();
  ensurePlan(s);
  const now = Date.now();
  assert.ok(wakeReasons(s, { now }).length > 0, 'no decision yet');
  const first = decided(s, [{ action: 'walk_to', details: {} }, { action: 'play_piano', details: {} }, { action: 'search_web', details: {} }, { action: 'rest', details: {} }], now);
  assert.deepEqual(first.map((x) => x.action), ['walk_to', 'play_piano']);
  assert.deepEqual(wakeReasons(s, { now: now + 8 * 60_000 }), []);
  assert.deepEqual(nextQueued(s).map((x) => x.action), ['search_web']);
  assert.ok(wakeReasons(s, { now: now + 31 * 60_000 }).some((r) => /30 minutes/.test(r)));
  assert.ok(wakeReasons(s, { unread: 1, now: now + 9 * 60_000 }).includes('Bas wrote to me'));
  s.tools.push({ name: 'saw', kind: 'saw' });
  assert.ok(wakeReasons(s, { now: now + 9 * 60_000 }).includes('I got a new tool'));
  nextQueued(s);
  assert.ok(wakeReasons(s, { now: now + 9 * 60_000 }).includes('I finished what I planned'));
});

ok('the reply becomes steps; moves that were not offered are dropped', () => {
  const a = toAnswer({ moves: [{ move: 'search_web', details: { query: 'how do bees fly' } }, { move: 'fly_to_moon', details: {} }, { move: 'tell', details: { text: 'Hello!' } }, { move: 'decorate', details: { what: 'a bee', why: 'bees' } }], reason: 'I want to know.', mood: 'curious' }, ['search_web', 'tell', 'decorate']);
  assert.deepEqual(a.steps.map((x) => x.action), ['search_web', 'walk_to']);
  assert.equal(a.tell, 'Hello!');
  const b = toAnswer({ moves: [{ move: 'decorate', details: { what: 'a bee' } }, { move: 'remove_decoration', details: { what: 'old lamp' } }] }, ['decorate', 'remove_decoration']);
  assert.equal(b.steps[0].make, true);
  assert.equal(b.steps[1].details.name, 'old lamp');
});

ok('asks: only for a reason, at most 2 a day', () => {
  const s = fresh();
  s.projects = [];
  s.tools.push({ name: 'guitar', kind: 'guitar' }); // with no instrument at all, asking for one is a reason too
  s.fullness = 8; // not hungry
  assert.equal(askReason(s), null);
  ensurePlan(s);
  s.plan.lastFail = { at: new Date().toISOString(), why: 'extend_thing: I need a toolbox' };
  assert.ok(askReason(s));
  s.today.done.ask_for = 2;
  assert.equal(askReason(s), null);
});

ok('the brain prompt is small (under 6k tokens), the schema lists only offered moves', () => {
  const s = fresh();
  const moves = availableMoves(s);
  const p = brainPrompt({ soul: fs.readFileSync(new URL('../soul.md', import.meta.url), 'utf8'), now: 'Sunday 10:00', feelings: bodyText(s), doing: [], events: ['I just woke up'], messages: ['"hi"'], memories: s.memories.slice(0, 5).map((m) => m.text), projects: [], moves });
  assert.ok(p.length / 4 < 6000, `${Math.round(p.length / 4)} tokens`);
  assert.deepEqual(brainSchema(moves.map((m) => m.name)).properties.moves.items.properties.move.enum, moves.map((m) => m.name));
});

ok('no model: needs come first', () => {
  const s = fresh();
  s.energy = 2;
  assert.equal(fallbackSteps(s, [])[0].action, 'rest');
});

ok('a "do" that is really planting, watering or eating becomes that move (no pretending)', () => {
  const a = toAnswer({ moves: [{ move: 'do', details: { what: 'plant basil seeds in my planter box' } }, { move: 'do', details: { what: 'eat some bread' } }, { move: 'do', details: { what: 'hum by the window' } }] }, ['do']);
  assert.deepEqual(a.steps.map((x) => x.action), ['plant', 'eat', 'do']);
  assert.equal(a.steps[0].details.seed, 'basil');
  assert.equal(a.steps[1].details.food, 'bread');
});
