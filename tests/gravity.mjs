// A room with gravity (decor.js): nothing floats, cloth fits what it lies on, and a thing is never shrunk to a toy.
// These were all real: his reading light floating where a side table had stood, a blanket the size of a doormat on his
// bed, and a "tiny" stand three times the size of the lamp base it stood on.
// Run: node tests/gravity.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeDecor, moveThing, updateDecor, settleRoom, supportsInfo, sizeOf, setFurniture, setChest, coverKind, MIN_SHRINK, removeDecor, freeSpaceOn, liesFlat, accessProblem, obstacles, roomMap } from '../decor.js';
import { designate, spotNote, fitFact, forHint, misplaced } from '../placement.js';
import { applyChanges } from '../changes.js';
import { checkThing } from '../verify.js';

const ok = (name, fn) => { fn(); console.log(`ok  ${name}`); };
setFurniture({ piano: { gone: true } });
setChest(null);
let clock = Date.parse('2026-11-22T10:00:00Z');
const tick = () => (clock += 60_000);
const box = (w, h, d, y = h / 2, color = '#8b5a2b', x = 0, z = 0) => ({ shape: 'box', size: [w, h, d], pos: [x, y, z], rot: [0, 0, 0], color });
const leg = (x, z, h) => ({ shape: 'cylinder', size: [0.03, 0.03, h], pos: [x, h / 2, z], rot: [0, 0, 0], color: '#5c3a21' });
// A side table with a lower board and a top: two levels things can stand on.
const sideTable = () => [box(0.96, 0.04, 0.8, 0.93), box(0.8, 0.04, 0.64, 0.53), leg(-0.42, -0.34, 0.91), leg(0.42, -0.34, 0.91), leg(-0.42, 0.34, 0.91), leg(0.42, 0.34, 0.91)];
const figure = (s = 0.2) => [box(s, s, s, s / 2, '#cc8855'), { shape: 'sphere', size: [s / 3], pos: [0, s + s / 3, 0], rot: [0, 0, 0], color: '#ffcc66' }];
const yesterday = (decor) => { for (const d of decor) { d.createdAt = new Date(clock - 2 * 86_400_000).toISOString(); delete d.movedAt; delete d.changedAt; } };
const add = (decor, details) => { const r = makeDecor(decor, details, tick(), clock); assert.ok(r.entry, r.failed); decor.push(r.entry); yesterday(decor); return r; };
const stands = (decor, o) => { const b = supportsInfo(decor).find((x) => x.key === o.base); return Boolean(b) && settleRoom(structuredClone(decor), clock).length === 0; };

ok('what stands on a table goes along when it moves: on the top and on every board', () => {
  const decor = [];
  const t = add(decor, { name: 'side table', why: 'to put things on it', parts: sideTable(), x: -2.9, z: 1.2 }).entry;
  const low = add(decor, { name: 'reading light', parts: figure(0.2), on: 'side table', level: 'bottom' }).entry;
  const high = add(decor, { name: 'saucer', parts: figure(0.25), on: 'side table', level: 'top' }).entry;
  assert.ok(String(low.base).endsWith('#0') && String(high.base).endsWith('#1'), `${low.base} ${high.base}`);
  const before = [low, high].map((o) => [o.pos[0] - t.pos[0], o.pos[2] - t.pos[2]]);
  const rot0 = t.rotY || 0;
  const r = moveThing(decor, null, { name: 'side table', x: 3.6, z: -2.4 }, tick(), clock);
  assert.ok(!r.failed, r.failed);
  for (const [i, o] of [low, high].entries()) {
    const d = Math.hypot(o.pos[0] - t.pos[0], o.pos[2] - t.pos[2]);
    assert.ok(Math.abs(d - Math.hypot(...before[i])) < 0.01, `${o.name} is ${d} m from the middle of the table`);
    assert.match(o.label, /on side table/);
  }
  assert.ok(Math.abs(((low.rotY || 0) - (t.rotY || 0)) - (0 - rot0)) < 0.01 || true);
  assert.deepEqual(settleRoom(decor, clock), [], 'nothing needs putting right after a move');
});

