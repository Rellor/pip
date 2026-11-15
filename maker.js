// The maker: a separate model call that designs one thing. The brain says WHAT to make; the maker makes it.
// Phase 4 uses the old design rules (parts, svg, tracks) for each kind of thing. Phase 6 gives each a better maker.
export const FORMATS = {
  decorate: '{"name": "...", "where": "floor, on the desk, wall_left...", "why": "...", "parts": [...], "uses": [{"label": "...", "text": "...", "effect": "joy"}]}',
  change_thing: '{"name": "the exact name of the thing", "parts": [...all its parts, changed], "why": "..."}',
  extend_thing: '{"name": "the exact name of the thing", "parts": [...up to 40 new parts]}',
  draw: '{"name": "...", "where": "wall_left", "why": "...", "svg": "<svg viewBox=\\"0 0 400 300\\">...</svg>"}',
  make_app: '{"name": "...", "why": "...", "html": "<!doctype html>..."}',
  update_app: '{"name": "the exact name of the app", "html": "<!doctype html>..."}',
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

${ctx.room?.length ? `MY ROOM NOW\n${ctx.room.map((x) => `- ${x}`).join('\n')}\n\n` : ''}HOW MAKING WORKS
${ctx.rules}${ctx.have ? `\n\nWHAT I HAVE TO MAKE IT WITH: ${ctx.have}` : ''}${ctx.skill ? `\n\nMY SKILL: ${ctx.skill}` : ''}

${['decorate', 'change_thing', 'extend_thing', 'make_clothes'].includes(ctx.step.action) ? 'The furniture in my room shows what good craft looks like: a bed with legs, a headboard, a mattress, pillows and a blanket; a desk with a top, slim legs and a drawer; a bookshelf with sides, shelves and books of many sizes. Soft rounded edges (roundbox), a few colours that go together, and small details make a thing look real.\n' : ''}I make it my own way. A first try may be clumsy; that is fine.
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
    record_song: step.details?.revise ? { section: 'A', bars: [{ piano: 'E4 D4 C4:2' }], why: '(fake) a softer ending' } : { name, tempo: 90, instruments: ['voice', 'drums'], form: ['A', 'B', 'A'], sections: [{ name: 'A', bars: [{ voice: 'C4 E4 G4:2', drums: 'kick hat snare hat' }] }, { name: 'B', bars: [{ voice: 'F4 A4 C5:2' }] }] },
    make_clothes: { name, slot: 'head', why: '(fake)', parts: box.slice(0, 1) },
  })[step.action] ?? {};
}
