// No room full of small things, and nothing forbidden: he has a museum. A full room sends what he makes to a plinth
// there, he can carry things over himself, and a project and a making hobby like to grow one piece.
import assert from 'node:assert/strict';
delete process.env.PIP_ROOM_ENOUGH; delete process.env.PIP_MAKES_PER_DAY; delete process.env.PIP_NO_OUT;
const { MAX_PER_DAY, ROOM_PLENTY, ROOM_FULL, roomIsFull, roomHasPlenty, roomThings } = await import('../decor.js');
const { byName, availableMoves } = await import('../moves.js');
const { dayLimits } = await import('../limits.js');
const { hobbyMoves, hobbyLines } = await import('../curiosity.js');
const { workStep, projectThing } = await import('../projects.js');
const { CHANGES } = await import('../changes.js');
const { MUSEUM_MAX, showInMuseum, markForMuseum, carryToMuseum, museumLines, showable } = await import('../museum.js');
const { toAnswer } = await import('../brain.js');
const { startOuting, outingTick, goOptions } = await import('../world.js');
const { MUSEUM, MUSEUM_SLOTS, TOWN_SPOTS, TOWN_FOR, ROUTES, townBlocked, TOWN_X, buildProblem } = await import('../web/town.js');

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-27T11:00:00Z');
const DAY = 86_400_000, MIN = 60_000;
const iso = (ms) => new Date(ms).toISOString();
const part = [{ shape: 'box', size: [0.3, 0.3, 0.3], pos: [0, 0.15, 0], rot: [0, 0, 0], color: '#a67' }];
const thing = (i, more = {}) => ({ id: `d${i}`, name: `thing number ${i}`, parts: part, pos: [(i % 6) - 3, 0, Math.floor(i / 6) - 2], zone: 'floor', kind: 'floor', createdAt: iso(now - (5 + i) * DAY), uses: [{ label: 'look at it', text: 'x' }], ...more });
const fresh = (n, more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 4, body: { creativity: 9, curiosity: 5, boredom: 4, loneliness: 3, tidiness: 5, coziness: 4 }, decor: Array.from({ length: n }, (_, i) => thing(i)), stored: [], weather: { kind: 'clear', temp: 8 }, tools: [], pantry: [], log: [], outings: [], visitors: [], pictures: [], found: [], art: [], apps: [], wardrobe: [], moves: [], cookedAt: [], asks: [], projects: [], wishes: [], curious: { sparks: [], interests: [] }, ...more });
const note = (topic, more = {}) => ({ id: `b${topic.length}`, board: true, from: 'the notice board', topic, text: `Wanted: ${topic}. 3 coins.`, medium: ['decorate'], at: iso(now - 3_600_000), reward: 3, status: 'open', seen: true, ...more });

// ---- a full room: nothing is refused, what he makes goes to his museum
{
  assert.deepEqual([MAX_PER_DAY, ROOM_PLENTY, ROOM_FULL, MUSEUM_MAX, MUSEUM_SLOTS.length], [12, 12, 18, 40, 40]);
  const full = fresh(ROOM_FULL + 2), some = fresh(ROOM_PLENTY + 1), few = fresh(4);
  assert.ok(roomIsFull(full.decor) && !roomIsFull(some.decor) && roomHasPlenty(some.decor) && !roomHasPlenty(few.decor));
  assert.equal(Boolean(byName('decorate').when(full, now)), true, 'he may make a thing in a full room');
  assert.match(byName('decorate').line(full, now), /My room is full, so it goes on a plinth in my museum for everyone to see/);
  assert.match(museumLines(full)[0], /My room is full \(20 things\), and that is fine.*museum.*show_in_museum/);
  assert.equal(dayLimits(few, now).decorate.max, 12, 'he decides how much he makes');
  // he makes one: at the end of that wake-up it is marked, and at the next one it stands in his museum
  full.decor.push(thing(90, { name: 'a small brass orrery', createdAt: iso(now), why: 'to see the planets go round' }));
  assert.deepEqual(markForMuseum(full, now - 1000), ['a small brass orrery']);
  assert.deepEqual(markForMuseum(full, now - 1000), [], 'not marked twice, and nothing old is taken from his room');
  assert.deepEqual(carryToMuseum(full, now + MIN), [], 'it stands in his room for a moment first');
  assert.deepEqual(carryToMuseum(full, now + 9 * MIN), ['a small brass orrery']);
  assert.ok(roomThings(full.decor).length === ROOM_FULL + 2 && full.museum.length === 1 && full.museum[0].from === 'new' && full.museum[0].parts.length && full.museum[0].why);
  // with room left, a new thing simply stays
  some.decor.push(thing(91, { name: 'a stool', createdAt: iso(now) }));
  assert.deepEqual(markForMuseum(some, now - 1000), []);
  // pictures and what stands outside do not fill his room
  const outside = fresh(ROOM_FULL - 1, { decor: [...fresh(ROOM_FULL - 1).decor, thing(70, { kind: 'outside' }), { id: 'p', name: 'a photo', image: 'photos/p.jpg' }] });
  assert.equal(roomIsFull(outside.decor), false);
  assert.ok(byName('decorate').score(some, now) < byName('decorate').score(few, now) - 1, 'a bare room wants things; a room with plenty much less');
  assert.ok(byName('decorate').score(some, now) < byName('change_thing').score(some, now), 'with plenty, making a thing better pulls more than a new one');
}
ok('a full room refuses nothing: what he makes there goes to a plinth in his museum');

