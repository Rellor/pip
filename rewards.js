// Extra rewards that push him to think for himself. Balanced so that doing it himself pays more than asking:
//   figured it out   a step that failed before now works, with no help from anyone      joy 1.0  wonder 0.5  fullness 0.5
//   research paid    he looked something up and then made or fixed it with those words   joy 0.6  wonder 0.5
//   asked after trying  asking someone (ask_for, request_ability) after he tried first   joy 0.3  wonder 0.2
//   asked without trying                                                                nothing
//   tested it        he used something with a real effect and wrote what happened (verdict)  joy 0.5  wonder 0.4
//   still works      a thing he built days ago still works when he uses it (once in a while: 3 days apart, each thing 7)  joy 0.7  wonder 0.4  fullness 0.3
//   lit a dark place  he switched on a lamp where it was dark and it helped (scaled like the others)  joy 0.6  calm 0.6
//   something fresh  he does something (photo, painting, sculpture, song...) he has not done for many hours  joy 0.5  wonder 0.5
//   new ability      the first time ever he uses an ability (light, drive, spin, stand, custom) joy 0.8  wonder 0.8 (once each)
// Each kind pays less the more often it paid today (full, then 60%, then 30%, then nothing), so it cannot run away.
// The bars also drift back toward the middle by themselves (see passTime), so a reward is a push, never a way to sit at 10.
import { nudge } from './feelings.js';
import { DORMANT } from './mirror.js';

const MAKE = ['decorate', 'extend_thing', 'change_thing', 'add_use', 'use', 'move_thing', 'make_move', 'compose', 'draw', 'make_app', 'update_app', 'make_clothes', 'place_picture', 'cook', 'plant', 'water', 'harvest'];
const ASK = ['ask_for', 'request_ability'];
const REWARD = { fixed: { joy: 1, wonder: 0.5, fullness: 0.5 }, research: { joy: 0.6, wonder: 0.5 }, asked: { joy: 0.3, wonder: 0.2 }, tested: { joy: 0.5, wonder: 0.4 }, lit: { joy: 0.6, calm: 0.6 }, fresh: { joy: 0.5, wonder: 0.5 } };
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
    const dorm = DORMANT.find(([a]) => a === st.action);
    if (dorm && !st.made?.failed && !st.failed) {
      s.doneAt ??= {};
      const before = Math.max(Date.parse(s.doneAt[st.action] ?? 0), ...(s.log ?? []).filter((e) => e.action === st.action && now - Date.parse(e.at) > 600_000).map((e) => Date.parse(e.at)));
      s.doneAt[st.action] = new Date(now).toISOString();
      if (now - before >= dorm[2] * 3_600_000 && pay(s, 'fresh', now)) paid.push(`something fresh: ${st.action.replace('_', ' ')}`);
    }
    if (MAKE.includes(st.action) && st.made?.failed) {
      tried = true;
      continue;
    }
    if (MAKE.includes(st.action) && !st.made?.failed && name) {
      const before = recent.filter((e) => MAKE.includes(e.action) && e.failed && String(e.name ?? '').toLowerCase() === name && Date.parse(e.at) > Date.parse(s.fixedAt[name] ?? 0));
      if (before.length) {
        s.fixedAt[name] = new Date(now).toISOString();
        if (pay(s, 'fixed', now)) paid.push(`figured out ${name}`);
      } else {
      const mine = new Set(words(`${name} ${st.details?.why ?? ''}`));
      const dug = lookedUp.some((w) => mine.has(w)) || recent.slice(-6).some((e) => ['search_web', 'read_book'].includes(e.action) && words(`${e.query ?? ''} ${e.topic ?? ''}`).some((w) => mine.has(w)));
      if (dug && !st.researchPaid && pay(s, 'research', now)) {
        st.researchPaid = true;
        paid.push(`research paid off for ${name}`);
      }
      }
    }
    if (st.action === 'use' && !st.made?.failed && st.made?.ref?.does) {
      const does = st.made.ref.does;
      s.abilitiesUsed ??= [];
      if (!s.abilitiesUsed.includes(does)) { // the first time ever he uses this kind of ability
        s.abilitiesUsed.push(does);
        for (const [bar, v] of Object.entries({ joy: 0.8, wonder: 0.8 })) nudge(s, bar, v);
        paid.push(`first time using the ${does} ability`);
      }
      const e = (s.decor ?? []).find((x) => x.id === st.made.ref.id);
      const days = (iso) => (now - Date.parse(iso ?? 0)) / 86_400_000;
      if (e && days(e.at) >= 1 && days(e.keptAt) >= 7 && days(s.keptAt) >= 3) { // something he built a while ago still does its job
        e.keptAt = s.keptAt = new Date(now).toISOString();
        for (const [bar, v] of Object.entries({ joy: 0.7, wonder: 0.4, fullness: 0.3 })) nudge(s, bar, v);
        paid.push(`${e.name} still works, days after he built it`);
      }
      if (String(st.details?.verdict ?? '').trim().length >= 15 && pay(s, 'tested', now)) paid.push(`tested ${name || 'it'} and wrote what happened`);
    }
    if (st.litUp && pay(s, 'lit', now)) paid.push(`lit up a dark place (${st.litUp.from}% to ${st.litUp.to}%)`);
    if (ASK.includes(st.action) && !st.made?.failed && tried && pay(s, 'asked', now)) paid.push('asked after trying');
  }
  return paid;
}
