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
  assert.equal(s.intent.items.length, 2);
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
