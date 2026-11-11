// A mirror, not a rule: when most of what Pip has been looking up and making shares the same few words,
// he is shown that, so he can notice it himself. It never tells him what to do.
const STOP = new Set('a an the and or of to in on at for with from by about how what why where when which who is are was were be been do does did can could would should i me my we our you your it its this that these those as into than then so not no vs'.split(' '));
const WINDOW = 24; // how many recent searches, readings and made things count
const MIN_ENTRIES = 8;

const words = (t) => [...new Set(String(t ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)))];
const textOf = (e) => [e.query, e.topic, e.name, e.item].filter(Boolean).join(' ');

// Returns '' when there is nothing to show, otherwise a short plain paragraph for his prompt.
export function topicMirror(log) {
  const dom = dominantTheme(log);
  if (dom) return `Of my last ${dom.total} searches, readings and things I made, ${dom.n} were about ${dom.theme}. It is fine to love something and to do a lot with it. But the same subject again and again fills me less each time (my wonder grows slower from it), and something different would feel new and fill me more. What I do is my own choice.`;
  const recent = (Array.isArray(log) ? log : []).filter((e) => ['search_web', 'read_book', 'decorate', 'draw', 'make_app', 'make_clothes'].includes(e.action) && textOf(e)).slice(-WINDOW);
  if (recent.length < MIN_ENTRIES) return '';
  const counts = new Map();
  for (const e of recent) for (const w of words(textOf(e))) counts.set(w, (counts.get(w) ?? 0) + 1);
  const top = [...counts.entries()].filter(([, n]) => n >= Math.ceil(recent.length * 0.25)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);
  if (!top.length) return '';
  const hits = recent.filter((e) => words(textOf(e)).some((w) => top.includes(w)));
  if (hits.length < recent.length * 0.55) return '';
  const others = recent.filter((e) => !hits.includes(e)).map((e) => textOf(e).slice(0, 50)).slice(-4);
  return `Of my last ${recent.length} searches, readings and things I made, ${hits.length} used the words ${top.map((w) => `"${w}"`).join(', ')}. ${others.length ? `The other things I looked at were: ${others.join('; ')}. ` : 'Nothing else came up. '}It is fine to love something and to do a lot with it. But the same theme again and again fills me less each time (my wonder grows slower from it), and something different would feel new and fill me more. What I do is my own choice.`;
}

// Themes: broad subjects, because one subject shows up in many different words (stars, a galaxy, a nebula, Antares...).
const THEMES = {
  'space and stars': /\b(stars?|stellar|galax\w*|nebula\w*|orion|milky|planets?|cosmos|cosmic|astro\w*|telescope\w*|sky|skies|moon|solar|comet\w*|bortle|antares|betelgeuse|light.?years?|supernova\w*|orbit\w*|constellation\w*|universe|triangulum|andromeda|space)\b/i,
  'sound and music': /\b(music\w*|song\w*|sound\w*|audio|piano|melod\w*|compos\w*|chord\w*|lullaby|instrument\w*|oscillation\w*|acoustic|hum\w*|noise)\b/i,
  'nature and animals': /\b(plants?|trees?|flowers?|animals?|birds?|ocean|sea|forest|garden|insects?|fish|mushroom\w*|weather|river|mountain\w*|rain)\b/i,
  'food and cooking': /\b(cook\w*|food|recipe\w*|bread|soup|bak\w*|kitchen|stove|dinner|tea|cake|fruit\w*|eat\w*)\b/i,
  'making and building': /\b(shelf|shelves|closet|build\w*|sculpture\w*|furniture|wood\w*|tools?|room|layout|model|craft\w*|sewing|clothes)\b/i,
  'people and history': /\b(histor\w*|people|war|king|queen|city|country|language\w*|culture\w*|ancient|story|stories|friend\w*|famous)\b/i,
};
const themesOf = (text) => Object.entries(THEMES).filter(([, re]) => re.test(text)).map(([k]) => k);
function dominantTheme(log) {
  const recent = (Array.isArray(log) ? log : []).filter((e) => ['search_web', 'read_book', 'decorate', 'draw', 'make_app', 'make_clothes', 'compose'].includes(e.action) && (textOf(e) || e.why)).slice(-WINDOW);
  if (recent.length < MIN_ENTRIES) return null;
  const counts = new Map();
  for (const e of recent) for (const k of themesOf(`${textOf(e)} ${e.why || ''}`)) counts.set(k, (counts.get(k) ?? 0) + 1);
  const [theme, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return theme && n / recent.length >= 0.55 ? { theme, n, total: recent.length, share: n / recent.length } : null;
}

// Fatigue: when most of what he looked up and made is about one subject, that subject fills him less each time, and something
// different feels new. Like a person who has had enough of one subject. Returns { on, fatigue 0-1 } for a step, or null.
export function themeFatigue(log, details) {
  const dom = dominantTheme(log);
  if (!dom) return null;
  const cur = `${details?.query ?? ''} ${details?.topic ?? ''} ${details?.name ?? ''} ${details?.item ?? ''} ${details?.why ?? ''}`.trim();
  if (!cur) return null;
  return { on: themesOf(cur).includes(dom.theme), fatigue: Math.min(1, (dom.share - 0.45) / 0.45) };
}

// A second mirror: which things he can do that he has not done lately. Only a picture, never an order.
const TRYABLE = { decorate: 'make something for my room', change_thing: 'change something I made', draw: 'draw', compose: 'compose a song', make_app: 'make an app', make_clothes: 'make clothes', play_piano: 'play the piano', write_diary: 'write in my diary', ask_for: 'ask for something' };
export function untriedMirror(log) {
  const recent = (Array.isArray(log) ? log : []).slice(-40);
  if (recent.length < 12) return '';
  const missing = Object.entries(TRYABLE).filter(([a]) => !recent.some((e) => e.action === a)).map(([, t]) => t);
  return missing.length ? `In my last ${recent.length} activities I did not: ${missing.join(', ')}. That is only a picture of how I spend my time.` : '';
}
