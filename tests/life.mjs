// Phase 5: daily goals, projects with versions, skills, asks, dreams, food.
// Run: node tests/life.mjs
import assert from 'node:assert/strict';
import { setGoals, fakeGoals } from '../goals.js';
import { ensureProjects, addVersion, judgeProject, projectLines, missingForProject } from '../projects.js';
import { practise, level, maxParts, ensureSkills, skillOf } from '../skills.js';
import { toAnswer } from '../brain.js';
import { applyMade } from '../maker.js';
import { askReason } from '../moves.js';
import { ensureBody } from '../body.js';

const ok = (name, fn) => { fn(); console.log(`ok  ${name}`); };
const now = Date.parse('2026-11-16T10:00:00Z');
const base = () => { const s = { projects: [], log: [], tools: [], pantry: [], garden: { plots: [] }, decor: [], fullness: 6 }; ensureBody(s, now); return s; };

ok('daily goals: 1 to 3, in his words, ticked by kind', () => {
  const s = {};
  assert.ok(setGoals(s, fakeGoals(), '2026-11-16'));
  assert.equal(s.intent.items.length, 3);
  assert.ok(s.intent.items.some((i) => i.cat === 'outside'), 'one goal takes him outside');
  assert.ok(!setGoals(s, { goals: [] }, '2026-11-16'));
  setGoals(s, { goals: [1, 2, 3, 4].map((i) => ({ text: `g${i}`, kind: 'weird' })) }, '2026-11-17');
  assert.equal(s.intent.items.length, 3);
  assert.equal(s.intent.items[0].cat, 'make');
});

ok('projects: versions, notes, done only when proud', () => {
  const s = base();
  s.projects.push({ title: 'Build a bird house', status: 'working', since: '2026-11-13T10:00:00Z', updatedAt: '2026-11-13T10:00:00Z', steps: [] });
  ensureProjects(s);
  assert.equal(judgeProject(s, 'bird house', { proud: true, why: 'nice' }).done, false, 'nothing made yet');
  assert.deepEqual(addVersion(s, 'bird house', { kind: 'decorate', name: 'bird house' }), { project: 'Build a bird house', v: 1 });
  const j = judgeProject(s, 'bird house', { proud: false, why: 'the roof is crooked' });
  assert.equal(j.done, false);
  assert.match(s.projects[0].nextStep, /make v2: the roof is crooked/);
  addVersion(s, 'bird house', { kind: 'change_thing', name: 'bird house' });
  assert.equal(judgeProject(s, 'bird house', { proud: true, why: 'the roof is straight now' }).done, true);
  assert.equal(s.projects[0].status, 'done');
});

ok('an old unfinished project is pointed out days later', () => {
  const s = base();
  s.projects.push({ title: 'Learn a waltz', status: 'working', since: '2026-11-13T10:00:00Z', updatedAt: '2026-11-13T10:00:00Z', steps: [{ text: 'read about waltzes', done: true }] });
  assert.match(projectLines(s, now)[0], /not touched it for 3 days/);
});

ok('skills grow with practice and research; the level limits the maker', () => {
  const s = {};
  ensureSkills(s);
  assert.equal(level(s, 'woodwork'), 1);
  assert.equal(skillOf('decorate', { what: 'a wooden stool' }), 'woodwork');
  for (let i = 0; i < 8; i++) practise(s, 'decorate', { name: 'a small table' });
  assert.equal(level(s, 'woodwork'), 3);
  practise(s, 'search_web', { query: 'how to bake bread' });
  assert.equal(s.skills.cooking, 0.5);
  const made = applyMade({ action: 'decorate', details: { what: 'x' } }, { parts: Array.from({ length: 30 }, () => ({})) }, { parts: maxParts(1) });
  assert.equal(made.details.parts.length, 10);
});

ok('asks: a project that needs a tool, after research; hunger with no food', () => {
  const s = base();
  s.projects.push({ title: 'Build a bird house', status: 'working', since: '2026-11-15T10:00:00Z', needs: ['saw'], steps: [] });
  assert.equal(missingForProject(s, () => false), null, 'no research yet');
  s.log.push({ action: 'search_web', query: 'how to build a bird house', at: '2026-11-15T11:00:00Z' });
  assert.deepEqual(missingForProject(s, () => false), { project: 'Build a bird house', tool: 'saw' });
  assert.match(askReason(s, now), /needs saw/);
  const h = base();
  h.fullness = 2;
  assert.match(askReason(h, now), /hungry/);
});

ok('dreams become big asks; judging a project is passed on', () => {
  const a = toAnswer({ moves: [{ move: 'dream', details: { what: 'a synth machine', why: 'to make huge sounds' } }, { move: 'judge_project', details: { title: 'Bird house', proud: 'no', why: 'crooked roof' } }] }, ['dream', 'judge_project']);
  assert.equal(a.asks_add[0].big, true);
  assert.match(a.asks_add[0].item, /^Dream: a synth machine/);
  assert.deepEqual(a.project_judged, { title: 'Bird house', proud: false, why: 'crooked roof' });
});

