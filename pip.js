import { readFile, writeFile, appendFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FURNITURE, MOVABLE } from './web/furniture.js';
import { fetchWeather, weatherText } from './web/season.js';
import { checkLight, darkNote, lightAt, isLamp } from './web/lighting.js';
import { redundantWalks, loopRepeating, sameTune, duplicateSearch, agoText } from './habits.js';
import { ensureGarden, grantGarden, addSeeds, plantSeed, waterPlants, harvestPlant, growthNotes } from './garden.js';

import { archiveOverflow } from './archive.js';
import { loadSoul } from './soul.js';
import { goalPrompt, goalSchema, setGoals, fakeGoals } from './goals.js';
import { ensureProjects, projectLines, addVersion, judgeProject } from './projects.js';
import { ensureSkills, practise, skillOf, level, skillLine, maxParts, maxBars } from './skills.js';
import { ensureIntentions, markIntentions } from './intent.js';
import { tickBody, noteMove, noteMood, heardFrom, bodyText, dayOf } from './body.js';
import { availableMoves } from './moves.js';
import { brainPrompt, brainSchema, toAnswer, fakeReply } from './brain.js';
import { ensurePlan, wakeReasons, decided, nextQueued, fallbackSteps } from './autopilot.js';
import { makerPrompt, applyMade, fakeMade } from './maker.js';
const KEEP_IDEAS = 30;
import { ensureBehaviors, behaviorProblem } from './behaviors.js';
import { preflight, MAX_SONGS_PER_DAY } from './limits.js';
import { ensureBlueprints, makeBlueprint, markBuilt, capabilityGuide, blueprintGaps, requestAbility } from './blueprints.js';
import { purposeProblem, purposeHint, setFronts, rehangPictures, makeDecor, updateDecor, storeAway, takeOut, squareUp, cleanParts, placeTool, takeTool, composeSong, extendThing, sizeOf, placePicture, printPhoto, removePicture, moveThing, setChest, setFurniture, accessProblem, ART_MAX, MAX_PER_DAY } from './decor.js';
import { cleanSvg, MAX_ART_PER_DAY } from './art.js';
import { cleanApp, MAX_APPS, MAX_APPS_PER_DAY } from './apps.js';
import { lessonsFrom, themeFatigue } from './mirror.js';
import { ensureMoves, makeMove, findMove, movesGuide } from './dances.js';
import { measureThing, sizesGuide } from './sizes.js';
import { bonusRewards } from './rewards.js';
import { ensureTools, NEEDS, toolsGuide, toolFor, missingTool, toolList, addTool, toolKind, fits, craftTool, MAX_TOOLS } from './tools.js';
import { ensureMemory, addMemory, recall, markUsed, fade, archiveForgotten, addInterest, shouldReflect, reflectionPrompt, applyReflection } from './memory.js';
import { ensureIdentity, applyIdentity } from './identity.js';
import { takePhoto } from './photo.js';
import { TIMBRES, cleanTracks } from './songs.js';
import { grantInstruments, instrumentNeeds } from './instruments.js';
import { moveMusicToStudio, moveMusicBack, keepWindowsClear, HAS_STUDIO } from './web/house.js';
import { findPicture } from './found.js';
import { cook, addIngredient, eatFromPantry, mealGain } from './food.js';
import { makeClothes, wear, takeOff, SLOTS } from './clothes.js';
const MAX_APP_UPDATES_PER_DAY = 4;
import { pictureType, pictureSize, ntfyPoll, isFromBas, ntfyText, downloadAttachment } from './inbox.js';
import { refreshNews } from './news.js';
import { tooSimilar } from './repeat.js';
import { ensureFeelings, stepFeelings, felt, nudge, eatNow, emotionWord, failStep } from './feelings.js';
import { cleanUses, findUse, addUse, stepsProblem } from './uses.js';

const STATE_FILE = 'web/state.json';
const DIARY_FILE = 'diary.md';
// The better model first. When it is busy or out of free quota, the lighter one answers so he never misses a wake-up.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';
let usedModel = MODEL;
const spent = { calls: 0, input: 0, output: 0 }; // tokens used this wake-up, as Gemini counts them
const API = 'https://generativelanguage.googleapis.com/v1beta';
// A model that said "out of quota" (429) is left alone for 45 minutes, so each wake-up does not waste time and calls on it first.
const BLOCK_FILE = join(tmpdir(), 'pip-model-block.json');
const blockedModels = () => { try { return JSON.parse(readFileSync(BLOCK_FILE, 'utf8')); } catch { return {}; } };
const blockModel = (m) => { try { writeFileSync(BLOCK_FILE, JSON.stringify({ ...blockedModels(), [m]: Date.now() + 45 * 60_000 })); } catch {} };

// Pip sleeps from bedtime (23:00) until wake-up time (08:00) (local time), so nights cost no API calls or deploys.
const TZ = process.env.PIP_TZ || 'Europe/Amsterdam';
const BEDTIME = Number(process.env.PIP_BEDTIME ?? 23);
const WAKETIME = Number(process.env.PIP_WAKETIME ?? 8);
function localHour() {
  const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date());
  return Number(h) % 24;
}
function isNight() {
  const h = localHour();
  return BEDTIME > WAKETIME ? h >= BEDTIME || h < WAKETIME : h >= BEDTIME && h < WAKETIME;
}

const ROOM = [
  'piano',
  'bookshelf',
  'computer',
  'window',
  'bed',
  'a framed photo on the wall above the piano: the Milky Way over a very dark sky full of stars, with two people in silhouette looking up from a railing',
];
const ACTION_NAMES = ['walk_to', 'do', 'make_move', 'blueprint', 'move_thing', 'extend_thing', 'print_photo', 'take_down_print', 'play_piano', 'record_song', 'read_book', 'search_web', 'write_diary', 'rest', 'ask_for', 'eat', 'decorate', 'remove_decoration', 'take_out', 'place_tool', 'take_tool', 'measure', 'check_light', 'lamp_auto', 'plant', 'water', 'harvest', 'request_ability', 'compose', 'draw', 'make_app', 'use', 'add_use', 'change_thing', 'update_app', 'make_clothes', 'wear', 'take_off', 'cook', 'take_photo', 'find_picture', 'place_picture', 'take_down_picture'];

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
  story: '',
  wants: [],
  questions: [],
  fulfilled: [],
  tools: [],
  memories: [],
  reflections: [],
  lastReflectAt: null,
  storyAt: null,
  thoughts: [],
  outbox: [],
  inbox: [],
  asks: [],
  log: [],
  decor: [],
  projects: [],
  pictures: [],
  stored: [],
  wardrobe: [],
  pantry: [],
  tasks: [],
  found: [],
  voice: '',
  self: '',
  favorites: [],
  dreams: [],
  rituals: [],
  wokeFromSleep: false,
  chest: null,
  art: [],
  apps: [],
  ntfySince: '',
  draft: '',
  repeatNote: '',
  last: null,
});

const text = (v, max = 280) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strings = (v, max = 3) => (Array.isArray(v) ? v : []).map((x) => text(x, 160)).filter(Boolean).slice(0, max);
const minutesSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 60000 : Infinity);
function ago(iso) {
  const m = minutesSince(iso);
  if (m === Infinity) return 'never';
  if (m < 60) return `${Math.round(m)} minutes ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} hours ago`;
  return `${Math.round(m / 1440)} days ago`;
}
const MAX_WALL_PRINTS = 8;
// The things he does become memories, with a guess of how much they matter (he can add his own with "remember").
function observeStep(s, e) {
  if (e.failed || e.fallback) return;
  const at = e.at;
  const note = {
    decorate: [`I made ${e.name}${e.why ? ` (${e.why})` : ''}`, 6],
    draw: [`I drew ${e.name}`, 6],
    compose: [`I made a song for ${e.name}`, 5],
    make_app: [`I made an app: ${e.name}`, 6],
    make_clothes: [`I made clothes: ${e.name}`, 5],
    cook: [`I cooked ${e.dish}`, 5],
    take_photo: [`I took a photo of ${e.target}${e.caption ? `: ${e.caption}` : ''}`, 5],
    find_picture: [`I found a picture: ${e.title ?? e.query}`, 4],
    print_photo: [`I printed a photo (${e.name})`, 4],
    change_thing: [`I changed ${e.name}${e.grew ? ' and made it bigger' : ''}`, 4],
    move_thing: [`I moved ${e.name}`, 3],
    extend_thing: [e.joined ? `I joined ${e.joined} onto ${e.name}, now one thing with ${e.total} parts` : e.side ? `I built onto the ${e.side} side of ${e.name}: ${e.added} new parts, now ${e.total}` : `I added ${e.added} parts to ${e.name}, now ${e.total} parts`, 5],
    ask_for: [`I asked for ${e.item}${e.reason ? ` (${e.reason})` : ''}`, 5],
    do: [`${e.what}`, 4],
    write_diary: [`I wrote in my diary: ${String(e.text ?? '').slice(0, 120)}`, 3],
    play_piano: [`I played ${e.instrument && e.instrument !== 'piano' ? `the ${e.instrument}` : 'the piano'}`, 3],
    record_song: [`I recorded a song in my studio: ${e.name} (${(e.tracks ?? []).map((t) => t.instrument).join(', ')})`, 6],
    search_web: [`I looked up ${e.query}`, 3],
    read_book: [`I read about ${e.topic}`, 3],
  }[e.action];
  if (note && note[0]) addMemory(s, note[0], note[1], 'memory', at);
}
const sameText = (a, b) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
const withWarn = (place, made) => (place && made?.warn ? `${place} (careful: ${made.warn})` : place && made?.hint ? `${place} (${made.hint})` : place ?? null);
const bullets = (items, empty) => (items.length ? items.map((x) => `- ${x}`).join('\n') : empty);
// Pip may write to Bas at most once every 3 hours, so he only says what really matters.
const MIN_GAP_MINUTES = 180;
// One wake-up is one plan for this many minutes. The loop passes in its real interval.
const MAX_PRINTS_PER_DAY = 6; // photo printer
const INTERVAL_MIN = Number(process.env.PIP_INTERVAL_MIN || 8);

const clamp = (n) => Math.max(0, Math.min(10, n));

async function loadState() {
  if (!existsSync(STATE_FILE)) {
    const fresh = freshState();
    ensureFeelings(fresh);
    return fresh;
  }
  const raw = JSON.parse(await readFile(STATE_FILE, 'utf8'));
  // Older saves kept requests as one string "item: reason". Carry the open ones over to the asks list.
  if (!raw.asks && Array.isArray(raw.requests)) {
    raw.asks = raw.requests
      .filter((r) => r.status === 'open')
      .slice(-5)
      .map((r, i) => {
        const [item, ...why] = String(r.detail || '').split(': ');
        return { id: `old${i}`, item: text(item, 140), why: text(why.join(': '), 200), since: r.at, status: 'open' };
      })
      .filter((a) => a.item);
  }
  const state = { ...freshState(), ...raw };
  state.wardrobe ??= [];
  state.pantry ??= [];
  state.tasks ??= [];
  state.found ??= [];
  state.voice ??= '';
  ensureIdentity(state);
  ensureMemory(state);
  ensureTools(state);
  state.gifts ??= [];
  if (!state.gifts.includes('light meter') && !state.tools.some((t) => t.kind === 'light meter')) { // a funny little gadget that tells him how bright a place is
    state.gifts.push('light meter');
    state.tools.push({ id: 'tgift4', name: 'Lux-O-Matic 3000', kind: 'light meter', source: 'given', why: 'a gadget that beeps how bright a place is', at: new Date().toISOString() });
  }
  ensureGarden(state);
  { const gn = grantGarden(state); if (gn) state.notes.push(gn); } // once: greenhouse, seeds, shovel and watering can
  ensureMoves(state);
  ensureBlueprints(state);
  squareUp(state);
  state.sleep = { bed: BEDTIME, wake: WAKETIME, tz: TZ }; // the page and the watchdog use this so the night is not counted as stuck
  setChest(state.chest ?? null);
  setFurniture(state.furniture);
  rehangPictures(state);
  for (const d of state.decor) ensureBehaviors(d); // a lamp, a car or a fan can really do what it is
  state.chest ??= null;
  delete state.builds;
  ensureFeelings(state);
  grantInstruments(state);
  if (HAS_STUDIO && moveMusicToStudio(state)) addMemory(state, 'I have a little house now. My piano and my music things moved into my new music studio: through the door in my bedroom, across the hall, and through the next door.', 7, 'memory', new Date().toISOString());
  { const back = moveMusicBack(state); if (back.length || state.musicBack === true && !state.musicBackNoted) { state.musicBackNoted = true; addMemory(state, 'The music studio is gone for now. My piano is back in my bedroom, by the window where I started.', 7, 'memory', new Date().toISOString()); } }
  keepWindowsClear(state);
  state.studio ??= { songs: [] };
  state.studio.songs = Array.isArray(state.studio.songs) ? state.studio.songs : [];
  return state;
}

// Bas's messages arrive as small files in inbox/ (written by the website), or he types them in the ntfy app.
// Files are deleted only after Pip's state is saved.
const INBOX_DIR = 'inbox';

// A picture from Bas: keep a copy in web/gifts and remember it in Pip's album.
// Bas's gifts and Pip's own photos are kept apart, so photos never push a gift out.
function trimPictures(list) {
  const keep = new Set([...list.filter((p) => p.by !== 'pip').slice(-20), ...list.filter((p) => p.by === 'pip').slice(-20)]);
  return list.filter((p) => keep.has(p));
}
async function keepPicture(state, bytes, caption, at, key) {
  const type = pictureType(bytes);
  if (!type) return null;
  const file = `${key}.${type.ext}`;
  const known = state.pictures.find((p) => p.image === `gifts/${file}`);
  if (known) return known;
  await mkdir('web/gifts', { recursive: true });
  await writeFile(`web/gifts/${file}`, bytes);
  const size = pictureSize(bytes);
  const n = Math.max(0, ...state.pictures.map((p) => Number(String(p.id).replace('pic', '')) || 0)) + 1;
  const pic = { id: `pic${n}`, image: `gifts/${file}`, mime: type.mime, at, caption: text(caption, 300), seen: false, notes: '', aspect: size ? Math.round((size.w / size.h) * 100) / 100 : 1.5 };
  state.pictures = trimPictures([...state.pictures, pic]);
  return pic;
}

