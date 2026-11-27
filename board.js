// The notice board in Pip's street (like the order board in a farm game). People of the town pin a note on it: "Wanted:
// a birdhouse". Nobody has to be named and nobody needs a house for it. What is asked for is random, from a long list of
// things he can make. He walks to the board to read it (check_board); only then he knows what is asked. Then he can look
// up how such a thing is made (search_web), make it, and the note comes down and he gets his coins. A note he does not
// take simply goes away after a few days: nobody is ever cross.
// The notes are kept with the wishes (s.wishes, with board: true), so making one is noticed the same way (neighbours.js).
const DAY = 86_400_000;
export const MAX_BOARD = 3; // notes on the board at one time
export const NOTE_DAYS = 3; // how long a note hangs
const NEW_NOTE_HOURS = 5; // about this long after the last one, a new note is pinned (while there is room)

// What people ask for: [what, how he makes it, coins]. "how" is the move that counts (a print is made with print_thing,
// which is a decorate done at the workshop).
export const ORDERS = [
  // (few things to build: a room does not fill with small furniture for coins. What he does build for a note, he brings
  // to the square: it does not stay in his room. See handOver below.)
  ...['a birdhouse', 'a wind chime', 'a weather vane', 'a kite', 'a bee hotel', 'a toy train', 'a signpost', 'a scarecrow', 'a fruit bowl', 'a model lighthouse'].map((what) => [what, ['decorate'], 3]),
  ...['a cat', 'a lighthouse', 'the moon', 'a steam train', 'a sunflower', 'a hedgehog', 'a sailing boat', 'a rainy street', 'an owl', 'a bowl of fruit', 'a mountain', 'a fox in the snow', 'a kite in the sky', 'a teapot', 'a whale', 'a bicycle', 'an old tree', 'a snail', 'a market stall', 'a starry night'].map((what) => [`a drawing of ${what}`, ['draw'], 2]),
  ...['a lullaby', 'a marching tune', 'a rain song', 'a birthday song', 'a sea shanty', 'a morning song', 'a walking tune', 'a song for the first snow'].map((what) => [what, ['record_song'], 3]),
  ...['a key ring', 'a chess piece', 'a tiny dinosaur', 'a whistle', 'a small gear', 'a cookie cutter'].map((what) => [`${what} from the 3D printer`, ['decorate'], 3]),
  ...['a game about catching stars', 'a little clock program', 'a game about a jumping frog', 'a program that draws rain', 'a game about a hungry duck', 'a program that counts down to tea'].map((what) => [what, ['make_app', 'update_app'], 5]),
];
// The same board always gets the same next note (a test, and a wake-up that runs twice, tell one story).
function dice(seed) {
  let a = 0;
  for (const c of String(seed)) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const notes = (s) => (s.wishes ?? []).filter((w) => w.board);
// The notes hanging on the board now (old ones come down by themselves).
export function boardNotes(s, now = Date.now()) {
  for (const w of notes(s)) if (w.status === 'open' && now - Date.parse(w.at) > NOTE_DAYS * DAY) w.status = 'gone';
  return notes(s).filter((w) => w.status === 'open');
}
// Called at every wake-up: pins a new note when there is room and the last one is a while ago. Returns the new note or null.
export function postOrders(s, now = Date.now()) {
  const open = boardNotes(s, now);
  const last = notes(s).at(-1);
  if (open.length >= MAX_BOARD || (last && now - Date.parse(last.at) < NEW_NOTE_HOURS * 3_600_000 && open.length > 0)) return null;
  const recent = new Set(notes(s).slice(-14).map((w) => w.topic));
  const pool = ORDERS.filter(([what]) => !recent.has(what));
  const rnd = dice(`${notes(s).length}:${Math.floor(now / 3_600_000)}`);
  const [what, medium, reward] = pool[Math.floor(rnd() * pool.length)];
  const note = { id: `b${Math.floor(now / 1000).toString(36)}`, board: true, from: 'the notice board', topic: what, text: `Wanted: ${what}. ${reward} coins.`, medium, at: new Date(now).toISOString(), reward, status: 'open', said: false, seen: false };
  s.wishes = [...(s.wishes ?? []), note].slice(-40);
  return note;
}
// He stands at the board and reads it: now he knows what is asked. Returns what he read, in his words.
export function readBoard(s, now = Date.now()) {
  const open = boardNotes(s, now);
  const fresh = open.filter((w) => !w.seen);
  for (const w of open) w.seen = true;
  s.boardReadAt = new Date(now).toISOString();
  if (!open.length) return 'I read the notice board. There is nothing on it today.';
  const list = open.map((w) => `${w.topic} (${w.reward} coins)`).join(', ');
  return `I read the notice board. ${fresh.length ? `New: someone wants ${fresh.map((w) => w.topic).join(' and ')}. ` : ''}On it now: ${list}. If I make one of them, the coins are mine.`;
}
// Is there something on the board he has not read yet, or has he not looked for a long time?
export const boardCalls = (s, now = Date.now()) => boardNotes(s, now).some((w) => !w.seen) || now - Date.parse(s.boardReadAt ?? 0) > 20 * 3_600_000;
// For the brain: the notes he has read, with how to go about it (look it up first, then make it).
export function boardLines(s, now = Date.now()) {
  return boardNotes(s, now).filter((w) => w.seen).slice(0, 3).map((w) => {
    const how = w.medium.includes('draw') ? 'draw' : w.medium.includes('make_app') ? 'make_app' : w.medium.includes('record_song') ? 'record_song: I name the song so' : /3D printer/.test(w.topic) ? 'print_thing' : 'decorate: I bring it to the square, it does not stay in my room';
    const looked = (s.log ?? []).some((e) => ['search_web', 'read_book'].includes(e.action) && !e.failed && now - Date.parse(e.at) < 3 * DAY && topicWords(w.topic).some((k) => `${e.query ?? ''} ${e.topic ?? ''}`.toLowerCase().includes(k)));
    return `On the notice board someone asks for ${w.topic}: ${w.reward} coins when I make it (${how}).${looked ? ' I have looked up how it is made.' : ` I can look up how it is made first (search_web), then make it: a thing made with knowledge earns 1 coin more.`}`;
  });
}
const STOP = new Set('a an the of from in on about that game program drawing little small tiny 3d printer'.split(' '));
export const topicWords = (topic) => String(topic).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
// He made what a note asked for: did he look it up first? (Then he gets one coin more.)
export function researched(s, note, now = Date.now()) {
  return (s.log ?? []).some((e) => ['search_web', 'read_book'].includes(e.action) && !e.failed && Date.parse(e.at) >= Date.parse(note.at) - DAY && Date.parse(e.at) <= now && topicWords(note.topic).some((k) => `${e.query ?? ''} ${e.topic ?? ''}`.toLowerCase().includes(k)));
}

// ---- a thing built for a note does not stay in his room
// The thing a note on the board asks him to build (a note he has read, not a print), or null.
const isBuild = (w) => (w.medium ?? []).includes('decorate') && !/3D printer/.test(w.topic);
export const boardThing = (s, now = Date.now()) => boardNotes(s, now).find((w) => w.seen && isBuild(w))?.topic ?? null;
// Is this (what he wants to make, in words) the thing a note asks for? All of the note's own words have to be in it.
export const forBoard = (s, text, now = Date.now()) => { const words = new Set(topicWords(text)); return boardNotes(s, now).find((w) => isBuild(w) && topicWords(w.topic).length > 0 && topicWords(w.topic).every((k) => words.has(k))) ?? null; };
// Called at every wake-up: what he built for a note and has shown in his room for a moment is brought to the square.
// It leaves his room for good (it is kept in s.given, so the page can still show that he made it). Returns their names.
export const GIVEN_KEPT = 30;
export function handOver(s, now = Date.now()) {
  const going = (s.decor ?? []).filter((d) => d.forBoard && now - Date.parse(d.createdAt ?? d.at ?? 0) > 5 * 60_000);
  if (!going.length) return [];
  const ids = new Set(going.map((d) => d.id));
  for (const d of s.decor) if (ids.has(String(d.base ?? '').split('#')[0])) delete d.base; // what stood on it stays, on the floor
  s.decor = s.decor.filter((d) => !ids.has(d.id));
  s.given = [...(s.given ?? []), ...going.map((d) => ({ id: d.id, name: d.name, why: d.why ?? '', parts: d.parts ?? [], uses: d.uses ?? [], createdAt: d.createdAt ?? d.at, givenAt: new Date(now).toISOString(), for: d.forBoard }))].slice(-GIVEN_KEPT);
  return going.map((d) => d.name);
}
