// The maker: a separate model call that designs one thing. The brain says WHAT to make; the maker makes it.
// Phase 4 uses the old design rules (parts, svg, tracks) for each kind of thing. Phase 6 gives each a better maker.
export const FORMATS = {
  decorate: '{"name": "...", "where": "(optional: leave it out and the game puts it where this kind of thing belongs; or floor, on the desk, wall_left, ceiling...)", "why": "...", "parts": [...], "uses": [{"label": "...", "text": "...", "effect": "joy"}]}',
  change_thing: '{"name": "the exact name of the thing", "parts": [...all its parts, changed], "why": "..."}',
  extend_thing: '{"name": "the exact name of the thing", "parts": [...up to 40 new parts]}',
  draw: '{"name": "...", "where": "wall_left", "why": "...", "svg": "<svg viewBox=\\"0 0 400 300\\">...</svg>"}',
  make_app: '{"name": "...", "why": "...", "html": "<!doctype html>..."}',
  update_app: '{"name": "the exact name of the app", "change": "the one thing I did, in a few words", "edits": [{"find": "a piece of the file copied exactly (a few whole lines, so it is found only once)", "replace": "what comes there instead"}]}  (small edits: only what changes; or, for a tiny program, "html": the whole new file instead of edits)',
  record_song: '{"name": "...", "tempo": 90, "instruments": ["one of my instruments", "drums"], "form": ["A", "A", "B", "A"], "sections": [{"name": "A", "bars": [{"piano": "C4 E4 G4 E4", "guitar": "C3+E3+G3:4", "drums": "kick hat snare hat"}]}, {"name": "B", "bars": [...]}]}',
  revise_song: '{"section": "the name of the ONE section I rewrite", "bars": [{"<instrument>": "..."}], "why": "what I changed and why"}',
  make_clothes: '{"name": "...", "slot": "head, face, neck, body or back", "why": "...", "parts": [...]}',
  make_move: '{"name": "...", "why": "...", "duration": 2, "frames": [{"at": 0, ...}, {"at": 0.5, ...}]}',
  blueprint: '{"name": "...", "goal": "...", "research": "...", "mechanisms": [{"part": "...", "how": "...", "uses": "..."}], "tools": [...]}',
  add_use: '{"name": "the exact name of the thing", "use": {"label": "...", "text": "...", "effect": "joy"}}',
};

