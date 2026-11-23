// His world: friendships and wishes (neighbours.js), coins and the corner shop (shop.js), and the storyteller (story.js).
import assert from 'node:assert/strict';
import { planNotes, deliverNotes, neighbourLines, noteAnswer, keepWishes, wishLines, openWishes, ledgerLines, neighbourPrompt, warmthWord } from '../neighbours.js';
import { buy, shopLine, shopOpen, shopList, CATALOGUE } from '../shop.js';
import { storyTick, moonPhase } from '../story.js';
import { availableMoves } from '../moves.js';
import { tickBody } from '../body.js';
import fs from 'node:fs';

const ok = (name) => console.log(`ok  ${name}`);
const noon = Date.parse('2026-11-23T11:00:00Z'); // Monday 12:00 in Amsterdam
const fresh = () => ({ log: [], visitors: [], tools: [], pantry: [], garden: { seeds: [], plots: [] }, decor: [], art: [], projects: [], memories: [], curious: { sparks: [], interests: [] } });

// ---- wishes
const s = fresh();
planNotes(s, { notes: [{ from: 'Dot', kind: 'ask', text: 'Can you draw me a cat with a big tail?', topic: 'a cat drawing' }, { from: 'Mo', kind: 'hello', text: 'Morning!', topic: 'hello' }] }, noon);
deliverNotes(s, noon + 10 * 3_600_000);
const later = noon + 10 * 3_600_000;
assert.equal(openWishes(s, later).length, 0, 'an ask in a note is only a note now: what people want made hangs on the notice board (tests/board.mjs)');
// (a wish of a neighbour can still exist, like Kees's puzzle of the week: the rest of this test is about those)
s.wishes = [{ id: s.visitors.find((v) => /Dot/.test(v.name)).id, from: 'Dot', text: 'Can you draw me a cat with a big tail?', topic: 'a cat drawing', at: new Date(later).toISOString(), reward: 2, status: 'open', said: false }];
assert.equal(openWishes(s, later).length, 1);
assert.match(neighbourLines(s).find((l) => /Dot/.test(l)), /would give me 2 coins/);
const note = s.visitors.find((v) => /Dot/.test(v.name));
note.answer = 'Yes, Dot! A cat with the biggest tail.';
noteAnswer(s, note);
assert.equal(s.wishes[0].said, true);
assert.match(wishLines(s, later)[0], /I told Dot I would make a cat drawing: with draw, 2 coins/);
ok('a wish stays open, with a reward; saying yes makes it a promise');

assert.deepEqual(keepWishes(s, [{ action: 'decorate', name: 'wooden cat' }], later), [], 'a wooden cat is not the drawing she asked for');
const kept = keepWishes(s, [{ action: 'draw', name: 'the cat with the big tail', why: 'for Dot' }], later);
assert.match(kept[0], /I made what Dot wished for .* gave me 2 coins/);
assert.equal(s.coins, 2);
assert.equal(openWishes(s, later).length, 0);
assert.ok(s.street.people.Dot.warmth >= 2);
assert.match(ledgerLines(s, later).find((l) => /^Dot/.test(l)), /delighted and thanks him today/);
assert.match(neighbourPrompt(s, later), /WHAT HAS HAPPENED BETWEEN THEM[\s\S]*Dot: friendly of Pip/);
ok('making it earns coins, warms the friendship, and tomorrow\'s notes know');

const fan = keepWishes(s, [{ action: 'draw', name: 'old steam locomotive' }], later);
assert.match(fan[0], /Mo saw my drawing .* bought a little print of it: 1 coin/);
assert.deepEqual(keepWishes(s, [{ action: 'draw', name: 'another train' }], later), [], 'one print a day per neighbour');
assert.equal(s.coins, 3);
ok('a neighbour who loves the subject buys a print: drawing different things pays');

s.wishes.push({ id: 'old', from: 'Lina', text: 'a song', topic: 'a song', at: new Date(later - 8 * 86_400_000).toISOString(), reward: 3, status: 'open' });
assert.equal(openWishes(s, later).length, 0, 'an old wish fades quietly');
assert.equal(warmthWord(6), 'a friend');
ok('nobody is angry: a wish he does not take just fades');

