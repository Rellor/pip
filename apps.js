// Small web pages and apps Pip writes. They are one file of HTML, CSS and JavaScript.
// They only run when Bas opens one, inside a locked box in the page (no internet, no storage, no way out).
// This file only checks the size and removes tags that try to change the page around them.

export const MAX_APP_BYTES = 120_000; // room for a game that grows ticket by ticket (with small edits it never has to be written in one go)
export const MAX_APPS = 12;
export const MAX_APPS_PER_DAY = 2;

// Returns the cleaned html or null.
export function cleanApp(raw) {
  if (typeof raw !== 'string') return null;
  let html = raw.trim();
  if (html.length < 40 || Buffer.byteLength(html) > MAX_APP_BYTES || !html.includes('<')) return null;
  html = html
    .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '') // no redirects, no changing the safety rules
    .replace(/<(base|iframe|frame|frameset|object|embed|link)\b[^>]*>(\s*<\/\1>)?/gi, '');
  return html;
}

// Small edits to a program, like a coder changes only what is needed: [{ find, replace }]. Each "find" must be in the
// file exactly once. Returns { html } or { failed } (which edit did not fit, so he can try again).
export function applyEdits(html, edits) {
  if (!Array.isArray(edits) || !edits.length) return { failed: 'no edits' };
  let out = String(html);
  for (const [i, e] of edits.slice(0, 12).entries()) {
    const find = String(e?.find ?? '');
    const repl = String(e?.replace ?? '');
    if (!find) return { failed: `edit ${i + 1} has nothing to find` };
    const at = out.indexOf(find);
    if (at < 0) return { failed: `edit ${i + 1}: I could not find "${find.slice(0, 60)}" in the file (it must be copied exactly)` };
    if (out.indexOf(find, at + 1) >= 0) return { failed: `edit ${i + 1}: "${find.slice(0, 60)}" is in the file more than once (I take a longer piece)` };
    out = out.slice(0, at) + repl + out.slice(at + find.length);
  }
  return { html: out };
}
