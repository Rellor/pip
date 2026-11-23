// What the game and the page share about Pip's world outside: the grocery store (what it sells), the hour in the
// Netherlands, the real moon, and Pip's own face as a small drawing. (The file keeps its old name: it used to hold his
// street, with the five neighbours, their faces and their houses. They moved away on 2026-11-23, see changes.js, and the
// street itself is the 3D world of town.js now.)
// Plain data and plain functions that return text (SVG): nothing here touches the page or the files.

// ---- The grocery store
export const OPEN_FROM = 0; // the grocery store is always open (it used to keep hours)
export const OPEN_TO = 24;
export const CATALOGUE = [
  ...['bread', 'eggs', 'flour', 'milk', 'cheese', 'butter', 'rice', 'tomatoes', 'apples'].map((item) => ({ item, price: 1, kind: 'food' })),
  ...['tomato', 'sunflower', 'lettuce', 'carrot', 'lavender', 'pea'].map((k) => ({ item: `${k} seeds`, price: 2, kind: 'seeds' })),
  { item: 'paper', price: 2, kind: 'material' }, { item: 'beads', price: 2, kind: 'material' }, { item: 'string', price: 2, kind: 'material' },
  { item: 'clay', price: 3, kind: 'material' }, { item: 'wool', price: 3, kind: 'material' }, { item: 'wire', price: 3, kind: 'material' }, { item: 'wood', price: 3, kind: 'material' },
  { item: 'umbrella', price: 4, kind: 'outdoor' }, { item: 'kite', price: 4, kind: 'outdoor' }, { item: 'scarf', price: 5, kind: 'outdoor' },
  { item: 'ruler', price: 3, kind: 'tool' }, { item: 'drawing supplies', price: 4, kind: 'tool' }, { item: 'sewing kit', price: 6, kind: 'tool' }, { item: 'toolbox', price: 8, kind: 'tool' },
  { item: 'kalimba', price: 10, kind: 'instrument' }, { item: 'flute', price: 12, kind: 'instrument' }, { item: 'guitar', price: 14, kind: 'instrument' }, { item: 'synthesizer', price: 16, kind: 'instrument' },
];
export const SHOP_ICON = { food: '🍞', seeds: '🌱', material: '🧶', tool: '🧰', instrument: '🎵', outdoor: '☂️' };
export const hourNL = (now = Date.now()) => { const d = new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })); return d.getHours() + d.getMinutes() / 60; };
export const shopOpen = (now = Date.now()) => Math.floor(hourNL(now)) >= OPEN_FROM && Math.floor(hourNL(now)) < OPEN_TO;
export const owns = (s, c) => (c.kind === 'tool' || c.kind === 'instrument' || c.kind === 'material' || c.kind === 'outdoor') && (s.tools ?? []).some((t) => `${t.name} ${t.kind ?? ''}`.toLowerCase().includes(c.item.split(' ')[0]));

// ---- The sky
// The real moon: 0 new, 0.5 full (a new moon was on 6 January 2000, 18:14 UTC; one round takes 29.53 days).
const MOON_DAYS = 29.530588853;
export const moonPhase = (now = Date.now()) => { const p = ((now - Date.UTC(2000, 0, 6, 18, 14)) / (MOON_DAYS * 86_400_000)) % 1; return p < 0 ? p + 1 : p; };
export const moonWord = (p) => (p < 0.03 || p > 0.97 ? 'new moon' : p < 0.22 ? 'a thin growing moon' : p < 0.28 ? 'half moon, growing' : p < 0.47 ? 'a growing moon, almost full' : p < 0.53 ? 'full moon' : p < 0.72 ? 'a shrinking moon' : p < 0.78 ? 'half moon, shrinking' : 'a thin old moon');
// When the moon is next full (a time in ms).
export const nextFullMoon = (now = Date.now()) => now + ((0.5 - moonPhase(now) + 1) % 1) * MOON_DAYS * 86_400_000;

// ---- Pip's face. A small drawing in a 64 x 64 box, made of plain shapes (the same style as his own drawings).
const FACE = { bg: '#fde3c4', draw: () => `<path d="M17 22 Q14 9 24 15Z" fill="#e79a4d"/><path d="M47 22 Q50 9 40 15Z" fill="#e79a4d"/><circle cx="32" cy="36" r="20" fill="#eda55a"/><ellipse cx="32" cy="45" rx="11" ry="8" fill="#f8d9ae"/><circle cx="24.5" cy="33" r="4.2" fill="#1d1512"/><circle cx="39.5" cy="33" r="4.2" fill="#1d1512"/><circle cx="25.8" cy="31.6" r="1.4" fill="#fff"/><circle cx="40.8" cy="31.6" r="1.4" fill="#fff"/><circle cx="18" cy="40" r="3.4" fill="#f08c7c" opacity=".6"/><circle cx="46" cy="40" r="3.4" fill="#f08c7c" opacity=".6"/><path d="M28 41 Q32 45 36 41" fill="none" stroke="#7a3f1e" stroke-width="2" stroke-linecap="round"/>` };
// The inside of his face (for the marker on a map or a postcard), and his face as a round picture of its own.
export const faceInner = () => FACE.draw();
export const faceSvg = (name = 'Pip', size = 56) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${name}"><circle cx="32" cy="32" r="32" fill="${FACE.bg}"/><g>${faceInner()}</g></svg>`;
