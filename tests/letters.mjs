// Every Sunday evening Pip writes Bas a letter about his week, with his favourite drawing.
import assert from 'node:assert/strict';
import { letterDue, weekDigest, letterPrompt, fakeLetter, sendLetter, weekOf } from '../letters.js';

const sunday = Date.parse('2026-11-22T18:30:00Z'); // 19:30 in Amsterdam, a Sunday
const s = { art: [{ name: 'red apple', file: 'made/a.svg', createdAt: '2026-11-21T10:00:00Z' }], decor: [], projects: [{ title: 'Knit a blanket', status: 'done', doneAt: '2026-11-21T12:00:00Z' }], visitors: [{ npc: true, name: 'Dot (neighbour)', text: 'Draw me a cat!', at: '2026-11-22T10:00:00Z' }], memories: [{ text: 'I finished my blanket', importance: 8, at: '2026-11-21T12:00:00Z' }], outbox: [] };
assert.ok(letterDue(s, sunday));
assert.ok(!letterDue(s, sunday - 6 * 3_600_000), 'not before the evening');
assert.ok(!letterDue(s, sunday + 86_400_000), 'not on Monday');
const d = weekDigest(s, sunday);
assert.deepEqual(d.done, ['Knit a blanket']);
assert.match(letterPrompt('I am Pip.', d, { first: true }), /very first weekly letter[\s\S]*Dot: "Draw me a cat!"/);
const m = sendLetter(s, { letter: 'Dear Bas,\nThis week I knitted a blanket and drew an apple. Dot asked me for a cat.\nLove, Pip', favourite: 'red apple' }, d, sunday);
assert.equal(m.kind, 'letter');
assert.equal(m.image, 'made/a.svg');
assert.ok(m.private);
assert.equal(s.letterWeek, weekOf(sunday));
assert.ok(!letterDue(s, sunday + 3_600_000), 'one letter a week');
assert.ok(fakeLetter(d).letter.startsWith('Dear Bas'));
console.log('ok  a letter every Sunday evening, about his week, with his favourite drawing');
