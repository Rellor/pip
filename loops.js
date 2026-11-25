// The loop breaker: whatever bug or habit is behind it, Pip may not choose the same move again and again while nothing
// comes of it. After 3 times in a row with no real result, that move rests for 2 hours and he hears why.
// A real result: a step that worked and is not a free "do" (a waiting step of a project counts). Plain code, no model.
export const LOOP_TRIES = 3;
export const LOOP_REST_H = 2;
const NEVER = ['tell', 'rest', 'eat']; // "do" counts too, by what he does (the same pretend step 3 times) // the free move and the needs are never put to rest

// The move he chose this time, in a few words: "work_on_project:bake a simple loaf of bread".
// Making the same kind of thing under a new name ("ceramic desk lamp", "ceramic base desk lamp") is the same choice.
const MAKERS = ['decorate', 'draw', 'make_app', 'make_clothes', 'record_song'];
const thingWord = (t) => String(t ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['for', 'the', 'and', 'with', 'base', 'small', 'little', 'tiny', 'big', 'new', 'cozy'].includes(w)).at(-1) ?? '';
export const choiceOf = (reply) => { const m = (Array.isArray(reply?.moves) ? reply.moves : [])[0]; if (!m?.move) return null; const d = m.details ?? {}; const name = d.title ?? d.name ?? d.lamp ?? d.app ?? d.query ?? d.dish ?? d.what ?? ''; return { move: String(m.move), key: `${m.move}:${MAKERS.includes(m.move) ? thingWord(name) : String(name).toLowerCase().trim().slice(0, 40)}` }; };
// Did this wake-up's steps (its log entries) really do something?
export const gotSomewhere = (entries) => entries.some((e) => !e.failed && !e.fallback && (e.action !== 'do' || e.as));

// After a wake-up: remember the choice; after LOOP_TRIES of the same with nothing to show, rest that move.
export function noteChoice(s, choice, ok, why = '', now = Date.now(), failed = false) {
  if (!choice) return null;
  s.recent ??= {};
  s.recent.choices = [...(s.recent.choices ?? []), { key: choice.key, move: choice.move, ok, ...(failed ? { failed: true } : {}), at: new Date(now).toISOString() }].slice(-10);
  const last = s.recent.choices.slice(-LOOP_TRIES);
  const inARow = last.length >= LOOP_TRIES && last.every((c) => c.key === choice.key && !c.ok);
  const same = s.recent.choices.filter((c) => c.key === choice.key); // the same thing again and again, with other moves in between
  const onAndOff = same.length >= LOOP_TRIES && same.every((c) => !c.ok);
  const failedTwice = failed && same.filter((c) => c.failed).length >= 2 && same.slice(-2).every((c) => !c.ok); // research: telling a small model "do not repeat" does not work, and seeing a failed action makes it MORE likely to repeat it; taking the option away works. So the same thing failing twice rests at once
  if (NEVER.includes(choice.move) || !(inARow || onAndOff || failedTwice)) return null;
  s.resting = { move: choice.move, key: choice.key, until: new Date(now + LOOP_REST_H * 3_600_000).toISOString(), why: String(why || 'nothing came of it').slice(0, 160) };
  s.recent.choices = [];
  return s.resting;
}
export const restingMove = (s, now = Date.now()) => (s.resting && Date.parse(s.resting.until) > now && s.resting.move !== 'do' ? s.resting.move : null); // "do" stays offered (it is his free move): only the same thing rests
// A free "do" of the very thing he looped on is left out while it rests (he does it for real, or something else).
export function dropRestingDo(s, steps, now = Date.now()) {
  const r = s.resting && Date.parse(s.resting.until) > now && s.resting.move === 'do' ? s.resting.key : null;
  if (!r) return steps;
  const same = (st) => st.action === 'do' && !st.as && choiceOf({ moves: [{ move: 'do', details: st.details }] })?.key === r;
  return steps.filter((st) => !same(st));
}
export function restingLines(s, now = Date.now()) {
  if (!restingMove(s, now)) return [];
  return [`I chose "${s.resting.move.replace(/_/g, ' ')}" ${LOOP_TRIES} times in a row and nothing came of it (${s.resting.why}). I leave it for a while and do something else.`];
}

// Wanting something different: after hours of the same kind of thing (6 of his last 8 moves making things, say), that
// kind rests for an hour and he feels like something else. Like a person who has worked all afternoon and wants a walk.
// Eating, resting and the garden never tire him (they are needs).
export const SAME_KIND_N = 6;
export const SAME_KIND_OF = 8;
export const TIRED_H = 1;
const NEEDS_KINDS = ['food', 'rest', 'garden', 'walk'];
const KIND_WORDS = { make: 'making things', learn: 'reading and looking things up', music: 'making music', room: 'moving things around my room', play: 'small things that make nothing', look: 'taking pictures', write: 'writing', people: 'talking', clothes: 'my clothes' };
export function tiredOf(s, now = Date.now()) {
  if (s.tired && Date.parse(s.tired.until) > now) return s.tired.kind;
  const last = (s.recent?.moves ?? []).slice(-SAME_KIND_OF);
  if (last.length < SAME_KIND_OF) return null;
  const count = {};
  for (const m of last) count[m.kind] = (count[m.kind] ?? 0) + 1;
  const [kind, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!kind || n < SAME_KIND_N || NEEDS_KINDS.includes(kind)) return null;
  s.tired = { kind, until: new Date(now + TIRED_H * 3_600_000).toISOString() };
  return kind;
}
export function tiredLines(s, now = Date.now()) {
  const k = s.tired && Date.parse(s.tired.until) > now ? s.tired.kind : null;
  return k ? [`I have been ${KIND_WORDS[k] ?? k} for hours. My head wants something different for a while: I go outside, read or look something up, play music, care for my garden, write in my diary, cook, or talk to someone. I come back to it later with fresh eyes.`] : [];
}
