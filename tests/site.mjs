// Loads the website with a given web folder and checks it starts without errors.
// Run: node tests/site.mjs [webDir] [screenshot.png]
// If the test machine cannot reach the CDN, set THREE_DIR to an unpacked three@0.160.0 package.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const dir = path.resolve(process.argv[2] ?? 'web');
const shot = process.argv[3];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(dir) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
if (process.env.THREE_DIR) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
    const rel = route.request().url().replace(/^.*three@[^/]+\//, '');
    const f = path.join(process.env.THREE_DIR, rel);
    return fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'text/javascript' }) : route.continue();
  });
}
await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const canvas = await page.$('canvas');
if (shot) await page.screenshot({ path: shot });
await browser.close();
server.close();
if (errors.length) { console.log('FAIL page errors:\n' + errors.join('\n')); process.exit(1); }
if (!canvas) { console.log('FAIL no 3D canvas on the page'); process.exit(1); }
console.log('ok  site loads with', path.relative(process.cwd(), dir) || '.');
