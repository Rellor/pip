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
    const v = p.versions.length ? `, I made v${p.versions.length}` : '';
    const note = p.notes.at(-1)?.text ? `, to improve: ${p.notes.at(-1).text}` : '';
    const wait = untouchedDays(p, now) >= 1 ? ` (I have not touched it for ${Math.floor(untouchedDays(p, now))} day${untouchedDays(p, now) >= 2 ? 's' : ''})` : '';
    const needs = p.needs.length ? `, needs: ${p.needs.join(', ')}` : '';
    return `"${p.title}"${v}${note}${needs}. Next: ${p.nextStep || p.next || '?'}${steps ? ` [${steps}]` : ''}${wait}`;
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
