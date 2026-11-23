// A slow model must not freeze Pip: when the first model does not answer in time, he moves on to the next one at once
// (he used to wait for it twice, minutes long), and tries the slow one last for a while. A local fake Gemini, no real calls.
// Run: node tests/slow.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-slow-'));
fs.cpSync(root, work, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) && !p.includes('node_modules') });
const hits = [];
const answer = { reason: 'I am a little tired.', moves: [{ thought: 'a short rest', move: 'rest', details: {} }], mood: 'sleepy', remember: null };
const server = http.createServer((req, res) => {
  const model = req.url.match(/models\/([^:]+):/)?.[1];
  hits.push(model);
  req.on('data', () => {});
  req.on('end', () => {
    if (model === 'lite-a') return; // never answers
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 80 } }));
  });
}).listen(0);
await new Promise((r) => server.once('listening', r));
const env = { ...process.env, GEMINI_API_KEY: 'test', GEMINI_API_BASE: `http://127.0.0.1:${server.address().port}`, GEMINI_LITE: 'lite-a,lite-b', GEMINI_BIG: 'big-a', PIP_AWAKE: '1', PIP_NO_PHOTO: '1', PIP_NO_OUT: '1', PIP_NIGHT: '0', PIP_NO_STORY: '1', PIP_MODEL_TIMEOUT_MS: '1500' };
delete env.PIP_FAKE;
const prep = () => {
  const state = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
  state.inbox = (state.inbox ?? []).map((m) => ({ ...m, read: true }));
  state.plan = { ...(state.plan ?? {}), queue: [], decidedAt: null };
  state.intent = { day: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }), items: [] };
  state.lookBack = null;
  fs.writeFileSync(path.join(work, 'web/state.json'), JSON.stringify(state));
};
const run = () => new Promise((resolve, reject) => execFile('node', ['pip.js'], { cwd: work, env, timeout: 120_000 }, (e, out, err) => (e ? reject(new Error(`${e.message}\n${out}\n${err}`)) : resolve(out))));

prep();
const t0 = Date.now();
const out = await run();
const took = Date.now() - t0;
const s = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
assert.equal(s.last.via, 'brain', out);
assert.equal(s.last.model, 'lite-b');
assert.equal(hits.filter((m) => m === 'lite-a').length, 1, 'the slow model is tried once, not twice');
assert.ok(s.quota.slow['lite-a'] > Date.now(), 'and remembered as slow for a while');
assert.ok(took < 30_000, `the wake-up took ${took} ms`);

hits.length = 0;
prep();
await run();
const s2 = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
assert.equal(hits[0], 'lite-b', 'next time the quick model is asked first');
assert.equal(s2.last.model, 'lite-b');
server.close();
console.log(`ok  a slow model does not freeze him: one try, then the next model (${took} ms), and it goes last for a while`);
