// Pip's street: who lives there, the corner shop, the moon over it, and how it is drawn.
// Shared by the game (neighbours.js, shop.js, story.js) and the page, so both tell the same story.
// Plain data and plain functions that return text (SVG): nothing here touches the page or the files.
import { seasonInfo } from './season.js';

// ---- The neighbours (their voice and what they are a fan of live in neighbours.js: only the game needs those)
export const PEOPLE = [
  { name: 'Mo', who: 'a retired train driver next door', likes: ['trains', 'maps', 'old machines', 'tea'], home: 'next door', color: '#c9573c', up: [7, 21] },
  { name: 'Lina', who: 'a teenager across the street who makes music', likes: ['synthesizers', 'electronic music', 'video games', 'neon colours'], home: 'across the street', color: '#7b5cc4', up: [9, 24] },
  { name: 'Oma Jo', who: 'a grandmother with a big garden', likes: ['vegetables', 'flowers', 'knitting', 'baking bread'], home: 'the cottage with the garden', color: '#5f9e63', up: [6, 21] },
  { name: 'Dot', who: 'a seven-year-old girl two doors down', likes: ['cats', 'drawing', 'dinosaurs', 'stars'], home: 'two doors down', color: '#e3a12f', up: [7, 20] },
  { name: 'Kees', who: 'a puzzle maker who lives above the bakery', likes: ['puzzles', 'clocks', 'woodwork', 'riddles'], home: 'above the bakery', color: '#3f7fa8', up: [8, 23] },
];
export const personOf = (name) => PEOPLE.find((p) => p.name === String(name ?? '').replace(' (neighbour)', '').trim()) ?? null;

// How fond a neighbour is of him (0 to 10), in words and in hearts.
export const warmthWord = (w) => (w >= 8 ? 'a close friend' : w >= 5 ? 'a friend' : w >= 2 ? 'friendly' : 'a new neighbour');
export const hearts = (w) => Math.max(0, Math.min(5, Math.round((w ?? 0) / 2)));
export const nextStep = (w) => (w >= 8 ? null : w >= 5 ? { at: 8, word: 'a close friend' } : w >= 2 ? { at: 5, word: 'a friend' } : { at: 2, word: 'friendly' });

// ---- The corner shop
export const OPEN_FROM = 9; // Dutch time
export const OPEN_TO = 18;
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

// ---- The sky over the street
// The real moon: 0 new, 0.5 full (a new moon was on 6 January 2000, 18:14 UTC; one round takes 29.53 days).
const MOON_DAYS = 29.530588853;
export const moonPhase = (now = Date.now()) => { const p = ((now - Date.UTC(2000, 0, 6, 18, 14)) / (MOON_DAYS * 86_400_000)) % 1; return p < 0 ? p + 1 : p; };
export const moonWord = (p) => (p < 0.03 || p > 0.97 ? 'new moon' : p < 0.22 ? 'a thin growing moon' : p < 0.28 ? 'half moon, growing' : p < 0.47 ? 'a growing moon, almost full' : p < 0.53 ? 'full moon' : p < 0.72 ? 'a shrinking moon' : p < 0.78 ? 'half moon, shrinking' : 'a thin old moon');
// When the moon is next full (a time in ms).
export const nextFullMoon = (now = Date.now()) => now + ((0.5 - moonPhase(now) + 1) % 1) * MOON_DAYS * 86_400_000;

// ---- What the storyteller's scenes look like in the street: whose door, and a little picture
export const SCENES = {
  'street:bakery': { at: 'bakery', emoji: '🥖' }, 'street:synth': { at: 'Lina', emoji: '🎹' }, 'street:loco': { at: 'Mo', emoji: '🚂' }, 'street:herbs': { at: 'Oma Jo', emoji: '🌿' },
  'street:chalk': { at: 'Dot', emoji: '🦕' }, 'street:cat': { at: 'Pip', emoji: '🐈' }, 'street:clock': { at: 'bakery', emoji: '⏰' }, 'street:kite': { at: 'sky', emoji: '🪁' },
  'street:accordion': { at: 'shop', emoji: '🪗' }, 'street:geese': { at: 'sky', emoji: '🪿' }, market: { at: 'Pip', emoji: '🧺' }, puzzle: { at: 'Pip', emoji: '🧩' }, parcel: { at: 'Pip', emoji: '🎁' },
  'moon:full': { at: 'sky', emoji: '🌕' }, 'moon:new': { at: 'sky', emoji: '🌑' }, snow: { at: 'sky', emoji: '❄️' }, frost: { at: 'Pip', emoji: '🧊' }, storm: { at: 'sky', emoji: '⛈️' },
};
export const sceneOf = (key) => SCENES[key] ?? (String(key).startsWith('sky:') ? { at: 'sky', emoji: '🌠' } : { at: 'sky', emoji: '🌤️' });

