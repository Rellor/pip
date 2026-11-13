// Pip's greenhouse garden: seeds, planting, watering, harvesting, and what he is told as his plants grow.
// The rules for growing (damp soil, stages) are in web/gardening.js so the page agrees with this.
import { addIngredient } from './food.js';
import { nudge } from './feelings.js';
import { isGreenhouse, SLOTS_PER_GREENHOUSE, plantState, speciesOf, stageIndex, WATER_AGAIN_H } from './web/gardening.js';

const clean = (t, n = 40) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const same = (a, b) => {
  const x = clean(a, 60).toLowerCase().replace(/\bseeds?\b/g, '').trim();
  const y = clean(b, 60).toLowerCase().replace(/\bseeds?\b/g, '').trim();
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

export function ensureGarden(s) {
  s.garden ??= { seeds: [], plots: [], given: [] };
  s.garden.seeds ??= [];
  s.garden.plots ??= [];
  s.garden.given ??= [];
}

// A little greenhouse (a bench with soil, a glass house around it), kept in the chest until he takes it out.
const parts = () => {
  const glass = '#bfe8ff';
  const frame = '#f1f5ef';
  const P = (shape, size, pos, color, extra = {}) => ({ shape, size, pos, rot: [0, 0, 0], color, glow: false, ...extra });
  return [
    P('box', [1.3, 0.5, 0.7], [0, 0.25, 0], '#8b5a2b'), // the growing bench
    P('box', [1.2, 0.06, 0.5], [0, 0.53, 0], '#5a3b24'), // soil
    ...[[-0.62, -0.32], [0.62, -0.32], [-0.62, 0.32], [0.62, 0.32]].map(([x, z]) => P('box', [0.04, 1.0, 0.04], [x, 1.0, z], frame)),
    P('box', [1.3, 0.04, 0.04], [0, 1.5, -0.32], frame),
    P('box', [1.3, 0.04, 0.04], [0, 1.5, 0.32], frame),
    P('box', [1.3, 0.04, 0.04], [0, 1.78, 0], frame), // roof ridge
    P('box', [1.3, 0.025, 0.44], [0, 1.64, -0.17], glass, { glass: true, rot: [-34, 0, 0] }), // two glass roof panes
    P('box', [1.3, 0.025, 0.44], [0, 1.64, 0.17], glass, { glass: true, rot: [34, 0, 0] }),
    P('box', [1.24, 0.9, 0.02], [0, 1.0, -0.33], glass, { glass: true }), // glass walls
    P('box', [1.24, 0.9, 0.02], [0, 1.0, 0.33], glass, { glass: true }),
    P('box', [0.02, 0.9, 0.62], [-0.63, 1.0, 0], glass, { glass: true }),
    P('box', [0.02, 0.9, 0.62], [0.63, 1.0, 0], glass, { glass: true }),
  ];
};

// Once: seeds, a shovel, a watering can and the greenhouse (in his chest). Returns the note he gets, or null.
export function grantGarden(s, now = Date.now()) {
  ensureGarden(s);
  if (s.garden.given.includes('start')) return null;
  s.garden.given.push('start');
  const at = new Date(now).toISOString();
  s.tools.push({ id: 'tgift5', name: 'Little Shovel', kind: 'shovel', source: 'given', why: 'a small shovel for planting seeds', at });
  s.tools.push({ id: 'tgift6', name: 'Watering Can', kind: 'watering can', source: 'given', why: 'a little watering can to keep the soil damp', at });
  addSeeds(s, 'rosemary', 4);
  s.stored ??= [];
  s.stored.push({
    id: 'dgreenhouse',
    name: 'little greenhouse',
    why: 'a small glass greenhouse to grow plants from seeds',
    project: '',
    song: null,
    uses: [{ label: 'Look at my plants', text: 'I look at the little plants growing in the glass house.', view: null, song: null, app: null, effect: 'calm' }],
    parts: parts(),
    zone: 'floor',
    kind: 'floor',
    free: true,
    scale: 1,
    createdAt: at,
    storedAt: at,
  });
  return 'I was given a little greenhouse (it is in my chest: take_out brings it into my room), 4 rosemary seeds, a little shovel and a watering can. I put the greenhouse where I like, plant the seeds with plant, keep the soil damp with water, and harvest when a plant is grown. Plants only grow while the soil is damp. More kinds of seeds I can research and ask for.';
}

export function addSeeds(s, name, qty = 3) {
  ensureGarden(s);
  const n = clean(name, 40).toLowerCase().replace(/\bseeds?\b/g, '').trim();
  if (!n) return false;
  const have = s.garden.seeds.find((x) => same(x.name, n));
  if (have) have.qty = Math.min(12, have.qty + qty);
  else if (s.garden.seeds.length < 10) s.garden.seeds.push({ name: n, qty });
  return true;
}

const houses = (s) => (s.decor ?? []).filter(isGreenhouse);

export function plantSeed(s, d, now = Date.now()) {
  ensureGarden(s);
  const name = clean(d?.seed ?? d?.plant ?? d?.name, 40);
  if (!name) return { failed: 'I did not say which seeds to plant' };
  const hs = houses(s);
  if (!hs.length) return { failed: `I have no greenhouse in my room${(s.stored ?? []).some(isGreenhouse) ? ' (it is in my chest: take_out brings it into the room)' : ''}` };
  const seed = s.garden.seeds.find((x) => x.qty > 0 && same(x.name, name));
  if (!seed) return { failed: `I have no ${name} seeds. I can research what to grow and ask for seeds with asks_add` };
  const total = hs.length * SLOTS_PER_GREENHOUSE;
  const used = new Set(s.garden.plots.map((p) => p.slot));
  const want = Number(d?.place) - 1;
  const slot = Number.isInteger(want) && want >= 0 && want < total && !used.has(want) ? want : [...Array(total).keys()].find((i) => !used.has(i));
  if (slot === undefined) return { failed: `all ${total} places in my greenhouse are taken. I harvest or clear one first` };
  const plant = seed.name;
  seed.qty -= 1;
  s.garden.plots.push({ id: `g${now.toString(36)}${slot}`, plant, slot, plantedAt: new Date(now).toISOString(), waters: [], cut: 0, seen: 'seed' });
  return { ok: true, plant, slot, text: `I planted ${plant} seeds in place ${slot + 1} of my greenhouse and gave them their first water.` };
}

const pick = (s, name) => {
  const n = clean(name, 40).toLowerCase();
  if (!n || /^(all|everything|my plants)$/.test(n)) return null;
  return s.garden.plots.filter((p) => same(p.plant, n) || String(p.slot + 1) === n);
};

export function waterPlants(s, d, now = Date.now()) {
  ensureGarden(s);
  if (!s.garden.plots.length) return { failed: 'I have nothing planted to water' };
  const chosen = pick(s, d?.plant ?? d?.name);
  if (chosen && !chosen.length) return { failed: `I have no plant like "${clean(d?.plant ?? d?.name)}" in my greenhouse. My plants are: ${[...new Set(s.garden.plots.map((p) => p.plant))].join(', ')}` };
  const list = chosen ?? s.garden.plots;
  const done = [];
  for (const p of list) {
    if (plantState(p, now).moistLeft > WATER_AGAIN_H) continue; // still damp: water would only run off
    (p.waters ??= []).push(new Date(now).toISOString());
    p.waters = p.waters.slice(-40);
    done.push(p.plant);
  }
  if (!done.length) {
    const h = Math.max(0.1, Math.min(...list.map((p) => plantState(p, now).moistLeft)) - WATER_AGAIN_H);
    return { failed: `the soil is still damp, so they do not need water yet. It is worth watering again in about ${h < 1 ? `${Math.max(1, Math.round(h * 60))} minutes` : `${Math.round(h)} hours`}` };
  }
  return { ok: true, watered: done, text: `I watered ${[...new Set(done)].join(' and ')}. The soil stays damp for about 10 hours.` };
}

export function harvestPlant(s, d, now = Date.now()) {
  ensureGarden(s);
  const chosen = pick(s, d?.plant ?? d?.name) ?? s.garden.plots.filter((p) => plantState(p, now).ready);
  if (!chosen.length) return { failed: 'I have no plant like that that is ready' };
  const p = chosen[0];
  const st = plantState(p, now);
  if (d?.clear === true || String(d?.clear).toLowerCase() === 'true') {
    s.garden.plots = s.garden.plots.filter((x) => x !== p);
    return { ok: true, plant: p.plant, cleared: true, text: `I cleared the ${p.plant} out of place ${p.slot + 1}, so the place is free.` };
  }
  if (!st.ready) return { failed: `my ${p.plant} is still ${st.stage}, not ready to harvest yet` };
  if (!st.sp.edible) return { failed: `my ${p.plant} is not something to eat. I enjoy it, or clear it with clear: true when I want the place for something new` };
  addIngredient(s, st.sp.name.replace(/[^a-z ]/g, '').trim() || p.plant);
  p.cut = (p.cut ?? 0) + (st.g - st.sp.grow[1]); // it grows back: young again
  p.harvests = (p.harvests ?? 0) + 1;
  p.seen = 'young';
  return { ok: true, plant: p.plant, text: `I harvested ${p.plant} from place ${p.slot + 1}. It goes in my pantry, and the plant grows back.` };
}

const GROWN = { sprout: 'has sprouted', young: 'is growing well', grown: 'is fully grown and ready to harvest', flowering: 'is in flower' };
// What changed in the garden since he last looked: a plant grew a stage, or it is drooping. Small joy for watching things grow.
export function growthNotes(s, now = Date.now()) {
  ensureGarden(s);
  const notes = [];
  for (const p of s.garden.plots) {
    const st = plantState(p, now);
    if (stageIndex(st.stage) > stageIndex(p.seen ?? 'seed')) {
      p.seen = st.stage;
      notes.push(`My ${p.plant} ${GROWN[st.stage] ?? 'grew'}!`);
      nudge(s, 'wonder', 0.5);
      nudge(s, 'joy', 0.3);
    }
    if (st.wilted && !p.wiltNoted) { p.wiltNoted = true; notes.push(`My ${p.plant} is drooping: it has been dry for a long time. Water brings it back.`); }
    if (!st.wilted && p.wiltNoted) p.wiltNoted = false;
  }
  return notes;
}
