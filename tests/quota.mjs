// Phase 8 end to end, with a local fake Gemini (no key, no real calls): the first lite model is out for the day,
// the second answers. Pip must skip the first, count both, log the model and say it switched.
// Run: node tests/quota.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-quota-'));
fs.cpSync(root, work, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) && !p.includes('node_modules') });
const hits = [];
let allOut = false;
const answer = { moves: [{ move: 'rest', details: {}, thought: 'a short rest' }, { move: 'do', details: { what: 'hum a tune' } }], reason: 'I am a little tired.', mood: 'sleepy', remember: null };
const server = http.createServer((req, res) => {
  const model = req.url.match(/models\/([^:]+):/)?.[1];
  hits.push(model);
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (model === 'lite-a' || (allOut && model === 'lite-b')) {
      res.writeHead(429, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: { code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }] }] } }));
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 80 } }));
  });
}).listen(0);
await new Promise((r) => server.once('listening', r));
const env = { ...process.env, GEMINI_API_KEY: 'test', GEMINI_API_BASE: `http://127.0.0.1:${server.address().port}`, GEMINI_LITE: 'lite-a,lite-b', GEMINI_BIG: 'big-a', PIP_AWAKE: '1', PIP_NO_PHOTO: '1', PIP_NIGHT: '0' };
delete env.PIP_FAKE;
const state = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
state.inbox = (state.inbox ?? []).map((m) => ({ ...m, read: true })); // nobody wrote: a normal (lite) brain call
state.intent = { day: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }), items: [] }; // goals already set today
fs.writeFileSync(path.join(work, 'web/state.json'), JSON.stringify(state));
const run = () => new Promise((resolve, reject) => {
  import('node:child_process').then(({ execFile }) => execFile('node', ['pip.js'], { cwd: work, env, timeout: 120_000 }, (e, out, err) => (e ? reject(new Error(`${e.message}\n${out}\n${err}`)) : resolve(out))));
});
const out = await run();
const s = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
// now every model is out: Pip goes on without a model, nothing crashes
allOut = true;
const st2 = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
st2.plan.queue = [];
fs.writeFileSync(path.join(work, 'web/state.json'), JSON.stringify(st2));
await run();
const s2 = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
server.close();
assert.equal(s2.last.via, 'fallback');
assert.equal(s2.quota.out['lite-b'], s2.quota.day);
assert.ok(s2.last.steps.length >= 1);
assert.equal(s.last.via, 'brain', out);
assert.equal(s.last.model, 'lite-b');
assert.equal(s.last.fallback, true);
assert.match(s.last.modelNotes[0], /lite-b answered \(lite-a is out of quota\)/);
assert.equal(s.quota.out['lite-a'], s.quota.day);
assert.equal(s.quota.calls['lite-a'], 1);
assert.equal(s.quota.calls['lite-b'], 1);
assert.ok(!hits.includes('big-a'), 'a normal brain call does not use the big model');
console.log(`ok  out-of-quota model skipped, the next one answered: ${JSON.stringify(s.quota.calls)}, footer model ${s.last.model}; then all out: ${s2.last.via} (${s2.last.steps[0].action})`);
