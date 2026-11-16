// How Pip grows: lessons from failures, a recipe book, a pull towards new things, and soul lines after 3 days.
// Run: node tests/growth.mjs
import assert from 'node:assert/strict';
import { noteLesson, noteWorked, lessonsFor, lessonLines, saveRecipe, markProud, recipesFor, noveltyBoost, topicLoop, freshLines } from '../growth.js';
import { makerPrompt } from '../maker.js';
import { brainPrompt } from '../brain.js';
import { patterns, PATTERN_DAYS } from '../night.js';
import { availableMoves } from '../moves.js';

const ok = (name, fn) => { fn(); console.log(`ok  ${name}`); };
const now = Date.parse('2026-11-16T12:00:00Z');
const ago = (h) => new Date(now - h * 3_600_000).toISOString();

ok('A. a failure becomes a lesson, the same one is counted, and it is learned when the move works', () => {
  const s = {};
  noteLesson(s, 'record_song', 'the song had no part with at least 2 sounding notes (for example voice "C4")', ago(3));
  noteLesson(s, 'record_song', 'the song had no part with at least 2 sounding notes (for example voice "C4")', ago(2));
  noteLesson(s, 'walk_to', 'blocked', ago(1)); // walking is not a lesson
  assert.equal(s.lessons.length, 1);
  assert.equal(s.lessons[0].count, 2);
  assert.match(lessonsFor(s, 'record_song', now)[0], /went wrong 2 times/);
  assert.equal(lessonLines(s, ['record_song'], now).length, 1);
  noteWorked(s, 'record_song', ago(0.5));
  assert.match(lessonsFor(s, 'record_song', now)[0], /got past this/);
  const p = makerPrompt({ soul: 'I am Pip.', step: { action: 'record_song', details: { what: 'a song' } }, rules: '', lessons: lessonsFor(s, 'record_song', now) });
  assert.match(p, /WHAT WENT WRONG BEFORE/);
});

ok('B. things that worked go in the recipe book; alike and proud ones come first', () => {
  const s = {};
  const parts = [{ shape: 'box', size: [0.2, 0.1, 0.2], pos: [0, 0.05, 0], color: '#a0522d', extra: 'x' }];
  saveRecipe(s, { kind: 'decorate', name: 'little lamp', why: 'light for reading', parts, at: ago(5) });
  saveRecipe(s, { kind: 'decorate', name: 'wooden music box', why: 'to play tunes', parts, at: ago(4) });
  saveRecipe(s, { kind: 'record_song', name: 'Rain hum', song: 'Rain hum (tempo 80, voice)', at: ago(3) });
  assert.equal(s.recipes[0].parts[0].extra, undefined, 'only the shape data is kept');
  const r = recipesFor(s, 'decorate', 'a bigger music box');
  assert.match(r[0], /music box/);
  markProud(s, 'little lamp');
  assert.match(recipesFor(s, 'change_thing', 'something')[0], /little lamp.*proud/);
  assert.equal(recipesFor(s, 'record_song', 'rain')[0].startsWith('"Rain hum"'), true);
  for (let i = 0; i < 30; i++) saveRecipe(s, { kind: 'decorate', name: `thing ${i}`, parts, at: ago(2 - i / 100) });
  assert.ok(s.recipes.some((x) => x.name === 'little lamp'), 'proud recipes are kept');
  assert.ok(s.recipes.length <= 22);
});

ok('C. never-done moves are more inviting, and a topic filling his thoughts is noticed', () => {
  assert.equal(noveltyBoost({ ever: {} }, 'draw'), 1.6);
  assert.equal(noveltyBoost({ ever: { draw: 1 } }, 'draw'), 1.25);
  assert.equal(noveltyBoost({ ever: { draw: 9 } }, 'draw'), 1);
  assert.equal(noveltyBoost({ ever: {} }, 'do'), 1);
  const s = { thoughts: Array.from({ length: 12 }, (_, i) => ({ at: ago(i / 3), text: i % 4 ? 'the gears of my music box' : 'a cloud' })), ever: { decorate: 5 } };
  assert.equal(topicLoop(s, now), 'gears');
  const lines = freshLines(s, ['draw', 'decorate'], now);
  assert.match(lines[0], /"gears" for hours/);
  assert.match(lines[1], /never tried: drawing/);
  const p = brainPrompt({ soul: 'I am Pip.', now: 'now', feelings: [], doing: [], events: [], messages: [], memories: [], projects: [], moves: [], fresh: lines, lessons: ['recording a song: no notes'] });
  assert.match(p, /SOMETHING I NOTICE ABOUT MYSELF/);
  assert.match(p, /LESSONS I LEARNED/);
  const body = { creativity: 6, curiosity: 5, boredom: 3, loneliness: 3, tidiness: 5, coziness: 5 };
  const st = { body, calm: 5, energy: 6, joy: 5, wonder: 5, fullness: 6, tools: [{ name: 'drawing supplies', kind: 'drawing supplies' }], decor: [], projects: [], recent: { moves: [] }, today: { done: {} }, furniture: {}, ever: { play_piano: 50, read_book: 50, search_web: 50 } };
  assert.ok(availableMoves(st, { random: () => 0.5 }).length >= 6);
});

ok(`D. a pattern seen on ${PATTERN_DAYS} days can become a soul line`, () => {
  const day = (d) => ({ day: d, lifted: ['decorate'], lowered: [], most: ['decorate'], kinds: ['make'], mood: 'curious', unfinished: [] });
  assert.equal(patterns([day('a'), day('b')]).length, 0);
  assert.ok(patterns([day('a'), day('b'), day('c')]).some((p) => p.key === 'lifted:decorate'));
});

ok('light: in the evening he notices dark places and that a lamp would help; at noon he does not', async () => {
  const { darkLines } = await import('../growth.js');
  const s = { decor: [], furniture: {}, weather: { kind: 'clear' } };
  const noon = Date.parse('2026-11-16T12:00:00Z');
  const evening = Date.parse('2026-11-16T19:00:00Z');
  assert.equal(darkLines(s, noon).length, 0);
  assert.match(darkLines(s, evening)[0] ?? '', /dark.*lamp/);
});
