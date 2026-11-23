// Pip's world in 3D. It is set up the easy way, like the town of Pino the bird (pinos.world): one big flat ground with a
// grid on it, and on it plain blocks. A block becomes a bakery or a house by the picture on its front (facade.js), and a
// place is just a spot Pip walks to and does something at. Nothing has an inside, except his own home: the door of his
// house here leads into his room, and the front door in his hall leads back out here.
//   - To add a building: one line in BUILDINGS (where, how big, what its front looks like, or a photo for it).
//   - To add a wall for his drawings: one line in WALLS.
// The world stands in the same scene as his house, far to the side (at x = TOWN_X). The viewer can look at it from above
// or walk through it; when Pip goes out, he is seen here. It follows the real hour, season and weather. No model, no server.
import { PEOPLE, faceSvg, hourNL, shopOpen } from './street.js';
import { seasonInfo } from './season.js';
import { makeGrain } from './grain.js';
import { makeFacades } from './facade.js';

export const TOWN_X = 220; // where the world is in the scene (his room is around x 0)
export const WORLD = { x0: -112, x1: 112, z0: -72, z1: 64 }; // the whole world: 224 x 136 m. Beyond the rim there is nothing to walk on
export const WORLD_RANGE = [WORLD.x0, WORLD.x1];
export const TOWN_RANGE = [-39, 42]; // the high street, around his home: what the view from above shows first
export const TOWN_Z = [WORLD.z0, WORLD.z1];
// Pip's own plot: a piece of land across the street from his house, where a plain "outside" puts what he makes.
export const PLOT = { x0: -11, x1: 35, z0: 12.4, z1: 26.6 };
export const inTown = (x) => x > 60;

// ---- The buildings. `at` is the middle of the front on the ground, `size` is wide, high, deep. The front looks toward the
// viewer (+z) unless `face` is 180. `look` says what the front is made of (facade.js); `tex` is a photo to use instead.
// `who` lives there (a neighbour of street.js), `lit` are the hours its windows are lit, `low` buildings on the near side
// of the street are shown low from above, so they do not hide the street.
export const BUILDINGS = [
  { key: 'jo', name: 'Oma Jo', who: 'Oma Jo', at: [-19.5, 0], size: [9.4, 3.6, 7.5], look: { wall: 'planks', color: '#f1e3c8', trim: '#fffaf0', door: { x: 2.2, color: '#5f9e63' }, windows: [[4.2, 1.0, 1.5, 1.4], [6.8, 1.0, 1.5, 1.4]] }, roof: 0x9a6b47 },
  { key: 'mo', name: 'Mo', who: 'Mo', at: [-9, 0], size: [8.2, 4.4, 7.5], look: { wall: 'brick', color: '#c9654f', door: { x: 1.9, color: '#2f4a6b' }, windows: [[3.9, 1.0, 1.4, 1.5], [6.1, 1.0, 1.4, 1.5], [3.9, 3.0, 1.2, 0.9]] }, roof: 0x6b4a44 },
  { key: 'home', name: 'Pip', who: 'Pip', at: [0, 0], size: [9, 5, 7.5], look: { wall: 'plaster', color: '#f3cf7a', door: { x: 4.5, color: '#c0392b', w: 1.2, h: 2.3 }, windows: [[1.0, 1.1, 1.9, 1.7], [6.2, 1.1, 1.9, 1.7], [3.7, 3.5, 1.6, 1.0]] }, roof: 0xe9855b, lit: [8, 23] },
  { key: 'bakery', name: 'Bakery', who: 'Kees', at: [11.5, 0], size: [9.8, 6.2, 7.5], look: { wall: 'brick', color: '#d9cbb2', door: { x: 8.3, color: '#6b4a35' }, shop: { x0: 0.8, x1: 6.2, awning: '#d9483b' }, windows: [[1.4, 3.9, 1.5, 1.4], [5.2, 3.9, 1.5, 1.4]], sign: { text: 'BAKERY', bg: '#6b4a35', fg: '#fff3d6', y: 3.05, x: 3.5 } }, roof: 0x7c6a5c, lit: [6.5, 18] },
  { key: 'dot', name: 'Dot', who: 'Dot', at: [21.5, 0], size: [6.8, 4, 7.5], look: { wall: 'boards', color: '#9cc9e2', door: { x: 1.6, color: '#f2c14e' }, windows: [[3.5, 1.0, 1.2, 1.4], [5.2, 1.0, 1.1, 1.4]] }, roof: 0x4f7fa3 },
  { key: 'shop', name: 'Corner shop', at: [33, 0], size: [11.6, 4.4, 7.5], look: { wall: 'metal', color: '#4f9c91', door: { x: 7.4, color: '#2f5f58' }, shop: { x0: 0.8, x1: 6.2, awning: '#f2c14e', goods: ['#ef6f6c', '#f2c14e', '#8cc27a'] }, shutter: { x0: 8.6, x1: 11 }, sign: { text: 'CORNER SHOP', bg: '#fff8ee', fg: '#2f5f58', y: 3.3, x: 4.6 } }, roof: 0x3d7d74, lit: [9, 18] },
  { key: 'library', name: 'Library', at: [57, 0.4], size: [16, 7, 9], look: { wall: 'stone', color: '#e3d2b6', columns: 4, door: { x: 8, color: '#7a5237', w: 2.2, h: 3.4 }, windows: [[2.6, 1.6, 1.3, 2.6], [12.1, 1.6, 1.3, 2.6]], sign: { text: 'LIBRARY', bg: '#f1e6d2', fg: '#7a5237', y: 6.0, x: 8, size: 0.55 } }, roof: 0x8a5a3a, lit: [10, 17] },
  { key: 'workshop', name: 'Print workshop', at: [84, 0], size: [11, 5, 8], look: { wall: 'metal', color: '#9aa3a8', door: { x: 1.8, color: '#c9773c' }, shutter: { x0: 3.6, x1: 9.8 }, sign: { text: 'PRINT WORKSHOP', bg: '#2a2a2e', fg: '#f2c14e', y: 3.5, x: 6.7, size: 0.45 } }, roof: 0x5c6468, lit: [9, 18] },
  { key: 'studio', name: 'Art workshop', at: [58, 11.5], face: 180, size: [12, 5, 8], look: { wall: 'boards', color: '#e8dcc6', door: { x: 2, color: '#e9855b' }, windows: [[4.4, 1.2, 2.2, 1.9], [8.2, 1.2, 2.2, 1.9]], sign: { text: 'PIP’S ART', bg: '#e9855b', fg: '#ffffff', y: 3.6, x: 6 } }, roof: 0xe9855b, lit: [9, 21] },
  { key: 'lina', name: 'Lina', who: 'Lina', at: [-18.5, 11.8], face: 180, low: true, size: [10.2, 4.6, 7.2], look: { wall: 'plaster', color: '#b9a4dd', door: { x: 7.8, color: '#5b3f8f' }, windows: [[1.2, 1.0, 1.6, 1.5], [4.2, 1.0, 1.6, 1.5], [1.2, 3.1, 1.3, 0.9]] }, roof: 0x5b3f8f },
];
// A building's place on the ground: [x0, x1, z0, z1].
export const rectOf = (b) => { const [w, , d] = b.size; return b.face === 180 ? [b.at[0] - w / 2, b.at[0] + w / 2, b.at[1], b.at[1] + d] : [b.at[0] - w / 2, b.at[0] + w / 2, b.at[1] - d, b.at[1]]; };
// ---- Walls for his art (like Pino's numbered walls): a bare concrete wall somewhere in the world. Every drawing he makes
// is also pasted on one of them, over the older ones. `at` is its middle, `len` how long, `turn` 90 for a wall that runs
// away from the viewer.
export const WALLS = [
  { key: 'wall_1', name: 'the wall by the corner shop', at: [44, -1.2], len: 7 },
  { key: 'wall_2', name: 'the wall in the park', at: [-53, -6.5], len: 8 },
  { key: 'wall_3', name: 'the wall by my plot', at: [41.5, 20.5], len: 8 },
  { key: 'wall_4', name: 'the long wall behind the houses', at: [-2, -14], len: 16 },
  { key: 'wall_5', name: 'the wall by the workshop', at: [96, -1.2], len: 8 },
];
export const WALL_H = 3.4;
// ---- Where he can paint (like the tags on the walls of Pino's town). He needs no paper and no supplies for it. He picks
// the wall himself: one of the art walls, or the back wall of any building in the street; or he leaves it open and one is
// picked for him. `side` is the face he paints on (1: the one that looks toward the houses' backs, -1: the other).
const BACK_NAME = { jo: 'Oma Jo’s house', mo: 'Mo’s house', home: 'my own house', bakery: 'the bakery', dot: 'Dot’s house', shop: 'the corner shop', library: 'the library', workshop: 'the print workshop' };
export const PAINT_WALLS = [
  { key: 'wall_1', words: /corner shop|shop/, via: ['right'] }, { key: 'wall_2', words: /park|pond/, via: ['left', 'parkGate'] }, { key: 'wall_3', words: /plot/, via: ['right'], side: -1 },
  { key: 'wall_4', words: /long|behind/, via: ['gap', 'gapBack'] }, { key: 'wall_5', words: /workshop|print/, via: ['right', 'pastShelf'] },
].map((t) => { const w = WALLS.find((x) => x.key === t.key); const side = t.side ?? 1; return { ...t, name: w.name, x: w.at[0], z: w.at[1] + side * 0.21, len: w.len, h: WALL_H, side, spot: [w.at[0], w.at[1] + side * 1.95] }; })
  .concat(BUILDINGS.filter((b) => BACK_NAME[b.key]).map((b) => { const z = b.at[1] - b.size[2]; return { key: `back_${b.key}`, back: b.key, name: `the back wall of ${BACK_NAME[b.key]}`, x: b.at[0], z: z - 0.03, len: b.size[0], h: b.size[1], side: -1, spot: [b.at[0], z - 1.9], via: ['gap', 'gapBack'] }; }));
