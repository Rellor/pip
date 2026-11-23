// Sleep: once a night, code sums up the day (what lifted or lowered his feelings, what he did most, unfinished projects).
// One model call turns patterns seen on 5 or more days into a new "added by him" line on soul.md.
// Lines with no sign for 30 days are let go. Every change is logged in web/archive/soul-changes.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

export const PATTERN_DAYS = 3; // seen on 3 of his days: true enough to say something about who he is
export const LET_GO_DAYS = 30;
export const MAX_ADDED = 8;
export const KEEP_DAYS = 30;
const DAY = 86_400_000;
const top = (obj, n = 3, sign = 1) => Object.entries(obj ?? {}).filter(([, v]) => v * sign > 0.05).sort((a, b) => (b[1] - a[1]) * sign).slice(0, n).map(([k]) => k);
const NOT_MUCH = ['walk_to', 'rest', 'eat'];

// During the day: how much each move lifted (or lowered) joy + wonder + calm.
export function noteLift(s, actions, before, after) {
  const real = actions.filter((a) => a !== 'walk_to');
  if (!real.length || !s.today) return;
  const d = (after - before) / real.length;
  s.today.lift ??= {};
  for (const a of real) s.today.lift[a] = Math.round(((s.today.lift[a] ?? 0) + d) * 100) / 100;
}
export const feelSum = (s) => (s.joy ?? 5) + (s.wonder ?? 5) + (s.calm ?? 5);

// The day in a few lists. Each entry becomes a "sign" key like lifted:play_piano or mood:peaceful.
export function daySummary(s) {
  const t = s.today ?? {};
  const moods = top(t.moods, 1);
  return {
    day: t.day,
    lifted: top(t.lift, 3, 1),
    lowered: top(t.lift, 3, -1),
    most: top(Object.fromEntries(Object.entries(t.done ?? {}).filter(([k]) => !NOT_MUCH.includes(k))), 3),
    kinds: top(t.kinds, 2),
    mood: moods[0] ?? null,
    unfinished: (s.projects ?? []).filter((p) => p.status === 'working').map((p) => p.title).slice(0, 4),
  };
}
export const signsOf = (d) => [...d.lifted.map((x) => `lifted:${x}`), ...d.lowered.map((x) => `lowered:${x}`), ...d.most.map((x) => `most:${x}`), ...d.kinds.map((x) => `kind:${x}`), ...(d.mood ? [`mood:${d.mood}`] : []), ...d.unfinished.map((x) => `unfinished:${x}`)];

// Signs seen on PATTERN_DAYS or more of the kept days, that are not a soul line yet.
export function patterns(days, lines = []) {
  const count = {};
  for (const d of days) for (const k of new Set(signsOf(d))) count[k] = (count[k] ?? 0) + 1;
  const have = new Set(lines.map((l) => l.key));
  return Object.entries(count).filter(([k, n]) => n >= PATTERN_DAYS && !have.has(k)).sort((a, b) => b[1] - a[1]).map(([key, days]) => ({ key, days }));
}

const SAY = { lifted: 'made me feel better', lowered: 'made me feel worse', most: 'what I did most', kind: 'the kind of thing I did most', mood: 'the mood I was in most', unfinished: 'a project I kept not finishing' };
export const explain = (key) => { const [k, v] = key.split(':'); return `${String(v).replace(/_/g, ' ')}: ${SAY[k] ?? k}`; };

export function sleepPrompt({ soul, today, found, added, story }) {
  return `${soul}

I AM FALLING ASLEEP. MY DAY
- What made me feel better: ${today.lifted.map((x) => x.replace(/_/g, ' ')).join(', ') || 'nothing stood out'}
- What made me feel worse: ${today.lowered.map((x) => x.replace(/_/g, ' ')).join(', ') || 'nothing stood out'}
- What I did most: ${today.most.map((x) => x.replace(/_/g, ' ')).join(', ') || 'not much'}
- My mood most of the day: ${today.mood ?? 'mixed'}
- Projects I have not finished: ${today.unfinished.join(', ') || 'none'}

THINGS THAT KEEP COMING BACK, DAY AFTER DAY
${found.length ? found.slice(0, 6).map((p) => `- [${p.key}] ${explain(p.key)} (on ${p.days} days)`).join('\n') : '- nothing yet'}

WHAT I ALREADY ADDED ABOUT MYSELF
${added.length ? added.map((l) => `- ${l.text}`).join('\n') : '- nothing yet'}

MY LIFE STORY SO FAR
${story || '(not written yet)'}

If one of the things that keep coming back says something true about who I am, I write ONE new short line about myself, plain and honest, in the third person like the rest of my soul ("He ..."), and I give its key. Or null, if nothing is true enough yet.
Then I rewrite my life story in at most 8 plain sentences, and I dream something.

Answer in JSON: {"soul_line": {"text": "He ...", "key": "the key in brackets"} or null, "story": "...", "dream": "one or two sentences"}`;
}
export const sleepSchema = (keys) => ({
  type: 'OBJECT',
  properties: {
    soul_line: { type: 'OBJECT', nullable: true, properties: { text: { type: 'STRING' }, key: keys.length ? { type: 'STRING', enum: keys } : { type: 'STRING' } }, required: ['text', 'key'] },
    story: { type: 'STRING' },
    dream: { type: 'STRING' },
  },
  required: ['story', 'dream'],
});

