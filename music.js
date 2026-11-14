// Music as a pattern: instruments, a tempo, and sections made of bars, in the same note notation as play_piano
// ("C4 E4 G4:2", chords "C3+E3+G3:4", rests "-", drums "kick hat snare"). A bar is 4 beats.
// Code turns the pattern into tracks the site already plays. He can revise one section at a time; each revision is a new version.
//
// { name, tempo, instruments: ["piano", "guitar", "drums"], form: ["A", "A", "B", "A"],
//   sections: [{ name: "A", bars: [{ piano: "C4 E4 G4 E4", guitar: "C3+E3+G3:4", drums: "kick hat snare hat" }, ...] }] }
import { TRACK_TIMBRES } from './songs.js';

const clip = (t, n) => String(t ?? '').trim().slice(0, n);
const beatsOf = (notes) => String(notes ?? '').split(/\s+/).filter(Boolean).reduce((t, tok) => t + Math.min(4, Math.max(0.25, Number(tok.split(':')[1]) || 1)), 0);
const MAX_NOTES_PER_TRACK = 64;

export function cleanPattern(raw, maxBars = 16) {
  if (!raw || typeof raw !== 'object') return null;
  const instruments = (Array.isArray(raw.instruments) ? raw.instruments : []).map((x) => String(x).toLowerCase()).filter((x) => TRACK_TIMBRES.includes(x)).slice(0, 4);
  const sections = (Array.isArray(raw.sections) ? raw.sections : []).slice(0, 4).map((sec, i) => ({
    name: clip(sec?.name, 12) || String.fromCharCode(65 + i),
    bars: (Array.isArray(sec?.bars) ? sec.bars : []).slice(0, 8).map((b) => Object.fromEntries(instruments.filter((k) => b && typeof b[k] === 'string').map((k) => [k, clip(b[k], 120)]))),
  })).filter((sec) => sec.bars.length);
  if (!instruments.length || !sections.length) return null;
  let form = (Array.isArray(raw.form) ? raw.form : sections.map((x) => x.name)).map((x) => clip(x, 12)).filter((x) => sections.some((sec) => sec.name === x));
  if (!form.length) form = sections.map((x) => x.name);
  while (form.length > 1 && form.reduce((t, f) => t + sections.find((sec) => sec.name === f).bars.length, 0) > maxBars) form = form.slice(0, -1); // his skill sets how long a song can be
  return { name: clip(raw.name, 60), tempo: Math.min(200, Math.max(40, Math.round(Number(raw.tempo) || 90))), instruments, sections, form };
}

// The pattern as tracks: each instrument plays the bars in the order of the form; a bar it is silent in is a 4-beat rest.
export function patternToTracks(p) {
  return p.instruments.map((inst) => {
    const parts = [];
    for (const f of p.form) for (const bar of p.sections.find((sec) => sec.name === f).bars) {
      const notes = bar[inst];
      const beats = beatsOf(notes);
      parts.push(notes && beats ? (beats < 4 ? `${notes} -:${4 - beats}` : notes) : '-:4');
    }
    const tokens = parts.join(' ').split(/\s+/).slice(0, MAX_NOTES_PER_TRACK);
    return { instrument: inst, notes: tokens.join(' '), volume: inst === 'drums' ? 0.6 : 0.8, pan: 0, reverb: 0.2 };
  });
}

// One section rewritten. Returns the new pattern, or null when that section does not exist.
export function reviseSection(p, name, bars) {
  const i = p.sections.findIndex((sec) => sec.name.toLowerCase() === String(name ?? '').toLowerCase());
  if (i < 0 || !Array.isArray(bars) || !bars.length) return null;
  const next = structuredClone(p);
  next.sections[i].bars = bars.slice(0, 8).map((b) => Object.fromEntries(p.instruments.filter((k) => b && typeof b[k] === 'string').map((k) => [k, clip(b[k], 120)])));
  return next;
}

export const describePattern = (p) => `${p.name} (tempo ${p.tempo}, ${p.instruments.join(' + ')}, form ${p.form.join('-')})\n${p.sections.map((sec) => `section ${sec.name}: ${sec.bars.map((b, i) => `bar ${i + 1} ${Object.entries(b).map(([k, v]) => `${k} "${v}"`).join(', ')}`).join(' | ')}`).join('\n')}`;
