import { timingSafeEqual, randomBytes } from 'node:crypto';

// Saves "this is the front of that thing" (fronts/) in the repo, so Pip can learn which side of his things is the front.
// Only with the key. Uses the same Vercel environment variables as the reply service: PIP_REPLY_KEY and GITHUB_TOKEN.
// { key, check: true } only says whether the key is right (the settings page uses it).
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
  if (!expected || !process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'The service is not set up yet.' });

  const body = typeof req.body === 'string' ? parse(req.body) : req.body || {};
  if (!sameKey(body.key ?? '', expected)) return res.status(401).json({ error: 'That key is not right.' });
  if (body.check) return res.status(200).json({ ok: true });

  const target = typeof body.target === 'string' && /^[\w-]{1,60}$/.test(body.target) ? body.target : '';
  const local = Array.isArray(body.local) ? body.local.map(Number) : [];
  const quarter = local.length === 2 && local.every((v) => [-1, 0, 1].includes(v)) && Math.abs(local[0]) + Math.abs(local[1]) === 1;
  if (!target || !quarter) return res.status(400).json({ error: 'Which thing, and which side?' });
  if (Date.now() - lastCall < 800) return res.status(429).json({ error: 'Slow down a little.' });
  lastCall = Date.now();

  const id = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const put = await fetch(`https://api.github.com/repos/${REPO}/contents/fronts/${id}.json`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pip-front',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Someone showed Pip the front of a thing [skip ci]', branch: BRANCH, content: Buffer.from(JSON.stringify({ target, local, at: new Date().toISOString() })).toString('base64') }),
  });
  if (!put.ok) return res.status(502).json({ error: `Could not save it (GitHub said ${put.status}).` });
  return res.status(200).json({ ok: true });
}
