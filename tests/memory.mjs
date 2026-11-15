// Phase 2: forgetting, recall boosts, interests without duplicates, and the cleanup script.
// Run: node tests/memory.mjs   (changes nothing in web/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureMemory, addMemory, fade, markUsed, recall, addInterest, archiveForgotten, FORGET_BELOW, MAX_MEMORIES, MAX_INTERESTS } from '../memory.js';
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
  assert.equal(fade(s, t0 + 5 * DAY).length, 0);
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
  for (let i = 0; i < MAX_MEMORIES + 5; i++) addMemory(s, `memory number ${i} about thing${i} and stuff${i} plus extra${i}`, (i % 9) + 1);
  assert.equal(s.memories.length, MAX_MEMORIES);
  assert.ok(s.memories.some((m) => m.pinned));
  assert.equal(s.forgotten.length, 6);
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
