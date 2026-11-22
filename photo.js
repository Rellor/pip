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
// `recent` = his earlier photos as [{ id, data }] (data = base64 jpeg). When the new one looks almost the same as one of them, it is not kept.
export const SAME_BELOW = 4.5; // average brightness difference (0 to 255) on a small copy: the same view at another time of day is about 2 to 4, a different view 6 or more
export async function takePhoto(target, at, state, root = 'web', recent = [], camera = null) {
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
    const spec = encodeURIComponent(JSON.stringify({ target: String(target).slice(0, 60), camera }));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?photo=${spec}`, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForFunction(() => window.__photo, null, { timeout: 45_000 });
    const data = await page.evaluate(() => window.__photo);
    if (typeof data !== 'string' || !data.startsWith('data:image/jpeg;base64,')) return { failed: `the photo did not work out (${String(data).slice(0, 80)})` };
    const bytes = new Uint8Array(Buffer.from(data.split(',')[1], 'base64'));
    if (!pictureType(bytes)) return { failed: 'the photo came out empty' };
    if (recent.length) {
      const closest = await page.evaluate(async ({ now, old }) => {
        const small = async (src) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = 32;
          c.height = 24;
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0, 32, 24);
          const px = x.getImageData(0, 0, 32, 24).data;
          return Array.from({ length: 32 * 24 }, (_, k) => 0.3 * px[k * 4] + 0.59 * px[k * 4 + 1] + 0.11 * px[k * 4 + 2]);
        };
        const a = await small(now);
        let best = null;
        for (const o of old) {
          try {
            const b = await small(`data:image/jpeg;base64,${o.data}`);
            const diff = a.reduce((t, v, k) => t + Math.abs(v - b[k]), 0) / a.length;
            if (!best || diff < best.diff) best = { id: o.id, diff };
          } catch {}
        }
        return best;
      }, { now: data, old: recent });
      if (closest && closest.diff < SAME_BELOW) return { same: closest };
    }
    return { bytes };
  } catch (e) {
    return { failed: `the camera had a problem (${String(e.message).split('\n')[0].slice(0, 100)})` };
  } finally {
    await browser?.close().catch(() => {});
    server.close();
  }
}

// A look at one of his own files (a drawing or a program), the way he would see it on his screen: returns { bytes } or { failed }.
// Programs run in the same locked box as on the page (no internet), for a moment, and are shown as they look then.
export async function renderFile(file, root = 'web', { width = 800, height = 600, wait = 1200 } = {}) {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    return { failed: 'the camera is not set up on this computer' };
  }
  const server = await serve(root, '{}');
  let browser;
  try {
    browser = await pw.chromium.launch({ executablePath: process.env.PIP_CHROMIUM || undefined, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width, height } });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort()); // no internet, like on the page
    await page.goto(`http://127.0.0.1:${server.address().port}/${String(file).replace(/^\/+/, '')}`, { waitUntil: 'load', timeout: 20_000 });
    await page.waitForTimeout(wait);
    const bytes = new Uint8Array(await page.screenshot({ type: 'jpeg', quality: 80 }));
    return pictureType(bytes) ? { bytes } : { failed: 'it came out empty' };
  } catch (e) {
    return { failed: `it could not be shown (${String(e.message).split('\n')[0].slice(0, 100)})` };
  } finally {
    await browser?.close().catch(() => {});
    server.close();
  }
}

// A test run of one of his programs, like a coder runs their code. It runs in the same locked box as on the page (a
// sandboxed frame with the same safety rules: no internet, no storage), on a small screen. The run opens it, waits,
// clicks its buttons and the canvas, presses keys, and writes down what it saw:
// { errors: [..], blank, still, overflow, bytes } or { failed } (no browser on this computer).
export const APP_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'"; // the same as web/main.js
export async function testHtml(html) {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    return { failed: 'no browser to test with on this computer' };
  }
  let browser;
  const errors = [];
  try {
    browser = await pw.chromium.launch({ executablePath: process.env.PIP_CHROMIUM || undefined, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 480, height: 700 } });
    page.on('pageerror', (e) => errors.push(String(e.message).split('\n')[0].slice(0, 170)));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text().replace(/\s+/g, ' ').replace(/^Refused to (load|connect|execute)[^']*'([^']{0,60})[^']*'.*$/, 'it tried to load $2 from outside: that is blocked').slice(0, 170)); });
    await page.route(/^https?:\/\//, (r) => r.abort());
    await page.setContent('<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts" style="border:0;display:block;width:100vw;height:100vh"></iframe>');
    await page.evaluate(([doc, csp]) => { document.getElementById('f').srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}">${doc}`; }, [String(html), APP_CSP]);
    await page.waitForTimeout(900);
    const frame = page.frames().find((f) => f !== page.mainFrame());
    const look = async () => (frame ? frame.evaluate(() => ({ seen: (document.body?.innerText ?? '').trim().length + document.querySelectorAll('canvas,svg,img,button,input,select,video').length, wide: document.documentElement.scrollWidth })).catch(() => null) : null);
    const first = await look();
    const a = await page.screenshot({ type: 'png' });
    await page.waitForTimeout(600);
    const b = await page.screenshot({ type: 'png' });
    for (const sel of ['button', 'canvas', 'input', '[onclick]', 'svg', 'a']) { // press what can be pressed
      for (const el of (frame ? await frame.$$(sel).catch(() => []) : []).slice(0, 3)) { await el.click({ timeout: 400 }).catch(() => {}); await page.waitForTimeout(120); }
    }
    await page.mouse.click(240, 350).catch(() => {});
    for (const k of ['ArrowRight', 'ArrowUp', 'Space', 'Enter', 'KeyA']) { await page.keyboard.press(k).catch(() => {}); await page.waitForTimeout(70); }
    await page.waitForTimeout(500);
    const c = await page.screenshot({ type: 'png' });
    const bytes = new Uint8Array(await page.screenshot({ type: 'jpeg', quality: 75 }));
    return { errors: [...new Set(errors)].slice(0, 5), blank: first ? first.seen === 0 : false, still: a.equals(b) && b.equals(c), overflow: first && first.wide > 500 ? first.wide : 0, bytes };
  } catch (e) {
    return { errors: [...new Set([...errors, `it did not start: ${String(e.message).split('\n')[0].slice(0, 120)}`])].slice(0, 5) };
  } finally {
    await browser?.close().catch(() => {});
  }
}
export async function testApp(file, root = 'web') {
  let html;
  try { html = await readFile(join(root, String(file).replace(/^\/+/, '')), 'utf8'); } catch { return { errors: ['the file is missing'] }; }
  return testHtml(html);
}
