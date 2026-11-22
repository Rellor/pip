// Pip's neighbours: a few made-up people in his street, each with interests of their own. Pino gets his best ideas from
// the notes thousands of people leave him; Pip has no audience, so his neighbours leave him a few notes a day. They
// comment on what he made, ask him for something, or tell him about something they love, so ideas come to him that
// are neither Bas's nor his own. One light model call a day writes the day's notes; they arrive spread over the day.
// They are characters of his world, and the page says so.
export const NEIGHBOURS = [
  { name: 'Mo', who: 'a retired train driver next door', likes: ['trains', 'maps', 'old machines', 'tea'], voice: 'warm, slow, tells little stories', fan: /\b(train|locomotive|rail|station|map|engine|machine|teapot|tea)\b/i },
  { name: 'Lina', who: 'a teenager across the street who makes music', likes: ['synthesizers', 'electronic music', 'video games', 'neon colours'], voice: 'quick, excited, lots of ideas', fan: /\b(synth|synthesizer|keyboard|guitar|music|robot|neon|game|headphones|radio)\b/i },
  { name: 'Oma Jo', who: 'a grandmother with a big garden', likes: ['vegetables', 'flowers', 'knitting', 'baking bread'], voice: 'kind, practical, gives tips', fan: /\b(flower|rose|tulip|sunflower|vegetable|carrot|tomato|garden|bread|loaf|yarn|wool|basil|herb|apple|pear)\b/i },
  { name: 'Dot', who: 'a seven-year-old girl two doors down', likes: ['cats', 'drawing', 'dinosaurs', 'stars'], voice: 'short sentences, asks lots of questions', fan: /\b(cat|kitten|dinosaur|star|moon|rocket|dog|rabbit|owl|bird|fish)\b/i },
  { name: 'Kees', who: 'a puzzle maker who lives above the bakery', likes: ['puzzles', 'clocks', 'woodwork', 'riddles'], voice: 'dry humour, curious how things work', fan: /\b(puzzle|clock|gear|key|lock|maze|knot|hammer|saw|chess|dice)\b/i },
];
export const NOTES_PER_DAY = 4;
const KINDS = ['comment', 'ask', 'share', 'hello'];
const clip = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const dutchDay = (now) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });

// What the neighbours can know about him today (what anyone could see from the street or his page).
export function streetView(s, now = Date.now()) {
  const day = (s.log ?? []).filter((e) => now - Date.parse(e.at) < 36 * 3_600_000 && !e.failed);
  const made = [...new Set(day.filter((e) => ['decorate', 'draw', 'make_app', 'update_app', 'record_song', 'cook', 'make_clothes'].includes(e.action)).map((e) => `${e.action === 'draw' ? 'a drawing' : e.action.includes('app') ? 'a program' : e.action === 'record_song' ? 'a song' : e.action === 'cook' ? 'a dish' : 'a thing'}: ${e.name ?? e.dish ?? ''}`))].slice(0, 5);
  const project = (s.projects ?? []).find((p) => p.status === 'working')?.title ?? null;
  const into = (s.curious?.interests ?? []).slice(0, 3).map((i) => i.topic);
  return { made, project, into };
}

