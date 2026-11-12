// Things he makes for a purpose should really do it. A use can say what it DOES, and the website plays that:
//   light  the thing's glowing parts switch on and off (a lamp)
//   drive  the thing rolls a little loop across the floor and comes back (a car)
//   spin   the thing turns around (a windmill, a fan, a top)
//   stand  Pip climbs on it and stands on top (a stool, a step, a platform)
// If a thing's name says what it is (a lamp, a car, a fan) and it has no such use, one is added, so it works without him asking.
// If it cannot work (a lamp with nothing that glows, a car with no wheels) he is told what is missing.

export const DOES = ['light', 'drive', 'spin', 'stand', 'custom'];

const KINDS = {
  light: { words: /\b(lamp|light|lantern|candle|torch|beacon|night ?light|lighthouse)\b/i, label: 'Switch the light', text: 'The light clicks on, or off again.' },
  drive: { words: /\b(car|truck|rover|cart|tractor|bus|van|train|tank|buggy|vehicle|bike|scooter|racer|robot car)\b|remote.?control/i, label: 'Drive it', text: 'It rolls across the floor and comes back.' },
  stand: { words: /\b(stool|step ?stool|steps?|ladder|platform|podium)\b/i, label: 'Stand on it', text: 'I climb up and stand on top of it.' },
  spin: { words: /\b(windmill|fan|spinner|pinwheel|top|carousel|turbine|propeller)\b/i, label: 'Spin it', text: 'It spins around.' },
};

const real = (o) => !o.image && !o.art && Array.isArray(o.parts) && o.parts.length;
// What the name says it is, or null. The thing's own "why" counts too ("a car I can drive").
export const behaviorOf = (o) => (real(o) ? Object.entries(KINDS).find(([, k]) => k.words.test(o.name ?? ''))?.[0] ?? null : null);

// null when it can do it, otherwise what is missing.
export function behaviorProblem(o) {
  const b = behaviorOf(o);
  if (!b) return null;
  if (b === 'light' && !o.parts.some((p) => p.glow)) return `${o.name} is meant to give light, but no part of it glows (a part with "glow": true is the light)`;
  if (b === 'stand' && o.kind !== 'floor') return `${o.name} is meant to be stood on, but it does not stand on the floor`;
  if (b === 'drive') {
    if (o.kind !== 'floor') return `${o.name} is meant to be driven, but it does not stand on the floor`;
    if (o.parts.filter((p) => ['cylinder', 'sphere', 'torus'].includes(p.shape)).length < 2) return `${o.name} is meant to be driven, but it has no wheels (it needs at least 2 round parts)`;
  }
  return null;
}

// Makes sure a thing that is meant to do something has a use that does it. Returns true when a use was added.
export function ensureBehaviors(o) {
  const b = behaviorOf(o);
  if (!b || behaviorProblem(o)) return false;
  o.uses ??= [];
  if (o.uses.some((u) => u.does === b)) return false;
  const use = { label: KINDS[b].label, text: KINDS[b].text, view: null, song: null, app: null, effect: b === 'light' ? 'calm' : 'joy', does: b };
  if (o.uses.length >= 3) o.uses[2] = use; // the third place is given up for it
  else o.uses.push(use);
  return true;
}