// ctx: { soul, step: {action, details: {what, why, name, change, add}}, rules: text, room: [lines], skill: text }
export function makerPrompt(ctx) {
  const d = ctx.step.details ?? {};
  const asked = [d.what, d.name && `(${d.name})`, d.change && `change: ${d.change}`, d.add && `add: ${d.add}`].filter(Boolean).join(' ');
  return `${ctx.soul}

I AM MAKING THIS NOW
${asked || 'something new'}${d.why ? `\nWhy: ${d.why}` : ''}

${ctx.notes?.length ? `WHAT I LOOKED UP ABOUT THIS (I use what I learned)\n${ctx.notes.map((x) => `- ${x}`).join('\n')}\n\n` : ''}${ctx.lessons?.length ? `WHAT WENT WRONG BEFORE WHEN I MADE THIS KIND OF THING (I avoid it this time)\n${ctx.lessons.map((x) => `- ${x}`).join('\n')}\n\n` : ''}${ctx.recipes?.length ? `FROM MY RECIPE BOOK: THINGS LIKE THIS I MADE BEFORE (I can build on them and do it better, not copy them)\n${ctx.recipes.map((x) => `- ${x}`).join('\n')}\n\n` : ''}${ctx.room?.length ? `MY ROOM NOW\n${ctx.room.map((x) => `- ${x}`).join('\n')}\n\n` : ''}HOW MAKING WORKS
${ctx.build ? (ctx.step.action === 'update_app' ? `MY TICKET: ${d.change || d.what || 'one small thing that makes it better'}\n${ctx.bugs ? `ERRORS MY LAST TEST FOUND: ${ctx.bugs}\n` : ''}I work like a careful coder: I do only this ticket, with small edits (find a piece of the file exactly as it is, and replace it). Everything that works stays. No errors: every name I use exists. After my change the game runs my program and tests it; if it breaks, the old version comes back.\nMY PROGRAM AS IT IS NOW\n${ctx.build}\n\n` : `WHAT IT IS NOW (its parts; I change what I want and keep the rest${ctx.step.action === 'extend_thing' ? ', and my new parts touch these' : ''})\n${ctx.build}\n\n`) : ''}${ctx.rules}${ctx.have ? `\n\nWHAT I HAVE TO MAKE IT WITH: ${ctx.have}` : ''}${ctx.skill ? `\n\nMY SKILL: ${ctx.skill}` : ''}

${ctx.step.action === 'decorate' ? 'I design it in everyday sizes, the way it would be in a normal home (a desk lamp about 0.4 m high, a chair seat about 0.45 m, a bookcase about 1.8 m). My room is built bigger than a normal home, so the game builds what I make 1.6 times bigger, and then it matches my bed, desk and bookshelf. I do not have to make everything small: big things (a tall lamp, a real chair, a cupboard, a big plant stand) fill my room and make it feel like home. A seat or a table top stays at a height my body fits, the game sees to that.\n' : ''}${['decorate', 'change_thing', 'extend_thing', 'make_clothes'].includes(ctx.step.action) ? 'The furniture in my room shows what good craft looks like: a bed with legs, a headboard, a mattress, pillows and a blanket; a desk with a top, slim legs and a drawer; a bookshelf with sides, shelves and books of many sizes. Soft rounded edges (roundbox), a few colours that go together, and small details make a thing look real.\n' : ''}I make it my own way. A first try may be clumsy; that is fine.
${ctx.current ? `THE SONG AS IT IS NOW\n${ctx.current}\nI rewrite ONE section of it, and keep the rest.\n\n` : ''}Answer in JSON with exactly this shape: ${FORMATS[ctx.current ? 'revise_song' : ctx.step.action] ?? '{}'}`;
}

// The maker's answer becomes the step's details. What the brain said (what, why) stays as a fallback.
export function applyMade(step, reply, limits = {}) {
  const d = reply && typeof reply === 'object' ? { ...reply } : {};
  if (limits.parts && Array.isArray(d.parts)) d.parts = d.parts.slice(0, limits.parts); // his skill sets how much he can do
  if (limits.bars && Array.isArray(d.tracks)) d.tracks = d.tracks.slice(0, 4);
  return { ...step, details: { ...step.details, ...d, name: d.name ?? step.details?.name ?? step.details?.what }, make: false, made_by_maker: true };
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
  return ({
    decorate: { name, where: 'on the desk', why: '(fake)', parts: box, uses: [{ label: 'Look at it', text: 'It glows a little.', effect: 'joy' }] },
    change_thing: { name: step.details?.name, parts: box, why: '(fake)' },
    extend_thing: { name: step.details?.name, parts: box.slice(0, 1) },
    draw: { name, where: 'wall_left', why: '(fake)', svg: '<svg viewBox="0 0 400 300"><rect width="400" height="300" fill="#223"/><circle cx="200" cy="150" r="40" fill="#fd4"/></svg>' },
    make_app: { name, why: '(fake)', html: '<!doctype html><title>x</title><p>Hello</p>' },
    update_app: { name: step.details?.name, change: '(fake) a new button', html: '<!doctype html><title>x</title><p>Hello again</p><button>new</button>' },
    record_song: step.details?.revise ? { section: 'A', bars: [{ piano: 'E4 D4 C4:2' }], why: '(fake) a softer ending' } : { name, tempo: 90, instruments: ['voice', 'drums'], form: ['A', 'B', 'A'], sections: [{ name: 'A', bars: [{ voice: 'C4 E4 G4:2', drums: 'kick hat snare hat' }] }, { name: 'B', bars: [{ voice: 'F4 A4 C5:2' }] }] },
    make_clothes: { name, slot: 'head', why: '(fake)', parts: box.slice(0, 1) },
  })[step.action] ?? {};
}
