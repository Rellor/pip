// Curiosity: browsing leaves sparks, what he loves becomes an interest and then a hobby, and one interest leads to the next.
import assert from 'node:assert/strict';
import { browse, browseRoute, noteSpark, feel, fade, curiosityLines, interests, INTEREST_AT, HOBBY_AT } from '../curiosity.js';
import { toAnswer, brainSchema } from '../brain.js';

const s = { log: [], news: { items: [{ topic: 'Modular synthesizer', text: 'Did you know a modular synth is built from separate modules?' }] } };
const pages = { 'Modular synthesizer': 'A modular synthesizer is a type of synthesizer consisting of separate modules.', 'Eurorack': 'Eurorack is a modular synthesizer format.', '3D printing': '3D printing builds an object layer by layer.' };
const wiki = async (q) => (q.includes('morelike') ? { query: { search: [{ title: 'Eurorack' }, { title: '3D printing' }] } } : { query: { random: [{ title: '3D printing' }] } });
const read = async (t) => (pages[t] ? { title: t, text: pages[t], url: `https://en.wikipedia.org/wiki/${t}` } : null);

const b = await browse(s, { wiki, read, random: () => 0.7 }); // no interests yet: today's news
assert.equal(b.title, 'Modular synthesizer');
assert.equal(s.curious.sparks.length, 1);
assert.match(curiosityLines(s, [])[0], /I came across Modular synthesizer/);
console.log('ok  browsing opens something and leaves a spark he is told about');

feel(s, 'Modular synthesizer', 'love');
assert.equal(interests(s)[0].topic, 'Modular synthesizer');
const b2 = await browse(s, { wiki, read, random: () => 0.1 }); // he likes synths: a page near them
assert.equal(b2.via, 'Modular synthesizer');
assert.ok(['Eurorack', '3D printing'].includes(b2.title));
console.log('ok  what he loves becomes an interest, and browsing drifts to things close to it');

const f = feel(s, 'Modular synthesizer', 'love');
assert.equal(f.became, 'hobby');
assert.match(curiosityLines(s, []).join(' '), /keeps pulling at me. I could make it a hobby/);
assert.ok(!curiosityLines(s, [{ status: 'working', title: 'Build a modular synthesizer' }]).join(' ').includes('pulling'), 'not when it is already a project');
console.log('ok  a strong interest pulls at him to make it a hobby (until it is one)');

const t0 = Date.now();
s.curious.fadedAt = new Date(t0 - 5 * 86_400_000).toISOString();
fade(s, t0);
assert.ok(s.curious.interests[0].score < HOBBY_AT);
console.log('ok  interests fade when he leaves them alone');

const a = toAnswer({ moves: [{ move: 'browse', details: {} }], reason: 'x', mood: 'calm', spark: { topic: 'Eurorack', how: 'like' } }, ['browse']);
assert.equal(a.steps[0].action, 'browse');
assert.deepEqual(a.spark, { topic: 'Eurorack', how: 'like' });
assert.ok(brainSchema(['browse']).properties.spark);
console.log('ok  the brain can browse and say what caught him');

assert.equal(noteSpark(s, { topic: 'a terrible war', text: 'many were killed' }), null);
console.log('ok  grim things do not become sparks');
