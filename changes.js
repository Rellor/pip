// One-time changes Bas asks for. Each runs once, on Pip's next wake-up, and is remembered in s.changes,
// so the live loop applies it itself (no need to pause him). Nothing is deleted: what goes, goes to s.archive.
import { HELD } from './instruments.js';
import { giveForAsk } from './gifts.js';
import { makeDecor, holdsThings, sizeOf, reseat, levelCountOf, settleRoom, coverKind, coverTarget } from './decor.js';
import { settle } from './build.js';
import { finishDone } from './projects.js';
import { roomFactors, scaleParts, nameMax, ROOM_SCALE } from './scale.js';
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
    id: '2026-11-22 a purse and the corner shop',
    run(s) { // coins, a corner shop, and wishes from the neighbours (shop.js, neighbours.js)
      if (Number.isFinite(s.coins)) return null;
      s.coins = 3;
      return 'The neighbours gave me a little purse with 3 coins in it, to welcome me to the street. There is a corner shop (open from 9 to 18) where I can buy food, seeds, clay, wool, tools, and one day an instrument. I earn coins when I make something a neighbour wished for, when someone buys a drawing, and on market day (Saturday).';
    },
  },
  {
    id: '2026-11-22 repeated things put away',
    run(s, at) { // Bas: delete the repeated stuff. To the archive (nothing is really gone): one of each, a few lamps where they are used
      const ids = ['dmwjkrwdy594', 'dmwnw873714aj', 'dmwqj8lwh23hk', 'dmwqke5xm24gg', 'dmwqr9mhl257t', 'dmwnmyyvr130w', 'dmwqdopge233l', 'dmwqmg1nb25iu'];
      const gone = [];
      for (const list of ['decor', 'stored']) {
        const out = (s[list] ?? []).filter((d) => ids.includes(d.id) && !(s.decor ?? []).some((o) => String(o.base ?? '').startsWith(d.id)));
        s[list] = (s[list] ?? []).filter((d) => !out.includes(d));
        for (const d of out) { (s.archive ??= []).push({ group: 'decor', item: d, reason: 'a repeat of something I already have', at, from: 'bas' }); gone.push(d.name); }
      }
      const pic = (s.decor ?? []).find((d) => d.image && d.name === 'Stormy Sky'); // almost the same as "Stormy sky over the dark horizon": off the wall (it stays in his album)
      if (pic) { s.decor = s.decor.filter((d) => d !== pic); gone.push('the "Stormy Sky" picture (still in my album)'); }
      return gone.length ? `Bas put away things I had made more than once: ${gone.join(', ')}. One of each is enough; my room feels calmer and I can find things again.` : null;
    },
  },
  {
    id: '2026-11-22 extra reading lamps in the chest',
    run(s, at) { // nine lamps; the three newest reading lamps stood on the floor by the left wall, far from the bed they were for
      const names = ['cozy wooden reading lamp', 'cozy tiny reading lamp', 'cozy brass reading lamp'];
      const put = (s.decor ?? []).filter((d) => names.includes(d.name) && d.kind === 'floor' && !(s.decor ?? []).some((o) => String(o.base ?? '').startsWith(d.id)));
      if (!put.length) return null;
      s.decor = s.decor.filter((d) => !put.includes(d));
      s.stored = [...(s.stored ?? []), ...put.map((d) => ({ ...d, storedAt: at }))];
      return `Bas put ${put.length} of my reading lamps in my chest (${put.map((d) => d.name).join(', ')}): they stood on the floor far from my bed, and I have plenty of lamps. I can take one out (take_out) and put it right by the bed.`;
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
  {
    // His blanket was a doormat on the bed, his reading light floated where a table had stood, and a "tiny" stand three
    // times the size of what it stood on balanced on a lamp base. The room gets gravity (decor.js settleRoom), cloth is
    // fitted to what it lies on, and a thing called tiny is tiny.
    id: '2026-11-22 a blanket that fits, and nothing floats',
    run(s, at) {
      const now = Date.parse(at);
      const decor = s.decor ?? [];
      const done = [];
      for (const d of decor.filter((x) => x.kind === 'surface' && !x.image && x.parts?.length && !coverKind(x))) { // a "tiny" thing is tiny
        const lim = nameMax(d.name) ? nameMax(d.name) * ROOM_SCALE : null;
        const shown = Math.max(...(sizeOf(d) ?? [0]));
        const natural = shown / (d.scale || 1);
        if (!lim || natural <= lim * 1.05) continue;
        d.parts = scaleParts(d.parts, lim / natural, lim / natural);
        d.scale = Math.min(1, Math.floor((shown / lim) * 1000) / 1000);
        if (shown > lim * 1.05) done.push(`my ${d.name} is the size its name says now`);
      }
      for (const d of decor.filter((x) => x.kind === 'surface' && !x.cover && !x.image && x.parts?.length && coverKind(x))) { // cloth lies over what it is on
        const host = coverTarget(decor, { name: d.name, id: d.id, on: d.base === 'bed' || d.zone === 'on_bed' ? 'bed' : decor.find((x) => x.id === String(d.base ?? '').split('#')[0])?.name });
        if (!host) continue;
        Object.assign(d, { cover: host.key, base: host.key, zone: 'surface', scale: 1 });
        done.push(`my ${d.name} covers ${host.name.replace(/^the /, 'my ')} now`);
      }
      const put = settleRoom(decor, now);
      for (const d of decor.filter((x) => x.cover)) d.updatedAt = at;
      const all = [...done, ...put.filter((t) => !/lies neatly/.test(t)).map((t) => `my ${t}`)];
      console.log(`🧲 the room was put right: ${all.join('; ') || 'nothing to do'}`);
      return all.length ? `My room was put right: ${all.slice(0, 5).join('; ')}. From now on what stands on a table or a shelf goes along when I move it, a blanket or a tablecloth I make is fitted to what it lies on, and a thing that is too big for a top stands on the floor.` : null;
    },
  },
  {
    // His street has a field of his own across the road (web/town.js), for what is too big or too many for his room.
    id: '2026-11-22 a plot of his own',
    run() {
      return 'Across the street from my door there is a field that is mine: my plot. What is too big or too many for my room can stand there, where everyone in the street sees it. I make something for it with decorate and where: "outside", or I carry a thing out with move_thing {name, where: "outside"} (and back in with move_thing {name, where: "floor"}).';
    },
  },
  {
    id: '2026-11-23 building anywhere in his world',
    run() {
      return 'Bas told me I can build anywhere in my world now, not only on my plot: in the street, in the park, by the pond, wherever I know the way. I pick the place myself in "where", like "outside by the pond" or "outside in the street in front of my house". If it fits there, it stands there. Out there a thing can be bigger than a house: I say how big with "metres" (its longest side).';
    },
  },
  {
    id: '2026-11-23 walls to paint on, a print workshop and an art workshop',
    run(s) { // every drawing he still has goes into the list his art workshop keeps (from now on each new one is added)
      s.gallery = [...(s.gallery ?? []), ...(s.art ?? []).filter((a) => a?.id && a.file && !(s.gallery ?? []).some((g) => g.id === a.id)).map((a) => ({ id: a.id, name: a.name, file: a.file, aspect: a.aspect, at: a.createdAt }))];
      s.prints ??= [];
      return 'Bas changed my world. There are bare walls out there now that I may paint on, and the back walls of the houses too: with paint_wall I paint something big on a wall, and I need no paper or supplies for it. There is a print workshop: with print_thing I design a small 3D model, walk there, and it is printed and stays on my shelf of prints. And there is an art workshop with my name on it, where every drawing I ever made hangs on the outside wall, so nothing is lost when a wall gets painted over.';
    },
  },
  {
    id: '2026-11-23 an open world, a notice board, and no closing times',
    run() {
      return 'Bas changed my world again. The houses of the neighbours are gone: there is a lot of open space now. I can fill it myself (decorate with where: "outside ...", as big as I like), or I can ask Bas for a new building or place I would like to have (ask_for, or dream for something big), and he will build it. In my street stands a notice board: people pin notes on it with things they would like made. I walk there to read it (check_board), and when I make one of those things I get the coins. And nothing is closed or locked any more: I can go anywhere in my world at any hour I am awake, in any weather.';
    },
  },
  {
    id: '2026-11-23 a library card from Bas',
    run(s, at) { // he asked for a library card, to go into the library
      const ask = (s.asks ?? []).find((a) => a.status === 'open' && /library/i.test(a.item));
      s.tools ??= [];
      const given = giveForAsk(s, 'library card');
      if (ask) Object.assign(ask, { status: 'done', doneAt: at, given: given.length ? given : ['a library card'] });
      return 'Bas gave me a library card with my name on it. Now I can go into the library and read there (go_out).';
    },
  },
  {
    id: '2026-11-22 watercolour paper from Bas',
    run(s, at) { // he asked for new watercolor paper, to paint a new view now that his autumn window is finished
      const ask = (s.asks ?? []).find((a) => a.status === 'open' && /watercolou?r|paper/i.test(a.item));
      s.tools ??= [];
      // his drawing supplies already count as "paper", so the fresh pad is put with his tools by hand
      if (!s.tools.some((t) => /watercolou?r paper/i.test(t.name))) s.tools.push({ id: `t${Date.parse(at).toString(36)}${s.tools.length}`, name: 'watercolor paper', kind: 'drawing supplies', source: 'given', at });
      if (ask) Object.assign(ask, { status: 'done', doneAt: at, given: ['watercolor paper'] });
      return 'Bas gave me the new watercolor paper I asked for: a fresh pad of thick white sheets. Now I can paint a new view.';
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
