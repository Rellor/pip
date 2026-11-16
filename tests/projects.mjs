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
