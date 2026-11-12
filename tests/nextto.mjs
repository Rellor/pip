// Regression test: "next to <something>, on a side" must put the piece on that side, or fail with a reason. Never quietly somewhere else.
// Run: node tests/nextto.mjs   (reads web/state.json, changes nothing)
import fs from 'node:fs';
const D = await import('../decor.js');
const F = await import('../web/furniture.js');
const real = JSON.parse(fs.readFileSync(new URL('../web/state.json', import.meta.url), 'utf8'));
const EDGE = 4.95;
const sides = { left: 'toward the left wall', right: 'toward the right wall', back: 'toward the back wall', front: 'toward the front wall' };
let bad = 0, checked = 0;
const keys = F.MOVABLE.filter((k) => !F.FURNITURE[k].flat);
for (const moving of keys) {
  for (const target of keys.filter((k) => k !== moving)) {
    for (const [side, phrase] of Object.entries(sides)) {
      const s = structuredClone(real);
      D.setFronts(s.fronts);
      D.setFurniture(s.furniture);
      const rects = (k) => D.fixedRects().filter((r) => r.n === F.FURNITURE[k].n || F.FURNITURE[k].rects.some((x) => x.n === r.n));
      const t = rects(target)[0];
      const me = F.FURNITURE[moving].rects[0];
      const w = me.x[1] - me.x[0], h = me.z[1] - me.z[0];
      const gap = 0.27;
      const c = { left: [t.x0 - gap - w / 2, (t.z0 + t.z1) / 2], right: [t.x1 + gap + w / 2, (t.z0 + t.z1) / 2], back: [(t.x0 + t.x1) / 2, t.z0 - gap - h / 2], front: [(t.x0 + t.x1) / 2, t.z1 + gap + h / 2] }[side];
      c[0] = Math.min(EDGE - w / 2, Math.max(-EDGE + w / 2, c[0]));
      c[1] = Math.min(EDGE - h / 2, Math.max(-EDGE + h / 2, c[1]));
      const cand = { x0: c[0] - w / 2, x1: c[0] + w / 2, z0: c[1] - h / 2, z1: c[1] + h / 2 };
      const others = D.fixedRects(moving);
      const ch = s.chest ? { x0: s.chest.x - 0.5, x1: s.chest.x + 0.5, z0: s.chest.z - 0.5, z1: s.chest.z + 0.5, n: 'the chest' } : null; // roughly, the chest stands there too
      const clear = !D.blocker(cand, ch ? [...others, ch] : others, 0.2) && !D.blocker(cand, s.decor.filter((o) => o.kind === 'floor' && o.pos && !o.image).map((o) => ({ ...D.footRect?.(o), n: o.name })).filter((o) => o.x0 !== undefined), 0.2);
      const r = D.moveThing(s.decor, s.chest, { name: moving, next_to: target, side: phrase }, Date.now(), Date.now());
      checked++;
      if (clear && r.failed) { bad++; console.log(`FAIL  ${moving} ${side} of ${target}: fits at ${c.map((v) => v.toFixed(2))} but: ${r.failed.slice(0, 120)}`); }
      if (!r.failed) {
        const p = s.furniture?.[moving];
        const m = /x (-?[\d.]+), z (-?[\d.]+)/.exec(r.label ?? '');
        const [x, z] = m ? [Number(m[1]), Number(m[2])] : [NaN, NaN];
        const ok = { left: x < t.x0, right: x > t.x1, back: z < t.z0, front: z > t.z1 }[side];
        if (!ok) { bad++; console.log(`FAIL  ${moving} ${side} of ${target}: ended at x ${x}, z ${z} (wrong side)`); }
      }
    }
  }
}
console.log(`${checked} cases checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
