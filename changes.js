// One-time changes Bas asks for. Each runs once, on Pip's next wake-up, and is remembered in s.changes,
// so the live loop applies it itself (no need to pause him). Nothing is deleted: what goes, goes to s.archive.
import { HELD } from './instruments.js';
import { giveForAsk } from './gifts.js';
import { makeDecor, holdsThings, sizeOf, reseat, levelCountOf } from './decor.js';
import { settle } from './build.js';
import { finishDone } from './projects.js';
import { roomFactors, scaleParts } from './scale.js';
import { handsOn, PIP } from './sizes.js';
import { noteResearch } from './growth.js';
import { addIngredient } from './food.js';

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
    id: '2026-11-16 bread is not done yet',
    run(s, at) { // his bread project was called done after 1 of 4 steps (only the stove was made): it opens again
      const p = (s.projects ?? []).find((x) => x.status === 'done' && /bread/i.test(x.title) && (x.steps ?? []).filter((y) => !y.done).length > (x.steps ?? []).length / 2);
      if (!p) return null;
      Object.assign(p, { status: 'working', proud: false, updatedAt: at });
      delete p.doneAt;
      s.projects = [...s.projects.filter((x) => x.status === 'working'), ...s.projects.filter((x) => x.status !== 'working')];
      return 'My bread project is not finished yet: I made the stove, but I still have to knead, let it rise and bake.';
    },
  },
  {
    id: '2026-11-16 drawing supplies from Bas',
    run(s, at) { // Bas answers his ask: drawing supplies for his watercolor of the stormy sky
      const ask = (s.asks ?? []).find((x) => x.status === 'open' && /drawing|paint|brush|watercolou?r/i.test(x.item));
      const given = giveForAsk(s, 'drawing supplies');
      if (ask) Object.assign(ask, { status: 'done', doneAt: at, given });
      for (const p of s.projects ?? []) p.needs = (p.needs ?? []).filter((n) => !/drawing supplies/i.test(n));
      return given.length ? 'Bas gave me the drawing supplies I asked for. Now I can paint my stormy sky.' : null;
    },
  },
  {
    id: '2026-11-16 shelves come down within reach',
    run(s, at) { // his shelf hung at 2.8 m: shelves for his things hang where he can reach them (the rest of the wall stays as it is)
      const moved = [];
      for (const old of [...(s.decor ?? [])].filter((d) => d.kind === 'wall' && !d.image && d.pos && d.pos[1] > PIP.reachUp - 0.3 && holdsThings(d))) {
        const rest = s.decor.filter((d) => d !== old);
        const side = old.side ?? (Math.abs(old.pos[2] + 4.97) < 0.2 ? 'back' : 'left');
        const r = makeDecor(rest, { name: old.name, why: old.why, project: old.project, parts: old.parts, uses: old.uses, wall: side, along: side === 'back' ? old.pos[0] : old.pos[2], height: 1.1 }, Date.parse(at) - 60_000, Date.parse(at));
        if (!r?.entry) continue;
        s.decor[s.decor.indexOf(old)] = { ...r.entry, id: old.id, at: old.at, uses: old.uses, movedAt: at };
        moved.push(old.name);
      }
      return moved.length ? `My ${moved.join(' and ')} hung too high to put things on. Now it hangs where I can reach it.` : null;
    },
  },
  {
    id: '2026-11-17 shelf beside the stove',
    run(s, at) { // Bas: the shelf hung right above the stove, so the stove could not grow; it moves along the wall to beside it
      const shelf = (s.decor ?? []).find((d) => d.kind === 'wall' && /shelf/i.test(d.name) && d.pos && Math.abs(d.pos[2] + 4.15) < 0.3);
      if (!shelf) return null;
      const rest = s.decor.filter((d) => d !== shelf);
      const r = makeDecor(rest, { name: shelf.name, why: shelf.why, project: shelf.project, parts: shelf.parts, uses: shelf.uses, wall: 'left', along: -3.1, height: shelf.pos[1], keep: true }, Date.parse(at) - 60_000, Date.parse(at));
      if (!r?.entry) return null;
      s.decor[s.decor.indexOf(shelf)] = { ...r.entry, id: shelf.id, at: shelf.at, createdAt: shelf.createdAt ?? r.entry.createdAt, uses: shelf.uses, movedAt: at };
      return null;
    },
  },
  {
    id: '2026-11-17 his things at the size of his room',
    run(s, at) { // everything he made grows to the room's size (1.6x; work tops only as far as he can reach), and stays where it was
      const atMs = Date.parse(at) - 60_000;
      const deg = (r) => Math.round(((r ?? 0) * 180) / Math.PI);
      const mine = (s.decor ?? []).filter((d) => !d.image && !d.art && d.parts?.length && !d.roomScaled);
      const order = [...mine.filter((d) => d.kind !== 'surface'), ...mine.filter((d) => d.kind === 'surface')]; // shelves and tables first, then what stands on them
      const grown = [];
      for (const old of order) {
        const f = roomFactors(old.parts, old);
        const rest = s.decor.filter((d) => d !== old);
        const side = old.side ?? (old.pos && Math.abs(old.pos[2] + 4.97) < 0.2 ? 'back' : 'left');
        const baseKey = old.base ?? '';
        const [bid, lv] = String(baseKey).split('#');
        const holder = lv !== undefined ? s.decor.find((d) => d.id === bid) : null;
        const where = old.kind === 'floor' ? { x: old.pos[0], z: old.pos[2], turn: deg(old.rotY) }
          : old.kind === 'wall' ? { wall: side, along: side === 'back' ? old.pos[0] : old.pos[2], height: old.pos[1] }
          : holder ? { on: holder.name, level: String(Number(lv) + 1) } : { on: baseKey || 'desk' };
        // It keeps its place: as big as fits right there (1.6 times, or a bit less where there is no more room).
        let r = null;
        for (let k = 1; k >= 0; k -= 0.1) {
          const wide = 1 + (f.wide - 1) * k;
          const high = 1 + (f.high - 1) * k;
          let at2 = where;
          if (old.kind === 'floor') { // against a wall: the middle moves out from it by half of what it grows, so its back stays at the wall
            const [w0, , d0] = sizeOf(old) ?? [0, 0, 0];
            const grow = Math.max(w0, d0) * (wide - 1) / 2;
            const off = (v) => (v < -3.9 ? grow : v > 3.9 ? -grow : 0);
            at2 = { ...where, x: Math.round((old.pos[0] + off(old.pos[0])) * 1000) / 1000, z: Math.round((old.pos[2] + off(old.pos[2])) * 1000) / 1000 };
          }
          const t = makeDecor(rest, { name: old.name, why: old.why, project: old.project, parts: scaleParts(old.parts, wide, high), uses: old.uses, keep: true, ...at2 }, atMs, Date.parse(at));
          const room = old.kind === 'floor' ? 0.45 : 0.12; // on the floor: the same spot against the same wall (a little out from it as it grows)
          if (t?.entry && Math.hypot(t.entry.pos[0] - old.pos[0], t.entry.pos[2] - old.pos[2]) <= room) { r = t; break; }
        }
        if (!r?.entry) { old.roomScaled = true; continue; } // it stays as it is
        s.decor[s.decor.indexOf(old)] = { ...r.entry, id: old.id, at: old.at, createdAt: old.createdAt ?? r.entry.createdAt, uses: old.uses, ...(old.auto ? { auto: old.auto } : {}), ...(old.lit !== undefined ? { lit: old.lit } : {}), roomScaled: true };
        grown.push(old.name);
      }
      return grown.length ? `My room is big, and the things I made were very small in it. Now they are the right size: ${grown.slice(0, 4).join(', ')}${grown.length > 4 ? ' and more' : ''}.` : null;
    },
  },
  {
    id: '2026-11-17 shelf up to a normal height',
    run(s, at) { // Bas: hanging things do not have to be at his height; his shelf goes up to a normal shelf height, beside the stove
      const shelf = (s.decor ?? []).find((d) => d.kind === 'wall' && /shelf/i.test(d.name) && d.pos && d.pos[1] < 1.4);
      if (!shelf) return null;
      const rest = s.decor.filter((d) => d !== shelf);
      const side = shelf.side ?? 'left';
      const r = makeDecor(rest, { name: shelf.name, why: shelf.why, project: shelf.project, parts: shelf.parts, uses: shelf.uses, wall: side, along: side === 'back' ? shelf.pos[0] : shelf.pos[2], height: 1.7, keep: true }, Date.parse(at) - 60_000, Date.parse(at));
      if (!r?.entry) return null;
      for (const d of s.decor) if (String(d.base ?? '').startsWith(`${shelf.id}#`)) d.pos = [d.pos[0], d.pos[1] + (r.entry.pos[1] - shelf.pos[1]), d.pos[2]]; // what stands on it goes up with it
      s.decor[s.decor.indexOf(shelf)] = { ...r.entry, id: shelf.id, at: shelf.at, createdAt: shelf.createdAt ?? r.entry.createdAt, uses: shelf.uses, roomScaled: shelf.roomScaled, movedAt: at };
      return null;
    },
  },
  {
    id: '2026-11-17 a phone as a gift',
    run(s, at) { // a gift (not from anyone in particular): a phone with a Lights app, and his own apps on it
      if (s.phone) return null;
      s.phone = { since: at, from: 'a gift' };
      return 'I got a phone as a gift! It has a Lights app: I can switch my lamps on and off, give them names, pick colours, dim them and set timers. My own apps are on it too.';
    },
  },
  {
    id: '2026-11-21 wool from Bas',
    run(s, at) { // he asked for extra wool for his blanket
      const ask = (s.asks ?? []).find((a) => a.status === 'open' && /wool|yarn/i.test(a.item));
      const given = giveForAsk(s, 'wool');
      if (ask) Object.assign(ask, { status: 'done', doneAt: at, given });
      return given.length ? 'Bas gave me wool, soft and warm. Now I can knit my blanket.' : null;
    },
  },
  {
    id: '2026-11-20 sewing kit from Bas',
    run(s, at) { // he asked for a sewing kit to knit his warm wool blanket
      const ask = (s.asks ?? []).find((a) => a.status === 'open' && /sew|knit/i.test(a.item));
      const given = giveForAsk(s, 'sewing kit');
      if (ask) Object.assign(ask, { status: 'done', doneAt: at, given });
      return given.length ? 'Bas gave me a sewing kit: needles, thread and fabric. Now I can make my warm wool blanket, and sew things to wear.' : null;
    },
  },
  {
    id: '2026-11-18 the lamp project is done',
    run(s, at) { // all its steps were done and he had made it twice, but he kept making one more lamp
      const done = (s.projects ?? []).filter((p) => p.status === 'working').map((p) => finishDone(s, p.title, at)).filter(Boolean);
      return done.length ? `My project "${done[0].title}" is finished: all my steps are done and I made it ${done[0].versions.length} times. It works. I have enough lamps now, so I can start something new.` : null;
    },
  },
  {
    id: '2026-11-18 duplicate lamps put away',
    run(s, at) { // three copies of his clay desk lamp, made one after another for his lamp project, stood on the floor by the rug
      const ids = ['dmwlueu5g1049', 'dmwlupvwl11hq', 'dmwlvl4ns12vt'];
      const gone = (s.decor ?? []).filter((d) => ids.includes(d.id) && !(s.decor ?? []).some((o) => String(o.base ?? '').startsWith(d.id)));
      if (!gone.length) return null;
      s.decor = s.decor.filter((d) => !gone.includes(d));
      for (const d of gone) (s.archive ??= []).push({ group: 'decor', item: d, reason: 'a copy of my clay desk lamp', at, from: 'bas' });
      return `Bas put away ${gone.length} copies of my clay desk lamp (${gone.map((d) => d.name).join(', ')}). I already have my small clay lamp on the desk, my brass lamp and my amber reading light: that is enough lamps.`;
    },
  },
  {
    id: '2026-11-18 clay from Bas',
    run(s, at) { // he asked for clay for the base of his desk lamp
      const ask = (s.asks ?? []).find((a) => a.status === 'open' && /clay/i.test(a.item));
      const given = giveForAsk(s, 'clay');
      if (ask) Object.assign(ask, { status: 'done', doneAt: at, given });
      return given.length ? 'Bas gave me the clay I asked for. Now I can shape the base for my desk lamp.' : null;
    },
  },
  {
    id: '2026-11-18 builder: things hold together',
    run(s) { // the new builder (build.js) fixes what he built before: legs reach their tops, and what stands on his shelves sits on the boards as they are now
      const fixed = [];
      for (const d of (s.decor ?? []).filter((x) => !x.image && Array.isArray(x.parts))) {
        const r = settle(d.parts, { kind: d.kind });
        if (r.fixes.length) { d.parts = r.parts; d.updatedAt = new Date().toISOString(); fixed.push(d.name); }
      }
      const moved = [];
      for (const d of (s.decor ?? []).filter((x) => !x.image && Array.isArray(x.parts))) moved.push(...reseat(s.decor, d, levelCountOf(d)).moved);
      return fixed.length || moved.length ? `I got a builder's eye: ${[fixed.length ? `the legs of my ${fixed.join(' and ')} now reach the top` : '', moved.length ? `${moved.join(', ')} sit on the shelf boards again` : ''].filter(Boolean).join(', and ')}. Now my things hold together, and when I change something, what stands on it moves along.` : null;
    },
  },
  {
    id: '2026-11-17 food from Bas',
    run(s) { // he was very hungry with an empty pantry: Bas brings him food
      s.pantry ??= [];
      for (const name of ['bread', 'apples', 'eggs', 'cheese', 'carrots', 'potatoes', 'milk', 'butter']) for (let i = 0; i < 2; i++) addIngredient(s, name);
      const soup = s.pantry.find((p) => p.kind === 'dish' && p.name === 'vegetable soup');
      if (soup) soup.qty += 3;
      else s.pantry.push({ name: 'vegetable soup', kind: 'dish', qty: 3, from: 'bas' });
      return 'Bas brought me food: bread, apples, eggs, cheese, carrots, potatoes, milk, butter and three bowls of vegetable soup. My pantry is full again. I am so hungry, I eat something now.';
    },
  },
  {
    id: '2026-11-17 painting not stuck',
    run(s) { // his painting only waited for tomorrow's drawings (a daily limit), it was never stuck
      for (const p of s.projects ?? []) delete p.stuck;
      return null;
    },
  },
  {
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
