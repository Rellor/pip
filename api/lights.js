import { timingSafeEqual, randomBytes } from 'node:crypto';

// Saves a light command from Pip's phone on the page (lights/) in the repo; Pip's wake-up applies it (web/lights.js).
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

  const c = body.cmd && typeof body.cmd === 'object' ? body.cmd : {};
  const s = (v, n) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, n) : undefined);
  const cmd = { lamp: s(c.lamp, 60), switch: s(c.switch, 8), name: s(c.name, 30), mode: s(c.mode, 5), color: s(c.color, 20), level: s(c.level, 4), remove_timer: s(c.remove_timer, 30),
    timer: c.timer && typeof c.timer === 'object' ? { at: s(c.timer.at, 5), do: s(c.timer.do, 6), color: s(c.timer.color, 20), level: s(c.timer.level, 4) } : undefined };
  if (!cmd.lamp) return res.status(400).json({ error: 'Which lamp?' });
  if (Date.now() - lastCall < 800) return res.status(429).json({ error: 'Slow down a little.' });
  lastCall = Date.now();

  const id = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const put = await fetch(`https://api.github.com/repos/${REPO}/contents/lights/${id}.json`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pip-lights',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'A light was changed on Pip\'s phone [skip ci]', branch: BRANCH, content: Buffer.from(JSON.stringify({ cmd, at: new Date().toISOString() })).toString('base64') }),
  });
  if (!put.ok) return res.status(502).json({ error: `Could not save it (GitHub said ${put.status}).` });
  return res.status(200).json({ ok: true });
}
