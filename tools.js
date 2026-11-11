// Tools: to do some things Pip needs the right tool, like a person needs pencils to draw.
// He can make a tool himself (decorate with "tool": "<kind>"), ask for it, or be given it. A tool can stand in his room
// (or in his chest) or stay in his inventory. To add a new kind of tool or a new thing that needs one, add a line here.

export const TOOL_KINDS = {
  'drawing supplies': { words: /pencil|marker|crayon|paint|brush|\bpens?\b|drawing|sketch|paper|art suppl|\bink\b|easel/i, hint: 'pencils, markers, paint, paper', for: 'drawing with draw' },
  'sewing kit': { words: /\bsew|needle|thread|fabric|yarn|knit|stitch|tailor/i, hint: 'needle, thread, fabric', for: 'making clothes with make_clothes' },
  toolbox: { words: /hammer|\bsaw\b|tool|screw|\bnails?\b|glue|drill|wrench|carpent|workbench|pliers/i, hint: 'hammer, saw, screws, glue', for: 'building big things step by step with extend_thing' },
};
// What needs which tool.
export const NEEDS = { draw: 'drawing supplies', make_clothes: 'sewing kit', extend_thing: 'toolbox' };

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// "a cup of pencils" -> "drawing supplies". null when it is not a tool kind we know.
export function toolKind(name) {
  const n = clip(name, 80).toLowerCase();
  if (!n) return null;
  if (Object.hasOwn(TOOL_KINDS, n)) return n;
  return Object.entries(TOOL_KINDS).find(([, k]) => k.words.test(n))?.[0] ?? null;
}

export function ensureTools(s) {
  s.tools = (Array.isArray(s.tools) ? s.tools : []).filter((t) => t && TOOL_KINDS[t.kind]);
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
export const hasTool = (s, kind) => s.tools.some((t) => t.kind === kind);

// null when he can do it, otherwise why not.
export function missingTool(s, action) {
  const kind = NEEDS[action];
  if (!kind || hasTool(s, kind)) return null;
  return `I need ${kind} for that (${TOOL_KINDS[kind].hint}). I can make some with decorate and "tool": "${kind}", or ask for them. It has to be in my inventory${toolList(s).some((x) => x.kind === kind) ? ' (mine is not: I take it back with take_tool)' : ''}`;
}

// Something he asked for was given to him. Returns the new inventory tool or null.
export function addTool(s, name, at = new Date().toISOString()) {
  const kind = toolKind(name);
  if (!kind || hasTool(s, kind)) return null;
  const t = { id: `t${Date.now().toString(36)}${s.tools.length}`, name: clip(name, 40) || kind, kind, source: 'given', at };
  s.tools.push(t);
  return t;
}

export function toolsText(s) {
  const have = toolList(s);
  const lines = Object.entries(TOOL_KINDS).map(([kind, k]) => {
    const mine = have.filter((t) => t.kind === kind);
    return `- ${kind} (${k.hint}), needed for ${k.for}: ${mine.length ? mine.map((t) => `${t.name} (${t.where}${t.usable ? '' : ', I cannot use it there: take_tool brings it back'})`).join('; ') : 'I do not have it yet'}`;
  });
  return `MY TOOLS (to do some things I need the right tool, like a person needs pencils to draw)
${lines.join('\n')}
MY INVENTORY holds my tools (at most ${MAX_TOOLS}). I can only use a tool that is in my inventory. I can make a tool myself with decorate: I design it and add "tool": "<kind>", and it goes straight into my inventory. Or I can ask for it with asks_add. When it has been given to me I mark the ask as done and write its name in tools_add, and it goes in my inventory. If I want a tool to stand in my room I use place_tool {name, where}, and then it is not in my inventory: take_tool {name} takes it back. Without the tool in my inventory a step with that action does not work out.
`;
}

// A tool he makes goes straight into his inventory. Returns { tool } or { failed }.
export function craftTool(s, d, kind, parts, at = new Date().toISOString()) {
  const name = clip(d.name, 40);
  if (!name) return { failed: 'he did not give it a name' };
  if (s.tools.length >= MAX_TOOLS) return { failed: 'his inventory is full' };
  if (hasTool(s, kind)) return { failed: `he already has ${kind} in his inventory` };
  const t = { id: `t${Date.now().toString(36)}${s.tools.length}`, name, kind, source: 'made', why: clip(d.why, 200), parts: parts ?? null, at };
  s.tools.push(t);
  return { tool: t };
}
