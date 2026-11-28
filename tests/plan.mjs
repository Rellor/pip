// The plan Bas and Pip agreed on, checked piece by piece: he decides his own day, quiet time is real, his pace follows
// his mood. (More pieces of the plan are checked in the tests of their own parts.)
import assert from 'node:assert/strict';
delete process.env.PIP_NO_OUT;
const { byName } = await import('../moves.js');
const { toAnswer } = await import('../brain.js');
const { paceMin, PACE } = await import('../pace.js');
const { kindOf, ensureBody } = await import('../body.js');

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-27T11:00:00Z');
const fresh = (more = {}) => { const s = { energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 4, loneliness: 4, emo: { excited: 0 }, decor: [], stored: [], log: [], outings: [], curious: { sparks: [], interests: [] }, ...more }; ensureBody(s, now); return s; };

// ---- quiet time is a real move of its own
{
  const s = fresh();
  assert.equal(Boolean(byName('quiet').when(s, now)), true);
  assert.equal(kindOf('quiet'), 'quiet');
  const a = toAnswer({ moves: [{ move: 'quiet', details: { where: 'by the window', what: 'watch the rain run down the glass' } }], reason: 'r', mood: 'calm' });
  assert.deepEqual([a.steps[0].action, a.steps[0].as, a.steps[0].details.what], ['do', 'quiet', 'watch the rain run down the glass']);
  assert.ok(byName('quiet').score(fresh({ calm: 3, energy: 4 }), now) > byName('quiet').score(s, now) + 1, 'restless and tired: quiet pulls more');
  const just = fresh(); just.recent.moves = [{ move: 'quiet', kind: 'quiet' }];
  assert.ok(byName('quiet').score(just, now) < byName('quiet').score(s, now), 'not one quiet moment after the other');
}
ok('quiet time is a real move: it pulls when he is restless or tired, and not twice in a row');

// ---- his pace follows his mood
{
  assert.equal(paceMin(fresh()), PACE.steady);
  assert.equal(paceMin(fresh({ emo: { excited: 6 } })), PACE.quick, 'excited: he thinks again sooner');
  assert.equal(paceMin(fresh({ plan: { queue: [{ action: 'go_out' }] } })), PACE.quick, 'in the middle of a plan too');
  assert.equal(paceMin(fresh({ energy: 2 })), PACE.slow, 'tired: later');
  const q = fresh(); q.recent.moves = [{ move: 'quiet', kind: 'quiet' }];
  assert.equal(paceMin(q), PACE.slow, 'after a quiet moment: later');
  assert.ok(PACE.quick < PACE.steady && PACE.steady < PACE.slow);
  assert.equal(paceMin(fresh(), 16), 16, 'a slower loop slows all of it');
}
ok('his pace follows his mood: sooner when excited or mid-plan, later when tired or quiet');

// ---- no money, easy food, a nap anywhere
{
  const { buy, canTake, shopLine } = await import('../shop.js');
  const { fallbackSteps } = await import('../autopilot.js');
  const { startOuting, outingTick } = await import('../world.js');
  const { passTime } = await import('../feelings.js');
  const { CHANGES } = await import('../changes.js');
  const s = fresh({ pantry: [], tools: [], garden: { seeds: [], beds: [] }, weather: { kind: 'clear', temp: 8 } });
  assert.equal(Boolean(byName('buy').when(s, now)), true, 'no coins needed to go to the store');
  assert.match(byName('buy').line(s, now), /nothing costs anything/);
  assert.ok(buy(s, 'bread', now).bought && canTake(s, now) && !/coin/.test(JSON.stringify(s)));
  // hungry with an empty house: he fetches food (a need, not a filler)
  const hungry = fresh({ fullness: 3, pantry: [] });
  assert.deepEqual([fallbackSteps(hungry, [{ name: 'buy' }], now)[0].action, fallbackSteps(hungry, [{ name: 'buy' }], now)[0].details.item], ['buy', 'bread']);
  assert.ok(byName('buy').score(hungry, now) > 3.5, 'and with a model he chooses it himself');
  // a full belly lasts most of a day
  const t = fresh({ fullness: 9, feelAt: new Date(now - 6 * 3_600_000).toISOString() });
  passTime(t, now);
  assert.ok(t.fullness > 4.5, `six hours later: ${t.fullness}`);
  // a nap outside gives him his energy back
  const n = fresh({ energy: 4, weather: { kind: 'clear', temp: 8 } });
  assert.ok(startOuting(n, { place: 'the pond in the park', what: 'take a nap on the bench' }, now).ok);
  assert.equal(n.where.thing, 'nap');
  const back = outingTick(n, Date.parse(n.where.homeAt) + 60_000);
  assert.ok(back.home && /nap|slept/i.test(back.outing.did) && n.energy >= 6.5, `${back.outing.did} (${n.energy})`);
  // the one-time change takes the coins away
  const old = fresh({ coins: 13, bought: [{ item: 'clay', price: 3, at: new Date(now).toISOString() }] });
  const said = CHANGES.find((c) => c.id === '2026-11-28 no money, and my house is my workshop').run(old, new Date(now).toISOString());
  assert.ok(old.coins === undefined && old.bought[0].price === undefined);
  assert.match(said, /Money is gone from my world.*My house is my workshop now.*rest anywhere/s);
}
ok('no money: he takes what he needs at the store, a full belly lasts, and he can nap anywhere');

