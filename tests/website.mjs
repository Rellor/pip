// Pip's own website (site.js): he makes it at the internet café and works on it there. What he writes is never
// trusted: no scripts, no forms, nothing from other sites, only his own pictures and plain links.
import assert from 'node:assert/strict';
import { cleanSite, siteText, siteProblem, buildSite, siteMaterial, SITE_FILE, SITE_CHANGES_PER_DAY, MAX_SITE_BYTES, SITE_CHECKLIST } from '../site.js';
import { byName, MAKER_MOVES } from '../moves.js';
import { toAnswer } from '../brain.js';
import { makerPrompt, FORMATS } from '../maker.js';
import { dayLimits } from '../limits.js';

const ok = (name) => console.log(`ok  ${name}`);
const now = Date.parse('2026-11-27T11:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const page = (body, style = 'body{color:#333}') => `<!doctype html><html><head><title>Pip</title><style>${style}</style></head><body><h1>Pip was here</h1><p>I am Pip. I live in a small village with a pond, a library and an internet café, and I am writing this page there right now, on a keyboard that sticks a little.</p><p>I make things, I draw, I say what I think, and I will change my mind about most of it.</p>${body}</body></html>`;

// ---- nothing dangerous is left in the page
{
  const dirty = page(`<script>alert(1)</script><script src="https://evil.example/x.js"></script><img src="https://evil.example/track.png"><img src="made/art1.svg" alt="my owl" onerror="alert(2)"><img src="../photos/pic3.jpg"><img src="made/../../state.json"><a href="javascript:alert(3)" onclick="steal()">click</a><a href="https://en.wikipedia.org/wiki/Moon">the Moon</a><a href="#top">up</a><a href="made/app1.html">my program</a><iframe src="https://evil.example"></iframe><form action="https://evil.example"><input name="key"><button>go</button></form><link rel="stylesheet" href="https://evil.example/s.css"><meta http-equiv="refresh" content="0;url=https://evil.example"><p onmouseover="x()">hello</p>`, '@import url(https://evil.example/a.css); body{background:url(https://evil.example/b.png)}');
  const html = cleanSite(dirty);
  assert.ok(html, 'still a page');
  for (const bad of ['<script', 'alert(', 'evil.example', 'javascript:', 'onclick', 'onerror', 'onmouseover', '<iframe', '<form', '<input', '<button', '<link', 'http-equiv', '@import', 'state.json']) assert.ok(!html.includes(bad), `"${bad}" is still in the page`);
  assert.match(html, /<img src="made\/art1\.svg" alt="my owl" loading="lazy">/, 'his own drawing stays');
  assert.match(html, /<img src="photos\/pic3\.jpg"/, 'and his own photo (the path is made plain)');
  assert.match(html, /<a href="https:\/\/en\.wikipedia\.org\/wiki\/Moon" target="_blank" rel="noopener noreferrer nofollow">the Moon<\/a>/, 'a plain link opens in a new tab');
  assert.match(html, /<a href="#top">up<\/a>/);
  assert.match(html, /<a>my program<\/a>/, 'any other link goes nowhere');
  assert.match(html, /<p>hello<\/p>/);
  assert.equal(cleanSite('<p>hi</p>'), null, 'too small to be a page');
  assert.equal(cleanSite(page(`<p>${'x'.repeat(MAX_SITE_BYTES)}</p>`)), null, 'too big');
  assert.equal(cleanSite('just some words '.repeat(40)), null, 'not HTML');
  assert.equal(cleanSite(null), null);
}
ok('his page is cleaned: no scripts, no forms, nothing from other sites, only his own pictures and plain links');

// ---- a home page says something
assert.equal(siteProblem(cleanSite(page(''))), null);
assert.match(siteProblem(cleanSite(`<html><body><h2>hello</h2><p>${'word '.repeat(60)}</p></body></html>`)), /no heading/);
assert.match(siteProblem(cleanSite(`<html><head><style>${'a{color:red}'.repeat(30)}</style></head><body><h1>Pip</h1><p>Hello there.</p></body></html>`)), /says almost nothing/);
assert.ok(!siteText(page('')).includes('color') && siteText(page('')).startsWith('Pip was here I am Pip.'), siteText(page('')));
ok('a page needs a heading and something to read');

// ---- making it, and changing it
{
  const s = {};
  const made = buildSite(s, { title: 'Pip was here', why: 'I want a place of my own', html: page('<script>x()</script>') }, null, now);
  assert.ok(!made.failed && !made.html.includes('<script') && made.site.v === 1 && made.site.title === 'Pip was here' && made.site.file === SITE_FILE && made.site.words > 40 && made.site.changes[0].change === 'the first version', JSON.stringify(made.site));
  s.site = made.site;
  const edit = buildSite(s, { change: 'a line about today', edits: [{ find: '<p>I make things', replace: '<p>Today I went outside. It was fine.</p><p>I make things' }] }, made.html, now + 3_600_000);
  assert.ok(!edit.failed && edit.site.v === 2 && edit.html.includes('Today I went outside') && edit.site.createdAt === made.site.createdAt && edit.site.changes.at(-1).change === 'a line about today' && edit.site.title === 'Pip was here', JSON.stringify(edit.site ?? edit));
  s.site = edit.site;
  assert.match(buildSite(s, { change: 'x', edits: [{ find: 'this is not on the page', replace: 'y' }] }, edit.html, now + 2 * 3_600_000).failed, /my edit did not fit/);
  assert.match(buildSite(s, { change: 'nothing' }, edit.html, now + 2 * 3_600_000).failed, /did not write what changes/);
  assert.match(buildSite(s, { change: 'the same', html: edit.html }, edit.html, now + 2 * 3_600_000).failed, /nothing changed/);
  assert.match(buildSite(s, { change: 'all gone', html: '<html><body><h1>Pip</h1><p>Hi.</p><p>' + 'x'.repeat(200) + '</p></body></html>' }, edit.html, now + 2 * 3_600_000).failed, /says almost nothing/);
  const third = buildSite(s, { change: 'a whole new page', html: page('<h2>New</h2><p>I redid it.</p>') }, edit.html, now + 2 * 3_600_000);
  assert.ok(!third.failed && third.site.v === 3);
  s.site = third.site;
  assert.match(buildSite(s, { change: 'one more', html: page('<p>more</p>') }, third.html, now + 3 * 3_600_000).failed, /enough for today/, 'the first version and two changes in one day');
  assert.ok(!buildSite(s, { change: 'next day', html: page('<p>a new day</p>') }, third.html, now + 26 * 3_600_000).failed);
  assert.equal(dayLimits({ site: s.site, log: [], decor: [], pictures: [], found: [], art: [], apps: [], wardrobe: [], moves: [], cookedAt: [], studio: { songs: [] } }, now + 3 * 3_600_000).update_site.used, SITE_CHANGES_PER_DAY);
  assert.match(buildSite({}, { title: 'x' }, null, now).failed, /did not write the page/);
}
ok('he makes his website once, changes it with small edits, at most a few times a day');

// ---- what he can write about is true, and from his own life
{
  const s = { self: 'I am dry and honest.', favorites: [{ what: 'the pond at dusk' }], beliefs: [{ text: 'Making things lifts me' }], gallery: [{ id: 'a1', name: 'grumpy owl', file: 'made/art1.svg', at: iso(now - 3_600_000) }, { id: 'a2', name: 'not yet', file: 'made/art2.svg', at: iso(now + 3_600_000) }], decor: [{ name: 'tall lamp' }, { name: 'giant clock', kind: 'outside' }, { name: 'photo', image: 'x.jpg' }], apps: [{ name: 'night_sky', title: 'Night Sky' }], studio: { songs: [{ name: 'quiet night song' }] }, log: [{ action: 'write_diary', text: 'Too much room and not enough quiet.' }, { action: 'search_web', opened: { title: 'Moon', url: 'https://en.wikipedia.org/wiki/Moon' }, opinion: { says: 'A slow way to leave.' } }], asks: [{ item: 'a telescope', status: 'open' }] };
  const m = siteMaterial(s, now);
  for (const re of [/I am dry and honest/, /the pond at dusk/, /Making things lifts me/, /"grumpy owl" FILE made\/art1\.svg/, /tall lamp; giant clock \(it stands outside\)/, /Night Sky/, /quiet night song/, /Too much room/, /https:\/\/en\.wikipedia\.org\/wiki\/Moon: "A slow way to leave\."/, /a telescope/, /internet café/]) assert.match(m, re);
  assert.ok(!m.includes('not yet') && !m.includes('x.jpg'), 'nothing from the future, no pictures that are not his');
  assert.match(siteMaterial({}, now), /My world: a small village square/);
}
ok('he writes about true things from his own life: himself, what he made, read and wants');

// ---- the moves, and what the maker is told
{
  const s0 = { body: { creativity: 6 }, today: { done: {} } };
  const make = byName('make_site'), update = byName('update_site');
  assert.ok(MAKER_MOVES.includes('make_site') && MAKER_MOVES.includes('update_site'));
  assert.ok(make.when(s0, now) && make.line(s0).length < 240 && /my own website at the internet café/.test(make.line(s0)), make.line(s0));
  assert.equal(Boolean(update.when(s0, now)), false, 'nothing to work on yet');
  const s1 = { ...s0, site: { title: 'Pip was here', v: 3, createdAt: iso(now - 50 * 3_600_000), updatedAt: iso(now - 30 * 3_600_000), changes: [{ v: 1, at: iso(now - 50 * 3_600_000), change: 'the first version' }] }, log: [], decor: [], pictures: [], found: [], art: [], apps: [], wardrobe: [], moves: [], cookedAt: [], studio: { songs: [] } };
  assert.equal(Boolean(make.when(s1, now)), false, 'he has one already');
  assert.ok(update.when(s1, now) && update.line(s1).length < 240 && /"Pip was here", version 3/.test(update.line(s1)), update.line(s1));
  assert.ok(update.score(s1, now) > update.score({ ...s1, site: { ...s1.site, updatedAt: iso(now - 3_600_000) } }, now), 'a page he has not touched for a day pulls more');
  const a = toAnswer({ moves: [{ move: 'make_site', details: { title: 'Pip was here', what: 'who I am and what I made', why: 'a place of my own' }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['make_site']).steps[0];
  assert.deepEqual([a.action, a.make, a.details.title], ['make_site', true, 'Pip was here']);
  const u = toAnswer({ moves: [{ move: 'update_site', details: { change: 'add my new hill', why: 'I am proud of it' }, thought: 'x' }], reason: 'r', mood: 'calm' }, ['update_site']).steps[0];
  assert.deepEqual([u.action, u.make, u.details.change], ['update_site', true, 'add my new hill']);
  assert.ok(FORMATS.make_site.includes('"html"') && FORMATS.update_site.includes('"edits"'));
  const first = makerPrompt({ soul: 'I am Pip.', step: a, rules: '', site: siteMaterial({ self: 'I am dry.' }, now) });
  assert.ok(first.includes(SITE_CHECKLIST) && /No scripts at all/.test(first) && /WHAT I CAN WRITE ABOUT/.test(first) && /I am dry\./.test(first) && first.includes(FORMATS.make_site), 'the maker hears the rules for a website and what he can write about');
  const later = makerPrompt({ soul: 'I am Pip.', step: u, rules: '', build: '<h1>Pip was here</h1>', site: 'WHAT I CAN WRITE ABOUT' });
  assert.ok(/WHAT I CHANGE ON MY WEBSITE NOW: add my new hill/.test(later) && /MY WEBSITE AS IT IS NOW\n<h1>Pip was here<\/h1>/.test(later) && later.includes(FORMATS.update_site), later.slice(0, 300));
  assert.ok(!/MY CHECKLIST FOR A PROGRAM/.test(first), 'not the rules for a program');
}
ok('make_site and update_site: moves of their own, with their own rules for the maker');
