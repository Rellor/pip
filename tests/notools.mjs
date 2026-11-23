// He needs no tools any more (tools.js), he has a toolbox anyway, and the build workshop is where he builds.
import assert from 'node:assert/strict';
import { missingTool, toolsGuide, NEEDS } from '../tools.js';
import { applyChanges } from '../changes.js';
import { BUILDINGS, TOWN_SPOTS, ROUTES, townBlocked, TOWN_X, paintTarget, buildPlace } from '../web/town.js';

const ok = (name) => console.log(`ok  ${name}`);
const bare = { tools: [], decor: [], stored: [] };
for (const action of Object.keys(NEEDS)) assert.equal(missingTool(bare, action), null, `${action} needs no tool`);
assert.match(toolsGuide(), /I do not need a tool for anything I do/);
assert.ok(toolsGuide().length < 500, 'the rule is short now');
ok('nothing he does needs a tool any more');

{
  const s = { changes: [], memories: [], tools: [], decor: [], stored: [], pantry: [], wardrobe: [], visitors: [], wishes: [], asks: [{ id: 'a1', item: 'a small hammer', why: 'to build a shelf', status: 'open' }, { id: 'a2', item: 'a harp', why: 'to hear it', status: 'open' }] };
  const notes = applyChanges(s, Date.parse('2026-11-23T18:00:00Z'));
  assert.ok(notes.some((n) => /Bas gave me a toolbox[\s\S]*do not need small things[\s\S]*build workshop/.test(n)));
  assert.ok(s.tools.some((t) => t.kind === 'toolbox'), 'the toolbox is in his inventory');
  assert.deepEqual(s.asks.map((a) => a.status), ['done', 'open'], 'an open ask for a small tool is done; other asks stay');
  ok('he gets a toolbox, and his asks for small tools are settled');
}

const b = BUILDINGS.find((x) => x.key === 'build');
assert.ok(b && !b.decor && TOWN_SPOTS.build && ROUTES.build && !townBlocked(TOWN_X + TOWN_SPOTS.build.x, TOWN_SPOTS.build.z, 0.2));
assert.ok(!BUILDINGS.some((x) => x.key === 'closed'), 'the closed shop has opened');
assert.equal(paintTarget('the wall by the build workshop').key, 'wall_5');
assert.equal(buildPlace('outside by the build workshop').key, 'buildshop');
ok('the build workshop is a real building with a door he walks to');
