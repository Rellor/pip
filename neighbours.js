// Notes and wishes. (The file keeps its old name: it used to be about the five neighbours in Pip's street. They moved
// away on 2026-11-23, see changes.js, and with them went the daily model call that wrote their notes, their warmth for
// him, and the prints they bought.) What is left is what the two things that took their place need. Plain code, no model.
//  - Notes: a traveller passing through leaves a note somewhere in his world (strangers.js). Once he has it, it lies
//    with his visitors (s.visitors, with npc: true and stranger: true). noteLines shows the unanswered ones to the brain,
//    and he answers one with answer_visitor.
//  - Wishes: something someone would like made, with a reward in coins (s.wishes). Today only the notice board pins
//    them (board.js, with board: true). keepWishes notices when he made one, and pays him.
import { researched } from './board.js';
const clip = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// For the brain: the unanswered notes of the made-up people of his world (the travellers), the oldest first.
export function noteLines(s) {
  return (s.visitors ?? []).filter((v) => v.npc && !v.answer).slice(0, 3).map((v) => {
    const w = (s.wishes ?? []).find((x) => x.id === v.id && x.status === 'open');
    return `[${v.id}] ${v.name || 'someone'}${v.kind === 'ask' ? ` asks${w ? ` (and would give me ${w.reward} coins for it)` : ''}` : v.kind === 'share' ? ' tells me about something' : ''}: "${v.text}"`;
  });
}

// ---- Wishes. A wish stays open for a few days. When he makes it he earns the coins (shop.js). Nobody is ever angry:
// a wish he does not take just fades. (A note on the notice board is a wish too; board.js takes it down a little sooner.)
const WISH_DAYS = 6;
const DAY_MS = 86_400_000;
const mediumOf = (text) => (/\b(game|program|app|simulat)/i.test(text) ? ['make_app', 'update_app'] : /\b(song|tune|melody)\b/i.test(text) ? ['record_song'] : /\b(draw|drawing|picture|sketch|paint)/i.test(text) ? ['draw'] : /\b(cook|bake|soup|bread|cake|dish)\b/i.test(text) ? ['cook'] : ['decorate', 'draw', 'make_clothes', 'make_app', 'update_app', 'change_thing', 'record_song', 'cook']);
const WISH_STOP = new Set('the a an of at in on my for and with from little small tiny big new nice drawing picture sketch game song thing something one some your you me could can please would'.split(' '));
const keyWords = (t) => String(t ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).map((w) => w.replace(/s$/, '')).filter((w) => w.length > 2 && !WISH_STOP.has(w));
const BOARD_SKIP = new Set(['about', 'from', 'printer', 'program', 'that', 'draw', 'catching', 'jumping']);
const plain = (t) => String(t ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // a name as plain letters inside a pattern
// Open wishes (old ones fade quietly).
export function openWishes(s, now = Date.now()) {
  for (const w of s.wishes ?? []) if (w.status === 'open' && now - Date.parse(w.at) > WISH_DAYS * DAY_MS) w.status = 'gone';
  return (s.wishes ?? []).filter((w) => w.status === 'open');
}
// He answered a note. A traveller's note asks for nothing, so nothing happens here (what he learns from it: strangers.js).
// When a note of someone else in his world asked for something (a wish with the same id), "yes" is a promise.
export function noteAnswer(s, v) {
  if (!v?.npc || v.stranger) return;
  const w = (s.wishes ?? []).find((x) => x.id === v.id && x.status === 'open');
  if (w) w.said = !/\b(no|sorry|cannot|can't|not now|maybe later)\b/i.test(String(v.answer ?? ''));
}
// After a wake-up: did he make what someone wished for? entries = this wake-up's log entries. Returns what happened, in his words.
export function keepWishes(s, entries, now = Date.now()) {
  const lines = [];
  for (const e of entries.filter((x) => !x.failed && !x.fallback)) {
    const text = `${e.name ?? ''} ${e.what ?? ''} ${e.why ?? ''} ${e.dish ?? ''} ${e.change ?? ''} ${e.project ?? ''}`;
    const words = new Set(keyWords(text));
    const itself = new Set(keyWords(`${e.name ?? ''} ${e.what ?? ''} ${e.dish ?? ''}`)); // what the thing IS (its name), not why he made it
    for (const w of openWishes(s, now)) {
      if (!(w.medium ?? mediumOf(w.text)).includes(e.action)) continue;
      const named = Boolean(w.from) && new RegExp(`\\bfor ${plain(w.from)}(?![a-z])`, 'i').test(text);
      if (w.board ? !keyWords(w.topic).filter((k) => !BOARD_SKIP.has(k)).every((k) => itself.has(k)) : !named && !keyWords(w.topic).some((k) => words.has(k))) continue; // a note on the board asks for one thing: all of its words ("toy train" is not any toy)
      Object.assign(w, { status: 'kept', keptAt: new Date(now).toISOString(), with: clip(e.name ?? e.dish ?? e.what, 60) });
      s.coins = (s.coins ?? 0) + w.reward;
      if (w.board) { // a note from the notice board: it comes down, and knowing how it is made pays a coin more
        const extra = researched(s, w, now) ? 1 : 0;
        s.coins += extra;
        const built = e.action === 'decorate' && e.as !== 'print_thing' ? (s.decor ?? []).findLast((d) => d.name === e.name && d.kind !== 'outside' && !d.image) : null; // a thing he built for a note goes to the square (board.js handOver): it does not stay in his room
        if (built) built.forBoard = w.topic;
        lines.push(`I made ${w.topic}, as the note on the notice board asked. I took the note down and got ${w.reward + extra} coins${extra ? ' (one more because I had looked up how it is made)' : ''}. I have ${s.coins} coins now.${built ? ' I bring it to the square: it is not mine to keep.' : ''}`);
        break;
      }
      lines.push(`I made what ${w.from || 'someone'} wished for (${w.topic}), and got ${w.reward} coins for it. I have ${s.coins} coins now.`);
      break;
    }
  }
  return lines;
}
// For the brain: wishes still open that do not hang on the notice board (a promise he made comes first). The notes on
// the board have their own lines (boardLines in board.js).
export function wishLines(s, now = Date.now()) {
  return openWishes(s, now).filter((w) => !w.board).sort((a, b) => Number(b.said) - Number(a.said)).slice(0, 3)
    .map((w) => `${w.said ? `I told ${w.from || 'someone'} I would make` : `${w.from || 'Someone'} wished for`} ${w.topic}${w.said ? '' : ' (I may, or not)'}: ${mediumOf(w.text).length <= 2 ? `with ${mediumOf(w.text)[0].replace(/_/g, ' ')}, ` : ''}${w.reward} coins when it is done.`);
}
