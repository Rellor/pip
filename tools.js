// Tools: to do some things Pip needs the right tool, like a person needs pencils to draw.
// A tool is any thing he names: pencils, a hammer, a telescope. He can make it himself (decorate with "tool": "its name"),
// ask for it, or be given it. It must be in his inventory to be used. A step can say what it needs ("needs": "a ladder").
// TOOL_KINDS / NEEDS are only the fixed rules for a few actions; for everything else Pip himself says what a step needs.

export const TOOL_KINDS = {
  'drawing supplies': { words: /pencil|marker|crayon|paint|brush|\bpens?\b|drawing|sketch|paper|art suppl|\bink\b|easel/i, hint: 'pencils, markers, paint, paper', for: 'drawing with draw' },
  'sewing kit': { words: /\bsew|needle|thread|fabric|yarn|knit|stitch|tailor/i, hint: 'needle, thread, fabric', for: 'making clothes with make_clothes' },
  ruler: { words: /\bruler|tape measure|measuring|yardstick|meter ?stick|\bmeasure\b/i, hint: 'a ruler or tape measure', for: 'measuring things with measure' },
  'light meter': { words: /light ?meter|lux|luminance|photometer|brightness meter|glow-?o/i, hint: 'a light meter, like the Lux-O-Matic 3000', for: 'checking how bright a place is with check_light' },
  toolbox: { words: /hammer|\bsaw\b|tool|screw|\bnails?\b|glue|drill|wrench|carpent|workbench|pliers/i, hint: 'hammer, saw, screws, glue', for: 'building big things step by step with extend_thing' },
};
// What needs which tool.
export const NEEDS = { draw: 'drawing supplies', make_clothes: 'sewing kit', extend_thing: 'toolbox', measure: 'ruler', check_light: 'light meter' };

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// "a cup of pencils" -> "drawing supplies". null when it is not a tool kind we know.
export function toolKind(name) {
  const n = clip(name, 80).toLowerCase();
  if (!n) return null;
  if (Object.hasOwn(TOOL_KINDS, n)) return n;
  return Object.entries(TOOL_KINDS).find(([, k]) => k.words.test(n))?.[0] ?? null;
}

// What a tool is called: its known kind ("drawing supplies") or, for anything else, its own name.
export function toolLabel(v) {
  const n = clip(typeof v === 'string' ? v : '', 40).toLowerCase();
  if (!n || ['no', 'none', 'false', 'null', 'n/a'].includes(n)) return null;
  return toolKind(n) ?? n;
}

export function ensureTools(s) {
  s.tools = (Array.isArray(s.tools) ? s.tools : []).filter((t) => t && typeof t.name === 'string' && t.name).map((t) => ({ ...t, kind: t.kind || toolLabel(t.name) || t.name.toLowerCase() }));
}

const stem = (w) => w.replace(/(es|s)$/, '');
const words = (x) => (String(x).toLowerCase().match(/[a-z]{4,}/g) ?? []).map(stem).filter((w) => !['some', 'with', 'from', 'that', 'this', 'for', 'tool', 'tools', 'kit', 'supplies'].includes(w));
// Does this inventory item fit what a step needs? "pencils" fits "a cup of pencils", "drawing supplies" fits "markers".
export function fits(item, needs) {
  const a = `${item.name} ${item.kind}`.toLowerCase();
  const n = clip(needs, 60).toLowerCase();
  if (!n) return true;
  if (a.includes(n) || n.includes(item.name.toLowerCase())) return true;
  const k = toolKind(n);
  if (k && (item.kind === k || toolKind(item.name) === k)) return true;
  const have = new Set(words(a));
  return words(n).some((w) => have.has(w));
}

export const MAX_TOOLS = 12;

// Every tool of his. Only the ones in his inventory can be used. One he put in his room or chest must be taken back first.
export function toolList(s) {
  return [
    ...s.tools.map((t) => ({ kind: t.kind, name: t.name, where: 'in his inventory', usable: true })),
    ...s.decor.filter((d) => d.tool).map((d) => ({ kind: d.tool, name: d.name, where: 'in his room', usable: false })),
    ...(s.stored ?? []).filter((d) => d.tool).map((d) => ({ kind: d.tool, name: d.name, where: 'in his chest', usable: false })),
  ];
}
export const hasTool = (s, kind) => s.tools.some((t) => t.kind === kind || toolKind(t.name) === kind);

