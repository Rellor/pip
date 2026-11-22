// The game's checks on what Pip makes: measured facts, for one retry (verify.js).
import assert from 'node:assert/strict';
import { checkDrawing, checkThing, checkAppText, checkAppRun, checkMade, drawnOften, revisionsLeft, noteRevision, revisionNote, MAX_REVISIONS_PER_DAY } from '../verify.js';
import { testHtml } from '../photo.js';

const ok = (name) => console.log(`ok  ${name}`);
const apple = '<svg viewBox="0 0 400 300"><circle cx="200" cy="160" r="70" fill="#e8584a" stroke="#222"/><path d="M200 92 C 198 75, 205 62, 214 55" fill="none" stroke="#222"/><path d="M206 80 C 225 62, 250 66, 256 78 C 236 88, 218 86, 206 80 Z" fill="#7fbf5a" stroke="#222"/><circle cx="175" cy="135" r="9" fill="#f6b3a8"/></svg>';
assert.deepEqual(checkDrawing({ name: 'red apple', svg: apple }), []);
assert.match(checkDrawing({ name: 'dot', svg: '<svg viewBox="0 0 400 300"><rect width="400" height="300" fill="#112"/><circle cx="200" cy="150" r="8" fill="#fff"/></svg>' }).join(' | '), /only 1 shape.*background/);
assert.match(checkDrawing({ name: 'tiny bug', svg: '<svg viewBox="0 0 400 300"><circle cx="200" cy="150" r="10" stroke="#222"/><circle cx="210" cy="150" r="10" stroke="#222"/><line x1="190" y1="150" x2="220" y2="150" stroke="#222"/></svg>' })[0], /it is small/);
assert.match(checkDrawing({ name: 'x', svg: '<script>alert(1)</script>' })[0], /could not be read/);
const art = Array.from({ length: 6 }, (_, i) => ({ name: `autumn window at dusk ${i}` }));
assert.equal(drawnOften(art)[0].n, 6);
assert.match(checkDrawing({ name: 'the autumn window', svg: apple }, { art }).join(' '), /I have drawn "(window|autumn|dusk)" 6 times/);
ok('drawings: empty, tiny, unreadable or the same subject again become facts; a good one passes');

const table = [{ shape: 'box', size: [0.6, 0.04, 0.5], pos: [0, 0.6, 0], color: '#8b5a2b' }, ...[[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]].map(([x, z]) => ({ shape: 'box', size: [0.04, 0.58, 0.04], pos: [x, 0.29, z], color: '#5c3a21' }))];
assert.deepEqual(checkThing({ name: 'side table', parts: table }, { maxParts: 20 }), []);
assert.match(checkThing({ name: 'reading lamp', parts: [{ shape: 'box', size: [0.2, 0.2, 0.2], pos: [0, 0.1, 0], color: '#aaaaaa' }] }, { maxParts: 20 }).join(' | '), /only 1 part.*no part of it glows/);
assert.match(checkThing({ name: 'thing', parts: 'nope' })[0], /could not be read/);
ok('things: a plain block, a lamp that does not glow or unreadable parts become facts; a good table passes');

assert.deepEqual(checkAppText('<!doctype html><button id="b">go</button><script>let n = 0; document.getElementById("b").addEventListener("click", () => { n++; });</script>'), []);
const bad = checkAppText('<!doctype html><script src="https://cdn.example.com/x.js"></script><script>localStorage.setItem("a", 1); alert("hi");</script>').join(' | ');
assert.match(bad, /storage/);
assert.match(bad, /internet/);
assert.match(bad, /alert/);
assert.match(checkAppRun({ errors: ['ReferenceError: drops is not defined'], still: true }).join(' | '), /drops is not defined.*nothing moved/);
assert.deepEqual(checkAppRun({ failed: 'no browser' }), []);
ok('programs: storage, the internet, alerts and test errors become facts');

assert.match((await checkMade('update_app', { edits: [{ find: 'zzz', replace: 'y' }] }, { current: '<p>a</p>' }))[0], /my edit did not fit/);
const s = {};
assert.equal(revisionsLeft(s), MAX_REVISIONS_PER_DAY);
for (let i = 0; i < MAX_REVISIONS_PER_DAY; i++) noteRevision(s);
assert.equal(revisionsLeft(s), 0);
assert.match(revisionNote({ name: 'x' }, ['it is small']), /MY FIRST TRY[\s\S]*- it is small[\s\S]*same JSON shape/);
ok('one retry with the facts, a few a day at most');

const run = await testHtml('<!doctype html><button id="b">go</button><p id="o">0</p><script>let n = 0; document.getElementById("b").addEventListener("click", () => { n++; document.getElementById("o").textContent = n; });</script>');
if (run.failed) console.log(`skip browser checks (${run.failed})`);
else {
  assert.deepEqual(run.errors, []);
  assert.equal(run.still, false, 'the counter changes when its button is clicked');
  assert.equal(run.blank, false);
  const st = await testHtml('<!doctype html><p>hello</p><script>localStorage.setItem("a", "1");</script>');
  assert.ok(st.errors.length, 'storage is blocked in the box, like on the page');
  assert.equal((await testHtml('<!doctype html><p>just words</p><script>document.addEventListener("click", () => {});</script>')).still, true);
  assert.match((await testHtml('<!doctype html><script>document.addEventListener("click", () => { boom(); });</script><button>x</button>')).errors.join(' '), /boom is not defined/);
  ok('the test run works in the same locked box as the page (storage is blocked, clicks are tried)');
}
