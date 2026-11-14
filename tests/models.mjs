// Phase 8: model groups, daily counts, 429 handling. No real calls.
// Run: node tests/models.mjs
import assert from 'node:assert/strict';
import { groups, ensureQuota, candidates, count, markOut, read429, pacificDay, BIG_DAILY_CAP } from '../models.js';

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