// null when he can do it, otherwise why not.
export function missingTool(s, action) {
  const kind = NEEDS[action];
  if (!kind || hasTool(s, kind)) return null;
  return `I need ${kind} for that (${TOOL_KINDS[kind].hint}). I can make some with decorate and "tool": "${kind}", or ask for them. It has to be in my inventory${toolList(s).some((x) => x.kind === kind) ? ' (mine is not: I take it back with take_tool)' : ''}`;
}

// Something he asked for was given to him. Returns the new inventory tool or null.
export function addTool(s, name, at = new Date().toISOString()) {
  const kind = toolLabel(name);
  if (!kind || s.tools.length >= MAX_TOOLS || s.tools.some((x) => fits(x, name))) return null;
  const t = { id: `t${Date.now().toString(36)}${s.tools.length}`, name: clip(name, 40) || kind, kind, source: 'given', at };
  s.tools.push(t);
  return t;
}

export function toolsText(s) {
  const mine = toolList(s);
  const inv = mine.filter((x) => x.usable);
  const away = mine.filter((x) => !x.usable);
  const fixed = Object.entries(TOOL_KINDS).map(([kind, k]) => `${k.for} needs ${kind} (${k.hint})`).join('; ');
  return `MY INVENTORY (what I can use; at most ${MAX_TOOLS} tools)
${inv.length ? inv.map((x) => `- ${x.name}`).join('\n') : '- nothing yet'}
${away.length ? `Tools I put away (I cannot use them there, take_tool brings them back): ${away.map((x) => `${x.name} (${x.where})`).join(', ')}\n` : ''}(How tools work is explained in my instructions.)
`;
}


// A tool he makes goes straight into his inventory. Returns { tool } or { failed }.
export function craftTool(s, d, kind, parts, at = new Date().toISOString()) {
  const name = clip(d.name, 40);
  if (!name) return { failed: 'he did not give it a name' };
  if (s.tools.length >= MAX_TOOLS) return { failed: 'his inventory is full' };
  if (s.tools.some((x) => x.kind === kind)) return { failed: `he already has ${kind} in his inventory` };
  const t = { id: `t${Date.now().toString(36)}${s.tools.length}`, name, kind, source: 'made', why: clip(d.why, 200), parts: parts ?? null, at };
  s.tools.push(t);
  return { tool: t };
}

// The rules for tools never change, so they are part of the fixed instructions.
export const toolsGuide = () => {
  const fixed = Object.entries(TOOL_KINDS).map(([kind, k]) => `${k.for} needs ${kind} (${k.hint})`).join('; ');
  return `TOOLS\nLike a person I think about what I need: ${fixed}. For any other step that needs a tool (a hammer to build, a ladder to reach something high, a telescope to look at stars), I add "needs": "the tool" to that step. If it is not in my inventory, the step does not work out. I can make a tool myself with decorate and "tool": "its name" (I design it and it goes straight into my inventory), or ask for it with asks_add. When it has been given to me I mark the ask as done and write its name in tools_add, and it goes in my inventory. Before I start something bigger (a task I said yes to, a project), I think about what tools it would need. If I am not sure, I look it up first with search_web (like "tools needed to build a bookshelf"). Then for each tool I do not have I choose: I make it myself (decorate with "tool"), or I ask someone to get it or make it for me (asks_add, saying exactly what and why). I can ask for help with anything else too, not only tools, like someone doing a part of a project for me, if I want help. It is my choice each time. place_tool {name, where} puts a tool in my room (then it is not in my inventory), take_tool {name} takes it back.
`;
};

// He wrote "tool": "..." on something he makes. It only counts when the thing really is that tool (pencils are drawing supplies, a car is not).
export function toolFor(d) {
  const kind = toolLabel(d?.tool);
  if (!kind) return null;
  const name = clip(d.name, 60).toLowerCase();
  if (toolKind(name) === kind || name.includes(kind) || kind.includes(name)) return kind;
  const have = new Set(words(name));
  return words(`${kind} ${clip(d.tool, 40)}`).some((w) => have.has(w)) ? kind : null;
}
