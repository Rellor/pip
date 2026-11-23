// His street in 3D (web/town.js): the places Pip is seen at are free to stand on and can be walked to, and every place
// of his world has a spot in the street. (The drawing itself is checked by eye, in a real browser.)
// Run: node tests/town.mjs
import assert from 'node:assert/strict';
import { TOWN_X, TOWN_RANGE, TOWN_Z, TOWN_SPOTS, TOWN_FOR, ROUTES, POND, HILL, WORLD_RANGE, groundAt, inTown, townBlocked, atTownDoor, buildProblem, buildPlace, WORLD, BUILDINGS, WALLS, rectOf, artSpot } from '../web/town.js';
import { PLACES } from '../web/world.js';
import { PLOT } from '../web/town.js';
import { makeDecor, moveThing, updateDecor, storeAway, takeOut, outsideThings, sizeOf, setFurniture, setChest, MAX_OUTSIDE, isOutside, outsideChoice, outsideIn } from '../decor.js';
import { spotNote, misplaced, designate } from '../placement.js';
import { availableMoves } from '../moves.js';

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

// every place has a way there from his door, corner by corner, with nothing in the way
for (const [place, [spot]] of Object.entries(TOWN_FOR)) {
  const path = ['door', ...(ROUTES[place] ?? []), spot];
  for (const n of path) assert.ok(TOWN_SPOTS[n], `${place}: ${n} is a spot`);
  for (let i = 0; i < path.length - 1; i++) {
    const a = TOWN_SPOTS[path[i]];
    const b = TOWN_SPOTS[path[i + 1]];
    for (let k = 0; k <= 1; k += 0.02) assert.equal(townBlocked(TOWN_X + a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, 0.2), false, `${place}: from ${path[i]} to ${path[i + 1]} at ${Math.round(k * 100)}%`);
  }
}
assert.equal(townBlocked(TOWN_X + POND.x, POND.z), true, 'nobody walks on the water');
assert.ok(groundAt(HILL.x, HILL.z) > 8 && groundAt(TOWN_SPOTS.hill.x, TOWN_SPOTS.hill.z) > 7.5, 'the top of the hill is high');
assert.equal(groundAt(0, 1), 0);
assert.equal(groundAt(TOWN_SPOTS.pond.x, TOWN_SPOTS.pond.z), 0, 'the pond lies on flat ground');
assert.ok(groundAt(TOWN_SPOTS.hillBend.x, TOWN_SPOTS.hillBend.z) > 1 && groundAt(TOWN_SPOTS.hillBend.x, TOWN_SPOTS.hillBend.z) < groundAt(TOWN_SPOTS.hill.x, TOWN_SPOTS.hill.z), 'the path climbs');
assert.ok(inTown(TOWN_X + WORLD_RANGE[0]) && inTown(TOWN_X + WORLD_RANGE[1]));
ok('the park, the pond, the hill and the library: a clear way to each, and the hill is a real hill');

