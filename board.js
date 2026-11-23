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
  ...['a birdhouse', 'a wind chime', 'a small lantern', 'a toy train', 'a flower pot', 'a weather vane', 'a little boat', 'a kite', 'a garden gnome', 'a bird bath', 'a signpost', 'a rocking horse', 'a sundial', 'a letterbox', 'a snow globe', 'a windmill', 'a scarecrow', 'a telescope', 'a stool', 'a small table', 'a coat rack', 'a candle holder', 'a picture frame', 'a toy car', 'a wheelbarrow', 'a bee hotel', 'a garden bench', 'a wishing well', 'a street lamp', 'a toy robot', 'a drum', 'a treasure chest', 'a ladder', 'a watering can', 'a doll house', 'a spinning top', 'a hat stand', 'an umbrella stand', 'a fruit bowl', 'a model lighthouse'].map((what) => [what, ['decorate'], 3]),
  ...['a cat', 'a lighthouse', 'the moon', 'a steam train', 'a sunflower', 'a hedgehog', 'a sailing boat', 'a rainy street', 'an owl', 'a bowl of fruit', 'a mountain', 'a fox in the snow', 'a kite in the sky', 'a teapot', 'a whale', 'a bicycle', 'an old tree', 'a snail', 'a market stall', 'a starry night'].map((what) => [`a drawing of ${what}`, ['draw'], 2]),
  ...['a key ring', 'a chess piece', 'a tiny dinosaur', 'a whistle', 'a button', 'a small gear', 'a toy boat', 'a cookie cutter', 'a little owl', 'a door hook'].map((what) => [`${what} from the 3D printer`, ['decorate'], 3]),
  ...['a game about catching stars', 'a little clock program', 'a game about a jumping frog', 'a program that draws rain'].map((what) => [what, ['make_app', 'update_app'], 5]),
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
    const how = w.medium.includes('draw') ? 'draw' : w.medium.includes('make_app') ? 'make_app' : /3D printer/.test(w.topic) ? 'print_thing' : 'decorate';
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
