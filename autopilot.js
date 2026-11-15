// Autopilot: most ticks need no model call. Pip carries on with the moves he already chose.
// The brain is woken only when: his queued plan is done, Bas wrote, something new happened
// (a gift, a finished project, a new task, a failed move), he just woke up, or 30 minutes passed without a decision.
export const DECIDE_EVERY_MIN = 30;

export function ensurePlan(s) {
  s.plan ??= {};
  s.plan.queue = Array.isArray(s.plan.queue) ? s.plan.queue : [];
  s.plan.decidedAt ??= null;
  s.plan.seen ??= null;
  s.plan.lastFail ??= null;
  s.plan.unread ??= 0;
}

// Counts of things that matter, so code can see when something new happened.
export function snapshot(s) {
  return {
    tools: (s.tools ?? []).length,
    gifts: (s.pictures ?? []).filter((p) => p.by !== 'pip').length,
    asksDone: (s.asks ?? []).filter((a) => a.status === 'done').length,
    projectsDone: (s.projects ?? []).filter((p) => p.status === 'done').length,
    tasks: (s.tasks ?? []).filter((t) => t.status === 'open').length,
    seeds: (s.garden?.seeds ?? []).reduce((a, x) => a + (x.qty ?? 0), 0),
    visitors: (s.visitors ?? []).length,
  };
}

const GOT = { tools: 'I got a new tool', gifts: 'I was given a picture', asksDone: 'Bas did something I asked for', projectsDone: 'I finished a project', tasks: 'Bas asked me to do something', seeds: 'I got new seeds', visitors: 'a visitor left me a message' };

// Why the brain should think now. Empty means: autopilot.
export function wakeReasons(s, { unread = 0, woke = false, now = Date.now() } = {}) {
  ensurePlan(s);
  const why = [];
  if (woke) why.push('I just woke up');
  if (unread > 0) why.push('Bas wrote to me');
  if (!s.plan.queue.length) why.push('I finished what I planned');
  const was = s.plan.seen;
  const is = snapshot(s);
  if (was) for (const k of Object.keys(GOT)) if ((is[k] ?? 0) > (was[k] ?? 0)) why.push(GOT[k]);
  if (s.plan.lastFail && Date.parse(s.plan.lastFail.at) >= Date.parse(s.plan.decidedAt ?? 0)) why.push(`something did not work: ${s.plan.lastFail.why}`);
  if (!s.plan.decidedAt || now - Date.parse(s.plan.decidedAt) >= DECIDE_EVERY_MIN * 60_000) why.push(`${DECIDE_EVERY_MIN} minutes passed`);
  return [...new Set(why)];
}

// The brain decided: remember when, what was there, and queue the moves after the first.
export function decided(s, steps, now = Date.now()) {
  ensurePlan(s);
  s.plan.decidedAt = new Date(now).toISOString();
  s.plan.seen = snapshot(s);
  s.plan.lastFail = null;
  const real = steps.filter((x) => x.action !== 'walk_to');
  const first = steps.slice(0, Math.max(1, steps.findIndex((x) => x === real[0]) + 1));
  s.plan.queue = steps.slice(first.length);
  return first;
}

// The next queued move (with a walk in front of it, when there is one). Null when the queue is empty.
export function nextQueued(s) {
  ensurePlan(s);
  if (!s.plan.queue.length) return null;
  const out = [];
  while (s.plan.queue.length) {
    const st = s.plan.queue.shift();
    out.push(st);
    if (st.action !== 'walk_to') break;
  }
  return out;
}

// When there is no model at all (quota used up): plain needs first, then a quiet habit. No model call.
export function fallbackSteps(s, moves) {
  const has = (n) => moves.some((m) => m.name === n);
  const food = (s.pantry ?? []).find((p) => p.qty > 0);
  if (s.fullness <= 4 && has('harvest')) return [{ action: 'harvest', details: {}, thought: 'I am hungry. Let me pick something.', enjoyment: 6 }];
  if (s.fullness <= 4 && has('eat') && food) return [{ action: 'eat', details: { food: food.name }, thought: 'I am hungry.', enjoyment: 6 }];
  if (s.energy <= 3) return [{ action: 'rest', details: {}, thought: 'I am tired. I rest a while.', enjoyment: 6 }];
  if (has('water')) return [{ action: 'water', details: {}, thought: 'My plants look dry.', enjoyment: 6 }];
  const quiet = [
    { action: 'play_piano', details: { notes: 'C4 E4 G4 E4 C4:2', instrument: 'voice' }, thought: 'I hum a little tune while I think.' },
    { action: 'do', details: { what: 'look out of the window for a while' }, thought: 'I watch the sky for a bit.' },
    { action: 'do', details: { what: 'say hello to my plants through the glass' }, thought: 'Hello, little plants.' },
  ];
  const can = quiet.filter((q) => q.action !== 'play_piano' || has('play_piano'));
  return [{ ...can[Math.floor(Math.random() * can.length)], enjoyment: 5 }];
}
