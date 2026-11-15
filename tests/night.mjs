// Phase 7: the sleep call. Patterns on 5+ days become a soul line; lines with no sign for 30 days are let go.
// Run: node tests/night.mjs   (works on a temporary copy of soul.md)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applySleep, patterns, withAddedLines, saveSoul, fakeSleep, sleepPrompt, daySummary, noteLift, LET_GO_DAYS } from '../night.js';
import { ensureBody, noteMove, noteMood } from '../body.js';
import { soulText } from '../soul.js';

const ok = async (name, fn) => { await fn(); console.log(`ok  ${name}`); };
const DAY = 86_400_000;
const t0 = Date.parse('2026-11-16T21:00:00Z');
const live = (s, i) => {
  s.today = null;
  ensureBody(s, t0 + i * DAY);
  for (let k = 0; k < 3; k++) noteMove(s, 'play_piano', { now: t0 + i * DAY });
  noteMove(s, 'search_web', { now: t0 + i * DAY });
  noteLift(s, ['play_piano'], 15, 16);
  noteLift(s, ['search_web'], 15, 14.5);
  noteMood(s, 'calm', t0 + i * DAY);
};

await ok('the day is summed up in code', () => {
  const s = { projects: [{ title: 'Bird house', status: 'working' }] };
  live(s, 0);
  const d = daySummary(s);
  assert.deepEqual(d.lifted, ['play_piano']);
  assert.deepEqual(d.lowered, ['search_web']);
  assert.equal(d.most[0], 'play_piano');
  assert.equal(d.mood, 'calm');
  assert.deepEqual(d.unfinished, ['Bird house']);
});

await ok('a pattern needs 5 days before it can become a line', () => {
  const s = { projects: [] };
  for (let i = 0; i < 4; i++) { live(s, i); applySleep(s, fakeSleep(patterns(s.days ?? [], s.soulLines))); }
  assert.equal((s.soulLines ?? []).length, 0);
  live(s, 4);
  const found = patterns([...s.days, daySummary(s)], s.soulLines);
  assert.ok(found.some((p) => p.key === 'lifted:play_piano' && p.days === 5));
  const { changes } = applySleep(s, fakeSleep(found), t0 + 4 * DAY);
  assert.equal(s.soulLines.length, 1);
  assert.equal(changes[0].change, 'added');
});

await ok('a made-up key is refused', () => {
  const s = { projects: [] };
  for (let i = 0; i < 5; i++) live(s, i);
  applySleep(s, { soul_line: { text: 'He loves volcanoes.', key: 'lifted:volcanoes' } });
  assert.equal((s.soulLines ?? []).length, 0);
});

await ok('a line with no sign for 30 days is let go', () => {
  const s = { projects: [], soulLines: [{ text: 'He loves the harp.', key: 'lifted:harp', addedAt: '2026-10-01T00:00:00Z', lastSeen: new Date(t0 - (LET_GO_DAYS + 1) * DAY).toISOString() }] };
  live(s, 0);
  const { changes } = applySleep(s, null, t0);
  assert.equal(s.soulLines.length, 0);
  assert.equal(changes[0].change, 'let go');
});

await ok('soul.md: only the "Added by him" part changes, and every change is logged', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pip-soul-'));
  const soulFile = path.join(dir, 'soul.md');
  const logFile = path.join(dir, 'archive', 'soul-changes.json');
  const md = fs.readFileSync(new URL('../soul.md', import.meta.url), 'utf8');
  fs.writeFileSync(soulFile, md);
  await saveSoul([{ text: 'He plays the piano when he is unsure.' }], [{ change: 'added', text: 'He plays the piano when he is unsure.' }], { soulFile, logFile });
  const next = fs.readFileSync(soulFile, 'utf8');
  assert.equal(next.split('## Added by him')[0], md.split('## Added by him')[0], 'the locked part is the same');
  assert.match(next, /## Added by him\n- He plays the piano when he is unsure\.\n/);
  assert.equal(JSON.parse(fs.readFileSync(logFile, 'utf8')).length, 1);
  assert.match(soulText(next), /He plays the piano when he is unsure/);
  assert.equal(withAddedLines(next, []).split('## Added by him')[1].trim(), '(nothing yet)');
});

await ok('the sleep prompt is small', () => {
  const s = { projects: [] };
  live(s, 0);
  const p = sleepPrompt({ soul: 'x'.repeat(2500), today: daySummary(s), found: [], added: [], story: 'y'.repeat(900) });
  assert.ok(p.length / 4 < 2000);
});
