import { timingSafeEqual } from 'node:crypto';
import { ntfyPoll, isFromBas, ntfyText } from '../inbox.js';

// Shows messages Bas typed in the ntfy app in the web chat straight away (Pip reads them at his next wake-up).
// Needs the Vercel variables PIP_REPLY_KEY and NTFY_TOPIC.
const sameKey = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const expected = process.env.PIP_REPLY_KEY;
  const topic = process.env.NTFY_TOPIC;
  if (!expected || !topic) return res.status(501).json({ error: 'The ntfy link is not set up yet.' });
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!sameKey(body?.key ?? '', expected)) return res.status(401).json({ error: 'That key is not right.' });
  try {
    const events = await ntfyPoll(topic, '12h');
    const messages = events
      .filter(isFromBas)
      .slice(-20)
      .map((e) => ({ id: `ntfy-${e.id}`, at: new Date(Number(e.time) * 1000).toISOString(), text: ntfyText(e) || '(a picture)', picture: Boolean(e.attachment) }));
    return res.status(200).json({ messages });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
