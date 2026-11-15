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
