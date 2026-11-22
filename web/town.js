// Pip's street in 3D: the same street as the drawing in the World tab (street.js), built from simple shapes like his room.
// It stands in the same scene as his house, far to the side (at x = TOWN_X), like the inside and the outside of a house
// in a game: his front door in the hall leads here, and the door of his house here leads back into the hall.
// The viewer can look at it from above (the "Street" view) or walk through it; when Pip goes out, he is seen here.
// Everything is free: no model, no server. It follows the real hour, season and weather like the drawing does.
import { PEOPLE, faceSvg, hourNL, shopOpen } from './street.js';
import { seasonInfo } from './season.js';
import { makeGrain } from './grain.js';

export const TOWN_X = 220; // where the street is in the scene (his house is around x 0; the park reaches 92 m to the left of the street)
export const TOWN_RANGE = [-39, 42]; // from the left end of the street to the right end (street coordinates)
export const TOWN_Z = [-9, 28];
// Pip's own plot: a piece of land across the street from his house, for the things he makes that are too big or too
// many for his room (like Pino's town, which grows with what its bird builds). Street coordinates.
export const PLOT = { x0: -11, x1: 35, z0: 12.4, z1: 26.6 };
export const inTown = (x) => x > 60;
// Places in the street (street coordinates: x along the street, z toward the viewer; the house fronts are at z 0).
export const TOWN_SPOTS = {
  door: { x: 0, z: 1.1, face: 0 }, // in front of Pip's own door
  step: { x: 0.2, z: 0.62, face: 0, y: 0.2 }, // on his own doorstep
  shop: { x: 34.6, z: 1.0, face: Math.PI },
  garden: { x: -29.5, z: -3.4, face: 0.6 }, // between Oma Jo's vegetable beds
  gate: { x: -25.6, z: 0.9, face: Math.PI }, // her garden gate: the way in and out
  gateIn: { x: -25.7, z: -1.3, face: Math.PI }, // just inside it
  left: { x: -38, z: 1.2, face: -Math.PI / 2 }, // the way to the park and the pond, and up the hill
  right: { x: 41, z: 1.2, face: Math.PI / 2 }, // the way to the library
  parkGate: { x: -44, z: 1.4, face: -Math.PI / 2 }, // where the street becomes the park path
  pond: { x: -58.5, z: 5.6, face: 0.25 }, // by the bench under the willow, looking over the water
  hillFoot: { x: -62, z: -6, face: Math.PI },
  hillBend: { x: -72, z: -15, face: Math.PI },
  hill: { x: -65.2, z: -23.2, face: 0.5 }, // on the top, by the bench
  libFront: { x: 46, z: 3.6, face: Math.PI / 2 },
  library: { x: 57, z: 3.6, face: Math.PI }, // at the foot of the library steps
};
// Where Pip is seen for each place of his world: [spot, does he walk on out of the street?]
// Where Pip is seen for each place of his world: [the spot, 'in' when he goes inside there (then he is out of sight)].
export const TOWN_FOR = { doorstep: ['step', ''], shop: ['shop', ''], garden: ['garden', ''], pond: ['pond', ''], hill: ['hill', ''], library: ['library', 'in'] };
// The way to each spot from his door: the corners he walks by, one after the other (the way home is the same, backwards).
export const ROUTES = { garden: ['gate', 'gateIn'], pond: ['left', 'parkGate'], hill: ['left', 'parkGate', 'hillFoot', 'hillBend'], library: ['right', 'libFront'] };
// The world outside the street: the park with the pond and the hill to the left, the library to the right (street coordinates).
export const WORLD_RANGE = [-92, 74];
export const PARK = { x0: -92, x1: -39, z0: -46, z1: 28 };
export const POND = { x: -64, z: 14, rx: 11.5, rz: 6.5 };
export const HILL = { x: -66, z: -24, r: 21, h: 8.5 };
// How high the ground is (the hill): street coordinates in, metres out. Everywhere else the ground is flat.
export function groundAt(lx, z) {
  const d = Math.hypot(lx - HILL.x, z - HILL.z) / HILL.r;
  return d >= 1 ? 0 : HILL.h * (1 - d * d) ** 2;
}
export const townGround = (x, z) => groundAt(x - TOWN_X, z);
// What cannot be walked through: [x0, x1, z0, z1] in street coordinates (the houses, the fence, the trees).
const BLOCKS = [[-24.6, -14.4, -7.5, 0.2], [-13.4, -4.6, -7.5, 0.2], [-4.6, 4.6, -7.5, 0.2], [6.4, 16.6, -7.5, 0.2], [17.9, 25.1, -7.5, 0.2], [26.9, 39.1, -7.5, 0.2], [-23.6, -13.4, 11.8, 19], [-36.2, -35.4, -7.5, 0.3], [-36.2, -24.6, -7.6, -7.2], [-36.2, -26.6, -0.1, 0.25], [48.8, 65.2, -10, 2.3]];
export function townBlocked(x, z, pad = 0.3) {
  const lx = x - TOWN_X;
  const inside = (x0, x1, z0, z1) => lx >= x0 + 0.4 && lx <= x1 - 0.4 && z >= z0 + 0.4 && z <= z1 - 0.4;
  if (!(inside(TOWN_RANGE[0] - 1, TOWN_RANGE[1] + 1, TOWN_Z[0], TOWN_Z[1]) || inside(PARK.x0, PARK.x1 + 1, PARK.z0, PARK.z1) || inside(TOWN_RANGE[1] - 1, WORLD_RANGE[1], TOWN_Z[0], TOWN_Z[1]))) return true; // the street, the park, the library square
  if (((lx - POND.x) / (POND.rx + pad)) ** 2 + ((z - POND.z) / (POND.rz + pad)) ** 2 < 1) return true; // the water
  return BLOCKS.some(([x0, x1, z0, z1]) => lx > x0 - pad && lx < x1 + pad && z > z0 - pad && z < z1 + pad);
}
// Standing right in front of Pip's door in the street (for the viewer who walks: this is the way back into the hall).
export const atTownDoor = (x, z) => Math.abs(x - TOWN_X) < 0.75 && z < 0.75 && z > -0.2;

