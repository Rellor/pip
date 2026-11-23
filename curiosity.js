// Curiosity: how Pip finds new things to love, the way someone does while browsing the web.
// 1. Browsing (the browse move): the game opens something for him: today's news, a "did you know", or a page close to
//    what he already likes (Wikipedia's "more like this"), so one interest can lead to the next (3D printing -> synths).
// 2. Sparks: everything he comes across (browsing, looking up, reading) leaves a spark: a topic and a short text.
// 3. He says what caught him (the brain's "spark" answer: love, like or meh). A topic he loves or keeps coming back to
//    becomes an interest; a strong interest pulls at him to make it a hobby (a project: learn it, get what it needs, make).
// 4. Interests fade slowly when he leaves them alone, so new ones get room.
// Plain code; the only model call is his own answer in the normal brain call.
import { isHeavy } from './news.js';

export const MAX_SPARKS = 30;
export const INTEREST_AT = 3; // a topic with this score is an interest
export const HOBBY_AT = 6; // ...and with this score it pulls at him to make it a hobby
export const MASTER_AFTER = 12; // a hobby he has done this many times is something he has mastered
export const MAX_BROWSE_PER_DAY = 8;
const FADE_PER_DAY = 0.3;
const DAY = 86_400_000;
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

// Something he came across. from: browse, search, read, news.
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
  for (const i of c.interests) i.score = Math.round(Math.max(0, i.score - FADE_PER_DAY * Math.floor(days)) * 10) / 10;
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
    title = (r.query?.random ?? []).map((x) => x.title).find((t) => !isHeavy(t) && !/^(list of|\d{4} in)/i.test(t)) ?? null;
  }
  if (!title) return { failed: 'the pages did not load' };
  const page = await read(title);
  if (!page) return { failed: `I could not open the page about ${title}` };
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
