// The World tab: where Pip is, and then four short pages to choose from, so nobody has to scroll through everything:
// Places (the map, where he can go, his plot, postcards, what he brought home), People (his street, wishes, neighbours),
// Shop (his coins and what is for sale) and Today (what is coming and what happened). Everything is read from
// state.json; nothing is asked of a server.
import { PEOPLE, warmthWord, hearts, nextStep, CATALOGUE, SHOP_ICON, OPEN_FROM, OPEN_TO, shopOpen, owns, hourNL, moonPhase, moonWord, nextFullMoon, sceneOf, faceSvg, streetSvg, SPOTS, STREET_SIZE } from './street.js';
import { PLACES, placeOf, openNow, worldMapSvg, postcardSvg, hisWords } from './world.js';

const DAY = 86_400_000;
const WISH_DAYS = 6; // a wish he does not take fades after this many days (neighbours.js)
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nl = (now, o) => new Date(now).toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', ...o });
const dayNL = (now) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : /(sh|ch|s|x)$/.test(w) ? 'es' : 's'}`;
const ago = (iso, now) => {
  const d = now - Date.parse(iso);
  if (!Number.isFinite(d)) return '';
  if (dayNL(Date.parse(iso)) === dayNL(now)) return `today ${nl(Date.parse(iso), { hour: '2-digit', minute: '2-digit' })}`;
  if (d < 2 * DAY && dayNL(Date.parse(iso)) === dayNL(now - DAY)) return 'yesterday';
  return d < 7 * DAY ? `${Math.max(2, Math.round(d / DAY))} days ago` : nl(Date.parse(iso), { day: 'numeric', month: 'short' });
};
const nameOf = (v) => String(v?.name ?? v?.from ?? '').replace(' (neighbour)', '').trim();

// Everything the tab shows, worked out from his state (plain data, so it can be tested without a page).
export function streetData(s, now = Date.now()) {
  const today = dayNL(now);
  const log = (s.teller?.log ?? []).filter((e) => e?.at && e?.text);
  const notes = (s.visitors ?? []).filter((v) => v.npc);
  const wishes = s.wishes ?? [];
  const h = hourNL(now);
  const weekday = nl(now, { weekday: 'long' });
  const coins = Number.isFinite(s.coins) ? s.coins : 0;
  const open = shopOpen(now);
  const mine = CATALOGUE.filter((c) => !owns(s, c));
  const can = mine.filter((c) => c.kind !== 'food' && c.price <= coins).sort((a, b) => b.price - a.price).slice(0, 5);
  const saving = mine.filter((c) => c.price > coins && (c.kind === 'instrument' || c.kind === 'tool')).sort((a, b) => a.price - b.price)[0] ?? null;
  const openW = wishes.filter((w) => w.status === 'open' && now - Date.parse(w.at) <= WISH_DAYS * DAY).map((w) => ({ ...w, left: Math.max(0, Math.ceil((Date.parse(w.at) + WISH_DAYS * DAY - now) / DAY)) }));
  const kept = wishes.filter((w) => w.status === 'kept').sort((a, b) => Date.parse(b.keptAt) - Date.parse(a.keptAt)).slice(0, 6);
  const people = PEOPLE.map((p) => {
    const st = s.street?.people?.[p.name] ?? {};
    const theirs = notes.filter((v) => nameOf(v) === p.name).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const last = theirs.at(-1) ?? null;
    const w = st.warmth ?? 0;
    const scene = log.filter((e) => dayNL(Date.parse(e.at)) === today && sceneOf(e.key).at === p.name).at(-1) ?? (p.name === 'Kees' ? log.filter((e) => dayNL(Date.parse(e.at)) === today && e.key === 'street:clock').at(-1) : null) ?? null;
    return { ...p, warmth: w, word: warmthWord(w), hearts: hearts(w), next: nextStep(w), last, notes: theirs.length, waiting: theirs.filter((v) => !v.answer).length, kept: wishes.filter((x) => x.from === p.name && x.status === 'kept').length, wish: openW.find((x) => x.from === p.name) ?? null, thank: st.thank ?? null, awake: h >= p.up[0] && h < p.up[1], scene };
  });
  const sat = (6 - new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getDay() + 7) % 7;
  const wed = (3 - new Date(new Date(now).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })).getDay() + 7) % 7;
  const full = nextFullMoon(now);
  const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);
  const market = weekday === 'Saturday' && h >= 10 && h < 16;
  const coming = [
    { emoji: '🧺', what: 'Market day', when: sat === 0 ? (h < 16 ? 'today, 10:00 to 16:00' : 'next Saturday') : `Saturday (${inDays(sat)})`, why: 'He sells little prints of what he made this week.' },
    { emoji: '🧩', what: 'Kees’s puzzle of the week', when: wed === 0 ? 'today' : `Wednesday (${inDays(wed)})`, why: 'A small program to make, for 5 coins.' },
    { emoji: '🌕', what: 'Full moon', when: inDays(Math.max(0, Math.round((full - now) / DAY))), why: `Now: ${moonWord(moonPhase(now))}.` },
  ];
  const w = s.weather ?? {};
  const cap = [`${weekday} ${nl(now, { hour: '2-digit', minute: '2-digit' })}`, w.kind ? `${w.kind}${Number.isFinite(w.temp) ? `, ${Math.round(w.temp)}°` : ''}` : '', open ? `shop open till ${OPEN_TO}:00` : `shop closed (opens ${OPEN_FROM}:00)`].filter(Boolean).join(' · ');
  // his world: where he is, the places he knows, the postcards of his outings, what he brought home
  const wh = s.where && placeOf(s.where.place) && s.where.place !== 'home' ? s.where : null;
  const phase = !wh ? null : now < Date.parse(wh.leftAt) ? null : now < Date.parse(wh.arriveAt) && !wh.cut ? 'going' : now < Date.parse(wh.leaveAt) ? 'there' : 'back';
  const openKeys = new Set(PLACES.filter((p) => !p.locked || s.world?.open?.[p.key]).map((p) => p.key));
  const hmNL = (iso) => nl(Date.parse(iso), { hour: '2-digit', minute: '2-digit' });
  const hoursWords = (p) => (p.hours === 'light' ? 'while it is light' : p.hours === 'evening' ? 'until the first stars' : `${p.hours?.[0] ?? 8}:00 to ${p.hours?.[1] ?? 21}:00${p.days ? ', Tuesday to Saturday' : ''}`);
  const outings = (s.outings ?? []).filter((o) => o && placeOf(o.place));
  const world = {
    away: Boolean(wh && phase),
    place: wh && phase ? wh.place : 'home',
    phase,
    now: !wh || !phase ? { emoji: s.last?.sleeping ? '💤' : '🏠', line: s.last?.sleeping ? 'Pip is at home, asleep.' : 'Pip is at home.', sub: '' }
      : { emoji: phase === 'there' ? placeOf(wh.place).emoji : phase === 'going' ? '🚶' : '🏠', line: phase === 'going' ? `Pip is walking to ${placeOf(wh.place).name.replace(/^my /, 'his ')}.` : phase === 'there' ? `Pip is at ${placeOf(wh.place).name.replace(/^my /, 'his ')}.` : `Pip is walking home from ${placeOf(wh.place).name.replace(/^my /, 'his ')}.`, sub: `${phase === 'there' && wh.words && !wh.errand ? `He wants to ${hisWords(wh.place, wh.words)}. ` : ''}Home again around ${hmNL(wh.homeAt)}.` },
    map: { now, weather: s.weather, where: wh && phase ? wh.place : 'home', phase, unlocked: [...openKeys], known: Object.keys(s.world?.known ?? {}), open: Object.fromEntries(PLACES.filter((p) => p.key !== 'home').map((p) => [p.key, openNow(p, now)])) },
    places: PLACES.filter((p) => p.key !== 'home').map((p) => ({ key: p.key, title: p.title, emoji: p.emoji, walk: p.walk, blurb: p.blurb, hours: hoursWords(p), unlocked: openKeys.has(p.key), heard: openKeys.has(p.key) || Boolean(p.seen) || Boolean(s.world?.known?.[p.key]), lock: p.locked ?? null, open: openNow(p, now), visits: outings.filter((o) => o.place === p.key && !o.errand).length, things: (p.things ?? []).map((t) => hisWords(p.key, t.words)) })),
    cards: outings.filter((o) => !o.errand).slice(-8).reverse().map((o) => ({ id: o.id, place: o.place, title: placeOf(o.place).title, at: o.homeAt, when: ago(o.homeAt, now), did: o.did, found: o.found ?? [], met: o.met ?? null, weather: o.weather })),
    finds: (s.finds ?? []).slice(-24).reverse().map((f) => ({ ...f, where: placeOf(f.from)?.title ?? '' })),
    trips: s.world?.count ?? outings.filter((o) => !o.errand).length,
    plot: (s.decor ?? []).filter((d) => d.kind === 'outside').map((d) => d.name),
    // what he built out in his world, and where (he picks the place himself: town.js)
    built: (s.decor ?? []).filter((d) => d.kind === 'outside').map((d) => ({ name: d.name, where: String(d.label ?? '').replace(/^outside,? /, '').replace(/, across the street from my door$/, '').replace(/\bmy\b/g, 'his') || 'outside', metres: Number(d.metres) > 0 ? Math.round(d.metres) : null })).reverse(),
  };
  return {
    world,
    scene: { now, weather: s.weather, today: log.filter((e) => dayNL(Date.parse(e.at)) === today).map((e) => e.key), notes: notes.filter((v) => !v.answer).length, market, puzzle: openW.some((x) => x.from === 'Kees' && /puzzle/i.test(x.text)), away: world.away },
    shelf: Object.keys(SHOP_ICON).map((kind) => ({ kind, icon: SHOP_ICON[kind], things: CATALOGUE.filter((c) => c.kind === kind).map((c) => ({ item: c.item, price: c.price, owned: owns(s, c), can: c.price <= coins })) })),
    cap, coins, open, can, saving, bought: (s.bought ?? []).slice(-5).reverse(), wishes: openW, kept, people, coming,
    happened: [...log].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12).map((e) => ({ ...e, emoji: sceneOf(e.key).emoji })), // the newest first
    count: openW.length,
  };
}

const heartsHtml = (n) => `<span class="st-hearts" aria-label="${n} of 5 hearts">${'<i class="on">♥</i>'.repeat(n)}${'<i>♥</i>'.repeat(5 - n)}</span>`;
const bubble = (who, text, mine = false) => `<div class="st-say${mine ? ' pip' : ''}"><b>${esc(who)}</b>${esc(text)}</div>`;
const KIND_WORD = { food: 'Food', seeds: 'Seeds', material: 'To make with', tool: 'Tools', instrument: 'Instruments', outdoor: 'For outside' };

// What the reader chose: which page, and what is folded open. Kept while the tab is drawn again (the page also in the browser).
export const PAGES = [['places', '🗺️', 'Places'], ['people', '👋', 'People'], ['shop', '🪙', 'Shop'], ['today', '📅', 'Today']];
const ui = { page: null, place: null, people: new Set() };
const recall = () => { try { const v = localStorage.getItem('pip.world.page'); return PAGES.some((p) => p[0] === v) ? v : null; } catch { return null; } };
const remember = (v) => { try { localStorage.setItem('pip.world.page', v); } catch { /* private window: it is only a convenience */ } };

// Draws the tab into `root`. `page` picks the page (otherwise the one chosen last).
export function renderStreet(root, s, now = Date.now(), page = null) {
  const d = streetData(s, now);
  const w = d.world;
  ui.page = page ?? ui.page ?? recall() ?? 'places';
  const waiting = d.people.reduce((n, p) => n + p.waiting, 0);
  const badge = { people: waiting + d.wishes.length || '', shop: d.coins, places: '', today: '' };
  const html = [];
  // where he is now (always in view), and the four pages
  const last = w.cards[0];
  const sub = w.now.sub || (last ? `Last outing: ${last.title.replace(/^His /, 'his ').replace(/^The /, 'the ')}, ${last.when}.` : 'He has not been out yet.');
  html.push(`<div class="st-card wd-now${w.away ? ' away' : ''}"><span class="wd-em">${w.now.emoji}</span><div><b>${esc(w.now.line)}</b><small>${esc(sub)}</small></div></div>`);
  html.push(`<div class="wd-nav" role="tablist" aria-label="Pages of his world">${PAGES.map(([k, em, name]) => `<button type="button" role="tab" data-page="${k}" aria-selected="${k === ui.page}" class="${k === ui.page ? 'on' : ''}"><span class="wd-ni">${em}</span><span>${name}</span>${badge[k] !== '' ? `<i class="${k === 'shop' ? 'coin' : ''}">${badge[k]}</i>` : ''}</button>`).join('')}</div>`);

  if (ui.page === 'places') {
    html.push(`<div class="wd-map">${worldMapSvg(w.map)}</div><p class="st-cap">Tap a place on the map to read about it.</p>`);
    const pill = (p) => (!p.unlocked ? '<span class="st-pill lock">🔒 Not yet</span>' : p.open ? '<span class="st-pill open">Open</span>' : '<span class="st-pill closed">Closed</span>');
    const heard = w.places.filter((p) => p.heard);
    const unknown = w.places.length - heard.length;
    html.push(`<div class="wd-places">${heard.map((p) => `<details class="wd-place${p.unlocked ? '' : ' locked'}" data-place="${p.key}"${ui.place === p.key ? ' open' : ''}><summary><span class="st-em">${p.emoji}</span><span class="wd-pt"><b>${esc(p.title)}</b><small>${p.unlocked ? `${p.walk} min walk${p.visits ? ` · been ${p.visits} time${p.visits === 1 ? '' : 's'}` : ' · not been yet'}` : 'He cannot go here yet'}</small></span>${pill(p)}</summary><p>${esc(p.blurb)}</p>${p.unlocked ? `<p class="wd-do">🕘 Open ${esc(p.hours)}.</p>` : ''}${p.unlocked && p.things.length ? `<p class="wd-do">✨ There he can: ${p.things.map(esc).join(', ')}.</p>` : ''}${!p.unlocked && p.lock ? `<p class="wd-do">🔒 ${esc(p.lock)}</p>` : ''}</details>`).join('')}${unknown ? `<div class="wd-more"><span class="st-em">❔</span><span><b>${unknown} more place${unknown === 1 ? '' : 's'} to find</b><small>They open up as he goes out and makes friends.</small></span></div>` : ''}</div>`);
    html.push(`<div class="st-card wd-plot"><span class="st-em">🧱</span><div><b>Built by Pip</b><small>He can build anywhere in his world, even bigger than a house.</small>${w.built.length ? `<ul class="wd-built">${w.built.slice(0, 12).map((b) => `<li><b>${esc(b.name)}</b><span>${esc(b.where)}${b.metres ? ` · ${b.metres} m` : ''}</span></li>`).join('')}</ul>${w.built.length > 12 ? `<p>and ${w.built.length - 12} more.</p>` : ''}` : '<p>Nothing stands outside yet. He picks the place himself: his plot, the street, the park.</p>'}</div></div>`);
    // postcards of his outings, and what he brought home
    html.push(`<h2>Postcards${w.trips ? ` <small>${plural(w.trips, 'outing')}</small>` : ''}</h2>`);
    if (w.cards.length) html.push(`<div class="wd-cards">${w.cards.map((c) => `<figure class="wd-card">${postcardSvg({ place: c.place, at: c.at, weather: c.weather, found: c.found })}<figcaption><b>${esc(c.title)}</b> <small>${esc(c.when)}</small><p>${esc(c.did)}</p>${c.found.length ? `<div class="st-tags">${c.found.map((f) => `<span class="st-tag coin">${f.emoji ?? '✨'} ${esc(f.name)}</span>`).join('')}</div>` : ''}</figcaption></figure>`).join('')}</div>`);
    else html.push('<p class="muted">He has not been out yet. When he goes, he comes home with a postcard of what he saw.</p>');
    html.push('<h2>Brought home</h2>');
    if (w.finds.length) html.push(`<div class="st-chips wd-finds">${w.finds.map((f) => `<span class="st-chip" title="${esc(f.where)}">${f.emoji ?? '✨'} ${esc(f.name.replace(/^an? /, ''))}</span>`).join('')}</div>`);
    else html.push('<p class="muted">Nothing yet. Sometimes he finds a feather, a stone or a leaf on the way.</p>');
  }

  if (ui.page === 'people') {
    html.push(`<div class="st-scene" id="stscene">${streetSvg(d.scene)}</div><p class="st-cap">${esc(d.cap)}</p>`);
    // wishes
    html.push('<h2>Wishes</h2>');
    if (d.wishes.length) for (const x of d.wishes) html.push(`<div class="st-card st-wish" data-goto="${esc(x.from)}"><div class="st-face">${faceSvg(x.from, 44)}</div><div class="st-body"><div class="st-line"><b>${esc(x.from)}</b> wishes for <b>${esc(x.topic)}</b></div><p>“${esc(x.text)}”</p><div class="st-tags"><span class="st-tag coin">🪙 ${x.reward} coins</span><span class="st-tag ${x.said ? 'yes' : ''}">${x.said ? '✓ Pip said yes' : 'Pip has not decided'}</span><span class="st-tag">${x.left <= 1 ? 'last day' : `${x.left} days left`}</span></div></div></div>`);
    else html.push('<p class="muted">No open wishes now. A neighbour asks for something about once a day.</p>');
    if (d.kept.length) html.push(`<details class="st-kept"><summary>${plural(d.kept.length, 'wish')} come true</summary>${d.kept.map((x) => `<div class="st-keptrow"><span>${faceSvg(x.from, 26)}</span><span><b>${esc(x.with || x.topic)}</b> for ${esc(x.from)} <small>${esc(ago(x.keptAt, now))} · 🪙 ${x.reward}</small></span></div>`).join('')}</details>`);
    // the neighbours: a short row each, tap for more
    html.push('<h2>Neighbours <small>tap one for more</small></h2>');
    for (const p of d.people) {
      const nx = p.next ? `${Math.max(0, Math.round((p.next.at - p.warmth) * 10) / 10)} more to “${p.next.word}”` : 'as close as can be';
      const flag = p.wish ? '<span class="st-flag wish">⭐ wish</span>' : p.waiting ? '<span class="st-flag">✉️ new note</span>' : '';
      html.push(`<details class="st-card st-person" data-who="${esc(p.name)}" id="stp-${esc(p.name.replace(/\s+/g, '-'))}" style="--who:${p.color}"${ui.people.has(p.name) ? ' open' : ''}>
        <summary class="st-top"><div class="st-face big">${faceSvg(p.name, 50)}${p.awake ? '' : '<span class="st-zz" title="asleep">💤</span>'}</div>
          <div class="st-id"><div class="st-name">${esc(p.name)}${flag}</div><div class="st-who">${esc(p.who)}</div><div class="st-fr">${heartsHtml(p.hearts)}<span>${esc(p.word)}</span></div></div><span class="st-arrow" aria-hidden="true">›</span></summary>
        <div class="st-sub">Likes</div><div class="st-chips likes">${p.likes.map((l) => `<span class="st-chip">${esc(l)}</span>`).join('')}</div>
        ${p.scene ? `<div class="st-today">${sceneOf(p.scene.key).emoji} Today: ${esc(p.scene.text)}</div>` : ''}
        ${p.last ? `<div class="st-talk">${bubble(`${p.name} · ${ago(p.last.at, now)}`, p.last.text)}${p.last.answer ? bubble('Pip', p.last.answer, true) : '<div class="st-wait">Pip has not answered yet</div>'}</div>` : '<p class="st-none">No note from ' + esc(p.name) + ' yet.</p>'}
        <div class="st-foot"><span>${plural(p.notes, 'note')}</span>${p.kept ? `<span>${plural(p.kept, 'wish')} come true</span>` : ''}<span>${esc(nx)}</span></div></details>`);
    }
    html.push('<p class="muted st-fine">The neighbours are made-up people of Pip’s world. They grow fonder of him when he answers their notes and makes what they wish for.</p>');
  }

  if (ui.page === 'shop') {
    const pct = d.saving ? Math.min(100, Math.round((d.coins / d.saving.price) * 100)) : 0;
    html.push(`<div class="st-card st-purse"><div class="st-coins"><span class="st-coin">🪙</span><div><b>${d.coins}</b><small>coin${d.coins === 1 ? '' : 's'} in Pip’s purse</small></div><span class="st-pill ${d.open ? 'open' : 'closed'}">${d.open ? 'Shop open' : 'Shop closed'}<small>${d.open ? `till ${OPEN_TO}:00` : `opens ${OPEN_FROM}:00`}</small></span></div>
      ${d.saving ? `<div class="st-sub">Saving up for: ${SHOP_ICON[d.saving.kind] ?? ''} ${esc(d.saving.item)} (${d.saving.price} coins)</div><div class="st-bar"><span style="width:${pct}%"></span></div>` : ''}
      ${d.bought.length ? `<div class="st-sub">Bought lately: ${d.bought.map((b) => esc(b.item)).join(', ')}</div>` : ''}</div>`);
    html.push('<h2>In the shop</h2>');
    html.push(`<div class="st-card st-shelf">${d.shelf.map((g) => `<div class="st-row"><span class="st-em">${g.icon}</span><span><b>${KIND_WORD[g.kind] ?? g.kind}</b><div class="st-chips">${g.kind === 'food' ? `<span class="st-chip${d.coins >= 1 ? '' : ' far'}">${g.things.map((t) => esc(t.item)).join(', ')} <b>1 each</b></span>` : g.things.map((t) => `<span class="st-chip${t.owned ? ' has' : t.can ? '' : ' far'}">${esc(t.item.replace(/ seeds$/, ''))} <b>${t.owned ? '✓' : t.price}</b></span>`).join('')}</div></span></div>`).join('')}</div>`);
    html.push('<p class="st-key"><span class="st-chip">can buy <b>4</b></span><span class="st-chip far">too dear <b>12</b></span><span class="st-chip has">has it <b>✓</b></span></p>');
    html.push('<h2>How he earns coins</h2><div class="st-card st-coming"><div class="st-row"><span class="st-em">⭐</span><span><b>A wish come true</b><br><small>He makes what a neighbour wished for: 2 to 5 coins.</small></span></div><div class="st-row"><span class="st-em">🖼️</span><span><b>A print</b><br><small>Someone buys a print of a drawing: 1 coin.</small></span></div><div class="st-row"><span class="st-em">🧺</span><span><b>Market day</b><br><small>On Saturday he sells little prints.</small></span></div></div>');
  }

  if (ui.page === 'today') {
    html.push('<h2>Coming up</h2>');
    html.push(`<div class="st-card st-coming">${d.coming.map((c) => `<div class="st-row"><span class="st-em">${c.emoji}</span><span><b>${esc(c.what)}</b> <small>${esc(c.when)}</small><br><small>${esc(c.why)}</small></span></div>`).join('')}</div>`);
    html.push('<h2>What happened</h2>');
    if (d.happened.length) html.push(`<ul class="st-log">${d.happened.map((e) => `<li class="${e.big ? 'big' : ''}"><span class="st-em">${e.emoji}</span><span>${esc(e.text)}<small>${esc(ago(e.at, now))}</small></span></li>`).join('')}</ul>`);
    else html.push('<p class="muted">Nothing has happened in the street yet.</p>');
  }

  const keep = root.querySelector('#stscene')?.scrollLeft;
  root.innerHTML = html.join('');
  const show = (k) => { ui.page = k; remember(k); renderStreet(root, s, now); root.closest('.pane')?.scrollTo?.({ top: 0 }); };
  root.querySelectorAll('.wd-nav [data-page]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.page !== ui.page) show(b.dataset.page); }));
  // what is folded open stays open when the tab is drawn again
  root.querySelectorAll('.wd-place').forEach((row) => row.addEventListener('toggle', () => { if (row.open) { ui.place = row.dataset.place; root.querySelectorAll('.wd-place[open]').forEach((x) => { if (x !== row) x.open = false; }); } else if (ui.place === row.dataset.place) ui.place = null; }));
  root.querySelectorAll('.st-person').forEach((card) => card.addEventListener('toggle', () => { if (card.open) ui.people.add(card.dataset.who); else ui.people.delete(card.dataset.who); }));
  root.querySelector('.wd-map')?.addEventListener('click', (e) => { const g = e.target.closest('[data-place]'); const row = g && root.querySelector(`.wd-place[data-place="${g.dataset.place === 'home' ? 'doorstep' : g.dataset.place}"]`); if (row) { row.open = true; row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } });
  const scene = root.querySelector('#stscene');
  if (scene) {
    // the picture is wider than the panel: it starts with Pip's home in the middle, and stays where it was swiped to
    const pic = scene.querySelector('svg');
    const center = () => { const k = pic.getBoundingClientRect().width / STREET_SIZE[0]; scene.scrollLeft = Number.isFinite(keep) && keep > 0 ? keep : Math.max(0, SPOTS.Pip * k - scene.clientWidth / 2); };
    center();
    if (!scene.clientWidth) requestAnimationFrame(center);
    const goto = (who) => { const card = root.querySelector(`#stp-${CSS.escape(String(who).replace(/\s+/g, '-'))}`); if (card) { card.open = true; card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1400); } };
    scene.addEventListener('click', (e) => { const g = e.target.closest('[data-who]'); if (!g) return; const who = g.dataset.who; if (who === 'shop') show('shop'); else if (who !== 'Pip') goto(who); });
    root.querySelectorAll('[data-goto]').forEach((n) => n.addEventListener('click', () => goto(n.dataset.goto)));
  }
  return d;
}
