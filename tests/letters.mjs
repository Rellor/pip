// Every Sunday evening Pip writes Bas a letter about his week, with his favourite drawing.
import assert from 'node:assert/strict';
import { letterDue, weekDigest, letterPrompt, fakeLetter, sendLetter, weekOf } from '../letters.js';

const sunday = Date.parse('2026-11-22T18:30:00Z'); // 19:30 in Amsterdam, a Sunday
const s = { art: [{ name: 'red apple', file: 'made/a.svg', createdAt: '2026-11-21T10:00:00Z' }], decor: [], projects: [{ title: 'Knit a blanket', status: 'done', doneAt: '2026-11-21T12:00:00Z' }], visitors: [{ npc: true, name: 'Dot (neighbour)', text: 'Draw me a cat!', at: '2026-11-22T10:00:00Z' }, { npc: true, stranger: true, name: 'Sam (a sailor)', text: 'An octopus has three hearts.', answer: 'Three is a lot.', at: '2026-11-22T11:00:00Z' }], wishes: [{ id: 'b1', board: true, from: 'the notice board', topic: 'a toy train', reward: 3, status: 'kept', keptAt: '2026-11-21T15:00:00Z', with: 'little wooden toy train' }, { id: 'k1', from: 'Lina', topic: 'night sky game', reward: 5, status: 'kept', keptAt: '2026-11-21T16:00:00Z', with: 'Neon star catcher' }], memories: [{ text: 'I finished my blanket', importance: 8, at: '2026-11-21T12:00:00Z' }], outbox: [] };
assert.ok(letterDue(s, sunday));
assert.ok(!letterDue(s, sunday - 6 * 3_600_000), 'not before the evening');
assert.ok(!letterDue(s, sunday + 86_400_000), 'not on Monday');
const d = weekDigest(s, sunday);
assert.deepEqual(d.done, ['Knit a blanket']);
const prompt = letterPrompt('I am Pip.', d, { first: true });
assert.match(prompt, /very first weekly letter[\s\S]*- Notes travellers left for me: Sam \(a sailor\): "An octopus has three hearts\." \(I answered: "Three is a lot\."\)\n/);
assert.match(prompt, /- Things I made for a note on the notice board: a toy train \(3 coins\)\n[\s\S]*- Things that happened on the square: /);
assert.ok(!/neighbour|my street|\b(Mo|Lina|Oma Jo|Dot|Kees)\b/i.test(prompt), 'the letter is not asked about neighbours');
const m = sendLetter(s, { letter: 'Dear Bas,\nThis week I knitted a blanket and drew an apple. A sailor told me about the octopus.\nLove, Pip', favourite: 'red apple' }, d, sunday);
assert.equal(m.kind, 'letter');
assert.equal(m.image, 'made/a.svg');
assert.ok(m.private);
assert.equal(s.letterWeek, weekOf(sunday));
assert.ok(!letterDue(s, sunday + 3_600_000), 'one letter a week');
assert.ok(fakeLetter(d).letter.startsWith('Dear Bas') && !/neighbour/i.test(fakeLetter(d).letter));
console.log('ok  a letter every Sunday evening, about his week, with his favourite drawing');
