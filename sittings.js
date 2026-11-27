// A thing takes time. He designs it in one go (one call to the maker, as always), but he does not build it in one go:
// a thing of a few parts takes two sittings, a bigger one three. After the first sitting only its frame stands in his
// room; he goes on with it (build_on, no model asked) until it is finished. At most two things are in progress at one
// time: first he finishes one. So a day makes fewer things, and each one is seen growing.
export const IN_PROGRESS_MAX = 2;
// How many sittings a thing takes, by how many parts it has.
export const sittingsFor = (parts) => (process.env.PIP_ONE_SITTING ? 1 : (parts ?? 0) >= 7 ? 3 : (parts ?? 0) >= 4 ? 2 : 1);
export const unfinished = (s) => (s.decor ?? []).filter((d) => !d.image && d.stages > 1 && (d.stage ?? d.stages) < d.stages);
const bare = (n) => String(n ?? '').toLowerCase().replace(/^(my|the|a|an)\s+/, '').trim();
// He started it: this was the first sitting. Returns how many sittings it takes in all.
export function startSittings(entry) {
  const n = sittingsFor(entry?.parts?.length);
  if (n > 1) { entry.stage = 1; entry.stages = n; }
  return n;
}
// He goes on with a thing he started. Returns { thing, stage, stages, done } or { failed }.
export function buildOn(s, name, now = Date.now()) {
  const open = unfinished(s);
  if (!open.length) return { failed: 'I have nothing half built to go on with' };
  const d = open.find((x) => bare(x.name) === bare(name)) ?? open.find((x) => bare(name).length > 2 && (bare(x.name).includes(bare(name)) || bare(name).includes(bare(x.name)))) ?? open[0];
  d.stage = (d.stage ?? 1) + 1;
  d.updatedAt = new Date(now).toISOString(); // (the page builds it again, with more of its parts)
  const done = d.stage >= d.stages;
  if (done) d.finishedAt = d.updatedAt;
  return { thing: d, stage: d.stage, stages: d.stages, done };
}
// For his prompt.
export function sittingLines(s) {
  const open = unfinished(s);
  if (!open.length) return [];
  return [`Half built in my room: ${open.map((d) => `${d.name} (sitting ${d.stage} of ${d.stages} done)`).join(', ')}. ${open.length >= IN_PROGRESS_MAX ? 'Two things in progress is enough: I finish one (build_on) before I start a new thing.' : 'I can go on with it (build_on) whenever I like.'}`];
}
