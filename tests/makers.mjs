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

ok('surfaces have a limit and must be within reach; shelves for things hang within reach', async () => {
  const { makeDecor } = await import('../decor.js');
  const small = (name) => ({ name, parts: [{ shape: 'box', size: [0.1, 0.1, 0.1], pos: [0, 0.05, 0], color: '#fff' }], on: 'desk' });
  const decor = [];
  for (let i = 0; i < 3; i++) { const r = makeDecor(decor, small(`cup ${i}`), Date.now()); assert.ok(r.entry, r.failed); decor.push(r.entry); }
  assert.match(makeDecor(decor, small('cup 4'), Date.now()).failed ?? '', /desk is full/);
  assert.match(makeDecor(decor, { ...small('book'), on: 'bookshelf' }, Date.now()).failed ?? '', /can only reach/);
  const shelf = makeDecor(decor, { name: 'wooden shelf', why: 'to put my cups on', parts: [{ shape: 'box', size: [0.6, 0.04, 0.2], pos: [0, 0, 0], color: '#a0522d' }], wall: 'left', along: -1, height: 2.8 }, Date.now());
  assert.ok(shelf.entry && shelf.entry.pos[1] <= 1.4, JSON.stringify(shelf.entry?.pos ?? shelf.failed));
});

ok('a too-full desk feels messy, and moving a thing onto his shelf is offered', async () => {
  const { availableMoves } = await import('../moves.js');
  const { clutter } = await import('../body.js');
  const thing = (name, i) => ({ id: `t${i}`, name, kind: 'surface', base: 'desk', pos: [-4.3, 0.85, 0.4 + i * 0.3], parts: [{ shape: 'box', size: [0.1, 0.1, 0.1], pos: [0, 0.05, 0], rot: [0, 0, 0], color: '#fff' }] });
  const shelf = { id: 'sh', name: 'small wooden shelf', kind: 'wall', side: 'left', pos: [-4.97, 1.1, -3], rotY: Math.PI / 2, why: 'to put things on', parts: [{ shape: 'box', size: [0.6, 0.04, 0.2], pos: [0, 0, 0], rot: [0, 0, 0], color: '#a0522d' }] };
  const s = { found: [], art: [], apps: [], wardrobe: [], moves: [], studio: { songs: [] }, log: [], stored: [], pictures: [], body: { creativity: 3, curiosity: 3, boredom: 3, loneliness: 3, tidiness: 5, coziness: 5 }, calm: 5, energy: 6, joy: 5, wonder: 5, fullness: 6, tools: [], projects: [], recent: { moves: [] }, today: { done: {} }, furniture: {}, decor: [...['a', 'b', 'c', 'd'].map(thing), shelf] };
  assert.ok(clutter(s) >= 1.5);
  const mv = availableMoves(s, { random: () => 0.5 });
  assert.ok(mv.slice(0, 4).some((m) => m.name === 'move_thing'), mv.map((m) => m.name).join());
  assert.match(mv.find((m) => m.name === 'move_thing').line, /too full.*small wooden shelf/);
});
