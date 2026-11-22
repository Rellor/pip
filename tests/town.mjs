// His street in 3D (web/town.js): the places Pip is seen at are free to stand on and can be walked to, and every place
// of his world has a spot in the street. (The drawing itself is checked by eye, in a real browser.)
// Run: node tests/town.mjs
import assert from 'node:assert/strict';
import { TOWN_X, TOWN_RANGE, TOWN_Z, TOWN_SPOTS, TOWN_FOR, inTown, townBlocked, atTownDoor } from '../web/town.js';
import { PLACES } from '../web/world.js';
import { PLOT } from '../web/town.js';
import { makeDecor, moveThing, updateDecor, storeAway, takeOut, outsideThings, sizeOf, setFurniture, setChest, MAX_OUTSIDE } from '../decor.js';
import { spotNote, misplaced, designate } from '../placement.js';
import { availableMoves } from '../moves.js';
import { streetData } from '../web/streetview.js';

const ok = (name) => console.log(`ok  ${name}`);
assert.ok(inTown(TOWN_X) && inTown(TOWN_X + TOWN_RANGE[0]) && !inTown(8.3) && !inTown(0), 'the street is far from his room');
for (const p of PLACES.filter((x) => x.key !== 'home')) assert.ok(TOWN_FOR[p.key] && TOWN_SPOTS[TOWN_FOR[p.key][0]], `${p.key} has a spot in the street`);
assert.deepEqual(Object.keys(TOWN_FOR).sort(), PLACES.filter((x) => x.key !== 'home').map((p) => p.key).sort());
ok('every place of his world has a spot in the street');

for (const [name, s] of Object.entries(TOWN_SPOTS)) assert.equal(townBlocked(TOWN_X + s.x, s.z, 0.2), false, `${name} is free to stand on`);
for (const to of ['shop', 'left', 'right', 'step']) { // along the pavement from his door: nothing in the way
  const a = TOWN_SPOTS.door;
  const b = TOWN_SPOTS[to];
  for (let t = 0; t <= 1; t += 0.02) assert.equal(townBlocked(TOWN_X + a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.2), false, `the way to ${to} at ${Math.round(t * 100)}%`);
}
ok('where he stands is free, and the pavement is clear from his door to every end');

assert.equal(townBlocked(TOWN_X, -3), true, 'inside his own house');
assert.equal(townBlocked(TOWN_X + 33, -2), true, 'inside the shop');
assert.equal(townBlocked(TOWN_X - 18.5, 15), true, 'inside Lina\'s house');
assert.equal(townBlocked(TOWN_X + TOWN_RANGE[1] + 1, 2), true, 'beyond the end of the street');
assert.equal(townBlocked(TOWN_X, TOWN_Z[1] + 1), true);
assert.equal(townBlocked(TOWN_X + 3, 5), false, 'the road');
assert.equal(townBlocked(TOWN_X - 30, -3), false, 'Oma Jo\'s garden can be walked into (from the street side it has a fence)');
ok('houses and the edges of the street cannot be walked through');

assert.ok(atTownDoor(TOWN_X, 0.6) && !atTownDoor(TOWN_X + 2, 0.6) && !atTownDoor(TOWN_X, 2));
assert.equal(townBlocked(TOWN_X, 0.6), false, 'the viewer can step up to his door (and so walk back into the hall)');
ok('his own door in the street is the way back in');

// ---- his plot: a field of his own across the street, for what he makes
setFurniture({});
setChest(null);
let t = Date.parse('2026-11-23T11:00:00Z');
const decor = [];
const cube = (w, h, d) => [{ shape: 'box', size: [w, h, d], pos: [0, h / 2, 0], rot: [0, 0, 0], color: '#aa7744' }];
const add = (d) => { const r = makeDecor(decor, d, (t += 60_000), t); if (r.entry) { decor.push(r.entry); for (const x of decor) { x.createdAt = new Date(t - 3 * 86_400_000).toISOString(); delete x.movedAt; delete x.changedAt; } } return r; };
const onPlot = (e) => { const [w, , d] = sizeOf(e); const x = e.pos[0] - TOWN_X; return e.kind === 'outside' && x - w / 2 >= PLOT.x0 && x + w / 2 <= PLOT.x1 && e.pos[2] - d / 2 >= PLOT.z0 && e.pos[2] + d / 2 <= PLOT.z1 && e.pos[1] === 0; };
const mill = add({ name: 'tall windmill', where: 'outside', parts: cube(2.5, 3.2, 2.5) }).entry;
assert.ok(onPlot(mill) && mill.scale === 1, `a big thing keeps its size out there: ${mill.label}`);
assert.match(mill.label, /outside on my plot/);
assert.ok(Math.abs(mill.pos[0] - TOWN_X) < 6 && mill.pos[2] < PLOT.z0 + 4, 'the first thing stands in front, across from his door');
const bench = add({ name: 'garden bench', where: 'on my plot', parts: cube(2, 1, 0.8) }).entry;
assert.ok(onPlot(bench));
const gap = Math.max(Math.abs(bench.pos[0] - mill.pos[0]) - (2.5 + 2) / 2, Math.abs(bench.pos[2] - mill.pos[2]) - (2.5 + 0.8) / 2);
assert.ok(gap >= 0.55, `things stand apart (${gap} m)`);
assert.equal(misplaced({ decor }, mill), null);
assert.deepEqual(designate({ decor }, { name: 'stone arch', where: 'outside' }), {});
ok('a thing made for his plot stands on it, at its full size, apart from the others');

