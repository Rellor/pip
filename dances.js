// Moves: little body animations that Pip designs once, as data (a few poses over time). The page plays them for free, as often
// as he wants, so only designing one costs anything. No code is ever run: every number is checked and clamped here.
//
// A move is { id, name, why, duration, frames: [{ at, hop, lean, turn, tilt, armL, armR, spread, footL, footR }] }
//   at        0 to 1, where in the move this pose is (the move loops, and goes back to the first pose at the end)
//   hop       0 to 0.6   how high his body lifts
//   lean      -0.6 to 0.6  forward (+) or back (-)
//   turn      -1.6 to 1.6  turns left or right
//   tilt      -0.5 to 0.5  leans sideways
//   armL armR 0 to 1     arm down at his side (0) up over his head (1)
//   spread    0 to 1     arms out to the sides
//   footL footR 0 to 1   foot on the floor (0) lifted (1)
//   eyes      -1 to 1    wide open (-1), normal (0), closed (1)
//   sound     one of SOUNDS, played once when the move reaches this pose
//   sign      one symbol (like ♪ or ✨) that floats up from his head at this pose
export const MAX_MOVES = 12;
export const MAX_MOVES_PER_DAY = 3;

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n)) * 100) / 100 : 0;
};
const sign = (v) => (typeof v === 'string' && /^[^\p{L}\p{N}\s]{1,4}$/u.test(v.trim()) ? [...v.trim()].slice(0, 2).join('') : null);
export const SOUNDS = ['chirp', 'boing', 'whoosh', 'pop', 'sparkle', 'hum', 'sigh'];
const RANGES = { hop: [0, 0.6], lean: [-0.6, 0.6], turn: [-1.6, 1.6], tilt: [-0.5, 0.5], armL: [0, 1], armR: [0, 1], spread: [0, 1], footL: [0, 1], footR: [0, 1], eyes: [-1, 1] };

export function ensureMoves(s) {
  s.moves = Array.isArray(s.moves) ? s.moves.filter((m) => m && m.name && Array.isArray(m.frames)) : [];
}

export function cleanFrames(raw) {
  const frames = (Array.isArray(raw) ? raw : [])
    .filter((f) => f && typeof f === 'object')
    .slice(0, 8)
    .map((f, i, all) => ({ at: Object.hasOwn(f, 'at') ? num(f.at, 0, 1) : Math.round((i / Math.max(1, all.length)) * 100) / 100, ...Object.fromEntries(Object.entries(RANGES).map(([k, [lo, hi]]) => [k, num(f[k], lo, hi)])), ...(SOUNDS.includes(f.sound) ? { sound: f.sound } : {}), ...(sign(f.sign) ? { sign: sign(f.sign) } : {}) }));
  return frames.length >= 2 ? frames.sort((a, b) => a.at - b.at) : null;
}

export function findMove(s, name) {
  const n = clip(name, 40).toLowerCase();
  if (!n) return null;
  return s.moves.find((m) => m.name.toLowerCase() === n) ?? s.moves.find((m) => m.name.toLowerCase().includes(n) || n.includes(m.name.toLowerCase())) ?? null;
}

// Designing a move. Returns { move } or { failed }. Using the same name again redesigns it.
export function makeMove(s, d, now = Date.now()) {
  const name = clip(d?.name, 40);
  if (!name) return { failed: 'he did not give the move a name' };
  const frames = cleanFrames(d.frames);
  if (!frames) return { failed: 'the move needs at least 2 poses (frames)' };
  const old = findMove(s, name);
  const today = s.moves.filter((m) => now - Date.parse(m.createdAt) < 86_400_000).length;
  if (!old && today >= MAX_MOVES_PER_DAY) return { failed: 'he has already made enough new moves today' };
  if (!old && s.moves.length >= MAX_MOVES) return { failed: 'he knows as many moves as he can remember. He can redesign one with the same name' };
  const move = { id: old?.id ?? `m${now.toString(36)}${s.moves.length}`, name, why: clip(d.why, 200), duration: num(d.duration, 1, 6) || 2, frames, createdAt: old?.createdAt ?? new Date(now).toISOString() };
  if (old) Object.assign(old, move);
  else s.moves.push(move);
  return { move };
}

export function movesText(s) {
  const list = s.moves.map((m) => `- ${m.name}${m.why ? `: ${m.why}` : ''}`);
  return `MY MOVES (little body animations. I design one once with make_move and then do it as often as I like, for free)
${list.length ? list.join('\n') : '- none yet'}
(How I design a move is explained in my instructions.)
`;
}

// How to design a move never changes, so it is part of the fixed instructions.
export const movesGuide = () => `MY MOVES: how I design one\nmake_move {"name": "happy hop", "why": "when I am glad", "duration": 1.5, "frames": [{"at": 0}, {"at": 0.5, "hop": 0.35, "armL": 1, "armR": 1, "spread": 0.6}, {"at": 1}]} designs a move: 2 to 8 poses over the move (at goes from 0 to 1, and the move loops). In each pose I can set hop 0-0.6 (how high), lean -0.6 to 0.6, turn -1.6 to 1.6, tilt -0.5 to 0.5, armL and armR 0-1 (down to up), spread 0-1 (arms out), footL and footR 0-1 (lifted), eyes -1 to 1 (wide open to closed), sound (one of ${SOUNDS.join(', ')}, heard when the pose is reached) and sign (one symbol like ♪ or ✨ that floats up from my head). What I leave out stays at rest. I do a move with do {"what": "...", "move": "happy hop", "where": "window"} (where is optional: it is where I stand, anywhere I can walk to), and it plays for as long as that step lasts. At most ${MAX_MOVES_PER_DAY} new moves a day, ${MAX_MOVES} in all.
`;
