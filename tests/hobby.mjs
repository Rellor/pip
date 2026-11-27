// A hobby of his own idea (curiosity.js): he thinks "I want to start graffiti", says why, and then really tries it.
import assert from 'node:assert/strict';
import { startHobby, practiseHobby, dropUntriedHobbies, hobbyLines, hobbyMoves, hobbyIdeas, canStartHobby, tryingHobbies, fade, levelOf, HOBBY_AT, HOBBY_REAL_AFTER, HOBBY_DROP_DAYS, HOBBY_IDEA_EVERY_DAYS, HOBBIES_TRYING_MAX, MASTER_AFTER } from '../curiosity.js';
import { byName } from '../moves.js';
import { toAnswer } from '../brain.js';

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-27T11:00:00Z');
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const fresh = (more = {}) => ({ body: { boredom: 6, creativity: 5 }, curious: { sparks: [], interests: [] }, log: [], news: { items: [] }, ...more });

// ---- which moves are a way to do a hobby
for (const [topic, moves] of [['graffiti', ['paint_wall']], ['bird watching at the pond', ['go_out']], ['baking bread', ['cook']], ['land art with hills and holes', ['shape_land']], ['chess', ['search_web', 'read_book']], ['reading old books', ['read_book', 'write_diary', 'search_web']]]) assert.deepEqual(hobbyMoves(topic), moves, topic);
assert.ok(hobbyMoves('writing songs for my flute').slice(0, 2).includes('play_piano') && hobbyMoves('building big things on my field').includes('build_outside') && hobbyMoves('making small games').includes('make_app'));
ok('every hobby has a way to do it: graffiti is painting a wall, bird watching is going out');

// ---- he thinks of a hobby, and says why
{
  const s = fresh();
  assert.equal(canStartHobby(s, now), true);
  assert.match(startHobby(s, 'graffiti', '', now).failed, /a hobby needs a why/);
  assert.match(startHobby(s, 'graffiti', 'because', now).failed, /a hobby needs a why/);
  assert.match(startHobby(s, '', 'I want something to do with my hands', now).failed, /did not say what/);
  const r = startHobby(s, 'I want to start graffiti as a hobby', 'The walls are bare and somebody should say something on them.', now);
  assert.ok(r.hobby && r.hobby.topic === 'graffiti' && r.hobby.own && r.hobby.score === HOBBY_AT && r.hobby.practice === 0 && r.hobby.moves[0] === 'paint_wall' && /walls are bare/.test(r.hobby.why), JSON.stringify(r));
  assert.equal(levelOf(r.hobby), 'hobby');
  assert.equal(tryingHobbies(s).length, 1);
  assert.match(startHobby(s, 'graffiti', 'I still want it very much', now + 4 * DAY).failed, /is a hobby of mine already/);
  assert.equal(canStartHobby(s, now + 0.5 * DAY), false, 'not two new ideas in one day');
  assert.match(startHobby(s, 'pottery', 'I like the idea of mud that stays', now + 0.5 * DAY).failed, /only a little while ago/);
  assert.equal(canStartHobby(s, now + HOBBY_IDEA_EVERY_DAYS * DAY), true);
  assert.ok(startHobby(s, 'pottery', 'I like the idea of mud that stays', now + HOBBY_IDEA_EVERY_DAYS * DAY).hobby);
  assert.ok(startHobby(s, 'juggling', 'My hands want something silly to do.', now + 2 * HOBBY_IDEA_EVERY_DAYS * DAY).hobby);
  assert.equal(tryingHobbies(s).length, HOBBIES_TRYING_MAX);
  assert.match(startHobby(s, 'kites', 'the sky is empty and I have string', now + 9 * DAY).failed, /still have not tried graffiti or pottery or juggling/);
  // an interest he already had becomes his own hobby
  const t = fresh({ curious: { sparks: [], interests: [{ topic: 'Night sky', score: 10.8, since: iso(now - 9 * DAY) }] } });
  const n = startHobby(t, 'the night sky', 'I look at it every evening anyway', now);
  assert.ok(n.hobby.own && n.hobby.score === 10.8 && t.curious.interests.length === 1 && n.hobby.moves.includes('go_out'));
}
ok('start_hobby: his own idea, with a why, one idea at a time');

