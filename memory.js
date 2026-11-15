// Pip's memory, after the "Generative Agents" research (Park et al., 2023):
//   - a stream of memories, each with an importance from 1 to 10
//   - recall that picks the memories that matter now: recent, important and about what he is busy with
//   - reflection: now and then he looks back and writes a few insights, with the memories they come from
// No embeddings: relevance is overlap of words, which is enough for a small room.

export const MAX_MEMORIES = 60;
export const MAX_REFLECTIONS = 30;
export const MAX_INTERESTS = 15;
// Forgetting: a memory's weight starts at its importance, fades a little every day,
// grows when he recalls it, and goes to web/archive/memories.json when it gets too light.
export const FADE_PER_DAY = 0.97; // importance 5 fades out in about a month, importance 9 in about two
export const FORGET_BELOW = 2;
export const RECALL_BOOST = 0.5;
const RECALL_GAP_H = 6; // a memory is only boosted once per 6 hours, so the same few do not always win
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
  s.memories = (Array.isArray(s.memories) ? s.memories : []).map((m, i) => {
    const importance = imp(m.importance);
    const out = { id: m.id ?? `m${Date.parse(m.at) || i}x${i}`, at: m.at, text: m.text, importance, kind: m.kind ?? 'memory', weight: Number.isFinite(m.weight) ? m.weight : importance, lastUsed: m.lastUsed ?? m.at };
    if (m.pinned) out.pinned = true;
    return out;
  });
  s.memoryFadeAt ??= new Date().toISOString();
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
  const m = { id: `m${Date.now().toString(36)}${s.memories.length}`, at, text: t, importance: imp(importance), kind, weight: imp(importance), lastUsed: at };
  s.memories.push(m);
  if (s.memories.length > MAX_MEMORIES) { // too many: the lightest go to the archive list (pinned ones stay)
    const order = s.memories.filter((x) => !x.pinned && x !== m).sort((a, b) => a.weight - b.weight);
    const out = new Set(order.slice(0, s.memories.length - MAX_MEMORIES).map((x) => x.id));
    s.forgotten = [...(s.forgotten ?? []), ...s.memories.filter((x) => out.has(x.id))];
    s.memories = s.memories.filter((x) => !out.has(x.id));
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
    return { m, rec: 0.99 ** hoursSince(m.at, now), imp: (m.weight ?? m.importance) / 10, rel: w.size ? shared / Math.sqrt(w.size * Math.max(1, f.size)) : 0 };
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

// Recalling a memory keeps it alive: it gets a little heavier (at most once per 6 hours) and lastUsed is now.
export function markUsed(list, now = Date.now()) {
  for (const m of list) {
    if (m.lastUsed && hoursSince(m.lastUsed, now) < RECALL_GAP_H) continue;
    m.weight = Math.min(10, (m.weight ?? m.importance) + RECALL_BOOST);
    m.lastUsed = new Date(now).toISOString();
  }
  return list;
}

// Everything fades a little with time. Memories that get too light are forgotten: they leave his state
// and wait in s.forgotten until the loop writes them to web/archive/memories.json. Returns the forgotten ones.
export function fade(s, now = Date.now()) {
  const days = hoursSince(s.memoryFadeAt ?? new Date(now).toISOString(), now) / 24;
  if (days <= 0) return [];
  const f = FADE_PER_DAY ** days;
  for (const m of s.memories) if (!m.pinned) m.weight = Math.round((m.weight ?? m.importance) * f * 1000) / 1000;
  s.memoryFadeAt = new Date(now).toISOString();
  const gone = s.memories.filter((m) => !m.pinned && m.weight < FORGET_BELOW);
  if (!gone.length) return [];
  const ids = new Set(gone.map((m) => m.id));
  s.memories = s.memories.filter((m) => !ids.has(m.id));
  s.forgotten = [...(s.forgotten ?? []), ...gone];
  return gone;
}

// Writes s.forgotten to the archive file and empties it. Nothing is thrown away.
export async function archiveForgotten(s, file = 'web/archive/memories.json') {
  const list = s.forgotten ?? [];
  if (!list.length) return 0;
  const { readFile, writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  let have = [];
  try { have = JSON.parse(await readFile(file, 'utf8')); } catch {}
  const known = new Set(have.map((m) => m.id));
  const at = new Date().toISOString();
  for (const m of list) if (!known.has(m.id)) have.push({ ...m, forgottenAt: at });
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(have, null, 1));
  s.forgotten = [];
  return list.length;
}

// Interests: a new one that is nearly the same as one he has is not added twice (the old one moves to the end,
// as the freshest). At most MAX_INTERESTS: the oldest drop off. Returns true when the list changed.
const interestWords = (t) => new Set([...words(t)].map((w) => w.replace(/s$/, '')));
export function sameInterest(a, b) {
  const x = interestWords(a);
  const y = interestWords(b);
  if (!x.size || !y.size) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / Math.min(x.size, y.size) >= 0.6;
}
export function addInterest(s, text) {
  const t = clip(text, 80);
  if (!t) return false;
  s.interests ??= [];
  const i = s.interests.findIndex((x) => sameInterest(x, t));
  if (i >= 0) s.interests.push(s.interests.splice(i, 1)[0]);
  else s.interests.push(t);
  s.interests = s.interests.slice(-MAX_INTERESTS);
  return true;
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
