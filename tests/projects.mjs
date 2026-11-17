// Projects move on: a project without steps gets a "plan" move, things made for it become versions
// (and tick a step), and "good enough" is offered strongly once there are versions. Fake mode, no model.
// Run: node tests/projects.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { availableMoves } from '../moves.js';
import { toAnswer as brainAnswer } from '../brain.js';

const fail = (m) => { console.log(`FAIL ${m}`); process.exit(1); };
const body = { creativity: 6, curiosity: 5, boredom: 3, loneliness: 3, tidiness: 5, coziness: 5 };
const base = { body, calm: 5, energy: 6, joy: 5, wonder: 5, fullness: 6, tools: [], decor: [], projects: [], recent: { moves: [] }, today: { done: {} }, furniture: {} };

// 1. no steps: plan_project is offered, near the top
const unplanned = { ...base, projects: [{ title: 'Build a music box', status: 'working', steps: [], versions: [], notes: [], needs: [] }] };
const offered = availableMoves(unplanned, { random: () => 0.5 }).map((m) => m.name);
if (!offered.includes('plan_project')) fail(`plan_project not offered: ${offered}`);
if (offered.indexOf('plan_project') > 2) fail(`plan_project too low: ${offered}`);
const a = brainAnswer({ moves: [{ move: 'plan_project', details: { title: 'Build a music box', steps: ['make the box', 'make the comb', 'record its tune'] } }] }, offered);
if (a.projects_update[0]?.steps?.length !== 3) fail(`plan_project gave no steps: ${JSON.stringify(a.projects_update)}`);

// 2. with versions: judge_project is offered strongly, and "do" is not on top
const made = { ...base, projects: [{ title: 'Build a music box', status: 'working', steps: [{ text: 'a', done: true }], versions: [{ v: 1 }, { v: 2 }], notes: [], needs: [] }] };
const offered2 = availableMoves(made, { random: () => 0.5 }).map((m) => m.name);
if (offered2[0] !== 'judge_project') fail(`judge_project not first: ${offered2}`);
if (offered2[0] === 'do') fail('do on top');

