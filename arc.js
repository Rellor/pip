// His mood over the day: at every wake-up the game writes down how he feels (the numbers his body already keeps, and
// his mood in one word). The page draws them as one line on the Today tab. Plain code: no model is asked.
export const ARC_KEPT = 140; // a full day of wake-ups (the page shows today)
const one = (v) => Math.round((Number(v) || 0) * 10) / 10;

// How he feels in one number, 0 to 10: joy, calm and wonder together.
export const feelOf = (p) => one(((Number(p.joy) || 0) + (Number(p.calm) || 0) + (Number(p.wonder) || 0)) / 3);

export function noteArc(s, now = Date.now(), more = {}) {
  const point = { at: new Date(now).toISOString(), joy: one(s.joy), calm: one(s.calm), wonder: one(s.wonder), energy: one(s.energy), mood: String(s.emotion || s.mood || '').slice(0, 24), ...more };
  point.feel = feelOf(point);
  const list = (s.arc ?? []).filter((p) => Date.parse(p.at) < now - 60_000); // one point per wake-up, also when it runs twice
  s.arc = [...list, point].slice(-ARC_KEPT);
  return point;
}