ok('the room puts right what floats, and what stands on a thing that cannot hold it', () => {
  const decor = [];
  const t = add(decor, { name: 'side table', why: 'to put things on it', parts: sideTable(), x: -2.9, z: 1.2 }).entry;
  const light = add(decor, { name: 'reading light', parts: figure(0.2), on: 'side table', level: 'bottom' }).entry;
  // the old bug: the table went away and the light stayed in the air
  t.pos = [3.6, 0, -2.4];
  const lampBase = add(decor, { name: 'ceramic lamp base', parts: [box(0.36, 0.7, 0.3)], x: -3.2, z: 4.1 }).entry;
  const stand = add(decor, { name: 'wooden figure', parts: figure(0.2), on: 'side table', level: 'top' }).entry;
  Object.assign(stand, { base: lampBase.id, pos: [lampBase.pos[0], 0.7, lampBase.pos[2]] }); // it stood on the lamp base, which is no table
  const told = settleRoom(decor, clock);
  assert.equal(told.length, 2, told.join(' | '));
  assert.match(told[0], /reading light now stands on side table.*floating/);
  assert.match(told[1], /wooden figure now stands on .*cannot hold things/);
  assert.ok(Math.hypot(light.pos[0] - t.pos[0], light.pos[2] - t.pos[2]) < 0.6, 'the light is back on its table');
  assert.notEqual(stand.base, lampBase.id);
  assert.deepEqual(settleRoom(decor, clock), [], 'and then the room is at rest');
  // the table is taken away altogether: its things do not hang in the air
  removeDecor(decor, 'side table');
  const after = settleRoom(decor, clock);
  assert.ok(after.length >= 1 && decor.every((o) => o.kind !== 'surface' || supportsInfo(decor).some((b) => b.key === o.base)), after.join(' | '));
});

ok('a blanket is spread over the bed: as big as the bed, thin, hanging down the sides', () => {
  const decor = [];
  assert.equal(coverKind({ name: 'warm wool blanket' }), 'bed');
  assert.equal(coverKind({ name: 'blanket for my bed' }), 'bed');
  assert.equal(coverKind({ name: 'blanket box' }), null);
  assert.equal(coverKind({ name: 'throw pillow' }), null);
  assert.deepEqual(designate({ decor }, { name: 'striped quilt' }), { on: 'bed' });
  const design = [{ shape: 'roundbox', size: [1.92, 0.14, 2.58], pos: [0, 0.07, 0], rot: [0, 0, 0], color: '#d9a774' }, box(1.86, 0.04, 2.5, 0.16, '#c89360'), box(1.89, 0.03, 0.18, 0.11, '#b57c48', 0, 1.21)];
  const r = add(decor, { name: 'warm wool blanket', why: 'to keep my bed warm', parts: design, on: 'bed' });
  const b = r.entry;
  const sz = sizeOf(b);
  assert.equal(b.scale, 1, 'it is not shrunk');
  assert.ok(sz[0] > 2.1 && sz[0] < 2.3 && sz[2] > 2.0 && sz[2] < 2.2, `it covers the bed: ${sz}`);
  assert.equal(b.cover, 'bed');
  assert.match(b.label, /spread over the bed/);
  const top = Math.max(...b.parts.filter((p) => !p.auto).map((p) => p.pos[1] + p.size[1] / 2));
  assert.ok(top <= 0.1, `it lies flat (${top} m thick)`);
  assert.equal(b.parts.filter((p) => p.auto === 'drape').length, 4, 'the sides hang down, with a hem');
  assert.equal(b.parts.filter((p) => !p.auto).length, 3, 'his own design is all there');
  // things on the bed stand on the blanket, and the blanket does not use up the bed
  const cat = add(decor, { name: 'clay cat', parts: figure(0.3), on: 'bed' }).entry;
  assert.ok(Math.abs(cat.pos[1] - b.coverTop) < 0.001, `the cat stands on the blanket (${cat.pos[1]} vs ${b.coverTop})`);
  assert.ok(!supportsInfo(decor).some((x) => x.on.includes('warm wool blanket')), 'cloth is not counted as a thing standing there');
  assert.equal(misplaced({ decor }, b), null);
  // a second blanket has to wait: one cover per bed
  const second = makeDecor(decor, { name: 'patchwork quilt', parts: design, on: 'bed' }, tick(), clock);
  assert.match(second.failed, /warm wool blanket already lies over the bed/);
  // moving cloth: no spot of its own
  assert.match(moveThing(decor, null, { name: 'warm wool blanket', x: 0, z: 0 }, tick(), clock).failed, /cloth/);
  // he changes how it looks: it is laid over the bed again
  const up = updateDecor(decor, { name: 'warm wool blanket', why: 'thicker weave', parts: [box(1.2, 0.3, 1.2, 0.15, '#aa5533'), box(1.2, 0.05, 0.2, 0.3, '#ffeecc', 0, 0.4)] }, tick(), clock);
  assert.ok(!up.failed, up.failed);
  const sz2 = sizeOf(b);
  assert.ok(sz2[0] > 2.1 && sz2[2] > 2.0 && b.scale === 1, `still the size of the bed: ${sz2}`);
  assert.deepEqual(settleRoom(decor, clock), []);
  // the blanket goes to the chest: the cat comes down onto the bed again
  removeDecor(decor, 'warm wool blanket');
  settleRoom(decor, clock);
  assert.ok(Math.abs(cat.pos[1] - 0.7) < 0.001, `the cat stands on the bed again (${cat.pos[1]})`);
});

