// Phase 6: music patterns and revisions, sculpture limits, photo angles.
// Run: node tests/makers.mjs
import assert from 'node:assert/strict';
import { cleanPattern, patternToTracks, reviseSection } from '../music.js';
import { finishSong, fakeMade, makerPrompt } from '../maker.js';
import { cleanTracks } from '../songs.js';
import { cleanParts } from '../decor.js';
import { toAnswer } from '../brain.js';

const ok = (name, fn) => { fn(); console.log(`ok  ${name}`); };
const raw = { name: 'Bee waltz', tempo: 96, instruments: ['piano', 'guitar', 'drums', 'kazoo'], form: ['A', 'A', 'B', 'A'], sections: [{ name: 'A', bars: [{ piano: 'C4 E4 G4 E4', guitar: 'C3+E3+G3:4', drums: 'kick hat snare hat' }, { piano: 'F4 A4 C5:2' }] }, { name: 'B', bars: [{ piano: 'G4:4', guitar: 'G2+B2+D3:4' }] }] };

ok('a pattern becomes tracks the site can play, in the order of the form', () => {
  const p = cleanPattern(raw);
  assert.deepEqual(p.instruments, ['piano', 'guitar', 'drums']);
  const tracks = patternToTracks(p);
  assert.equal(tracks.length, 3);
  assert.ok(cleanTracks({ tempo: p.tempo, tracks }), 'the old track checker accepts it');
  assert.match(tracks[0].notes, /^C4 E4 G4 E4 F4 A4 C5:2 C4 E4 G4 E4/);
  assert.match(tracks[2].notes, /^kick hat snare hat -:4 kick/, "a bar without drums is a rest");
});

ok('his skill sets how long a song can be', () => {
  const p = cleanPattern(raw, 4);
  assert.ok(p.form.length < 4);
});

ok('revising changes one section and makes a new version', () => {
  const p = cleanPattern(raw);
  const song = { id: 'song1', name: 'Bee waltz', pattern: p, v: 1 };
  const st = finishSong({ action: 'record_song', details: { revise: 'bee waltz' } }, { section: 'B', bars: [{ piano: 'A4 G4 F4 E4' }], why: 'a falling end' }, { songs: [song] });
  assert.equal(st.details.v, 2);
  assert.equal(st.details.of, 'song1');
  assert.equal(st.details.name, 'Bee waltz');
  assert.deepEqual(st.details.pattern.sections[0], p.sections[0], 'section A is kept');
  assert.equal(st.details.pattern.sections[1].bars[0].piano, 'A4 G4 F4 E4');
  assert.equal(reviseSection(p, 'Z', [{ piano: 'C4' }]).sections[0].bars[0].piano, 'C4', 'an unknown section name means the first one');
  assert.equal(reviseSection(p, 'A', []), null);
});

ok('the brain can ask to revise a song; the maker sees the song as it is', () => {
  const a = toAnswer({ moves: [{ move: 'revise_song', details: { name: 'Bee waltz', section: 'B', why: 'too plain' } }] }, ['revise_song']);
  assert.equal(a.steps[0].action, 'record_song');
  assert.equal(a.steps[0].make, true);
  const prompt = makerPrompt({ soul: 'me', step: a.steps[0], rules: 'rules', current: 'section A ...' });
  assert.match(prompt, /I rewrite ONE section/);
  assert.match(prompt, /"section"/);
});

ok('sculpture: shapes with position, rotation, scale and colour; at most 40', () => {
  const parts = cleanParts([{ shape: 'torus', size: [0.2, 0.05], pos: [0, 0.3, 0], rot: [90, 0, 0], scale: 2, color: '#ff8800' }, ...Array.from({ length: 50 }, () => ({ shape: 'box', size: [0.1, 0.1, 0.1] }))]);
  assert.equal(parts.length, 40);
  assert.deepEqual(parts[0].size, [0.4, 0.1]);
  assert.deepEqual(parts[0].rot, [90, 0, 0]);
});

ok('fake makers give valid designs', () => {
  assert.ok(cleanParts(fakeMade({ action: 'decorate', details: { what: 'x' } }).parts));
  const song = finishSong({ action: 'record_song', details: { what: 'hum' } }, fakeMade({ action: 'record_song', details: { what: 'hum' } }));
  assert.ok(song.details.tracks.length);
});

ok('revising a drum song with a sung line keeps the voice (and odd names still work)', () => {
  const old = cleanPattern({ name: 'Beat', tempo: 80, instruments: ['drums'], form: ['A'], sections: [{ name: 'A', bars: [{ drums: 'kick hat snare hat' }] }] }, 16);
  const songs = [{ id: 's1', name: 'Beat', pattern: old }];
  for (const reply of [{ section: 'A', bars: [{ piano: 'C4 E4 G4:2' }] }, { section: 'chorus', bars: [{ vocals: 'C4 E4 G4:2', drums: 'kick hat snare hat' }] }]) {
    const song = finishSong({ action: 'record_song', details: { revise: 'Beat' } }, reply, { songs, allowed: ['voice', 'drums'] });
    assert.ok(cleanTracks({ tempo: song.details.tempo, tracks: song.details.tracks }), `no playable song for ${JSON.stringify(reply)}`);
    assert.ok(song.details.tracks.some((t) => t.instrument === 'voice'), 'the voice was thrown away');
  }
});

ok('things he works at with his hands stand within reach, not high on a wall', async () => {
  const { makeDecor } = await import('../decor.js');
  const parts = [{ shape: 'box', size: [0.6, 0.8, 0.5], pos: [0, 0.4, 0], color: '#9e4e31' }, { shape: 'box', size: [0.3, 0.2, 0.02], pos: [0, 0.4, 0.26], color: '#ff4500', glow: true }];
  const stove = makeDecor([], { name: 'small stove', parts, uses: [{ label: 'Bake a loaf', text: 'warm' }], wall: 'back', along: 1, height: 2.9 }, Date.now());
  assert.equal(stove.entry?.kind, 'floor', JSON.stringify(stove).slice(0, 200));
  assert.equal(stove.entry.pos[1], 0);
});
