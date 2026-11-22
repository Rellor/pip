// A game he builds grows a little every day: each next step of the project changes that same program.
import assert from 'node:assert/strict';
import { workStep, growGames, finishDone } from '../projects.js';

const p = { title: 'Make a tiny garden game', status: 'working', steps: [{ text: 'Make a tiny garden game: a first version', done: false }, { text: 'add a watering can that makes flowers grow', done: false }], versions: [], notes: [], needs: [] };
const s = { projects: [p], apps: [] };
assert.equal(workStep(s, p.title).action, 'make_app', 'the first version is a new program');
p.steps[0].done = true;
p.versions.push({ v: 1, kind: 'make_app', name: 'Tiny Garden' });
s.apps.push({ name: 'Tiny Garden', v: 1, file: 'made/x.html' });
const st = workStep(s, p.title);
assert.equal(st.action, 'update_app');
assert.equal(st.details.name, 'Tiny Garden');
assert.match(st.details.change, /watering can/);
console.log('ok  each next step of a game project grows that same game (update_app)');

p.steps[1].done = true;
p.versions.push({ v: 2, kind: 'update_app', name: 'Tiny Garden' });
assert.equal(finishDone(s, p.title), null, 'a game is not finished just by being made twice');
const now = Date.parse('2026-11-22T10:00:00Z');
assert.deepEqual(growGames(s, now), [p.title]);
assert.match(p.steps.at(-1).text, /add one small new thing to Tiny Garden \(version 2\)/);
assert.deepEqual(growGames(s, now + 3_600_000), [], 'one new step a day at most');
console.log('ok  when its steps are done, a game gets one new step a day');
{
  const { cleanSvg, sketchStyle } = await import('../art.js');
  const c = cleanSvg('<svg viewBox="0 0 400 300"><rect width="400" height="300" fill="#112"/><circle cx="200" cy="150" r="60" fill="#e55" stroke="#222"/><text x="150" y="270">my apple</text></svg>');
  const out = sketchStyle(c.svg, 3);
  assert.match(out, /feDisplacementMap/);
  assert.ok(!/fill="#112"/.test(out), 'a background that fills the whole picture goes: the paper shows');
  assert.equal((out.match(/<circle/g) ?? []).length, 3, 'colour layer, ink line, second ink line');
  assert.ok(!/<script|<image|href=/i.test(out), 'still only shapes');
  console.log('ok  drawings get the sketchbook look (paper, wobbly ink, colour beside the line)');
}
