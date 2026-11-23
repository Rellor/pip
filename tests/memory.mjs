// Phase 2: forgetting, recall boosts, interests without duplicates, and the cleanup script.
// Run: node tests/memory.mjs   (changes nothing in web/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureMemory, addMemory, fade, markUsed, recall, addInterest, archiveForgotten, consolidate, touch, tierOf, weakest, FORGET_BELOW, MAX_MEMORIES, MAX_INTERESTS, SHORT_SLOTS, LONG_SLOTS } from '../memory.js';
import { clean } from '../scripts/clean-memory.mjs';

const DAY = 86_400_000;
const t0 = Date.parse('2026-11-15T12:00:00Z');
let n = 0;
const ok = (name, fn) => Promise.resolve(fn()).then(() => { n++; console.log(`ok  ${name}`); });

await ok('old memories get weight and lastUsed', () => {
  const s = { memories: [{ id: 'a', at: '2026-11-10T00:00:00Z', text: 'hello', importance: 6 }] };
  ensureMemory(s);
  assert.equal(s.memories[0].weight, 6);
  assert.equal(s.memories[0].lastUsed, '2026-11-10T00:00:00Z');
});

await ok('memories fade with time and are forgotten below the line', () => {
  const s = { memories: [], memoryFadeAt: new Date(t0).toISOString() };
  addMemory(s, 'a small thing I saw once', 3, 'memory', new Date(t0).toISOString());
  addMemory(s, 'the day Bas brought my picture in a frame', 9, 'memory', new Date(t0).toISOString());
  s.memories.push({ id: 'p', at: new Date(t0).toISOString(), text: 'pinned core memory', importance: 10, weight: 10, pinned: true });
  assert.equal(fade(s, t0 + 1 * DAY).length, 0);
  const gone = fade(s, t0 + 20 * DAY);
  assert.deepEqual(gone.map((m) => m.text), ['a small thing I saw once']);
  assert.ok(s.memories.find((m) => m.text.includes('Bas')).weight < 9);
  assert.equal(s.memories.find((m) => m.pinned).weight, 10);
  assert.equal(s.forgotten.length, 1);
  assert.ok(gone[0].weight < FORGET_BELOW);
});

await ok('recalled memories gain weight, at most once per 6 hours', () => {
  const s = { memories: [] };
  addMemory(s, 'stars ring like bells', 5, 'memory', new Date(t0 - DAY).toISOString());
  markUsed(recall(s, 'stars bells', 8, t0), t0);
  assert.equal(s.memories[0].weight, 5.5);
  markUsed(s.memories, t0 + 3_600_000);
  assert.equal(s.memories[0].weight, 5.5);
  markUsed(s.memories, t0 + 7 * 3_600_000);
  assert.equal(s.memories[0].weight, 6);
});

await ok('a full memory list drops the lightest, never pinned ones', () => {
  const s = { memories: [{ id: 'p', at: '2026-01-01T00:00:00Z', text: 'pinned', importance: 1, weight: 1, pinned: true }] };
  ensureMemory(s);
  for (let i = 0; i < MAX_MEMORIES + 5; i++) addMemory(s, `memory number ${i} about thing${i} and stuff${i} plus extra${i}`, (i % 8) + 1);
  assert.equal(tierOf(s, 'short').length, SHORT_SLOTS, 'short term has a fixed number of places');
  assert.ok(s.memories.some((m) => m.pinned) && s.memories.length <= MAX_MEMORIES);
  assert.equal(s.forgotten.length, MAX_MEMORIES + 5 - SHORT_SLOTS);
  assert.ok(Math.min(...tierOf(s, 'short').map((m) => m.weight)) >= 5, 'the heavy ones won the places');
  assert.equal(addMemory(s, 'a very small thing that happened just now somewhere', 1), null, 'a new memory must beat the lightest one, or it does not stick');
  assert.ok(addMemory(s, 'the day everything changed for me and my world', 9).tier === 'long', 'something that big is long term at once');
});

