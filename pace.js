// His pace follows his mood. When he is excited or in the middle of a plan, he thinks again sooner; when he is tired or
// having quiet time, later. Over a day it comes to about the same number of wake-ups (and model calls) as a steady one.
// The loop (loop.js) reads when he wants to wake next from his state.
export const PACE = { quick: 5, steady: 8, slow: 12 };
// How many minutes until his next wake-up, from how he is right now. `base` is the steady pace the loop was given.
export function paceMin(s, base = PACE.steady) {
  const scale = base / PACE.steady;
  const excited = (s.emo?.excited ?? 0) >= 4 || (s.joy ?? 5) >= 7.8 || (s.plan?.queue ?? []).length > 0;
  const lastKinds = (s.recent?.moves ?? []).slice(-2).map((m) => m.kind);
  const quiet = (s.energy ?? 5) <= 3 || lastKinds.at(-1) === 'quiet' || lastKinds.at(-1) === 'rest';
  const min = quiet ? PACE.slow : excited ? PACE.quick : PACE.steady;
  return Math.max(3, Math.round(min * scale));
}
