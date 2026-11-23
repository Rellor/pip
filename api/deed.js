// A small deed: a visitor of the page does one small thing in Pip's world (leaves a flower on his doorstep, puts a
// paper boat on the pond). There are no words in it, only which deed, so nothing has to be approved. It is saved as a
// small file in the repo; Pip's next wake-up reads it (strangers.js) and he finds it a while later.
// - POST { deed, website, since }. Checks: a deed from the list, the hidden "website" field left empty (bots fill it
//   in), a few seconds on the page first, one deed per 10 minutes per visitor, and at most 8 waiting.
// Needs the Vercel variables PIP_REPLY_KEY (only to tell visitors apart) and GITHUB_TOKEN.
import { randomBytes, createHash } from 'node:crypto';
import { body, readDir, putFile } from '../github.js';

const DEEDS = ['flower', 'apple', 'boat', 'doodle', 'hat', 'bookmark', 'chalk']; // (the same list as in strangers.js)
const MAX_WAITING = 8;
const GAP_MS = 10 * 60_000;
const seen = new Map(); // visitor (hashed address) -> last deed time, for this server instance

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GITHUB_TOKEN) return res.status(501).json({ error: 'This does not work yet.' });
  const b = body(req);
  res.setHeader('Cache-Control', 'no-store');
  const deed = DEEDS.includes(b.deed) ? b.deed : null;
  if (!deed) return res.status(400).json({ error: 'Which deed?' });
  if (b.website) return res.status(200).json({ ok: true }); // a bot filled the hidden field: pretend it worked, save nothing
  if (!(Number(b.since) >= 4000)) return res.status(400).json({ error: 'Take a moment first.' });
  const who = createHash('sha256').update(`${req.headers['x-forwarded-for'] ?? ''}|${req.headers['user-agent'] ?? ''}|${String(process.env.PIP_REPLY_KEY ?? '').slice(0, 8)}`).digest('hex').slice(0, 16);
  if (Date.now() - (seen.get(who) ?? 0) < GAP_MS) return res.status(429).json({ error: 'One small deed every 10 minutes is enough. Thank you!' });
  const waiting = (await readDir('visitors')).filter((f) => f.data?.status === 'deed');
  if (waiting.length >= MAX_WAITING) return res.status(429).json({ error: 'There is a lot waiting for Pip already. Try again later.' });
  if (waiting.some((f) => f.data?.deed === deed)) return res.status(409).json({ error: 'Someone just did that. Pip has not found it yet.' });
  if (waiting.some((f) => f.data?.who === who && Date.now() - Date.parse(f.data.at) < GAP_MS)) return res.status(429).json({ error: 'One small deed every 10 minutes is enough. Thank you!' });
  seen.set(who, Date.now());
  const id = `deed-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const put = await putFile(`visitors/${id}.json`, JSON.stringify({ id, status: 'deed', deed, who, at: new Date().toISOString() }), 'A visitor did a small deed in Pip\'s world [skip ci]');
  if (!put.ok) return res.status(502).json({ error: 'That did not work. Please try again later.' });
  return res.status(200).json({ ok: true, id });
}
