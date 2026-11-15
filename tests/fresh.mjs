// The fresh start: only soul.md and the furniture stay; the rest is archived, and old one-time gifts do not come back.
// Run: node tests/fresh.mjs   (on a copy of the repo)
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-fresh-'));
fs.cpSync(root, work, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) && !p.includes('node_modules') });
const old = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
const soul = fs.readFileSync(path.join(work, 'soul.md'), 'utf8');
execFileSync('node', ['pip.js'], { cwd: work, env: { ...process.env, PIP_FAKE: '1', PIP_AWAKE: '1', PIP_NO_PHOTO: '1', PIP_NIGHT: '0' }, stdio: 'pipe' });
const s = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
assert.ok(s.changes.includes('2026-11-15 fresh start'));
assert.ok(JSON.parse(fs.readFileSync(path.join(work, 'web/archive/pre-fresh/state.json'), 'utf8')).memories.length > 5, 'the old state is archived');
assert.ok(fs.existsSync(path.join(work, 'web/archive/pre-fresh/diary.md')));
assert.equal(fs.readFileSync(path.join(work, 'soul.md'), 'utf8'), soul, 'his soul stays');
assert.equal(s.tools.length, 0, 'no tools (no light meter, shovel or watering can come back)');
assert.equal(s.garden.seeds.length + s.garden.plots.length, 0, 'no seeds or plants');
assert.equal((s.pantry ?? []).length, 0, 'no food');
assert.equal((s.stored ?? []).length, 0, 'an empty chest');
assert.ok(s.decor.length <= 1, 'only what he made in this one wake-up');
assert.ok(s.memories.every((m) => !/studio|piano|guitar|scarf|stool|greenhouse|rosemary/i.test(m.text)));
assert.deepEqual(s.furniture, old.furniture, 'the furniture stays where it was');
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(work, 'web/archive/index.json'), 'utf8')), [], 'the site starts with no old days');
execFileSync('node', ['pip.js'], { cwd: work, env: { ...process.env, PIP_FAKE: '1', PIP_AWAKE: '1', PIP_NO_PHOTO: '1', PIP_NIGHT: '0' }, stdio: 'pipe' });
const again = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
assert.equal(again.changes.filter((c) => c === '2026-11-15 fresh start').length, 1, 'it runs only once');
assert.ok(again.memories.some((m) => /quiet room/.test(m.text)), 'his first memory is still there');
console.log(`ok  fresh start: ${old.memories.length} memories, ${old.decor.length} things, ${old.tools.length} tools archived; work copy ${work}`);