// ---- doing it counts, and three times makes it a real hobby
{
  const s = fresh();
  startHobby(s, 'graffiti', 'The walls are bare and somebody should say something.', now);
  assert.deepEqual(practiseHobby(s, [{ action: 'eat', food: 'mint' }, { action: 'do', as: 'start_hobby', what: 'decide to try graffiti as a hobby' }], now), [], 'eating is not graffiti, and neither is deciding');
  assert.deepEqual(practiseHobby(s, [{ action: 'draw', as: 'paint_wall', name: 'giant fox', failed: 'no wall' }], now), [], 'a try that failed does not count');
  const one = practiseHobby(s, [{ action: 'draw', as: 'paint_wall', name: 'giant fox' }, { action: 'draw', as: 'paint_wall', name: 'second fox' }], now + 3_600_000);
  assert.ok(one.length === 1 && one[0].hobby.practice === 1 && one[0].became === null && one[0].hobby.score > HOBBY_AT, 'once per wake-up');
  assert.equal(practiseHobby(s, [{ action: 'search_web', query: 'how graffiti artists plan a piece' }], now + 2 * 3_600_000)[0].hobby.practice, 2, 'looking it up counts too: the word is in it');
  const three = practiseHobby(s, [{ action: 'draw', as: 'paint_wall', name: 'a crown' }], now + DAY);
  assert.equal(three[0].became, 'real');
  assert.equal(tryingHobbies(s).length, 0, 'no longer only an idea');
  for (let i = HOBBY_REAL_AFTER; i < MASTER_AFTER - 1; i++) assert.equal(practiseHobby(s, [{ action: 'draw', as: 'paint_wall', name: `piece ${i}` }], now + (i + 2) * DAY)[0].became, null);
  const last = practiseHobby(s, [{ action: 'draw', as: 'paint_wall', name: 'the big one' }], now + 20 * DAY);
  assert.ok(last[0].became === 'mastered' && levelOf(last[0].hobby) === 'mastered');
}
ok('painting a wall counts for graffiti: three times is a real hobby, twelve is mastered');

// ---- an idea he never tries is let go; one he tried stays
{
  const s = fresh();
  startHobby(s, 'graffiti', 'The walls are bare and somebody should say something.', now);
  startHobby(s, 'kites', 'the sky is empty and I have string', now + HOBBY_IDEA_EVERY_DAYS * DAY);
  practiseHobby(s, [{ action: 'draw', as: 'paint_wall', name: 'giant fox' }], now + DAY);
  fade(s, now); fade(s, now + 6 * DAY);
  assert.ok(s.curious.interests.every((i) => i.score >= HOBBY_AT), 'his own ideas do not fade away quietly');
  assert.deepEqual(dropUntriedHobbies(s, now + 2 * DAY), []);
  const gone = dropUntriedHobbies(s, now + (HOBBY_IDEA_EVERY_DAYS + HOBBY_DROP_DAYS) * DAY);
  assert.deepEqual(gone.map((g) => g.topic), ['kites']);
  assert.deepEqual(s.curious.interests.map((i) => i.topic), ['graffiti'], 'what he tried stays');
}
ok('an idea he never tries is let go after a few days');

// ---- he hears about it when he thinks, with a way to do it
{
  const s = fresh();
  startHobby(s, 'graffiti', 'The walls are bare.  Somebody should say something.', now);
  const line = hobbyLines(s, ['paint_wall', 'draw', 'go_out'], now + 2 * DAY)[0];
  assert.match(line, /My own idea: I want to try graffiti as a hobby \(The walls are bare\. Somebody should say something\.\)\. I have not tried it yet, and it has been 2 days\. A way to do it now: paint a wall \(paint_wall\)\./);
  assert.match(hobbyLines(s, ['draw', 'go_out'], now)[0], /find out how it is done first \(search_web\)/, 'the wall is not his to paint right now');
  for (let i = 0; i < HOBBY_REAL_AFTER; i++) practiseHobby(s, [{ action: 'draw', as: 'paint_wall', name: `p${i}` }], now + i * DAY);
  assert.match(hobbyLines(s, ['paint_wall'], now + 5 * DAY)[0], /^My hobby: graffiti \(I did it 3 times\)\. A way to do it now: paint a wall/);
  assert.deepEqual(hobbyLines(fresh(), [], now), []);
}
ok('his prompt names the hobby he is trying and a move that does it');

// ---- the move
{
  const move = byName('start_hobby');
  const s = fresh();
  const line = move.line(s, now);
  assert.ok(move.when(s, now) && line.length < 240 && /try as a hobby, and say why/.test(line) && /or anything else/.test(line), line);
  assert.equal(hobbyIdeas(s, now).length, 3);
  assert.notDeepEqual(hobbyIdeas(s, now), hobbyIdeas(s, now + DAY), 'other ideas on another day');
  assert.ok(move.score(fresh({ body: { boredom: 9 } })) > move.score(fresh({ body: { boredom: 1 } })), 'boredom makes a new hobby more inviting');
  startHobby(s, 'graffiti', 'The walls are bare and somebody should say something.', now);
  assert.equal(Boolean(move.when(s, now + 0.5 * DAY)), false);
  assert.ok(!hobbyIdeas(s, now).some((i) => /graffiti/.test(i)), 'not what he does already');
  const st = toAnswer({ moves: [{ move: 'start_hobby', details: { what: 'graffiti', why: 'the walls are bare' }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['start_hobby']).steps[0];
  assert.deepEqual([st.action, st.as, st.details.hobby, st.details.why, st.details.what], ['do', 'start_hobby', 'graffiti', 'the walls are bare', 'decide to try graffiti as a hobby']);
}
ok('the move: offered now and then, with a few ideas that fit his world');