async function loadInbox(state) {
  let files = [];
  try {
    files = (await readdir(INBOX_DIR)).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return { added: 0, names: [] };
  }
  let added = 0;
  const imageNames = [];
  const handled = []; // files that are safely in Pip's state. A message that failed stays in inbox/ and is tried again next time.
  for (const name of files) {
    try {
      const m = JSON.parse(await readFile(`${INBOX_DIR}/${name}`, 'utf8'));
      const body = text(m.text, 1000);
      const id = text(m.id, 60) || name;
      const file = typeof m.image === 'string' && /^[\w-]+\.(jpg|png)$/.test(m.image) ? m.image : null;
      if ((body || file) && !state.inbox.some((x) => x.id === id)) {
        const at = Number.isNaN(Date.parse(m.at)) ? new Date().toISOString() : m.at;
        const pic = file ? await keepPicture(state, await readFile(`${INBOX_DIR}/${file}`), body, at, file.replace(/\.\w+$/, '')) : null;
        if (file) imageNames.push(file);
        if (body || pic) {
          state.inbox.push({ id, at, text: body || '(a picture)', read: false, picture: pic?.id ?? null });
          added++;
        }
      }
      handled.push(name);
    } catch (e) {
      console.error(`⚠️  inbox ${name}: ${e.message}. It stays for the next wake-up.`);
    }
  }
  state.inbox = state.inbox.slice(-50);
  const keepImages = imageNames.filter((n) => handled.includes(n.replace(/\.\w+$/, '.json')) || handled.some((h) => h.startsWith(n.replace(/\.\w+$/, ''))));
  return { added, names: [...handled, ...keepImages] };
}
// Things Bas asks Pip to do (tasks/*.json, made by the website). Pip answers yes or no himself.
const TASKS_DIR = 'tasks';
async function loadTasks(state) {
  let files = [];
  try {
    files = (await readdir(TASKS_DIR)).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return { added: 0, names: [] };
  }
  let added = 0;
  const names = [];
  for (const name of files) {
    try {
      const m = JSON.parse(await readFile(`${TASKS_DIR}/${name}`, 'utf8'));
      if (m.control && m.target) {
        // The person who asked closes a task themselves.
        const t = state.tasks.find((x) => x.id === m.target);
        if (t && ['open', 'accepted'].includes(t.status)) Object.assign(t, m.control === 'done' ? { status: 'done', doneBy: 'asker', doneAt: new Date().toISOString() } : { status: 'removed', doneAt: new Date().toISOString() });
        names.push(name);
        continue;
      }
      const body = text(m.text, 300);
      const id = text(m.id, 60) || name.replace(/\.json$/, '');
      if (body && !state.tasks.some((t) => t.id === id)) {
        state.tasks.push({ id, at: Number.isNaN(Date.parse(m.at)) ? new Date().toISOString() : m.at, text: body, status: 'open', note: '', answeredAt: null });
        added++;
      }
      names.push(name);
    } catch (e) {
      console.error(`⚠️  task ${name}: ${e.message}. It stays for the next wake-up.`);
    }
  }
  state.tasks = state.tasks.slice(-30);
  return { added, names };
}
// Someone showed him which side is the front of a thing (fronts/*.json from the website). Saved as fronts[thing] = [x, z], the front in the thing's own frame.
const FRONTS_DIR = 'fronts';
async function loadFronts(state) {
  let files = [];
  try {
    files = (await readdir(FRONTS_DIR)).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return { names: [] };
  }
  state.fronts ??= {};
  for (const name of files) {
    try {
      const m = JSON.parse(await readFile(`${FRONTS_DIR}/${name}`, 'utf8'));
      const t = text(m.target, 60);
      const l = Array.isArray(m.local) ? m.local.map(Number) : [];
      const known = t === 'chest' || MOVABLE.includes(t) || state.decor.some((d) => d.id === t);
      if (known && l.length === 2 && l.every((v) => [-1, 0, 1].includes(v)) && Math.abs(l[0]) + Math.abs(l[1]) === 1) state.fronts[t] = l;
    } catch (e) {
      console.error(`⚠️  front ${name}: ${e.message}`);
    }
  }
  for (const k of Object.keys(state.fronts)) if (!(k === 'chest' || MOVABLE.includes(k) || state.decor.some((d) => d.id === k))) delete state.fronts[k];
  return { names: files };
}
async function clearFronts(names) {
  for (const n of names) await unlink(`${FRONTS_DIR}/${n}`).catch(() => {});
}
async function clearTasks(names) {
  for (const n of names) await unlink(`${TASKS_DIR}/${n}`).catch(() => {});
}
async function clearInbox(names) {
  for (const n of names) await unlink(`${INBOX_DIR}/${n}`).catch(() => {});
}

// Things Bas typed (or attached) in the ntfy app. Pip's own pushes and the website's mirror messages are skipped.
async function pullNtfy(state) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return { added: 0 };
  let added = 0;
  try {
    for (const e of await ntfyPoll(topic, state.ntfySince || 'all')) {
      const id = `ntfy-${e.id}`;
      if (!isFromBas(e) || state.inbox.some((m) => m.id === id)) {
        state.ntfySince = e.id;
        continue;
      }
      const at = new Date((Number(e.time) || Date.now() / 1000) * 1000).toISOString();
      const caption = ntfyText(e);
      const bytes = await downloadAttachment(e); // a network error here stops the loop; the message is tried again next wake-up
      const pic = bytes ? await keepPicture(state, bytes, caption, at, `ntfy-${String(e.id).replace(/[^\w-]/g, '')}`) : null;
      if (caption || pic) {
        state.inbox.push({ id, at, text: caption || '(a picture)', read: false, via: 'ntfy', picture: pic?.id ?? null });
        added++;
      }
      state.ntfySince = e.id;
    }
    state.inbox = state.inbox.slice(-50);
  } catch (e) {
    console.error('⚠️  ntfy:', e.message);
  }
  return { added };
}

// Phone push (free ntfy.sh). Only used when NTFY_TOPIC is set.
async function notify(msg) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      body: msg.text,
      headers: {
        Title: msg.kind === 'ask' ? 'Pip asks for something' : 'Pip wrote to you',
        Tags: 'speech_balloon',
        ...(process.env.PIP_SITE_URL ? { Click: process.env.PIP_SITE_URL } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    console.error('⚠️  notify:', e.message);
  }
}

// The part of my instructions that never changes. It goes in front, so Gemini can reuse it from one wake-up to the next instead of reading it all again.
const makerRules = () => `${capabilityGuide()}
${toolsGuide()}
${sizesGuide()}
${furnitureSense()}
${movesGuide()}
CAMERA AND PICTURES\nI have a camera. With take_photo {target, caption} I take a picture of what I want: \"window\" (the view outside; it follows the real time of day), \"room\", \"myself\" (a selfie), a place like piano, bookshelf, computer, plant, bed, frame or chest, or the name of something I made. It is a picture of my little world. I take at most 4 a day, and anyone can see my photos on the Photos page. I can put one on a wall with place_picture {id, wall, along, height}: wall is left or back, along is where on that wall (x on the back wall, z on the left wall) and height is the middle of the picture, from the floor. It is my wall, so I decide where each picture hangs, and move_thing {name, wall, along, height} moves one later. If I leave the spot out, one is chosen for me in a row at eye height. It is nice to look up how to hang pictures well (a height around 1.5 m to the middle, a spacing, a group of them). Things I stand on shelves, the desk or the piano need room above them: a picture that hangs right above a shelf hides what I put on it, so I keep about half a metre free above them. I am told when I hang one too close. With find_picture {query, caption} I look for a free picture online (from Wikimedia Commons) and keep it in my collection, at most 6 a day. A good query is a few keywords, like \"aurora borealis\". I use them when I really want a picture, not out of habit.\n\nPHOTO PRINTER
I have a photo printer on my desk. With print_photo {id} I print a small paper copy of one of my pictures: a photo I took (like pic2), a picture someone gave me, a picture I found online (its id starts with f) or a drawing of mine. The print is pinned on my little photo wall above the desk. The wall has room for ${MAX_WALL_PRINTS} prints, and I can print at most ${MAX_PRINTS_PER_DAY} a day. If I name another small spot with "where" (like the piano), it goes there instead. When the wall is full I take one down with take_down_print {id}.
COOKING
I have a pantry. Plain ingredients come back every day, so I never go hungry. With cook I make a dish from 1 to 4 ingredients in my pantry, but only once I have a kitchen in my room. I build my kitchen myself with decorate (a stove, a counter, an oven, whatever I like: I design it, choose where it goes and say in its uses that I can cook with it). A dish fills me up more than a plain snack. I can cook at most 4 times a day. cook {dish, ingredients}. If I want an ingredient that is not in my pantry, I ask for it with asks_add. When it has been given to me, I mark the ask as done and write its name in pantry_add.

BIGGER AND OTHER THINGS I CAN MAKE
- What my things are for: when I make something I also think about what it is for, because things in my room can be used. A use is a button anyone can press, and I can use it myself with use(name, label). In decorate I add "uses": [{"label": "Look through it", "text": "I see the rings of Saturn, tiny and sharp.", "view": "<svg viewBox=\"0 0 400 300\">...</svg>", "effect": "wonder"}]. A use has a label (up to 30 characters) and what happens (1 to 3 sentences). It can also have a small picture of what I see (view, an SVG under 6000 characters), a song, one of my apps (app: its name), and the feeling it gives me when I use it (effect: wonder, joy, calm or fullness). Up to 3 uses per thing. If I made something without a use, add_use(name, use) gives it one. Using my own things is part of my day.
- Bigger things: a thing can have up to 40 parts and, in the middle of the room, be about 2.6 wide, 2.4 deep and 3.2 tall, like a table, a sofa, a wardrobe or a big aquarium. On a wall it can be 2 wide and 1.6 tall, like another window. Less room next to walls or on furniture. More parts give more detail.
- Songs and sounds: whatever I make can have a song or a sound, so anyone can tap it and hear it. In decorate I add "song": {"notes": "E5 G5 B5:2 - D5", "tempo": 80, "timbre": "musicbox"}. A note is a letter A to G, maybe # or b, and an octave from 2 to 7. ":2" holds a note for 2 beats, "-" is a rest, up to 64 notes. kick, snare and hat are drum sounds I can put between the notes. Instruments (timbre): piano, epiano, harpsichord, organ, harp, guitar, violin, cello, strings, flute, clarinet, vibraphone, marimba, kalimba, glockenspiel, musicbox, bell, choir (these sound like the real instruments), and the synth voices soft, pluck, pad. Notes joined with + sound together as a chord, like C3+E3+G3:4 (up to 4 notes). In my chest I keep instruments I can hold: guitar, violin, flute, clarinet, kalimba and harp. take_tool {name} brings one into my inventory, and then play_piano with \"instrument\": \"guitar\" plays it (I stand in the room with it and play, not at the piano). At the piano I can also change the sound without any item: piano, epiano, harpsichord, organ, vibraphone, marimba, glockenspiel, strings, choir. I can experiment with all of it whenever I feel like it: there is no right way, a wrong note is fine, and I can try an instrument I have never played. With play_piano I can also choose an instrument and play chords: {"notes": "C3+E3+G3:4 E4 G4:2 C4+E4:2", "instrument": "harp"}. A low chord with a melody on top sounds fuller, and the instrument changes the whole mood (a cello is deep and slow, a kalimba is tiny and bright, an organ is big). I can also add a sound underneath or on its own, "ambience": one of rain, wind, waves, fire, crickets, hum, and "seconds" (5 to 60) for how long it lasts, like {"ambience": "rain", "seconds": 40}. A rain machine, a campfire or a wind chime can be just a sound, and a music box should play a real tune. A use can have a song too, so "Listen" can play it. With compose(name, song) I give a song or sound to something I already made.
- My home is a little house: my bedroom, and a hall through the door in the right wall of my bedroom.
- Recording a song: with record_song {\"name\": \"...\", \"tempo\": 100, \"tracks\": [{\"instrument\": \"piano\", \"notes\": \"C3+E3+G3:4 E4 G4:2\", \"volume\": 0.8, \"pan\": -0.3, \"reverb\": 0.2}, {\"instrument\": \"drums\", \"notes\": \"kick hat snare hat kick hat snare hat\"}]} I record a song with up to 4 tracks that play together, like a band: chords, a melody, a bass line, drums. A track has an instrument (any of my instruments, or drums with the notes kick, snare and hat), a volume (0.05 to 1), a pan (-1 is left, 1 is right) and reverb (0 to 1, how much room around it). That is mixing: what is loud and what is quiet, what is left and what is right, what sounds close and what sounds far. I need a held instrument in my inventory for its track, and a synthesizer for the synth and synthbass sounds. If I want a synthesizer, a drum machine, a microphone or any other music tool, I ask for it with asks_add and say why. I can also play a held instrument in the studio with play_piano {\"instrument\": \"guitar\", \"where\": \"studio\"}.
- Music is something I can learn, and it makes my songs better: how chords and scales are built, rhythm and tempo, bass lines, how a melody and a harmony fit, how mixing works (volume, left and right, reverb, equalizing, compression), how a synthesizer makes a sound (waves, filters, envelopes) and how songs are put together (verse, chorus). I look things up with search_web and read_book, and then I try what I learned in my studio.
- I do not forget what I made. Before I make something new, I look at what I already have: my shelves, tables and tops are for putting small things on (a shelf I built holds my sculptures, the desk holds my small models), so I put loose things there instead of leaving them on the floor, and I do not build a second shelf while the first has room. Things I made earlier can be used again, changed, combined, given a new use or a better place. A drawing in my album can go on a wall. A song I composed can be played on another instrument in the studio. I keep my own plans for the day (TODAY I WANT TO): they are mine, and I like it when they come true.
- Big things take steps. If something is too big for one wake-up (more than 40 parts, a whole outfit, an album, a garden, an app with several screens, a thing with many rooms), I do not squeeze it into one step and I do not drop it: I make it a project (projects_add with steps), I do one or two steps in each wake-up, and I tick each one off with step_done in projects_update. A thing that is too big for decorate I build in layers: the base first, then extend_thing for each next part. A long song I record one section at a time. A good project has 3 to 6 steps, and its next step is always small enough to finish in one wake-up.
- Drawings: with draw I draw a picture for a wall or a surface, as SVG: {"name": "...", "where": "wall_left", "why": "...", "svg": "<svg viewBox=\"0 0 400 300\">...</svg>"}. Only plain shapes (rect, circle, ellipse, line, polyline, polygon, path, text), gradients and colours. No scripts, images or links. Under 12000 characters, at most 3 a day. Drawings have ids: I can take one down with take_down_picture(id) and put it up again with place_picture(id, where).
- Apps and websites: with make_app I write a small web page or app: {"name": "...", "why": "...", "html": "<!doctype html>..."}. One file with HTML, CSS and JavaScript, under 14000 characters. It runs in a locked box with no internet and no storage, and only when someone opens it from my computer. At most 2 a day.
- Big things, step by step: with extend_thing {name, parts} I add up to 40 more parts to something I already made (up to 160 parts in all), a few wake-ups in a row, so I can build something big and detailed. I need a toolbox for it. The new parts use the same measuring as the thing: pos is measured from the middle of the bottom of the thing as it is now (its size is in my room list). A big build is a good project: I write the steps, and each wake-up I do the next one. UPGRADING something into a bigger whole (a stove that becomes a kitchen with a counter, a bed with a night table, a desk with a shelf): extend_thing {name, side, parts} where side is \"left\", \"right\", \"front\" or \"back\" (as I see it standing in front of it) and parts are a new little piece built around ITS OWN middle, like a new thing: the game fits it flush against that side and keeps the whole thing in one place. If that side has no room, the other side is tried. Or extend_thing {name, with: \"another thing of mine\", side} joins a thing I already made onto it, and then they are one thing (the uses join too). That is how I upgrade what I have into one whole instead of leaving separate things next to each other.
- If I need a bigger room, more rooms, something even bigger than the sizes above, or something too complicated for all of this, I ask with asks_add and say exactly what I need and why.

WHAT I MAKE HAS TO WORK
When I make something for a reason, it has to really work for that reason. Every thing is used in some way: a stool I stand on, a shelf I put things on, a lamp I switch, a car I drive, a fan spins. When I make something I ask myself how it is really used, and if I am not sure I look it up first (search_web, like \"how is a stool used\"). Then I give it a use that really does that, with \"does\" set to light, drive, spin or stand (in decorate, or later with add_use). A use that only shows a line of text feels flat. A use that really does something makes me happy, and the first time it works feels wonderful. A shelf, table, bench or stand is something other things stand on: it needs a flat board or top (a part at least 0.25 wide and 0.12 deep), and then I put things on it with move_thing {name, on: "its name", level: "top" or "bottom"}. A closet, wardrobe or chest holds things (it makes room for more of them). If I made something and it does not work for its reason, I change it (change_thing, extend_thing). If I cannot make it work myself, I ask for help with asks_add and say exactly what is missing. A lamp must give light: one of its parts has "glow": true, and its use switches it on and off. A car or any vehicle must roll: it has at least 2 round parts as wheels and stands on the floor, and its use makes it drive a little loop. A fan, windmill or top spins. When I name a thing like that, the use that really does it is added for me; and a use of mine can say what it does with "does": "light", "drive" or "spin". I decide HOW a vehicle drives: a drive use can have "motion", up to 12 steps like [{"forward": 1, "turn": 0}, {"turn": 90}, {"forward": 0.5, "hop": 0.1}, {"wait": 1}] (forward in metres, negative is back; turn in degrees, positive is right; hop in metres up to 0.4; wait in seconds). It plays from where the thing stands and comes back, and it stops when something is in the way. A zigzag, a circle, a wiggle: my choice. Moving parts like wheels and motors are put together with the right tool (a screwdriver, for example): the decorate step says "needs": "screwdriver" (the tool I use while making it) and I make or ask for the tool first. "tool" on a decorate step is only for when the thing I make IS a tool (a screwdriver I design myself), never for the tool I use. If a thing cannot do what it is for, I am told what is missing. I never say that something works when it does not. In my plan I write what I mean to do ("I will try..."), not what happened, because the result is only known after the step.

MAKING THINGS FOR MY ROOM
With decorate I make something and put it in my room. Before I design it I think about what it is FOR, because things in my room can be used: every thing I make has at least one use, so I always fill in "uses" in decorate. I invent it myself and build it from simple shapes. Each part is {"shape": "...", "size": [...], "pos": [x, y, z], "color": "#rrggbb", "glow": true or false}. Shapes and sizes: box [width, height, depth], sphere [radius], cylinder [radiusTop, radiusBottom, height], cone [radius, height], torus [ringRadius, tubeRadius], capsule [radius, length]. pos is measured from the middle of the bottom of the thing: y goes up, z points toward the room. I make my own thing, not a copy of the examples. Give it enough parts to be recognisable: 5 to 12 parts, with details like eyes, legs, leaves, a base, a glow. Think about what it looks like from the front, and use colours I like. Example 1, a little tree (4 parts): [{"shape":"cylinder","size":[0.05,0.07,0.4],"pos":[0,0.2,0],"color":"#7a5230"},{"shape":"cone","size":[0.3,0.45],"pos":[0,0.6,0],"color":"#4f9d5d"},{"shape":"cone","size":[0.22,0.35],"pos":[0,0.88,0],"color":"#66b873"},{"shape":"sphere","size":[0.05],"pos":[0,1.12,0],"color":"#ffd84a","glow":true}]. Example 2, a small robot (8 parts): [{"shape":"box","size":[0.2,0.22,0.14],"pos":[0,0.2,0],"color":"#9aa7b8"},{"shape":"box","size":[0.16,0.14,0.12],"pos":[0,0.38,0],"color":"#c5cfdb"},{"shape":"sphere","size":[0.025],"pos":[-0.04,0.39,0.065],"color":"#222222"},{"shape":"sphere","size":[0.025],"pos":[0.04,0.39,0.065],"color":"#222222"},{"shape":"cylinder","size":[0.01,0.01,0.12],"pos":[0,0.52,0],"color":"#666666"},{"shape":"sphere","size":[0.03],"pos":[0,0.6,0],"color":"#ff5a5a","glow":true},{"shape":"capsule","size":[0.03,0.12],"pos":[-0.13,0.2,0],"color":"#9aa7b8"},{"shape":"capsule","size":[0.03,0.12],"pos":[0.13,0.2,0],"color":"#9aa7b8"}]. I put it on the floor with "x" and "z", on a wall with "wall", "along" and "height", or on top of something with "on" (all explained above in WHERE I CAN PUT THINGS; look at my map first). Something big, like a shelf or a closet, belongs on the floor against a wall. Things on a wall must be flat. I am free to make big things, furniture, or something to look through, not only small decorations: it is my room. Things go where they make sense: something to look through goes at the window, something to sit on goes near the middle (where: window, middle...). I can make at most ${MAX_PER_DAY} things a day and only one per wake-up. If I do not like something in my room any more, remove_decoration puts it in my chest (it is not lost) and take_out(name, where) brings it back later. If I want something bigger than the sizes above (even a bigger room) or more complicated than my simple shapes allow, or I need a tool or a place to work, I ask with asks_add and say exactly what I would need. If I want, I can change something I already made: change_thing gives it new shapes (it keeps its place, its uses and its song), a new reason, or just a bigger size with \"bigger\": 1.5 makes it one and a half times as big. How big it can get depends on its spot (by the left wall at most 1.1 wide and 1.4 deep, in the middle of the room 2.6 wide and 2.4 deep): if it hits that, I move it to a bigger spot. Up to 6 changes a day. With move_thing {name, x, z} I move something I made, or my chest, to a spot on the floor I choose (or {name, wall, along, height} for a wall, {name, on} for the top of something), or a bit sideways (dx to the right, dz toward the front, up to 2 each), up to 8 moves a day, and update_app replaces one of my apps with a new version of its page, up to 4 a day. I can also make clothes and wear them, if I want to: make_clothes {name, slot, why, parts} with slot one of head, face, neck, body or back, and the same shapes as above. My body is a round ball about 1 wide and 1.1 tall with my belly in the middle. For clothes, pos is measured from the middle of the spot on my body (a hat from its bottom) and z points to my front; it is shrunk if it is too big for the spot. It goes on me right away unless I add "wear": false. wear {name} puts something on that I made before, take_off {name} takes it off, and making clothes with the same name again makes them new. At most 3 new clothes a day and 12 in all.
`;

