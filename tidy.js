// The big tidy (Phase 3 of the rebuild), run once: node pip.js tidy  ->  node pip.js tidy apply
// Pip goes through everything he has and picks keep, store or let go for each, with a reason in his own words.
// Nothing is deleted: let-go things move to state.archive, and their files stay on disk.
import { storeAway, MAX_STORED } from './decor.js';

export const KEEP_MAX = 5; // things he keeps out in his life (room things, drawings, photos, songs, clothes, programs)
export const STORE_MAX = 8; // things he puts away in his chest or album
// Things he needs to live. They do not count toward the limits, but he still says what he thinks of them.
const NEEDED = { 'little greenhouse': 'where my food grows', 'cozy kitchen stove': 'where I cook' };

const lower = (t) => String(t ?? '').toLowerCase();
const day = (iso) => (iso ? String(iso).slice(0, 10) : '');

// How often a thing came up in what he did (all logs he ever had).
export function useCounter(logs) {
  const texts = logs.map((e) => lower([e.name, e.target, e.item, e.what, e.detail, e.query, e.topic, e.song, e.picture, e.id].filter(Boolean).join(' | ')));
  return (...keys) => {
    const ks = keys.filter(Boolean).map(lower).filter((k) => k.length > 2);
    return texts.filter((t) => ks.some((k) => t.includes(k))).length;
  };
}

// Everything he can decide about, each with an id, what it is, who made or gave it and how often he used it.
export function tidyItems(s, logs = []) {
  const used = useCounter(logs);
  const fromBas = (x) => x.by && x.by !== 'pip';
  const items = [];
  for (const d of s.decor ?? []) {
    const pic = d.picture ? (s.pictures ?? []).find((p) => p.id === d.picture || `print:${p.id}` === d.picture) : null;
    const by = pic && fromBas(pic) ? 'Bas gave it' : d.picture && /^print:f/.test(d.picture) ? 'a print of a picture I found online' : 'I made it';
    items.push({ id: d.id, group: 'room', name: d.name, what: `${d.label ?? 'in my room'}${d.why ? `, ${d.why}` : ''}`, by, uses: used(d.name), since: day(d.createdAt ?? d.at), needed: NEEDED[lower(d.name)] });
  }
  for (const d of s.stored ?? []) items.push({ id: d.id ?? `stored:${d.name}`, group: 'chest', name: d.name, what: d.why ?? 'in my chest', by: d.given || /violin|flute|clarinet/i.test(d.name) ? 'Bas gave it' : 'I made it', uses: used(d.name), since: day(d.createdAt ?? d.storedAt) });
  for (const t of s.tools ?? []) items.push({ id: t.id, group: 'tool', name: t.name, what: `${t.kind}${t.why ? `, ${t.why}` : ''}`, by: t.source === 'given' ? 'Bas gave it' : 'I have it', uses: used(t.name, t.kind), since: day(t.at) });
  for (const a of s.art ?? []) items.push({ id: a.id, group: 'drawing', name: a.name, what: a.why ?? 'a drawing', by: 'I drew it', uses: used(a.name, a.id), since: day(a.createdAt) });
  for (const p of s.pictures ?? []) items.push({ id: p.id, group: 'photo', name: p.caption?.slice(0, 70) ?? p.id, what: p.notes?.slice(0, 120) ?? '', by: fromBas(p) ? 'Bas gave it' : 'I took it', uses: used(p.id), since: day(p.at) });
  for (const g of s.studio?.songs ?? []) items.push({ id: g.id, group: 'song', name: g.name, what: `${g.tracks?.map((t) => t.instrument).join(' and ')} song`, by: 'I made it', uses: used(g.name), since: day(g.createdAt) });
  for (const a of s.apps ?? []) items.push({ id: a.id, group: 'program', name: a.name, what: a.why ?? '', by: 'I made it', uses: used(a.name), since: day(a.createdAt) });
  for (const c of s.wardrobe ?? []) items.push({ id: c.id, group: 'clothes', name: c.name, what: c.why ?? '', by: 'I made it', uses: used(c.name), since: day(c.at ?? c.createdAt) });
  return items;
}

export function tidyPrompt(soul, items) {
  const groups = [...new Set(items.map((i) => i.group))];
  const list = groups.map((g) => `${g.toUpperCase()}\n${items.filter((i) => i.group === g).map((i) => `- [${i.id}] ${i.name} | ${i.by} | used ${i.uses} times | since ${i.since || '?'}${i.needed ? ` | I need it: ${i.needed}` : ''}${i.what ? ` | ${i.what}` : ''}`).join('\n')}`).join('\n\n');
  return `${soul}

Today I make a fresh start. My room is too full of things that are almost the same, and I keep doing the same calm things with them. I want space for new ideas and new projects.

I go through everything I have, one by one. For each thing I choose:
- "keep": it stays in my life. I keep at most ${KEEP_MAX} things, so only what really matters to me. (Tools and things I need to live do not count toward the ${KEEP_MAX}.)
- "store": I put it away in my chest or album. At most ${STORE_MAX} things.
- "let go": I say goodbye. It is not thrown away, it just leaves my room.

For each thing I write one short line, in my own words, about why. Plain and honest, not flowery.

${list}

Then I write a short diary entry (3 to 6 sentences) about this tidy: what I kept, what I let go of and how it feels.

Answer in JSON: {"choices": [{"id": "the id in brackets", "choice": "keep" | "store" | "let go", "reason": "one short line"}], "diary": "..."}`;
}

