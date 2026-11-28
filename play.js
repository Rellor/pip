// Things to do that leave nothing behind. Pip can build anything he can think of to use outside: a bike, a kite, a model
// plane, a boat for the pond, a ball, a swing, a go-kart. He designs the thing himself (the maker, like everything he
// makes) AND says how it is used: one word for what he does with it, how it moves, and where. From then on he can take
// it out whenever he likes (play). It does not stand in his room. The more he does it, the better he gets: the game
// tells that story by plain code, no model is asked.
// He can also get such a thing by asking for it (his wants list): when it is given, it arrives and he sets it up the
// same way (arrivals, below).
// And he can simply play one of the games he wrote (play_game).
export const MOTIONS = ['ride', 'fly', 'float', 'roll', 'stay', 'hold'];
export const PLAY_PLACES = ['square', 'pond', 'field', 'stone', 'doorstep'];
export const PLAYTHINGS_MAX = 12; // what he keeps to play with; the one he used least makes room
export const PLAYTHINGS_PER_DAY = 6; // (he decides: this only stops a runaway day)
const DEFAULT_WHERE = { ride: 'square', fly: 'field', float: 'pond', roll: 'square', stay: 'field', hold: 'doorstep' };
const DEFAULT_VERB = { ride: 'ride', fly: 'fly', float: 'sail', roll: 'roll', stay: 'use', hold: 'play with' };
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const bare = (name) => clip(name, 60).replace(/^(a|an|the|my)\s+/i, '');
const same = (a, b) => bare(a).toLowerCase() === bare(b).toLowerCase();

// How a thing moves when he uses it, from his words (when he did not say, or said something else).
export function motionOf(words) {
  const t = String(words ?? '').toLowerCase();
  if (/\b(fl(y|ies|ying|own)|kite|plane|glider|balloon|drone|rocket|disc|frisbee|boomerang|bird)\b/.test(t)) return 'fly';
  if (/\b(sail\w*|boat|float\w*|raft|ship|canoe|paddl\w*|row(ing)?)\b/.test(t)) return 'float';
  if (/\b(rid(e|es|ing)|bike|bicycle|cycl\w*|skat\w*|scooter|kart|cart|car|sled\w*|sledge|unicycle|drive|driving|race|wagon|horse|tricycle|trike|train)\b/.test(t)) return 'ride';
  if (/\b(kick\w*|\w*ball|hoop|roll\w*|marbles?|bowl\w*|throw\w*|toss\w*|hit|bat|club)\b/.test(t)) return 'roll';
  if (/\b(swing\w*|hammock|tent|camp\w*|telescope|seesaw|slide|chess|fish\w*|rod|bench|table|climb\w*|tower|trampoline|sit|lie|watch\w*)\b/.test(t)) return 'stay';
  return 'hold';
}
const placeOfWords = (t) => (PLAY_PLACES.find((p) => new RegExp(`\\b${p}\\b`).test(String(t ?? '').toLowerCase())) ?? (/\b(water|duck)/.test(String(t ?? '').toLowerCase()) ? 'pond' : /\b(land|grass|meadow)\b/.test(String(t ?? '').toLowerCase()) ? 'field' : null));

export const playthings = (s) => s.playthings ?? [];
export const findPlaything = (s, name) => playthings(s).find((p) => same(p.name, name)) ?? playthings(s).find((p) => bare(name).length > 2 && (p.name.toLowerCase().includes(bare(name).toLowerCase()) || bare(name).toLowerCase().includes(bare(p.name).toLowerCase()))) ?? null;
export const madeToday = (s, isToday, now) => playthings(s).filter((p) => p.made === 'built' && isToday(p.createdAt, now)).length;

