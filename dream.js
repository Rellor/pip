// His one big dream. Not a want for the list, not a goal for today: something he really wants to reach, have or do,
// that takes a long time (Pino has a real train ticket he saves for). He names it himself, when something grips him,
// and says why. From then on it stays in front of him at every thought, until he reaches it or lets it go.
// There is one at a time. What became of the earlier ones is kept.
const DAY = 86_400_000;
export const DREAMS_KEPT = 8;
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export const bigDream = (s) => s.bigDream ?? null;
// He names his dream. Returns { dream } or { failed }.
export function nameDream(s, what, why, now = Date.now()) {
  const text = clip(what, 160), reason = clip(why, 240);
  if (s.bigDream) return { failed: `I have a big dream already: "${s.bigDream.text}". One at a time: first I reach it or let it go` };
  if (text.length < 8) return { failed: 'I did not say what my dream is' };
  if (reason.length < 12 || reason.split(' ').length < 3) return { failed: 'a big dream needs a why: I say in one honest sentence why this matters to me' };
  s.bigDream = { id: `dr${now.toString(36)}`, text, why: reason, since: new Date(now).toISOString(), steps: [] };
  return { dream: s.bigDream };
}
// Something he did for it today (kept as its story: the last few).
export function dreamStep(s, what, now = Date.now()) {
  if (!s.bigDream || clip(what, 10).length < 4) return null;
  s.bigDream.steps = [...(s.bigDream.steps ?? []), { at: new Date(now).toISOString(), what: clip(what, 160) }].slice(-12);
  return s.bigDream;
}
// It ends: he reached it ('reached') or let it go ('gone'). Returns the dream as it is kept, or { failed }.
export function endDream(s, how, words, now = Date.now()) {
  const d = s.bigDream;
  if (!d) return { failed: 'I have no big dream right now' };
  if (clip(words, 10).length < 6) return { failed: how === 'reached' ? 'I did not say how I reached it' : 'I did not say why I let it go' };
  const kept = { ...d, ended: how, endedAt: new Date(now).toISOString(), words: clip(words, 240) };
  s.pastDreams = [...(s.pastDreams ?? []), kept].slice(-DREAMS_KEPT);
  s.bigDream = null;
  return { dream: kept };
}
// For his prompt: it is in front of him at every thought.
export function dreamLines(s, now = Date.now()) {
  const d = s.bigDream;
  if (!d) return [];
  const days = Math.floor((now - Date.parse(d.since)) / DAY);
  const last = (d.steps ?? []).at(-1);
  return [`MY BIG DREAM${days ? ` (for ${days} day${days === 1 ? '' : 's'} now)` : ' (since today)'}: ${d.text}. Because: ${d.why}${last ? ` The last thing I did for it: ${last.what}.` : ' I have not done anything for it yet.'} It stays in front of me. Is there one small thing I can do for it now?`];
}
