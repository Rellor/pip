// Pip's little world outside his room: a few named places, what there is to do there, and how the page draws it.
// Shared by the game (world.js: the rules) and the page (the cards of his outings), so both tell the same story.
// Research on worlds for small models and on games like this says: named places, never coordinates; five to seven
// places are enough; every place has things to do that exist nowhere else, and opening hours; the world starts small.
import { seasonInfo } from './season.js';
import { hourNL, faceInner } from './street.js';

// walk: minutes on foot from home. stay: how long he stays (minutes, from-to). hours: when he can be there (Dutch time);
// 'light' means from sunrise to sunset. things: what he can do there (the first that fits the moment is the usual one).
export const PLACES = [
  { key: 'home', name: 'home', title: 'Home', emoji: '🏠', walk: 0, at: [300, 250] },
  {
    key: 'doorstep', name: 'my doorstep', title: 'His doorstep', emoji: '🚪', walk: 1, stay: [15, 25], hours: [8, 21], at: [330, 292],
    blurb: 'Sitting in front of his door, watching the square.',
    things: [{ key: 'watch', words: 'sit and watch the square', match: /watch|sit|street|square|look/ }],
  },
  {
    key: 'square', name: 'the square', title: 'The square', emoji: '⛲', walk: 2, stay: [10, 18], hours: [7, 22], at: [300, 300],
    blurb: 'The middle of the village. Everyone crosses it, and there is room to ride, kick and roll.',
    things: [{ key: 'walk', words: 'walk round the square', match: /walk|round|cross|stroll|look|people/ }],
  },
  { key: 'shop', name: 'the grocery store', title: 'The grocery store', emoji: '🛒', walk: 3, stay: [4, 6], hours: [9, 18], at: [452, 262], errand: true, blurb: 'Where he spends his coins. He cooks and bakes himself, with what he buys here.' },
  {
    key: 'pond', name: 'the pond in the park', title: 'The pond', emoji: '🦆', walk: 8, stay: [30, 50], hours: 'light', at: [150, 118],
    blurb: 'Ducks, reeds and a bench under the willow. It freezes in real frost.',
    things: [{ key: 'ducks', words: 'watch the ducks', match: /duck|watch|water|bench|sit/ }, { key: 'find', words: 'look for something to bring home', match: /find|look for|collect|bring|search|feather|stone|pebble|leaf|leaves/ }, { key: 'sketch', words: 'sketch what I see', match: /sketch|draw|paint/ }, { key: 'ice', words: 'slide on the ice', match: /ice|slide|skate/, when: 'frozen' }],
  },
  {
    key: 'library', name: 'the library', title: 'The library', emoji: '📚', walk: 10, stay: [30, 45], hours: [10, 17], days: [2, 3, 4, 5, 6], at: [478, 118],
    blurb: 'Quiet tables and more books than he can count.',
    locked: 'He needs a library card. He can ask for one.',
    things: [{ key: 'read', words: 'read about something I wonder about', match: /read|book|learn|look up|find out/ }],
  },
  {
    key: 'field', name: 'my field', title: 'His field', emoji: '🌱', walk: 5, stay: [20, 35], hours: 'light', at: [540, 210],
    blurb: 'His own land beside the square. It is his to fill.',
    things: [{ key: 'plan', words: 'walk around my field and pick a spot to build on', match: /plan|walk|build|spot|pace|measure|look/ }, { key: 'clouds', words: 'lie in the grass and watch the clouds', match: /cloud|lie|grass|sky|nothing|rest/ }],
  },
  {
    key: 'stone', name: 'the green stone', title: 'The green stone', emoji: '💎', walk: 12, stay: [20, 30], hours: 'light', at: [70, 70],
    blurb: 'It stands far out in the grass and glows a little at night. Nobody knows who put it there.',
    things: [{ key: 'sit', words: 'sit by the green stone', match: /sit|rest|look|watch|view/ }, { key: 'listen', words: 'listen if it hums', match: /listen|hum|ear|hear|sound/ }],
  },
  {
    key: 'museum', name: 'my museum', title: 'His museum', emoji: '🏛️', walk: 7, stay: [15, 25], hours: 'light', at: [150, 200],
    blurb: 'An open hall with plinths, south of the pond. The things he made stand here for everyone to see.',
    things: [{ key: 'walk', words: 'walk past my things and look at them', match: /walk|look|see|visit|round|past/ }, { key: 'dust', words: 'dust the plinths and set things straight', match: /dust|clean|straight|tidy|polish|care/ }],
  },
  // Places he only goes to with something to do there (job): he designs it first, then walks there and it is made.
  { key: 'board', name: 'the notice board', title: 'The notice board', emoji: '📌', walk: 1, stay: [3, 5], hours: [0, 24], at: [270, 292], job: true, blurb: 'People of the town pin notes on it: things they would like made. He reads it, makes one, and earns coins.' },
  { key: 'workshop', name: 'the print workshop', title: 'The print workshop', emoji: '🖨️', walk: 9, stay: [20, 30], hours: [9, 18], at: [560, 300], job: true, blurb: 'A 3D printer hums behind the shutter. What he designs is printed small and kept on the shelf by the door.' },
  { key: 'walls', name: 'the walls', title: 'The walls', emoji: '🎨', walk: 6, stay: [25, 40], hours: 'light', at: [420, 330], job: true, blurb: 'Bare walls all over his world that he paints on, and some back walls too. He needs no paper for it.' },
  { key: 'drops', name: 'my world', title: 'A note in his world', emoji: '💌', walk: 3, stay: [3, 5], hours: [0, 24], at: [300, 300], job: true, blurb: 'People passing through leave notes for him somewhere in his world. He walks over and picks them up.' },
  { key: 'land', name: 'the land workshop', title: 'The land workshop', emoji: '⛰️', walk: 6, stay: [20, 35], hours: [0, 24], at: [600, 240], job: true, blurb: 'The land tools are kept here. With them he shapes the ground of his world: a hill here, a hole there.' },
];
// Places that were in his world once (the page still shows his old outings to them). He cannot go there any more.
export const OLD_PLACES = [
  {
    key: 'garden', name: 'Oma Jo’s garden', title: 'Oma Jo’s garden', emoji: '🌻', walk: 2, stay: [25, 40], hours: [9, 18], at: [112, 258],
    blurb: 'Vegetable beds and a shed that smells of earth. Oma Jo always has a job for him.',
    locked: 'Oma Jo lets him in once she is friendly with him.', seen: true, // he can see it from his street, so he knows it is there
    things: [{ key: 'help', words: 'help Oma Jo in her garden', match: /help|dig|weed|plant|water|garden/ }, { key: 'learn', words: 'ask her how she grows things', match: /ask|learn|how|tip/ }],
  },
  {
    key: 'hill', name: 'the hill behind the houses', title: 'The hill', emoji: '⛰️', walk: 14, stay: [25, 40], hours: 'evening', at: [322, 66],
    blurb: 'The highest spot around: the whole street below, and all of the sky.',
    locked: 'He has not found the path up yet. It shows itself to someone who goes out often.',
    things: [{ key: 'sky', words: 'watch the sky from up there', match: /sky|sun|star|moon|cloud|watch|look/ }, { key: 'kite', words: 'fly my kite', match: /kite|fly/, needs: 'kite' }],
  },
];
export const placeOf = (key) => PLACES.find((p) => p.key === key) ?? OLD_PLACES.find((p) => p.key === key) ?? null;
export const isGone = (key) => OLD_PLACES.some((p) => p.key === key);
// What he does there, said about him on the page ("sketch what I see" is his own way of saying it).
export const hisWords = (place, words) => String(words ?? '').replace(/what I see/g, 'what he sees').replace(/I wonder/g, 'he wonders').replace(/\bmy\b/g, 'his').replace(/\bI\b/g, 'he').replace(/\bme\b/g, 'him');
// The place he means: its key, its name, or a word of it ("the pond", "park", "Oma Jo's garden").
export function findPlace(text) {
  const t = String(text ?? '').toLowerCase().replace(/[’']/g, '').trim();
  if (!t) return null;
  return PLACES.find((p) => p.key === t || p.name.replace(/[’']/g, '') === t) ?? PLACES.find((p) => p.key !== 'home' && (t.includes(p.key) || p.name.replace(/[’']/g, '').split(' ').some((w) => w.length > 3 && !['behind', 'houses', 'corner', 'workshop', 'notice', 'store'].includes(w) && t.includes(w)))) ?? (/park|duck/.test(t) ? placeOf('pond') : /door|street|outside my/.test(t) ? placeOf('doorstep') : /book/.test(t) ? placeOf('library') : null);
}
// Every place is open all day, every day (they used to have opening hours).
export const hoursOf = () => [0, 24];
export const dayIndexNL = (now = Date.now()) => new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getDay();
export const openNow = () => true;
export const isFrozen = (weather, now = Date.now()) => Number.isFinite(weather?.temp) && weather.temp <= 0 || /snow|ice|frost/.test(String(weather?.kind ?? ''));
export const isWet = (weather) => /rain|drizzle|shower|storm|thunder/.test(String(weather?.kind ?? ''));
export const isStorm = (weather) => /storm|thunder/.test(String(weather?.kind ?? '')) || (weather?.wind ?? 0) > 0.85;

// ---- Things he can find and bring home: [name, emoji, the months it can be found (1-12), a topic it may make him curious about]
export const FINDS = {
  pond: [['a white duck feather', '🪶', null, 'Feather'], ['a smooth grey pebble', '🪨', null, 'Pebble'], ['a pine cone', '🌰', [9, 10, 11, 12, 1, 2], 'Conifer cone'], ['an acorn with its cap', '🌰', [9, 10, 11], 'Acorn'], ['a red maple leaf', '🍁', [10, 11], 'Autumn leaf color'], ['a snail shell', '🐚', [4, 5, 6, 7, 8, 9], 'Snail'], ['a reed stalk', '🌾', [6, 7, 8, 9, 10], 'Phragmites'], ['a daisy', '🌼', [4, 5, 6, 7, 8], 'Bellis perennis'], ['a forked stick', '🪵', null, 'Dowsing']],
  doorstep: [['a blue marble someone lost', '🔵', null, 'Marble (toy)'], ['a shiny button', '🔘', null, 'Button'], ['a chestnut', '🌰', [9, 10, 11], 'Horse chestnut']],
  hill: [['a striped stone', '🪨', null, 'Sedimentary rock'], ['a tuft of sheep wool from the fence', '🐑', null, 'Wool'], ['a hawk feather', '🪶', null, 'Bird of prey']],
  garden: [['a wonky carrot', '🥕', [6, 7, 8, 9, 10, 11], 'Carrot'], ['a sunflower head full of seeds', '🌻', [8, 9, 10], 'Sunflower seed'], ['a clay flowerpot she did not need', '🪴', null, 'Terracotta']],
};

// ---- The map: a small drawing of his town with a marker where he is.
// o: { now, weather, where: place key, phase: 'going'|'there'|'back'|null, open: {key: bool}, unlocked: [keys], known: [keys he has heard of] }
const MW = 600;
const MH = 340;
export const MAP_SIZE = [MW, MH];
export function worldMapSvg(o = {}) {
  const now = o.now ?? Date.now();
  const h = hourNL(now);
  const se = seasonInfo(new Date(now));
  const night = h < se.sunrise - 0.5 || h > se.sunset + 0.75;
  const snowy = /snow/.test(String(o.weather?.kind ?? '')) || (se.frozen && (o.weather?.temp ?? 5) <= 0);
  const frozen = isFrozen(o.weather, now);
  const grass = snowy ? '#eef3f6' : se.name === 'autumn' ? '#c9c98a' : se.name === 'winter' ? '#b9c6a4' : '#a8d48f';
  const tree = se.leafOn <= 0.05 ? null : se.turn > 0.5 ? '#d98b3a' : '#5fa457';
  const unlocked = new Set(o.unlocked ?? PLACES.map((p) => p.key));
  const known = new Set([...(o.known ?? []), ...PLACES.filter((p) => p.seen).map((p) => p.key)]);
  const out = [];
  const add = (t) => out.push(t);
  const id = `wm${Math.floor(now / 60_000).toString(36)}`;
  add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MW} ${MH}" class="worldmap" role="img" aria-label="A map of Pip's world"><defs><clipPath id="${id}"><rect width="${MW}" height="${MH}" rx="18"/></clipPath></defs><g clip-path="url(#${id})"><rect width="${MW}" height="${MH}" fill="${grass}"/>`);
  // soft hills and the hill itself
  add(`<ellipse cx="320" cy="66" rx="150" ry="62" fill="${snowy ? '#ffffff' : se.name === 'autumn' ? '#b5b877' : '#93c67b'}"/><ellipse cx="60" cy="20" rx="120" ry="48" fill="#000" opacity=".04"/><ellipse cx="560" cy="330" rx="140" ry="50" fill="#000" opacity=".04"/>`);
  // paths (the street runs left to right through the middle)
  const road = '#e9dcc3';
  add(`<path d="M0 262 H${MW}" stroke="${road}" stroke-width="26" stroke-linecap="round"/><path d="M0 262 H${MW}" stroke="#fff" stroke-width="2" stroke-dasharray="12 12" opacity=".6"/>`);
  const path = (d, show = true) => add(`<path d="${d}" fill="none" stroke="${road}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="${show ? 1 : 0.35}" ${show ? '' : 'stroke-dasharray="3 12"'}/>`);
  path('M300 250 Q250 200 215 170 Q185 145 172 132'); // home to the pond
  path('M352 250 Q420 200 470 150', unlocked.has('library')); // to the library
  path('M172 120 Q230 90 300 80', unlocked.has('hill')); // from the pond up the hill
  // trees
  const tr = (x, y, s = 1) => add(`<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2.5" y="-4" width="5" height="16" fill="#7a5237"/>${tree ? `<circle cx="0" cy="-12" r="14" fill="${tree}"/><circle cx="-8" cy="-4" r="9" fill="${tree}"/><circle cx="8" cy="-5" r="10" fill="${tree}"/>` : '<path d="M0 -4 L-9 -20 M0 -4 L8 -22 M0 -8 L0 -26" stroke="#7a5237" stroke-width="2.4" stroke-linecap="round"/>'}${snowy ? '<ellipse cx="0" cy="-22" rx="10" ry="4" fill="#fff"/>' : ''}</g>`);
  for (const [x, y, s] of [[64, 96, 1.1], [100, 160, 0.9], [232, 132, 1], [40, 190, 1], [560, 80, 1.2], [530, 190, 0.9], [400, 60, 0.8], [250, 40, 0.8], [572, 300, 1], [36, 316, 1]]) tr(x, y, s);
  // the pond
  add(`<ellipse cx="150" cy="120" rx="62" ry="34" fill="${frozen ? '#dff0f8' : '#7fc4e8'}" stroke="${frozen ? '#ffffff' : '#5ba9d2'}" stroke-width="3"/>${frozen ? '<path d="M120 112 l22 8 M150 104 l18 14 M132 130 l30 -6" stroke="#fff" stroke-width="2" opacity=".9"/>' : '<path d="M120 116 q6 -5 12 0 M160 126 q6 -5 12 0" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/><g transform="translate(166 110)"><ellipse cx="0" cy="0" rx="8" ry="5" fill="#fff"/><circle cx="7" cy="-5" r="3.6" fill="#fff"/><path d="M10 -5 l5 1.4 -5 1.4z" fill="#f2a33c"/></g>'}<rect x="92" y="150" width="26" height="5" rx="2" fill="#9a6b47"/><rect x="95" y="155" width="3" height="7" fill="#7a5237"/><rect x="112" y="155" width="3" height="7" fill="#7a5237"/>`);
  // a small house shape for places with a roof
  const hut = (x, y, body, roof, w = 44, hh = 30) => `<rect x="${x - w / 2}" y="${y - hh}" width="${w}" height="${hh}" rx="3" fill="${body}"/><path d="M${x - w / 2 - 5} ${y - hh + 2} L${x} ${y - hh - 20} L${x + w / 2 + 5} ${y - hh + 2}Z" fill="${snowy ? '#fff' : roof}"/><rect x="${x - 5}" y="${y - 16}" width="10" height="16" rx="2" fill="#7a5237"/>`;
  // the street: his neighbours' houses in a row, his own in the middle
  add(`${hut(226, 252, '#f6ead6', '#9a6b47', 34, 24)}${hut(262, 252, '#d9775f', '#6b4a44', 34, 26)}${hut(344, 252, '#e9dcc6', '#7c6a5c', 36, 32)}${hut(382, 252, '#a9d3e8', '#4f7fa3', 32, 24)}`);
  add(`<g>${hut(300, 252, '#fbd98c', '#e9855b', 40, 32)}<path d="M320 222 v-22" stroke="#7a5237" stroke-width="2"/><path d="M321 200 l14 4 -14 5z" fill="#ef6f6c"/></g>`);
  // Oma Jo's garden: beds in rows
  add(`<g opacity="${unlocked.has('garden') ? 1 : 0.45}"><rect x="76" y="232" width="74" height="46" rx="6" fill="${snowy ? '#f7fbff' : '#8a6a48'}"/>${[0, 1, 2].map((i) => `<path d="M84 ${243 + i * 12} h58" stroke="${snowy ? '#dfe8ee' : '#5f9e63'}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>`).join('')}<rect x="150" y="238" width="22" height="20" rx="2" fill="#b98a5a"/><path d="M147 240 l14 -11 14 11z" fill="${snowy ? '#fff' : '#7a5237'}"/></g>`);
  // the grocery store and the library
  add(`<g>${hut(452, 252, '#58a59a', '#3d7d74', 48, 30)}<rect x="436" y="230" width="32" height="7" rx="2" fill="#fff8ee"/></g>`);
  add(`<g opacity="${unlocked.has('library') ? 1 : 0.45}"><rect x="446" y="92" width="64" height="44" rx="3" fill="#e7d3b5"/><path d="M440 94 L478 68 L516 94Z" fill="${snowy ? '#fff' : '#8a5a3a'}"/>${[456, 470, 484, 498].map((x) => `<rect x="${x}" y="100" width="6" height="36" fill="#fff8ee"/>`).join('')}<rect x="472" y="118" width="12" height="18" rx="2" fill="#7a5237"/></g>`);
  // a bench on the hill
  add(`<g opacity="${unlocked.has('hill') ? 1 : 0.45}"><rect x="308" y="52" width="28" height="5" rx="2" fill="#9a6b47"/><rect x="311" y="57" width="3" height="8" fill="#7a5237"/><rect x="330" y="57" width="3" height="8" fill="#7a5237"/><path d="M350 62 v-26" stroke="#7a5237" stroke-width="2"/><path d="M351 36 l12 4 -12 4z" fill="#f2c14e"/></g>`);
  // names, and a lock or a question mark on what he cannot go to yet
  for (const p of PLACES) {
    if (p.key === 'doorstep') continue;
    const [x, y] = p.at;
    const can = unlocked.has(p.key);
    const heard = can || known.has(p.key);
    const here = o.where === p.key && o.phase !== 'going' && o.phase !== 'back';
    const ly = p.key === 'home' ? y + 26 : p.key === 'shop' || p.key === 'garden' ? y + 34 : p.key === 'hill' ? y - 44 : y + 48;
    const closed = can && !here && p.key !== 'home' && o.open && o.open[p.key] === false;
    const words = `${can ? '' : heard ? '🔒 ' : ''}${heard ? p.title : '?'}`; // short and big, so it can be read on a phone
    const wide = Math.max(30, words.length * 8.9 + 20); // the little sign is as wide as its words
    add(`<g data-place="${p.key}" class="wplace${can ? '' : ' locked'}"><title>${p.title}</title><circle cx="${x}" cy="${y - 4}" r="38" fill="#fff" opacity="${here ? 0.35 : 0}"/><rect x="${x - wide / 2}" y="${ly - 17}" width="${wide}" height="24" rx="12" fill="${here ? '#e9855b' : '#fffaf3'}" opacity="${can ? (closed ? 0.8 : 0.96) : 0.7}"/><text x="${x}" y="${ly}" font-size="16" font-weight="700" text-anchor="middle" fill="${here ? '#fff' : can ? '#4a3d35' : '#8a7d73'}" font-family="system-ui,sans-serif">${words}</text></g>`);
  }
  // where Pip is: at a place, or on the way (a third of the way out, or two thirds of the way back)
  const home = placeOf('home').at;
  const target = placeOf(o.where ?? 'home')?.at ?? home;
  const f = o.phase === 'going' ? 0.45 : o.phase === 'back' ? 0.5 : 1;
  const px = o.where && o.where !== 'home' ? home[0] + (target[0] - home[0]) * f : home[0];
  const py = o.where && o.where !== 'home' ? home[1] + (target[1] - home[1]) * f - (f === 1 ? 6 : 0) : home[1] - 44;
  add(`<g class="wpip" transform="translate(${Math.round(px)} ${Math.round(py)})"><path d="M0 22 l-8 -12 h16z" fill="#fffaf3"/><circle cx="0" cy="0" r="17" fill="#fffaf3" stroke="#e9855b" stroke-width="3"/><g transform="translate(-13.5 -14.5) scale(.42)">${faceInner('Pip')}</g>${o.phase === 'going' || o.phase === 'back' ? `<text x="20" y="5" font-size="15">${o.phase === 'back' ? '🏠' : '👣'}</text>` : ''}</g>`);
  if (night) add(`<rect width="${MW}" height="${MH}" fill="#141a33" opacity=".38" pointer-events="none"/><circle cx="560" cy="34" r="12" fill="#f6f2dc" opacity=".9"/>`);
  add('</g></svg>');
  return out.join('');
}

// ---- A postcard from an outing: a little picture of the place as it was, with his line. c: { place, at, weather, did, found: [{emoji}], met }
export function postcardSvg(c = {}) {
  const p = placeOf(c.place) ?? placeOf('pond');
  const at = Date.parse(c.at) || Date.now();
  const h = hourNL(at);
  const se = seasonInfo(new Date(at));
  const kind = String(c.weather?.kind ?? 'clear');
  const dusk = h > se.sunset - 1.2 || h < se.sunrise + 1;
  const dark = h > se.sunset + 0.6;
  const grey = /cloud|rain|drizzle|snow|fog|storm/.test(kind);
  const snowy = /snow/.test(kind) || (se.frozen && (c.weather?.temp ?? 5) <= 0);
  const sky = dark ? ['#1b2347', '#3a4585'] : dusk ? ['#f2a184', '#fbdcb4'] : grey ? ['#b4c1cc', '#e3eaee'] : ['#9bd3f2', '#e8f6fc'];
  const leaf = se.leafOn <= 0.05 ? null : se.turn > 0.5 ? '#d98b3a' : '#5fa457';
  const ground = snowy ? '#f1f6f9' : se.name === 'autumn' ? '#c2bf7c' : '#9ccf86';
  const id = `pc${Math.floor(at / 1000).toString(36)}${p.key}`;
  const tree = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="-6" width="6" height="26" fill="#7a5237"/>${leaf ? `<circle cx="0" cy="-22" r="22" fill="${leaf}"/><circle cx="-14" cy="-10" r="14" fill="${leaf}"/><circle cx="14" cy="-12" r="15" fill="${leaf}"/>` : '<path d="M0 -6 L-14 -30 M0 -6 L12 -34 M0 -12 L0 -40" stroke="#7a5237" stroke-width="3" stroke-linecap="round"/>'}</g>`;
  const pip = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="18" rx="15" ry="4" fill="#000" opacity=".15"/><g transform="translate(-20 -22) scale(.62)">${faceInner('Pip')}</g></g>`;
  let scene = '';
  if (p.key === 'pond') scene = `${tree(52, 108, 1.1)}${tree(262, 96, 0.8)}<ellipse cx="170" cy="128" rx="112" ry="34" fill="${isFrozen(c.weather, at) ? '#e1f1f8' : dark ? '#33508a' : '#7fc4e8'}" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>${isFrozen(c.weather, at) ? '<path d="M120 122 l40 10 M180 112 l30 18" stroke="#fff" stroke-width="2.5"/>' : '<g transform="translate(206 122)"><ellipse cx="0" cy="0" rx="13" ry="8" fill="#fff"/><circle cx="11" cy="-9" r="6" fill="#fff"/><path d="M16 -9 l8 2 -8 2z" fill="#f2a33c"/></g><g transform="translate(150 136) scale(.7)"><ellipse cx="0" cy="0" rx="13" ry="8" fill="#e8d9b8"/><circle cx="11" cy="-9" r="6" fill="#3d7d5a"/><path d="M16 -9 l8 2 -8 2z" fill="#f2a33c"/></g>'}${pip(92, 148)}`;
  else if (p.key === 'hill') scene = `<ellipse cx="160" cy="210" rx="230" ry="110" fill="${ground}"/><rect x="170" y="100" width="54" height="8" rx="3" fill="#9a6b47"/><rect x="176" y="108" width="5" height="14" fill="#7a5237"/><rect x="213" y="108" width="5" height="14" fill="#7a5237"/>${[[40, 150, 14], [74, 156, 11], [110, 158, 12]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="10" fill="#f6ead6"/><path d="M${x - 2} ${y} l${w / 2 + 2} -8 ${w / 2 + 2} 8z" fill="#c9573c"/>`).join('')}${pip(150, 96)}`;
  else if (p.key === 'garden') scene = `<rect x="0" y="118" width="320" height="62" fill="${snowy ? '#f7fbff' : '#8a6a48'}"/>${[0, 1, 2].map((i) => `<path d="M18 ${132 + i * 16} h284" stroke="${snowy ? '#dfe8ee' : '#5f9e63'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="3 18"/>`).join('')}<rect x="226" y="62" width="62" height="56" fill="#b98a5a"/><path d="M218 66 l39 -28 39 28z" fill="${snowy ? '#fff' : '#7a5237'}"/><g transform="translate(150 112)"><circle cx="0" cy="-34" r="15" fill="#f6c544"/><circle cx="0" cy="-34" r="7" fill="#7a5237"/><rect x="-2" y="-22" width="4" height="26" fill="#4f8a45"/></g><g transform="translate(60 84) scale(.6)">${faceInner('Oma Jo')}</g>${pip(118, 128)}`;
  else if (p.key === 'library') scene = `<rect x="70" y="52" width="180" height="92" fill="#e7d3b5"/><path d="M58 56 L160 12 L262 56Z" fill="${snowy ? '#fff' : '#8a5a3a'}"/>${[92, 124, 188, 220].map((x) => `<rect x="${x}" y="64" width="12" height="80" fill="#fff8ee"/>`).join('')}<rect x="146" y="98" width="28" height="46" rx="3" fill="#7a5237"/><text x="160" y="46" font-size="13" font-weight="800" text-anchor="middle" fill="#fff8ee" font-family="system-ui,sans-serif">LIBRARY</text>${pip(204, 148)}`;
  else if (p.key === 'shop') scene = `<rect x="76" y="56" width="170" height="90" fill="#58a59a"/><rect x="68" y="48" width="186" height="12" rx="3" fill="${snowy ? '#fff' : '#3d7d74'}"/><rect x="92" y="78" width="74" height="48" rx="4" fill="#eaf6f4" stroke="#fff8ee" stroke-width="4"/><circle cx="112" cy="110" r="8" fill="#ef6f6c"/><circle cx="134" cy="110" r="8" fill="#f6c544"/><rect x="186" y="82" width="34" height="64" rx="4" fill="#2f5e57"/>${pip(150, 152)}`;
  else if (p.key === 'workshop') scene = `<rect x="70" y="50" width="190" height="96" fill="#9aa3a8"/>${Array.from({ length: 12 }, (_, i) => `<path d="M${78 + i * 15} 50 v96" stroke="#7d868b" stroke-width="3"/>`).join('')}<rect x="62" y="42" width="206" height="12" rx="2" fill="${snowy ? '#fff' : '#5c6468'}"/><rect x="84" y="92" width="30" height="54" fill="#c9773c"/><rect x="130" y="84" width="116" height="62" fill="#b9c0c4"/>${[0, 1, 2, 3, 4].map((i) => `<path d="M130 ${94 + i * 11} h116" stroke="#8d9599" stroke-width="2"/>`).join('')}<rect x="120" y="58" width="130" height="18" rx="3" fill="#2a2a2e"/><text x="185" y="71" font-size="11" font-weight="800" text-anchor="middle" fill="#f2c14e" font-family="system-ui,sans-serif">PRINT WORKSHOP</text>`;
  else if (p.key === 'walls') scene = `<rect x="40" y="52" width="240" height="94" fill="#aaa69f"/>${[100, 160, 220].map((x) => `<path d="M${x} 52 v94" stroke="#8d8880" stroke-width="2"/>`).join('')}<circle cx="104" cy="98" r="30" fill="#e9855b"/><path d="M150 132 L186 62 L222 132Z" fill="#58a59a"/><rect x="214" y="78" width="44" height="44" rx="8" fill="#f2c14e"/><circle cx="96" cy="92" r="5" fill="#fff"/><circle cx="114" cy="92" r="5" fill="#fff"/><path d="M92 108 q12 10 24 0" fill="none" stroke="#3b2f2a" stroke-width="3" stroke-linecap="round"/>`;
  else scene = `<rect x="110" y="52" width="110" height="94" fill="#fbd98c"/><path d="M100 56 L165 10 L230 56Z" fill="${snowy ? '#fff' : '#e9855b'}"/><rect x="176" y="92" width="30" height="54" rx="4" fill="#c9573c"/><rect x="100" y="146" width="130" height="8" fill="#d8cdbf"/>${tree(40, 120, 1)}${pip(150, 146)}`;
  const extras = [dark ? '<circle cx="270" cy="34" r="14" fill="#f6f2dc"/>' : `<circle cx="${dusk ? 262 : 52}" cy="${dusk ? 62 : 36}" r="17" fill="${dusk ? '#ffb35c' : '#ffe27a'}" opacity="${grey ? 0.5 : 1}"/>`];
  if (/rain|drizzle|storm/.test(kind)) for (let i = 0; i < 26; i++) extras.push(`<path d="M${(i * 53 + 11) % 320} ${(i * 37 + 5) % 150} l-4 12" stroke="#fff" stroke-width="1.8" opacity=".7" stroke-linecap="round"/>`);
  if (/snow/.test(kind)) for (let i = 0; i < 30; i++) extras.push(`<circle cx="${(i * 53 + 11) % 320}" cy="${(i * 37 + 5) % 160}" r="${2 + (i % 3) * 0.6}" fill="#fff"/>`);
  if (dark && !grey) for (let i = 0; i < 18; i++) extras.push(`<circle cx="${(i * 71 + 9) % 320}" cy="${(i * 29 + 7) % 70}" r="1.3" fill="#fff" opacity=".8"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" class="postcard" role="img" aria-label="A postcard from ${p.title}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="320" height="180" fill="url(#${id})"/>${extras[0]}<rect x="0" y="118" width="320" height="62" fill="${ground}"/>${scene}${extras.slice(1).join('')}${(c.found ?? []).slice(0, 2).map((f, i) => `<text x="${286 - i * 26}" y="168" font-size="20" text-anchor="middle">${f.emoji ?? '✨'}</text>`).join('')}${dark ? '<rect width="320" height="180" fill="#141a33" opacity=".15"/>' : ''}</svg>`;
}
