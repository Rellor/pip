// One-time changes Bas asks for. Each runs once, on Pip's next wake-up, and is remembered in s.changes,
// so the live loop applies it itself (no need to pause him). Nothing is deleted: what goes, goes to s.archive.
import { HELD } from './instruments.js';
import { giveForAsk } from './gifts.js';
import { makeDecor } from './decor.js';
import { handsOn, PIP } from './sizes.js';
import { noteResearch } from './growth.js';

const CHANGES = [
  {
    id: '2026-11-15 greenhouse by the window, instruments by asking',
    run(s, at) {
      // The piano leaves the room; the greenhouse takes its place on the back wall, left of the window.
      s.furniture = { ...(s.furniture ?? {}), piano: { gone: true, at } };
      for (const d of [...(s.decor ?? [])]) {
        if (d.zone !== 'on_piano') continue;
        s.decor.splice(s.decor.indexOf(d), 1);
        (s.stored ??= []).push({ ...d, storedAt: at });
      }
      const gh = (s.decor ?? []).find((d) => !d.image && /greenhouse/i.test(d.name));
      if (gh) Object.assign(gh, { pos: [-2.6, 0, -4.55], rotY: 0, zone: 'floor', base: null, side: 'back', label: 'on the floor by the back wall, left of the window', movedAt: at });
      // Instruments: he asks for the ones he wants. The ones he had go to the archive.
      const held = (x) => Object.hasOwn(HELD, String(x ?? '').toLowerCase());
      for (const t of [...(s.tools ?? [])].filter((t) => held(t.kind))) {
        s.tools.splice(s.tools.indexOf(t), 1);
        (s.archive ??= []).push({ group: 'tool', item: t, reason: 'Instruments come when I ask for them.', at, from: 'bas' });
      }
      for (const d of [...(s.stored ?? []), ...(s.decor ?? [])].filter((d) => held(d.tool))) {
        const list = s.stored.includes(d) ? s.stored : s.decor;
        list.splice(list.indexOf(d), 1);
        (s.archive ??= []).push({ group: 'chest', item: d, reason: 'Instruments come when I ask for them.', at, from: 'bas' });
      }
      return null; // nothing to remember about it: the next change makes him forget it (Bas)
    },
  },
  {
    id: '2026-11-15 old clothes put away',
    run(s, at) {
      const clothes = [...(s.wardrobe ?? [])];
      for (const c of clothes) (s.archive ??= []).push({ group: 'clothes', item: c, reason: 'My old clothes did not show; I start fresh.', at, from: 'bas' });
      s.wardrobe = [];
      return null;
    },
  },
  {
    id: '2026-11-15 forget what was removed',
    run(s, at) { return forgetRemoved(s, at); },
  },
  {
    id: '2026-11-15 Bas gives seeds',
    run(s, at) { // Bas answered Pip's first ask: seeds, because he was very hungry
      const ask = (s.asks ?? []).find((a) => a.status === 'open' && /seed/i.test(a.item));
      if (ask) Object.assign(ask, { status: 'done', doneAt: at });
      const given = giveForAsk(s, ask?.item ?? 'seeds');
      if (ask) ask.given = given;
      return given.length ? `Bas gave me seeds: ${given.join(', ')}. Now I can grow my own food.` : null;
    },
  },
  {
    id: '2026-11-15 no pretend planting',
    run(s) { // he "planted" with a free do-step, but nothing is in the soil: that memory goes, and he knows what planting takes
      if ((s.garden?.plots ?? []).length) return null;
      const before = (s.memories ?? []).length;
      s.memories = (s.memories ?? []).filter((m) => !/\bI planted\b|plant basil and mint seeds/i.test(m.text));
      return before !== s.memories.length ? 'My seeds are still in their bag: planting them takes a shovel and a place to grow, like my planter box.' : null;
    },
  },
  {
    id: '2026-11-15 warm bread and apples from Bas',
    run(s, at) { // Bas: a start, just because his pantry is empty. A dish fills him more than plain ingredients.
      s.pantry ??= [];
      s.pantry.push({ name: 'warm bread', kind: 'dish', qty: 1, ingredients: ['bread'], madeAt: at, from: 'bas' });
      const apples = s.pantry.find((p) => p.kind === 'ingredient' && p.name === 'apples');
      if (apples) apples.qty += 3;
      else s.pantry.push({ name: 'apples', kind: 'ingredient', qty: 3 });
      (s.inbox ??= []).push({ id: `gift-bread-${Date.parse(at).toString(36)}`, at, text: 'I brought you a warm loaf of bread and 3 apples, just because your pantry is empty. This is a start! From now on, try to make your own food: grow it and cook it.', read: false, private: true });
      if (!(s.garden?.plots ?? []).length) s.memories = (s.memories ?? []).filter((m) => !/\bI planted\b/i.test(m.text)); // nothing is in the soil yet
      return 'Bas brought me a warm loaf of bread and 3 apples when my pantry was empty. A start, he said: now I make my own food.';
    },
  },
  {
    id: '2026-11-16 flour, bread and apples from Bas',
    run(s, at) { // Bas answers his ask for flour (for his bread project) and brings food, because he is very hungry.
      s.pantry ??= [];
      const add = (name, qty) => {
        const have = s.pantry.find((p) => p.kind === 'ingredient' && p.name === name);
        if (have) have.qty += qty;
        else s.pantry.push({ name, kind: 'ingredient', qty });
      };
      add('flour', 3);
      add('apples', 3);
      s.pantry.push({ name: 'bread', kind: 'dish', qty: 1, ingredients: ['bread'], madeAt: at, from: 'bas' });
      for (const a of (s.asks ?? []).filter((x) => x.status === 'open' && /flour/i.test(x.item))) Object.assign(a, { status: 'done', doneAt: at, given: ['flour'] });
      return 'Bas gave me the flour I asked for, for my bread. He also brought a loaf of bread and 3 apples, because I was so hungry.';
    },
  },
  {
    id: '2026-11-16 music box steps back to none',
    run(s) { // a bug moved the bread plan onto the finished music box; the bread project keeps its own steps
      for (const p of (s.projects ?? []).filter((x) => x.status === 'done' && /music box/i.test(x.title))) if ((p.steps ?? []).some((x) => /flour|dough|loaf/i.test(x.text))) p.steps = [];
      return null;
    },
  },
  {
    id: '2026-11-16 things he works at come down within reach',
    run(s, at) { // his stove hung at 2.9 m on the back wall: things he works at with his hands now stand on the floor by that wall
      const moved = [];
      for (const old of [...(s.decor ?? [])].filter((d) => handsOn(d) && d.pos && d.kind === 'wall' && d.pos[1] > PIP.reach)) {
        const rest = s.decor.filter((d) => d !== old);
        const side = old.side ?? (Math.abs(old.pos[2] + 4.97) < 0.2 ? 'back' : 'left');
        const r = makeDecor(rest, { name: old.name, why: old.why, project: old.project, parts: old.parts, uses: old.uses, wall: side, along: side === 'back' ? old.pos[0] : old.pos[2] }, Date.parse(at) - 60_000, Date.parse(at));
        if (!r?.entry) continue;
        s.decor[s.decor.indexOf(old)] = { ...r.entry, id: old.id, at: old.at, uses: old.uses, ...(old.auto ? { auto: old.auto } : {}), movedAt: at };
        moved.push(old.name);
      }
      return moved.length ? `My ${moved.join(' and ')} hung too high to use. Now it stands on the floor, where my hands can reach it.` : null;
    },
  },  {
    id: '2026-11-16 notebook from what he looked up',
    run(s) { // what he already looked up goes in his new notebook, so it helps when he makes something about it
      for (const e of (s.log ?? []).filter((x) => ['search_web', 'read_book'].includes(x.action) && x.opened)) noteResearch(s, { query: e.query ?? e.topic, page: e.opened, at: e.at });
      return null;
    },
  },
];