// The night: keep the day, add at most one line, let old lines go. Returns the changes (also for the log).
export function applySleep(s, reply, now = Date.now()) {
  const at = new Date(now).toISOString();
  const today = daySummary(s);
  s.days = [...(s.days ?? []).filter((d) => d.day !== today.day), today].slice(-KEEP_DAYS);
  s.soulLines ??= [];
  const signs = new Set(signsOf(today));
  for (const l of s.soulLines) if (signs.has(l.key)) l.lastSeen = at;
  const changes = [];
  const found = patterns(s.days, s.soulLines);
  const line = reply?.soul_line;
  const text = String(line?.text ?? '').trim().replace(/\s+/g, ' ').slice(0, 160);
  if (text && found.some((p) => p.key === line.key) && s.soulLines.length < MAX_ADDED) {
    s.soulLines.push({ text, key: line.key, addedAt: at, lastSeen: at });
    changes.push({ at, change: 'added', text, key: line.key, days: found.find((p) => p.key === line.key).days });
  }
  for (const l of [...s.soulLines]) {
    if (now - Date.parse(l.lastSeen) >= LET_GO_DAYS * DAY) {
      s.soulLines.splice(s.soulLines.indexOf(l), 1);
      changes.push({ at, change: 'let go', text: l.text, key: l.key, why: `no sign of it for ${LET_GO_DAYS} days` });
    }
  }
  return { today, changes };
}

// ---- Beliefs: what he has learned about himself, counted by the game from his days (no model). Each day says which
// kinds of things made him feel better or worse (daySummary); something that did so on three days or more, and nearly
// always the same way, is a belief, with the number of days as its evidence.
const DOING = { play_piano: 'Playing music', record_song: 'Recording a song', compose: 'Writing music', draw: 'Drawing', decorate: 'Making things', go_out: 'Going outside', search_web: 'Looking things up', read_book: 'Reading', browse: 'Browsing the web', cook: 'Cooking', eat: 'Eating', write_diary: 'Writing in my diary', rest: 'Resting', take_photo: 'Taking photos', make_app: 'Making programs', update_app: 'Working on my programs', water: 'Looking after my plants', plant: 'Planting', harvest: 'Harvesting', move_thing: 'Moving my things around', do: 'Small things around the house', buy: 'Shopping', answer_visitor: 'Writing back to people', make_clothes: 'Making clothes', blueprint: 'Planning how to make something' };
export const BELIEF_DAYS = 3;
export function beliefs(s) {
  const tally = {};
  for (const d of s.days ?? []) {
    for (const a of d.lifted ?? []) (tally[a] ??= { up: 0, down: 0 }).up += 1;
    for (const a of d.lowered ?? []) (tally[a] ??= { up: 0, down: 0 }).down += 1;
  }
  return Object.entries(tally)
    .map(([action, { up, down }]) => ({ action, lifts: up >= down, days: Math.max(up, down), of: up + down }))
    .filter((b) => b.days >= BELIEF_DAYS && b.days / b.of >= 0.7)
    .sort((a, b) => b.days - a.days)
    .slice(0, 8)
    .map((b) => ({ ...b, text: `${DOING[b.action] ?? `${b.action.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}`} ${b.lifts ? 'lifts me' : 'wears me down'}` }));
}
// For the brain: the two he is surest of.
export const beliefLines = (s) => (s.beliefs ?? []).slice(0, 2).map((b) => `Something I know about myself by now: ${b.text.charAt(0).toLowerCase()}${b.text.slice(1)} (it did on ${b.days} of my days).`);

// soul.md with the "Added by him" section rewritten from s.soulLines. Bas's [locked] lines are never touched.
export function withAddedLines(md, lines) {
  const head = String(md).split(/\n## Added by him[^\n]*\n/)[0].trimEnd();
  const body = lines.length ? lines.map((l) => `- ${l.text}`).join('\n') : '(nothing yet)';
  return `${head}\n\n## Added by him\n${body}\n`;
}

export async function saveSoul(lines, changes, { soulFile = 'soul.md', logFile = 'web/archive/soul-changes.json' } = {}) {
  const md = await readFile(soulFile, 'utf8');
  const next = withAddedLines(md, lines);
  if (next !== md) await writeFile(soulFile, next);
  if (!changes.length) return;
  let log = [];
  try { log = JSON.parse(await readFile(logFile, 'utf8')); } catch {}
  await mkdir(logFile.replace(/\/[^/]+$/, ''), { recursive: true });
  await writeFile(logFile, JSON.stringify([...log, ...changes], null, 1));
}

export const fakeSleep = (found) => ({ soul_line: found[0] ? { text: `(fake) He keeps coming back to ${found[0].key.split(':')[1]}.`, key: found[0].key } : null, story: '(fake) I live in a little room and I make things.', dream: '(fake) I dreamed of a bee made of light.' });
