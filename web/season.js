// The place, the seasons and the weather that Pip's world follows (the page and Pip's wake-up both use this).
export const PLACE = { name: 'Purmerend', lat: 52.505, lon: 4.959 };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dayOfYear = (date) => Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86_400_000);


// When the sun comes up and goes down in Purmerend (the usual NOAA formulas), in local Dutch time.
function sunTimes(date) {
  const rad = Math.PI / 180;
  const d = dayOfYear(date);
  const g = ((2 * Math.PI) / 365) * (d - 1 + 0.5);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(PLACE.lat * rad) * Math.cos(decl)) - Math.tan(PLACE.lat * rad) * Math.tan(decl);
  const ha = Math.acos(clamp(cosHa, -1, 1)) / rad;
  const local = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const offset = Math.round((local - new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))) / 3_600_000);
  return { sunrise: (720 - 4 * (PLACE.lon + ha) - eq) / 60 + offset, sunset: (720 - 4 * (PLACE.lon - ha) - eq) / 60 + offset };
}

// What the time of year looks like in the Netherlands (rough, but it follows the real days).
export function seasonInfo(date = new Date()) {
  const d = dayOfYear(date);
  const { sunrise, sunset } = sunTimes(date);
  const name = d < 60 || d >= 335 ? 'winter' : d < 152 ? 'spring' : d < 244 ? 'summer' : 'autumn';
  const leafOn = d < 95 ? 0 : d < 130 ? (d - 95) / 35 : d <= 290 ? 1 : d < 340 ? 1 - (d - 290) / 50 : 0; // how much of the leaves are on the trees
  return {
    day: d,
    name,
    sunrise,
    sunset,
    leafOn,
    turn: clamp((d - 250) / 70, 0, 1), // leaves go from green to yellow, orange and brown
    blossom: d >= 90 && d <= 125,
    falling: d > 250 && leafOn > 0.02 && leafOn < 1,
    flowers: d >= 95 && d <= 285,
    frozen: d > 355 || d < 40,
  };
}
const hm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
export const seasonText = (s) => {
  const trees = s.leafOn <= 0.02 ? 'the trees are bare' : s.falling ? 'the leaves are turning and falling' : s.blossom ? 'the trees are in blossom' : s.leafOn < 1 ? 'the trees are getting their leaves' : 'the trees are full of leaves';
  return `${s.name} (${trees}). The sun comes up at ${hm(s.sunrise)} and goes down at ${hm(s.sunset)} today`;
};

// Open-Meteo weather codes in plain kinds.
export const weatherKind = (code) => (code >= 95 ? 'storm' : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow' : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? 'rain' : code === 45 || code === 48 ? 'fog' : code >= 2 ? 'cloudy' : 'clear');
const WORDS = { clear: 'clear sky', cloudy: 'cloudy', rain: 'raining', snow: 'snowing', fog: 'foggy', storm: 'a thunderstorm' };
export const weatherText = (w) => (w ? `${WORDS[w.kind] ?? w.kind}, ${Math.round(w.temp)}°C${w.wind >= 0.6 ? ', windy' : w.wind <= 0.15 ? ', calm' : ''}` : null);

export async function fetchWeather(signal) {
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}&current=weather_code,cloud_cover,wind_speed_10m,temperature_2m&timezone=auto`, { signal });
  const cur = (await res.json()).current;
  return { at: new Date().toISOString(), kind: weatherKind(cur.weather_code), code: cur.weather_code, temp: cur.temperature_2m, cloud: clamp(cur.cloud_cover / 100, 0, 1), wind: clamp(cur.wind_speed_10m / 30, 0.1, 1) };
}

// The hour in Purmerend (24h, with minutes as a fraction), whatever time zone the device is in.
export function amsterdamHour(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Amsterdam' }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get('hour') % 24) + get('minute') / 60;
}

// Where the sun (by day) or the moon (at night) is, for the sky and for the light that comes in at the window.
// az is sideways (negative = left of the window), el is how high. Higher than the real sun on purpose, so the light lands inside the room.
export function skyAim(date = new Date(), hour = null) {
  const se = seasonInfo(date);
  const h = hour ?? amsterdamHour(date);
  const span = se.sunset - se.sunrise;
  const t = (h - se.sunrise) / span;
  if (t >= 0 && t <= 1) return { body: 'sun', t, az: -0.9 + 1.8 * t, el: 0.3 + 0.6 * Math.sin(Math.PI * t) };
  const n = (((h - se.sunset) % 24) + 24) % 24 / (24 - span);
  return { body: 'moon', t: Math.min(1, n), az: -0.8 + 1.6 * Math.min(1, n), el: 0.5 + 0.35 * Math.sin(Math.PI * Math.min(1, n)) };
}
// From the room toward that body (x sideways, y up, z negative = behind the window).
export const aimVector = ({ az, el }) => [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
