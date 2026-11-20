// A new lamp is only needed where none of his lamps reaches, even switched on (the game knows each lamp's reach, on or off).
import assert from 'node:assert/strict';
import { needLampSpots, darkSpots } from '../growth.js';
const night = Date.parse('2026-11-18T22:00:00Z');
const lamp = (name, x, z, lit) => ({ id: name, name, kind: 'surface', pos: [x, 0.85, z], lit, parts: [{ shape: 'sphere', size: [0.1], pos: [0, 0.3, 0], glow: true, color: '#ffcc88' }], uses: [{ label: 'Switch', does: 'light' }] });
const base = () => ({ decor: [], weather: { kind: 'clear' }, last: { sleeping: false }, fixedLamps: [{ id: 'room-lamp', fixed: true, lit: false, parts: [{ glow: true }], uses: [{ does: 'light' }] }, { id: 'hall-lamp', fixed: true, lit: false, parts: [{ glow: true }], uses: [{ does: 'light' }] }] });

const s = base();
const bed = darkSpots(s, night).find((p) => p.name === 'bed');
assert.ok(bed, 'the bed is dark at night with no lamps');
s.decor.push(lamp('bed lamp', bed.x, bed.z, false));
assert.ok(darkSpots(s, night).some((p) => p.name === 'bed'), 'still dark: the lamp is off');
assert.ok(!needLampSpots(s, night).some((p) => p.name === 'bed'), 'but no new lamp is needed: the one there reaches it');
console.log('ok  a lamp that is off still counts: switch it on, no new lamp needed there');
assert.ok(needLampSpots(s, night).some((p) => p.name !== 'bed'), 'far corners still need one');
console.log('ok  a place no lamp reaches still needs a lamp');
{
  const { designate } = await import('../placement.js');
  const t = base();
  const RealNow = Date.now; Date.now = () => night;
  const p = designate(t, { name: 'cozy bed reading lamp', parts: [{ shape: 'sphere', size: [0.1], pos: [0, 0.1, 0], glow: true }] });
  Date.now = RealNow;
  const dark = needLampSpots(t, night)[0];
  assert.ok(p.next_to || p.on, JSON.stringify(p));
  assert.ok(!p.on || p.on !== 'desk' || dark.name === 'desk', `a new lamp goes where it is dark (${dark.name}), not to the desk: ${JSON.stringify(p)}`);
  console.log('ok  a new lamp goes to the dark place, not where the other lamps are');
}
