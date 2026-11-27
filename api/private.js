// Bas's private chat with Pip, readable only with the reply key. The repo and state.json are public, so the texts are sealed
// (seal.js); this opens them for Bas. It also lists visitor messages that wait for his approval.
// Needs the Vercel variables PIP_REPLY_KEY and GITHUB_TOKEN.
import { unseal } from '../seal.js';
import { gh, sameKey, body, readDir, BRANCH } from '../github.js';

const open = (x, key) => (x?.enc ? unseal(x.enc, key) : null) ?? x?.text ?? '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.PIP_REPLY_KEY;
  if (!key || !process.env.GITHUB_TOKEN) return res.status(501).json({ error: 'The private chat is not set up yet.' });
  if (!sameKey(body(req).key ?? '', key)) return res.status(401).json({ error: 'That key is not right.' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const r = await gh(`/contents/web/state.json?ref=${BRANCH}`, { raw: true });
    const s = r.ok ? JSON.parse(await r.text()) : {};
    const messages = [
      ...(s.inbox ?? []).filter((m) => m.private).map((m) => ({ id: m.id, at: m.at, from: 'bas', text: open(m, key), read: m.read, readAt: m.readAt, via: m.via })),
      ...(s.outbox ?? []).filter((m) => m.private).map((m) => ({ id: m.id, at: m.at, from: 'pip', kind: m.kind, text: open(m, key) })),
    ];
    // what Bas sent that Pip has not picked up yet (still in inbox/)
    const waiting = (await readDir('inbox')).filter((f) => f.data && !messages.some((m) => m.id === f.data.id)).map((f) => ({ id: f.data.id, at: f.data.at, from: 'bas', text: open(f.data, key), read: false, waiting: true }));
    const visitors = (await readDir('visitors')).filter((f) => f.data?.status === 'pending').map((f) => {
      let v = {};
      try { v = JSON.parse(unseal(f.data.enc, key) ?? '{}'); } catch {}
      return { id: f.data.id, at: f.data.at, name: v.name ?? '', text: v.text ?? '', shelf: v.shelf ?? null, title: v.title ?? '', answerTo: v.answerTo ?? null };
    });
    return res.status(200).json({ messages: [...messages, ...waiting], visitors });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
