import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pictureType } from './inbox.js';

const ROOT = fileURLToPath(new URL('./', import.meta.url));
const WEB = resolve(ROOT, 'web');
const PORT = Number(process.env.PORT) || 4321;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };

let waking = false;
let lastError = null;

function wake() {
  if (waking) return;
  waking = true;
  lastError = null;
  const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'pip.js'], { cwd: ROOT });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  child.on('close', (code) => {
    waking = false;
    if (code !== 0) lastError = out.trim().split('\n').pop().slice(0, 200);
  });
}

async function readState() {
  try {
    return JSON.parse(await readFile(resolve(WEB, 'state.json'), 'utf8'));
  } catch {
    return {};
  }
}

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/state') {
    return json(res, 200, { ...(await readState()), _waking: waking, _error: lastError });
  }
  if (url.pathname === '/api/wake' && req.method === 'POST') {
    wake();
    return json(res, 202, { ok: true });
  }
  if (url.pathname === '/api/reply' && req.method === 'POST') {
    // Local version of the reply service: same inbox file, no key needed on your own Mac.
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 3_500_000) return json(res, 413, { error: 'Too big.' });
    }
    let text = '';
    let picture = null;
    try {
      const body = JSON.parse(raw);
      text = String(body.text ?? '').trim().slice(0, 1000);
      if (typeof body.image === 'string' && body.image) picture = Buffer.from(body.image, 'base64');
    } catch {}
    const type = picture ? pictureType(new Uint8Array(picture)) : null;
    if (picture && !type) return json(res, 400, { error: 'That picture is not a small JPEG or PNG.' });
    if (!text && !picture) return json(res, 400, { error: 'Write something first.' });
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await mkdir(resolve(ROOT, 'inbox'), { recursive: true });
    if (picture) await writeFile(resolve(ROOT, 'inbox', `${id}.${type.ext}`), picture);
    await writeFile(resolve(ROOT, 'inbox', `${id}.json`), JSON.stringify({ id, at: new Date().toISOString(), text, ...(picture ? { image: `${id}.${type.ext}` } : {}) }));
    wake();
    return json(res, 200, { ok: true, id });
  }
  const file = resolve(WEB, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(WEB + sep)) return json(res, 403, { error: 'no' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    json(res, 404, { error: 'not found' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Pip's room: http://localhost:${PORT}`);
  const every = Number(process.env.AUTO_WAKE_MIN);
  if (every > 0) {
    console.log(`Pip wakes up by himself every ${every} minutes.`);
    setInterval(wake, every * 60_000);
  }
});
