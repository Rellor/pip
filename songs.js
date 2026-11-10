// Songs and sounds for the things Pip makes (a music box, a wind chime, a rain machine...).
// A song is plain data: notes, a tempo, a sound for the notes, and maybe a background sound like rain.

export const TIMBRES = ['piano', 'musicbox', 'bell', 'soft', 'pluck', 'flute', 'pad', 'marimba'];
export const AMBIENCE = ['rain', 'wind', 'waves', 'fire', 'crickets', 'hum'];
export const PERCUSSION = ['kick', 'snare', 'hat'];
const MAX_NOTES = 64;
const MAX_SECONDS = 90;
const NOTE = /^([A-Ga-g])([#b]?)(\d)$/;

// notes: "E5 G5 B5:2 - D5 kick snare:2" (letter, optional # or b, octave 2-7; ":2" = 2 beats; "-" = a rest;
// kick, snare and hat are drum sounds). ambience: rain, wind, waves, fire, crickets or hum plays underneath for `seconds`.
// Returns { notes: [[name|null, beats], ...], tempo, timbre, ambience, seconds } or null.
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
    if (PERCUSSION.includes(name.toLowerCase())) {
      notes.push([name.toLowerCase(), beats]);
      continue;
    }
    const m = NOTE.exec(name);
    const octave = m ? Number(m[3]) : 0;
    if (!m || octave < 2 || octave > 7) continue;
    notes.push([m[1].toUpperCase() + m[2] + octave, beats]);
  }
  const ambience = AMBIENCE.includes(raw.ambience) ? raw.ambience : null;
  const sounding = notes.filter(([n]) => n).length;
  if (sounding < 2 && !ambience) return null;
  const tempo = Math.min(200, Math.max(40, Math.round(Number(raw.tempo) || 90)));
  const timbre = TIMBRES.includes(raw.timbre) ? raw.timbre : 'piano';
  const song = { notes: sounding < 2 ? [] : notes, tempo, timbre };
  if (ambience) {
    song.ambience = ambience;
    song.seconds = Math.min(60, Math.max(5, Math.round(Number(raw.seconds) || 20)));
  }
  while (songSeconds(song) > MAX_SECONDS && song.notes.length > 2) song.notes.pop();
  return song;
}

// How long it plays: the notes, or the background sound if that lasts longer.
export const songSeconds = (s) => Math.max((s.notes.reduce((t, [, b]) => t + b, 0) * 60) / s.tempo, s.ambience ? s.seconds || 20 : 0);
