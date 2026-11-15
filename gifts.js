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

export function giveForAsk(s, item) {
  const t = String(item ?? '').toLowerCase();
  const given = [];
  if (/seed/.test(t)) {
    const named = KNOWN_SEEDS.filter((k) => t.includes(k.replace(/y$/, '')));
    for (const k of named.length ? named : STARTER_SEEDS) if (addSeeds(s, k, 4)) given.push(`${k} seeds`);
    return given;
  }
  if (FOOD.test(t)) { // food first: "some bread" is food, not a tool
    const food = t.match(FOOD)[0].replace(/^(food|snacks?|vegetables|fruit)$/, 'bread');
    for (let i = 0; i < 3; i++) addIngredient(s, food);
    return [food];
  }
  for (const k of Object.keys(HELD)) if (t.includes(k) && addTool(s, k)) given.push(`a ${k}`);
  if (!given.length && toolKind(t) && addTool(s, t)) given.push(t); // only tools the game knows (shovel, toolbox, sewing kit...)
  return given;
}
