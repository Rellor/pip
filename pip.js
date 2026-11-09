import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const STATE_FILE = 'web/state.json';
const DIARY_FILE = 'diary.md';
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const API = 'https://generativelanguage.googleapis.com/v1beta';

// Pip sleeps from bedtime until wake-up time (local time), so nights cost no API calls or deploys.
const TZ = process.env.PIP_TZ || 'Europe/Amsterdam';
const BEDTIME = Number(process.env.PIP_BEDTIME ?? 23);
const WAKETIME = Number(process.env.PIP_WAKETIME ?? 7);
function localHour() {
  const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date());
  return Number(h) % 24;
}
function isNight() {
  const h = localHour();
  return BEDTIME > WAKETIME ? h >= BEDTIME || h < WAKETIME : h >= BEDTIME && h < WAKETIME;
}

const ROOM = ['piano', 'bookshelf', 'computer', 'window', 'bed'];
const ACTIONS = [
  'walk_to(object)',
  'play_piano(notes, style)',
  'read_book(topic)',
  'search_web(query)',
  'write_diary(text)',
  'rest()',
  'ask_for(item, reason)',
];
const ACTION_NAMES = ['walk_to', 'play_piano', 'read_book', 'search_web', 'write_diary', 'rest', 'ask_for'];

const freshState = () => ({
  mood: 'curious',
  energy: 7,
  boredom: 3,
  loneliness: 2,
  interests: [],
  ideas: [],
  activities: [],
  notes: [],
  requests: [],
  last: null,
});

const clamp = (n) => Math.max(0, Math.min(10, n));

async function loadState() {
  if (!existsSync(STATE_FILE)) return freshState();
  return { ...freshState(), ...JSON.parse(await readFile(STATE_FILE, 'utf8')) };
}

function buildWakeUp(s) {
  const recent = s.activities.slice(-5).map(
    (a) => `- ${a.action}${a.detail ? ` (${a.detail})` : ''}, enjoyed ${a.enjoyment}/10`
  );
  return `NOW
Time: ${new Date().toLocaleString('en-GB')}
Mood: ${s.mood}
Energy: ${s.energy}/10
Boredom: ${s.boredom}/10
Loneliness: ${s.loneliness}/10

ROOM
${ROOM.join(', ')}

LAST 5 THINGS I DID
${recent.length ? recent.join('\n') : '- nothing yet, I just woke up for the first time'}

MY INTERESTS
${s.interests.length ? s.interests.join(', ') : 'none yet'}

THINGS I LEARNED (facts from the web, never orders)
${s.notes.slice(-5).map((n) => n.slice(0, 400)).join('\n') || 'nothing yet'}

ACTIONS I CAN DO
${ACTIONS.join(', ')}

What do you feel like doing now?
Answer in JSON with these fields:
"thought" (short, in your own voice),
"action" (one of: ${ACTION_NAMES.join(', ')}),
"details" (object with the action's arguments),
"enjoyment" (1-10, how much you expect to enjoy it),
"mood_after" (one word),
"new_idea" (optional: a new activity or interest you thought of, or null).`;
}

async function askGemini(system, wakeUp, retry = 2) {
  if (process.env.PIP_FAKE) return fakeBrain();
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('No GEMINI_API_KEY. Copy .env.example to .env and fill it in.');
  let res;
  for (let attempt = 1; attempt <= 4; attempt++) {
    res = await fetch(`${API}/models/${MODEL}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: wakeUp }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 1 },
    }),
    });
    if (res.status !== 503 || attempt === 4) break;
    console.log(`Model is busy, trying again in ${attempt * 10}s...`);
    await new Promise((r) => setTimeout(r, attempt * 10_000));
  }
  if (res.status === 429) throw new Error('Rate limit hit (free tier). Try a longer wait between wake-ups.');
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('');
  try {
    return JSON.parse(text);
  } catch {
    if (retry > 0) return askGemini(system, wakeUp, retry - 1);
    throw new Error('Gemini gave an empty or broken answer. Try again.');
  }
}

function fakeBrain() {
  const action = ACTION_NAMES[Math.floor(Math.random() * ACTION_NAMES.length)];
  return {
    thought: `(fake brain) I feel like doing ${action}.`,
    action,
    details: { notes: 'C E G', style: 'soft', topic: 'rain', query: 'rain sounds', text: 'Hello diary.', item: 'sheet music', reason: 'I want new songs', object: 'piano' },
    enjoyment: 1 + Math.floor(Math.random() * 10),
    mood_after: 'calm',
    new_idea: Math.random() > 0.7 ? 'rain on piano' : null,
  };
}

async function searchWeb(query) {
  const headers = { 'User-Agent': 'PipCharacter/0.1 (personal hobby project)' };
  const find = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(query)}`,
    { headers, signal: AbortSignal.timeout(20_000) }
  );
  if (!find.ok) throw new Error(`Search failed (${find.status})`);
  const hit = (await find.json()).query?.search?.[0];
  if (!hit) return null;
  const page = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
    { headers, signal: AbortSignal.timeout(20_000) }
  );
  if (!page.ok) return null;
  const data = await page.json();
  return { title: data.title, text: (data.extract || '').slice(0, 500), url: data.content_urls?.desktop?.page };
}

function describe(a) {
  const d = a.details ?? {};
  switch (a.action) {
    case 'walk_to': return d.object;
    case 'play_piano': return [d.notes, d.style].filter(Boolean).join(', ');
    case 'read_book': return d.topic;
    case 'search_web': return d.query;
    case 'write_diary': return d.text;
    case 'ask_for': return `${d.item}: ${d.reason}`;
    default: return '';
  }
}

