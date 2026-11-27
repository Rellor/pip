// His world: wishes and what they pay (neighbours.js), coins and the grocery store (shop.js), and the storyteller (story.js).
import assert from 'node:assert/strict';
import { noteLines, noteAnswer, keepWishes, wishLines, openWishes } from '../neighbours.js';
import { buy, shopLine, shopOpen, shopList, CATALOGUE } from '../shop.js';
import { storyTick, moonPhase } from '../story.js';
import { availableMoves } from '../moves.js';
import { tickBody } from '../body.js';
import fs from 'node:fs';

const ok = (name) => console.log(`ok  ${name}`);
const noon = Date.parse('2026-11-23T11:00:00Z'); // Monday 12:00 in Amsterdam
const fresh = () => ({ log: [], visitors: [], tools: [], pantry: [], garden: { seeds: [], plots: [] }, decor: [], art: [], projects: [], memories: [], curious: { sparks: [], interests: [] } });

// ---- wishes (today only the notice board pins them, tests/board.mjs; a wish that came with a note still works the same way)
const FIVE = /\b(Mo|Lina|Oma Jo|Dot|Kees)\b/;
const s = fresh();
const later = noon + 10 * 3_600_000;
s.visitors = [{ id: 'a1', at: new Date(later).toISOString(), name: 'Wren (a girl on a bicycle)', text: 'Can you draw me a cat with a big tail?', answer: null, npc: true, kind: 'ask', topic: 'a cat drawing' }];
assert.equal(openWishes(s, later).length, 0, 'a note is only a note: what people want made hangs on the notice board (tests/board.mjs)');
assert.match(noteLines(s)[0], /^\[a1\] Wren \(a girl on a bicycle\) asks: "Can you draw me a cat/);
s.wishes = [{ id: 'a1', from: 'Wren', text: 'Can you draw me a cat with a big tail?', topic: 'a cat drawing', at: new Date(later).toISOString(), reward: 2, status: 'open', said: false }];
assert.equal(openWishes(s, later).length, 1);
assert.match(noteLines(s)[0], /would give me 2 coins/);
assert.match(wishLines(s, later)[0], /^Wren wished for a cat drawing \(I may, or not\): with draw, 2 coins/);
const note = s.visitors[0];
note.answer = 'Yes. A cat with the biggest tail.';
noteAnswer(s, { ...note, stranger: true });
assert.equal(s.wishes[0].said, false, 'a traveller asks for nothing: answering one promises nothing');
noteAnswer(s, note);
assert.equal(s.wishes[0].said, true);
assert.match(wishLines(s, later)[0], /I told Wren I would make a cat drawing: with draw, 2 coins/);
ok('a wish stays open, with a reward; saying yes makes it a promise');

assert.deepEqual(keepWishes(s, [{ action: 'decorate', name: 'wooden cat' }], later), [], 'a wooden cat is not the drawing that was asked for');
const kept = keepWishes(s, [{ action: 'draw', name: 'the cat with the big tail', why: 'for Wren' }], later);
assert.match(kept[0], /I made what Wren wished for \(a cat drawing\), and got 2 coins for it\. I have 2 coins now\./);
assert.equal(s.coins, 2);
assert.equal(openWishes(s, later).length, 0);
assert.equal(s.street, undefined, 'no score of friendship is kept');
ok('making it earns the coins, and nothing else');

assert.deepEqual(keepWishes(s, [{ action: 'draw', name: 'old steam locomotive' }, { action: 'draw', name: 'a cat on the moon' }, { action: 'draw', name: 'a clock with a key' }], later), [], 'nobody buys a print at his door any more');
assert.equal(s.coins, 2);
ok('a drawing nobody asked for earns nothing by itself (prints sell on market day)');

s.coins = 3;
s.wishes.push({ id: 'old', from: 'someone', text: 'a song', topic: 'a song', at: new Date(later - 8 * 86_400_000).toISOString(), reward: 3, status: 'open' });
assert.equal(openWishes(s, later).length, 0, 'an old wish fades quietly');
assert.deepEqual(wishLines({ wishes: [{ id: 'x', text: 'a song', topic: 'a song', at: new Date(later).toISOString(), reward: 3, status: 'open' }] }, later), ['Someone wished for a song (I may, or not): with record song, 3 coins when it is done.'], 'a wish without a name is still a wish');
ok('nobody is angry: a wish he does not take just fades');

// ---- the shop
assert.ok(shopOpen(noon) && shopOpen(noon + 9 * 3_600_000), 'the grocery store is always open');
assert.match(buy(s, 'toolbox', noon).failed, /costs 8 coins and I have 3\. I earn coins on market day/);
const b = buy(s, 'clay', noon);
assert.deepEqual([b.bought, b.price, b.left], ['clay', 3, 0]);
assert.ok(s.tools.some((t) => /clay/.test(t.name)));
assert.match(buy(s, 'a flying carpet', noon).failed, /does not have/);
s.coins = 20;
assert.ok(buy(s, 'tomato seeds', noon).bought && s.garden.seeds.some((x) => /tomato/.test(x.name)));
assert.ok(buy(s, 'kalimba', noon).bought && s.tools.some((t) => /kalimba/.test(`${t.name} ${t.kind}`)), 'after saving up: an instrument of his own');
assert.ok(!shopList(s).some((c) => c.item === 'kalimba'), 'what he owns is not offered again');
assert.ok(shopLine(s).length < 120 && CATALOGUE.length > 20);
ok('the grocery store: prices, and real things in his bag');

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
assert.match(market[0].text, /^It is market day on the square\. .* I sold 2 small prints: 2 coins\. I have 2 coins now\.$/);
assert.equal(m.coins, 2);
assert.equal(storyTick(m, saturday + 3 * 3_600_000).filter((e) => e.big).length, 0, 'after something big comes rest');
// the things that needed a neighbour do not happen any more: no puzzle of the week, no parcel from a friend
const k = fresh();
const wednesday = Date.parse('2026-11-25T11:00:00Z');
assert.ok(storyTick(k, wednesday).every((e) => !e.big) && openWishes(k, wednesday).length === 0 && wishLines(k, wednesday).length === 0, 'no puzzle of the week');
const g = fresh();
g.street = { people: { 'Oma Jo': { warmth: 4 }, Lina: { warmth: 9 } } };
assert.ok(storyTick(g, noon).every((e) => !e.big) && g.garden.seeds.length === 0 && g.tools.length === 0, 'no parcel, however fond someone once was');
ok('big things: market day on the square, with rest after it; no puzzle and no parcel');

// a year of the storyteller: nobody is named, and nothing is about the bakery, his street or a road
{
  const y = fresh();
  y.weather = { kind: 'clear', temp: 8 };
  const seen = new Map();
  for (let t = Date.parse('2026-11-24T05:00:00Z'); t < Date.parse('2027-11-24T05:00:00Z'); t += 3 * 3_600_000) {
    if (Math.floor(t / 86_400_000) % 9 === 0) y.art = [{ name: 'a', createdAt: new Date(t).toISOString() }];
    y.weather = Math.floor(t / 86_400_000) % 40 === 3 ? { kind: 'storm', temp: 12 } : Math.floor(t / 86_400_000) % 40 === 7 ? { kind: 'snow', temp: -2 } : { kind: 'clear', temp: 8 };
    for (const e of storyTick(y, t)) seen.set(e.key, e.text);
  }
  const all = [...seen.values()].join('\n');
  assert.ok(seen.size >= 14 && seen.has('market') && [...seen.keys()].filter((key) => key.startsWith('street:')).length === 10, [...seen.keys()].join(', '));
  assert.ok(!FIVE.test(all) && !/neighbou?r|bakery|my street|the street|\broad\b|pavement|parcel|puzzle of the week/i.test(all), all);
  assert.ok(y.teller.log.every((e) => !FIVE.test(e.text)) && y.curious.sparks.every((x) => !FIVE.test(`${x.topic} ${x.text}`)));
  assert.ok((y.wishes ?? []).length === 0, 'the storyteller pins no wishes');
  ok('a whole year of things that happen: nobody has a name, and it is the square, not the street');
}

assert.ok(Math.abs(moonPhase(Date.UTC(2000, 0, 21, 4, 40)) - 0.5) < 0.02, 'the full moon of 21 January 2000');
const moon = fresh();
moon.teller = { seen: {}, lastAt: new Date(0).toISOString() };
let fullAt = Date.parse('2026-11-01T19:00:00Z');
while (Math.abs(moonPhase(fullAt) - 0.5) > 0.01) fullAt += 3_600_000 * 24;
assert.match(storyTick(moon, fullAt)[0].text, /moon is full|shooting stars|fall/);
ok('the sky is the real sky: the moon and the meteor showers');
