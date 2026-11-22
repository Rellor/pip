// The whole of Pip, many wake-ups in a row, on a copy of his real state (web/state.json), with a fake brain that acts like
// the real model: it almost always picks the top move, so it repeats itself. The parts can each be fine and still loop
// together; this catches that. Fake mode: no model, no network, nothing is saved to the real repo.
// Run: node tests/whole.mjs [wake-ups=40]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const N = Number(process.argv[2] ?? 40);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-whole-'));
fs.cpSync(root, work, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) && !p.includes('node_modules') });
const env = { ...process.env, PIP_FAKE: '1', PIP_AWAKE: '1', PIP_NO_PHOTO: '1', PIP_NO_OUT: '1', PIP_FAKE_STYLE: 'greedy' };
const read = () => JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
const startedAt = Date.now() - 1000;
const STEP_MIN = 9; // a wake-up every 9 minutes of fake time
for (let i = 1; i <= N; i++) {
  try {
    const out = execFileSync('node', ['pip.js'], { cwd: work, env: { ...env, PIP_CLOCK_SHIFT_MIN: String(i * STEP_MIN) }, encoding: 'utf8', stdio: 'pipe', timeout: 120_000 });
    if (process.env.WHOLE_VERBOSE) for (const l of String(out).split('\n').filter((x) => x.includes('⛔'))) console.log('  ', l.slice(0, 160));
  } catch (e) {
    console.log(`FAIL wake-up ${i} crashed:\n${String(e.stdout).slice(-800)}\n${String(e.stderr).slice(-800)}`);
    process.exit(1);
  }
}
const s = read();
const log = [...(s.log ?? [])].filter((e) => Date.parse(e.at) >= startedAt);
const sig = (e) => `${e.as ?? e.action}|${String(e.what ?? e.name ?? e.lamp ?? e.query ?? e.dish ?? '').toLowerCase().slice(0, 40)}|${e.failed ? 'failed' : ''}`;
const problems = [];
// 1. the same thing over and over
let run = 1;
let worst = { n: 0, what: '' };
for (let i = 1; i < log.length; i++) {
  run = sig(log[i]) === sig(log[i - 1]) && !['walk_to', 'rest', 'eat'].includes(log[i].action) ? run + 1 : 1;
  if (run > worst.n) worst = { n: run, what: sig(log[i]) };
}
if (worst.n > 4) problems.push(`the same step ${worst.n} times in a row: ${worst.what}`);
// 2. the same failure again and again
const fails = {};
for (const e of log.filter((x) => x.failed)) { const k = `${e.action}: ${String(e.failed).slice(0, 60)}`; fails[k] = (fails[k] ?? 0) + 1; }
for (const [k, n] of Object.entries(fails)) if (n > 6) problems.push(`the same failure ${n} times: ${k}`);
// 3. mostly pretending
const free = log.filter((e) => e.action === 'do' && !e.as).length;
if (log.length >= 10 && free / log.length > 0.7) problems.push(`${free} of ${log.length} steps were free "do" steps`);
const summary = `${N} wake-ups, ${log.length} steps, longest repeat ${worst.n}, ${Object.values(fails).reduce((a, b) => a + b, 0)} failed, ${free} free do, resting: ${s.resting?.move ?? 'none'}`;
if (problems.length) {
  console.log(`FAIL ${summary}\n${problems.map((p) => `  - ${p}`).join('\n')}\n  steps: ${log.map((e) => e.as ?? e.action).join(', ')}\n  work copy: ${work}`);
  process.exit(1);
}
console.log(`ok  whole Pip: ${summary}`);
if (process.env.WHOLE_VERBOSE) console.log(`  steps: ${log.map((e) => `${e.as ?? e.action}${e.failed ? '!' : ''}`).join(', ')}\n  failures: ${JSON.stringify(fails)}\n  free do: ${log.filter((e) => e.action === 'do' && !e.as).map((e) => String(e.what).slice(0, 30)).join(' | ')}`);