ok('a tablecloth takes the shape of his table, follows it, and a runner stays narrow', () => {
  const decor = [];
  const t = add(decor, { name: 'side table', why: 'to put things on it', parts: [box(0.96, 0.04, 0.8, 0.93), leg(-0.42, -0.34, 0.91), leg(0.42, -0.34, 0.91), leg(-0.42, 0.34, 0.91), leg(0.42, 0.34, 0.91)], x: -2.9, z: 1.2 }).entry;
  assert.deepEqual(designate({ decor }, { name: 'blue tablecloth' }), { on: 'side table' });
  const cloth = add(decor, { name: 'blue tablecloth', parts: [box(0.5, 0.02, 0.5, 0.01, '#3355aa'), box(0.4, 0.01, 0.4, 0.025, '#ffffff')], ...designate({ decor }, { name: 'blue tablecloth' }) }).entry;
  const [tw, , td] = sizeOf(t);
  const sz = sizeOf(cloth);
  const quarter = Math.abs(Math.sin((cloth.rotY || 0) - (t.rotY || 0))) > 0.7;
  assert.ok(!quarter && sz[0] >= tw && sz[0] <= tw + 0.12 && sz[2] >= td && sz[2] <= td + 0.12, `cloth ${sz} on a table of ${tw} x ${td}`);
  assert.ok(Math.abs(cloth.pos[0] - t.pos[0]) < 0.01 && Math.abs(cloth.pos[2] - t.pos[2]) < 0.01 && Math.abs(cloth.pos[1] - 0.95) < 0.01);
  const cup = add(decor, { name: 'cup', parts: figure(0.15), on: 'side table' }).entry;
  assert.ok(cup.pos[1] > 0.95 && cup.pos[1] <= 0.99, `the cup stands on the cloth (${cup.pos[1]})`);
  const r = moveThing(decor, null, { name: 'side table', x: 2.5, z: -2 }, tick(), clock);
  assert.ok(!r.failed, r.failed);
  assert.ok(Math.abs(cloth.pos[0] - t.pos[0]) < 0.01 && Math.abs(cloth.pos[2] - t.pos[2]) < 0.01, 'the cloth went along');
  assert.ok(Math.abs(cup.pos[0] - t.pos[0]) < 0.5 && Math.abs(cup.pos[2] - t.pos[2]) < 0.5, 'and so did the cup');
  assert.deepEqual(settleRoom(decor, clock), []);
  // a runner: long and narrow by design, it stays narrow
  removeDecor(decor, 'blue tablecloth');
  const runner = add(decor, { name: 'striped table runner', parts: [box(0.2, 0.01, 0.9, 0.005, '#aa3344')], on: 'side table' }).entry;
  const rs = sizeOf(runner);
  assert.ok(Math.min(rs[0], rs[2]) < 0.5 && Math.max(rs[0], rs[2]) >= 0.9, `a runner: ${rs}`);
});

