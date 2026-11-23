// Notes and wishes (neighbours.js) now that the five neighbours have moved away: a traveller's note reaches the brain and
// can be answered, nothing is written for made-up people any more, and the one-time change (changes.js) lets them go.
// Run: node tests/neighbours.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as notes from '../neighbours.js';
import { noteLines, noteAnswer, openWishes, keepWishes, wishLines } from '../neighbours.js';
import { dropFound, postDrop } from '../strangers.js';
import { applyChanges } from '../changes.js';
import { toAnswer, brainPrompt } from '../brain.js';
import { byName } from '../moves.js';

const ok = (name) => console.log(`ok  ${name}`);
const HOUR = 3_600_000;
const noon = Date.parse('2026-11-23T11:00:00Z'); // 12:00 in Amsterdam
const iso = (ms) => new Date(ms).toISOString();
const FIVE = /\b(Mo|Lina|Oma Jo|Dot|Kees)\b/;

// ---- nothing writes notes for neighbours any more
for (const gone of ['NEIGHBOURS', 'needsNotes', 'neighbourPrompt', 'neighbourSchema', 'fakeNotes', 'planNotes', 'deliverNotes', 'streetView', 'warm', 'warmthWord', 'ledgerLines', 'neighbourLines']) assert.equal(notes[gone], undefined, `${gone} is gone`);
const pipJs = fs.readFileSync(new URL('../pip.js', import.meta.url), 'utf8');
assert.ok(!/neighbourPrompt|planNotes|needsNotes|fakeNotes|deliverNotes|PIP_NO_NEIGHBOURS/.test(pipJs), 'a wake-up has no model call for neighbours');
ok('no neighbours, and no model call that writes their notes');

