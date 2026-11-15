// One-time changes Bas asks for. Each runs once, on Pip's next wake-up, and is remembered in s.changes,
// so the live loop applies it itself (no need to pause him). Nothing is deleted: what goes, goes to s.archive.
import { HELD } from './instruments.js';
import { giveForAsk } from './gifts.js';

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
