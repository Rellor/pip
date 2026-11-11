// Old thoughts and log entries move to web/archive/<day>.json instead of being thrown away.
// The website can show them (Day tab, "Older days"). Pip never reads them: his prompt, his repetition checks and his feelings only use what is still in state.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

export const KEEP = { log: 150, thoughts: 250 };
const dayOf = (at, tz) => {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString('en-CA', { timeZone: tz }); // 2026-11-11
};
const same = (a, b) => `${a.at}|${a.action ?? ''}` === `${b.at}|${b.action ?? ''}`;
const read = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
};

// Moves what is beyond the limits out of the state. Returns how many entries were archived.
export async function archiveOverflow(state, { dir = 'web/archive', tz = 'Europe/Amsterdam', keep = KEEP } = {}) {
  const days = new Map();
  let moved = 0;
  for (const [key, limit] of Object.entries(keep)) {
    const list = Array.isArray(state[key]) ? state[key] : [];
    if (list.length <= limit) continue;
    const extra = list.slice(0, list.length - limit);
    state[key] = list.slice(-limit);
    for (const e of extra) {
      const d = dayOf(e?.at, tz);
      if (!d) continue;
      if (!days.has(d)) days.set(d, { log: [], thoughts: [] });
      days.get(d)[key].push(e);
      moved++;
    }
  }
  if (!moved) return 0;
  await mkdir(dir, { recursive: true });
  const index = await read(`${dir}/index.json`, []);
  for (const [d, add] of days) {
    const file = `${dir}/${d}.json`;
    const have = await read(file, { log: [], thoughts: [] });
    const merged = {};
    for (const key of Object.keys(keep)) {
      const all = [...(have[key] ?? [])];
      for (const e of add[key]) if (!all.some((x) => same(x, e))) all.push(e);
      merged[key] = all.sort((p, q) => Date.parse(p.at) - Date.parse(q.at));
    }
    await writeFile(file, JSON.stringify({ day: d, ...merged }));
    const row = { day: d, log: merged.log.length, thoughts: merged.thoughts.length };
    const i = index.findIndex((r) => r.day === d);
    if (i >= 0) index[i] = row;
    else index.push(row);
  }
  index.sort((p, q) => (p.day < q.day ? 1 : -1));
  await writeFile(`${dir}/index.json`, JSON.stringify(index));
  return moved;
}
