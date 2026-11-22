// Pip's neighbours: a few made-up people in his street, each with interests of their own. Pino gets his best ideas from
// the notes thousands of people leave him; Pip has no audience, so his neighbours leave him a few notes a day. They
// comment on what he made, ask him for something, or tell him about something they love, so ideas come to him that
// are neither Bas's nor his own. One light model call a day writes the day's notes; they arrive spread over the day.
// They are characters of his world, and the page says so.
export const NEIGHBOURS = [
  { name: 'Mo', who: 'a retired train driver next door', likes: ['trains', 'maps', 'old machines', 'tea'], voice: 'warm, slow, tells little stories' },
  { name: 'Lina', who: 'a teenager across the street who makes music', likes: ['synthesizers', 'electronic music', 'video games', 'neon colours'], voice: 'quick, excited, lots of ideas' },
  { name: 'Oma Jo', who: 'a grandmother with a big garden', likes: ['vegetables', 'flowers', 'knitting', 'baking bread'], voice: 'kind, practical, gives tips' },
  { name: 'Dot', who: 'a seven-year-old girl two doors down', likes: ['cats', 'drawing', 'dinosaurs', 'stars'], voice: 'short sentences, asks lots of questions' },
  { name: 'Kees', who: 'a puzzle maker who lives above the bakery', likes: ['puzzles', 'clocks', 'woodwork', 'riddles'], voice: 'dry humour, curious how things work' },
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

Write ${NOTES_PER_DAY} short notes (1 to 3 sentences each), each from a different neighbour, in their own voice:
- at least one "ask": a friendly wish he could make into a project (a drawing, a small game, a song, a thing), from that neighbour's own interests
- at least one "share": the neighbour tells him about something they love that Pip may not know yet (a real thing: a hobby, an instrument, an idea, a craft), so it can spark a new interest
- one "comment" on something he made, if he made something (honest and kind; it may say what could be better)
- maybe one "hello"
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
    .slice(0, NOTES_PER_DAY);
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
  for (const n of due) s.visitors.push({ id: n.id, at: n.at, name: `${n.from} (neighbour)`, text: n.text, answer: null, npc: true, kind: n.kind, topic: n.topic });
  s.visitors = s.visitors.slice(-40);
  return due;
}

// For the brain: the unanswered notes, the way Pino's sorter puts them: asks first, then new things, then comments.
const ORDER = { ask: 0, share: 1, comment: 2, hello: 3 };
export function neighbourLines(s) {
  return (s.visitors ?? []).filter((v) => v.npc && !v.answer).sort((a, b) => (ORDER[a.kind] ?? 3) - (ORDER[b.kind] ?? 3)).slice(0, 3)
    .map((v) => `[${v.id}] ${v.name.replace(' (neighbour)', '')}${v.kind === 'ask' ? ' asks' : v.kind === 'share' ? ' tells me about something' : v.kind === 'comment' ? ' says about my work' : ''}: "${v.text}"`);
}
