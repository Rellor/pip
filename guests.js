// What the people who visit his page can do with him, beyond a plain message (all of it goes through the same mailbox,
// and nothing reaches him before Bas has let it through: api/visit.js):
// - Pip can put one question to everyone who visits. They answer on his page; he reads the answers and says what he thinks.
// - Visitors can leave a poem, a short story or a book tip on a shelf in the library. He reads a piece when he is at
//   the library, and says honestly what he thinks of it.
const DAY = 86_400_000, HOUR = 3_600_000;
export const QUESTION_DAYS = 3; // a question stays open this long
export const QUESTION_GAP_H = 20; // between two questions
export const QUESTION_ANSWERS = 8; // answers kept with a question
export const QUESTIONS_KEPT = 6; // old questions he keeps
export const SHELF_KINDS = { poem: 'poem', story: 'short story', tip: 'book tip' };
export const SHELF_KEPT = 30;
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const lines = (v, n) => String(v ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n); // a poem keeps its lines

// ---- his question for the people who visit
export const openQuestion = (s, now = Date.now()) => (s.openQuestion && now - Date.parse(s.openQuestion.at) < QUESTION_DAYS * DAY ? s.openQuestion : null);
// An old question goes to the ones he asked before. Returns it when that happened now.
export function closeQuestion(s, now = Date.now(), force = false) {
  const q = s.openQuestion;
  if (!q || (!force && now - Date.parse(q.at) < QUESTION_DAYS * DAY)) return null;
  s.pastQuestions = [...(s.pastQuestions ?? []), { ...q, closedAt: new Date(now).toISOString() }].slice(-QUESTIONS_KEPT);
  s.openQuestion = null;
  return q;
}
const lastAsked = (s) => Date.parse(s.openQuestion?.at ?? (s.pastQuestions ?? []).at(-1)?.at ?? 0) || 0;
export const canAskVisitors = (s, now = Date.now()) => now - lastAsked(s) >= QUESTION_GAP_H * HOUR;
// He asks. A question with no reason is not asked (the same as with his wants). Returns { question } or { failed }.
export function askVisitors(s, question, why, now = Date.now()) {
  let text = clip(question, 180);
  const reason = clip(why, 200);
  if (text.length < 8) return { failed: 'I did not say what I want to ask' };
  if (reason.length < 4) return { failed: 'a question for my visitors needs a reason: why do I want to know?' };
  if (!canAskVisitors(s, now)) return { failed: 'I asked my visitors something not long ago: their answers come first' };
  if (!/[?]$/.test(text)) text = `${text.replace(/[.!]+$/, '')}?`;
  closeQuestion(s, now, true);
  s.openQuestion = { id: `q${now.toString(36)}`, text, why: reason, at: new Date(now).toISOString(), answers: [] };
  return { question: s.openQuestion };
}
const questionOf = (s, id) => [s.openQuestion, ...(s.pastQuestions ?? [])].find((q) => q && q.id === id) ?? null;
// A visitor's answer that Bas let through: it is kept with the question. Returns the question's words (or null: no such question).
export function takeAnswer(s, v) {
  const q = questionOf(s, v.answerTo);
  if (!q) return null;
  if (!q.answers.some((a) => a.id === v.id)) q.answers = [...q.answers, { id: clip(v.id, 40), at: v.at, name: clip(v.name, 30), text: clip(v.text, 300), reply: null }].slice(-QUESTION_ANSWERS);
  return q.text;
}

// ---- the shelf in the library
export function takeShelf(s, v) {
  if (!SHELF_KINDS[v.shelf] || !clip(v.text, 10)) return null;
  s.shelf ??= [];
  if (s.shelf.some((p) => p.id === v.id)) return null;
  const piece = { id: clip(v.id, 40), at: v.at, kind: v.shelf, title: clip(v.title, 80), name: clip(v.name, 30), text: lines(v.text, 700), readAt: null, opinion: null };
  s.shelf = [...s.shelf, piece].slice(-SHELF_KEPT);
  return piece;
}
export const unreadShelf = (s) => (s.shelf ?? []).filter((p) => !p.readAt);
export const pieceWords = (p) => `${SHELF_KINDS[p.kind] ?? 'piece'}${p.title ? ` “${p.title}”` : ''}${p.name ? ` from ${p.name}` : ''}`;
// At the library he reads the piece that has waited longest. It becomes something he can answer (like a visitor's
// message): what he says about it is shown on the shelf. Returns the piece, or null when nothing waits.
export function readShelf(s, now = Date.now()) {
  const piece = unreadShelf(s)[0];
  if (!piece) return null;
  piece.readAt = new Date(now).toISOString();
  s.visitors = [...(s.visitors ?? []), { id: piece.id, at: piece.readAt, name: piece.name, text: piece.text, shelf: piece.kind, title: piece.title, answer: null }].slice(-40);
  return piece;
}

// ---- what he said back: it is kept with the answer to his question, or with the piece on the shelf
export function noteReply(s, v) {
  if (v.shelf) { const p = (s.shelf ?? []).find((x) => x.id === v.id); if (p) { p.opinion = v.answer; p.opinionAt = v.answeredAt; } }
  if (v.answerTo) { const a = questionOf(s, v.answerTo)?.answers.find((x) => x.id === v.id); if (a) a.reply = v.answer; }
}
// How a waiting message reads in his prompt.
export function visitorLine(v) {
  const who = v.name || 'someone';
  if (v.shelf) return `[${v.id}] the ${SHELF_KINDS[v.shelf]}${v.title ? ` "${v.title}"` : ''} that ${who} left for me on the shelf in the library (I read it there; I say honestly what I think of it): "${clip(v.text, 700)}"`;
  if (v.question) return `[${v.id}] ${who} answers my question "${v.question}": "${v.text}"`;
  return `[${v.id}] ${who}: "${v.text}"`;
}
// For his prompt: his question is still open, and what waits on the shelf.
export function guestLines(s, now = Date.now()) {
  const out = [];
  const q = openQuestion(s, now);
  if (q) out.push(`My question to the people who visit my page is still open: "${q.text}" (${q.answers.length ? `${q.answers.length} answer${q.answers.length === 1 ? '' : 's'} so far` : 'no answers yet: people have to find it first'}).`);
  const waiting = unreadShelf(s);
  if (waiting.length) out.push(`On the shelf in the library ${waiting.length === 1 ? `lies a ${pieceWords(waiting[0])}` : `lie ${waiting.length} things visitors left`} for me. I read ${waiting.length === 1 ? 'it' : 'one'} when I go to the library (read_shelf).`);
  return out;
}