// ---- the shop
assert.ok(shopOpen(noon) && shopOpen(noon + 9 * 3_600_000), 'the corner shop is always open');
assert.match(buy(s, 'toolbox', noon).failed, /costs 8 coins and I have 3/);
const b = buy(s, 'clay', noon);
assert.deepEqual([b.bought, b.price, b.left], ['clay', 3, 0]);
assert.ok(s.tools.some((t) => /clay/.test(t.name)));
assert.match(buy(s, 'a flying carpet', noon).failed, /does not have/);
s.coins = 20;
assert.ok(buy(s, 'tomato seeds', noon).bought && s.garden.seeds.some((x) => /tomato/.test(x.name)));
assert.ok(buy(s, 'kalimba', noon).bought && s.tools.some((t) => /kalimba/.test(`${t.name} ${t.kind}`)), 'after saving up: an instrument of his own');
assert.ok(!shopList(s).some((c) => c.item === 'kalimba'), 'what he owns is not offered again');
assert.ok(shopLine(s).length < 120 && CATALOGUE.length > 20);
ok('the corner shop: opening hours, prices, and real things in his bag');

const live = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
delete live.body; delete live.recent; delete live.today; delete live.tired; delete live.resting;
tickBody(live);
live.coins = 5;
const line = availableMoves(live, { now: noon, random: () => 0.99 }).find((m) => m.name === 'buy')?.line ?? '';
assert.ok(line === '' || (/I have 5/.test(line) && line.length < 240), line);
ok('the buy move is short and says what he has');

// ---- the storyteller
const t = fresh();
t.weather = { kind: 'clear', temp: 8 };
const first = storyTick(t, noon);
assert.equal(first.length, 1, 'something small to notice on a quiet day');
assert.ok(!first[0].big && t.curious.sparks.length === 1 && t.curious.sparks[0].shown === 2);
assert.deepEqual(storyTick(t, noon + 3_600_000), [], 'not again within hours');
const second = storyTick(t, noon + 6 * 3_600_000);
assert.equal(second.length, 1);
assert.notEqual(second[0].key, first[0].key, 'not the same scene twice');
assert.deepEqual(storyTick(t, noon + 12 * 3_600_000 - 60_000 * 61), [], 'at most two small things a day');
ok('small things happen with a rhythm: hours apart, two a day at most, never the same');

const m = fresh();
m.art = [{ name: 'a', createdAt: new Date(noon).toISOString() }, { name: 'b', createdAt: new Date(noon).toISOString() }, { name: 'c', createdAt: new Date(noon).toISOString() }];
const saturday = Date.parse('2026-11-28T11:00:00Z');
const market = storyTick(m, saturday);
assert.equal(market[0].key, 'market');
assert.equal(m.coins, 2);
assert.equal(storyTick(m, saturday + 3 * 3_600_000).filter((e) => e.big).length, 0, 'after something big comes rest');
const k = fresh();
const wednesday = Date.parse('2026-11-25T11:00:00Z');
const puzzle = storyTick(k, wednesday);
assert.equal(puzzle[0].key, 'puzzle');
assert.equal(openWishes(k, wednesday)[0].reward, 5);
assert.match(wishLines(k, wednesday)[0], /Kees wished for .* 5 coins/);
const g = fresh();
g.street = { people: { 'Oma Jo': { warmth: 4 } } };
const parcel = storyTick(g, noon);
assert.equal(parcel[0].key, 'parcel');
assert.ok(g.garden.seeds.some((x) => /tomato/.test(x.name)), 'the parcel is real');
ok('big things: market day, the weekly puzzle, a parcel from a friend, with rest in between');

assert.ok(Math.abs(moonPhase(Date.UTC(2000, 0, 21, 4, 40)) - 0.5) < 0.02, 'the full moon of 21 January 2000');
const moon = fresh();
moon.teller = { seen: {}, lastAt: new Date(0).toISOString() };
let fullAt = Date.parse('2026-11-01T19:00:00Z');
while (Math.abs(moonPhase(fullAt) - 0.5) > 0.01) fullAt += 3_600_000 * 24;
assert.match(storyTick(moon, fullAt)[0].text, /moon is full|shooting stars|fall/);
ok('the sky is the real sky: the moon and the meteor showers');