// ---- Where Pip may build (decor.js). He picks the place himself, anywhere in his world: on his plot, in the street,
// in the park, by the pond, on the hill, by the library. The only rule: it has to fit. It may not stand in a house, in the
// water, on a tree or on what is already there, and the ways people walk must stay free (the pavement along the doors,
// the park path, the way up the hill). It can be bigger than a house.
export const BUILD_MAX = { w: 20, h: 18, d: 20 };
// What stands there already: [what it is, x0, x1, z0, z1] and [what it is, x, z, radius] (street coordinates).
const KEEP_RECTS = [
  ['the houses of my street stand there', -40.5, 43.5, -10.5, 0.25], ['the pavement along the doors must stay free to walk on', -45, 74, 0.25, 2.5],
  ['the park path must stay free to walk on', -71.5, -39, 0.2, 2.6], ['Lina’s house stands there', -24.4, -12.6, 11, 19.8], ['the library stands there', 48, 66, -10.5, 4.8],
  ['the market stalls stand there on Saturday', -8, 9.5, 8.3, 10.7], ['the old containers stand there', -40.4, -28.8, 19, 27.4],
];
const TREES = [[-37.5, -5.5, 1.1], [-25.2, 10.2, 0.9], [5.5, -5.5, 0.8], [-13, 24, 1.1], [40, -5, 1.1], [39.5, 14, 0.9], [-36, 13, 1], [-30, 25, 1.2], [39, 25.5, 1], [-45, -8, 1.1], [-52, -16, 1], [-84, 2, 1.2], [-86, 18, 1], [-78, 24, 1.1], [-47, 22, 0.9], [-86, -14, 1.1], [-50, -34, 1.2], [-84, -36, 1], [-74, 8, 0.8], [46, -5, 1], [70, -4, 1.1], [69, 12, 1], [47, 16, 1.1], [60, 22, 1.2]];
const STONES = [[-60.5, -1.5], [-61.5, -4], [-62, -6.5], [-64, -9], [-67, -11.5], [-70, -13.8], [-72, -16], [-71.2, -18.6], [-69, -20.6], [-66.8, -22.2]];
const KEEP_ROUND = [
  ...TREES.map(([x, z, k]) => ['a tree stands there', x, z, 1.5 * k]), ...STONES.map(([x, z]) => ['the path up the hill must stay free', x, z, 1.3]),
  ['the willow stands there', -52.8, 6.4, 3], ['the swing stands there', -48.5, 9.5, 2.5], ['a park bench stands there', -60.5, 5.2, 2.2], ['a park bench stands there', -69, 5.6, 1.8],
  ['the bench and the flag on the hilltop stand there', HILL.x + 0.8, HILL.z - 0.3, 3.4], ['the old boat lies there', -78, 21.5, 3.4], ['the green stone stands there', -82, -6, 3],
  ['the radio mast stands there', -86, -40, 2.4], ['the heap of junk lies there', 43.5, 13.5, 2.5], ['the sign of my plot stands there', -2.2, 12.1, 0.9],
  ...[-37, -14, 9, 32, 47].map((x) => ['a pole with wires stands there', x, 10.9, 0.6]),
];
// The ways he walks himself (ROUTES): they stay free too, from corner to corner.
const WALKS = Object.entries(TOWN_FOR).flatMap(([place, [spot]]) => { const pts = ['door', ...(ROUTES[place] ?? []), spot].map((k) => TOWN_SPOTS[k]); return pts.slice(1).map((b, i) => [pts[i], b, place]); });
const inRect = (x, z, x0, x1, z0, z1, pad = 0) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;
// null when a thing with this footprint (street coordinates) can stand there, otherwise what is in the way, in his words.
export function buildProblem(x0, x1, z0, z1) {
  if (x0 < PARK.x0 + 0.5 || x1 > WORLD_RANGE[1] - 0.5) return 'my world ends there';
  for (const [a, b, lo, hi] of [[PARK.x0, PARK.x1, PARK.z0, PARK.z1], [PARK.x1, WORLD_RANGE[1], TOWN_Z[0] - 1.5, TOWN_Z[1] + 1]]) if (x1 > a && x0 < b && (z0 < lo + 0.5 || z1 > hi - 0.5)) return 'my world ends there';
  for (const [why, a, b, c, d] of KEEP_RECTS) if (x0 < b && x1 > a && z0 < d && z1 > c) return why;
  const nearX = (x) => Math.max(x0, Math.min(x1, x));
  const nearZ = (z) => Math.max(z0, Math.min(z1, z));
  for (const [why, x, z, r] of KEEP_ROUND) if (Math.hypot(nearX(x) - x, nearZ(z) - z) < r) return why;
  { const x = nearX(POND.x); const z = nearZ(POND.z); if (((x - POND.x) / (POND.rx + 1.3)) ** 2 + ((z - POND.z) / (POND.rz + 1.3)) ** 2 < 1) return 'the pond is there'; }
  if (x0 < PLOT.x1 + 0.3 && x1 > PLOT.x0 - 0.3 && z0 < PLOT.z1 + 0.3 && z1 > PLOT.z0 - 0.3 && !(x0 >= PLOT.x0 + 0.3 && x1 <= PLOT.x1 - 0.3 && z0 >= PLOT.z0 + 0.3 && z1 <= PLOT.z1 - 0.3)) return 'the fence of my plot runs there';
  for (const [a, b, place] of WALKS) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.6));
    for (let i = 0; i <= n; i++) if (inRect(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n, x0, x1, z0, z1, 1.1)) return `my own way to ${place === 'doorstep' ? 'my doorstep' : `the ${place}`} must stay free`;
  }
  return null;
}
// The places he can name. `at` is the middle, `half` how far it reaches (a thing goes beside it, not in it), `needs` the
// place of his world he must know first (world.js). The first place named in his words counts.
export const BUILD_PLACES = [
  { key: 'plot', name: 'on my plot', words: /\b(my |the )?(plot|own land|own field|yard)\b/i, at: [12, 19.5], half: [0, 0] },
  { key: 'pond', name: 'by the pond', words: /\bpond\b/i, at: [POND.x, POND.z], half: [POND.rx + 1.3, POND.rz + 1.3], needs: 'pond' },
  { key: 'willow', name: 'by the willow', words: /\bwillow\b/i, at: [-52.8, 6.4], half: [3, 3], needs: 'pond' },
  { key: 'swing', name: 'by the swing', words: /\bswing\b/i, at: [-48.5, 9.5], half: [2.5, 2.5], needs: 'pond' },
  { key: 'boat', name: 'by the old boat', words: /\b(old )?boat\b/i, at: [-78, 21.5], half: [3.4, 3.4], needs: 'pond' },
  { key: 'stone', name: 'by the green stone', words: /\b(green|glowing) stone\b/i, at: [-82, -6], half: [3, 3], needs: 'pond' },
  { key: 'hilltop', name: 'on top of the hill', words: /\b(hill ?top|top of the hill|on the hill|up the hill)\b/i, at: [HILL.x - 5.5, HILL.z + 1], half: [0, 0], needs: 'hill' },
  { key: 'hillfoot', name: 'at the foot of the hill', words: /\b(foot|bottom) of the hill\b/i, at: [-54, -4], half: [0, 0], needs: 'hill' },
  { key: 'hillside', name: 'on the side of the hill', words: /\b(hill ?side|slope|hill)\b/i, at: [-55, -18], half: [0, 0], needs: 'hill' },
  { key: 'library', name: 'by the library', words: /\blibrary\b/i, at: [57, -3], half: [9, 7.8], needs: 'library' },
  { key: 'bakery', name: 'in the street by the bakery', words: /\b(bakery|kees)\b/i, at: [11.5, 5.4], half: [0, 0] },
  { key: 'shop', name: 'in the street by the corner shop', words: /\b(corner )?shop\b/i, at: [33, 5.4], half: [0, 0] },
  { key: 'mo', name: 'in the street by Mo’s house', words: /\bmo(’s|'s)|\b(by|near|of) mo\b/i, at: [-9, 5.4], half: [0, 0] },
  { key: 'jo', name: 'in the street by Oma Jo’s house', words: /\b(oma jo|jo(’s|'s))/i, at: [-22, 5.4], half: [0, 0] },
  { key: 'dot', name: 'in the street by Dot’s house', words: /\bdot(’s|'s)|\b(by|near|of) dot\b/i, at: [21.5, 5.4], half: [0, 0] },
  { key: 'lina', name: 'by Lina’s house', words: /\blina\b/i, at: [-18.5, 15.4], half: [5.9, 4.4], side: [0, -1] }, // her door is on the street side
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
const PLACE_WORDS = /\b(by|at|near|in|on|beside|next to|in front of|behind|left of|right of|top of|foot of|across from|up)\s+(the |my )?(pond|park|hill|hilltop|hillside|library|street|road|meadow|willow|swing|old boat|green stone|bakery|corner shop|plot)\b(?!\s+(lamp|light|sign|map|picture|painting|drawing|photo|model|book|shelf|poster|print|view))/i;
export const worldPhrase = (text) => PLACE_WORDS.exec(String(text ?? ''))?.[0] ?? null; // "by the pond" out of a longer sentence
export const worldWhere = (text) => /\b(outside|outdoors?)\b/i.test(String(text ?? '')) || PLACE_WORDS.test(String(text ?? ''));

export function buildTown(THREE) {
  const group = new THREE.Group();
  group.position.x = TOWN_X;
  const mats = []; // every plain material: at dusk and at night they keep a little of their own colour, so the street is never a black shape
  // Nothing out here is smooth plastic: every surface has a rough, grainy skin (made here, pixel by pixel, no picture files):
  // plaster with stains, brick, planks, corrugated metal, roof tiles, stone blocks, worn grass, cracked paving, patched asphalt.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const jit = (by) => (rnd() - 0.5) * 2 * by; // a little crooked, never the same twice
  const grain = makeGrain(THREE); // the rough skins (grain.js): shared with his room
  const M = (color, o = {}, kind = 'plain', rx = 1, ry = 1) => { const map = o.transparent ? null : grain(kind, rx, ry); const m = new THREE.MeshStandardMaterial({ color, roughness: 0.94, ...(map ? { map, emissiveMap: map } : {}), ...o }); mats.push(m); return m; };
  const add = (geo, material, [x, y, z], parent = group) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (size, color, pos, parent = group) => add(new THREE.BoxGeometry(...size), typeof color === 'number' ? M(color) : color, pos, parent);
  const cyl = (r0, r1, h, color, pos, parent = group, seg = 14) => add(new THREE.CylinderGeometry(r0, r1, h, seg), typeof color === 'number' ? M(color) : color, pos, parent);
  const se = seasonInfo(new Date());
  const snowy = () => /snow/.test(String(state.weather?.kind ?? '')) || (se.frozen && (state.weather?.temp ?? 5) <= 0);
  const state = { weather: null };
  const tex = (svg) => { const t = new THREE.TextureLoader().load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const signs = [];
  const sign = (text, w, h, bg, fg, font = 44) => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = Math.round((512 * h) / w);
    const g = c.getContext('2d');
    const draw = (words, back = bg) => { g.fillStyle = back; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = `800 ${font}px "Marker Felt", "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(words, c.width / 2, c.height / 2 + 2); t.needsUpdate = true; };
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    draw(text);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5 }));
    mesh.userData.draw = draw;
    signs.push(mesh.material);
    return mesh;
  };

  // ---- the ground: grass, two pavements and the road, on a slab like the floor of his room
  const grass = box([84, 0.5, 40], M(0x9ccf86, {}, 'grass', 26, 12), [1.5, -0.27, 9.5]);
  box([84.4, 0.6, 40.4], 0x8a6a4c, [1.5, -0.6, 9.5]);
  // his plot: a mown field with a low fence and a sign
  const field = box([PLOT.x1 - PLOT.x0, 0.06, PLOT.z1 - PLOT.z0], M(0xb4dc9a, {}, 'grass', 14, 4), [(PLOT.x0 + PLOT.x1) / 2, 0.0, (PLOT.z0 + PLOT.z1) / 2]);
  field.receiveShadow = true;
  for (let x = PLOT.x0; x <= PLOT.x1 + 0.01; x += 2) for (const z of [PLOT.z0, PLOT.z1]) if (!(z === PLOT.z0 && Math.abs(x - 1) < 2.5)) box([0.14, 0.5, 0.14], 0xfff8ee, [x, 0.25, z]);
  for (let z = PLOT.z0; z <= PLOT.z1 + 0.01; z += 2) for (const x of [PLOT.x0, PLOT.x1]) box([0.14, 0.5, 0.14], 0xfff8ee, [x, 0.25, z]);
  const paveA = box([82, 0.08, 2.6], M(0xd8cdbf, {}, 'pave', 30, 1), [1.5, 0.02, 1.1]);
  const road = box([82, 0.06, 6], M(0x8f8a86, {}, 'road', 20, 2), [1.5, 0.0, 5.4]);
  const paveB = box([82, 0.08, 2.2], M(0xd8cdbf, {}, 'pave', 30, 1), [1.5, 0.02, 9.5]);
  for (let x = -36; x <= 40; x += 6) box([2.4, 0.02, 0.16], 0xf4efe6, [x, 0.04, 5.4]);
  for (const m of [grass, paveA, paveB, road]) m.receiveShadow = true;

  // ---- houses
  const windows = []; // { mat, who, lit: colour when the light is on }
  const gable = (w, h, d, color) => { // a roof with its triangle to the street
    const s = new THREE.Shape();
    s.moveTo(-w / 2 - 0.35, 0); s.lineTo(0, h); s.lineTo(w / 2 + 0.35, 0); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: d + 0.5, bevelEnabled: false });
    return new THREE.Mesh(geo, M(color, {}, 'roof', 0.5, 0.5));
  };
  const win = (parent, x, y, w, h, who = null) => {
    box([w + 0.3, h + 0.3, 0.12], 0xfff8ee, [x, y, 0.04], parent);
    const mat = new THREE.MeshStandardMaterial({ color: 0xdff1fa, roughness: 0.3, emissive: 0xffd98a, emissiveIntensity: 0 });
    add(new THREE.PlaneGeometry(w, h), mat, [x, y, 0.115], parent);
    let face = null;
    if (who) {
      const k = Math.min(w, h) * 0.92;
      face = add(new THREE.PlaneGeometry(k, k), new THREE.MeshBasicMaterial({ map: tex(faceSvg(who, 256)), transparent: true }), [x, y - 0.02, 0.13], parent);
    }
    windows.push({ mat, who, face });
  };
  const door = (parent, x, w, h, color) => { box([w + 0.24, h + 0.12, 0.1], 0xfff8ee, [x, h / 2 + 0.06, 0.03], parent); box([w, h, 0.12], color, [x, h / 2, 0.06], parent); add(new THREE.SphereGeometry(0.07, 10, 8), M(0xf2d08a, { metalness: 0.5, roughness: 0.4 }), [x + w / 2 - 0.18, h / 2, 0.15], parent); };
  const roofs = []; // roofs turn white in the snow
  const house = (x, w, h, d, wall, roofColor, o = {}) => {
    const g = new THREE.Group();
    g.position.set(x, 0, 0);
    group.add(g);
    box([w, h, d], M(wall, {}, o.kind ?? 'plain', o.kind === 'brick' ? w / 3 : o.kind ? w / 2.4 : 1, o.kind === 'brick' ? h / 3 : o.kind ? h / 2.4 : 1), [0, h / 2, -d / 2], g).castShadow = true;
    g.rotation.y = jit(0.03); g.rotation.z = jit(0.008); g.position.z = jit(0.12) - 0.1; // built by hand: none stands quite straight
    if (o.flat) { const r = box([w + 0.5, 0.35, d + 0.4], roofColor, [0, h + 0.17, -d / 2], g); roofs.push({ m: r, color: roofColor }); }
    else { const r = gable(w, o.roofH ?? w * 0.42, d, roofColor); r.position.set(0, h, -d - 0.25); g.add(r); roofs.push({ m: r, color: roofColor }); }
    if (o.chimney) { box([0.7, 1.6, 0.7], o.chimney, [w / 2 - 1.3, h + (o.flat ? 0.9 : w * 0.2), -d / 2], g); }
    return g;
  };
  // Oma Jo: a cottage, with her garden beside it
  const jo = house(-19.5, 9.4, 3.3, 7, 0xf6ead6, 0x9a6b47, { chimney: 0xa8674a, kind: 'planks' });
  win(jo, -2.4, 1.9, 1.5, 1.5, 'Oma Jo');
  door(jo, 1.8, 1.25, 2.5, 0x5f9e63);
  const beds = [];
  const fence = M(0xfff8ee);
  box([10.6, 0.5, 6.6], 0x8a6a48, [-30.3, 0.02, -3.6]).scale.y = 0.2;
  for (let i = 0; i < 4; i++) { const b = box([8.2, 0.22, 0.7], 0x6b4f35, [-30.9, 0.16, -1.3 - i * 1.5]); beds.push(b); for (let k = 0; k < 8; k++) { const p = add(new THREE.SphereGeometry(0.22, 8, 6), M(se.flowers ? [0x5f9e63, 0x7fbf6a, 0x4f8a45][k % 3] : 0x8a9a6a), [-34.6 + k * 1.07, 0.38, -1.3 - i * 1.5]); p.userData.plant = true; beds.push(p); } }
  if (se.flowers) for (const [x, z] of [[-34.2, -6.4], [-32.9, -6.5], [-31.6, -6.4]]) { cyl(0.05, 0.05, 1.7, 0x4f8a45, [x, 0.85, z]); cyl(0.36, 0.36, 0.08, 0xf6c544, [x, 1.72, z + 0.02]).rotation.x = Math.PI / 2; cyl(0.17, 0.17, 0.1, 0x7a5237, [x, 1.72, z + 0.04]).rotation.x = Math.PI / 2; }
  for (let x = -35.8; x <= -24.8; x += 0.62) if (x < -26.5 || x > -24.9) { const pk = box([0.12, 0.7 + rnd() * 0.3, 0.06], fence, [x, 0.4, 0.05]); pk.rotation.z = jit(0.07); } // (an open gate by the cottage)
  for (const y of [0.62, 0.3]) box([9.4, 0.09, 0.05], fence, [-31.2, y, 0.07]);
  box([0.06, 0.85, 7.4], fence, [-35.8, 0.42, -3.6]);
  const shed = house(-26.4, 2.4, 1.9, 2.2, 0xb98a5a, 0x7a5237, { roofH: 0.9 });
  shed.position.z = -5.2;
  // Mo: next door, with a little locomotive on the roof
  const mo = house(-9, 8.2, 4.2, 7, 0xd9775f, 0x6b4a44, { chimney: 0x8a4a3a, kind: 'brick' });
  win(mo, -2.2, 2.3, 1.6, 1.6, 'Mo');
  win(mo, 2.4, 2.9, 1.5, 1.2);
  door(mo, 2.2, 1.3, 2.5, 0x2f4a7a);
  const loco = new THREE.Group();
  box([1.0, 0.36, 0.4], 0x2f4a7a, [0, 0.3, 0], loco); box([0.34, 0.34, 0.4], 0x2f4a7a, [0.3, 0.62, 0], loco); cyl(0.09, 0.11, 0.3, 0x1f2a44, [-0.3, 0.62, 0], loco);
  for (const wx of [-0.3, 0.3]) cyl(0.15, 0.15, 0.44, 0x1f2a44, [wx, 0.12, 0], loco).rotation.x = Math.PI / 2;
  cyl(0.03, 0.03, 1.1, 0x5a4a40, [0, -0.5, 0], loco);
  loco.position.set(-9 - 2.6, 4.2 + 2.6, -1.2);
  group.add(loco);
  // Pip: home (a flag with a heart, a mat, and a step to sit on)
  const home = house(0, 8.6, 4.6, 7, 0xfbd98c, 0xe9855b, { chimney: 0xb3653f });
  win(home, -2.3, 2.5, 1.9, 1.9, 'Pip');
  win(home, 2.7, 3.0, 1.5, 1.3);
  door(home, 0, 1.4, 2.7, 0xc9573c);
  cyl(0.5, 0.5, 0.1, 0xfff4d6, [0, 6.0, 0.08], home).rotation.x = Math.PI / 2;
  box([2.4, 0.2, 0.9], 0xcdbfae, [0.2, 0.1, 0.5], home);
  box([1.1, 0.03, 0.6], 0xb8554a, [0, 0.215, 0.55], home);
  cyl(0.04, 0.04, 2.2, 0x7a5237, [3.9, 5.2, 0.15], home);
  box([0.9, 0.55, 0.04], 0xef6f6c, [4.4, 5.9, 0.15], home);
  const mailbox = new THREE.Group();
  cyl(0.05, 0.05, 1.0, 0x5a4a40, [0, 0.5, 0], mailbox); box([0.5, 0.34, 0.3], 0xc9573c, [0, 1.1, 0], mailbox);
  const letter = box([0.34, 0.22, 0.03], 0xfffaf3, [0, 1.36, 0.02], mailbox);
  mailbox.position.set(-3.6, 0, 0.7);
  group.add(mailbox);
  // the bakery, and Kees above it
  const bakery = house(11.5, 9.8, 6.2, 7, 0xe9dcc6, 0x7c6a5c, { flat: true, chimney: 0x7c6a5c, kind: 'brick' });
  win(bakery, -2.6, 4.6, 1.7, 1.7, 'Kees');
  const clock = cyl(0.62, 0.62, 0.1, 0xfff8ee, [2.4, 4.7, 0.08], bakery); clock.rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.62, 0.07, 8, 28), M(0x3f7fa8), [2.4, 4.7, 0.1], bakery);
  const hands = [box([0.05, 0.42, 0.03], 0x3a2a22, [0, 0.19, 0]), box([0.05, 0.3, 0.03], 0x3a2a22, [0, 0.13, 0])];
  const handPivots = hands.map((hd) => { const pv = new THREE.Group(); pv.position.set(2.4, 4.7, 0.16); group.remove(hd); pv.add(hd); bakery.add(pv); return pv; });
  box([9.8, 0.3, 0.2], 0xc9573c, [0, 3.2, 0.1], bakery);
  for (let i = 0; i < 9; i++) { const a = box([1.09, 0.08, 1.3], i % 2 ? 0xfff8ee : 0xe98a6a, [-4.36 + i * 1.09, 2.86, 0.6], bakery); a.rotation.x = 0.42; }
  const shopWin = new THREE.MeshStandardMaterial({ color: 0xf6efdf, roughness: 0.4, emissive: 0xffe2a6, emissiveIntensity: 0 });
  box([4.6, 2.0, 0.1], 0xfff8ee, [-1.9, 1.5, 0.03], bakery); add(new THREE.PlaneGeometry(4.3, 1.7), shopWin, [-1.9, 1.5, 0.09], bakery);
  for (const [x, c, r] of [[-3.2, 0xc98a4a, 0.36], [-2.2, 0xd9a05c, 0.44], [-1.1, 0xc98a4a, 0.34], [-0.4, 0xe0b070, 0.3]]) { const loaf = add(new THREE.SphereGeometry(r, 12, 8), M(c), [x, 0.95, 0.2], bakery); loaf.scale.set(1.3, 0.62, 0.7); }
  door(bakery, 3.2, 1.35, 2.6, 0x7c5a3c);
  const bakerySign = sign('BAKERY', 3.0, 0.6, '#fff8ee', '#7c5a3c', 70); bakerySign.position.set(0, 3.75, 0.13); bakery.add(bakerySign);
  // Dot: two doors down, with chalk on the pavement
  const dot = house(21.5, 6.8, 3.8, 7, 0xa9d3e8, 0x4f7fa3, { kind: 'boards' });
  win(dot, -1.5, 2.2, 1.6, 1.6, 'Dot');
  door(dot, 1.6, 1.2, 2.4, 0xe3a12f);
  for (const [x, z, c, r] of [[20.2, 1.2, 0xf6a9c0, 0.42], [21.2, 1.5, 0xf6e27a, 0.3], [22.3, 1.1, 0x9ad0f0, 0.36]]) { const ch = add(new THREE.RingGeometry(r * 0.62, r, 20), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }), [x, 0.07, z]); ch.rotation.x = -Math.PI / 2; }
  // the corner shop
  const shop = house(33, 11.6, 4.2, 7, 0x58a59a, 0x3d7d74, { flat: true, kind: 'metal' });
  const shopSign = sign('CORNER SHOP', 7.4, 0.9, '#fff8ee', '#3d7d74', 54); shopSign.position.set(0, 3.55, 0.1); shop.add(shopSign);
  for (let i = 0; i < 9; i++) { const a = box([1.24, 0.08, 1.2], i % 2 ? 0xfff8ee : 0xf2c14e, [-4.96 + i * 1.24, 2.85, 0.55], shop); a.rotation.x = 0.42; }
  const shopGlass = new THREE.MeshStandardMaterial({ color: 0xeaf6f4, roughness: 0.4, emissive: 0xffe2a6, emissiveIntensity: 0 });
  box([5.4, 1.9, 0.1], 0xfff8ee, [-2.4, 1.45, 0.03], shop); add(new THREE.PlaneGeometry(5.1, 1.6), shopGlass, [-2.4, 1.45, 0.09], shop);
  for (const [x, c] of [[-4.2, 0xef6f6c], [-3.3, 0xf6c544], [-2.4, 0x8cc27a], [-1.5, 0x7b5cc4], [-0.6, 0xe9855b]]) add(new THREE.SphereGeometry(0.3, 12, 8), M(c), [x, 1.0, 0.24], shop);
  door(shop, 1.6, 1.4, 2.6, 0x2f5e57);
  const openSign = sign('OPEN', 1.0, 0.42, '#4caf6a', '#ffffff', 150); openSign.position.set(1.6, 1.75, 0.14); shop.add(openSign);
  // Lina: across the street, her window to the street
  const lina = new THREE.Group();
  lina.position.set(-18.5, 0, 19);
  lina.rotation.y = Math.PI;
  group.add(lina);
  const linaFull = new THREE.Group(); // seen when you walk in the street
  const linaLow = new THREE.Group(); // seen from above: only the floor and low walls, like the front of Pip's own room, so it hides nothing
  lina.add(linaFull, linaLow);
  box([9.4, 4.0, 7], M(0x8b78c9, {}, 'planks', 4, 1.6), [0, 2.0, -3.5], linaFull).castShadow = true;
  const lr = gable(9.4, 3.6, 7, 0x5b4a8a); lr.position.set(0, 4.0, -7.25); linaFull.add(lr); roofs.push({ m: lr, color: 0x5b4a8a });
  win(linaFull, -2.2, 2.3, 1.7, 1.7, 'Lina');
  door(linaFull, 2.2, 1.3, 2.5, 0x2bb3a3);
  win(linaFull, 0, 5.4, 1.4, 1.2);
  box([9.4, 0.3, 7], 0xcfc4ee, [0, 0.15, -3.5], linaLow);
  for (const [sx, sz, px, pz] of [[9.4, 0.3, 0, -0.15], [9.4, 0.3, 0, -6.85], [0.3, 7, -4.55, -3.5], [0.3, 7, 4.55, -3.5]]) box([sx, 0.9, sz], 0x8b78c9, [px, 0.45, pz], linaLow);
  box([2.6, 0.5, 1.0], 0x2bb3a3, [-1.8, 0.75, -4.2], linaLow); // her keyboard on its stand
  for (let i = 0; i < 9; i++) box([0.2, 0.06, 0.6], i % 2 ? 0x1f2a44 : 0xfff8ee, [-2.8 + i * 0.25, 1.03, -4.2], linaLow);
  const linaFace = add(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: tex(faceSvg('Lina', 256)), transparent: true, side: THREE.DoubleSide }), [1.6, 2.1, -3.4], linaLow);
  linaFace.rotation.y = Math.PI; // toward the viewer in the overview
  cyl(0.04, 0.04, 1.3, 0x7a5237, [1.6, 0.65, -3.4], linaLow);
  linaFull.visible = false;

  // ---- names on little signs by the doors
  for (const [name, x, z, rot] of [['Oma Jo', -17.6, 0.5, 0], ['Mo', -6.8, 0.5, 0], ['Pip', -1.6, 0.5, 0], ['Kees', 14.7, 0.5, 0], ['Dot', 23.1, 0.5, 0], ['Lina', -20.7, 11.6, Math.PI]]) {
    const s = sign(name, 0.9, 0.36, '#fffaf3', '#4a3d35', 150);
    s.position.set(x, 1.2, z); s.rotation.y = rot; s.rotation.z = jit(0.09);
    group.add(s);
    cyl(0.03, 0.03, 1.1, 0x7a5237, [x, 0.55, z - (rot ? -0.03 : 0.03)]);
  }
  // ---- where the street goes on: signposts at both ends
  const post = (x, words, flip) => { cyl(0.07, 0.07, 2.6, 0x7a5237, [x, 1.3, 2.0]); const s = sign(words, 3.0, 0.6, '#fffaf3', '#4a3d35', 62); s.position.set(x + (flip ? -0.2 : 0.2), 2.3, 2.09); group.add(s); };

  post(39.5, 'Library  →', true);
  { cyl(0.06, 0.06, 1.5, 0x7a5237, [-2.2, 0.75, PLOT.z0 - 0.3]); const sg = sign('Pip’s plot', 2.2, 0.55, '#fde3c4', '#8a4a2c', 84); sg.position.set(-2.2, 1.45, PLOT.z0 - 0.36); sg.rotation.y = Math.PI; group.add(sg); const sg2 = sign('Pip’s plot', 2.2, 0.55, '#fde3c4', '#8a4a2c', 84); sg2.position.set(-2.2, 1.45, PLOT.z0 - 0.24); group.add(sg2); }

  // ---- trees (their leaves follow the real season) and a street lamp
  const leaf = se.leafOn <= 0.05 ? null : se.turn > 0.5 ? 0xd98b3a : se.blossom ? 0xf3b7c8 : 0x6fae5e;
  const crowns = [];
  const tree = (x, z, s = 1) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.scale.setScalar(s);
    group.add(g);
    cyl(0.22, 0.3, 2.6, 0x7a5237, [0, 1.3, 0], g).castShadow = true;
    if (leaf) for (const [dx, dy, dz, r] of [[0, 3.6, 0, 1.7], [-1.1, 3.0, 0.3, 1.2], [1.1, 3.1, -0.2, 1.25], [0.2, 4.6, 0.2, 1.1]]) crowns.push(add(new THREE.SphereGeometry(r, 14, 10), M(leaf), [dx, dy, dz], g));
    else for (const [a, len] of [[0.5, 1.6], [-0.6, 1.5], [0.1, 1.9]]) { const b = cyl(0.06, 0.1, len, 0x7a5237, [Math.sin(a) * len * 0.45, 2.6 + len * 0.42, 0], g); b.rotation.z = -a; }
  };
  for (const [x, z, s] of [[-37.5, -5.5, 1.1], [-25.2, 10.2, 0.9], [5.5, -5.5, 0.8], [-13, 24, 1.1], [40, -5, 1.1], [39.5, 14, 0.9], [-36, 13, 1], [-30, 25, 1.2], [39, 25.5, 1]]) tree(x, z, s);
  const lamps = [];
  for (const x of [-12.6, 16.9]) {
    cyl(0.07, 0.09, 3.6, 0x4a4f66, [x, 1.8, 2.05]);
    const bulb = add(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe6e1d6, emissive: 0xffe9a8, emissiveIntensity: 0 }), [x, 3.7, 2.05]);
    const light = new THREE.PointLight(0xffe2a0, 0, 16, 1.6);
    light.position.set(x, 3.5, 2.2);
    group.add(light);
    lamps.push({ bulb, light });
  }
  // ---- Scrap. A street people really live in is never tidy: patched walls, crates and barrels, a washing line, poles
  // with sagging wires, puddles, weeds along the walls, a heap of junk at the end.
  const wood = (c = 0xb98a5a) => M(c, {}, 'boards');
  const tin = (c = 0x9aa3a8) => M(c, { roughness: 0.6, metalness: 0.35 }, 'metal');
  const crate = (x, y, z, sz = 0.8, c = 0xb98a5a) => { const m = box([sz, sz, sz], wood(c), [x, y + sz / 2, z]); m.rotation.y = jit(0.4); return m; };
  crate(27.6, 0, 0.55); crate(28.5, 0, 0.5, 0.7, 0xa87b4f); crate(27.9, 0.8, 0.5, 0.65); crate(40.2, 0, 0.6, 0.9, 0x9a6b47);
  for (const [x, z] of [[17.1, 0.45], [17.9, 0.5], [-4.9, 0.4]]) { const b = cyl(0.36, 0.36, 0.95, tin(rnd() < 0.5 ? 0x3d6f8a : 0xb8554a), [x, 0.48, z]); b.rotation.y = jit(1); }
  for (let i = 0; i < 3; i++) { const t = add(new THREE.TorusGeometry(0.34, 0.14, 8, 16), M(0x2a2a2e), [-13.2 + jit(0.06), 0.14 + i * 0.27, 0.5 + jit(0.05)]); t.rotation.x = Math.PI / 2; }
  // patches on the walls: a sheet of tin here, a few boards there
  for (const [g, x, y, w, h, c, k] of [[mo, 2.9, 1.2, 1.5, 1.1, 0x9aa3a8, 'metal'], [home, 3.3, 1.1, 1.3, 1.5, 0xc9a26a, 'boards'], [jo, -4.0, 0.7, 1.0, 1.2, 0x9aa3a8, 'metal'], [dot, -2.9, 0.9, 0.9, 1.6, 0xc98a5a, 'boards'], [shop, 4.6, 1.6, 1.6, 2.2, 0xb8554a, 'metal'], [bakery, -4.4, 0.8, 0.8, 1.3, 0xc9a26a, 'boards']]) { const pch = box([w, h, 0.06], M(c, k === 'metal' ? { roughness: 0.6, metalness: 0.3 } : {}, k), [x, y, 0.035], g); pch.rotation.z = jit(0.06); }
  // a washing line in Oma Jo's garden
  { cyl(0.05, 0.06, 2.9, 0x7a5237, [-34.6, 1.45, -4.2]).rotation.z = 0.04; box([9.9, 0.03, 0.03], 0xf1ece2, [-29.7, 2.72, -4.2]).rotation.z = -0.012; for (const [x, w, h, c] of [[-33.2, 0.7, 0.9, 0xef6f6c], [-32.1, 0.5, 0.6, 0xfff8ee], [-31.2, 0.9, 1.1, 0x7fb6d9], [-29.8, 0.5, 0.7, 0xf2c14e], [-28.9, 0.8, 0.5, 0xfff8ee], [-27.6, 0.6, 0.9, 0x8b78c9]]) { const cl = box([w, h, 0.03], c, [x, 2.68 - h / 2, -4.2 + jit(0.02)]); cl.rotation.z = jit(0.07); cl.rotation.x = jit(0.12); } }
  // poles with sagging wires along the far side of the street
  const poleXs = [-37, -14, 9, 32, 47];
  for (const x of poleXs) { const pl = cyl(0.11, 0.14, 6.4, 0x6b4a35, [x, 3.2, 10.9]); pl.rotation.z = jit(0.03); pl.rotation.x = jit(0.03); box([1.6, 0.12, 0.12], 0x6b4a35, [x, 5.9, 10.9]); for (const dx of [-0.6, 0.6]) cyl(0.06, 0.06, 0.2, 0x3d7d74, [x + dx, 6.05, 10.9]); }
  const wire = new THREE.LineBasicMaterial({ color: 0x2a2a2e });
  for (let i = 0; i < poleXs.length - 1; i++) for (const dx of [-0.6, 0.6]) { const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3(poleXs[i] + dx + (poleXs[i + 1] - poleXs[i]) * t, 6.1 - Math.sin(Math.PI * t) * 0.9, 10.9)); } group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire)); }
  { const pts = [new THREE.Vector3(9 - 0.6, 6.1, 10.9), new THREE.Vector3(9.5, 5.2, 5), new THREE.Vector3(10.6, 5.6, 0.2)]; group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire)); } // one wire crosses the street to the bakery
  // puddles and weeds
  const wet = new THREE.MeshStandardMaterial({ color: 0x5f6f80, roughness: 0.08, metalness: 0.4 });
  for (const [x, z, rx, rz] of [[-7, 4.4, 1.4, 0.7], [15.5, 6.3, 1.0, 0.6], [29, 3.6, 1.6, 0.8], [-27, 6.8, 0.9, 0.5]]) { const pd = add(new THREE.CircleGeometry(1, 14), wet, [x, 0.035, z]); pd.rotation.x = -Math.PI / 2; pd.scale.set(rx, rz, 1); }
  for (let i = 0; i < 46; i++) { const x = TOWN_RANGE[0] + 3 + rnd() * 74; const z = rnd() < 0.6 ? 0.28 + jit(0.08) : 8.5 + rnd() * 2; const w = add(new THREE.ConeGeometry(0.1 + rnd() * 0.08, 0.3 + rnd() * 0.35, 5), M(rnd() < 0.5 ? 0x6f9a4f : 0x8aae5c), [x, 0.2, z]); w.rotation.z = jit(0.3); }
  // a heap of junk at the end of the street, by the way to the library
  { const g = new THREE.Group(); g.position.set(43.5, 0, 13.5); group.add(g); for (let i = 0; i < 12; i++) { const m = box([0.5 + rnd() * 0.9, 0.3 + rnd() * 0.7, 0.4 + rnd() * 0.8], rnd() < 0.5 ? wood([0xb98a5a, 0x8a6a48, 0xc9a26a][i % 3]) : tin([0x9aa3a8, 0xb8554a, 0x3d6f8a][i % 3]), [jit(1.5), 0.25 + rnd() * 0.9, jit(1.2)], g); m.rotation.set(jit(0.5), jit(1.5), jit(0.5)); } const wh = add(new THREE.TorusGeometry(0.42, 0.12, 8, 16), M(0x2a2a2e), [1.6, 0.45, 0.6], g); wh.rotation.y = 0.5; wh.rotation.x = 0.3; cyl(0.07, 0.07, 2.4, tin(0x8a8f96), [-0.4, 1.3, 0.2], g).rotation.z = 0.9; }
  // a ladder against Mo's wall and a wheelbarrow by the garden
  { const g = new THREE.Group(); g.position.set(-12.2, 0, 0.5); g.rotation.x = -0.2; group.add(g); for (const dx of [-0.25, 0.25]) box([0.07, 3.4, 0.07], wood(0xc9a26a), [dx, 1.7, 0], g); for (let i = 0; i < 8; i++) box([0.5, 0.05, 0.05], wood(0xc9a26a), [0, 0.35 + i * 0.4, 0], g); }
  { const g = new THREE.Group(); g.position.set(-25.4, 0, 2.0); g.rotation.y = 0.5; group.add(g); box([0.9, 0.35, 0.6], tin(0x5f9e63), [0, 0.5, 0], g); const whl = add(new THREE.TorusGeometry(0.2, 0.06, 8, 14), M(0x2a2a2e), [0.6, 0.2, 0], g); whl.rotation.y = Math.PI / 2; for (const dz of [-0.25, 0.25]) box([1.0, 0.05, 0.05], wood(), [-0.6, 0.55, dz], g); }
  // ---- Stranger things, seen from far: a water tower behind the houses, a radio mast with a blinking light, a stack of
  // containers, an old boat on the grass, and a tall green stone that glows a little. Nobody knows who put them there.
  { const g = new THREE.Group(); g.position.set(25.6, 0, -8.8); g.rotation.y = 0.3; group.add(g); for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const l = cyl(0.12, 0.16, 8.2, M(0x6b6f76, { metalness: 0.3 }, 'metal'), [dx, 4.1, dz], g); l.rotation.z = -dx * 0.03; l.rotation.x = dz * 0.03; } cyl(2.3, 2.3, 3.2, M(0xb8554a, { metalness: 0.2 }, 'metal', 6, 1), [0, 9.6, 0], g, 20); add(new THREE.ConeGeometry(2.5, 1.2, 20), M(0x8a4a3a, {}, 'metal', 6, 1), [0, 11.8, 0], g); box([0.08, 8, 0.08], 0x6b6f76, [2.35, 4.2, 0], g); }
  const mastTop = new THREE.MeshStandardMaterial({ color: 0xff3b2f, emissive: 0xff3b2f, emissiveIntensity: 1 });
  { const g = new THREE.Group(); g.position.set(-86, 0, -40); group.add(g); for (let i = 0; i < 4; i++) { const l = cyl(0.07, 0.07, 26, M(0xb5463c, { metalness: 0.3 }, 'metal'), [i < 2 ? -0.9 : 0.9, 13, i % 2 ? -0.9 : 0.9], g); l.rotation.z = (i < 2 ? -1 : 1) * 0.03; l.rotation.x = (i % 2 ? 1 : -1) * 0.03; } for (let y = 2; y < 25; y += 3) box([1.6 - y * 0.05, 0.07, 1.6 - y * 0.05], M(y % 6 ? 0xfff8ee : 0xb5463c, {}, 'metal'), [0, y, 0], g); cyl(0.04, 0.04, 4, 0x6b6f76, [0, 28, 0], g); add(new THREE.SphereGeometry(0.34, 10, 8), mastTop, [0, 30.1, 0], g); }
  for (const [y, c, ry] of [[1.3, 0x3d6f8a, 0.12], [3.9, 0xc9773c, -0.06], [1.3, 0xd9b23c, 1.2]]) { const b = box([6, 2.6, 2.5], M(c, { metalness: 0.2 }, 'metal', 7, 1), [-36.5 + (ry > 1 ? 4.6 : 0), y, 21 + (ry > 1 ? 3.6 : 0)]); b.rotation.y = ry; }
  { const g = new THREE.Group(); g.position.set(-78, 0.25, 21.5); g.rotation.set(0.05, 0.6, 0.22); group.add(g); const hull = add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(0x4f7fa3, { side: THREE.DoubleSide }, 'boards', 3, 2), [0, 0.9, 0], g); hull.scale.set(3.4, 1.1, 1.3); box([0.14, 2.6, 0.14], M(0x7a5237, {}, 'boards'), [0.3, 1.9, 0], g); box([5.6, 0.1, 0.5], M(0xc9a26a, {}, 'boards'), [0, 0.86, 0], g); }
  const stoneGlow = new THREE.MeshStandardMaterial({ color: 0x2fa37a, roughness: 0.35, emissive: 0x2fa37a, emissiveIntensity: 0.5, map: grain('stone'), emissiveMap: grain('stone') });
  { const st = add(new THREE.OctahedronGeometry(1.5, 0), stoneGlow, [-82, 2.4, -6]); st.scale.set(0.8, 2.0, 0.7); st.rotation.set(0.1, 0.5, 0.08); for (const [dx, dz, k] of [[1.6, 0.5, 0.35], [-1.3, 1.0, 0.28], [0.4, -1.5, 0.22]]) { const sm = add(new THREE.OctahedronGeometry(1, 0), stoneGlow, [-82 + dx, k * 1.6, -6 + dz]); sm.scale.set(k, k * 2, k); sm.rotation.y = dx; } }
  const stoneLight = new THREE.PointLight(0x4fe0a8, 0, 22, 1.4);
  stoneLight.position.set(-82, 3, -6);
  group.add(stoneLight);
  // Daylight for the street. The lamps and the window light of his room are 120 metres away, so the street has a light
  // of its own, high above it (it does not reach his room).
  const daylight = new THREE.PointLight(0xfff4e2, 1.5, 74, 0);
  daylight.position.set(4, 34, 20);
  group.add(daylight);
  // a bench by the pavement, across the street
  box([2.2, 0.1, 0.6], 0x9a6b47, [6, 0.55, 9.6]); box([2.2, 0.5, 0.08], 0x9a6b47, [6, 0.9, 9.9]);
  for (const x of [5.1, 6.9]) box([0.1, 0.55, 0.5], 0x7a5237, [x, 0.27, 9.6]);
  // market stalls (only on market day)
  const market = new THREE.Group();
  for (const [x, c] of [[-6, 0xef6f6c], [0.5, 0x58a59a], [7, 0xf2c14e]]) {
    box([2.6, 0.1, 1.2], 0xc9a26a, [x, 1.0, 9.4], market);
    for (const dx of [-1.2, 1.2]) cyl(0.05, 0.05, 2.4, 0x7a5237, [x + dx, 1.2, 9.9], market);
    const top = box([3.2, 0.08, 1.9], c, [x, 2.45, 9.3], market); top.rotation.x = -0.2;
    for (const [dx, cc] of [[-0.8, 0xf6c544], [0, 0xef6f6c], [0.8, 0x8cc27a]]) add(new THREE.SphereGeometry(0.2, 10, 8), M(cc), [x + dx, 1.25, 9.3], market);
  }
  market.visible = false;
  group.add(market);

  // ---- the park: a meadow with the pond, a willow, benches and a swing; behind it the hill
  const SEG = 44;
  const parkGeo = new THREE.PlaneGeometry(PARK.x1 - PARK.x0, PARK.z1 - PARK.z0, SEG, SEG);
  parkGeo.rotateX(-Math.PI / 2);
  parkGeo.translate((PARK.x0 + PARK.x1) / 2, 0, (PARK.z0 + PARK.z1) / 2);
  { const pos = parkGeo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)) - 0.03); parkGeo.computeVertexNormals(); }
  const park = add(parkGeo, M(0x9ccf86, {}, 'grass', 17, 24), [0, 0, 0]);
  park.receiveShadow = true;
  box([PARK.x1 - PARK.x0 + 0.4, 0.6, PARK.z1 - PARK.z0 + 0.4], 0x8a6a4c, [(PARK.x0 + PARK.x1) / 2, -0.6, (PARK.z0 + PARK.z1) / 2]);
  const gravel = M(0xe2d5bd);
  box([32, 0.05, 2.2], gravel, [-55, 0.03, 1.4]); // the park path, on from the pavement
  for (const [x, z] of [[-60.5, -1.5], [-61.5, -4], [-62, -6.5], [-64, -9], [-67, -11.5], [-70, -13.8], [-72, -16], [-71.2, -18.6], [-69, -20.6], [-66.8, -22.2]]) { const st = cyl(0.55, 0.6, 0.12, gravel, [x, groundAt(x, z) + 0.04, z]); st.scale.z = 0.75; } // stepping stones up the hill
  const water = new THREE.MeshStandardMaterial({ color: 0x7fc4e8, roughness: 0.25, emissive: 0x2a6f95, emissiveIntensity: 0.35 });
  const pond = add(new THREE.CylinderGeometry(1, 1, 0.08, 40), water, [POND.x, 0.03, POND.z]);
  pond.scale.set(POND.rx, 1, POND.rz);
  const bank = add(new THREE.CylinderGeometry(1, 1, 0.05, 40), M(0xcdbb8e), [POND.x, 0.01, POND.z]);
  bank.scale.set(POND.rx + 0.7, 1, POND.rz + 0.7);
  for (let i = 0; i < 26; i++) { const a = 2.2 + i * 0.13; const x = POND.x + Math.cos(a) * (POND.rx + 0.2); const z = POND.z + Math.sin(a) * (POND.rz + 0.2); const r = cyl(0.04, 0.05, 1.1 + (i % 3) * 0.3, 0x6f9a4f, [x, 0.6, z]); r.rotation.z = (i % 5 - 2) * 0.05; cyl(0.07, 0.07, 0.3, 0x7a5237, [x, 1.2 + (i % 3) * 0.3, z]); } // reeds
  const ducks = [];
  const duck = (body, head) => { const g = new THREE.Group(); const b = add(new THREE.SphereGeometry(0.42, 14, 10), M(body), [0, 0.22, 0], g); b.scale.set(1.25, 0.7, 0.85); add(new THREE.SphereGeometry(0.2, 12, 8), M(head), [0.42, 0.55, 0], g); const bill = add(new THREE.ConeGeometry(0.08, 0.22, 8), M(0xf2a33c), [0.66, 0.53, 0], g); bill.rotation.z = -Math.PI / 2; group.add(g); ducks.push(g); return g; };
  duck(0xffffff, 0xffffff); duck(0xe8d9b8, 0x3d7d5a); duck(0xd9c7a0, 0x3d7d5a); duck(0xffffff, 0xffffff);
  const benchAt = (x, z, rot = 0) => { const g = new THREE.Group(); g.position.set(x, groundAt(x, z), z); g.rotation.y = rot; group.add(g); box([2.2, 0.1, 0.6], 0x9a6b47, [0, 0.55, 0], g); box([2.2, 0.5, 0.08], 0x9a6b47, [0, 0.95, -0.3], g); for (const dx of [-0.9, 0.9]) box([0.1, 0.55, 0.5], 0x7a5237, [dx, 0.27, 0], g); return g; };
  benchAt(-60.5, 5.2); benchAt(-69, 5.6, 0.2);
  // the willow: a thick trunk and long hanging green
  { const g = new THREE.Group(); g.position.set(-52.8, 0, 6.4); group.add(g); cyl(0.4, 0.55, 3.4, 0x6b4a35, [0, 1.7, 0], g).castShadow = true; const wl = se.leafOn <= 0.05 ? null : se.turn > 0.5 ? 0xc9b24f : 0x86b96a; if (wl) { add(new THREE.SphereGeometry(2.6, 16, 12), M(wl), [0, 4.4, 0], g).scale.y = 0.75; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; cyl(0.5, 0.18, 2.6, wl, [Math.cos(a) * 2.2, 2.9, Math.sin(a) * 2.2], g, 8); } } else for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const br = cyl(0.05, 0.1, 2.6, 0x6b4a35, [Math.cos(a) * 0.9, 4.2, Math.sin(a) * 0.9], g, 6); br.rotation.z = Math.cos(a) * 0.7; br.rotation.x = -Math.sin(a) * 0.7; } }
  // the swing by the pond (Dot's favourite)
  { const g = new THREE.Group(); g.position.set(-48.5, 0, 9.5); group.add(g); for (const dx of [-1.3, 1.3]) { for (const dz of [-0.8, 0.8]) { const leg = cyl(0.07, 0.07, 3.1, 0xc9573c, [dx, 1.5, dz * 0.5], g); leg.rotation.x = -dz * 0.26; } } cyl(0.07, 0.07, 2.8, 0xc9573c, [0, 3.0, 0], g).rotation.z = Math.PI / 2; for (const dx of [-0.35, 0.35]) cyl(0.02, 0.02, 2.2, 0x5a4a40, [dx, 1.9, 0], g); box([0.9, 0.07, 0.34], 0xf2c14e, [0, 0.8, 0], g); }
  for (const [x, z, sc] of [[-45, -8, 1.1], [-52, -16, 1], [-84, 2, 1.2], [-86, 18, 1], [-78, 24, 1.1], [-47, 22, 0.9], [-86, -14, 1.1], [-50, -34, 1.2], [-84, -36, 1], [-74, 8, 0.8]]) { const before = group.children.length; tree(x, z, sc); group.children[before].position.y = groundAt(x, z); }
  // the top of the hill: a bench, a flag, and all of the sky
  benchAt(HILL.x + 0.2, HILL.z - 0.6, 0.5);
  { const y = groundAt(HILL.x + 2.6, HILL.z); cyl(0.06, 0.06, 3.2, 0x7a5237, [HILL.x + 2.6, y + 1.6, HILL.z]); box([1.1, 0.6, 0.04], 0xf2c14e, [HILL.x + 3.2, y + 2.85, HILL.z]); }
  post(-40.5, '←  Park · Pond · Hill');
  { cyl(0.06, 0.06, 1.6, 0x7a5237, [-60.2, 0.8, -0.6]); const sg = sign('↑ Up the hill', 2.2, 0.5, '#fffaf3', '#4a3d35', 78); sg.position.set(-60.2, 1.5, -0.52); group.add(sg); }
  // ---- the library, at the other end of the street: wide steps, pillars, a big door
  const libGrass = box([32, 0.5, 37.5], M(0x9ccf86, {}, 'grass', 10, 12), [58, -0.27, 9.25]);
  box([32.4, 0.6, 37.9], 0x8a6a4c, [58, -0.6, 9.25]);
  box([32, 0.08, 2.6], 0xd8cdbf, [58, 0.02, 1.1]);
  { const g = new THREE.Group(); g.position.set(57, 0, 0); group.add(g);
    box([16, 6.4, 9], M(0xe7d3b5, {}, 'stone', 4, 2.4), [0, 3.2, -4.5], g).castShadow = true; // its front wall is at z 0, like the houses
    const ped = gable(16.6, 3.0, 10.4, 0x8a5a3a); ped.position.set(0, 6.7, -9.3); g.add(ped); roofs.push({ m: ped, color: 0x8a5a3a });
    for (let i = 0; i < 3; i++) box([13 - i * 1.0, 0.18, 2.4 - i * 0.6], 0xd9cdb8, [0, 0.09 + i * 0.18, 1.2 - i * 0.3], g); // the steps
    for (const dx of [-5.6, -2.6, 2.6, 5.6]) { cyl(0.36, 0.42, 5.5, 0xfff8ee, [dx, 3.25, 1.05], g, 18); box([1.0, 0.25, 1.0], 0xfff8ee, [dx, 6.1, 1.05], g); }
    box([16.6, 0.5, 1.7], 0xf1e6d2, [0, 6.45, 0.8], g);
    door(g, 0, 2.2, 3.7, 0x7a5237);
    win(g, -4.1, 3.3, 1.3, 2.6); win(g, 4.1, 3.3, 1.3, 2.6);
    const ls = sign('LIBRARY', 5.2, 0.46, '#f1e6d2', '#7a5237', 40); ls.position.set(0, 6.45, 1.66); g.add(ls);
    const hours = sign('Tue – Sat   10 – 17', 2.6, 0.42, '#fffaf3', '#4a3d35', 56); hours.position.set(7.2, 1.6, 2.72); g.add(hours); cyl(0.04, 0.04, 1.5, 0x7a5237, [7.2, 0.75, 2.68], g);
  }
  for (const [x, z, sc] of [[46, -5, 1], [70, -4, 1.1], [69, 12, 1], [47, 16, 1.1], [60, 22, 1.2]]) tree(x, z, sc);
  // light for the park and for the library square (the street has its own)
  const parkLight = new THREE.PointLight(0xfff4e2, 1.5, 70, 0);
  parkLight.position.set(-66, 40, -6);
  const libLight = new THREE.PointLight(0xfff4e2, 1.2, 44, 0);
  libLight.position.set(60, 30, 12);
  group.add(parkLight, libLight);
  // the ducks swim their rounds (or stand still on the ice)
  let frozenNow = false;
  function animate(t) {
    mastTop.emissiveIntensity = Math.sin(t * 2.4) > 0.2 ? 1.6 : 0.05; // the mast light blinks
    stoneGlow.emissiveIntensity = 0.45 + Math.sin(t * 0.9) * 0.2; // the stone breathes
    ducks.forEach((d, i) => {
      const a = frozenNow ? i * 1.7 : t * (0.05 + i * 0.012) + i * 1.7;
      const k = 0.35 + (i % 3) * 0.2;
      d.position.set(POND.x + Math.cos(a) * POND.rx * k, frozenNow ? 0.07 : 0.03 + Math.sin(t * 1.6 + i) * 0.025, POND.z + Math.sin(a) * POND.rz * k);
      d.rotation.y = -a - Math.PI / 2;
    });
  }
  animate(0);

  // ---- what follows the real time: lights in the windows, the shop sign, the clock, the snow
  const nightBlue = new THREE.Color(0x1c2a55);
  let said = '';
  function update(s, now = Date.now(), hour = undefined) {
    state.weather = s?.weather ?? null;
    const h = Number.isFinite(hour) ? hour : hourNL(now); // (a test or a screenshot can ask for an hour)
    const dark = h < se.sunrise - 0.4 || h > se.sunset + 0.3;
    const dusk = dark || h > se.sunset - 0.9;
    const away = Boolean(s?.where && s.where.place !== 'home' && now >= Date.parse(s.where.leftAt));
    const key = `${Math.floor(h * 4)}${dark}${dusk}${away}${shopOpen(now)}${snowy()}${(s?.visitors ?? []).filter((v) => v.npc && !v.answer).length}${new Date(now).getDay()}`;
    handPivots[0].rotation.z = -((h % 1) * Math.PI * 2);
    handPivots[1].rotation.z = -(((h % 12) / 12) * Math.PI * 2);
    if (key === said) return;
    said = key;
    fogColor = paintSky(h);
    for (const w of windows) {
      const p = w.who ? PEOPLE.find((q) => q.name === w.who) : null;
      const up = w.who === 'Pip' ? !away && h >= 8 && h < 23 : p ? h >= p.up[0] && h < p.up[1] : h >= 7 && h < 22;
      w.mat.color.set(up ? (dusk ? 0xffd98a : 0xdff1fa) : dark ? 0x232a47 : 0xb9c7d2);
      w.mat.emissive.copy(w.mat.color);
      w.mat.emissiveIntensity = up && dusk ? 0.85 : dark ? 0.2 : 0.3;
      if (w.face) w.face.visible = up;
    }
    const open = shopOpen(now);
    openSign.userData.draw(open ? 'OPEN' : 'CLOSED', open ? '#4caf6a' : '#b8554a');
    shopGlass.color.set(open ? (dusk ? 0xffe2a6 : 0xeaf6f4) : dark ? 0x232a47 : 0xb9c7d2);
    shopGlass.emissive.copy(shopGlass.color);
    shopGlass.emissiveIntensity = open && dusk ? 0.8 : dark ? 0.2 : 0.3;
    const baking = h >= 6.5 && h < 18;
    shopWin.color.set(baking ? (dusk ? 0xffe2a6 : 0xf6efdf) : dark ? 0x232a47 : 0xcfc6b6);
    shopWin.emissive.copy(shopWin.color);
    shopWin.emissiveIntensity = baking && dusk ? 0.8 : dark ? 0.2 : 0.3;
    for (const m of signs) m.emissiveIntensity = dark ? 0.25 : dusk ? 0.3 : 0.3;
    for (const l of lamps) { l.bulb.material.emissiveIntensity = dusk ? 1.2 : 0; l.light.intensity = dusk ? 26 : 0; }
    // The lamps of his room do not reach the street, and the page's daylight is made for indoors: so everything here
    // keeps some of its own colour (more by day, less at night, a little blue in the dark).
    for (const [l, k] of [[daylight, 1], [parkLight, 1], [libLight, 0.8]]) { l.intensity = (dark ? 0.4 : dusk ? 1.2 : 2.1) * k; l.color.set(dark ? 0x8fa3e0 : dusk ? 0xffc79a : 0xfff4e2); }
    stoneLight.intensity = dark ? 30 : dusk ? 14 : 0;
    frozenNow = Number.isFinite(state.weather?.temp) ? state.weather.temp <= 0 : false; // the pond freezes in real frost
    water.color.set(frozenNow ? 0xe1f1f8 : dark ? 0x3b5a92 : 0x7fc4e8);
    water.emissive.set(frozenNow ? 0x9fc4d6 : 0x2a6f95);
    for (const m of [park, libGrass]) m.material.color.set(snowy() ? 0xeef3f6 : se.name === 'autumn' ? 0xc2bf7c : se.name === 'winter' ? 0xb9c6a4 : 0x9ccf86);
    const glow = dark ? 0.16 : dusk ? 0.16 : 0.12;
    for (const m of mats) { m.emissive.copy(m.color).multiplyScalar(glow); if (dark) m.emissive.lerp(nightBlue, 0.35); }
    const white = snowy();
    grass.material.color.set(white ? 0xeef3f6 : se.name === 'autumn' ? 0xc2bf7c : se.name === 'winter' ? 0xb9c6a4 : 0x9ccf86);
    paveA.material.color.set(white ? 0xeef3f7 : 0xd8cdbf);
    paveB.material.color.set(white ? 0xeef3f7 : 0xd8cdbf);
    for (const r of roofs) r.m.material.color.set(white ? 0xffffff : r.color);
    letter.visible = (s?.visitors ?? []).some((v) => v.npc && !v.answer);
    const d = new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
    market.visible = d.getDay() === 6 && h >= 10 && h < 16;
  }
  // ---- far away (only seen when you walk outside): the land goes on to a horizon with hills, under a real sky
  const far = new THREE.Group();
  far.visible = false;
  group.add(far);
  const gridTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#d6cfc0'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(160, 160); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const land = add(new THREE.CircleGeometry(640, 48), new THREE.MeshBasicMaterial({ map: gridTex, color: 0xffffff }), [0, -0.66, 0], far);
  land.rotation.x = -Math.PI / 2;
  const hillMat = new THREE.MeshBasicMaterial({ color: 0x8fb89a });
  const hillMat2 = new THREE.MeshBasicMaterial({ color: 0xa7c6b4 });
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + 0.2; const r = 300 + ((i * 37) % 90); const h = add(new THREE.SphereGeometry(60 + ((i * 53) % 50), 12, 8), i % 2 ? hillMat : hillMat2, [Math.cos(a) * r, -18, Math.sin(a) * r], far); h.scale.y = 0.38 + ((i * 17) % 10) / 40; }
  const blockMat = [new THREE.MeshBasicMaterial({ color: 0x9aa7b5 }), new THREE.MeshBasicMaterial({ color: 0xb7b0c2 }), new THREE.MeshBasicMaterial({ color: 0x8a97a8 })];
  for (let i = 0; i < 11; i++) { const a = -0.9 + i * 0.33 + (i % 3) * 0.05; const r = 250 + ((i * 41) % 60); box([16 + (i % 3) * 8, 46 + ((i * 29) % 60), 14], blockMat[i % 3], [Math.sin(a) * r, 18 + ((i * 29) % 60) / 2, -Math.cos(a) * r], far); } // tower blocks far away, behind the street
  const skyGeo = new THREE.SphereGeometry(900, 24, 14);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  const sky = add(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), [0, 0, 0], far);
  const sunDisc = add(new THREE.CircleGeometry(34, 28), new THREE.MeshBasicMaterial({ color: 0xffd36e, fog: false }), [0, 0, 0], far);
  // The sky for an hour: [top, horizon, sun colour, fog colour]
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
    land.material.color.set(night ? 0x56608f : edge ? 0xf2cdb0 : 0xffffff);
    blockMat.forEach((m, i) => m.color.set(night ? [0x26305a, 0x2d3766, 0x222b52][i] : edge ? [0xc79a94, 0xd6aa9c, 0xb98a8a][i] : [0x9aa7b5, 0xb7b0c2, 0x8a97a8][i]));
    hillMat.color.set(night ? 0x2d3a63 : edge ? 0xb98f86 : 0x8fb89a);
    hillMat2.color.set(night ? 0x384873 : edge ? 0xd3a894 : 0xa7c6b4);
    return low;
  }
  let fogColor = paintSky(13);
  // Walking in the street shows Lina's whole house and the land to the horizon; from above only the town itself.
  const setWalk = (walking) => { linaFull.visible = walking; linaLow.visible = !walking; far.visible = walking; };
  const skyFog = () => fogColor;
  return { group, update, setWalk, animate, skyFog };
}
