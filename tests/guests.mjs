// His visitors (guests.js): one question he puts to everyone who comes by, and the shelf in the library where they can
// leave a poem, a short story or a book tip. Plus his mood over the day (arc.js).
import assert from 'node:assert/strict';
import { askVisitors, canAskVisitors, openQuestion, closeQuestion, takeAnswer, takeShelf, unreadShelf, readShelf, noteReply, visitorLine, guestLines, pieceWords, QUESTION_DAYS, QUESTION_GAP_H, QUESTION_ANSWERS } from '../guests.js';
import { noteArc, feelOf, ARC_KEPT } from '../arc.js';
import { toAnswer } from '../brain.js';
import { availableMoves } from '../moves.js';

const ok = (name) => console.log(`ok  ${name}`);
const HOUR = 3_600_000, DAY = 24 * HOUR;
const now = Date.parse('2026-11-27T11:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

// ---- his question: it needs a reason, there is one at a time, and it closes by itself
{
  const s = {};
  assert.match(askVisitors(s, 'What do you keep in your pockets', '', now).failed, /needs a reason/);
  assert.match(askVisitors(s, 'Why?', 'because', now).failed, /did not say what/);
  const asked = askVisitors(s, 'What do you keep in your pockets', 'Mine are always empty and I wonder what I miss.', now);
  assert.equal(asked.question.text, 'What do you keep in your pockets?', 'a question ends with a question mark');
  assert.ok(openQuestion(s, now) && !canAskVisitors(s, now + HOUR));
  assert.match(askVisitors(s, 'And what about your shoes?', 'I have no shoes', now + HOUR).failed, /not long ago/);
  assert.match(guestLines(s, now + HOUR)[0], /still open.*no answers yet/);
  // answers Bas let through are kept with it; an answer to a question that does not exist is a plain message
  assert.equal(takeAnswer(s, { id: 'v1', at: iso(now + HOUR), name: 'Mila', text: 'A blue marble.', answerTo: asked.question.id }), asked.question.text);
  assert.equal(takeAnswer(s, { id: 'v1', at: iso(now + HOUR), name: 'Mila', text: 'A blue marble.', answerTo: asked.question.id }), asked.question.text);
  assert.equal(s.openQuestion.answers.length, 1, 'the same answer is not kept twice');
  assert.equal(takeAnswer(s, { id: 'v9', text: 'x', answerTo: 'qnope' }), null);
  for (let i = 0; i < 12; i++) takeAnswer(s, { id: `w${i}`, at: iso(now), name: '', text: `answer ${i}`, answerTo: asked.question.id });
  assert.equal(s.openQuestion.answers.length, QUESTION_ANSWERS);
  assert.match(visitorLine({ id: 'v1', name: 'Mila', text: 'A blue marble.', question: asked.question.text }), /\[v1\] Mila answers my question "What do you keep in your pockets\?": "A blue marble\."/);
  // what he says back is kept with the answer
  const v = { id: 'w11', answerTo: asked.question.id, answer: 'Eleven. A fine number.', answeredAt: iso(now) };
  noteReply(s, v);
  assert.equal(s.openQuestion.answers.find((a) => a.id === 'w11').reply, 'Eleven. A fine number.');
  // a day later he may ask a new one: the old one moves to the ones he asked before
  assert.ok(canAskVisitors(s, now + (QUESTION_GAP_H + 1) * HOUR));
  const next = askVisitors(s, 'What is your favourite useless thing?', 'I made a chair for an ant once.', now + (QUESTION_GAP_H + 1) * HOUR);
  assert.ok(next.question && s.pastQuestions.length === 1 && s.pastQuestions[0].answers.length === QUESTION_ANSWERS);
  assert.equal(closeQuestion(s, now + 2 * DAY), null, 'still open after a day');
  assert.equal(closeQuestion(s, now + (QUESTION_DAYS + 1.1) * DAY)?.id, next.question.id);
  assert.ok(!s.openQuestion && s.pastQuestions.length === 2 && openQuestion(s, now + 9 * DAY) === null);
}
ok('his question for visitors needs a reason, keeps its answers and his replies, and closes after three days');

// ---- the shelf in the library
{
  const s = { visitors: [] };
  assert.equal(takeShelf(s, { id: 'x', shelf: 'recipe', text: 'a long enough text here' }), null, 'only a poem, a story or a book tip');
  const poem = takeShelf(s, { id: 'p1', at: iso(now), shelf: 'poem', title: 'Heron', name: 'Joris', text: 'A heron stands in the ditch\nlike a question\nnobody dares to answer.' });
  assert.ok(poem && /\n/.test(poem.text), 'a poem keeps its lines');
  assert.equal(takeShelf(s, { id: 'p1', shelf: 'poem', text: 'the same one again, twice' }), null);
  takeShelf(s, { id: 'p2', at: iso(now + HOUR), shelf: 'tip', title: 'The Wind in the Willows', name: '', text: 'A mole, a rat and a toad.' });
  assert.equal(pieceWords(poem), 'poem “Heron” from Joris');
  assert.equal(unreadShelf(s).length, 2);
  assert.match(guestLines(s, now).at(-1), /2 things visitors left.*read_shelf/);
  // at the library he reads the one that waited longest; it becomes something he can answer
  const read = readShelf(s, now + 2 * HOUR);
  assert.equal(read.id, 'p1');
  assert.ok(s.visitors.length === 1 && s.visitors[0].shelf === 'poem' && !s.visitors[0].answer);
  assert.match(visitorLine(s.visitors[0]), /the poem "Heron" that Joris left for me on the shelf in the library.*honestly.*heron stands/s);
  Object.assign(s.visitors[0], { answer: 'The last line is the best one.', answeredAt: iso(now + 3 * HOUR) });
  noteReply(s, s.visitors[0]);
  assert.equal(s.shelf[0].opinion, 'The last line is the best one.');
  assert.equal(unreadShelf(s).length, 1);
  readShelf(s, now + 4 * HOUR);
  assert.equal(readShelf(s, now + 5 * HOUR), null, 'nothing left to read');
}
ok('a poem, story or book tip waits on the library shelf until he reads it there, and his opinion is kept with it');

// ---- the moves: he is offered them, and the brain's answer becomes the right step
{
  const s = { energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, body: { creativity: 3, boredom: 4, loneliness: 6, curiosity: 4 }, weather: { kind: 'clear', temp: 8 }, tools: [], pantry: [], decor: [], stored: [], log: [], outings: [], visitors: [], pictures: [], found: [], art: [], apps: [], wardrobe: [], moves: [], cookedAt: [], asks: [], projects: [], curious: { sparks: [], interests: [] }, shelf: [{ id: 'p1', kind: 'poem', title: 'Heron', name: 'Joris', text: 'x', readAt: null }] };
  delete process.env.PIP_NO_OUT;
  const all = availableMoves(s, { now, random: () => 0.5 }).map((m) => m.name);
  assert.ok(all.includes('read_shelf'), all.join(' '));
  const none = availableMoves({ ...s, shelf: [], body: { ...s.body, loneliness: 9 } }, { now, random: () => 0.5 }).map((m) => m.name); // (lonely: a question for his visitors pulls)
  assert.ok(none.includes('ask_visitors') && !none.includes('read_shelf'), none.join(' '));
  assert.ok(!availableMoves({ ...s, shelf: [], openQuestion: { id: 'q1', text: 'x?', at: iso(now - HOUR), answers: [] } }, { now, random: () => 0.5 }).some((m) => m.name === 'ask_visitors'), 'not a second question while one is open');
  const a = toAnswer({ moves: [{ move: 'ask_visitors', details: { question: 'What do you hear right now?', why: 'It is very quiet here.' }, thought: 't' }], reason: 'r', mood: 'calm' });
  assert.deepEqual([a.steps[0].action, a.steps[0].as, a.steps[0].details.question, a.steps[0].details.why], ['do', 'ask_visitors', 'What do you hear right now?', 'It is very quiet here.']);
  const b = toAnswer({ moves: [{ move: 'read_shelf', details: {}, thought: 't' }], reason: 'r', mood: 'calm' });
  assert.deepEqual([b.steps[0].action, b.steps[0].details.place], ['go_out', 'the library']);
}
ok('he is offered ask_visitors and read_shelf, and they become the right steps');

// ---- his mood over the day
{
  const s = { joy: 6.04, calm: 5, wonder: 4, energy: 7.26, mood: 'quiet', emotion: '' };
  const p = noteArc(s, now);
  assert.deepEqual([p.joy, p.energy, p.mood, p.feel], [6, 7.3, 'quiet', 5]);
  assert.equal(feelOf({ joy: 10, calm: 10, wonder: 10 }), 10);
  noteArc(s, now + 10_000); // the same wake-up again: still one point
  assert.equal(s.arc.length, 1);
  s.emotion = 'irritated';
  assert.equal(noteArc(s, now + 8 * 60_000, { out: true }).mood, 'irritated', 'a strong feeling wins from the mood word');
  assert.ok(s.arc.at(-1).out && s.arc.length === 2);
  for (let i = 2; i < 400; i++) noteArc(s, now + i * 8 * 60_000);
  assert.equal(s.arc.length, ARC_KEPT);
}
ok('his feelings are written down at every wake-up, one point each, and the list stays small');