// Makes the answer safe: every item gets a choice, the limits hold, and things that stand on a kept thing keep it.
export function settleChoices(items, answer) {
  const by = new Map((answer?.choices ?? []).map((c) => [String(c.id), c]));
  const norm = (c) => (/keep/i.test(c) ? 'keep' : /store|chest|album|away/i.test(c) ? 'store' : 'let go');
  const out = items.map((i) => {
    const c = by.get(i.id);
    return { ...i, choice: c ? norm(c.choice) : 'store', reason: String(c?.reason ?? '').trim().slice(0, 200) || (c ? '' : '(I did not say, so I put it away for now.)') };
  });
  const free = (i) => i.group === 'tool' || i.needed;
  const trim = (choice, max, to) => {
    const extra = out.filter((i) => i.choice === choice && !free(i)).sort((a, b) => b.uses - a.uses).slice(max);
    for (const i of extra) {
      i.choice = to;
      i.note = `more than ${max} to ${choice}, so: ${to}`;
    }
  };
  trim('keep', KEEP_MAX, 'store');
  trim('store', STORE_MAX, 'let go');
  return out;
}

// Applies the choices. Returns a short summary. Pure on the state (no files).
export function applyTidy(s, choices, at = new Date().toISOString()) {
  s.archive ??= [];
  const done = { keep: [], store: [], 'let go': [] };
  const goodbye = (group, item, c) => s.archive.push({ group, item, reason: c.reason, at, from: 'tidy' });
  const take = (list, id) => {
    const i = (list ?? []).findIndex((x) => (x.id ?? `stored:${x.name}`) === id);
    return i >= 0 ? list.splice(i, 1)[0] : null;
  };
  // Room things go last, children before what they stand on, so a base is free when it leaves.
  const order = [...choices].sort((a, b) => (a.group === 'room') - (b.group === 'room'));
  const standsOn = (d) => String(d.base ?? '').split('#')[0];
  for (const c of order.filter((x) => x.group === 'room' && x.choice !== 'keep')) {
    const kids = (s.decor ?? []).filter((d) => standsOn(d) === c.id);
    if (kids.some((k) => choices.find((x) => x.id === k.id)?.choice === 'keep')) {
      c.note = 'something I keep stands on it, so it stays';
      c.choice = 'keep';
    }
  }
  const rooms = order.filter((x) => x.group === 'room');
  rooms.sort((a, b) => (s.decor.some((d) => standsOn(d) === a.id) ? 1 : 0) - (s.decor.some((d) => standsOn(d) === b.id) ? 1 : 0));
  for (const c of [...order.filter((x) => x.group !== 'room'), ...rooms]) {
    done[c.choice].push(c.name);
    if (c.choice === 'keep') continue;
    const lists = { chest: 'stored', tool: 'tools', drawing: 'art', photo: 'pictures', program: 'apps', clothes: 'wardrobe' };
    if (c.group === 'song') {
      if (c.choice === 'let go') { const g = take(s.studio?.songs, c.id); if (g) goodbye('song', g, c); }
      continue;
    }
    if (c.group === 'room') {
      const d = s.decor.find((x) => x.id === c.id);
      if (!d) continue;
      if (c.choice === 'store' && !d.image && (s.stored ?? []).length < MAX_STORED) {
        const r = storeAway(s.decor, s.stored, d.name);
        if (!r.failed) continue;
      }
      if (c.choice === 'store' && d.image) { // a picture on the wall: it comes down, and stays in his album
        s.decor.splice(s.decor.indexOf(d), 1);
        s.archive.push({ group: 'room', item: d, reason: c.reason, at, from: 'tidy', note: 'taken off the wall, still in my album' });
        continue;
      }
      for (const k of s.decor.filter((x) => standsOn(x) === d.id)) { // anything still on it leaves with it
        s.decor.splice(s.decor.indexOf(k), 1);
        goodbye('room', k, { reason: `it stood on ${d.name}` });
      }
      s.decor.splice(s.decor.indexOf(d), 1);
      goodbye('room', d, c);
      continue;
    }
    if (c.choice === 'store') continue; // chest things stay in the chest; drawings, photos, clothes and programs stay in his album
    const item = take(s[lists[c.group]], c.id);
    if (item) goodbye(c.group, item, c);
  }
  return done;
}

export function tidyDiary(choices, diary) {
  const line = (c) => `- ${c.choice}: ${c.name}${c.reason ? `: ${c.reason}` : ''}${c.note ? ` (${c.note})` : ''}`;
  return `## ${new Date().toLocaleString('en-GB')}\nThe big tidy. I went through everything I have.\n> ${String(diary ?? '').trim()}\n${['keep', 'store', 'let go'].flatMap((k) => choices.filter((c) => c.choice === k).map(line)).join('\n')}\n\n`;
}

// What the fake brain answers, for tests: the most used things are kept, the next ones stored.
export function fakeTidy(items) {
  const ranked = [...items].filter((i) => i.group !== 'tool' && !i.needed).sort((a, b) => b.uses - a.uses);
  const keep = new Set(ranked.slice(0, KEEP_MAX).map((i) => i.id));
  const store = new Set(ranked.slice(KEEP_MAX, KEEP_MAX + STORE_MAX).map((i) => i.id));
  return {
    choices: items.map((i) => ({ id: i.id, choice: i.group === 'tool' || i.needed || keep.has(i.id) ? 'keep' : store.has(i.id) ? 'store' : 'let go', reason: `(fake) I used it ${i.uses} times.` })),
    diary: '(fake) I tidied my room today. It feels lighter.',
  };
}
