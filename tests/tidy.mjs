// Phase 3: the big tidy. Limits hold, nothing is lost, things on a kept thing are safe.
// Run: node tests/tidy.mjs   (changes nothing in web/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tidyItems, settleChoices, applyTidy, fakeTidy, tidyPrompt, KEEP_MAX, STORE_MAX } from '../tidy.js';
import { soulText } from '../soul.js';

const real = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
const s = structuredClone(real);
const archivedBefore = (s.archive ?? []).length;
const items = tidyItems(s, s.log);
const total = items.length;
const count = (st) => (st.decor?.length ?? 0) + (st.stored?.length ?? 0) + (st.tools?.length ?? 0) + (st.art?.length ?? 0) + (st.pictures?.length ?? 0) + (st.studio?.songs?.length ?? 0) + (st.apps?.length ?? 0) + (st.wardrobe?.length ?? 0);
assert.equal(total, count(s), 'every thing he has is in the list');
assert.ok(new Set(items.map((i) => i.id)).size === total, 'ids are unique');

const prompt = tidyPrompt(soulText(fs.readFileSync(new URL('../soul.md', import.meta.url), 'utf8')), items);
assert.ok(!prompt.includes('[locked]'));
assert.ok(prompt.length < 24_000, `prompt is ${prompt.length} chars`);

// A greedy answer: keep everything. The limits must still hold.
const greedy = settleChoices(items, { choices: items.map((i) => ({ id: i.id, choice: 'keep', reason: 'mine' })) });
const counted = (c) => c.group !== 'tool' && !c.needed;
assert.ok(greedy.filter((c) => c.choice === 'keep' && counted(c)).length <= KEEP_MAX);
assert.ok(greedy.filter((c) => c.choice === 'store' && counted(c)).length <= STORE_MAX);

// An empty answer: nothing is let go by accident.
assert.ok(settleChoices(items, {}).every((c) => c.choice !== 'let go' || !counted(c) || c.note));

// Apply the fake answer: nothing disappears, it is all still somewhere.
const choices = settleChoices(items, fakeTidy(items));
applyTidy(s, choices);
assert.equal(count(s) + s.archive.length - archivedBefore, total, 'what left the room is in state.archive');
for (const d of s.decor) if (d.base && !/^(desk|piano|bookshelf|bed)/.test(d.base)) assert.ok(s.decor.some((x) => x.id === String(d.base).split('#')[0]), `${d.name} still stands on something`);
console.log(`ok  tidy: ${total} things, kept ${choices.filter((c) => c.choice === 'keep').length}, stored ${choices.filter((c) => c.choice === 'store').length}, let go ${choices.filter((c) => c.choice === 'let go').length}`);
