// Pip's sleeping time. The loop stays quiet at night, so "he has not woken up" must not count those hours.
// Used by the page and by watchdog.js.
const hourIn = (tz, ms) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(new Date(ms))) % 24;

export function isNightAt(ms, { bed = 23, wake = 8, tz = 'Europe/Amsterdam' } = {}) {
  const h = hourIn(tz, ms);
  return bed > wake ? h >= bed || h < wake : h >= bed && h < wake;
}

// Minutes between two moments that Pip was supposed to be awake.
export function awakeMinutes(fromMs, toMs, cfg) {
  let n = 0;
  for (let t = fromMs; t < toMs; t += 300_000) if (!isNightAt(t, cfg)) n += Math.min(5, (toMs - t) / 60_000);
  return Math.round(n);
}
