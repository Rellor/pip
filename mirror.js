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
  ['record_song', 'record a song in my music studio, with several instruments mixed together', 10],
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

// ---- Photos. A picture, never an order: when his last photos were mostly of the same thing, he is shown it.
export function photoMirror(log, now = Date.now()) {
  const shots = (Array.isArray(log) ? log : []).filter((e) => e.action === 'take_photo' && !e.failed && Date.parse(e.at) <= now).slice(-4);
  if (shots.length < 3) return '';
  const counts = new Map();
  for (const e of shots) counts.set(String(e.target ?? '').toLowerCase(), (counts.get(String(e.target ?? '').toLowerCase()) ?? 0) + 1);
  const [target, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (n < 3) return '';
  return `${n} of my last ${shots.length} photos were of the same thing (${target}). Another photo of it looks the same unless something changed, and the camera does not keep one that looks just like an older photo. I can photograph something else: myself, a corner of my room, a thing I made, or the window when the light is different.`;
}

// ---- Asking. A picture, never an order. Bas answers the asks list, not chat: a wish said in a message or kept as a want does not reach it.
const OFFER = /\b(add an ask|an ask|ask for|would you like|if you (?:want|would like|like)|we could|i could|think about it)\b/i;
const NEEDS_OTHERS = /\b(studio|music room|new room|bigger room|more space|kit|supplies|instrument|picture of|book about|tool)\b/i;
const sameWords = (a, b) => { const w = (t) => new Set(String(t).toLowerCase().split(/[^a-z]+/).filter((x) => x.length > 3)); const A = w(a); return [...w(b)].some((x) => A.has(x)); };
export function askMirror(s, now = Date.now()) {
  if (Math.floor(now / 480_000) % 3 !== 0) return ''; // about one wake-up in three, so it never nags
  const asks = s.asks ?? [];
  const lines = [];
  const offer = [...(s.inbox ?? [])].reverse().find((m) => OFFER.test(m.text ?? '') && now - Date.parse(m.at) < 48 * 3_600_000 && Date.parse(m.at) <= now);
  if (offer && !asks.some((a) => Date.parse(a.since) > Date.parse(offer.at))) {
    lines.push(`Someone offered me something: "${String(offer.text).slice(0, 160)}". If I want it, an ask is how I say yes: asks_add {item, why} with what I want and why, in detail. A reply in a message does not reach their list, and they answer the asks.`);
  }
  const open = asks.filter((a) => a.status !== 'done');
  const wish = (s.wants ?? []).map((w) => w.text).find((t) => NEEDS_OTHERS.test(t) && ![...asks].some((a) => sameWords(a.item, t)));
  if (wish && !lines.length) lines.push(`I wrote down that I want "${String(wish).slice(0, 120)}", but I have not asked for anything like it. If it is something someone has to bring or build for me, asking is welcome, and I can ask with asks_add (I have ${open.length} open ask${open.length === 1 ? '' : 's'} now).`);
  return lines.join(' ');
}

// ---- The music studio. Many gentle nudges, never orders: he is shown what he could read about music and try in the studio.
// Shown on about two wake-ups in three while he has read little about music and recorded nothing today.
const MUSIC_WORDS = /\b(music|chord|chords|scale|scales|melody|harmony|rhythm|tempo|bass|mixing|mix|synth|synthesizer|reverb|compression|equaliz\w*|song|songs|beat|drums?|notes?|arpeggio|octave|key signature|producer|production|recording|instrument\w*)\b/i;
const MUSIC_TOPICS = [
  ['how chords are built', 'how do chords work in music'],
  ['what a scale is and why major sounds happy and minor sounds sad', 'major and minor scales explained'],
  ['how rhythm and tempo work', 'rhythm and time signature for beginners'],
  ['how to write a bass line', 'how to write a simple bass line'],
  ['what mixing is: volume, left and right, and reverb', 'music mixing basics for beginners'],
  ['how a synthesizer makes sound', 'how does a synthesizer work oscillator filter envelope'],
  ['what a melody and a harmony are', 'melody versus harmony explained'],
  ['how a song is built: verse, chorus and bridge', 'song structure verse chorus bridge'],
  ['what reverb and echo do to a sound', 'what is reverb in music production'],
  ['how drum patterns are made', 'basic drum beats rock and electronic'],
  ['what arpeggios are', 'what is an arpeggio in music'],
  ['how equalizing makes room for each instrument', 'what is EQ in music mixing'],
  ['how famous songs use only four chords', 'four chord songs progression I V vi IV'],
  ['how the same melody sounds different on different instruments', 'timbre of musical instruments explained'],
];
export function studioMirror(s, now = Date.now()) {
  const k = Math.floor(now / 480_000); // changes every wake-up
  if (k % 3 === 2) return '';
  const log = (Array.isArray(s.log) ? s.log : []).filter((e) => !e.failed && Date.parse(e.at) <= now && now - Date.parse(e.at) < 86_400_000);
  const reads = log.filter((e) => (e.action === 'search_web' || e.action === 'read_book') && MUSIC_WORDS.test(`${e.query ?? ''} ${e.topic ?? ''}`)).length;
  const made = log.filter((e) => e.action === 'record_song').length;
  if (reads >= 4 && made >= 2) return '';
  const done = (Array.isArray(s.log) ? s.log : []).filter((e) => e.action === 'search_web' || e.action === 'read_book').map((e) => `${e.query ?? ''} ${e.topic ?? ''}`.toLowerCase()).join(' ');
  const fresh = MUSIC_TOPICS.filter(([, q]) => !q.toLowerCase().split(' ').filter((w) => w.length > 4).every((w) => done.includes(w)));
  const pool = fresh.length >= 3 ? fresh : MUSIC_TOPICS;
  const pick = [0, 1, 2].map((i) => pool[(k * 2 + i * 5) % pool.length]).filter((x, i, a) => a.indexOf(x) === i);
  const parts = [];
  if (reads < 4) parts.push(`I have read little about music today. Things I could look up: ${pick.map(([t, q]) => `${t} (search "${q}")`).join('; ')}.`);
  if (!made) parts.push('I have not recorded anything in my music studio today. My mixing desk, drum kit and keyboard are waiting, and a recording can use up to 4 tracks at once.');
  else if (made < 2) parts.push('What I learn about music goes straight into my studio: I can try it in a new recording.');
  const hasSynth = (s.tools ?? []).some((t) => t.kind === 'synthesizer');
  parts.push(`If I want a music tool I do not have${hasSynth ? '' : ' (a synthesizer, a drum machine, a microphone)'}, I can ask for it with asks_add.`);
  return parts.join(' ');
}

// ---- Variety and choices, from what his days showed. Pictures and ideas, never orders: what he does is his own choice.
const CAT = {
  music: ['play_piano', 'record_song', 'compose'],
  make: ['decorate', 'extend_thing', 'change_thing', 'draw', 'make_app', 'make_clothes', 'make_move', 'blueprint'],
  learn: ['search_web', 'read_book'],
  tend: ['plant', 'water', 'harvest', 'cook', 'eat'],
  look: ['take_photo', 'find_picture', 'check_light'],
  write: ['write_diary'],
};
const catOf = (a) => Object.entries(CAT).find(([, l]) => l.includes(a))?.[0] ?? 'other';
const LABEL = { play_piano: 'playing music', write_diary: 'writing in my diary', use: 'using my things', compose: 'composing', do: 'small actions', cook: 'cooking', record_song: 'recording', search_web: 'looking things up', read_book: 'reading' };

// When one kind of step takes up a quarter or more of his last steps, he is shown the numbers.
export function shareMirror(log, now = Date.now()) {
  const l = (Array.isArray(log) ? log : []).filter((e) => Date.parse(e.at) <= now && !['walk_to', 'rest', 'eat'].includes(e.action) && !e.fallback).slice(-60);
  if (l.length < 30) return '';
  const counts = new Map();
  for (const e of l) counts.set(e.action, (counts.get(e.action) ?? 0) + 1);
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (n < l.length * 0.25) return '';
  const second = [...counts.entries()].sort((a, b) => b[1] - a[1])[1];
  return `In my last ${l.length} steps, ${Math.round((n / l.length) * 100)}% were ${LABEL[top] ?? top.replace(/_/g, ' ')}${second ? ` and ${Math.round((second[1] / l.length) * 100)}% were ${LABEL[second[0]] ?? second[0].replace(/_/g, ' ')}` : ''}. I can love that, and it is only part of what I can do: there are ${Object.keys(CAT).length + 2} kinds of things in my days, and most of them I did only a few times.`;
}

// Big things: when he has no big project going, a few ideas with their stages. A big thing takes several wake-ups: it is a project with steps.
const BIG = [
  ['build a tiny observatory for my room', ['sketch it and write the plan', 'build the base and the tower (decorate)', 'add the dome and a telescope (extend_thing)', 'give it a use and a song']],
  ['record a three-song album in my studio', ['write song one: chords and a melody', 'record it with 3 tracks and mix it', 'write and record songs two and three', 'name the album and listen to it all']],
  ['sew a whole outfit: a hat, a scarf and a cape', ['design the hat', 'sew the scarf', 'sew the cape', 'wear it all and take a photo']],
  ['grow a little herb garden and cook a dinner from it', ['plant four different herbs', 'water them until they are grown', 'harvest and cook a dish', 'write down the recipe']],
  ['learn one real song: chords first, then melody', ['read about its chords', 'play the chords on the piano', 'add the melody on the guitar or kalimba', 'record it with drums in the studio']],
  ['make an app that plays all my recordings', ['plan what it shows', 'write the first version (make_app)', 'update it with the song list (update_app)', 'show it to Bas']],
  ['write and draw a small story in three parts', ['write the idea in my diary', 'draw part one', 'draw parts two and three', 'hang them on the wall in order']],
];
export function bigIdeasMirror(s, now = Date.now()) {
  if (Math.floor(now / 480_000) % 2 === 1) return '';
  const working = (s.projects ?? []).filter((p) => p.status === 'working');
  if (working.length >= 2) return '';
  const k = Math.floor(now / 3_600_000);
  const pick = [0, 1].map((i) => BIG[(k + i * 3) % BIG.length]);
  return `Big things take several wake-ups, and that is how I do them: I make a project (projects_add, with its steps), do one or two steps each wake-up, and tick them off with step_done. I have ${working.length ? 'one project' : 'no project'} going. Ideas that are big enough: ${pick.map(([t, st]) => `"${t}" (${st.join(' → ')})`).join('; ')}.`;
}

// A short menu of things he could do now, from what is true in his room: only ideas, in kinds he did least lately.
export function menuMirror(s, now = Date.now()) {
  const log = (Array.isArray(s.log) ? s.log : []).filter((e) => Date.parse(e.at) <= now && !e.failed);
  const recent = log.slice(-10);
  const done = (a, h) => log.some((e) => e.action === a && now - Date.parse(e.at) < h * 3_600_000);
  const hot = new Map();
  for (const e of recent) hot.set(catOf(e.action), (hot.get(catOf(e.action)) ?? 0) + 1);
  const options = [];
  const add = (cat, text) => options.push({ cat, text });
  const proj = (s.projects ?? []).find((p) => p.status === 'working' && p.next);
  if (proj) add('make', `go on with my project "${proj.title}": ${proj.next}`);
  const owned = (s.tools ?? []).map((t) => t.kind);
  const played = new Set(log.filter((e) => e.action === 'play_piano' && e.instrument).map((e) => e.instrument));
  const fresh = ['guitar', 'violin', 'flute', 'clarinet', 'kalimba', 'harp'].find((i) => owned.includes(i) && !played.has(i));
  if (fresh) add('music', `play the ${fresh}, which I have not played yet`);
  else if (!done('record_song', 12)) add('music', 'record a song in my music studio with 2 or 3 tracks');
  if (!done('search_web', 6) && (s.interests ?? []).length) add('learn', `look up something about ${s.interests[Math.floor(now / 480_000) % s.interests.length]}`);
  if (!done('take_photo', 10)) add('look', 'take a photo of something I have not photographed');
  if (!done('walk_to', 3) || !log.some((e) => e.action === 'walk_to' && /hall|studio|front door/i.test(`${e.object ?? ''}`))) add('look', 'walk through my house: the hall, the front door, the studio, and look out of a window');
  if ((s.wardrobe ?? []).length < 2 && owned.includes('sewing kit')) add('make', 'make something to wear');
  if (!done('draw', 10)) add('make', 'draw something for a wall');
  if (!done('cook', 6)) add('tend', `cook something${(s.pantry ?? []).length ? ` (I have ${(s.pantry ?? []).filter((p) => p.qty > 0).slice(0, 3).map((p) => p.name).join(', ')})` : ''}`);
  if (!done('read_book', 8)) add('learn', 'read about how something works');
  const lastOut = (s.outbox ?? []).at(-1)?.at;
  if (!lastOut || now - Date.parse(lastOut) > 8 * 3_600_000) add('write', 'write to Bas about my day');
  if (!options.length) return '';
  const k = Math.floor(now / 480_000);
  const sorted = options.map((o, i) => ({ ...o, w: (hot.get(o.cat) ?? 0) * 2 + ((i * 7 + k) % 5) * 0.3 })).sort((a, b) => a.w - b.w);
  const picked = [];
  for (const o of sorted) if (picked.length < 5 && picked.filter((p) => p.cat === o.cat).length < 2) picked.push(o);
  return `Things I could do now, only ideas, my choice: ${picked.map((o) => o.text).join('; ')}.`;
}

// ---- His interests are many near-copies of the same search ("stellar acoustic oscillations ..." six times). He is shown the different themes.
const wset = (t) => new Set(String(t).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
export function interestThemes(list, max = 12) {
  const kept = [];
  for (const t of [...(Array.isArray(list) ? list : [])].reverse()) {
    const a = wset(t);
    if (!a.size) continue;
    const same = kept.some((k) => { const b = wset(k); const i = [...a].filter((w) => b.has(w)).length; return i / Math.min(a.size, b.size) >= 0.5; });
    if (!same) kept.push(String(t));
    if (kept.length >= max) break;
  }
  return kept;
}

// ---- Older things. He made a lot already, and it is easy to forget it: a few things from earlier, each with something he could do with it.
export function pastMirror(s, now = Date.now()) {
  if (Math.floor(now / 480_000) % 2 === 0) return '';
  const old = (s.decor ?? []).filter((d) => !d.image && d.pos && now - Date.parse(d.usedAt || d.createdAt) > 36 * 3_600_000);
  const album = (s.art ?? []).filter((a) => !(s.decor ?? []).some((d) => d.art === a.id));
  const songs = (s.decor ?? []).filter((d) => d.song?.notes?.length && !d.image);
  const dishes = (s.pantry ?? []).filter((p) => p.kind === 'dish' && p.qty > 0);
  const k = Math.floor(now / 480_000);
  const pool = [];
  for (const d of old) pool.push(`my ${d.name} (${d.song ? 'it has a song' : 'I have not used it for a while'}): I can use it, add a new use, or change it`);
  for (const a of album.slice(-6)) pool.push(`my drawing "${a.name}" is only in my album: I can hang it with place_picture`);
  for (const d of songs.slice(-4)) pool.push(`the song of my ${d.name}: I can play it on another instrument in the studio, or record it with more tracks`);
  for (const p of dishes.slice(0, 2)) pool.push(`I still have ${p.name} in my pantry: I can eat it, or cook something new from it`);
  for (const p of (s.projects ?? []).filter((x) => x.status === 'done').slice(-3)) pool.push(`my finished project "${p.title}": something that grows out of it could be my next project`);
  if (!pool.length) return '';
  const pick = [0, 1, 2].map((i) => pool[(k * 3 + i * 4) % pool.length]).filter((x, i, a) => a.indexOf(x) === i);
  return `Things from earlier I have not forgotten: ${pick.join('; ')}. I made a lot already, and what I made can be used, changed and combined before I make something new.`;
}
