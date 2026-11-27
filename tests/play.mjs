// Things to do that leave nothing behind (play.js): he builds anything he can use outside and says how it is used,
// goes out with it, gets better at it, gets things he asked for, and plays the games he wrote.
import assert from 'node:assert/strict';
delete process.env.PIP_NO_OUT;
const { makePlaything, findPlaything, playJob, playDone, levelOf, motionOf, playLines, noteArrival, nextArrival, arrived, playGame, looksPlayable, MOTIONS, PLAYTHINGS_MAX } = await import('../play.js');
const { startOuting, outingTick, goOptions } = await import('../world.js');
const { toAnswer } = await import('../brain.js');
const { byName } = await import('../moves.js');
const { preflight, dayLimits } = await import('../limits.js');
const { makerPrompt, fakeMade } = await import('../maker.js');
const { hobbyMoves } = await import('../curiosity.js');
const { TOWN_SPOTS, TOWN_FOR, ROUTES, townBlocked, TOWN_X } = await import('../web/town.js');
const { ensureBody } = await import('../body.js');

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-27T11:00:00Z');
const MIN = 60_000, DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const parts = [{ shape: 'box', size: [1.2, 0.5, 0.3], pos: [0, 0.45, 0], rot: [0, 0, 0], color: '#c04030' }];
const fresh = (more = {}) => { const s = { energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 6, loneliness: 5, weather: { kind: 'clear', temp: 8 }, tools: [], pantry: [], decor: [], stored: [], log: [], outings: [], visitors: [], pictures: [], found: [], art: [], apps: [], wardrobe: [], moves: [], cookedAt: [], asks: [], projects: [], wishes: [], curious: { sparks: [], interests: [] }, ...more }; ensureBody(s, now); return s; };

// ---- he builds anything, and says how it is used
{
  const s = fresh();
  const bike = makePlaything(s, { name: 'a red bike', why: 'The square is big and my legs are short.', verb: 'ride', motion: 'ride', where: 'square', how: 'I ride it round the square as fast as I dare.', parts }, now).thing;
  assert.deepEqual([bike.name, bike.verb, bike.motion, bike.where, bike.goes, bike.made], ['red bike', 'ride', 'ride', 'square', 0, 'built']);
  // he does not have to say everything: the game reads it from his words
  assert.deepEqual(['a kite', 'a model plane', 'a small sailing boat', 'a football', 'a swing', 'three juggling balls', 'a go-kart'].map(motionOf), ['fly', 'fly', 'float', 'roll', 'stay', 'hold', 'ride']);
  const kite = makePlaything(s, { name: 'a kite', parts }, now).thing;
  assert.deepEqual([kite.motion, kite.where, kite.verb], ['fly', 'field', 'fly']);
  assert.equal(makePlaything(s, { name: 'a paper boat', motion: 'float', where: 'square', parts }, now).thing.where, 'pond', 'a boat floats where there is water');
  const odd = makePlaything(s, { name: 'a cloud catcher', verb: 'catch', motion: 'stay', where: 'stone', how: 'I hold it up by the green stone and wait.', parts }, now).thing;
  assert.deepEqual([odd.verb, odd.motion, odd.where], ['catch', 'stay', 'stone'], 'something nobody thought of works too');
  assert.match(makePlaything(s, { name: 'red bike', parts }, now).failed, /already/);
  assert.match(makePlaything(s, { name: 'a sled', parts: [] }, now).failed, /shapes/);
  assert.ok(MOTIONS.includes(odd.motion) && findPlaything(s, 'my kite') === kite && findPlaything(s, 'the bike')?.name === 'red bike');
  // more than he can keep: the one he used least makes room
  const t = fresh();
  for (let i = 0; i <= PLAYTHINGS_MAX; i++) { const r = makePlaything(t, { name: `toy number ${i}`, parts }, now + i); if (i === 3) r.thing.goes = 5; if (i === PLAYTHINGS_MAX) assert.equal(r.gone.name, 'toy number 0'); }
  assert.equal(t.playthings.length, PLAYTHINGS_MAX);
}
ok('he builds anything he can use outside and says how; what he does not say, the game reads from his words');

