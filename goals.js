// Daily goals: when he wakes up after sleep, one small call where he sets 1 to 3 goals for today,
// from his projects, his skills and how he feels. They go in s.intent (the same place as the old day plan,
// so the site shows them and code ticks them off when a move really does one).
export const KINDS = ['make', 'learn', 'tend', 'music', 'revisit', 'explore'];

export function goalPrompt({ soul, feelings, projects, skills, interests }) {
  return `${soul}

GOOD MORNING
I just woke up. How I feel: ${feelings.join('; ') || 'fine'}.
My projects: ${projects.length ? projects.join(' | ') : 'none right now'}
My skills: ${skills}
Things I like to think about: ${interests.slice(-6).join(', ') || 'nothing yet'}

I set 1 to 3 small goals for today. Each is one thing I really want to do today, in my own plain words.
For each I say what kind it is: make, learn, tend (plants, food), music, revisit (go back to something I made) or explore.

Answer in JSON: {"goals": [{"text": "...", "kind": "make"}]}`;
}

export const goalSchema = { type: 'OBJECT', properties: { goals: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, kind: { type: 'STRING', enum: KINDS } }, required: ['text', 'kind'] } } }, required: ['goals'] };

export function setGoals(s, reply, day) {
  const items = (Array.isArray(reply?.goals) ? reply.goals : []).slice(0, 3).map((g) => ({ cat: KINDS.includes(g?.kind) ? g.kind : 'make', text: String(g?.text ?? '').trim().slice(0, 160), done: false })).filter((g) => g.text);
  if (!items.length) return false;
  const prev = s.intent ?? {};
  const kept = prev.items?.length > 0 && prev.items.every((i) => i.done);
  s.intent = { day, streak: kept ? (prev.streak || 0) + 1 : 0, items, by: 'pip' };
  return true;
}

export const fakeGoals = () => ({ goals: [{ text: '(fake) make something small with my hands', kind: 'make' }, { text: '(fake) find out how bees talk', kind: 'learn' }] });
