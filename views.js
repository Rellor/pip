// What he thinks of his own work, and taking it apart.
// - Every thing he makes keeps its real reason (why he made it). After he has made something he looks at it, and what he
//   thinks of it then is kept with the thing, in his own words. When he sees it again later (in his museum, in his
//   workshop) he may think something new: the newest view is shown, the older ones are kept behind it.
// - He may take apart or destroy anything he made. It is really gone from his world, but a record stays: what it was,
//   why he made it, what he thought of it, and why he took it apart.
export const VIEWS_KEPT = 4;
export const GONE_KEPT = 60;
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const bare = (n) => clip(n, 80).toLowerCase().replace(/^(my|the|a|an)\s+/, '');
const lists = (s) => [['drawing', s.art ?? []], ['program', s.apps ?? []], ['thing', (s.decor ?? []).filter((d) => !d.image)], ['thing', s.stored ?? []], ['thing', s.museum ?? []], ['thing', s.playthings ?? []], ['song', s.studio?.songs ?? []]];
const nameOf = (x) => x.name ?? x.title ?? '';
// Something he made, by its name: { item, kind } (the newest one with that name), or null.
// (A drawing and a thing can have the same name: "pendulum clock". With `kind` given, that kind is looked at first.)
export function findMade(s, name, kind = null) {
  const n = bare(name);
  if (n.length < 2) return null;
  const all = lists(s);
  const ordered = kind ? [...all.filter(([k]) => k === kind), ...all.filter(([k]) => k !== kind)] : all;
  for (const exact of [true, false]) for (const [kind, list] of ordered) {
    const item = [...list].reverse().find((x) => (exact ? bare(nameOf(x)) === n || bare(x.title) === n : n.length > 3 && (bare(nameOf(x)).includes(n) || n.includes(bare(nameOf(x))))));
    if (item) return { item, kind };
  }
  return null;
}
// What he thinks of it now, in his own words. Returns the thing, or null when it is not his or he said nothing.
export function setView(s, name, text, now = Date.now(), kind = null) {
  const words = clip(text, 300);
  const hit = findMade(s, name, kind);
  if (!hit || words.length < 6) return null;
  const at = new Date(now).toISOString();
  hit.item.views = [...(hit.item.views ?? []), { at, text: words }].slice(-VIEWS_KEPT);
  hit.item.thinks = words;
  hit.item.thinksAt = at;
  return hit;
}

// He takes something apart (or throws it away, or destroys it). `why` is his reason: without one it stays.
// Returns { gone } (the record that is kept) or { failed }.
export function takeApart(s, name, why, now = Date.now()) {
  const reason = clip(why, 240);
  const n = bare(name);
  if (n.length < 2) return { failed: 'I did not say what I take apart' };
  if (reason.length < 8) return { failed: `I do not take ${clip(name, 40)} apart without a reason: I say why` };
  const places = [['room', 'decor'], ['chest', 'stored'], ['museum', 'museum'], ['playthings', 'playthings']];
  for (const [where, key] of places) {
    const list = s[key] ?? [];
    const d = list.find((x) => !x.image && !x.art && bare(x.name) === n) ?? list.find((x) => !x.image && !x.art && n.length > 3 && (bare(x.name).includes(n) || n.includes(bare(x.name))));
    if (!d) continue;
    if (key === 'decor') for (const x of s.decor) if (String(x.base ?? '').split('#')[0] === d.id) delete x.base; // what stood on it stays
    s[key] = list.filter((x) => x.id !== d.id);
    const gone = { id: d.id, name: d.name, why: clip(d.why, 200), thinks: d.thinks ?? null, parts: d.parts ?? [], createdAt: d.createdAt ?? d.at ?? null, goneAt: new Date(now).toISOString(), said: reason, from: where };
    s.gone = [...(s.gone ?? []), gone].slice(-GONE_KEPT);
    return { gone };
  }
  return { failed: `I have no thing called "${clip(name, 60)}" to take apart` };
}
// What he could take apart (for the move): the things in his room, chest, museum and what he plays with.
export const takeable = (s) => [...(s.decor ?? []).filter((d) => !d.image && !d.art && d.kind !== 'outside'), ...(s.stored ?? []).filter((d) => !d.image), ...(s.museum ?? []), ...(s.playthings ?? [])];
