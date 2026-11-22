// The storyteller: small things that happen in Pip's street and sky, with a rhythm. Plain code, no model.
// (Research: the worlds that felt alive had outside events with pacing: a little tension, then rest, never a flood.
// RimWorld's storyteller works this way.) There are two sizes:
//   big    a parcel from a neighbour who has grown fond of him, market day, the puzzle maker's weekly puzzle.
//          At most one about every 20 hours.
//   small  something to notice: the real moon and meteor showers, the first frost or snow, life in the street.
//          At most two a day, hours apart. Each can spark his curiosity.
// Everything that happens is true in his world: gifts really arrive, coins are really earned, the moon is the real moon.
import { giveForAsk } from './gifts.js';
import { noteSpark } from './curiosity.js';
import { NEIGHBOURS, warm, openWishes, MAX_OPEN_WISHES } from './neighbours.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SMALL_GAP_H = 5;
const BIG_GAP_H = 20;
const nl = (now, o) => new Date(now).toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', ...o });
const hourNL = (now) => Number(nl(now, { hour: '2-digit', hour12: false }));
const dayNL = (now) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
const weekdayNL = (now) => nl(now, { weekday: 'long' });

// The real moon: 0 new, 0.5 full (a new moon was on 6 January 2000, 18:14 UTC; one round takes 29.53 days).
export const moonPhase = (now = Date.now()) => { const p = ((now - Date.UTC(2000, 0, 6, 18, 14)) / (29.530588853 * DAY)) % 1; return p < 0 ? p + 1 : p; };
// Real meteor showers and turning points of the year: [month, day from, day to, what he notices, topic].
const SKY = [
  [1, 3, 4, 'Tonight the Quadrantids fall: shooting stars from the north.', 'Quadrantids'],
  [3, 19, 21, 'Today day and night are just as long: spring begins.', 'Equinox'],
  [4, 21, 23, 'Tonight the Lyrids fall: shooting stars near the bright star Vega.', 'Lyrids'],
  [6, 20, 22, 'This is the longest day of the year. The sun hardly wants to go down.', 'Summer solstice'],
  [8, 11, 13, 'Tonight the Perseids fall: the best shooting stars of the year.', 'Perseids'],
  [9, 22, 23, 'Today day and night are just as long: autumn begins.', 'Equinox'],
  [10, 20, 22, 'Tonight the Orionids fall: dust from Halley\'s comet.', 'Orionids'],
  [11, 16, 18, 'Tonight the Leonids fall: shooting stars out of the Lion.', 'Leonids'],
  [12, 12, 14, 'Tonight the Geminids fall: slow, bright shooting stars.', 'Geminids'],
  [12, 20, 22, 'This is the shortest day of the year. From now on the light comes back.', 'Winter solstice'],
];
// Life in the street: [key, when (hour test), what he notices, a topic it may spark].
const STREET = [
  ['bakery', (h) => h >= 7 && h < 11, 'The smell of fresh bread drifts up from the bakery under Kees\'s flat.', 'Sourdough'],
  ['synth', (h) => h >= 15 && h < 21, 'Lina is practising: a wobbly synth melody comes through the wall, the same four notes again and again.', 'Arpeggio'],
  ['loco', (h) => h >= 10 && h < 17, 'Mo sits on his doorstep oiling a little model locomotive, humming.', 'Steam locomotive'],
  ['herbs', (h) => h >= 9 && h < 18, 'Oma Jo is hanging bunches of herbs to dry under her porch.', 'Drying herbs'],
  ['chalk', (h) => h >= 13 && h < 18, 'Dot has drawn a huge chalk dinosaur on the pavement. It has seven legs.', 'Dinosaur'],
  ['cat', (h) => h >= 8 && h < 20, 'A grey cat sits on my window sill, looks in at me for a long time, and leaves.', 'Cat'],
  ['clock', (h) => h >= 9 && h < 20, 'Kees has taken a clock apart on a table outside: a hundred tiny wheels in rows.', 'Clockwork'],
  ['kite', (h) => h >= 11 && h < 17, 'Someone flies a red kite over the roofs. It dives and climbs.', 'Kite'],
  ['accordion', (h) => h >= 17 && h < 21, 'Somewhere down the street someone plays an accordion, slow and a little off.', 'Accordion'],
  ['geese', (h) => h >= 7 && h < 18, 'A long V of geese goes over, calling.', 'Bird migration'],
];
const PARCELS = { Mo: ['wood', 'a few pieces of good wood, "left over from my model railway"'], Lina: ['wire', 'a coil of wire, "for when you build something that glows"'], 'Oma Jo': ['tomato seeds', 'a paper bag of tomato seeds, "from my best plant"'], Dot: ['beads', 'a handful of beads, "the blue ones are the best"'], Kees: ['paper', 'a stack of good paper, "for plans and puzzles"'] };
const PUZZLES = ['a game where you catch falling stars', 'a clock that shows the time with dots', 'a maze with exactly one way out', 'a game where two colours must never touch', 'a little machine that sorts things by size', 'a memory game with six pairs', 'a counter that goes up when you find the hidden spot'];