for (let i = 0; i < 40; i++) decor.push({ id: `room${i}`, name: `thing ${i}`, kind: 'floor', zone: 'floor', pos: [0, 0, 0], parts: cube(0.3, 0.3, 0.3), createdAt: new Date(t - 9 * 86_400_000).toISOString() });
assert.match(add({ name: 'one more vase', parts: cube(0.3, 0.4, 0.3) }).failed, /his room is full.*outside on his plot/);
assert.ok(add({ name: 'stone arch', where: 'outside', parts: cube(3, 3, 1) }).entry, 'a full room does not close the plot');
decor.splice(decor.findIndex((d) => d.id === 'room0'), 40);
ok('a full room is no end: the plot has room');

const horse = add({ name: 'wooden horse', parts: cube(1, 1.2, 0.5), x: 0, z: 3 }).entry;
assert.equal(horse.kind, 'floor');
assert.match(moveThing(decor, null, { name: 'wooden horse', where: 'outside' }, t, t).label, /outside on my plot/);
assert.ok(onPlot(horse));
for (const x of decor) delete x.movedAt;
assert.match(moveThing(decor, null, { name: 'wooden horse', where: 'floor' }, t, t).label, /on the floor/);
assert.equal(horse.kind, 'floor');
assert.ok(Math.abs(horse.pos[0]) < 5 && Math.abs(horse.pos[2]) < 5, 'back in his room');
const grown = updateDecor(decor, { name: 'tall windmill', bigger: 1.3 }, t, t);
assert.ok(!grown.failed && onPlot(mill) && sizeOf(mill)[1] > 3.9, `out there a thing can grow: ${sizeOf(mill)}`);
const stored = [];
assert.equal(storeAway(decor, stored, 'garden bench').stored, 'garden bench');
assert.equal(takeOut(decor, stored, 'garden bench', null, t, t).entry.kind, 'outside', 'out of the chest it goes back to the plot');
ok('he can carry a thing out to his plot and back in, change it there, and store it');

const many = [];
for (let i = 0; i < MAX_OUTSIDE; i++) { const r = makeDecor(many, { name: `zorb${String.fromCharCode(97 + i)}`, where: 'outside', parts: cube(1, 2, 1) }, t, t + i); assert.ok(r.entry, `${i}: ${r.failed}`); many.push({ ...r.entry, createdAt: new Date(t - 5 * 86_400_000).toISOString() }); }
assert.ok(many.every(onPlot));
for (const a of many) for (const b of many) if (a !== b) assert.ok(Math.abs(a.pos[0] - b.pos[0]) >= 1.5 || Math.abs(a.pos[2] - b.pos[2]) >= 1.5, 'no two things overlap');
assert.match(makeDecor(many, { name: 'one too many', where: 'outside', parts: cube(1, 1, 1) }, t, t + 99).failed, /my plot is full/);
ok(`the plot holds ${MAX_OUTSIDE} things, none on top of another`);

assert.match(spotNote({ decor }, { what: 'a big wooden windmill for my plot outside' }), /outside, on my own plot.*up to 3\.7 m wide.*"where": "outside"/);
const live = { decor, energy: 8, fullness: 8, body: { creativity: 6, boredom: 3, curiosity: 4, coziness: 6 }, tools: [{ name: 'toolbox', kind: 'toolbox' }], log: [], projects: [], pantry: [], garden: { seeds: [], plots: [] } };
const line = availableMoves(live, { now: t, random: () => 0.5 }).find((m) => m.name === 'decorate')?.line ?? '';
assert.ok(line === '' || (line.length < 240 && /outside on my plot|stove|desk is full|lamp/.test(line)), line);
assert.deepEqual(streetData({ decor }, t).world.plot, outsideThings(decor).map((d) => d.name));
ok('the maker hears how big a thing can be out there, and the page lists what stands on his plot');
