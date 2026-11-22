// A letter from Pip, every Sunday evening: his week in his own words, to Bas. What he made and learned, who wrote to him,
// what he is proud of and what he wants to do next week, with his favourite drawing of the week. One big-model call a week.
// The first one came on his first birthday week: he started fresh on 15 November 2026.
const DAY = 86_400_000;
const clip = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const ams = (now, o) => new Date(now).toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', ...o });
export const weekOf = (now = Date.now()) => { const d = new Date(new Date(now).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); }; // the Monday
export const letterDue = (s, now = Date.now()) => ams(now, { weekday: 'long' }) === 'Sunday' && Number(ams(now, { hour: '2-digit', hour12: false })) >= 19 && s.letterWeek !== weekOf(now) && !s.last?.sleeping;

// His week, in facts (no model): what the letter is written from.
export function weekDigest(s, now = Date.now()) {
  const since = now - 7 * DAY;
  const inWeek = (iso) => iso && Date.parse(iso) > since && Date.parse(iso) <= now;
  const art = (s.art ?? []).filter((a) => inWeek(a.createdAt));
  const made = (s.decor ?? []).filter((d) => !d.image && inWeek(d.createdAt)).map((d) => d.name);
  const apps = (s.apps ?? []).filter((a) => inWeek(a.createdAt) || inWeek(a.updatedAt)).map((a) => `${a.name}${a.v ? ` (version ${a.v})` : ''}`);
  const songs = (s.studio?.songs ?? []).filter((x) => inWeek(x.createdAt)).map((x) => x.name);
  const done = (s.projects ?? []).filter((p) => p.status === 'done' && inWeek(p.doneAt)).map((p) => p.title);
  const working = (s.projects ?? []).filter((p) => p.status === 'working').map((p) => p.title);
  const learned = (s.notebook ?? []).filter((n) => inWeek(n.at)).map((n) => n.topic ?? n.query ?? n.title).filter(Boolean);
  const lessons = (s.lessons ?? []).filter((l) => inWeek(l.solvedAt)).length;
  const into = (s.curious?.interests ?? []).slice(0, 4).map((i) => i.topic);
  const neighbours = (s.visitors ?? []).filter((v) => v.npc && inWeek(v.at)).map((v) => `${v.name.replace(' (neighbour)', '')}: "${clip(v.text, 90)}"`).slice(-4);
  const gifts = (s.asks ?? []).filter((a) => a.status === 'done' && inWeek(a.doneAt)).map((a) => a.item);
  const memories = (s.memories ?? []).filter((m) => inWeek(m.at) && (m.importance ?? 0) >= 7).sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0)).slice(0, 8).map((m) => clip(m.text, 140));
  const days = (s.days ?? []).filter((d) => d.day && Date.parse(d.day) > since - DAY).map((d) => `${d.day}: mostly ${(d.most ?? []).slice(0, 2).join(', ')}, mood ${d.mood}`);
  return { art, made, apps, songs, done, working, learned: [...new Set(learned)].slice(0, 6), lessons, into, neighbours, gifts, memories, days };
}

export function letterPrompt(soul, d, { first = false } = {}) {
  const list = (a, none = 'none') => (a.length ? a.join('; ') : none);
  return `${soul}

IT IS SUNDAY EVENING. I WRITE MY WEEKLY LETTER TO BAS.
${first ? 'This is my very first weekly letter: one week ago today I started fresh in my little room.\n' : ''}
MY WEEK, IN FACTS
- Days: ${list(d.days)}
- Drawings (${d.art.length}): ${list(d.art.map((a) => a.name).slice(-8))}
- Things I made for my room: ${list(d.made)}
- Programs and games: ${list(d.apps)}
- Songs: ${list(d.songs)}
- Projects I finished: ${list(d.done)}; still working on: ${list(d.working)}
- What I looked up and learned about: ${list(d.learned)}
- Things that went wrong and that I learned to do better: ${d.lessons}
- What I am into lately: ${list(d.into)}
- Notes from my neighbours: ${list(d.neighbours)}
- What Bas gave me: ${list(d.gifts)}
- What I remember most: ${list(d.memories)}

I write a warm, honest letter to Bas, like a real letter from a small friend: 8 to 14 short sentences, plain words, my own voice. Not a list. I pick the two or three moments that mattered most, say one thing that was hard or went wrong and what I learned, say what I am proud of, and what I want to try next week. I end with my name and one short P.S. I also choose my favourite drawing of the week (its exact name from the list, or null).
Answer in JSON: {"letter": "Dear Bas, ...", "favourite": "the drawing's exact name or null"}`;
}
export const letterSchema = { type: 'OBJECT', properties: { letter: { type: 'STRING' }, favourite: { type: 'STRING', nullable: true } }, required: ['letter'] };
export const fakeLetter = (d) => ({ letter: `Dear Bas,\n\nThis week I made ${d.art.length} drawings and ${d.made.length} things for my room. (fake)\n\nLove,\nPip\n\nP.S. The neighbours are nice.`, favourite: d.art.at(-1)?.name ?? null });

// The letter into his outbox (private, like everything he tells Bas), with the drawing he chose.
export function sendLetter(s, reply, d, now = Date.now()) {
  const text = clip(reply?.letter, 2400).replace(/\s*\n\s*/g, '\n');
  if (text.length < 40) return null;
  const fav = d.art.find((a) => a.name.toLowerCase() === String(reply?.favourite ?? '').toLowerCase().trim()) ?? d.art.at(-1) ?? null;
  const msg = { id: `L${now.toString(36)}`, at: new Date(now).toISOString(), kind: 'letter', text, private: true, ...(fav ? { image: fav.file, imageName: fav.name } : {}) };
  s.outbox = [...(s.outbox ?? []), msg].slice(-50);
  s.letterWeek = weekOf(now);
  s.letters = [...(s.letters ?? []), { id: msg.id, at: msg.at, week: s.letterWeek, favourite: fav?.name ?? null }].slice(-60);
  return msg;
}
