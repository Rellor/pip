// The land tool (land.js): Pip shapes the ground of his world at the land workshop. A hill, a hole, or flat again.
import assert from 'node:assert/strict';
import { planLand, landDone, landToday, landLine, LAND_PER_DAY } from '../land.js';
import { groundAt, setLand, buildProblem, LAND_MAX, LAND_SIZES, POND, PLOT, TOWN_X } from '../web/town.js';
import { startOuting, outingTick, canGo } from '../world.js';
import { toAnswer } from '../brain.js';
import { byName } from '../moves.js';
import { applyChanges } from '../changes.js';

const ok = (name) => console.log(`ok  ${name}`);
delete process.env.PIP_NO_OUT;
const noon = Date.parse('2026-11-23T11:00:00Z');
const MIN = 60_000;
const fresh = (more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 5, loneliness: 5, body: { creativity: 6, boredom: 3, curiosity: 4, coziness: 6 }, weather: { kind: 'clear', temp: 8 }, tools: [], pantry: [], decor: [], log: [], outings: [], ...more });

// ---- he plans a shape: the kind, the place and the size are his; it goes where it fits
const s = fresh();
const hill = planLand(s, { kind: 'hill', where: 'on my land', size: 'big', name: 'Lookout Hill' }, noon).job;
assert.ok(hill && hill.place === 'land' && hill.shape.kind === 'hill' && hill.shape.r === LAND_SIZES.big.r && hill.shape.h === LAND_SIZES.big.hill && hill.shape.name === 'Lookout Hill', JSON.stringify(hill));
assert.ok(hill.shape.x - hill.shape.r >= PLOT.x0 && hill.shape.x + hill.shape.r <= PLOT.x1 && hill.shape.z - hill.shape.r >= PLOT.z0 && hill.shape.z + hill.shape.r <= PLOT.z1, 'on his own land');
assert.match(hill.words, /make a hill on my land/);
const hole = planLand(s, { kind: 'a deep hole', where: 'by the pond', size: 'small' }, noon).job;
assert.ok(hole.shape.kind === 'hole' && hole.shape.h === LAND_SIZES.small.hole && Math.hypot(hole.shape.x - POND.x, hole.shape.z - POND.z) < 40, JSON.stringify(hole));
assert.equal(buildProblem(hole.shape.x - hole.shape.r, hole.shape.x + hole.shape.r, hole.shape.z - hole.shape.r, hole.shape.z + hole.shape.r), null, 'not in the water, not on a path, not in a building');
assert.equal(planLand(s, {}, noon).job.shape.kind, 'hill', 'he only said "shape the land": a hill on his own land');
assert.match(planLand(s, { kind: 'hill', where: 'on the square', size: 'small' }, noon).job?.words ?? '', /beside the square/, '"on the square" is beside it: the square itself stays free');
ok('he plans a hill or a hole at a place he names, and it goes where it fits');

// ---- what he built is not buried
const withShed = fresh({ decor: [{ name: 'garden shed', kind: 'outside', pos: [TOWN_X + hill.shape.x, 0, hill.shape.z], metres: 4 }] });
const beside = planLand(withShed, { kind: 'hill', where: 'on my land', size: 'small' }, noon).job.shape;
assert.ok(Math.hypot(beside.x - hill.shape.x, beside.z - hill.shape.z) >= beside.r + 2, 'the hill goes beside his shed, not under it');
{ const two = fresh({ land: [{ id: 'l0', kind: 'hill', name: 'first hill', x: hill.shape.x, z: hill.shape.z, r: 12, h: 5, at: new Date(noon - 3 * 86_400_000).toISOString() }] }); const next = planLand(two, { kind: 'hill', where: 'on my land', size: 'small' }, noon).job.shape; assert.ok(Math.hypot(next.x - hill.shape.x, next.z - hill.shape.z) >= 12, 'a second hill goes beside the first, not on top of it'); assert.ok(planLand(two, { kind: 'hole', where: 'on my land', size: 'small' }, noon).job, 'a hole in a hill is fine'); }
ok('a hill does not bury what he built');

