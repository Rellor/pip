// No room full of small furniture. A full room takes no new thing (one a day at most when there is room), a project
// and a making hobby grow one piece instead of many, and what he builds for the notice board leaves his room.
import assert from 'node:assert/strict';
delete process.env.PIP_ROOM_ENOUGH; delete process.env.PIP_MAKES_PER_DAY; delete process.env.PIP_NO_OUT;
const { MAX_PER_DAY, ROOM_PLENTY, ROOM_FULL, roomIsFull, roomHasPlenty, fullWhy } = await import('../decor.js');
const { byName, availableMoves } = await import('../moves.js');
const { dayLimits } = await import('../limits.js');
const { ORDERS, boardThing, forBoard, handOver, boardLines } = await import('../board.js');
const { keepWishes } = await import('../neighbours.js');
const { hobbyMoves, hobbyLines } = await import('../curiosity.js');
const { workStep, projectThing } = await import('../projects.js');
const { CHANGES } = await import('../changes.js');

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-27T11:00:00Z');
const DAY = 86_400_000, MIN = 60_000;
const iso = (ms) => new Date(ms).toISOString();
const part = [{ shape: 'box', size: [0.3, 0.3, 0.3], pos: [0, 0.15, 0], rot: [0, 0, 0], color: '#a67' }];
const thing = (i, more = {}) => ({ id: `d${i}`, name: `thing number ${i}`, parts: part, pos: [(i % 6) - 3, 0, Math.floor(i / 6) - 2], zone: 'floor', kind: 'floor', createdAt: iso(now - (5 + i) * DAY), uses: [{ label: 'look at it', text: 'x' }], ...more });
const fresh = (n, more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 4, body: { creativity: 9, curiosity: 5, boredom: 4, loneliness: 3, tidiness: 5, coziness: 4 }, decor: Array.from({ length: n }, (_, i) => thing(i)), stored: [], weather: { kind: 'clear', temp: 8 }, tools: [], pantry: [], log: [], outings: [], visitors: [], pictures: [], found: [], art: [], apps: [], wardrobe: [], moves: [], cookedAt: [], asks: [], projects: [], wishes: [], curious: { sparks: [], interests: [] }, ...more });
const note = (topic, more = {}) => ({ id: `b${topic.length}`, board: true, from: 'the notice board', topic, text: `Wanted: ${topic}. 3 coins.`, medium: ['decorate'], at: iso(now - 3_600_000), reward: 3, status: 'open', seen: true, ...more });

// ---- a full room takes no new thing; with room, one a day
{
  assert.deepEqual([MAX_PER_DAY, ROOM_PLENTY, ROOM_FULL], [1, 12, 18]);
  const full = fresh(ROOM_FULL + 6), some = fresh(ROOM_PLENTY + 1), few = fresh(4);
  assert.ok(roomIsFull(full.decor) && !roomIsFull(some.decor) && roomHasPlenty(some.decor) && !roomHasPlenty(few.decor));
  assert.equal(Boolean(byName('decorate').when(full, now)), false, 'not offered in a full room, however much his hands itch');
  assert.equal(Boolean(byName('decorate').when(some, now)), true);
  assert.ok(!availableMoves(full, { now, random: () => 0.5 }).some((m) => m.name === 'decorate'));
  for (const name of ['change_thing', 'build_outside', 'draw']) assert.equal(Boolean(byName(name).when(full, now)), true, `${name} stays`);
  assert.match(fullWhy(full.decor), /my room is full: 24 things.*under 18.*change_thing.*build_outside.*remove_decoration/);
  assert.equal(dayLimits(few, now).decorate.max, 1, 'one new thing for his room a day');
  const made = fresh(4, { decor: [...fresh(4).decor, thing(50, { createdAt: iso(now - 3_600_000) })] });
  assert.equal(Boolean(byName('decorate').when(made, now)), false, 'he made one today: no second one');
  // pictures and what stands outside do not fill his room
  const outside = fresh(ROOM_FULL - 1, { decor: [...fresh(ROOM_FULL - 1).decor, thing(70, { kind: 'outside' }), { id: 'p', name: 'a photo', image: 'photos/p.jpg' }] });
  assert.equal(roomIsFull(outside.decor), false);
  // a bare-room push only while it really is bare; a dark corner is no excuse for one more lamp in a room with plenty
  assert.ok(byName('decorate').score(some, now) < byName('decorate').score(few, now) - 1);
  assert.ok(byName('decorate').score(some, now) < byName('change_thing').score(some, now), 'with plenty, making a thing better pulls more than a new one');
}
ok('a full room takes no new thing; with room it is one a day, and a new thing pulls less than improving one');

