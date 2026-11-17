// Pip's phone: the Lights app. Names, on/off, colour in warm or RGB mode, dim in steps, timers in Dutch time.
// Run: node tests/lights.mjs
import assert from 'node:assert/strict';
import { applyLight, lampNow, colorOf, LEVELS } from '../web/lights.js';
import { lightAt } from '../web/lighting.js';
import { toAnswer } from '../brain.js';

const ok = (name, fn) => { fn(); console.log(`ok  ${name}`); };
const lamp = () => ({ id: 'l1', name: 'amber reading light', pos: [-4.3, 0.85, 1.2], parts: [{ glow: true, color: '#ffaa00' }], uses: [{ does: 'light' }], lit: true });
const dutch = (hhmm) => Date.parse(`2026-11-17T${hhmm}:00+01:00`);

ok('name, switch, dim in steps, warm colours only in warm mode, any colour in RGB mode', () => {
  const s = { decor: [lamp()] };
  assert.ok(applyLight(s, { lamp: 'amber', name: 'Desk glow' }).ok);
  assert.ok(applyLight(s, { lamp: 'desk glow', switch: 'off' }).ok);
  assert.equal(lampNow(s.decor[0]).on, false);
  assert.ok(applyLight(s, { lamp: 'desk glow', level: '50%' }).ok);
  assert.deepEqual([lampNow(s.decor[0]).on, lampNow(s.decor[0]).level], [true, 50]);
  assert.ok(applyLight(s, { lamp: 'desk glow', level: 40 }).failed, 'only 25, 50, 75 or 100');
  assert.ok(applyLight(s, { lamp: 'desk glow', color: '#123456' }).failed, 'warm mode: presets only');
  assert.ok(applyLight(s, { lamp: 'desk glow', color: 'lavender' }).ok);
  assert.ok(applyLight(s, { lamp: 'desk glow', mode: 'rgb', color: '#123456' }).ok);
  assert.equal(lampNow(s.decor[0]).color, '#123456');
  assert.equal(colorOf('sky'), '#8fd3ff');
  assert.deepEqual(LEVELS, [25, 50, 75, 100]);
});

ok('timers switch, dim and colour at their Dutch time; the light model follows', () => {
  const s = { decor: [lamp()], weather: { kind: 'clear' }, furniture: {} };
  applyLight(s, { lamp: 'amber', timer: { at: '21:00', do: 'off' } }, { now: dutch('20:00') });
  applyLight(s, { lamp: 'amber', timer: { at: '20:30', do: 'dim', level: '25' } }, { now: dutch('20:00') });
  assert.equal(lampNow(s.decor[0], dutch('20:15')).level, 100);
  assert.equal(lampNow(s.decor[0], dutch('20:45')).level, 25);
  assert.equal(lampNow(s.decor[0], dutch('21:30')).on, false);
  const lit = lightAt(s, -4.3, 1.2, dutch('20:45')).level;
  const off = lightAt(s, -4.3, 1.2, dutch('21:30')).level;
  assert.ok(lit > off, 'a lamp that is on (even dimmed) gives light; off gives none');
});

ok('the brain can use the phone; a timer comes through', () => {
  const a = toAnswer({ moves: [{ move: 'phone', details: { lamp: 'amber', switch: 'on', timer: { at: '22:30', do: 'dim', level: '25' } } }] }, ['phone']);
  assert.equal(a.steps[0].action, 'phone');
  assert.equal(a.steps[0].details.timer.at, '22:30');
  const s = { decor: [lamp()] };
  assert.ok(applyLight(s, a.steps[0].details).ok);
});
