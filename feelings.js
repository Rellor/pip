// How Pip feels: five bars from 0 to 10.
//   fullness  like hunger (it slowly drops, he can eat) and like being satisfied (learning, making and finishing things fill him)
//   energy    drops with activity, comes back with rest
//   wonder    rises with discoveries and new things, fades with repetition
//   joy       follows how much he enjoys what he does, and what people do for him
//   calm      rises with rest, quiet music and the window, drifts back toward the middle
// The code moves the bars. Pip sees them in his prompt and decides what to do about them.

export const BARS = ['fullness', 'energy', 'wonder', 'joy', 'calm'];
export const EAT_GAP_MINUTES = 30;
const EAT_GAIN = 3;

// Two decimals inside, so tiny changes are not rounded away. Shown with one decimal.
const clamp = (n) => Math.round(Math.max(0, Math.min(10, Number.isFinite(n) ? n : 5)) * 100) / 100;
const show = (v) => (Math.round(v * 10) / 10).toString();

// Older saves had energy, boredom and loneliness only.
export function ensureFeelings(s, now = Date.now()) {
  s.energy = clamp(s.energy ?? 7);
  s.fullness = clamp(s.fullness ?? 7);
  s.wonder = clamp(s.wonder ?? 10 - (s.boredom ?? 3));
  s.joy = clamp(s.joy ?? 6);
  s.calm = clamp(s.calm ?? 6);
  s.feelAt ??= new Date(now).toISOString();
  s.lastAte ??= null;
}

// Once per wake-up. Hunger grows about 1 point per 50 minutes (a night counts as at most 3 hours).
export function passTime(s, now = Date.now()) {
  if (!Number.isFinite(now)) now = Date.now();
  const gone = (now - Date.parse(s.feelAt || now)) / 60_000;
  const minutes = Number.isFinite(gone) ? Math.min(180, Math.max(0, gone)) : 0;
  s.fullness = clamp(s.fullness - minutes / 50);
  s.wonder = clamp(s.wonder + (4 - s.wonder) * 0.12); // wonder needs new things to stay up
  s.joy = clamp(s.joy + (5 - s.joy) * 0.15); // joy and calm settle back toward the middle
  s.calm = clamp(s.calm + (5 - s.calm) * 0.12);
  s.feelAt = new Date(now).toISOString();
}

// Every step of his plan.
export function stepFeelings(s, { action, enjoyment = 5, repeating = false, fresh = false, style = '' }) {
  s.energy = s.energy + (action === 'rest' ? 3 : -1);
  s.joy = s.joy + (Number(enjoyment) - 8) / 6; // he rates most things 8 to 10, so only the best lifts joy and the rest lowers it a little
  switch (action) {
    case 'search_web':
    case 'read_book':
      s.wonder += 1.2;
      s.fullness += 0.05;
      break;
    case 'decorate':
      s.wonder += 1;
      s.fullness += 0.2;
      break;
    case 'play_piano':
      s.calm += /slow|soft|gentle|calm|sad|sleep|dream|quiet/i.test(style) ? 0.6 : 0.3;
      s.joy += 0.3;
      break;
    case 'rest':
      s.calm += 0.8;
      break;
    case 'write_diary':
      s.calm += 0.3;
      s.fullness += 0.05;
      break;
    case 'walk_to':
      s.calm += 0.05;
      break;
    case 'ask_for':
      s.calm -= 0.2;
      break;
  }
  if (repeating) s.wonder -= 1.5;
  if (fresh) {
    s.wonder += 0.8; // trying something he has not done lately
    s.joy += 0.2;
  }
  if (s.energy <= 2) s.calm -= 0.5;
  for (const b of BARS) s[b] = clamp(s[b]);
}

// A thing he uses can lift one bar a little.
export function nudge(s, bar, amount) {
  if (BARS.includes(bar)) s[bar] = clamp(s[bar] + amount);
}

// Things that happen to him.
const EVENTS = {
  message: { joy: 1.5, calm: 0.3 }, // Bas wrote
  wrote: { joy: 0.5 }, // he wrote to Bas
  projectStart: { wonder: 0.8 },
  projectDone: { joy: 2, fullness: 1 },
};
export function felt(s, event) {
  for (const [bar, gain] of Object.entries(EVENTS[event] ?? {})) s[bar] = clamp(s[bar] + gain);
}

// Eating fills him up a little. Not more than once every half hour.
export function eatNow(s, now = Date.now()) {
  if (s.lastAte && (now - Date.parse(s.lastAte)) / 60_000 < EAT_GAP_MINUTES) return { failed: 'he ate a short while ago' };
  s.fullness = clamp(s.fullness + EAT_GAIN);
  s.joy = clamp(s.joy + 0.5);
  s.calm = clamp(s.calm + 0.3);
  s.lastAte = new Date(now).toISOString();
  return { ok: true };
}

// The bars that are very low, and what would help.
export function needsText(s) {
  const help = { fullness: 'to eat', energy: 'to rest', wonder: 'to find or make something new', joy: 'to do something I love or write to Bas', calm: 'some quiet, like soft piano or the window' };
  const low = BARS.filter((b) => s[b] <= 3).sort((a, b) => s[a] - s[b]);
  return low.length ? `Right now I need: ${low.map((b) => help[b]).join('; ')}.` : '';
}

// What Pip reads about himself.
export function feelingsText(s) {
  const word = (v, low, mid, high) => (v <= 3 ? low : v >= 7 ? high : mid);
  return [
    `Fullness ${show(s.fullness)}/10: ${word(s.fullness, 'I am hungry', 'I am fine for now', 'I am full and satisfied')}`,
    `Energy ${show(s.energy)}/10: ${word(s.energy, 'I am very tired', 'I have some energy', 'I am full of energy')}`,
    `Wonder ${show(s.wonder)}/10: ${word(s.wonder, 'I want something new to marvel at', 'I am curious', 'I am full of wonder')}`,
    `Joy ${show(s.joy)}/10: ${word(s.joy, 'I feel low and want something I love', 'I feel okay', 'I feel happy')}`,
    `Calm ${show(s.calm)}/10: ${word(s.calm, 'I feel restless and need some quiet', 'I feel steady', 'I feel peaceful')}`,
  ].join('\n');
}
