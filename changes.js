// One-time changes Bas asks for. Each runs once, on Pip's next wake-up, and is remembered in s.changes,
// so the live loop applies it itself (no need to pause him). Nothing is deleted: what goes, goes to s.archive.
import { HELD } from './instruments.js';

const CHANGES = [
  {
    id: '2026-11-15 greenhouse by the window, instruments by asking',
    run(s, at) {
      // The piano leaves the room; the greenhouse takes its place on the back wall, left of the window.
      s.furniture = { ...(s.furniture ?? {}), piano: { gone: true, at } };
      for (const d of [...(s.decor ?? [])]) {
        if (d.zone !== 'on_piano') continue;
        s.decor.splice(s.decor.indexOf(d), 1);
        (s.stored ??= []).push({ ...d, storedAt: at });
      }
      const gh = (s.decor ?? []).find((d) => !d.image && /greenhouse/i.test(d.name));
      if (gh) Object.assign(gh, { pos: [-2.6, 0, -4.55], rotY: 0, zone: 'floor', base: null, side: 'back', label: 'on the floor by the back wall, left of the window', movedAt: at });
      // Instruments: he asks for the ones he wants. The ones he had go to the archive.
      const held = (x) => Object.hasOwn(HELD, String(x ?? '').toLowerCase());
      for (const t of [...(s.tools ?? [])].filter((t) => held(t.kind))) {
        s.tools.splice(s.tools.indexOf(t), 1);
        (s.archive ??= []).push({ group: 'tool', item: t, reason: 'Instruments come when I ask for them.', at, from: 'bas' });
      }
      for (const d of [...(s.stored ?? []), ...(s.decor ?? [])].filter((d) => held(d.tool))) {
        const list = s.stored.includes(d) ? s.stored : s.decor;
        list.splice(list.indexOf(d), 1);
        (s.archive ??= []).push({ group: 'chest', item: d, reason: 'Instruments come when I ask for them.', at, from: 'bas' });
      }
      return 'My piano and my instruments are gone for now, and my greenhouse stands by the window where the piano was. If I want to play music, I can ask Bas for an instrument.';
    },
  },
  {
    id: '2026-11-15 old clothes put away',
    run(s, at) {
      const clothes = [...(s.wardrobe ?? [])];
      for (const c of clothes) (s.archive ??= []).push({ group: 'clothes', item: c, reason: 'My old clothes did not show; I start fresh.', at, from: 'bas' });
      s.wardrobe = [];
      return clothes.length ? `My old clothes are put away (${clothes.map((c) => c.name).join(', ')}). If I want something to wear, I can make something new.` : null;
    },
  },
];

// Runs the changes this state has not had yet. Returns the memories they leave.
export function applyChanges(s, now = Date.now()) {
  s.changes ??= [];
  const notes = [];
  for (const c of CHANGES) {
    if (s.changes.includes(c.id)) continue;
    const note = c.run(s, new Date(now).toISOString());
    s.changes.push(c.id);
    if (note) notes.push(note);
  }
  return notes;
}
