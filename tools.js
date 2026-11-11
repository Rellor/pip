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

// Every tool he has: in his inventory, standing in his room, or kept in his chest.
export function toolList(s) {
  return [
    ...s.tools.map((t) => ({ kind: t.kind, name: t.name, where: 'in his inventory' })),
    ...s.decor.filter((d) => d.tool).map((d) => ({ kind: d.tool, name: d.name, where: 'in his room' })),
    ...(s.stored ?? []).filter((d) => d.tool).map((d) => ({ kind: d.tool, name: d.name, where: 'in his chest' })),
  ];
}
export const hasTool = (s, kind) => toolList(s).some((t) => t.kind === kind);

// null when he can do it, otherwise why not.
export function missingTool(s, action) {
  const kind = NEEDS[action];
  if (!kind || hasTool(s, kind)) return null;
  return `I need ${kind} for that (${TOOL_KINDS[kind].hint}). I can make some with decorate and "tool": "${kind}", or ask for them`;
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
    return `- ${kind} (${k.hint}), needed for ${k.for}: ${mine.length ? `I have it (${mine.map((t) => `${t.name}, ${t.where}`).join('; ')})` : 'I do not have it yet'}`;
  });
  return `MY TOOLS (to do some things I need the right tool, like a person needs pencils to draw)
${lines.join('\n')}
I can make a tool myself with decorate: I design it, and add "tool": "<kind>" so it counts (it can stand in my room, or sit in my chest). Or I can ask for it with asks_add. When it has been given to me I mark the ask as done and write its name in tools_add, and it goes in my inventory. Without the tool a step with that action does not work out.
`;
}