// "the wall by the corner shop", "the back of the bakery", "any wall": the wall he means. No wall named: one of them, by `seed`.
export function paintTarget(text, seed = 0) {
  const norm = (v) => String(v ?? '').toLowerCase().replace(/[’']/g, '');
  const t = norm(text);
  const word = (w) => norm(w.name).replace(/^the back wall of (the |my own )?/, '').replace(/s house$/, ''); // "bakery", "oma jo", "house" (his own)
  const backs = PAINT_WALLS.filter((w) => w.back);
  const backOf = () => backs.find((w) => w.back !== 'home' && t.includes(word(w))) ?? (/\b(my|own|home)\b/.test(t) ? backs.find((w) => w.back === 'home') : null);
  return PAINT_WALLS.find((w) => t.includes(norm(w.name)))
    ?? (/\bback\b/.test(t) ? backOf() : null)
    ?? PAINT_WALLS.find((w) => !w.back && w.words.test(t))
    ?? backOf()
    ?? PAINT_WALLS[Math.abs(Math.floor(seed)) % PAINT_WALLS.length];
}
const wallRect = (w) => (w.turn === 90 ? [w.at[0] - 0.25, w.at[0] + 0.25, w.at[1] - w.len / 2, w.at[1] + w.len / 2] : [w.at[0] - w.len / 2, w.at[0] + w.len / 2, w.at[1] - 0.25, w.at[1] + 0.25]);

// Places Pip is seen at (x along the street, z toward the viewer; the house fronts are at z 0).
export const TOWN_SPOTS = {
  door: { x: 0, z: 1.1, face: 0 }, // in front of Pip's own door
  step: { x: 0.2, z: 0.62, face: 0, y: 0.2 }, // on his own doorstep
  shop: { x: 34.6, z: 1.0, face: Math.PI },
  garden: { x: -29.5, z: -3.4, face: 0.6 }, // between Oma Jo's vegetable beds
  gate: { x: -25.6, z: 0.9, face: Math.PI }, // her garden gate: the way in and out
  gateIn: { x: -25.7, z: -1.3, face: Math.PI }, // just inside it
  left: { x: -38, z: 1.2, face: -Math.PI / 2 }, // the way to the pond, and up the hill
  right: { x: 41, z: 1.2, face: Math.PI / 2 }, // the way to the library
  parkGate: { x: -44, z: 1.4, face: -Math.PI / 2 },
  pond: { x: -58.5, z: 5.6, face: 0.25 }, // by the bench under the willow, looking over the water
  hillFoot: { x: -62, z: -6, face: Math.PI },
  hillBend: { x: -72, z: -15, face: Math.PI },
  hill: { x: -65.2, z: -23.2, face: 0.5 }, // on the top, by the bench
  libFront: { x: 46, z: 3.6, face: Math.PI / 2 },
  library: { x: 57, z: 3.6, face: Math.PI }, // at the library door
  workshop: { x: 80.3, z: 1.1, face: Math.PI }, // at the door of the print workshop
  gap: { x: 5.55, z: 1.2, face: Math.PI }, // the alley between his house and the bakery: the way to the back of the houses
  gapBack: { x: 5.55, z: -9.6, face: Math.PI },
  pastShelf: { x: 89.6, z: 1.4, face: Math.PI / 2 }, // past the shelf of prints, on the way to the wall by the workshop
  ...Object.fromEntries(PAINT_WALLS.map((w) => [`paint_${w.key}`, { x: w.spot[0], z: w.spot[1], face: w.side > 0 ? Math.PI : 0 }])), // in front of each wall he can paint on
};
// Where Pip is seen for each place of his world: [the spot, 'in' when he goes inside there (then he is out of sight)].
export const TOWN_FOR = { doorstep: ['step', ''], shop: ['shop', ''], garden: ['garden', ''], pond: ['pond', ''], hill: ['hill', ''], library: ['library', 'in'], workshop: ['workshop', ''], walls: ['paint_wall_1', ''] };
// The way to each spot from his door: the corners he walks by, one after the other (the way home is the same, backwards).
// (A route can also be for one spot: the way to each wall he paints on. The page looks for the spot first, then the place.)
export const ROUTES = { garden: ['gate', 'gateIn'], pond: ['left', 'parkGate'], hill: ['left', 'parkGate', 'hillFoot', 'hillBend'], library: ['right', 'libFront'], workshop: ['right'], ...Object.fromEntries(PAINT_WALLS.map((w) => [`paint_${w.key}`, w.via])) };
export const POND = { x: -64, z: 14, rx: 11.5, rz: 6.5 };
export const HILL = { x: -66, z: -24, r: 21, h: 8.5 };
// How high the ground is (the hill): street coordinates in, metres out. Everywhere else the ground is flat.
export function groundAt(lx, z) {
  const d = Math.hypot(lx - HILL.x, z - HILL.z) / HILL.r;
  return d >= 1 ? 0 : HILL.h * (1 - d * d) ** 2;
}
export const townGround = (x, z) => groundAt(x - TOWN_X, z);
// What cannot be walked through: [x0, x1, z0, z1] (every building and wall, and the fence of Oma Jo's garden).
export const PRINT_SHELF = { x0: 82.3, x1: 88.1, z: 0.42, rows: [0.62, 1.32, 2.02], per: 7 }; // the shelf in front of the print workshop: 21 prints
export const PRINT_SLOTS = PRINT_SHELF.rows.flatMap((y) => Array.from({ length: PRINT_SHELF.per }, (_, i) => [PRINT_SHELF.x0 + 0.45 + i * ((PRINT_SHELF.x1 - PRINT_SHELF.x0 - 0.9) / (PRINT_SHELF.per - 1)), y, PRINT_SHELF.z]));
const BLOCKS = [...BUILDINGS.map(rectOf), ...WALLS.map(wallRect), [-36.2, -35.4, -7.5, 0.3], [-36.2, -24.6, -7.6, -7.2], [-36.2, -26.6, -0.1, 0.25], [PRINT_SHELF.x0 - 0.1, PRINT_SHELF.x1 + 0.1, 0, 0.8]];
export function townBlocked(x, z, pad = 0.3) {
  const lx = x - TOWN_X;
  if (lx < WORLD.x0 + 0.4 || lx > WORLD.x1 - 0.4 || z < WORLD.z0 + 0.4 || z > WORLD.z1 - 0.4) return true; // the rim of the world
  if (((lx - POND.x) / (POND.rx + pad)) ** 2 + ((z - POND.z) / (POND.rz + pad)) ** 2 < 1) return true; // the water
  return BLOCKS.some(([x0, x1, z0, z1]) => lx > x0 - pad && lx < x1 + pad && z > z0 - pad && z < z1 + pad);
}
// Standing right in front of Pip's door in the street (for the viewer who walks: this is the way back into the hall).
export const atTownDoor = (x, z) => Math.abs(x - TOWN_X) < 0.75 && z < 0.75 && z > -0.2;

// ---- Where Pip may build (decor.js). He picks the place himself, anywhere in his world. The only rule: it has to fit.
// It may not stand in a building, in the water, on a tree or on what is already there, and the ways people walk must stay
// free (the pavement along the doors, the path to the pond, the way up the hill). It can be bigger than a house.
export const BUILD_MAX = { w: 20, h: 18, d: 20 };
// What stands there already: [what it is, x0, x1, z0, z1] and [what it is, x, z, radius] (street coordinates).
const KEEP_RECTS = [
  ...BUILDINGS.map((b) => { const [x0, x1, z0, z1] = rectOf(b); return [b.who && b.who !== 'Pip' ? `${b.who}’s house stands there` : b.key === 'home' ? 'my own house stands there' : `the ${b.name.toLowerCase()} stands there`, x0 - 0.6, x1 + 0.6, z0 - 0.6, z1 + 0.6]; }),
  ...WALLS.map((w) => { const [x0, x1, z0, z1] = wallRect(w); return ['my drawings hang on the wall there, and people must be able to see them', x0 - 1.6, x1 + 1.6, z0 - 1.6, z1 + 1.6]; }),
  ...PAINT_WALLS.filter((w) => w.back).map((w) => ['I paint on that back wall, and people must be able to see it', w.x - w.len / 2, w.x + w.len / 2, w.z - 2.6, w.z]),
  ['Oma Jo’s garden is there', -36.6, -24.4, -8, 0.4], ['the pavement along the doors must stay free to walk on', -45, 92, 0.25, 2.5],
  ['the path to the pond must stay free to walk on', -71.5, -39, 0.2, 2.6],
];
const TREES = [[-37.5, -5.5, 1.1], [-25.2, 10.2, 0.9], [5.5, -13.5, 0.8], [-13, 24, 1.1], [40, -5, 1.1], [39.5, 14, 0.9], [-36, 13, 1], [-30, 25, 1.2], [39, 25.5, 1], [-45, -8, 1.1], [-52, -16, 1], [-84, 2, 1.2], [-86, 18, 1], [-78, 24, 1.1], [-47, 22, 0.9], [-86, -14, 1.1], [-50, -34, 1.2], [-84, -36, 1], [-74, 8, 0.8], [47.5, -5, 1], [70, -4, 1.1], [71.5, 13, 1], [47, 16, 1.1], [68, 25, 1.2]];
const STONES = [[-60.5, -1.5], [-61.5, -4], [-62, -6.5], [-64, -9], [-67, -11.5], [-70, -13.8], [-72, -16], [-71.2, -18.6], [-69, -20.6], [-66.8, -22.2]];
const KEEP_ROUND = [
  ...TREES.map(([x, z, k]) => ['a tree stands there', x, z, 1.5 * k]), ...STONES.map(([x, z]) => ['the path up the hill must stay free', x, z, 1.3]),
  ['the willow stands there', -52.8, 6.4, 3], ['a bench stands there', -60.5, 5.2, 2.2], ['a bench stands there', -69, 5.6, 1.8],
  ['the bench and the flag on the hilltop stand there', HILL.x + 0.8, HILL.z - 0.3, 3.4], ['the green stone stands there', -82, -6, 3], ['the sign of my plot stands there', -2.2, 12.1, 0.9],
];
// The ways he walks himself (ROUTES): they stay free too, from corner to corner.
const WALKS = [...Object.entries(TOWN_FOR).map(([place, [spot]]) => [place, spot, ROUTES[place] ?? []]), ...PAINT_WALLS.map((w) => ['walls', `paint_${w.key}`, w.via])].flatMap(([place, spot, via]) => { const pts = ['door', ...via, spot].map((k) => TOWN_SPOTS[k]); return pts.slice(1).map((b, i) => [pts[i], b, place]); });
const inRect = (x, z, x0, x1, z0, z1, pad = 0) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;
// null when a thing with this footprint (street coordinates) can stand there, otherwise what is in the way, in his words.
export function buildProblem(x0, x1, z0, z1) {
  if (x0 < WORLD.x0 + 0.5 || x1 > WORLD.x1 - 0.5 || z0 < WORLD.z0 + 0.5 || z1 > WORLD.z1 - 0.5) return 'my world ends there';
  for (const [why, a, b, c, d] of KEEP_RECTS) if (x0 < b && x1 > a && z0 < d && z1 > c) return why;
  const nearX = (x) => Math.max(x0, Math.min(x1, x));
  const nearZ = (z) => Math.max(z0, Math.min(z1, z));
  for (const [why, x, z, r] of KEEP_ROUND) if (Math.hypot(nearX(x) - x, nearZ(z) - z) < r) return why;
  { const x = nearX(POND.x); const z = nearZ(POND.z); if (((x - POND.x) / (POND.rx + 1.3)) ** 2 + ((z - POND.z) / (POND.rz + 1.3)) ** 2 < 1) return 'the pond is there'; }
  if (x0 < PLOT.x1 + 0.3 && x1 > PLOT.x0 - 0.3 && z0 < PLOT.z1 + 0.3 && z1 > PLOT.z0 - 0.3 && !(x0 >= PLOT.x0 + 0.3 && x1 <= PLOT.x1 - 0.3 && z0 >= PLOT.z0 + 0.3 && z1 <= PLOT.z1 - 0.3)) return 'the fence of my plot runs there';
  for (const [a, b, place] of WALKS) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.6));
    for (let i = 0; i <= n; i++) if (inRect(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n, x0, x1, z0, z1, 1.1)) return `my own way to ${place === 'doorstep' ? 'my doorstep' : place === 'walls' ? 'a wall I paint on' : `the ${place}`} must stay free`;
  }
  return null;
}
// The places he can name. `at` is the middle, `half` how far it reaches (a thing goes beside it, not in it), `needs` the
// place of his world he must know first (world.js). The first place named in his words counts.
export const BUILD_PLACES = [
  { key: 'plot', name: 'on my plot', words: /\b(my |the )?(plot|own land|own field|yard)\b/i, at: [12, 19.5], half: [0, 0] },
  { key: 'pond', name: 'by the pond', words: /\bpond\b/i, at: [POND.x, POND.z], half: [POND.rx + 1.3, POND.rz + 1.3], needs: 'pond' },
  { key: 'willow', name: 'by the willow', words: /\bwillow\b/i, at: [-52.8, 6.4], half: [3, 3], needs: 'pond' },
  { key: 'stone', name: 'by the green stone', words: /\b(green|glowing) stone\b/i, at: [-82, -6], half: [3, 3], needs: 'pond' },
  { key: 'hilltop', name: 'on top of the hill', words: /\b(hill ?top|top of the hill|on the hill|up the hill)\b/i, at: [HILL.x - 5.5, HILL.z + 1], half: [0, 0], needs: 'hill' },
  { key: 'hillfoot', name: 'at the foot of the hill', words: /\b(foot|bottom) of the hill\b/i, at: [-54, -4], half: [0, 0], needs: 'hill' },
  { key: 'hillside', name: 'on the side of the hill', words: /\b(hill ?side|slope|hill)\b/i, at: [-55, -18], half: [0, 0], needs: 'hill' },
  { key: 'library', name: 'by the library', words: /\blibrary\b/i, at: [57, -4.1], half: [8.6, 5.1], needs: 'library' },
  { key: 'workshop', name: 'by the print workshop', words: /\b(print )?workshop\b/i, at: [84, -4], half: [6.1, 4.6] },
  { key: 'bakery', name: 'in the street by the bakery', words: /\b(bakery|kees)\b/i, at: [11.5, 5.4], half: [0, 0] },
  { key: 'shop', name: 'in the street by the corner shop', words: /\b(corner )?shop\b/i, at: [33, 5.4], half: [0, 0] },
  { key: 'mo', name: 'in the street by Mo’s house', words: /\bmo(’s|'s)|\b(by|near|of) mo\b/i, at: [-9, 5.4], half: [0, 0] },
  { key: 'jo', name: 'in the street by Oma Jo’s house', words: /\b(oma jo|jo(’s|'s))/i, at: [-22, 5.4], half: [0, 0] },
  { key: 'dot', name: 'in the street by Dot’s house', words: /\bdot(’s|'s)|\b(by|near|of) dot\b/i, at: [21.5, 5.4], half: [0, 0] },
  { key: 'lina', name: 'by Lina’s house', words: /\blina\b/i, at: [-18.5, 15.4], half: [5.9, 4.4], side: [0, -1] }, // her door is on the street side
  { key: 'north', name: 'in the north field', words: /\bnorth(ern)? field\b|\bbehind (the|my) houses?\b/i, at: [18, -36], half: [0, 0] }, // the big empty land behind the houses
  { key: 'south', name: 'in the south field', words: /\bsouth(ern)? field\b/i, at: [10, 44], half: [0, 0] },
  { key: 'east', name: 'in the east field', words: /\beast(ern)? field\b/i, at: [92, 30], half: [0, 0] },
  { key: 'park', name: 'in the park', words: /\b(park|meadow)\b/i, at: [-46, 16], half: [0, 0], needs: 'pond', wide: true },
  { key: 'street', name: 'in the street in front of my house', words: /\b(street|road|my (front )?door|my house|my home|doorstep)\b/i, at: [0, 5.4], half: [0, 0], wide: true },
];
// "outside by the pond", "in the park", "on top of the hill" -> the place he means (null for a plain "outside").
export function buildPlace(text) {
  const t = String(text ?? '');
  const hits = BUILD_PLACES.map((p) => ({ p, i: t.search(p.words) })).filter((h) => h.i >= 0);
  if (!hits.length) return null;
  const exact = hits.filter((h) => !h.p.wide); // "in the park by the pond" is the pond, "in the street by the shop" the shop
  return (exact.length ? exact : hits).sort((a, b) => a.i - b.i)[0].p;
}
// Is this "where" a place out in his world? "outside ...", or one of the places with a word like by, in, on, at before it.
const PLACE_WORDS = /\b(by|at|near|in|on|beside|next to|in front of|behind|left of|right of|top of|foot of|across from|up)\s+(the |my )?(pond|park|hill|hilltop|hillside|library|street|road|meadow|willow|green stone|bakery|corner shop|plot|print workshop|workshop|north field|south field|east field)\b(?!\s+(lamp|light|sign|map|picture|painting|drawing|photo|model|book|shelf|poster|print|view))/i;
export const worldPhrase = (text) => PLACE_WORDS.exec(String(text ?? ''))?.[0] ?? null; // "by the pond" out of a longer sentence
export const worldWhere = (text) => /\b(outside|outdoors?)\b/i.test(String(text ?? '')) || PLACE_WORDS.test(String(text ?? ''));

// Where on its wall a painting is: always the same for the same painting (from its id), so the walls do not reshuffle.
// Returns { n (a number made from the id), u (0..1 along the wall), tilt }.
export function artSpot(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { n: h, u: ((h >>> 8) % 1000) / 1000, tilt: (((h >>> 24) % 100) / 100 - 0.5) * 0.14 };
}

export function buildTown(THREE) {
  const group = new THREE.Group();
  group.position.x = TOWN_X;
  const mats = []; // plain coloured things: at dusk and at night they keep a little of their own colour
  const skins = []; // things with a picture on them (fronts, the ground, his drawings): the same, by their picture
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const jit = (by) => (rnd() - 0.5) * 2 * by; // a little crooked, never the same twice
  const grain = makeGrain(THREE); // rough skins for the plain things (grain.js)
  const facade = makeFacades(THREE); // the fronts of the buildings (facade.js)
  const M = (color, o = {}, kind = 'plain', rx = 1, ry = 1) => { const map = o.transparent ? null : grain(kind, rx, ry); const m = new THREE.MeshStandardMaterial({ color, roughness: 0.94, ...(map ? { map, emissiveMap: map } : {}), ...o }); mats.push(m); return m; };
  const skin = (map, k = 1) => { const m = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.14 * k, roughness: 0.95 }); m.userData.k = k; skins.push(m); return m; };
  const add = (geo, material, [x, y, z], parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (size, color, pos, parent = group) => add(new THREE.BoxGeometry(...size), typeof color === 'number' ? M(color) : color, pos, parent);
  const cyl = (r0, r1, h, color, pos, parent = group, seg = 12) => add(new THREE.CylinderGeometry(r0, r1, h, seg), typeof color === 'number' ? M(color) : color, pos, parent);
  const se = seasonInfo(new Date());
  const state = { weather: null };
  const snowy = () => /snow/.test(String(state.weather?.kind ?? '')) || (se.frozen && (state.weather?.temp ?? 5) <= 0);
  const tex = (src) => { const t = new THREE.TextureLoader().load(src); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const svgTex = (svg) => tex(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const signs = [];
  const sign = (text, w, h, bg, fg, font = 44) => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = Math.round((512 * h) / w);
    const g = c.getContext('2d');
    const draw = (words, back = bg) => { g.fillStyle = back; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = `800 ${font}px "Marker Felt", "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(words, c.width / 2, c.height / 2 + 2); t.needsUpdate = true; };
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    draw(text);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
    mesh.userData.draw = draw;
    signs.push(mesh.material);
    return mesh;
  };

  // ---- the ground: one big flat field, with the hill pushed up out of it. Its colour follows the season (white in snow);
  // a faint line every 4 m shows how far things are.
  const tintOf = () => (snowy() ? 0xf4f8fa : se.name === 'autumn' ? 0xa8c373 : se.name === 'winter' ? 0xadc49a : 0x8fcf7c);
  const gridTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 520; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '60,70,40'},${0.05 + rnd() * 0.1})`; g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 3)); }
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.strokeRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })();
  const WW = WORLD.x1 - WORLD.x0, WD = WORLD.z1 - WORLD.z0;
  const groundGeo = new THREE.PlaneGeometry(WW, WD, Math.round(WW / 2), Math.round(WD / 2));
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate((WORLD.x0 + WORLD.x1) / 2, 0, (WORLD.z0 + WORLD.z1) / 2);
  { const pos = groundGeo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)) - 0.03); groundGeo.computeVertexNormals(); }
  const groundTex = gridTex.clone(); groundTex.needsUpdate = true; groundTex.repeat.set(WW / 4, WD / 4);
  const ground = add(groundGeo, skin(groundTex), [0, 0, 0]);
  ground.material.userData.tint = tintOf();
  ground.receiveShadow = true;
  box([WW + 0.6, 0.7, WD + 0.6], 0x8a6a4c, [(WORLD.x0 + WORLD.x1) / 2, -0.4, (WORLD.z0 + WORLD.z1) / 2]); // the slab it lies on
  // the high street: a strip of asphalt past the doors, and a path of gravel on to the pond
  const road = box([138, 0.05, 5.8], M(0x8f8a86, {}, 'road', 34, 2), [23.5, 0.0, 5.4]);
  for (let x = -42; x <= 90; x += 6) box([2.4, 0.02, 0.16], 0xf4efe6, [x, 0.035, 5.4]);
  const gravel = M(0xe2d5bd);
  box([32, 0.05, 2.2], gravel, [-55, 0.01, 1.4]);
  for (const [x, z] of STONES) cyl(0.55, 0.6, 0.12, gravel, [x, groundAt(x, z) + 0.04, z]);
  road.receiveShadow = true;
  // his plot: a field marked out with a low fence and a sign
  const field = box([PLOT.x1 - PLOT.x0, 0.05, PLOT.z1 - PLOT.z0], M(0xb4dc9a, {}, 'grass', 14, 4), [(PLOT.x0 + PLOT.x1) / 2, 0.0, (PLOT.z0 + PLOT.z1) / 2]);
  for (let x = PLOT.x0; x <= PLOT.x1 + 0.01; x += 2) for (const z of [PLOT.z0, PLOT.z1]) if (!(z === PLOT.z0 && Math.abs(x - 1) < 2.5)) box([0.14, 0.5, 0.14], 0xfff8ee, [x, 0.25, z]);
  for (let z = PLOT.z0; z <= PLOT.z1 + 0.01; z += 2) for (const x of [PLOT.x0, PLOT.x1]) box([0.14, 0.5, 0.14], 0xfff8ee, [x, 0.25, z]);
  { cyl(0.06, 0.06, 1.5, 0x7a5237, [-2.2, 0.75, PLOT.z0 - 0.3]); for (const [dz, ry] of [[-0.36, Math.PI], [-0.24, 0]]) { const sg = sign('Pip’s plot', 2.2, 0.55, '#fde3c4', '#8a4a2c', 84); sg.position.set(-2.2, 1.45, PLOT.z0 + dz); sg.rotation.y = ry; group.add(sg); } }

  // ---- the buildings: a block, a picture on its front, a flat roof
  const blocks = []; // { b, g, glow: the lit windows }
  const roofs = []; // roofs turn white in the snow
  const lowOnes = [];
  BUILDINGS.forEach((b, i) => {
    const [w, h, d] = b.size;
    const g = new THREE.Group();
    g.position.set(b.at[0], 0, b.at[1]);
    g.rotation.y = ((b.face ?? 0) * Math.PI) / 180;
    group.add(g);
    const front = b.tex ? { map: Object.assign(tex(b.tex), { magFilter: THREE.NearestFilter }), glow: null } : facade({ ...b.look, seed: i + 1 }, w, h);
    const side = facade({ wall: b.look.wall, color: b.look.color, trim: b.look.trim, windows: b.look.sideWindows ?? [[d / 2 - 0.6, 1.1, 1.2, 1.3]], seed: i + 41 }, d, h);
    const back = facade({ wall: b.look.wall, color: b.look.color, trim: b.look.trim, seed: i + 83 }, w, h);
    const top = M(b.roof ?? 0x6b6460, {}, 'roof', w / 3, d / 3);
    const body = add(new THREE.BoxGeometry(w, h, d), [skin(side.map), skin(side.map), top, top, skin(front.map), skin(back.map)], [0, h / 2, -d / 2], g);
    body.castShadow = true;
    const cap = box([w + 0.36, 0.22, d + 0.36], M(b.roof ?? 0x6b6460, {}, 'roof', w / 3, d / 3), [0, h + 0.11, -d / 2], g); // the edge of the roof
    roofs.push({ m: cap, color: b.roof ?? 0x6b6460 });
    let glow = null;
    if (front.glow) { glow = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: front.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }), [0, h / 2, 0.02], g); }
    if (b.who) { // who lives here: a small portrait by the door
      const dx = (b.look.door?.x ?? w / 2) - w / 2;
      const px = dx + (dx > 0 ? -1 : 1) * 1.15;
      box([0.86, 0.86, 0.05], 0xfff8ee, [px, 1.75, 0.03], g);
      add(new THREE.PlaneGeometry(0.74, 0.74), new THREE.MeshBasicMaterial({ map: svgTex(faceSvg(b.who, 256)), transparent: true }), [px, 1.75, 0.062], g);
      const s = sign(b.name, 0.86, 0.3, '#fffaf3', '#4a3d35', 150); s.position.set(px, 1.12, 0.035); g.add(s);
    }
    if (b.low) lowOnes.push(g);
    blocks.push({ b, g, glow });
  });
  const blockOf = (key) => blocks.find((x) => x.b.key === key);
  // small things on some of them: Pip's doorstep and letterbox, the clock on the bakery, the OPEN sign of the shop
  box([1.7, 0.2, 0.75], 0xd9cdb8, [0, 0.1, 0.42]);
  cyl(0.04, 0.04, 1.0, 0x7a5237, [2.7, 0.5, 0.75]); box([0.5, 0.32, 0.3], 0xc0392b, [2.7, 1.1, 0.75]);
  const letter = box([0.3, 0.2, 0.02], 0xfff8ee, [2.7, 1.32, 0.75]);
  const handPivots = [];
  { const g = blockOf('bakery').g; cyl(0.62, 0.62, 0.1, 0xfff8ee, [3.4, 5.25, 0.06], g, 24).rotation.x = Math.PI / 2; for (const [len, wd] of [[0.48, 0.05], [0.32, 0.08]]) { const p = new THREE.Group(); p.position.set(3.4, 5.25, 0.13); g.add(p); box([wd, len, 0.02], 0x3b2f2a, [0, len / 2, 0], p); handPivots.push(p); } }
  const openSign = sign('OPEN', 0.84, 0.3, '#4caf6a', '#ffffff', 150);
  openSign.position.set(1.6, 1.5, 0.04); blockOf('shop').g.add(openSign);
  // Oma Jo's vegetable garden: soil, green rows, a low fence, a little shed
  box([11.4, 0.06, 7.4], M(0x8a6a48), [-30.4, 0.01, -3.7]);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 9; k++) add(new THREE.SphereGeometry(0.22, 8, 6), M(se.leafOn <= 0.05 ? 0x9a8f5a : 0x5f9e63), [-35.2 + k * 1.0, 0.2, -6.3 + i * 1.5]);
  for (let x = -36.2; x <= -24.6; x += 1.45) { box([0.1, 0.9, 0.1], 0xfff8ee, [x, 0.45, -7.4]); if (x < -26.6 || x > -24.7) box([0.1, 0.9, 0.1], 0xfff8ee, [x, 0.45, 0.1]); }
  for (let z = -7.4; z <= 0.1; z += 1.5) box([0.1, 0.9, 0.1], 0xfff8ee, [-36.2, 0.45, z]);
  box([11.6, 0.08, 0.06], 0xfff8ee, [-30.4, 0.75, -7.4]); box([0.06, 0.08, 7.5], 0xfff8ee, [-36.2, 0.75, -3.65]); box([9.6, 0.08, 0.06], 0xfff8ee, [-31.4, 0.75, 0.1]);
  box([2.2, 1.9, 2], M(0xb98a5a, {}, 'boards', 1, 2), [-26.2, 0.95, -5.8]); box([2.5, 0.16, 2.3], M(0x7a5237, {}, 'roof'), [-26.2, 1.98, -5.8]);

  // ---- walls for his art: bare concrete, both sides. What he paints goes on them, and on the back walls of the houses.
  WALLS.forEach((w, i) => {
    const g = new THREE.Group();
    g.position.set(w.at[0], 0, w.at[1]);
    g.rotation.y = w.turn === 90 ? Math.PI / 2 : 0;
    group.add(g);
    const f = facade({ wall: 'concrete', color: '#aaa69f', plain: true, seed: 200 + i }, w.len, WALL_H);
    const f2 = facade({ wall: 'concrete', color: '#a39f98', plain: true, seed: 300 + i }, w.len, WALL_H);
    const edge = M(0x8d8880);
    add(new THREE.BoxGeometry(w.len, WALL_H, 0.4), [edge, edge, edge, edge, skin(f.map), skin(f2.map)], [0, WALL_H / 2, 0], g).castShadow = true;
  });
  const painted = new THREE.Group(); // his paintings on the walls
  const gallery = new THREE.Group(); // every drawing he ever made, on the outside of the art workshop
  group.add(painted, gallery);
  const artTex = new Map(); // a drawing's picture, loaded once
  // the shelf of the print workshop: three boards under a little roof, in front of the shutter (main.js puts his prints on it)
  { const sh = PRINT_SHELF; const w = sh.x1 - sh.x0; const cx = (sh.x0 + sh.x1) / 2;
    for (const y of sh.rows) box([w, 0.06, 0.62], M(0xc9a26a, {}, 'boards', 4, 1), [cx, y - 0.03, sh.z]);
    for (const x of [sh.x0 + 0.05, cx, sh.x1 - 0.05]) for (const z of [sh.z - 0.27, sh.z + 0.27]) box([0.07, 2.75, 0.07], 0x7a5237, [x, 1.375, z]);
    box([w + 0.3, 0.07, 0.9], M(0x5c6468, { metalness: 0.3 }, 'metal', 5, 1), [cx, 2.8, sh.z + 0.05]).rotation.x = 0.12;
    const sg = sign('printed by Pip', 2.2, 0.36, '#2a2a2e', '#f2c14e', 60); sg.position.set(cx, 2.55, sh.z + 0.33); group.add(sg); }

  // ---- trees (their leaves follow the real season), lamps, poles with wires
  const leaf = se.leafOn <= 0.05 ? null : se.turn > 0.5 ? 0xd98b3a : se.blossom ? 0xf3b7c8 : 0x6fae5e;
  const tree = (x, z, s = 1) => {
    const g = new THREE.Group();
    g.position.set(x, groundAt(x, z), z); g.scale.setScalar(s);
    group.add(g);
    cyl(0.22, 0.3, 2.6, 0x7a5237, [0, 1.3, 0], g).castShadow = true;
    if (leaf) for (const [dx, dy, dz, r] of [[0, 3.6, 0, 1.7], [-1.1, 3.0, 0.3, 1.2], [1.1, 3.1, -0.2, 1.25], [0.2, 4.6, 0.2, 1.1]]) add(new THREE.SphereGeometry(r, 10, 7), M(leaf), [dx, dy, dz], g);
    else for (const [a, len] of [[0.5, 1.6], [-0.6, 1.5], [0.1, 1.9]]) { const b = cyl(0.06, 0.1, len, 0x7a5237, [Math.sin(a) * len * 0.45, 2.6 + len * 0.42, 0], g); b.rotation.z = -a; }
  };
  for (const [x, z, s] of TREES) tree(x, z, s);
  const lamps = [];
  for (const x of [-12.6, 16.9, 49.5, 76]) {
    cyl(0.07, 0.09, 3.6, 0x4a4f66, [x, 1.8, 2.05]);
    const bulb = add(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe6e1d6, emissive: 0xffe9a8, emissiveIntensity: 0 }), [x, 3.7, 2.05]);
    const light = new THREE.PointLight(0xffe2a0, 0, 16, 1.6);
    light.position.set(x, 3.5, 2.2);
    group.add(light);
    lamps.push({ bulb, light });
  }
  // signposts where the street goes on
  const post = (x, words, flip) => { cyl(0.07, 0.07, 2.6, 0x7a5237, [x, 1.3, 2.0]); const s = sign(words, 3.0, 0.6, '#fffaf3', '#4a3d35', 62); s.position.set(x + (flip ? -0.2 : 0.2), 2.3, 2.09); group.add(s); };
  post(39.5, 'Library  →', true); post(-40.5, '←  Pond · Hill'); post(74, 'Workshop  →', true);
  { cyl(0.06, 0.06, 1.6, 0x7a5237, [-60.2, 0.8, -0.6]); const sg = sign('↑ Up the hill', 2.2, 0.5, '#fffaf3', '#4a3d35', 78); sg.position.set(-60.2, 1.5, -0.52); group.add(sg); }
    // ---- a tall green stone that glows a little. Nobody knows who put it there.
  const stoneGlow = new THREE.MeshStandardMaterial({ color: 0x2fa37a, roughness: 0.35, emissive: 0x2fa37a, emissiveIntensity: 0.5, map: grain('stone'), emissiveMap: grain('stone') });
  { const st = add(new THREE.OctahedronGeometry(1.5, 0), stoneGlow, [-82, 2.4, -6]); st.scale.set(0.8, 2.0, 0.7); st.rotation.set(0.1, 0.5, 0.08); for (const [dx, dz, k] of [[1.6, 0.5, 0.35], [-1.3, 1.0, 0.25], [0.4, -1.5, 0.3]]) { const s2 = add(new THREE.OctahedronGeometry(1.5, 0), stoneGlow, [-82 + dx, 0.5, -6 + dz]); s2.scale.set(k, k * 1.6, k); } }
  const stoneLight = new THREE.PointLight(0x4fe0a8, 0, 22, 1.4);
  stoneLight.position.set(-82, 3, -6);
  group.add(stoneLight);
  // ---- the pond with its willow and benches; the hill with its bench and flag
  const water = new THREE.MeshStandardMaterial({ color: 0x7fc4e8, roughness: 0.25, emissive: 0x2a6f95, emissiveIntensity: 0.35 });
  add(new THREE.CylinderGeometry(1, 1, 0.08, 40), water, [POND.x, 0.03, POND.z]).scale.set(POND.rx, 1, POND.rz);
  add(new THREE.CylinderGeometry(1, 1, 0.05, 40), M(0xcdbb8e), [POND.x, 0.01, POND.z]).scale.set(POND.rx + 0.7, 1, POND.rz + 0.7);
  for (let i = 0; i < 26; i++) { const a = 2.2 + i * 0.13; cyl(0.04, 0.05, 1.1 + (i % 3) * 0.3, 0x5f9e63, [POND.x + Math.cos(a) * (POND.rx + 0.2), 0.6, POND.z + Math.sin(a) * (POND.rz + 0.2)]); }
  const ducks = [];
  const duck = (body, head) => { const g = new THREE.Group(); const b = add(new THREE.SphereGeometry(0.42, 12, 8), M(body), [0, 0.22, 0], g); b.scale.set(1.25, 0.7, 0.85); add(new THREE.SphereGeometry(0.2, 10, 8), M(head), [0.42, 0.55, 0], g); const bill = add(new THREE.ConeGeometry(0.08, 0.22, 8), M(0xf2a33c), [0.66, 0.53, 0], g); bill.rotation.z = -Math.PI / 2; group.add(g); ducks.push(g); return g; };
  duck(0xffffff, 0xffffff); duck(0xe8d9b8, 0x3d7d5a); duck(0xd9c7a0, 0x3d7d5a); duck(0xffffff, 0xffffff);
  const benchAt = (x, z, rot = 0) => { const g = new THREE.Group(); g.position.set(x, groundAt(x, z), z); g.rotation.y = rot; group.add(g); box([2.2, 0.1, 0.6], 0x9a6b47, [0, 0.55, 0], g); box([2.2, 0.5, 0.08], 0x9a6b47, [0, 0.95, -0.3], g); for (const dx of [-0.9, 0.9]) box([0.1, 0.55, 0.5], 0x7a5237, [dx, 0.27, 0], g); return g; };
  benchAt(-60.5, 5.2); benchAt(-69, 5.6, 0.2);
  { const g = new THREE.Group(); g.position.set(-52.8, 0, 6.4); group.add(g); cyl(0.4, 0.55, 3.4, 0x6b4a35, [0, 1.7, 0], g).castShadow = true; const wl = se.leafOn <= 0.05 ? null : se.turn > 0.5 ? 0xc9b24f : 0x86b96a; if (wl) { add(new THREE.SphereGeometry(2.6, 12, 9), M(wl), [0, 4.4, 0], g).scale.y = 0.75; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; cyl(0.5, 0.2, 2.6, M(wl), [Math.cos(a) * 2.1, 2.9, Math.sin(a) * 2.1], g, 6); } } }
  benchAt(HILL.x + 0.2, HILL.z - 0.6, 0.5);
  { const y = groundAt(HILL.x + 2.6, HILL.z); cyl(0.06, 0.06, 3.2, 0x7a5237, [HILL.x + 2.6, y + 1.6, HILL.z]); box([1.1, 0.6, 0.04], 0xf2c14e, [HILL.x + 3.2, y + 2.85, HILL.z]); }

  // Daylight for the world. The lamps and the window light of his room are far away, so the world has lights of its own,
  // high above it (they do not reach his room).
  const suns = [[-70, 46, 0, 100], [-8, 46, 10, 110], [62, 46, 8, 110], [10, 46, -44, 100]].map(([x, y, z, far]) => { const l = new THREE.PointLight(0xfff4e2, 1.5, far, 0); l.position.set(x, y, z); group.add(l); return l; });

  let frozenNow = false;
  function animate(t) {
    stoneGlow.emissiveIntensity = 0.45 + Math.sin(t * 0.9) * 0.2; // the stone breathes
    ducks.forEach((d, i) => {
      const a = frozenNow ? i * 1.7 : t * (0.05 + i * 0.012) + i * 1.7;
      const k = 0.35 + (i % 3) * 0.2;
      d.position.set(POND.x + Math.cos(a) * POND.rx * k, frozenNow ? 0.07 : 0.03 + Math.sin(t * 1.6 + i) * 0.025, POND.z + Math.sin(a) * POND.rz * k);
      d.rotation.y = -a - Math.PI / 2;
    });
  }
  animate(0);

  // ---- his art in the world. What he painted on a wall is on that wall (always at the same place for the same painting),
  // newer ones over older ones, like the tags on the walls of Pino's town. And every drawing he ever made, on paper or on
  // a wall, hangs small in a row on the outside of his art workshop: nothing gets lost when a wall is painted over.
  let hung = '';
  const picture = (a) => { if (!artTex.has(a.id)) artTex.set(a.id, tex(a.file)); return artTex.get(a.id); };
  const wipe = (holder) => { for (const m of holder.children) { const i = skins.indexOf(m.material); if (i >= 0) skins.splice(i, 1); m.geometry.dispose(); m.material.dispose(); } holder.clear(); };
  function hangArt(s, now) {
    const all = (Array.isArray(s?.gallery) ? s.gallery : Array.isArray(s?.art) ? s.art : []).filter((a) => a?.id && a.file && !(Date.parse(a.at ?? a.createdAt) > now));
    const key = all.map((a) => `${a.id}${a.wall ?? ''}`).join(',');
    if (key === hung) return;
    hung = key;
    wipe(painted);
    all.filter((a) => a.wall).slice(-80).forEach((a, i) => {
      const w = PAINT_WALLS.find((x) => x.key === a.wall);
      if (!w) return;
      const sp = artSpot(a.id);
      const hh = Math.min(w.h - 0.9, 1.7 + (sp.n % 9) / 10); // 1.7 to 2.5 m high
      const ww = Math.min(w.len - 0.6, hh * (Number(a.aspect) > 0 ? a.aspect : 1.33));
      const m = add(new THREE.PlaneGeometry(ww, hh), skin(picture(a), 2.2), [w.x + (sp.u - 0.5) * (w.len - ww - 0.4), 0.4 + hh / 2 + ((sp.n >>> 4) % 5) / 10, w.z + w.side * (0.012 + i * 0.002)], painted);
      m.rotation.y = w.side > 0 ? 0 : Math.PI;
      m.rotation.z = sp.tilt;
    });
    // the gallery: the newest first, on the back wall of the art workshop, then on its two side walls
    wipe(gallery);
    const [x0, x1, z0, z1] = rectOf(BUILDINGS.find((b) => b.key === 'studio'));
    const cells = [];
    const rows = [3.95, 2.95, 1.95, 0.95];
    for (const y of rows) for (let x = x0 + 0.85; x < x1 - 0.5; x += 1.32) cells.push([x, y, z1 + 0.03, 0]);
    for (const y of rows) for (let z = z1 - 0.85; z > z0 + 0.5; z -= 1.32) cells.push([x1 + 0.03, y, z, Math.PI / 2]);
    for (const y of rows) for (let z = z0 + 0.85; z < z1 - 0.5; z += 1.32) cells.push([x0 - 0.03, y, z, -Math.PI / 2]);
    const white = M(0xfffaf3);
    [...all].reverse().slice(0, cells.length).forEach((a, i) => {
      const [x, y, z, ry] = cells[i];
      const asp = Number(a.aspect) > 0 ? a.aspect : 1.33;
      const ww = Math.min(1.12, 0.84 * asp), hh = ww / asp;
      const f = add(new THREE.PlaneGeometry(ww + 0.1, hh + 0.1), white, [x, y, z], gallery); f.rotation.y = ry;
      const m = add(new THREE.PlaneGeometry(ww, hh), skin(picture(a), 2.4), [x + Math.sin(ry) * 0.012, y, z + Math.cos(ry) * 0.012], gallery); m.rotation.y = ry;
    });
  }

  // ---- what follows the real time: lights in the windows, the shop sign, the clock, the snow
  const nightBlue = new THREE.Color(0x1c2a55);
  let said = '';
  let insideNow = false;
  function update(s, now = Date.now(), hour = undefined) {
    state.weather = s?.weather ?? null;
    hangArt(s, now);
    const h = Number.isFinite(hour) ? hour : hourNL(now); // (a test or a screenshot can ask for an hour)
    const dark = h < se.sunrise - 0.4 || h > se.sunset + 0.3;
    const dusk = dark || h > se.sunset - 0.9;
    const away = Boolean(s?.where && s.where.place !== 'home' && now >= Date.parse(s.where.leftAt));
    const key = `${Math.floor(h * 4)}${dark}${dusk}${away}${shopOpen(now)}${snowy()}${(s?.visitors ?? []).filter((v) => v.npc && !v.answer).length}${new Date(now).getDay()}${insideNow}`;
    handPivots[0].rotation.z = -((h % 1) * Math.PI * 2);
    handPivots[1].rotation.z = -(((h % 12) / 12) * Math.PI * 2);
    if (key === said) return;
    said = key;
    fogColor = paintSky(h);
    for (const { b, glow } of blocks) { // the windows are lit when someone is in and it is getting dark
      if (!glow) continue;
      const p = b.who ? PEOPLE.find((q) => q.name === b.who) : null;
      const up = b.key === 'home' ? !away && h >= 8 && h < 23 : b.key === 'shop' ? shopOpen(now) : b.lit ? h >= b.lit[0] && h < b.lit[1] : p ? h >= p.up[0] && h < p.up[1] : h >= 7 && h < 22;
      glow.material.opacity = up && dark ? 0.95 : up && dusk ? 0.6 : 0;
    }
    const open = shopOpen(now);
    openSign.userData.draw(open ? 'OPEN' : 'CLOSED', open ? '#4caf6a' : '#b8554a');
    for (const m of signs) m.emissiveIntensity = dark ? 0.25 : 0.3;
    for (const l of lamps) { l.bulb.material.emissiveIntensity = dusk ? 1.2 : 0; l.light.intensity = dusk && !insideNow ? 26 : 0; }
    // The lamps of his room do not reach the world, and the page's daylight is made for indoors: so everything here
    // keeps some of its own colour (more by day, less at night, a little blue in the dark).
    for (const l of suns) { l.intensity = insideNow ? 0 : dark ? 0.4 : dusk ? 1.2 : 2.1; l.color.set(dark ? 0x8fa3e0 : dusk ? 0xffc79a : 0xfff4e2); }
    stoneLight.intensity = insideNow ? 0 : dark ? 30 : dusk ? 14 : 0;
    frozenNow = Number.isFinite(state.weather?.temp) ? state.weather.temp <= 0 : false; // the pond freezes in real frost
    water.color.set(frozenNow ? 0xe1f1f8 : dark ? 0x3b5a92 : 0x7fc4e8);
    water.emissive.set(frozenNow ? 0x9fc4d6 : 0x2a6f95);
    // (seen from inside his home the world's own lights are off, or they would shine into his room: then it glows more by itself)
    const glowLevel = insideNow ? (dark ? 0.3 : dusk ? 0.6 : 0.85) : dark ? 0.2 : dusk ? 0.18 : 0.13;
    for (const m of mats) { m.emissive.copy(m.color).multiplyScalar(glowLevel); if (dark) m.emissive.lerp(nightBlue, 0.35); }
    const white = snowy();
    ground.material.userData.tint = tintOf();
    ground.material.color.set(tintOf());
    for (const m of skins) { m.emissive.set(m.userData.tint ?? 0xffffff); if (dark) m.emissive.lerp(nightBlue, 0.3); m.emissiveIntensity = glowLevel * (m.userData.k ?? 1); }
    field.material.color.set(white ? 0xf4f8fa : se.name === 'autumn' ? 0xc9c98a : se.name === 'winter' ? 0xb9c6a4 : 0xb4dc9a);
    for (const r of roofs) r.m.material.color.set(white ? 0xffffff : r.color);
    letter.visible = (s?.visitors ?? []).some((v) => v.npc && !v.answer);
  }

  // ---- far away (only seen when you walk): the grid goes on to a horizon with hills, under a real sky
  const far = new THREE.Group();
  far.visible = false;
  group.add(far);
  const farTex = gridTex.clone(); farTex.needsUpdate = true; farTex.repeat.set(320, 320);
  const land = add(new THREE.CircleGeometry(640, 48), new THREE.MeshBasicMaterial({ map: farTex, color: tintOf() }), [0, -0.75, 0], far);
  land.rotation.x = -Math.PI / 2;
  const hillMat = new THREE.MeshBasicMaterial({ color: 0x8fb89a });
  const hillMat2 = new THREE.MeshBasicMaterial({ color: 0xa7c6b4 });
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + 0.2; const r = 330 + ((i * 37) % 90); const hl = add(new THREE.SphereGeometry(60 + ((i * 53) % 50), 12, 8), i % 2 ? hillMat : hillMat2, [Math.cos(a) * r, -18, Math.sin(a) * r], far); hl.scale.y = 0.38 + ((i * 17) % 10) / 40; }
  const blockMat = [new THREE.MeshBasicMaterial({ color: 0x9aa7b5 }), new THREE.MeshBasicMaterial({ color: 0xb7b0c2 }), new THREE.MeshBasicMaterial({ color: 0x8a97a8 })];
  for (let i = 0; i < 11; i++) { const a = -0.9 + i * 0.33 + (i % 3) * 0.05; const r = 280 + ((i * 41) % 60); box([16 + (i % 3) * 8, 46 + ((i * 29) % 60), 14], blockMat[i % 3], [Math.sin(a) * r, 18 + ((i * 29) % 60) / 2, -Math.cos(a) * r], far); } // tower blocks far away
  const skyGeo = new THREE.SphereGeometry(900, 24, 14);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  add(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), [0, 0, 0], far);
  const sunDisc = add(new THREE.CircleGeometry(34, 28), new THREE.MeshBasicMaterial({ color: 0xffd36e, fog: false }), [0, 0, 0], far);
  // The sky for an hour: [top, horizon, sun colour]; returns the colour of the horizon (for the fog)
  function paintSky(h) {
    const night = h < se.sunrise - 0.6 || h > se.sunset + 0.7;
    const edge = !night && (h < se.sunrise + 0.9 || h > se.sunset - 1.0);
    const [top, low, sunC] = night ? [0x10173a, 0x2b3a6b, 0xf2f0dc] : edge ? [0x5b7fc0, 0xf5a98a, 0xff7a5a] : [0x4f9fe0, 0xcfe9f7, 0xffd36e];
    const a = new THREE.Color(top), b = new THREE.Color(low), c = new THREE.Color();
    const pos = skyGeo.attributes.position, col = skyGeo.attributes.color;
    for (let i = 0; i < pos.count; i++) { const k = Math.max(0, Math.min(1, pos.getY(i) / 520)); c.copy(b).lerp(a, Math.sqrt(k)); col.setXYZ(i, c.r, c.g, c.b); }
    col.needsUpdate = true;
    const f = night ? 0.5 : Math.max(0.04, Math.min(0.96, (h - se.sunrise) / (se.sunset - se.sunrise)));
    const ang = Math.PI * (1 - f);
    sunDisc.position.set(Math.cos(ang) * 620, 60 + Math.sin(ang) * 360, -520);
    sunDisc.lookAt(group.position.x, 20, 0);
    sunDisc.material.color.set(sunC);
    land.material.color.set(tintOf()).multiplyScalar(night ? 0.38 : edge ? 0.85 : 1);
    blockMat.forEach((m, i) => m.color.set(night ? [0x26305a, 0x2d3766, 0x222b52][i] : edge ? [0xc79a94, 0xd6aa9c, 0xb98a8a][i] : [0x9aa7b5, 0xb7b0c2, 0x8a97a8][i]));
    hillMat.color.set(night ? 0x2d3a63 : edge ? 0xb98f86 : 0x8fb89a);
    hillMat2.color.set(night ? 0x384873 : edge ? 0xd3a894 : 0xa7c6b4);
    return low;
  }
  let fogColor = paintSky(13);
  // Walking shows every building at its full height and the land to the horizon; from above the buildings on the near
  // side of the street are low, so they do not hide it.
  const setWalk = (walking) => { for (const g of lowOnes) g.scale.y = walking ? 1 : 0.22; far.visible = walking; };
  setWalk(false);
  // Seen from inside his home (main.js puts the world right outside his real windows then): the buildings that would
  // stand where his rooms are step aside, and the world's lights go off so they do not shine through his walls.
  const setInside = (on, hide = []) => { insideNow = on; said = ''; for (const { b, g } of blocks) g.visible = !(on && hide.includes(b.key)); };
  const skyFog = () => fogColor;
  return { group, update, setWalk, setInside, animate, skyFog };
}