const seenAgo = (s, key, now) => (now - (Date.parse(s.teller?.seen?.[key] ?? 0) || 0)) / DAY;

// One step of the storyteller, at the start of a wake-up. Returns what happened (0 or 1 thing), in his words.
export function storyTick(s, now = Date.now()) {
  if (s.last?.sleeping) return [];
  const st = (s.teller ??= { seen: {} });
  st.seen ??= {};
  const h = hourNL(now);
  const sinceBig = (now - (Date.parse(st.lastBig ?? 0) || 0)) / HOUR;
  const sinceAny = (now - (Date.parse(st.lastAt ?? 0) || 0)) / HOUR;
  const today = dayNL(now);
  if (st.day !== today) Object.assign(st, { day: today, smallToday: 0 });
  const happen = (key, text, { big = false, emoji = '🌤️', spark = null } = {}) => {
    st.seen[key] = new Date(now).toISOString();
    st.lastAt = st.seen[key];
    if (big) st.lastBig = st.seen[key]; else st.smallToday = (st.smallToday ?? 0) + 1;
    if (spark) { const sp = noteSpark(s, { topic: spark, text, from: 'street' }, now); if (sp) sp.shown = 2; } // he hears it as something that happened (once); it can still catch him
    st.log = [...(st.log ?? []), { at: st.seen[key], key, text, big }].slice(-30);
    return [{ key, text, big, emoji }];
  };

  // ---- big things (rest in between)
  if (sinceBig >= BIG_GAP_H && sinceAny >= 2) {
    const madeThisWeek = (s.art ?? []).filter((a) => now - Date.parse(a.createdAt) < 7 * DAY).length + (s.decor ?? []).filter((d) => !d.image && now - Date.parse(d.createdAt) < 7 * DAY).length;
    if (weekdayNL(now) === 'Saturday' && h >= 10 && h < 16 && seenAgo(s, 'market', now) > 5 && madeThisWeek >= 1) {
      const sold = Math.min(6, 1 + Math.floor(madeThisWeek / 3));
      s.coins = (s.coins ?? 0) + sold;
      return happen('market', `It is market day in my street. I put my week's work on a little table by my door, and people stopped to look. I sold ${sold} small print${sold > 1 ? 's' : ''}: ${sold} coin${sold > 1 ? 's' : ''}. I have ${s.coins} coins now.`, { big: true, emoji: '🧺' });
    }
    if (['Wednesday', 'Thursday'].includes(weekdayNL(now)) && h >= 10 && h < 19 && seenAgo(s, 'puzzle', now) > 6 && openWishes(s, now).length < MAX_OPEN_WISHES) {
      const idea = PUZZLES[Math.floor(now / (7 * DAY)) % PUZZLES.length];
      const at = new Date(now).toISOString();
      (s.wishes ??= []).push({ id: `w${now.toString(36)}`, from: 'Kees', text: `Kees's puzzle of the week: could you make ${idea}? A game or a little program.`, topic: idea.replace(/^a (game|clock|maze|little machine|memory game|counter) /, '$1 ').replace(/^a /, ''), at, reward: 5, status: 'open', said: false });
      warm(s, 'Kees', 0.3);
      return happen('puzzle', `Kees pinned his puzzle of the week to my door: "Could you make ${idea}?" He gives 5 coins to whoever makes it work.`, { big: true, emoji: '🧩' });
    }
    const fond = NEIGHBOURS.filter((n) => (s.street?.people?.[n.name]?.warmth ?? 0) >= 3 && seenAgo(s, `parcel:${n.name}`, now) > 5).sort((a, b) => (s.street.people[b.name].warmth ?? 0) - (s.street.people[a.name].warmth ?? 0))[0];
    if (fond && h >= 9 && h < 20 && seenAgo(s, 'parcel', now) > 3) {
      const [item, words] = PARCELS[fond.name];
      const given = giveForAsk(s, item);
      if (given.length) {
        st.seen[`parcel:${fond.name}`] = new Date(now).toISOString();
        return happen('parcel', `A little parcel was at my door, from ${fond.name}: ${words}. I did not ask for it. It is mine now (${given.join(', ')}).`, { big: true, emoji: '🎁' });
      }
    }
  }

  // ---- small things to notice (at most two a day, hours apart)
  if ((st.smallToday ?? 0) < 2 && sinceAny >= SMALL_GAP_H) {
    const d = new Date(now);
    const [mo, dd] = [Number(nl(now, { month: 'numeric' })), Number(nl(now, { day: 'numeric' }))];
    const evening = h >= 17 && h <= 23;
    const sky = SKY.find(([m, a, b]) => m === mo && dd >= a && dd <= b);
    if (sky && seenAgo(s, `sky:${sky[4]}`, now) > 20 && (evening || /day|solstice|Equinox/.test(sky[3] + sky[4]))) return happen(`sky:${sky[4]}`, sky[3], { emoji: '🌠', spark: sky[4] });
    const moon = moonPhase(now);
    if (evening && Math.abs(moon - 0.5) < 0.025 && seenAgo(s, 'moon:full', now) > 20) return happen('moon:full', 'The moon is full tonight. My room is silver at the edges.', { emoji: '🌕', spark: 'Full moon' });
    if (evening && (moon < 0.02 || moon > 0.98) && seenAgo(s, 'moon:new', now) > 20) return happen('moon:new', 'There is no moon tonight: new moon. The darkest night of the month, the best one for stars.', { emoji: '🌑', spark: 'New moon' });
    const w = s.weather ?? {};
    if (w.kind === 'snow' && seenAgo(s, 'snow', now) > 60) return happen('snow', 'It is snowing: the first snow. Everything outside goes quiet and white.', { emoji: '❄️', spark: 'Snowflake' });
    if (Number.isFinite(w.temp) && w.temp <= 0 && h < 11 && seenAgo(s, 'frost', now) > 30) return happen('frost', 'There are frost flowers on my window this morning: little ferns of ice.', { emoji: '🧊', spark: 'Frost' });
    if (w.kind === 'storm' && seenAgo(s, 'storm', now) > 7) return happen('storm', 'A storm is rolling over the street. I count the seconds between the flash and the thunder.', { emoji: '⛈️', spark: 'Thunder' });
    const turn = Math.floor(now / DAY) + d.getUTCHours(); // which street scene is next: they take turns
    const scene = STREET.map((x, i) => STREET[(i + turn) % STREET.length]).find(([key, when]) => when(h) && seenAgo(s, `street:${key}`, now) > 6);
    if (scene) return happen(`street:${scene[0]}`, scene[2], { emoji: '🏘️', spark: scene[3] });
  }
  return [];
}
