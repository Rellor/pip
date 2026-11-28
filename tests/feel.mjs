// What things do to him: making is not the only reward, an outing counts for what the place gave him, and he can feel
// less alone without anybody writing to him.
import assert from 'node:assert/strict';
import { stepFeelings, ensureFeelings } from '../feelings.js';
import { ensureBody, tickBody, noteMove } from '../body.js';
import { noteLift, feelSum, feelParts, feelDiff, beliefs } from '../night.js';
import { startOuting, outingTick } from '../world.js';
import { CHANGES } from '../changes.js';

const ok = (name) => console.log(`ok  ${name}`);
delete process.env.PIP_NO_OUT;
const now = Date.parse('2026-11-27T11:00:00Z');
const HOUR = 3_600_000, MIN = 60_000;
const iso = (ms) => new Date(ms).toISOString();
const fresh = (more = {}) => { const s = { energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 4, loneliness: 6, emo: { irritated: 0, sad: 0, excited: 0 }, weather: { kind: 'clear', temp: 8 }, outings: [], log: [], decor: [], curious: { sparks: [], interests: [] }, ...more }; ensureFeelings(s); ensureBody(s, now); return s; };
const after = (action, more = {}) => { const s = fresh(); stepFeelings(s, { action, enjoyment: 9, ...more }); return s; };

// ---- making satisfies but tires; playing and going out are real pleasures
{
  const build = after('decorate'), play = after('play'), music = after('play_piano'), out = after('go_out'), read = after('read_book');
  assert.ok(build.energy < music.energy - 0.5 && build.energy < read.energy - 0.5, 'building takes more out of him than playing music or reading');
  assert.ok(play.joy > build.joy + 0.5, 'being out with his bike or kite makes him gladder than building one more thing');
  assert.ok(music.joy > build.joy, 'music is the quick way to let something out');
  assert.ok(out.calm > 5 && out.wonder > 5, 'setting off does him good already');
  assert.ok(feelSum(play) > feelSum(build) && feelSum(out) >= feelSum(build) - 0.3);
  const rested = after('rest');
  assert.ok(rested.joy >= 5, 'resting does not make him feel worse');
}
ok('making satisfies but tires; playing, music and going out are pleasures of their own');

// ---- an outing counts for what the place gave him, and a belief says what a thing does to him
{
  const s = fresh({ today: { day: '2026-11-27', lift: {} }, days: [] });
  const before = { sum: feelSum(s), parts: feelParts(s) };
  startOuting(s, { place: 'the pond in the park', what: 'watch the ducks' }, now);
  const back = outingTick(s, Date.parse(s.where.homeAt) + MIN);
  assert.ok(back.home);
  noteLift(s, ['go_out'], before.sum, feelSum(s), feelDiff(before.parts, feelParts(s)));
  assert.ok(s.today.lift.go_out > 0.5, `a walk to the pond lifts him: ${s.today.lift.go_out}`);
  assert.ok(s.feels.go_out.calm > 0 && s.feels.go_out.joy > 0);
  s.days = [1, 2, 3].map((d) => ({ day: `2026-11-2${d}`, lifted: ['go_out', 'play_piano'], lowered: [] }));
  s.feels.play_piano = { joy: 0.9, wonder: 0.1, calm: 0.3 };
  const b = beliefs(s);
  assert.match(b.find((x) => x.action === 'go_out').text, /^Going outside (settles me|makes me glad|wakes me up)$/);
  assert.equal(b.find((x) => x.action === 'play_piano').text, 'Playing music makes me glad');
  assert.equal(beliefs({ days: s.days }).find((x) => x.action === 'go_out').text, 'Going outside lifts me', 'with nothing counted yet it only says that it lifts him');
}
ok('a walk is counted for what the place did to him, and his beliefs say what a thing does: settles, gladdens, wakes up');

// ---- loneliness: slower, and people around him help
{
  const s = fresh();
  s.body.loneliness = 2;
  s.body.at = iso(now - 3 * HOUR);
  tickBody(s, now);
  assert.ok(s.body.loneliness < 2.6, `three hours alone: ${s.body.loneliness}`);
  s.body.loneliness = 8;
  noteMove(s, 'read_book', { now });
  assert.ok(s.body.loneliness < 8, 'at the library there are people around him');
  s.body.loneliness = 8; s.loneliness = 8;
  startOuting(s, { place: 'the library', what: 'read' }, now);
  outingTick(s, Date.parse(s.where.homeAt) + MIN);
  assert.ok(s.body.loneliness <= 6.6, `after the library: ${s.body.loneliness}`);
  s.body.boredom = 8; s.boredom = 8;
  startOuting(s, { place: 'the pond in the park', what: 'watch the ducks' }, now + 3 * HOUR);
  outingTick(s, Date.parse(s.where.homeAt) + MIN);
  assert.ok(s.body.boredom < 8, 'an outing really takes the dullness off (it used to be forgotten at the next wake-up)');
}
ok('he grows lonely more slowly, and being among people in his village helps without anybody writing');

// ---- the one-time change: the wrong marks go
{
  const s = fresh({ days: [{ day: 'a', lifted: ['draw'], lowered: ['go_out', 'move_thing'] }, { day: 'b', lifted: [], lowered: ['rest', 'browse'] }], beliefs: [{ action: 'go_out', lifts: false, text: 'Going outside wears me down' }, { action: 'draw', lifts: true, text: 'Drawing lifts me' }] });
  s.body.loneliness = 10;
  const said = CHANGES.find((c) => c.id === '2026-11-28 what things do to me').run(s, iso(now));
  assert.deepEqual(s.days.map((d) => d.lowered), [['move_thing'], []]);
  assert.deepEqual(s.beliefs.map((b) => b.action), ['draw']);
  assert.equal(s.body.loneliness, 5);
  assert.match(said, /That was wrong/);
}
ok('the belief that going outside wears him down is taken back');
