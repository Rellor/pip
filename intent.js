// His own plan for each day: three or four small things he wants to do today, picked from what is true in his life (his project, a thing to learn,
// something to look after, music, an old thing to go back to, a place to explore). The game ticks them off when a step really did one.
// It is a plan he can ignore, never an order. Ticking one off gives a small lift, a few times a day at most, so it cannot be farmed.
const MAKE = ['decorate', 'extend_thing', 'change_thing', 'draw', 'make_app', 'update_app', 'make_clothes', 'make_move', 'blueprint'];
const MATCH = {
  make: (e, s, i) => (i.big ? (s.projects ?? []).some((p) => Date.parse(p.since ?? 0) >= Date.parse(`${s.intent.day}T00:00:00Z`)) : MAKE.includes(e.action)),
  learn: (e) => ['search_web', 'read_book'].includes(e.action),
  tend: (e) => ['water', 'plant', 'harvest', 'cook'].includes(e.action),
  music: (e) => ['play_piano', 'record_song', 'compose'].includes(e.action),
  revisit: (e) => ['use', 'add_use', 'change_thing', 'place_picture', 'take_out', 'move_thing', 'extend_thing'].includes(e.action),
  explore: (e) => (e.action === 'walk_to' && /hall|studio|door|window|mixing|drum|keyboard/i.test(String(e.object ?? ''))) || e.action === 'take_photo' || e.action === 'check_light',
};
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
const hash = (t) => [...String(t)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

function candidates(s, now) {
  const c = {};
  const proj = (s.projects ?? []).find((p) => p.status === 'working' && p.next);
  c.make = proj ? `go on with my project "${proj.title}": ${proj.next}` : 'start something bigger than a small thing: a project with steps (projects_add)';
  const ints = s.interests ?? [];
  c.learn = `find something out about ${ints.length ? ints[(hash(dayOf(now)) % ints.length)] : 'how music is made'} (or how music works)`;
  c.tend = 'look after my plants, my pantry or my kitchen';
  const owned = (s.tools ?? []).map((t) => t.kind);
  const fresh = ['guitar', 'violin', 'flute', 'clarinet', 'kalimba', 'harp'].find((i) => owned.includes(i));
  c.music = fresh ? `make music a new way: a recording in the studio, or the ${fresh} in a new tune` : 'make music a new way: a recording in the studio';
  const old = (s.decor ?? []).filter((d) => !d.image && d.pos && now - Date.parse(d.usedAt || d.createdAt) > 36 * 3_600_000).sort(() => 0);
  const pick = old.length ? old[hash(dayOf(now)) % old.length] : null;
  c.revisit = pick ? `go back to my "${pick.name}": use it, change it, give it a new use or a better place` : 'go back to something I made earlier';
  c.explore = 'go somewhere in my house I have not been today, or look at something through a window';
  return c;
}

export function ensureIntentions(s, now = Date.now()) {
  s.intent ??= { day: null, streak: 0, items: [] };
  const d = dayOf(now);
  if (s.intent.day === d) return false;
  const prev = s.intent;
  const kept = prev.items.length > 0 && prev.items.every((i) => i.done);
  const c = candidates(s, now);
  const h = hash(d);
  const second = ['music', 'tend'][h % 2];
  const third = ['revisit', 'explore'][(h >> 1) % 2];
  const cats = ['make', 'learn', second, third];
  s.intent = { day: d, streak: prev.day && kept ? (prev.streak || 0) + 1 : 0, items: cats.map((cat) => ({ cat, text: c[cat], done: false, ...(cat === 'make' && !(s.projects ?? []).some((p) => p.status === 'working' && p.next) ? { big: true } : {}) })) };
  return true;
}

// Ticks off what the new log entries did. Returns the intentions that just got done.
export function markIntentions(s, entries) {
  const out = [];
  for (const e of entries) {
    if (e.failed || e.fallback) continue;
    for (const i of s.intent?.items ?? []) if (!i.done && MATCH[i.cat]?.(e, s, i)) { i.done = true; out.push(i); }
  }
  return out;
}

export function intentionsText(s) {
  const it = s.intent?.items ?? [];
  if (!it.length) return '';
  return `TODAY I WANT TO (my own plan for today. I can change it, ignore it or do it in any order)\n${it.map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}`).join('\n')}${s.intent.streak ? `\nI kept all my plans ${s.intent.streak} day${s.intent.streak === 1 ? '' : 's'} in a row.` : ''}`;
}
