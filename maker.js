// The maker: a separate model call that designs one thing. The brain says WHAT to make; the maker makes it.
// Phase 4 uses the old design rules (parts, svg, tracks) for each kind of thing. Phase 6 gives each a better maker.
import { SITE_CHECKLIST } from './site.js';
export const FORMATS = {
  plaything: '{"name": "...", "why": "...", "verb": "one word for what I do with it: ride, fly, sail, kick, swing, juggle, ...", "motion": "how it moves when I use it, one of: ride (I sit on it and go round), fly (it goes round in the air above me), float (it drifts on the pond), roll (it goes over the ground and I go after it), stay (it stands where it is and I am on it or at it), hold (I hold it and do it on the spot)", "where": "square | pond | field | stone | doorstep", "how": "one sentence in my own words: what I do with it", "parts": [...]}',
  decorate: '{"name": "...", "where": "(optional: leave it out and the game puts it where this kind of thing belongs; or floor, on the desk, wall_left, ceiling...)", "why": "...", "parts": [...], "uses": [{"label": "...", "text": "...", "effect": "joy"}]}',
  change_thing: '{"name": "the exact name of the thing", "parts": [...all its parts, changed], "why": "..."}',
  extend_thing: '{"name": "the exact name of the thing", "parts": [...up to 40 new parts]}',
  draw: '{"name": "...", "where": "wall_left", "why": "...", "svg": "<svg viewBox=\\"0 0 400 300\\">...</svg>"}',
  make_app: '{"name": "...", "title": "a short, nice name for the phone (1 to 3 words)", "icon": "one emoji for its icon", "why": "...", "html": "<!doctype html>... (it must also work small, on a phone screen)"}',
  update_app: '{"name": "the exact name of the app", "change": "the one thing I did, in a few words", "edits": [{"find": "a piece of the file copied exactly (a few whole lines, so it is found only once)", "replace": "what comes there instead"}]}  (small edits: only what changes; or, for a tiny program, "html": the whole new file instead of edits)',
  make_site: '{"title": "the name of my website (a few words)", "why": "...", "html": "<!doctype html>... (HTML and CSS only, it also reads well on a phone)"}',
  update_site: '{"change": "the one thing I did, in a few words", "edits": [{"find": "a piece of my page copied exactly (a few whole lines, so it is found only once)", "replace": "what comes there instead"}]}  (small edits: only what changes; or "html": the whole new page when I redo it)',
  record_song: '{"name": "...", "tempo": 90, "instruments": ["one of my instruments", "drums"], "form": ["A", "A", "B", "A"], "sections": [{"name": "A", "bars": [{"piano": "C4 E4 G4 E4", "guitar": "C3+E3+G3:4", "drums": "kick hat snare hat"}]}, {"name": "B", "bars": [...]}]}',
  revise_song: '{"section": "the name of the ONE section I rewrite", "bars": [{"<instrument>": "..."}], "why": "what I changed and why"}',
  make_clothes: '{"name": "...", "slot": "head, face, neck, body or back", "why": "...", "parts": [...]}',
  make_move: '{"name": "...", "why": "...", "duration": 2, "frames": [{"at": 0, ...}, {"at": 0.5, ...}]}',
  blueprint: '{"name": "...", "goal": "...", "research": "...", "mechanisms": [{"part": "...", "how": "...", "uses": "..."}], "tools": [...]}',
  add_use: '{"name": "the exact name of the thing", "use": {"label": "...", "text": "...", "effect": "joy"}}',
};

// What makes a small program or game work in his computer (a locked box): told every time, because these are the
// mistakes that break most first tries. After he answers, the game really runs it and tells him what it saw.
export const APP_CHECKLIST = `MY CHECKLIST FOR A PROGRAM THAT WORKS
- One file. Everything is in it: no internet, no outside scripts, fonts or pictures, no storage (localStorage), no alert or prompt.
- Small and finished beats big and broken: one simple idea that really works. A game has a goal, a score I can see, and a way to start again.
- It reacts: to a click or tap AND to the keyboard (arrows or space), and I can see that it reacted.
- Every name I use is defined before I use it. I read my code once more from the top, line by line, as if I were the computer.
- It fits a small screen: widths in % or max-width, a canvas no wider than 440.
The game runs my program after I write it (it clicks, presses keys, and looks for errors). What it finds comes back to me.`;

