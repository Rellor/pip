// Who Pip is, in his own words: a note about himself, his favorites, his rituals and his dreams.
// He writes all of it himself. The code only keeps it, limits the size, and shows it back to him.

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const same = (a, b) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
const list = (v, max) => (Array.isArray(v) ? v : []).map((x) => text(x, 160)).filter(Boolean).slice(0, max);

export function ensureIdentity(s) {
  s.self ??= '';
  s.favorites ??= [];
  s.dreams ??= [];
  s.rituals ??= [];
  s.wokeFromSleep ??= false;
}

// The part of his prompt about himself. ago and bullets come from pip.js.
export function identityText(s, ago, bullets) {
  const dreams = s.dreams.slice(-2);
  const dreamBlock = dreams.length ? `\nMY LAST DREAMS\n${dreams.map((d) => `(${ago(d.at)}) ${d.text}`).join('\n')}\n` : '';
  const wokeBlock = s.wokeFromSleep
    ? '\nI just woke up after sleeping. In my sleep I dreamed, and I remember it a little: I can write it down in "dream", 2 to 4 strange, dreamlike sentences made from my day, my feelings and my wants (dreams do not make sense, and that is good). Or I leave it null.\n'
    : '';
  return `WHO I AM (my own note about myself; I rewrite it with self_update whenever I feel I have changed)
${s.self || 'I have not written about myself yet. I can, when I know something true about who I am.'}

MY FAVORITES (things I love; I add or drop them with favorites_add and favorites_remove)
${bullets(s.favorites.map((f) => `${f.kind ? `${f.kind}: ` : ''}${f.what}`), 'none yet. When I notice I love something, I can write it down.')}

MY RITUALS (things I do on a regular day. I can keep, change or drop them with rituals_add and rituals_drop)
${bullets(s.rituals.map((r) => `${r.text}${r.when ? ` (${r.when})` : ''}`), 'none. I can choose one if I want a habit.')}
${dreamBlock}${wokeBlock}
`;
}

// The JSON fields he can answer with.
export const IDENTITY_FIELDS = `"self_update": my note about who I am, 1 to 3 sentences, only when I feel I have really changed or learned something true about myself. Or null,
"favorites_add": up to 2 things I truly love, each {"kind": "song, color, food, place, animal, anything", "what": "short"}. Or [],
"favorites_remove": exact text of favorites I do not love any more (or []),
"rituals_add": at most 1 thing I decide to do regularly, {"text": "short, like look at the stars every evening", "when": "morning, evening, when I wake up, anytime"}. Or [],
"rituals_drop": exact text of rituals I stop (or []),
"dream": the dream I had in my sleep, only when I was just woken (see above), or null,
`;

export function applyIdentity(s, r, at) {
  ensureIdentity(s);
  const self = text(r.self_update, 500);
  if (self && self !== s.self) {
    s.self = self;
    s.selfAt = at;
  }
  for (const f of Array.isArray(r.favorites_add) ? r.favorites_add.slice(0, 2) : []) {
    const what = text(f?.what, 80);
    if (what && !s.favorites.some((x) => x.what.toLowerCase() === what.toLowerCase())) s.favorites.push({ kind: text(f?.kind, 30), what, since: at });
  }
  for (const t of list(r.favorites_remove, 3)) s.favorites = s.favorites.filter((f) => !same(f.what, t));
  while (s.favorites.length > 14) s.favorites.shift();
  for (const t of list(r.rituals_drop, 3)) s.rituals = s.rituals.filter((x) => !same(x.text, t));
  const ritual = Array.isArray(r.rituals_add) ? r.rituals_add[0] : null;
  const ritualText = text(ritual?.text, 120);
  if (ritualText && !s.rituals.some((x) => same(x.text, ritualText)) && s.rituals.length < 5) s.rituals.push({ text: ritualText, when: text(ritual?.when, 40), since: at });
  const dream = text(r.dream, 600);
  if (dream && s.wokeFromSleep) s.dreams = [...s.dreams, { at, text: dream }].slice(-30);
  s.wokeFromSleep = false; // asked once per night
}