await ok('three tiers: short fades fast, the night keeps what matters, long fades to one worn sentence', () => {
  const s = { memories: [], memoryFadeAt: new Date(t0).toISOString() };
  const small = addMemory(s, 'I watched a sparrow take a bath in a puddle. It was very serious about it.', 4, 'memory', new Date(t0).toISOString());
  const big = addMemory(s, 'I built a lighthouse on my land and climbed to the top of it. It took me a whole day.', 7, 'memory', new Date(t0).toISOString());
  assert.deepEqual([small.tier, big.tier], ['short', 'short']);
  const night = consolidate(s, t0 + 12 * 3_600_000);
  assert.deepEqual(night.kept.map((m) => m.id), [big.id], 'what matters is kept for long while he sleeps');
  assert.equal(big.tier, 'long');
  assert.deepEqual(fade(s, t0 + 6 * DAY).map((m) => m.id), [small.id], 'a short memory nobody kept is gone in days');
  assert.ok(s.memories.includes(big) && !(s.faded ?? []).length, 'a short memory leaves nothing behind');
  const gone = fade(s, t0 + 60 * DAY);
  assert.deepEqual(gone.map((m) => m.id), [big.id]);
  assert.equal(s.faded.length, 1);
  assert.equal(s.faded[0].text, 'I built a lighthouse on my land and climbed to the top of it.', 'one worn sentence is left');
  assert.deepEqual(touch(s, 'the pond and the ducks', t0 + 61 * DAY), [], 'it does not come up by itself');
  assert.match(touch(s, 'a lighthouse on my land', t0 + 61 * DAY)[0], /comes back to me, faintly.*lighthouse/);
  assert.deepEqual(touch(s, 'a lighthouse on my land', t0 + 61 * DAY + 3_600_000), [], 'not again the same day');
  assert.match(touch(s, 'my land and a lighthouse', t0 + 63 * DAY)[0], /almost lost is back/);
  assert.ok(!s.faded.length && s.memories.some((m) => m.back && m.tier === 'short'), 'touched twice, it is a memory again');
});

await ok('long term is full: a new one only gets in when it beats the lightest', () => {
  const s = { memories: [] };
  ensureMemory(s);
  for (let i = 0; i < LONG_SLOTS - 1; i++) s.memories.push({ id: `l${i}`, at: new Date(t0 - 30 * DAY).toISOString(), text: `long memory ${i} about subject${i}`, importance: 8, weight: 6 + (i % 3), kind: 'memory', tier: 'long' });
  s.memories.push({ id: 's1', at: new Date(t0).toISOString(), text: 'a light new thing', importance: 5, weight: 5.6, kind: 'memory', tier: 'short' }, { id: 's2', at: new Date(t0).toISOString(), text: 'a heavy new thing', importance: 8, weight: 8, kind: 'memory', tier: 'short' }, { id: 'pv', at: new Date(t0 - 40 * DAY).toISOString(), text: 'a private thing', importance: 8, weight: 1, kind: 'memory', tier: 'long', private: true });
  const first = weakest(s, 'long');
  const night = consolidate(s, t0);
  assert.deepEqual(night.kept.map((m) => m.id), ['s2']);
  assert.deepEqual(night.faded.map((m) => m.id), ['pv'], 'the lightest long memory made room');
  assert.equal(first.id, 'pv');
  assert.equal((s.faded ?? []).length, 0, 'of a private memory no sentence is left in the open');
  assert.equal(s.memories.find((m) => m.id === 's1').tier, 'short', 'the light one beat nothing: it stays short');
  assert.equal(tierOf(s, 'long').length, LONG_SLOTS);
});

await ok('forgotten memories are written to the archive file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-'));
  const file = path.join(dir, 'memories.json');
  const s = { forgotten: [{ id: 'x', text: 'gone' }] };
  assert.equal(await archiveForgotten(s, file), 1);
  assert.equal(await archiveForgotten({ forgotten: [{ id: 'x', text: 'gone' }] }, file), 1);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 1);
  assert.deepEqual(s.forgotten, []);
});

await ok('interests merge near-duplicates and stay at most 15', () => {
  const s = { interests: ['Bortle class 1 dark sky'] };
  addInterest(s, 'Bortle class 1 dark sky locations');
  addInterest(s, 'dark sky Bortle 1 class');
  assert.equal(s.interests.length, 1);
  for (let i = 0; i < 30; i++) addInterest(s, `topic${i} thing${i}`);
  assert.equal(s.interests.length, MAX_INTERESTS);
});

await ok('cleanup on the real state: lists shrink, runs twice the same', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-'));
  const state = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
  await clean(state, { archiveDir: dir });
  assert.ok(state.interests.length <= 15);
  assert.ok(state.memories.length <= 30);
  for (const k of ['thoughts', 'ideas', 'log']) assert.ok(state[k].length <= 30, k);
  assert.ok(state.memories.every((m) => Number.isFinite(m.weight) && m.lastUsed));
  assert.equal(state.memories.filter((m) => m.pinned).length, 7);
  const again = structuredClone(state);
  await clean(again, { archiveDir: dir });
  assert.deepEqual(again.memories.map((m) => m.id), state.memories.map((m) => m.id));
  assert.deepEqual(again.interests, state.interests);
});

console.log(`\n${n} passed`);
