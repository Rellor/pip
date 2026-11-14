// Phase 2 of the rebuild: back up Pip's state, then shrink his lists. Safe to run again:
// the live Pip keeps changing state.json on main, so run this once more right before merging.
// Run: node scripts/clean-memory.mjs [path/to/state.json]   (default web/state.json)
// Nothing is thrown away: the full state goes to web/archive/pre-rebuild/, old log and thoughts
// go to the daily files in web/archive/ (the site shows them under "Older days").
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { ensureMemory, sameInterest, addInterest, MAX_INTERESTS } from '../memory.js';
import { archiveOverflow } from '../archive.js';

const file = process.argv[2] ?? 'web/state.json';
const root = file.replace(/state\.json$/, '');
const backupDir = `${root}archive/pre-rebuild`;
const KEEP_MEMORIES = 30;
const KEEP_LIST = 30;
const MAX_REFLECTION_MEMORIES = 6; // most of his reflections say "cozy and peaceful" in new words; a few is enough

// Core memories: the big moments of his first days, from his diary. Pinned, so they never fade.
// Many of these had already fallen out of his 150-memory list.
const CORE = [
  ['2026-11-09T15:22:55.000Z', 'Bas made my room. The first time he wrote to me, I felt a little less alone.'],
  ['2026-11-09T16:30:00.000Z', 'I asked Bas for a picture of a truly dark sky. He brought it in a frame, and now it hangs on my wall.'],
  ['2026-11-11T12:00:00.000Z', 'I once said I had built shelves, but I had only moved things around. Now I check before I say I made something.'],
  ['2026-11-12T12:00:00.000Z', 'My first window stool was too low. I asked for a toolbox and built a taller one, and now I can see the stars.'],
  ['2026-11-13T12:00:00.000Z', 'I grew rosemary from seeds and baked bread with what I picked. Food I grow myself tastes the best.'],
  ['2026-11-14T10:00:00.000Z', 'I wrote my first program on my computer: a little sky with the Great Comet of 1680.'],
  ['2026-11-14T14:00:00.000Z', 'I sewed my first scarf with the sewing kit Bas gave me. It is amber, like autumn.'],
];
const coreMemories = () => CORE.map(([at, text], i) => ({ id: `core${i + 1}`, at, text, importance: 10, kind: 'memory', weight: 10, lastUsed: at, pinned: true }));

// Interests he had, merged into one line per topic. The first pattern that matches wins.
const TOPICS = [
  [/triangulum/i, 'the Triangulum Galaxy'],
  [/orion/i, 'the Orion Nebula'],
  [/betelgeuse/i, 'Betelgeuse and its giant bubbling cells'],
  [/star colou?rs|vivid colou?rs|distinct colou?rs|antares/i, 'star colours you can see with your own eyes'],
  [/milky way/i, 'the Milky Way and its dust lanes'],
  [/andromeda|galaxies visible|telescope/i, 'what a small telescope can show'],
  [/bortle|class 1|dark sk/i, 'truly dark skies with no city light (Bortle class 1)'],
  [/stellar acoustic/i, 'how stars ring like bells (stellar oscillations)'],
  [/starlight into sound|star sounds/i, 'turning starlight into sound'],
  [/ambient|eno/i, 'quiet ambient music, like Brian Eno'],
  [/mixing|panning/i, 'music mixing and stereo panning'],
  [/comet|kirch/i, 'the Great Comet of 1680'],
  [/rosemary|indoor herbs/i, 'growing rosemary indoors'],
  [/stool/i, 'building a wooden stool'],
  [/bread crust/i, 'the sound of bread crust cooling'],
  [/evening suite|^stars and the night sky$/i, null], // a finished project, and a line every other one already covers
];

const exists = (p) => access(p).then(() => true, () => false);
const words = (t) => new Set(String(t).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
const overlap = (a, b) => {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let n = 0;
  for (const w of x) if (y.has(w)) n++;
  return n / Math.min(x.size, y.size);
};

export function cleanInterests(list) {
  const out = [];
  const rest = [];
  for (const i of list) {
    const hit = TOPICS.find(([, name]) => name === i) ?? TOPICS.find(([re]) => re.test(i));
    if (!hit) rest.push(i);
    else if (hit[1] && !out.includes(hit[1])) out.push(hit[1]);
  }
  const s = { interests: out };
  for (const i of rest) addInterest(s, i); // anything new since this list was written: kept, without near-duplicates
  return s.interests.slice(-MAX_INTERESTS);
}

// The strongest memories, skipping ones that say nearly the same as a stronger one. Strongest first.
export function cleanMemories(list, keep = KEEP_MEMORIES, now = Date.now()) {
  const score = (m) => (m.weight ?? m.importance) + 2 * 0.98 ** ((now - Date.parse(m.at)) / 86_400_000) + (m.pinned ? 100 : 0);
  const chosen = [];
  for (const m of [...list].sort((a, b) => score(b) - score(a))) {
    if (chosen.length >= keep) break;
    if (/[{}]|\b[a-z]+_[a-z]+\b/.test(m.text)) continue; // old how-to-use-a-tool notes; the new brain has new moves
    if (chosen.some((c) => overlap(c.text, m.text) >= 0.5)) continue;
    if (m.kind === 'reflection' && !m.pinned && chosen.filter((c) => c.kind === 'reflection').length >= MAX_REFLECTION_MEMORIES) continue;
    chosen.push(m);
  }
  return chosen;
}

// Near-duplicate favourites (13 kinds of "guitar and kalimba in the evening") become one: the newest.
export function cleanFavorites(list) {
  const out = [];
  const near = (a, b) => overlap(a, b) >= 0.4 || sameInterest(a, b);
  for (const f of [...list].reverse()) if (!out.some((o) => o.kind === f.kind && near(o.what, f.what))) out.push(f);
  return out.reverse();
}

export async function clean(state, { archiveDir = `${root}archive`, now = Date.now() } = {}) {
  const before = Object.fromEntries(['interests', 'memories', 'thoughts', 'ideas', 'log', 'favorites', 'dreams'].map((k) => [k, state[k]?.length ?? 0]));
  ensureMemory(state);
  state.interests = cleanInterests(state.interests ?? []);
  const core = coreMemories().filter((c) => !state.memories.some((m) => m.id === c.id));
  state.memories = cleanMemories([...core, ...state.memories], KEEP_MEMORIES, now);
  state.memoryFadeAt = new Date(now).toISOString(); // forgetting starts now, not back in time
  state.ideas = (state.ideas ?? []).slice(-KEEP_LIST);
  state.favorites = cleanFavorites(state.favorites ?? []);
  state.dreams = (state.dreams ?? []).filter((d, i, all) => all.findIndex((x) => x.text === d.text) === i);
  await archiveOverflow(state, { dir: archiveDir, keep: { log: KEEP_LIST, thoughts: KEEP_LIST } });
  const after = Object.fromEntries(Object.keys(before).map((k) => [k, state[k]?.length ?? 0]));
  return { before, after };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = await readFile(file, 'utf8');
  await mkdir(backupDir, { recursive: true });
  const backup = (await exists(`${backupDir}/state.json`)) ? `${backupDir}/state-${new Date().toISOString().replace(/[:.]/g, '-')}.json` : `${backupDir}/state.json`;
  await writeFile(backup, raw);
  console.log(`💾 backup: ${backup}`);
  const state = JSON.parse(raw);
  const { before, after } = await clean(state);
  await writeFile(file, JSON.stringify(state, null, 2));
  for (const k of Object.keys(before)) console.log(`${k.padEnd(10)} ${String(before[k]).padStart(4)} -> ${after[k]}`);
}
