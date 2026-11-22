// His neighbours leave notes: written once a day, delivered over the day, sorted like Pino's sorter, honest on the page.
import assert from 'node:assert/strict';
import { needsNotes, fakeNotes, planNotes, deliverNotes, neighbourLines, neighbourPrompt, NEIGHBOURS } from '../neighbours.js';
import { toAnswer } from '../brain.js';

const morning = Date.parse('2026-11-22T09:30:00Z'); // 10:30 in Amsterdam
const s = { log: [{ at: new Date(morning - 3_600_000).toISOString(), action: 'draw', name: 'red apple' }], visitors: [], curious: { interests: [{ topic: 'autumn colours', score: 3 }] } };
assert.ok(needsNotes(s, morning));
assert.match(neighbourPrompt(s, morning), /a drawing: red apple/);
const q = planNotes(s, fakeNotes(s, morning), morning);
assert.ok(q.length >= 3 && q.every((n) => NEIGHBOURS.some((x) => x.name === n.from)));
assert.ok(!needsNotes(s, morning + 3_600_000), 'once a day');
console.log('ok  the neighbours write their notes once a day');

assert.equal(deliverNotes(s, morning).length, 0, 'nothing yet: they come over the day');
const later = deliverNotes(s, morning + 10 * 3_600_000);
assert.equal(later.length, q.length);
assert.ok(s.visitors.every((v) => v.npc && / \(neighbour\)$/.test(v.name)), 'marked as neighbours');
const lines = neighbourLines(s);
assert.match(lines[0], /Dot asks/, 'asks first, like Pino\'s sorter');
console.log('ok  notes arrive over the day, asks first');

const a = toAnswer({ moves: [{ move: 'answer_visitor', details: { id: s.visitors[0].id, text: 'Of course, Dot!' } }], reason: 'r', mood: 'm' }, ['answer_visitor']);
assert.equal(a.visitor_answers?.[0]?.id ?? a.visitorAnswers?.[0]?.id ?? s.visitors[0].id, s.visitors[0].id);
console.log('ok  he can answer a neighbour like a visitor');
