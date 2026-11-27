// The storyteller: small things that happen on Pip's square and in his sky, with a rhythm. Plain code, no model.
// (Research: the worlds that felt alive had outside events with pacing: a little tension, then rest, never a flood.
// RimWorld's storyteller works this way.) There are two sizes:
//   big    market day on the square. At most one about every 20 hours.
//   small  something to notice: the real moon and meteor showers, the first frost or snow, life on the square.
//          At most two a day, hours apart. Each can spark his curiosity.
// Everything that happens is true in his world: coins are really earned, the moon is the real moon.
// (Nobody in these scenes has a name: his neighbours moved away, and the people he sees now are passing through.)
import { noteSpark } from './curiosity.js';
import { moonPhase } from './web/street.js'; // the real moon (shared with world.js)

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SMALL_GAP_H = 2; // (his world moves: something small to notice every few hours)
export const SMALL_PER_DAY = 5;
const BIG_GAP_H = 20;
const nl = (now, o) => new Date(now).toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', ...o });
const hourNL = (now) => Number(nl(now, { hour: '2-digit', hour12: false }));
const dayNL = (now) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
const weekdayNL = (now) => nl(now, { weekday: 'long' });

// The real moon: 0 new, 0.5 full (a new moon was on 6 January 2000, 18:14 UTC; one round takes 29.53 days).
export { moonPhase };
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
// Life on the square: [key, when (hour test), what he notices, a topic it may spark].
const STREET = [
  ['sparrows', (h) => h >= 7 && h < 11, 'A row of sparrows sits on top of the notice board, all facing the same way.', 'House sparrow'],
  ['printer', (h) => h >= 15 && h < 21, 'The printer in the print workshop is humming. It draws the same line again and again, each time a little higher.', '3D printing'],
  ['traveller', (h) => h >= 10 && h < 17, 'A traveller with a big backpack crosses the square, reads every note on the notice board, and walks on.', 'Hiking'],
  ['heron', (h) => h >= 9 && h < 18, 'A heron stands in the pond on one leg, as still as a fence post.', 'Grey heron'],
  ['chalk', (h) => h >= 13 && h < 18, 'Someone has drawn a huge chalk dinosaur on the square. It has seven legs. Nobody saw who did it.', 'Dinosaur'],
  ['cat', (h) => h >= 8 && h < 20, 'A grey cat sits on my window sill, looks in at me for a long time, and leaves.', 'Cat'],
  ['typing', (h) => h >= 9 && h < 20, 'The door of the internet café stands open. Someone inside types very fast. It sounds like rain on a roof.', 'Touch typing'],
  ['kite', (h) => h >= 11 && h < 17, 'Someone flies a red kite over the roofs. It dives and climbs.', 'Kite'],
  ['accordion', (h) => h >= 17 && h < 21, 'Someone passing through plays an accordion on the square, slow and a little off. Then it stops.', 'Accordion'],
  ['geese', (h) => h >= 7 && h < 18, 'A long V of geese goes over, calling.', 'Bird migration'],
  // (what people in the village do: he sees it happen, and it may give him an idea of his own)
  ['bike', (h) => h >= 8 && h < 19, 'Somebody rides a bike across the square with no hands, eating an apple.', 'Cycling'],
  ['plane', (h) => h >= 11 && h < 17, 'A small model plane goes round and round over the big field, buzzing like a slow fat bee.', 'Model aircraft'],
  ['ball', (h) => h >= 14 && h < 19, 'Two children kick a ball against the wall by the flats. It makes a hollow sound each time.', 'Football'],
  ['boat', (h) => h >= 10 && h < 17, 'A paper boat crosses the pond all by itself. The ducks let it pass.', 'Paper boat'],
  ['skater', (h) => h >= 16 && h < 21, 'Somebody rattles over the square on a skateboard and is gone before I can see who.', 'Skateboarding'],
  ['juggler', (h) => h >= 11 && h < 18, 'A juggler practises by the notice board: three balls, then four, then all of them on the ground.', 'Juggling'],
  ['chess', (h) => h >= 10 && h < 18, 'Two old men play chess on the bench by the pond. Neither has moved for a long time.', 'Chess'],
  ['runner', (h) => h >= 7 && h < 10, 'A runner goes round the pond three times, and each time nods at the heron.', 'Running'],
  ['easel', (h) => h >= 10 && h < 16, 'Somebody stands on the square behind an easel and paints my house. They made it a little too yellow.', 'Painting outdoors'],
  ['stilts', (h) => h >= 12 && h < 17, 'Someone crosses the square on stilts and looks over every wall on the way.', 'Stilts'],
  ['balloon', (h) => h >= 9 && h < 17, 'A hot air balloon drifts over the village, very high, with a sound like a long breath.', 'Hot air balloon'],
  ['drummer', (h) => h >= 17 && h < 21, 'Behind the workshops somebody practises the drums. The same four beats, again and again, each time a little better.', 'Drum kit'],
  ['fisher', (h) => h >= 7 && h < 12, 'A man with a fishing rod sits by the pond. He has caught nothing and looks pleased.', 'Fishing'],
  ['hopscotch', (h) => h >= 13 && h < 18, 'Children hop across a chalk hopscotch on the square and shout the numbers.', 'Hopscotch'],
  ['stargazer', (h) => h >= 20 && h < 23, 'Out by the green stone someone has set up a telescope. A small red light moves about in the dark.', 'Amateur astronomy'],
];

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

  // ---- big things (rest in between). Only market day is left: the parcels and the weekly puzzle went with the neighbours.
  if (sinceBig >= BIG_GAP_H && sinceAny >= 2) {
    const madeThisWeek = (s.art ?? []).filter((a) => now - Date.parse(a.createdAt) < 7 * DAY).length + (s.decor ?? []).filter((d) => !d.image && now - Date.parse(d.createdAt) < 7 * DAY).length;
    if (weekdayNL(now) === 'Saturday' && h >= 10 && h < 16 && seenAgo(s, 'market', now) > 5 && madeThisWeek >= 1) {
      const sold = Math.min(6, 1 + Math.floor(madeThisWeek / 3));
      s.coins = (s.coins ?? 0) + sold;
      return happen('market', `It is market day on the square. I put my week's work on a little table by the notice board, and people passing through stopped to look. I sold ${sold} small print${sold > 1 ? 's' : ''}: ${sold} coin${sold > 1 ? 's' : ''}. I have ${s.coins} coins now.`, { big: true, emoji: '🧺' });
    }
  }

  // ---- small things to notice (a handful a day, hours apart)
  if ((st.smallToday ?? 0) < SMALL_PER_DAY && sinceAny >= SMALL_GAP_H) {
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
    if (w.kind === 'storm' && seenAgo(s, 'storm', now) > 7) return happen('storm', 'A storm is rolling over the square. I count the seconds between the flash and the thunder.', { emoji: '⛈️', spark: 'Thunder' });
    const turn = Math.floor(now / DAY) + d.getUTCHours(); // which scene of the square is next: they take turns
    const scene = STREET.map((x, i) => STREET[(i + turn) % STREET.length]).find(([key, when]) => when(h) && seenAgo(s, `street:${key}`, now) > 3.5);
    if (scene) return happen(`street:${scene[0]}`, scene[2], { emoji: '🏘️', spark: scene[3] });
  }
  return [];
}
