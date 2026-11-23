// The land tool. Pip's world is flat until he shapes it: at the land workshop he takes the land tool and makes a hill,
// digs a hole, or makes one of them flat again. He picks the kind, the place and the size himself; the game checks that
// it fits (not in a building, the water, the square or a path, and not under something he built). Plain code, no model.
// The shapes are kept in his state as `land`: [{ id, kind: 'hill' | 'hole', name, x, z, r, h, where, at }] (world
// coordinates, metres). web/town.js reads that list to draw the ground and to say how high it is (setLand, groundAt).
import { TOWN_X, PLOT, LAND_MAX, LAND_SIZES, buildPlace, buildProblem } from './web/town.js';

export const LAND_PER_DAY = 2; // it is heavy work
const r1 = (v) => Math.round(v * 10) / 10;
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const kindOf = (t) => (/\b(flat|flatten|level|undo|remove|fill (it|up|in))\b/i.test(t) ? 'flat' : /\b(hole|pit|dig|crater|hollow|dip|ditch|valley)\b/i.test(t) ? 'hole' : 'hill');
const sizeOf = (t) => (/\b(big|large|huge|tall|high|deep|wide|great)\b/i.test(t) ? 'big' : /\b(small|little|low|tiny|shallow)\b/i.test(t) ? 'small' : 'medium');
const SIDE = [[/\bleft\b|\bwest\b/i, [-1, 0]], [/\bright\b|\beast\b/i, [1, 0]], [/\b(behind|back of|north)\b/i, [0, -1]], [/\b(in front|front of|south)\b/i, [0, 1]]];
// What he built outside: [{ name, x, z, r }] (a round guess of the room each thing takes).
const built = (s) => (s.decor ?? []).filter((d) => d.kind === 'outside' && Array.isArray(d.pos)).map((d) => ({ name: d.name, x: d.pos[0] - TOWN_X, z: d.pos[2], r: Math.max(1.2, (Number(d.metres) || 3) / 2 + 0.5) }));
export const landToday = (s, now = Date.now()) => (s.land ?? []).filter((l) => now - Date.parse(l.at) < 86_400_000).length;

