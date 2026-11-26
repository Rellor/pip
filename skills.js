// Pip's skills. Practice (a move that worked) and research (reading about it) raise them slowly.
// A higher level lets the maker do more: more parts in a sculpture, more bars in a song.
export const SKILLS = ['music', 'painting', 'sculpture', 'woodwork', 'sewing', 'gardening', 'cooking', 'coding'];
const WOOD = /\b(stool|chair|table|shelf|shelves|bench|cabinet|box|frame|desk|bed|bookcase|crate|cupboard|wardrobe|furniture|wood|wooden)\b/i;

// Which skill a move practises, or null.
export function skillOf(action, details = {}) {
  const what = `${details.name ?? ''} ${details.what ?? ''}`;
  if (['play_piano', 'record_song', 'compose'].includes(action)) return 'music';
  if (action === 'draw') return 'painting';
  if (['decorate', 'change_thing', 'extend_thing'].includes(action)) return WOOD.test(what) ? 'woodwork' : 'sculpture';
  if (action === 'make_clothes') return 'sewing';
  if (['plant', 'water', 'harvest'].includes(action)) return 'gardening';
  if (action === 'cook') return 'cooking';
  if (['make_app', 'update_app', 'make_site', 'update_site'].includes(action)) return 'coding';
  return null;
}
// Which skill a search or a book is about, or null.
const TOPICS = { music: /music|chord|melod|song|rhythm|piano|guitar|harp|scale|tempo|harmon/i, painting: /paint|drawing|draw|colou?r|sketch|watercolou?r|art\b/i, sculpture: /sculpt|clay|model|carv/i, woodwork: /wood|carpent|joint|saw|plank|furniture|build a/i, sewing: /sew|knit|fabric|stitch|cloth/i, gardening: /garden|grow|seed|plant|soil|herb|compost/i, cooking: /cook|bake|recipe|bread|soup|dish|kitchen/i, coding: /code|program|javascript|html|app\b|simulat/i };
export const researchSkill = (topic) => Object.entries(TOPICS).find(([, re]) => re.test(String(topic ?? '')))?.[0] ?? null;

export function ensureSkills(s) {
  s.skills ??= {};
  for (const k of SKILLS) s.skills[k] = Number.isFinite(s.skills[k]) ? s.skills[k] : 0;
}
// Level 1 to 10 from practice points: 1 at the start, 2 after 2 points, 3 after 8, 4 after 18, ... (slower the higher it gets).
export const levelOf = (xp) => Math.min(10, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 2)));
export const level = (s, skill) => levelOf(s.skills?.[skill] ?? 0);

// After a move that worked. Returns the skill and its new level when it went up a level, else null.
export function practise(s, action, details = {}) {
  ensureSkills(s);
  const research = ['search_web', 'read_book'].includes(action) ? researchSkill(details.query ?? details.topic) : null;
  const skill = research ?? skillOf(action, details);
  if (!skill) return null;
  const before = level(s, skill);
  s.skills[skill] = Math.round((s.skills[skill] + (research ? 0.5 : 1)) * 10) / 10;
  const after = level(s, skill);
  return after > before ? { skill, level: after } : null;
}

// How much the maker may do at a level.
export const maxParts = (lvl) => Math.min(40, 6 + lvl * 4); // level 1: 10 parts ... level 9+: 40
export const maxBars = (lvl) => Math.min(16, 2 + lvl * 2); // level 1: 4 bars ... level 7+: 16
export function skillLine(s) {
  ensureSkills(s);
  return SKILLS.filter((k) => s.skills[k] > 0).map((k) => `${k} ${level(s, k)}`).join(', ') || 'I am a beginner at everything';
}