// ---- the move: he walks to the land workshop, and the ground changes when the work is done
const step = toAnswer({ moves: [{ move: 'shape_land', details: { kind: 'hill', where: 'on my land', size: 'medium', name: 'my first hill' }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['shape_land']).steps[0];
assert.deepEqual([step.action, step.as, step.details.land.kind, step.details.land.size], ['go_out', 'shape_land', 'hill', 'medium']);
const plan = planLand(s, step.details.land, noon);
assert.ok(canGo(s, 'land', noon).ok);
const went = startOuting(s, { job: plan.job }, noon);
assert.ok(went.ok && s.where.place === 'land' && s.where.job.shape.name === 'my first hill', JSON.stringify(went));
assert.match(outingTick(s, noon + 10 * MIN).line, /I am at the land workshop: I make a hill on my land/);
assert.equal((s.land ?? []).length, 0, 'nothing changes before the work is done');
const back = outingTick(s, Date.parse(s.where.homeAt) + MIN);
assert.ok(back.home && /made a hill on my land: 16 m wide and 3 m high/.test(back.outing.did), back.outing.did);
assert.equal(s.land.length, 1);
setLand(s.land);
assert.equal(groundAt(s.land[0].x, s.land[0].z), 3, 'the ground is high there now');
assert.equal(landToday(s, noon + 60 * MIN), 1);
assert.match(landLine(s), /I shaped the land: my first hill/);
ok('shape_land: he walks to the land workshop, and afterwards the hill is really there');

// cut short on the way: nothing is made
{ const c = fresh({ energy: 8 }); const p = planLand(c, { kind: 'hole' }, noon); startOuting(c, { job: p.job }, noon); c.energy = 1.5; outingTick(c, noon + 2 * MIN); const o = outingTick(c, noon + 30 * MIN); assert.ok(o.home && !(c.land ?? []).length, 'he turned around: the land is as it was'); }

// ---- flat again, and the limits
const flat = planLand(s, { kind: 'flat', where: 'on my land' }, noon + 2 * 60 * MIN).job;
assert.ok(flat.kind === 'flat' && flat.remove === s.land[0].id);
assert.match(landDone(s, flat), /made my first hill flat again/);
assert.equal(s.land.length, 0);
assert.match(planLand(s, { kind: 'flat' }, noon).failed, /flat everywhere/);
const full = fresh({ land: Array.from({ length: LAND_MAX }, (_, i) => ({ id: `l${i}`, kind: 'hill', name: `hill ${i}`, x: -90 + i * 3, z: -30, r: 5, h: 1.6, at: new Date(noon - 3 * 86_400_000).toISOString() })) });
assert.match(planLand(full, { kind: 'hill' }, noon).failed, /enough for my world[\s\S]*flat/);
const stood = fresh({ land: [{ id: 'l1', kind: 'hill', name: 'tower hill', x: 50, z: 30, r: 8, h: 3, at: new Date(noon).toISOString() }], decor: [{ name: 'stone tower', kind: 'outside', pos: [TOWN_X + 51, 3, 30], metres: 4 }] });
assert.match(planLand(stood, { kind: 'flat' }, noon).failed, /my stone tower stands on tower hill/);
ok('he can make one flat again; not more than a dozen, and not one that something stands on');

// ---- it is one of his moves, a few times a day
const move = byName('shape_land');
assert.ok(move.when(fresh(), noon), 'he can do it from the first day');
{ const line = move.line(fresh()); assert.ok(line.length < 240 && /hill/.test(line) && /hole/.test(line) && /all flat now/.test(line), line); }
const busy = fresh({ land: Array.from({ length: LAND_PER_DAY }, (_, i) => ({ id: `l${i}`, kind: 'hill', name: 'h', x: 0, z: -30, r: 5, h: 1, at: new Date(noon - 60 * MIN).toISOString() })) });
assert.equal(move.when(busy, noon), false, 'after two in a day it is enough');
assert.equal(move.when(fresh({ where: { place: 'pond' } }), noon), false, 'not while he is out');
ok('shaping the land is a move of his, at most twice a day');

// ---- the one-time change: what stood outside moves to his land, paintings on walls that are gone go to the long wall
{
  const old = fresh({ changes: [], memories: [], decor: [{ name: 'old shed', kind: 'outside', pos: [TOWN_X + 5, 0, 20], spot: 'street' }], gallery: [{ id: 'a1', wall: 'back_bakery' }, { id: 'a2', wall: 'wall_2' }], art: [] });
  const notes = applyChanges(old, noon);
  assert.ok(notes.some((n) => /village square[\s\S]*grocery store[\s\S]*land workshop[\s\S]*shape_land/.test(n)));
  const shed = old.decor[0];
  assert.ok(shed.spot === 'plot' && shed.pos[0] - TOWN_X > PLOT.x0 && shed.pos[0] - TOWN_X < PLOT.x1 && shed.pos[2] > PLOT.z0 && shed.pos[2] < PLOT.z1);
  assert.deepEqual(old.gallery.map((a) => a.wall), ['wall_4', 'wall_2']);
  ok('the new map: his things outside and his wall paintings come along');
}
setLand([]);
