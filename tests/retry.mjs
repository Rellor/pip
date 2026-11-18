// Something did not work: he wakes again soon, with a guide. A second failure of the same thing: no third try.
import assert from 'node:assert/strict';
import { planRetry, startRetry, retryLines, guideFor } from '../retry.js';

const now = Date.parse('2026-11-18T20:00:00Z');
const s = { decor: [], garden: { seeds: [{ name: 'mint', qty: 2 }] }, pantry: [] };
const fail = { at: new Date(now + 120_000).toISOString(), action: 'plant', failed: 'I have no rosemary seeds' };
const w = planRetry(s, [{ at: new Date(now).toISOString(), action: 'rest' }, fail], now);
assert.ok(w, 'a real failure: an early wake');
assert.equal(Date.parse(w.at), now + 120_000 + 70_000);
assert.match(w.guide, /Seeds I have: mint/);
console.log('ok  a failed step: he wakes again shortly after, with a guide');

assert.equal(startRetry(s, now + 60_000), null, 'too early: a normal wake keeps it');
const r = startRetry(s, Date.parse(w.at));
assert.equal(r.key, w.key);
assert.match(retryLines(s)[0], /up again right away, because plant did not work: I have no rosemary seeds\. Seeds I have: mint/);
assert.equal(s.wakeSoon, undefined);
console.log('ok  the second try tells him why he is up and what he can do');

assert.equal(planRetry(s, [{ ...fail, at: new Date(now + 300_000).toISOString() }], now + 300_000), null, 'the same failure on the second try: no third');
console.log('ok  the same thing failing again: no third try');

const t = { decor: [] };
assert.equal(planRetry(t, [{ at: new Date(now).toISOString(), action: 'draw', failed: 'I already used up my 5 a day: I cannot draw again today' }], now), null);
console.log('ok  a daily limit only waits for tomorrow: no early wake');

assert.match(guideFor({ decor: [] }, { failed: 'there is nothing called "bee" in my room' }), /My things are/);
console.log('ok  guides use what is really there');
