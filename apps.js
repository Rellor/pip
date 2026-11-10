// Small web pages and apps Pip writes. They are one file of HTML, CSS and JavaScript.
// They only run when Bas opens one, inside a locked box in the page (no internet, no storage, no way out).
// This file only checks the size and removes tags that try to change the page around them.

export const MAX_APP_BYTES = 14_000;
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
