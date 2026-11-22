// The next challenge is one step above what he can do (curriculum.js), and making gets one retry with facts (verify.js).
import assert from 'node:assert/strict';
import { nextChallenges, challengeLines, challengeSteps } from '../curriculum.js';
import { withOneRetry } from '../verify.js';
import { noteChoice, choiceOf } from '../loops.js';
import { brainSchema } from '../brain.js';

const ok = (name) => console.log(`ok  ${name}`);
const base = () => ({ apps: [], decor: [], recipes: [], art: [], projects: [], tools: [], skills: {}, studio: { songs: [] }, log: [], curious: { interests: [{ topic: 'Night sky', score: 6 }] } });

const s = base();
const c = nextChallenges(s);
assert.equal(c.length, 2);
assert.ok(c.every((x) => x.steps.length >= 3 && x.rung === 1), 'a beginner gets first rungs');
s.apps.push({ name: 'Button', v: 1 });
const coding = nextChallenges({ ...s, skills: { music: 50, painting: 50, sculpture: 50, woodwork: 50, gardening: 50, cooking: 50 } }).find((x) => x.skill === 'coding');
assert.match(coding.title, /game, one ticket at a time/);
assert.match(coding.title, /night sky/, 'it is about what he is into');
s.apps[0].v = 3;
assert.ok(!nextChallenges(s).some((x) => /one ticket at a time/.test(x.title)), 'a rung he has done is not offered again');
ok('challenges are the first rung not done yet, about what he is into');

assert.match(challengeLines(s)[0], /one step up for me/);
assert.deepEqual(challengeLines({ ...s, projects: [{ status: 'working', title: 'x' }] }), [], 'not while he has a project');
const pick = nextChallenges(s)[0];
assert.deepEqual(challengeSteps(s, pick.title), pick.steps);
assert.equal(challengeSteps(s, 'something of my own'), null);
ok('he sees them when he has no project, and a chosen one brings its steps');

let asked = 0;
const good = await withOneRetry({ v: 1 }, { check: async (m) => (m.v === 1 ? ['it is small'] : []), retry: async () => { asked++; return { v: 2 }; } });
assert.deepEqual([good.made.v, good.tries, good.facts.length, asked], [2, 2, 0, 1]);
const worse = await withOneRetry({ v: 1 }, { check: async (m) => (m.v === 1 ? ['a'] : ['a', 'b']), retry: async () => ({ v: 2 }) });
assert.equal(worse.made.v, 1, 'a worse second try is thrown away');
const taste = await withOneRetry({ v: 1 }, { check: async () => ['style: many colours'], retry: async () => { throw new Error('no retry for taste'); } });
assert.equal(taste.tries, 1);
const none = await withOneRetry({ v: 1 }, { check: async () => ['x'], allowed: false, retry: async () => ({ v: 2 }) });
assert.equal(none.made.v, 1);
ok('one retry with the facts; the better try is kept; taste alone is no reason');

const l = { recent: {} };
const mv = choiceOf({ moves: [{ move: 'move_thing', details: { name: 'lamp' } }] });
assert.equal(noteChoice(l, mv, false, 'the desk is full', Date.now(), true), null);
assert.equal(noteChoice(l, mv, false, 'the desk is full', Date.now(), true)?.move, 'move_thing', 'the same thing failing twice rests at once');
ok('the same failure twice: that move rests (taking the option away works, saying "do not repeat" does not)');

const sc = brainSchema(['do', 'draw']);
assert.equal(sc.propertyOrdering[0], 'reason');
assert.deepEqual(sc.properties.moves.items.propertyOrdering, ['thought', 'move', 'details']);
ok('the brain writes its reason first, then its choice');
