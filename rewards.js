// Extra rewards that push him to think for himself. Balanced so that doing it himself pays more than asking:
//   figured it out   a step that failed before now works, with no help from anyone      joy 1.0  wonder 0.5  fullness 0.5
//   research paid    he looked something up and then made or fixed it with those words   joy 0.6  wonder 0.5
//   asked after trying  asking someone (ask_for, request_ability) after he tried first   joy 0.3  wonder 0.2
//   asked without trying                                                                nothing
// Each kind pays less the more often it paid today (full, then 60%, then 30%, then nothing), so it cannot run away.
// The bars also drift back toward the middle by themselves (see passTime), so a reward is a push, never a way to sit at 10.
import { nudge } from './feelings.js';

const MAKE = ['decorate', 'extend_thing', 'change_thing', 'add_use', 'use', 'move_thing', 'make_move', 'compose', 'draw', 'make_app', 'update_app', 'make_clothes', 'place_picture', 'cook'];
const ASK = ['ask_for', 'request_ability'];
const REWARD = { fixed: { joy: 1, wonder: 0.5, fullness: 0.5 }, research: { joy: 0.6, wonder: 0.5 }, asked: { joy: 0.3, wonder: 0.2 } };
const SCALE = [1, 0.6, 0.3, 0];
const words = (t) => (String(t ?? '').toLowerCase().match(/[a-z]{4,}/g) ?? []);
const day = (now) => new Date(now).toISOString().slice(0, 10);

function pay(s, kind, now) {
  s.rewardDay = s.rewardDay?.date === day(now) ? s.rewardDay : { date: day(now), n: {} };
  const k = s.rewardDay.n[kind] ?? 0;
  const f = SCALE[Math.min(k, SCALE.length - 1)];
  if (!f) return 0;
  s.rewardDay.n[kind] = k + 1;
  for (const [bar, v] of Object.entries(REWARD[kind])) nudge(s, bar, v * f);
  return f;
}

// steps: this wake-up's steps, after they ran (made is set). Returns what was paid, for the log.
export function bonusRewards(s, steps, now = Date.now()) {
  const paid = [];
  const recent = (s.log ?? []).filter((e) => now - Date.parse(e.at) < 86_400_000);
  s.fixedAt ??= {};
  let tried = recent.some((e) => MAKE.includes(e.action) && e.failed);
  const lookedUp = []; // words he looked up in this wake-up, before the step
  for (const st of steps) {
    const name = String(st.details?.name ?? '').toLowerCase();
    if (['search_web', 'read_book'].includes(st.action)) lookedUp.push(...words(`${st.details?.query ?? ''} ${st.details?.topic ?? ''}`));
    if (MAKE.includes(st.action) && st.made?.failed) {
      tried = true;
      continue;
    }
    if (MAKE.includes(st.action) && !st.made?.failed && name) {
      const before = recent.filter((e) => MAKE.includes(e.action) && e.failed && String(e.name ?? '').toLowerCase() === name && Date.parse(e.at) > Date.parse(s.fixedAt[name] ?? 0));
      if (before.length) {
        s.fixedAt[name] = new Date(now).toISOString();
        if (pay(s, 'fixed', now)) paid.push(`figured out ${name}`);
        continue;
      }
      const mine = new Set(words(`${name} ${st.details?.why ?? ''}`));
      const dug = lookedUp.some((w) => mine.has(w)) || recent.slice(-6).some((e) => ['search_web', 'read_book'].includes(e.action) && words(`${e.query ?? ''} ${e.topic ?? ''}`).some((w) => mine.has(w)));
      if (dug && !st.researchPaid && pay(s, 'research', now)) {
        st.researchPaid = true;
        paid.push(`research paid off for ${name}`);
      }
    }
    if (ASK.includes(st.action) && !st.made?.failed && tried && pay(s, 'asked', now)) paid.push('asked after trying');
  }
  return paid;
}
