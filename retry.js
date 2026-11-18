// When a step does not work, Pip does not sit out the rest of his 8 minutes with filler: he wakes again in a minute or
// two and thinks again, with a guide (what went wrong and what he can do instead). If the same thing fails again on that
// second try, there is no third: he moves on (and the loop breaker rests that move).
// loop.js reads s.wakeSoon and wakes him early.
import { supportsInfo } from './decor.js';

export const RETRY_AFTER_S = 70; // after the failed step shows on the page
export const MAX_RETRIES_PER_DAY = 10;
const DAY = 86_400_000;
const WAITING = /used up|enough for today|again today|a day\b|already .* today|is asleep|sleeping/i; // a daily limit only waits for tomorrow
const keyOf = (e) => `${e.action}:${String(e.name ?? e.what ?? e.query ?? e.dish ?? '').toLowerCase().slice(0, 40)}`;

// What he can do instead, from what is really there (the reason itself often says how already).
export function guideFor(s, e) {
  const why = String(e.failed ?? '');
  const out = [];
  if (/is full|no room left on/i.test(why) && !/wall/i.test(why)) {
    const free = supportsInfo(s.decor ?? []).filter((b) => !b.full && !b.high && b.room > 0 && !/^piano$/.test(b.label)).map((b) => b.label).slice(0, 3);
    out.push(free.length ? `Places with room right now: ${free.join(', ')} (move_thing or decorate with on: its name).` : 'Nothing has room: I build a shelf or table first (decorate), or put something in my chest.');
  }
  if (/no room left on the walls/i.test(why)) out.push('I can take down the picture that hung longest (take_down_picture), or keep the drawing in my album for now and do something else.');
  if (/nothing called|no .* called|nothing with that name/i.test(why)) out.push(`My things are: ${(s.decor ?? []).filter((d) => !d.image).map((d) => d.name).slice(0, 8).join(', ')}.`);
  if (/seeds?/i.test(why)) out.push(`Seeds I have: ${(s.garden?.seeds ?? []).filter((x) => x.qty > 0).map((x) => x.name).join(', ') || 'none'} (or I ask Bas for some).`);
  if (/no .*(food|bread|eat)|food does not appear/i.test(why)) out.push(`In my pantry: ${(s.pantry ?? []).filter((x) => x.qty > 0).map((x) => x.name).join(', ') || 'nothing'}.`);
  return out.join(' ');
}

// After a wake-up: the first real failure (not a daily limit) gets an early second try, once.
export function planRetry(s, entries, now = Date.now()) {
  const bad = entries.find((e) => e.failed && !e.fallback && !WAITING.test(String(e.failed)));
  if (!bad) return null;
  const key = keyOf(bad);
  if (s.retried?.key === key && now - Date.parse(s.retried.at) < 2 * 3_600_000) return null; // this was the second try already
  const today = (s.retries ?? []).filter((t) => now - Date.parse(t) < DAY);
  if (today.length >= MAX_RETRIES_PER_DAY) return null;
  const at = Math.max(now + 30_000, Date.parse(bad.at) + RETRY_AFTER_S * 1000);
  s.wakeSoon = { at: new Date(at).toISOString(), key, action: bad.action, name: bad.name ?? bad.what ?? null, why: String(bad.failed).slice(0, 300), guide: guideFor(s, bad) };
  s.retries = [...today, new Date(now).toISOString()];
  return s.wakeSoon;
}

// At the start of a wake-up: is this the early second try? Then he is told why he is up again.
export function startRetry(s, now = Date.now()) {
  const w = s.wakeSoon;
  if (!w) { s.retryNow = null; return null; }
  delete s.wakeSoon;
  if (Date.parse(w.at) - now > 60_000) { s.wakeSoon = w; s.retryNow = null; return null; } // a normal wake-up came first: keep it for later (it will not be needed)
  s.retryNow = w;
  s.retried = { key: w.key, at: new Date(now).toISOString() };
  return w;
}
export function retryLines(s) {
  const w = s.retryNow;
  if (!w) return [];
  return [`I am up again right away, because ${w.action.replace(/_/g, ' ')}${w.name ? ` (${w.name})` : ''} did not work: ${w.why}. ${w.guide ? `${w.guide} ` : ''}I try it a different way now, or I do something else that matters to me. Not just a little filler.`];
}
