// Songs and sounds for the things Pip makes (a music box, a wind chime, a rain machine...).
// A song is plain data: notes, a tempo, a sound for the notes, and maybe a background sound like rain.

// Real instrument sounds (played from recorded samples when the page can load them, with a synth voice as backup):
// piano, epiano (electric piano), harpsichord, organ, harp, guitar (nylon), violin, cello, strings (a string group), flute, clarinet,
// vibraphone, marimba, kalimba, glockenspiel, musicbox, bell (tubular bells), choir. Plain synth voices: soft, pluck, pad.
export const TIMBRES = ['piano', 'epiano', 'harpsichord', 'organ', 'harp', 'guitar', 'violin', 'cello', 'strings', 'flute', 'clarinet', 'vibraphone', 'marimba', 'kalimba', 'glockenspiel', 'musicbox', 'bell', 'choir', 'soft', 'pluck', 'pad', 'synth', 'synthbass'];
// What needs something he has to own (a held instrument, or a synthesizer): see studio.js.
export const AMBIENCE = ['rain', 'wind', 'waves', 'fire', 'crickets', 'hum'];
export const PERCUSSION = ['kick', 'snare', 'hat'];
const MAX_NOTES = 64;
const MAX_SECONDS = 90;
const NOTE = /^([A-Ga-g])([#b]?)(\d)$/;

// notes: "E5 G5 B5:2 - D5 kick snare:2 C3+E3+G3:4" (letter, optional # or b, octave 2-7; ":2" = 2 beats; "-" = a rest;
// notes joined with + sound together as a chord, up to 4;
// kick, snare and hat are drum sounds). ambience: rain, wind, waves, fire, crickets or hum plays underneath for `seconds`.
// Returns { notes: [[name|null, beats], ...], tempo, timbre, ambience, seconds } or null.
const PERC = PERCUSSION;
// One list of notes ("E5 G5 B5:2 - D5 kick C3+E3:4") as [[name|[names]|drum|null, beats], ...].
function parseNotesText(text, drumsOnly = false) {
  const notes = [];
  for (const token of String(text ?? '').split(/[\s,;|]+/).filter(Boolean).slice(0, MAX_NOTES)) {
    const [name, b] = token.split(':');
    const beats = Math.min(4, Math.max(0.25, Number(b) || 1));
    if (name === '-' || /^r(est)?$/i.test(name)) {
      notes.push([null, beats]);
      continue;
    }
    if (PERC.includes(name.toLowerCase())) {
      notes.push([name.toLowerCase(), beats]);
      continue;
    }
    if (drumsOnly) continue;
    const chord = name.split('+').slice(0, 4).map((x) => NOTE.exec(x)).filter((m) => m && Number(m[3]) >= 2 && Number(m[3]) <= 7).map((m) => m[1].toUpperCase() + m[2] + m[3]);
    if (!chord.length) continue;
    notes.push([chord.length > 1 ? chord : chord[0], beats]);
  }
  return notes;
}
const soundingOf = (notes) => notes.filter(([n]) => n).length;
export const TRACK_TIMBRES = [...TIMBRES, 'drums'];
// A song with several tracks (a studio recording): { tempo, tracks: [{ timbre, notes, volume, pan, reverb }] }, up to 4 tracks. Returns null when nothing in it sounds.
export function cleanTracks(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tracks)) return null;
  const tracks = [];
  for (const t of raw.tracks.slice(0, 4)) {
    const timbre = String(t?.instrument ?? t?.timbre ?? 'piano').toLowerCase();
    const kind = TRACK_TIMBRES.includes(timbre) ? timbre : 'piano';
    const notes = parseNotesText(t?.notes, kind === 'drums');
    if (soundingOf(notes) < 2) continue;
    const num = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d));
    tracks.push({ timbre: kind, notes, volume: num(t.volume, 0.05, 1, 0.8), pan: num(t.pan, -1, 1, 0), reverb: num(t.reverb, 0, 1, 0.15) });
  }
  if (!tracks.length) return null;
  const song = { notes: [], tempo: Math.min(200, Math.max(40, Math.round(Number(raw.tempo) || 90))), timbre: tracks[0].timbre === 'drums' ? 'piano' : tracks[0].timbre, tracks };
  while (songSeconds(song) > MAX_SECONDS) {
    const longest = song.tracks.reduce((a, b) => (b.notes.length > a.notes.length ? b : a));
    if (longest.notes.length <= 2) break;
    longest.notes.pop();
  }
  return song;
}
export function cleanSong(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const notes = parseNotesText(raw.notes);
  const ambience = AMBIENCE.includes(raw.ambience) ? raw.ambience : null;
  const sounding = soundingOf(notes);
  if (sounding < 2 && !ambience) return null;
  const tempo = Math.min(200, Math.max(40, Math.round(Number(raw.tempo) || 90)));
  const timbre = TIMBRES.includes(String(raw.timbre ?? '').toLowerCase()) ? String(raw.timbre).toLowerCase() : 'piano';
  const song = { notes: sounding < 2 ? [] : notes, tempo, timbre };
  if (ambience) {
    song.ambience = ambience;
    song.seconds = Math.min(60, Math.max(5, Math.round(Number(raw.seconds) || 20)));
  }
  while (songSeconds(song) > MAX_SECONDS && song.notes.length > 2) song.notes.pop();
  return song;
}

// How long it plays: the notes, or the background sound if that lasts longer.
export const songSeconds = (s) => Math.max((s.notes.reduce((t, [, b]) => t + b, 0) * 60) / s.tempo, ...(s.tracks ?? []).map((t) => (t.notes.reduce((x, [, b]) => x + b, 0) * 60) / s.tempo), s.ambience ? s.seconds || 20 : 0);