// ---- he carries things to his museum himself, and walks through it
{
  const s = fresh(ROOM_FULL + 1, { stored: [thing(80, { name: 'clay bird' }), { id: 'x', name: 'an old photo', image: 'photos/x.jpg' }] });
  assert.equal(showable(s).length, ROOM_FULL + 2, 'things from his room and his chest, not pictures');
  assert.equal(Boolean(byName('show_in_museum').when(s, now)), true);
  assert.ok(availableMoves({ ...s, body: { ...s.body, creativity: 3 } }, { now, random: () => 0.5 }).some((m) => m.name === 'show_in_museum'), 'with a full room it is among his moves (when his hands do not itch to make)');
  const a = toAnswer({ moves: [{ move: 'show_in_museum', details: { name: 'clay bird', why: 'It is the first thing I made that looks back at me.' }, thought: 't' }], reason: 'r', mood: 'calm' });
  assert.deepEqual([a.steps[0].action, a.steps[0].as, a.steps[0].details.what, a.steps[0].details.name], ['do', 'show_in_museum', 'carry clay bird to my museum', 'clay bird']);
  const fromChest = showInMuseum(s, 'clay bird', 'It looks back at me.', now);
  assert.deepEqual([fromChest.from, fromChest.piece.shown, s.stored.length, s.museum.length], ['chest', 'It looks back at me.', 1, 1]);
  s.decor.push(thing(95, { name: 'a cup', base: 'd3#1' }));
  const fromRoom = showInMuseum(s, 'thing number 3', '', now);
  assert.ok(fromRoom.from === 'room' && !s.decor.some((d) => d.id === 'd3') && s.decor.at(-1).base === undefined, 'what stood on it stays in his room');
  assert.match(showInMuseum(s, 'a golden throne', '', now).failed, /no thing called "a golden throne"/);
  assert.match(showInMuseum(s, 'an old photo', '', now).failed, /no thing called/, 'a picture is not carried there');
  showInMuseum(s, 'thing number 4', '', now);
  assert.equal(Boolean(byName('show_in_museum').when(s, now)), false, 'three walks there a day is plenty');
  assert.equal(Boolean(byName('show_in_museum').when(s, now + DAY)), true);
  // every plinth taken: the oldest piece moves to the depot, nothing is lost and nothing is refused
  const big = fresh(2, { museum: Array.from({ length: MUSEUM_MAX }, (_, i) => ({ id: `m${i}`, name: `old piece ${i}`, parts: part })) });
  showInMuseum(big, 'thing number 0', '', now);
  assert.deepEqual([big.museum.length, big.depot.length, big.depot[0].name, big.museum.at(-1).name], [MUSEUM_MAX, 1, 'old piece 0', 'thing number 0']);
  // a walk through it
  assert.ok(goOptions(s, now).some((o) => o.key === 'museum'));
  assert.ok(startOuting(s, { place: 'my museum', what: 'walk past my things' }, now).ok && s.where.place === 'museum');
  const back = outingTick(s, Date.parse(s.where.homeAt) + MIN);
  assert.match(back.outing.did, /museum/);
  const empty = fresh(2);
  startOuting(empty, { place: 'my museum', what: 'look' }, now);
  assert.match(outingTick(empty, Date.parse(empty.where.homeAt) + MIN).outing.did, /Forty plinths and nothing on them/);
  // it stands in the world: forty places inside its walls, a spot before the gate and a free way to it
  assert.ok(MUSEUM_SLOTS.every(([x, z]) => x > MUSEUM.x0 + 1 && x < MUSEUM.x1 - 1 && z > MUSEUM.z0 + 1 && z < MUSEUM.z1 - 1 && townBlocked(TOWN_X + x, z, 0)));
  assert.equal(buildProblem(-40, -30, 38, 44), 'my museum stands there');
  const pts = ['door', ...ROUTES.museum, TOWN_FOR.museum[0]].map((k) => TOWN_SPOTS[k]);
  for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i]; const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.4); for (let k = 0; k <= n; k++) assert.equal(townBlocked(TOWN_X + p.x + ((q.x - p.x) * k) / n, p.z + ((q.z - p.z) * k) / n, 0.2), false, `the way to the museum is blocked between corner ${i - 1} and ${i}`); }
  for (let z = MUSEUM.z0 - 1; z < MUSEUM.z1 - 1.5; z += 0.3) assert.equal(townBlocked(TOWN_X + (MUSEUM.gate[0] + MUSEUM.gate[1]) / 2, z, 0.3) && z < MUSEUM.z0 + 1, false, 'you walk in through the gate');
}
ok('he carries things to his museum himself (three a day), a full museum moves the oldest to the depot, and he can walk through it');