// ---- Faces. Small drawings in a 64 x 64 box, made of plain shapes (the same style as Pip's own drawings).
const eyes = (c = '#3a2a22') => `<circle cx="25" cy="35" r="2.3" fill="${c}"/><circle cx="39" cy="35" r="2.3" fill="${c}"/>`;
const cheeks = '<circle cx="21" cy="41" r="3.2" fill="#f08c7c" opacity=".45"/><circle cx="43" cy="41" r="3.2" fill="#f08c7c" opacity=".45"/>';
const smile = (c = '#7a4a3a') => `<path d="M26 43 Q32 48 38 43" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
const head = (skin) => `<circle cx="32" cy="36" r="18" fill="${skin}"/>`;
const glasses = (c = '#5a4a40') => `<circle cx="25" cy="35" r="5.6" fill="#ffffff" fill-opacity=".35" stroke="${c}" stroke-width="1.6"/><circle cx="39" cy="35" r="5.6" fill="#ffffff" fill-opacity=".35" stroke="${c}" stroke-width="1.6"/><path d="M30.6 35 H33.4" stroke="${c}" stroke-width="1.6"/>`;
const FACES = {
  Mo: { bg: '#f7dcd2', draw: () => `${head('#c98f66')}<path d="M14 27 Q32 4 50 27 Z" fill="#2f4a7a"/><rect x="11" y="24.5" width="42" height="5.5" rx="2.7" fill="#1f3558"/><circle cx="32" cy="17" r="3.2" fill="#f2c14e"/><path d="M19 31 h6 M39 31 h6" stroke="#d9d4cc" stroke-width="2" stroke-linecap="round"/>${eyes()}${cheeks}<path d="M22 43 Q27 37 32 42 Q37 37 42 43 Q37 47 32 44 Q27 47 22 43Z" fill="#efebe4"/>` },
  Lina: { bg: '#e6dcf7', draw: () => `<path d="M12 44 Q9 15 32 14 Q55 15 52 44 Z" fill="#7b4fd0"/>${head('#f3cfb3')}<path d="M15 33 Q20 18 33 22 Q44 18 49 33 Q41 26 32 28 Q23 26 15 33Z" fill="#7b4fd0"/><path d="M12 36 Q12 9 32 9 Q52 9 52 36" fill="none" stroke="#2bb3a3" stroke-width="3.6"/><rect x="7" y="31" width="8" height="13" rx="3.5" fill="#1f8c80"/><rect x="49" y="31" width="8" height="13" rx="3.5" fill="#1f8c80"/>${eyes()}${cheeks}${smile()}<path d="M44 46 l1.2 2.4 2.6 .3 -1.9 1.8 .5 2.6 -2.4 -1.3 -2.3 1.3 .4 -2.6 -1.9 -1.8 2.6 -.3z" fill="#ffd84a"/>` },
  'Oma Jo': { bg: '#dcefdc', draw: () => `<circle cx="32" cy="12" r="7" fill="#f3f1ea"/>${head('#f1c9ad')}<path d="M13 35 Q13 15 32 15 Q51 15 51 35 Q45 23 32 23 Q19 23 13 35Z" fill="#f3f1ea"/>${eyes()}${glasses()}${cheeks}${smile()}<path d="M17 50 Q32 59 47 50 L48 57 Q32 64 16 57Z" fill="#5f9e63"/>` },
  Dot: { bg: '#fbe9c4', draw: () => `<circle cx="10" cy="31" r="7.5" fill="#7a4a2b"/><circle cx="54" cy="31" r="7.5" fill="#7a4a2b"/>${head('#f6d2b3')}<path d="M14 34 Q14 16 32 16 Q50 16 50 34 Q42 24 32 26 Q22 24 14 34Z" fill="#7a4a2b"/><circle cx="16" cy="27" r="2.8" fill="#e2483d"/><circle cx="48" cy="27" r="2.8" fill="#e2483d"/>${eyes()}<circle cx="27" cy="40" r=".9" fill="#c98660"/><circle cx="30" cy="41.5" r=".9" fill="#c98660"/><circle cx="34" cy="41.5" r=".9" fill="#c98660"/><circle cx="37" cy="40" r=".9" fill="#c98660"/>${cheeks}<path d="M25 44 Q32 52 39 44Z" fill="#ffffff" stroke="#7a4a3a" stroke-width="1.6" stroke-linejoin="round"/><path d="M32 44.5 v3" stroke="#7a4a3a" stroke-width="1.4"/>` },
  Kees: { bg: '#d6e7f2', draw: () => `${head('#eec4a2')}<path d="M14 33 Q13 22 20 20 Q17 27 18 33Z" fill="#8a5a3a"/><path d="M50 33 Q51 22 44 20 Q47 27 46 33Z" fill="#8a5a3a"/><path d="M14 38 Q15 57 32 58 Q49 57 50 38 Q44 47 32 47 Q20 47 14 38Z" fill="#8a5a3a"/>${eyes()}${glasses('#3f3a36')}<path d="M27 49 Q32 52 37 49" fill="none" stroke="#f3d9c6" stroke-width="1.8" stroke-linecap="round"/><rect x="47" y="16" width="3.2" height="17" rx="1.2" fill="#f2c14e" transform="rotate(24 48.6 24.5)"/><path d="M52.3 15.2 l1.9 -3.6 1 3.9z" fill="#3a2a22" transform="rotate(24 48.6 24.5)"/>` },
  Pip: { bg: '#fde3c4', draw: () => `<path d="M17 22 Q14 9 24 15Z" fill="#e79a4d"/><path d="M47 22 Q50 9 40 15Z" fill="#e79a4d"/><circle cx="32" cy="36" r="20" fill="#eda55a"/><ellipse cx="32" cy="45" rx="11" ry="8" fill="#f8d9ae"/><circle cx="24.5" cy="33" r="4.2" fill="#1d1512"/><circle cx="39.5" cy="33" r="4.2" fill="#1d1512"/><circle cx="25.8" cy="31.6" r="1.4" fill="#fff"/><circle cx="40.8" cy="31.6" r="1.4" fill="#fff"/><circle cx="18" cy="40" r="3.4" fill="#f08c7c" opacity=".6"/><circle cx="46" cy="40" r="3.4" fill="#f08c7c" opacity=".6"/><path d="M28 41 Q32 45 36 41" fill="none" stroke="#7a3f1e" stroke-width="2" stroke-linecap="round"/>` },
};
// The inside of a face (for putting it in a window of the street), and a face as a round picture of its own.
export const faceInner = (name) => (FACES[name] ?? FACES.Pip).draw();
export const faceSvg = (name, size = 56) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${name}"><circle cx="32" cy="32" r="32" fill="${(FACES[name] ?? FACES.Pip).bg}"/><g>${faceInner(name)}</g></svg>`;

