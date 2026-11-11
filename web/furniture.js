// The furniture that can be moved. The page draws each piece at its saved place and Pip's animation spots (the stool, the bed, ...)
// move with it; the AI side only saves where a piece stands. Used by the page and by decor.js.
// Everything here is written for the place where the piece first stood. A saved place is { x, z, rot }: where the middle of
// the piece is now, and how far it is turned (a quarter turn at a time).
export const FURNITURE = {
  piano: {
    n: 'the piano',
    back: [0, -1], // the side that stands against a wall
    rects: [
      { n: 'the piano', x: [-3.95, -1.25], z: [-5, -3.55], h: 1.5 },
      { n: 'the piano stool', x: [-2.95, -2.25], z: [-3.5, -2.8], h: 0.6 },
    ],
    top: { x: [-3.95, -1.25], z: [-5, -4.05], y: 1.4, face: 0, off: [0, 1.5] },
    spot: { p: [-2.6, -3.15], face: Math.PI, y: 0.5 },
  },
  bookshelf: {
    n: 'the bookshelf',
    back: [0, -1],
    rects: [{ n: 'the bookshelf', x: [1.55, 3.65], z: [-5, -4.3], h: 3.1 }],
    top: { x: [1.6, 3.6], z: [-4.95, -4.4], y: 3.0, face: 0, off: [0, 1.4] },
    spot: { p: [2.6, -3.6], face: Math.PI },
  },
  desk: {
    n: 'the desk',
    back: [-1, 0],
    rects: [{ n: 'the desk and screen', x: [-5, -3.6], z: [0.1, 2.3], h: 1.95 }],
    top: { x: [-4.95, -3.65], z: [0.2, 2.2], y: 0.85, face: Math.PI / 2, off: [1.5, 0] },
    spot: { p: [-3.3, 1.2], face: -Math.PI / 2 },
  },
  bed: {
    n: 'the bed',
    back: [0, -1],
    rects: [{ n: 'the bed', x: [2.2, 4.6], z: [1.3, 4.7], h: 0.9 }],
    top: { x: [2.5, 4.5], z: [2.4, 4.7], y: 0.7, face: 0, off: [-1.5, 0] },
    spot: { p: [3.4, 3.45], face: 0, y: 1.15, rx: -Math.PI / 2 },
  },
  plant: {
    n: 'the plant',
    back: [0, -1],
    rects: [{ n: 'the plant', x: [3.6, 4.6], z: [-4.6, -3.6], h: 1.6 }],
    spot: { p: [3.7, -3.1], face: Math.PI },
  },
  rug: {
    n: 'the rug',
    back: [0, -1],
    flat: true, // walked over, not an obstacle
    rects: [{ n: 'the rug', x: [-2, 2], z: [-1.2, 2.8], h: 0.04 }],
    spot: { p: [0, 1.6], face: 0 },
  },
};
export const MOVABLE = Object.keys(FURNITURE);

const r3 = (n) => Math.round(n * 1000) / 1000;
// A point turned by `a` around the y axis, the way the page turns things.
export const turn = ([x, z], a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

// The middle of the piece where it first stood.
export function pivotOf(key) {
  const f = FURNITURE[key];
  const x0 = Math.min(...f.rects.map((r) => r.x[0]));
  const x1 = Math.max(...f.rects.map((r) => r.x[1]));
  const z0 = Math.min(...f.rects.map((r) => r.z[0]));
  const z1 = Math.max(...f.rects.map((r) => r.z[1]));
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}
export const placeOf = (furn, key) => {
  const p = furn?.[key];
  return p && Number.isFinite(p.x) && Number.isFinite(p.z) ? { x: p.x, z: p.z, rot: p.rot || 0 } : { x: pivotOf(key)[0], z: pivotOf(key)[1], rot: 0 };
};
// A point that belongs to the piece, where it stands now.
export function worldPoint(key, place, [x, z]) {
  const [px, pz] = pivotOf(key);
  const [tx, tz] = turn([x - px, z - pz], place.rot);
  return [r3(place.x + tx), r3(place.z + tz)];
}
export function worldRect(key, place, r) {
  const a = worldPoint(key, place, [r.x[0], r.z[0]]);
  const b = worldPoint(key, place, [r.x[1], r.z[1]]);
  return { n: r.n, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]), h: r.h };
}
export const furnRects = (furn, key) => FURNITURE[key].rects.map((r) => worldRect(key, placeOf(furn, key), r));

// The front of a thing: the side that faces out, like a person's face. In its own frame (before it is turned).
// Furniture: the opposite of its back. Everything else: the way it was made (+z). Someone can show Pip a different front (fronts[key] = [x, z]).
const quarter = ([x, z]) => (Math.abs(x) >= Math.abs(z) ? [Math.sign(x) || 0, 0] : [0, Math.sign(z) || 0]);
export const frontLocal = (key, fronts) => {
  const f = fronts?.[key];
  if (Array.isArray(f) && f.length === 2 && f.every(Number.isFinite)) return quarter(f);
  const b = FURNITURE[key]?.back;
  return b ? [-b[0], -b[1]] : [0, 1];
};
// Where the front points in the room now, as one of the four sides of the room.
export const frontWorld = (key, rot, fronts) => quarter(turn(frontLocal(key, fronts), rot || 0));
export const SIDE_VECTORS = { left: [-1, 0], right: [1, 0], back: [0, -1], front: [0, 1] };
export const sideOfVector = ([x, z]) => Object.entries(SIDE_VECTORS).find(([, v]) => v[0] === (Math.round(x) || 0) && v[1] === (Math.round(z) || 0))?.[0] ?? 'front';
// Its sides the way people say them: left and right as seen by someone standing in front of it and looking at it, like the left of a TV. Returns which side of the room each is.
export function ownSides(front) {
  const [fx, fz] = front;
  return { front: sideOfVector([fx, fz]), back: sideOfVector([-fx, -fz]), left: sideOfVector([-fz, fx]), right: sideOfVector([fz, -fx]) };
}
