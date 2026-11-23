// The private chat and the visitor mailbox. No real GitHub or model: fetch is faked.
// Run: node tests/private.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seal, unseal, sealState, unsealState, PRIVATE } from '../seal.js';
import { toAnswer } from '../brain.js';

const KEY = 'a-long-test-reply-key-1234567890';
process.env.PIP_REPLY_KEY = KEY;
process.env.GITHUB_TOKEN = 'test';
const ok = async (name, fn) => { await fn(); console.log(`ok  ${name}`); };

await ok('sealed text opens only with the right key', () => {
  const e = seal('hello Pip', KEY);
  assert.equal(unseal(e, KEY), 'hello Pip');
  assert.equal(unseal(e, 'wrong'), null);
  const s = { inbox: [{ id: 'a', text: 'my secret', private: true }], outbox: [{ id: 'b', kind: 'ask', text: 'a saw' }], memories: [{ id: 'm', text: 'Someone wrote to me: "my secret"', private: true }] };
  const saved = JSON.stringify(sealState(s, KEY));
  assert.ok(!saved.includes('my secret'));
  assert.ok(saved.includes('a saw'), 'asks stay public');
  assert.equal(s.inbox[0].text, 'my secret', 'the state in memory is not changed');
  assert.equal(unsealState(JSON.parse(saved), KEY).memories[0].text, 'Someone wrote to me: "my secret"');
});

// A copy of the repo with one private message from Bas, one approved and one waiting visitor message.
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-private-'));
fs.cpSync(root, work, { recursive: true, filter: (p) => !p.includes(`${path.sep}.git`) && !p.includes('node_modules') });
fs.mkdirSync(path.join(work, 'inbox'), { recursive: true });
fs.mkdirSync(path.join(work, 'visitors'), { recursive: true });
fs.writeFileSync(path.join(work, 'inbox/m1.json'), JSON.stringify({ id: 'm1', at: new Date().toISOString(), private: true, enc: seal('The secret word is marmalade', KEY) }));
fs.writeFileSync(path.join(work, 'visitors/v1.json'), JSON.stringify({ id: 'v1', at: new Date().toISOString(), status: 'approved', name: 'Ann', text: 'Hi Pip, what is your favourite star?' }));
fs.writeFileSync(path.join(work, 'visitors/v2.json'), JSON.stringify({ id: 'v2', at: new Date().toISOString(), status: 'pending', enc: seal(JSON.stringify({ name: 'Bob', text: 'waiting' }), KEY) }));
const run = (env) => execFileSync('node', ['pip.js'], { cwd: work, env: { ...process.env, PIP_FAKE: '1', PIP_AWAKE: '1', PIP_NO_PHOTO: '1', PIP_NO_OUT: '1', PIP_NIGHT: '0', ...env }, stdio: 'pipe' });

await ok('without the key, a private message waits and nothing leaks', () => {
  run({ PIP_REPLY_KEY: '', PIP_PRIVATE_KEY: '' });
  assert.ok(fs.existsSync(path.join(work, 'inbox/m1.json')), 'the message waits in inbox/');
  assert.ok(!fs.readFileSync(path.join(work, 'web/state.json'), 'utf8').includes('marmalade'));
});

await ok('with the key, Pip reads it; the public state and diary keep it sealed', () => {
  run({ PIP_REPLY_KEY: KEY });
  const raw = fs.readFileSync(path.join(work, 'web/state.json'), 'utf8');
  assert.ok(!raw.includes('marmalade'), 'no plain text in state.json');
  assert.ok(!fs.readFileSync(path.join(work, 'diary.md'), 'utf8').includes('marmalade'));
  const s = JSON.parse(raw);
  const m = s.inbox.find((x) => x.id === 'm1');
  assert.equal(m.text, PRIVATE);
  assert.equal(unseal(m.enc, KEY), 'The secret word is marmalade');
  assert.equal(s.last.private, true);
  assert.match(fs.readFileSync(path.join(work, 'diary.md'), 'utf8'), /A private moment with Bas/);
  assert.ok(!fs.existsSync(path.join(work, 'inbox/m1.json')));
});

