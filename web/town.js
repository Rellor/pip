// Pip's world in 3D. It is set up the easy way, like the town of Pino the bird (pinos.world): one big flat ground with a
// grid on it, and on it plain blocks. A block becomes a shop or a house by the picture on its front (facade.js), and a
// place is just a spot Pip walks to and does something at. Nothing has an inside, except his own home: the door of his
// house here leads into his room, and the front door in his hall leads back out here.
// The layout is a small village square: his home on the north side with the grocery store and the library glued to each
// other beside it, the notice board in the middle, the three workshops in a row on the south side, and walls for his art
// in between. Everything is close together. There is no road (there are no cars): sand paths run to every door.
//   - To add a building: one line in BUILDINGS (where, how big, what its front looks like, or a photo for it).
//   - To add a wall for his drawings: one line in WALLS.
// The world stands in the same scene as his house, far to the side (at x = TOWN_X). The viewer walks through it; when
// Pip goes out, he is seen here. It follows the real hour, season and weather. No model, no server.
import { hourNL, shopOpen } from './street.js';
import { seasonInfo } from './season.js';
import { makeGrain } from './grain.js';
import { makeFacades } from './facade.js';

export const TOWN_X = 220; // where the world is in the scene (his room is around x 0)
export const WORLD = { x0: -66, x1: 78, z0: -38, z1: 64 }; // the whole world: 144 x 102 m. Beyond the rim there is nothing to walk on
export const WORLD_RANGE = [WORLD.x0, WORLD.x1];
export const TOWN_RANGE = [-39, 42]; // around his home: what the view from above shows first
export const TOWN_Z = [WORLD.z0, WORLD.z1];
export const SQUARE = { x0: -10, x1: 26, z0: 7, z1: 31 }; // the village square: sand, with the notice board in the middle
// Pip's own land: a big free field beside the square, where a plain "outside" puts what he makes. It is his to fill.
export const PLOT = { x0: 30, x1: 62, z0: 4, z1: 34 };
export const inTown = (x) => x > 60;

// ---- The buildings. `at` is the middle of the front on the ground, `size` is wide, high, deep. The front looks toward
// +z (south, to the square) unless `face` is 180. `look` says what the front is made of (facade.js); `tex` is a photo to
// use instead. `lit` are the hours its windows are lit.
// Rows of windows for the floors above the ground floor: `w` wide, the sills at these heights.
const upper = (w, ys, n = Math.max(2, Math.floor(w / 3.3)), ww = 1.25, hh = 1.7) => ys.flatMap((y) => Array.from({ length: n }, (_, i) => [((i + 0.5) * w) / n - ww / 2, y, ww, hh]));
// (Like in Pino's town, most blocks are a few floors high, some stand glued to each other, and some are only there to
// make the village a village: `decor` buildings do nothing.)
export const BUILDINGS = [
  { key: 'home', name: 'Pip’s home', who: 'Pip', at: [0, 0], size: [9, 5, 7.5], look: { wall: 'plaster', color: '#f3cf7a', photo: { src: 'tex/plaster.jpg', m: 2.4, tint: '#f6cf78' }, door: { x: 4.5, color: '#c0392b', w: 1.2, h: 2.3 }, windows: [[1.0, 1.1, 1.9, 1.7], [6.2, 1.1, 1.9, 1.7], [3.7, 3.5, 1.6, 1.0]] }, roof: 0xe9855b, lit: [8, 23] },
  { key: 'shop', name: 'Grocery store', at: [14, 0], size: [14, 9, 9], look: { wall: 'brick', color: '#c98f6b', trim: '#f1e4cf', photo: { src: 'tex/bricks_red.jpg', m: 2.1 }, bands: [4.5], door: { x: 10.5, color: '#2f5f58' }, shop: { x0: 0.9, x1: 9.2, awning: '#f2c14e', goods: ['#ef6f6c', '#f2c14e', '#8cc27a', '#e9855b'] }, shutter: { x0: 11.7, x1: 13.4 }, windows: upper(14, [5.6]), sign: { text: 'GROCERY STORE', bg: '#2f5f58', fg: '#fff8ee', y: 3.7, x: 5.1 } }, roof: 0x5c5650, lit: [7, 22] },
  { key: 'library', name: 'Library', at: [29.2, 0], size: [16, 11.5, 9], look: { wall: 'stone', color: '#e3d2b6', photo: { src: 'tex/sandstone.jpg', m: 2.6 }, columns: 4, bands: [5.6], door: { x: 8, color: '#7a5237', w: 2.2, h: 3.4 }, windows: [[2.6, 1.4, 1.3, 2.9], [12.1, 1.4, 1.3, 2.9], [2.6, 6.6, 1.3, 2.6], [7.35, 6.6, 1.3, 2.6], [12.1, 6.6, 1.3, 2.6]], sign: { text: 'LIBRARY', bg: '#f1e6d2', fg: '#7a5237', y: 10.3, x: 8, size: 0.6 } }, roof: 0x8a5a3a, lit: [8, 22] },
  { key: 'flats', name: 'Flats', decor: true, at: [44.4, 0], size: [14, 15, 9], look: { wall: 'brick', color: '#b9856a', trim: '#e9dcc8', photo: { src: 'tex/flats.jpg', m: 14, glow: 'tex/flats_glow.jpg', fit: true }, ground: { h: 3.5, color: '#8a6f62' }, door: { x: 2.2, color: '#4a3d35', w: 1.1, h: 2.3 }, shutter: { x0: 5.2, x1: 12.6 }, sign: { text: 'TO LET', bg: '#f4efe6', fg: '#b8554a', y: 2.9, x: 8.9, size: 0.4 } }, roof: 0x5c5650, lit: [17, 23.5] },
  { key: 'cafe', name: 'Internet café', at: [-21.2, 0], size: [14, 9.5, 8], look: { wall: 'brick', color: '#a8745c', trim: '#efe6d6', photo: { src: 'tex/bricks_old.jpg', m: 2.3 }, bands: [4.2], door: { x: 3, color: '#3d5a80', w: 1.1, h: 2.4 }, windows: upper(14, [5.4]), sign: { text: 'INTERNET CAFÉ', bg: '#1f2a44', fg: '#7fd6ff', y: 3.55, x: 9, size: 0.42 } }, roof: 0x6b5a50, lit: [8, 23] },
  { key: 'studio', name: 'Art workshop', at: [-6, 38], face: 180, size: [12, 8, 8], look: { wall: 'boards', color: '#e8dcc6', photo: { src: 'tex/siding_pale.jpg', m: 1.7 }, bands: [4.3], door: { x: 2, color: '#e9855b' }, windows: [[4.4, 1.2, 2.2, 1.9], [8.2, 1.2, 2.2, 1.9], ...upper(12, [5.1], 3, 1.6, 1.8)], sign: { text: 'PIP’S ART', bg: '#e9855b', fg: '#ffffff', y: 3.6, x: 6 } }, roof: 0xe9855b, lit: [9, 21] },
  { key: 'workshop', name: 'Print workshop', at: [8.7, 38], face: 180, size: [11, 9, 8], look: { wall: 'brick', color: '#8f9aa0', trim: '#dfe5e8', photo: { src: 'tex/steel.jpg', m: 2.4 }, bands: [4.4], door: { x: 1.8, color: '#c9773c' }, shutter: { x0: 3.6, x1: 9.8 }, windows: upper(11, [5.6]), sign: { text: 'PRINT WORKSHOP', bg: '#2a2a2e', fg: '#f2c14e', y: 3.5, x: 6.7, size: 0.45 } }, roof: 0x5c6468, lit: [9, 21] },
  { key: 'land', name: 'Land workshop', at: [20.4, 38], face: 180, size: [12, 7, 8], look: { wall: 'planks', color: '#8fae6a', photo: { src: 'tex/siding_dark.jpg', m: 2.2, tint: '#dff0c0' }, door: { x: 2, color: '#5a4630' }, shutter: { x0: 4.2, x1: 10.8 }, windows: [[6.6, 4.9, 1.8, 1.3]], sign: { text: 'LAND TOOLS', bg: '#5a4630', fg: '#f4e7c6', y: 3.6, x: 7.5, size: 0.5 } }, roof: 0x6f8a52, lit: [9, 21] },
  { key: 'closed', name: 'Closed shop', decor: true, at: [32.6, 38], face: 180, size: [12, 10, 8], look: { wall: 'plaster', color: '#d8c6a4', trim: '#f4efe6', photo: { src: 'tex/plaster_worn.jpg', m: 3.2 }, bands: [4.2], door: { x: 10.4, color: '#6b4a35' }, shutter: { x0: 1, x1: 8.8 }, windows: upper(12, [5.2, 7.7], 3, 1.3, 1.5), sign: { text: 'CLOSED', bg: '#6b4a35', fg: '#f1e6d2', y: 3.5, x: 4.9, size: 0.42 } }, roof: 0x7c6a5c, lit: [18, 23] },
];
// A building's place on the ground: [x0, x1, z0, z1].
export const rectOf = (b) => { const [w, , d] = b.size; return b.face === 180 ? [b.at[0] - w / 2, b.at[0] + w / 2, b.at[1], b.at[1] + d] : [b.at[0] - w / 2, b.at[0] + w / 2, b.at[1] - d, b.at[1]]; };
const bOf = (key) => BUILDINGS.find((b) => b.key === key);
// Where its door is, and a step in front of it (where he stands): [x, z, the way he looks].
const doorOf = (key, out = 1.3) => { const b = bOf(key); const f = b.face === 180; return { x: b.at[0] + (f ? b.size[0] / 2 - b.look.door.x : b.look.door.x - b.size[0] / 2), z: b.at[1] + (f ? -out : out), face: f ? 0 : Math.PI }; };
// ---- Walls for his art (like Pino's numbered walls): a bare concrete wall somewhere in the world. `at` is its middle,
// `len` how long.
export const WALLS = [
  { key: 'wall_1', name: 'the wall beside my house', at: [-11, -2], len: 6 },
  { key: 'wall_2', name: 'the wall by the pond', at: [-30, 6], len: 8 },
  { key: 'wall_3', name: 'the wall by the flats', at: [56.5, -3], len: 8 },
  { key: 'wall_4', name: 'the long wall by the art workshop', at: [-24, 40], len: 12 },
  { key: 'wall_5', name: 'the wall by the closed shop', at: [44.6, 42], len: 8 },
];
// ---- The notice board: it stands in the middle of the square. People pin notes on it with what they would like made
// (board.js). He walks to it to read them. The notes are on both sides.
export const BOARD = { x: 8, z: 19, w: 2.6, h: 1.5 };
export const WALL_H = 3.4;
// ---- Where he can paint (like the tags on the walls of Pino's town). He needs no paper and no supplies for it. He picks
// the wall himself: one of the art walls, or the back wall of his house, the grocery store or the library; or he leaves
// it open and one is picked for him. `side` is the face he paints on (1: the one that looks south, -1: north).
const BACK_NAME = { home: 'my own house', shop: 'the grocery store', library: 'the library' };
const BACK_VIA = ['alley', 'alleyBack']; // the alley between his house and the grocery store leads to the back of the row
export const PAINT_WALLS = [
  { key: 'wall_1', words: /beside|my house|my home/, via: ['homeW'] }, { key: 'wall_2', words: /park|pond/, via: ['homeW'] }, { key: 'wall_3', words: /flats|end of the row/, via: ['rowE'] },
  { key: 'wall_4', words: /long|art/, via: ['sqN', 'sqW'], side: -1 }, { key: 'wall_5', words: /closed|land/, via: ['sqN', 'sqE', 'sqSE', 'rowSE'], side: -1 },
].map((t) => { const w = WALLS.find((x) => x.key === t.key); const side = t.side ?? 1; return { ...t, name: w.name, x: w.at[0], z: w.at[1] + side * 0.21, len: w.len, h: WALL_H, side, spot: [w.at[0], w.at[1] + side * 1.95] }; })
  .concat(BUILDINGS.filter((b) => BACK_NAME[b.key]).map((b) => { const z = b.at[1] - b.size[2]; return { key: `back_${b.key}`, back: b.key, name: `the back wall of ${BACK_NAME[b.key]}`, x: b.at[0], z: z - 0.03, len: b.size[0], h: b.size[1], side: -1, spot: [b.at[0], z - 1.9], via: BACK_VIA }; }));
