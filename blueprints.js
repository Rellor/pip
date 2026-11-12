// How Pip works out something new. Before he builds something complicated he looks up how it really works (search_web), then he writes
// a blueprint: the parts and mechanisms it needs, and for each one which of his abilities does it. A mechanism none of his abilities can
// do is marked missing and becomes a request (the website shows these), so the people who look after him can give him the ability.
// Nothing here runs as code: it is a checked list.

export const CAPS = [
  { id: 'shapes', what: 'build the body from shapes (box, sphere, cylinder, cone, torus, capsule) with colours', how: 'decorate parts' },
  { id: 'glow', what: 'a part that glows, like a light, a screen or an eye', how: 'a part with "glow": true' },
  { id: 'light', what: 'a lamp or light that switches on and off', how: 'a use with "does": "light"' },
  { id: 'drive', what: 'a vehicle or toy on the floor that drives a route I design (needs 2 or more round parts as wheels)', how: 'a use with "does": "drive" and "motion" steps' },
  { id: 'stand', what: 'something I climb on and stand on top of (a stool, a step, a platform)', how: 'a use with "does": "stand"' },
  { id: 'custom', what: 'my own movement built from steps: a part turns around an edge (a door or lid opens), a part slides (a drawer), a part lights up or goes dark, the whole thing spins, I climb on it, or it waits', how: 'a use with "does": "custom" and "steps": [{"do": "rotate_part", "part": 2, "deg": 90, "axis": "x", "hinge": "back", "s": 1}, {"do": "wait", "s": 2}, {"do": "rotate_part", "part": 2, "deg": -90, "axis": "x", "hinge": "back"}] (do is rotate_part, slide_part, glow, spin, climb or wait; part is the number of the part in the thing, from 1)' },
  { id: 'spin', what: 'something that turns around (a fan, a windmill, a top)', how: 'a use with "does": "spin"' },
  { id: 'song', what: 'a song, a tune or a sound that plays when it is used', how: '"song" on the thing, or compose' },
  { id: 'text', what: 'a use that tells what happens and can show a small picture', how: 'uses with text and view' },
  { id: 'holds', what: 'a shelf, table or stand that other things stand on (levels)', how: 'a flat board, then move_thing with "on"' },
  { id: 'storage', what: 'a closet, chest or shelf that makes room for more things', how: 'a thing named shelf, closet, cabinet, wardrobe...' },
  { id: 'tool', what: 'a tool I make or ask for and use to build things', how: '"needs" on a step, tools in my inventory' },
  { id: 'app', what: 'a small program on my computer: a web page with HTML, CSS and JavaScript (a game, a controller, a simulation, a calculator)', how: 'make_app' },
  { id: 'body', what: 'my own body moving (a dance, a wave, a hop)', how: 'make_move' },
  { id: 'draw', what: 'a drawing or a diagram', how: 'draw (SVG)' },
  { id: 'clothes', what: 'clothes or a costume for me', how: 'make_clothes' },
  { id: 'cook', what: 'cooking a dish from ingredients', how: 'cook' },
  { id: 'photo', what: 'photos, prints and pictures on the wall', how: 'take_photo, print_photo, place_picture' },
  { id: 'place', what: 'where things stand, hang or lie, and moving them', how: 'move_thing, next_to, on, wall' },
];
export const CAP_IDS = CAPS.map((c) => c.id);

const clip = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');
const words = (t) => (String(t).toLowerCase().match(/[a-z]{4,}/g) ?? []);

export function ensureBlueprints(s) {
  s.blueprints = Array.isArray(s.blueprints) ? s.blueprints.filter((b) => b && b.name && Array.isArray(b.mechanisms)) : [];
  s.requests = Array.isArray(s.requests) ? s.requests.filter((r) => r && r.what) : [];
}

// Did he look something up that fits this? (a search or a book in the last 12 hours that shares a word with the goal)
function researched(s, goal, now, sameWake = []) {
  const want = new Set(words(goal));
  if (sameWake.some((t) => words(t).some((w) => want.has(w)))) return true; // he looked it up earlier in this same plan
  return (s.log ?? []).some((e) => ['search_web', 'read_book'].includes(e.action) && now - Date.parse(e.at) < 12 * 3_600_000 && words(`${e.query ?? ''} ${e.topic ?? ''} ${e.opened?.title ?? ''}`).some((w) => want.has(w)));
}