await ok('approved visitor messages reach Pip; waiting ones stay sealed in the folder', () => {
  const s = JSON.parse(fs.readFileSync(path.join(work, 'web/state.json'), 'utf8'));
  const real = s.visitors.filter((v) => !v.npc); // (his neighbours' notes arrive there too)
  assert.equal(real.length, 1);
  assert.equal(real[0].name, 'Ann');
  assert.ok(!fs.existsSync(path.join(work, 'visitors/v1.json')));
  assert.ok(fs.existsSync(path.join(work, 'visitors/v2.json')));
  const a = toAnswer({ moves: [{ move: 'answer_visitor', details: { id: 'v1', text: 'Betelgeuse, it bubbles!' } }] }, ['answer_visitor']);
  assert.deepEqual(a.visitor_answers, [{ id: 'v1', text: 'Betelgeuse, it bubbles!', keep: true }]);
});

// ---- the api/ functions with a fake GitHub
const files = new Map(); // path -> { content, sha }
let n = 0;
global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const p = decodeURIComponent(u.pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
  const json = (code, data) => new Response(JSON.stringify(data), { status: code });
  if (init.method === 'PUT') { const b = JSON.parse(init.body); files.set(p, { content: Buffer.from(b.content, 'base64').toString(), sha: `s${++n}` }); return json(201, {}); }
  if (init.method === 'DELETE') { files.delete(p); return json(200, {}); }
  if (init.headers?.Accept === 'application/vnd.github.raw') return files.has(p) ? new Response(files.get(p).content) : json(404, {});
  const kids = [...files.keys()].filter((k) => k.startsWith(`${p}/`)).map((k) => ({ type: 'file', name: k.slice(p.length + 1), sha: files.get(k).sha }));
  return kids.length ? json(200, kids) : json(404, {});
};
const call = async (handler, body, headers = {}) => {
  let code = 0;
  let data = null;
  const res = { status: (c) => { code = c; return res; }, json: (d) => { data = d; return res; }, setHeader: () => {} };
  await handler({ method: 'POST', body, headers: { 'x-forwarded-for': '1.2.3.4', ...headers } }, res);
  return { code, data };
};
const visit = (await import('../api/visit.js')).default;
const priv = (await import('../api/private.js')).default;

await ok('the public mailbox refuses links, bots, rushing and floods', async () => {
  assert.equal((await call(visit, { text: 'see http://spam.example', since: 9000 })).code, 400);
  assert.equal((await call(visit, { text: 'buy now', website: 'x', since: 9000 })).code, 200);
  assert.equal(files.size, 0, 'the bot message was not saved');
  assert.equal((await call(visit, { text: 'hello', since: 500 })).code, 400);
  assert.equal((await call(visit, { text: 'x'.repeat(400), since: 9000 })).code, 400);
  const good = await call(visit, { text: 'Hello Pip, I love your room!', name: 'Cas', since: 9000 });
  assert.equal(good.code, 200);
  const saved = [...files.values()][0].content;
  assert.ok(!saved.includes('love your room'), 'a waiting message is sealed (the repo is public)');
  assert.equal((await call(visit, { text: 'and again', since: 9000 })).code, 429, 'one per 10 minutes');
});

await ok('only Bas (with the key) sees and approves waiting messages', async () => {
  assert.equal((await call(priv, { key: 'wrong' })).code, 401);
  files.set('web/state.json', { content: JSON.stringify({ inbox: [{ id: 'q', private: true, text: PRIVATE, enc: seal('just for Pip', KEY) }], outbox: [] }), sha: 'st' });
  const p = await call(priv, { key: KEY });
  assert.equal(p.code, 200);
  assert.equal(p.data.messages[0].text, 'just for Pip');
  assert.equal(p.data.visitors[0].text, 'Hello Pip, I love your room!');
  assert.equal((await call(visit, { key: 'wrong', approve: p.data.visitors[0].id })).code, 401);
  assert.equal((await call(visit, { key: KEY, approve: p.data.visitors[0].id })).code, 200);
  const approved = JSON.parse([...files.entries()].find(([k]) => k.startsWith('visitors/'))[1].content);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.text, 'Hello Pip, I love your room!');
});
