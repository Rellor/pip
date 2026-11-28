// A big thing takes days. He designs it in one go (one call to the maker, as always). A small thing is also built in one
// go. A big thing (many parts) is built in three sittings, one a day: after the first only its frame stands in his
// workshop, and he goes on with it on the next days (build_on, no model asked). Nothing stops him from starting other
// things in between: how many he has going is his own business.
import { isToday } from './days.js';

export const BIG_PARTS = 8; // from this many parts a thing is a big thing
export const BIG_SITTINGS = 3;
export const sittingsFor = (parts) => (process.env.PIP_ONE_SITTING ? 1 : (parts ?? 0) >= BIG_PARTS ? BIG_SITTINGS : 1);
export const unfinished = (s) => (s.decor ?? []).filter((d) => !d.image && d.stages > 1 && (d.stage ?? d.stages) < d.stages);
// The ones he can go on with now: not the ones he already worked on today.
export const canBuildOn = (s, now = Date.now()) => unfinished(s).filter((d) => !isToday(d.sittingAt ?? d.createdAt ?? d.at, now));
const bare = (n) => String(n ?? '').toLowerCase().replace(/^(my|the|a|an)\s+/, '').trim();
// He started it: this was the first sitting. Returns how many sittings it takes in all.
export function startSittings(entry, now = Date.now()) {
  const n = sittingsFor(entry?.parts?.length);
  if (n > 1) { entry.stage = 1; entry.stages = n; entry.sittingAt = new Date(now).toISOString(); }
  return n;
}
// He goes on with a big thing he started. Returns { thing, stage, stages, done } or { failed }.
export function buildOn(s, name, now = Date.now()) {
  const open = unfinished(s);
  if (!open.length) return { failed: 'I have nothing half built to go on with' };
  const ready = canBuildOn(s, now);
  if (!ready.length) return { failed: `I worked on my ${open[0].name} today already. A big thing takes days: I go on with it tomorrow` };
  const d = ready.find((x) => bare(x.name) === bare(name)) ?? ready.find((x) => bare(name).length > 2 && (bare(x.name).includes(bare(name)) || bare(name).includes(bare(x.name)))) ?? ready[0];
  d.stage = (d.stage ?? 1) + 1;
  d.updatedAt = new Date(now).toISOString(); // (the page builds it again, with more of its parts)
  d.sittingAt = d.updatedAt;
  const done = d.stage >= d.stages;
  if (done) d.finishedAt = d.updatedAt;
  return { thing: d, stage: d.stage, stages: d.stages, done };
}
// For his prompt.
export function sittingLines(s, now = Date.now()) {
  const open = unfinished(s);
  if (!open.length) return [];
  const ready = canBuildOn(s, now);
  return [`Half built in my workshop: ${open.map((d) => `${d.name} (day ${d.stage} of ${d.stages} done)`).join(', ')}. A big thing takes days. ${ready.length ? `I can go on with ${ready.length === 1 ? 'it' : 'one'} today (build_on).` : 'I did my part for today: tomorrow I go on.'}`];
}
