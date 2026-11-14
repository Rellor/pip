// The maker: a separate model call that designs one thing. The brain says WHAT to make; the maker makes it.
// Phase 4 uses the old design rules (parts, svg, tracks) for each kind of thing. Phase 6 gives each a better maker.
export const FORMATS = {
  decorate: '{"name": "...", "where": "floor, on the desk, wall_left...", "why": "...", "parts": [...], "uses": [{"label": "...", "text": "...", "effect": "joy"}]}',
  change_thing: '{"name": "the exact name of the thing", "parts": [...all its parts, changed], "why": "..."}',
  extend_thing: '{"name": "the exact name of the thing", "parts": [...up to 40 new parts]}',
  draw: '{"name": "...", "where": "wall_left", "why": "...", "svg": "<svg viewBox=\\"0 0 400 300\\">...</svg>"}',
  make_app: '{"name": "...", "why": "...", "html": "<!doctype html>..."}',
  update_app: '{"name": "the exact name of the app", "html": "<!doctype html>..."}',
  record_song: '{"name": "...", "tempo": 90, "tracks": [{"instrument": "piano", "notes": "C3+E3+G3:4 E4 G4:2", "volume": 0.8, "pan": 0, "reverb": 0.2}]}',
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
${ctx.rules}${ctx.skill ? `\n\nMY SKILL: ${ctx.skill}` : ''}

I make it my own way. A first try may be clumsy; that is fine.
Answer in JSON with exactly this shape: ${FORMATS[ctx.step.action] ?? '{}'}`;
}

// The maker's answer becomes the step's details. What the brain said (what, why) stays as a fallback.
export function applyMade(step, reply, limits = {}) {
  const d = reply && typeof reply === 'object' ? { ...reply } : {};
  if (limits.parts && Array.isArray(d.parts)) d.parts = d.parts.slice(0, limits.parts); // his skill sets how much he can do
  if (limits.bars && Array.isArray(d.tracks)) d.tracks = d.tracks.slice(0, 4);
  return { ...step, details: { ...step.details, ...d, name: d.name ?? step.details?.name ?? step.details?.what }, make: false, made_by_maker: true };
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
    record_song: { name, tempo: 90, tracks: [{ instrument: 'piano', notes: 'C4 E4 G4:2 C3+E3+G3:4', volume: 0.8 }] },
    make_clothes: { name, slot: 'head', why: '(fake)', parts: box.slice(0, 1) },
  })[step.action] ?? {};
}