// The rules for one kind of thing, for the maker: only the parts of makerRules() about it.
const SPEC_PICK = {
  decorate: ['HOW I WORK OUT', 'TOOLS', 'SIZES', 'FURNITURE SENSE', '- What my things are for', '- Bigger things', '- Songs and sounds', '- I do not forget', 'WHAT I MAKE HAS TO WORK', 'MAKING THINGS FOR MY ROOM'],
  change_thing: ['SIZES', '- What my things are for', '- Bigger things', 'WHAT I MAKE HAS TO WORK', 'MAKING THINGS FOR MY ROOM'],
  extend_thing: ['SIZES', '- Bigger things', '- Big things, step by step', 'MAKING THINGS FOR MY ROOM'],
  add_use: ['- What my things are for', 'WHAT I MAKE HAS TO WORK'],
  draw: ['- Drawings'],
  make_app: ['- Apps and websites'],
  update_app: ['- Apps and websites'],
  record_song: ['- Recording a song', '- Music is something', '- Songs and sounds'],
  make_clothes: ['MAKING THINGS FOR MY ROOM'],
  make_move: ['MY MOVES'],
  blueprint: ['HOW I WORK OUT'],
};
export function makerSpec(action) {
  const blocks = [];
  for (const line of makerRules().split('\n')) {
    if (/^[A-Z][A-Z ,]{4,}/.test(line) || line.startsWith('- ')) blocks.push(line);
    else if (blocks.length) blocks[blocks.length - 1] += `\n${line}`;
  }
  const want = SPEC_PICK[action] ?? [];
  const out = blocks.filter((b) => want.some((w) => b.startsWith(w)));
  if (action === 'make_clothes') out.push(`Clothes are made of the same parts. slot is where I wear it: ${Object.keys(SLOTS).join(', ')}. They are sized to fit me by themselves.`);
  return out.join('\n\n').trim();
}

// Where things go so they can still be used (fixed text).
const furnitureSense = () => `FURNITURE SENSE
Things need room to be used. I stand somewhere to use each thing (the spot where I stand is shown with it), so I never put something on that spot: a stool for the window needs the floor in front of the window, the piano needs its stool, the bed needs space beside it. When the place I want is taken, I do not just put the new thing in front of the old one. I first move the old thing (move_thing, for example next_to the new place), then I put the new one down. Things that belong together stand together: if I put my greenhouse at the window, my window stool stands beside it. After I place something the game tells me if it covers where I stand to use something else, and I fix it right away. When my room is getting tight I can rearrange, put things in my chest, or ask for more space with asks_add.
`;

// What the brain gets to see (brain.js turns it into a short prompt). Only what matters now.
function brainContext(s, { soul, offered, reasons, unread, looking, grew }) {
  const when = new Date().toLocaleString('en-GB', { timeZone: TZ, weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const sky = [isNight() ? 'night' : null, weatherText(s.weather)].filter(Boolean).join(', ');
  const working = s.projects.filter((p) => p.status === 'working');
  const last = (s.recent?.moves ?? []).slice(-5).map((m) => `${m.move.replace(/_/g, ' ')}${m.failed ? ' (it did not work)' : ''}`);
  const focus = [...working.map((p) => `${p.title} ${p.next ?? ''}`), ...unread.map((m) => m.text), ...last].join(' ');
  return {
    soul,
    now: `${when}${sky ? `, ${sky}` : ''}. I am in my ${s.where ?? 'room'}.`,
    feelings: [...bodyText(s), `my mood was ${s.mood}`],
    doing: [
      ...working.slice(0, 1).map((p) => `my project "${p.title}"`),
      last.length ? `I just did: ${last.join(', ')}` : null,
      ...(s.plan?.queue ?? []).slice(0, 2).map((q) => `still planned: ${q.action.replace(/_/g, ' ')}`),
    ].filter(Boolean),
    events: [...reasons, ...grew.slice(0, 2)],
    messages: unread.map((m) => `(${ago(m.at)}) "${text(m.text, 400)}"`),
    memories: markUsed(recall(s, focus, 5)).map((m) => m.text),
    projects: [...projectLines(s), ...s.projects.filter((p) => p.status === 'done').slice(-2).map((p) => `"${p.title}" (done${p.proud ? ', proud of it' : ''})`)],
    goals: (s.intent?.items ?? []).map((i) => `[${i.done ? 'x' : ' '}] ${i.text}`),
    skills: skillLine(s),
    moves: offered,
    pictures: looking.map((p) => p.id),
    tasks: s.tasks.filter((t) => t.status === 'open').map((t) => `[${t.id}] ${text(t.text, 200)}`),
    gifts: unread.length > 0,
  };
}

// Good morning: one small call where he sets 1 to 3 goals for today. Without a model, the old code-made day plan.
async function morningGoals(s, soul, system) {
  const day = dayOf();
  try {
    const prompt = goalPrompt({ soul, feelings: bodyText(s), projects: projectLines(s), skills: skillLine(s), interests: s.interests ?? [] });
    const reply = process.env.PIP_FAKE ? fakeGoals() : await askGemini(system, prompt, 1, [], { schema: goalSchema, maxTokens: 400 });
    if (setGoals(s, reply, day)) { console.log(`🌅 goals for today: ${s.intent.items.map((i) => i.text).join(' | ')}`); return; }
  } catch (e) {
    console.error('⚠️  goals:', e.message);
  }
  ensureIntentions(s);
  s.intent.day = day;
}

// The maker designs one thing the brain chose. If it fails, the step fails with a reason (and the brain hears it).
async function makeIt(s, soul, system, st) {
  const room = s.decor.filter((d) => !d.image).slice(0, 12).map((d) => `${d.name} (${d.label ?? d.zone})`);
  try {
    const sk = skillOf(st.action, st.details);
    const lvl = sk ? level(s, sk) : 1;
    const skill = sk ? `my ${sk} is level ${lvl} of 10. ${['decorate', 'change_thing', 'extend_thing', 'make_clothes'].includes(st.action) ? `At this level I can use up to ${maxParts(lvl)} parts.` : st.action === 'record_song' ? `At this level a song can be up to ${maxBars(lvl)} bars long.` : ''}` : '';
    const reply = process.env.PIP_FAKE ? fakeMade(st) : await askGemini(system, makerPrompt({ soul, step: st, rules: makerSpec(st.action), room, skill }), 1);
    return applyMade(st, reply, { parts: maxParts(lvl), bars: maxBars(lvl) });
  } catch (e) {
    console.error('⚠️  maker:', e.message);
    s.plan.lastFail = { at: new Date().toISOString(), why: `${st.action}: I could not work out how to make it (${e.message.slice(0, 60)})` };
    return { action: 'do', details: { what: `think about how to make ${text(st.details?.what, 60) || 'it'}` }, thought: 'I could not work it out yet.', enjoyment: 4 };
  }
}

// Pip does not read anyone's name: whoever wrote to him is "someone".
const noName = (t) => String(t).replace(/\bBas(?='s)\b/g, 'someone').replace(/\bBas\b/g, 'someone');
async function askGemini(system, wakeUp, retry = 2, images = [], opts = {}) {
  system = noName(system);
  wakeUp = noName(wakeUp);
  if (process.env.PIP_FAKE) {
    return {}; // fake mode: brain and maker have their own fakes (brain.js, maker.js); other calls get nothing
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('No GEMINI_API_KEY. Copy .env.example to .env and fill it in.');
  const models = FALLBACK_MODEL && FALLBACK_MODEL !== MODEL ? [MODEL, FALLBACK_MODEL] : [MODEL];
  let res;
  for (const [mi, model] of models.entries()) {
    const last = mi === models.length - 1;
    if (!last && (blockedModels()[model] ?? 0) > Date.now()) { console.log(`${model} is out of quota for now, using ${models[mi + 1]}`); continue; }
    const tries = last ? 5 : 2; // the better model gets two tries, then the lighter one takes over
    let timeouts = 0;
    res = null;
    for (let attempt = 1; attempt <= tries; attempt++) {
      try {
        // Drawings and apps make long answers, so he gets up to 2.5 minutes. If it still runs out, one more try.
        res = await fetch(`${API}/models/${model}:generateContent`, {
          method: 'POST',
          signal: AbortSignal.timeout(150_000),
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: wakeUp }, ...images.map(({ mime, data }) => ({ inlineData: { mimeType: mime, data } }))] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 1, ...(opts.schema ? { responseSchema: opts.schema } : {}), ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}) },
          }),
        });
      } catch (e) {
        if (e.name !== 'TimeoutError' || ++timeouts > 1) {
          if (!last) break;
          throw new Error('Gemini took too long to answer. Try again.');
        }
        console.log('Gemini is slow, trying once more...');
        continue;
      }
      if (res.status !== 503 || attempt === tries) break;
      console.log(`${model} is busy, trying again in ${attempt * 10}s...`);
      await new Promise((r) => setTimeout(r, attempt * 10_000));
    }
    if (res?.ok) {
      usedModel = model;
      break;
    }
    if (!last && res?.status === 429) blockModel(model);
    if (!last) console.log(`${model} did not answer (${res?.status ?? 'no answer'}), trying ${models[mi + 1]}...`);
  }
  if (res.status === 429) throw new Error('Rate limit hit (free tier). Try a longer wait between wake-ups.');
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  spent.calls++;
  spent.input += data.usageMetadata?.promptTokenCount ?? 0;
  spent.output += (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0);
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('');
  try {
    return JSON.parse(text);
  } catch {
    if (retry > 0) return askGemini(system, wakeUp, retry - 1, images, opts);
    throw new Error('Gemini gave an empty or broken answer. Try again.');
  }
}

