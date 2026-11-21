// When Bas does what Pip asked ("I did this for you"), code hands over the real thing, so a gift never depends on the model
// noticing it: seeds go in his seed bag, tools and instruments in his inventory, food in his pantry. Returns what was given.
import { addSeeds } from './garden.js';
import { addTool, toolKind } from './tools.js';
import { addIngredient } from './food.js';
import { HELD } from './instruments.js';

// Seeds he can grow (web/gardening.js); a plain "seeds" ask gets a starter mix that is quick to eat.
const KNOWN_SEEDS = ['rosemary', 'lavender', 'basil', 'mint', 'thyme', 'parsley', 'chive', 'tomato', 'sunflower', 'daisy', 'tulip', 'strawberry', 'lettuce', 'radish', 'carrot', 'bean', 'pea', 'potato', 'spinach', 'pepper'];
export const STARTER_SEEDS = ['basil', 'mint', 'strawberry'];
const FOOD = /\b(bread|rice|eggs?|potato(es)?|carrots?|apples?|milk|cheese|flour|butter|onions?|tomato(es)?|berr(y|ies)|soup|pasta|beans|fruit|vegetables|food|snacks?|honey|oats)\b/i;

// Materials to make things with: when he asks for one of these, Bas can simply give it (it goes with his tools).
const MATERIALS = /\b(clay|wool|wire|wood|planks?|sticks?|twigs?|string|rope|yarn|beads?|stones?|pebbles?|shells?|paper|cardboard|glass|metal|wax|plaster|cork|leather|felt|sand|ribbons?|buttons?|magnets?|batter(y|ies)|light ?bulbs?|led|leds|bricks?|tiles?)\b/i;
export function giveForAsk(s, item) {
  const t = String(item ?? '').toLowerCase();
  const given = [];
  if (/seed/.test(t)) { // seeds (and maybe something else in the same ask, like "seeds and bread")
    const named = KNOWN_SEEDS.filter((k) => t.includes(k.replace(/y$/, '')));
    for (const k of named.length ? named : STARTER_SEEDS) if (addSeeds(s, k, 4)) given.push(`${k} seeds`);
  }
  const rest = t.replace(/[\w-]*\s*seeds?/g, ' '); // "vegetable seeds" is not food
  if (FOOD.test(rest)) { // food before tools: "some bread" is food, not a tool
    const food = rest.match(FOOD)[0].replace(/^(food|snacks?|vegetables|fruit)$/, 'bread');
    for (let i = 0; i < 3; i++) addIngredient(s, food);
    given.push(food);
  }
  if (given.length) return given;
  for (const k of Object.keys(HELD)) if (t.includes(k) && addTool(s, k)) given.push(`a ${k}`);
  if (!given.length && toolKind(t) && addTool(s, t)) given.push(t); // tools the game knows (shovel, toolbox, sewing kit...)
  const thing = t.replace(/^\s*(some|a|an|the|more|my|new)\s+/, '').trim();
  if (!given.length && MATERIALS.test(thing) && addTool(s, thing)) given.push(thing); // a material to make with (clay, wire, wood): it goes with his tools
  return given;
}