export function neighbourPrompt(s, now = Date.now()) {
  const v = streetView(s, now);
  return `You write the notes that Pip's neighbours leave at his door today. Pip is a small, shy, curious creature who lives alone in a little room; he makes things (drawings, small programs and games, songs, things for his room), cooks, gardens and reads.

HIS NEIGHBOURS
${NEIGHBOURS.map((n) => `- ${n.name}: ${n.who}. Loves ${n.likes.join(', ')}. Writes: ${n.voice}.`).join('\n')}

WHAT THEY CAN SEE OF PIP
Made lately: ${v.made.join('; ') || 'nothing new'}
Working on: ${v.project ?? 'nothing in particular'}
Seems into: ${v.into.join(', ') || 'not sure yet'}
${ledgerLines(s, now).length ? `\nWHAT HAS HAPPENED BETWEEN THEM (the story goes on from here; nobody starts again from nothing)\n${ledgerLines(s, now).map((x) => `- ${x}`).join('\n')}\n` : ''}
Write ${NOTES_PER_DAY} short notes (1 to 3 sentences each), each from a different neighbour, in their own voice:
- at least one "ask": a friendly wish he could make into a project (a drawing, a small game, a song, a thing), from that neighbour's own interests
- at least one "share": the neighbour tells him about something they love that Pip may not know yet (a real thing: a hobby, an instrument, an idea, a craft), so it can spark a new interest
- one "comment" on something he made, if he made something (honest and kind; it may say what could be better)
- maybe one "hello"
- a neighbour whose wish Pip made come true says thank you, and what they did with it (kind "comment")
- a neighbour who is still waiting for a wish does not ask for a new thing
Never orders, never sad or scary things, nothing about real news. Plain words.
Answer in JSON: {"notes": [{"from": "a neighbour's name", "kind": "ask | share | comment | hello", "text": "...", "topic": "the thing it is about, in 1 to 4 words"}]}`;
}
export const neighbourSchema = { type: 'OBJECT', properties: { notes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { from: { type: 'STRING' }, kind: { type: 'STRING', enum: KINDS }, text: { type: 'STRING' }, topic: { type: 'STRING' } }, required: ['from', 'kind', 'text'] } } }, required: ['notes'] };

// For tests and when there is no model: plain notes from what they can see.
export function fakeNotes(s, now = Date.now()) {
  const v = streetView(s, now);
  return { notes: [
    { from: 'Dot', kind: 'ask', text: 'Can you draw me a cat with a big tail? Please!', topic: 'a cat drawing' },
    { from: 'Lina', kind: 'share', text: 'Have you ever heard a modular synthesizer? You patch cables and it makes the weirdest sounds.', topic: 'modular synthesizers' },
    ...(v.made[0] ? [{ from: 'Mo', kind: 'comment', text: `I saw ${v.made[0].split(': ')[1] || 'what you made'}. Lovely work, little one.`, topic: v.made[0].split(': ')[1] || 'his work' }] : []),
    { from: 'Kees', kind: 'hello', text: 'Morning, Pip. The bakery smells of cinnamon today.', topic: 'hello' },
  ] };
}

// The day's notes: cleaned, and spread over the day (10:00 to 20:00 Dutch time, roughly).
export function planNotes(s, reply, now = Date.now()) {
  const names = NEIGHBOURS.map((n) => n.name);
  const notes = (Array.isArray(reply?.notes) ? reply.notes : [])
    .map((n) => ({ from: names.find((x) => x.toLowerCase() === String(n?.from ?? '').toLowerCase()) ?? null, kind: KINDS.includes(n?.kind) ? n.kind : 'hello', text: clip(n?.text, 300), topic: clip(n?.topic, 40) }))
    .filter((n) => n.from && n.text)
    .filter((n) => n.kind !== 'ask' || !openWishes(s, now).some((w) => w.from === n.from)) // still waiting for one wish: no new one
    .slice(0, NOTES_PER_DAY);
  for (const p of Object.values(s.street?.people ?? {})) delete p.thank; // today's notes carry the thanks
  const start = now;
  const span = 9 * 3_600_000;
  s.street ??= {};
  s.street.day = dutchDay(now);
  s.street.queue = notes.map((n, i) => ({ ...n, id: `n${now.toString(36)}${i}`, at: new Date(start + ((i + 0.3) / notes.length) * span).toISOString() }));
  return s.street.queue;
}
export const needsNotes = (s, now = Date.now()) => (s.street?.day ?? '') !== dutchDay(now) && new Date(now).toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', hour12: false }) >= '09';

// Notes whose time has come land at his door (with his visitors, marked as neighbours). Returns the new ones.
export function deliverNotes(s, now = Date.now()) {
  const due = (s.street?.queue ?? []).filter((n) => Date.parse(n.at) <= now);
  if (!due.length) return [];
  s.street.queue = s.street.queue.filter((n) => !due.includes(n));
  s.visitors ??= [];
  for (const n of due) {
    s.visitors.push({ id: n.id, at: n.at, name: `${n.from} (neighbour)`, text: n.text, answer: null, npc: true, kind: n.kind, topic: n.topic });
    const p = person(s, n.from);
    Object.assign(p, { lastAt: n.at, lastKind: n.kind, lastTopic: n.topic || p.lastTopic });
    if (n.kind === 'ask' && openWishes(s, now).length < MAX_OPEN_WISHES) (s.wishes ??= []).push({ id: n.id, from: n.from, text: n.text, topic: n.topic || 'something', at: n.at, reward: rewardFor(n.text), status: 'open', said: false });
  }
  s.wishes = (s.wishes ?? []).slice(-30);
  s.visitors = s.visitors.slice(-40);
  return due;
}