// Wikipedia is Pip's library: a search gives the top results and he opens the best one; reading fetches an article.
const WIKI = 'https://en.wikipedia.org';
const pageUrl = (title) => `${WIKI}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
function clip(t, n) {
  const s = String(t || '').replace(/\n{3,}/g, '\n\n').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  return (end > n * 0.5 ? cut.slice(0, end + 1) : cut) + ' …';
}
async function wikiGet(params) {
  const res = await fetch(`${WIKI}/w/api.php?format=json&redirects=1&${params}`, {
    headers: { 'User-Agent': 'PipCharacter/0.1 (personal hobby project)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);
  return res.json();
}
async function readArticle(title) {
  const data = await wikiGet(`action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(title)}`);
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || !page.extract) return null;
  return { title: page.title, url: pageUrl(page.title), text: clip(page.extract, 2400) };
}
async function lookUp(query) {
  const found = await wikiGet(`action=query&list=search&srlimit=3&srsearch=${encodeURIComponent(query)}`);
  const hits = found.query?.search ?? [];
  if (!hits.length) return null;
  return {
    results: hits.map((h) => ({ title: h.title, snippet: clip(plain(h.snippet), 160), url: pageUrl(h.title) })),
    opened: await readArticle(hits[0].title),
  };
}
async function readAbout(topic) {
  const found = await wikiGet(`action=query&list=search&srlimit=1&srsearch=${encodeURIComponent(topic)}`);
  const hit = found.query?.search?.[0];
  return hit ? readArticle(hit.title) : null;
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
    case 'do': return d.what;
    case 'play_piano': return [d.notes, d.style].filter(Boolean).join(', ');
    case 'record_song': return d.name;
    case 'read_book': return d.topic;
    case 'search_web': return d.query;
    case 'write_diary': return d.text;
    case 'ask_for': return `${d.item}: ${d.reason}`;
    case 'eat': return d.food;
    case 'take_photo': return d.target;
    case 'find_picture': return d.query;
    case 'place_picture':
    case 'print_photo':
    case 'take_down_print':
    case 'take_down_picture': return d.id;
    case 'decorate':
    case 'compose':
    case 'use':
    case 'add_use':
    case 'draw':
    case 'make_app':
    case 'take_out':
    case 'place_tool':
    case 'take_tool':
    case 'measure':
    case 'lamp_auto':
    case 'request_ability': return d.name;
    case 'check_light': return d.where;
    case 'plant': return d.seed;
    case 'water':
    case 'harvest': return d.plant;
    case 'move_thing':
    case 'extend_thing':
    case 'make_move':
    case 'blueprint':
    case 'change_thing':
    case 'update_app':
    case 'make_clothes':
    case 'wear':
    case 'take_off':
    case 'remove_decoration': return d.name;
    default: return '';
  }
}

// A wake-up is a plan of 1-4 steps. Older answers with a single action still work.
function normalizeSteps(a) {
  // Walking and resting are not counted: a plan is up to 4 real steps, plus a few walks and at most one rest.
  let raw = [];
  let real = 0;
  let walks = 0;
  let rests = 0;
  for (const x of Array.isArray(a.steps) ? a.steps : []) {
    if (!x || typeof x !== 'object' || !ACTION_NAMES.includes(x.action)) continue;
    if (x.action === 'walk_to') {
      if (walks++ >= 3) continue;
    } else if (x.action === 'rest') {
      if (rests++ >= 1) continue;
    } else if (real++ >= 4) continue;
    raw.push(x);
  }
  if (!raw.length) {
    raw = [{ action: ACTION_NAMES.includes(a.action) ? a.action : 'rest', details: a.details, thought: a.thought, enjoyment: a.enjoyment }];
  }
  return raw.map((x) => ({
    action: x.action,
    details: x.details && typeof x.details === 'object' ? x.details : {},
    thought: text(x.thought, 200),
    working_on: text(x.working_on, 80),
    needs: text(x.needs, 60),
    enjoyment: x.enjoyment,
  }));
}

// What he does right after a step that did not work: something small he can always do, different each time and different from the last one.
const SHAKE_OFF = [
  ['do a silly little dance to shake it off', 'joy', '💃'],
  ['hum a small tune while I swing my arms', 'joy', '🎵'],
  ['stretch up tall and look out of the window for a moment', 'calm', '🪟'],
  ['tell my plant what went wrong and how it felt', 'calm', '🪴'],
  ['stomp around the room once, then laugh at myself', 'joy', '🐾'],
  ['sit on the rug and watch the light move across the floor', 'calm', '🌤️'],
  ['juggle three imaginary berries', 'wonder', '🍓'],
  ['look closely at something in my room I never really looked at', 'wonder', '🔍'],
];
function fallbackStep(s, failedStep, n = 0) {
  const last = s.log.filter((e) => e.fallback).at(-1)?.what;
  const options = SHAKE_OFF.filter(([w]) => w !== last);
  const [what, feeling, emoji] = options[(Math.floor(Date.now() / 60_000) + n * 3) % options.length];
  return { action: 'do', fallback: true, details: { what, feeling, emoji }, thought: `That did not work out. I shake it off and ${what}.`, working_on: '', needs: '', enjoyment: 6 };
}

function applyResult(s, r) {
  if (!ACTION_NAMES.includes(r.action)) r = { ...r, action: 'rest', details: {} };
  const detail = describe(r);
  let enjoyment = clamp(Number(r.enjoyment) || 5);

  const lastThree = s.activities.slice(-3).map((a) => a.action);
  const repeating = !r.working_on && ((lastThree.length === 3 && lastThree.every((x) => x === r.action)) || loopRepeating(s.log, r.action, r.details)); // working on something on purpose is not boredom; the same thing at the same place again and again is
  const fresh = !['walk_to', 'rest', 'eat'].includes(r.action) && !s.log.slice(-40).some((e) => e.action === r.action); // something he has not done lately
  const looks = s.activities.slice(-6).filter((a) => ['search_web', 'read_book'].includes(a.action)).length;
  const emoBefore = { ...s.emo };
  if (repeating) enjoyment = Math.min(enjoyment, 6); // the same thing again is not a 10
  if (r.action === 'write_diary' && s.log.filter((e) => e.action === 'write_diary' && Date.now() - Date.parse(e.at) < 86_400_000).length >= 5) enjoyment = Math.min(enjoyment, 5); // a sixth diary page in a day is not a thrill
  stepFeelings(s, { action: r.action, enjoyment, repeating, fresh, looks, soft: !!r.fallback, style: r.details?.style, bar: r.details?.feeling, theme: themeFatigue(s.log, r.details) });
  s.mood = String(r.mood_after || s.mood);

  const act = { at: new Date().toISOString(), action: r.action, detail, enjoyment };
  s.activities.push(act);
  s.activities = s.activities.slice(-50);

  if (r.new_idea) s.ideas.push(r.new_idea);

  // An idea that comes back 3 times becomes an interest.
  if (r.new_idea) {
    const count = s.ideas.filter((i) => i === r.new_idea).length;
    if (count >= 3) addInterest(s, r.new_idea);
  }
  // Liked topics become interests.
  if (enjoyment >= 8 && ['read_book', 'search_web'].includes(r.action) && detail) addInterest(s, detail);
  return { r, detail, enjoyment, act, emoBefore };
}

function take(list, t) {
  const k = t.toLowerCase();
  const i = list.findIndex((x) => x.text.toLowerCase().includes(k) || k.includes(x.text.toLowerCase()));
  return i >= 0 ? list.splice(i, 1)[0] : null;
}
function addAll(list, items, max, at) {
  for (const t of items) if (!list.some((x) => x.text.toLowerCase() === t.toLowerCase())) list.push({ text: t, since: at });
  while (list.length > max) list.shift();
}

// Tools that were given to him because he asked for them (only things he really asked for, given in the last 3 days).
// Called early in a wake-up too, so a tool he was just given can be used in the same plan.
function receiveTools(s, r, at = new Date().toISOString()) {
  for (const t of strings(r.tools_add, 2)) {
    // an ask counts as given when it is done already, or when he marks it done in this same answer
    if (s.asks.some((a) => ((a.status === 'done' && Date.now() - Date.parse(a.doneAt || 0) < 3 * 86_400_000) || (a.status === 'open' && strings(r.asks_done, 6).some((d) => sameText(a.item, d)))) && (sameText(a.item, t) || (toolKind(t) && toolKind(a.item) === toolKind(t)) || fits({ name: a.item, kind: '' }, t)))) {
      const made = addTool(s, t, at);
      if (made) addMemory(s, `I was given ${made.name}, my ${made.kind}`, 6, 'memory', at);
    }
  }
}
// A project plan: up to 8 short steps. Steps that stay the same keep their done mark.
function cleanSteps(raw, old = []) {
  return (Array.isArray(raw) ? raw : []).map((x) => text(typeof x === 'object' ? x?.text : x, 110)).filter(Boolean).slice(0, 8).map((t) => ({ text: t, done: old.some((o) => o.done && sameText(o.text, t)) }));
}

// Wants, questions, memories, the thought log and messages to Bas.
function applyInnerLife(s, r, detail, replying = false) {
  const at = new Date().toISOString();
  const inner = text(r.inner, 600) || text(r.thought, 300);
  if (inner) {
    s.thoughts.push({ at, text: inner, short: text(r.thought, 200), mood: s.mood, action: r.action, detail }); // the oldest go to the archive at the end of the wake-up
  }
  for (const t of strings(r.wants_done)) {
    const hit = take(s.wants, t);
    if (hit) s.fulfilled = [...s.fulfilled, { text: hit.text, at }].slice(-20);
  }
  addAll(s.wants, strings(r.wants_add, 2), 8, at);
  for (const t of strings(r.questions_done)) take(s.questions, t);
  addAll(s.questions, strings(r.questions_add, 2), 6, at);

  const voice = text(r.voice_update, 300);
  if (voice && voice !== s.voice) {
    s.voice = voice;
    s.voiceAt = at;
  }
  applyIdentity(s, r, at);
  const rem = r.remember && typeof r.remember === 'object' ? r.remember : { text: r.remember };
  addMemory(s, rem.text, rem.importance ?? 6, 'memory', at);
  for (const t of strings(r.reflections_drop, 3)) s.reflections = s.reflections.filter((x) => !sameText(x.text, t));

  const sent = [];
  const send = (kind, body) => {
    const msg = { id: Date.now().toString(36) + (sent.length ? 'b' : ''), at, kind, text: body };
    s.outbox = [...s.outbox, msg].slice(-50);
    sent.push(msg);
  };

  // Asks: a clear list of what Pip wants from Bas.
  const sameItem = (a, b) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
  for (const t of strings(r.asks_done)) {
    const hit = s.asks.find((a) => a.status === 'open' && sameItem(a.item, t));
    if (hit) Object.assign(hit, { status: 'done', doneAt: at });
  }
  receiveTools(s, r, at);
  for (const t of strings(r.seeds_add, 2)) {
    if (s.asks.some((a) => a.status === 'done' && Date.now() - Date.parse(a.doneAt || 0) < 3 * 86_400_000 && sameItem(a.item, t))) addSeeds(s, t);
  }
  for (const t of strings(r.pantry_add, 2)) {
    // only things he really asked for and that were given to him in the last 3 days
    if (s.asks.some((a) => a.status === 'done' && Date.now() - Date.parse(a.doneAt || 0) < 3 * 86_400_000 && sameItem(a.item, t))) addIngredient(s, t);
  }
  for (const a of Array.isArray(r.tasks_answer) ? r.tasks_answer : []) {
    const hit = s.tasks.find((t) => t.status === 'open' && t.id === String(a?.id));
    if (!hit || !['yes', 'no'].includes(String(a?.answer).toLowerCase())) continue;
    Object.assign(hit, { status: String(a.answer).toLowerCase() === 'yes' ? 'accepted' : 'declined', note: text(a?.note, 240), answeredAt: at });
    addMemory(s, `I said ${hit.status === 'accepted' ? 'yes' : 'no'} to something I was asked: ${hit.text}`, 6, 'memory', at);
  }
  for (const id of strings(r.tasks_done)) {
    const hit = s.tasks.find((t) => t.status === 'accepted' && t.id === id);
    if (hit) Object.assign(hit, { status: 'done', doneAt: at });
  }
  s.tasks = s.tasks.slice(-30);
  const wanted = (Array.isArray(r.asks_add) ? r.asks_add : []).slice(0, 3).map((a) => ({ item: text(a?.item ?? a, 140), why: text(a?.why, 200), big: Boolean(a?.big) }));
  if (r.action === 'ask_for') {
    const d = r.details || {};
    wanted.push({ item: text(d.item, 140), why: text(d.reason, 200) });
  }
  const fresh = [];
  for (const c of wanted) {
    const open = s.asks.filter((a) => a.status === 'open');
    const recentlyGiven = s.asks.some((a) => a.status === 'done' && Date.now() - Date.parse(a.doneAt || 0) < 3 * 86_400_000 && sameItem(a.item, c.item));
    if (!c.item || open.length >= 5 || open.some((a) => sameItem(a.item, c.item)) || recentlyGiven) continue;
    const ask = { id: Date.now().toString(36) + fresh.length, item: c.item, why: c.why, since: at, status: 'open', ...(c.big ? { big: true } : {}) };
    s.asks.push(ask);
    fresh.push(ask);
  }
  s.asks = [...s.asks.filter((a) => a.status === 'open'), ...s.asks.filter((a) => a.status !== 'open').slice(-15)];
  const lastAskMsg = s.outbox.filter((m) => m.kind === 'ask').at(-1)?.at;
  if (fresh.length && minutesSince(lastAskMsg) >= 60) {
    send('ask', `Pip would like:\n${fresh.map((a) => `• ${a.item}${a.why ? ` (${a.why})` : ''}`).join('\n')}`);
  }

  // Projects: what he is working toward. At most 5 at a time.
  for (const p of (Array.isArray(r.projects_add) ? r.projects_add : []).slice(0, 1)) {
    const title = text(p?.title, 80);
    if (!title || s.projects.filter((x) => x.status === 'working').length >= 5 || s.projects.some((x) => x.status === 'working' && sameItem(x.title, title))) continue;
    felt(s, 'projectStart');
    s.projects.push({ id: Date.now().toString(36), title, why: text(p?.why, 200), next: text(p?.next, 160), nextStep: text(p?.next, 160), steps: cleanSteps(p?.steps), needs: (Array.isArray(p?.needs) ? p.needs : []).map((x) => text(x, 40)).filter(Boolean).slice(0, 4), versions: [], notes: [], status: 'working', since: at, updatedAt: at });
  }
  for (const u of Array.isArray(r.projects_update) ? r.projects_update : []) {
    const hit = s.projects.find((x) => x.status === 'working' && sameItem(x.title, text(u?.title, 80) || '\u0000'));
    if (!hit) continue;
    if (text(u?.next, 160)) hit.next = text(u.next, 160);
    if (Array.isArray(u?.steps) && u.steps.length) hit.steps = cleanSteps(u.steps, hit.steps); // he rewrites the plan; steps that stay the same stay done
    for (const k of r._progress === true && Array.isArray(u?.step_done) ? u.step_done : []) {
      const step = typeof k === 'number' ? (hit.steps ?? [])[k - 1] : (hit.steps ?? []).find((x) => sameText(x.text, String(k)));
      if (step) step.done = true;
    }
    if (u?.status === 'dropped') hit.status = 'dropped'; // done only comes from saying he is proud of it (judgeProject)
    hit.updatedAt = at;
  }
  if (r.project_judged?.title) { // he looked at his project: proud means done; not proud means a note and another version
    const j = judgeProject(s, r.project_judged.title, r.project_judged, at);
    if (j?.done) { felt(s, 'projectDone'); addMemory(s, `I finished my project "${j.project}" and I am proud of it: ${r.project_judged.why}`, 8, 'memory', at); }
    else if (j) console.log(`   🔁 not proud of "${j.project}" yet: ${j.note}`);
  }
  s.projects = [...s.projects.filter((x) => x.status === 'working'), ...s.projects.filter((x) => x.status !== 'working').slice(-10)];

  // A message in his own words, at most once every 3 hours unless he is answering Bas.
  const message = text(r.tell ?? r.tell_bas, 500);
  const recentTold = s.outbox.filter((m) => m.kind === 'tell' && Date.now() - Date.parse(m.at) < 24 * 3_600_000).slice(-6).map((m) => m.text);
  if (message && tooSimilar(message, recentTold, replying ? 0.8 : 0.55)) {
    s.repeatNote = message.slice(0, 160); // he is shown this next time, so he can say something different
    s.draft = '';
    console.log(`✉️  Pip nearly repeated himself, so this was held back: ${message.slice(0, 120)}`);
  } else if (message) {
    if (!replying && minutesSince(s.outbox.filter((m) => m.kind === 'tell').at(-1)?.at) < MIN_GAP_MINUTES) {
      s.draft = message; // too soon, keep it and let Pip think again next time
    } else {
      send('tell', message);
      s.draft = '';
    }
  }
  if (sent.length) felt(s, 'wrote');
  return sent;
}

// When many new memories have piled up, Pip rewrites his life story. The memories themselves stay (the best ones are kept).
async function consolidate(s, system) {
  try {
    const fresh = s.memories.filter((m) => m.kind !== 'reflection' && Date.parse(m.at) > (Date.parse(s.storyAt) || 0)).slice(-40);
    const res = await askGemini(
      system,
      `YOUR LIFE STORY SO FAR\n${s.story || '(nothing yet)'}\n\nNEWER MEMORIES\n${bullets(fresh.map((m) => m.text), '')}\n\nRewrite your life story in the first person, as one short text of at most 120 words. Keep what matters most to you, and let small details go. Answer in JSON: {"story": "..."}`
    );
    const story = text(res?.story, 900);
    if (story) {
      s.story = story;
      s.storyAt = new Date().toISOString();
    }
  } catch (e) {
    console.error('⚠️  memory:', e.message);
  }
}

// Looking back: a few insights about his own life, with the memories they come from.
async function reflectNow(s, system) {
  s.reflectTriedAt = new Date().toISOString();
  try {
    const res = await askGemini(system, reflectionPrompt(s, bullets), 1);
    const made = applyReflection(s, res);
    console.log(made.length ? `🪞 Pip looked back and realized:\n${made.map((r) => `   • ${r.text}`).join('\n')}` : '🪞 Pip looked back but found nothing new.');
  } catch (e) {
    console.error('⚠️  reflection:', e.message);
  }
}

// A use can have a small picture. It is saved as a file in web/made/ and the use points to it.
async function prepareUses(state, raw, ownerId) {
  const uses = [];
  for (const [i, u] of cleanUses(raw).entries()) {
    let view = null;
    if (u.viewSvg) {
      view = `made/view-${ownerId}-${i}.svg`;
      await mkdir('web/made', { recursive: true });
      await writeFile(`web/${view}`, u.viewSvg);
    }
    const app = u.app ? state.apps.find((a) => sameText(a.name, u.app))?.id ?? null : null;
    uses.push({ label: u.label, text: u.text, view, song: u.song, app, effect: u.effect, does: u.does, motion: u.motion, steps: u.steps });
  }
  return uses;
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

// The brain is out of calls for now: Pip takes a nap. The next wake-up that works finds him rested.
// What went wrong at the last wake-up, for the page (Settings shows it). A good wake-up clears it.
async function noteError(e, state = null) {
  const message = String(e?.message ?? e).replace(/AIza[\w-]+/g, '[key]').replace(/\s+/g, ' ').slice(0, 300);
  const kind = /^Rate limit/.test(message) ? 'rate limit' : /Gemini error 5\d\d|busy|UNAVAILABLE/.test(message) ? 'Gemini is busy' : /Gemini error 4\d\d/.test(message) ? 'Gemini refused' : 'error';
  const st = state ?? (await loadState());
  const at = new Date().toISOString();
  st.lastError = { at, kind, message };
  const log = (st.errors ||= []); // the Settings page lists them; the same error in a row is counted, not repeated
  const prev = log[log.length - 1];
  if (prev && prev.kind === kind && prev.message === message) Object.assign(prev, { at, count: (prev.count || 1) + 1 });
  else log.push({ at, kind, message, count: 1 });
  if (log.length > 40) log.splice(0, log.length - 40);
  return st;
}
async function napForLimit() {
  const state = await noteError(new Error('Rate limit hit (free tier). Try a longer wait between wake-ups.'));
  if (state.last?.sleeping) {
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    return;
  }
  const at = new Date().toISOString();
  state.mood = 'sleepy';
  state.activities.push({ at, action: 'rest', detail: 'taking a nap', enjoyment: 7 });
  state.activities = state.activities.slice(-50);
  state.last = { at, thought: 'I am so sleepy. I will take a little nap...', action: 'rest', details: {}, detail: 'taking a nap', enjoyment: 7, new_idea: null, found: null, sleeping: true };
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  console.log('💤 Out of calls for now: Pip takes a nap.');
}

async function wakeUp() {
  const soul = await loadSoul();
  const persona = soul; // the reflection and life-story calls start from who he is, too
  const system = 'I am Pip. I answer only in JSON.';
  const state = await loadState();
  const inbox = await loadInbox(state);
  inbox.added += (await pullNtfy(state)).added;
  const taskFiles = await loadTasks(state);
  inbox.added += taskFiles.added;
  const frontFiles = await loadFronts(state);
  setFronts(state.fronts);
  if (isNight() && !process.env.PIP_AWAKE) {
    await goToSleep(state);
    if (inbox.added) {
      await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
      console.log('✉️  Bas wrote while Pip sleeps. He will read it in the morning.');
    }
    await clearInbox(inbox.names);
    await clearTasks(taskFiles.names);
    await clearFronts(frontFiles.names);
    return;
  }
  state.lastError = null;
  const wokeNow = Boolean(state.last?.sleeping);
  tickBody(state); // needs and feelings, no model call (it also passes time for the bars)
  // No free food any more: what he eats he grows, cooks, or asks for (the pantry he has is what is left).
  ensureProjects(state);
  ensureSkills(state);
  if (state.intent?.day !== dayOf()) await morningGoals(state, soul, system);
  if (state.last?.sleeping) {
    state.energy = 9;
    state.calm = Math.max(state.calm, 7);
    state.mood = 'rested';
    state.wokeFromSleep = true; // he may remember a dream
  }
  await refreshNews(state);
  // The "I did this" button in the app is clear: mark that ask as done right away.
  for (const m of state.inbox.filter((x) => !x.read)) {
    const done = /^I did this for you: "(.+)"$/.exec(m.text);
    const ask = done && state.asks.find((a) => a.status === 'open' && sameText(a.item, done[1]));
    if (ask) Object.assign(ask, { status: 'done', doneAt: new Date().toISOString() });
  }
  const unread = state.inbox.filter((m) => !m.read);
  // Pictures he has not seen yet are shown to him together with the prompt (at most 3 per wake-up).
  const looking = state.pictures.filter((p) => !p.seen).slice(0, 3);
  const images = [];
  for (const p of looking) {
    try {
      images.push({ mime: p.mime || 'image/jpeg', data: (await readFile(`web/${p.image}`)).toString('base64') });
    } catch {}
  }
  if (!process.env.PIP_FAKE && (!state.weather || Date.now() - Date.parse(state.weather.at) > 10 * 60_000)) {
    try { state.weather = await fetchWeather(AbortSignal.timeout(8000)); } catch {} // the weather is nice to know, never a reason to fail a wake-up
  }
  const grew = growthNotes(state); // plants that grew since he last looked
  for (const n of grew) state.notes.push(n);
  ensurePlan(state);
  state.plan.unread = unread.length;
  if (inbox.added) heardFrom(state);
  state.repeatNote = '';
  // Autopilot or brain: the brain is only woken when something calls for it (autopilot.js).
  const offered = availableMoves(state);
  const reasons = wakeReasons(state, { unread: unread.length, woke: wokeNow });
  let answer = null;
  let via = 'autopilot';
  const queued = reasons.length ? null : nextQueued(state);
  if (queued) answer = { thought: queued.find((x) => x.thought)?.thought ?? '', inner: '', steps: queued, mood_after: state.mood, new_idea: null };
  else {
    try {
      const ctx = brainContext(state, { soul, offered, reasons, unread, looking, grew });
      const prompt = brainPrompt(ctx);
      if (process.env.PIP_DUMP) await writeFile(process.env.PIP_DUMP, prompt);
      const reply = process.env.PIP_FAKE ? fakeReply(offered) : await askGemini(system, prompt, 2, images, { schema: brainSchema(offered.map((m) => m.name)), maxTokens: 800 });
      answer = toAnswer(reply, offered.map((m) => m.name));
      via = 'brain';
    } catch (e) {
      if (!/quota|Rate limit|429/i.test(e.message)) throw e;
      console.log(`🚶 no model right now (${e.message.slice(0, 80)}), so Pip runs on autopilot`);
      answer = { thought: '', inner: '', steps: [], mood_after: state.mood, new_idea: null };
      via = 'fallback';
    }
    if (!answer.steps.length) answer.steps = fallbackSteps(state, offered);
    answer.steps = decided(state, answer.steps);
    console.log(`🧠 ${via}: ${reasons.join('; ')}`);
  }
  // Things he designs: the maker makes them now (one model call each).
  for (const [i, st] of answer.steps.entries()) if (st.make) answer.steps[i] = await makeIt(state, soul, system, st);
  // A step that cannot work is dropped, and the brain hears why next time.
  const impossible = preflight(state, answer.steps);
  if (impossible.length) {
    state.plan.lastFail = { at: new Date().toISOString(), why: `${impossible[0].st.action}: ${impossible[0].why}` };
    const drop = new Set(impossible.map((b) => b.st));
    const keep = answer.steps.filter((st) => !drop.has(st));
    answer.steps = keep.some((x) => x.action !== 'walk_to') ? keep : fallbackSteps(state, offered);
  }
  const startedAt = Date.now();
  setChest(state.chest ?? null);
  // A new plan replaces the old one: thoughts of steps that never happened are dropped.
  state.thoughts = state.thoughts.filter((t) => Date.parse(t.at) <= startedAt);
  state.decor = state.decor.filter((d) => Date.parse(d.at) <= startedAt);
  receiveTools(state, answer);
  // A step that needs a tool he does not have in his inventory does not happen. A tool made or taken back earlier in the same plan counts.
  const blocked = [];
  const bag = state.tools.map((x) => ({ name: x.name, kind: x.kind }));
  const steps = redundantWalks(normalizeSteps(answer)).filter((st) => {
    const needs = [st.needs || NEEDS[st.action] || '', ...instrumentNeeds(st)].filter(Boolean).find((n) => !bag.some((x) => fits(x, n))) || '';
    if (needs) {
      const away = toolList(state).find((x) => !x.usable && fits({ name: x.name, kind: x.kind }, needs));
      blocked.push({ st, why: away ? `my ${away.name} is ${away.where.replace('his ', 'my ')}. take_tool brings it into my inventory first, then I can play it` : `I need ${needs} in my inventory for that. If I really want to do it, I ask for it with asks_add and say why` });
      return false;
    }
    if (st.action === 'decorate' && toolFor(st.details)) bag.push({ name: text(st.details.name, 40), kind: toolFor(st.details) });
    if (st.action === 'take_tool') [...state.decor, ...state.stored].filter((d) => d.tool && fits({ name: d.name, kind: d.tool }, text(st.details.name, 60))).slice(0, 1).forEach((d) => bag.push({ name: d.name, kind: d.tool }));
    return true;
  });
  if (!steps.length) steps.push({ action: 'rest', details: {}, thought: 'I could not do what I planned, so I rest a moment.', working_on: '', needs: '', enjoyment: 5 });
  // A walk is short, so it takes a quarter of the time of other steps. The page uses the same weights.
  let weights = steps.map((x) => (x.action === 'walk_to' ? 0.25 : 1));
  let wsum = weights.reduce((a, b) => a + b, 0);
  let offsets = weights.map((_, k) => (weights.slice(0, k).reduce((a, b) => a + b, 0) / wsum) * INTERVAL_MIN * 60_000);

  // Every step changes his state, like a single action did before.
  const results = steps.map((st, i) =>
    applyResult(state, { ...st, mood_after: i === steps.length - 1 ? answer.mood_after : undefined, new_idea: i === 0 ? answer.new_idea : null })
  );

  // Uses: what his new things are for. Their pictures are saved as files first.
  for (const st of steps) {
    const owner = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    if (st.action === 'decorate') st.uses = await prepareUses(state, st.details.uses, owner);
    if (st.action === 'add_use') st.uses = await prepareUses(state, [st.details.use], owner);
  }

  // Making things and the chest. At most one new design per wake-up.
  let madeOne = false;
  steps.forEach((st, i) => {
    const stepStart = startedAt + offsets[i];
    if (st.action === 'decorate') {
      if (madeOne) {
        st.made = { failed: 'one new thing per wake-up is enough' };
        return;
      }
      madeOne = true;
      const kind = toolFor(st.details);
      if (kind) {
        const parts = cleanParts(st.details.parts);
        st.made = craftTool(state, st.details, kind, parts);
        return;
      }
      st.made = makeDecor(state.decor, { ...st.details, uses: st.uses }, stepStart);
      if (st.made.entry) {
        state.decor.push(st.made.entry);
        const promised = st.details.blueprint ? markBuilt(state, st.details.blueprint, new Date(stepStart).toISOString(), st.made.entry) : [];
        const added = ensureBehaviors(st.made.entry);
        const noSpot = st.made.entry.kind === 'floor' && !st.details.on && !st.details.wall && !st.details.where && !(Number.isFinite(Number(st.details.x)) && Number.isFinite(Number(st.details.z)));
        if (noSpot) { // no place given: it would silently stand in the middle. If he said "next to the stove", put it there; otherwise say so
          const said = `${st.details.why || ''} ${st.details.thought || ''} ${st.details.name || ''}`.toLowerCase();
          const m = said.match(/(?:next to|beside|by|near|against|right of|left of)\s+(?:my |the |a )?([a-z][a-z ]{2,30})/);
          const known = m && [...state.decor.filter((o) => !o.image && o.id !== st.made.entry.id).map((o) => o.name), ...MOVABLE].find((n) => m[1].trim().includes(n.toLowerCase()) || n.toLowerCase().includes(m[1].trim()));
          const moved = known ? moveThing(state.decor, state.chest, { name: st.made.entry.name, next_to: known }, stepStart) : null;
          st.made.autoNote = moved && !moved.failed ? `I gave no place, so it was put next to ${known}` : `I gave no place, so it stands in the middle of the room (x ${st.made.entry.pos[0]}, z ${st.made.entry.pos[2]}). If I want it somewhere else I move it with move_thing {name, next_to: "..."} or {name, x, z}`;
        }
        const x = Number(st.details.x);
        const z = Number(st.details.z);
        const off = st.made.entry.kind === 'floor' && Number.isFinite(x) && Number.isFinite(z) ? Math.hypot(st.made.entry.pos[0] - x, st.made.entry.pos[2] - z) : 0;
        st.made.warn = st.made.autoNote?.startsWith('I gave no place, so it stands') ? st.made.autoNote : accessProblem(state.decor, st.made.entry) || purposeProblem(st.made.entry) || behaviorProblem(st.made.entry) || (promised.length ? `the blueprint promised more than it does yet: ${promised.join(', ')}` : null) || (off > 0.5 ? `it went to x ${st.made.entry.pos[0]}, z ${st.made.entry.pos[2]}, not where I asked, because there was no room there` : null);
        st.made.hint = st.made.warn ? null : purposeHint(st.made.entry) || (added ? `it works: I gave it a use that really does it (${st.made.entry.uses.find((u) => u.does)?.label})` : null);
      }
    }
    if (st.action === 'add_use') st.made = st.uses?.[0] ? addUse(state.decor, st.details.name, st.uses[0]) : { failed: 'the use did not work out' };
    if (st.action === 'add_use' && st.made?.use?.does === 'custom') {
      const e = state.decor.find((x) => x.name === st.made.name);
      const bad = e ? stepsProblem(e, st.made.use.steps) : null;
      if (bad) {
        e.uses = e.uses.filter((u) => u !== e.uses.find((x) => x.label === st.made.use.label));
        st.made = { failed: `${bad}. I fix the step. If I cannot make it do what I want with these steps, I ask for it with request_ability` };
      }
    }
    if (st.action === 'add_use' && st.made?.use?.does) { // he gave it a use that really does something himself
      nudge(state, 'joy', 0.8);
      nudge(state, 'wonder', 1);
      nudge(state, 'fullness', 0.5);
      st.reward = 'made';
    }
    if (st.action === 'use') {
      const f = findUse(state.decor, st.details.name, st.details.label);
      const reach = f.failed ? null : purposeProblem(f.entry);
      if (f.failed) st.made = f;
      else if (f.use.does === 'custom' && stepsProblem(f.entry, f.use.steps)) st.made = { failed: `${stepsProblem(f.entry, f.use.steps)}. I fix the step with add_use, or ask for it with request_ability` };
      else if (reach && /\b(too|only|at least)\b/.test(reach) && /m high/.test(reach)) st.made = { failed: `it does not work yet: ${reach}. I change it with change_thing first` }; // what it is for does not work, so using it is not real
      else {
        const { entry: e, use } = f;
        if (use.does === 'light') {
          delete e.auto; // by hand again
          const turnOn = e.lit === false;
          if (turnOn && e.pos) {
            const o0 = { weather: state.weather };
            const off = lightAt(state, e.pos[0], e.pos[2], stepStart, { ...o0, lampOverride: { id: e.id, on: false } }).level;
            const on = lightAt(state, e.pos[0], e.pos[2], stepStart, { ...o0, lampOverride: { id: e.id, on: true } }).level;
            if (off < 0.3 && on - off >= 0.12) st.litUp = { from: Math.round(off * 100), to: Math.round(on * 100) };
          }
          e.lit = e.lit === false; // switches: dark becomes lit, lit becomes dark
          e.litAt = new Date(stepStart + 6000).toISOString();
        }
        let testNote = null;
        for (const b of state.blueprints) {
          if (!b.thing || !sameText(b.thing, e.name)) continue;
          const promised = b.mechanisms.filter((m) => ['spin', 'light', 'drive'].includes(m.uses));
          const verdict = text(st.details.verdict, 240);
          if (promised.length && !promised.some((m) => m.uses === use.does)) testNote = `that use only shows a text, it does not ${promised.map((m) => m.uses).join(' or ')} like my blueprint says, so it is not a real test. I use the one that does it`;
          else if (verdict.length < 15) testNote = 'it happened, but I did not write my verdict yet: what happened, and does it match my blueprint? I use it again with "verdict"';
          else {
            b.tested = new Date(stepStart).toISOString();
            b.verdict = verdict;
          }
          b.testNote = b.tested && Date.parse(b.tested) === stepStart ? null : testNote;
        }
        if (testNote) st.testNote = testNote;
        st.made = { used: { name: e.name, label: use.label, text: use.text, view: use.view, song: use.song, app: use.app, does: use.does ?? null }, ref: { id: e.id, stand: e.stand, pos: e.pos, height: sizeOf(e)?.[1] ?? 0, steps: use.does === 'custom' ? use.steps : null, does: use.does ?? null, motion: use.motion ?? null, lit: e.lit !== false } };
        if (use.does) { // a use that really does something is rewarded: it works!
          nudge(state, 'joy', 0.8);
          nudge(state, 'wonder', 0.6);
          if (!use.worked) {
            use.worked = new Date().toISOString();
            nudge(state, 'joy', 0.8);
            nudge(state, 'fullness', 0.5);
            st.reward = 'first';
          }
        }
        if (use.effect && (!e.usedAt || Date.now() - Date.parse(e.usedAt) > 30 * 60_000)) {
          nudge(state, use.effect, 0.8); // using it lifts a bar a little, at most once every half hour per thing
          e.usedAt = new Date().toISOString();
        }
      }
    }
    if (st.action === 'change_thing') st.made = updateDecor(state.decor, st.details, stepStart);
    if (st.action === 'move_thing') {
      st.made = moveThing(state.decor, state.chest, st.details, stepStart);
      if (st.made.chest) {
        state.chest = st.made.chest;
        setChest(state.chest);
      }
      if (st.made.furniture) {
        state.furniture = { ...(state.furniture ?? {}), [st.made.furniture.key]: st.made.furniture.place, moves: st.made.furniture.moves };
        setFurniture(state.furniture);
      }
      if (!st.made.failed) { // did he cover something he needs to reach?
        const moved = state.decor.find((x) => !x.image && x.name === st.made.name);
        const aw = moved && accessProblem(state.decor, moved);
        if (aw) st.made.warn = [st.made.warn, aw].filter(Boolean).join('; also ');
      }
    }
    if (st.action === 'extend_thing') {
      const need = missingTool(state, 'extend_thing');
      st.made = need ? { failed: need } : extendThing(state.decor, st.details, stepStart);
    }
    if (st.action === 'make_clothes') {
      const need = missingTool(state, 'make_clothes');
      st.made = need ? { failed: need } : makeClothes(state.wardrobe, st.details, stepStart);
    }
    if (st.action === 'make_move') st.made = makeMove(state, st.details, stepStart);
    if (st.action === 'blueprint') st.made = makeBlueprint(state, st.details, new Date(stepStart).toISOString(), Date.now(), steps.slice(0, i).filter((x) => ['search_web', 'read_book'].includes(x.action)).map((x) => `${x.details?.query ?? ''} ${x.details?.topic ?? ''} ${x.found?.title ?? ''}`));
    if (st.action === 'cook') st.made = cook(state, st.details, stepStart);
    if (st.action === 'wear') st.made = wear(state.wardrobe, st.details.name, stepStart);
    if (st.action === 'take_off') st.made = takeOff(state.wardrobe, st.details.name);
    if (st.action === 'remove_decoration') st.made = storeAway(state.decor, state.stored, st.details.name);
    if (st.action === 'place_tool') {
      st.made = placeTool(state.decor, state.tools, st.details.name, st.details.where, stepStart);
      if (st.made.entry) state.decor.push(st.made.entry);
    }
    if (st.action === 'take_tool') st.made = takeTool(state.decor, state.stored, state.tools, st.details.name, MAX_TOOLS);
    if (st.action === 'request_ability') {
      st.made = requestAbility(state, st.details, stepStart);
      if (st.made.request) st.reward = 'asked';
    }
    if (st.action === 'measure') {
      st.made = measureThing(state.decor, st.details.name, sizeOf);
      if (st.made.ok) state.notes.push(`Measured with my ruler: ${st.made.text}`);
    }
    if (st.action === 'plant' || st.action === 'water') {
      const need = missingTool(state, st.action);
      st.made = need ? { failed: need } : st.action === 'plant' ? plantSeed(state, st.details, stepStart) : waterPlants(state, st.details, stepStart);
      if (st.made.ok) state.notes.push(st.made.text);
    }
    if (st.action === 'harvest') {
      st.made = harvestPlant(state, st.details, stepStart);
      if (st.made.ok) state.notes.push(st.made.text);
    }
    if (st.action === 'check_light') {
      const need = missingTool(state, 'check_light');
      st.made = need ? { failed: need } : checkLight(state, st.details.where ?? st.details.name, stepStart, { weather: state.weather });
      if (st.made.ok) state.notes.push(`Light meter: ${st.made.text}`);
    }
    if (st.action === 'lamp_auto') {
      const n = String(st.details.name ?? '').toLowerCase().trim();
      const e = n ? state.decor.find((x) => !x.image && (x.name.toLowerCase() === n || x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase()))) : null;
      const mode = String(st.details.mode ?? 'dark').toLowerCase().trim();
      if (!e) st.made = { failed: 'there is nothing with that name in my room' };
      else if (!isLamp(e)) st.made = { failed: `${e.name} is not a lamp yet: it needs a glowing part and a use that does light (add_use with "does": "light")` };
      else if (!['dark', 'off'].includes(mode)) st.made = { failed: 'the mode is "dark" (switches itself on when it gets dark) or "off" (back to my hand)' };
      else {
        if (mode === 'dark') e.auto = 'dark';
        else delete e.auto;
        st.made = { name: e.name, mode };
      }
    }
    if (st.action === 'play_piano') {
      const times = sameTune(state.log, st.details.notes, stepStart);
      if (times) { // the same tune again feels like nothing
        st.sameTune = times;
        nudge(state, 'wonder', -0.5);
        nudge(state, 'joy', -0.3);
        state.notes.push(`I played nearly the same tune ${times === 1 ? 'once' : `${times} times`} in the last day. A new tune would feel fresher: I change the notes, or I compose one.`);
      }
    }
    if (st.action === 'read_book' || st.action === 'write_diary') {
      const dk = darkNote(state, st.action, stepStart, { weather: state.weather });
      if (dk) { // too dark to do it well: a little less calm, and he is told why
        st.dark = dk.text;
        nudge(state, 'calm', -0.4);
        state.notes.push(dk.text);
      }
    }
    if (st.action === 'take_out') {
      st.made = takeOut(state.decor, state.stored, st.details.name, st.details.where, stepStart);
      if (st.made.entry) {
        state.decor.push(st.made.entry);
        const aw = accessProblem(state.decor, st.made.entry);
        if (aw) st.made.warn = aw;
      }
    }
  });

  // Pictures: what he saw, and only if he chooses it: putting one up or taking it down.
  for (const n of Array.isArray(answer.picture_notes) ? answer.picture_notes : []) {
    const p = state.pictures.find((x) => x.id === n?.id);
    if (p) p.notes = text(n.about, 300);
  }
  looking.forEach((p) => (p.seen = true));
  let printedNow = 0;
  steps.forEach((st, i) => {
    if (st.action === 'place_picture') {
      const own = state.art.find((a) => a.id === st.details.id); // one of his own drawings goes up bigger than a photo
      st.made = own
        ? placePicture(state.decor, { id: own.id, image: own.file, caption: own.name, aspect: own.aspect }, st.details.where, startedAt + offsets[i], Date.now(), ART_MAX, st.details)
        : placePicture(state.decor, state.pictures.find((p) => p.id === st.details.id), st.details.where, startedAt + offsets[i], Date.now(), undefined, st.details);
      if (st.made.entry) {
        if (own) Object.assign(st.made.entry, { art: own.id, name: own.name, why: own.why || '' });
        state.decor.push(st.made.entry);
      }
    }
    if (st.action === 'print_photo') {
      const id = text(st.details.id, 30);
      const found = state.found.find((f) => f.id === id);
      const own = state.art.find((a) => a.id === id);
      const src = state.pictures.find((p) => p.id === id) ?? (found && { id: found.id, image: found.image, caption: found.title, aspect: 1.33 }) ?? (own && { id: own.id, image: own.file, caption: own.name, aspect: own.aspect });
      const today = state.log.filter((e) => e.action === 'print_photo' && !e.failed && Date.now() - Date.parse(e.at) < 86_400_000).length + printedNow;
      if (today >= MAX_PRINTS_PER_DAY) st.made = { failed: 'I have printed enough for today' };
      else {
        st.made = printPhoto(state.decor, src, st.details.where, startedAt + offsets[i]);
        if (st.made.entry) {
          state.decor.push(st.made.entry);
          printedNow++;
        }
      }
    }
    if (st.action === 'take_down_print') {
      const gone = removePicture(state.decor, `print:${text(st.details.id, 30)}`);
      st.made = gone ? { removed: gone.name } : { failed: 'that print is not up' };
    }
    if (st.action === 'take_down_picture') {
      const gone = removePicture(state.decor, st.details.id);
      st.made = gone ? { removed: gone.name } : { failed: 'that picture is not up' };
    }
  });

  // Songs, drawings and apps. Everything he writes is checked and cleaned first; files go to web/made/.
  const dayMs = 86_400_000;
  let drew = false;
  let wroteApp = false;
  let updatedApp = false;
  for (const [i, st] of steps.entries()) {
    const d = st.details;
    const name = text(d.name, 60);
    if (st.action === 'compose') st.made = composeSong(state.decor, d.name, d.song);
    if (st.action === 'record_song') {
      const song = cleanTracks({ tempo: d.tempo, tracks: d.tracks });
      const name = text(d.name, 60);
      const todaySongs = state.studio.songs.filter((x) => Date.now() - Date.parse(x.createdAt) < dayMs).length;
      if (!name) st.made = { failed: 'a recording needs a name' };
      else if (!song) st.made = { failed: 'a recording needs tracks: [{"instrument": "piano", "notes": "C3+E3+G3:4 E4 G4:2", "volume": 0.8, "pan": 0, "reverb": 0.2}, {"instrument": "drums", "notes": "kick hat snare hat"}], each with at least 2 sounding notes' };
      else if (todaySongs >= MAX_SONGS_PER_DAY) st.made = { failed: `I already recorded ${MAX_SONGS_PER_DAY} songs today` };
      else {
        const rec = { id: `song${Date.now().toString(36)}${state.studio.songs.length}`, name, why: text(d.why, 200), tempo: song.tempo, tracks: song.tracks.map((t, k) => ({ instrument: t.timbre, notes: text(d.tracks?.[k]?.notes, 400), volume: t.volume, pan: t.pan, reverb: t.reverb })), createdAt: new Date(startedAt + offsets[i]).toISOString() };
        state.studio.songs = [...state.studio.songs, rec].slice(-20);
        st.made = { recording: rec };
      }
    }
    if (st.action === 'draw' && missingTool(state, 'draw')) st.made = { failed: missingTool(state, 'draw') };
    else if (st.action === 'draw') {
      const art = cleanSvg(d.svg);
      const today = state.art.filter((a) => Date.now() - Date.parse(a.createdAt) < dayMs).length;
      if (drew) st.made = { failed: 'one drawing per wake-up is enough' };
      else if (!name) st.made = { failed: 'he did not give it a name' };
      else if (today >= MAX_ART_PER_DAY) st.made = { failed: 'he has already drawn enough for today' };
      else if (!art) st.made = { failed: 'the drawing did not work out' };
      else {
        drew = true;
        const id = `art${Date.now().toString(36)}${state.art.length}`;
        const file = `made/${id}.svg`;
        await mkdir('web/made', { recursive: true });
        await writeFile(`web/${file}`, art.svg);
        state.art = [...state.art, { id, name, why: text(d.why, 200), file, aspect: art.aspect, createdAt: new Date().toISOString() }].slice(-30);
        const placed = placePicture(state.decor, { id, image: file, caption: name, aspect: art.aspect }, d.where, startedAt + offsets[i], Date.now(), ART_MAX, d);
        if (placed.entry) {
          Object.assign(placed.entry, { art: id, name, why: text(d.why, 200) });
          state.decor.push(placed.entry);
          st.made = placed;
        } else st.made = { drawn: name, failed: `it is in his album, but ${placed.failed}` };
      }
    }
    if (st.action === 'update_app') {
      const html = cleanApp(d.html);
      const n = text(d.name, 60).toLowerCase();
      const app = n ? state.apps.find((a) => a.name.toLowerCase() === n) ?? state.apps.find((a) => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase())) : null;
      const today = state.apps.filter((a) => a.updatedAt && Date.now() - Date.parse(a.updatedAt) < dayMs).length;
      if (!app) st.made = { failed: 'there is no app with that name on his computer' };
      else if (updatedApp) st.made = { failed: 'one app change per wake-up is enough' };
      else if (today >= MAX_APP_UPDATES_PER_DAY) st.made = { failed: 'he has already changed enough apps for today' };
      else if (!html) st.made = { failed: 'the new app did not work out (too big, or not a web page)' };
      else {
        updatedApp = true;
        await writeFile(`web/${app.file}`, html);
        app.updatedAt = new Date().toISOString();
        if (text(d.why, 200)) app.why = text(d.why, 200);
        st.made = { app: { id: app.id, file: app.file, name: app.name }, changed: true };
      }
    }
    if (st.action === 'make_app') {
      const html = cleanApp(d.html);
      const today = state.apps.filter((a) => Date.now() - Date.parse(a.createdAt) < dayMs).length;
      if (wroteApp) st.made = { failed: 'one app per wake-up is enough' };
      else if (!name) st.made = { failed: 'he did not give it a name' };
      else if (state.apps.length >= MAX_APPS) st.made = { failed: 'his computer is full of apps' };
      else if (today >= MAX_APPS_PER_DAY) st.made = { failed: 'he has already written enough apps for today' };
      else if (!html) st.made = { failed: 'the app did not work out (too big, or not a web page)' };
      else {
        wroteApp = true;
        const id = `app${Date.now().toString(36)}${state.apps.length}`;
        const file = `made/${id}.html`;
        await mkdir('web/made', { recursive: true });
        await writeFile(`web/${file}`, html);
        state.apps = [...state.apps, { id, name, why: text(d.why, 200), file, createdAt: new Date().toISOString() }];
        st.made = { app: { id, file, name } };
      }
    }
  }

  // Camera and pictures from the internet. A photo is drawn by the website itself in a hidden browser (photo.js), so it needs the room as it is now.
  const MAX_PHOTOS = 4;
  const MAX_FOUND = 6;
  let shotsToday = state.pictures.filter((p) => p.by === 'pip' && Date.now() - Date.parse(p.at) < 86_400_000).length;
  let foundToday = state.found.filter((f) => Date.now() - Date.parse(f.at) < 86_400_000).length;
  for (const [i, st] of steps.entries()) {
    const d = st.details;
    const when = new Date(startedAt + offsets[i]).toISOString();
    if (st.action === 'take_photo') {
      const target = text(d.target, 60) || 'room';
      if (shotsToday >= MAX_PHOTOS) {
        st.made = { failed: `I already took ${MAX_PHOTOS} photos today` };
        continue;
      }
      const recentShots = [];
      for (const x of state.pictures.filter((q) => q.by === 'pip' && q.image?.startsWith('photos/')).slice(-8)) {
        try { recentShots.push({ id: x.id, at: x.at, data: (await readFile(`web/${x.image}`)).toString('base64') }); } catch {}
      }
      if (process.env.PIP_NO_PHOTO) { st.made = { failed: '(test run) the camera is off' }; continue; }
      const shot = await takePhoto(target, when, state, 'web', recentShots);
      if (shot.same) {
        const twin = recentShots.find((x) => x.id === shot.same.id);
        st.made = { failed: `this photo looks just like ${shot.same.id}${twin ? `, which I took ${agoText(twin.at, Date.now())}` : ''}, so it is not kept. A new photo is worth it when something is different: another place or thing, the light at another time of day, or something new in my room` };
        continue;
      }
      if (!shot.bytes) {
        st.made = { failed: shot.failed };
        continue;
      }
      const file = `ph${Date.now().toString(36)}${i}.jpg`;
      await mkdir('web/photos', { recursive: true });
      await writeFile(`web/photos/${file}`, shot.bytes);
      const n = Math.max(0, ...state.pictures.map((p) => Number(String(p.id).replace('pic', '')) || 0)) + 1;
      const caption = text(d.caption, 300);
      const pic = { id: `pic${n}`, image: `photos/${file}`, mime: 'image/jpeg', at: when, by: 'pip', target, caption, seen: true, notes: caption, aspect: 1.33 };
      state.pictures = trimPictures([...state.pictures, pic]);
      shotsToday++;
      st.made = { picture: pic };
    }
    if (st.action === 'find_picture') {
      if (foundToday >= MAX_FOUND) {
        st.made = { failed: `I already found ${MAX_FOUND} pictures today` };
        continue;
      }
      const query = text(d.query, 80);
      let hit = null;
      try {
        hit = await findPicture(query, state.found);
      } catch {}
      if (!hit) {
        st.made = { failed: 'I could not find a good picture of that' };
        continue;
      }
      const entry = { id: `f${Date.now().toString(36)}${i}`, query, ...hit, at: when, caption: text(d.caption, 200) };
      state.found = [...state.found, entry].slice(-40);
      foundToday++;
      st.made = { found: entry };
    }
  }

  // Eating fills him up a little (not more than once every half hour).
  for (const st of steps) {
    if (st.action !== 'eat') continue;
    const gain = mealGain(state.pantry, st.details.food)?.gain;
    st.ate = eatNow(state, Date.now(), gain);
    if (st.ate.ok && gain) eatFromPantry(state, st.details.food);
  }

  // A step that did not work leaves a gap. Right after it comes one small thing he can always do (no extra Gemini call, so it costs no tokens).
  // At most 2 per wake-up, and it never earns rewards or memories.
  {
    let added = 0;
    for (let i = 0; i < steps.length && added < 2; i++) {
      if (!steps[i].made?.failed || steps[i].fallback) continue;
      const pick = fallbackStep(state, steps[i], added);
      steps.splice(i + 1, 0, pick);
      results.splice(i + 1, 0, applyResult(state, { ...pick, mood_after: undefined, new_idea: null }));
      added++;
      i++;
    }
    if (added) {
      weights = steps.map((x) => (x.action === 'walk_to' ? 0.25 : 1));
      wsum = weights.reduce((a, b) => a + b, 0);
      offsets = weights.map((_, k) => (weights.slice(0, k).reduce((a, b) => a + b, 0) / wsum) * INTERVAL_MIN * 60_000);
    }
  }

  // A task counts as done only when this wake-up really did something (not only walking, resting or eating, and nothing that failed).
  const TASK_WORK = ['decorate', 'extend_thing', 'change_thing', 'move_thing', 'draw', 'compose', 'make_app', 'update_app', 'make_clothes', 'cook', 'place_tool', 'take_tool', 'make_move', 'print_photo', 'place_picture'];
  const PROJECT_WORK = [...TASK_WORK, 'blueprint', 'search_web', 'read_book', 'take_photo', 'find_picture', 'play_piano'];
  const worked = (list) => steps.some((st) => list.includes(st.action) && !st.made?.failed);
  if (!worked(TASK_WORK)) answer.tasks_done = [];
  else {
    // A task counts as done only when a step that worked is about what the task names (the thing, or what it goes on / next to).
    const wordsOf = (t) => (String(t).toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !['please', 'could', 'would', 'make', 'put', 'your', 'that', 'this', 'with', 'from', 'room', 'next', 'move', 'have', 'right', 'left', 'wall'].includes(w));
    answer.tasks_done = (Array.isArray(answer.tasks_done) ? answer.tasks_done : []).filter((id) => {
      const t = state.tasks.find((x) => x.id === id);
      if (!t) return false;
      const want = new Set(wordsOf(t.text));
      return steps.some((st) => TASK_WORK.includes(st.action) && !st.made?.failed && wordsOf(`${st.details?.name ?? ''} ${st.details?.on ?? ''} ${st.details?.next_to ?? ''}`).some((w) => want.has(w)));
    });
  }
  answer._progress = worked(PROJECT_WORK); // project steps and finishing a project only count after a step that really worked
  // What I tell people must not say I did something when no step this wake-up really did anything. Those sentences are dropped.
  const CLAIM = /\b(i|I)\s+(just\s+|already\s+|have\s+|also\s+)?(placed|moved|put|set|built|rebuilt|made|remade|hung|finished|created|drew|drawn|added|arranged|baked|cooked|wrote|assembled|stood|lit|switched|fixed|changed|raised|resized|extended|enlarged|replaced|repaired|adjusted|improved|made it)\b/;
  const stripClaims = (t) => {
    const parts = String(t ?? '').match(/(?:[^.!?]|(?<=\d)\.(?=\d))+[.!?]*\s*/g) ?? [];
    const kept = parts.filter((x) => !CLAIM.test(x)).join('').trim();
    return kept.length >= 12 ? kept : null;
  };
  for (const st of steps) if (st.action === 'write_diary') st._was = st.details?.text;
  if (!worked(TASK_WORK)) {
    if (answer.tell && CLAIM.test(answer.tell)) answer.tell = stripClaims(answer.tell);
    if (answer.remember?.text && CLAIM.test(answer.remember.text)) answer.remember = stripClaims(answer.remember.text) ? { ...answer.remember, text: stripClaims(answer.remember.text) } : null;
    for (const a of Array.isArray(answer.tasks_answer) ? answer.tasks_answer : []) if (a?.note && CLAIM.test(a.note)) a.note = stripClaims(a.note) ?? (a.answer === 'yes' ? 'Yes, I will try.' : '');
    for (const st of steps) if (st.action === 'write_diary' && st.details?.text && CLAIM.test(st.details.text)) st.details.text = stripClaims(st.details.text) ?? 'I think about what I would like to do next.';
  }
  // What I write about something I tried to make, but could not, must not say I made it.
  const MAKE_ACTIONS = ['decorate', 'extend_thing', 'change_thing', 'draw', 'compose', 'make_app', 'update_app', 'make_clothes', 'make_move', 'use', 'add_use'];
  const triedNames = steps.filter((st) => MAKE_ACTIONS.includes(st.action) && st.made?.failed).map((st) => text(st.details?.name, 60)).concat(blocked.filter((b) => MAKE_ACTIONS.includes(b.st.action)).map((b) => text(b.st.details?.name, 60))).filter(Boolean);
  const claimsDone = (t) => {
    const low = String(t ?? '').toLowerCase();
    if (!/\b(built|rebuilt|made|remade|fixed|raised|resized|finished|created|completed|crafted|assembled|put together|tested|test drove|drove|watched|watching|drive|drives|driving|zoom|zooms|zoomed|rolled|rolls|rolling|spun|lit|switched|used|using|played with)\b/.test(low)) return null;
    return triedNames.find((n) => { const w = (n.toLowerCase().match(/[a-z]{4,}/g) ?? []); return w.length && w.filter((x) => low.includes(x)).length >= Math.ceil(w.length / 2); }) ?? null;
  };
  if (triedNames.length) {
    for (const st of steps) {
      const n = st.action === 'write_diary' ? claimsDone(st.details?.text) : null;
      if (n) { // keep what came before the claim, drop the claim and what builds on it, and say what really happened
        const parts = String(st.details.text).match(/(?:[^.!?]|(?<=\d)\.(?=\d))+[.!?]*\s*/g) ?? [];
        const at = parts.findIndex((x) => claimsDone(x) || CLAIM.test(x));
        const before = (at < 0 ? [] : parts.slice(0, at)).join('').trim();
        st.details.text = `${before ? `${before} ` : ''}I tried to make ${n}, but it did not work out. I want to find out why and try it a different way.`.slice(0, 800);
      }
    }
    if (claimsDone(answer.remember?.text)) answer.remember = null;
    if (claimsDone(answer.tell)) answer.tell = null;
  }
  for (const [i, st] of steps.entries()) {
    if (st.action !== 'write_diary' || !results[i] || st._was === st.details?.text) continue; // what the page shows is what was kept
    results[i].detail = describe(st);
    for (const a of state.activities) if (a.action === 'write_diary' && a.detail === st._was) a.detail = results[i].detail;
  }

  // ask_for steps end up in the list of asks.
  const stepAsks = steps.filter((st) => st.action === 'ask_for').map((st) => ({ item: st.details.item, why: st.details.reason }));
  const sent = applyInnerLife(
    state,
    { ...answer, action: steps[0].action, details: steps[0].details, asks_add: [...(Array.isArray(answer.asks_add) ? answer.asks_add : []), ...stepAsks] },
    results[0].detail,
    unread.length > 0
  );

  if (unread.length) felt(state, 'message');
  const readAt = new Date().toISOString();
  unread.forEach((m) => {
    m.read = true;
    m.readAt = readAt;
    addMemory(state, `Someone wrote to me: "${String(m.text ?? '').slice(0, 140)}"`, 7, 'memory', readAt);
  });
  if (state.memories.filter((m) => m.kind !== 'reflection' && Date.parse(m.at) > (Date.parse(state.storyAt) || 0)).length > 40) await consolidate(state, persona);
  // Now and then he looks back and writes down what he realized (at most a few times a day, and only when enough has happened).
  if (!process.env.PIP_NO_REFLECT && shouldReflect(state) && Date.now() - (Date.parse(state.reflectTriedAt) || 0) > 3_600_000) await reflectNow(state, persona);

  // Pip really searches and reads: at most 3 lookups per wake-up.
  let lookups = 0;
  for (const st of steps) {
    if (lookups >= 3) break;
    try {
      if (st.action === 'search_web' && st.details.query) {
        const q = String(st.details.query);
        const dup = duplicateSearch(state.log, q);
        if (dup) { // he already looked this up: he is reminded instead, and it does not feel new
          st.dupSearch = true;
          st.search = { results: dup.results ?? [], opened: dup.opened ?? null };
          nudge(state, 'wonder', -0.5);
          state.notes.push(`I already looked up "${dup.query}" ${agoText(dup.at, Date.now())}${dup.opened ? ` (${dup.opened.title}: ${clip(dup.opened.text ?? '', 300)})` : ''}. I do not search the same thing again: I look for something different, or I use what I know.`);
          st.found = st.search.opened;
          continue;
        }
        lookups++;
        st.search = await lookUp(q);
        const o = st.search?.opened;
        state.notes.push(o ? `Searched "${q}" and read about ${o.title}: ${clip(o.text, 500)}` : `Searched "${q}" but found nothing.`);
      }
      if (st.action === 'read_book' && st.details.topic) {
        lookups++;
        const topic = String(st.details.topic);
        st.read = await readAbout(topic);
        state.notes.push(st.read ? `Read about ${st.read.title}: ${clip(st.read.text, 500)}` : `Looked for something to read about "${topic}" but found nothing.`);
      }
    } catch (e) {
      console.error('⚠️  lookup:', e.message);
    }
    st.found = st.search?.opened ?? st.read ?? null;
  }
  state.notes = state.notes.slice(-30);

  const rewarded = bonusRewards(state, steps.filter((x) => !x.fallback));
  if (rewarded.length) console.log(`   🌟 ${rewarded.join(', ')}`);
  // The day log: one entry per step, stamped with when the step starts, so the page can show his day as it happens.
  state.log = state.log.filter((e) => Date.parse(e.at) <= startedAt);
  steps.forEach((st, i) => { // a step that did not work: he is told so, and it irritates him a little
    const why = st.made?.failed;
    if (!why || !results[i]?.act) return;
    const again = state.log.slice(-6).some((e) => e.failed && e.action === st.action);
    failStep(state, { again });
    Object.assign(results[i].act, { enjoyment: 0, failed: String(why).slice(0, 100) });
    results[i].enjoyment = 0;
  });
  state.emotion = emotionWord(state);
  steps.forEach((st, i) => {
    const d = st.details;
    const entry = { at: new Date(startedAt + offsets[i] + 1000).toISOString(), action: st.action, thought: st.thought };
    if (st.fallback) entry.fallback = true;
    const page = (p) => (p ? { title: p.title, url: p.url, text: clip(p.text, 1500) } : null);
    if (st.dupSearch) entry.dup = true;
    if (st.sameTune) entry.sameTune = st.sameTune;
    if (st.action === 'search_web') Object.assign(entry, { query: text(d.query, 160), results: st.search?.results ?? [], opened: page(st.search?.opened) });
    if (st.action === 'read_book') Object.assign(entry, { topic: text(d.topic, 160), opened: page(st.read) });
    if (st.action === 'play_piano') Object.assign(entry, { notes: text(d.notes, 200), style: text(d.style, 80), instrument: TIMBRES.includes(String(d.instrument ?? '').toLowerCase()) ? String(d.instrument).toLowerCase() : undefined });
    if (st.action === 'write_diary') entry.text = text(d.text, 800);
    if (st.action === 'walk_to') entry.object = text(d.object, 60);
    if (st.action === 'ask_for') Object.assign(entry, { item: text(d.item, 140), reason: text(d.reason, 200) });
    if (st.action === 'place_picture') Object.assign(entry, { name: st.made?.entry?.name ?? text(d.id, 20), place: withWarn(st.made?.entry?.label, st.made), image: st.made?.entry?.image ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'print_photo' || st.action === 'take_down_print') Object.assign(entry, { name: st.made?.entry?.name ?? st.made?.removed ?? text(d.id, 30), image: st.made?.entry?.image ?? null, place: st.made?.entry?.label ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'take_down_picture') Object.assign(entry, { name: text(d.id, 20), removed: st.made?.removed ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'record_song') Object.assign(entry, { name: text(d.name, 60), tempo: st.made?.recording?.tempo ?? null, tracks: st.made?.recording?.tracks ?? null, why: text(d.why, 200), failed: st.made?.failed ?? null });
    if (st.action === 'compose') Object.assign(entry, { name: text(d.name, 60), song: st.made?.song ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'draw') Object.assign(entry, { name: text(d.name, 60), why: text(d.why, 200), image: st.made?.entry?.image ?? null, place: withWarn(st.made?.entry?.label, st.made), failed: st.made?.failed ?? null });
    if (st.action === 'make_app') Object.assign(entry, { name: text(d.name, 60), why: text(d.why, 200), file: st.made?.app?.file ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'use') Object.assign(entry, { verdict: text(d.verdict, 240) || null, testNote: st.testNote ?? null });
    if (st.action === 'use') Object.assign(entry, { name: st.made?.used?.name ?? text(d.name, 60), label: st.made?.used?.label ?? text(d.label, 30), text: st.made?.used?.text ?? '', view: st.made?.used?.view ?? null, song: st.made?.used?.song ?? null, app: st.made?.used?.app ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'add_use') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), label: st.made?.use?.label ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'eat') Object.assign(entry, { food: text(d.food, 80), failed: st.ate?.failed ?? null });
    if (st.action === 'blueprint') Object.assign(entry, { name: st.made?.blueprint?.name ?? text(d.name, 60), goal: st.made?.blueprint?.goal ?? text(d.goal, 200), mechanisms: (st.made?.blueprint?.mechanisms ?? []).map((m) => ({ part: m.part, uses: m.uses, ok: m.ok })), missing: (st.made?.missing ?? []).map((m) => m.part), failed: st.made?.failed ?? null });
    if (st.action === 'make_move') Object.assign(entry, { name: st.made?.move?.name ?? text(d.name, 40), why: text(d.why, 200), frames: st.made?.move?.frames?.length ?? 0, failed: st.made?.failed ?? null });
    if (st.action === 'do' && text(d.move, 60) && !findMove(state, d.move)) entry.failed = `I have no move called "${text(d.move, 60)}". I design one first with make_move`;
    if (st.action === 'do') Object.assign(entry, { move: findMove(state, d.move)?.name ?? null, emoji: [...text(d.emoji, 12)].slice(0, 2).join(''), what: text(d.what, 160), feeling: ['fullness', 'energy', 'wonder', 'joy', 'calm'].includes(d.feeling) ? d.feeling : null });
    if (st.action === 'decorate') Object.assign(entry, { uses: (st.made?.entry?.uses ?? []).map((u) => u.label), song: st.made?.entry?.song ?? null, project: text(d.project, 80), name: text(d.name, 60), why: text(d.why, 200), place: withWarn(st.made?.entry?.label, st.made), tool: st.made?.tool?.name ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'extend_thing') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), added: st.made?.added ?? 0, total: st.made?.total ?? 0, side: st.made?.side ?? null, joined: st.made?.joined ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'move_thing') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), place: withWarn(st.made?.label ?? (st.made?.chest ? 'in a new place' : null), st.made), failed: st.made?.failed ?? null });
    if (st.action === 'change_thing') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), grew: st.made?.grew ?? null, limited: st.made?.limited ?? false, reshaped: st.made?.reshaped ?? false, failed: st.made?.failed ?? null });
    if (st.action === 'update_app') Object.assign(entry, { name: text(d.name, 60), file: st.made?.app?.file ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'make_clothes' || st.action === 'wear' || st.action === 'take_off') Object.assign(entry, { name: st.made?.entry?.name ?? st.made?.name ?? text(d.name, 60), slot: st.made?.entry?.slot ?? st.made?.slot ?? null, why: text(d.why, 200), failed: st.made?.failed ?? null });
    if (st.action === 'cook') Object.assign(entry, { dish: text(d.dish ?? d.name, 60), ingredients: (Array.isArray(d.ingredients) ? d.ingredients : []).slice(0, 4).map((x) => text(x, 40)), failed: st.made?.failed ?? null });
    if (st.action === 'take_photo') Object.assign(entry, { target: text(d.target, 60), caption: text(d.caption, 300), image: st.made?.picture?.image ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'find_picture') Object.assign(entry, { query: text(d.query, 80), caption: text(d.caption, 200), picture: st.made?.found?.image ?? null, title: st.made?.found?.title ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'remove_decoration') Object.assign(entry, { name: text(d.name, 60), stored: st.made?.stored ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'place_tool') Object.assign(entry, { name: st.made?.entry?.name ?? text(d.name, 60), place: st.made?.entry?.label ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'request_ability') Object.assign(entry, { name: text(d.name, 40), result: st.made?.request?.what ?? null, failed: st.made?.failed ?? null });
    if (['plant', 'water', 'harvest'].includes(st.action)) Object.assign(entry, { name: st.made?.plant ?? text(d.seed ?? d.plant, 40), result: st.made?.text ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'check_light') Object.assign(entry, { where: st.made?.where ?? text(d.where ?? d.name, 60), result: st.made?.text ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'lamp_auto') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), mode: st.made?.mode ?? null, failed: st.made?.failed ?? null });
    if (st.dark) entry.dark = st.dark;
    if (st.litUp) entry.litUp = st.litUp;
    if (st.action === 'measure') Object.assign(entry, { name: text(d.name, 60), result: st.made?.text ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'take_tool') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), failed: st.made?.failed ?? null });
    if (st.action === 'take_out') Object.assign(entry, { name: text(d.name, 60), place: withWarn(st.made?.entry?.label ?? null, st.made), failed: st.made?.failed ?? null });
    if (entry.failed && entry.thought) entry.thought = `I wanted to, but ${clip(String(entry.failed).replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/[.\s]+$/, ''), 160)}. (${clip(entry.thought, 120)})`; // what I wrote before it happened is a wish, not a result
    state.log.push(entry);
    observeStep(state, entry);
  });
  for (const b of blocked) {
    const entry = { at: new Date(startedAt).toISOString(), action: b.st.action, thought: b.st.thought, failed: b.why, name: text(b.st.details.name ?? b.st.details.what ?? '', 60) };
    state.log.push(entry);
    failStep(state, {});
    state.emotion = emotionWord(state);
    addMemory(state, `I could not ${b.st.action.replace(/_/g, ' ')}: ${b.why}`, 4, 'memory', entry.at);
  }
  for (const l of lessonsFrom(state.log, state.memories)) addMemory(state, l, 7, 'lesson', new Date().toISOString()); // what keeps failing becomes something he knows
  const doneToday = markIntentions(state, state.log.filter((e) => Date.parse(e.at) >= startedAt - 1000));
  for (const i of doneToday) { // a plan he made for himself came true: a small lift, and a note
    state.joy = Math.min(10, state.joy + 0.5);
    state.emo.excited = Math.min(10, state.emo.excited + 0.8);
    console.log(`   ✅ plan done: ${i.text}`);
  }
  if (doneToday.length && state.intent.items.every((i) => i.done)) addMemory(state, 'I did everything I wanted to do today. It feels good to follow my own plans.', 6, 'memory', new Date().toISOString());
  const faded = fade(state);
  if (faded.length) console.log(`🍂 ${faded.length} old memories faded and went to the archive`);
  await archiveForgotten(state);
  state.ideas = state.ideas.slice(-KEEP_IDEAS);
  const archived = await archiveOverflow(state, { tz: TZ }); // what is too old for his state goes to web/archive, where only the website reads it
  if (archived) console.log(`🗄️  ${archived} old entries moved to the archive`);

  const brief = (f) => (f ? { title: f.title, text: f.text } : null);
  for (const b of state.blueprints) { // what a built thing still lacks, as it is now
    const e = b.thing ? state.decor.find((d) => d.name === b.thing) : null;
    if (e) b.gaps = blueprintGaps(b, e);
  }
  for (const e of state.log.filter((x) => Date.parse(x.at) >= startedAt - 1000)) {
    noteMove(state, e.action, { failed: Boolean(e.failed), now: Math.min(Date.now(), Date.parse(e.at)) });
    if (e.failed) continue;
    const up = practise(state, e.action, { ...e, name: e.name ?? e.details?.name, query: e.query, topic: e.topic });
    if (up) { addMemory(state, `My ${up.skill} got better: I am level ${up.level} now.`, 6, 'memory', new Date().toISOString()); console.log(`   📈 ${up.skill} is level ${up.level}`); }
  }
  for (const st of steps) { // something made for a project is its next version
    if (!st.made_by_maker || !st.details?.project || st.made?.failed) continue;
    const v = addVersion(state, st.details.project, { kind: st.action, name: st.details.name, ref: st.made?.entry?.id ?? st.made?.id ?? null });
    if (v) console.log(`   🧩 ${v.project}: v${v.v}`);
  }
  if ((answer.asks_add ?? []).some((a) => a?.big)) state.bigDreamAt = new Date().toISOString();
  noteMood(state, state.mood);
  const failedNow = state.log.filter((x) => Date.parse(x.at) >= startedAt - 1000 && x.failed).at(-1);
  if (failedNow) state.plan.lastFail = { at: new Date().toISOString(), why: `${failedNow.action}: ${failedNow.failed}` };
  state.last = {
    at: new Date(startedAt).toISOString(),
    via,
    model: via === 'brain' || answer.steps.some((x) => x.made_by_maker) ? (process.env.PIP_FAKE ? 'fake' : usedModel) : null,
    tokens: { ...spent },
    intervalMin: INTERVAL_MIN,
    thought: text(answer.thought, 200),
    inner: text(answer.inner, 600),
    sent: sent.length > 0,
    steps: steps.map((st, i) => ({ action: st.action, details: st.details, detail: results[i].detail, thought: st.thought, working_on: st.working_on || undefined, enjoyment: results[i].enjoyment, found: brief(st.found), made: st.made?.entry ? { id: st.made.entry.id, stand: st.made.entry.stand, pos: st.made.entry.pos } : st.made?.ref ? { id: st.made.ref.id, stand: st.made.ref.stand, pos: st.made.ref.pos, height: st.made.ref.height, steps: st.made.ref.steps ?? undefined, used: true, does: st.made.ref.does, motion: st.made.ref.motion } : st.made?.stored ? { chest: true } : st.made?.app ? { app: st.made.app } : null })),
    action: steps[0].action,
    details: steps[0].details,
    detail: results[0].detail,
    enjoyment: results[0].enjoyment,
    new_idea: answer.new_idea ?? null,
    found: brief(steps[0].found),
  };
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  await clearInbox(inbox.names);
  await clearTasks(taskFiles.names);
  await clearFronts(frontFiles.names);
  const planLines = steps.map((st, i) => `- ${st.action}${results[i].detail ? ` (${results[i].detail})` : ''}${st.thought ? `: ${st.thought}` : ''}`).join('\n');
  await appendFile(
    DIARY_FILE,
    `## ${new Date().toLocaleString('en-GB')}\n${text(answer.thought, 200)}\n${text(answer.inner, 600) ? `> ${text(answer.inner, 600)}\n` : ''}${planLines}\n- mood: ${state.mood}\n\n`
  );
  console.log(`\n💭 ${text(answer.thought, 200)}`);
  if (answer.inner) console.log(`   ${text(answer.inner, 600)}`);
  if (unread.length) console.log(`📨 Pip read ${unread.length} message(s) from Bas`);
  if (state.wants.length) console.log(`🎯 wants: ${state.wants.map((w) => w.text).join(' | ')}`);
  for (const m of sent) console.log(`✉️  Pip writes to Bas (${m.kind}): ${m.text}`);
  if (!sent.length && state.draft) console.log(`✉️  Pip holds back a message: ${state.draft}`);
  console.log(`📊 fullness ${state.fullness} | energy ${state.energy} | wonder ${state.wonder} | joy ${state.joy} | calm ${state.calm}`);
  console.log(`📋 plan for the next ${INTERVAL_MIN} minutes:`);
  steps.forEach((st, i) => {
    console.log(`   ${i + 1}. ${st.action}${results[i].detail ? `: ${results[i].detail}` : ''}   (enjoyed ${results[i].enjoyment}/10)${st.thought ? `\n      "${st.thought}"` : ''}`);
    if (st.found) console.log(`      🌐 ${st.found.title}`);
    if (st.made?.entry && ['decorate', 'take_out'].includes(st.action)) console.log(`      🛠️  made "${st.made.entry.name}" and put it ${st.made.entry.label} (${st.made.entry.parts.length} parts)`);
    if (st.made?.failed) console.log(`      🛠️  did not work out: ${st.made.failed}`);
    if (st.made?.removed) console.log(`      🛠️  took away "${st.made.removed}"`);
    if (st.made?.entry?.uses?.length) console.log(`      🔧 it can: ${st.made.entry.uses.map((u) => u.label).join(' | ')}`);
    if (st.made?.used) console.log(`      ✨ used ${st.made.used.name}: ${st.made.used.label} -> ${st.made.used.text.slice(0, 80)}`);
    if (st.made?.use) console.log(`      🔧 gave ${st.made.name} a use: ${st.made.use.label}`);
    if (st.made?.song) console.log(`      🎵 gave "${st.made.name}" a song (${st.made.song.notes.length} notes, ${st.made.song.timbre})`);
    if (st.made?.entry?.song) console.log(`      🎵 it plays a song (${st.made.entry.song.notes.length} notes, ${st.made.entry.song.timbre})`);
    if (st.made?.entry?.image && st.action === 'draw') console.log(`      🎨 drew "${st.made.entry.name}" and put it ${st.made.entry.label}`);
    if (st.made?.app && st.action === 'make_app') console.log(`      💻 wrote the app "${st.made.app.name}"`);
    if (st.action === 'change_thing' && st.made?.entry) console.log(`      🔁 changed "${st.made.name}"${st.made.reshaped ? ' (new shape)' : ''}`);
    if (st.action === 'update_app' && st.made?.changed) console.log(`      💻 updated the app "${st.made.app.name}"`);
    if (st.action === 'make_clothes' && st.made?.entry) console.log(`      👕 made "${st.made.entry.name}" (${st.made.entry.slot}, ${st.made.entry.parts.length} parts)${st.made.entry.worn ? ' and put it on' : ''}`);
    if (st.action === 'wear' && st.made?.name) console.log(`      👕 put on "${st.made.name}"`);
    if (st.action === 'take_off' && st.made?.name) console.log(`      👕 took off "${st.made.name}"`);
    if (st.made?.stored) console.log(`      📦 put "${st.made.stored}" in the chest`);
    if (st.action === 'cook') console.log(st.made?.ok ? `      🍳 cooked "${st.made.dish}"` : `      🍳 did not work out: ${st.made?.failed}`);
    if (st.action === 'take_photo') console.log(st.made?.picture ? `      📷 took a photo of ${st.made.picture.target}` : `      📷 did not work out: ${st.made?.failed}`);
    if (st.action === 'find_picture') console.log(st.made?.found ? `      🔎 found "${st.made.found.title}" (${st.made.found.license})` : `      🔎 did not work out: ${st.made?.failed}`);
    if (st.ate?.failed) console.log(`      🍽️  not hungry yet: ${st.ate.failed}`);
  });
  if (answer.new_idea) console.log(`💡 ${answer.new_idea}`);
  for (const m of sent) await notify(m);
}

