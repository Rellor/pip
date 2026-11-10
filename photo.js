// Pip's camera. It opens the website in a hidden browser, lets the page draw one picture from Pip's eye
// (the page's "photo mode"), and returns the JPEG. If the browser tools are missing, the photo simply does not work out.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pictureType } from './inbox.js';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };

// A tiny file server for web/. state.json is answered from memory, so the photo shows the room as it is right now.
function serve(root, stateJson) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        if (path === '/state.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(stateJson);
        }
        const file = normalize(join(root, path === '/' ? 'index.html' : path));
        if (!file.startsWith(normalize(root))) throw new Error('outside');
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Returns { bytes } or { failed }. `at` is when the photo is taken (the sky follows that time).
export async function takePhoto(target, at, state, root = 'web') {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    return { failed: 'the camera is not set up on this computer' };
  }
  const server = await serve(root, JSON.stringify(state));
  let browser;
  try {
    browser = await pw.chromium.launch({ executablePath: process.env.PIP_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    try {
      await page.clock.setFixedTime(new Date(at));
    } catch {}
    const spec = encodeURIComponent(JSON.stringify({ target: String(target).slice(0, 60) }));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?photo=${spec}`, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForFunction(() => window.__photo, null, { timeout: 45_000 });
    const data = await page.evaluate(() => window.__photo);
    if (typeof data !== 'string' || !data.startsWith('data:image/jpeg;base64,')) return { failed: `the photo did not work out (${String(data).slice(0, 80)})` };
    const bytes = new Uint8Array(Buffer.from(data.split(',')[1], 'base64'));
    return pictureType(bytes) ? { bytes } : { failed: 'the photo came out empty' };
  } catch (e) {
    return { failed: `the camera had a problem (${String(e.message).split('\n')[0].slice(0, 100)})` };
  } finally {
    await browser?.close().catch(() => {});
    server.close();
  }
}
