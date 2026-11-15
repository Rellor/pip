// The check-up spots circling, stuck projects, failing moves and pretending, and sends each problem once a day.
// Run: node tests/checkup.mjs
import assert from 'node:assert/strict';
import { checkup } from '../checkup.js';

const now = Date.parse('2026-11-15T21:00:00Z');
const ago = (h) => new Date(now - h * 3_600_000).toISOString();
const bad = {
  thoughts: Array.from({ length: 20 }, (_, i) => ({ at: ago(i / 4), text: i % 3 ? 'I want to smooth the gears of my music box.' : 'The sky looks pale.' })),
  projects: [{ title: 'Music box', status: 'working', since: ago(10), steps: [], versions: [] }],
  today: { tried: { record_song: 9, do: 30, decorate: 5 }, done: { record_song: 2, do: 30, decorate: 5 } },
  log: [{ action: 'record_song', failed: 'the song had no part with at least 2 sounding notes (for example voice "C4")' }],
  fullness: 5, pantry: [{ name: 'apples', qty: 2 }], asks: [], errors: [],
};
const r = checkup(bad, {}, now);
const off = r.items.filter((x) => !x.ok).map((x) => x.id);
assert.deepEqual(off, ['circling', 'project', 'failing', 'pretend']);
assert.match(r.items.find((x) => x.id === 'circling').text, /gears/);
assert.doesNotMatch(r.items.find((x) => x.id === 'failing').text, /[{[]/, 'no code in the message');
assert.equal(r.fresh.length, 4);
assert.equal(checkup(bad, { checkup: r.saved }, now + 600_000).fresh.length, 0, 'the same problems are not sent twice a day');

const fine = { thoughts: [], projects: [], today: { tried: { decorate: 3 }, done: { decorate: 3 } }, fullness: 6, pantry: [], asks: [], errors: [] };
assert.ok(checkup(fine, {}, now).items.every((x) => x.ok));
console.log('ok  check-up finds circling, a stuck project, a failing move and pretending; each sent once a day');
const sealed = { ...fine, thoughts: Array.from({ length: 20 }, (_, i) => ({ at: ago(i / 4), text: '🔒 private', sealed: 'x' })) };
assert.ok(checkup(sealed, {}, now).items.find((x) => x.id === 'circling').ok, 'private thoughts are not read');
console.log('ok  private thoughts stay out of the check-up');
