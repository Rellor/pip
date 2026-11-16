// Pip's check-up: plain code (no model) that looks at how he spends his days and spots signs that something is off.
// It runs at the end of every wake-up. New problems go to Bas's phone (at most once a day each); the list is shown in Settings.
// Each problem has: text (what is wrong, plain words), look (where the cause usually is) and debug (the raw facts, to paste
// to whoever fixes it).
const HOUR = 3_600_000;
export const PUSH = ['failing', 'project', 'models', 'needs'];
export const PUSH_GAP_H = 3; // at most one check-up message every 3 hours (new problems wait and come together)
// After a message went out: these problems count as sent today.
export function markSent(saved, items, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  for (const x of items) saved.sent[x.id] = day;
  saved.pushedAt = new Date(now).toISOString();
}
const DAY = 24 * HOUR;
const MOVE_WORDS = { record_song: 'recording a song', change_thing: 'changing something he made', move_thing: 'moving something', decorate: 'making something', draw: 'drawing', make_app: 'making a program', make_clothes: 'sewing', plant: 'planting', cook: 'cooking', eat: 'eating', search_web: 'looking things up', read_book: 'reading', extend_thing: 'adding to something he made', place_picture: 'hanging a picture', use: 'using something' };
// Words that show up in any thought, so they do not count as "the same topic".
const COMMON = new Set('that this with have want just then from what will some them they need make made making about would could should still more next step steps project projects little small really little first last again before after work working keep going feel feels like into over time today here there when your mine very also been being because finished finish start started trying tried test testing done good back sure right nice well'.split(' '));

