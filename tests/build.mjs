// The builder (build.js): what Pip builds holds together, and things on a shelf move along when he changes it.
import './_many.mjs';
import assert from 'node:assert/strict';
import { settle, partsNow } from '../build.js';
import { makeDecor, updateDecor, extendThing, reseat, levelCountOf } from '../decor.js';

const ok = (name, fn) => { fn(); console.log(`ok  ${name}`); };
const table = () => [
  { shape: 'roundbox', size: [0.6, 0.035, 0.5], pos: [0, 0.9, 0], rot: [0, 0, 0], color: '#8b5a2b' },
  ...[[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]].map(([x, z]) => ({ shape: 'cylinder', size: [0.03, 0.03, 0.6], pos: [x, 0.3, z], rot: [0, 0, 0], color: '#5c3a21' })),
];
const top = (p) => p.pos[1] + (p.shape === 'cylinder' ? p.size[2] : p.size[1]) / 2;
const bottom = (p) => p.pos[1] - (p.shape === 'cylinder' ? p.size[2] : p.size[1]) / 2;

ok('a table top never floats: the legs grow to meet it', () => {
  const r = settle(table());
  for (const leg of r.parts.slice(1)) assert.ok(Math.abs(top(leg) - bottom(r.parts[0])) < 0.005, `leg top ${top(leg)}`);
  for (const leg of r.parts.slice(1)) assert.ok(Math.abs(bottom(leg)) < 0.005, 'legs still stand on the floor');
  assert.equal(r.parts[0].pos[1], 0.9, 'the top stays where he put it');
  assert.ok(r.fixes.length);
});
ok('a loose block comes down onto what is under it; a light may float', () => {
  const r = settle([...table().map((p, i) => (i ? { ...p, size: [0.03, 0.03, 0.8825], pos: [p.pos[0], 0.44125, p.pos[2]] } : p)), { shape: 'box', size: [0.1, 0.1, 0.1], pos: [0, 1.3, 0], rot: [0, 0, 0] }, { shape: 'sphere', size: [0.03], pos: [0, 1.5, 0], rot: [0, 0, 0], glow: true }]);
  assert.ok(Math.abs(bottom(r.parts[5]) - top(r.parts[0])) < 0.005, `block at ${bottom(r.parts[5])}`);
  assert.equal(r.parts[6].pos[1], 1.5);
});
ok('something that already holds together is left alone', () => {
  const good = settle(table()).parts;
  const r = settle(good);
  assert.deepEqual(r.fixes, []);
  assert.deepEqual(r.parts, good);
});
ok('wall and ceiling things are not checked (they hang)', () => {
  assert.deepEqual(settle(table(), { kind: 'wall' }).fixes, []);
});
ok('changing a shelf: what stands on it moves onto the boards as they are now', () => {
  const decor = [];
  const shelf = (dy) => [
    { shape: 'box', size: [0.8, 0.04, 0.25], pos: [0, -0.3 + dy, 0.125], rot: [0, 0, 0] },
    { shape: 'box', size: [0.8, 0.04, 0.25], pos: [0, 0.1 + dy, 0.125], rot: [0, 0, 0] },
    { shape: 'box', size: [0.04, 0.8, 0.22], pos: [-0.38, 0, 0.125], rot: [0, 0, 0] },
    { shape: 'box', size: [0.04, 0.8, 0.22], pos: [0.38, 0, 0.125], rot: [0, 0, 0] },
  ];
  const m = makeDecor(decor, { name: 'little wall shelf', wall: 'back', along: 1, height: 1.5, parts: shelf(0), why: 'to put things on' }, Date.now());
  assert.ok(m.entry, m.failed);
  decor.push(m.entry);
  const cup = makeDecor(decor, { name: 'small cup', on: 'little wall shelf', level: 'top', parts: [{ shape: 'cylinder', size: [0.04, 0.04, 0.08], pos: [0, 0.04, 0] }] }, Date.now());
  assert.ok(cup.entry, cup.failed);
  decor.push(cup.entry);
  const yBefore = cup.entry.pos[1];
  const r = updateDecor(decor, { name: 'little wall shelf', parts: shelf(0.15) }, Date.now(), Date.now() + 1);
  assert.ok(!r.failed, r.failed);
  assert.deepEqual(r.reseated, ['small cup']);
  assert.ok(cup.entry.pos[1] > yBefore + 0.1, `cup at ${cup.entry.pos[1]}, was ${yBefore}`);
  assert.equal(levelCountOf(m.entry), 2);
  assert.deepEqual(reseat(decor, m.entry, 2).moved, ['small cup'], 'running it again keeps it there');
});
ok('the maker sees what he is changing', () => {
  const t = partsNow({ name: 'table', parts: settle(table()).parts }, []);
  assert.match(t, /table: 5 parts/);
  assert.match(t, /"shape":"cylinder"/);
});
ok('adding parts: new parts snap on, old parts stay', () => {
  const decor = [];
  const m = makeDecor(decor, { name: 'side table', where: 'floor', x: 1, z: 1, parts: settle(table()).parts, why: 'to put things on' }, Date.now());
  decor.push(m.entry);
  const old = JSON.stringify(m.entry.parts);
  const r = extendThing(decor, { name: 'side table', parts: [{ shape: 'box', size: [0.1, 0.1, 0.1], pos: [0, 1.4, 0] }] }, Date.now(), Date.now() + 1);
  assert.ok(!r.failed, r.failed);
  assert.equal(JSON.stringify(m.entry.parts.slice(0, 5)), old);
  assert.ok(r.fixes.length, 'the block came down onto the top');
});
ok('a big table says how many it is for; a small one too', async () => {
  const { capacityText } = await import('../sizes.js');
  assert.match(capacityText({ name: 'long dining table' }, [4.3, 0.95, 1.9]), /10 of me can sit at it \(4 on each side, 1 at each end\)/);
  assert.match(capacityText({ name: 'small side table' }, [0.96, 0.95, 0.8]), /about 3 small things fit/);
  assert.equal(capacityText({ name: 'a vase' }, [0.3, 0.5, 0.3]), '');
});