assert.equal(townBlocked(TOWN_X, -3), true, 'inside his own house');
assert.equal(townBlocked(TOWN_X + 33, -2), true, 'inside the shop');
assert.equal(townBlocked(TOWN_X - 18.5, 15), true, 'inside Lina\'s house');
assert.equal(townBlocked(TOWN_X + WORLD_RANGE[1] + 1, 2), true, 'beyond the end of the world');
assert.equal(townBlocked(TOWN_X + 57, -4), true, 'inside the library');
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
assert.match(add({ name: 'one more vase', parts: cube(0.3, 0.4, 0.3) }).failed, /his room is full.*it can stand outside/);
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
for (let i = 0; i < MAX_OUTSIDE; i++) { const r = makeDecor(many, { name: `zorb${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, where: 'outside', parts: cube(1, 2, 1) }, t, t + i); assert.ok(r.entry, `${i}: ${r.failed}`); many.push({ ...r.entry, createdAt: new Date(t - 5 * 86_400_000).toISOString() }); }
assert.ok(many.every(onPlot));
for (const a of many) for (const b of many) if (a !== b) assert.ok(Math.abs(a.pos[0] - b.pos[0]) >= 1.5 || Math.abs(a.pos[2] - b.pos[2]) >= 1.5, 'no two things overlap');
assert.match(makeDecor(many, { name: 'one too many', where: 'outside', parts: cube(1, 1, 1) }, t, t + 99).failed, /40 things of mine outside/);
ok(`the plot holds ${MAX_OUTSIDE} things, none on top of another`);

{
  const note = spotNote({ decor }, { what: 'a big wooden windmill for my plot outside' });
  assert.match(note, /a place I pick myself[\s\S]*"outside by the pond"[\s\S]*bigger than a house[\s\S]*"metres"/);
  assert.ok(!/library|hill/.test(note), 'only places he knows the way to are named');
  assert.match(spotNote({ decor, world: { open: { hill: true }, known: { library: true } } }, { what: 'a tower', where: 'outside on top of the hill' }), /on top of the hill[\s\S]*by the library[\s\S]*I said: "outside on top of the hill"/);
  assert.equal(spotNote({ decor }, { what: 'a small painting of the pond' }).includes('a place I pick myself'), false, 'a thing about the pond is not a thing by the pond');
}
const live = { decor, energy: 8, fullness: 8, body: { creativity: 6, boredom: 3, curiosity: 4, coziness: 6 }, tools: [{ name: 'toolbox', kind: 'toolbox' }], log: [], projects: [], pantry: [], garden: { seeds: [], plots: [] } };
const line = availableMoves(live, { now: t, random: () => 0.5 }).find((m) => m.name === 'decorate')?.line ?? '';
assert.ok(line === '' || (line.length < 240 && /outside at a place I pick|stove|desk is full|lamp/.test(line)), line);
ok('the maker hears how big a thing can be out there');

// ---- He builds anywhere in his world: he names the place, and it stands there when it fits (web/town.js, decor.js)
{
  const part = (w, h, d) => { const k = 2 / Math.max(w, h, d); return [{ shape: 'box', size: [w * k, h * k, d * k], pos: [0, (h * k) / 2, 0], rot: [0, 0, 0], color: '#c96' }]; };
  const world = [];
  let n = 0;
  const build = (name, where, w, h, d, extra = {}) => { const r = makeDecor(world, { name, why: 'x', where, parts: part(w, h, d), metres: Math.max(w, h, d), ...extra }, t, t + n++); if (r.entry) world.push({ ...r.entry, createdAt: new Date(t - 5 * 86_400_000).toISOString() }); return r; };
  const at = (e) => [e.pos[0] - TOWN_X, e.pos[2]];
  const foot = (e) => { const [w, , d] = sizeOf(e); const [x, z] = at(e); return [x - w / 2, x + w / 2, z - d / 2, z + d / 2]; };

  const light = build('tall lighthouse', 'outside by the pond', 5, 16, 5).entry;
  assert.ok(light && light.kind === 'outside' && light.spot === 'pond' && /by the pond/.test(light.label));
  assert.deepEqual(sizeOf(light).map(Math.round), [5, 16, 5], 'as big as he said: higher than every house');
  assert.ok(Math.hypot(at(light)[0] - POND.x, at(light)[1] - POND.z) < 22 && ((at(light)[0] - POND.x) / POND.rx) ** 2 + ((at(light)[1] - POND.z) / POND.rz) ** 2 > 1, 'beside the water, not in it');
  const robot = build('giant robot', 'outside in the street in front of my house', 7, 12, 5).entry;
  assert.ok(robot && Math.abs(at(robot)[0]) < 6 && at(robot)[1] > 2.5 && at(robot)[1] < 9, `on the road before his door: ${at(robot)}`);
  const whale = build('big whale', 'outside left of the pond', 8, 4, 5).entry;
  assert.ok(whale && at(whale)[0] < POND.x - POND.rx, 'left of the pond is left of it');
  const arch = build('garden arch', 'outside behind the pond', 4, 4, 1).entry;
  assert.ok(arch && at(arch)[1] < POND.z - POND.rz);
  ok('he names the place and it stands there: by the pond, in the street, on the side he says, bigger than a house');

  // on the hill it stands on the ground as it is
  const tower = build('stone tower', 'outside on top of the hill', 4, 10, 4, { worldOpen: ['pond', 'hill'] }).entry;
  assert.ok(tower && tower.pos[1] > 3 && tower.pos[1] <= groundAt(...at(tower)) + 0.001, `on the slope: ${tower.pos}`);
  assert.match(build('second tower', 'outside on top of the hill', 4, 10, 4, { worldOpen: ['pond'] }).failed, /do not know the way[\s\S]*by the pond/);
  ok('the hill: on the slope, and only when he knows the way');

  // what does not fit is not placed, and he hears why and what would fit
  const castle = build('huge castle', 'outside by the willow', 20, 9, 16);
  assert.match(castle.failed, /does not fit by the willow[\s\S]*20 x 16 m[\s\S]*fits there[\s\S]*another place/);
  assert.match(build('sky bridge', 'outside by Lina’s house', 20, 9, 16).failed ?? '', /does not fit|my world ends/);
  assert.match(makeDecor(world, { name: 'far too big barn', why: 'x', where: 'outside', parts: part(20, 6, 18), metres: 20 }, t, t + 50).failed, /no room on my plot[\s\S]*another place outside/);
  ok('too big for the place: he hears why, how big would fit, and where else');

  // nothing he builds stands in a house, in the water, on a walkway or on another thing of his
  const spots = ['outside by the pond', 'outside in the park', 'outside in the street by the bakery', 'outside in the street by the corner shop', 'outside by Lina’s house', 'outside by the willow', 'outside in the street by Mo’s house', 'outside', 'outside right of the pond', 'outside by the green stone'];
  const fails = [];
  for (let i = 0; i < 24; i++) { const r = build(`q${String.fromCharCode(97 + i)}rk${String.fromCharCode(110 + (i % 12))}um`, spots[i % spots.length], 2 + (i % 4) * 2, 3 + (i % 5), 2 + (i % 3) * 2); if (r.failed) fails.push(`${spots[i % spots.length]}: ${r.failed}`); }
  if (process.env.SHOW) console.log(fails.join('\n'));
  assert.ok(world.length >= 20, `most of them found a place: ${world.length}`);
  for (const e of world) {
    const [x0, x1, z0, z1] = foot(e);
    assert.equal(buildProblem(x0 + 0.02, x1 - 0.02, z0 + 0.02, z1 - 0.02), null, `${e.name} at ${at(e)}`);
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], at(e)]) assert.equal(townBlocked(TOWN_X + x, z, 0), false, `${e.name}: a corner in something`);
    for (const o of world) if (o !== e) { const [a0, a1, b0, b1] = foot(o); assert.ok(x1 <= a0 + 0.01 || a1 <= x0 + 0.01 || z1 <= b0 + 0.01 || b1 <= z0 + 0.01, `${e.name} and ${o.name} overlap`); }
  }
  // the ways he walks stay free: every spot and every corner of every route
  for (const [k, sp] of Object.entries(TOWN_SPOTS)) for (const e of world) { const [x0, x1, z0, z1] = foot(e); assert.ok(!(sp.x > x0 - 0.9 && sp.x < x1 + 0.9 && sp.z > z0 - 0.9 && sp.z < z1 + 0.9), `${e.name} stands on ${k}`); }
  ok('nothing stands in a house, in the water, on a walkway or on another thing');

  // moving: to another place outside it keeps its size; a giant does not come into his room
  const moved = moveThing(world, null, { name: 'tall lighthouse', where: 'outside in the park' }, t, t + 200);
  assert.ok(!moved.failed && /in the park/.test(moved.label) && Math.round(sizeOf(world.find((e) => e.name === 'tall lighthouse'))[1]) === 16, JSON.stringify(moved).slice(0, 200));
  assert.match(moveThing(world, null, { name: 'tall lighthouse', where: 'floor' }, t, t + 201).failed, /too big for my room/);
  ok('a giant moves to another place outside at its own size, and does not fit in his room');

  // words: a place outside is a place outside, a thing in his room is not
  for (const w of ['outside', 'outside by the pond', 'by the pond', 'in the park', 'on top of the hill', 'in the street']) assert.ok(isOutside(w), w);
  for (const w of ['floor', 'on the desk', 'wall_left', 'next to the street lamp', 'by the pond painting', 'floor_front', 'ceiling']) assert.ok(!isOutside(w), w);
  assert.equal(buildPlace('outside in the park by the willow').key, 'willow');
  assert.equal(buildPlace('outside'), null);
  assert.equal(outsideChoice('outside by the pond', 'outside'), 'outside by the pond');
  assert.equal(outsideChoice('outside', 'outside by the willow'), 'outside by the willow');
  assert.equal(outsideChoice(null, 'on the desk'), 'on the desk');
  assert.equal(outsideIn('a lighthouse outside by the pond'), 'outside by the pond');
  assert.equal(outsideIn('a small clay cup'), null);
  ok('the words he uses for places');
}

// ---- The world is a list: buildings are blocks, walls carry his drawings (web/town.js)
{
  const rects = [...BUILDINGS.map((b) => [b.name, ...rectOf(b)]), ...WALLS.map((w) => [w.name, w.at[0] - w.len / 2, w.at[0] + w.len / 2, w.at[1] - 0.25, w.at[1] + 0.25])];
  for (const [name, x0, x1, z0, z1] of rects) {
    assert.ok(x0 > WORLD.x0 + 2 && x1 < WORLD.x1 - 2 && z0 > WORLD.z0 + 2 && z1 < WORLD.z1 - 2, `${name} stands inside the world`);
    assert.equal(townBlocked(TOWN_X + (x0 + x1) / 2, (z0 + z1) / 2, 0), true, `${name} cannot be walked through`);
    assert.ok(buildProblem(x0 + 0.1, x1 - 0.1, z0 + 0.1, z1 - 0.1), `${name}: nothing can be built in it`);
    for (const [other, a0, a1, b0, b1] of rects) if (other !== name) assert.ok(x1 <= a0 || a1 <= x0 || z1 <= b0 || b1 <= z0, `${name} and ${other} overlap`);
  }
  assert.deepEqual(BUILDINGS.map((b) => b.key).sort(), [...new Set(BUILDINGS.map((b) => b.key))].sort(), 'every building has its own key');
  const home = BUILDINGS.find((b) => b.key === 'home');
  assert.ok(home && Math.abs(home.at[0] + home.look.door.x - home.size[0] / 2) < 0.01 && home.at[1] === 0, 'the door of his home is where the way in is');
  assert.ok(BUILDINGS.every((b) => b.look && b.size.length === 3 && b.size.every((v) => v > 1)));
  // a drawing always hangs on the same wall, at the same place, and the walls share the drawings
  const ids = Array.from({ length: 60 }, (_, i) => `artm${(i * 7919 + 13).toString(36)}${i}`);
  for (const id of ids) { const a = artSpot(id); assert.deepEqual(artSpot(id), a); assert.ok(a.wall >= 0 && a.wall < WALLS.length && a.u >= 0 && a.u <= 1 && (a.side === 0 || a.side === 1) && Math.abs(a.tilt) <= 0.08); }
  assert.ok(new Set(ids.map((id) => artSpot(id).wall)).size === WALLS.length, 'every wall gets some');
  ok('buildings are blocks that stand apart inside the world, and his drawings hang on the walls, each always at its own place');
}
