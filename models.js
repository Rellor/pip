// Which Gemini model answers, and how many calls each one made today.
// Two groups (env vars, comma-separated):
//   GEMINI_BIG   for the daily goal, the sleep call, the makers, photo checks and replies to Bas
//   GEMINI_LITE  for normal brain calls
// If all BIG models are out, BIG calls fall back to LITE. If all are out, Pip runs on autopilot until the reset.
// Quotas reset at midnight Pacific time. A per-day 429 marks a model "out" until then; a per-minute 429 waits and retries once.
// Counts live in state.quota (the watchdog copies them into web/health.json).
export const DEFAULT_BIG = 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash';
export const DEFAULT_LITE = 'gemini-3.5-flash-lite,gemini-3.1-flash-lite';
export const BIG_DAILY_CAP = 15; // BIG calls per model per day, so there is room left for replies to Bas
export const MAX_RETRY_WAIT_MS = 60_000;

const list = (v, d) => String(v || d).split(',').map((x) => x.trim()).filter(Boolean);
export const groups = (env = process.env) => ({ big: list(env.GEMINI_BIG, DEFAULT_BIG), lite: list(env.GEMINI_LITE, DEFAULT_LITE) });
export const pacificDay = (now = Date.now()) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

export function ensureQuota(s, now = Date.now()) {
  const day = pacificDay(now);
  if (!s.quota || s.quota.day !== day) s.quota = { day, calls: {}, out: {}, history: [...(s.quota?.history ?? []), ...(s.quota?.day ? [{ day: s.quota.day, calls: s.quota.calls }] : [])].slice(-14) };
  s.quota.calls ??= {};
  s.quota.out ??= {};
  return s.quota;
}

// The models to try, in order, for a call. `reply`: an answer to Bas may go past the BIG daily cap.
export function candidates(q, group = 'lite', { reply = false, env = process.env } = {}) {
  const g = groups(env);
  const order = [];
  const skipped = [];
  const tryList = group === 'big' ? [...g.big.map((m) => [m, 'big']), ...g.lite.map((m) => [m, 'lite'])] : g.lite.map((m) => [m, 'lite']);
  for (const [m, from] of tryList) {
    if (order.includes(m)) continue;
    if (q.out[m]) { skipped.push({ model: m, why: 'out of quota until midnight Pacific' }); continue; }
    if (from === 'big' && !reply && (q.calls[m] ?? 0) >= BIG_DAILY_CAP) { skipped.push({ model: m, why: `already ${BIG_DAILY_CAP} calls today (kept for replies to Bas)` }); continue; }
    order.push(m);
  }
  return { order, skipped, first: tryList[0]?.[0] ?? null };
}

export const count = (q, model) => { q.calls[model] = (q.calls[model] ?? 0) + 1; };
// A request the model bounced because it was busy (503). It was not answered, so it does not count as a call: it used
// to, and three bounces in a row ate three of the day's fifteen. Kept apart, to see how busy a model was.
export const countBusy = (q, model) => { q.busy ??= {}; q.busy[model] = (q.busy[model] ?? 0) + 1; };

// ---- Spreading the smart calls over his day. Without this he used them all up in the morning and had none left by
// the afternoon. Now they come free bit by bit: a quarter is there when the quota day starts (about 09:00 in the
// Netherlands), the rest over the next twelve hours. While he is ahead of that, he designs nothing new and does
// things that need no smart model (outside, music, his garden, reading); a little later he can make things again.
// A model that Google has shut for the day has nothing left to give, so the day's total shrinks with it.
export const PACE_START = 0.25; // this share is free at once
export const PACE_HOURS = 12; // and the rest comes free over this many hours
export const PACE_MIN_TOTAL = 6; // with fewer smart calls than this in a whole day there is nothing to spread: the small models design, as before
const pacificHours = (now) => { const d = new Date(new Date(now).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })); return d.getHours() + d.getMinutes() / 60; };
// How he stands: { used, total, allowed, ok (he may design now), out (nothing left today), small (too little to spread), backAt (ms, when he may again) }.
export function bigPace(q, now = Date.now(), env = process.env) {
  const big = groups(env).big;
  const calls = (m) => q?.calls?.[m] ?? 0;
  const used = big.reduce((a, m) => a + calls(m), 0);
  const total = big.reduce((a, m) => a + (q?.out?.[m] ? Math.min(calls(m), BIG_DAILY_CAP) : BIG_DAILY_CAP), 0);
  if (total < PACE_MIN_TOTAL) return { used, total, allowed: total, ok: true, out: false, small: true, backAt: null };
  const hours = pacificHours(now);
  const allowed = Math.ceil(total * Math.min(1, PACE_START + (1 - PACE_START) * (hours / PACE_HOURS)));
  const out = used >= total;
  const ok = !out && used < allowed;
  const needHours = ((Math.floor(used) + 1) / total - PACE_START) / (1 - PACE_START) * PACE_HOURS; // when the share has grown enough for one more
  const backAt = ok ? null : out ? now + (24 - hours) * 3_600_000 : now + Math.max(0.05, needHours - hours) * 3_600_000;
  return { used, total, allowed, ok, out, small: false, backAt };
}
export const markOut = (q, model) => { q.out[model] = q.day; };

// What a 429 says: per day or per minute, how long to wait, and the exact quota (limit 0 = not in the free tier).
export function read429(body) {
  let j = body;
  if (typeof body === 'string') { try { j = JSON.parse(body); } catch { j = {}; } }
  const details = j?.error?.details ?? [];
  const violations = details.flatMap((d) => d.violations ?? []);
  const ids = violations.map((v) => `${v.quotaId ?? ''} ${v.quotaMetric ?? ''}`).join(' ');
  const limit = violations.map((v) => v.quotaValue).find((v) => v !== undefined);
  const delay = details.find((d) => String(d['@type'] ?? '').includes('RetryInfo'))?.retryDelay;
  const retryMs = delay ? Math.round(parseFloat(delay) * 1000) : null;
  const perDay = /PerDay|per_day|daily/i.test(ids) || String(limit) === '0';
  const perMinute = !perDay && (/PerMinute|per_minute/i.test(ids) || retryMs !== null);
  return { perDay, perMinute, retryMs, quotaId: violations[0]?.quotaId ?? null, limit: limit ?? null, notFree: String(limit) === '0' };
}

// Is his head for designing resting right now? Only when real models are asked (a key is set, and it is not a test
// with the pretend brain): then, and only then, the day's smart calls are something to be careful with.
export const headRests = (q, now = Date.now(), env = process.env) => Boolean(env.GEMINI_API_KEY) && !env.PIP_FAKE && !bigPace(q, now, env).ok;
// A smart model that answers "busy" is not asked again when another model can take the work: in two days of logs a
// busy model was still busy on the second and third try every single time, and each try is a request Google may count.
export const retryBusy = (model, order, env = process.env) => !(groups(env).big.includes(model) && order.at(-1) !== model);
