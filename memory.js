// Pip's memory, after the "Generative Agents" research (Park et al., 2023):
//   - a stream of memories, each with an importance from 1 to 10
//   - recall that picks the memories that matter now: recent, important and about what he is busy with
//   - reflection: now and then he looks back and writes a few insights, with the memories they come from
// No embeddings: relevance is overlap of words, which is enough for a small room.

export const MAX_MEMORIES = 150;
export const MAX_REFLECTIONS = 30;
const REFLECT_IMPORTANCE = 120; // importance added up since the last reflection
const REFLECT_MIN_GAP_H = 3;
const REFLECT_MAX_GAP_H = 12;
const REFLECT_MIN_NEW = 10;

const STOP = new Set('a an the and or of to in on at for with from by about how what why where when which who is are was were be been do does did can could would should i me my we our you your it its this that these those as into than then so not no up out just'.split(' '));
const words = (t) => new Set(String(t ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const imp = (v, d = 5) => (Number.isFinite(Number(v)) ? Math.min(10, Math.max(1, Math.round(Number(v)))) : d);
const hoursSince = (iso, now) => Math.max(0, (now - Date.parse(iso)) / 3_600_000);

export function ensureMemory(s) {
  s.memories = (Array.isArray(s.memories) ? s.memories : []).map((m, i) => ({ id: m.id ?? `m${Date.parse(m.at) || i}x${i}`, at: m.at, text: m.text, importance: imp(m.importance), kind: m.kind ?? 'memory' }));
  s.reflections ??= [];
  s.lastReflectAt ??= null;
  s.storyAt ??= null;
}

// Adds a memory. The stream keeps the best MAX_MEMORIES (important and recent ones win).
export function addMemory(s, text, importance = 5, kind = 'memory', at = new Date().toISOString()) {
  const t = clip(text, 220);
  if (!t) return null;
  const last = s.memories.slice(-12);
  if (last.some((m) => m.text.toLowerCase() === t.toLowerCase())) return null;
  const words = (x) => new Set(String(x).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const wt = words(t);
  if (wt.size >= 4 && s.memories.slice(-60).some((m) => { const o = words(m.text); const i = [...wt].filter((w) => o.has(w)).length; return i / Math.min(wt.size, o.size) >= 0.8; })) return null; // nearly the same as a recent memory
  const m = { id: `m${Date.now().toString(36)}${s.memories.length}`, at, text: t, importance: imp(importance), kind };
  s.memories.push(m);
  if (s.memories.length > MAX_MEMORIES) {
    const now = Date.now();
    const keep = new Set([...s.memories].sort((a, b) => b.importance + 6 / (1 + hoursSince(b.at, now) / 24) - (a.importance + 6 / (1 + hoursSince(a.at, now) / 24))).slice(0, MAX_MEMORIES).map((x) => x.id));
    s.memories = s.memories.filter((x) => keep.has(x.id));
  }
  return m;
}

// The k memories that matter most right now. recency fades by 1% an hour, importance is his own rating,
// relevance is how many words they share with what he is busy with. Each part is scaled 0..1 and they are added.
export function recall(s, focus, k = 8, now = Date.now()) {
  const f = words(focus);
  const rows = s.memories.map((m) => {
    const w = words(m.text);
    let shared = 0;
    for (const x of w) if (f.has(x)) shared++;
    return { m, rec: 0.99 ** hoursSince(m.at, now), imp: m.importance / 10, rel: w.size ? shared / Math.sqrt(w.size * Math.max(1, f.size)) : 0 };
  });
  const norm = (key) => {
    const v = rows.map((r) => r[key]);
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return (x) => (hi > lo ? (x - lo) / (hi - lo) : 0);
  };
  const nr = norm('rec');
  const ni = norm('imp');
  const nl = norm('rel');
  return rows
    .map((r) => ({ m: r.m, score: nr(r.rec) + ni(r.imp) + nl(r.rel) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.m)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

// Time to look back? Enough new and important things, but not too often.
export function shouldReflect(s, now = Date.now()) {
  const since = s.lastReflectAt ? Date.parse(s.lastReflectAt) : 0;
  const fresh = s.memories.filter((m) => Date.parse(m.at) > since && m.kind !== 'reflection');
  if (fresh.length < REFLECT_MIN_NEW) return false;
  const gap = since ? hoursSince(s.lastReflectAt, now) : Infinity;
  if (gap < REFLECT_MIN_GAP_H) return false;
  return fresh.reduce((a, m) => a + m.importance, 0) >= REFLECT_IMPORTANCE || gap >= REFLECT_MAX_GAP_H;
}

export function reflectionPrompt(s, bullets) {
  const since = s.lastReflectAt ? Date.parse(s.lastReflectAt) : 0;
  const recent = s.memories.filter((m) => m.kind !== 'reflection').slice(-60);
  const old = s.reflections.slice(-6);
  return `I look back on my days. These are my latest memories, each with its id and how important it was (1 to 10):
${bullets(recent.map((m) => `[${m.id}] (${m.importance}) ${m.text}`), 'nothing')}

What I realized before:
${bullets(old.map((r) => r.text), 'nothing yet')}

First I ask myself: what are the 3 most important questions I can answer about my own life, my feelings, what I love, what I want to try, or the people who look in on me? Then I answer with up to 4 insights. An insight is one honest sentence about me or my life that I could not see from one memory alone, and it names the memory ids it comes from. It must be new, not a repeat of what I realized before.

Answer in JSON: {"questions": ["...", "...", "..."], "insights": [{"text": "one sentence in the first person", "because": ["memory id", "memory id"]}]}`;
}

// Saves what he realized. Insights become memories too, so they can come back later. Returns the new reflections.
export function applyReflection(s, res, at = new Date().toISOString()) {
  const known = new Set(s.memories.map((m) => m.id));
  const made = [];
  for (const i of (Array.isArray(res?.insights) ? res.insights : []).slice(0, 4)) {
    const text = clip(i?.text, 280);
    if (!text || s.reflections.some((r) => r.text.toLowerCase() === text.toLowerCase())) continue;
    const because = (Array.isArray(i?.because) ? i.because : []).map(String).filter((id) => known.has(id)).slice(0, 6);
    const r = { id: `r${Date.now().toString(36)}${s.reflections.length}`, at, text, because };
    s.reflections.push(r);
    made.push(r);
    addMemory(s, text, 8, 'reflection', at);
  }
  s.reflections = s.reflections.slice(-MAX_REFLECTIONS);
  s.lastReflectAt = at;
  return made;
}

// The memories behind one insight, for the page.
export const evidence = (s, r) => (r.because ?? []).map((id) => s.memories.find((m) => m.id === id)?.text).filter(Boolean);