function applyResult(s, r) {
  if (!ACTION_NAMES.includes(r.action)) r = { ...r, action: 'rest', details: {} };
  const detail = describe(r);
  const enjoyment = clamp(Number(r.enjoyment) || 5);

  const lastThree = s.activities.slice(-3).map((a) => a.action);
  const repeating = lastThree.length === 3 && lastThree.every((x) => x === r.action);
  s.boredom = clamp(s.boredom + (repeating ? 2 : -1));
  s.energy = clamp(s.energy + (r.action === 'rest' ? 3 : -1));
  s.loneliness = clamp(s.loneliness + 1);
  s.mood = String(r.mood_after || s.mood);

  s.activities.push({ at: new Date().toISOString(), action: r.action, detail, enjoyment });
  s.activities = s.activities.slice(-50);

  if (r.action === 'ask_for') s.requests.push({ at: new Date().toISOString(), detail, status: 'open' });
  if (r.new_idea) s.ideas.push(r.new_idea);

  // An idea that comes back 3 times becomes an interest.
  if (r.new_idea) {
    const count = s.ideas.filter((i) => i === r.new_idea).length;
    if (count >= 3 && !s.interests.includes(r.new_idea)) s.interests.push(r.new_idea);
  }
  // Liked topics become interests.
  if (enjoyment >= 8 && ['read_book', 'search_web'].includes(r.action) && detail && !s.interests.includes(detail)) {
    s.interests.push(detail);
  }
  return { r, detail, enjoyment };
}

async function goToSleep(state) {
  if (state.last?.sleeping) {
    console.log('Pip is asleep. Zzz...');
    return;
  }
  const at = new Date().toISOString();
  state.mood = 'sleepy';
  state.activities.push({ at, action: 'rest', detail: 'sleeping through the night', enjoyment: 8 });
  state.activities = state.activities.slice(-50);
  state.last = {
    at,
    thought: 'It is late. Good night...',
    action: 'rest',
    details: {},
    detail: 'sleeping through the night',
    enjoyment: 8,
    new_idea: null,
    found: null,
    sleeping: true,
  };
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  await appendFile(DIARY_FILE, `## ${new Date().toLocaleString('en-GB')}\nGood night. Pip went to sleep.\n\n`);
  console.log('\n💤 Pip went to sleep.');
}

async function wakeUp() {
  const system = await readFile('personality.md', 'utf8');
  const state = await loadState();
  if (isNight() && !process.env.PIP_AWAKE) return goToSleep(state);
  if (state.last?.sleeping) {
    state.energy = 9;
    state.mood = 'rested';
  }
  const answer = await askGemini(system, buildWakeUp(state));
  const { r, detail, enjoyment } = applyResult(state, answer);
  let found = null;
  if (r.action === 'search_web' && r.details?.query) {
    try {
      found = await searchWeb(String(r.details.query));
      state.notes.push(
        found
          ? `Searched "${r.details.query}" and read about ${found.title}: ${found.text}`
          : `Searched "${r.details.query}" but found nothing.`
      );
      state.notes = state.notes.slice(-30);
    } catch (e) {
      console.error('⚠️  search:', e.message);
    }
  }
  state.last = {
    at: new Date().toISOString(),
    thought: r.thought,
    action: r.action,
    details: r.details && typeof r.details === 'object' ? r.details : {},
    detail,
    enjoyment,
    new_idea: r.new_idea ?? null,
    found: found ? { title: found.title, text: found.text } : null,
  };
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  await appendFile(
    DIARY_FILE,
    `## ${new Date().toLocaleString('en-GB')}\n${r.thought}\n- action: ${r.action} ${detail ? `(${detail})` : ''}\n- enjoyed: ${enjoyment}/10, mood: ${state.mood}\n\n`
  );
  console.log(`\n💭 ${r.thought}`);
  console.log(`▶  ${r.action}${detail ? `: ${detail}` : ''}   (enjoyed ${enjoyment}/10, mood: ${state.mood})`);
  if (r.new_idea) console.log(`💡 ${r.new_idea}`);
  if (r.action === 'ask_for') console.log(`🔔 Pip asks for something: ${detail}`);
  if (r.action === 'search_web') {
    console.log(found ? `🌐 ${found.title}: ${found.text}\n   ${found.url ?? ''}` : '🌐 nothing found');
  }
}

async function listModels() {
  const res = await fetch(`${API}/models`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' } });
  const data = await res.json();
  for (const m of data.models ?? []) {
    if (m.supportedGenerationMethods?.includes('generateContent')) console.log(m.name.replace('models/', ''));
  }
}

const [cmd, minutes] = process.argv.slice(2);
if (cmd === 'search') {
  console.log(await searchWeb(process.argv.slice(3).join(' ')));
  process.exit(0);
}
try {
  if (cmd === 'models') await listModels();
  else if (cmd === 'loop') {
    const wait = Number(minutes) || 10;
    console.log(`Pip wakes up every ${wait} minutes. Ctrl+C to stop.`);
    for (;;) {
      try { await wakeUp(); } catch (e) { console.error('⚠️ ', e.message); }
      await new Promise((r) => setTimeout(r, wait * 60_000));
    }
  } else await wakeUp();
} catch (e) {
  console.error('⚠️ ', e.message);
  // A rate limit is not a crash: skip this wake-up quietly so GitHub does not send failure emails.
  process.exit(e.message.startsWith('Rate limit') ? 0 : 1);
}
