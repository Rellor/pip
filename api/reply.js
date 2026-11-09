import { timingSafeEqual, randomBytes } from 'node:crypto';

// Receives Bas's reply from the app and saves it in the repo (inbox/). It does not wake Pip: he reads it at his next own wake-up.
// Needs these Vercel environment variables: PIP_REPLY_KEY (long secret) and GITHUB_TOKEN (fine-grained, this repo only).
const REPO = process.env.GITHUB_REPO || 'Rellor/pip';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

const gh = (path, init) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pip-reply',
      'Content-Type': 'application/json',
    },
  });

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
  if (!expected || !process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'The reply service is not set up yet.' });

  const body = typeof req.body === 'string' ? parse(req.body) : req.body || {};
  if (!sameKey(body.key ?? '', expected)) return res.status(401).json({ error: 'That key is not right.' });
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 1000) : '';
  if (!text) return res.status(400).json({ error: 'Write something first.' });
  if (Date.now() - lastCall < 3000) return res.status(429).json({ error: 'Slow down a little.' });
  lastCall = Date.now();

  const id = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const file = { id, at: new Date().toISOString(), text };
  const put = await gh(`/contents/inbox/${id}.json`, {
    method: 'PUT',
    body: JSON.stringify({ message: 'Bas wrote to Pip', branch: BRANCH, content: Buffer.from(JSON.stringify(file)).toString('base64') }),
  });
  if (!put.ok) return res.status(502).json({ error: `Could not save the message (GitHub said ${put.status}).` });

  return res.status(200).json({ ok: true, id });
}