// ---- the moves and the maker
{
  const s = fresh();
  assert.equal(Boolean(byName('make_plaything').when(s, now)), true);
  assert.equal(Boolean(byName('play').when(s, now)), false, 'nothing to go out with yet');
  const a = toAnswer({ moves: [{ move: 'make_plaything', details: { what: 'a bike', why: 'to go fast' }, thought: 't' }], reason: 'r', mood: 'calm' });
  assert.deepEqual([a.steps[0].action, a.steps[0].as, a.steps[0].details.play, a.steps[0].make], ['decorate', 'make_plaything', true, true]);
  assert.deepEqual(preflight(s, a.steps, now), [], 'it takes no room, so a full room does not stop it');
  assert.equal(dayLimits(s, now).make_plaything.max, 2);
  const prompt = makerPrompt({ soul: 'x', step: a.steps[0], rules: '', room: [] });
  assert.match(prompt, /NOT a thing for my room.*life-size.*"motion": "how it moves when I use it/s);
  assert.ok(fakeMade(a.steps[0]).parts.length >= 2);
  makePlaything(s, { name: 'bike', parts }, now);
  assert.equal(Boolean(byName('play').when(s, now)), true);
  assert.match(byName('play').line(s, now), /"bike": ride it, never tried yet/);
  const b = toAnswer({ moves: [{ move: 'play', details: { name: 'bike' }, thought: 't' }], reason: 'r', mood: 'calm' });
  assert.deepEqual([b.steps[0].action, b.steps[0].as, b.steps[0].details.plaything], ['go_out', 'play', 'bike']);
  assert.ok(byName('play').score(s, now) > byName('decorate').score(s, now), 'a thing that waits for its first go pulls more than building one more thing');
  assert.ok(hobbyMoves('riding a bike').includes('play') && hobbyMoves('flying kites')[0] === 'play');
}
ok('make_plaything and play are real moves; a new plaything pulls him outside');

// ---- going out with it: he gets better, and it does him good
{
  const s = fresh();
  const bike = makePlaything(s, { name: 'bike', parts }, now).thing;
  assert.ok(goOptions(s, now).some((o) => o.key === 'square'), 'the square is a place he can go to');
  const said = [];
  for (let i = 0; i < 8; i++) {
    const t = now + i * 60 * MIN;
    const joy = s.joy;
    assert.ok(startOuting(s, { play: playJob(bike) }, t).ok);
    assert.deepEqual([s.where.place, s.where.play.motion, s.where.words], ['square', 'ride', 'ride my bike']);
    const back = outingTick(s, Date.parse(s.where.homeAt) + MIN);
    assert.ok(back.home && back.outing.played.goes === i + 1);
    assert.ok(s.joy > joy || s.joy >= 9.5);
    said.push(back.outing.did);
    s.joy = 5; s.energy = 8;
  }
  assert.match(said[0], /first time|First go/);
  assert.ok(said.slice(1, 6).every((d) => /wobbl|turns|foot down|straight bits/i.test(d)), said[1]);
  assert.ok(/without thinking|no hands/.test(said[7]), said[7]);
  assert.deepEqual([bike.goes, levelOf(bike)], [8, 'good at it']);
  assert.match(playLines(s, now + 9 * 60 * MIN)[0], /bike \(I ride it, 8 times so far\)/);
  assert.match(playLines(s, now + 4 * DAY)[0], /not been out with my bike for days/);
  // a boat on a frozen pond slides
  const boat = makePlaything(s, { name: 'boat', parts }, now).thing;
  assert.match(playDone(s, playJob(boat), () => 0.1, { frozen: true }).did, /did not float: it slid/);
  // he is seen on the square, and the way there is free
  const pts = ['door', ...ROUTES.square, TOWN_FOR.square[0]].map((k) => TOWN_SPOTS[k]);
  for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i]; const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.4); for (let k = 0; k <= n; k++) assert.equal(townBlocked(TOWN_X + p.x + ((q.x - p.x) * k) / n, p.z + ((q.z - p.z) * k) / n, 0.2), false); }
}
ok('out with his bike he gets better each time, and the story changes with it');

// ---- asking: what is given arrives, and he sets it up himself
{
  const s = fresh();
  assert.equal(noteArrival(s, 'a kite'), 'kite');
  assert.equal(noteArrival(s, 'a kite'), null, 'not twice');
  assert.equal(nextArrival(s).what, 'kite');
  const made = makePlaything(s, { name: 'kite', parts }, now, 'given');
  arrived(s, 'kite');
  assert.ok(made.thing.made === 'given' && nextArrival(s) === null);
  assert.equal(dayLimits(s, now).make_plaything.used, 0, 'a gift does not count as something he built today');
  assert.ok(looksPlayable('a bike') && looksPlayable('a yo-yo') && !looksPlayable('tomato seeds') && !looksPlayable('some bread'));
}
ok('a thing he asked for arrives when it is given, and he sets it up');

// ---- playing a game he wrote
{
  const s = fresh();
  assert.match(playGame(s, 'frog').failed, /no game of my own/);
  s.apps = [{ name: 'jumping_frog', title: 'Jumping Frog' }];
  const first = playGame(s, 'Jumping Frog', () => 0.5, now);
  assert.ok(first.plays === 1 && first.score > 0 && /for the first time/.test(first.said));
  let best = first.best;
  for (let i = 0; i < 10; i++) best = Math.max(best, playGame(s, 'jumping frog', () => 0.5, now).score);
  assert.ok(best > first.score && s.games.jumping_frog.plays === 11 && s.games.jumping_frog.best === best, 'he gets better at his own game');
  const a = toAnswer({ moves: [{ move: 'play_game', details: { name: 'Jumping Frog' }, thought: 't' }], reason: 'r', mood: 'calm' });
  assert.deepEqual([a.steps[0].action, a.steps[0].as, a.steps[0].details.name], ['do', 'play_game', 'Jumping Frog']);
  assert.equal(Boolean(byName('play_game').when(s, now)), true);
}
ok('he plays the games he wrote, and his best score grows with practice');
