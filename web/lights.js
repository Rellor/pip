// Pip's lamps, as his phone's Lights app sees them: a name of his own, on or off, a colour, and timers.
// Shared by the game (his moves, Bas's commands) and the page (what you see, in real time), so both agree.
// Two colour modes, like most light apps: "warm" picks from a few fixed colours, "rgb" takes any colour.
// Dim in 4 steps: 25, 50, 75 or 100 %.
// Timers use Dutch time (where his room is): { id, at: "21:00", do: "on" | "off" | "color" | "dim", color, level }.
import { amsterdamHour } from './season.js';

// A lamp: a glowing part and a use that does light (the same test as lighting.js, which uses this file).
export const isLamp = (d) => !d.image && (d.parts ?? []).some((p) => p.glow) && (d.uses ?? []).some((u) => u.does === 'light');
export const LEVELS = [25, 50, 75, 100];
export const levelOf = (v) => { const n = parseInt(String(v ?? '').replace('%', ''), 10); return LEVELS.includes(n) ? n : null; };

export const PRESETS = [
  { key: 'warm white', hex: '#ffe9b0' },
  { key: 'amber', hex: '#ffc46b' },
  { key: 'sunset', hex: '#ff8a6b' },
  { key: 'lavender', hex: '#b9a7ff' },
  { key: 'sky', hex: '#8fd3ff' },
  { key: 'mint', hex: '#9fe39a' },
];
export const MAX_TIMERS = 6;
const HEX = /^#[0-9a-f]{6}$/i;
const clean = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export const lampsOf = (s) => (s.decor ?? []).filter((d) => isLamp(d));
export const lampName = (e) => e.nick || e.name;
// The colour it was made with (its glowing part), when he never picked one.
export const madeColor = (e) => (e.parts ?? []).find((p) => p.glow)?.color ?? PRESETS[0].hex;
export function findLamp(s, word) {
  const w = clean(word, 60).toLowerCase();
  if (!w) return null;
  const all = lampsOf(s);
  return all.find((e) => lampName(e).toLowerCase() === w || e.name.toLowerCase() === w || e.id === w) ?? all.find((e) => lampName(e).toLowerCase().includes(w) || e.name.toLowerCase().includes(w) || w.includes(lampName(e).toLowerCase())) ?? null;
}
// A colour from words or a code: a preset name in warm mode; any #rrggbb (or a preset) in rgb mode. Null if it is not one.
export function colorOf(v, mode = 'warm') {
  const t = clean(v, 20).toLowerCase();
  const preset = PRESETS.find((p) => p.key === t || t.includes(p.key) || p.hex === t);
  if (preset) return preset.hex;
  if (mode === 'rgb' && HEX.test(t)) return t;
  if (mode === 'rgb' && /^[0-9a-f]{6}$/i.test(t)) return `#${t}`;
  return null;
}
const minutesOf = (at) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(at ?? '').trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// The moments timers fired since `from` (at most the last 2 days), oldest first: [{ t (ms), timer }].
function firedSince(e, from, now) {
  const out = [];
  const nowMin = amsterdamHour(new Date(now)) * 60; // minutes since Dutch midnight, now
  for (const tm of e.timers ?? []) {
    const m = minutesOf(tm.at);
    if (m === null) continue;
    const ago = ((nowMin - m) % 1440 + 1440) % 1440; // minutes since it last fired
    for (const back of [0, 1]) {
      const at = now - (ago + back * 1440) * 60_000;
      if (at > from && at <= now) out.push({ t: at, timer: tm });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
// How the lamp is right now: { on, color }. What was set by hand, then every timer that fired after that.
export function lampNow(e, now = Date.now()) {
  let on = e.lit !== false;
  let color = e.color || madeColor(e);
  let level = levelOf(e.level) ?? 100;
  const set = Date.parse(e.setAt ?? e.litAt ?? e.at ?? 0) || 0;
  for (const { timer } of firedSince(e, set, now)) {
    if (timer.do === 'on') on = true;
    if (timer.do === 'off') on = false;
    if (timer.do === 'color' && HEX.test(timer.color ?? '')) { color = timer.color; on = true; }
    if (timer.do === 'dim' && levelOf(timer.level)) { level = levelOf(timer.level); on = true; }
  }
  return { on, color, level };
}
// The timers in words, for a list: "on at 21:00", "lavender at 22:30".
export const timerWords = (tm) => `${tm.do === 'color' ? `${PRESETS.find((p) => p.hex === tm.color)?.key ?? tm.color}` : tm.do === 'dim' ? `dim to ${tm.level}%` : tm.do} at ${tm.at}`;

// One command from his phone (or from Bas, with the key). Changes the lamp; returns { ok, text } or { failed }.
// cmd: { lamp, switch: "on" | "off", name, mode: "warm" | "rgb", color, level: 25 | 50 | 75 | 100, timer: { at, do, color, level }, remove_timer: id or "all" }
export function applyLight(s, cmd, { who = 'Pip', now = Date.now() } = {}) {
  const e = findLamp(s, cmd?.lamp);
  if (!e) {
    const names = lampsOf(s).map(lampName);
    return { failed: names.length ? `there is no lamp called "${clean(cmd?.lamp, 40)}". My lamps: ${names.join(', ')}` : 'I have no lamps yet. A lamp has a glowing part and a use that does light' };
  }
  const at = new Date(now).toISOString();
  const said = [];
  const settle = () => { const st = lampNow(e, now); e.lit = st.on; e.color = st.color; e.level = st.level; e.setAt = at; }; // timers that already fired count from here
  if (cmd.name && clean(cmd.name, 30)) { e.nick = clean(cmd.name, 30); said.push(`called it "${e.nick}"`); }
  if (cmd.mode === 'warm' || cmd.mode === 'rgb') { e.mode = cmd.mode; said.push(`switched it to ${cmd.mode === 'rgb' ? 'RGB' : 'warm'} mode`); }
  if (cmd.color) {
    const c = colorOf(cmd.color, e.mode ?? 'warm');
    if (!c) return { failed: e.mode === 'rgb' ? `"${clean(cmd.color, 20)}" is not a colour: a colour code like #ff8800, or ${PRESETS.map((p) => p.key).join(', ')}` : `in warm mode the colours are ${PRESETS.map((p) => p.key).join(', ')} (or I switch the lamp to RGB mode for any colour)` };
    settle();
    e.color = c;
    e.lit = true;
    said.push(`made it ${PRESETS.find((p) => p.hex === c)?.key ?? c}`);
  }
  if (cmd.level !== undefined && cmd.level !== null && cmd.level !== '') {
    const lv = levelOf(cmd.level);
    if (!lv) return { failed: `a lamp dims in steps: ${LEVELS.join(', ')} %` };
    settle();
    e.level = lv;
    e.lit = true;
    said.push(`set it to ${lv}%`);
  }
  if (cmd.switch === 'on' || cmd.switch === 'off' || cmd.switch === 'toggle') {
    settle();
    e.lit = cmd.switch === 'toggle' ? !e.lit : cmd.switch === 'on';
    e.auto = undefined; // switched by hand: it stops switching by itself in the dark (a timer can do that)
    said.push(`turned it ${e.lit ? 'on' : 'off'}`);
  }
  if (cmd.timer) {
    const m = minutesOf(cmd.timer.at);
    const what = ['on', 'off', 'color', 'dim', 'dark'].includes(cmd.timer.do) ? cmd.timer.do : null;
    if (what === 'dark') { e.auto = 'dark'; said.push('set it to come on by itself when it is dark'); }
    else {
      if (m === null || !what) return { failed: 'a timer needs a time like "21:00" and what it does: on, off, color, dim (or dark: on by itself when it is dark)' };
      const color = what === 'color' ? colorOf(cmd.timer.color, e.mode ?? 'warm') : null;
      if (what === 'color' && !color) return { failed: 'a colour timer needs a colour' };
      const level = what === 'dim' ? levelOf(cmd.timer.level) : null;
      if (what === 'dim' && !level) return { failed: `a dim timer needs a step: ${LEVELS.join(', ')} %` };
      e.timers = [...(e.timers ?? []).filter((t) => !(t.at === hhmm(m) && t.do === what)), { id: `t${Date.now().toString(36)}${(e.timers ?? []).length}`, at: hhmm(m), do: what, ...(color ? { color } : {}), ...(level ? { level } : {}), by: who }].slice(-MAX_TIMERS);
      settle();
      said.push(`set a timer: ${timerWords(e.timers.at(-1))}`);
    }
  }
  if (cmd.remove_timer) {
    const before = (e.timers ?? []).length;
    e.timers = cmd.remove_timer === 'all' ? [] : (e.timers ?? []).filter((t) => t.id !== cmd.remove_timer && t.at !== cmd.remove_timer);
    if (cmd.remove_timer === 'dark' && e.auto) { e.auto = undefined; said.push('it no longer comes on by itself'); }
    if (e.timers.length < before) said.push('removed a timer');
  }
  if (!said.length) return { failed: 'I did not say what to do with the lamp: switch, name, colour or a timer' };
  e.lightBy = { who, at, what: said.join(', ') };
  return { ok: true, lamp: lampName(e), text: `${who === 'Pip' ? 'I' : who} ${said.join(', ')} (${lampName(e)})` };
}