// ctx: { soul, step: {action, details: {what, why, name, change, add}}, rules: text, room: [lines], skill: text }
export function makerPrompt(ctx) {
  const d = ctx.step.details ?? {};
  const asked = [d.what, d.name && `(${d.name})`, d.change && `change: ${d.change}`, d.add && `add: ${d.add}`].filter(Boolean).join(' ');
  return `${ctx.soul}

I AM MAKING THIS NOW
${asked || 'something new'}${d.why ? `\nWhy: ${d.why}` : ''}

${ctx.spot ? `${ctx.spot}\n\n` : ''}${ctx.notes?.length ? `WHAT I LOOKED UP ABOUT THIS (I use what I learned)\n${ctx.notes.map((x) => `- ${x}`).join('\n')}\n\n` : ''}${ctx.lessons?.length ? `WHAT WENT WRONG BEFORE WHEN I MADE THIS KIND OF THING (I avoid it this time)\n${ctx.lessons.map((x) => `- ${x}`).join('\n')}\n\n` : ''}${ctx.recipes?.length ? `FROM MY RECIPE BOOK: THINGS LIKE THIS I MADE BEFORE (I can build on them and do it better, not copy them)\n${ctx.recipes.map((x) => `- ${x}`).join('\n')}\n\n` : ''}${ctx.room?.length && ['decorate', 'change_thing', 'extend_thing'].includes(ctx.step.action) ? `MY ROOM NOW\n${ctx.room.map((x) => `- ${x}`).join('\n')}\n\n` : ''}${ctx.drawn ? `${ctx.drawn}\n\n` : ''}HOW MAKING WORKS
${ctx.build ? (ctx.step.action === 'update_site' ? `WHAT I CHANGE ON MY WEBSITE NOW: ${d.change || d.what || 'one thing that makes it more mine'}\nI change only that, with small edits (find a piece of the page exactly as it is, and replace it), or I add a new part. Everything else stays.\nMY WEBSITE AS IT IS NOW\n${ctx.build}\n\n` : ctx.step.action === 'update_app' ? `MY TICKET: ${d.change || d.what || 'one small thing that makes it better'}\n${ctx.bugs ? `ERRORS MY LAST TEST FOUND: ${ctx.bugs}\n` : ''}I work like a careful coder: I do only this ticket, with small edits (find a piece of the file exactly as it is, and replace it). Everything that works stays. No errors: every name I use exists. After my change the game runs my program and tests it; if it breaks, the old version comes back.\nMY PROGRAM AS IT IS NOW\n${ctx.build}\n\n` : `WHAT IT IS NOW (its parts; I change what I want and keep the rest${ctx.step.action === 'extend_thing' ? ', and my new parts touch these' : ''})\n${ctx.build}\n\n`) : ''}${ctx.rules}${ctx.have && !['draw', 'make_app', 'update_app', 'make_site', 'update_site'].includes(ctx.step.action) ? `\n\nWHAT I HAVE TO MAKE IT WITH: ${ctx.have}` : ''}${['make_app', 'update_app'].includes(ctx.step.action) ? `\n\n${APP_CHECKLIST}` : ''}${['make_site', 'update_site'].includes(ctx.step.action) ? `\n\n${SITE_CHECKLIST}${ctx.site ? `\n\n${ctx.site}` : ''}` : ''}${ctx.skill ? `\n\nMY SKILL: ${ctx.skill}` : ''}

${ctx.step.action === 'decorate' ? 'I design it in everyday sizes, the way it would be in a normal home (a desk lamp about 0.4 m high, a chair seat about 0.45 m, a bookcase about 1.8 m). My room is built bigger than a normal home, so the game builds what I make 1.6 times bigger, and then it matches my bed, desk and bookshelf. I do not have to make everything small: big things (a tall lamp, a real chair, a cupboard, a big plant stand) fill my room and make it feel like home. A seat or a table top stays at a height my body fits, the game sees to that.\n' : ''}${['decorate', 'change_thing', 'extend_thing', 'make_clothes'].includes(ctx.step.action) ? 'The furniture in my room shows what good craft looks like: a bed with legs, a headboard, a mattress, pillows and a blanket; a desk with a top, slim legs and a drawer; a bookshelf with sides, shelves and books of many sizes. Soft rounded edges (roundbox), a few colours that go together, and small details make a thing look real.\n' : ''}I make it my own way. A first try may be clumsy; that is fine.
${ctx.current ? `THE SONG AS IT IS NOW\n${ctx.current}\nI rewrite ONE section of it, and keep the rest.\n\n` : ''}${ctx.step.details?.play ? 'This is NOT a thing for my room. It is something to DO things with outside: I build it life-size, the way it really is (a bike about 1.7 m long with two wheels of 0.65 m, a kite about 1 m across with a tail, a small sailing boat about 0.8 m long), from simple shapes, so that anyone sees from far what it is. Then I say how I use it: what I do with it (verb), how it moves (motion), where (where) and one sentence about it (how). I can invent anything: it only has to be something I can really do.\n\n' : ''}Answer in JSON with exactly this shape: ${FORMATS[ctx.current ? 'revise_song' : ctx.step.details?.play ? 'plaything' : ctx.step.action] ?? '{}'}`;
}

