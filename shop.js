// The grocery store. There is no money in Pip's world: nothing costs anything. He walks to the store and takes what he
// needs: food, seeds, materials, a tool. A few things a day, so it stays something he goes and does (and so his day is
// never spoiled by an empty pantry). Plain code, no model. Bas can still give him anything.
import { giveForAsk } from './gifts.js';
import { isToday } from './days.js';

import { OPEN_FROM, OPEN_TO, CATALOGUE, shopOpen, owns } from './web/street.js'; // what the shop sells and when it is open: shared with the page
export { OPEN_FROM, OPEN_TO, CATALOGUE, shopOpen };
const find = (item) => { const t = String(item ?? '').toLowerCase().replace(/^(a|an|some|the)\s+/, '').trim(); return t ? CATALOGUE.find((c) => c.item === t) ?? CATALOGUE.find((c) => t.includes(c.item) || c.item.includes(t)) ?? null : null; };

export const TAKES_PER_DAY = 4; // things he takes home from the store in one day
const takenToday = (s, now) => (s.bought ?? []).filter((b) => isToday(b.at, now)).length;
// What he might want now: what a project needs, food when the pantry is empty, then things he does not own.
export function shopList(s, max = 6) {
  const needs = (s.projects ?? []).filter((p) => p.status === 'working').flatMap((p) => p.needs ?? []).map((n) => find(n)).filter(Boolean);
  const hungry = (s.fullness ?? 10) <= 5 && !(s.pantry ?? []).some((p) => p.qty > 0);
  const rest = CATALOGUE.filter((c) => !owns(s, c) && c.kind !== 'food');
  const pick = [...needs, ...(hungry ? CATALOGUE.filter((c) => c.kind === 'food').slice(0, 3) : []), ...rest, CATALOGUE[0]];
  return [...new Map(pick.filter((c) => !owns(s, c)).map((c) => [c.item, c])).values()].slice(0, max);
}
// The words for the move: "bread, eggs, clay, ...".
export const shopLine = (s) => shopList(s).map((c) => c.item).join(', ');
// Is there something there he could use right now? (for how inviting the move is)
export const wantsToBuy = (s) => shopList(s, 3).length > 0;
export const canTake = (s, now = Date.now()) => takenToday(s, now) < TAKES_PER_DAY;

// He takes one thing home from the store. Returns { bought } or { failed }. (The name "buy" stays in his log and his
// day: it is the same walk to the same store. Only the paying is gone.)
export function buy(s, item, now = Date.now()) {
  const c = find(item);
  if (!shopOpen(now)) return { failed: `the grocery store is closed now (it is open from ${OPEN_FROM}:00 to ${OPEN_TO}:00). I go when it is open` };
  if (!c) return { failed: `the grocery store does not have "${String(item ?? '').slice(0, 30)}". It has: ${CATALOGUE.filter((x) => x.kind !== 'food').slice(0, 12).map((x) => x.item).join(', ')}, and simple food` };
  if (owns(s, c) && c.kind !== 'material') return { failed: `I already have a ${c.item}` };
  if (!canTake(s, now)) return { failed: `I took ${TAKES_PER_DAY} things from the store today already: that is enough to carry` };
  const given = giveForAsk(s, c.item);
  if (!given.length) return { failed: `I could not carry the ${c.item} home (my bag is full)` };
  s.bought = [...(s.bought ?? []), { item: c.item, at: new Date(now).toISOString() }].slice(-30);
  return { bought: c.item };
}
