// The public mailbox: anyone can leave Pip a short message. Nothing is shown or read by Pip until Bas approves it.
// - A visitor POSTs { text, name, since, website }. Checks: short text only, no links or code, a hidden "website" field
//   that people leave empty (bots fill it in), a few seconds on the page first, one message per 10 minutes per visitor,
//   and at most 25 waiting. The message is saved sealed (the repo is public), so unapproved words are never public.
// - Bas POSTs { key, approve: id } (the message becomes public and Pip reads it) or { key, remove: id } (gone).
// Needs the Vercel variables PIP_REPLY_KEY and GITHUB_TOKEN.
import { randomBytes, createHash } from 'node:crypto';
import { seal, unseal } from '../seal.js';
import { sameKey, body, readDir, putFile, deleteFile } from '../github.js';

const MAX_TEXT = 300;
const MAX_NAME = 30;
const MAX_WAITING = 25;
const GAP_MS = 10 * 60_000;
const seen = new Map(); // visitor (hashed address) -> last message time, for this server instance

const clean = (t, n) => String(t ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const LINKY = /(https?:|www\.|\.(com|net|org|io|nl|ru|xyz|ly|gg|app|dev)\b|<|>|\{|\}|@\w+\.\w|\[.*\]\(.*\))/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.PIP_REPLY_KEY;
  if (!key || !process.env.GITHUB_TOKEN) return res.status(501).json({ error: 'The mailbox is not open yet.' });
  const b = body(req);
  res.setHeader('Cache-Control', 'no-store');

  // Bas: approve or remove
  if (b.key !== undefined) {
    if (!sameKey(b.key, key)) return res.status(401).json({ error: 'That key is not right.' });
    const id = clean(b.approve ?? b.remove, 40);
    if (!/^[\w-]+$/.test(id)) return res.status(400).json({ error: 'Which message?' });
    const file = (await readDir('visitors')).find((f) => f.data?.id === id);
    if (!file) return res.status(404).json({ error: 'That message is not there any more.' });
    if (b.remove !== undefined) {
      const del = await deleteFile(`visitors/${file.name}`, file.sha, 'A visitor message was removed [skip ci]');
      return del.ok ? res.status(200).json({ ok: true }) : res.status(502).json({ error: `GitHub said ${del.status}` });
    }
    let v = {};
    try { v = JSON.parse(unseal(file.data.enc, key) ?? '{}'); } catch {}
    if (!v.text) return res.status(400).json({ error: 'That message could not be opened.' });
    const out = { id, at: file.data.at, status: 'approved', name: clean(v.name, MAX_NAME), text: clean(v.text, MAX_TEXT), approvedAt: new Date().toISOString() };
    const put = await putFile(`visitors/${file.name}`, JSON.stringify(out), 'Bas let a visitor message through [skip ci]', file.sha);
    return put.ok ? res.status(200).json({ ok: true }) : res.status(502).json({ error: `GitHub said ${put.status}` });
  }

  // A visitor
  const text = clean(b.text, MAX_TEXT + 1);
  const name = clean(b.name, MAX_NAME + 1);
  if (b.website) return res.status(200).json({ ok: true }); // a bot filled the hidden field: pretend it worked, save nothing
  if (!(Number(b.since) >= 4000)) return res.status(400).json({ error: 'Take a moment before you send.' });
  if (text.length < 2) return res.status(400).json({ error: 'Write a short message first.' });
  if (text.length > MAX_TEXT || name.length > MAX_NAME) return res.status(400).json({ error: `Keep it short: up to ${MAX_TEXT} letters, and a name up to ${MAX_NAME}.` });
  if (LINKY.test(text) || LINKY.test(name)) return res.status(400).json({ error: 'Plain words only, please: no links, addresses or code.' });
  const who = createHash('sha256').update(`${req.headers['x-forwarded-for'] ?? ''}|${req.headers['user-agent'] ?? ''}|${key.slice(0, 8)}`).digest('hex').slice(0, 16);
  const last = seen.get(who) ?? 0;
  if (Date.now() - last < GAP_MS) return res.status(429).json({ error: 'Thank you! One message every 10 minutes is enough.' });
  const waiting = (await readDir('visitors')).filter((f) => f.data?.status === 'pending');
  if (waiting.length >= MAX_WAITING) return res.status(429).json({ error: 'Pip\'s mailbox is full for now. Please try again later.' });
  if (waiting.some((f) => f.data?.who === who && Date.now() - Date.parse(f.data.at) < GAP_MS)) return res.status(429).json({ error: 'Thank you! One message every 10 minutes is enough.' });
  seen.set(who, Date.now());
  const id = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const file = { id, at: new Date().toISOString(), status: 'pending', who, enc: seal(JSON.stringify({ name, text }), key) };
  const put = await putFile(`visitors/${id}.json`, JSON.stringify(file), 'A visitor left Pip a message [skip ci]');
  if (!put.ok) return res.status(502).json({ error: 'The message could not be saved. Please try again later.' });
  return res.status(200).json({ ok: true, id }); // the id lets this visitor's page follow their message
}
