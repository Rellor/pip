// Runs Pip for many ticks in fake mode (no model, no network) on a copy of the repo, and checks nothing breaks.
// Run: node tests/ticks.mjs [ticks=50]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ticks = Number(process.argv[2] ?? 50);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-ticks-'));
fs.cpSync(root, work, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) && !p.includes('node_modules') });
const env = { ...process.env, PIP_FAKE: '1', PIP_AWAKE: '1', PIP_NO_PHOTO: '1' };
const count = { brain: 0, autopilot: 0, fallback: 0 };
const moves = {};
let failed = 0;
for (let i = 1; i <= ticks; i++) {
  try {
    execFileSync('node', ['pip.js'], { cwd: work, env, stdio: 'pipe', timeout: 120_000 });
  } catch (e) {
    console.log(`FAIL tick ${i}:\n${String(e.stdout).slice(-1500)}\n${String(e.stderr).slice(-1500)}`);
    process.exit(1);
  }
  const s = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
  count[s.last.via] = (count[s.last.via] ?? 0) + 1;
  for (const st of s.last.steps ?? []) moves[st.action] = (moves[st.action] ?? 0) + 1;
  failed += (s.log ?? []).filter((e) => e.failed && Date.parse(e.at) >= Date.parse(s.last.at) - 1000).length;
}
const s = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
if (!s.recent?.moves?.length || !s.today || !s.body) { console.log('FAIL body state missing'); process.exit(1); }
console.log(`ok  ${ticks} ticks: ${JSON.stringify(count)}, ${failed} failed moves (allowed), moves: ${JSON.stringify(moves)}`);
console.log(`    work copy: ${work}`);