// 3. a real run: something made for a project becomes a version
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-projects-'));
fs.cpSync(root, work, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) && !p.includes('node_modules') });
const env = { ...process.env, PIP_FAKE: '1', PIP_AWAKE: '1', PIP_NO_PHOTO: '1' };
{ // he already has the project the fake brain makes things for, so this does not wait for luck
  const f = path.join(work, 'web/state.json');
  const st = JSON.parse(fs.readFileSync(f, 'utf8'));
  st.projects = [{ id: 'p1', title: '(fake) Learn about bees', why: 'test', steps: [{ text: 'make a bee', done: false }], needs: [], versions: [], notes: [], status: 'working', since: new Date().toISOString(), updatedAt: new Date().toISOString() }];
  fs.writeFileSync(f, JSON.stringify(st));
}
let versions = 0;
for (let i = 0; i < 40 && !versions; i++) {
  execFileSync('node', ['pip.js'], { cwd: work, env, stdio: 'pipe', timeout: 120_000 });
  const s = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
  versions = Math.max(0, ...(s.projects ?? []).map((p) => (p.versions ?? []).length));
}
if (!versions) fail('nothing made for a project became a version in 40 ticks');
{ const s = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8')); if (!(s.projects ?? []).some((p) => (p.steps ?? []).some((x) => x.done))) fail('no project step was ticked off'); }
console.log(`ok  plan_project offered and gives steps; judge_project first with versions; a made thing became v${versions}`);

// "That is enough for a first try" means done, even when proud was left empty; "not yet" stays open.
import { proudOf } from '../brain.js';
if (!proudOf('', 'It plays its little tune and the gears turn now. That is enough for a first try.')) fail('"enough for a first try" was not proud');
if (!proudOf('yes', '')) fail('yes was not proud');
if (proudOf('no', 'The lid is still crooked.')) fail('no became proud');
if (proudOf('', 'It is not good enough yet.')) fail('"not good enough yet" became proud');
console.log('ok  "good enough" counts as proud, "not yet" does not');

// Real moves written as "do": baking becomes cooking (with flour), looking up becomes a search.
import { toAnswer as answerOf } from '../brain.js';
const bake = answerOf({ moves: [{ move: 'do', details: { what: 'Mix flour, water, and a pinch of salt in my small bowl' } }] }, ['do']).steps[0];
if (bake.action !== 'cook' || !bake.details.ingredients.includes('flour')) fail(`mixing flour did not become cooking: ${JSON.stringify(bake)}`);
const look = answerOf({ moves: [{ move: 'do', details: { what: 'Look up a simple recipe for a vegetable soup' } }] }, ['do']).steps[0];
if (look.action !== 'search_web' || !/soup/.test(look.details.query)) fail(`looking up did not become a search: ${JSON.stringify(look)}`);
const dance = answerOf({ moves: [{ move: 'do', details: { what: 'do a silly little dance' } }] }, ['do']).steps[0];
if (dance.action !== 'do') fail('a dance should stay a free step');
console.log('ok  real moves written as "do" become those moves');

// Planning written as a free "do" with steps is the plan; a project without steps says how to plan it.
import { projectLines } from '../projects.js';
const freePlan = answerOf({ moves: [{ move: 'do', details: { what: 'plan the steps of my project Paint a watercolor of the stormy sky', steps: ['mix grey paint', 'paint the clouds', 'add rain'] } }] }, ['do']);
if (freePlan.projects_update[0]?.steps?.length !== 3) fail(`a free plan with steps was lost: ${JSON.stringify(freePlan.projects_update)}`);
if (!/plan_project/.test(projectLines({ projects: [{ title: 'Paint', status: 'working', steps: [], versions: [], notes: [], needs: [] }] })[0])) fail('an unplanned project does not say how to plan it');
console.log('ok  planning written as a free step is kept, and an unplanned project says how to plan it');

// "work on my project": the game turns the next step into the right move.
import { workStep } from '../projects.js';
import { cookDetails } from '../brain.js';
const proj = { projects: [{ title: 'Bake bread', status: 'working', steps: ['Look up how bread dough is kneaded', 'Mix flour and water', 'Let the dough rise by the window', 'Paint a little sign for it', 'Build a wooden bread board', 'Polish the bread board'].map((text) => ({ text, done: false })), versions: [], notes: [], needs: [] }] };
const routes = [];
for (let i = 0; i < 6; i++) { const w = workStep(proj, 'Bake bread', { cookDetails }); routes.push(w.action + (w.waits ? '(wait)' : '')); proj.projects[0].steps[i].done = true; if (w.action === 'decorate') proj.projects[0].versions.push({ v: 1, kind: 'decorate', name: 'bread board' }); }
if (routes.join() !== 'search_web,cook,do(wait),draw,decorate,change_thing') fail(`routes: ${routes}`);
if (workStep(proj, 'Bake bread') !== null) fail('a finished plan still gave a step');
console.log('ok  work_on_project: look up → search, mix → cook, let rise → wait, paint → draw, build → make, polish → change');

// "Good enough" needs most of the plan done.
import { judgeProject } from '../projects.js';
const jp = { projects: [{ title: 'Bread', status: 'working', steps: [{ text: 'a', done: true }, { text: 'b', done: false }, { text: 'c', done: false }, { text: 'd', done: false }], versions: [{ v: 1 }], notes: [], needs: [] }] };
if (judgeProject(jp, 'Bread', { proud: true, why: 'enough' }).done) fail('a project with 1 of 4 steps was finished');
jp.projects[0].steps.forEach((x, i) => { if (i < 3) x.done = true; });
if (!judgeProject(jp, 'Bread', { proud: true, why: 'enough' }).done) fail('a project with 3 of 4 steps could not be finished');
console.log('ok  "good enough" needs most of the steps done');

// A project stuck without a tool: he may ask for it even after his 2 asks today, and the project move skips it.
import { askReason, blockedProject } from '../moves.js';
const paint = { body: { creativity: 6, curiosity: 5, boredom: 3, loneliness: 3, tidiness: 5, coziness: 5 }, calm: 5, energy: 6, joy: 5, wonder: 5, fullness: 6, tools: [], decor: [], recent: { moves: [] }, furniture: {}, asks: [], today: { done: { ask_for: 2 } },
  projects: [{ title: 'Paint the sky', status: 'working', steps: [{ text: 'Paint the grey clouds', done: false }], versions: [], notes: [], needs: [] }] };
if (blockedProject(paint)?.tool !== 'drawing supplies') fail(`no blocked project: ${JSON.stringify(blockedProject(paint))}`);
if (!/drawing supplies/.test(askReason(paint) ?? '')) fail('a stuck project gives no reason to ask after 2 asks');
if (availableMoves(paint, { random: () => 0.5 }).some((m) => m.name === 'work_on_project')) fail('work_on_project offered for a step he cannot do');
paint.today.done.ask_for = 3;
if (askReason(paint)) fail('more than one extra ask a day');
console.log('ok  a project stuck without a tool: he asks for it (one extra ask), and does not keep trying');

// Mixing paint is painting, not cooking; a step whose way keeps failing waits, and he plans it again.
{
  const paintP = { projects: [{ title: 'Paint a watercolor of the stormy sky', status: 'working', steps: [{ text: 'Mix soft blues and grays for the stormy clouds', done: false }], versions: [], notes: [], needs: [] }] };
  if (workStep(paintP, 'Paint a watercolor of the stormy sky').action !== 'draw') fail('mixing paint became cooking');
  const breadP = { projects: [{ title: 'Bake bread', status: 'working', steps: [{ text: 'Mix flour, water, and a pinch of salt', done: false }], versions: [], notes: [], needs: [] }] };
  if (workStep(breadP, 'Bake bread', { cookDetails }).action !== 'cook') fail('mixing flour is no longer cooking');
  const stuck = { ...paint, today: { done: {} }, tools: [{ name: 'drawing supplies', kind: 'drawing supplies' }], projects: [{ title: 'Paint the sky', status: 'working', steps: [{ text: 'Paint the grey clouds', done: false }], versions: [], notes: [], needs: [], stuck: { text: 'Paint the grey clouds', n: 2, at: new Date().toISOString() } }] };
  const names = availableMoves(stuck, { random: () => 0.5 }).map((m) => m.name);
  if (names.includes('work_on_project')) fail('a step that failed twice is tried again');
  if (!names.includes('plan_project')) fail('he is not offered to plan it again');
  console.log('ok  mixing paint is painting; a step that failed twice waits and he plans it again');
}

import { MAX_ART_PER_DAY } from '../art.js';
// A step whose move is used up for today is not offered (it was dropped in advance, and he filled the time with pretend steps).
{
  const s = { ...paint, art: Array.from({ length: MAX_ART_PER_DAY }, () => ({ createdAt: new Date().toISOString() })), apps: [], wardrobe: [], moves: [], found: [], pictures: [], log: [], studio: { songs: [] }, today: { done: {} }, tools: [{ name: 'drawing supplies', kind: 'drawing supplies' }], projects: [{ title: 'Paint the sky', status: 'working', steps: [{ text: 'Paint the grey clouds', done: false }], versions: [], notes: [], needs: [] }] };
  if (availableMoves(s, { random: () => 0.5 }).some((m) => m.name === 'work_on_project')) fail('work_on_project offered while drawing is used up for today');
  console.log('ok  a project step whose move is used up for today waits until tomorrow');
}
