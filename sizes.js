// How big things are, in metres, so Pip can tell if something is high enough or big enough for what it is for.
// His own size comes from his body on the page: ears reach 1.35 m and his eyes sit at 0.8 m. The window is part of the back wall.
import { FURNITURE } from './web/furniture.js';

export const PIP = { height: 1.35, eyes: 0.8 };
export const WINDOW = { from: 1.7, to: 4.1 };
export const STEP_FOR_WINDOW = Math.round((WINDOW.from - PIP.eyes) * 100) / 100; // how high he must stand to look out

const r2 = (n) => Math.round(n * 100) / 100;

// What never changes, so it sits in his fixed instructions.
export const sizesGuide = () => {
  const furn = Object.values(FURNITURE).filter((f) => !f.flat).flatMap((f) => f.rects.map((r) => `${r.n.replace(/^the /, '')} ${r2(r.h)}`)).join(', ');
  return `SIZES (in metres; the "[w x h x d m]" after the things I made is width x height x depth)
I am about ${PIP.height} m tall and my eyes are ${PIP.eyes} m above the floor. The window starts ${WINDOW.from} m above the floor and goes up to ${WINDOW.to} m. To look out of it my eyes must be higher than ${WINDOW.from} m, so I must stand on something at least ${STEP_FOR_WINDOW} m high. Heights of what is already in my room: ${furn}. When I make something for a reason, I think about how high or big it has to be for that, and I can measure things with a ruler (measure).
`;
};

// A thing that is made to stand on to look out of the window must be high enough.
export function reachProblem(o, sizeOf) {
  const t = `${o?.name ?? ''} ${o?.why ?? ''}`.toLowerCase();
  if (!/\b(stool|step|steps|ladder|platform|podium)\b/.test(String(o?.name ?? '').toLowerCase()) || !/\b(window|see out|look out|outside|stars|sky)\b/.test(t)) return null; // it must be called a stool, step...: a "box" that only mentions the sky is not one
  const h = sizeOf(o)?.[1];
  if (!h || h >= STEP_FOR_WINDOW - 0.02) return null;
  return `${o.name} is for looking out of the window, but it is only ${r2(h)} m high. My eyes are ${PIP.eyes} m up and the window starts at ${WINDOW.from} m, so standing on it my eyes would be at ${r2(PIP.eyes + h)} m. It needs to be at least ${STEP_FOR_WINDOW} m high (and wide enough for me to stand on)`;
}

// What the ruler says. Works on things he made, on the furniture, and on himself.
export function measureThing(decor, name, sizeOf) {
  const n = String(name ?? '').toLowerCase().trim();
  if (!n) return { failed: 'he did not say what to measure' };
  if (/^(me|myself|pip)$/.test(n)) return { ok: true, text: `I am ${PIP.height} m tall, and my eyes are ${PIP.eyes} m above the floor.` };
  if (/window/.test(n)) return { ok: true, text: `The window starts ${WINDOW.from} m above the floor and goes up to ${WINDOW.to} m. To look out my eyes must be higher than ${WINDOW.from} m, so I must stand ${STEP_FOR_WINDOW} m or higher.` };
  const e = decor.find((x) => !x.image && x.name.toLowerCase() === n) ?? decor.find((x) => !x.image && (x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())));
  if (e) {
    const s = sizeOf(e);
    if (s) return { ok: true, text: `${e.name} is ${s[0]} m wide, ${s[1]} m high and ${s[2]} m deep.` };
  }
  const key = Object.keys(FURNITURE).find((k) => n.includes(k));
  if (key) {
    const f = FURNITURE[key];
    return { ok: true, text: f.rects.map((r) => `${r.n} is ${r2(r.x[1] - r.x[0])} m wide, ${r2(r.h)} m high and ${r2(r.z[1] - r.z[0])} m deep`).join('; ') + '.' };
  }
  return { failed: `there is nothing called "${String(name).slice(0, 40)}" to measure` };
}