// A failure reason without the code examples that are only meant for Pip.
const plainReason = (t) => String(t ?? '').replace(/[:\s]*[\[{][\s\S]*$/, '').replace(/\s+/g, ' ').trim().slice(0, 160) || 'it did not work';
export const words = (t) => [...new Set(String(t ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4 && !COMMON.has(w)))];

export function checkup(s, health = {}, now = Date.now()) {
  const out = [];
  const add = (id, ok, label, text, more = {}) => out.push({ id, ok, label, text, ...(ok ? {} : more) });
  const at = (iso) => (iso ? new Date(iso).toISOString().slice(11, 16) + ' UTC' : '?');

  // 1. Going in circles: most of his recent thoughts share one word.
  // (He is "going in circles" when one word fills most of them, like "gears" for hours.)
  const thoughts = (s.thoughts ?? []).filter((t) => !t.private && !t.sealed && now - Date.parse(t.at) < 8 * HOUR).slice(-20);
  let circle = null;
  if (thoughts.length >= 10) {
    const count = {};
    for (const t of thoughts) for (const w of words(t.text)) count[w] = (count[w] ?? 0) + 1;
    const top = Object.entries(count).filter(([, n]) => n >= Math.max(8, thoughts.length * 0.6)).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length) circle = { w: top.map(([w]) => `"${w}"`).join(', '), n: top[0][1] };
  }
  add('circling', !circle, 'Thoughts', circle ? `He may be going in circles: ${circle.n} of his last ${thoughts.length} thoughts are about ${circle.w}.` : 'His thoughts move between different things.', {
    look: 'Usually something he keeps trying does not work (see Moves), or a project has no next step (see Projects). Check what he does in the Day tab.',
    debug: `top words: ${circle?.w}\nlast thoughts:\n${thoughts.slice(-4).map((t) => `- ${at(t.at)} [${t.action ?? '?'}] ${String(t.text).slice(0, 140)}`).join('\n')}`,
  });

  // 2. A project that does not move: open for hours, but nothing made for it and no step done.
  const stuck = (s.projects ?? []).filter((p) => p.status === 'working' && now - Date.parse(p.since ?? now) > 6 * HOUR && !(p.versions ?? []).length && !(p.steps ?? []).some((x) => x.done));
  const sp = stuck[0];
  add('project', !stuck.length, 'Projects', stuck.length ? `"${sp.title}" has been open for ${Math.round((now - Date.parse(sp.since)) / HOUR)} hours, but nothing made for it counted yet and no step is done.` : 'Every open project has made some progress (or is new).', {
    look: !(sp?.steps ?? []).length ? 'The project has no steps, so he has no next step. He should get a "plan my project" move.' : 'Things he makes may not be linked to the project (a version needs the project name in the move), or his makes fail.',
    debug: sp ? `project: ${JSON.stringify({ title: sp.title, since: sp.since, updatedAt: sp.updatedAt, steps: (sp.steps ?? []).map((x) => `${x.done ? '✓' : '○'} ${x.text}`), versions: (sp.versions ?? []).length, notes: (sp.notes ?? []).length, needs: sp.needs ?? [] })}\nmoves today: ${JSON.stringify(s.today?.done ?? {})}` : '',
  });

  // 3. The same move failing again and again today.
  const tried = s.today?.tried ?? {};
  const done = s.today?.done ?? {};
  const failing = Object.keys(tried).map((m) => ({ m, n: tried[m], bad: tried[m] - (done[m] ?? 0) })).filter((x) => x.bad >= 3 && x.bad / x.n >= 0.5).sort((a, b) => b.bad - a.bad);
  const why = failing.length ? (s.log ?? []).filter((e) => e.action === failing[0].m && e.failed).at(-1)?.failed : '';
  const fl = failing[0];
  const flLog = fl ? (s.log ?? []).filter((e) => e.action === fl.m) : [];
  add('failing', !failing.length, 'Moves', failing.length ? `${MOVE_WORDS[fl.m] ?? fl.m} failed ${fl.bad} of ${fl.n} times today${why ? `. Last reason: ${plainReason(why)}` : ''}.` : 'No move keeps failing today.', {
    look: 'The same reason again and again is usually a bug in the game code for this move, not Pip being clumsy. A reason that changes each time is more likely Pip learning.',
    debug: `move: ${fl?.m}\ntried today: ${fl?.n}, failed: ${fl?.bad}\nlast tries:\n${flLog.slice(-4).map((e) => `- ${at(e.at)} ${e.failed ? 'FAILED' : 'ok'}${e.name ? ` "${e.name}"` : ''}${e.failed ? `: ${String(e.failed).slice(0, 200)}` : ''}`).join('\n')}`,
  });

  // 4. Too much pretending: free "do" steps make nothing.
  const total = Object.values(done).reduce((a, b) => a + b, 0);
  const pretend = (done.do ?? 0) / Math.max(1, total);
  add('pretend', !(total >= 20 && pretend >= 0.4), 'Real things', total >= 20 && pretend >= 0.4 ? `${done.do} of his ${total} steps today were free "do" steps that make nothing.` : 'Most of his steps really make, grow or learn something.', {
    look: 'He picks "do" when the real moves he wants are not offered or keep failing. Check which "do" steps he takes: each is a move he is missing.',
    debug: `last "do" steps:\n${(s.log ?? []).filter((e) => e.action === 'do').slice(-5).map((e) => `- ${at(e.at)} ${String(e.what ?? (e.sealed ? '(private)' : e.thought) ?? '').slice(0, 120)}${e.fallback ? ' (after a failure)' : ''}`).join('\n')}`,
  });

  // 5. Needs: hungry with nothing to eat, or an ask waiting for days.
  const food = (s.pantry ?? []).some((p) => p.qty > 0);
  const hungry = Number.isFinite(s.fullness) && s.fullness <= 2 && !food;
  const oldAsk = (s.asks ?? []).find((a) => a.status === 'open' && now - Date.parse(a.since ?? a.at ?? now) > 2 * DAY);
  add('needs', !hungry && !oldAsk, 'Needs', hungry ? 'He is hungry and has nothing to eat.' : oldAsk ? `He asked for "${oldAsk.item}" more than 2 days ago.` : 'He has food, and no ask is waiting long.', {
    look: hungry ? 'He needs seeds and a place to grow, or food from you. Check his garden and pantry in the Pip tab.' : 'Answer the ask in the Asks tab (give it, or say no).',
    debug: `fullness: ${s.fullness}\npantry: ${JSON.stringify(s.pantry ?? [])}\nplots: ${(s.garden?.plots ?? []).length}, seeds: ${JSON.stringify(s.garden?.seeds ?? [])}${oldAsk ? `\nask: ${JSON.stringify(oldAsk)}` : ''}`,
  });

  // 6. The models: all out, or many wake-ups without one.
  const errs = (s.errors ?? []).filter((e) => now - Date.parse(e.at) < 6 * HOUR).reduce((a, e) => a + (e.count ?? 1), 0);
  const allOut = s.quota?.out && Object.keys(s.quota.out).length && s.last?.via === 'fallback';
  add('models', !allOut && errs < 5, 'Models', allOut ? 'No model is left today, so he runs on autopilot until the daily reset.' : errs >= 5 ? `${errs} wake-ups went wrong in the last 6 hours.` : 'The models answer.', {
    look: allOut ? 'The free daily quota is used up. It resets at about 09:00 Dutch time. Fewer calls per wake-up, or a longer gap between wake-ups, helps.' : 'See the Error log below for what went wrong.',
    debug: `calls today: ${JSON.stringify(s.quota?.calls ?? {})}\nout: ${JSON.stringify(s.quota?.out ?? {})}\nlast: via ${s.last?.via}, model ${s.last?.model ?? '-'}\nerrors (6h): ${(s.errors ?? []).filter((e) => now - Date.parse(e.at) < 6 * HOUR).map((e) => `${at(e.at)} ${e.kind}: ${String(e.message).slice(0, 120)}`).join(' | ')}`,
  });

  // Every move that failed lately, grouped by what went wrong, so a repeating error stands out in Settings.
  const groups = {};
  for (const e of (s.log ?? []).filter((x) => x.failed && now - Date.parse(x.at) < DAY)) {
    const reason = plainReason(e.failed);
    const k = `${e.action}|${reason}`;
    groups[k] ??= { move: MOVE_WORDS[e.action] ?? e.action.replace(/_/g, ' '), action: e.action, reason, raw: String(e.failed).slice(0, 300), names: [], count: 0, last: e.at };
    groups[k].count += 1;
    if (e.name && !groups[k].names.includes(e.name)) groups[k].names = [...groups[k].names, e.name].slice(-3);
    if (e.at > groups[k].last) groups[k].last = e.at;
  }
  const failures = Object.values(groups).sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, 8);

  // What to send to the phone: only problems Bas can or should act on (a bug, a stuck project, the models, his needs),
  // each at most once a day. Going in circles and pretending are only shown in Settings: Pip works those out himself.
  const day = new Date(now).toISOString().slice(0, 10);
  const sent = Object.fromEntries(Object.entries(health.checkup?.sent ?? {}).filter(([, d]) => d === day));
  const fresh = out.filter((x) => !x.ok && PUSH.includes(x.id) && !sent[x.id]);
  return { items: out, fresh, failures, saved: { at: new Date(now).toISOString(), items: out, failures, sent, pushedAt: health.checkup?.pushedAt ?? null } };
}
