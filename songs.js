// Songs for the things Pip makes (a music box, a wind chime...). A song is plain data: notes, a tempo and a sound.

export const TIMBRES = ['piano', 'musicbox', 'bell', 'soft'];
const MAX_NOTES = 64;
const MAX_SECONDS = 90;
const NOTE = /^([A-Ga-g])([#b]?)(\d)$/;

// notes: "E5 G5 B5:2 - D5" (letter, optional # or b, octave 2-7; ":2" = 2 beats; "-" = a rest).
// Returns { notes: [[name|null, beats], ...], tempo, timbre } or null.
export function cleanSong(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const notes = [];
  for (const token of String(raw.notes ?? '').split(/[\s,;|]+/).filter(Boolean).slice(0, MAX_NOTES)) {
    const [name, b] = token.split(':');
    const beats = Math.min(4, Math.max(0.25, Number(b) || 1));
    if (name === '-' || /^r(est)?$/i.test(name)) {
      notes.push([null, beats]);
      continue;
    }
    const m = NOTE.exec(name);
    const octave = m ? Number(m[3]) : 0;
    if (!m || octave < 2 || octave > 7) continue;
    notes.push([m[1].toUpperCase() + m[2] + octave, beats]);
  }
  if (notes.filter(([n]) => n).length < 2) return null;
  const tempo = Math.min(200, Math.max(40, Math.round(Number(raw.tempo) || 90)));
  const timbre = TIMBRES.includes(raw.timbre) ? raw.timbre : 'piano';
  const song = { notes, tempo, timbre };
  while (songSeconds(song) > MAX_SECONDS && song.notes.length > 2) song.notes.pop();
  return song;
}

export const songSeconds = (s) => (s.notes.reduce((t, [, b]) => t + b, 0) * 60) / s.tempo;
