// Projects with depth: versions (v1, v2, ...), notes on what to improve, a next step, and tools they need.
// A project is only done when he says he is proud of it. Unfinished ones wait, and he is reminded of them days later.
const clip = (t, n) => (typeof t === 'string' ? t.trim().slice(0, n) : '');
const same = (a, b) => { const x = String(a ?? '').toLowerCase(); const y = String(b ?? '').toLowerCase(); return !!x && !!y && (x.includes(y) || y.includes(x)); };
const DAY = 86_400_000;

export function ensureProjects(s) {
  s.projects ??= [];
  for (const p of s.projects) {
    p.versions ??= [];
    p.notes ??= [];
    p.needs ??= [];
    p.nextStep ??= p.next ?? '';
  }
}
export const findProject = (s, title) => (s.projects ?? []).find((p) => p.status === 'working' && same(p.title, title)) ?? null;

// Something he made for a project becomes its next version.
export function addVersion(s, title, { kind, name, ref, at = new Date().toISOString() }) {
  const p = findProject(s, title);
  if (!p) return null;
  const v = { v: p.versions.length + 1, kind, name: clip(name, 80), ref: ref ?? null, at };
  p.versions.push(v);
  p.updatedAt = at;
  return { project: p.title, v: v.v };
}

// He says whether he is proud of it. Proud: done. Not proud: a note on what to improve, and it stays open.
export function judgeProject(s, title, { proud, why }, at = new Date().toISOString()) {
  const p = findProject(s, title);
  if (!p) return null;
  const steps = p.steps ?? [];
  const open = steps.filter((x) => !x.done).length;
  if (proud && steps.length && open > steps.length / 2) { // "good enough" needs most of the plan done: a stove alone is not baked bread
    const note = `I want to do more of my steps first (${steps.length - open} of ${steps.length} done)`;
    p.notes = [...p.notes, { at, text: note }].slice(-6);
    p.updatedAt = at;
    return { done: false, project: p.title, note };
  }
  if (proud && p.versions.length) {
    Object.assign(p, { status: 'done', proud: true, proudOf: clip(why, 200), doneAt: at, updatedAt: at });
    return { done: true, project: p.title };
  }
  const note = clip(why, 200) || 'it is not good enough yet';
  p.notes = [...p.notes, { at, text: note }].slice(-6);
  p.nextStep = p.versions.length ? `make v${p.versions.length + 1}: ${note}` : p.nextStep;
  p.next = p.nextStep;
  p.updatedAt = at;
  return { done: false, project: p.title, note };
}

export const untouchedDays = (p, now = Date.now()) => (now - Date.parse(p.updatedAt ?? p.since ?? now)) / DAY;

// For the brain: each open project in one line, and a nudge for the ones left waiting.
export function projectLines(s, now = Date.now()) {
  ensureProjects(s);
  return s.projects.filter((p) => p.status === 'working').map((p) => {
    const steps = (p.steps ?? []).map((x, i) => `${i + 1}. ${x.text}${x.done ? ' ✓' : ''}`).join('; ');
    const how = p.stuck?.n >= 2 && p.stuck.text === (p.steps ?? []).find((x) => !x.done)?.text ? ' (this step did not work twice: I write my steps again with plan_project, in other words)' : (p.steps ?? []).some((x) => !x.done) ? ' (work_on_project does the next step)' : '';
    const v = p.versions.length ? `, I made v${p.versions.length}` : '';
    const note = p.notes.at(-1)?.text ? `, to improve: ${p.notes.at(-1).text}` : '';
    const wait = untouchedDays(p, now) >= 1 ? ` (I have not touched it for ${Math.floor(untouchedDays(p, now))} day${untouchedDays(p, now) >= 2 ? 's' : ''})` : '';
    const needs = p.needs.length ? `, needs: ${p.needs.join(', ')}` : '';
    const next = (p.steps ?? []).length ? p.nextStep || p.next || (p.steps.find((x) => !x.done)?.text ?? '?') : 'no steps yet, so I plan it first with the plan_project move (and give the steps)';
    return `"${p.title}"${v}${note}${needs}. Next: ${next}${how}${steps ? ` [${steps}]` : ''}${wait}`;
  });
}

// A project that needs a tool he does not have, after he looked into how to do it: a reason to ask.
export function missingForProject(s, hasTool) {
  ensureProjects(s);
  for (const p of s.projects.filter((x) => x.status === 'working')) {
    const missing = p.needs.find((n) => !hasTool(n));
    if (!missing) continue;
    const researched = (s.log ?? []).some((e) => ['search_web', 'read_book'].includes(e.action) && !e.failed && Date.parse(e.at) >= Date.parse(p.since ?? 0));
    if (researched) return { project: p.title, tool: missing };
  }
  return null;
}