// For the brain: the unanswered notes, the way Pino's sorter puts them: asks first, then new things, then comments.
const ORDER = { ask: 0, share: 1, comment: 2, hello: 3 };
export function neighbourLines(s) {
  return (s.visitors ?? []).filter((v) => v.npc && !v.answer).sort((a, b) => (ORDER[a.kind] ?? 3) - (ORDER[b.kind] ?? 3)).slice(0, 3)
    .map((v) => `[${v.id}] ${v.name.replace(' (neighbour)', '')}${v.kind === 'ask' ? ` asks${(s.wishes ?? []).find((w) => w.id === v.id && w.status === 'open') ? ` (and would give me ${(s.wishes ?? []).find((w) => w.id === v.id).reward} coins for it)` : ''}` : v.kind === 'share' ? ' tells me about something' : v.kind === 'comment' ? ' says about my work' : ''}: "${v.text}"`);
}

// ---- Friendships and wishes: what makes a street feel alive is that things go on from one day to the next.
// (Research: relationships that persist, and words that match deeds, are what kept simulated societies together.)
// Each neighbour has a warmth (0 to 10) that grows when Pip answers them and when he makes what they wished for.
// A wish ("could you draw my cat?") stays open for a few days. When he makes it, the neighbour is happy, he earns a few
// coins (shop.js), and the next day's notes say thank you. Nobody is ever angry: a wish he does not take just fades.
export const MAX_OPEN_WISHES = 3;
const WISH_DAYS = 6;
const DAY_MS = 86_400_000;
const person = (s, name) => { s.street ??= {}; s.street.people ??= {}; return (s.street.people[name] ??= { warmth: 0 }); };
export function warm(s, name, by) { const p = person(s, name); p.warmth = Math.round(Math.max(0, Math.min(10, (p.warmth ?? 0) + by)) * 10) / 10; return p; }
export const warmthWord = (w) => (w >= 8 ? 'a close friend' : w >= 5 ? 'a friend' : w >= 2 ? 'friendly' : 'a new neighbour');
const rewardFor = (text) => (/\b(game|program|app|simulat)/i.test(text) ? 5 : /\b(song|tune|melody|music)\b/i.test(text) ? 3 : /\b(draw|drawing|picture|sketch|paint)/i.test(text) ? 2 : 3);
const mediumOf = (text) => (/\b(game|program|app|simulat)/i.test(text) ? ['make_app', 'update_app'] : /\b(song|tune|melody)\b/i.test(text) ? ['record_song'] : /\b(draw|drawing|picture|sketch|paint)/i.test(text) ? ['draw'] : /\b(cook|bake|soup|bread|cake|dish)\b/i.test(text) ? ['cook'] : ['decorate', 'draw', 'make_clothes', 'make_app', 'update_app', 'change_thing', 'record_song', 'cook']);
const WISH_STOP = new Set('the a an of at in on my for and with from little small tiny big new nice drawing picture sketch game song thing something one some your you me could can please would'.split(' '));
const keyWords = (t) => String(t ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).map((w) => w.replace(/s$/, '')).filter((w) => w.length > 2 && !WISH_STOP.has(w));
// Open wishes (old ones fade quietly).
export function openWishes(s, now = Date.now()) {
  for (const w of s.wishes ?? []) if (w.status === 'open' && now - Date.parse(w.at) > WISH_DAYS * DAY_MS) w.status = 'gone';
  return (s.wishes ?? []).filter((w) => w.status === 'open');
}
// He answered a neighbour's note: they grow a little closer, and "yes" to a wish is a promise.
export function noteAnswer(s, v) {
  if (!v?.npc) return;
  const from = v.name.replace(' (neighbour)', '');
  const p = warm(s, from, 0.5);
  p.lastAnswer = clip(v.answer, 160);
  const w = (s.wishes ?? []).find((x) => x.id === v.id && x.status === 'open');
  if (w) w.said = !/\b(no|sorry|cannot|can't|not now|maybe later)\b/i.test(String(v.answer ?? ''));
}
// After a wake-up: did he make what someone wished for? entries = this wake-up's log entries. Returns what happened, in his words.
export function keepWishes(s, entries, now = Date.now()) {
  const lines = [];
  for (const e of entries.filter((x) => !x.failed && !x.fallback)) {
    const text = `${e.name ?? ''} ${e.what ?? ''} ${e.why ?? ''} ${e.dish ?? ''} ${e.change ?? ''} ${e.project ?? ''}`;
    const words = new Set(keyWords(text));
    for (const w of openWishes(s, now)) {
      if (!mediumOf(w.text).includes(e.action)) continue;
      const named = new RegExp(`\\bfor ${w.from}\\b`, 'i').test(text);
      if (!named && !keyWords(w.topic).some((k) => words.has(k))) continue;
      Object.assign(w, { status: 'kept', keptAt: new Date(now).toISOString(), with: clip(e.name ?? e.dish ?? e.what, 60) });
      s.coins = (s.coins ?? 0) + w.reward;
      const p = warm(s, w.from, 1.5);
      p.thank = { with: w.with, topic: w.topic, at: w.keptAt };
      p.kept = (p.kept ?? 0) + 1;
      lines.push(`I made what ${w.from} wished for (${w.topic}): ${w.from} is so happy, and gave me ${w.reward} coins. I have ${s.coins} coins now.`);
      break;
    }
    if (e.action === 'draw') { // a neighbour who loves the subject buys a little print (once a day each): drawing many different things pays
      const fan = NEIGHBOURS.find((n) => n.fan?.test(text) && person(s, n.name).boughtDay !== dutchDay(now));
      if (fan && !lines.some((l) => l.includes(fan.name))) {
        person(s, fan.name).boughtDay = dutchDay(now);
        warm(s, fan.name, 0.5);
        s.coins = (s.coins ?? 0) + 1;
        lines.push(`${fan.name} saw my drawing "${clip(e.name, 40)}" and bought a little print of it: 1 coin. I have ${s.coins} coins now.`);
      }
    }
  }
  return lines;
}
// For the brain: wishes still open (a promise he made comes first).
export function wishLines(s, now = Date.now()) {
  return openWishes(s, now).sort((a, b) => Number(b.said) - Number(a.said)).slice(0, 3)
    .map((w) => `${w.said ? `I told ${w.from} I would make` : `${w.from} wished for`} ${w.topic}${w.said ? '' : ' (I may, or not)'}: ${mediumOf(w.text).length <= 2 ? `with ${mediumOf(w.text)[0].replace(/_/g, ' ')}, ` : ''}${w.reward} coins when it is done.`);
}
// For the note writer: where each neighbour stands with Pip.
export function ledgerLines(s, now = Date.now()) {
  const out = [];
  for (const n of NEIGHBOURS) {
    const p = s.street?.people?.[n.name];
    if (!p) continue;
    const bits = [`${warmthWord(p.warmth ?? 0)} of Pip`];
    const w = openWishes(s, now).find((x) => x.from === n.name);
    if (p.thank) bits.push(`Pip made "${p.thank.with}" for ${n.name}, as wished (${p.thank.topic}): ${n.name} is delighted and thanks him today`);
    else if (w) bits.push(`wished for ${w.topic} ${Math.max(1, Math.round((now - Date.parse(w.at)) / DAY_MS))} day(s) ago${w.said ? ' and Pip said he would make it' : ''}; still waiting, patiently`);
    if (p.lastAnswer) bits.push(`Pip's last answer: "${p.lastAnswer}"`);
    else if (p.lastTopic) bits.push(`last wrote about ${p.lastTopic}`);
    out.push(`${n.name}: ${bits.join('. ')}.`);
  }
  return out;
}