// ---- the notice board: few things to build, and what he builds for a note leaves his room
{
  const builds = ORDERS.filter(([what, how]) => how.includes('decorate') && !/3D printer/.test(what)).length;
  assert.ok(builds <= ORDERS.length / 4, `${builds} of ${ORDERS.length} notes ask for a thing to build`);
  assert.ok(ORDERS.some(([, how]) => how.includes('record_song')));
  const s = fresh(ROOM_FULL + 2, { wishes: [note('a fruit bowl')], coins: 0 });
  assert.equal(boardThing(s, now), 'a fruit bowl');
  assert.equal(Boolean(byName('decorate').when(s, now)), true, 'for a note he may build, also in a full room');
  assert.match(byName('decorate').line(s, now), /make a fruit bowl for the note on the notice board.*does not stay in my room/);
  assert.ok(forBoard(s, 'a wooden fruit bowl', now) && !forBoard(s, 'a small stool', now) && !forBoard(s, 'a bowl', now));
  assert.match(boardLines(s, now)[0], /decorate: I bring it to the square/);
  s.decor.push(thing(99, { name: 'fruit bowl', createdAt: iso(now) }));
  const lines = keepWishes(s, [{ at: iso(now), action: 'decorate', name: 'fruit bowl' }], now);
  assert.match(lines[0], /got 3 coins.*I bring it to the square/);
  assert.equal(s.decor.at(-1).forBoard, 'a fruit bowl');
  assert.deepEqual(handOver(s, now + MIN), [], 'it stands in his room for a moment first');
  assert.deepEqual(handOver(s, now + 9 * MIN), ['fruit bowl']);
  assert.ok(!s.decor.some((d) => d.name === 'fruit bowl') && s.given.length === 1 && s.given[0].for === 'a fruit bowl' && s.given[0].parts.length);
  assert.equal(Boolean(byName('decorate').when(s, now + 9 * MIN)), false, 'the note is down: his room is full again');
  // a drawing or a print for a note is not carried anywhere
  const t = fresh(3, { wishes: [note('a drawing of an owl', { medium: ['draw'] })], decor: [thing(1, { name: 'owl' })] });
  keepWishes(t, [{ at: iso(now), action: 'draw', name: 'an owl' }], now);
  assert.ok(!t.decor.some((d) => d.forBoard));
}
ok('what he builds for a note on the board is brought to the square: it does not stay in his room');

// ---- a making hobby and a project grow one piece
{
  const ways = hobbyMoves('building clocks');
  assert.ok(!ways.includes('decorate') && ways[0] === 'extend_thing' && ways.includes('build_outside'), ways.join(' '));
  assert.ok(hobbyMoves('graffiti').includes('paint_wall') && !hobbyMoves('woodworking').includes('decorate'));
  const s = fresh(5, { curious: { sparks: [], interests: [{ topic: 'building clocks', score: 6, own: true, moves: ways, practice: 4, since: iso(now - DAY), ideaAt: iso(now - DAY) }] } });
  assert.match(hobbyLines(s, [], now)[0], /keep working on one piece.*not a new small thing every time/);
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

// ---- the one-time change: his clock hobby, the fruit bowl he made for the board, and a memory
{
  const s = fresh(20, { wishes: [note('a fruit bowl', { status: 'kept' })], stored: [thing(80)], curious: { sparks: [], interests: [{ topic: 'building clocks', own: true, moves: ['decorate', 'build_outside', 'change_thing', 'extend_thing', 'print_thing'] }, { topic: 'Night sky' }] } });
  s.decor.push(thing(99, { name: 'fruit bowl' }));
  const said = CHANGES.find((c) => c.id === '2026-11-27 a full room').run(s, iso(now));
  assert.ok(!s.curious.interests[0].moves.includes('decorate') && s.curious.interests[1].moves === undefined);
  assert.equal(s.decor.at(-1).forBoard, 'a fruit bowl');
  assert.match(said, /21 things stand in my room and 1 more lie in my chest.*no new thing while it is full \(18 or more\).*one clock/);
  assert.deepEqual(handOver(s, now), ['fruit bowl']);
}
ok('the change for today: his clock hobby keeps to one clock, and the fruit bowl goes to the square');