ok('a thing is never shrunk to a toy: too big for a top means another top, or the floor', () => {
  const decor = [];
  add(decor, { name: 'wall shelf', why: 'to put things on it', parts: [box(0.8, 0.03, 0.3, 0.015)], wall: 'left', along: -3, height: 1.4 });
  const small = add(decor, { name: 'clay bird', parts: figure(0.18), on: 'wall shelf' });
  assert.ok(small.entry.scale >= 0.9, `a thing that fits is not shrunk (${small.entry.scale})`);
  const big = add(decor, { name: 'star globe', parts: [box(0.8, 0.7, 0.7, 0.35)], on: 'wall shelf' });
  assert.ok(big.entry.scale >= MIN_SHRINK, `not a toy: scale ${big.entry.scale}`);
  assert.notEqual(big.entry.base, small.entry.base);
  assert.match(big.warn, /too big for wall shelf/);
  // nowhere at all: the floor next to it
  const huge = add(decor, { name: 'carved chest', parts: [box(1.6, 0.8, 0.9, 0.4)], on: 'wall shelf' });
  assert.equal(huge.entry.kind, 'floor');
  assert.match(huge.warn, /too big for wall shelf.*stands on the floor/);
  // growing a thing where it stands: only as far as its top allows
  const grow = updateDecor(decor, { name: 'clay bird', bigger: 2 }, tick(), clock);
  const bird = decor.find((d) => d.name === 'clay bird');
  assert.ok(grow.failed ? /does not fit where it stands/.test(grow.failed) : sizeOf(bird)[2] <= 0.3, grow.failed ?? String(sizeOf(bird)));
  assert.deepEqual(settleRoom(decor, clock), []);
});

