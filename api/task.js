import { timingSafeEqual, randomBytes } from 'node:crypto';

// Saves something Bas asks Pip to do (tasks/) in the repo. Pip reads it at his next own wake-up and answers yes or no himself.
// Uses the same Vercel environment variables as the reply service: PIP_REPLY_KEY and GITHUB_TOKEN.
const REPO = process.env.GITHUB_REPO || 'Rellor/pip';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

const sameKey = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
const parse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
};

let lastCall = 0;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const expected = process.env.PIP_REPLY_KEY;
  if (!expected || !process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'The task service is not set up yet.' });

  const body = typeof req.body === 'string' ? parse(req.body) : req.body || {};
  if (!sameKey(body.key ?? '', expected)) return res.status(401).json({ error: 'That key is not right.' });
  // Closing a task yourself: "done" (you did it or it is finished) or "remove" (you do not want it any more).
  const closing = ['done', 'remove'].includes(body.action) ? body.action : null;
  const target = typeof body.id === 'string' && /^[\w-]{3,60}$/.test(body.id) ? body.id : '';
  if (closing && !target) return res.status(400).json({ error: 'Which task?' });
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 300) : '';
  if (!closing && !text) return res.status(400).json({ error: 'Write what you would like Pip to do.' });
  if (Date.now() - lastCall < (closing ? 800 : 3000)) return res.status(429).json({ error: 'Slow down a little.' });
  lastCall = Date.now();

  const id = closing ? `${target}~${closing}` : `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const file = closing ? { control: closing, target, at: new Date().toISOString() } : { id, at: new Date().toISOString(), text };
  const put = await fetch(`https://api.github.com/repos/${REPO}/contents/tasks/${id}.json`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pip-task',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Someone asked Pip to do something [skip ci]', branch: BRANCH, content: Buffer.from(JSON.stringify(file)).toString('base64') }),
  });
  if (!put.ok) return res.status(502).json({ error: `Could not save it (GitHub said ${put.status}).` });
  return res.status(200).json({ ok: true, id });
}