// ---- his one big dream, and joy in getting better
{
  const { nameDream, dreamStep, endDream, dreamLines, bigDream } = await import('../dream.js');
  const { makePlaything, playJob, playDone } = await import('../play.js');
  const s = fresh();
  assert.equal(Boolean(byName('dream').when(s, now)), true);
  assert.match(nameDream(s, 'a real telescope on my own tower', 'yes', now).failed, /needs a why/);
  const d = nameDream(s, 'a real telescope on my own tower', 'The night sky keeps pulling at me and I want to see it properly.', now).dream;
  assert.ok(d && bigDream(s) === d);
  assert.match(nameDream(s, 'a boat as big as the pond', 'because it would be funny to try', now).failed, /One at a time/);
  assert.equal(Boolean(byName('dream').when(s, now)), false);
  assert.match(dreamLines(s, now)[0], /^MY BIG DREAM \(since today\): a real telescope on my own tower\. Because: The night sky.*I have not done anything for it yet\. It stays in front of me/);
  assert.equal(Boolean(byName('dream_step').when(s, now)), true);
  dreamStep(s, 'paced out where the tower could stand on my field', now);
  assert.match(dreamLines(s, now + 3 * 86_400_000)[0], /\(for 3 days now\).*The last thing I did for it: paced out where the tower could stand/);
  const a = toAnswer({ moves: [{ move: 'end_dream', details: { how: 'reached', why: 'The tower stands and I saw the rings of Saturn.' } }], reason: 'r', mood: 'happy' });
  assert.deepEqual([a.steps[0].as, a.steps[0].details.how], ['end_dream', 'reached']);
  const e = endDream(s, 'reached', 'The tower stands and I saw the rings of Saturn.', now + 30 * 86_400_000).dream;
  assert.ok(e.ended === 'reached' && s.bigDream === null && s.pastDreams.length === 1);
  assert.equal(Boolean(byName('dream').when(s, now)), true, 'after it he may name a new one, himself');
  // getting better at something feels good
  const t = fresh();
  const bike = makePlaything(t, { name: 'bike', parts: [{ shape: 'box', size: [1, 0.5, 0.3], pos: [0, 0.4, 0], rot: [0, 0, 0], color: '#c04030' }] }, now).thing;
  const runs = Array.from({ length: 8 }, () => playDone(t, playJob(bike), () => 0.2));
  assert.deepEqual(runs.map((r) => r.better ?? '-'), ['-', '-', 'getting the hang of it', '-', '-', '-', '-', 'good at it']);
  assert.match(runs[2].did, /I am getting the hang of it now\. I can tell\./);
}
ok('his big dream stays in front of him until he reaches it or lets it go; getting better is a joy of its own');

