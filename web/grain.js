// Rough skins for everything Pip's world is made of, so nothing looks like smooth plastic: stained plaster, brick, planks,
// corrugated tin, roof tiles, stone blocks, worn grass, cracked paving, patched asphalt. Each is a tiny grey picture made
// here pixel by pixel (no picture files); a thing's own colour shines through it. Used outside (town.js) and in his room.
export function makeGrain(THREE) {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const jit = (by) => (rnd() - 0.5) * 2 * by;
  const grains = new Map();
  return function grain(kind, rx = 1, ry = 1) {
    const key = `${kind}`;
    let base = grains.get(key);
    if (!base) {
      const n = ['brick', 'stone', 'pave'].includes(kind) ? 64 : 32;
      const c = document.createElement('canvas');
      c.width = c.height = n;
      const g = c.getContext('2d');
      const grey = (v) => `rgb(${v},${v},${v})`;
      const px = (x, y, v, w = 1, h = 1) => { g.fillStyle = grey(Math.max(0, Math.min(255, Math.round(v)))); g.fillRect(x, y, w, h); };
      g.fillStyle = grey(232); g.fillRect(0, 0, n, n);
      if (kind === 'brick') { g.fillStyle = grey(168); g.fillRect(0, 0, n, n); for (let row = 0; row < 8; row++) for (let i = -1; i < 4; i++) px(i * 16 + (row % 2) * 8 + 1, row * 8 + 1, 196 + rnd() * 54 - (rnd() < 0.12 ? 50 : 0), 14, 6); }
      else if (kind === 'stone') { g.fillStyle = grey(176); g.fillRect(0, 0, n, n); for (let row = 0; row < 4; row++) for (let i = -1; i < 2; i++) px(i * 32 + (row % 2) * 16 + 1, row * 16 + 1, 206 + rnd() * 44, 30, 14); }
      else if (kind === 'planks') { for (let i = 0; i < 4; i++) { const v = 208 + rnd() * 42; px(i * 8, 0, v, 7, n); px(i * 8 + 7, 0, 150, 1, n); if (rnd() < 0.6) px(i * 8 + 2 + Math.floor(rnd() * 3), Math.floor(rnd() * 28), v - 46, 2, 2); } }
      else if (kind === 'boards') { for (let i = 0; i < 4; i++) { const v = 206 + rnd() * 44; px(0, i * 8, v, n, 7); px(0, i * 8 + 7, 146, n, 1); } }
      else if (kind === 'metal') { for (let x = 0; x < n; x++) px(x, 0, x % 4 < 2 ? 238 : 198, 1, n); for (let i = 0; i < 9; i++) px(Math.floor(rnd() * 30), Math.floor(rnd() * 30), 150 + rnd() * 30, 1 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 4)); }
      else if (kind === 'roof') { for (let row = 0; row < 4; row++) for (let i = -1; i < 5; i++) { const v = 200 + rnd() * 50 - (rnd() < 0.1 ? 45 : 0); px(i * 8 + (row % 2) * 4, row * 8, v, 7, 6); px(i * 8 + (row % 2) * 4, row * 8 + 6, v - 50, 7, 2); } }
      else if (kind === 'pave') { for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) px(i * 32 + 1, k * 32 + 1, 214 + rnd() * 34, 30, 30); let cx = 10, cy = 0; for (let i = 0; i < 40; i++) { px(cx, cy, 150); cy += 1; cx += Math.round(jit(1)); } }
      if (kind !== 'brick' && kind !== 'stone') for (let i = 0; i < n * n * 0.35; i++) { const x = Math.floor(rnd() * n), y = Math.floor(rnd() * n); const d = g.getImageData(x, y, 1, 1).data[0]; px(x, y, d + jit(kind === 'grass' ? 34 : kind === 'road' ? 26 : 16)); }
      if (kind === 'grass') for (let i = 0; i < 26; i++) px(Math.floor(rnd() * n), Math.floor(rnd() * n), 176 + rnd() * 20, 1 + Math.floor(rnd() * 2), 1);
      if (kind === 'road') { px(4, 6, 196, 12, 9); px(18, 20, 244, 9, 7); }
      if (kind === 'plain') { for (let i = 0; i < 3; i++) { const x = Math.floor(rnd() * 30); g.fillStyle = 'rgba(60,50,40,.12)'; g.fillRect(x, 0, 1 + Math.floor(rnd() * 2), 12 + rnd() * 20); } g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(Math.floor(rnd() * 20), Math.floor(rnd() * 20), 9, 7); }
      base = new THREE.CanvasTexture(c);
      base.magFilter = THREE.NearestFilter;
      base.minFilter = THREE.NearestMipmapLinearFilter;
      base.wrapS = base.wrapT = THREE.RepeatWrapping;
      base.colorSpace = THREE.SRGBColorSpace;
      grains.set(key, base);
    }
    if (rx === 1 && ry === 1) return base;
    const t = base.clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    return t;
  };
}
