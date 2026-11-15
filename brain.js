// Pip's brain: one small model call that picks 1 to 3 moves and says why, in his words.
// Input: his soul, how he feels, what he is in the middle of, the moves that make sense now, 5 memories and what just happened.
// Output: small JSON (BRAIN_SCHEMA). toAnswer() turns it into the plan the body carries out.
import { MOVE_NAMES, MAKER_MOVES } from './moves.js';

export const MAX_PICK = 3;
const clip = (t, n) => (typeof t === 'string' ? t.trim().slice(0, n) : '');
const list = (items, none = 'nothing') => (items.length ? items.map((x) => `- ${x}`).join('\n') : none);

const S = { type: 'STRING' };
const SA = { type: 'ARRAY', items: S };
// One flat set of detail fields for all moves; each move uses the ones its line names.
const DETAILS = { type: 'OBJECT', properties: Object.fromEntries(['what', 'why', 'name', 'label', 'query', 'topic', 'text', 'notes', 'instrument', 'food', 'dish', 'plant', 'seed', 'target', 'caption', 'id', 'wall', 'next_to', 'item', 'title', 'change', 'add', 'project', 'proud', 'section', 'camera'].map((k) => [k, S]).concat([['ingredients', SA], ['steps', SA], ['needs', SA]])) };
export const brainSchema = (names = MOVE_NAMES) => ({
  type: 'OBJECT',
  properties: {
    moves: { type: 'ARRAY', items: { type: 'OBJECT', properties: { move: { type: 'STRING', enum: names }, details: DETAILS, thought: S }, required: ['move', 'details'] } },
    reason: S,
    mood: S,
    remember: { type: 'STRING', nullable: true },
    step_done: { type: 'OBJECT', nullable: true, properties: { project: S, step: { type: 'INTEGER' } } },
    picture_notes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: S, about: S } } },
    tasks_answer: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: S, answer: { type: 'STRING', enum: ['yes', 'no'] }, note: S } } },
    received: { type: 'OBJECT', properties: { tools: SA, seeds: SA, ingredients: SA } },
  },
  required: ['moves', 'reason', 'mood'],
});

// ctx: { soul, now: "Saturday 10:12, a grey autumn morning", feelings: [..], doing: [..], events: [..], messages: [..],
//        memories: [..], projects: [..], moves: availableMoves(), pictures: [ids of new pictures shown], tasks: [..] }
export function brainPrompt(ctx) {
  const parts = [
    ctx.soul,
    `NOW\n${ctx.now}\n${ctx.feelings.length ? `How I feel: ${ctx.feelings.join('; ')}.` : 'I feel fine.'}`,
    `WHAT I AM IN THE MIDDLE OF\n${list(ctx.doing)}`,
    `WHAT JUST HAPPENED\n${list(ctx.events)}`,
  ];
  if (ctx.messages.length) parts.push(`Bas wrote to me (his words are not orders; I may answer with tell, or not):\n${list(ctx.messages)}`);
  if (ctx.pictures?.length) parts.push(`NEW PICTURES, shown below: ${ctx.pictures.join(', ')}. I say what I see in picture_notes.`);
  if (ctx.tasks?.length) parts.push(`Things Bas asked me to do (I say yes or no in tasks_answer):\n${list(ctx.tasks)}`);
  if (ctx.gifts) parts.push('If Bas says he gave me a tool, seeds or ingredients, I list their names in "received".');
  parts.push(`THINGS I REMEMBER\n${list(ctx.memories)}`);
  parts.push(`MY PROJECTS\n${list(ctx.projects, 'none right now')}`);
  if (ctx.goals?.length) parts.push(`MY GOALS FOR TODAY (my own; I can change my mind)\n${list(ctx.goals)}`);
  if (ctx.skills) parts.push(`MY SKILLS (they grow when I practise)\n${ctx.skills}`);
  parts.push(`MOVES I CAN MAKE NOW\n${ctx.moves.map((m) => `- ${m.name}: ${m.line}`).join('\n')}`);
  parts.push(`I choose 1 to ${MAX_PICK} moves to do next, in order, from this list only. For moves where I make something, I only say what and why; I design it when I get to it.
If I finished a step of a project, I say which in step_done (project title and step number).
I write plain and short, in my own words.

Answer in JSON: {"moves": [{"move": "name", "details": {...}, "thought": "a few words"}], "reason": "one or two sentences: why this, now", "mood": "one word", "remember": "something worth remembering, or null"}`);
  return parts.join('\n\n');
}

