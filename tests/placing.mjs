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
assert.ok(middle(rug.entry), 'a rug belongs in the middle');
console.log('ok  a rug still goes in the middle');
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
