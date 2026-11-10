// Pip's pantry and kitchen. A small daily stock of plain ingredients refills by itself, so he never starves.
// Dishes are cooked in a kitchen he builds himself. Eating a dish fills him more than a plain snack.

export const BASICS = ['bread', 'rice', 'eggs', 'potatoes', 'carrots', 'apples', 'milk', 'cheese', 'flour', 'butter', 'onions', 'tomatoes'];
export const MAX_PANTRY = 24;
export const MAX_COOKS_PER_DAY = 4;
export const DISH_GAIN = 5;
export const INGREDIENT_GAIN = 2.5;

const clean = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const same = (a, b) => {
  const x = clean(a, 80).toLowerCase();
  const y = clean(b, 80).toLowerCase();
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};
const find = (pantry, name, kind) => pantry.find((p) => p.qty > 0 && (!kind || p.kind === kind) && same(p.name, name));

// A new day: every plain ingredient is back to at least 2.
export function refillPantry(s, now = Date.now()) {
  s.pantry ??= [];
  const day = new Date(now).toISOString().slice(0, 10);
  if (s.pantryDay === day) return;
  s.pantryDay = day;
  for (const name of BASICS) {
    const have = s.pantry.find((p) => p.kind === 'ingredient' && p.name === name);
    if (have) have.qty = Math.max(have.qty, 2);
    else s.pantry.push({ name, kind: 'ingredient', qty: 2 });
  }
}

// A thing in his room that is a kitchen: judged by its name and by what he said it is for.
export function kitchenIn(decor) {
  return (decor ?? []).find((d) => !d.image && /kitchen|stove|oven|cooker|hob|cooking|kettle/i.test(`${d.name} ${(d.uses ?? []).map((u) => u.label).join(' ')}`)) ?? null;
}

export function pantryText(s) {
  const dishes = (s.pantry ?? []).filter((p) => p.kind === 'dish' && p.qty > 0).map((p) => `${p.name} x${p.qty} (a dish I cooked)`);
  const stuff = (s.pantry ?? []).filter((p) => p.kind === 'ingredient' && p.qty > 0).map((p) => `${p.name} x${p.qty}`);
  const kitchen = kitchenIn(s.decor);
  return `${[...dishes, ...stuff].map((x) => `- ${x}`).join('\n') || '- nothing right now'}\n${kitchen ? `My kitchen: ${kitchen.name}. I can cook with it.` : 'I have no kitchen yet. I can build one myself with decorate and then cook.'}`;
}

// What eating this would give, or null when it is not in the pantry (then it is a plain snack).
export function mealGain(pantry, food) {
  const dish = find(pantry ?? [], food, 'dish');
  if (dish) return { item: dish, gain: DISH_GAIN };
  const ing = find(pantry ?? [], food, 'ingredient');
  return ing ? { item: ing, gain: INGREDIENT_GAIN } : null;
}

// Cooks a dish from ingredients in the pantry. Needs a kitchen. Returns { ok, dish } or { failed }.
export function cook(s, d, now = Date.now()) {
  s.pantry ??= [];
  s.cookedAt ??= [];
  const dish = clean(d?.dish ?? d?.name, 60);
  const wanted = (Array.isArray(d?.ingredients) ? d.ingredients : []).map((x) => clean(x, 40)).filter(Boolean).slice(0, 4);
  if (!dish || !wanted.length) return { failed: 'a dish needs a name and 1 to 4 ingredients' };
  if (!kitchenIn(s.decor)) return { failed: 'I have no kitchen in my room yet' };
  if (s.cookedAt.filter((t) => now - Date.parse(t) < 86_400_000).length >= MAX_COOKS_PER_DAY) return { failed: `I already cooked ${MAX_COOKS_PER_DAY} times today` };
  const used = [];
  for (const w of wanted) {
    const hit = find(s.pantry, w, 'ingredient');
    if (!hit || used.includes(hit)) return { failed: `I have no ${w} in my pantry` };
    used.push(hit);
  }
  const have = s.pantry.find((p) => p.kind === 'dish' && p.name.toLowerCase() === dish.toLowerCase());
  if (!have && s.pantry.length >= MAX_PANTRY) return { failed: 'my pantry is full' };
  for (const u of used) u.qty -= 1;
  if (have) have.qty = Math.min(3, have.qty + 1);
  else s.pantry.push({ name: dish, kind: 'dish', qty: 1, ingredients: wanted, madeAt: new Date(now).toISOString() });
  s.pantry = s.pantry.filter((p) => p.qty > 0 || p.kind === 'ingredient');
  s.cookedAt = [...s.cookedAt, new Date(now).toISOString()].slice(-10);
  return { ok: true, dish };
}

// Something Bas gave him that he asked for is added as an ingredient (at most 2 each).
export function addIngredient(s, name) {
  s.pantry ??= [];
  const n = clean(name, 40);
  if (!n) return false;
  const have = s.pantry.find((p) => p.kind === 'ingredient' && same(p.name, n));
  if (have) have.qty = Math.min(6, have.qty + 2);
  else if (s.pantry.length < MAX_PANTRY) s.pantry.push({ name: n.toLowerCase(), kind: 'ingredient', qty: 2 });
  return true;
}

// Eating something from the pantry: takes one away. Returns the gain to use.
export function eatFromPantry(s, food) {
  const m = mealGain(s.pantry, food);
  if (!m) return null;
  m.item.qty -= 1;
  s.pantry = s.pantry.filter((p) => p.qty > 0 || p.kind === 'ingredient');
  return m.gain;
}