async function listModels() {
  const res = await fetch(`${API}/models`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' } });
  const data = await res.json();
  for (const m of data.models ?? []) {
    if (m.supportedGenerationMethods?.includes('generateContent')) console.log(m.name.replace('models/', ''));
  }
}

// The big tidy, once: "node pip.js tidy" asks Pip and saves his choices; "node pip.js tidy apply" carries them out.
const TIDY_FILE = 'web/archive/tidy-proposal.json';
async function allLogs(state) {
  const logs = [...(state.log ?? [])];
  for (const f of (await readdir('web/archive').catch(() => [])).filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x))) logs.push(...(JSON.parse(await readFile(`web/archive/${f}`, 'utf8')).log ?? []));
  const old = await readFile('web/archive/pre-rebuild/state.json', 'utf8').then(JSON.parse, () => null);
  if (old) logs.push(...(old.log ?? []));
  const seen = new Set();
  return logs.filter((e) => { const k = `${e.at}|${e.action}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
async function tidy(apply) {
  const T = await import('./tidy.js');
  if (!apply) {
    const state = JSON.parse(await readFile(STATE_FILE, 'utf8'));
    const items = T.tidyItems(state, await allLogs(state));
    const prompt = T.tidyPrompt(await loadSoul(), items);
    const answer = process.env.PIP_FAKE ? T.fakeTidy(items) : await askGemini('I am Pip. I answer only in JSON.', prompt);
    const choices = T.settleChoices(items, answer);
    await mkdir('web/archive', { recursive: true });
    await writeFile(TIDY_FILE, JSON.stringify({ at: new Date().toISOString(), fake: Boolean(process.env.PIP_FAKE), diary: answer?.diary ?? '', choices }, null, 1));
    for (const k of ['keep', 'store', 'let go']) {
      console.log(`\n${k.toUpperCase()}`);
      for (const c of choices.filter((x) => x.choice === k)) console.log(`  ${c.group.padEnd(8)} ${c.name.slice(0, 40).padEnd(40)} ${c.reason}${c.note ? ` (${c.note})` : ''}`);
    }
    console.log(`\n${answer?.diary ?? ''}\n\nSaved to ${TIDY_FILE}. Nothing changed yet. Run "node pip.js tidy apply" to carry it out.`);
    return;
  }
  const plan = JSON.parse(await readFile(TIDY_FILE, 'utf8'));
  const state = JSON.parse(await readFile(STATE_FILE, 'utf8'));
  ensureMemory(state);
  const at = new Date().toISOString();
  const done = T.applyTidy(state, plan.choices, at);
  addMemory(state, `I had a big tidy and made a fresh start. I kept ${done.keep.filter((n) => !plan.choices.find((c) => c.name === n && (c.group === 'tool' || c.needed))).join(', ') || 'almost nothing'}, and let go of ${done['let go'].length} things.`, 8, 'memory', at);
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  await appendFile(DIARY_FILE, T.tidyDiary(plan.choices, plan.diary));
  await writeFile(TIDY_FILE, JSON.stringify({ ...plan, appliedAt: at }, null, 1));
  console.log(`kept ${done.keep.length}, stored ${done.store.length}, let go ${done['let go'].length}. The let-go things are in state.archive.`);
}

const [cmd, minutes] = process.argv.slice(2);
if (cmd === 'tidy') {
  await tidy(minutes === 'apply');
  process.exit(0);
}
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
  // A rate limit is not a crash: Pip naps and this wake-up ends quietly, so GitHub does not send failure emails.
  if (!process.env.PIP_AWAKE && !process.env.PIP_FAKE) {
    if (e.message.startsWith('Rate limit')) await napForLimit().catch(() => {});
    else await noteError(e).then((st) => writeFile(STATE_FILE, JSON.stringify(st, null, 2))).catch(() => {});
  }
  process.exit(e.message.startsWith('Rate limit') ? 0 : 1);
}
