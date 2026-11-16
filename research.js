// Which search result Pip opens. Wikipedia's first hit is often not what he meant ("simple clay pottery for beginners"
// opened "Ocarina"), so the results are ranked: the title should be about the words he searched for (a short word like
// "pot" matches "pottery"), a word in the snippet helps a little, and names of companies, people and places (a title with
// more capital letters, like "Roseville Pottery") or lists and disambiguation pages come last.
const FILLER = new Set('simple easy basic beginner beginners guide tutorial how what why when make made making build building small little tiny good best first some about with from that this your mine work works'.split(' '));
const plain = (t) => String(t ?? '').replace(/<[^>]+>/g, ' ').toLowerCase();
const wordsOf = (t) => [...new Set(plain(t).replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !FILLER.has(w)))];
const alike = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));

export function hitScore(query, hit) {
  const want = wordsOf(query);
  if (!want.length) return 0;
  const title = wordsOf(hit.title);
  const snip = wordsOf(hit.snippet);
  let score = 0;
  for (const w of want) {
    if (title.some((t) => alike(t, w))) score += 3;
    else if (snip.some((t) => alike(t, w))) score += 1;
  }
  const extraCaps = String(hit.title ?? '').split(/\s+/).slice(1).filter((x) => /^[A-Z]/.test(x)).length;
  if (extraCaps) score -= 2; // a name, not a thing
  if (/^list of|disambiguation|\(album\)|\(song\)|\(film\)|\(band\)/i.test(String(hit.title))) score -= 4;
  return score;
}
// The hits, best first; Wikipedia's own order breaks ties.
export const bestHits = (query, hits) => hits.map((h, i) => ({ h, i, s: hitScore(query, h) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.h);
