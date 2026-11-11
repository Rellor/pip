// A gentle daily newspaper for Pip, and a mirror of what he keeps looking up.
// The news comes from Wikipedia's daily feed (headlines, "did you know", "on this day").
// Grim items are left out: Pip is a small, shy creature and the point is a spark of curiosity, not distress.

const HEAVY = /\b(shoot\w*|shot|kill\w*|dead|death\w*|died|murder\w*|massacre\w*|attack\w*|bomb\w*|terror\w*|war|wars|invasion|crash\w*|explosion\w*|disaster\w*|earthquake\w*|flood\w*|famine|genocide|assassinat\w*|hostage\w*|abuse\w*|suicide|riot\w*|victims?|wound\w*|injur\w*|casualt\w*|execut\w*|crisis|impeach\w*|arrest\w*|prison\w*|convict\w*|sentenc\w*|trial|scandal|collapse\w*)\b/i;

const plain = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const clip = (t, n) => (t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + ' …');
const list = (v) => (Array.isArray(v) ? v : []);
// "Did you know" items carry their links inside the html: <a href="/wiki/Octopus" title="Octopus">
const htmlLinks = (html) =>
  [...String(html || '').matchAll(/<a [^>]*href="(?:https:\/\/en\.wikipedia\.org)?(?:\.\/|\/wiki\/)([^"#]+)"[^>]*>/g)].map((m) => {
    let title = m[1];
    try {
      title = decodeURIComponent(m[1]);
    } catch {}
    return { title, content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${m[1]}` } } };
  });
const topicOf = (links) => (links?.[0]?.title ? String(links[0].title).replace(/_/g, ' ') : '');
const urlOf = (links) => links?.[0]?.content_urls?.desktop?.page || '';

export const isHeavy = (text) => HEAVY.test(text);

// Picks up to 3 gentle items from the feed: a headline, a "did you know", and something from history.
export function pickNews(feed, dayNumber = Math.floor(Date.now() / 86_400_000)) {
  const items = [];
  const seen = new Set();
  const add = (kind, text, links, max = 220) => {
    const topic = topicOf(links);
    if (!text || (topic && seen.has(topic))) return;
    if (topic) seen.add(topic);
    items.push({ kind, text: clip(text, max), topic, url: urlOf(links) });
  };
  // A few of each, from different places in the feed, so the day covers different subjects.
  const spread = (arr, n) => (arr.length <= n ? arr : Array.from({ length: n }, (_, i) => arr[(dayNumber + Math.floor((i * arr.length) / n)) % arr.length]));

  const news = list(feed?.news).map((n) => ({ text: plain(n?.story), links: list(n?.links) })).filter((n) => n.text && !isHeavy(n.text));
  spread(news, 2).forEach((n) => add('In the news', n.text, n.links));

  const dyk = list(feed?.dyk).map((d) => ({ text: plain(d?.text || d?.html).replace(/^\.\.\.\s*/, ''), links: list(d?.links).length ? list(d.links) : htmlLinks(d?.html) })).filter((d) => d.text && !isHeavy(d.text));
  spread(dyk, 3).forEach((d) => add('Did you know', d.text, d.links));

  const past = list(feed?.onthisday).map((e) => ({ text: `${e?.year}: ${plain(e?.text)}`, links: list(e?.pages) })).filter((e) => !isHeavy(e.text));
  spread(past, 2).forEach((e) => add('On this day', e.text, e.links));

  if (feed?.tfa?.title) {
    const t = feed.tfa;
    const text = plain(t.extract);
    if (text && !isHeavy(text)) add('Featured article', text, [{ title: String(t.title).replace(/_/g, ' '), content_urls: t.content_urls }]);
  }
  const pic = feed?.image;
  const picText = plain(pic?.description?.text);
  if (pic?.title && picText && !isHeavy(picText)) add('Picture of the day', picText, [{ title: String(pic.title).replace(/^File:/, '').replace(/\.\w+$/, '').replace(/_/g, ' '), content_urls: { desktop: { page: pic.file_page || '' } } }]);
  return items.slice(0, 8);
}

export async function fetchNews(now = new Date()) {
  const [y, m, d] = now.toISOString().slice(0, 10).split('-');
  const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${d}`, {
    headers: { 'User-Agent': 'PipCharacter/0.1 (personal hobby project)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`News feed answered ${res.status}`);
  return pickNews(await res.json(), Math.floor(now.getTime() / 86_400_000));
}

// Gets today's news once a day. If it fails, Pip keeps yesterday's and tries again in an hour.
export async function refreshNews(state, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const news = state.news || { date: '', items: [], triedAt: 0 };
  if (news.date === today && news.items.length && news.v === 2) return;
  if (now.getTime() - (news.triedAt || 0) < 3_600_000) return;
  news.triedAt = now.getTime();
  try {
    const items = await fetchNews(now);
    if (items.length) Object.assign(news, { date: today, items, v: 2 });
  } catch (e) {
    console.error('⚠️  news:', e.message);
  }
  state.news = news;
}

// ---- the mirror: what Pip keeps coming back to
const STOP = new Set('about after also being between could does from have into just like more most much only other over same than that their them then there these they this those very what when where which while with would your how why who the and for are was were can you its not but all any his her she him our out has had one two ever many some such near best first last small large'.split(' '));
const stem = (w) => (w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

// `lookups` are the queries and topics of his last searches and reading.
export function themeMirror(lookups) {
  const n = lookups.length;
  if (n < 5) return null;
  const count = new Map();
  for (const q of lookups) {
    const words = new Set(String(q).toLowerCase().match(/[a-z]{4,}/g)?.map(stem).filter((w) => !STOP.has(w)) ?? []);
    for (const w of words) count.set(w, (count.get(w) || 0) + 1);
  }
  const top = [...count.entries()].filter(([, c]) => c >= Math.max(3, Math.ceil(n / 3))).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!top.length) return null;
  const list = top.map(([w, c]) => `"${w}" (${c} of my last ${n} lookups)`).join(', ');
  return `I notice I keep looking up the same things: ${list}. I might want something different for a change, or I might not.`;
}
