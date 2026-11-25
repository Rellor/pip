// What counts as "today" for everything Pip may do a few times a day (make things, draw, cook, move things ...).
// A day is his own day: the Dutch calendar day. What he did late last night counts for a few more hours, so midnight
// does not hand him a fresh set, but when he wakes up in the morning everything is new again. (It used to be "the last
// 24 hours": then three things made on an afternoon kept him from making anything the whole next morning.)
const TZ = 'Europe/Amsterdam';
export const DAY = 86_400_000;
export const LATE_H = 6; // how long something from before midnight still counts
const dayNL = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });
// Did this (an ISO time, or milliseconds) happen today?
export function isToday(when, now = Date.now()) {
  const t = typeof when === 'number' ? when : Date.parse(when);
  if (!Number.isFinite(t) || t > now + 3_600_000) return false;
  const ago = now - t;
  return ago < LATE_H * 3_600_000 || (ago < DAY && dayNL(t) === dayNL(now));
}