// ---- a making hobby and a project grow one piece
{
  const ways = hobbyMoves('building clocks');
  assert.ok(ways[0] === 'extend_thing' && ways.at(-1) === 'decorate' && ways.includes('build_outside'), ways.join(' '));
  assert.ok(hobbyMoves('graffiti').includes('paint_wall'));
  const s = fresh(5, { curious: { sparks: [], interests: [{ topic: 'building clocks', score: 6, own: true, moves: ways, practice: 4, since: iso(now - DAY), ideaAt: iso(now - DAY) }] } });
  assert.match(hobbyLines(s, [], now)[0], /keep working on one piece.*more than a new small thing every time/);
  // a project: the first build step makes the thing, every next one adds to it
  const p = { title: 'Build a pendulum clock', why: 'x', status: 'working', steps: [{ text: 'build the case', done: true }, { text: 'build the pendulum', done: false }], versions: [], needs: [] };
  const t = fresh(5, { projects: [p] });
  assert.equal(workStep(t, p.title).action, 'decorate', 'nothing made yet: the first step makes it');
  p.versions.push({ kind: 'decorate', name: 'pendulum clock', at: iso(now) });
  assert.equal(projectThing(t, p), null, 'the thing is not in his room (yet)');
  t.decor.push(thing(60, { name: 'pendulum clock' }));
  const next = workStep(t, p.title);
  assert.deepEqual([next.action, next.details.name, next.details.add], ['extend_thing', 'pendulum clock', 'build the pendulum']);
}
ok('a making hobby and a project grow one piece, instead of a new thing every time');

// ---- the one-time change: the museum opens with what lay in his chest
{
  const s = fresh(20, { stored: [thing(80, { name: 'clay bird' }), thing(81, { name: 'tiny lamp' }), { id: 'x', name: 'an old photo', image: 'photos/x.jpg' }], curious: { sparks: [], interests: [{ topic: 'building clocks', own: true, moves: ['decorate', 'build_outside', 'change_thing', 'extend_thing', 'print_thing'] }, { topic: 'Night sky' }] } });
  const said = CHANGES.find((c) => c.id === '2026-11-27 a museum').run(s, iso(now));
  assert.equal(s.curious.interests[0].moves[0], 'extend_thing');
  assert.deepEqual([s.museum.map((p) => p.name), s.stored.map((d) => d.name)], [['clay bird', 'tiny lamp'], ['an old photo']]);
  assert.match(said, /I have a museum now.*The 2 things that lay in my chest.*My room holds 20 things, and it is full at 18.*show_in_museum/);
  assert.equal(Boolean(byName('show_in_museum').when(s, now)), true, 'the opening does not count as his three walks of today');
}
ok('the museum opens with what lay unseen in his chest');
