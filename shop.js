// The grocery store and Pip's coins. Until now everything he needed came from Bas (ask, wait, hope). Now he can earn a few
// coins (a thing made for a note on the notice board, the prints he sells on market day) and buy small things himself: food, seeds,
// materials, a tool, and after saving up, an instrument. Scarcity gives him choices to make, and a reason to finish
// things. (Research: a small economy and scarce resources drove the most interesting behaviour in similar worlds.)
// Plain code, no model. Bas can still give him anything.
import { giveForAsk } from './gifts.js';

import { OPEN_FROM, OPEN_TO, CATALOGUE, shopOpen, owns } from './web/street.js'; // what the shop sells and when it is open: shared with the page
export { OPEN_FROM, OPEN_TO, CATALOGUE, shopOpen };
const find = (item) => { const t = String(item ?? '').toLowerCase().replace(/^(a|an|some|the)\s+/, '').trim(); return t ? CATALOGUE.find((c) => c.item === t) ?? CATALOGUE.find((c) => t.includes(c.item) || c.item.includes(t)) ?? null : null; };

// What he might want now, cheapest of each: what a project needs, food when the pantry is empty, then things he does not own.
export function shopList(s, max = 6) {
  const coins = s.coins ?? 0;
  const needs = (s.projects ?? []).filter((p) => p.status === 'working').flatMap((p) => p.needs ?? []).map((n) => find(n)).filter(Boolean);
  const hungry = (s.fullness ?? 10) <= 4 && !(s.pantry ?? []).some((p) => p.qty > 0);
  const rest = CATALOGUE.filter((c) => !owns(s, c) && c.kind !== 'food');
  const pick = [...needs, ...(hungry ? CATALOGUE.filter((c) => c.kind === 'food').slice(0, 2) : []), ...rest.filter((c) => c.price <= coins).sort((a, b) => b.price - a.price), ...rest.filter((c) => c.price > coins).sort((a, b) => a.price - b.price), CATALOGUE[0]];
  return [...new Map(pick.filter((c) => !owns(s, c)).map((c) => [c.item, c])).values()].slice(0, max);
}
// The words for the buy move: "(I have 5 coins) clay 3, wool 3, ...".
export const shopLine = (s) => shopList(s).map((c) => `${c.item} ${c.price}`).join(', ');
// Can he buy something he could use right now? (for how inviting the move is)
export const wantsToBuy = (s) => { const coins = s.coins ?? 0; return shopList(s, 3).some((c) => c.price <= coins); };

// Buys one thing. Returns { bought, price, left } or { failed }.
export function buy(s, item, now = Date.now()) {
  const c = find(item);
  const coins = s.coins ?? 0;
  if (!shopOpen(now)) return { failed: `the grocery store is closed now (it is open from ${OPEN_FROM}:00 to ${OPEN_TO}:00). I go when it is open` };
  if (!c) return { failed: `the grocery store does not have "${String(item ?? '').slice(0, 30)}". It has: ${CATALOGUE.filter((x) => x.kind !== 'food').slice(0, 12).map((x) => x.item).join(', ')}, and simple food` };
  if (owns(s, c) && c.kind !== 'material') return { failed: `I already have a ${c.item}` };
  if (coins < c.price) return { failed: `${c.item} costs ${c.price} coins and I have ${coins}. I earn coins on market day` };
  const given = giveForAsk(s, c.item);
  if (!given.length) return { failed: `I could not carry the ${c.item} home (my bag is full)` };
  s.coins = coins - c.price;
  s.bought = [...(s.bought ?? []), { item: c.item, price: c.price, at: new Date(now).toISOString() }].slice(-30);
  return { bought: c.item, price: c.price, left: s.coins };
}
