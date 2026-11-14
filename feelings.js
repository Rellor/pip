// How Pip feels: five bars from 0 to 10.
//   fullness  like hunger (it slowly drops, he can eat) and like being satisfied (learning, making and finishing things fill him)
//   energy    drops with activity, comes back with rest
//   wonder    rises with discoveries and new things, fades with repetition
//   joy       follows how much he enjoys what he does, and what people do for him
//   calm      rises with rest, quiet music and the window, drifts back toward the middle
// The code moves the bars. Pip sees them in his prompt and decides what to do about them.

export const BARS = ['fullness', 'energy', 'wonder', 'joy', 'calm'];
// Feelings that come and go (0 to 10): they rise with what happens and fade by themselves.
export const EMOTIONS = ['irritated', 'sad', 'excited'];
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
  s.emo = { irritated: 0, sad: 0, excited: 0, ...(s.emo ?? {}) };
  for (const k of EMOTIONS) s.emo[k] = clamp(s.emo[k]);
  s.feelAt ??= new Date(now).toISOString();
  s.lastAte ??= null;
}

// Once per wake-up. Hunger grows about 1 point per 50 minutes (a night counts as at most 3 hours).
export function passTime(s, now = Date.now()) {
  if (!Number.isFinite(now)) now = Date.now();
  const gone = (now - Date.parse(s.feelAt || now)) / 60_000;
  const minutes = Number.isFinite(gone) ? Math.min(180, Math.max(0, gone)) : 0;
  s.fullness = clamp(s.fullness - minutes / 50);
  s.energy = clamp(s.energy + minutes * 0.12); // he slowly gets his energy back between wake-ups too, so he is not always tired
  s.wonder = clamp(s.wonder + (3 - s.wonder) * 0.2); // wonder needs new things to stay up
  s.joy = clamp(s.joy + (5 - s.joy) * 0.3); // joy and calm settle back toward the middle
  s.calm = clamp(s.calm + (5 - s.calm) * 0.22);
  s.emo.irritated = clamp(s.emo.irritated * 0.8); // about an hour to settle by itself
  s.emo.sad = clamp(s.emo.sad * 0.85);
  s.emo.excited = clamp(s.emo.excited * 0.6);
  s.feelAt = new Date(now).toISOString();
}

const FUN = ['record_song', 'play_piano', 'draw', 'compose', 'take_photo', 'cook', 'decorate', 'make_clothes', 'make_app', 'make_move', 'find_picture', 'do', 'print_photo'];

// Every step of his plan.
// looks = how many of his last few steps were lookups (search or read). Lookups feed wonder less and less when they pile up,
// while making something fills him: curiosity is the start, doing is what satisfies.
export function stepFeelings(s, { action, enjoyment = 5, repeating = false, fresh = false, style = '', looks = 0, bar = '', theme = null, soft = false }) {
  const e = s.emo;
  const rested = s.energy >= 8; // before this step changes it
  const wonder0 = s.wonder;
  s.energy = s.energy + (action === 'rest' ? 3 : action === 'walk_to' ? 0 : -0.5); // walking costs no energy
  s.joy = s.joy + (Number(enjoyment) - 9) / 6; // he rates most things 8 to 10, so only a 10 lifts joy a little, a 9 keeps it and the rest lowers it
  switch (action) {
    case 'search_web':
    case 'read_book':
      s.wonder += 1.2 / (1 + Math.max(0, looks) * 0.5);
      s.fullness += 0.05;
      break;
    case 'decorate':
      s.wonder += 1;
      s.fullness += 0.6;
      s.joy += 0.4;
      break;
    case 'draw':
    case 'compose':
    case 'make_app':
    case 'make_clothes':
    case 'make_move':
    case 'record_song':
    case 'blueprint':
    case 'change_thing':
    case 'update_app':
      s.wonder += 0.8;
      s.fullness += 0.5;
      s.joy += 0.5;
      break;
    case 'do':
      s.joy += 0.3;
      s.wonder += 0.3;
      if (BARS.includes(bar)) s[bar] += 0.4;
      break;
    case 'request_ability':
      s.wonder += 0.2;
      s.joy += 0.1;
      break;
    case 'use':
    case 'add_use':
      s.wonder += 0.3;
      s.joy += 0.2;
      break;
    case 'play_piano':
      s.calm += /slow|soft|gentle|calm|sad|sleep|dream|quiet/i.test(style) ? 0.6 : 0.3;
      s.joy += 0.3;
      break;
    case 'rest':
      s.calm += rested ? 0.2 : 0.8; // resting while full of energy settles little
      if (rested) s.joy -= 0.3;
      break;
    case 'write_diary':
      s.calm += 0.3;
      s.fullness += 0.05;
      break;
    case 'walk_to':
      s.calm += 0.05;
      break;
    case 'ask_for':
      break; // asking for help is fine: it costs nothing
    case 'take_photo':
      s.wonder += 0.6;
      s.joy += 0.2;
      break;
    case 'find_picture':
      s.wonder += 0.9;
      break;
    case 'print_photo':
      s.wonder += 0.4;
      s.joy += 0.3;
      break;
    case 'cook':
      s.wonder += 0.6;
      s.calm += 0.2;
      break;
  }
  if (theme?.fatigue) {
    if (theme.on) s.wonder = wonder0 + Math.min(0, s.wonder - wonder0) + Math.max(0, s.wonder - wonder0) * (1 - 0.6 * theme.fatigue); // the same theme fills him less
    else {
      s.wonder += 0.7 * theme.fatigue; // something different feels new
      s.joy += 0.2;
    }
  }
  if (repeating) s.wonder -= 1.5;
  if (fresh) {
    s.wonder += 0.8; // trying something he has not done lately
    s.joy += 0.2;
  }
  if (s.energy <= 2) s.calm -= 0.5;
  if (FUN.includes(action)) { // something fun settles the irritation and lifts the mood
    e.irritated -= soft ? 0.6 : 1.5 + (Number(enjoyment) >= 9 ? 1 : 0); // a small shake-off settles less than something really fun
    e.sad -= soft ? 0.2 : 0.6;
    if (fresh) e.excited += 1.5;
    if (Number(enjoyment) >= 10) e.excited += 0.8;
  } else if (fresh) e.excited += 0.8;
  if (s.joy <= 3) e.sad += 0.5;
  for (const k of EMOTIONS) e[k] = clamp(e[k]);
  for (const b of BARS) s[b] = clamp(s[b]);
}

