// Helps Pip not say the same thing again and again.

const STOP = new Set('about also been being could does from have into just like more most much only other over same than that their them then there these they this those very what when where which while with would your really because still much'.split(' '));
const stem = (w) => (w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const wordsOf = (t) => new Set((String(t).toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)).map(stem));

// Share of the shorter message's words that also appear in the other one (0 to 1).
export function overlap(a, b) {
  const x = wordsOf(a);
  const y = wordsOf(b);
  if (x.size < 3 || y.size < 3) return 0;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.min(x.size, y.size);
}

// True when `text` says almost the same as one of the recent messages.
export const tooSimilar = (text, recent, threshold = 0.55) => recent.some((r) => overlap(text, r) >= threshold);

// Things that are new since Pip last wrote to Bas: his own material for a message that is not a copy.
export function sinceLastWrote(s, now = Date.now()) {
  const last = s.outbox.filter((m) => m.kind === 'tell').at(-1)?.at;
  const since = last ? Date.parse(last) : 0;
  const fresh = (iso) => Date.parse(iso) > since && Date.parse(iso) <= now;
  const out = [];
  for (const e of s.log ?? []) if (fresh(e.at) && e.opened?.title && ['search_web', 'read_book'].includes(e.action)) out.push(`I read about ${e.opened.title}`);
  for (const d of s.decor ?? []) if (fresh(d.createdAt) && !d.image) out.push(`I made ${d.name}`);
  for (const p of s.projects ?? []) if (fresh(p.since)) out.push(`I started a project: ${p.title}`);
  for (const w of s.wants ?? []) if (fresh(w.since)) out.push(`I now want ${w.text}`);
  for (const q of s.questions ?? []) if (fresh(q.since)) out.push(`I wonder: ${q.text}`);
  for (const m of s.memories ?? []) if (fresh(m.at)) out.push(`I want to remember: ${m.text}`);
  return [...new Set(out)].slice(-6);
}
