// Pip's own opinion about what he reads (curiosity.js noteOpinion, the "spark" of the brain's answer).
import assert from 'node:assert/strict';
import { noteOpinion, feel } from '../curiosity.js';
import { toAnswer, brainSchema } from '../brain.js';
import { TOWN_SPOTS, ROUTES, BUILDINGS } from '../web/town.js';

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-23T12:00:00Z');
const at = (min) => new Date(now - min * 60_000).toISOString();
const s = { log: [{ at: at(300), action: 'read_book', topic: 'Lighthouse', opened: { title: 'Lighthouse' } }, { at: at(40), action: 'search_web', query: 'how is sourdough bread made', opened: { title: 'Sourdough' } }, { at: at(10), action: 'do', what: 'look out of the window' }], curious: { sparks: [], interests: [] } };

assert.deepEqual(brainSchema().properties.spark.properties.how.enum, ['love', 'like', 'meh', 'dislike', 'doubt']);
const a = toAnswer({ reason: 'r', moves: [], mood: 'flat', spark: { topic: 'Sourdough', how: 'dislike', says: 'It takes five days and then it is just bread. I expected more.' } }, []);
assert.deepEqual(a.spark, { topic: 'Sourdough', how: 'dislike', says: 'It takes five days and then it is just bread. I expected more.' });
const op = noteOpinion(s, a.spark, now);
assert.ok(op && s.log[1].opinion.how === 'dislike' && /just bread/.test(s.log[1].opinion.says), 'the opinion is kept with what he read about it');
assert.equal(s.log[0].opinion, undefined);
assert.equal(s.opinions.length, 1);
noteOpinion(s, { topic: 'Lighthouse', how: 'love', says: 'A lamp that small, and ships see it from 30 km. I want one.' }, now);
assert.equal(s.log[0].opinion.how, 'love', 'an older read gets its own opinion by its topic');
noteOpinion(s, { topic: 'Sourdough', how: 'meh', says: 'Still just bread.' }, now);
assert.ok(s.opinions.length === 2 && s.opinions.at(-1).says === 'Still just bread.', 'one opinion per topic: the newest');
assert.equal(noteOpinion(s, { topic: 'Rain', how: 'like', says: '' }, now), null, 'no words, no opinion');
assert.ok(feel({ curious: { sparks: [], interests: [] } }, 'Sourdough', 'dislike', now) !== undefined);
ok('he says what he really thinks of what he read, and it stays with what he read');

assert.ok(BUILDINGS.some((b) => b.key === 'cafe' && !b.decor) && TOWN_SPOTS.cafe && ROUTES.cafe, 'the internet café is a real place with a door he walks to');
ok('the internet café is where he looks things up');
