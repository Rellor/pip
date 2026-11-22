// The next challenge: one step above what Pip can already do. Plain code, no model.
// Research (Voyager, 2023): an agent that picks its next task just above its level learns far more than one that picks at
// random (random tasks: 93 % fewer new things). So for every skill there is a small ladder; the first rung he has not
// done yet is his next challenge there. He is shown one or two when he has no project, and may take one or not.
import { level } from './skills.js';

const has = (s, re) => (s.tools ?? []).some((t) => re.test(`${t.name} ${t.kind ?? ''}`));
const clipT = (t) => String(t ?? '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase().slice(0, 40);
const partsMax = (s) => Math.max(0, ...(s.decor ?? []).filter((d) => !d.image).map((d) => (d.parts ?? []).length), ...(s.recipes ?? []).map((r) => (r.parts ?? []).length));
const grownApp = (s) => (s.apps ?? []).some((a) => (a.v ?? 1) >= 3);
const songParts = (x) => new Set(x.pattern?.form ?? []).size;
const kindsOf = (list, key) => new Set((list ?? []).map((x) => String(x[key] ?? '').toLowerCase()).filter(Boolean)).size;

// Each rung: done(s) -> has he done this already?; make(topic) -> the challenge. `topic` is something he is into (or '').
const LADDERS = {
  coding: [
    { done: (s) => (s.apps ?? []).length >= 1, make: () => ({ title: 'Write my first tiny program', steps: ['a tiny version: one button that does one thing I can see', 'add one more thing it can do', 'look at it and improve one thing'] }) },
    { done: grownApp, make: (t) => ({ title: `Build a tiny ${t ? `${t} ` : ''}game, one ticket at a time`, steps: ['a tiny version of the game: one thing to click, and a score I can see', 'add a way to lose and a button to start again', 'add keyboard controls (arrows or space)', 'add one thing that makes it more fun: a sound, a second level or a surprise'] }) },
    { done: (s) => (s.apps ?? []).filter((a) => (a.v ?? 1) >= 3).length >= 2, make: (t) => ({ title: `Build a little simulation${t ? ` of ${t}` : ''}: something that moves by itself`, steps: ['a tiny version: one thing that moves by itself by a simple rule', 'add a slider or button that changes the rule', 'add a second kind of thing that reacts to the first', 'make it pretty: colours, a title, a short line about what it shows'] }) },
  ],
  sculpture: [
    { done: (s) => partsMax(s) >= 8, make: (t) => ({ title: `Make ${t ? `a model of ${t}` : 'a thing'} with real detail (8 parts or more)`, steps: ['look up what it really looks like and what its parts are', 'make a first version with at least 8 parts and two or three colours', 'look at it and improve one thing'] }) },
    { done: (s) => (s.decor ?? []).some((d) => (d.uses ?? []).some((u) => ['spin', 'drive'].includes(u.does))), make: () => ({ title: 'Make something that really moves: a little car I can drive or a windmill that spins', steps: ['look up how a windmill or a toy car is built', 'make a first version (round parts for wheels, or a part that can spin)', 'use it and see it move', 'look at it and improve one thing'] }) },
    { done: (s) => partsMax(s) >= 16, make: (t) => ({ title: `Make my most detailed thing yet${t ? `: ${t}` : ''} (16 parts or more)`, steps: ['plan its parts on paper: what is it made of?', 'make a first version with at least 16 parts', 'look at it and improve one thing'] }) },
  ],
  woodwork: [
    { done: (s) => (s.decor ?? []).some((d) => /\b(bench|table|chair|wardrobe|cupboard|cabinet|bookcase|sofa|dresser)\b/i.test(d.name) && !/\b(small|tiny|little|side)\b/i.test(d.name)), make: () => ({ title: 'Build a real piece of furniture, big enough for me and a friend', steps: ['look up how a bench or a dining table is built', 'build a first version: big (a table for four of me is about 2 m long), with legs that reach the top', 'put it in a good place and use it', 'look at it and improve one thing'] }) },
    { done: (s) => (s.ever?.extend_thing ?? 0) >= 1 || !has(s, /toolbox|hammer|saw/), make: () => ({ title: 'Build something big in two goes: first the frame, then add to it', steps: ['build the frame of something big (a cupboard, a loft, a workbench)', 'add doors, shelves or drawers to it (extend_thing)', 'look at it and improve one thing'] }) },
  ],
  music: [
    { done: (s) => (s.studio?.songs ?? []).length >= 1, make: () => ({ title: 'Write and record my first song', steps: ['hum a short tune and find the notes', 'record a first version', 'listen to it and improve one thing'] }) },
    { done: (s) => (s.studio?.songs ?? []).some((x) => songParts(x) >= 2), make: (t) => ({ title: `Write a song with two parts that come back (A and B)${t ? ` about ${t}` : ''}`, steps: ['write part A: a short tune', 'write part B: something that answers it, and record them as A A B A', 'listen to it and improve one part'] }) },
    { done: (s) => (s.ever?.revise_song ?? 0) >= 1 || (s.log ?? []).some((e) => e.action === 'record_song' && e.revised), make: () => ({ title: 'Take my best song and rewrite one part to make it better', steps: ['listen to my songs and pick the best one', 'rewrite its weakest part (revise_song)', 'listen again: is it better?'] }) },
  ],
  painting: [
    { done: (s) => kindsOf((s.art ?? []).slice(-12), 'name') >= 5 && (s.art ?? []).length >= 5, make: () => ({ title: 'A sketchbook page a day: five different things', steps: ['draw an animal', 'draw something to eat', 'draw a tool or a machine', 'draw a plant from my garden', 'draw something I came across on the web'] }) },
    { done: (s) => (s.projects ?? []).some((p) => /three ways|series/i.test(p.title)), make: (t) => ({ title: `Draw ${t || 'one thing'} three ways: a series`, steps: [`draw ${t || 'it'} big, filling the page`, `draw ${t || 'it'} tiny, with something next to it for size`, `draw ${t || 'it'} from above or from an odd side`] }) },
  ],
  sewing: [
    { done: (s) => (s.wardrobe ?? []).length >= 1 || !has(s, /sew|needle|thread/), make: () => ({ title: 'Sew something to wear: a little hat or a scarf for me', steps: ['look up how a simple hat or scarf is sewn', 'sew a first version and wear it', 'look at it and improve one thing'] }) },
  ],
  gardening: [
    { done: (s) => kindsOf(s.garden?.plots, 'plant') >= 2 || !(s.garden?.seeds ?? []).some((x) => x.qty > 0), make: () => ({ title: 'Grow a second kind of plant from seed', steps: ['plant a kind of seed I have not grown yet', 'water it when it is dry', 'harvest it when it is ripe'] }) },
    { done: (s) => (s.log ?? []).some((e) => e.action === 'cook' && !e.failed && /basil|mint|strawberr|tomato|herb/i.test(`${e.dish} ${(e.ingredients ?? []).join(' ')}`)), make: () => ({ title: 'From seed to plate: cook a dish with something I grew', steps: ['harvest something ripe from my garden', 'cook a dish with it', 'eat it and write down how it tasted'] }) },
  ],
  cooking: [
    { done: (s) => kindsOf((s.log ?? []).filter((e) => e.action === 'cook' && !e.failed), 'dish') >= 3, make: () => ({ title: 'Cook three different dishes this week', steps: ['cook a dish with three ingredients', 'cook something I have never made', 'cook my favourite again, a little better'] }) },
  ],
};

// His next challenges: the first rung not done in each skill, the best one or two for now.
export function nextChallenges(s, now = Date.now()) {
  const topics = (s.curious?.interests ?? []).filter((i) => i.score >= 3).map((i) => clipT(i.topic));
  const day = Math.floor(now / 86_400_000);
  const today = s.today?.done ?? {};
  const recentTitles = (s.projects ?? []).slice(-8).map((p) => p.title.toLowerCase());
  const out = [];
  for (const [skill, rungs] of Object.entries(LADDERS)) {
    const i = rungs.findIndex((r) => { try { return !r.done(s); } catch { return false; } });
    if (i < 0) continue;
    const topic = topics.length ? topics[(day + out.length) % topics.length] : '';
    const c = rungs[i].make(topic);
    if (recentTitles.some((t) => t === c.title.toLowerCase())) continue; // he took this one lately
    const practised = Object.entries({ coding: ['make_app', 'update_app'], sculpture: ['decorate'], woodwork: ['decorate'], music: ['record_song', 'play_piano'], painting: ['draw'], sewing: ['make_clothes'], gardening: ['plant', 'harvest'], cooking: ['cook'] }[skill] ?? []).reduce((a, [, m]) => a + (today[m] ?? 0), 0);
    const score = (topic && c.title.toLowerCase().includes(topic) ? 2 : 0) + (10 - level(s, skill)) * 0.3 - practised * 0.8 + ((day + skill.length) % 3) * 0.5; // what he is into, skills that lag behind, not what he did all day, and a little turn-taking
    out.push({ skill, level: level(s, skill), rung: i + 1, ...c, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 2);
}
// For the brain, when he has no project: one or two ideas, one step up.
export function challengeLines(s, now = Date.now()) {
  if ((s.projects ?? []).some((p) => p.status === 'working')) return [];
  const c = nextChallenges(s, now);
  if (!c.length) return [];
  return [`I have no project now. Ideas that are one step up for me: ${c.map((x) => `"${x.title}" (my ${x.skill} is level ${x.level})`).join(' or ')}. I can start one with start_project (its title is enough: the steps are known), or think of my own.`];
}
// The steps of a challenge he chose (by its title), or null.
export const challengeSteps = (s, title, now = Date.now()) => {
  const t = String(title ?? '').toLowerCase().trim();
  const hit = t ? nextChallenges(s, now).find((c) => c.title.toLowerCase() === t || c.title.toLowerCase().includes(t) || t.includes(c.title.toLowerCase().slice(0, 24))) : null;
  return hit ? hit.steps : null;
};