// ---- why he made it, what he thinks of it, and taking things apart
{
  const { findMade, setView, takeApart, takeable } = await import('../views.js');
  const { applyMade } = await import('../maker.js');
  const { brainPrompt } = await import('../brain.js');
  const { showInMuseum } = await import('../museum.js');
  const part = [{ shape: 'box', size: [0.3, 0.3, 0.3], pos: [0, 0.15, 0], rot: [0, 0, 0], color: '#a67' }];
  // his real reason stays; what the maker wrote about the making is a note beside it
  const made = applyMade({ action: 'draw', details: { what: 'a map of the night sky', why: 'I want to see where Orion stands above my field.' } }, { name: 'night map', why: 'I added more shapes because the check said it was too empty.', svg: '<svg/>' });
  assert.deepEqual([made.details.why, made.details.madeNote], ['I want to see where Orion stands above my field.', 'I added more shapes because the check said it was too empty.']);
  assert.equal(applyMade({ action: 'draw', details: { what: 'x' } }, { name: 'x', why: 'the maker knew why' }).details.why, 'the maker knew why', 'no reason of his own: the maker\'s is used');
  // what he thinks of it is kept with the thing, and he may change his mind
  const s = fresh({ art: [{ id: 'a1', name: 'night map', why: 'to see Orion', file: 'made/a1.svg' }], apps: [{ name: 'jumping_frog', title: 'Jumping Frog' }], decor: [{ id: 'd1', name: 'pendulum clock', why: 'for my hobby', parts: part, createdAt: new Date(now).toISOString() }], stored: [], museum: [], playthings: [] });
  assert.deepEqual([findMade(s, 'the night map').kind, findMade(s, 'Jumping Frog').kind, findMade(s, 'my pendulum clock').kind, findMade(s, 'a boat')], ['drawing', 'program', 'thing', null]);
  assert.equal(setView(s, 'night map', 'ok', now), null, 'a real sentence, or nothing');
  setView(s, 'night map', 'Orion came out lopsided. I like him better that way.', now);
  setView(s, 'night map', 'Seen again: the sky is too tidy. Real skies are messier.', now + 86_400_000);
  assert.deepEqual([s.art[0].thinks, s.art[0].views.length], ['Seen again: the sky is too tidy. Real skies are messier.', 2]);
  setView(s, 'pendulum clock', 'It ticks unevenly, which is the only honest thing about it.', now);
  showInMuseum(s, 'pendulum clock', 'It is my first clock.', now);
  assert.equal(s.museum[0].thinks, 'It ticks unevenly, which is the only honest thing about it.', 'what he thought goes with it to his museum');
  // his prompt asks him: right after making it, and when he sees it again
  const ctx = { soul: 'x', now: 'noon', doing: [], events: [], moves: [{ name: 'do', line: 'x' }], feelings: [], memories: [], projects: [], goals: [], room: [], fresh: [], lessons: [], messages: [], skills: '' };
  assert.match(brainPrompt({ ...ctx, ownWork: { name: 'night map', what: 'drawing', how: 'draw a new version', why: 'to see Orion' } }), /HOW MY DRAWING TURNED OUT.*I made it because: to see Orion\..*honestly think of it in own_view/s);
  assert.match(brainPrompt({ ...ctx, ownWork: { name: 'pendulum clock', what: 'thing', again: 'in my museum', why: 'for my hobby', thought: 'It ticks unevenly.' } }), /I SAW MY THING AGAIN \(in my museum\): "pendulum clock"\. I made it because: for my hobby\. What I thought of it before: "It ticks unevenly\."\s+What do I think of it now\?/);
  assert.equal(toAnswer({ moves: [{ move: 'quiet', details: {} }], reason: 'r', mood: 'calm', own_view: 'Too tidy. I would smudge it.' }).own_view, 'Too tidy. I would smudge it.');
  // taking apart: with a reason, really gone, and a record stays
  assert.match(takeApart(s, 'pendulum clock', '', now).failed, /without a reason/);
  assert.match(takeApart(s, 'a golden throne', 'it annoys me', now).failed, /no thing called/);
  const g = takeApart(s, 'pendulum clock', 'It never kept time and I am tired of pretending it does.', now).gone;
  assert.deepEqual([g.name, g.from, g.why, g.thinks, s.museum.length, s.gone.length], ['pendulum clock', 'museum', 'for my hobby', 'It ticks unevenly, which is the only honest thing about it.', 0, 1]);
  assert.ok(g.parts.length && g.said.startsWith('It never kept time'));
  assert.equal(Boolean(byName('take_apart').when(fresh({ decor: [{ id: 'x', name: 'stool', parts: part }] }), now)), true);
  assert.equal(takeable(fresh({ decor: [{ id: 'p', name: 'photo', image: 'photos/p.jpg' }, { id: 'o', name: 'tower', kind: 'outside', parts: part }] })).length, 0, 'not a picture, and not what stands outside');
}
ok('every thing keeps why he made it and what he thinks of it; he may take it apart, and a record stays');

// ---- a drawing and a thing with the same name: what he says about the thing stays with the thing
{
  const { setView, findMade } = await import('../views.js');
  const s = { art: [{ id: 'a1', name: 'Pendulum clock', file: 'made/a1.svg' }], decor: [{ id: 'd1', name: 'pendulum clock', parts: [{}] }] };
  assert.equal(setView(s, 'pendulum clock', 'It runs slow. I like that.', now, 'thing').kind, 'thing');
  assert.equal(s.decor[0].thinks, 'It runs slow. I like that.');
  assert.equal(s.art[0].thinks, undefined);
  assert.equal(setView(s, 'pendulum clock', 'The lines are too thick.', now, 'drawing').kind, 'drawing');
  assert.equal(findMade(s, 'pendulum clock', 'program').kind, 'drawing', 'a kind he has none of: the first one found');
}
ok('a drawing and a thing with the same name each keep their own view');