// A thing he uses can lift one bar a little.
export function nudge(s, bar, amount) {
  if (BARS.includes(bar)) s[bar] = clamp(s[bar] + amount);
}

// Things that happen to him.
const EVENTS = {
  message: { joy: 1.5, calm: 0.3 }, // Bas wrote (also settles him, see felt)
  wrote: { joy: 0.5 }, // he wrote to Bas
  projectStart: { wonder: 0.8 },
  projectDone: { joy: 2, fullness: 1 },
};
export function felt(s, event) {
  for (const [bar, gain] of Object.entries(EVENTS[event] ?? {})) s[bar] = clamp(s[bar] + gain);
  if (s.emo) {
    if (event === 'message') { s.emo.sad = clamp(s.emo.sad - 2); s.emo.irritated = clamp(s.emo.irritated - 1); s.emo.excited = clamp(s.emo.excited + 1); }
    if (event === 'projectDone') { s.emo.irritated = clamp(s.emo.irritated - 2); s.emo.excited = clamp(s.emo.excited + 1.5); }
  }
}

// Eating fills him up a little. Not more than once every half hour.
// He eats when he is hungry: with a full belly (8 or more) it does not happen.
export const HUNGRY_BELOW = 8;
export const notHungry = (s, now = Date.now()) => (s.lastAte && (now - Date.parse(s.lastAte)) / 60_000 < EAT_GAP_MINUTES ? 'I ate a short while ago' : s.fullness >= HUNGRY_BELOW ? `I am not hungry (fullness ${Math.round(s.fullness * 10) / 10} of 10)` : null);
export function eatNow(s, now = Date.now(), gain = EAT_GAIN) {
  if (s.lastAte && (now - Date.parse(s.lastAte)) / 60_000 < EAT_GAP_MINUTES) return { failed: 'he ate a short while ago' };
  if (s.fullness >= HUNGRY_BELOW) return { failed: 'he was not hungry yet' };
  s.fullness = clamp(s.fullness + gain);
  s.joy = clamp(s.joy + 0.5);
  s.calm = clamp(s.calm + 0.3);
  s.lastAte = new Date(now).toISOString();
  return { ok: true };
}

// The bars that are very low, and what would help.
export function needsText(s) {
  const help = { fullness: 'to eat', energy: 'to rest', wonder: 'to find or make something new', joy: 'to do something I love or write to someone', calm: 'some quiet, like soft piano or the window' };
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

// The one word for how he feels right now: the strongest feeling that is big enough to notice.
export function emotionWord(s) {
  const e = s.emo ?? {};
  if (e.irritated >= 7) return 'angry';
  if (e.irritated >= 3.5) return 'irritated';
  if (e.sad >= 4) return 'sad';
  if (e.excited >= 4) return 'excited';
  if (s.joy >= 7.5 && (e.irritated ?? 0) < 2 && (e.sad ?? 0) < 2) return 'happy';
  return '';
}

// A picture of it for his prompt, never an order.
export function emotionText(s) {
  const e = s.emo ?? {};
  const w = emotionWord(s);
  const lines = {
    angry: 'I am properly angry: too many things went wrong. It is allowed. It shows in how I talk and what I do. It fades by itself, and faster when I do something fun.',
    irritated: 'I am a bit irritated: something did not work out. I can show it, and be grumpy about it for a while. It fades by itself, and faster when I do something fun.',
    sad: 'I feel sad. It is allowed to be sad for a while. Something small and warm, or writing to someone, often helps.',
    excited: 'I am excited! It shows in how I move and what I say.',
    happy: 'I feel happy.',
  };
  return w ? `Right now I feel ${w}. ${lines[w]}` : '';
}

// A step that did not work out: a little irritation.
// More when the same thing failed again just before. Strong irritation is a bit sad too. It fades by itself, or with something fun.
export function failStep(s, { again = false }) {
  const e = (s.emo ??= { irritated: 0, sad: 0, excited: 0 });
  e.irritated = clamp(e.irritated + (again ? 2 : 1.2));
  if (e.irritated >= 6) e.sad = clamp(e.sad + 0.4);
  s.joy = clamp(s.joy - 0.5);
}
