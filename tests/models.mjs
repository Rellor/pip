// Phase 8: model groups, daily counts, 429 handling. No real calls.
// Run: node tests/models.mjs
import assert from 'node:assert/strict';
import { groups, ensureQuota, candidates, count, countBusy, markOut, read429, pacificDay, BIG_DAILY_CAP, bigPace, headRests, retryBusy, PACE_START, PACE_HOURS, PACE_MIN_TOTAL } from '../models.js';

const ok = (name, fn) => { fn(); console.log(`ok  ${name}`); };
const env = { GEMINI_BIG: 'big-a,big-b', GEMINI_LITE: 'lite-a,lite-b' };

ok('groups come from env vars, with the planned defaults', () => {
  assert.deepEqual(groups(env), { big: ['big-a', 'big-b'], lite: ['lite-a', 'lite-b'] });
  assert.equal(groups({}).big[0], 'gemini-3.8-flash');
  assert.equal(groups({}).lite.at(-1), 'gemini-3.1-flash-lite');
});

ok('counts reset at midnight Pacific time', () => {
  const s = {};
  const t = Date.parse('2026-11-15T07:59:00Z'); // 23:59 in Los Angeles
  ensureQuota(s, t);
  count(s.quota, 'lite-a');
  assert.equal(pacificDay(t), '2026-11-14');
  ensureQuota(s, t + 60_000);
  assert.equal(s.quota.day, '2026-11-15');
  assert.deepEqual(s.quota.calls, {});
  assert.deepEqual(s.quota.history.at(-1), { day: '2026-11-14', calls: { 'lite-a': 1 } });
});

ok('lite calls use lite models; big calls fall back to lite', () => {
  const q = ensureQuota({});
  assert.deepEqual(candidates(q, 'lite', { env }).order, ['lite-a', 'lite-b']);
  assert.deepEqual(candidates(q, 'big', { env }).order, ['big-a', 'big-b', 'lite-a', 'lite-b']);
  markOut(q, 'big-a');
  markOut(q, 'big-b');
  assert.deepEqual(candidates(q, 'big', { env }).order, ['lite-a', 'lite-b']);
  markOut(q, 'lite-a');
  markOut(q, 'lite-b');
  assert.deepEqual(candidates(q, 'big', { env }).order, [], 'all out: autopilot');
});

ok(`big calls stop at ${BIG_DAILY_CAP} per model, except replies to Bas`, () => {
  const q = ensureQuota({});
  for (let i = 0; i < BIG_DAILY_CAP; i++) count(q, 'big-a');
  assert.equal(candidates(q, 'big', { env }).order[0], 'big-b');
  assert.equal(candidates(q, 'big', { env, reply: true }).order[0], 'big-a');
});

ok('a 429 says per day or per minute, the wait, and limit 0', () => {
  const perDay = { error: { code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '250' }] }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '31s' }] } };
  const d = read429(JSON.stringify(perDay));
  assert.equal(d.perDay, true);
  assert.equal(d.quotaId, 'GenerateRequestsPerDayPerProjectPerModel-FreeTier');
  const perMin = structuredClone(perDay);
  perMin.error.details[0].violations[0].quotaId = 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier';
  const m = read429(perMin);
  assert.equal(m.perMinute, true);
  assert.equal(m.retryMs, 31_000);
  const none = structuredClone(perMin);
  none.error.details[0].violations[0].quotaValue = '0';
  assert.equal(read429(none).notFree, true);
  assert.equal(read429(none).perDay, true, 'limit 0 is treated as out for the day');
  assert.equal(read429('not json').perDay, false);
});

ok('a busy bounce is not a call', () => {
  const q = ensureQuota({});
  for (let i = 0; i < 40; i++) countBusy(q, 'big-a');
  assert.equal(q.calls['big-a'] ?? 0, 0);
  assert.equal(q.busy['big-a'], 40);
  assert.equal(candidates(q, 'big', { env }).order[0], 'big-a', 'forty bounces do not use up the model');
});

ok('the smart calls are spread over his day', () => {
  const start = Date.parse('2026-11-26T08:00:00Z'); // midnight Pacific: his quota day starts (09:00 in the Netherlands)
  const H = 3_600_000;
  const total = 2 * BIG_DAILY_CAP; // two smart models in this test
  const q = ensureQuota({}, start);
  const first = bigPace(q, start, env);
  assert.deepEqual([first.used, first.total, first.allowed, first.ok, first.out], [0, total, Math.ceil(total * PACE_START), true, false]);
  for (let i = 0; i < first.allowed; i++) count(q, 'big-a'); // he uses the whole first share at once
  const ahead = bigPace(q, start + 10 * 60_000, env);
  assert.ok(!ahead.ok && !ahead.out && ahead.backAt > start && ahead.backAt < start + PACE_HOURS * H, JSON.stringify(ahead));
  assert.equal(bigPace(q, ahead.backAt + 60_000, env).ok, true, 'at that time he may design again');
  assert.equal(bigPace(q, start + PACE_HOURS * H, env).allowed, total, 'after twelve hours everything is free');
  // lots of bounces change nothing
  for (let i = 0; i < 30; i++) countBusy(q, 'big-b');
  assert.equal(bigPace(q, start + 10 * 60_000, env).used, first.allowed);
  // everything used: out until the next quota day
  for (let i = first.allowed; i < BIG_DAILY_CAP; i++) count(q, 'big-a');
  for (let i = 0; i < BIG_DAILY_CAP; i++) count(q, 'big-b');
  const gone = bigPace(q, start + 13 * H, env);
  assert.ok(!gone.ok && gone.out && Math.abs(gone.backAt - (start + 24 * H)) < 60_000, JSON.stringify(gone));
  // a model Google shut early has nothing left to give: the day's total shrinks with it
  const r = ensureQuota({}, start);
  for (let i = 0; i < 4; i++) count(r, 'big-a');
  markOut(r, 'big-a');
  assert.equal(bigPace(r, start + 6 * H, env).total, 4 + BIG_DAILY_CAP);
  // hardly any smart calls in a whole day: nothing to spread, the small models design as before
  const t = ensureQuota({}, start);
  markOut(t, 'big-a'); markOut(t, 'big-b');
  const none = bigPace(t, start + H, env);
  assert.ok(none.small && none.ok && none.total < PACE_MIN_TOTAL);
  assert.equal(bigPace(undefined, start + H, env).ok, true, 'a state without counts yet');
});

ok('his head rests only when real models are asked, and a busy smart model is not asked twice', () => {
  const start = Date.parse('2026-11-26T08:00:00Z');
  const q = ensureQuota({}, start);
  for (let i = 0; i < BIG_DAILY_CAP; i++) count(q, 'big-a');
  const real = { ...env, GEMINI_API_KEY: 'x' };
  assert.equal(headRests(q, start + 60_000, real), true);
  assert.equal(headRests(q, start + 60_000, env), false, 'no key: nothing to be careful with (tests)');
  assert.equal(headRests(q, start + 60_000, { ...real, PIP_FAKE: '1' }), false, 'the pretend brain');
  assert.equal(headRests(ensureQuota({}, start), start + 60_000, real), false, 'nothing used yet');
  const order = ['big-a', 'big-b', 'lite-a', 'lite-b'];
  assert.equal(retryBusy('big-a', order, env), false);
  assert.equal(retryBusy('lite-a', order, env), true, 'the small models are asked again');
  assert.equal(retryBusy('lite-b', order, env), true);
  assert.equal(retryBusy('big-b', ['big-a', 'big-b'], env), true, 'the last one in line may try again');
});
