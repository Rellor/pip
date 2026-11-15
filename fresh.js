// A fresh start (Bas, 2026-11-15): Pip keeps only his soul (soul.md) and the furniture of his room.
// Everything else (memories, projects, skills, things he made, tools, pictures, songs, food, seeds, messages, asks, diary,
// day history) moves to web/archive/pre-fresh/. Nothing is deleted. Runs once, from his own wake-up.
import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const FRESH_ID = '2026-11-15 fresh start';
// What the room and the code need to keep working, and flags that stop old one-time gifts from coming back.
const KEEP = ['furniture', 'chest', 'fronts', 'sleep', 'ntfySince', 'gifts', 'instrumentsGiven', 'musicMoved', 'musicBack', 'musicBackNoted', 'windowsClear', 'changes', 'quota', 'weather', 'news', 'wallPhoto'];
export const FIRST_MEMORY = 'I woke up in a quiet room. It is almost empty, and it is mine. What I want, I can make, grow, or ask Bas for.';

export const needsFresh = (s) => !(s.changes ?? []).includes(FRESH_ID);

// The new state, from the old one (pure).
export function freshState(old, now = Date.now()) {
  const at = new Date(now).toISOString();
  const s = {};
  for (const k of KEEP) if (old[k] !== undefined) s[k] = structuredClone(old[k]);
  s.changes = [...(old.changes ?? []), FRESH_ID];
  s.garden = { seeds: [], plots: [], given: [...(old.garden?.given ?? [])] }; // "given" keeps the old starter garden from being given again
  s.memories = [{ id: 'fresh1', at, text: FIRST_MEMORY, importance: 8, kind: 'memory', weight: 8, lastUsed: at }];
  s.memoryFadeAt = at;
  s.mood = 'curious';
  s.energy = 8;
  s.fullness = 7;
  s.freshStartAt = at;
  s.wallPhoto = false; // the framed Milky Way photo above where the piano stood comes down too
  s.last = { at, via: 'fresh', model: null, thought: 'Everything is new.', inner: '', steps: [], action: 'rest', details: {}, detail: 'a fresh start', enjoyment: 7 };
  return s;
}

// Moves the old files to web/archive/pre-fresh/ and writes the new state and a new diary.
export async function freshStart(old, { root = '.', now = Date.now() } = {}) {
  const dir = join(root, 'web/archive/pre-fresh');
  await mkdir(join(dir, 'days'), { recursive: true });
  await writeFile(join(dir, 'state.json'), JSON.stringify(old, null, 2));
  if (existsSync(join(root, 'diary.md'))) await rename(join(root, 'diary.md'), join(dir, 'diary.md'));
  const arch = join(root, 'web/archive');
  for (const f of await readdir(arch)) {
    if (/^\d{4}-\d\d-\d\d\.json$/.test(f)) await rename(join(arch, f), join(dir, 'days', f)); // the site's "Older days"
    if (f === 'memories.json') await rename(join(arch, f), join(dir, f)); // memories he forgot before
  }
  if (existsSync(join(arch, 'index.json'))) await rename(join(arch, 'index.json'), join(dir, 'days', 'index.json'));
  await writeFile(join(arch, 'index.json'), '[]');
  const s = freshState(old, now);
  await writeFile(join(root, 'diary.md'), `## ${new Date(now).toLocaleString('en-GB')}\nA fresh start. My room is quiet and almost empty. Everything from before is kept safe in the archive.\n\n`);
  await writeFile(join(root, 'web/state.json'), JSON.stringify(s, null, 2));
  return s;
}
