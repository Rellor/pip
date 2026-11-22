// The Street tab (web/street.js, web/streetview.js): what it shows is worked out from his state, and the picture of
// his street is always a whole picture, whatever the hour, the season or the weather.
// Run: node tests/street.mjs
import assert from 'node:assert/strict';
import { PEOPLE, hearts, warmthWord, nextStep, shopOpen, moonPhase, nextFullMoon, streetSvg, faceSvg, sceneOf, CATALOGUE } from '../web/street.js';
import { streetData } from '../web/streetview.js';
import { NEIGHBOURS } from '../neighbours.js';
import { CATALOGUE as SHOP } from '../shop.js';

const ok = (name) => console.log(`ok  ${name}`);
const noon = Date.parse('2026-11-23T11:00:00Z'); // Monday 12:00 in Amsterdam
const iso = (ms) => new Date(ms).toISOString();

// ---- one story for the game and the page
assert.deepEqual(NEIGHBOURS.map((n) => n.name), PEOPLE.map((p) => p.name));
assert.ok(NEIGHBOURS.every((n) => n.voice && n.fan instanceof RegExp && n.who && n.likes.length));
assert.equal(SHOP, CATALOGUE);
ok('the game and the page read the same neighbours and the same shop');

// ---- hearts and words
assert.deepEqual([0, 1, 2, 5, 8, 10].map(hearts), [0, 1, 1, 3, 4, 5]);
assert.equal(warmthWord(5), 'a friend');
assert.deepEqual(nextStep(2.4), { at: 5, word: 'a friend' });
assert.equal(nextStep(9), null);
ok('friendship in hearts and in words');

// ---- what the tab shows
const s = {
  coins: 7, tools: [{ name: 'clay' }], weather: { kind: 'clear', temp: 6 },
  street: { people: { Lina: { warmth: 5.6 }, Mo: { warmth: 2 } } },
  visitors: [
    { id: 'a', at: iso(noon - 3 * 3_600_000), name: 'Mo (neighbour)', npc: true, text: 'Nice tune!', answer: 'Thank you Mo.' },
    { id: 'b', at: iso(noon - 3_600_000), name: 'Dot (neighbour)', npc: true, text: 'Draw me a cat?', answer: null },
    { id: 'c', at: iso(noon - 3_600_000), name: 'Bas', text: 'hello', answer: 'hi' },
  ],
  wishes: [
    { id: 'b', from: 'Dot', text: 'Draw me a cat?', topic: 'a cat drawing', at: iso(noon - 3_600_000), reward: 2, status: 'open', said: false },
    { id: 'old', from: 'Kees', text: 'a clock', topic: 'a clock', at: iso(noon - 9 * 86_400_000), reward: 3, status: 'open' },
    { id: 'k', from: 'Lina', text: 'a star game', topic: 'night sky game', at: iso(noon - 2 * 86_400_000), reward: 5, status: 'kept', keptAt: iso(noon - 86_400_000), with: 'Neon star catcher' },
  ],
  teller: { log: [{ at: iso(noon - 2 * 3_600_000), key: 'street:loco', text: 'Mo oils a little locomotive.', big: false }, { at: iso(noon - 30 * 3_600_000), key: 'parcel', text: 'A parcel from Lina.', big: true }] },
  bought: [{ item: 'clay', price: 3, at: iso(noon - 86_400_000) }],
};
const d = streetData(s, noon);
assert.equal(d.coins, 7);
assert.equal(d.open, true);
assert.ok(d.can.every((c) => c.price <= 7 && c.kind !== 'food') && !d.can.some((c) => c.item === 'clay'), 'what he could buy: not what he has, not more than he has');
assert.equal(d.saving.item, 'toolbox');
assert.deepEqual(d.wishes.map((w) => w.from), ['Dot'], 'an old wish has faded');
assert.equal(d.wishes[0].left, 6);
assert.equal(d.count, 1);
assert.deepEqual(d.kept.map((w) => w.with), ['Neon star catcher']);
const by = Object.fromEntries(d.people.map((p) => [p.name, p]));
assert.deepEqual([by.Lina.hearts, by.Lina.word, by.Lina.kept], [3, 'a friend', 1]);
assert.deepEqual([by.Mo.notes, by.Mo.waiting, by.Mo.scene?.key], [1, 0, 'street:loco']);
assert.deepEqual([by.Dot.waiting, by.Dot.wish?.topic], [1, 'a cat drawing']);
assert.equal(by.Kees.last, null);
assert.equal(d.scene.notes, 1, 'one note waits at his door');
assert.deepEqual(d.scene.today, ['street:loco']);
assert.deepEqual(d.happened.map((e) => e.emoji), ['🚂', '🎁']);
assert.match(d.cap, /^Monday 12:00 · clear, 6° · shop open till 18:00$/);
assert.deepEqual(d.coming.map((c) => c.what), ['Market day', 'Kees’s puzzle of the week', 'Full moon']);
assert.match(d.coming[0].when, /Saturday \(in 5 days\)/);
ok('coins, the shop, wishes, friendships, notes and what happened, from his state');

