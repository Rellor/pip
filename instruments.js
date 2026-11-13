// Instruments Pip can hold and play. They wait in his chest; take_tool brings one into his inventory, and play_piano with "instrument" plays it.
// At the piano he can also change the keyboard sound (piano, epiano, harpsichord, organ, vibraphone, marimba, glockenspiel, strings, choir...) without any item.
export const HELD = {
  guitar: { label: 'a small guitar', why: 'a small nylon-string guitar to strum', parts: [
    { shape: 'sphere', size: [0.2], pos: [0, 0.22, 0], color: '#c98a4b' }, { shape: 'sphere', size: [0.15], pos: [0, 0.4, 0], color: '#c98a4b' },
    { shape: 'cylinder', size: [0.025, 0.025, 0.55], pos: [0, 0.65, 0], color: '#5a3a22' } ] },
  violin: { label: 'a little violin', why: 'a little violin with a bow', parts: [
    { shape: 'sphere', size: [0.14], pos: [0, 0.14, 0], color: '#a8541f' }, { shape: 'cylinder', size: [0.02, 0.02, 0.3], pos: [0, 0.38, 0], color: '#3a2415' } ] },
  flute: { label: 'a silver flute', why: 'a thin silver flute to blow across', parts: [
    { shape: 'cylinder', size: [0.018, 0.018, 0.5], pos: [0, 0.02, 0], color: '#d8dde6', rot: [0, 0, 1.5708] } ] },
  clarinet: { label: 'a dark clarinet', why: 'a dark clarinet with silver keys', parts: [
    { shape: 'cylinder', size: [0.022, 0.03, 0.45], pos: [0, 0.23, 0], color: '#2a2527' }, { shape: 'cone', size: [0.05, 0.1], pos: [0, 0.02, 0], color: '#2a2527' } ] },
  kalimba: { label: 'a wooden kalimba', why: 'a small wooden thumb piano with metal keys', parts: [
    { shape: 'box', size: [0.26, 0.05, 0.18], pos: [0, 0.03, 0], color: '#b57b45' }, { shape: 'box', size: [0.2, 0.01, 0.12], pos: [0, 0.06, 0], color: '#c9ccd4' } ] },
  harp: { label: 'a little lap harp', why: 'a little harp that sits on my lap or the floor', parts: [
    { shape: 'cylinder', size: [0.02, 0.02, 0.55], pos: [-0.14, 0.28, 0], color: '#8a5a2e' }, { shape: 'cylinder', size: [0.02, 0.02, 0.35], pos: [0.12, 0.2, 0], color: '#8a5a2e', rot: [0, 0, 0.5] },
    { shape: 'box', size: [0.3, 0.03, 0.04], pos: [0, 0.02, 0], color: '#8a5a2e' } ] },
};
export const heldKind = (x) => { const k = String(x ?? '').toLowerCase(); return Object.hasOwn(HELD, k) ? k : null; };

// Once: the instruments are put in his chest (nothing is added to his inventory, he takes what he wants).
export function grantInstruments(s, now = Date.now()) {
  if (s.instrumentsGiven) return false;
  s.instrumentsGiven = true;
  s.stored ??= [];
  const at = new Date(now).toISOString();
  for (const [k, v] of Object.entries(HELD)) {
    const have = [...(s.stored ?? []), ...(s.decor ?? [])].some((d) => d.tool === k) || (s.tools ?? []).some((t) => t.kind === k);
    if (have) continue;
    s.stored.push({ id: `dinst-${k}`, name: k, why: v.why, project: '', song: null, uses: [], tool: k, zone: 'floor', slot: null, free: true, label: 'in my chest', kind: 'floor', pos: [0, 0, 0], rotY: 0, scale: 1, parts: v.parts.map((p) => ({ rot: [0, 0, 0], glow: false, ...p })), stand: null, at, createdAt: at, storedAt: at });
  }
  return true;
}