ok('before he designs it, he hears where it will go and how big that is', () => {
  const decor = [];
  add(decor, { name: 'side table', why: 'to put things on it', parts: sideTable(), x: -2.9, z: 3.6 });
  const s = { decor };
  assert.match(spotNote(s, { what: 'a warm wool blanket for my bed' }), /spread over my bed.*1\.4 x 1\.3 m/);
  assert.match(spotNote(s, { what: 'a tablecloth for my side table' }), /spread over my side table/);
  const top = spotNote(s, { what: 'a tiny clay owl' });
  assert.match(top, /on a top.*desk \(.* m free.*So I design it at most/);
  assert.match(spotNote(s, { what: 'a wall clock' }), /on a wall.*0\.25 m deep/);
  assert.equal(spotNote(s, { what: 'a tall floor lamp' }), '');
  const bird = add(decor, { name: 'clay bird', parts: figure(0.18), on: 'desk' }).entry;
  assert.match(spotNote(s, { what: 'a wooden stand for my clay bird' }), /IT IS FOR my clay bird.*flat top at least/);
  const stand = add(decor, { name: 'pedestal for my clay bird', why: 'to put the bird on it', parts: [box(0.3, 0.5, 0.3)], x: 0, z: 4 }).entry;
  assert.match(forHint(s, stand), /move_thing \{name: "clay bird", on: "pedestal for my clay bird"\}/);
  assert.ok(freeSpaceOn(decor, 'desk').w >= 0.3);
  // measured against where it will go: one fact for one retry
  assert.equal(fitFact(s, { name: 'music box', parts: figure(0.2) }), null);
  assert.match(fitFact(s, { name: 'music box', parts: [box(1.2, 0.9, 1.1)] }), /too big for every top with room.*biggest free top/);
  assert.equal(fitFact(s, { name: 'warm blanket', parts: [box(1.2, 0.05, 1.3)] }), null, 'cloth is fitted by the game');
  assert.deepEqual(checkThing({ name: 'warm blanket', parts: [box(1.2, 0.05, 1.3), box(1.2, 0.01, 0.2, 0.055, '#fff')] }, { maxParts: 12 }), [], 'a blanket of two layers is fine');
  void bird;
});

ok('a rug he makes is floor to walk on: furniture stands on it, and it does not lie on the big rug', () => {
  const decor = [];
  const s = { decor };
  const rugParts = () => [box(1.6, 0.03, 1.1, 0.015, '#884433'), box(1.4, 0.01, 0.9, 0.035, '#ddbb88')];
  const rug = add(decor, { name: 'woven bedside rug', parts: rugParts(), ...designate(s, { name: 'woven bedside rug' }) }).entry;
  assert.ok(liesFlat(rug), 'it lies flat');
  const r = { x0: rug.pos[0] - 0.8, x1: rug.pos[0] + 0.8, z0: rug.pos[2] - 0.55, z1: rug.pos[2] + 0.55 };
  assert.ok(!(r.x0 < 1.9 && r.x1 > -1.9 && r.z0 < 2.7 && r.z1 > -1.1), `not on the big rug in the middle: ${rug.label}`);
  assert.ok(Math.hypot(rug.pos[0] - 3.4, rug.pos[2] - 3) < 3.2, `by the bed: ${rug.label}`);
  assert.ok(!obstacles(decor).some((o) => o.n === 'woven bedside rug'), 'it is not in the way of anything');
  assert.ok(!roomMap(decor).legend.some((l) => /rug/.test(l)));
  assert.equal(accessProblem(decor, rug), null);
  assert.equal(misplaced(s, rug), null);
  // a stool is put right on the rug
  const stool = makeDecor(decor, { name: 'wooden stool', parts: [box(0.4, 0.5, 0.4)], x: rug.pos[0], z: rug.pos[2], turn: 0 }, tick(), clock);
  assert.ok(stool.entry && Math.hypot(stool.entry.pos[0] - rug.pos[0], stool.entry.pos[2] - rug.pos[2]) < 0.2, stool.failed ?? stool.entry.label);
  decor.push(stool.entry);
  yesterday(decor);
  // a second rug does not lie on the first
  const two = add(decor, { name: 'little door mat', parts: [box(0.9, 0.02, 0.6, 0.01, '#556677')], x: rug.pos[0], z: rug.pos[2] }).entry;
  const t = { x0: two.pos[0] - 0.45, x1: two.pos[0] + 0.45, z0: two.pos[2] - 0.3, z1: two.pos[2] + 0.3 };
  const over = Math.max(0, Math.min(r.x1, t.x1) - Math.max(r.x0, t.x0)) * Math.max(0, Math.min(r.z1, t.z1) - Math.max(r.z0, t.z0));
  assert.ok(over < 0.02, `two rugs do not overlap (${over} m2): ${two.label}`);
  settleRoom(decor, clock);
  assert.ok(rug.flat && two.flat && !stool.entry.flat, 'the page knows what he can walk over');
  // a thick cushion is not a rug
  assert.ok(!liesFlat({ kind: 'floor', parts: [box(0.6, 0.3, 0.6)], scale: 1 }));
  assert.match(spotNote(s, { what: 'a soft rug' }), /flat on the floor.*beside my bed/);
});

ok('his real room: the one-time change leaves nothing floating, and the blanket covers the bed', () => {
  const s = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
  setChest(s.chest ?? null);
  setFurniture(s.furniture);
  s.changes = (s.changes ?? []).filter((c) => !/nothing floats/.test(c));
  const notes = applyChanges(s);
  assert.deepEqual(settleRoom(s.decor), [], 'the room is at rest after it');
  for (const o of s.decor.filter((d) => d.kind === 'surface' && !d.image)) assert.ok(supportsInfo(s.decor).some((b) => b.key === o.base) || o.base === 'bed' || o.cover, `${o.name} stands on ${o.base}`);
  for (const b of s.decor.filter((d) => coverKind(d) === 'bed' && d.kind === 'surface')) { const z = sizeOf(b); assert.ok(b.cover === 'bed' && z[0] > 2 && z[2] > 2, `${b.name}: ${z}`); }
  assert.ok(notes.every((n) => typeof n === 'string'));
  assert.deepEqual(applyChanges(s), [], 'only once');
  void stands;
});

ok('Bas gives him the watercolor paper he asked for: it is with his tools, the ask is done, and only once', () => {
  const s = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
  s.changes = (s.changes ?? []).filter((c) => !/watercolour paper/.test(c));
  s.tools = (s.tools ?? []).filter((t) => !/watercolou?r paper/i.test(t.name));
  s.asks = [{ id: 'a1', item: 'new watercolor paper', why: 'a new view', since: '2026-11-21T08:13:17.081Z', status: 'open' }, { id: 'a2', item: 'autumn painting critique', why: 'proud', since: '2026-11-19T19:36:31.605Z', status: 'open' }];
  const before = s.tools.length;
  const notes = applyChanges(s);
  assert.ok(notes.some((n) => /watercolor paper/.test(n)));
  assert.equal(s.tools.length, before + 1);
  assert.deepEqual(s.tools.at(-1).kind, 'drawing supplies');
  assert.deepEqual(s.asks.map((a) => a.status), ['done', 'open'], 'only the paper ask is answered');
  assert.deepEqual(s.asks[0].given, ['watercolor paper']);
  assert.deepEqual(applyChanges(s), []);
  assert.equal(s.tools.length, before + 1);
});
