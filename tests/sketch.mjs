// Plan first, then build (sketch.js): the small model guesses the size, the game does a dry run in the real place, and
// only then the smart model is asked, with the size that fits as its budget.
import assert from 'node:assert/strict';
import { sketchPrompt, fakeSketch, cleanSketch, dryRun, budgetNote, keepWithin, SHRINK } from '../sketch.js';
import { box as boxOf } from '../scale.js';
import { makeDecor, setFurniture, setChest } from '../decor.js';

const ok = (name) => console.log(`ok  ${name}`);
setFurniture({});
setChest(null);
const t = Date.parse('2026-11-23T11:00:00Z');
const old = new Date(t - 5 * 86_400_000).toISOString();
const state = (decor = []) => ({ decor, stored: [], tools: [] });

// ---- the question for the small model, and its answer made safe
assert.match(sketchPrompt({ what: 'a big map of the stars for my wall', where: 'back wall' }), /a big map of the stars for my wall[\s\S]*back wall[\s\S]*"wide"/);
assert.deepEqual(cleanSketch({ wide: 1.5, high: 1, deep: 0.1 }, {}), { wide: 1.5, high: 1, deep: 0.1 });
assert.deepEqual(cleanSketch({ wide: 'huge', high: -3 }, { what: 'a small mug' }), fakeSketch({ what: 'a small mug' }), 'a broken answer falls back to a guess from his words');
assert.ok(cleanSketch({ wide: 900, high: 900, deep: 900 }, {}).wide <= 20);
ok('the small model is only asked for a size, and a broken answer cannot break the plan');

// ---- an empty room: the sketched size fits as it is, and that is the budget
const free = dryRun(state(), { what: 'a wooden stool', where: 'floor' }, { wide: 0.5, high: 0.5, deep: 0.5 }, t);
assert.ok(free.ok && free.shrunk === 1 && free.budget.every((v) => v > 0.2 && v < 1.2), JSON.stringify(free));
assert.match(budgetNote(free), /at most .* m wide, .* m high and .* m deep[\s\S]*Bigger does not fit/);
assert.equal(budgetNote({ ok: false }), '');
ok('it fits: the smart model gets the size as its budget');

// ---- walls that are full: a big wall thing only fits smaller, or not at all, and that is known before the smart call
const full = [];
const hang = (i, w, h) => { const r = makeDecor(full, { name: `wall picture ${'abcdefghijklmnop'[i]}`, why: 'x', where: i % 2 ? 'wall_left' : 'wall_back', parts: [{ shape: 'box', size: [w, h, 0.06], pos: [0, h / 2, 0], rot: [0, 0, 0], color: '#a55' }] }, t, t + i); if (r.entry) full.push({ ...r.entry, createdAt: old }); return r; };
let hung = 0;
for (let i = 0; i < 16; i++) if (hang(i, 1.9, 1.4).entry) hung++;
assert.ok(hung >= 2, `some big pictures hang (${hung})`);
const tight = dryRun(state(full), { what: 'a huge wall map of the stars', where: 'wall_back' }, { wide: 2, high: 1.6, deep: 0.08 }, t);
if (tight.ok) {
  assert.ok(tight.shrunk < 1, 'on full walls only a smaller one fits');
  assert.match(budgetNote(tight), /smaller than I first thought/);
} else assert.match(tight.why, /wall|room|place|fit/i);
ok(`full walls: the plan says so before the smart model is asked (${tight.ok ? `it fits at ${Math.round(tight.shrunk * 100)}%` : 'nothing fits'})`);

// ---- a reason that is not about size stops at once
const many = Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, name: `thing ${i}`, kind: 'floor', zone: 'floor', pos: [0, 0, 0], parts: [{ shape: 'box', size: [0.3, 0.3, 0.3], pos: [0, 0.15, 0], rot: [0, 0, 0], color: '#888' }], createdAt: old }));
const stuffed = dryRun(state(many), { what: 'one more vase' }, { wide: 0.2, high: 0.3, deep: 0.2 }, t);
assert.ok(!stuffed.ok && /full/i.test(stuffed.why), JSON.stringify(stuffed));
ok('a full room stops the plan with the reason, and no size is tried in vain');
assert.deepEqual(SHRINK, [...SHRINK].sort((a, b) => b - a), 'the biggest size is tried first');

// ---- after the design: bigger than the budget is made smaller, its shape kept
const big = [{ shape: 'box', size: [3, 2, 0.2], pos: [0, 1, 0], rot: [0, 0, 0], color: '#888' }, { shape: 'box', size: [0.4, 0.4, 0.4], pos: [0, 2.2, 0], rot: [0, 0, 0], color: '#888' }];
const kept = keepWithin(big, [1.5, 1.2, 0.3]);
const size = boxOf(kept).size;
assert.ok(size[0] <= 1.51 && size[1] <= 1.21, `made smaller to fit: ${size}`);
assert.ok(Math.abs(size[0] / size[1] - boxOf(big).size[0] / boxOf(big).size[1]) < 0.01, 'its shape is the same');
assert.equal(keepWithin(big, [5, 5, 5]), big, 'small enough: left as it is');
assert.equal(keepWithin(big, null), big);
ok('a design that came out too big is shrunk to what was shown to fit');