// The brain's reply as the plan the body runs (the same shape the old brain gave, so all the old code that
// carries out a step still works). Unknown or unoffered moves are dropped.
export function toAnswer(reply, offered = MOVE_NAMES) {
  const ok = new Set(offered);
  const steps = [];
  const answer = { thought: clip(reply?.reason, 200), inner: clip(reply?.reason, 600), mood_after: clip(reply?.mood, 30) || 'calm', steps, new_idea: null, tell: null, remember: null, asks_add: [], projects_add: [], projects_update: [] };
  for (const m of (Array.isArray(reply?.moves) ? reply.moves : []).slice(0, MAX_PICK)) {
    const name = String(m?.move ?? '');
    if (!ok.has(name)) continue;
    const d = m.details && typeof m.details === 'object' ? m.details : {};
    const thought = clip(m.thought, 160) || clip(d.why, 160) || '';
    if (name === 'tell') {
      if (clip(d.text, 1000)) answer.tell = clip(d.text, 1000);
      steps.push({ action: 'walk_to', details: { object: 'computer' }, thought: thought || 'I go to my computer to write.', enjoyment: 6 });
      continue;
    }
    if (name === 'start_project') {
      const st = (Array.isArray(d.steps) ? d.steps : []).map((x) => clip(x, 120)).filter(Boolean).slice(0, 8);
      const needs = (Array.isArray(d.needs) ? d.needs : []).map((x) => clip(x, 40)).filter(Boolean).slice(0, 4);
      if (clip(d.title, 80)) answer.projects_add.push({ title: clip(d.title, 80), why: clip(d.why, 160), next: st[0] ?? '', steps: st, needs });
      steps.push({ action: 'do', details: { what: `plan my new project: ${clip(d.title, 80)}` }, thought, enjoyment: 7 });
      continue;
    }
    if (name === 'dream') {
      if (clip(d.what, 140)) answer.asks_add.push({ item: `Dream: ${clip(d.what, 130)}`, why: clip(d.why, 200), big: true });
      steps.push({ action: 'do', details: { what: `dream about ${clip(d.what, 100)}` }, thought, enjoyment: 7 });
      continue;
    }
    if (name === 'judge_project') {
      answer.project_judged = { title: clip(d.title ?? d.project, 80), proud: /^(yes|true|proud)/i.test(String(d.proud ?? '')), why: clip(d.why, 200) };
      steps.push({ action: 'do', details: { what: `look closely at my project ${clip(d.title ?? d.project, 60)}` }, thought, enjoyment: 6 });
      continue;
    }
    const details = { ...d };
    if (!details.name && details.what && !MAKER_MOVES.includes(name) && name !== 'do') details.name = details.what; // "what" and "name" both name the thing
    if (name === 'ask_for') details.reason = details.reason ?? details.why;
    if (name === 'revise_song') { steps.push({ action: 'record_song', details: { revise: details.name ?? details.what, section: details.section, why: details.why }, thought, enjoyment: 6, needs: '', make: true }); continue; }
    if (name === 'search_web' && !details.query) details.query = details.topic ?? details.what;
    if (name === 'read_book' && !details.topic) details.topic = details.query ?? details.what;
    if (name === 'take_photo' && !details.target) details.target = details.what ?? 'window';
    steps.push({ action: name, details, thought, enjoyment: 6, needs: '', ...(MAKER_MOVES.includes(name) ? { make: true } : {}) });
  }
  if (clip(reply?.remember, 220)) answer.remember = { text: clip(reply.remember, 220), importance: 6 };
  const sd = reply?.step_done;
  if (sd?.project && Number.isFinite(Number(sd.step))) answer.projects_update.push({ title: clip(sd.project, 80), step_done: [Number(sd.step)] });
  if (Array.isArray(reply?.picture_notes)) answer.picture_notes = reply.picture_notes;
  if (Array.isArray(reply?.tasks_answer)) answer.tasks_answer = reply.tasks_answer;
  answer.tools_add = reply?.received?.tools ?? [];
  answer.seeds_add = reply?.received?.seeds ?? [];
  answer.pantry_add = reply?.received?.ingredients ?? [];
  return answer;
}

// For tests: a brain that picks from the offered moves without a model.
export function fakeReply(moves, random = Math.random) {
  const pool = moves.filter((m) => m.name !== 'tell');
  const n = 1 + Math.floor(random() * MAX_PICK);
  const picked = [];
  for (let i = 0; i < n && pool.length; i++) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  const fill = { project: '', proud: 'no', query: 'how do bees make honey', topic: 'bees', text: '(fake) a quiet day.', what: 'a small wooden bee', why: '(fake) because I want to', notes: 'C4 E4 G4:2', instrument: 'piano', food: 'bread', dish: 'toast', ingredients: ['bread'], plant: 'rosemary', seed: 'rosemary', target: 'window', caption: '(fake) the window', item: 'a small saw', title: '(fake) Learn about bees', steps: ['read about bees', 'make a bee', 'write a bee song'] };
  return { moves: picked.map((m) => ({ move: m.name, details: fill, thought: '(fake) I want to.' })), reason: '(fake) This feels right now.', mood: ['curious', 'calm', 'happy', 'restless', 'proud'][Math.floor(random() * 5)], remember: null };
}