// "the wall by the library", "the back of the grocery store", "any wall": the wall he means. No wall named: one of them, by `seed`.
export function paintTarget(text, seed = 0) {
  const norm = (v) => String(v ?? '').toLowerCase().replace(/[’']/g, '');
  const t = norm(text);
  const word = (w) => norm(w.name).replace(/^the back wall of (the |my own )?/, '').replace(/ store$/, ''); // "grocery", "library", "house" (his own)
  const backs = PAINT_WALLS.filter((w) => w.back);
  const backOf = () => backs.find((w) => w.back !== 'home' && t.includes(word(w))) ?? (/\b(my|own|home)\b/.test(t) ? backs.find((w) => w.back === 'home') : null);
  return PAINT_WALLS.find((w) => t.includes(norm(w.name)))
    ?? (/\bback\b/.test(t) ? backOf() : null)
    ?? PAINT_WALLS.find((w) => !w.back && w.words.test(t))
    ?? backOf()
    ?? PAINT_WALLS[Math.abs(Math.floor(seed)) % PAINT_WALLS.length];
}
const wallRect = (w) => [w.at[0] - w.len / 2, w.at[0] + w.len / 2, w.at[1] - 0.25, w.at[1] + 0.25];

export const POND = { x: -30, z: 20, rx: 12, rz: 8 };
const WILLOW = [-19, 29];
const STONE = [-54, -16]; // the green stone
const BENCHES = [[-15.6, 17.4, -Math.PI / 2], [-30, 30.4, Math.PI]]; // [x, z, the way it looks]
const PLOT_SIGN = [28.8, 6.2];
// Places Pip is seen at (x to the east, z to the south; the front of his house is at z 0, the square lies south of it).
export const TOWN_SPOTS = {
  door: { x: 0, z: 1.1, face: 0 }, // in front of Pip's own door
  step: { x: 0.2, z: 0.62, face: 0, y: 0.2 }, // on his own doorstep
  sqN: { x: 0, z: 5.5, face: 0 }, // the north edge of the square, before his door
  sqW: { x: -10, z: 12, face: -Math.PI / 2 }, sqE: { x: 15, z: 10, face: Math.PI / 2 }, sqSW: { x: -2, z: 33, face: 0 }, // corners of the square he walks by
  shop: doorOf('shop'), // at the door of the grocery store
  library: doorOf('library', 1.5),
  studio: doorOf('studio'), // at the door of the art workshop (he draws there)
  workshop: doorOf('workshop'), // at the door of the print workshop
  land: doorOf('land'), // at the door of the land workshop
  cafe: doorOf('cafe'), // at the door of the internet café (he looks things up there)
  board: { x: BOARD.x, z: BOARD.z - 1.15, face: 0 }, // in front of the notice board
  pond: { x: -16.4, z: 19.6, face: -Math.PI / 2 }, // by the bench, looking over the water
  homeW: { x: -6.2, z: 1.2, face: -Math.PI / 2 }, // past the west corner of his house
  alley: { x: 5.75, z: 1.2, face: Math.PI }, alleyBack: { x: 5.75, z: -10.9, face: Math.PI }, // the alley between his house and the grocery store, and out behind the row
  rowE: { x: 52.8, z: 1.3, face: Math.PI / 2 }, // past the east end of the north row (the flats)
  sqSE: { x: 27.6, z: 33.4, face: Math.PI / 2 }, rowSE: { x: 40.2, z: 36.4, face: Math.PI / 2 }, // along the south row, past the closed shop
  ...Object.fromEntries(PAINT_WALLS.map((w) => [`paint_${w.key}`, { x: w.spot[0], z: w.spot[1], face: w.side > 0 ? Math.PI : 0 }])), // in front of each wall he can paint on
  drop_square: { x: -5.4, z: 25.4, face: Math.PI / 2 }, drop_pond: { x: -14.8, z: 23.6, face: -Math.PI / 2 }, drop_door: { x: 2.4, z: 3.6, face: Math.PI / 2 }, drop_wall: { x: -24, z: 36.2, face: 0 }, // where a note for him can lie (strangers.js): he stands beside it
};
// Where things that people leave lie: the notes (by their spot) and the small deeds of visitors (by what they are).
export const LIE = { drop_square: [-6.2, 25.4], drop_pond: [-15.6, 23.6], drop_door: [3.2, 3.6], drop_wall: [-24, 37.0], flower: [1.1, 0.62], apple: [16.4, 0.7], boat: [POND.x + 4, POND.z - 2], doodle: [BOARD.x + 0.8, BOARD.z + 0.12], hat: [STONE[0], STONE[1]], bookmark: [30.6, 0.8], chalk: [14, 24] };
// Where Pip is seen for each place of his world: [the spot, 'in' when he goes inside there (then he is out of sight)].
export const TOWN_FOR = { doorstep: ['step', ''], shop: ['shop', ''], pond: ['pond', ''], library: ['library', 'in'], board: ['board', ''], workshop: ['workshop', ''], land: ['land', ''], walls: ['paint_wall_1', ''], drops: ['drop_square', ''] };
// The way to each spot from his door: the corners he walks by, one after the other (the way home is the same, backwards).
// (A route can also be for one spot: the way to each wall he paints on. The page looks for the spot first, then the place.)
export const ROUTES = { doorstep: [], shop: [], pond: ['sqN', 'sqW'], library: [], board: ['sqN'], workshop: ['sqN', 'sqE'], studio: ['sqN', 'sqSW'], cafe: ['homeW'], land: ['sqN', 'sqE'], drops: ['sqN'], drop_square: ['sqN'], drop_pond: ['sqN', 'sqW'], drop_door: [], drop_wall: ['sqN', 'sqSW'], ...Object.fromEntries(PAINT_WALLS.map((w) => [`paint_${w.key}`, w.via])) };

// ---- The land itself. It is flat, until Pip shapes it: at the land workshop he takes the land tool and makes a hill or
// digs a hole (land.js; the list is kept in his state as `land`). Whoever draws the world or puts something on it first
// says what he made, with setLand.
export const LAND_MAX = 12; // hills and holes at one time
export const LAND_SIZES = { small: { r: 5, hill: 1.6, hole: 1.2 }, medium: { r: 8, hill: 3, hole: 2 }, big: { r: 12, hill: 5, hole: 3 } }; // how wide (radius) and how high or deep, in metres
let LAND = [];
export function setLand(list) { LAND = (Array.isArray(list) ? list : []).filter((s) => s && Number.isFinite(s.x) && Number.isFinite(s.z) && s.r > 0 && s.h > 0).slice(-LAND_MAX); return LAND; }
export const landNow = () => LAND;
// How high the ground is: world coordinates in, metres out. Flat (0) everywhere he has not shaped it.
export function groundAt(lx, z) {
  let y = 0;
  for (const s of LAND) { const d = Math.hypot(lx - s.x, z - s.z) / s.r; if (d < 1) y += s.kind === 'hole' ? -s.h * (1 - d ** 4) ** 2 : s.h * (1 - d * d) ** 2; } // a hill is round; a hole has a flat bottom and steeper sides
  return Math.max(-3, Math.min(9, y));
}
export const townGround = (x, z) => groundAt(x - TOWN_X, z);
// The shelf in front of the print workshop: 21 prints. It stands before the shutter, and looks the way the building looks.
export const PRINT_SHELF = (() => { const b = bOf('workshop'); const f = b.face === 180 ? -1 : 1; const edge = (v) => b.at[0] + (f < 0 ? b.size[0] / 2 - v : v - b.size[0] / 2); const [a, c] = [edge(b.look.shutter.x0 + 0.2), edge(b.look.shutter.x1 - 0.2)]; return { x0: Math.min(a, c), x1: Math.max(a, c), z: b.at[1] + f * 0.42, dir: f, rows: [0.62, 1.32, 2.02], per: 7 }; })();
export const PRINT_SLOTS = PRINT_SHELF.rows.flatMap((y) => Array.from({ length: PRINT_SHELF.per }, (_, i) => [PRINT_SHELF.x0 + 0.45 + i * ((PRINT_SHELF.x1 - PRINT_SHELF.x0 - 0.9) / (PRINT_SHELF.per - 1)), y, PRINT_SHELF.z]));
// What cannot be walked through: [x0, x1, z0, z1] (every building and wall, the shelf of prints and the notice board).
const BLOCKS = [...BUILDINGS.map(rectOf), ...WALLS.map(wallRect), [PRINT_SHELF.x0 - 0.1, PRINT_SHELF.x1 + 0.1, PRINT_SHELF.z - 0.4, PRINT_SHELF.z + 0.4], [BOARD.x - BOARD.w / 2 - 0.1, BOARD.x + BOARD.w / 2 + 0.1, BOARD.z - 0.22, BOARD.z + 0.22]];
export function townBlocked(x, z, pad = 0.3) {
  const lx = x - TOWN_X;
  if (lx < WORLD.x0 + 0.4 || lx > WORLD.x1 - 0.4 || z < WORLD.z0 + 0.4 || z > WORLD.z1 - 0.4) return true; // the rim of the world
  if (((lx - POND.x) / (POND.rx + pad)) ** 2 + ((z - POND.z) / (POND.rz + pad)) ** 2 < 1) return true; // the water
  return BLOCKS.some(([x0, x1, z0, z1]) => lx > x0 - pad && lx < x1 + pad && z > z0 - pad && z < z1 + pad);
}
// Standing right in front of Pip's door in the world (for the viewer who walks: this is the way back into the hall).
export const atTownDoor = (x, z) => Math.abs(x - TOWN_X) < 0.75 && z < 0.75 && z > -0.2;

// ---- Where Pip may build (decor.js) and shape the land (land.js). He picks the place himself, anywhere in his world.
// The only rule: it has to fit. It may not stand in a building, in the water, on a tree or on what is already there,
// and the square and the ways he walks must stay free. It can be bigger than a house.
export const BUILD_MAX = { w: 20, h: 18, d: 20 };
// The ways he walks himself (ROUTES): they stay free, from corner to corner. (The sand paths are drawn along them.)
const WALKS = [...Object.entries(TOWN_FOR).map(([place, [spot]]) => [place, spot, ROUTES[place] ?? []]), ['studio', 'studio', ROUTES.studio], ['cafe', 'cafe', ROUTES.cafe], ...['drop_pond', 'drop_door', 'drop_wall'].map((k) => ['drops', k, ROUTES[k]]), ...PAINT_WALLS.map((w) => ['walls', `paint_${w.key}`, w.via])].flatMap(([place, spot, via]) => { const pts = ['door', ...via, spot].map((k) => TOWN_SPOTS[k]); return pts.slice(1).map((b, i) => [pts[i], b, place]); });
// Every stretch of path once: [ax, az, bx, bz] (for drawing them).
export const PATHS = [...new Map(WALKS.map(([a, b]) => [[a, b].map((p) => `${p.x},${p.z}`).sort().join('|'), [a.x, a.z, b.x, b.z]])).values()];
// What stands there already: [what it is, x0, x1, z0, z1] and [what it is, x, z, radius] (world coordinates).
const KEEP_RECTS = [
  ...BUILDINGS.map((b) => { const [x0, x1, z0, z1] = rectOf(b); return [b.key === 'home' ? 'my own house stands there' : b.decor ? `${/^[aeiou]/i.test(b.name) ? 'an' : 'a'} ${b.name.toLowerCase().replace(/^flats$/, 'block of flats')} stands there` : `the ${b.name.toLowerCase()} stands there`, x0 - 0.6, x1 + 0.6, z0 - 0.6, z1 + 0.6]; }),
  ...WALLS.map((w) => { const [x0, x1, z0, z1] = wallRect(w); return ['my drawings hang on the wall there, and people must be able to see them', x0 - 1.6, x1 + 1.6, z0 - 1.6, z1 + 1.6]; }),
  ...PAINT_WALLS.filter((w) => w.back).map((w) => ['I paint on that back wall, and people must be able to see it', w.x - w.len / 2, w.x + w.len / 2, w.z - 2.6, w.z]),
  (() => { const [x0, x1, z0, z1] = rectOf(bOf('studio')); return ['my drawings hang on the walls of my art workshop, and people must be able to see them', x0 - 2.4, x1 + 2.4, z0, z1 + 2.4]; })(),
  ['the shelf with my prints stands there', PRINT_SHELF.x0 - 0.6, PRINT_SHELF.x1 + 0.6, PRINT_SHELF.z - 2, PRINT_SHELF.z + 2],
  ['the square must stay free: everyone walks there', SQUARE.x0 - 0.4, SQUARE.x1 + 0.4, SQUARE.z0 - 0.4, SQUARE.z1 + 0.4],
];
const inRect = (x, z, x0, x1, z0, z1, pad = 0) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;
const nearWalk = (x, z, pad) => WALKS.some(([a, b]) => { const dx = b.x - a.x, dz = b.z - a.z; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a.x - dx * t, z - a.z - dz * t) < pad; });
// The trees: scattered over the grass, always the same, and never on a path, the square, his land or against a building.
const TREES = (() => {
  let a = 20261123;
  const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (let i = 0; i < 400 && out.length < 30; i++) {
    const x = WORLD.x0 + 5 + rnd() * (WORLD.x1 - WORLD.x0 - 10), z = WORLD.z0 + 5 + rnd() * (WORLD.z1 - WORLD.z0 - 10), k = 0.8 + rnd() * 0.45;
    if (KEEP_RECTS.some(([, x0, x1, z0, z1]) => inRect(x, z, x0, x1, z0, z1, 3.5)) || inRect(x, z, PLOT.x0, PLOT.x1, PLOT.z0, PLOT.z1, 3) || inRect(x, z, -16, 40, 0, 7, 1)) continue; // (and not on the strip between the row of houses and the square)
    if (((x - POND.x) / (POND.rx + 3)) ** 2 + ((z - POND.z) / (POND.rz + 3)) ** 2 < 1 || nearWalk(x, z, 3.6) || out.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 9)) continue;
    if ([WILLOW, STONE, ...BENCHES, PLOT_SIGN].some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 6)) continue;
    out.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10, Math.round(k * 100) / 100]);
  }
  return out;
})();
const KEEP_ROUND = [
  ...TREES.map(([x, z, k]) => ['a tree stands there', x, z, 1.5 * k]),
  ['the willow stands there', ...WILLOW, 3], ...BENCHES.map(([x, z]) => ['a bench stands there', x, z, 2]),
  ['the green stone stands there', ...STONE, 3], ['the sign of my land stands there', ...PLOT_SIGN, 0.9],
];
// null when a thing with this footprint (world coordinates) can stand there, otherwise what is in the way, in his words.
export function buildProblem(x0, x1, z0, z1) {
  if (x0 < WORLD.x0 + 0.5 || x1 > WORLD.x1 - 0.5 || z0 < WORLD.z0 + 0.5 || z1 > WORLD.z1 - 0.5) return 'my world ends there';
  for (const [why, a, b, c, d] of KEEP_RECTS) if (x0 < b && x1 > a && z0 < d && z1 > c) return why;
  const nearX = (x) => Math.max(x0, Math.min(x1, x));
  const nearZ = (z) => Math.max(z0, Math.min(z1, z));
  for (const [why, x, z, r] of KEEP_ROUND) if (Math.hypot(nearX(x) - x, nearZ(z) - z) < r) return why;
  { const x = nearX(POND.x); const z = nearZ(POND.z); if (((x - POND.x) / (POND.rx + 1.3)) ** 2 + ((z - POND.z) / (POND.rz + 1.3)) ** 2 < 1) return 'the pond is there'; }
  for (const [a, b, place] of WALKS) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.6));
    for (let i = 0; i <= n; i++) if (inRect(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n, x0, x1, z0, z1, 1.1)) return `my own way to ${place === 'doorstep' ? 'my doorstep' : place === 'walls' ? 'a wall I paint on' : place === 'shop' ? 'the grocery store' : place === 'studio' ? 'my art workshop' : place === 'land' ? 'the land workshop' : place === 'workshop' ? 'the print workshop' : place === 'drops' ? 'where people leave notes for me' : place === 'cafe' ? 'the internet café' : `the ${place === 'board' ? 'notice board' : place}`} must stay free`;
  }
  return null;
}
// The places he can name. `at` is the middle, `half` how far it reaches (a thing goes beside it, not in it), `side` the
// side it goes to when he names none. The first place named in his words counts.
export const BUILD_PLACES = [
  { key: 'plot', name: 'on my land', words: /\b(my |the )?(plot|own land|own field|yard)\b|\bmy land\b/i, at: [(PLOT.x0 + PLOT.x1) / 2, (PLOT.z0 + PLOT.z1) / 2], half: [0, 0] },
  { key: 'pond', name: 'by the pond', words: /\bpond\b/i, at: [POND.x, POND.z], half: [POND.rx + 1.3, POND.rz + 1.3], side: [-1, 0] },
  { key: 'willow', name: 'by the willow', words: /\bwillow\b/i, at: WILLOW, half: [3, 3] },
  { key: 'stone', name: 'by the green stone', words: /\b(green|glowing) stone\b/i, at: STONE, half: [3, 3] },
  { key: 'library', name: 'by the library', words: /\blibrary\b/i, at: [29.2, -4.5], half: [8.6, 5.1], side: [1, 0] },
  { key: 'studio', name: 'by my art workshop', words: /\bart (work)?shop\b|\bstudio\b/i, at: [-6, 42], half: [8.4, 6.4], side: [-1, 0] },
  { key: 'landshop', name: 'by the land workshop', words: /\bland (work)?shop\b|\bland tools?\b/i, at: [20.4, 42], half: [6.6, 4.6], side: [1, 0] },
  { key: 'workshop', name: 'by the print workshop', words: /\b(print )?workshop\b|\bprinter\b/i, at: [8.7, 42], half: [6.1, 4.6], side: [0, 1] },
  { key: 'shop', name: 'by the grocery store', words: /\b(grocery( store)?|grocer|shop|store)\b/i, at: [14, -4.5], half: [7.6, 5.1], side: [0, 1] },
  { key: 'cafe', name: 'by the internet café', words: /\b(internet )?caf[eé]\b/i, at: [-21.2, -4], half: [7.6, 4.6], side: [-1, 0] },
  { key: 'north', name: 'in the north field', words: /\bnorth(ern)? field\b|\bbehind (the|my) houses?\b/i, at: [8, -28], half: [0, 0] }, // the big empty land behind the row of houses
  { key: 'west', name: 'in the west field', words: /\bwest(ern)? field\b/i, at: [-58, 6], half: [0, 0] },
  { key: 'east', name: 'in the east field', words: /\beast(ern)? field\b/i, at: [70, 20], half: [0, 0] },
  { key: 'south', name: 'in the south field', words: /\bsouth(ern)? field\b/i, at: [6, 55], half: [0, 0] },
  { key: 'park', name: 'in the meadow by the pond', words: /\b(park|meadow)\b/i, at: [-46, 40], half: [0, 0], wide: true },
  { key: 'square', name: 'beside the square', words: /\b(village )?square\b|\bnotice board\b/i, at: [(SQUARE.x0 + SQUARE.x1) / 2, (SQUARE.z0 + SQUARE.z1) / 2], half: [18.6, 12.6], side: [1, 0], wide: true },
  { key: 'street', name: 'in front of my house', words: /\b(street|my (front )?door|my house|my home|doorstep)\b/i, at: [-12, 4.6], half: [0, 0], wide: true },
];
// "outside by the pond", "in the meadow", "beside the square" -> the place he means (null for a plain "outside").
export function buildPlace(text) {
  const t = String(text ?? '');
  const hits = BUILD_PLACES.map((p) => ({ p, i: t.search(p.words) })).filter((h) => h.i >= 0);
  if (!hits.length) return null;
  const exact = hits.filter((h) => !h.p.wide); // "in the meadow by the pond" is the pond
  return (exact.length ? exact : hits).sort((a, b) => a.i - b.i)[0].p;
}
// Is this "where" a place out in his world? "outside ...", or one of the places with a word like by, in, on, at before it.
const PLACE_WORDS = /\b(by|at|near|in|on|beside|next to|in front of|behind|left of|right of|across from)\s+(the |my )?(pond|park|library|square|street|meadow|willow|green stone|grocery store|grocery|internet café|internet cafe|café|cafe|plot|land workshop|art workshop|print workshop|workshop|north field|south field|east field|west field|land)\b(?!\s+(lamp|light|sign|map|picture|painting|drawing|photo|model|book|shelf|poster|print|view))/i;
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
  const things = []; // what can be opened in the world: { kind, key, object } (main.js gives each a card that says what Pip can do there)
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

  // ---- the ground: one big flat field. Its colour follows the season (white in snow); a faint line every 4 m shows how
  // far things are. Where Pip shaped the land it goes up or down (reshape).
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
  // his own land: a lighter field that lies on the ground and follows it
  const fieldGeo = new THREE.PlaneGeometry(PLOT.x1 - PLOT.x0, PLOT.z1 - PLOT.z0, Math.round((PLOT.x1 - PLOT.x0) / 2), Math.round((PLOT.z1 - PLOT.z0) / 2));
  fieldGeo.rotateX(-Math.PI / 2);
  fieldGeo.translate((PLOT.x0 + PLOT.x1) / 2, 0, (PLOT.z0 + PLOT.z1) / 2);
  // (a slope is a little darker and a hole darker still, so a hill and a hole can be seen from far)
  const lift = (geo, by) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)) + by);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    if (!geo.attributes.color) geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    const col = geo.attributes.color, nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) - by; const k = Math.max(0.45, 1 - 3.4 * (1 - nor.getY(i))); const e = Math.min(1, Math.max(0, -y / 0.7)); col.setXYZ(i, k * (1 - e * 0.08), k * (1 - e * 0.42), k * (1 - e * 0.4)); } // (in a hole the grass is gone: bare earth)
    col.needsUpdate = true;
  };
  let landKey = '';
  const reshape = (list) => { // what he made of the land: hills and holes (the list of his state)
    const key = (Array.isArray(list) ? list : []).map((l) => `${l.id}${l.kind}${l.x},${l.z},${l.r},${l.h}`).join('|');
    if (key === landKey) return false;
    landKey = key;
    setLand(list);
    lift(groundGeo, -0.03); lift(fieldGeo, 0.012);
    return true;
  };
  lift(groundGeo, -0.03); lift(fieldGeo, 0.012);
  const groundTex = gridTex.clone(); groundTex.needsUpdate = true; groundTex.repeat.set(WW / 4, WD / 4);
  const ground = add(groundGeo, skin(groundTex), [0, 0, 0]);
  ground.material.vertexColors = true;
  ground.material.userData.tint = tintOf();
  ground.receiveShadow = true;
  { const cx = (WORLD.x0 + WORLD.x1) / 2, cz = (WORLD.z0 + WORLD.z1) / 2; for (const [w, d, x, z] of [[WW + 0.6, 0.3, cx, WORLD.z0 - 0.15], [WW + 0.6, 0.3, cx, WORLD.z1 + 0.15], [0.3, WD, WORLD.x0 - 0.15, cz], [0.3, WD, WORLD.x1 + 0.15, cz]]) box([w, 0.8, d], 0x8a6a4c, [x, -0.42, z]); } // the rim it lies in
  // the village square: sand, and sand paths from it to every door (there is no road: there are no cars)
  const paving = tex('tex/paving.jpg'); paving.wrapS = paving.wrapT = THREE.RepeatWrapping; paving.repeat.set((SQUARE.x1 - SQUARE.x0) / 3, (SQUARE.z1 - SQUARE.z0) / 3); paving.anisotropy = 4; // real cobbles (a photo from ambientCG, see web/tex/CREDITS.txt)
  const square = box([SQUARE.x1 - SQUARE.x0, 0.07, SQUARE.z1 - SQUARE.z0], skin(paving, 1.2), [(SQUARE.x0 + SQUARE.x1) / 2, 0.0, (SQUARE.z0 + SQUARE.z1) / 2]);
  square.receiveShadow = true;
  things.push({ kind: 'place', key: 'square', object: square });
  for (const [x, z] of [[SQUARE.x0, SQUARE.z0], [SQUARE.x1, SQUARE.z0], [SQUARE.x0, SQUARE.z1], [SQUARE.x1, SQUARE.z1]]) cyl(0.5, 0.56, 0.5, 0xd9cdb8, [x, 0.25, z]);
  const pathMat = M(0xe2d5bd);
  PATHS.forEach(([ax, az, bx, bz], i) => { const len = Math.hypot(bx - ax, bz - az); const p = box([len + 2, 0.04, 2.2], pathMat, [(ax + bx) / 2, -0.004 + i * 0.0012, (az + bz) / 2]); p.rotation.y = -Math.atan2(bz - az, bx - ax); p.receiveShadow = true; });
  const field = add(fieldGeo, M(0xb4dc9a, {}, 'grass', 14, 10), [0, 0, 0]);
  field.material.vertexColors = true;
  field.receiveShadow = true;
  things.push({ kind: 'place', key: 'plot', object: field });
  { const [sx, sz] = PLOT_SIGN; cyl(0.06, 0.06, 1.7, 0x7a5237, [sx, 0.85, sz]); for (const [dx, ry] of [[-0.03, -Math.PI / 2], [0.03, Math.PI / 2]]) { const sg = sign('Pip’s land', 2.4, 0.6, '#fde3c4', '#8a4a2c', 84); sg.position.set(sx + dx, 1.6, sz); sg.rotation.y = ry; group.add(sg); } }

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
    const front = b.tex ? { map: Object.assign(tex(b.tex), { magFilter: THREE.NearestFilter }), glow: null } : facade({ ...b.look, ...(b.who && b.look.door ? { door: { ...b.look.door, plate: b.name } } : {}), seed: i + 1 }, w, h); // who lives there: only a small nameplate by the door
    const side = facade({ wall: b.look.wall, color: b.look.color, trim: b.look.trim, bands: b.look.bands, photo: b.look.photo && { ...b.look.photo, fit: false }, ground: b.look.ground, windows: b.look.photo?.glow ? [] : b.look.sideWindows ?? Array.from({ length: Math.max(1, Math.floor((h - 1) / 3.2)) }, (_, k) => [d / 2 - 0.6, 1.1 + k * (b.look.bands ? 4.3 : 3.2), 1.2, 1.4]).filter((v) => v[1] + 1.6 < h), seed: i + 41 }, d, h);
    const back = facade({ wall: b.look.wall, color: b.look.color, trim: b.look.trim, bands: b.look.bands, photo: b.look.photo?.glow ? { src: 'tex/bricks_old.jpg', m: 2.3 } : b.look.photo, seed: i + 83 }, w, h);
    const top = M(b.roof ?? 0x6b6460, {}, 'roof', w / 3, d / 3);
    const body = add(new THREE.BoxGeometry(w, h, d), [skin(side.map), skin(side.map), top, top, skin(front.map), skin(back.map)], [0, h / 2, -d / 2], g);
    body.castShadow = true;
    const cap = box([w + 0.36, 0.22, d + 0.36], M(b.roof ?? 0x6b6460, {}, 'roof', w / 3, d / 3), [0, h + 0.11, -d / 2], g); // the edge of the roof
    roofs.push({ m: cap, color: b.roof ?? 0x6b6460 });
    let glow = null;
    if (front.glow) { glow = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: front.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }), [0, h / 2, 0.02], g); }
    if (b.low) lowOnes.push(g);
    blocks.push({ b, g, glow });
    things.push({ kind: 'building', key: b.key, object: g });
  });
  const blockOf = (key) => blocks.find((x) => x.b.key === key);
  // the screen in the window of the internet café: what he last looked up or read there, and what he thought of it
  const cafeScreen = (() => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 160;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.9), new THREE.MeshBasicMaterial({ map: t }));
    m.position.set(2.1, 1.85, 0.03);
    blockOf('cafe').g.add(m);
    box([7.9, 2.2, 0.06], 0x2a2a2e, [2.1, 1.85, 0.0], blockOf('cafe').g);
    let shown = null;
    const FACE = { love: '😍', like: '🙂', meh: '😐', dislike: '😒', doubt: '🤨' };
    return (s) => {
      const e = [...(s?.log ?? [])].reverse().find((x) => ['search_web', 'read_book', 'browse'].includes(x.action) && !x.failed && (x.query || x.opened?.title || x.topic));
      const what = e ? String(e.query || e.opened?.title || e.topic) : '';
      const key = `${what}|${e?.opinion?.says ?? ''}`;
      if (key === shown) return;
      shown = key;
      const g = c.getContext('2d');
      g.fillStyle = '#0d1424'; g.fillRect(0, 0, c.width, c.height);
      for (let y = 0; y < c.height; y += 4) { g.fillStyle = 'rgba(127,214,255,.035)'; g.fillRect(0, y, c.width, 1); }
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillStyle = '#7fd6ff'; g.font = '700 20px ui-monospace, Menlo, Consolas, monospace';
      g.fillText(e ? (e.action === 'search_web' ? '> PIP LOOKED UP' : e.action === 'browse' ? '> PIP CAME ACROSS' : '> PIP READ ABOUT') : '> NOBODY IS ONLINE', 20, 28);
      const fit = (text, font, max) => { g.font = font; let x = String(text); while (x.length > 4 && g.measureText(x).width > max) x = `${x.slice(0, -2).trimEnd()}…`; return x; };
      if (e) { g.fillStyle = '#f4f7ff'; g.fillText(fit(what, '700 34px ui-monospace, Menlo, Consolas, monospace', 600), 20, 74); }
      g.fillStyle = '#ffd36e';
      g.fillText(e?.opinion ? fit(`${FACE[e.opinion.how] ?? ''} “${e.opinion.says}”`, '600 22px system-ui, sans-serif', 600) : e ? fit('He has not said what he thinks of it yet.', '600 20px system-ui, sans-serif', 600) : '', 20, 124);
      t.needsUpdate = true;
    };
  })();
  // small things on some of them: Pip's doorstep and letterbox, the OPEN sign of the grocery store
  box([1.7, 0.2, 0.75], 0xd9cdb8, [0, 0.1, 0.42]);
  cyl(0.04, 0.04, 1.0, 0x7a5237, [2.7, 0.5, 0.75]); box([0.5, 0.32, 0.3], 0xc0392b, [2.7, 1.1, 0.75]);
  const letter = box([0.3, 0.2, 0.02], 0xfff8ee, [2.7, 1.32, 0.75]);
  const openSign = sign('OPEN', 0.84, 0.3, '#4caf6a', '#ffffff', 150);
  openSign.position.set(3.5, 1.72, 0.05); blockOf('shop').g.add(openSign);
  { const g = blockOf('land').g; for (const [x, c] of [[1.4, 0x8a6a48], [2.8, 0x9a7a52], [4.1, 0x7f9a5a]]) { const heap = add(new THREE.ConeGeometry(0.75, 0.9, 9), M(c), [x, 0.45, 0.9], g); heap.scale.set(1, 1, 0.8); } cyl(0.035, 0.035, 1.7, 0x7a5237, [5.3, 0.85, 0.3], g).rotation.z = 0.12; box([0.34, 0.4, 0.04], 0x9aa3a8, [5.2, 0.2, 0.3], g); } // heaps of earth and a spade by the shutter

  // ---- walls for his art: bare concrete, both sides. What he paints goes on them, and on the back walls of the houses.
  WALLS.forEach((w, i) => {
    const g = new THREE.Group();
    g.position.set(w.at[0], 0, w.at[1]);
    g.rotation.y = w.turn === 90 ? Math.PI / 2 : 0;
    group.add(g);
    const f = facade({ wall: 'concrete', color: '#aaa69f', plain: true, photo: { src: 'tex/concrete.jpg', m: 2.6 }, seed: 200 + i }, w.len, WALL_H);
    const f2 = facade({ wall: 'concrete', color: '#a39f98', plain: true, photo: { src: 'tex/concrete.jpg', m: 2.6 }, seed: 300 + i }, w.len, WALL_H);
    const edge = M(0x8d8880);
    add(new THREE.BoxGeometry(w.len, WALL_H, 0.4), [edge, edge, edge, edge, skin(f.map), skin(f2.map)], [0, WALL_H / 2, 0], g).castShadow = true;
    things.push({ kind: 'wall', key: w.key, object: g });
  });
  const painted = new THREE.Group(); // his paintings on the walls
  const gallery = new THREE.Group(); // every drawing he ever made, on the outside of the art workshop
  group.add(painted, gallery);
  const artTex = new Map(); // a drawing's picture, loaded once
  // the shelf of the print workshop: three boards under a little roof, in front of the shutter (main.js puts his prints on it)
  { const sh = PRINT_SHELF; const w = sh.x1 - sh.x0; const cx = (sh.x0 + sh.x1) / 2;
    const g = new THREE.Group(); group.add(g);
    for (const y of sh.rows) box([w, 0.06, 0.62], M(0xc9a26a, {}, 'boards', 4, 1), [cx, y - 0.03, sh.z], g);
    for (const x of [sh.x0 + 0.05, cx, sh.x1 - 0.05]) for (const z of [sh.z - 0.27, sh.z + 0.27]) box([0.07, 2.75, 0.07], 0x7a5237, [x, 1.375, z], g);
    box([w + 0.3, 0.07, 0.9], M(0x5c6468, { metalness: 0.3 }, 'metal', 5, 1), [cx, 2.8, sh.z + sh.dir * 0.05], g).rotation.x = sh.dir * 0.12;
    const sg = sign('printed by Pip', 2.2, 0.36, '#2a2a2e', '#f2c14e', 60); sg.position.set(cx, 2.55, sh.z + sh.dir * 0.33); sg.rotation.y = sh.dir < 0 ? Math.PI : 0; g.add(sg);
    things.push({ kind: 'shelf', key: 'shelf', object: g }); }
  // the notice board: two posts, a board with a little roof, and the notes people pinned on it (drawn again when they change)
  const boardNotes = (() => {
    const g = new THREE.Group(); g.position.set(BOARD.x, 0, BOARD.z); group.add(g);
    for (const dx of [-BOARD.w / 2 + 0.1, BOARD.w / 2 - 0.1]) box([0.12, 2.5, 0.12], 0x7a5237, [dx, 1.25, -0.02], g);
    box([BOARD.w + 0.5, 0.08, 0.5], M(0x8a5a3a, {}, 'roof', 2, 1), [0, 2.58, 0.05], g).rotation.x = 0.14;
    const c = document.createElement('canvas'); c.width = 416; c.height = 240;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    add(new THREE.BoxGeometry(BOARD.w, BOARD.h, 0.08), [M(0x9a6b47), M(0x9a6b47), M(0x9a6b47), M(0x9a6b47), skin(t, 2.2), skin(t, 2.2)], [0, 1.65, 0], g);
    things.push({ kind: 'board', key: 'board', object: g });
    let shown = null;
    return (notes) => {
      const key = notes.map((n) => `${n.topic}${n.reward}`).join('|');
      if (key === shown) return;
      shown = key;
      const x = c.getContext('2d');
      x.fillStyle = '#b98a5a'; x.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(90,60,30,${0.05 + ((i * 37) % 10) / 100})`; x.fillRect(0, (i * 53) % c.height, c.width, 2); }
      x.fillStyle = '#5a3d22'; x.font = '800 24px "Marker Felt", "Comic Sans MS", "Chalkboard SE", cursive, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('NOTICE BOARD', c.width / 2, 22);
      const paper = ['#fffaf0', '#fde9a8', '#d8efe0'];
      notes.slice(0, 3).forEach((n, i) => {
        const px = 14 + i * 132, py = 46 + (i % 2) * 8, pw = 124, ph = 172;
        x.save(); x.translate(px + pw / 2, py + ph / 2); x.rotate(((i * 7) % 5 - 2) * 0.02); x.translate(-pw / 2, -ph / 2);
        x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(3, 4, pw, ph);
        x.fillStyle = paper[i % 3]; x.fillRect(0, 0, pw, ph);
        x.fillStyle = '#c0392b'; x.beginPath(); x.arc(pw / 2, 9, 6, 0, 7); x.fill();
        x.fillStyle = '#8a4a2c'; x.font = '800 17px system-ui, sans-serif'; x.fillText('WANTED', pw / 2, 34);
        x.fillStyle = '#3b2f2a'; x.font = '700 17px system-ui, sans-serif';
        const words = String(n.topic).replace(/ from the 3D printer$/, ' (printed)').split(' '); const lines = []; let line = '';
        for (const w of words) { if (x.measureText(`${line} ${w}`).width > pw - 12 && line) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w; }
        lines.push(line);
        lines.slice(0, 4).forEach((l, k) => x.fillText(l, pw / 2, 64 + k * 21));
        x.fillStyle = '#b8860b'; x.font = '800 19px system-ui, sans-serif'; x.fillText(`${n.reward} coins`, pw / 2, ph - 20);
        x.restore();
      });
      if (!notes.length) { x.fillStyle = 'rgba(90,60,30,.7)'; x.font = '700 18px system-ui, sans-serif'; x.fillText('nothing today', c.width / 2, c.height / 2 + 10); }
      t.needsUpdate = true;
    };
  })();

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
  for (const [x, z] of [[SQUARE.x0, SQUARE.z0], [SQUARE.x1, SQUARE.z0], [SQUARE.x0, SQUARE.z1], [SQUARE.x1, SQUARE.z1], [-5.6, 2.7]]) {
    cyl(0.07, 0.09, 3.6, 0x4a4f66, [x, 1.8, z]);
    const bulb = add(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe6e1d6, emissive: 0xffe9a8, emissiveIntensity: 0 }), [x, 3.7, z]);
    const light = new THREE.PointLight(0xffe2a0, 0, 18, 1.6);
    light.position.set(x, 3.5, z);
    group.add(light);
    lamps.push({ bulb, light });
  }
  // ---- a tall green stone that glows a little. Nobody knows who put it there.
  const stoneGlow = new THREE.MeshStandardMaterial({ color: 0x2fa37a, roughness: 0.35, emissive: 0x2fa37a, emissiveIntensity: 0.5, map: grain('stone'), emissiveMap: grain('stone') });
  { const st = add(new THREE.OctahedronGeometry(1.5, 0), stoneGlow, [STONE[0], 2.4, STONE[1]]); st.scale.set(0.8, 2.0, 0.7); st.rotation.set(0.1, 0.5, 0.08); things.push({ kind: 'place', key: 'stone', object: st }); for (const [dx, dz, k] of [[1.6, 0.5, 0.35], [-1.3, 1.0, 0.25], [0.4, -1.5, 0.3]]) { const s2 = add(new THREE.OctahedronGeometry(1.5, 0), stoneGlow, [STONE[0] + dx, 0.5, STONE[1] + dz]); s2.scale.set(k, k * 1.6, k); } }
  const stoneLight = new THREE.PointLight(0x4fe0a8, 0, 22, 1.4);
  stoneLight.position.set(STONE[0], 3, STONE[1]);
  group.add(stoneLight);
  // ---- the pond with its willow and benches
  const water = new THREE.MeshStandardMaterial({ color: 0x7fc4e8, roughness: 0.25, emissive: 0x2a6f95, emissiveIntensity: 0.35 });
  { const pondMesh = add(new THREE.CylinderGeometry(1, 1, 0.08, 40), water, [POND.x, 0.03, POND.z]); pondMesh.scale.set(POND.rx, 1, POND.rz); things.push({ kind: 'place', key: 'pond', object: pondMesh }); }
  add(new THREE.CylinderGeometry(1, 1, 0.05, 40), M(0xcdbb8e), [POND.x, 0.01, POND.z]).scale.set(POND.rx + 0.7, 1, POND.rz + 0.7);
  for (let i = 0; i < 26; i++) { const a = 2.2 + i * 0.13; cyl(0.04, 0.05, 1.1 + (i % 3) * 0.3, 0x5f9e63, [POND.x + Math.cos(a) * (POND.rx + 0.2), 0.6, POND.z + Math.sin(a) * (POND.rz + 0.2)]); }
  const ducks = [];
  const duck = (body, head) => { const g = new THREE.Group(); const b = add(new THREE.SphereGeometry(0.42, 12, 8), M(body), [0, 0.22, 0], g); b.scale.set(1.25, 0.7, 0.85); add(new THREE.SphereGeometry(0.2, 10, 8), M(head), [0.42, 0.55, 0], g); const bill = add(new THREE.ConeGeometry(0.08, 0.22, 8), M(0xf2a33c), [0.66, 0.53, 0], g); bill.rotation.z = -Math.PI / 2; group.add(g); ducks.push(g); return g; };
  duck(0xffffff, 0xffffff); duck(0xe8d9b8, 0x3d7d5a); duck(0xd9c7a0, 0x3d7d5a); duck(0xffffff, 0xffffff);
  const benchAt = (x, z, rot = 0) => { const g = new THREE.Group(); g.position.set(x, groundAt(x, z), z); g.rotation.y = rot; group.add(g); box([2.2, 0.1, 0.6], 0x9a6b47, [0, 0.55, 0], g); box([2.2, 0.5, 0.08], 0x9a6b47, [0, 0.95, -0.3], g); for (const dx of [-0.9, 0.9]) box([0.1, 0.55, 0.5], 0x7a5237, [dx, 0.27, 0], g); return g; };
  for (const [x, z, rot] of BENCHES) benchAt(x, z, rot);
  { const g = new THREE.Group(); g.position.set(WILLOW[0], 0, WILLOW[1]); group.add(g); cyl(0.4, 0.55, 3.4, 0x6b4a35, [0, 1.7, 0], g).castShadow = true; const wl = se.leafOn <= 0.05 ? null : se.turn > 0.5 ? 0xc9b24f : 0x86b96a; if (wl) { add(new THREE.SphereGeometry(2.6, 12, 9), M(wl), [0, 4.4, 0], g).scale.y = 0.75; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; cyl(0.5, 0.2, 2.6, M(wl), [Math.cos(a) * 2.1, 2.9, Math.sin(a) * 2.1], g, 6); } } }
  // Daylight for the world. The lamps and the window light of his room are far away, so the world has lights of its own,
  // high above it (they do not reach his room).
  const suns = [[-44, 46, 14, 100], [4, 46, 24, 110], [50, 46, 16, 110], [6, 46, -18, 100]].map(([x, y, z, far]) => { const l = new THREE.PointLight(0xfff4e2, 1.5, far, 0); l.position.set(x, y, z); group.add(l); return l; });

  const lyingThings = new THREE.Group(); // what people left for him (filled further down)
  group.add(lyingThings);
  let frozenNow = false;
  function animate(t) {
    stoneGlow.emissiveIntensity = 0.45 + Math.sin(t * 0.9) * 0.2; // the stone breathes
    lyingThings.children.forEach((m, i) => { m.position.y = m.userData.bob + Math.sin(t * 2 + i) * 0.06; }); // what lies waiting for him bobs a little
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
    // the gallery: the newest first, on the two side walls of the art workshop, then on its back wall
    wipe(gallery);
    const [x0, x1, z0, z1] = rectOf(BUILDINGS.find((b) => b.key === 'studio'));
    const cells = [];
    const rows = [3.95, 2.95, 1.95, 0.95];
    for (const y of rows) for (let z = z0 + 0.85; z < z1 - 0.5; z += 1.32) cells.push([x0 - 0.03, y, z, -Math.PI / 2]);
    for (const y of rows) for (let z = z0 + 0.85; z < z1 - 0.5; z += 1.32) cells.push([x1 + 0.03, y, z, Math.PI / 2]);
    for (const y of rows) for (let x = x1 - 0.85; x > x0 + 0.5; x -= 1.32) cells.push([x, y, z1 + 0.03, 0]);
    const white = M(0xfffaf3);
    [...all].reverse().slice(0, cells.length).forEach((a, i) => {
      const [x, y, z, ry] = cells[i];
      const asp = Number(a.aspect) > 0 ? a.aspect : 1.33;
      const ww = Math.min(1.12, 0.84 * asp), hh = ww / asp;
      const f = add(new THREE.PlaneGeometry(ww + 0.1, hh + 0.1), white, [x, y, z], gallery); f.rotation.y = ry;
      const m = add(new THREE.PlaneGeometry(ww, hh), skin(picture(a), 2.4), [x + Math.sin(ry) * 0.012, y, z + Math.cos(ry) * 0.012], gallery); m.rotation.y = ry;
    });
  }

  // ---- what people left for him: a note from a traveller (an envelope) and the small deeds of visitors. They lie in
  // his world until he finds them. Each is a little picture that always looks at you.
  const emojiTex = new Map();
  const emoji = (ch) => { if (!emojiTex.has(ch)) { const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); g.font = '72px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 48, 54); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; emojiTex.set(ch, t); } return emojiTex.get(ch); };
  let lyingKey = '';
  function layDown(s, now) {
    const notes = (s?.drops ?? []).filter((d) => d.status === 'lying' && Date.parse(d.at) <= now && LIE[d.spot]);
    const deeds = (s?.deeds ?? []).filter((d) => d.status === 'lying' && LIE[d.deed]);
    const key = [...notes.map((d) => d.id), ...deeds.map((d) => d.id)].join(',');
    if (key === lyingKey) return;
    lyingKey = key;
    for (const m of lyingThings.children) m.material.dispose();
    lyingThings.clear();
    const put = (ch, [x, z], y, size, info) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoji(ch), transparent: true, depthWrite: false })); sp.scale.set(size, size, 1); sp.position.set(x, groundAt(x, z) + y, z); sp.userData.info = info; sp.userData.bob = sp.position.y; lyingThings.add(sp); };
    for (const d of notes) put('💌', LIE[d.spot], 0.55, 0.8, () => ({ title: 'A note for Pip', icon: '💌', subtitle: 'In his world', sections: [{ lines: [`From ${d.from}, ${d.who}${d.madeUp ? ' (a made-up traveller)' : ''}.`, `“${d.text}”`] }, { heading: 'So far', lines: ['Pip has not picked it up yet. He will walk here to get it.'] }] }));
    for (const d of deeds) put(deedEmoji[d.deed] ?? '🎁', LIE[d.deed], d.deed === 'hat' ? 5.6 : d.deed === 'doodle' ? 1.7 : d.deed === 'chalk' ? 0.25 : 0.45, d.deed === 'chalk' ? 1.6 : 0.6, () => ({ title: deedTitle[d.deed] ?? 'A small deed', icon: deedEmoji[d.deed] ?? '🎁', subtitle: 'In his world', sections: [{ lines: ['A visitor did this for Pip.'] }, { heading: 'So far', lines: ['Pip has not found it yet.'] }] }));
  }
  const deedEmoji = { flower: '🌼', apple: '🍎', boat: '⛵', doodle: '✏️', hat: '🎩', bookmark: '🔖', chalk: '🟨' };
  const deedTitle = { flower: 'A flower on his doorstep', apple: 'An apple for Pip', boat: 'A paper boat', doodle: 'A doodle on the board', hat: 'A tiny hat on the stone', bookmark: 'A bookmark', chalk: 'Hopscotch on the square' };

  // ---- what follows the real time: lights in the windows, the shop sign, the clock, the snow
  const nightBlue = new THREE.Color(0x1c2a55);
  let said = '';
  let insideNow = false;
  function update(s, now = Date.now(), hour = undefined) {
    state.weather = s?.weather ?? null;
    const shaped = reshape(s?.land);
    layDown(s, now);
    cafeScreen(s);
    hangArt(s, now);
    boardNotes((s?.wishes ?? []).filter((w) => w.board && w.status === 'open' && now - Date.parse(w.at) < 3 * 86_400_000));
    const h = Number.isFinite(hour) ? hour : hourNL(now); // (a test or a screenshot can ask for an hour)
    const dark = h < se.sunrise - 0.4 || h > se.sunset + 0.3;
    const dusk = dark || h > se.sunset - 0.9;
    const away = Boolean(s?.where && s.where.place !== 'home' && now >= Date.parse(s.where.leftAt));
    const key = `${Math.floor(h * 4)}${dark}${dusk}${away}${shopOpen(now)}${snowy()}${(s?.visitors ?? []).filter((v) => v.npc && !v.answer).length}${new Date(now).getDay()}${insideNow}`;
    if (key === said && !shaped) return;
    said = key;
    fogColor = paintSky(h);
    for (const { b, glow } of blocks) { // the windows are lit when someone is in and it is getting dark
      if (!glow) continue;
      const up = b.key === 'home' ? !away && h >= 8 && h < 23 : b.key === 'shop' ? shopOpen(now) : b.lit ? h >= b.lit[0] && h < b.lit[1] : h >= 7 && h < 22;
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
  const farTex = gridTex.clone(); farTex.needsUpdate = true; 
  const farShape = new THREE.Shape(); farShape.absarc(0, 0, 640, 0, Math.PI * 2, false);
  { const hole = new THREE.Path(); hole.moveTo(WORLD.x0 - 0.2, -(WORLD.z1 + 0.2)); hole.lineTo(WORLD.x1 + 0.2, -(WORLD.z1 + 0.2)); hole.lineTo(WORLD.x1 + 0.2, -(WORLD.z0 - 0.2)); hole.lineTo(WORLD.x0 - 0.2, -(WORLD.z0 - 0.2)); hole.closePath(); farShape.holes.push(hole); }
  farTex.repeat.set(0.25, 0.25);
  const land = add(new THREE.ShapeGeometry(farShape, 48), new THREE.MeshBasicMaterial({ map: farTex, color: tintOf() }), [0, -0.75, 0], far);
  land.rotation.x = -Math.PI / 2;
  const hillMat = new THREE.MeshBasicMaterial({ color: 0x8fb89a });
  const hillMat2 = new THREE.MeshBasicMaterial({ color: 0xa7c6b4 });
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + 0.2; const r = 330 + ((i * 37) % 90); const hl = add(new THREE.SphereGeometry(60 + ((i * 53) % 50), 12, 8), i % 2 ? hillMat : hillMat2, [Math.cos(a) * r, -18, Math.sin(a) * r], far); hl.scale.y = 0.38 + ((i * 17) % 10) / 40; }
  { const hide = add(new THREE.SphereGeometry(46, 16, 10), hillMat, [-TOWN_X + 1.6, -14, 0], far); hide.scale.y = 0.75; } // (his real rooms stand far to the side of the world: this hill covers them)
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
  return { group, update, setWalk, setInside, animate, skyFog, things, reshape };
}
