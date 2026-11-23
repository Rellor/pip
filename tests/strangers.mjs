// What people leave for Pip in his world (strangers.js): notes from travellers he fetches and learns from, and the
// small deeds of visitors he finds.
import assert from 'node:assert/strict';
import { PARCELS, TRAVELLERS, DROP_PLACES, DEEDS, MAX_LYING, postDrop, lying, dropLines, fetchJob, sweepDrops, learnFrom, takeDeed, findDeed } from '../strangers.js';
import { startOuting, outingTick, canGo } from '../world.js';
import { toAnswer } from '../brain.js';
import { byName } from '../moves.js';
import { TOWN_SPOTS, LIE, ROUTES, townBlocked, TOWN_X } from '../web/town.js';

const ok = (name) => console.log(`ok  ${name}`);
delete process.env.PIP_NO_OUT;
const noon = Date.parse('2026-11-23T11:00:00Z'); // 12:00 in the Netherlands
const HOUR = 3_600_000, MIN = 60_000;
const fresh = (more = {}) => ({ energy: 8, fullness: 8, joy: 5, calm: 5, wonder: 5, boredom: 5, loneliness: 5, body: { creativity: 6 }, weather: { kind: 'clear', temp: 8 }, tools: [], pantry: [], decor: [], log: [], outings: [], visitors: [], curious: { sparks: [], interests: [] }, ...more });

// ---- the list itself
assert.ok(PARCELS.length >= 40 && TRAVELLERS.length >= 10);
for (const [kind, topic, text] of PARCELS) assert.ok(['fact', 'tip', 'opinion'].includes(kind) && topic && text.length > 20 && text.length <= 300 && !/https?:|</.test(text), text);
assert.equal(new Set(PARCELS.map((p) => p[1])).size, PARCELS.length, 'every note is about something else');
for (const [k] of DROP_PLACES) { const sp = TOWN_SPOTS[`drop_${k}`]; assert.ok(sp && LIE[`drop_${k}`] && ROUTES[`drop_${k}`] && !townBlocked(TOWN_X + sp.x, sp.z, 0.2), k); }
for (const k of Object.keys(DEEDS)) assert.ok(LIE[k] && DEEDS[k].found && DEEDS[k].label, k);
ok('notes with true things, tips and opinions; every place a note or a deed can lie is a real spot');

// ---- a traveller leaves a note: not at night, not too many, not too often
const s = fresh();
assert.equal(postDrop(fresh(), Date.parse('2026-11-23T02:00:00Z')), null, 'nobody passes through at night');
const first = postDrop(s, noon);
assert.ok(first && first.status === 'lying' && first.madeUp && TOWN_SPOTS[first.spot] && first.text && first.from && first.who, JSON.stringify(first));
assert.equal(postDrop(s, noon + HOUR), null, 'not again so soon');
const second = postDrop(s, noon + 5 * HOUR);
assert.ok(second && second.spot !== first.spot && second.topic !== first.topic);
assert.equal(postDrop(s, noon + 6 * HOUR), null);
assert.equal(lying(s).length, MAX_LYING);
assert.match(dropLines(s)[0], /Someone left a note for me .* and another one .*fetch_note/);
ok('a traveller leaves a note now and then, at most two lie waiting');

// ---- he walks there, picks it up, reads it
const move = byName('fetch_note');
assert.ok(move.when(s, noon + 5 * HOUR) && move.line(s).length < 240 && !move.when(fresh(), noon));
const step = toAnswer({ moves: [{ move: 'fetch_note', details: {}, thought: 'x' }], reason: 'r', mood: 'calm' }, ['fetch_note']).steps[0];
assert.deepEqual([step.action, step.as], ['go_out', 'fetch_note']);
const job = fetchJob(s);
assert.ok(job.drop === first.id && job.spot === first.spot && canGo(s, 'drops', noon).ok);
const went = startOuting(s, { job }, noon + 5 * HOUR);
assert.ok(went.ok && s.where.place === 'drops' && s.where.spot === first.spot, JSON.stringify(went));
const back = outingTick(s, Date.parse(s.where.homeAt) + MIN);
assert.ok(back.home && back.outing.did.includes(first.text) && back.outing.did.includes(first.from), back.outing.did);
const note = s.visitors.find((v) => v.id === first.id);
assert.ok(note && note.npc && note.stranger && !note.answer && note.text === first.text);
assert.equal(s.drops.find((d) => d.id === first.id).status, 'found');
if (first.kind !== 'opinion') assert.ok(s.curious.sparks.some((x) => x.topic === first.topic), 'what a traveller tells him can become an interest');
ok('fetch_note: he walks to where it lies, and then it is a note he can read and answer');

// ---- he answers and says if he keeps it
const a = toAnswer({ moves: [{ move: 'answer_visitor', details: { id: first.id, text: 'I do not believe that, but I will look it up.', keep: true }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['answer_visitor']);
assert.deepEqual(a.visitor_answers[0], { id: first.id, text: 'I do not believe that, but I will look it up.', keep: true });
assert.equal(toAnswer({ moves: [{ move: 'answer_visitor', details: { id: 'x', text: 'Not for me.', keep: false }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['answer_visitor']).visitor_answers[0].keep, false);
note.answer = 'I do not believe that, but I will look it up.';
const mem = learnFrom(s, note, true, noon + 6 * HOUR);
assert.ok(mem.startsWith(`${first.from} told me: `) && s.learned.length === 1 && s.learned[0].from === first.from && s.learned[0].said === note.answer && note.kept === true);
const other = { id: 'v1', name: 'Anna', text: 'Did you know cats sleep 16 hours a day?', answer: 'That is too much sleep.', npc: false };
assert.equal(learnFrom(s, other, false, noon), null, 'what he lets go, he does not keep');
assert.equal(s.learned.length, 1);
assert.ok(learnFrom(s, { ...other, id: 'v2' }, true, noon) && s.learned.at(-1).who === 'a visitor', 'a real visitor teaches him the same way');
assert.equal(learnFrom(s, { id: 'n1', name: 'Mo (neighbour)', text: 'x', answer: 'y', npc: true }, true, noon), null, 'the neighbours have their own way');
ok('he answers with what he thinks, and what he keeps he has learned');

// ---- a note nobody fetches comes to him by itself
const lines = sweepDrops(s, noon + 12 * HOUR);
assert.ok(lines.length === 1 && /The wind blew a note against my door/.test(lines[0]) && lying(s).length === 0);
ok('a note he never fetched is blown to his door');

// ---- small deeds of visitors
const d = fresh();
assert.equal(takeDeed(d, { id: 'deed-1', deed: 'flower', at: new Date(noon).toISOString() }), true);
assert.equal(takeDeed(d, { id: 'deed-1', deed: 'flower', at: new Date(noon).toISOString() }), false, 'the same file twice');
assert.equal(takeDeed(d, { id: 'deed-2', deed: 'flower', at: new Date(noon).toISOString() }), false, 'one of each kind at a time');
assert.equal(takeDeed(d, { id: 'deed-3', deed: 'rm -rf', at: new Date(noon).toISOString() }), false, 'only deeds from the list');
assert.equal(findDeed(d, noon + 5 * MIN), null, 'not the moment it is done');
const found = findDeed(d, noon + 40 * MIN);
assert.match(found, /flower on my doorstep/);
assert.ok(d.joy > 5 && d.loneliness < 5 && d.deeds[0].status === 'found' && findDeed(d, noon + 50 * MIN) === null);
ok('a small deed lies there until he finds it, and it does him good');