// He built it (d is what the maker designed: name, why, verb, motion, where, how, parts) or it was given to him.
// Returns { thing } or { failed }.
export function makePlaything(s, d = {}, now = Date.now(), made = 'built') {
  const name = bare(d.name ?? d.what);
  const parts = Array.isArray(d.parts) ? d.parts : [];
  if (name.length < 2) return { failed: 'I did not say what it is' };
  if (!parts.length) return { failed: 'the shapes did not work out' };
  const have = playthings(s).find((p) => same(p.name, name));
  if (have) return { failed: `I have a ${have.name} already: I can take it out (play)` };
  const said = `${d.verb ?? ''} ${d.how ?? ''} ${name} ${d.what ?? ''}`;
  const motion = MOTIONS.includes(String(d.motion ?? '').toLowerCase()) ? String(d.motion).toLowerCase() : motionOf(said);
  let where = PLAY_PLACES.includes(String(d.where ?? '').toLowerCase()) ? String(d.where).toLowerCase() : placeOfWords(d.where) ?? placeOfWords(d.how) ?? DEFAULT_WHERE[motion];
  if (motion === 'float') where = 'pond'; // it floats where there is water
  const verb = clip(String(d.verb ?? '').toLowerCase().replace(/[^a-z -]/g, ''), 20) || DEFAULT_VERB[motion];
  const thing = { id: `pl${now.toString(36)}`, name, why: clip(d.why, 200), how: clip(d.how, 200) || `I ${verb} it ${where === 'square' ? 'on the square' : where === 'doorstep' ? 'in front of my door' : where === 'stone' ? 'out by the green stone' : `${where === 'pond' ? 'on' : 'on'} ${where === 'pond' ? 'the pond' : 'my field'}`}.`, verb, motion, where, parts, made, createdAt: new Date(now).toISOString(), goes: 0, lastAt: null };
  s.playthings = [...playthings(s), thing];
  let gone = null;
  if (s.playthings.length > PLAYTHINGS_MAX) { // the one he used least makes room (the oldest of those)
    gone = [...s.playthings.slice(0, -1)].sort((a, b) => a.goes - b.goes || Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
    s.playthings = s.playthings.filter((p) => p.id !== gone.id);
  }
  return { thing, gone };
}

// What he sets off with (world.js keeps it with his outing, and the page shows him doing it).
export const playJob = (p) => ({ id: p.id, name: p.name, verb: p.verb, motion: p.motion, place: p.where, words: `${p.verb} my ${p.name}` });
// How good he is at it by now, in a word.
export const levelOf = (p) => ((p.goes ?? 0) === 0 ? 'never tried' : p.goes < 3 ? 'a beginner' : p.goes < 8 ? 'getting the hang of it' : p.goes < 20 ? 'good at it' : 'a master');

// What happened this time, in his words: it depends on how it moves and how often he has done it.
const STORY = {
  ride: [
    ['I got on my {name} for the first time. It went where it wanted, which was mostly sideways. I fell off twice and got back on three times.', 'First go on my {name}. I wobbled across {place} like something with five legs. I did not stop smiling.'],
    ['I rode my {name} round {place}. Still wobbly in the turns. I only put a foot down four times.', 'Round {place} on my {name}. The straight bits go well now. The turns have opinions.'],
    ['I rode my {name} round {place}, round and round, without thinking about it. The wind in my face is the whole point.', 'Seven times round {place} on my {name}, the last one with no hands for a moment. Nobody saw. I saw.'],
  ],
  fly: [
    ['I took my {name} out for the first time. It went up, thought about it, and came down on its nose. Then it stayed up for a whole minute.', 'First flight of my {name}. Three crashes and one moment where it just hung there in the air, as if it had always been there.'],
    ['I flew my {name} over {place}. It climbs well now. Landing is still more of a falling.', 'My {name} stayed up a long time over {place}. I let out more line than I dared last time.'],
    ['I flew my {name} high over {place}, in slow wide circles, and brought it down at my feet. I know what the wind is going to do before it does.', 'My {name} drew circles over {place} for half an hour. From up there my whole village must look like a toy.'],
  ],
  float: [
    ['I put my {name} on the pond for the first time. It floated. Then it turned round and floated the wrong way, with great confidence.', 'First launch of my {name}. It leaned, it took in water, it stayed up. The ducks kept their distance.'],
    ['I sailed my {name} on the pond. It crossed to the reeds and got stuck, and the wind brought it back by itself.', 'My {name} went all the way across the pond today. A duck swam beside it the whole way.'],
    ['I sailed my {name} across the pond and back, twice. I can read the wind on the water now, by the little dark patches.', 'My {name} raced a leaf across the pond and won by a length.'],
  ],
  roll: [
    ['I tried my {name} for the first time. It rolled away faster than I could follow, and I ran after it across {place}.', 'First try with my {name}. It never went where I aimed. It went somewhere better.'],
    ['I played with my {name} on {place}. I can keep it going for ten counts now. Eleven is a rumour.', 'My {name} and I crossed {place} together, more or less in a straight line.'],
    ['I played with my {name} on {place} until my legs said stop. It does what I mean now, nearly always.', 'A hundred counts with my {name} without losing it once. I counted out loud at the end.'],
  ],
  stay: [
    ['I tried my {name} for the first time. I did not know how long to stay, so I stayed a long time.', 'First time at my {name}. It holds. I checked by using it, which is the only real way.'],
    ['I spent a while at my {name}. The world goes on by itself when I am there, which is restful to see.', 'At my {name} again. I notice more each time: today, how the light moves.'],
    ['I was at my {name} for a long time and thought about nothing at all. I am getting good at that.', 'My {name} and I know each other now. I did not want to go home.'],
  ],
  hold: [
    ['I tried my {name} for the first time. More of it ended up on the ground than in my hands.', 'First go with my {name}. I was bad at it in a way that makes me want to try again at once.'],
    ['I practised with my {name}. Still dropping it, but later each time.', 'With my {name} again. My hands begin to know what to do before I tell them.'],
    ['I practised with my {name} until it looked easy. It is not easy. It only looks it now.', 'My {name} did everything I asked today. Somebody clapped, or a door banged. I took it as clapping.'],
  ],
};
const PLACE_WORDS = { square: 'the square', pond: 'the pond', field: 'my field', stone: 'the grass by the green stone', doorstep: 'the path in front of my door' };
// The outing is over: he did it. Returns what happened in his words and what it does to him (world.js applies it).
export function playDone(s, job, rnd = Math.random, { wet = false, frozen = false } = {}) {
  const p = playthings(s).find((x) => x.id === job?.id) ?? null;
  const goes = p?.goes ?? 0;
  const band = goes === 0 ? 0 : goes < 6 ? 1 : 2;
  const lines = STORY[job?.motion] ?? STORY.hold;
  let did = lines[band][Math.floor(rnd() * lines[band].length) % lines[band].length].replace(/\{name\}/g, job?.name ?? 'thing').replace(/\{place\}/g, PLACE_WORDS[job?.place] ?? 'the square');
  if (job?.motion === 'float' && frozen) did = `The pond was frozen, so my ${job.name} did not float: it slid. I pushed it over the ice and ran after it. That works too.`;
  else if (wet) did += ' It rained the whole time. I did it anyway.';
  if (p) { p.goes = goes + 1; p.lastAt = new Date().toISOString(); }
  return { did, first: goes === 0, goes: goes + 1, saw: `${PLACE_WORDS[job?.place] ?? 'outside'} with my ${job?.name ?? 'thing'}` };
}

// For his prompt: what he has to play with, and what has stood unused for long.
export function playLines(s, now = Date.now()) {
  const list = playthings(s);
  if (!list.length) return [];
  const idle = list.filter((p) => !p.lastAt || now - Date.parse(p.lastAt) > 2 * 86_400_000);
  return [`Things of mine to go out with: ${list.slice(-5).map((p) => `${p.name} (I ${p.verb} it, ${p.goes ? `${p.goes} time${p.goes === 1 ? '' : 's'} so far` : 'never tried yet'})`).join('; ')}.${idle.length ? ` ${idle[0].goes ? `I have not been out with my ${idle[0].name} for days` : `My ${idle[0].name} still waits for its first go`}.` : ''}`];
}

// ---- Things he asked for that were given: they arrive, and he sets them up at his next free moment (one design).
const TOOLISH = /\b(seeds?|bread|food|flour|sugar|milk|eggs?|butter|cheese|apples?|soup|paper|paint|clay|wool|wood|nails|toolbox|hammer|saw|brush|pencils?|book|card)\b/i;
export const looksPlayable = (item) => !TOOLISH.test(String(item ?? '')) && motionOf(item) !== 'hold' ? true : /\b(juggl\w*|yo-?yo|rope|drum|chess|cards|marbles|toy|game|stilts|binoculars|puppet|whistle|top)\b/i.test(String(item ?? ''));
export function noteArrival(s, item, now = Date.now()) {
  const what = bare(item);
  if (what.length < 2 || findPlaything(s, what) || (s.arrivals ?? []).some((a) => same(a.what, what))) return null;
  s.arrivals = [...(s.arrivals ?? []), { what, at: new Date(now).toISOString() }].slice(-4);
  return what;
}
export const nextArrival = (s) => (s.arrivals ?? [])[0] ?? null;
export const arrived = (s, what) => { s.arrivals = (s.arrivals ?? []).filter((a) => !same(a.what, what)); };

// ---- Playing one of the games he wrote himself. No model: the score is made by plain code and grows with practice.
export function playGame(s, name, rnd = Math.random, now = Date.now()) {
  const apps = s.apps ?? [];
  const app = apps.find((a) => same(a.title ?? a.name, name) || same(a.name, name)) ?? apps[Math.floor(rnd() * apps.length)] ?? null;
  if (!app) return { failed: 'I have no game of my own to play yet: I can write one (make_app)' };
  s.games ??= {};
  const g = (s.games[app.name] ??= { plays: 0, best: 0 });
  const score = Math.round((20 + g.plays * 6) * (0.5 + rnd()));
  g.plays += 1;
  const record = score > g.best;
  if (record) g.best = score;
  g.lastAt = new Date(now).toISOString();
  const title = clip(app.title ?? app.name, 40);
  return { game: title, score, best: g.best, record, plays: g.plays, said: record && g.plays > 1 ? `I played my own game ${title}: ${score} points. A new best. I beat myself, which is the fairest fight there is.` : g.plays === 1 ? `I played my own game ${title} properly for the first time: ${score} points. I found one thing in it I want to change.` : `I played my own game ${title}: ${score} points. My best is ${g.best}. Next time.` };
}