const night = streetData({ ...s, coins: undefined }, noon + 11 * 3_600_000);
assert.equal(night.open, false);
assert.equal(night.coins, 0);
assert.ok(night.people.find((p) => p.name === 'Dot').awake === false && night.people.find((p) => p.name === 'Lina').awake === true);
assert.deepEqual(streetData({}, noon).people.map((p) => p.hearts), [0, 0, 0, 0, 0], 'an empty state still draws');
ok('at night the shop is closed and the little ones sleep; a brand-new Pip has a street too');

// ---- the picture
const pictures = [
  { now: noon, weather: { kind: 'clear', temp: 7 }, today: ['street:loco'], notes: 0 },
  { now: Date.parse('2026-11-28T11:00:00Z'), weather: { kind: 'cloudy', temp: 9, cloud: 0.8 }, today: ['street:chalk', 'market', 'street:synth'], notes: 2, market: true },
  { now: Date.parse('2026-11-24T22:40:00Z'), weather: { kind: 'clear', temp: 3 }, today: ['moon:full'] },
  { now: Date.parse('2027-01-12T09:30:00Z'), weather: { kind: 'snow', temp: -2 }, today: ['snow', 'street:bakery'], notes: 1, away: true },
  { now: Date.parse('2027-06-15T13:00:00Z'), weather: { kind: 'storm', temp: 17 }, today: ['street:herbs', 'street:cat', 'sky:Perseids'] },
  {},
];
for (const o of pictures) {
  const svg = streetSvg(o);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.ok(!/NaN|undefined|null/.test(svg), `a broken number in the picture: ${svg.match(/.{30}(NaN|undefined|null).{30}/)?.[0]}`);
  for (const who of [...PEOPLE.map((p) => p.name), 'Pip', 'shop']) assert.ok(svg.includes(`data-who="${who}"`), `${who} has a house`);
  assert.equal((svg.match(/<g/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length, 'every group is closed');
}
assert.match(streetSvg(pictures[3]), /he is out/);
assert.match(streetSvg(pictures[2]), /CLOSED/);
assert.match(streetSvg(pictures[0]), /OPEN/);
assert.ok(streetSvg(pictures[1]).includes('>2</text>'), 'two notes at his door');
for (const p of [...PEOPLE.map((x) => x.name), 'Pip', 'nobody']) assert.ok(faceSvg(p).includes('</svg>') && !/NaN|undefined/.test(faceSvg(p)));
assert.equal(sceneOf('sky:Leonids').emoji, '🌠');
ok('the street is a whole picture by day and night, in snow and storm, on market day, and when he is out');

// ---- the sky
assert.equal(shopOpen(noon), true);
assert.ok(Math.abs(moonPhase(Date.UTC(2000, 0, 21, 4, 40)) - 0.5) < 0.02);
const full = nextFullMoon(noon);
assert.ok(full > noon && full - noon < 30 * 86_400_000 && Math.abs(moonPhase(full) - 0.5) < 0.01);
ok('the real moon');
