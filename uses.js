// What a thing is for. Everything Pip makes can have "uses": buttons Bas can press (and Pip can use himself).
// A use is plain data: a label, a short text about what happens, and optionally a small picture (what you see),
// a song, one of his apps, and a feeling it gives Pip. Nothing here ever runs as code.

import { cleanSong } from './songs.js';
import { cleanSvg } from './art.js';

export const MAX_USES = 3;
export const EFFECTS = ['wonder', 'joy', 'calm', 'fullness'];
export const DOES = ['light', 'drive', 'spin', 'stand']; // what the website plays when it is used
export const VIEW_MAX_CHARS = 6_000;
export const MAX_MOTION_STEPS = 12;
export const MAX_MOTION_METRES = 8; // all the forward and back together

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');

// How a thing moves when it is driven: a few steps, each a turn (degrees, + is right), a way forward (metres, - is back),
// a hop (metres) and a wait (seconds). The website plays them from where the thing stands and brings it back. Nothing runs as code.
export function cleanMotion(raw) {
  const num = (v, lo, hi) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : 0);
  const out = [];
  let metres = 0;
  for (const m of (Array.isArray(raw) ? raw : []).slice(0, MAX_MOTION_STEPS)) {
    if (!m || typeof m !== 'object') continue;
    const step = { turn: Math.round(num(m.turn, -360, 360)), forward: Math.round(num(m.forward, -3, 3) * 100) / 100, hop: Math.round(num(m.hop, 0, 0.4) * 100) / 100, wait: Math.round(num(m.wait, 0, 3) * 10) / 10 };
    metres += Math.abs(step.forward);
    if (metres > MAX_MOTION_METRES) step.forward = 0;
    if (step.turn || step.forward || step.hop || step.wait) out.push(step);
  }
  return out.length ? out : null;
}

// From Pip's answer to a clean list. The picture (if any) comes back as clean svg text, for the caller to save as a file.
export function cleanUses(raw) {
  const out = [];
  for (const u of (Array.isArray(raw) ? raw : []).slice(0, MAX_USES)) {
    if (!u || typeof u !== 'object') continue;
    const label = str(u.label, 30);
    if (!label) continue;
    const text = str(u.text, 400);
    const view = u.view ? cleanSvg(u.view, VIEW_MAX_CHARS) : null;
    const song = cleanSong(u.song);
    const app = str(u.app, 60) || null;
    const does = DOES.includes(u.does) ? u.does : null;
    if (!text && !view && !song && !app && !does) continue; // a button that does nothing is not a use
    out.push({ label, text, viewSvg: view?.svg ?? null, song, app, effect: EFFECTS.includes(u.effect) ? u.effect : null, does, motion: does === 'drive' ? cleanMotion(u.motion) : null });
  }
  return out;
}

// What is allowed to sit in the save file (the picture is a path to a file, the app an id).
export function storedUses(raw) {
  const out = [];
  for (const u of (Array.isArray(raw) ? raw : []).slice(0, MAX_USES)) {
    if (!u || typeof u !== 'object') continue;
    const label = str(u.label, 30);
    if (!label) continue;
    out.push({
      label,
      text: str(u.text, 400),
      view: typeof u.view === 'string' && /^made\/view-[\w-]+\.svg$/.test(u.view) ? u.view : null,
      song: cleanSong(u.song),
      app: typeof u.app === 'string' && /^app[\w-]+$/.test(u.app) ? u.app : null,
      effect: EFFECTS.includes(u.effect) ? u.effect : null,
      does: DOES.includes(u.does) ? u.does : null,
      motion: u.does === 'drive' ? cleanMotion(u.motion) : null,
    });
  }
  return out;
}

// Finds a use of a thing: by its label, or the only one it has.
export function findUse(decor, name, label) {
  const n = str(name, 60).toLowerCase();
  const e = n ? decor.find((x) => !x.image && (x.name.toLowerCase() === n || x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()))) : null;
  if (!e) return { failed: 'there is nothing with that name in his room' };
  const uses = e.uses ?? [];
  if (!uses.length) return { failed: 'that thing has no use yet' };
  const l = str(label, 30).toLowerCase();
  const use = l ? (uses.find((u) => u.label.toLowerCase() === l) ?? uses.find((u) => u.label.toLowerCase().includes(l) || l.includes(u.label.toLowerCase()))) : uses.length === 1 ? uses[0] : null;
  if (!use) return { failed: `that thing can: ${uses.map((u) => u.label).join(', ')}` };
  return { entry: e, use };
}

// Adds a (checked) use to a thing he already made.
export function addUse(decor, name, use) {
  const n = str(name, 60).toLowerCase();
  const e = n ? decor.find((x) => !x.image && (x.name.toLowerCase() === n || x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()))) : null;
  if (!e) return { failed: 'there is nothing with that name in his room' };
  const [clean] = storedUses([use]);
  if (!clean) return { failed: 'the use did not work out' };
  const uses = (e.uses ?? []).filter((u) => u.label.toLowerCase() !== clean.label.toLowerCase());
  if (uses.length >= MAX_USES) return { failed: `a thing can have at most ${MAX_USES} uses` };
  e.uses = [...uses, clean];
  return { name: e.name, use: clean };
}
