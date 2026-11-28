// Curiosity: how Pip finds new things to love, the way someone does while browsing the web.
// 1. Browsing (the browse move): the game opens something for him: today's news, a "did you know", or a page close to
//    what he already likes (Wikipedia's "more like this"), so one interest can lead to the next (3D printing -> synths).
// 2. Sparks: everything he comes across (browsing, looking up, reading) leaves a spark: a topic and a short text.
// 3. He says what caught him (the brain's "spark" answer: love, like or meh). A topic he loves or keeps coming back to
//    becomes an interest; a strong interest pulls at him to make it a hobby (a project: learn it, get what it needs, make).
// 4. Interests fade slowly when he leaves them alone, so new ones get room.
// Plain code; the only model call is his own answer in the normal brain call.
import { isHeavy } from './news.js';
import { dullPage } from './research.js';

export const MAX_SPARKS = 30;
export const INTEREST_AT = 3; // a topic with this score is an interest
export const HOBBY_AT = 6; // ...and with this score it pulls at him to make it a hobby
export const MASTER_AFTER = 12; // a hobby he has done this many times is something he has mastered
export const MAX_BROWSE_PER_DAY = 8;
const FADE_PER_DAY = 0.3;
const DAY = 86_400_000;
const dayKey = (when) => new Date(when).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }); // his calendar day
const LOVE = { love: 3, like: 1.5, meh: -0.5, dislike: -1.5, doubt: -0.3 };
const clip = (t, n) => { const x = String(t ?? '').replace(/\s+/g, ' ').trim(); return x.length <= n ? x : `${x.slice(0, n).replace(/\s+\S*$/, '')}…`; };
const key = (t) => String(t ?? '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const same = (a, b) => { const x = key(a); const y = key(b); return Boolean(x && y) && (x === y || (x.length > 4 && y.includes(x)) || (y.length > 4 && x.includes(y))); };

export function ensureCurious(s) {
  s.curious ??= {};
  s.curious.sparks ??= [];
  s.curious.interests ??= [];
  return s.curious;
}

// Something he came across. from: browse, search, read, news, street (the storyteller), outing, traveller (a note someone left).
export function noteSpark(s, { topic, text = '', url = '', from = 'browse', via = null }, now = Date.now()) {
  const c = ensureCurious(s);
  if (!topic || isHeavy(`${topic} ${text}`)) return null;
  const spark = { topic: clip(topic, 80), text: clip(text, 400), url, from, via, at: new Date(now).toISOString(), shown: 0 };
  c.sparks = [...c.sparks.filter((x) => !same(x.topic, topic)), spark].slice(-MAX_SPARKS);
  if (from === 'search' || from === 'read') feel(s, topic, 1, now); // he chose to look it up himself: that already says something
  return spark;
}

// His own opinion about something he read or came across: it is kept with what he read (the page shows it there, and on
// the screen of the internet café), and in a short list of what he thinks about things. Returns the opinion or null.
export function noteOpinion(s, { topic, how, says }, now = Date.now()) {
  const t = clip(says, 200);
  if (!topic || !t) return null;
  const op = { topic: clip(topic, 80), how, says: t, at: new Date(now).toISOString() };
  const words = key(topic).split(' ').filter((w) => w.length > 3);
  const recent = [...(s.log ?? [])].reverse().filter((e) => ['search_web', 'read_book', 'browse'].includes(e.action) && !e.opinion && now - Date.parse(e.at) < 24 * 3_600_000);
  const entry = recent.find((e) => words.some((w) => key(`${e.query ?? ''} ${e.topic ?? ''} ${e.opened?.title ?? ''}`).includes(w))) ?? (recent[0] && now - Date.parse(recent[0].at) < 3 * 3_600_000 ? recent[0] : null);
  if (entry) entry.opinion = { how, says: t };
  s.opinions = [...(s.opinions ?? []).filter((o) => !same(o.topic, op.topic)), op].slice(-30);
  return op;
}
// He felt something about a topic: love, like or meh (or a number).
export function feel(s, topic, how, now = Date.now()) {
  const c = ensureCurious(s);
  const add = typeof how === 'number' ? how : LOVE[String(how ?? '').toLowerCase()] ?? 0;
  if (!topic || !add) return null;
  let it = c.interests.find((i) => same(i.topic, topic));
  if (!it) { it = { topic: clip(topic, 60), score: 0, since: new Date(now).toISOString() }; c.interests.push(it); }
  const was = it.score;
  it.score = Math.round(Math.max(0, Math.min(12, it.score + add)) * 10) / 10;
  it.last = new Date(now).toISOString();
  c.interests = c.interests.filter((i) => i.score > 0.2).sort((a, b) => b.score - a.score).slice(0, 20);
  return { topic: it.topic, became: was < INTEREST_AT && it.score >= INTEREST_AT ? 'interest' : was < HOBBY_AT && it.score >= HOBBY_AT ? 'hobby' : null };
}

// Interests fade a little each day he leaves them alone.
export function fade(s, now = Date.now()) {
  const c = ensureCurious(s);
  const last = Date.parse(c.fadedAt ?? 0) || now;
  const days = (now - last) / DAY;
  if (days < 1) { c.fadedAt ??= new Date(now).toISOString(); return; }
  for (const i of c.interests) if (!(i.own && (i.practice ?? 0) < HOBBY_REAL_AFTER)) i.score = Math.round(Math.max(0, i.score - FADE_PER_DAY * Math.floor(days)) * 10) / 10; // (an idea of his own waits for him: it does not fade, it is tried or let go)
  c.interests = c.interests.filter((i) => i.score > 0.2);
  c.fadedAt = new Date(now).toISOString();
}

export const interests = (s) => ensureCurious(s).interests.filter((i) => i.score >= INTEREST_AT);
// He did or made something: if it is about one of his interests, that is practice (the page counts it, and a hobby he
// practised often is mastered). `what` is what he did, in words. Returns the interests it counted for.
export function practiseInterest(s, what, now = Date.now()) {
  const t = key(what);
  if (!t) return [];
  const hit = ensureCurious(s).interests.filter((i) => i.score >= INTEREST_AT && key(i.topic).split(' ').filter((w) => w.length > 3).some((w) => t.includes(w)));
  for (const i of hit) { i.practice = (i.practice ?? 0) + 1; i.practisedAt = new Date(now).toISOString(); }
  return hit;
}
// Where an interest stands: an interest, a hobby, or mastered.
export const levelOf = (i) => (i.score >= HOBBY_AT && (i.practice ?? 0) >= MASTER_AFTER ? 'mastered' : i.score >= HOBBY_AT ? 'hobby' : 'interest');
const browsedToday = (s, now) => (s.log ?? []).filter((e) => e.action === 'browse' && !e.failed && now - Date.parse(e.at) < DAY).length;
export const canBrowse = (s, now = Date.now()) => browsedToday(s, now) < MAX_BROWSE_PER_DAY;

// Where browsing goes this time: { kind: 'near', topic } (a page close to something he likes), { kind: 'news', item },
// or { kind: 'random' }. random() is passed in for tests.
export function browseRoute(s, random = Math.random) {
  const c = ensureCurious(s);
  const liked = c.interests.filter((i) => i.score >= 1);
  const seen = new Set(c.sparks.map((x) => key(x.topic)));
  const news = (s.news?.items ?? []).filter((n) => n.topic && !seen.has(key(n.topic)) && !isHeavy(`${n.text} ${n.topic}`));
  const r = random();
  if (liked.length && r < 0.55) { // weighted toward what he likes most, but not always the top one
    const total = liked.reduce((a, i) => a + i.score, 0);
    let x = random() * total;
    return { kind: 'near', topic: liked.find((i) => (x -= i.score) <= 0)?.topic ?? liked[0].topic };
  }
  if (news.length && r < 0.85) return { kind: 'news', item: news[Math.floor(random() * news.length)] };
  return { kind: 'random' };
}

// One browse: fetches a page and leaves a spark. wiki(params) is a Wikipedia API call, read(title) reads an article.
export async function browse(s, { wiki, read, random = Math.random, now = Date.now() }) {
  const route = browseRoute(s, random);
  const seen = new Set(ensureCurious(s).sparks.map((x) => key(x.topic)));
  let title = null;
  let via = null;
  if (route.kind === 'near') {
    const found = await wiki(`action=query&list=search&srlimit=12&srsearch=${encodeURIComponent(`morelike:${route.topic}`)}`);
    const hits = (found.query?.search ?? []).map((h) => h.title).filter((t) => !seen.has(key(t)) && !same(t, route.topic) && !isHeavy(t));
    title = hits[Math.floor(random() * Math.min(6, hits.length))] ?? null;
    via = route.topic;
  }
  if (!title && route.kind === 'news') title = route.item.topic;
  if (!title) {
    const r = await wiki('action=query&list=random&rnnamespace=0&rnlimit=5');
    const titles = (r.query?.random ?? []).map((x) => x.title).filter((t) => !isHeavy(t) && !/^(list of|\d{4} in)/i.test(t));
    title = titles.find((t) => t.split(' ').filter((w) => /^[A-Z]/.test(w)).length < 2 && !/\b\d{4}\b/.test(t)) ?? titles[0] ?? null; // (a title of one capital is mostly a thing; two or more is mostly somebody's name)
  }
  if (!title) return { failed: 'the pages did not load' };
  let page = await read(title);
  if (!page) return { failed: `I could not open the page about ${title}` };
  // A stranger's biography, a village, a sports season: not what he wanders the web for. He clicks on (twice at most).
  for (let i = 0; i < 2 && route.kind === 'random' && dullPage(page); i++) {
    const r = await wiki('action=query&list=random&rnnamespace=0&rnlimit=8');
    const next = (r.query?.random ?? []).map((x) => x.title).find((t) => !isHeavy(t) && !/^(list of|\d{4} in)/i.test(t) && !/\b\d{4}\b/.test(t) && t.split(' ').filter((w) => /^[A-Z]/.test(w)).length < 2);
    const other = next ? await read(next) : null;
    if (other) page = other;
  }
  const spark = noteSpark(s, { topic: page.title, text: page.text, url: page.url, from: route.kind === 'news' ? 'news' : 'browse', via }, now);
  return { title: page.title, text: clip(page.text, 300), url: page.url, via, from: route.kind, spark };
}

// For the brain: what he came across lately, what he is into, and a hobby pulling at him.
export function curiosityLines(s, projects = [], now = Date.now()) {
  const c = ensureCurious(s);
  const out = [];
  const fresh = c.sparks.filter((x) => x.shown < 2 && now - Date.parse(x.at) < 12 * 3_600_000).slice(-2);
  for (const x of fresh) {
    x.shown += 1;
    out.push(`I came across ${x.topic}${x.via ? ` (while reading about ${x.via})` : ''}: ${clip(x.text, 220)} In "spark" I say what I really think of it: love, like, meh, dislike or doubt, and one honest sentence of my own (says).`);
  }
  const into = interests(s).slice(0, 4);
  if (into.length) out.push(`Things I am into lately: ${into.map((i) => `${i.topic}${i.score >= HOBBY_AT ? ' (I love it)' : ''}`).join(', ')}.`);
  const hobby = into.find((i) => i.score >= HOBBY_AT && !projects.some((p) => p.status === 'working' && same(p.title, i.topic)) && !projects.some((p) => key(p.title).split(' ').some((w) => w.length > 4 && key(i.topic).includes(w))));
  if (hobby) out.push(`${hobby.topic} keeps pulling at me. I could make it a hobby: a project to learn it, get what I need for it (I can ask Bas), and make something with it.`);
  if (!into.length && !fresh.length) out.push('I have no hobby of my own yet. Browsing the web (browse) is how people stumble on something they love.');
  return out;
}

// ---- A hobby of his own idea. Until now a hobby could only grow out of something he happened to read. Now he can also
// simply think: "I want to start graffiti" (the start_hobby move). He has to say why. From then on it is a hobby he is
// trying: he hears it when he thinks, with the move that would be a way to do it, and every time he really does
// something for it, that counts (practice): once a day at most, because coming back to it on another day is what makes a
// hobby. Six days and it is a hobby for real; often enough and he has mastered it.
// An idea he never tries is let go after a few days, like anyone's.
export const HOBBY_IDEA_EVERY_DAYS = 3; // a new idea at most this often (many small things catch him, few become a hobby)
export const HOBBIES_TRYING_MAX = 2; // ideas he has not made real yet, at one time
export const HOBBY_REAL_AFTER = 6; // done on this many different days: it is a real hobby (it grows over weeks, like a person's)
export const HOBBY_STALE_DAYS = 10; // a real hobby he has not touched for this long: he notices, and says he is done with it
export const HOBBY_DROP_DAYS = 4; // never tried in this many days: he lets the idea go
// Which of his moves are a way to do a hobby, by the words in it.
const HOBBY_MOVES = [
  [/bik(e|ing)|cycl|kite|plane|aircraft|glider|balloon|sail|boat|skat|scooter|sled|juggl|unicycle|swing|fishing|\bball\b|football|frisbee|disc\b|kart|stilts|hoop|yo-?yo|skipping|camp|tent|chess|marbles|card games|hammock|drumming outside/, ['play', 'make_plaything']],
  [/graffiti|mural|street art|spray|tag(ging)?s?\b|wall paint/, ['paint_wall']],
  [/garden|plant|grow(ing)?|herb|vegetable|tomato|flower|botan/, ['plant', 'water', 'harvest']],
  [/music|song|sing|flute|guitar|piano|violin|melod|compos|drum|band/, ['play_piano', 'record_song', 'compose']],
  [/draw|sketch|paint|watercolou?r|illustrat|comic|cartoon|portrait/, ['draw', 'paint_wall']],
  [/cook|bak(e|ing)|recipe|soup|bread|kitchen|food/, ['cook']],
  [/cod(e|ing)|program|game|app\b|software|website|web ?design|pixel/, ['make_app', 'update_app', 'make_site', 'update_site']],
  [/build|carpent|wood|sculpt|potter|clay|ceramic|craft|furniture|architect|model|invent|machine|clock|whittl|carv/, ['extend_thing', 'change_thing', 'build_outside', 'print_thing', 'decorate']], // (adding to a piece he has comes first; a new piece is the last way, and it can go to his museum)
  [/sew|knit|cloth|fashion|costume|hat\b|tailor|weav/, ['make_clothes']],
  [/danc|ballet|gymnast|juggl|acrobat/, ['make_move']],
  [/photo|camera|film/, ['take_photo']],
  [/landscap|dig(ging)?|hill|earth|terrain|land art/, ['shape_land']],
  [/print/, ['print_thing']],
  [/walk|hik|bird|star ?gaz|astronom|night sky|explor|collect|stone|fossil|nature|cloud|weather|fish|duck|kite|map/, ['go_out']],
  [/\bread(ing)?\b|\bbooks?\b|poe(m|try)|\bwrit|stor(y|ies)|diary|journal|histor|philosoph|language/, ['read_book', 'write_diary', 'search_web']],
];
export const hobbyMoves = (topic) => { const t = key(topic); const out = HOBBY_MOVES.filter(([re]) => re.test(t)).flatMap(([, m]) => m); return [...new Set(out.length ? out : ['search_web', 'read_book'])]; }; // nothing fits: he starts by finding out about it
const MOVE_WORDS = { paint_wall: 'paint a wall', plant: 'plant something', water: 'water my plants', harvest: 'harvest', play_piano: 'play music', record_song: 'record a song', compose: 'compose', draw: 'draw', cook: 'cook', make_app: 'write a program', update_app: 'work on a program', make_site: 'make my website', update_site: 'work on my website', decorate: 'make a thing', play: 'go out and do it', make_plaything: 'build what I need for it', build_outside: 'build outside', change_thing: 'make a piece of mine better', extend_thing: 'add to a piece of mine', print_thing: 'print a model', make_clothes: 'make clothes', make_move: 'design a move', take_photo: 'take a photo', shape_land: 'shape the land', go_out: 'go outside', read_book: 'read about it', write_diary: 'write', search_web: 'look it up' };
const ownHobbies = (s) => ensureCurious(s).interests.filter((i) => i.own);
export const tryingHobbies = (s) => ownHobbies(s).filter((i) => (i.practice ?? 0) < HOBBY_REAL_AFTER);
// May he think of a new hobby now? (not too often, and not while two ideas are still waiting to be tried)
export const canStartHobby = (s, now = Date.now()) => tryingHobbies(s).length < HOBBIES_TRYING_MAX && (!s.curious?.hobbyIdeaAt || now - Date.parse(s.curious.hobbyIdeaAt) >= HOBBY_IDEA_EVERY_DAYS * DAY);
// A few ideas that fit his world, different every day (he can also think of anything else).
const HOBBY_IDEAS = ['graffiti on the bare walls', 'growing tomatoes', 'bird watching at the pond', 'stargazing by the green stone', 'building big things on my field', 'writing songs for my flute', 'baking bread', 'carving wood', 'making kites', 'collecting stones', 'drawing a map of my village', 'writing poems', 'land art with hills and holes', 'photography', 'making small games', 'pottery', 'making hats', 'inventing dances', 'building clocks', 'drawing comics', 'writing a book, a page a day', 'keeping a weather diary', 'cooking soups', 'making masks', 'drawing flags for my village', 'star maps', 'making beats', 'building bridges', 'shadow puppets', 'collecting words I like', 'painting stones', 'whistling tunes', 'making model trains', 'a museum guide for my own museum', 'sewing a coat', 'growing herbs for tea'];
export function hobbyIdeas(s, now = Date.now(), n = 3) {
  const have = ensureCurious(s).interests.map((i) => key(i.topic));
  const free = HOBBY_IDEAS.filter((h) => !have.some((k) => k && key(h).split(' ').some((w) => w.length > 4 && k.includes(w))));
  const day = Math.floor(now / DAY);
  return Array.from({ length: Math.min(n, free.length) }, (_, i) => free[(day * 7 + i * 5) % free.length]).filter((v, i, all) => all.indexOf(v) === i);
}
// He decides to try something as a hobby. Returns { hobby } or { failed } (he hears why).
export function startHobby(s, what, why, now = Date.now()) {
  const c = ensureCurious(s);
  const topic = clip(String(what ?? '').replace(/^(to |i want to |i wanna |start(ing)? |try(ing)? |learn(ing)? (how to )?)+/i, '').replace(/\s+as a hobby$/i, ''), 60);
  const reason = clip(why, 200);
  if (key(topic).length < 3) return { failed: 'I did not say what the hobby is' };
  if (reason.length < 12 || reason.split(' ').length < 3) return { failed: `a hobby needs a why: I say in one honest sentence why I want to try ${topic}` };
  if (isHeavy(topic)) return { failed: 'that is nothing for a hobby' };
  if (!canStartHobby(s, now)) return { failed: tryingHobbies(s).length >= HOBBIES_TRYING_MAX ? `I still have not tried ${tryingHobbies(s).map((i) => i.topic).join(' or ')}: first that, then a new idea` : 'I had a new idea for a hobby only a little while ago: first I try that one' };
  const old = c.interests.find((i) => same(i.topic, topic));
  if (old?.own) return { failed: `${old.topic} is a hobby of mine already` };
  const hobby = old ?? { topic, score: 0, since: new Date(now).toISOString() };
  Object.assign(hobby, { score: Math.max(hobby.score, HOBBY_AT), own: true, why: reason, ideaAt: new Date(now).toISOString(), last: new Date(now).toISOString(), moves: hobbyMoves(topic), practice: hobby.practice ?? 0 });
  if (!old) c.interests.push(hobby);
  c.interests = c.interests.filter((i) => i.score > 0.2).sort((a, b) => b.score - a.score).slice(0, 20);
  c.hobbyIdeaAt = new Date(now).toISOString();
  return { hobby };
}
// After a wake-up: what he really did for a hobby of his own idea counts (once per hobby per wake-up). Returns
// [{ hobby, became }] where became is 'real' when it has just turned into a real hobby, or 'mastered'.
export function practiseHobby(s, entries, now = Date.now()) {
  const out = [];
  for (const h of ownHobbies(s)) {
    const words = key(h.topic).split(' ').filter((w) => w.length > 3);
    const did = (entries ?? []).find((e) => !e.failed && !e.fallback && e.as !== 'start_hobby' && ((h.moves ?? []).includes(e.as ?? e.action) || (h.moves ?? []).includes(e.action) || words.some((w) => key(`${e.name ?? ''} ${e.what ?? ''} ${e.query ?? ''} ${e.topic ?? ''}`).includes(w))));
    if (!did) continue;
    h.goes = (h.goes ?? h.practice ?? 0) + 1; // every time he did it
    if (h.practisedAt && dayKey(h.practisedAt) === dayKey(now)) { h.last = new Date(now).toISOString(); continue; } // he did it today already: a hobby grows by the days he comes back to it
    const was = h.practice ?? 0;
    h.practice = was + 1;
    h.practisedAt = new Date(now).toISOString();
    h.score = Math.round(Math.min(12, Math.max(h.score, HOBBY_AT) + 0.5) * 10) / 10; // doing it keeps it alive
    h.last = h.practisedAt;
    out.push({ hobby: h, became: was < HOBBY_REAL_AFTER && h.practice >= HOBBY_REAL_AFTER ? 'real' : was < MASTER_AFTER && h.practice >= MASTER_AFTER ? 'mastered' : null });
  }
  return out;
}
// A hobby of his own that he did, and then did not touch for a long time: he notices it himself, and lets it go. Returns the ones that went
// (he says so: pip.js writes it into his day and his memory).
export function letGoStale(s, now = Date.now()) {
  const c = ensureCurious(s);
  const gone = c.interests.filter((i) => i.own && (i.practice ?? 0) > 0 && now - Date.parse(i.practisedAt ?? i.last ?? i.since) >= HOBBY_STALE_DAYS * DAY);
  if (gone.length) { c.interests = c.interests.filter((i) => !gone.includes(i)); c.pastHobbies = [...(c.pastHobbies ?? []), ...gone.map((i) => ({ topic: i.topic, days: i.practice, since: i.ideaAt ?? i.since, goneAt: new Date(now).toISOString() }))].slice(-12); }
  return gone;
}
// An idea he never tried is let go. Returns the hobbies that went (for a memory).
export function dropUntriedHobbies(s, now = Date.now()) {
  const c = ensureCurious(s);
  const gone = c.interests.filter((i) => i.own && !(i.practice > 0) && now - Date.parse(i.ideaAt ?? i.since) >= HOBBY_DROP_DAYS * DAY);
  if (gone.length) c.interests = c.interests.filter((i) => !gone.includes(i));
  return gone;
}
// For the brain: the hobbies of his own idea, and what would be a way to do them now.
export function hobbyLines(s, offered = [], now = Date.now()) {
  return ownHobbies(s).filter((h) => (h.practice ?? 0) < MASTER_AFTER).slice(0, 3).map((h) => {
    const n = h.practice ?? 0;
    const ways = (h.moves ?? []).filter((m) => !offered.length || offered.includes(m)).slice(0, 3).map((m) => `${MOVE_WORDS[m] ?? m.replace(/_/g, ' ')} (${m})`);
    const days = Math.max(0, Math.floor((now - Date.parse(h.ideaAt ?? h.since)) / DAY));
    const onePiece = (h.moves ?? []).includes('extend_thing') ? ' For this hobby I like to keep working on one piece (I add to it, I make it better) or build big outside, more than a new small thing every time.' : '';
    return `${n >= HOBBY_REAL_AFTER ? `My hobby: ${h.topic} (I did it on ${n} different days)` : `My own idea: I want to try ${h.topic} as a hobby${h.why ? ` (${h.why})` : ''}. ${n ? `I did it on ${n} day${n === 1 ? '' : 's'} so far (a hobby is something I come back to on other days)` : `I have not tried it yet${days ? `, and it has been ${days} day${days === 1 ? '' : 's'}` : ''}`}`}.${ways.length ? ` A way to do it now: ${ways.join(', ')}.` : ' I can find out how it is done first (search_web).'}${onePiece}`;
  });
}
