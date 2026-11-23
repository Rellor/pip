// What people leave for Pip in his world, and what he learns from it. Plain code, no model.
//  - Drops: a note from someone passing through. It lies somewhere in his world (the page shows it) until he walks over
//    and picks it up (the move fetch_note). Then he reads it and may answer (answer_visitor): he says what he really
//    thinks of it, and whether he keeps it in his head (keep) or lets it go. What he keeps, he has learned (s.learned).
//    For now the travellers are made up: each note carries one true thing about the world, a tip, or an opinion to
//    argue with. (Like the people who leave things for Pino the bird. Later real visitors can take their place.)
//  - Deeds: a small thing a visitor of the page did in his world (api/deed.js): a flower on his doorstep, a paper boat on
//    the pond. No words, so nothing to approve. It lies there until he finds it.
import { noteSpark } from './curiosity.js';

const HOUR = 3_600_000;
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const hourNL = (now) => Number(new Date(now).toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false }));
function dice(seed) {
  let a = 0;
  for (const c of String(seed)) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const TRAVELLERS = [['Sam', 'a sailor'], ['Noor', 'a beekeeper'], ['Ravi', 'a train driver'], ['Ilse', 'a baker’s daughter'], ['Tomás', 'a lighthouse keeper'], ['Yuki', 'a paper folder'], ['Wren', 'a girl on a bicycle'], ['Old Bert', 'a man with a dog'], ['Fenna', 'a painter'], ['Idris', 'a clockmaker'], ['Lotte', 'a postwoman'], ['Kofi', 'a kite maker']];
// [kind, topic, what the note says]. A "fact" is true and can be looked up; a "tip" is for his making; an "opinion" is
// there to be argued with.
export const PARCELS = [
  ['fact', 'Octopus', 'An octopus has three hearts and blue blood. Two of the hearts are only for its gills.'],
  ['fact', 'Honey', 'Honey never goes bad. People found pots of it in old Egyptian tombs, thousands of years old, and it was still good to eat.'],
  ['fact', 'Banana', 'To a botanist a banana is a berry, and a strawberry is not. Nobody asked the fruit.'],
  ['fact', 'Eiffel Tower', 'The Eiffel Tower is about 15 cm taller in summer. Iron grows when it gets warm.'],
  ['fact', 'Venus', 'On Venus a day is longer than a year. It turns around once in 243 Earth days, and goes around the sun in 225.'],
  ['fact', 'Shark', 'Sharks are older than trees. There were sharks about 450 million years ago, long before the first trees.'],
  ['fact', 'Wombat', 'Wombats make droppings shaped like cubes. No other animal is known to do that.'],
  ['fact', 'Hummingbird', 'A hummingbird can fly backwards. It is the only bird that really can.'],
  ['fact', 'Fresnel lens', 'The lamp of a lighthouse is not very strong. The trick is the lens: rings of glass, thought up by Augustin Fresnel in 1822, that bend all the light into one beam.'],
  ['fact', 'Snail', 'A garden snail has thousands of tiny teeth on its tongue. The tongue is called a radula.'],
  ['fact', 'Flamingo', 'A group of flamingos is called a flamboyance.'],
  ['fact', 'Bristlecone pine', 'The oldest known living tree is a bristlecone pine in California, more than 4,800 years old. They call it Methuselah.'],
  ['fact', 'Waggle dance', 'A honeybee tells the others where the flowers are with a dance. The angle of the dance shows the direction, measured from the sun.'],
  ['fact', 'Cumulus cloud', 'A plain white summer cloud weighs about 500 tonnes. As much as a hundred elephants, floating.'],
  ['fact', 'Fulgurite', 'When lightning hits sand it can melt it into a tube of glass. It is called a fulgurite.'],
  ['fact', 'Moon', 'The Moon moves away from the Earth by about 3.8 cm every year. About as fast as a fingernail grows.'],
  ['fact', 'Koala', 'Koalas have fingerprints almost like ours. Even under a microscope they are hard to tell apart.'],
  ['fact', 'LNER Class A4 4468 Mallard', 'The fastest steam locomotive ever was Mallard, in England in 1938: 203 km an hour.'],
  ['fact', 'Magnetic north', 'A compass does not point to the North Pole of the map. It points to the magnetic pole, and that one wanders a little every year.'],
  ['fact', 'Pencil', 'The "lead" in a pencil is not lead at all. It is graphite mixed with clay. More clay makes a harder pencil.'],
  ['fact', 'Ultramarine', 'For a long time the best blue paint was ground from a stone, lapis lazuli, and cost more than gold. Its name, ultramarine, means "from beyond the sea".'],
  ['fact', 'Sourdough', 'Sourdough bread rises without bought yeast. Wild yeast and bacteria from the flour and the air do the work.'],
  ['fact', 'Carrot', 'Carrots were purple and yellow long before they were orange. The orange ones became common in the Netherlands in the 1600s.'],
  ['fact', 'Owl', 'An owl cannot move its eyes. That is why it turns its whole head, up to 270 degrees.'],
  ['fact', 'Petrichor', 'The smell of rain on dry ground has a name: petrichor.'],
  ['fact', 'Polder', 'About a quarter of the Netherlands lies below the level of the sea. Dikes, dunes and pumps keep it dry.'],
  ['fact', 'Orizuru', 'A Japanese story says that whoever folds a thousand paper cranes may make a wish.'],
  ['fact', 'Moog synthesizer', 'The Moog synthesizer of the 1960s made sound out of electricity alone. You shaped it with knobs and patch cables.'],
  ['tip', 'Shadow', 'When you draw a thing, draw its shadow too. A thing without a shadow floats.'],
  ['tip', 'Complementary colours', 'Put a little orange next to blue and both look brighter. Painters call them complementary colours.'],
  ['tip', 'Tower', 'Build the base wider than the top. Towers that forget this fall over. I have seen it.'],
  ['tip', 'Hill', 'A hill looks twice as high with one small tree on top.'],
  ['tip', 'Perspective (graphical)', 'Things far away are smaller, paler and a little bluer. Paint them that way and your picture gets deep.'],
  ['opinion', 'Rain', 'I think rain is better than sunshine. You can hear rain. Tell me I am wrong.'],
  ['opinion', 'Tidiness', 'I walked across your square. It is very tidy. Too tidy, maybe? A town needs one strange thing in it.'],
  ['opinion', 'Hole', 'Is a hole something, or is it nothing with an edge around it? I could not sleep over this.'],
  ['opinion', 'Cat', 'Everyone says cats are clever. I think they just do not care. What do you think?'],
  ['opinion', 'Rhyme', 'I do not like poems that rhyme. They sound as if they want to sell me something.'],
  ['opinion', 'Useless machine', 'What is the most useless thing you ever made? I once built a ladder for a fish.'],
  ['opinion', 'Afternoon', 'The best time of the day is four in the afternoon. Nothing is expected of anyone. Argue with me.'],
  ['opinion', 'Kitsch', 'Somebody called your drawings "nice". I think nice is the worst word there is. What would you want them to be called?'],
  ['opinion', 'Boredom', 'People say being bored is bad. I think every good idea I ever had came out of being bored.'],
];
// Where a note can lie (the spots are in web/town.js: drop_<key>).
export const DROP_PLACES = [['square', 'on the square'], ['pond', 'by the pond'], ['door', 'in front of my door'], ['wall', 'by the long wall']];
export const MAX_LYING = 2;
const DROP_EVERY_H = 4; // about this long after the last one, a new note is left (while he is awake)
const FOUND_AFTER_H = 6; // a note he does not fetch is blown to his door after this long

const drops = (s) => (s.drops ??= []);
export const lying = (s) => drops(s).filter((d) => d.status === 'lying');
// Called at every wake-up: now and then a traveller leaves a note somewhere in his world. Returns the new drop or null.
export function postDrop(s, now = Date.now()) {
  const h = hourNL(now);
  const last = drops(s).at(-1);
  if (h < 9 || h >= 21 || lying(s).length >= MAX_LYING || (last && now - Date.parse(last.at) < DROP_EVERY_H * HOUR)) return null;
  const rnd = dice(`${drops(s).length}:${Math.floor(now / HOUR)}`);
  const had = new Set([...drops(s).slice(-24).map((d) => d.topic), ...(s.learned ?? []).slice(-24).map((l) => l.topic)]);
  const pool = PARCELS.filter(([, topic]) => !had.has(topic));
  const [kind, topic, text] = (pool.length ? pool : PARCELS)[Math.floor(rnd() * (pool.length || PARCELS.length))];
  const [from, who] = TRAVELLERS[Math.floor(rnd() * TRAVELLERS.length)];
  const free = DROP_PLACES.filter(([k]) => !lying(s).some((d) => d.spot === `drop_${k}`));
  const [place, where] = free[Math.floor(rnd() * free.length)];
  const drop = { id: `t${Math.floor(now / 1000).toString(36)}`, from, who, kind, topic, text, spot: `drop_${place}`, where, at: new Date(now).toISOString(), status: 'lying', madeUp: true };
  s.drops = [...drops(s), drop].slice(-30);
  return drop;
}
// For the brain: something lies there for him.
export function dropLines(s) {
  const l = lying(s);
  return l.length ? [`Someone left a note for me ${l[0].where}${l.length > 1 ? `, and another one ${l[1].where}` : ''}. I can walk there and pick it up (fetch_note).`] : [];
}
// What he takes along when he goes to get it (world.js walks him there).
export function fetchJob(s) {
  const d = lying(s)[0];
  return d ? { place: 'drops', kind: 'fetch', words: `pick up the note someone left ${d.where}`, drop: d.id, spot: d.spot, name: `a note from ${d.from}` } : null;
}
// He picked it up (or the wind brought it): now it is a note he can read and answer, like a note from a neighbour.
export function dropFound(s, id, now = Date.now(), how = 'fetched') {
  const d = drops(s).find((x) => x.id === id && x.status === 'lying');
  if (!d) return 'I walked there, but the note was gone. The wind, I think.';
  Object.assign(d, { status: 'found', foundAt: new Date(now).toISOString(), how });
  s.visitors = [...(s.visitors ?? []), { id: d.id, at: d.foundAt, name: `${d.from} (${d.who})`, text: d.text, answer: null, npc: true, stranger: true, kind: 'share', topic: d.topic }].slice(-40);
  if (d.kind !== 'opinion') noteSpark(s, { topic: d.topic, text: d.text, from: 'neighbour' }, now);
  return how === 'fetched'
    ? `I picked up the note ${d.where}. It is from ${d.from}, ${d.who}, who was passing through: "${d.text}"`
    : `The wind blew a note against my door. It is from ${d.from}, ${d.who}: "${d.text}"`;
}
// Notes nobody fetched for a long time come to him by themselves. Returns what happened, in his words.
export function sweepDrops(s, now = Date.now()) {
  return lying(s).filter((d) => now - Date.parse(d.at) > FOUND_AFTER_H * HOUR).map((d) => dropFound(s, d.id, now, 'wind'));
}
// He answered a note from a traveller or a visitor: what he keeps, he has learned. Returns the memory it leaves, or null.
export function learnFrom(s, v, keep = true, now = Date.now()) {
  if (!v || (v.npc && !v.stranger)) return null; // (the neighbours' notes have their own way: neighbours.js)
  const from = clip(String(v.name ?? 'someone').replace(/\s*\(.*\)$/, ''), 30) || 'someone';
  const d = drops(s).find((x) => x.id === v.id);
  if (d) d.kept = Boolean(keep);
  v.kept = Boolean(keep);
  if (!keep) return null;
  s.learned = [...(s.learned ?? []), { id: v.id, from, who: d?.who ?? 'a visitor', topic: clip(v.topic ?? d?.topic ?? '', 60), text: clip(v.text, 300), said: clip(v.answer, 200), at: new Date(now).toISOString() }].slice(-40);
  return `${from} told me: ${clip(v.text, 150)}`;
}

// ---- Small deeds: [what the visitor did, where it lies (a spot of web/town.js), an emoji, what Pip says when he finds it].
export const DEEDS = {
  flower: { label: 'Leave a flower on his doorstep', at: 'home', emoji: '🌼', found: 'Someone left a flower on my doorstep. No note. Just the flower.' },
  apple: { label: 'Leave an apple by the door', at: 'shop', emoji: '🍎', found: 'Someone left an apple for me by the door of the grocery store. I ate it on the way home.', food: 0.6 },
  boat: { label: 'Put a paper boat on the pond', at: 'pond', emoji: '⛵', found: 'A paper boat was sailing on the pond. Somebody folded it and set it off, for nobody, or for me.' },
  doodle: { label: 'Pin a doodle on the board', at: 'board', emoji: '✏️', found: 'Somebody pinned a little doodle on the notice board. Not a wish, just a face with big ears. I think it is me.' },
  hat: { label: 'Put a tiny hat on the stone', at: 'stone', emoji: '🎩', found: 'The green stone was wearing a tiny hat. I do not know who did it. I left it on.' },
  bookmark: { label: 'Leave a bookmark in a book', at: 'library', emoji: '🔖', found: 'In a library book I found a bookmark that was not mine. Someone read this far and then stopped.' },
  chalk: { label: 'Draw hopscotch on the square', at: 'square', emoji: '🟨', found: 'Someone drew a hopscotch on the square with chalk. I hopped it, of course. Twice.' },
};
export const MAX_DEEDS = 4; // lying in his world at one time
const DEED_AFTER_MIN = 20; // he does not find it the moment it is done
// New deeds from the page (pip.js reads the files): { id, deed, at }. One of each kind lies at a time.
export function takeDeed(s, d) {
  s.deeds ??= [];
  if (!DEEDS[d?.deed] || s.deeds.some((x) => x.id === d.id) || s.deeds.filter((x) => x.status === 'lying').length >= MAX_DEEDS || s.deeds.some((x) => x.deed === d.deed && x.status === 'lying')) return false;
  s.deeds = [...s.deeds, { id: clip(d.id, 40), deed: d.deed, at: d.at ?? new Date().toISOString(), status: 'lying' }].slice(-30);
  return true;
}
// He comes across them: one at a wake-up, when it has been lying for a while and he is awake. Returns his words or null.
export function findDeed(s, now = Date.now()) {
  const d = (s.deeds ?? []).find((x) => x.status === 'lying' && now - Date.parse(x.at) > DEED_AFTER_MIN * 60_000);
  if (!d) return null;
  Object.assign(d, { status: 'found', foundAt: new Date(now).toISOString() });
  const k = DEEDS[d.deed];
  const up = (key, by) => { if (Number.isFinite(s[key])) s[key] = Math.round(Math.max(0, Math.min(10, s[key] + by)) * 100) / 100; };
  up('joy', 0.8); up('loneliness', -1.2); up('wonder', 0.4);
  if (k.food) up('fullness', k.food);
  return k.found;
}
