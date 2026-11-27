// The notice board on the square. It used to hang full of orders ("Wanted: a birdhouse. 3 coins."), and he made small
// things for coins. Not any more: nobody asks Pip for anything, and nothing is paid. The board now shows what people in
// the village are up to: a kite day on the field, somebody on a unicycle, a chess board left on the bench by the pond.
// He walks there to read it (check_board), and may get an idea from it. Or not: a note is never a task.
// What he does with an idea is his own: he can build the thing and say how it is used (make_plaything), put it on his
// wants list, try it as a hobby, look it up first, or shrug.
import { noteSpark } from './curiosity.js';

const DAY = 86_400_000;
export const MAX_BOARD = 3; // notes on the board at one time
export const NOTE_DAYS = 3; // how long a note hangs
const NEW_NOTE_HOURS = 6; // about this long after the last one, a new note is pinned (while there is room)

// What people in the village do: [key, the thing it takes (or null), the hobby in a few words, the note as it hangs there].
export const DOINGS = [
  ['kite', 'a kite', 'flying kites', 'Kite day on the field this week. Bring one, or make one. Wind is promised.'],
  ['bike', 'a bike', 'riding a bike', 'Seen every morning: somebody rides a bike three times round the pond, and rings the bell at the ducks.'],
  ['plane', 'a model plane', 'flying model planes', 'The model plane people fly from the big field when the wind is low. They wave if you watch.'],
  ['boat', 'a small sailing boat', 'sailing toy boats', 'Boat race on the pond on Sunday. Anything that floats may start.'],
  ['ball', 'a ball', 'kicking a ball about', 'Found: a ball on the square. It is back with its owner. They say the square is good for kicking.'],
  ['skateboard', 'a skateboard', 'skateboarding', 'To whoever rattles over the square on a skateboard at dusk: nice turns.'],
  ['scooter', 'a scooter', 'riding a scooter', 'A scooter stood against the library all day. Somebody rides to their books.'],
  ['sled', 'a sled', 'sledging', 'When it snows: the hill by the field is for sleds. Until then it is just a hill.'],
  ['skates', 'a pair of skates', 'skating on the pond', 'The pond holds when it has frozen three nights. Skaters, wait for the third.'],
  ['stilts', 'a pair of stilts', 'walking on stilts', 'Someone crossed the square on stilts, very slowly, and looked over every wall.'],
  ['hoop', 'a hoop and a stick', 'rolling a hoop', 'Old game seen again: a hoop rolled all the way from the shop to the pond with a stick.'],
  ['frisbee', 'a flying disc', 'throwing a flying disc', 'A flying disc landed on the library roof. It is still there. Throw lower.'],
  ['rod', 'a fishing rod', 'fishing in the pond', 'The man with the fishing rod sat by the pond for four hours and caught nothing. He says that is the point.'],
  ['telescope', 'a telescope', 'stargazing', 'Clear nights this week. Someone sets up a telescope by the green stone after dark.'],
  ['binoculars', 'a pair of binoculars', 'bird watching', 'The bird list at the pond stands at eleven kinds. Twelfth wanted.'],
  ['swing', 'a swing', 'swinging', 'There ought to be a swing somewhere in this village. Signed: someone who misses one.'],
  ['tent', 'a tent', 'camping', 'Somebody slept in a tent on the field and says the stars are louder out there.'],
  ['gokart', 'a go-kart', 'racing a go-kart', 'Heard at dawn: a home-made cart with four wheels coming down the lane much too fast.'],
  ['unicycle', 'a unicycle', 'riding a unicycle', 'Seen on the square: someone on a unicycle. Nobody knows who.'],
  ['juggling', 'three juggling balls', 'juggling', 'Juggling practice by the notice board at noon. Dropping is allowed and expected.'],
  ['yoyo', 'a yo-yo', 'yo-yo tricks', 'The yo-yo trick called "walk the dog" was done on the square today. The dog was not impressed.'],
  ['rope', 'a skipping rope', 'rope skipping', 'Counted on the square: one hundred and four skips without a miss.'],
  ['hammock', 'a hammock', 'lying in a hammock', 'A hammock hangs between two trees by the pond. Whoever owns it is very wise.'],
  ['drum', 'a drum', 'drumming outside', 'Whoever drums by the pond in the evening: the ducks have stopped complaining.'],
  ['chess', 'a chess set', 'playing chess', 'A chess board was left on the bench by the pond, mid-game. White is winning. Please do not tidy it.'],
  ['hopscotch', null, 'hopscotch', 'Somebody chalked a hopscotch on the square, with eleven squares instead of ten. Nobody knows the rules for eleven.'],
  ['cards', 'a pack of cards', 'card games', 'Patience is a card game for one. Seen played on the library steps, with great patience.'],
  ['marbles', 'a bag of marbles', 'playing marbles', 'Marbles season. The good hollow is by the south corner of the square.'],
  ['game', null, 'making and playing computer games', 'High score list at the internet café: the top name has not changed in a year. Somebody should.'],
  ['walk', null, 'long walks', 'A walking club of one leaves from the square every afternoon and comes back with pockets full of things.'],
  ['sketch', null, 'drawing outside', 'Someone sat on the square all morning and drew every house. The library got an extra window by mistake.'],
  ['stones', null, 'skimming stones', 'Record at the pond: a stone that skipped seven times. Flat ones work best.'],
  ['garden', null, 'growing things outside', 'The first one to grow a pumpkin bigger than a chair gets to say so on this board.'],
  ['snowman', null, 'building with snow', 'When the snow comes: the square is free for snow people. Carrots at your own cost.'],
  ['whistle', null, 'whistling', 'Whoever whistles the same four notes past the shop every morning: we all hum it now. Thanks.'],
  ['map', null, 'mapping the village', 'Nobody has ever drawn a proper map of this village. The pond is the easy part.'],
];
// The same board always gets the same next note (a test, and a wake-up that runs twice, tell one story).
function dice(seed) {
  let a = 0;
  for (const c of String(seed)) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// The notes hanging on the board now (old ones come down by themselves).
export function boardNotes(s, now = Date.now()) {
  s.board = (s.board ?? []).filter((n) => now - Date.parse(n.at) <= NOTE_DAYS * DAY).slice(-MAX_BOARD * 4);
  return s.board.slice(-MAX_BOARD);
}
// Called at every wake-up: pins a new note when there is room and the last one is a while ago. Returns the new note or null.
export function postNote(s, now = Date.now()) {
  const open = boardNotes(s, now);
  const last = (s.board ?? []).at(-1);
  if (open.length >= MAX_BOARD || (last && now - Date.parse(last.at) < NEW_NOTE_HOURS * 3_600_000)) return null;
  s.boardSeen = (s.boardSeen ?? []).slice(-18); // what hung there lately does not come straight back
  const pool = DOINGS.filter(([key]) => !s.boardSeen.includes(key));
  const rnd = dice(`${s.boardSeen.length}:${Math.floor(now / 3_600_000)}`);
  const [key, thing, hobby, text] = pool[Math.floor(rnd() * pool.length)];
  const note = { id: `b${Math.floor(now / 1000).toString(36)}`, key, thing, hobby, text, at: new Date(now).toISOString(), seen: false };
  s.board = [...(s.board ?? []), note];
  s.boardSeen.push(key);
  return note;
}
// He stands at the board and reads it. What is new may catch him (curiosity.js). Returns what he read, in his words.
export function readBoard(s, now = Date.now()) {
  const open = boardNotes(s, now);
  const fresh = open.filter((n) => !n.seen);
  for (const n of fresh) { n.seen = true; noteSpark(s, { topic: n.hobby, text: n.text, from: 'board' }, now); }
  s.boardReadAt = new Date(now).toISOString();
  if (!open.length) return 'I read the notice board. There is nothing on it today.';
  if (!fresh.length) return `I read the notice board again. Nothing new. Still there: "${open.at(-1).text}"`;
  return `I read the notice board. ${fresh.map((n) => `"${n.text}"`).join(' And: ')} Nobody asks me for anything. I just know a little more about what goes on here.`;
}
// Is there something on the board he has not read yet, or has he not looked for a long time?
export const boardCalls = (s, now = Date.now()) => boardNotes(s, now).some((n) => !n.seen) || now - Date.parse(s.boardReadAt ?? 0) > 20 * 3_600_000;
// For the brain: the newest notes he has read, and that an idea is his to take or leave.
export function boardLines(s, now = Date.now()) {
  return boardNotes(s, now).filter((n) => n.seen).slice(-2).map((n) => `On the notice board I read: "${n.text}" Nobody asks me for anything. If it pulls at me: ${n.thing ? `I can build ${n.thing} myself and say how I use it (make_plaything), or put it on my wants list (want). Or ` : ''}I try ${n.hobby} as a hobby (start_hobby), or look it up first.`);
}

// ---- (for neighbours.js: a wish made with knowledge)
const STOP = new Set(['the', 'and', 'for', 'from', 'with', 'about', 'small', 'little', 'tiny', 'model', 'drawing', 'game', 'program', 'that', 'printer']);
export const topicWords = (topic) => String(topic).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
export function researched(s, note, now = Date.now()) {
  return (s.log ?? []).some((e) => ['search_web', 'read_book'].includes(e.action) && !e.failed && now - Date.parse(e.at) < 3 * DAY && Date.parse(e.at) >= Date.parse(note.at) && topicWords(note.topic).some((k) => `${e.query ?? ''} ${e.topic ?? ''}`.toLowerCase().includes(k)));
}