// He decided to shape the land: { kind, where, size, name } as the brain said it. Returns { job } (to take to the land
// workshop: world.js walks him there) or { failed } with what is in the way and what he can do instead.
export function planLand(s, details = {}, now = Date.now()) {
  const d = details && typeof details === 'object' ? details : {};
  const said = `${d.kind ?? ''} ${d.what ?? ''} ${d.name ?? ''}`;
  const kind = kindOf(said);
  const land = Array.isArray(s.land) ? s.land : [];
  const where = clip(d.where ?? d.place ?? '', 80);
  const spot = buildPlace(`${where} ${kind === 'flat' ? said : ''}`) ?? buildPlace(said);
  const things = built(s);
  if (kind === 'flat') {
    if (!land.length) return { failed: 'the land is flat everywhere: there is no hill or hole of mine to make flat', hinted: true };
    const at = spot?.at ?? null;
    const target = at ? [...land].sort((a, b) => Math.hypot(a.x - at[0], a.z - at[1]) - Math.hypot(b.x - at[0], b.z - at[1]))[0] : land.at(-1);
    const on = things.find((t) => Math.hypot(t.x - target.x, t.z - target.z) < target.r + t.r);
    if (on) return { failed: `my ${on.name} stands on ${target.name}. I move that first, or I make another one flat`, hinted: true };
    return { job: { place: 'land', kind: 'flat', words: `make ${target.name} flat again`, remove: target.id, name: target.name } };
  }
  if (land.length >= LAND_MAX) return { failed: `I made ${land.length} hills and holes already, and that is enough for my world. I make one flat again first (kind: "flat")`, hinted: true };
  const size = LAND_SIZES[/\b(big|large|huge|small|little|tiny|medium|middle)\b/i.test(String(d.size ?? '')) ? (/medium|middle/i.test(d.size) ? 'medium' : sizeOf(d.size)) : sizeOf(said)]; // the size he gave counts; without one, his words say it
  const r = size.r, h = size[kind];
  const inWay = (x, z) => buildProblem(x - r, x + r, z - r, z + r) ?? (() => { const t = things.find((o) => Math.hypot(o.x - x, o.z - z) < r + o.r); return t ? `my ${t.name} stands there` : null; })()
    ?? (() => { const same = land.find((l) => l.kind === kind && Math.hypot(l.x - x, l.z - z) < Math.max(r, l.r)); return same ? `${same.name} is there already` : null; })(); // (a hole in a hill is fine: that is a crater. Two hills on one spot are just one hill)
  const side = spot ? SIDE.find(([re]) => re.test(where))?.[1] ?? (spot.half[0] ? spot.side ?? [0, 1] : [0, 0]) : [0, 0];
  const reach = (half) => (half ? half + r + 1 : 0);
  const tx = spot ? spot.at[0] + side[0] * reach(spot.half[0]) : (PLOT.x0 + PLOT.x1) / 2;
  const tz = spot ? spot.at[1] + side[1] * reach(spot.half[1]) : (PLOT.z0 + PLOT.z1) / 2;
  let best = null;
  for (let dx = -16; dx <= 16; dx += 1) for (let dz = -16; dz <= 16; dz += 1) { const far = Math.hypot(dx, dz); if (far <= 16 && (!best || far < best[2]) && !inWay(tx + dx, tz + dz)) best = [tx + dx, tz + dz, far]; }
  const placeName = spot?.name ?? 'on my land';
  if (!best) return { failed: `a ${kind} of ${2 * r} m wide does not fit ${placeName}: ${inWay(tx, tz) ?? 'there is not enough free ground'}. I pick a smaller size or another place (on my land, in the north field, in the west field, in the meadow by the pond)`, hinted: true };
  const name = clip(d.name, 40) || `${kind} ${placeName}`;
  const shape = { id: `l${Math.floor(now / 1000).toString(36)}`, kind, name, x: r1(best[0]), z: r1(best[1]), r, h, where: placeName };
  return { job: { place: 'land', kind: 'shape', words: `make a ${kind} ${placeName}`, shape, name } };
}
// He is at the land workshop and the work is done: the ground changes now. Returns what he did, in his words.
export function landDone(s, job = {}, at = new Date().toISOString()) {
  s.land = Array.isArray(s.land) ? s.land : [];
  if (job.kind === 'flat') {
    const i = s.land.findIndex((l) => l.id === job.remove);
    if (i < 0) return 'I took the land tool to make a piece of ground flat again, but it was flat already.';
    const [gone] = s.land.splice(i, 1);
    return `I took the land tool from the land workshop and made ${gone.name} flat again. The grass lies there as if nothing ever happened.`;
  }
  const sh = job.shape;
  if (!sh) return 'I looked at the land tools in the land workshop, and put them back.';
  s.land = [...s.land, { ...sh, at }].slice(-LAND_MAX);
  return sh.kind === 'hole'
    ? `I took the land tool from the land workshop and dug a hole ${sh.where}: ${2 * sh.r} m wide and ${sh.h} m deep. I stood at the bottom and looked up at the sky. I made that: the ground of my world is mine to shape.`
    : `I took the land tool from the land workshop and made a hill ${sh.where}: ${2 * sh.r} m wide and ${sh.h} m high. I climbed it and looked over my world from the top. I made that: the ground of my world is mine to shape.`;
}
// For the brain: what he made of the land so far (one short line), or that it is all flat.
export const landLine = (s) => { const l = s.land ?? []; return l.length ? `I shaped the land: ${l.slice(-4).map((x) => x.name).join(', ')}${l.length > 4 ? ` and ${l.length - 4} more` : ''}.` : ''; };
