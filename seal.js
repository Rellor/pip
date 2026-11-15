// Private things, sealed. The repo and the site are public, so Bas's messages, Pip's answers to him, and memories about them
// are stored encrypted (AES-256-GCM). The key is Bas's reply key: Vercel has it as PIP_REPLY_KEY, GitHub Actions as the
// secret PIP_REPLY_KEY (or PIP_PRIVATE_KEY). Without the key nothing private is read or written in plain text.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const PRIVATE = '(private)';
export const sealSecret = (env = process.env) => env.PIP_PRIVATE_KEY || env.PIP_REPLY_KEY || '';
const keyOf = (secret) => createHash('sha256').update(`pip-private:${secret}`).digest();
const b64 = (b) => Buffer.from(b).toString('base64url');

// Text -> "v1.iv.tag.data", or null without a key.
export function seal(text, secret = sealSecret()) {
  if (!secret) return null;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const data = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return `v1.${b64(iv)}.${b64(c.getAuthTag())}.${b64(data)}`;
}

// "v1...." -> text, or null (wrong key, broken, or no key).
export function unseal(blob, secret = sealSecret()) {
  if (!secret || typeof blob !== 'string' || !blob.startsWith('v1.')) return null;
  try {
    const [, iv, tag, data] = blob.split('.');
    const d = createDecipheriv('aes-256-gcm', keyOf(secret), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// The lists Pip needs back in plain text while he runs. Items with private: true are sealed on save and opened on load.
export const SEALED_LISTS = ['inbox', 'outbox', 'memories'];

// A copy of the state, ready to save: private items keep only their sealed text.
export function sealState(s, secret = sealSecret()) {
  const out = { ...s };
  for (const key of SEALED_LISTS) {
    if (!Array.isArray(s[key])) continue;
    out[key] = s[key].map((x) => {
      if (!x?.private || x.text === PRIVATE) return x;
      const enc = seal(x.text, secret);
      return { ...x, text: PRIVATE, ...(enc ? { enc } : {}) };
    });
  }
  return out;
}

// After loading: private items get their text back (in memory only).
export function unsealState(s, secret = sealSecret()) {
  for (const key of SEALED_LISTS) {
    for (const x of Array.isArray(s[key]) ? s[key] : []) {
      if (!x?.enc) continue;
      const t = unseal(x.enc, secret);
      if (t !== null) { x.text = t; delete x.enc; }
    }
  }
  return s;
}

// Fields of an object that are sealed for good (Pip does not need them back): they become PRIVATE, the real values go in .sealed.
export function sealFields(obj, fields, secret = sealSecret()) {
  if (!obj) return obj;
  const picked = Object.fromEntries(fields.filter((f) => typeof obj[f] === 'string' && obj[f] && obj[f] !== PRIVATE).map((f) => [f, obj[f]]));
  if (!Object.keys(picked).length) return obj;
  const enc = seal(JSON.stringify(picked), secret);
  for (const f of Object.keys(picked)) obj[f] = PRIVATE;
  if (enc) obj.sealed = enc;
  return obj;
}
