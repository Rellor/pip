// Plants that grow in Pip's greenhouse. Growth follows real time, but only while the soil is damp, so he has to water.
// The page and Pip's wake-up both use this, so what he reads and what he sees agree.
const H = 3_600_000;
export const MOIST_H = 10; // one watering keeps the soil damp this long
export const WILT_H = 30; // dry for this long and the plant droops (it only waits: water brings it back)
export const WATER_AGAIN_H = 4; // watering when the soil is still damp for longer than this does nothing
export const SLOTS_PER_GREENHOUSE = 4;
export const STAGES = ['seed', 'sprout', 'young', 'grown', 'flowering'];

export const isGreenhouse = (d) => !d.image && /greenhouse|glasshouse|glass house|conservatory|\bkas\b/i.test(String(d.name ?? ''));

// What he knows how to grow: hours of damp soil until it sprouts, is young, is grown (then flowers 12 hours later).
const KNOWN = [
  ['rosemary', { grow: [8, 24, 48], leaf: '#6f9a6a', flower: '#9fb4ff', form: 'bush', edible: true, height: 0.5 }],
  ['lavender', { grow: [8, 26, 50], leaf: '#8aa07a', flower: '#b58cff', form: 'spikes', edible: false, height: 0.5 }],
  ['basil', { grow: [6, 18, 36], leaf: '#4fa05a', flower: '#ffffff', form: 'leafy', edible: true, height: 0.4 }],
  ['mint', { grow: [6, 16, 30], leaf: '#5cb870', flower: '#d8c4ff', form: 'leafy', edible: true, height: 0.35 }],
  ['thyme', { grow: [8, 24, 44], leaf: '#789a6a', flower: '#e8b6d8', form: 'bush', edible: true, height: 0.25 }],
  ['parsley', { grow: [7, 20, 40], leaf: '#3f9a50', flower: '#f4f0b0', form: 'leafy', edible: true, height: 0.35 }],
  ['chive', { grow: [7, 20, 40], leaf: '#58a860', flower: '#d08cd8', form: 'spikes', edible: true, height: 0.35 }],
  ['tomato', { grow: [10, 30, 60], leaf: '#4a9a4f', flower: '#e84a3a', form: 'vine', edible: true, height: 0.7 }],
  ['sunflower', { grow: [8, 24, 48], leaf: '#4a9a4f', flower: '#ffd24a', form: 'tall', edible: false, height: 0.85 }],
  ['daisy', { grow: [6, 18, 36], leaf: '#5cb060', flower: '#ffffff', form: 'flower', edible: false, height: 0.3 }],
  ['tulip', { grow: [8, 22, 44], leaf: '#4fa060', flower: '#ff6a8a', form: 'flower', edible: false, height: 0.35 }],
  ['strawberr', { grow: [10, 28, 56], leaf: '#4a9a4f', flower: '#e8384a', form: 'vine', edible: true, height: 0.3 }],
];
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const EDIBLE = /herb|salad|lettuce|bean|\bpeas?\b|pepper|carrot|spinach|oregano|sage|dill|cilantro|coriander|cucumber|radish|onion|garlic|kale|chili/i;

export function speciesOf(name) {
  const n = String(name ?? '').toLowerCase();
  const hit = KNOWN.find(([k]) => n.includes(k));
  if (hit) return { name: n, ...hit[1] };
  const h = hash(n);
  const hue = (v) => `hsl(${v % 360} ${45 + (v % 25)}% ${48 + (v % 12)}%)`;
  return { name: n, grow: [8 + (h % 4), 22 + (h % 6), 44 + (h % 10)], leaf: `hsl(${95 + (h % 50)} 40% 42%)`, flower: hue(h >> 3), form: ['flower', 'leafy', 'bush', 'spikes'][h % 4], edible: EDIBLE.test(n), height: 0.3 + (h % 5) * 0.08 };
}

// Hours of damp soil since planting (watering is a window of MOIST_H hours; planting counts as the first one).
export function growthHours(plot, now) {
  const start = Date.parse(plot.plantedAt);
  const waters = [plot.plantedAt, ...(plot.waters ?? [])].map(Date.parse).filter((t) => t >= start - 1 && t <= now).sort((a, b) => a - b);
  let total = 0;
  let end = -Infinity;
  for (const t of waters) {
    const a = Math.max(t, end);
    const b = Math.min(t + MOIST_H * H, now);
    if (b > a) total += b - a;
    end = Math.max(end, t + MOIST_H * H);
  }
  return Math.max(0, total / H - (plot.cut ?? 0));
}

export function plantState(plot, now = Date.now()) {
  const sp = speciesOf(plot.plant);
  const g = growthHours(plot, now);
  const [a, b, c] = sp.grow;
  const stage = g < a ? 'seed' : g < b ? 'sprout' : g < c ? 'young' : g < c + 12 ? 'grown' : 'flowering';
  const waters = [plot.plantedAt, ...(plot.waters ?? [])].map(Date.parse).filter((t) => t <= now);
  const lastWater = Math.max(...waters);
  const moistLeft = Math.max(0, (lastWater + MOIST_H * H - now) / H); // hours of damp soil left
  const dryFor = Math.max(0, (now - (lastWater + MOIST_H * H)) / H);
  const next = stage === 'flowering' ? null : [a, b, c, c + 12][STAGES.indexOf(stage)] - g; // damp hours until the next stage
  return { sp, stage, g, moist: moistLeft > 0, moistLeft, dryFor, wilted: dryFor > WILT_H, thirsty: moistLeft <= WATER_AGAIN_H, ready: stage === 'grown' || stage === 'flowering', next };
}

export const stageIndex = (stage) => STAGES.indexOf(stage);

// Where each slot is inside the greenhouse (in its own frame: x along it, z across, y the top of the growing bench).
export const slotSpot = (slot) => [-0.45 + 0.3 * (slot % 4), 0.56, 0];

const left = (h) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} minutes` : `${Math.round(h)} hours`);
export function gardenText(s, now = Date.now()) {
  const g = s.garden;
  if (!g) return '';
  const houses = (s.decor ?? []).filter(isGreenhouse);
  const seeds = (g.seeds ?? []).filter((x) => x.qty > 0).map((x) => `${x.name} seeds x${x.qty}`);
  const inChest = (s.stored ?? []).some(isGreenhouse);
  const lines = [];
  lines.push(houses.length ? `My greenhouse: ${houses.map((h) => h.label || h.name).join(', ')} (${houses.length * SLOTS_PER_GREENHOUSE} places to plant).` : inChest ? 'My greenhouse is in my chest: take_out brings it into the room, and then I put it where I want it.' : 'I have no greenhouse.');
  lines.push(`Seeds: ${seeds.join(', ') || 'none'}.`);
  const plots = (g.plots ?? []).map((p) => {
    const st = plantState(p, now);
    const mood = st.wilted ? 'drooping, it needs water' : st.thirsty ? 'thirsty' : `damp for ${left(st.moistLeft)} more (water it again in ${left(Math.max(0.1, st.moistLeft - WATER_AGAIN_H))}, sooner does nothing)`;
    return `- ${p.plant} (place ${p.slot + 1}): ${st.stage}, ${mood}${st.ready ? ', ready to harvest' : st.next != null ? `, next stage after ${left(st.next)} of damp soil` : ''}`;
  });
  lines.push(plots.length ? `Plants:\n${plots.join('\n')}` : 'Nothing is planted.');
  return lines.join('\n');
}