// details: { name, goal, research, mechanisms: [{ part, how, uses }], tools }. Returns { blueprint, missing } or { failed }.
export function makeBlueprint(s, d, at = new Date().toISOString(), now = Date.now(), sameWake = []) {
  const name = clip(d?.name, 60);
  const goal = clip(d?.goal, 200);
  if (!name || !goal) return { failed: 'a blueprint needs a name and a goal (what it should do)' };
  const research = clip(d?.research, 500);
  if (research.length < 30) return { failed: 'a blueprint needs what I learned about how it really works (research, at least a sentence)' };
  if (!researched(s, `${name} ${goal}`, now, sameWake)) return { failed: 'I have not looked up how this works yet: I search_web first (for example "how does a remote controlled car work"), then I write the blueprint' };
  const mechanisms = (Array.isArray(d?.mechanisms) ? d.mechanisms : []).slice(0, 8).map((m) => {
    const part = clip(m?.part, 60);
    const how = clip(m?.how, 160);
    const uses = clip(m?.uses, 20).toLowerCase();
    return part ? { part, how, uses: CAP_IDS.includes(uses) ? uses : 'missing', ok: CAP_IDS.includes(uses) } : null;
  }).filter(Boolean);
  if (mechanisms.length < 2) return { failed: 'a blueprint lists at least 2 parts or mechanisms, each with the ability I use for it (or "missing")' };
  const tools = (Array.isArray(d?.tools) ? d.tools : []).map((t) => clip(t, 40)).filter(Boolean).slice(0, 4);
  const old = s.blueprints.findIndex((b) => b.name.toLowerCase() === name.toLowerCase());
  const bp = { name, goal, research, mechanisms, tools, at, built: old >= 0 ? s.blueprints[old].built ?? null : null };
  if (old >= 0) s.blueprints[old] = bp;
  else s.blueprints = [...s.blueprints, bp].slice(-8);
  const missing = mechanisms.filter((m) => !m.ok);
  for (const m of missing) {
    const what = `${m.part}${m.how ? `: ${m.how}` : ''}`;
    if (s.requests.some((r) => r.status === 'open' && words(r.what).join() === words(what).join())) continue;
    if (s.requests.filter((r) => r.status === 'open').length >= 12) break;
    s.requests.push({ id: `r${now.toString(36)}${s.requests.length}`, what, why: goal, blueprint: name, at, status: 'open' });
  }
  return { blueprint: bp, missing };
}

// He wants a thing to do something that no ability covers. He asks for it and explains exactly what it should do, so it can be built for him.
export function requestAbility(s, d, now = Date.now(), at = new Date(now).toISOString()) {
  const name = clip(d?.name, 40).toLowerCase();
  const what = clip(d?.what, 400);
  const thing = clip(d?.thing, 60);
  if (name.length < 3) return { failed: 'he did not give the ability a short name (like "open and close")' };
  if (what.length < 30) return { failed: 'he did not explain what it should do. He says exactly what happens, step by step, so someone can build it' };
  if (s.requests.some((r) => r.status === 'open' && words(`${r.ability ?? ''} ${r.what}`).join() === words(`${name} ${what}`).join())) return { failed: 'that is already asked for' };
  if (s.requests.filter((r) => r.by === 'pip' && now - Date.parse(r.at) < 86_400_000).length >= 3) return { failed: 'he already asked for 3 new abilities today' };
  if (s.requests.filter((r) => r.status === 'open').length >= 12) return { failed: 'there are too many open requests. They are built first' };
  const r = { id: `r${now.toString(36)}${s.requests.length}`, what: `${name}: ${what}`, why: thing ? `for ${thing}` : '', blueprint: thing || undefined, ability: name, at, status: 'open', by: 'pip' };
  s.requests.push(r);
  return { request: r };
}

// What the blueprint promised that the thing he built does not do yet (a spin use, a light, a song...). Empty when it keeps its promises.
export function blueprintGaps(bp, entry) {
  const has = { spin: (u) => u.does === 'spin', light: (u) => u.does === 'light', drive: (u) => u.does === 'drive', song: (u) => u.song, glow: () => true };
  const gaps = [];
  for (const m of bp.mechanisms) {
    if (m.uses === 'glow' && !entry.parts?.some((p) => p.glow)) gaps.push(`${m.part} (nothing glows)`);
    else if (['spin', 'light', 'drive'].includes(m.uses) && !(entry.uses ?? []).some(has[m.uses])) gaps.push(`${m.part} (no use with "does": "${m.uses}")`);
    else if (m.uses === 'song' && !entry.song && !(entry.uses ?? []).some(has.song)) gaps.push(`${m.part} (no song)`);
  }
  return gaps;
}
// A thing he built from a blueprint marks it built and keeps what is still missing from it.
export function markBuilt(s, blueprintName, at, entry = null) {
  const b = s.blueprints.find((x) => x.name.toLowerCase() === clip(blueprintName, 60).toLowerCase());
  if (!b) return [];
  b.built = at;
  b.tested = null;
  b.thing = entry?.name ?? b.thing ?? null;
  b.gaps = entry ? blueprintGaps(b, entry) : b.gaps ?? [];
  return b.gaps;
}