// The maker's answer becomes the step's details. What the brain said (what, why) stays as a fallback.
export function applyMade(step, reply, limits = {}) {
  const d = reply && typeof reply === 'object' ? { ...reply } : {};
  if (limits.parts && Array.isArray(d.parts)) d.parts = d.parts.slice(0, limits.parts); // his skill sets how much he can do
  if (limits.bars && Array.isArray(d.tracks)) d.tracks = d.tracks.slice(0, 4);
  // He chose a place outside when he picked the move ("a lighthouse outside by the pond"): the design goes there, whatever
  // spot the maker wrote down (decided here, because the step is tidied afterwards and only its details stay).
  const where = outsideChoice(step.details?.where ?? outsideIn(step.details?.what), d.where ?? step.details?.where);
  // Why he makes it is what HE said when he chose to (his real reason). What the maker wrote about it (often about how
  // the making went: "I added more shapes because the check said it was too empty") is kept beside it as a note.
  const own = String(step.details?.why ?? '').trim();
  const said = String(d.why ?? '').trim();
  const why = own.length >= 8 ? own : said || own;
  return { ...step, details: { ...step.details, ...d, ...(where ? { where } : {}), ...(why ? { why } : {}), ...(said && said !== why ? { madeNote: said } : {}), name: d.name ?? step.details?.name ?? step.details?.what }, make: false, made_by_maker: true };
}

// Songs only use what he has. An instrument he does not own becomes his voice (drums stay drums), and names are matched
// loosely ("Voice", "vocals", "singing"), so a whole song is not lost to one wrong word.
const ALIAS = { vocals: 'voice', vocal: 'voice', singing: 'voice', sing: 'voice', hum: 'voice', humming: 'voice', choir: 'voice', drum: 'drums', percussion: 'drums' };
function onlyWhatHeHas(reply, allowed) {
  const fit = (name) => {
    const n = String(name ?? '').toLowerCase().trim();
    const a = ALIAS[n] ?? n;
    return allowed.includes(a) ? a : allowed.includes('voice') ? 'voice' : allowed[0];
  };
  const instruments = [...new Set((Array.isArray(reply.instruments) ? reply.instruments : []).map(fit))];
  const sections = (Array.isArray(reply.sections) ? reply.sections : []).map((sec) => ({
    ...sec,
    bars: (Array.isArray(sec?.bars) ? sec.bars : []).map((bar) => {
      const out = {};
      for (const [k, v] of Object.entries(bar ?? {})) { const f = fit(k); out[f] = out[f] ? `${out[f]} ${v}` : v; }
      return out;
    }),
  }));
  for (const sec of sections) for (const bar of sec.bars) for (const k of Object.keys(bar)) if (!instruments.includes(k)) instruments.push(k);
  const fitBar = (bar) => { const out = {}; for (const [k, v] of Object.entries(bar ?? {})) { const f = fit(k); out[f] = out[f] ? `${out[f]} ${v}` : v; } return out; };
  return { ...reply, instruments: instruments.slice(0, 4), sections, ...(Array.isArray(reply.bars) ? { bars: reply.bars.map(fitBar) } : {}) }; // a revised section's bars too
}

