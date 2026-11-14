// Habits: loops he can fall into (the same walks, the same tune, the same search) so he can notice them and the game does not pay for them twice.
const wordsOf = (t) => new Set(String(t ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
const jaccard = (a, b) => {
  const A = wordsOf(a);
  const B = wordsOf(b);
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i);
};
const DAY = 86_400_000;
const ago = (iso, now) => { const h = (now - Date.parse(iso)) / 3_600_000; return h < 1 ? 'a little while ago' : h < 24 ? `${Math.round(h)} hours ago` : `${Math.round(h / 24)} days ago`; };

// A place in his room, from what he says: the same words the page uses to walk him there.
const PLACES = [['the greenhouse', /greenhouse|garden|seedling|sprout|rosemary|herb/], ['the piano', /piano|keys|music/], ['the bookshelf', /book|shelf/], ['his desk', /computer|desk|screen|laptop/], ['the window', /window|sky|star|outside/], ['his bed', /\bbed\b|pillow/], ['the plant', /plant|flower|leaf/]];
export const placeOfText = (t) => { const s = String(t ?? '').toLowerCase(); return PLACES.find(([, re]) => re.test(s))?.[0] ?? (s.trim() ? s.trim().slice(0, 30) : null); };
// Where an action takes him by itself (so a walk there first is redundant).
export function placeOfAction(action, d = {}) {
  switch (action) {
    case 'play_piano': return 'the piano';
    case 'read_book': return 'the bookshelf';
    case 'search_web': case 'make_app': case 'update_app': case 'blueprint': return 'his desk';
    case 'rest': return 'his bed';
    case 'record_song': return 'the studio';
    case 'plant': case 'water': case 'harvest': return 'the greenhouse';
    case 'use': return placeOfText(d.name);
    case 'walk_to': return placeOfText(d.object);
    default: return null;
  }
}

// "walk to the piano" right before "play the piano" (or any action that already walks there) is wasted: drop the walk.
export function redundantWalks(steps) {
  const out = [];
  steps.forEach((st, i) => {
    if (st.action === 'walk_to') {
      const here = placeOfAction('walk_to', st.details);
      const next = steps[i + 1];
      if (here && next && next.action !== 'walk_to' && placeOfAction(next.action, next.details) === here) return;
      const prev = out.at(-1);
      if (here && prev?.action === 'walk_to' && placeOfAction('walk_to', prev.details) === here) return; // the same walk twice
    }
    out.push(st);
  });
  return out.length ? out : steps;
}

// Where he was in the last steps (not counting the walks), most visited first.
const visits = (log, n) => {
  const counts = new Map();
  let walks = 0;
  const recent = log.slice(-n);
  for (const e of recent) {
    if (e.action === 'walk_to') { walks++; continue; }
    const p = placeOfAction(e.action, { name: e.name, object: e.object });
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return { counts: [...counts.entries()].sort((a, b) => b[1] - a[1]), walks, total: recent.length };
};

// A picture of his routine, never an order.
export function habitMirror(log, now = Date.now()) {
  const l = (Array.isArray(log) ? log : []).filter((e) => Date.parse(e.at) <= now);
  if (l.length < 12) return '';
  const { counts, walks, total } = visits(l, 30);
  const top = counts.filter(([, n]) => n >= 4).slice(0, 4);
  if (!top.length && walks < total * 0.3) return '';
  const parts = [];
  if (top.length) parts.push(`I was at ${top.map(([p, n]) => `${p} ${n} times`).join(', ')}`);
  if (walks >= total * 0.3) parts.push(`${walks} of my steps were only walking`);
  return `In my last ${total} steps: ${parts.join('; ')}. A calm routine is fine. It is only a picture, and there is much in my room I have not touched in a while.`;
}

// The current step counts as repeating when the same thing at the same place was already done 3 times in his last 8 steps.
export function loopRepeating(log, action, d = {}) {
  if (action === 'walk_to' || action === 'rest') return false;
  const p = placeOfAction(action, d);
  if (!p) return false;
  const recent = (Array.isArray(log) ? log : []).filter((e) => e.action !== 'walk_to').slice(-8);
  return recent.filter((e) => e.action === action && placeOfAction(e.action, { name: e.name, object: e.object }) === p).length >= 3;
}

// The same tune again: the same notes (or nearly) as one he played in the last day. Returns how many times, or 0.
const tune = (n) => String(n ?? '').toUpperCase().split(/[^A-G0-9#]+/).filter(Boolean);
export function sameTune(log, notes, now = Date.now()) {
  const mine = tune(notes);
  if (mine.length < 3) return 0;
  return (Array.isArray(log) ? log : []).filter((e) => e.action === 'play_piano' && now - Date.parse(e.at) < DAY && Date.parse(e.at) <= now).filter((e) => {
    const t = tune(e.notes);
    if (t.length < 3) return false;
    if (t.join(' ') === mine.join(' ')) return true;
    const a = new Set(t);
    const b = new Set(mine);
    const inter = [...a].filter((x) => b.has(x)).length;
    return Math.abs(t.length - mine.length) <= 1 && inter / (a.size + b.size - inter) >= 0.85 && t[0] === mine[0] && t.at(-1) === mine.at(-1);
  }).length;
}

// An almost identical search in the last 3 days: returns that earlier entry, so he is reminded instead of searching again.
export function duplicateSearch(log, query, now = Date.now()) {
  return (Array.isArray(log) ? log : []).filter((e) => e.action === 'search_web' && e.query && now - Date.parse(e.at) < 3 * DAY && Date.parse(e.at) <= now).reverse().find((e) => jaccard(e.query, query) >= 0.75) ?? null;
}
export { ago as agoText };
