// Coding like a coder: small edits, a test run after each change, and a fix ticket when it breaks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyEdits } from '../apps.js';
import { addFixTicket } from '../projects.js';
import { testApp } from '../photo.js';

const html = '<!doctype html><title>t</title><script>let score = 0;\nfunction tick() { score++; }\n</script>';
const ok = applyEdits(html, [{ find: 'let score = 0;', replace: 'let score = 0;\nlet lives = 3;' }]);
assert.match(ok.html, /let lives = 3;/);
assert.match(applyEdits(html, [{ find: 'nothing like this', replace: 'x' }]).failed, /could not find/);
assert.match(applyEdits('a a', [{ find: 'a', replace: 'b' }]).failed, /more than once/);
console.log('ok  small edits change only what is needed, and say why when they do not fit');

const s = { projects: [{ title: 'Garden game', status: 'working', steps: [{ text: 'a tiny version', done: true }, { text: 'add a score', done: false }], versions: [{ kind: 'make_app', name: 'Garden' }] }], apps: [{ name: 'Garden' }] };
addFixTicket(s, 'Garden', 'ReferenceError: lives is not defined');
assert.equal(s.projects[0].steps[1].text, 'fix Garden: ReferenceError: lives is not defined');
assert.equal(s.projects[0].steps[1].from, 'test');
console.log('ok  an error becomes the first ticket on the board');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-code-'));
fs.writeFileSync(path.join(dir, 'good.html'), html);
fs.writeFileSync(path.join(dir, 'bad.html'), '<!doctype html><script>document.addEventListener("click", () => { boom(); });</script>');
const good = await testApp('good.html', dir);
if (good.failed) console.log(`skip browser test (${good.failed})`);
else {
  assert.deepEqual(good.errors, []);
  const bad = await testApp('bad.html', dir);
  assert.match(bad.errors[0], /boom is not defined/);
  console.log('ok  the test run finds errors (even ones that only happen on a click)');
}
