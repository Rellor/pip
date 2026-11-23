// What the game and the page share (web/street.js): the grocery store, the hour, the real moon, and Pip's own face.
// The five neighbours, their faces and the old picture of his street are gone from it.
// Run: node tests/street.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as street from '../web/street.js';
import { shopOpen, hourNL, moonPhase, moonWord, nextFullMoon, faceSvg, faceInner, CATALOGUE, OPEN_FROM, OPEN_TO } from '../web/street.js';
import { CATALOGUE as SHOP } from '../shop.js';

const ok = (name) => console.log(`ok  ${name}`);
const noon = Date.parse('2026-11-23T11:00:00Z'); // Monday 12:00 in Amsterdam

// ---- one story for the game and the page
assert.equal(SHOP, CATALOGUE);
assert.ok(CATALOGUE.length > 20 && CATALOGUE.every((c) => c.item && c.price >= 1 && c.kind));
assert.deepEqual([OPEN_FROM, OPEN_TO, shopOpen(noon), shopOpen(noon + 14 * 3_600_000)], [0, 24, true, true], 'the grocery store is always open');
assert.equal(hourNL(noon), 12);
ok('the game and the page read the same grocery store and the same clock');

// ---- the neighbours are gone from it: no people, no hearts, no houses in a row
for (const gone of ['PEOPLE', 'personOf', 'warmthWord', 'hearts', 'nextStep', 'SCENES', 'sceneOf', 'SPOTS', 'STREET_SIZE', 'streetSvg']) assert.equal(street[gone], undefined, `${gone} is gone`);
const source = fs.readFileSync(new URL('../web/street.js', import.meta.url), 'utf8');
assert.ok(!/\b(Mo|Lina|Oma Jo|Dot|Kees)\b|bakery/.test(source), 'nobody is named in it any more');
ok('no neighbours, no faces of theirs, and no picture of the old street');

// ---- his own face is still a whole little picture (the page draws it on his postcards)
for (const name of ['Pip', 'nobody', undefined]) assert.ok(faceSvg(name).startsWith('<svg') && faceSvg(name).endsWith('</svg>') && !/NaN|undefined/.test(faceSvg(name)));
assert.ok(faceInner('Pip').includes('<circle') && faceInner('Pip') === faceInner() && faceSvg('Pip', 40).includes('width="40"'));
ok('Pip\'s face');

// ---- the sky
assert.ok(Math.abs(moonPhase(Date.UTC(2000, 0, 21, 4, 40)) - 0.5) < 0.02);
const full = nextFullMoon(noon);
assert.ok(full > noon && full - noon < 30 * 86_400_000 && Math.abs(moonPhase(full) - 0.5) < 0.01);
assert.deepEqual([moonWord(0.5), moonWord(0)], ['full moon', 'new moon']);
ok('the real moon');
