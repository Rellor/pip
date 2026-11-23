// The fronts of the buildings in Pip's world. A building is a plain block; what makes it a bakery or a house is the
// picture on its front, like a photo stuck on a box. Two ways to get that picture:
//   1. a real photo: put a file in web/tex/ and give the building "tex": "tex/bakery.jpg" (town.js);
//   2. no photo yet: one is made here from a few words (brick or planks, a door, windows, a shop front, a sign),
//      small and a little dirty, so it looks like a low photo and not like clean plastic.
// Each front also has a second picture of only its windows: that one glows when the lights are on.
export function makeFacades(THREE) {
  const PX = 26; // pixels per metre: low on purpose
  const rgb = (hex) => { const n = parseInt(String(hex).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const css = ([r, g, b], k = 1, a = 1) => `rgba(${Math.max(0, Math.min(255, Math.round(r * k)))},${Math.max(0, Math.min(255, Math.round(g * k)))},${Math.max(0, Math.min(255, Math.round(b * k)))},${a})`;

  // One wall, w x h metres. spec: { wall, color, trim, door, windows, shop, sign, shutter, columns, seed }
  return function facade(spec, w, h) {
    let seed = (spec.seed ?? 1) * 7919 + 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const W = Math.max(32, Math.min(512, Math.round(w * PX)));
    const H = Math.max(32, Math.min(512, Math.round(h * PX)));
    const kx = W / w, ky = H / h; // metres to pixels
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const lit = document.createElement('canvas'); // only the glass, for the light at night
    lit.width = W; lit.height = H;
    const gl = lit.getContext('2d');
    gl.fillStyle = '#000'; gl.fillRect(0, 0, W, H);
    const base = rgb(spec.color ?? '#c9b9a3');
    const trim = rgb(spec.trim ?? '#f4efe6');
    const X = (m) => Math.round(m * kx);
    const Y = (m) => Math.round(H - m * ky); // metres up from the ground
    const rect = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(X(x), Y(y + hh), Math.max(1, X(x + ww) - X(x)), Math.max(1, Y(y) - Y(y + hh))); };

    // ---- the wall itself
    g.fillStyle = css(base); g.fillRect(0, 0, W, H);
    const kind = spec.wall ?? 'plaster';
    if (kind === 'brick') {
      g.fillStyle = css(base, 0.62); g.fillRect(0, 0, W, H); // the mortar
      const bw = 11, bh = 4;
      for (let row = 0; row * (bh + 1) < H; row++) for (let i = -1; i * (bw + 1) < W; i++) { g.fillStyle = css(base, 0.82 + rnd() * 0.36 - (rnd() < 0.08 ? 0.25 : 0)); g.fillRect(i * (bw + 1) + (row % 2) * 6, row * (bh + 1), bw, bh); }
    } else if (kind === 'planks') {
      for (let x = 0; x < W; x += 7) { g.fillStyle = css(base, 0.88 + rnd() * 0.22); g.fillRect(x, 0, 6, H); g.fillStyle = css(base, 0.55); g.fillRect(x + 6, 0, 1, H); if (rnd() < 0.3) { g.fillStyle = css(base, 0.6); g.fillRect(x + 2, Math.floor(rnd() * H), 2, 2); } }
    } else if (kind === 'boards') {
      for (let y = 0; y < H; y += 7) { g.fillStyle = css(base, 0.86 + rnd() * 0.24); g.fillRect(0, y, W, 6); g.fillStyle = css(base, 0.5); g.fillRect(0, y + 6, W, 1); }
    } else if (kind === 'metal') {
      for (let x = 0; x < W; x++) { g.fillStyle = css(base, x % 5 < 2 ? 1.12 : x % 5 === 2 ? 0.98 : 0.8); g.fillRect(x, 0, 1, H); }
      for (let i = 0; i < W / 9; i++) { g.fillStyle = `rgba(120,70,40,${0.12 + rnd() * 0.25})`; const x = Math.floor(rnd() * W); g.fillRect(x, Math.floor(rnd() * H * 0.6), 1 + Math.floor(rnd() * 3), 6 + Math.floor(rnd() * 30)); } // rust
    } else if (kind === 'stone') {
      g.fillStyle = css(base, 0.68); g.fillRect(0, 0, W, H);
      for (let row = 0; row * 13 < H; row++) for (let i = -1; i * 25 < W; i++) { g.fillStyle = css(base, 0.86 + rnd() * 0.26); g.fillRect(i * 25 + (row % 2) * 12, row * 13, 24, 12); }
    } else if (kind === 'concrete') {
      for (let x = 0; x < W; x += 52) { g.fillStyle = css(base, 0.93 + rnd() * 0.12); g.fillRect(x, 0, 51, H); g.fillStyle = css(base, 0.7); g.fillRect(x + 51, 0, 1, H); }
      for (let i = 0; i < W / 6; i++) { g.fillStyle = `rgba(40,40,45,${0.05 + rnd() * 0.1})`; g.fillRect(Math.floor(rnd() * W), 0, 1 + Math.floor(rnd() * 3), Math.floor(rnd() * H)); }
    } else { // plaster: patches and stains
      for (let i = 0; i < (W * H) / 900; i++) { g.fillStyle = css(base, 0.9 + rnd() * 0.2, 0.5); g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 8 + Math.floor(rnd() * 26), 5 + Math.floor(rnd() * 14)); }
    }
    // a plinth along the ground, and a beam under the roof
    if (!spec.plain) { rect(0, 0, w, 0.32, css(base, 0.62)); rect(0, h - 0.22, w, 0.22, css(trim, 0.86)); }

    // ---- what is in it
    const glass = (x, y, ww, hh, dark = '#2e3a4a') => {
      rect(x, y, ww, hh, dark);
      const gr = g.createLinearGradient(0, Y(y + hh), X(ww), Y(y)); gr.addColorStop(0, 'rgba(190,215,235,.55)'); gr.addColorStop(0.5, 'rgba(120,150,180,.18)'); gr.addColorStop(1, 'rgba(210,225,240,.4)');
      g.fillStyle = gr; g.fillRect(X(x), Y(y + hh), X(x + ww) - X(x), Y(y) - Y(y + hh));
      gl.fillStyle = '#ffd98a'; gl.fillRect(X(x), Y(y + hh), X(x + ww) - X(x), Y(y) - Y(y + hh));
    };
    for (const [x, y, ww, hh] of spec.windows ?? []) {
      rect(x - 0.12, y - 0.14, ww + 0.24, hh + 0.26, css(trim));
      glass(x, y, ww, hh);
      rect(x + ww / 2 - 0.03, y, 0.06, hh, css(trim)); rect(x, y + hh * 0.55, ww, 0.06, css(trim)); // the bars
      rect(x - 0.18, y - 0.22, ww + 0.36, 0.1, css(trim, 0.8)); // the sill
      g.fillStyle = 'rgba(30,25,20,.22)'; g.fillRect(X(x - 0.18), Y(y - 0.22), X(ww + 0.36), 3); // its shadow
      if (rnd() < 0.7) { g.fillStyle = `rgba(${200 + Math.floor(rnd() * 55)},${170 + Math.floor(rnd() * 60)},${150 + Math.floor(rnd() * 80)},.75)`; g.fillRect(X(x), Y(y + hh), X(x + ww * 0.28) - X(x), Y(y + hh * 0.45) - Y(y + hh)); g.fillRect(X(x + ww * 0.72), Y(y + hh), X(x + ww) - X(x + ww * 0.72), Y(y + hh * 0.45) - Y(y + hh)); } // curtains
    }
    if (spec.shop) { // a shop front: a big window with things in it, and an awning
      const { x0, x1, awning, goods } = spec.shop;
      rect(x0 - 0.15, 0.3, x1 - x0 + 0.3, 2.35, css(trim, 0.9));
      glass(x0, 0.55, x1 - x0, 1.95, '#3a2f2a');
      for (let i = 0; i < (x1 - x0) * 2.2; i++) { const col = (goods ?? ['#e9c27a', '#d98b4a', '#f2dfb0'])[Math.floor(rnd() * 3) % (goods?.length ?? 3)]; g.fillStyle = col; const px = X(x0 + 0.2 + rnd() * (x1 - x0 - 0.5)); const row = Math.floor(rnd() * 2); g.fillRect(px, Y(0.72 + row * 0.75 + 0.28), 5 + Math.floor(rnd() * 5), 6); }
      rect(x0, 0.68, x1 - x0, 0.05, css(trim, 0.7)); rect(x0, 1.43, x1 - x0, 0.05, css(trim, 0.7)); // shelves
      if (awning) { const a = rgb(awning); for (let i = 0, x = x0 - 0.3; x < x1 + 0.3; x += 0.45, i++) rect(x, 2.65, 0.45, 0.5, i % 2 ? css(a) : css([250, 244, 232])); g.fillStyle = 'rgba(20,15,10,.3)'; g.fillRect(X(x0 - 0.3), Y(2.65), X(x1 - x0 + 0.6), 4); }
    }
    if (spec.shutter) { // a roller shutter, pulled down, with a scribble on it
      const { x0, x1 } = spec.shutter;
      for (let y = 0.1; y < 2.6; y += 0.11) rect(x0, y, x1 - x0, 0.1, css([150, 150, 148], 0.8 + rnd() * 0.3));
      g.strokeStyle = 'rgba(25,25,30,.75)'; g.lineWidth = 1.4; g.beginPath();
      let px = X(x0 + 0.3), py = Y(1.2); g.moveTo(px, py);
      for (let i = 0; i < 9; i++) { px += 6 + rnd() * 9; py = Y(0.7 + rnd() * 1.3); g.lineTo(px, py); }
      g.stroke();
    }
    for (let i = 0; i < (spec.columns ?? 0); i++) { const x = (w / (spec.columns + 1)) * (i + 1) - 0.35; rect(x, 0.3, 0.7, h - 1.1, css(trim, 0.96)); rect(x + 0.5, 0.3, 0.2, h - 1.1, css(trim, 0.78)); rect(x - 0.12, h - 0.9, 0.94, 0.22, css(trim, 0.9)); }
    if (spec.door) {
      const { x, color = '#7a5237', w: dw = 1.0, h: dh = 2.1 } = spec.door;
      const d = rgb(color);
      rect(x - dw / 2 - 0.12, 0, dw + 0.24, dh + 0.14, css(trim));
      rect(x - dw / 2, 0, dw, dh, css(d));
      rect(x - dw / 2 + 0.12, dh * 0.52, dw - 0.24, dh * 0.38, css(d, 0.82)); rect(x - dw / 2 + 0.12, 0.14, dw - 0.24, dh * 0.3, css(d, 0.82)); // panels
      rect(x + dw / 2 - 0.2, dh * 0.45, 0.08, 0.08, '#f2d08a');
      rect(x - dw / 2 - 0.2, 0, dw + 0.4, 0.1, css([200, 195, 188])); // the step
    }
    if (spec.sign) { // a painted board with its name
      const { text, bg = '#fffaf3', fg = '#4a3d35', y = Math.min(h - 0.95, 3.2), x = w / 2, size = 0.5 } = spec.sign;
      g.font = `800 ${Math.round(size * ky)}px "Marker Felt", "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive, sans-serif`;
      const tw = g.measureText(text).width / kx + 0.5;
      rect(x - tw / 2, y, tw, size + 0.28, css(rgb(bg)));
      rect(x - tw / 2, y, tw, 0.05, 'rgba(0,0,0,.25)');
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, X(x), Y(y + (size + 0.28) / 2) + 1);
    }

    // ---- what makes it look like a photo of a real wall: dirt that ran down, damp at the ground, grain, a soft edge
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(20,18,16,.22)'); gr.addColorStop(0.12, 'rgba(20,18,16,0)'); gr.addColorStop(0.8, 'rgba(20,18,16,0)'); gr.addColorStop(1, 'rgba(30,26,20,.3)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < W / 14; i++) { const x = Math.floor(rnd() * W); const len = 10 + Math.floor(rnd() * H * 0.5); const s = g.createLinearGradient(0, 0, 0, len); s.addColorStop(0, `rgba(30,26,22,${0.1 + rnd() * 0.16})`); s.addColorStop(1, 'rgba(30,26,22,0)'); g.fillStyle = s; g.fillRect(x, Math.floor(rnd() * H * 0.3), 1 + Math.floor(rnd() * 2), len); }
    const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) { const n = (rnd() - 0.5) * 22; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    const soft = document.createElement('canvas'); soft.width = W; soft.height = H;
    const gs = soft.getContext('2d');
    gs.filter = 'blur(0.7px)'; gs.drawImage(c, 0, 0);
    g.globalAlpha = 0.45; g.drawImage(soft, 0, 0); g.globalAlpha = 1;

    const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t; };
    return { map: tex(c), glow: (spec.windows?.length || spec.shop) ? tex(lit) : null };
  };
}
