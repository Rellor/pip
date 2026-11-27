// The public mailbox (api/visit.js) with a pretend GitHub: a plain message, an answer to Pip's question and a poem for
// the library shelf go in sealed, and come out as Bas approved them. Nothing here touches the real GitHub.
import assert from 'node:assert/strict';

process.env.PIP_REPLY_KEY = 'k'.repeat(24);
process.env.GITHUB_TOKEN = 'pretend';
const files = new Map(); // path -> text
globalThis.fetch = async (url, init = {}) => {
  const path = decodeURIComponent(new URL(url).pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
  const json = (status, data) => ({ ok: status < 300, status, json: async () => data, text: async () => (typeof data === 'string' ? data : JSON.stringify(data)) });
  if (init.method === 'PUT') { files.set(path, Buffer.from(JSON.parse(init.body).content, 'base64').toString()); return json(200, {}); }
  if (init.method === 'DELETE') { files.delete(path); return json(200, {}); }
  if (files.has(path)) return json(200, files.get(path));
  const inside = [...files.keys()].filter((p) => p.startsWith(`${path}/`));
  return inside.length ? json(200, inside.map((p) => ({ type: 'file', name: p.split('/').pop(), sha: 's' }))) : json(404, {});
};
const { default: handler } = await import('../api/visit.js');
const ok = (name) => console.log(`ok  ${name}`);
let n = 0;
async function post(body) {
  const res = { code: 0, data: null, setHeader() {}, status(c) { this.code = c; return this; }, json(d) { this.data = d; return this; } };
  await handler({ method: 'POST', body, headers: { 'x-forwarded-for': `10.0.0.${++n}`, 'user-agent': 'test' } }, res);
  return res;
}
const key = process.env.PIP_REPLY_KEY;
const stored = (id) => JSON.parse(files.get(`visitors/${id}.json`));

// ---- a poem for the shelf: longer than a message, it keeps its lines, and it is sealed until approved
{
  const poem = 'A heron stands in the ditch\nlike a question\n\n\n\nnobody dares to answer.';
  const sent = await post({ text: poem, name: 'Joris', title: 'Heron', shelf: 'poem', since: 9000 });
  assert.equal(sent.code, 200, JSON.stringify(sent.data));
  const waiting = stored(sent.data.id);
  assert.ok(waiting.status === 'pending' && waiting.enc && !JSON.stringify(waiting).includes('heron'), 'what waits is sealed');
  assert.equal((await post({ key, approve: sent.data.id })).code, 200);
  const out = stored(sent.data.id);
  assert.deepEqual([out.status, out.shelf, out.title, out.name], ['approved', 'poem', 'Heron', 'Joris']);
  assert.equal(out.text, 'A heron stands in the ditch\nlike a question\n\nnobody dares to answer.');
  assert.equal((await post({ text: 'x'.repeat(650), shelf: 'story', title: 'Long', since: 9000 })).code, 200, 'a story may be longer than a message');
  assert.equal((await post({ text: 'x'.repeat(701), shelf: 'story', since: 9000 })).code, 400);
  assert.equal((await post({ text: 'x'.repeat(301), since: 9000 })).code, 400, 'a plain message stays short');
  assert.equal((await post({ text: 'too short', shelf: 'poem', since: 9000 })).code, 400);
  assert.equal((await post({ text: 'A fine book, see www.example.com for more of it', shelf: 'tip', since: 9000 })).code, 400, 'no links, also not on the shelf');
  assert.equal((await post({ text: 'A fine book about herons and ditches.', title: 'see http://x.y', shelf: 'tip', since: 9000 })).code, 400);
}
ok('a poem goes in sealed, keeps its lines, and lands on the shelf only after approval');

// ---- an answer to his question carries the question's id; a made-up id is dropped
{
  const sent = await post({ text: 'A blue marble with a cloud inside.', name: 'Mila', answerTo: 'qmwyp0ctq', since: 9000 });
  assert.equal(sent.code, 200);
  await post({ key, approve: sent.data.id });
  assert.deepEqual([stored(sent.data.id).answerTo, stored(sent.data.id).shelf], ['qmwyp0ctq', undefined]);
  const odd = await post({ text: 'Hello Pip, nice house.', answerTo: '../../state', since: 9000 });
  await post({ key, approve: odd.data.id });
  assert.equal(stored(odd.data.id).answerTo, undefined);
  const plain = await post({ text: 'Hello Pip!', since: 9000 });
  await post({ key, approve: plain.data.id });
  assert.deepEqual(Object.keys(stored(plain.data.id)).sort(), ['approvedAt', 'at', 'id', 'name', 'status', 'text']);
  assert.equal((await post({ key: 'wrong', approve: plain.data.id })).code, 401);
}
ok('an answer to his question keeps the id of the question; a plain message is as it always was');
