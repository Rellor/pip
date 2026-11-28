// Which search result Pip opens. Wikipedia's first hit is often not what he meant ("simple clay pottery for beginners"
// opened "Ocarina"), so the results are ranked: the title should be about the words he searched for (a short word like
// "pot" matches "pottery"), a word in the snippet helps a little, and names of companies, people and places (a title with
// more capital letters, like "Roseville Pottery") or lists and disambiguation pages come last.
const FILLER = new Set('simple easy basic beginner beginners guide tutorial how what why when make made making build building small little tiny good best first some about with from that this your mine work works'.split(' '));
const plain = (t) => String(t ?? '').replace(/<[^>]+>/g, ' ').toLowerCase();
const wordsOf = (t) => [...new Set(plain(t).replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !FILLER.has(w)))];
const alike = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));

// What he is really looking for. "how to build a small wooden corner shelf" is a question about a shelf: an encyclopedia
// has no page called that, and matching every word opened "Russian wooden architecture". So the question is cut down to
// the thing itself (core: "wooden corner shelf") and its main word (head: "shelf", the last one: in English the thing
// comes last, what it is like comes before).
const VERBS = new Set('build builds building make makes making design designs print prints create creates draw draws write writes play plays learn find fix improve add put use get start try want need plan sew cook bake grow paint carve record program code'.split(' '));
const SOFT = new Set('small simple plain little tiny clumsy big large new old nice good better easy quick real proper own basic short long great quiet'.split(' '));
const SKIP = new Set('a an the my his her its some any to of or and i me you it is are do does can how what why when where which that this'.split(' '));
export function searchTerms(query) {
  const asks = /^\s*(why|what|when|where|who|which|is|are|does|do|can)\b/i.test(String(query ?? '')) && !/^\s*what (is|are) /i.test(String(query ?? '')); // "why is the sky blue": no single thing at the end
  let q = plain(query).replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  q = q.replace(/^(how (do|can|could|should) (i|you|we) |how to |i want to |i would like to |learn (how )?to |what is |what are |to )/, '');
  const words = q.split(' ');
  const cut = words.findIndex((w, i) => i > 0 && ['for', 'with', 'in', 'on', 'from', 'using', 'so', 'by', 'at', 'out', 'like', 'without'].includes(w) && words.slice(0, i).some((x) => !VERBS.has(x) && !SOFT.has(x) && !SKIP.has(x)));
  const kept = (cut > 0 ? words.slice(0, cut) : words).filter((w) => w.length >= 2 && !VERBS.has(w) && !SOFT.has(w) && !SKIP.has(w) && !FILLER.has(w));
  if (!kept.length) return { core: String(query ?? '').trim(), head: '' };
  return { core: kept.join(' '), head: asks ? '' : kept.at(-1) };
}
const bareTitle = (title) => plain(title).replace(/\([^)]*\)/g, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function hitScore(query, hit) {
  const { core, head } = searchTerms(query);
  const want = wordsOf(core).length ? wordsOf(core) : wordsOf(query);
  if (!want.length) return 0;
  const title = wordsOf(bareTitle(hit.title));
  const snip = wordsOf(hit.snippet);
  let score = 0;
  for (const w of want) {
    if (title.some((t) => alike(t, w))) score += head && alike(w, head) ? 5 : 3; // the thing itself counts most
    else if (snip.some((t) => alike(t, w))) score += 1;
  }
  if (head && alike(bareTitle(hit.title), head)) score += 4; // the page IS the thing
  score -= Math.min(3, title.filter((t) => !want.some((w) => alike(t, w))).length); // a page about something wider or something else
  const extraCaps = String(hit.title ?? '').split(/\s+/).slice(1).filter((x) => /^[A-Z]/.test(x)).length;
  if (extraCaps) score -= 2; // a name, not a thing
  if (/^list of|disambiguation|\(([^)]*\b)?(album|song|film|band|magazine|novel|series|video game|company|ep|musical|book|newspaper|surname|name|brand|journal|comics|manga|anime|tv|radio|ship|software)\)|^glossary of|^outline of|^timeline of|^history of/i.test(String(hit.title))) score -= 4;
  return score;
}
// A page that is no use to wander into: a person, a village, a sports season. (For browsing: he came for a thing, an
// idea, an animal, a how. He still reads about people when he looks one up himself.)
export function dullPage(page) {
  const start = String(page?.text ?? '').slice(0, 320);
  if (/\b\d{4}\b/.test(String(page?.title ?? ''))) return true; // "1987 Tour of Flanders"
  if (/\((born|died|c\.|\d{3,4}\s*[–-])|\b(born|died)\b[^.]{0,40}\b\d{4}\b/i.test(start)) return true; // somebody's life
  if (/\b(is|was) an? [\w ,'-]{0,60}\b(politician|footballer|(?<!(record|media|music|cd|dvd|piano) )player|actor|actress|singer|minister|cricketer|bishop|judge|lawyer|businessman|businesswoman|army officer|professor|village|municipality|commune|district|parish|hamlet|suburb|railway station|constituency)\b/i.test(start)) return true;
  return /\b\d{4}([–-]\d{2,4})?\b[^.]{0,40}\b(season|election|championship|tournament|cup final)\b|\b(season|election|championship|tournament|cup final)\b[^.]{0,40}\b\d{4}\b/i.test(start);
}
// The hits, best first; Wikipedia's own order breaks ties.
export const bestHits = (query, hits) => hits.map((h, i) => ({ h, i, s: hitScore(query, h) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.h);