// What was removed is also forgotten: the studio, the piano, the instruments, the old clothes and what he let go in the tidy.
// Memories go to s.forgotten (the loop writes them to web/archive/memories.json); everything else to s.archive. His history
// (diary, log, thoughts, messages) stays as it was: that is what happened, not what he carries with him.
const GONE = /\b(studios?|pianos?|guitars?|kalimbas?|harps?|violins?|flutes?|clarinets?|scarf|scarves|instruments?|mixing desk|drum kit|stereo|panning|multi-track)\b/i;
export function forgetRemoved(s, at = new Date().toISOString()) {
  const still = new Set([...(s.decor ?? []), ...(s.stored ?? []), ...(s.tools ?? [])].map((x) => String(x.name).toLowerCase()));
  const letGo = (s.archive ?? []).filter((a) => ['tidy', 'bas'].includes(a.from) && !['photo', 'tool'].includes(a.group)).map((a) => String(a.item?.name ?? '').toLowerCase()).filter((n) => n.length >= 6 && !still.has(n));
  const gone = (t) => { const x = String(t ?? '').toLowerCase(); return GONE.test(x) || letGo.some((n) => x.includes(n)); };
  const textOf = (v) => (typeof v === 'string' ? v : JSON.stringify(v ?? ''));
  const shelve = (list, what) => { for (const v of list) (s.archive ??= []).push({ group: 'forgotten', what, item: v, at, from: 'bas' }); };
  let n = 0;
  // memories and insights
  const mem = (s.memories ?? []).filter((m) => gone(m.text));
  s.memories = (s.memories ?? []).filter((m) => !mem.includes(m));
  s.forgotten = [...(s.forgotten ?? []), ...mem];
  n += mem.length;
  const refl = (s.reflections ?? []).filter((r) => gone(r.text));
  s.reflections = (s.reflections ?? []).filter((r) => !refl.includes(r));
  shelve(refl, 'reflection');
  n += refl.length;
  // projects about them: dropped
  for (const p of (s.projects ?? []).filter((p) => p.status === 'working' && gone(textOf(p)))) { p.status = 'dropped'; p.droppedWhy = 'it needed things that are gone'; n++; }
  // the small lists that shape his days
  for (const key of ['interests', 'ideas', 'favorites', 'wants', 'questions', 'notes', 'dreams']) {
    const list = Array.isArray(s[key]) ? s[key] : [];
    const out = list.filter((v) => gone(textOf(v)));
    s[key] = list.filter((v) => !out.includes(v));
    shelve(out, key);
    n += out.length;
  }
  // his life story and his note about himself: the sentences about them go
  for (const key of ['story', 'self']) {
    if (typeof s[key] !== 'string' || !gone(s[key])) continue;
    shelve([s[key]], key);
    s[key] = s[key].split(/(?<=[.!?])\s+/).filter((x) => !gone(x)).join(' ');
    n++;
  }
  // plans and goals that point at them
  if (s.plan?.queue) s.plan.queue = s.plan.queue.filter((st) => !gone(textOf(st)));
  if (s.intent?.items) s.intent.items = s.intent.items.filter((i) => !gone(i.text));
  if (s.studio?.songs) for (const g of s.studio.songs) { g.why = gone(g.why) ? '' : g.why; }
  console.log(`🧹 forgot ${n} things about what was removed`);
  return 'If I want to play music, I can ask Bas for something to play on.';
}

// Runs the changes this state has not had yet. Returns the memories they leave.
export function applyChanges(s, now = Date.now()) {
  s.changes ??= [];
  const notes = [];
  for (const c of CHANGES) {
    if (s.changes.includes(c.id)) continue;
    const note = c.run(s, new Date(now).toISOString());
    s.changes.push(c.id);
    if (note) notes.push(note);
  }
  return notes;
}