// ---- a traveller's note reaches the brain, and he can answer it
const s = { visitors: [{ id: 'v1', at: iso(noon), name: 'Ann', text: 'hello', answer: null }], wishes: [], curious: { sparks: [], interests: [] }, log: [] };
const drop = postDrop(s, noon);
dropFound(s, drop.id, noon + HOUR);
const lines = noteLines(s);
assert.equal(lines.length, 1, 'only the made-up people of his world: a real visitor has its own list');
assert.ok(lines[0].startsWith(`[${drop.id}] ${drop.from} (${drop.who}) tells me about something: "`) && lines[0].includes(drop.text), lines[0]);
assert.equal(s.curious.sparks.every((x) => x.from === 'traveller'), true, 'what a traveller tells him is marked as a traveller\'s');
const prompt = brainPrompt({ soul: 'I am Pip.', now: 'now', feelings: [], doing: [], events: [], messages: [], memories: [], projects: [], moves: [], fresh: [], lessons: [], notes: lines });
assert.match(prompt, /NOTES FROM TRAVELLERS \(a traveller is someone passing through[\s\S]*what I really think[\s\S]*keep: true when I want to remember it, false when it is not for me/);
assert.ok(prompt.includes(drop.text) && !FIVE.test(prompt) && !/neighbour/i.test(prompt), 'the brain hears of travellers only');
assert.match(byName('answer_visitor').line(s), /^answer a note from a visitor or a traveller \(/);
const a = toAnswer({ moves: [{ move: 'answer_visitor', details: { id: drop.id, text: 'I doubt that.', keep: false } }], reason: 'r', mood: 'm' }, ['answer_visitor']);
assert.deepEqual(a.visitor_answers, [{ id: drop.id, text: 'I doubt that.', keep: false }]);
const note = s.visitors.find((v) => v.id === drop.id);
note.answer = 'I doubt that.';
noteAnswer(s, note);
noteAnswer(s, s.visitors[0]);
noteAnswer(s, null);
assert.equal(s.street, undefined, 'answering a traveller keeps no score of friendship');
assert.deepEqual(noteLines(s), [], 'an answered note is not shown again');
ok('a traveller\'s note is shown to the brain, he answers it like a visitor, and nothing else happens');

// ---- the one-time change: the neighbours moved away
const MOVED = '2026-11-23 the neighbours moved away';
const real = () => JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
const others = (() => { const x = real(); applyChanges(x, noon); return x.changes.filter((id) => id !== MOVED); })(); // every other change has been done already
const old = {
  changes: [...others], memories: [], coins: 4,
  street: { day: '2026-11-23', happened: ['x'], people: { Dot: { warmth: 1.5 } }, queue: [{ id: 'q1', from: 'Oma Jo', kind: 'hello', text: 'Good morning Pip.', at: iso(noon + HOUR) }] },
  visitors: [
    { id: 'n1', at: iso(noon - 5 * HOUR), name: 'Mo (neighbour)', npc: true, kind: 'share', text: 'Trains!', answer: 'Thank you Mo.' },
    { id: 'n2', at: iso(noon - 2 * HOUR), name: 'Dot (neighbour)', npc: true, kind: 'ask', text: 'Draw me a cat?', answer: null },
    { id: 't1', at: iso(noon - HOUR), name: 'Sam (a sailor)', npc: true, stranger: true, kind: 'share', text: 'An octopus has three hearts.', answer: null },
    { id: 'v1', at: iso(noon - HOUR), name: 'Ann', text: 'hello', answer: null },
  ],
  wishes: [
    { id: 'n2', from: 'Dot', text: 'Draw me a cat?', topic: 'a cat drawing', at: iso(noon - 2 * HOUR), reward: 2, status: 'open', said: true },
    { id: 'w1', from: 'Kees', text: 'a maze', topic: 'maze with exactly one way out', at: iso(noon - 20 * HOUR), reward: 5, status: 'open', said: false },
    { id: 'k1', from: 'Lina', text: 'a star game', topic: 'night sky game', at: iso(noon - 40 * HOUR), reward: 5, status: 'kept', keptAt: iso(noon - 30 * HOUR), with: 'Neon star catcher' },
    { id: 'b1', board: true, from: 'the notice board', topic: 'a drawing of an old tree', text: 'Wanted: a drawing of an old tree. 2 coins.', medium: ['draw'], at: iso(noon - HOUR), reward: 2, status: 'open', said: false, seen: true },
  ],
};
const notesOfChange = applyChanges(old, noon);
assert.equal(notesOfChange.length, 1);
const told = notesOfChange[0];
assert.ok(old.changes.includes(MOVED));
assert.match(told, /Mo, Lina, Oma Jo, Dot and Kees/);
assert.match(told, /did not get to say goodbye[\s\S]*Travellers pass through and leave notes[\s\S]*notice board is where people ask for things/);
assert.deepEqual(old.street.queue, [], 'notes that were on their way never arrive');
assert.deepEqual([old.street.happened, old.street.day], [['x'], '2026-11-23'], 'the rest of the street is left as it was');
assert.deepEqual(old.visitors.map((v) => v.id), ['n1', 't1', 'v1'], 'an answered note stays as history; an unanswered one of a neighbour goes; travellers and visitors stay');
assert.deepEqual(old.wishes.map((w) => w.status), ['gone', 'gone', 'kept', 'open'], 'their open wishes are off; the note on the board hangs on');
assert.deepEqual(old.archive.filter((x) => x.group === 'note').map((x) => x.item.id), ['q1', 'n2'], 'nothing is thrown away: it is in the archive');
assert.equal(old.coins, 4);
assert.deepEqual(applyChanges(old, noon + HOUR), [], 'only once');
assert.deepEqual(wishLines(old, noon), [], 'no wish of a neighbour is told to the brain');
assert.ok(noteLines(old).length === 1 && noteLines(old)[0].startsWith('[t1] Sam (a sailor)') && !FIVE.test(noteLines(old).join(' ')), 'only the traveller\'s note is left to answer');
assert.deepEqual(keepWishes(old, [{ action: 'draw', name: 'the cat with the big tail', why: 'for Dot' }], noon), [], 'a drawing for someone who is gone earns nothing');
assert.match(keepWishes(old, [{ action: 'draw', name: 'the old tree by the pond' }], noon)[0], /as the note on the notice board asked\. I took the note down and got 2 coins\. I have 6 coins now\./);
assert.equal(openWishes(old, noon).length, 0);
{ const bare = { changes: [...others] }; applyChanges(bare, noon); assert.deepEqual(bare.street.queue, []); assert.equal(bare.visitors, undefined, 'a state without notes is left alone'); }
ok('the change: their waiting notes and open wishes go, what he answered stays, the board and the travellers go on');

// ---- his real state: after the change nothing of the five is asked of him any more
{
  const live = real();
  live.changes = (live.changes ?? []).filter((id) => id !== MOVED);
  const before = (live.visitors ?? []).filter((v) => v.answer).length;
  applyChanges(live);
  assert.equal((live.visitors ?? []).filter((v) => v.answer).length, before, 'his answered notes are all still there');
  assert.ok(!(live.visitors ?? []).some((v) => v.npc && !v.stranger && !v.answer) && !(live.street?.queue ?? []).length);
  assert.ok(!(live.wishes ?? []).some((w) => w.status === 'open' && !w.board));
  assert.ok(!FIVE.test([...noteLines(live), ...wishLines(live)].join(' ')));
  ok('his real state: nothing of the five waits for him after the change');
}
