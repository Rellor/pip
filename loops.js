// The loop breaker: whatever bug or habit is behind it, Pip may not choose the same move again and again while nothing
// comes of it. After 3 times in a row with no real result, that move rests for 2 hours and he hears why.
// A real result: a step that worked and is not a free "do" (a waiting step of a project counts). Plain code, no model.
export const LOOP_TRIES = 3;
export const LOOP_REST_H = 2;
const NEVER = ['do', 'tell', 'rest', 'eat']; // the free move and the needs are never put to rest

// The move he chose this time, in a few words: "work_on_project:bake a simple loaf of bread".
export const choiceOf = (reply) => {
  const m = (Array.isArray(reply?.moves) ? reply.moves : [])[0];
  if (!m?.move) return null;
  const d = m.details ?? {};
  return { move: String(m.move), key: `${m.move}:${String(d.title ?? d.name ?? d.lamp ?? d.app ?? d.query ?? d.dish ?? '').toLowerCase().trim().slice(0, 40)}` };
};
// Did this wake-up's steps (its log entries) really do something?
export const gotSomewhere = (entries) => entries.some((e) => !e.failed && !e.fallback && (e.action !== 'do' || e.as));

// After a wake-up: remember the choice; after LOOP_TRIES of the same with nothing to show, rest that move.
export function noteChoice(s, choice, ok, why = '', now = Date.now()) {
  if (!choice) return null;
  s.recent ??= {};
  s.recent.choices = [...(s.recent.choices ?? []), { key: choice.key, move: choice.move, ok, at: new Date(now).toISOString() }].slice(-6);
  const last = s.recent.choices.slice(-LOOP_TRIES);
  if (NEVER.includes(choice.move) || last.length < LOOP_TRIES || last.some((c) => c.key !== choice.key || c.ok)) return null;
  s.resting = { move: choice.move, key: choice.key, until: new Date(now + LOOP_REST_H * 3_600_000).toISOString(), why: String(why || 'nothing came of it').slice(0, 160) };
  s.recent.choices = [];
  return s.resting;
}
export const restingMove = (s, now = Date.now()) => (s.resting && Date.parse(s.resting.until) > now ? s.resting.move : null);
export function restingLines(s, now = Date.now()) {
  if (!restingMove(s, now)) return [];
  return [`I chose "${s.resting.move.replace(/_/g, ' ')}" ${LOOP_TRIES} times in a row and nothing came of it (${s.resting.why}). I leave it for a while and do something else.`];
}