// ---- Working on a project: Pip only says which project; the game takes its next step and does it the right way.
// The step's words decide the move (look up → search, mix flour → cook, paint → draw, record a melody → record a song,
// build/make → decorate...). The step is ticked off when that move really works. Waiting ("let the dough rise") is time
// passing: it is done at once.
const ROUTES = [
  ['wait', /\b(let (it|the \w+) (rise|rest|dry|cool|set|soak|grow)|wait|leave it to)\b/i],
  ['search_web', /\b(look up|find out|research|learn|read|study|search|ask myself)\b/i],
  ['cook', /\b(knead|bake|cook|boil|fry|dough|batter)\b|\b(mix|stir|whisk)\b.*\b(flour|water|salt|sugar|eggs?|milk|butter|yeast|oats|rice|soup|tea)\b/i], // mixing paint is not cooking
  ['plant', /\b(plant|sow)\b/i],
  ['water', /\bwater\b/i],
  ['harvest', /\b(harvest|pick)\b/i],
  ['draw', /\b(draw|paint|sketch|watercolou?r|colou?rs?|colour in|color in|brush(es)?|canvas|blues?|gr[ae]ys?|shades?)\b/i],
  ['record_song', /\b(record|compose)\b|\b(write|make)\b.*\b(song|melody|tune)\b/i],
  ['play_piano', /\b(hum|sing|play|practi[cs]e|try out)\b/i],
  ['take_photo', /\b(photo|photograph|picture of)\b/i],
  ['make_app', /\b(program|app|code)\b/i],
  ['make_clothes', /\b(sew|stitch|knit|wear)\b/i],
  ['change_thing', /\b(fix|improve|smooth|polish|adjust|repaint|change|sand)\b/i],
  ['extend_thing', /\b(add|attach|extend|put .* on top)\b/i],
];
export const MAKER_ROUTES = ['decorate', 'draw', 'record_song', 'make_app', 'make_clothes', 'change_thing', 'extend_thing'];
const lastMade = (p) => [...(p.versions ?? [])].reverse().find((v) => ['decorate', 'change_thing', 'extend_thing'].includes(v.kind))?.name ?? null;

// The next step of a project as a real move. ctx: { cookDetails(text), seeds: [names], tune: "notes" }. Null if nothing is left.
export function workStep(s, title, ctx = {}) {
  ensureProjects(s);
  const p = findProject(s, title) ?? s.projects.find((x) => x.status === 'working' && (x.steps ?? []).some((y) => !y.done));
  const step = p?.steps?.find((x) => !x.done);
  if (!step) return null;
  const t = step.text;
  // The step's own words first; a step that says nothing clear ("mix them") goes by what the project is about.
  const vague = /^\s*(mix|stir|blend|combine|prepare|continue|finish|work on|keep going|try)\b/i.test(t);
  let route = (ROUTES.find(([, re]) => re.test(t)) ?? (vague ? ROUTES.find(([k, re]) => k !== 'wait' && re.test(p.title)) : null) ?? ['decorate'])[0];
  if (['change_thing', 'extend_thing'].includes(route) && !lastMade(p)) route = 'decorate'; // nothing made yet to change
  const base = { thought: `I work on my project "${p.title}": ${t}`, enjoyment: 7, needs: '', forStep: { project: p.title, text: t } };
  const project = p.title;
  const d = {
    wait: { action: 'do', as: 'work_on_project', details: { what: `${t} (for my project ${p.title})` }, waits: true },
    search_web: { action: 'search_web', details: { query: t.replace(/^(look up|find out|research|learn|read about|study|search for)\s*(about|how)?\s*/i, '') || t, project } },
    cook: { action: 'cook', details: { ...(ctx.cookDetails?.(`${t} ${p.title}`.toLowerCase()) ?? { dish: p.title, ingredients: [] }), project } },
    plant: { action: 'plant', details: { seed: (ctx.seeds ?? []).find((x) => t.toLowerCase().includes(x)) ?? ctx.seeds?.[0] ?? '' } },
    water: { action: 'water', details: {} },
    harvest: { action: 'harvest', details: {} },
    draw: { action: 'draw', details: { what: t, why: `for my project "${p.title}"`, project }, make: true },
    record_song: { action: 'record_song', details: { what: p.title, why: t, project }, make: true },
    play_piano: { action: 'play_piano', details: { notes: ctx.tune || 'C4 E4 G4:2 E4 C4:2', instrument: 'voice' } },
    take_photo: { action: 'take_photo', details: { target: lastMade(p) ?? 'window', why: t } },
    make_app: { action: 'make_app', details: { what: t, why: `for my project "${p.title}"`, project }, make: true },
    make_clothes: { action: 'make_clothes', details: { what: t, why: `for my project "${p.title}"`, project }, make: true },
    change_thing: { action: 'change_thing', details: { name: lastMade(p), change: t, project }, make: true },
    extend_thing: { action: 'extend_thing', details: { name: lastMade(p), add: t, project }, make: true },
    decorate: { action: 'decorate', details: { what: `${t} (for my project "${p.title}")`, why: p.why || `for my project "${p.title}"`, project }, make: true },
  }[route];
  return { ...base, ...d };
}
