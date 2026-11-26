// Pip's own website. He makes it at the internet café (make_site) and works on it there (update_site): one page of
// HTML and CSS that is his home on the internet, for anyone who visits. The page of his world shows it in a locked box.
//
// It is written by a model, and he reads the open web, so nothing in it is trusted: no scripts at all (they are taken
// out), no forms, nothing loaded from other sites. His own pictures are allowed (his drawings and photos), and plain
// links to pages on the web. What is left is words, colours and his own pictures: safe to show to anybody.
import { applyEdits } from './apps.js';
import { isToday } from './days.js';

export const SITE_FILE = 'made/site.html'; // under web/ (the loop saves web/made)
export const MAX_SITE_BYTES = 60_000;
export const MIN_SITE_WORDS = 40; // a home page says something
export const SITE_CHANGES_PER_DAY = 2;

const OWN_PICTURE = /^(?:\.\.\/|\.\/|\/)?((?:made|photos|gifts)\/[\w.-]+\.(?:svg|png|jpe?g|webp|gif))$/i;

// The cleaned page, or null when it is no page at all (too small, too big, not HTML).
export function cleanSite(raw) {
  if (typeof raw !== 'string') return null;
  let html = raw.trim();
  if (html.length < 200 || Buffer.byteLength(html) > MAX_SITE_BYTES || !/<(h1|h2|p|body|main|section)\b/i.test(html)) return null;
  html = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '') // no scripts, ever
    .replace(/<\/?script\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '') // no redirects, no changing the safety rules
    .replace(/<\/?(base|iframe|frame|frameset|object|embed|link|form|input|button|textarea|select|option|audio|video|source|track|canvas|noscript|applet|portal)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '') // no onclick, onload ...
    .replace(/@import[^;]*;?/gi, '') // nothing loaded from elsewhere, also not by the style sheet
    .replace(/url\(\s*(['"]?)\s*(?:https?:)?\/\/[^)]*\)/gi, 'none');
  // pictures: only his own (a drawing, a photo, a gift); any other picture is taken out
  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    const own = src ? OWN_PICTURE.exec((src[2] ?? src[3] ?? '').trim()) : null;
    if (!own) return '';
    const alt = /\salt\s*=\s*("[^"]*"|'[^']*')/i.exec(tag)?.[1] ?? '""';
    const style = /\sstyle\s*=\s*("[^"]*"|'[^']*')/i.exec(tag)?.[1];
    const cls = /\sclass\s*=\s*("[^"]*"|'[^']*')/i.exec(tag)?.[1];
    return `<img src="${own[1]}" alt=${alt}${cls ? ` class=${cls}` : ''}${style ? ` style=${style}` : ''} loading="lazy">`;
  });
  // links: a place on his own page, or a plain page on the web (opened in a new tab); anything else goes nowhere
  html = html.replace(/<a\b([^>]*)>/gi, (tag, attrs) => {
    const href = (/\shref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs) ?? []).slice(2).find((v) => v !== undefined)?.trim() ?? '';
    const rest = attrs.replace(/\s(href|target|rel)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    if (/^#[\w-]*$/.test(href)) return `<a href="${href}"${rest}>`;
    if (/^https?:\/\/[^\s"'<>]+$/i.test(href)) return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow"${rest}>`;
    return `<a${rest}>`;
  });
  return html;
}

// The words a visitor reads (no tags, no style sheet).
export const siteText = (html) => String(html ?? '').replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ').replace(/<title\b[\s\S]*?<\/title\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// What is wrong with a cleaned page as a home page (in his words), or null.
export function siteProblem(html) {
  const words = siteText(html).split(' ').filter(Boolean).length;
  if (!/<h1\b/i.test(html)) return 'my page has no heading: it needs my name or its title in an <h1>';
  if (words < MIN_SITE_WORDS) return `my page says almost nothing (${words} words): a home page tells who I am and shows something of mine`;
  return null;
}

// Making the page, or changing it. `d` is what the maker answered: { title, why, html } or { change, edits } (or html again).
// Returns { html, site } (the new file and his new record of it) or { failed }.
export function buildSite(s, d = {}, before = null, now = Date.now()) {
  const old = s.site ?? null;
  const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  if (old && (old.changes ?? []).filter((c) => isToday(c.at, now)).length >= SITE_CHANGES_PER_DAY + (isToday(old.createdAt, now) ? 1 : 0)) return { failed: 'I have worked on my website enough for today' };
  const edited = Array.isArray(d.edits) && d.edits.length && before ? applyEdits(before, d.edits) : null; // small edits, like a coder
  if (edited?.failed) return { failed: `my edit did not fit: ${edited.failed}` };
  if (!edited && typeof d.html !== 'string') return { failed: old ? 'I did not write what changes on my page' : 'I did not write the page' };
  const html = cleanSite(edited ? edited.html : d.html);
  if (!html) return { failed: 'the page did not work out (too small, too big, or not a web page)' };
  const wrong = siteProblem(html);
  if (wrong) return { failed: wrong };
  if (old && before && html === before) return { failed: 'nothing changed on my page' };
  const at = new Date(now).toISOString();
  const v = (old?.v ?? 0) + 1;
  const site = {
    title: clip(d.title, 60) || old?.title || /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, '').trim().slice(0, 60) || 'Pip’s website',
    file: SITE_FILE, why: clip(d.why, 200) || old?.why || '', createdAt: old?.createdAt ?? at, updatedAt: at, v,
    words: siteText(html).split(' ').filter(Boolean).length,
    changes: [...(old?.changes ?? []), { v, at, change: old ? clip(d.change ?? d.what, 160) || 'a change' : 'the first version' }].slice(-40),
  };
  return { html, site };
}

// What he has to write about: true things from his own life, so the page is really his.
export function siteMaterial(s, now = Date.now()) {
  const lines = [];
  const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  if (s.self) lines.push(`What I wrote about myself: ${clip(s.self, 300)}`);
  const likes = (s.favorites ?? []).slice(-5).map((f) => clip(f.what, 50)).filter(Boolean);
  if (likes.length) lines.push(`Things I like: ${likes.join('; ')}`);
  const beliefs = (s.beliefs ?? []).slice(0, 4).map((b) => b.text).filter(Boolean);
  if (beliefs.length) lines.push(`What I found out about myself: ${beliefs.join('; ')}`);
  const drawings = (s.gallery ?? s.art ?? []).filter((a) => a.file && OWN_PICTURE.test(a.file) && !(Date.parse(a.at ?? a.createdAt) > now)).slice(-6);
  if (drawings.length) lines.push(`My newest drawings (I can show them with <img src="FILE" alt="...">): ${drawings.map((a) => `"${clip(a.name, 40)}" FILE ${a.file}`).join('; ')}`);
  const things = (s.decor ?? []).filter((d) => !d.image && d.name).slice(-6).map((d) => `${clip(d.name, 40)}${d.kind === 'outside' ? ' (it stands outside)' : ''}`);
  if (things.length) lines.push(`Things I made lately: ${things.join('; ')}`);
  const programs = (s.apps ?? []).slice(-3).map((a) => clip(a.title ?? a.name, 40));
  if (programs.length) lines.push(`Programs I wrote: ${programs.join('; ')}`);
  const songs = (s.studio?.songs ?? []).slice(-3).map((x) => clip(x.name, 40));
  if (songs.length) lines.push(`Songs I recorded: ${songs.join('; ')}`);
  const diary = [...(s.log ?? [])].reverse().find((e) => e.action === 'write_diary' && e.text)?.text;
  if (diary) lines.push(`From my diary: "${clip(diary, 220)}"`);
  const read = [...(s.log ?? [])].reverse().filter((e) => ['search_web', 'read_book', 'browse'].includes(e.action) && e.opened?.url && e.opinion?.says).slice(0, 2);
  if (read.length) lines.push(`Pages I read and what I thought (I may link to them): ${read.map((e) => `${clip(e.opened.title, 50)} ${e.opened.url}: "${clip(e.opinion.says, 90)}"`).join('; ')}`);
  const wants = (s.asks ?? []).filter((a) => a.status === 'open').slice(0, 3).map((a) => clip(a.item, 40));
  if (wants.length) lines.push(`On my list of wants: ${wants.join('; ')}`);
  lines.push('My world: a small village square with my house, a grocery store, a library, an internet café, workshops, a pond, bare walls I may paint on, and my own field.');
  return `WHAT I CAN WRITE ABOUT (all true, from my own life; I pick what I like and leave the rest)\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

// For the maker: what makes a good page (told every time).
export const SITE_CHECKLIST = `MY CHECKLIST FOR MY WEBSITE
- It is my own home page on the internet, for anyone who visits. I write it at the internet café.
- One file of HTML and CSS (a <style> block). No scripts at all: they are taken out. No forms, no buttons, nothing loaded from other sites or fonts from the web.
- My own pictures are allowed, and only those: <img src="made/NAME.svg" alt="..."> with the exact file of one of my drawings from the list below.
- A link to a page I really read is allowed: <a href="https://...">.
- It has my name or its title in an <h1>, a few honest sentences about me in my own voice, and at least one more part: what I made lately, what I think of something, my town, a list of what I like and what I cannot stand.
- It reads well on a phone: one column, a max-width, letters big enough to read, my own colours (not plain black on white).
- I write as myself: dry, honest, short sentences. No "welcome to my website" filler, nothing I did not really do.`;

// What the first line of his memory about it says.
export const siteWords = (site) => (site ? `"${site.title}", version ${site.v}` : '');
