// Small helpers for the api/ functions (kept outside api/, so Vercel does not serve it): the GitHub contents API (this repo only) and a safe key check.
import { timingSafeEqual } from 'node:crypto';

export const REPO = process.env.GITHUB_REPO || 'Rellor/pip';
export const BRANCH = process.env.GITHUB_BRANCH || 'main';

export const gh = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: init.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pip-site',
      'Content-Type': 'application/json',
    },
  });

export const sameKey = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export const body = (req) => {
  if (typeof req.body !== 'string') return req.body || {};
  try { return JSON.parse(req.body); } catch { return {}; }
};

// The JSON files in a folder of the repo: [{ name, sha, data }]. Missing folder: [].
export async function readDir(dir) {
  const res = await gh(`/contents/${dir}?ref=${BRANCH}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  const files = (await res.json()).filter((f) => f.type === 'file' && f.name.endsWith('.json')).slice(0, 60);
  return Promise.all(files.map(async (f) => {
    const r = await gh(`/contents/${dir}/${f.name}?ref=${BRANCH}`, { raw: true });
    let data = null;
    try { data = r.ok ? JSON.parse(await r.text()) : null; } catch {}
    return { name: f.name, sha: f.sha, data };
  }));
}

export const putFile = (path, content, message, sha) => gh(`/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, branch: BRANCH, content: Buffer.from(content).toString('base64'), ...(sha ? { sha } : {}) }) });
export const deleteFile = (path, sha, message) => gh(`/contents/${path}`, { method: 'DELETE', body: JSON.stringify({ message, branch: BRANCH, sha }) });