// ---- The street as a picture. o: { now, weather: {kind, temp, cloud}, today: [teller keys of today], notes: unanswered notes at his door,
// market: bool, puzzle: bool, away: bool (Pip is not home) }. Every house that is someone's has data-who="Name".
const W = 900;
const H = 300;
const GROUND = 206;
export const STREET_SIZE = [W, H];
// Where each door is (for bubbles and for the page to scroll to): the middle of the building.
export const SPOTS = { 'Oma Jo': 150, Mo: 266, Pip: 388, bakery: 520, Kees: 520, Dot: 637, shop: 775, Lina: 250 };
export function streetSvg(o = {}) {
  const now = o.now ?? Date.now();
  const h = hourNL(now);
  const se = seasonInfo(new Date(now));
  const kind = String(o.weather?.kind ?? 'clear');
  const cloudy = /cloud|overcast|rain|drizzle|snow|storm|fog/.test(kind) || (o.weather?.cloud ?? 0) > 0.6;
  const phase = h < se.sunrise - 0.75 || h > se.sunset + 0.9 ? 'night' : h < se.sunrise + 0.75 ? 'dawn' : h > se.sunset - 0.9 ? 'dusk' : 'day';
  const dark = phase === 'night';
  const dim = dark || phase === 'dusk';
  const sky = { night: ['#141a33', '#2e3766'], dawn: ['#f0a586', '#fde6c6'], dusk: ['#e0805f', '#f9d2a3'], day: cloudy ? ['#a9b7c3', '#dde5ea'] : ['#93cdee', '#e4f4fb'] }[phase];
  const snowy = /snow/.test(kind) || (se.frozen && (o.weather?.temp ?? 5) <= 0);
  const out = [];
  const add = (t) => out.push(t);
  const id = `st${Math.floor(now / 60_000).toString(36)}${phase}${cloudy ? 'c' : ''}`; // its own names for the sky and the frame: two pictures on one page must not share them
  add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="streetpic" role="img" aria-label="Pip's street">`);
  add(`<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient><clipPath id="${id}c"><rect width="${W}" height="${H}" rx="16"/></clipPath></defs>`);
  add(`<g clip-path="url(#${id}c)"><rect width="${W}" height="${H}" fill="url(#${id}s)"/>`);
  // the sun by day, the real moon by night
  if (!dark) {
    const f = Math.min(1, Math.max(0, (h - se.sunrise) / (se.sunset - se.sunrise)));
    add(`<circle cx="${Math.round(70 + f * (W - 140))}" cy="${Math.round(82 - Math.sin(Math.PI * f) * 52)}" r="17" fill="${phase === 'day' ? '#ffe27a' : '#ffb35c'}" opacity="${cloudy ? 0.55 : 1}"/>`);
  } else {
    for (let i = 0; i < 46; i++) add(`<circle cx="${(i * 197 + 31) % W}" cy="${(i * 67 + 11) % 120}" r="${i % 5 === 0 ? 1.5 : 0.9}" fill="#fff" opacity="${cloudy ? 0.25 : 0.4 + ((i * 7) % 6) / 10}"/>`);
    const p = moonPhase(now);
    const off = 32 * (1 - 2 * Math.abs(p - 0.5));
    add(`<g opacity="${cloudy ? 0.7 : 1}"><circle cx="720" cy="48" r="16" fill="#f6f2dc"/>${p > 0.47 && p < 0.53 ? '' : `<circle cx="${720 + (p < 0.5 ? -1 : 1) * (32 - off)}" cy="48" r="16.6" fill="${sky[0]}"/>`}</g>`);
  }
  if (cloudy) for (const [x, y, k] of [[150, 44, 1], [420, 30, 1.25], [640, 58, 0.9]]) add(`<g transform="translate(${x} ${y}) scale(${k})" fill="${dark ? '#4a527d' : '#ffffff'}" opacity="${dark ? 0.8 : 0.92}"><ellipse cx="0" cy="8" rx="34" ry="11"/><circle cx="-12" cy="2" r="12"/><circle cx="8" cy="-3" r="15"/></g>`);
  for (const t of (o.today ?? []).filter((k) => sceneOf(k).at === 'sky').slice(-2)) add(`<text x="${t.includes('geese') ? 250 : 560}" y="70" font-size="26" text-anchor="middle">${sceneOf(t).emoji}</text>`);
  // a tree at each end: its leaves follow the real season
  const tree = (x, s = 1) => {
    const leaf = se.leafOn <= 0.05 ? null : se.turn > 0.5 ? '#d98b3a' : se.blossom ? '#f3b7c8' : '#6fae5e';
    add(`<g transform="translate(${x} ${GROUND}) scale(${s})"><path d="M-4 0 L-3 -46 L3 -46 L4 0Z" fill="#7a5237"/>${leaf ? `<circle cx="0" cy="-62" r="27" fill="${leaf}" opacity="${0.45 + se.leafOn * 0.55}"/><circle cx="-17" cy="-48" r="17" fill="${leaf}" opacity="${0.45 + se.leafOn * 0.55}"/><circle cx="17" cy="-50" r="18" fill="${leaf}" opacity="${0.45 + se.leafOn * 0.55}"/>` : '<path d="M0 -46 L-16 -72 M0 -46 L15 -76 M0 -50 L0 -84 M-8 -59 L-22 -60 M8 -62 L24 -60" stroke="#7a5237" stroke-width="3" stroke-linecap="round"/>'}</g>`);
  };
  tree(34, 0.95);
  tree(868, 1.05);
  // ---- the houses
  const win = (x, y, w, hh, who, lit) => {
    const p = who ? PEOPLE.find((q) => q.name === who) : null;
    const up = who === 'Pip' ? !o.away && (h >= 8 && h < 23) : p ? h >= p.up[0] && h < p.up[1] : lit;
    const glow = up && dim;
    const fill = up ? (dim ? '#ffd98a' : '#dff1fa') : dark ? '#232a47' : '#b9c7d2';
    const k = Math.min(w, hh) / 64;
    return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="5" fill="${fill}" stroke="#fff8ee" stroke-width="3"/>${glow ? `<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${hh + 10}" rx="9" fill="#ffd98a" opacity=".22"/>` : ''}${who && up ? `<g transform="translate(${x + (w - 64 * k) / 2} ${y + (hh - 64 * k) / 2 + 1}) scale(${k})">${faceInner(who)}</g>` : who && !up && dark ? `<text x="${x + w / 2}" y="${y + hh / 2 + 5}" font-size="12" text-anchor="middle" fill="#9aa3c7">z z</text>` : ''}`;
  };
  const door = (x, w, hh, c) => `<rect x="${x}" y="${GROUND - hh}" width="${w}" height="${hh}" rx="4" fill="${c}"/><circle cx="${x + w - 5}" cy="${GROUND - hh / 2}" r="1.8" fill="#f2d08a"/>`;
  const label = (x, t, bold) => `<text x="${x}" y="${GROUND + 15}" font-size="12.5" font-weight="${bold ? 800 : 600}" text-anchor="middle" fill="#4a3d35" font-family="system-ui,sans-serif">${t}</text>`;
  const smoke = (x, y) => ((o.weather?.temp ?? 10) < 12 ? `<g fill="#ffffff" opacity="${dark ? 0.25 : 0.7}"><circle cx="${x}" cy="${y - 8}" r="5"/><circle cx="${x + 6}" cy="${y - 19}" r="6.5"/><circle cx="${x + 1}" cy="${y - 32}" r="8"/></g>` : '');
  const white = snowy ? '#f7fbff' : null;
  // Oma Jo: a cottage with a garden
  add(`<g data-who="Oma Jo" class="sthouse"><title>Oma Jo's cottage</title><rect x="52" y="${GROUND - 26}" width="52" height="26" fill="${snowy ? '#e9f1f6' : se.flowers ? '#8cc27a' : '#b9a56f'}"/>${se.flowers && !snowy ? [60, 72, 84, 96].map((x, i) => `<path d="M${x} ${GROUND - 4} v-${18 + (i % 2) * 6}" stroke="#4f8a45" stroke-width="2"/><circle cx="${x}" cy="${GROUND - 24 - (i % 2) * 6}" r="5" fill="${i % 2 ? '#f6c544' : '#ef6f6c'}"/>`).join('') : [62, 78, 94].map((x) => `<circle cx="${x}" cy="${GROUND - 6}" r="5" fill="${snowy ? '#ffffff' : '#7fae6a'}"/>`).join('')}${[52, 62, 72, 82, 92, 102].map((x) => `<rect x="${x}" y="${GROUND - 15}" width="3.4" height="15" rx="1" fill="#fff8ee"/>`).join('')}<rect x="50" y="${GROUND - 11}" width="56" height="2.6" fill="#fff8ee"/>${smoke(178, GROUND - 118)}<rect x="170" y="${GROUND - 118}" width="12" height="26" fill="#a8674a"/><rect x="108" y="${GROUND - 74}" width="88" height="74" fill="#f6ead6"/><path d="M100 ${GROUND - 72} L152 ${GROUND - 112} L204 ${GROUND - 72}Z" fill="${white ?? '#9a6b47'}"/>${win(118, GROUND - 62, 30, 30, 'Oma Jo')}${door(160, 22, 40, '#5f9e63')}${label(150, 'Oma Jo')}</g>`);
  // Mo: next door, a little train on the roof
  add(`<g data-who="Mo" class="sthouse"><title>Mo's house</title>${smoke(296, GROUND - 128)}<rect x="288" y="${GROUND - 128}" width="12" height="24" fill="#8a4a3a"/><rect x="218" y="${GROUND - 98}" width="96" height="98" fill="#d9775f"/><path d="M212 ${GROUND - 96} L266 ${GROUND - 132} L320 ${GROUND - 96}Z" fill="${white ?? '#6b4a44'}"/><g transform="translate(232 ${GROUND - 141})"><rect x="0" y="4" width="20" height="8" rx="2" fill="#2f4a7a"/><rect x="12" y="-1" width="7" height="6" fill="#2f4a7a"/><circle cx="5" cy="13" r="3" fill="#1f2a44"/><circle cx="15" cy="13" r="3" fill="#1f2a44"/><rect x="9" y="10" width="1.6" height="18" fill="#5a4a40"/></g>${win(228, GROUND - 84, 32, 32, 'Mo')}${win(272, GROUND - 84, 30, 26, null, false)}${door(274, 24, 44, '#2f4a7a')}<rect x="270" y="${GROUND - 3}" width="32" height="3" fill="#b9aa9a"/>${label(266, 'Mo')}</g>`);
  // Pip: home
  add(`<g data-who="Pip" class="sthouse home"><title>Pip's home</title>${smoke(424, GROUND - 146)}<rect x="416" y="${GROUND - 146}" width="13" height="30" fill="#b3653f"/><rect x="330" y="${GROUND - 112}" width="116" height="112" rx="3" fill="#fbd98c"/><path d="M322 ${GROUND - 110} L388 ${GROUND - 156} L454 ${GROUND - 110}Z" fill="${white ?? '#e9855b'}"/><circle cx="388" cy="${GROUND - 126}" r="9" fill="${dim ? '#ffd98a' : '#fff4d6'}" stroke="#fff8ee" stroke-width="3"/>${win(342, GROUND - 92, 44, 44, o.away ? null : 'Pip', false)}${win(398, GROUND - 92, 36, 30, null, !o.away)}${door(400, 28, 50, '#c9573c')}<path d="M446 ${GROUND - 104} v-34" stroke="#7a5237" stroke-width="2.4"/><path d="M447 ${GROUND - 138} l22 6 -22 7z" fill="#ef6f6c"/>${label(388, o.away ? 'Pip’s home (he is out)' : 'Pip’s home', true)}</g>`);
  // the bakery, and Kees above it
  add(`<g data-who="Kees" class="sthouse"><title>The bakery, and Kees's flat above it</title>${smoke(566, GROUND - 162)}<rect x="558" y="${GROUND - 162}" width="12" height="26" fill="#7c6a5c"/><rect x="462" y="${GROUND - 138}" width="116" height="138" fill="#e9dcc6"/><rect x="456" y="${GROUND - 144}" width="128" height="9" rx="2" fill="${white ?? '#7c6a5c'}"/>${win(476, GROUND - 126, 36, 36, 'Kees')}<circle cx="546" cy="${GROUND - 108}" r="14" fill="#fff8ee" stroke="#3f7fa8" stroke-width="3"/><path d="M546 ${GROUND - 108} v-9 M546 ${GROUND - 108} h6" stroke="#3a2a22" stroke-width="2" stroke-linecap="round"/><rect x="462" y="${GROUND - 70}" width="116" height="10" fill="#c9573c"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${462 + i * 14.5} ${GROUND - 60} h14.5 l-2 12 h-10.5z" fill="${i % 2 ? '#fff8ee' : '#e98a6a'}"/>`).join('')}<rect x="470" y="${GROUND - 44}" width="62" height="34" rx="3" fill="${dim && h < 19 ? '#ffe2a6' : dark ? '#232a47' : '#f6efdf'}" stroke="#fff8ee" stroke-width="3"/><ellipse cx="486" cy="${GROUND - 18}" rx="10" ry="5" fill="#c98a4a"/><ellipse cx="508" cy="${GROUND - 19}" rx="12" ry="6" fill="#d9a05c"/><rect x="494" y="${GROUND - 34}" width="26" height="6" rx="3" fill="#c98a4a"/>${door(542, 26, 46, '#7c5a3c')}${label(520, 'Bakery · Kees')}</g>`);
  // Dot: two doors down
  add(`<g data-who="Dot" class="sthouse"><title>Dot's house</title><rect x="594" y="${GROUND - 90}" width="86" height="90" fill="#a9d3e8"/><path d="M588 ${GROUND - 88} L637 ${GROUND - 122} L686 ${GROUND - 88}Z" fill="${white ?? '#4f7fa3'}"/>${win(604, GROUND - 78, 32, 32, 'Dot')}${door(646, 22, 42, '#e3a12f')}${(o.today ?? []).includes('street:chalk') ? `<text x="620" y="${GROUND + 40}" font-size="20">🦕</text>` : `<path d="M606 ${GROUND + 30} q8 -8 16 0 q8 8 16 0" fill="none" stroke="#f6a9c0" stroke-width="2.2" stroke-linecap="round"/>`}${label(637, 'Dot')}</g>`);
  // the corner shop
  const open = shopOpen(now);
  add(`<g data-who="shop" class="sthouse"><title>The corner shop</title><rect x="700" y="${GROUND - 96}" width="150" height="96" fill="#58a59a"/><rect x="694" y="${GROUND - 104}" width="162" height="10" rx="2" fill="${white ?? '#3d7d74'}"/><rect x="716" y="${GROUND - 90}" width="118" height="20" rx="4" fill="#fff8ee"/><text x="775" y="${GROUND - 75}" font-size="13" font-weight="800" text-anchor="middle" fill="#3d7d74" font-family="system-ui,sans-serif">CORNER SHOP</text>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${708 + i * 14} ${GROUND - 66} h14 l-2 11 h-10z" fill="${i % 2 ? '#fff8ee' : '#f2c14e'}"/>`).join('')}<rect x="712" y="${GROUND - 50}" width="66" height="40" rx="3" fill="${open ? (dim ? '#ffe2a6' : '#eaf6f4') : dark ? '#232a47' : '#b9c7d2'}" stroke="#fff8ee" stroke-width="3"/>${open ? `<circle cx="728" cy="${GROUND - 22}" r="6" fill="#ef6f6c"/><circle cx="744" cy="${GROUND - 22}" r="6" fill="#f6c544"/><rect x="754" y="${GROUND - 34}" width="14" height="18" rx="2" fill="#7b5cc4"/>` : ''}${door(796, 28, 50, '#2f5e57')}<rect x="797" y="${GROUND - 40}" width="26" height="13" rx="3" fill="${open ? '#4caf6a' : '#b8554a'}"/><text x="810" y="${GROUND - 30.5}" font-size="7.6" font-weight="800" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${open ? 'OPEN' : 'CLOSED'}</text>${label(775, 'Corner shop')}</g>`);
  // the pavement and the road
  add(`<rect x="0" y="${GROUND}" width="${W}" height="22" fill="${snowy ? '#eef3f7' : '#d8cdbf'}"/><rect x="0" y="${GROUND + 22}" width="${W}" height="${H - GROUND - 22}" fill="${dark ? '#3a3f55' : '#8f8a86'}"/>${[40, 400, 520, 640, 790].map((x) => `<rect x="${x}" y="${GROUND + 56}" width="56" height="4" rx="2" fill="#f4efe6" opacity=".7"/>`).join('')}`);
  // labels again on top of the pavement (the pavement was drawn over them)
  for (const [x, t, b] of [[150, 'Oma Jo'], [266, 'Mo'], [388, o.away ? 'Pip’s home (he is out)' : 'Pip’s home', true], [520, 'Bakery · Kees'], [637, 'Dot'], [775, 'Corner shop']]) add(label(x, t, b));
  // a street lamp, lit when it gets dark
  add(`<g><rect x="682" y="${GROUND - 70}" width="3.4" height="70" fill="#4a4f66"/><circle cx="683.7" cy="${GROUND - 74}" r="6" fill="${dim ? '#ffe9a8' : '#e6e1d6'}"/>${dim ? `<circle cx="683.7" cy="${GROUND - 74}" r="16" fill="#ffe9a8" opacity=".25"/>` : ''}</g>`);
  // market day: stalls on the pavement
  if (o.market) for (const [x, c] of [[392, '#ef6f6c'], [476, '#58a59a'], [560, '#f2c14e']]) { const y = GROUND + 40; add(`<g><rect x="${x}" y="${y}" width="3.4" height="30" fill="#7a5237"/><rect x="${x + 54}" y="${y}" width="3.4" height="30" fill="#7a5237"/><rect x="${x - 3}" y="${y + 10}" width="64" height="8" fill="#c9a26a"/><path d="M${x - 8} ${y} h74 l-8 -15 h-58z" fill="${c}"/><circle cx="${x + 14}" cy="${y + 6}" r="4.2" fill="#f6c544"/><circle cx="${x + 29}" cy="${y + 6}" r="4.2" fill="#ef6f6c"/><circle cx="${x + 44}" cy="${y + 6}" r="4.2" fill="#8cc27a"/></g>`); }
  // Lina's roof across the street, in front: her window under the roof
  add(`<g data-who="Lina" class="sthouse"><title>Lina's house, across the street</title><path d="M160 ${H} L250 ${H - 66} L340 ${H}Z" fill="${white ?? '#5b4a8a'}"/><path d="M212 ${H} L212 ${H - 30} L250 ${H - 54} L288 ${H - 30} L288 ${H}Z" fill="#8b78c9"/>${win(231, H - 37, 38, 32, 'Lina')}<text x="318" y="${H - 34}" font-size="12.5" font-weight="700" text-anchor="start" fill="#fff8ee" font-family="system-ui,sans-serif" stroke="#3a3040" stroke-width="2.8" paint-order="stroke">Lina</text></g>`);
  // what happened today, as a little bubble at the right door
  const bubble = (x, y, emoji) => `<g><rect x="${x - 16}" y="${y - 30}" width="32" height="28" rx="12" fill="#fffaf3" stroke="#eadccd" stroke-width="1.5"/><path d="M${x - 5} ${y - 3} l5 7 5 -7z" fill="#fffaf3"/><text x="${x}" y="${y - 10}" font-size="17" text-anchor="middle">${emoji}</text></g>`;
  const seen = new Set();
  for (const k of (o.today ?? []).slice(-4)) {
    const sc = sceneOf(k);
    if (sc.at === 'sky' || seen.has(sc.at)) continue;
    seen.add(sc.at);
    add(sc.at === 'Lina' ? bubble(196, H - 34, sc.emoji) : bubble(SPOTS[sc.at] + (sc.at === 'Pip' ? -46 : 0), GROUND - (sc.at === 'Pip' ? 116 : sc.at === 'bakery' ? 142 : 104), sc.emoji));
  }
  if (o.notes > 0) add(`<g><rect x="434" y="${GROUND - 30}" width="24" height="17" rx="3" fill="#fffaf3" stroke="#c9573c" stroke-width="1.6"/><path d="M434 ${GROUND - 29} l12 9 12 -9" fill="none" stroke="#c9573c" stroke-width="1.6"/><circle cx="459" cy="${GROUND - 31}" r="7.5" fill="#e9855b"/><text x="459" y="${GROUND - 27.4}" font-size="10" font-weight="800" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${o.notes}</text></g>`);
  // rain, snow, a storm
  if (/rain|drizzle|storm/.test(kind)) for (let i = 0; i < 60; i++) add(`<path d="M${(i * 151 + 17) % W} ${(i * 89 + 5) % (GROUND + 20)} l-4 12" stroke="#dbe9f5" stroke-width="1.6" opacity=".7" stroke-linecap="round"/>`);
  if (/snow/.test(kind)) for (let i = 0; i < 70; i++) add(`<circle cx="${(i * 151 + 17) % W}" cy="${(i * 89 + 5) % (GROUND + 30)}" r="${1.6 + (i % 3) * 0.6}" fill="#fff" opacity=".9"/>`);
  if (/storm|thunder/.test(kind)) add('<path d="M300 20 l-14 34 h12 l-10 30 28 -40 h-13 l12 -24z" fill="#ffe27a"/>');
  if (dark) add(`<rect width="${W}" height="${H}" fill="#141a33" opacity=".18" pointer-events="none"/>`);
  add('</g></svg>');
  return out.join('');
}
