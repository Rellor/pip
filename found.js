// Finding a free picture online for Pip: Wikimedia Commons, which has the license and the maker for every file.
// Only the link to the picture is kept (and who made it). The picture itself stays on Wikimedia's server.

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'PipCharacter/0.1 (https://github.com/Rellor/pip)';

const strip = (h, n) => String(h ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// Returns { image, page, title, credit, license } for the best new match, or null.
export async function findPicture(query, known = [], fetchFn = fetch) {
  const q = String(query ?? '').replace(/[^\p{L}\p{N} '-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!q) return null;
  const url = `${API}?${new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '10', prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata', iiurlwidth: '640' })}`;
  const res = await fetchFn(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const pages = Object.values((await res.json())?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const p of pages) {
    const i = p.imageinfo?.[0];
    const license = strip(i?.extmetadata?.LicenseShortName?.value, 40);
    let host = '';
    try {
      host = new URL(i?.thumburl ?? '').hostname;
    } catch {}
    if (!i || !/^image\/(jpeg|png)$/.test(i.mime) || (i.width ?? 0) < 500 || !license || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(host)) continue;
    if (!/^https:\/\//.test(i.thumburl) || !/^https:\/\/commons\.wikimedia\.org\//.test(i.descriptionurl ?? '')) continue;
    const title = strip(p.title?.replace(/^File:/, '').replace(/\.\w+$/, ''), 120);
    if (known.some((k) => k.page === i.descriptionurl)) continue;
    return { image: i.thumburl, page: i.descriptionurl, title, credit: strip(i.extmetadata?.Artist?.value, 80) || 'unknown', license };
  }
  return null;
}