// A song: the maker's pattern (or one revised section of an old one) becomes tracks the site can play.
import { cleanPattern, patternToTracks, reviseSection } from './music.js';
import { outsideIn, outsideChoice } from './decor.js';
export function finishSong(step, reply, { songs = [], maxBars = 16, allowed = null } = {}) {
  if (allowed && reply && typeof reply === 'object') reply = onlyWhatHeHas(reply, allowed);
  const old = step.details?.revise ? [...songs].reverse().find((x) => x.pattern && x.name.toLowerCase() === String(step.details.revise).toLowerCase()) : null;
  const pattern = old ? reviseSection(old.pattern, reply?.section, reply?.bars) : cleanPattern({ ...reply, name: reply?.name ?? step.details?.what }, maxBars);
  if (!pattern) return { ...step, details: { ...step.details, name: step.details?.what ?? step.details?.revise, tracks: [] }, make: false, made_by_maker: true };
  const name = old ? old.name : pattern.name || String(step.details?.what ?? 'a song').slice(0, 60);
  return { ...step, details: { ...step.details, name, tempo: pattern.tempo, tracks: patternToTracks(pattern), pattern, v: old ? (old.v ?? 1) + 1 : 1, of: old?.id ?? null, changed: old ? String(reply?.why ?? '').slice(0, 200) : null }, make: false, made_by_maker: true };
}

// For tests: small but valid designs without a model.
export function fakeMade(step) {
  const name = String(step.details?.name ?? step.details?.what ?? 'little thing').slice(0, 40);
  const box = [{ shape: 'box', size: [0.2, 0.2, 0.2], pos: [0, 0.1, 0], color: '#c08040' }, { shape: 'sphere', size: [0.06], pos: [0, 0.26, 0], color: '#ffd84a', glow: true }];
  if (step.details?.play) return { name, why: '(fake)', verb: '', motion: '', where: '', how: '', parts: [{ shape: 'box', size: [1.2, 0.5, 0.3], pos: [0, 0.45, 0], color: '#c04030' }, { shape: 'cylinder', size: [0.3, 0.06], pos: [-0.5, 0.3, 0], color: '#333333' }, { shape: 'cylinder', size: [0.3, 0.06], pos: [0.5, 0.3, 0], color: '#333333' }] };
  return ({
    decorate: { name, where: 'on the desk', why: '(fake)', parts: box, uses: [{ label: 'Look at it', text: 'It glows a little.', effect: 'joy' }] },
    change_thing: { name: step.details?.name, parts: box, why: '(fake)' },
    extend_thing: { name: step.details?.name, parts: box.slice(0, 1) },
    draw: { name, where: 'wall_left', why: '(fake)', svg: '<svg viewBox="0 0 400 300"><rect width="400" height="300" fill="#223"/><circle cx="200" cy="150" r="40" fill="#fd4"/></svg>' },
    make_app: { name, why: '(fake)', html: '<!doctype html><title>x</title><p>Hello</p>' },
    make_site: { title: '(fake) Pip was here', why: '(fake)', html: '<!doctype html><html><head><title>Pip</title><style>body{max-width:40rem;margin:auto;font:18px/1.5 Georgia;background:#f6efe6;color:#3b2f2a}</style></head><body><h1>Pip was here</h1><p>I am Pip. I live in a small village with a pond, a library and an internet café, where I am writing this page right now. I make things, I draw, and I say what I think.</p><h2>What I made lately</h2><p>A lamp that is too tall, a shelf that is a bit crooked, and a hill on my field. I like the hill best.</p><script>alert(1)</script></body></html>' },
    update_site: { change: '(fake) a new line about today', edits: [{ find: '<h2>What I made lately</h2>', replace: '<p>Today I went outside. It was fine.</p><h2>What I made lately</h2>' }] },
    update_app: { name: step.details?.name, change: '(fake) a new button', html: '<!doctype html><title>x</title><p>Hello again</p><button>new</button>' },
    record_song: step.details?.revise ? { section: 'A', bars: [{ piano: 'E4 D4 C4:2' }], why: '(fake) a softer ending' } : { name, tempo: 90, instruments: ['voice', 'drums'], form: ['A', 'B', 'A'], sections: [{ name: 'A', bars: [{ voice: 'C4 E4 G4:2', drums: 'kick hat snare hat' }] }, { name: 'B', bars: [{ voice: 'F4 A4 C5:2' }] }] },
    make_clothes: { name, slot: 'head', why: '(fake)', parts: box.slice(0, 1) },
  })[step.action] ?? {};
}