// ---- food: only real food fills him, and hunger never harms him for good
const { ensureFeelings, passTime, stepFeelings, felt } = await import('../feelings.js');
ok('only eating fills him; making, learning and pretending do not', () => {
  const s = { fullness: 4, energy: 5, wonder: 5, joy: 5, calm: 5 };
  ensureFeelings(s);
  for (const action of ['decorate', 'draw', 'search_web', 'write_diary', 'record_song']) stepFeelings(s, { action, enjoyment: 9 });
  stepFeelings(s, { action: 'do', bar: 'fullness', enjoyment: 9 });
  felt(s, 'projectDone');
  assert.equal(s.fullness, 4);
});
ok('he never drops below 1, and very hungry is tiring, not deadly', () => {
  const s = { fullness: 3, energy: 5, wonder: 5, joy: 6, calm: 5, feelAt: new Date(now - 10 * 3_600_000).toISOString() };
  ensureFeelings(s, now - 10 * 3_600_000);
  for (let h = 1; h <= 48; h++) { s.feelAt = new Date(now + (h - 1) * 3_600_000).toISOString(); passTime(s, now + h * 3_600_000); }
  assert.equal(s.fullness, 1);
  const hour = (full) => { const x = { fullness: full, energy: 3, wonder: 5, joy: 5, calm: 5, feelAt: new Date(now).toISOString() }; ensureFeelings(x, now); passTime(x, now + 3_600_000); return x; };
  assert.ok(hour(1.5).energy < hour(6).energy, 'very hungry: energy comes back slower');
  assert.ok(hour(1.5).joy < hour(6).joy, 'very hungry: he feels lower');
});

// ---- coziness: a bare room nudges him to make it his; clutter is not cozy
const { coziness } = await import('../body.js');
const { availableMoves } = await import('../moves.js');
ok('coziness: bare is low, a few varied things are cozy, piles of stuff are not', () => {
  const lamp = { name: 'floor lamp', pos: [0, 0, 0], zone: 'floor', parts: [{ glow: true }], uses: [{ does: 'light' }] };
  assert.equal(coziness({ decor: [] }), 1);
  const varied = { decor: [lamp, { name: 'fern', pos: [1, 0, 1], zone: 'floor', parts: [] }, { name: 'pic', image: 'x', pos: [0, 2, -5], kind: 'wall' }, { name: 'cup', pos: [0, 1, 0], zone: 'on_desk', parts: [] }] };
  assert.ok(coziness(varied) >= 7);
  assert.ok(coziness(varied, true) > coziness(varied), 'a lamp on in the dark');
  assert.ok(coziness({ decor: Array.from({ length: 16 }, (_, i) => ({ name: `box${i}`, pos: [i, 0, 0], zone: 'floor', parts: [] })) }) < 4);
});
ok('a bare room offers making things a little more (not a must)', () => {
  const base = { energy: 6, fullness: 6, calm: 5, wonder: 5, joy: 5, decor: [], tools: [], pantry: [], garden: { plots: [], seeds: [] }, projects: [], log: [], studio: { songs: [] }, art: [], apps: [], wardrobe: [], pictures: [], found: [], moves: [], cookedAt: [], stored: [] };
  const rate = (coz) => { let n = 0; for (let i = 0; i < 400; i++) { const s = structuredClone(base); s.body = { creativity: 3, curiosity: 5, boredom: 3, loneliness: 2, tidiness: 9, coziness: coz }; s.today = { done: {} }; let k = i; if (availableMoves(s, { now: Date.parse('2026-11-16T12:00:00Z'), random: () => ((k = (k * 16807 + 7) % 2147483647) / 2147483647) }).slice(0, 4).some((m) => m.name === 'decorate')) n++; } return n; };
  assert.ok(rate(1) > rate(8), `${rate(1)} > ${rate(8)}`);
});

// ---- gifts: "I did this for you" hands over the real thing; a planter counts for growing
const { giveForAsk } = await import('../gifts.js');
const { isGreenhouse } = await import('../web/gardening.js');
ok('a done ask gives the real thing: seeds, tools, food; nothing made up', () => {
  const s = { tools: [], pantry: [], garden: { seeds: [], plots: [], given: [] } };
  assert.deepEqual(giveForAsk(s, 'seeds'), ['basil seeds', 'mint seeds', 'strawberry seeds']);
  assert.deepEqual(giveForAsk(s, 'tomato seeds please'), ['tomato seeds']);
  assert.deepEqual(giveForAsk(s, 'a small shovel'), ['a small shovel']);
  assert.deepEqual(giveForAsk(s, 'some bread'), ['bread']);
  assert.deepEqual(giveForAsk(s, 'a flying carpet'), []);
  assert.ok(s.pantry[0].qty >= 3, 'some bread in his pantry');
});
ok('a planter he made counts as a place to grow', () => {
  assert.ok(isGreenhouse({ name: 'wooden planter box' }));
  assert.ok(isGreenhouse({ name: 'little greenhouse' }));
  assert.ok(!isGreenhouse({ name: 'small wooden shelf' }));
});
