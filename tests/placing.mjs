// Where new things go when he does not say (or only says "on the floor"): near where they are used, by a wall,
// never just in the middle of the room. Something he puts in the middle himself, he notices.
import assert from 'node:assert/strict';
import { designate, misplaced } from '../placement.js';
import { makeDecor } from '../decor.js';
const s = { decor: [], furniture: {} };
const box = (w, h, d) => [{ shape: 'box', size: [w, h, d], pos: [0, h / 2, 0], rot: [0, 0, 0] }];
const middle = (e) => Math.abs(e.pos[0]) < 2 && Math.abs(e.pos[2] - 0.8) < 2;
for (const spec of [{ name: 'small side table', where: 'floor' }, { name: 'strange sculpture', where: 'on the floor' }, { name: 'wooden rocking horse' }]) {
  const m = makeDecor(s.decor, { ...spec, ...designate(s, spec), parts: box(0.6, 0.6, 0.5) }, Date.now());
  assert.ok(m.entry, m.failed);
  assert.ok(!middle(m.entry), `${spec.name} stands in the middle: ${m.entry.label}`);
  s.decor.push(m.entry);
}
console.log('ok  "on the floor" or no place: a good spot by a wall, not the middle');
const rug = makeDecor([], { name: 'round rug', ...designate(s, { name: 'round rug' }), parts: box(1.2, 0.02, 1.2) }, Date.now());
assert.ok(rug.entry, rug.failed);
const onBigRug = rug.entry.pos[0] - 0.6 < 1.9 && rug.entry.pos[0] + 0.6 > -1.9 && rug.entry.pos[2] - 0.6 < 2.7 && rug.entry.pos[2] + 0.6 > -1.1;
assert.ok(!onBigRug, `a rug he makes does not lie on the big rug in the middle: ${rug.entry.label}`);
assert.ok(Math.hypot(rug.entry.pos[0] - 3.4, rug.entry.pos[2] - 3) < 3, `it lies by the bed: ${rug.entry.label}`);
assert.equal(misplaced(s, rug.entry), null);
console.log('ok  a rug he makes lies beside the bed, not on top of the big rug');
const put = makeDecor([], { name: 'odd stool', where: 'floor_middle', parts: box(0.4, 0.4, 0.4) }, Date.now());
assert.ok(middle(put.entry));
assert.match(misplaced(s, put.entry)?.why ?? '', /middle of the room/);
console.log('ok  he may put it in the middle himself, and then he notices it is in the way');
{
  const t = { decor: [], furniture: {} };
  const bird = { name: 'tiny clay bird', where: 'floor', parts: [{ shape: 'sphere', size: [0.08], pos: [0, 0.08, 0], rot: [0, 0, 0] }] };
  const p = designate(t, bird);
  assert.ok(p.on, `a small thing goes on something: ${JSON.stringify(p)}`);
  const m = makeDecor(t.decor, { ...bird, ...p }, Date.now());
  assert.equal(m.entry.kind, 'surface');
  console.log('ok  a small thing (a figure) goes on a shelf, table or desk, not the floor');
  const lost = makeDecor([], { name: 'little clay owl', where: 'floor', x: 3, z: -3, parts: bird.parts }, Date.now()).entry;
  assert.match(misplaced(t, lost)?.why ?? '', /small/);
  console.log('ok  a small thing he put on the floor himself: he notices');
}
{
  const d = [];
  const cup = (n) => ({ name: n, on: 'desk', parts: [{ shape: 'cylinder', size: [0.04, 0.04, 0.08], pos: [0, 0.04, 0] }] });
  const yesterday = Date.now() - 86_400_000 - 1000; // made on another day (3 new things a day)
  for (const n of ['cup one', 'cup two']) d.push(makeDecor(d, cup(n), yesterday, yesterday).entry);
  const t = makeDecor(d, { name: 'little side table', where: 'floor', x: 2, z: -2, parts: [{ shape: 'box', size: [0.8, 0.05, 0.6], pos: [0, 0.6, 0] }, { shape: 'box', size: [0.05, 0.6, 0.05], pos: [0, 0.3, 0] }], why: 'to put things on' }, yesterday, yesterday);
  d.push(t.entry);
  const m = makeDecor(d, cup('cup three'), Date.now());
  assert.ok(m.entry, m.failed);
  assert.match(m.warn, /desk was full .* so it stands on little side table/);
  console.log('ok  a full desk: it goes on the nearest top with room, and he is told');
}
{
  const { moveThing } = await import('../decor.js');
  const d = [];
  const bird = makeDecor(d, { name: 'clay owl', where: 'floor', x: 2, z: 2, parts: [{ shape: 'sphere', size: [0.08], pos: [0, 0.08, 0] }] }, Date.now()).entry;
  d.push(bird);
  const r = moveThing(d, null, { name: 'clay owl', on: 'desk' }, Date.now());
  assert.ok(!r.failed, r.failed);
  assert.equal(bird.kind, 'surface');
  console.log('ok  a small thing on the floor can be put on the desk');
}
{
  const { moveThing } = await import('../decor.js');
  const d = [];
  const base = makeDecor(d, { name: 'ceramic desk lamp base', where: 'floor', x: -3, z: 4, parts: [{ shape: 'cylinder', size: [0.15, 0.15, 0.1], pos: [0, 0.05, 0] }] }, Date.now()).entry;
  d.push(base);
  const owl = makeDecor(d, { name: 'clay owl', where: 'floor', x: 2, z: 2, parts: [{ shape: 'sphere', size: [0.06], pos: [0, 0.06, 0] }] }, Date.now()).entry;
  d.push(owl);
  const r = moveThing(d, null, { name: 'clay owl', on: 'desk' }, Date.now());
  assert.equal(owl.base, 'desk', `"desk" is the desk, not his lamp base: ${r.failed ?? r.label}`);
  console.log('ok  "on the desk" means the desk, not a thing with "desk" in its name');
  const bench = makeDecor(d, { name: 'long bench', where: 'floor', x: 1, z: 1, parts: [{ shape: 'box', size: [1.2, 0.45, 0.4], pos: [0, 0.22, 0] }] }, Date.now()).entry;
  d.push(bench);
  const w = moveThing(d, null, { name: 'long bench', next_to: 'the wall' }, Date.now());
  assert.ok(!w.failed, w.failed);
  assert.match(w.label, /by the/);
  console.log('ok  "next to the wall" puts it against the nearest wall');
}
{
  const { useSpots } = await import('../decor.js');
  const desk = useSpots().find((u) => /desk/.test(u.n));
  const [dx, dz] = [(desk.x0 + desk.x1) / 2, (desk.z0 + desk.z1) / 2];
  const tb = makeDecor([], { name: 'side table', where: 'floor', x: dx, z: dz, parts: [{ shape: 'box', size: [0.9, 0.05, 0.8], pos: [0, 0.9, 0] }, { shape: 'box', size: [0.05, 0.88, 0.05], pos: [0, 0.44, 0] }] }, Date.now());
  assert.ok(tb.entry, tb.failed);
  const r = { x0: tb.entry.pos[0] - 0.45, x1: tb.entry.pos[0] + 0.45, z0: tb.entry.pos[2] - 0.4, z1: tb.entry.pos[2] + 0.4 };
  assert.ok(!(r.x0 < desk.x1 && r.x1 > desk.x0 && r.z0 < desk.z1 && r.z1 > desk.z0), `a table never stands where he stands to use the desk: ${tb.entry.label}`);
  console.log('ok  nothing new stands where he stands to use the desk');
  const { sizeWords, box } = await import('../scale.js');
  assert.ok(Math.max(...box(sizeWords([{ shape: 'box', size: [0.44, 0.05, 0.44], pos: [0, 0.1, 0] }], 'tiny wooden stand')).size) <= 0.25 + 1e-9);
  console.log('ok  a "tiny" thing is tiny');
}
{
  const { moveThing } = await import('../decor.js');
  const d = [];
  const shelf = makeDecor(d, { name: 'wall shelf', wall: 'left', along: -3, height: 1.6, parts: [{ shape: 'box', size: [0.6, 0.03, 0.2], pos: [0, 0, 0.1] }, { shape: 'box', size: [0.6, 0.03, 0.2], pos: [0, 0.3, 0.1] }], why: 'to put things on' }, Date.now()).entry;
  d.push(shelf);
  const r = moveThing(d, null, { name: 'wall shelf', wall: 'near desk' }, Date.now());
  assert.ok(!r.failed, r.failed);
  assert.ok(Math.abs(shelf.pos[2] - 1.2) < 1.5 || Math.abs(shelf.pos[0] + 4.3) < 1.5, `near the desk: ${r.label}`);
  console.log('ok  a wall shelf moved "near the desk" hangs on the wall close to the desk');
}
{
  const { kindWord, MAX_SAME } = await import('../decor.js');
  assert.equal(kindWord('tiny wooden stand for my tiny clay bird'), 'stand');
  assert.equal(kindWord('amber reading light'), 'lamp');
  const d = [];
  const day = (i) => Date.now() - (i + 1) * 86_400_000;
  for (let i = 0; i < MAX_SAME; i++) d.push(makeDecor(d, { name: `wooden stand ${'abc'[i]}`.replace(/ .$/, ''), where: 'floor', x: -3 + i * 1.5, z: -2, parts: [{ shape: 'box', size: [0.3, 0.3, 0.3], pos: [0, 0.15, 0] }] }, day(i), day(i)).entry);
  const more = makeDecor(d, { name: 'little oak stand', where: 'floor', x: 2, z: 2, parts: [{ shape: 'box', size: [0.3, 0.3, 0.3], pos: [0, 0.15, 0] }] }, Date.now());
  assert.match(more.failed ?? '', /already have 3 things that are a stand/);
  console.log('ok  at most 3 of one kind of thing: then he improves one or puts one away');
}
