// His street in 3D (web/town.js): the places Pip is seen at are free to stand on and can be walked to, and every place
// of his world has a spot in the street. (The drawing itself is checked by eye, in a real browser.)
// Run: node tests/town.mjs
import assert from 'node:assert/strict';
import { TOWN_X, TOWN_RANGE, TOWN_Z, TOWN_SPOTS, TOWN_FOR, inTown, townBlocked, atTownDoor } from '../web/town.js';
import { PLACES } from '../web/world.js';

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
