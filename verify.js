// The game checks what Pip makes, before it is built: facts a ruler, a pair of eyes or a test run can see.
// Research (Voyager; Huang et al. 2024): a model that judges its own work often makes it worse, but one retry with
// real facts from outside (an error message, a measurement) helps a lot. So this file only measures; it never asks a model.
// Each check returns a list of short facts in Pip's words (empty when nothing is wrong). pip.js gives the maker one
// retry with them (at most a few a day), and keeps the better try.
import { cleanSvg } from './art.js';
import { cleanParts } from './decor.js';
import { settle } from './build.js';
import { behaviorProblem } from './behaviors.js';
import { cleanApp, applyEdits } from './apps.js';

export const MAX_REVISIONS_PER_DAY = 5;
const DAY = 86_400_000;
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

// ---- Drawings
const SHAPES = ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text'];
// The shapes of a cleaned SVG: [{ tag, a: {attr: value}, box: [x0, y0, x1, y1] | null }]. A box is null when it cannot be told simply.
export function svgShapes(svg) {
  const out = [];
  for (const m of String(svg).matchAll(/<(rect|circle|ellipse|line|polyline|polygon|path|text)\b([^>]*)>/g)) {
    const a = Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1].toLowerCase(), x[2]]));
    let box = null;
    const n = (k, d = 0) => num(a[k]) ?? d;
    if (m[1] === 'rect') box = [n('x'), n('y'), n('x') + (String(a.width).endsWith('%') ? Infinity : n('width')), n('y') + (String(a.height).endsWith('%') ? Infinity : n('height'))];
    else if (m[1] === 'circle') box = [n('cx') - n('r'), n('cy') - n('r'), n('cx') + n('r'), n('cy') + n('r')];
    else if (m[1] === 'ellipse') box = [n('cx') - n('rx'), n('cy') - n('ry'), n('cx') + n('rx'), n('cy') + n('ry')];
    else if (m[1] === 'line') box = [Math.min(n('x1'), n('x2')), Math.min(n('y1'), n('y2')), Math.max(n('x1'), n('x2')), Math.max(n('y1'), n('y2'))];
    else if (m[1] === 'text') box = [n('x'), n('y') - 12, n('x') + 60, n('y')];
    else {
      const src = m[1] === 'path' ? a.d : a.points;
      const absolute = m[1] !== 'path' || !/[a-y]/.test(String(src ?? '').replace(/e[-+]?\d/gi, '')); // lower-case path commands are relative: no simple box
      const nums = absolute ? (String(src ?? '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number) : [];
      if (nums.length >= 4 && m[1] !== 'path') { const xs = nums.filter((_, i) => i % 2 === 0); const ys = nums.filter((_, i) => i % 2 === 1); box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
      else if (nums.length >= 4 && !/[HhVvAa]/.test(String(src))) { const xs = nums.filter((_, i) => i % 2 === 0); const ys = nums.filter((_, i) => i % 2 === 1); box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
    }
    if (a.transform) box = null;
    out.push({ tag: m[1], a, box });
  }
  return out;
}
const SUBJECT_STOP = new Set('the a an of at in on my for and with from over under small little tiny quiet first version sketch drawing picture study'.split(' '));
export const subjectWords = (t) => String(t ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !SUBJECT_STOP.has(w));
// How often a subject was drawn lately: [{ word, n }] for words in at least 3 of his last 12 drawings.
export function drawnOften(art = []) {
  const last = art.slice(-12);
  const count = {};
  for (const a of last) for (const w of new Set(subjectWords(a.name))) count[w] = (count[w] ?? 0) + 1;
  return Object.entries(count).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).map(([word, n]) => ({ word, n }));
}

export function checkDrawing(details, { art = [] } = {}) {
  const facts = [];
  const clean = cleanSvg(details?.svg);
  if (!clean) return ['the drawing could not be read: it must be one <svg viewBox="0 0 400 300"> with only plain shapes (rect, circle, ellipse, line, polyline, polygon, path, text), under 12000 characters'];
  const vb = /viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(clean.svg);
  const [x0, y0, w, h] = vb ? vb.slice(1).map(Number) : [0, 0, 400, 300];
  const all = svgShapes(clean.svg);
  const isBack = (s) => s.tag === 'rect' && s.box && s.box[2] - s.box[0] >= w * 0.9 && s.box[3] - s.box[1] >= h * 0.9;
  const shapes = all.filter((s) => !isBack(s));
  if (shapes.length < 3) facts.push(`it has only ${shapes.length} shape${shapes.length === 1 ? '' : 's'}${all.length > shapes.length ? ' (besides a background)' : ''}: it will look empty. The thing itself needs at least 5 or 6 shapes (its outline, its parts, a detail or two)`);
  const boxes = shapes.map((s) => s.box).filter((b) => b && b.every(Number.isFinite));
  if (boxes.length >= Math.max(2, shapes.length * 0.6)) {
    const u = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
    const bw = Math.min(u[2], x0 + w) - Math.max(u[0], x0);
    const bh = Math.min(u[3], y0 + h) - Math.max(u[1], y0);
    if (bw <= 0 || bh <= 0) facts.push(`it is outside the paper: the paper goes from x ${x0} to ${x0 + w} and y ${y0} to ${y0 + h}`);
    else if (bw < w * 0.35 && bh < h * 0.35) facts.push(`it is small: about ${Math.round(bw)} x ${Math.round(bh)} on a paper of ${w} x ${h}. I draw it big, about ${Math.round(w * 0.6)} wide or ${Math.round(h * 0.7)} high, in the middle`);
    else if (u[0] < x0 - w * 0.15 || u[1] < y0 - h * 0.15 || u[2] > x0 + w * 1.15 || u[3] > y0 + h * 1.15) facts.push(`part of it falls off the paper (x ${Math.round(u[0])} to ${Math.round(u[2])}, y ${Math.round(u[1])} to ${Math.round(u[3])}; the paper is ${w} x ${h})`);
  }
  const fills = new Set(shapes.map((s) => String(s.a.fill ?? '').toLowerCase()).filter((f) => /^#[0-9a-f]{3,8}$/.test(f) && !/^#f{3,6}$/.test(f)));
  if (fills.size > 5) facts.push(`style: it uses ${fills.size} colours; my sketchbook style is ink lines with one or two colours`);
  const often = drawnOften(art);
  const mine = new Set(subjectWords(`${details?.name ?? ''} ${details?.what ?? ''}`));
  const again = often.filter((o) => mine.has(o.word));
  if (again.length) facts.push(`I have drawn "${again[0].word}" ${again[0].n} times lately. This time I draw a different thing from my day`);
  return facts;
}

// ---- Things made of parts (decorate, change_thing, extend_thing, make_clothes)
export function checkThing(details, { maxParts = 40, action = 'decorate' } = {}) {
  const facts = [];
  const parts = cleanParts(details?.parts);
  if (!parts) return ['the parts could not be read: "parts" is a list like [{"shape": "box", "size": [0.4, 0.05, 0.3], "pos": [0, 0.5, 0], "color": "#aa7744"}]'];
  if (action === 'extend_thing') return facts;
  const name = String(details?.name ?? details?.what ?? 'it');
  if (parts.length < 3 && maxParts >= 6 && action !== 'make_clothes') facts.push(`it has only ${parts.length} part${parts.length === 1 ? '' : 's'}: it will look like a plain block. A real ${name} has more to it (I can use up to ${maxParts} parts: its body, what it stands on, a detail or two)`);
  const st = settle(parts, { kind: details?.wall || /wall/.test(String(details?.where ?? '')) ? 'wall' : 'floor' });
  if (st.fixes.length >= 2) facts.push(`parts did not touch: ${st.fixes.join(', and ')}. Every part rests on the floor or touches another part (a top sits ON its legs: the legs are as tall as the top is high)`);
  const colors = new Set(parts.map((p) => p.color));
  if (parts.length >= 5 && colors.size === 1) facts.push('style: every part has the same colour; two or three colours show what is what');
  const b = behaviorProblem({ name, why: details?.why, parts, kind: 'floor', uses: details?.uses });
  if (b && /glows|wheels/.test(b)) facts.push(b);
  const ys = parts.map((p) => p.pos[1] - (p.shape === 'cylinder' ? (p.size[2] ?? 0.1) : p.shape === 'sphere' ? p.size[0] * 2 : (p.size[1] ?? p.size[0])) / 2);
  if (action === 'decorate' && Math.min(...ys) > 0.3) facts.push(`its lowest part starts ${Math.round(Math.min(...ys) * 100) / 100} m up: positions are measured from the bottom of the thing (y 0 is where it stands)`);
  return facts;
}

// ---- Programs and games: what cannot work in his computer's locked box, seen by reading the file
export function checkAppText(html) {
  const facts = [];
  const t = String(html ?? '');
  if (!cleanApp(t)) return ['the program is not a web page I can run (one file of HTML under 120 KB)'];
  if (/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/.test(t)) facts.push('it uses storage (localStorage, cookies): my computer has none, the program crashes there. I keep things in variables');
  if (/\b(fetch\s*\(|XMLHttpRequest|WebSocket|importScripts|navigator\.sendBeacon)/.test(t) || /<script[^>]+\bsrc\s*=/i.test(t) || /<link[^>]+href\s*=/i.test(t) || /(src|href)\s*=\s*["']https?:/i.test(t) || /@import|url\(\s*["']?https?:/i.test(t)) facts.push('it loads something from the internet (a script, a font, a picture or data): my computer has no internet. Everything is in this one file');
  if (/\b(alert|prompt|confirm)\s*\(/.test(t)) facts.push('it uses alert, prompt or confirm: they do not work in my computer. I show messages on the page');
  if (!/<script\b/i.test(t)) facts.push('it has no script: nothing can happen in it');
  if (/<script\b/i.test(t) && !/addEventListener|on(click|key|mouse|touch|pointer|input|change)\s*=/i.test(t) && !/requestAnimationFrame|setInterval|setTimeout/.test(t)) facts.push('nothing in it listens to clicks or keys and nothing moves by itself: it only stands still');
  return facts;
}
// What a test run saw (photo.js testHtml) as facts.
export function checkAppRun(test) {
  if (!test || test.failed) return [];
  const facts = (test.errors ?? []).slice(0, 3).map((e) => `when I ran it, it gave this error: ${e}`);
  if (test.blank) facts.push('when I ran it, the page stayed empty: nothing to see');
  else if (test.still) facts.push('when I ran it, nothing moved and nothing happened when I clicked or pressed keys (arrows, space, enter)');
  if (test.overflow) facts.push(`it is wider than the screen (${test.overflow} wide): it must fit a small screen too (width 100%, max-width)`);
  return facts;
}

// The whole check for one made step. opts: { art, maxParts, current (the program's file now), test: async (html) => result }.
export async function checkMade(action, details, opts = {}) {
  if (action === 'draw') return checkDrawing(details, opts);
  if (['decorate', 'change_thing', 'extend_thing', 'make_clothes'].includes(action)) return details?.parts ? checkThing(details, { ...opts, action }) : [];
  if (action === 'make_app' || action === 'update_app') {
    let html = details?.html;
    if (action === 'update_app' && Array.isArray(details?.edits) && details.edits.length && opts.current) {
      const e = applyEdits(opts.current, details.edits);
      if (e.failed) return [`my edit did not fit: ${e.failed}`];
      html = e.html;
    }
    if (!html) return action === 'update_app' ? ['I gave no edits and no file: "edits" is a list of {find, replace}'] : ['there is no "html"'];
    const facts = checkAppText(html);
    if (opts.test && !facts.some((f) => /not a web page/.test(f))) facts.push(...checkAppRun(await opts.test(html)));
    return facts;
  }
  return [];
}

// A fact that starts with "style:" is a matter of taste: it is told along with real problems, but is no reason for a retry by itself.
export const serious = (facts) => facts.filter((f) => !f.startsWith('style:'));
// One retry with the facts, and the better try is kept. check(made) -> facts; retry(facts) -> a second try (or null).
export async function withOneRetry(first, { check, retry, allowed = true }) {
  const facts = await check(first);
  if (!serious(facts).length || !allowed) return { made: first, facts, tries: 1 };
  const second = await retry(facts);
  if (!second) return { made: first, facts, tries: 1 };
  const facts2 = await check(second);
  return serious(facts2).length <= serious(facts).length ? { made: second, facts: facts2, tries: 2, before: facts } : { made: first, facts, tries: 2, before: facts };
}

// How many retries are left today (they use the big model, which is scarce).
export function revisionsLeft(s, now = Date.now()) {
  s.revisions = (s.revisions ?? []).filter((t) => now - Date.parse(t) < DAY);
  return Math.max(0, MAX_REVISIONS_PER_DAY - s.revisions.length);
}
export const noteRevision = (s, now = Date.now()) => { s.revisions = [...(s.revisions ?? []), new Date(now).toISOString()]; };
// The words added to the maker's prompt for the one retry.
export function revisionNote(first, facts) {
  const shown = JSON.stringify(first ?? {});
  return `\n\nMY FIRST TRY\n${shown.length > 60_000 ? `${shown.slice(0, 60_000)}…` : shown}\n\nWHAT THE CHECK FOUND IN IT (measured facts, not opinions)\n${facts.map((f) => `- ${f}`).join('\n')}\n\nI fix exactly these things and keep what was good. I answer again, complete, in the same JSON shape.`;
}
