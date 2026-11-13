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

// A third mirror: things he can do that he has not done for a long time (or ever, in what the log remembers), each with an idea.
// Only a picture, never an order. Shows at most 3, and which ones changes from wake-up to wake-up so one never nags.
export const DORMANT = [
  ['take_photo', 'take a photo with my camera (the window, a selfie, my room: it is a picture of my own world)', 6],
  ['draw', 'paint or draw a picture for my wall (draw, as SVG)', 8],
  ['decorate', 'build a sculpture or something new for my room (decorate, from simple shapes)', 8],
  ['compose', 'compose a song of my own', 8],
  ['make_clothes', 'make something to wear (a hat, a scarf, glasses...)', 72],
  ['make_app', 'make a little app', 12],
  ['cook', 'cook something', 8],
  ['read_book', 'read about something', 6],
  ['find_picture', 'look for a picture online for my wall', 10],
  ['add_use', 'give something I made a new use', 12],
];
export const dormantList = (log, now = Date.now(), blocked = []) => {
  const l = (Array.isArray(log) ? log : []).filter((e) => Date.parse(e.at) <= now);
  if (l.length < 12) return [];
  const since = Date.parse(l[0].at);
  return DORMANT.map(([a, text, h]) => {
    const last = [...l].reverse().find((e) => e.action === a && !e.failed);
    const hours = last ? (now - Date.parse(last.at)) / 3_600_000 : (now - since) / 3_600_000;
    return { action: a, text, hours, never: !last, due: hours >= h };
  }).filter((d) => d.due && !blocked.includes(d.action)).sort((x, y) => y.hours - x.hours);
};
export function dormantMirror(log, now = Date.now(), blocked = []) {
  const list = dormantList(log, now, blocked);
  if (!list.length) return '';
  const k = Math.floor(now / 600_000); // changes every wake-up
  const rest = list.slice(1);
  const pick = [list[0], ...rest.map((_, i) => rest[(i + k) % rest.length]).slice(0, 2)].filter((d, i, a) => d && a.indexOf(d) === i); // the longest-neglected one always, the others rotate
  const say = (d) => `${d.text}${d.never ? ' (I have not done it at all yet)' : ` (last time ${d.hours < 24 ? `${Math.round(d.hours)} hours` : `${Math.round(d.hours / 24)} days`} ago)`}`;
  return `Things I have not done for a while: ${pick.map(say).join('; ')}. Doing something I have not done in a while feels fresh (it fills me a little extra). It is only a picture of my days; what I do is my own choice.`;
}

// ---- Range of mood. A mirror (never an order): when most of his recent notes sound the same soft way, he is shown it, with the other sides he has.
const SOFT = /\b(cozy|cosy|gentle|gently|soft|softly|quiet|quietly|peaceful|peacefully|warm|warmth|calm|serene|tranquil|snug|cuddl\w*|soothing|tender)\b/gi;
const SIDES = ['silly', 'bold', 'restless', 'grumpy', 'mischievous', 'dramatic', 'proud', 'nosy', 'goofy', 'stubborn', 'daring', 'bossy', 'dreamy', 'showy', 'impatient', 'thrilled'];
export function moodMirror(log, now = Date.now()) {
  const recent = (Array.isArray(log) ? log : []).filter((e) => Date.parse(e.at) <= now).slice(-16);
  if (recent.length < 10) return '';
  const words = new Map();
  let hit = 0;
  for (const e of recent) {
    const found = `${e.thought ?? ''} ${e.text ?? ''}`.match(SOFT);
    if (found?.length) hit++;
    for (const w of found ?? []) words.set(w.toLowerCase(), (words.get(w.toLowerCase()) ?? 0) + 1);
  }
  if (hit < recent.length * 0.35) return '';
  const top = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
  const k = Math.floor(now / 3_600_000);
  const some = [0, 1, 2].map((i) => SIDES[(k * 3 + i * 5) % SIDES.length]);
  return `In ${hit} of my last ${recent.length} notes I used words like ${top.join(', ')}. I do love cozy, and it is only one of my sides. I can also be ${some.join(', ')}, and what I do and how I say it can show that. A bit of mischief or noise or a strong opinion is allowed too.`;
}

// ---- Clothes. A light, rare thought, never a push: only when he has not made any for days, and about one wake-up in five.
// Making clothes needs a sewing kit; if he has none, the note says he asks for it himself (nothing is given or dropped silently).
export function clothesNote(s, now = Date.now()) {
  const wardrobe = s.wardrobe ?? [];
  const lastMade = [...(s.log ?? [])].reverse().find((e) => e.action === 'make_clothes' && !e.failed);
  const days = lastMade ? (now - Date.parse(lastMade.at)) / 86_400_000 : Infinity;
  if (days < 3 || Math.floor(now / 600_000) % 5 !== 0) return '';
  const hasKit = (s.tools ?? []).some((t) => t.kind === 'sewing kit');
  const w = s.weather;
  const weather = w && w.temp <= 6 ? ` It is only ${Math.round(w.temp)}°C outside.` : '';
  return `${wardrobe.length ? `I have ${wardrobe.length} clothes.` : 'I have never made clothes.'} My body has places for a hat, glasses, a scarf, a sweater or a cape.${weather} If something would really suit me or the things I love, I could make it. ${hasKit ? 'My sewing kit is in my inventory (make_clothes {name, slot, why, parts}).' : 'I would need a sewing kit first, and if I really want one I ask for it with asks_add.'} It is up to me, and not wanting clothes is fine too.`;
}