export function blueprintsText(s) {
  const open = s.requests.filter((r) => r.status === 'open');
  const list = s.blueprints.map((b) => `- ${b.name}: ${b.goal} ${b.built ? (b.gaps?.length ? `(built as ${b.thing}, but it does not do yet: ${b.gaps.join(', ')}. I fix that with add_use or change_thing)` : b.tested ? `(built and tested. My verdict: ${b.verdict ?? 'it works'})` : '(built, not tested yet)') : `(NOT BUILT YET. My next step is decorate with "blueprint": "${b.name}" and the parts I can make now${b.mechanisms.every((m) => m.ok) ? '' : `; ${b.mechanisms.filter((m) => !m.ok).map((m) => m.part).join(', ')} cannot be done yet, so I build around ${b.mechanisms.filter((m) => !m.ok).length === 1 ? 'it' : 'them'} and do not wait`})`}`);
  const ready = s.requests.filter((r) => r.status === 'built' && r.does && Date.now() - Date.parse(r.builtAt ?? 0) < 3 * 86_400_000);
  return `MY BLUEPRINTS\n${nudgeText(s)}${ready.length ? `New abilities that are ready for me now: ${ready.map((r) => `${r.ability ?? r.what} (a use with "does": "${r.does}")`).join(' | ')}\n` : ''}${list.length ? list.join('\n') : '- none yet'}${open.length ? `\nThings I cannot do yet, that people know about: ${open.map((r) => r.what).join(' | ')}` : ''}\n`;
}

export const capabilityGuide = () => `HOW I WORK OUT SOMETHING NEW
My abilities, everything I can really make work: ${CAPS.map((c) => `${c.id} (${c.what}; ${c.how})`).join('; ')}.
If what I want a thing to do is more than one of these abilities, I build my own with "does": "custom" and steps. If I cannot make it do what I want, or it does not work the way it should, I do not fake it with text and I do not wait: I ask for it right away with request_ability {name, thing, what}. I explain exactly what should happen, step by step, so it can be built for me, and I am told when it is ready.

When I want to make something new or hard that has working parts (a vehicle, a machine, a game, a gadget), I do not just guess. I work it out in steps. Simple things (a shelf, a table, a bookcase, a chair, a decoration, a lamp) need no blueprint: I just build them with decorate. If what I want a thing to do is not one of my abilities, I do not fake it with text. I ask for the new ability with request_ability {name, thing, what}: I explain exactly what should happen, step by step, so it can be built for me, and I am told when it is ready.\n\nWhen a step does not work out, I do not repeat it. I ask myself what kind of thing it is, where that kind of thing normally goes (a stool stands on the floor, a picture hangs on a wall, a lamp stands on something) and why my plan did not fit, and then I try a different way.
1. Research. I look up how the real thing works with search_web, like "how does a remote controlled car work", and I read what I find.
2. Blueprint. With the blueprint step I write what I learned (research), my goal, and the parts and mechanisms it needs. For each one I say which of my abilities does it, by its id, or "missing" when none can. blueprint {"name": "...", "goal": "what it should do", "research": "what I learned, in a sentence or two", "mechanisms": [{"part": "wheels", "how": "4 round parts that turn", "uses": "drive"}, {"part": "steering", "how": "...", "uses": "missing"}], "tools": ["screwdriver"]}.
3. Tools. For the tools the blueprint lists, I make them or ask for them (asks_add) before I build.
4. Build with decorate, mentioning the blueprint name in "blueprint", and use "needs" for the tool I use.
5. Test. I use what I made, with the use that really does the thing, and I write a "verdict": what happened and whether it matches my blueprint. If it does not do what the blueprint says, I change it, or I think of another way with my abilities. I am honest about it: I do not squeeze a mechanism into an ability that does not really do it (a drive use does not fly, a spin use does not hover). If none of my abilities does it, I write "missing". A mechanism marked missing is not a failure: it goes on the list of things people can give me, and I build the rest.
I always check my abilities first: often a thing I want can be done in a different way than the real one (a car does not need a real motor: it drives a route I design).
`;

// What his blueprint is waiting for, so his plan includes it: build it, fix what it does not do yet, or test it.
// A blueprint he only just wrote this wake-up (less than 20 minutes ago) is left alone.
export function blueprintDue(s, now = Date.now()) {
  for (const b of s.blueprints) {
    if (now - Date.parse(b.at) < 20 * 60_000) continue;
    if (!b.built) return { bp: b, kind: 'build', actions: ['decorate'], text: `I planned "${b.name}" and have not built it yet. A step of my plan builds it now: decorate with "blueprint": "${b.name}" (what I cannot do yet, I build around)` };
    if (b.gaps?.length) return { bp: b, kind: 'fix', actions: ['add_use', 'change_thing', 'extend_thing', 'compose'], text: `"${b.name}" is built as ${b.thing}, but it does not do yet what my blueprint says: ${b.gaps.join(', ')}. A step of my plan fixes that (add_use, change_thing or extend_thing)` };
    if (!b.tested && b.thing) return { bp: b, kind: 'test', actions: ['use'], text: `${b.testNote ? `My last test did not count: ${b.testNote}. ` : ''}I built "${b.name}" as ${b.thing} but I have not tried it yet. A step of my plan uses it (use with a "verdict": what happened, and does it match my blueprint?)` };
  }
  return null;
}
export const nudgeText = (s) => {
  const d = blueprintDue(s);
  return d ? `MY BLUEPRINT IS WAITING: ${d.text}.\n` : '';
};
