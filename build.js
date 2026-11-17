// Pip's building tools: what a builder in a game does for you, so what he makes holds together.
// - Snapping: a leg or post that stops just under a top grows to meet it (a table top never floats over its legs).
// - Gravity: a loose part with nothing holding it comes down onto what is under it.
// Only things that stand (on the floor or on something) are checked; things on a wall or ceiling hang from it.
// Glowing bits (a light, a flame) and very small parts may float: they are details, not structure.
const r3 = (n) => Math.round(n * 1000) / 1000;
const TOUCH = 0.02; // closer than this counts as touching (2 cm)
const MAX_STRETCH = 1.2; // a post grows at most this much (in metres, in his design)

function halfSize(p) {
  const [a, b, c] = p.size;
  switch (p.shape) {
    case 'box':
    case 'roundbox': return [a / 2, b / 2, c / 2];
    case 'sphere': return [a, a, a];
    case 'cylinder': return [Math.max(a, b), c / 2, Math.max(a, b)];
    case 'cone': return [a, b / 2, a];
    case 'torus': return [a + b, a + b, b];
    default: return [a, b / 2 + a, a]; // capsule
  }
}
const turned = (p) => (p.rot ?? []).some((r) => Math.abs(r) > 0.5);
function boxOf(p) {
  let e = halfSize(p);
  if (turned(p)) e = e.map(() => Math.max(...e));
  return { lo: p.pos.map((v, i) => v - e[i]), hi: p.pos.map((v, i) => v + e[i]) };
}
const overlapXZ = (a, b, pad = TOUCH) => a.lo[0] < b.hi[0] + pad && a.hi[0] + pad > b.lo[0] && a.lo[2] < b.hi[2] + pad && a.hi[2] + pad > b.lo[2];
const touches = (a, b) => overlapXZ(a, b) && a.lo[1] < b.hi[1] + TOUCH && a.hi[1] + TOUCH > b.lo[1];
const detail = (p) => p.glow || Math.max(...halfSize(p)) * 2 < 0.03;
// A leg or post: standing upright, clearly taller than it is wide, and not turned.
const isPost = (p) => !turned(p) && ['box', 'roundbox', 'cylinder', 'capsule'].includes(p.shape) && (() => { const [x, y, z] = halfSize(p); return y >= Math.max(x, z) * 1.5; })();

// Makes the parts hold together. Returns { parts, fixes } (fixes: what the builder did, in his words). `only`: the indexes
// that may be changed (when he adds parts to something, the old parts stay as they are).
export function settle(parts, { kind = 'floor', only = null } = {}) {
  if (!Array.isArray(parts) || parts.length < 2 || kind === 'wall' || kind === 'ceiling') return { parts, fixes: [] };
  const ps = parts.map((p) => ({ ...p, size: [...p.size], pos: [...p.pos] }));
  const may = (i) => !only || only.includes(i);
  const fixes = new Set();
  const ground = Math.min(...ps.map((p) => boxOf(p).lo[1]));
  const leave = new Set(); // loose with nothing under it (sticking out to the side): left as he made it
  for (let round = 0; round < ps.length * 2; round++) {
    const boxes = ps.map(boxOf);
    // What holds: everything that stands on the ground, and everything touching that, and so on.
    const held = new Set(ps.map((p, i) => i).filter((i) => boxes[i].lo[1] <= ground + TOUCH || detail(ps[i])));
    for (let grew = true; grew;) {
      grew = false;
      for (let i = 0; i < ps.length; i++) if (!held.has(i) && [...held].some((j) => !detail(ps[j]) && touches(boxes[i], boxes[j]))) { held.add(i); grew = true; }
    }
    // The lowest loose part first: fixing it may hold up the parts above it.
    const loose = ps.map((p, i) => i).filter((i) => !held.has(i) && !leave.has(i)).sort((a, b) => boxes[a].lo[1] - boxes[b].lo[1]);
    if (!loose.length) break;
    const i = loose[0];
    const b = boxes[i];
    const under = [...held].filter((j) => !detail(ps[j]) && overlapXZ(b, boxes[j], 0) && boxes[j].hi[1] <= b.lo[1] + TOUCH);
    const posts = under.filter((j) => may(j) && isPost(ps[j]) && b.lo[1] - boxes[j].hi[1] <= MAX_STRETCH);
    if (posts.length) { // the posts grow up to meet it
      for (const j of posts) {
        const add = b.lo[1] - boxes[j].hi[1];
        const p = ps[j];
        const k = p.shape === 'cylinder' ? 2 : 1; // cylinder height is size[2]; boxes and capsules use size[1]
        p.size[k] = r3(p.size[k] + add);
        p.pos[1] = r3(p.pos[1] + add / 2);
      }
      fixes.add('the legs grew to reach the top');
      continue;
    }
    if (!may(i) || !under.length) { leave.add(i); continue; } // an old part, or nothing under it: left as it is
    const top = Math.max(...under.map((j) => boxes[j].hi[1]));
    ps[i].pos[1] = r3(ps[i].pos[1] - (b.lo[1] - top)); // it comes down onto what is under it
    fixes.add('a loose part came down onto what is under it');
  }
  return { parts: ps, fixes: [...fixes] };
}
// For the maker and for him: what was fixed, said once.
export const fixWords = (fixes) => (fixes?.length ? `The builder fixed it: ${fixes.join(', and ')}.` : '');

// The thing as it is now, for the maker when he changes it or adds to it: its parts (rounded), how big it is, and what
// stands on it. He keeps what is good and changes what he wants, instead of starting again from nothing.
const r2 = (n) => Math.round(n * 100) / 100;
export function partsNow(e, decor = [], max = 60) {
  const ps = e.parts ?? [];
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of ps) { const b = boxOf(p); for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b.lo[i]); hi[i] = Math.max(hi[i], b.hi[i]); } }
  const list = ps.slice(0, max).map((p) => JSON.stringify({ shape: p.shape, size: p.size.map(r2), pos: p.pos.map(r2), ...((p.rot ?? []).some((r) => r) ? { rot: p.rot.map((r) => Math.round(r)) } : {}), color: p.color, ...(p.glow ? { glow: true } : {}) }));
  const on = decor.filter((o) => o.kind === 'surface' && (o.base === e.id || String(o.base ?? '').startsWith(`${e.id}#`))).map((o) => o.name);
  return [
    `${e.name}: ${ps.length} parts, ${r2(hi[0] - lo[0])} wide, ${r2(hi[1] - lo[1])} high, ${r2(hi[2] - lo[2])} deep (metres, as it is built in my room: I keep these sizes).`,
    on.length ? `On it: ${on.join(', ')} (they move along by themselves when I change it).` : '',
    ...list,
    ps.length > max ? `(and ${ps.length - max} more parts)` : '',
  ].filter(Boolean).join('\n');
}
