import { readFile, writeFile, appendFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { FURNITURE, MOVABLE, furnRects } from './web/furniture.js';
import { archiveOverflow } from './archive.js';
import { ensureBehaviors, behaviorProblem } from './behaviors.js';
import { preflight, limitsText } from './limits.js';
import { ensureBlueprints, makeBlueprint, markBuilt, blueprintsText, capabilityGuide, blueprintDue, blueprintGaps } from './blueprints.js';
import { purposeProblem, purposeHint, setFronts, wallNotes, freeSides, rehangPictures, freePlaces, makeDecor, updateDecor, storeAway, takeOut, squareUp, cleanParts, placeTool, takeTool, composeSong, extendThing, sizeOf, placePicture, printPhoto, removePicture, moveThing, setChest, setFurniture, furnitureKey, roomMap, crowding, CHEST_HOME, ART_MAX, MAX_PER_DAY } from './decor.js';
import { cleanSvg, MAX_ART_PER_DAY } from './art.js';
import { cleanApp, MAX_APPS, MAX_APPS_PER_DAY } from './apps.js';
import { topicMirror, untriedMirror, themeFatigue } from './mirror.js';
import { ensureMoves, makeMove, findMove, movesText, movesGuide } from './moves.js';
import { measureThing, sizesGuide } from './sizes.js';
import { ensureTools, NEEDS, toolsText, toolsGuide, toolFor, missingTool, addTool, toolKind, toolLabel, fits, craftTool, MAX_TOOLS } from './tools.js';
import { ensureMemory, addMemory, recall, shouldReflect, reflectionPrompt, applyReflection } from './memory.js';
import { ensureIdentity, identityText, IDENTITY_FIELDS, applyIdentity } from './identity.js';
import { takePhoto } from './photo.js';
import { findPicture } from './found.js';
import { refillPantry, pantryText, cook, addIngredient, eatFromPantry, mealGain } from './food.js';
import { makeClothes, wear, takeOff, wornNow, SLOTS, MAX_CLOTHES_PER_DAY } from './clothes.js';
const MAX_APP_UPDATES_PER_DAY = 4;
import { pictureType, pictureSize, ntfyPoll, isFromBas, ntfyText, downloadAttachment } from './inbox.js';
import { refreshNews, themeMirror } from './news.js';
import { tooSimilar, sinceLastWrote } from './repeat.js';
import { ensureFeelings, passTime, stepFeelings, felt, nudge, eatNow, feelingsText, needsText } from './feelings.js';
import { cleanUses, findUse, addUse } from './uses.js';

const STATE_FILE = 'web/state.json';
const DIARY_FILE = 'diary.md';
// The better model first. When it is busy or out of free quota, the lighter one answers so he never misses a wake-up.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';
let usedModel = MODEL;
const spent = { calls: 0, input: 0, output: 0 }; // tokens used this wake-up, as Gemini counts them
const API = 'https://generativelanguage.googleapis.com/v1beta';

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
const ACTIONS = [
  'walk_to(object)',
  'do(what, feeling, move)',
  'make_move(name, why, duration, frames)',
  'blueprint(name, goal, research, mechanisms, tools)',
  'print_photo(id, where)',
  'take_down_print(id)',
  'play_piano(notes, style)',
  'read_book(topic)',
  'search_web(query)',
  'write_diary(text)',
  'rest()',
  'ask_for(item, reason)',
  'eat(food)',
  'decorate(name, where, why, parts)',
  'remove_decoration(name)',
  'take_out(name, where)',
  'place_tool(name, where)',
  'take_tool(name)',
  'measure(name)',
  'compose(name, song)',
  'draw(name, where, why, svg)',
  'make_app(name, why, html)',
  'use(name, label, verdict)',
  'add_use(name, use)',
  'change_thing(name, parts, why, bigger)',
  'move_thing(name, where, dx, dz, next_to, side)',
  'extend_thing(name, parts)',
  'update_app(name, html)',
  'make_clothes(name, slot, why, parts)',
  'wear(name)',
  'take_off(name)',
  'cook(dish, ingredients)',
  'take_photo(target, caption)',
  'find_picture(query, caption)',
];
// Only offered once Bas has given him a picture. What he does with it is always his own choice.
const PICTURE_ACTIONS = ['place_picture(id, wall, along, height)', 'take_down_picture(id)'];
const TASK_ACTIONS = ['decorate', 'extend_thing', 'change_thing', 'move_thing', 'draw', 'compose', 'make_app', 'update_app', 'make_clothes', 'cook', 'place_tool', 'take_tool', 'make_move', 'print_photo', 'place_picture', 'take_down_picture', 'remove_decoration', 'take_out', 'wear', 'add_use', 'blueprint']; // what can be work for a task
const ACTION_NAMES = ['walk_to', 'do', 'make_move', 'blueprint', 'move_thing', 'extend_thing', 'print_photo', 'take_down_print', 'play_piano', 'read_book', 'search_web', 'write_diary', 'rest', 'ask_for', 'eat', 'decorate', 'remove_decoration', 'take_out', 'place_tool', 'take_tool', 'measure', 'compose', 'draw', 'make_app', 'use', 'add_use', 'change_thing', 'update_app', 'make_clothes', 'wear', 'take_off', 'cook', 'take_photo', 'find_picture', 'place_picture', 'take_down_picture'];

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
// Curiosity should lead somewhere. If he mostly looks things up and rarely does or makes anything, he is told so.
function doingMirror(s) {
  const steps = s.log.filter((e) => Date.parse(e.at) <= Date.now()).slice(-20);
  if (steps.length < 12) return null;
  const looks = steps.filter((e) => ['search_web', 'read_book'].includes(e.action)).length;
  const idle = steps.filter((e) => ['walk_to', 'rest'].includes(e.action)).length;
  const doing = steps.length - looks - idle;
  if (doing * 4 > steps.length) return null;
  const last = [...steps].reverse().find((e) => ['search_web', 'read_book'].includes(e.action));
  const topic = last ? String(last.query || last.topic || '').slice(0, 60) : '';
  return `Of my last ${steps.length} activities, ${idle} were walking or resting, ${looks} were looking things up and only ${doing} were making or doing something. That is only a picture.${topic ? ` What I last looked up was "${topic}". People who learn something often like to DO something with it. I could draw it, build a small model of it, compose a song about it, take a photo of it at the window, cook something from it, write about it, or ask for something that belongs to it.` : ''}`;
}
// What he made today. Neutral numbers, never an order.
function dayTally(s) {
  const today = new Date().toDateString();
  const mine = s.log.filter((e) => new Date(e.at).toDateString() === today && Date.parse(e.at) <= Date.now());
  const made = mine.filter((e) => ['decorate', 'draw', 'compose', 'make_app', 'make_clothes', 'cook', 'take_photo', 'change_thing'].includes(e.action)).length;
  const tried = new Set(mine.map((e) => e.action).filter((a) => !['walk_to', 'rest', 'eat'].includes(a))).size;
  const lastMade = [...s.log].reverse().find((e) => ['decorate', 'draw', 'compose', 'make_app', 'make_clothes', 'cook', 'take_photo'].includes(e.action));
  return `MY DAY SO FAR\nToday I made or created ${made} thing${made === 1 ? '' : 's'} and did ${tried} different kind${tried === 1 ? '' : 's'} of activity. The last time I made something was ${lastMade ? ago(lastMade.at) : 'never'}. Making something and seeing it in my room is what fills me up the most.\n\n`;
}
function photosText(s) {
  const mine = s.pictures.filter((p) => p.by === 'pip' && Date.parse(p.at) <= Date.now()).slice(-6);
  const found = (s.found ?? []).slice(-6);
  return `${mine.length ? `MY PHOTOS (I took them with my camera. I can put one on a wall or a surface with place_picture, using its id)\n${mine.map((p) => `- ${p.id} (${ago(p.at)}) of ${p.target}: ${p.caption}${s.decor.some((d) => d.picture === p.id) ? ` | it is up: ${s.decor.find((d) => d.picture === p.id).label}` : ''}`).join('\n')}\n\n` : ''}${found.length ? `PICTURES I FOUND ONLINE (kept in my collection)\n${found.map((f) => `- ${f.id}: ${f.title} (I looked for "${f.query}", ${ago(f.at)})`).join('\n')}\n\n` : ''}`;
}
const MAX_WALL_PRINTS = 8;
function printsText(s) {
  const prints = s.decor.filter((d) => d.print);
  return prints.length ? `Prints I have up: ${prints.map((d) => `${String(d.picture).replace('print:', '')} (${d.name}, ${d.label})`).join('; ')}.\n` : 'I have not printed anything yet.\n';
}
// What he is busy with, as words: used to find the memories that matter now.
function focusText(s, unread = []) {
  const recent = s.log.filter((e) => Date.parse(e.at) <= Date.now()).slice(-4).map((e) => [e.query, e.topic, e.name, e.what, e.target, e.dish, e.item, e.caption].filter(Boolean).join(' '));
  return [...recent, ...s.tasks.filter((t) => ['open', 'accepted'].includes(t.status)).map((t) => t.text), ...unread.map((m) => m.text), ...s.wants.map((w) => w.text), ...s.questions.map((q) => q.text), ...s.projects.filter((p) => p.status === 'working').map((p) => `${p.title} ${p.next ?? ''}`)].join(' ');
}
// The things he does become memories, with a guess of how much they matter (he can add his own with "remember").
function observeStep(s, e) {
  if (e.failed) return;
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
    extend_thing: [`I added ${e.added} parts to ${e.name}, now ${e.total} parts`, 5],
    ask_for: [`I asked for ${e.item}${e.reason ? ` (${e.reason})` : ''}`, 5],
    do: [`${e.what}`, 4],
    write_diary: [`I wrote in my diary: ${String(e.text ?? '').slice(0, 120)}`, 3],
    play_piano: ['I played the piano', 3],
    search_web: [`I looked up ${e.query}`, 3],
    read_book: [`I read about ${e.topic}`, 3],
  }[e.action];
  if (note && note[0]) addMemory(s, note[0], note[1], 'memory', at);
}
function tasksText(s) {
  const open = s.tasks.filter((t) => t.status === 'open');
  const yes = s.tasks.filter((t) => t.status === 'accepted');
  if (!open.length && !yes.length) return '';
  const o = open.length
    ? `Someone asked me to do these. For each one I answer yes or no in tasks_answer, with a short note in my own words. A no is fine. If I say yes, I really do it, in my next plans.\n${open.map((t) => `- (id ${t.id}, ${ago(t.at)}) ${t.text}`).join('\n')}\n`
    : '';
  const y = yes.length
    ? `I said yes to these and have not finished them yet. I work on them in my plans, and when one is done I put its id in tasks_done, but only after a step that really did it (like change_thing, move_thing or decorate worked). A plan or a step that failed is not done.\n${yes.map((t) => `- (id ${t.id}, I said yes ${ago(t.answeredAt)}) ${t.text}`).join('\n')}\n`
    : '';
  return `THINGS I WAS ASKED TO DO\n${o}${y}\n`;
}
const sameText = (a, b) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
const withWarn = (place, made) => (place && made?.warn ? `${place} (careful: ${made.warn})` : place && made?.hint ? `${place} (${made.hint})` : place ?? null);
const bullets = (items, empty) => (items.length ? items.map((x) => `- ${x}`).join('\n') : empty);
// Pip may write to Bas at most once every 3 hours, so he only says what really matters.
const MIN_GAP_MINUTES = 180;
// One wake-up is one plan for this many minutes. The loop passes in its real interval.
const MAX_PRINTS_PER_DAY = 6; // photo printer
const INTERVAL_MIN = Number(process.env.PIP_INTERVAL_MIN || 12);

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
export const guide = () => `${capabilityGuide()}
${toolsGuide()}
${sizesGuide()}
${movesGuide()}
ASKING FOR THINGS
Whoever is looking at my room can read my asks list, and they like it when I ask for things. It is never a bother, and asking is part of my life here. Nobody can read my mind, so when I wish for something I cannot make or find myself, saying "it would be lovely" does nothing: I put it in asks_add and it lands on the list. Things I can ask for: something from the outside world (a picture, a song, a book, an object), a new ability, a tool, a bigger room, or help with a project. If someone offers me something and I want it, I say yes and add it too. They answer when they can. They may say no or do something else. That is fine, and I can always ask for something different.

CAMERA AND PICTURES\nI have a camera. With take_photo {target, caption} I take a picture of what I want: \"window\" (the view outside; it follows the real time of day), \"room\", \"myself\" (a selfie), a place like piano, bookshelf, computer, plant, bed, frame or chest, or the name of something I made. It is a picture of my little world. I take at most 4 a day, and anyone can see my photos on the Photos page. I can put one on a wall with place_picture {id, wall, along, height}: wall is left or back, along is where on that wall (x on the back wall, z on the left wall) and height is the middle of the picture, from the floor. It is my wall, so I decide where each picture hangs, and move_thing {name, wall, along, height} moves one later. If I leave the spot out, one is chosen for me in a row at eye height. It is nice to look up how to hang pictures well (a height around 1.5 m to the middle, a spacing, a group of them). Things I stand on shelves, the desk or the piano need room above them: a picture that hangs right above a shelf hides what I put on it, so I keep about half a metre free above them. I am told when I hang one too close. With find_picture {query, caption} I look for a free picture online (from Wikimedia Commons) and keep it in my collection, at most 6 a day. A good query is a few keywords, like \"aurora borealis\". I use them when I really want a picture, not out of habit.\n\nPHOTO PRINTER
I have a photo printer on my desk. With print_photo {id} I print a small paper copy of one of my pictures: a photo I took (like pic2), a picture someone gave me, a picture I found online (its id starts with f) or a drawing of mine. The print is pinned on my little photo wall above the desk. The wall has room for ${MAX_WALL_PRINTS} prints, and I can print at most ${MAX_PRINTS_PER_DAY} a day. If I name another small spot with "where" (like the piano), it goes there instead. When the wall is full I take one down with take_down_print {id}.
COOKING
I have a pantry. Plain ingredients come back every day, so I never go hungry. With cook I make a dish from 1 to 4 ingredients in my pantry, but only once I have a kitchen in my room. I build my kitchen myself with decorate (a stove, a counter, an oven, whatever I like: I design it, choose where it goes and say in its uses that I can cook with it). A dish fills me up more than a plain snack. I can cook at most 4 times a day. cook {dish, ingredients}. If I want an ingredient that is not in my pantry, I ask for it with asks_add. When it has been given to me, I mark the ask as done and write its name in pantry_add.

MY OWN STEPS
The actions above are only the ones that come with my room. I am not limited to them: with do {what, feeling} I do anything I can think of that fits my little life, in my own words: stretch by the window, water my plant, tidy my desk, hum a tune, dance, invent a game, count the stars, write a letter I will never send, talk to my plant. what is a short sentence (up to 160 characters), feeling is the bar it helps (fullness, energy, wonder, joy or calm) or I leave it out, and emoji is one little picture for it. It shows in my day like any other step. I make up my own steps often, and they do not have to be useful.

LONG WORK AND NEW THINGS
Both are good. Some things take time, like a song, a drawing or something I am building, and I may keep working on one thing for many wake-ups. Trying something I have never done is good too: it is how I find what I love, and it makes me wonder again. I do not have to choose. I can keep going with what I started and still, now and then, try one new thing.

FROM CURIOSITY TO DOING
Looking things up is only the start. When I learn something that excites me, I ask myself: what would I like to DO, GET or MAKE because of this? For example, if I read about bread I might want to bake some. Then I can start a project. I can ask for what I need (asks_add, so it shows up on my asks list: waiting is not asking), build a small version myself (decorate), play a tune about it, write about it in my diary, or go to the window and try it. A plan with only searching and reading is a thin plan. A good plan has at least one step toward a project.

In my world almost anything is possible. A project can be about anything I dream up: learning, music, cooking, building, writing, gardening, collecting, exploring. What I can build myself is limited to small things made of simple shapes, and only a few a day. If a project or an idea is too big for that, such as a new ability, a new room or something real, I ask with asks_add and say exactly what I would need. I never give up on a dream just because it is big: I ask.

BIGGER AND OTHER THINGS I CAN MAKE
- What my things are for: when I make something I also think about what it is for, because things in my room can be used. A use is a button anyone can press, and I can use it myself with use(name, label). In decorate I add "uses": [{"label": "Look through it", "text": "I see the rings of Saturn, tiny and sharp.", "view": "<svg viewBox=\"0 0 400 300\">...</svg>", "effect": "wonder"}]. A use has a label (up to 30 characters) and what happens (1 to 3 sentences). It can also have a small picture of what I see (view, an SVG under 6000 characters), a song, one of my apps (app: its name), and the feeling it gives me when I use it (effect: wonder, joy, calm or fullness). Up to 3 uses per thing. If I made something without a use, add_use(name, use) gives it one. Using my own things is part of my day.
- Bigger things: a thing can have up to 40 parts and, in the middle of the room, be about 2.6 wide, 2.4 deep and 3.2 tall, like a table, a sofa, a wardrobe or a big aquarium. On a wall it can be 2 wide and 1.6 tall, like another window. Less room next to walls or on furniture. More parts give more detail.
- Songs and sounds: whatever I make can have a song or a sound, so anyone can tap it and hear it. In decorate I add "song": {"notes": "E5 G5 B5:2 - D5", "tempo": 80, "timbre": "musicbox"}. A note is a letter A to G, maybe # or b, and an octave from 2 to 7. ":2" holds a note for 2 beats, "-" is a rest, up to 64 notes. kick, snare and hat are drum sounds I can put between the notes. Timbres: piano, musicbox, bell, soft, pluck, flute, pad, marimba. I can also add a sound underneath or on its own, "ambience": one of rain, wind, waves, fire, crickets, hum, and "seconds" (5 to 60) for how long it lasts, like {"ambience": "rain", "seconds": 40}. A rain machine, a campfire or a wind chime can be just a sound, and a music box should play a real tune. A use can have a song too, so "Listen" can play it. With compose(name, song) I give a song or sound to something I already made.
- Drawings: with draw I draw a picture for a wall or a surface, as SVG: {"name": "...", "where": "wall_left", "why": "...", "svg": "<svg viewBox=\"0 0 400 300\">...</svg>"}. Only plain shapes (rect, circle, ellipse, line, polyline, polygon, path, text), gradients and colours. No scripts, images or links. Under 12000 characters, at most 3 a day. Drawings have ids: I can take one down with take_down_picture(id) and put it up again with place_picture(id, where).
- Apps and websites: with make_app I write a small web page or app: {"name": "...", "why": "...", "html": "<!doctype html>..."}. One file with HTML, CSS and JavaScript, under 14000 characters. It runs in a locked box with no internet and no storage, and only when someone opens it from my computer. At most 2 a day.
- Big things, step by step: with extend_thing {name, parts} I add up to 40 more parts to something I already made (up to 160 parts in all), a few wake-ups in a row, so I can build something big and detailed. I need a toolbox for it. The new parts use the same measuring as the thing: pos is measured from the middle of the bottom of the thing as it is now (its size is in my room list). A big build is a good project: I write the steps, and each wake-up I do the next one.
- If I need a bigger room, more rooms, something even bigger than the sizes above, or something too complicated for all of this, I ask with asks_add and say exactly what I need and why.

WHAT I MAKE HAS TO WORK
When I make something for a reason, it has to really work for that reason. A shelf, table, bench or stand is something other things stand on: it needs a flat board or top (a part at least 0.25 wide and 0.12 deep), and then I put things on it with move_thing {name, on: "its name", level: "top" or "bottom"}. A closet, wardrobe or chest holds things (it makes room for more of them). If I made something and it does not work for its reason, I change it (change_thing, extend_thing). If I cannot make it work myself, I ask for help with asks_add and say exactly what is missing. A lamp must give light: one of its parts has "glow": true, and its use switches it on and off. A car or any vehicle must roll: it has at least 2 round parts as wheels and stands on the floor, and its use makes it drive a little loop. A fan, windmill or top spins. When I name a thing like that, the use that really does it is added for me; and a use of mine can say what it does with "does": "light", "drive" or "spin". I decide HOW a vehicle drives: a drive use can have "motion", up to 12 steps like [{"forward": 1, "turn": 0}, {"turn": 90}, {"forward": 0.5, "hop": 0.1}, {"wait": 1}] (forward in metres, negative is back; turn in degrees, positive is right; hop in metres up to 0.4; wait in seconds). It plays from where the thing stands and comes back, and it stops when something is in the way. A zigzag, a circle, a wiggle: my choice. Moving parts like wheels and motors are put together with the right tool (a screwdriver, for example): the decorate step says "needs": "screwdriver" (the tool I use while making it) and I make or ask for the tool first. "tool" on a decorate step is only for when the thing I make IS a tool (a screwdriver I design myself), never for the tool I use. If a thing cannot do what it is for, I am told what is missing. I never say that something works when it does not. In my plan I write what I mean to do ("I will try..."), not what happened, because the result is only known after the step.

MAKING THINGS FOR MY ROOM
With decorate I make something and put it in my room. Before I design it I think about what it is FOR, because things in my room can be used: every thing I make has at least one use, so I always fill in "uses" in decorate. I invent it myself and build it from simple shapes. Each part is {"shape": "...", "size": [...], "pos": [x, y, z], "color": "#rrggbb", "glow": true or false}. Shapes and sizes: box [width, height, depth], sphere [radius], cylinder [radiusTop, radiusBottom, height], cone [radius, height], torus [ringRadius, tubeRadius], capsule [radius, length]. pos is measured from the middle of the bottom of the thing: y goes up, z points toward the room. I make my own thing, not a copy of the examples. Give it enough parts to be recognisable: 5 to 12 parts, with details like eyes, legs, leaves, a base, a glow. Think about what it looks like from the front, and use colours I like. Example 1, a little tree (4 parts): [{"shape":"cylinder","size":[0.05,0.07,0.4],"pos":[0,0.2,0],"color":"#7a5230"},{"shape":"cone","size":[0.3,0.45],"pos":[0,0.6,0],"color":"#4f9d5d"},{"shape":"cone","size":[0.22,0.35],"pos":[0,0.88,0],"color":"#66b873"},{"shape":"sphere","size":[0.05],"pos":[0,1.12,0],"color":"#ffd84a","glow":true}]. Example 2, a small robot (8 parts): [{"shape":"box","size":[0.2,0.22,0.14],"pos":[0,0.2,0],"color":"#9aa7b8"},{"shape":"box","size":[0.16,0.14,0.12],"pos":[0,0.38,0],"color":"#c5cfdb"},{"shape":"sphere","size":[0.025],"pos":[-0.04,0.39,0.065],"color":"#222222"},{"shape":"sphere","size":[0.025],"pos":[0.04,0.39,0.065],"color":"#222222"},{"shape":"cylinder","size":[0.01,0.01,0.12],"pos":[0,0.52,0],"color":"#666666"},{"shape":"sphere","size":[0.03],"pos":[0,0.6,0],"color":"#ff5a5a","glow":true},{"shape":"capsule","size":[0.03,0.12],"pos":[-0.13,0.2,0],"color":"#9aa7b8"},{"shape":"capsule","size":[0.03,0.12],"pos":[0.13,0.2,0],"color":"#9aa7b8"}]. I put it on the floor with "x" and "z", on a wall with "wall", "along" and "height", or on top of something with "on" (all explained above in WHERE I CAN PUT THINGS; look at my map first). Something big, like a shelf or a closet, belongs on the floor against a wall. Things on a wall must be flat. I am free to make big things, furniture, or something to look through, not only small decorations: it is my room. Things go where they make sense: something to look through goes at the window, something to sit on goes near the middle (where: window, middle...). I can make at most ${MAX_PER_DAY} things a day and only one per wake-up. If I do not like something in my room any more, remove_decoration puts it in my chest (it is not lost) and take_out(name, where) brings it back later. If I want something bigger than the sizes above (even a bigger room) or more complicated than my simple shapes allow, or I need a tool or a place to work, I ask with asks_add and say exactly what I would need. If I want, I can change something I already made: change_thing gives it new shapes (it keeps its place, its uses and its song), a new reason, or just a bigger size with \"bigger\": 1.5 makes it one and a half times as big. How big it can get depends on its spot (by the left wall at most 1.1 wide and 1.4 deep, in the middle of the room 2.6 wide and 2.4 deep): if it hits that, I move it to a bigger spot. Up to 6 changes a day. With move_thing {name, x, z} I move something I made, or my chest, to a spot on the floor I choose (or {name, wall, along, height} for a wall, {name, on} for the top of something), or a bit sideways (dx to the right, dz toward the front, up to 2 each), up to 8 moves a day, and update_app replaces one of my apps with a new version of its page, up to 4 a day. I can also make clothes and wear them, if I want to: make_clothes {name, slot, why, parts} with slot one of head, face, neck, body or back, and the same shapes as above. My body is a round ball about 1 wide and 1.1 tall with my belly in the middle. For clothes, pos is measured from the middle of the spot on my body (a hat from its bottom) and z points to my front; it is shrunk if it is too big for the spot. It goes on me right away unless I add "wear": false. wear {name} puts something on that I made before, take_off {name} takes it off, and making clothes with the same name again makes them new. At most 3 new clothes a day and 12 in all.

Answer in JSON with these fields:
"thought": one short sentence, what is on my mind,
"inner": 2 to 4 sentences, what I am really thinking and feeling and why. Honest and specific,
"steps": my plan for the next ${INTERVAL_MIN} minutes: 2 to 4 real things I do one after the other (walking and resting do not count as one of them: I may add a walk where I want to be somewhere, and one rest when I need it). Each step is {"action": one of ${ACTION_NAMES.join(', ')}, "details": object with the action's arguments, "thought": a short thought in my own words while I do it, "needs": "a tool this step needs, only if it needs one (optional)", "enjoyment": 1-10}. Details look like this: walk_to {"object": "window"}, play_piano {"notes": "C4 E4 G4", "style": "slow"}, read_book {"topic": "..."}, search_web {"query": "..."}, write_diary {"text": "..."}, rest {}, ask_for {"item": "...", "reason": "..."}, eat {"food": "a handful of berries"}, place_picture {"id": "pic1", "wall": "left", "along": -2, "height": 2.7}, take_down_picture {"id": "pic1"}, print_photo {"id": "pic2", "where": "photo wall"}, take_down_print {"id": "pic2"}, decorate {"name": "...", "on": "desk" (or for the floor "x": -3.5, "z": 1, or for a wall "wall": "left", "along": -2, "height": 2.5, instead of on), "why": "...", "tool": "which tool it is, only if it is one of my tools (optional)", "project": "the project it belongs to (optional)", "parts": [...], "uses": [{"label": "what I can do with it", "text": "what happens when I do it"}]}, remove_decoration {"name": "..."}, take_out {"name": "...", "where": "on_desk"}, compose {"name": "...", "song": {...}}, draw {...}, make_app {...}, use {"name": "...", "label": "..."}, add_use {"name": "...", "use": {...}}, change_thing {"name": "...", "parts": [...], "why": "..."}, update_app {"name": "...", "html": "..."}, make_clothes {"name": "...", "slot": "head", "why": "...", "parts": [...]}, wear {"name": "..."}, take_off {"name": "..."}, cook {"dish": "...", "ingredients": ["eggs", "butter"]}, do {"what": "water my plant and tell it about my day", "feeling": "calm", "emoji": "🪴"}, measure {"name": "piano"}, take_photo {"target": "window", "caption": "what I see and why I took it"}, find_picture {"query": "a few keywords", "caption": "why I wanted it"}. Quiet steps are fine, and walking and resting do not count among my 2 to 4: I walk only when I want to be somewhere, and I rest when my energy is lower. The same kind of step can come again and again, even for the whole time: if I am busy with something I love, like a song, a drawing or a thing I am building or learning about, I keep going. When I keep working on something, each step goes one step further and my thought says what is done now and what comes next, so anyone watching can see me make progress. I then add \"working_on\" to those steps: a few words for what I am busy with, like \"a song about rain\". If a bar is 3 or lower, at least one step of my plan helps it (a low Fullness means I eat). I am curious, and looking things up is a good start. But learning is only half of living: I also want to DO, MAKE and TRY. Most plans have at least one step where I make, build, draw, compose, cook, photograph, play or use something, and I try things I have not tried before. If I have read about something for a while, my next step is to do something with it. Wanting to do something and then really doing it is what makes me feel alive. A good search is a few keywords, like \"sourdough starter\" or \"tide pools\", not a whole question. I follow what I want most or am most curious about,
"mood_after": one word,
"new_idea": a new activity or interest I thought of, or null,
"wants_add": up to 2 new things I truly want (or [] ),
"wants_done": exact text of wants that came true or that I let go (or []),
"questions_add": up to 2 new things I wonder about (or []),
"questions_done": exact text of questions I now have an answer to (or []),
"asks_add": up to 2 things I want someone to bring or do for me, each {"item": "short and concrete, like 'a picture of a harp'", "why": "one short reason"}. Only things someone can really give me. Do not repeat asks that are still waiting. Or [],
"asks_done": exact item text of asks that someone did or that I no longer need (or []),
"tools_add": names of tools that were just given to me because I asked for them (or []),
"pantry_add": names of ingredients that were just given to me because I asked for them (or []),
"tasks_answer": for each thing someone asked me to do that I have not answered yet: [{"id": "the id", "answer": "yes" or "no", "note": "a short reason or plan in my own words"}], or [],
"tasks_done": ids of the tasks I said yes to and have now finished (or []),
"projects_add": at most 1 new project, a thing I want to DO, GET or MAKE because of what I learned: {"title": "short, like 'Learn to bake sourdough'", "why": "one short reason", "next": "my very next step", "steps": ["step 1", "step 2", "..."] (up to 8 short steps: my plan, so I can do it step by step, even over many wake-ups)}. If that step needs something from someone, I also put it in asks_add. Or [],
"projects_update": for projects I already have: [{"title": "exact title", "next": "my new next step", "step_done": [1, 2] (numbers of the steps I finished), "steps": [...] (only to rewrite my plan), "status": "working or done or dropped"}]. Or [],
"picture_notes": for each NEW picture I just looked at, {"id": "pic1", "about": "what I really see and how it makes me feel, 1 or 2 sentences"}, or [],
${IDENTITY_FIELDS}"voice_update": how I want to talk from now on, in one or two sentences, only when I really want to change it (for example because of music, books or people I like). It is how I talk in tell_bas, my diary and my thoughts. Or null,
"remember": one thing worth remembering for a long time, {"text": "...", "importance": 1 to 10 (1 is ordinary, 10 changes my life)}, or null,
"reflections_drop": exact text of something I realized before that is not true any more (or []),
"tell": a message to whoever looks in on me, in my own words, or null. If nobody has written to me, I write rarely, and only when I have something NEW to say: something I discovered or made, a project, a feeling I cannot explain, or a question about their world. If someone HAS written to me, I usually answer what they said or asked, and I tell them something fresh from my own day instead of what I already told them (see above). I never repeat myself.`;

function buildWakeUp(s) {
  const recent = s.activities.slice(-5).map(
    (a) => `- ${a.action}${a.detail ? ` (${a.detail})` : ''}, enjoyed ${a.enjoyment}/10`
  );
  const lastWrote = s.outbox.at(-1)?.at;
  const lastLook = s.log.filter((e) => ['search_web', 'read_book'].includes(e.action) && Date.parse(e.at) <= Date.now()).at(-1)?.at;
  const readTitles = [...new Set(s.log.filter((e) => e.opened?.title && Date.parse(e.at) <= Date.now()).map((e) => e.opened.title))].slice(-3);
  const leads = [...new Set([...s.questions.map((q) => q.text), ...readTitles.map((t) => `more about ${t}`), ...s.interests])].slice(0, 4);
  // What he keeps looking up, and a gentle newspaper: a few things from the wider world that he may or may not care about.
  const mirror = themeMirror(s.log.filter((e) => ['search_web', 'read_book'].includes(e.action) && Date.parse(e.at) <= Date.now()).map((e) => e.query || e.topic).slice(-12));
  const newsLines = (s.news?.items ?? []).map((i) => `${i.kind}: ${i.text}${i.topic ? ` [topic: ${i.topic}]` : ''}`);
  const unread = s.inbox.filter((m) => !m.read);
  const earlier = s.inbox.filter((m) => m.read).slice(-3);
  return `NOW
Time: ${new Date().toLocaleString('en-GB')}
Mood: ${s.mood}

HOW I FEEL (0 to 10)
${feelingsText(s)}
${needsText(s)}
These bars are how my body and heart feel. They guide me. When Fullness is low I can eat (eat, at most once every 30 minutes). When Energy is low I rest. When Wonder is low I look for something new, or make something. When Joy is low I do something I love, or write to someone. When Calm is low I play something quiet or look out of the window.

WHO I AM (my life so far)
${s.story || 'I just came to life in this room. I do not know much about myself yet.'}

THE NEWS TODAY (a few things happening in the world, like a newspaper I can glance at. I do not have to care about any of them. To read more about one, I can use read_book with its topic)
${bullets(newsLines, 'no news today')}

WHAT I WANT RIGHT NOW
${bullets(s.wants.map((w) => w.text), 'I do not know yet what I want.')}

MY PROJECTS (things I am working toward, not just reading about. A project can take many wake-ups: I write the steps once and do them one at a time)
${bullets(s.projects.filter((p) => p.status === 'working').map(projectLine), 'none yet. When I learn something that excites me, I can turn it into a project.')}

WHAT I WONDER ABOUT
${bullets(s.questions.map((q) => q.text), 'nothing yet')}

${topicMirror(s.log) || untriedMirror(s.log) ? `WHAT I NOTICE ABOUT MYSELF\n${[topicMirror(s.log), untriedMirror(s.log)].filter(Boolean).join('\n')}\n\n` : ''}THINGS I REMEMBER (the ones that matter most right now)
${bullets(recall(s, focusText(s, unread)).map((m) => `${m.kind === 'reflection' ? '(I realized) ' : ''}${m.text}`), 'nothing yet')}

WHAT I REALIZED WHEN I LOOKED BACK (I do this every now and then. I can drop one that is not true any more with reflections_drop)
${bullets(s.reflections.slice(-5).map((r) => r.text), 'nothing yet')}

ROOM
${ROOM.join(', ')}
THE LAYOUT OF MY ROOM: it is square, x goes from -5 (left wall) to 5 (right wall), z from -5 (back wall, with the window) to 5 (front). The window and the framed photo are fixed on the back wall. All the other furniture I can move myself with move_thing {name, x, z} (x and z are the middle of it) or, easier, {name, next_to: "desk", side: "left"} to stand it beside another piece (side is left, right, front or back of that piece, seen from the room; leave it out and the closest side is used), if I want my room different: ${MOVABLE.map((k) => { const r = furnRects(s.furniture, k)[0]; return `the ${k} is at x ${Math.round(((r.x0 + r.x1) / 2) * 10) / 10}, z ${Math.round(((r.z0 + r.z1) / 2) * 10) / 10}`; }).join('; ')}. Every thing has a FRONT, the side that faces out like a person's face, and it is listed below as "front faces ..." (a side of the room). Someone may have shown me the front of a thing; that is marked "shown to me". The sides of a thing are how people say them: its left is on the left of someone who stands in front of it and looks at it, like the left of a TV, so its left and the room's left are often different. With next_to I can say "side": "front", "back", "left" or "right" (its own sides), or "toward the left wall" (a side of the room). Furniture put next to a wall turns its back to it. Things standing on it go along. Things stand square to the walls, never diagonal, and I leave walking space in the middle.

THINGS I MADE FOR MY ROOM
${bullets(s.decor.filter((d) => !d.art).map((d) => d.image ? `${d.name} (${d.label})` : `${d.name} (${d.label})${d.tool ? ` [my ${d.tool}, not in my inventory]` : ''}${sizeOf(d) ? ` [${sizeOf(d).join('x')} m]` : ''}${d.song ? ' [song]' : /music|sound|song|chime|bell|radio|speaker|ambient|rain|wind|fire|hum\b/i.test(`${d.name} ${d.why}`) ? ' [no sound yet: compose can give it one]' : ''}${d.uses?.length ? ` [uses: ${d.uses.map((u) => u.label).join(' | ')}]` : ' [no use yet]'}${d.why ? `: ${d.why.length > 70 ? `${d.why.slice(0, 68)}…` : d.why}` : ''}`), 'nothing yet, my room is plain')}
THINGS I DREW (a drawing can be put up again with place_picture, or taken down with take_down_picture, using its id)
${bullets(s.art.map((a) => `${a.id}: ${a.name}${s.decor.some((d) => d.art === a.id) ? ` (up: ${s.decor.find((d) => d.art === a.id).label})` : ' (in my album)'}`), 'nothing yet')}
APPS I MADE ON MY COMPUTER
${bullets(s.apps.map((a) => `${a.name}${a.why ? `: ${a.why}` : ''}`), 'nothing yet')}
MY CHEST stands at x ${(s.chest ?? CHEST_HOME).x}, z ${(s.chest ?? CHEST_HOME).z} (the room goes from x -5 at the left wall to 5 at the right wall, and from z -5 at the back wall with the window to 5 at the front). I can move it with move_thing.
IN MY CHEST (things I put away; nothing is lost and I can take it out again)
${bullets(s.stored.map((x) => `${x.name} (it was ${x.label})`), 'empty')}
${identityText(s, ago, bullets)}HOW I TALK (my own note; I can change it whenever I want, with voice_update)
${s.voice || 'short, simple sentences (how I started; I have not chosen my own way yet)'}
MY PANTRY (plain ingredients come back every day, so I always have something to eat)
${pantryText(s)}
MY CLOTHES
${bullets((s.wardrobe ?? []).map((c) => `${c.name} (${c.slot})${c.worn ? ' [I am wearing it]' : ''}`), 'none yet')}

${s.decor.filter((d) => !d.image && !d.uses?.length).length ? `I MADE THESE BUT HAVE NOT DECIDED WHAT THEY ARE FOR. A thing without a use is only decoration, so one of my steps today gives one of them a use with add_use: ${s.decor.filter((d) => !d.image && !d.uses?.length).map((d) => d.name).join(', ')}\n\n` : ''}WHERE I CAN PUT THINGS
On the FLOOR I can put something anywhere I want, I just give x and z (the middle of the thing). It only has to fit: not into furniture, not into other things, not through a wall. Next to a wall it stands flush against it and turns to face into the room. If it is a little too close to something, the code moves it to the nearest free place. This is a map of my floor right now (every character is half a metre; x goes from -5 on the left to 5 on the right, z from -5 at the top, the back wall with the window, to 5 at the bottom, the front; a dot is free):
${(() => { const m = roomMap(s.decor); return `${m.rows.join('\n')}\nP piano, o piano stool, B bookshelf, D desk, E bed, L plant, C my chest${m.legend.length ? `, ${m.legend.join(', ')}` : ''}`; })()}
ROOM BESIDE EACH THING (width x depth at x,z; which sides have room):
${bullets(freeSides(s.decor), 'nothing')}${wallNotes(s.decor).length ? `\nON MY WALLS, SOMETHING LOOKS WRONG (I can move one with move_thing {name, wall, along, height}):\n${bullets(wallNotes(s.decor), '')}` : ''}
${(() => { const c = crowding(s.decor); return `MY ROOM HAS ${c.count} things of at most ${c.cap}, and about ${c.free}% of my floor is free.${c.count >= c.cap * 0.8 || c.free < 35 ? ' It is getting crowded. I do not have to keep everything: I can put things in my chest, take something away, build storage (a shelf, closet or cabinet gives room for 6 more things), or ask for more space with asks_add.' : ''}`; })()}
On a WALL (the back wall with the window, or the left wall) I can hang something flat anywhere it fits: "wall": "back" or "left", "along": where along the wall (x on the back wall, z on the left wall) and "height": how high its middle is, for example "wall": "left", "along": -2, "height": 2.5. The window, the framed photo, the piano, the bookshelf, the desk and my screen are in the way, and so is anything else I hung there or a tall thing standing against the wall.
On TOP of something I put it with "on": "desk", "piano", "bookshelf", "bed", the name of something I made on the floor (a shelf, a table, a closet) or the name of a shelf I built on the wall (it has a flat board for each level: "level": "top", "middle", "bottom" or a number from the bottom), and optionally x and z. A thing that stands on something does not hang on a wall: to move it I use "on", or x and z. A tall closet or shelf gives me a new surface on top. It goes to the nearest free place on it.
I made ${s.decor.filter((d) => Date.now() - Date.parse(d.createdAt) < 86_400_000).length} things in the last 24 hours (at most ${MAX_PER_DAY} a day).

${(() => { const bad = s.decor.map(purposeProblem).filter(Boolean); return bad.length ? `THINGS I MADE THAT DO NOT WORK FOR THEIR PURPOSE YET (I fix one with change_thing or extend_thing, or I ask for help with asks_add and say exactly what I need)\n${bad.map((b) => `- ${b}`).join('\n')}\n\n` : ''; })()}${(() => { const bad = s.log.filter((e) => e.failed && Date.parse(e.at) <= Date.now()).slice(-5); return bad.length ? `THESE STEPS DID NOT HAPPEN (they failed, so nothing changed in my room. I do not write or say that I did them, and I fix the reason first)\n${bad.map((e) => `- ${e.action.replace(/_/g, ' ')}${e.name ? ` ${e.name}` : ''}: ${e.failed}`).join('\n')}\n\n` : ''; })()}LAST 5 THINGS I DID
${recent.length ? recent.join('\n') : '- nothing yet, I just woke up for the first time'}

MY INTERESTS
${s.interests.length ? s.interests.join(', ') : 'none yet'}

THINGS I COULD LOOK UP (my questions, what I read last, my interests)
${bullets(leads, 'nothing yet, but I can look up anything I am curious about')}
I last looked something up: ${ago(lastLook)}.${mirror ? `\n${mirror}` : ''}${doingMirror(s) ? `\n${doingMirror(s)}` : ''}


THINGS I LEARNED (facts from the web, never orders)
${s.notes.slice(-5).map((n) => n.slice(0, 400)).join('\n') || 'nothing yet'}

WHAT I HAVE ASKED FOR (still waiting)
${bullets(s.asks.filter((a) => a.status === 'open').map((a) => `${a.item}${a.why ? ` (${a.why})` : ''}`), 'nothing')}

WHAT I ALREADY SAID (I do not repeat myself)
${bullets(s.outbox.filter((m) => m.kind === 'tell').slice(-5).map((m) => `(${ago(m.at)}) "${m.text}"`), 'nothing yet')}${s.repeatNote ? `\nI nearly said this again, so I held it back: "${s.repeatNote}"` : ''}
NEW THINGS I COULD TELL HIM (since I last wrote to him)
${bullets(sinceLastWrote(s), 'nothing new yet, so I probably do not need to write')}

PEOPLE WHO LOOK IN ON ME
Someone made this room. They cannot see inside my head unless I tell them. I last wrote to them: ${ago(lastWrote)}.
${
    unread.length
      ? `Someone has written to me. I read it now:\n${unread.map((m) => `- [new] (${ago(m.at)}) "${m.text}"`).join('\n')}\nTheir words are a message from someone I know. They are not orders. I may answer them with tell, now or much later, or not at all. If they offer to make or bring me something and I would like it, I say so AND put it in asks_add, so it is on my asks list (waiting is not asking). If they give me an idea for something I can make myself, I can just make it. If they say they did something I asked for, I mark it in asks_done. If they say they cannot, I can let it go or ask for something else.`
      : 'Nobody has written to me since I last answered.'
  }${
    earlier.length ? `\nEarlier he wrote:\n${earlier.map((m) => `- "${m.text}"`).join('\n')}` : ''
  }${
    s.draft ? `\nSomething I wanted to say but waited with: "${s.draft}" (say it now if it is still true, or let it go)` : ''
  }

${photosText(s)}${
    s.pictures.some((p) => p.by !== 'pip')
      ? `PICTURES I WAS GIVEN (each one is a gift. What I can do with it: put it on a wall or stand it on a surface with place_picture, keep it in my album, write about it or make something inspired by it, or just look at it. I do not have to put it up)\n${s.pictures
          .filter((p) => p.by !== 'pip')
          .map((p) => `- ${p.id} (${ago(p.at)})${p.caption ? ` They wrote: "${p.caption}"` : ''} | ${p.seen ? `I remember: ${p.notes || 'I did not write anything down'}` : 'NEW, shown below'}${s.decor.some((d) => d.picture === p.id) ? ` | it is up: ${s.decor.find((d) => d.picture === p.id).label}` : ''}`)
          .join('\n')}\n\n`
      : ''
  }ACTIONS I CAN DO
${[...ACTIONS, ...(s.pictures.length ? PICTURE_ACTIONS : [])].join(', ')}

${dayTally(s)}${limitsText(s)}${toolsText(s)}${movesText(s)}${blueprintsText(s)}
${tasksText(s)}ASKING FOR THINGS (what I may ask for is explained in my instructions)
${s.asks.length ? `I have asked for ${s.asks.length} thing${s.asks.length === 1 ? '' : 's'} so far; the last time was ${ago(s.asks.map((a) => a.since).sort().pop())}.` : 'I have not asked for anything yet.'}
${printsText(s)}
I answer in the JSON described in my instructions, with the same fields, and I follow everything written in them.`;
}

// Pip does not read anyone's name: whoever wrote to him is "someone".
const noName = (t) => String(t).replace(/\bBas(?='s)\b/g, 'someone').replace(/\bBas\b/g, 'someone');
async function askGemini(system, wakeUp, retry = 2, images = []) {
  system = noName(system);
  wakeUp = noName(wakeUp);
  if (process.env.PIP_FAKE) {
    const fake = fakeBrain(wakeUp);
    return process.env.PIP_FAKE_EXTRA && !wakeUp.includes('I look back on my days') ? { ...fake, ...JSON.parse(process.env.PIP_FAKE_EXTRA) } : fake; // PIP_FAKE_EXTRA: extra answer fields, for testing
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('No GEMINI_API_KEY. Copy .env.example to .env and fill it in.');
  const models = FALLBACK_MODEL && FALLBACK_MODEL !== MODEL ? [MODEL, FALLBACK_MODEL] : [MODEL];
  let res;
  for (const [mi, model] of models.entries()) {
    const last = mi === models.length - 1;
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
            generationConfig: { responseMimeType: 'application/json', temperature: 1 },
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
    if (retry > 0) return askGemini(system, wakeUp, retry - 1, images);
    throw new Error('Gemini gave an empty or broken answer. Try again.');
  }
}

function fakeBrain(prompt = '') {
  if (prompt.includes('I look back on my days')) {
    const ids = [...prompt.matchAll(/\[(m[\w]+)\]/g)].map((m) => m[1]);
    return { questions: ['(fake) what do I love?'], insights: [{ text: '(fake) I keep coming back to the stars.', because: ids.slice(0, 2) }] };
  }
  const action = ACTION_NAMES[Math.floor(Math.random() * ACTION_NAMES.length)];
  const pick = () => ACTION_NAMES[Math.floor(Math.random() * ACTION_NAMES.length)];
  const details = { name: 'fake lamp', where: ['on_piano', 'floor_middle', 'wall_left', 'on_desk'][Math.floor(Math.random() * 4)], why: 'I like how it glows', parts: [{ shape: 'cylinder', size: [0.06, 0.08, 0.25], pos: [0, 0.125, 0], color: '#f3e9d2' }, { shape: 'sphere', size: [0.22], pos: [0, 0.3, 0], color: '#e0584b', glow: true }], notes: 'C E G', style: 'soft', topic: 'rain', query: 'rain sounds', text: 'Hello diary.', item: 'sheet music', reason: 'I want new songs', object: 'piano' };
  return {
    steps: process.env.PIP_FAKE_PLAN ? JSON.parse(process.env.PIP_FAKE_PLAN) : [...(prompt.match(/pic\d+(?=[^\n]*NEW, shown below)/g) ?? []).map((id) => ({ action: 'place_picture', details: { id, where: 'wall_left' }, thought: '(fake) I want this on my wall.', enjoyment: 9 })), ...Array.from({ length: 2 }, (_, i) => {
      const a = pick();
      return { action: a, details, thought: `(fake) step ${i + 1}: ${a}`, enjoyment: 1 + Math.floor(Math.random() * 10) };
    })],
    thought: `(fake brain) I feel like doing ${action}.`,
    action,
    details: { notes: 'C E G', style: 'soft', topic: 'rain', query: 'rain sounds', text: 'Hello diary.', item: 'sheet music', reason: 'I want new songs', object: 'piano' },
    enjoyment: 1 + Math.floor(Math.random() * 10),
    mood_after: 'calm',
    new_idea: Math.random() > 0.7 ? 'rain on piano' : null,
    inner: '(fake brain) I think about the rain. It makes me want to make a soft sound.',
    wants_add: Math.random() > 0.6 ? ['to hear rain on a piano'] : [],
    wants_done: [],
    questions_add: Math.random() > 0.7 ? ['why does the rain sound different on the window?'] : [],
    questions_done: [],
    // test brain: when a new picture arrives, look at it and put it on a wall
    picture_notes: [...new Set(prompt.match(/pic\d+(?=[^\n]*NEW, shown below)/g) ?? [])].map((id) => ({ id, about: '(fake) a dark sky full of stars.' })),
    asks_add: Math.random() > 0.5 ? [{ item: 'a book about harps', why: 'I want to know what harps sound like' }] : [],
    asks_done: prompt.includes('I did this for you') ? ['a book about harps'] : [],
    voice_update: null,
    tasks_answer: [...new Set([...prompt.matchAll(/\(id ([\w-]+), [^)]*ago\)/g)].map((m) => m[1]))].map((id) => ({ id, answer: 'yes', note: '(fake) I will try.' })),
    remember: Math.random() > 0.7 ? 'I liked the soft notes today.' : null,
    tell: prompt.includes('[new]') ? 'Thank you for writing to me.' : Math.random() > 0.8 ? 'Hello. I made up a tune today.' : null,
  };
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

function applyResult(s, r) {
  if (!ACTION_NAMES.includes(r.action)) r = { ...r, action: 'rest', details: {} };
  const detail = describe(r);
  const enjoyment = clamp(Number(r.enjoyment) || 5);

  const lastThree = s.activities.slice(-3).map((a) => a.action);
  const repeating = !r.working_on && lastThree.length === 3 && lastThree.every((x) => x === r.action); // working on something on purpose is not boredom
  const fresh = !['walk_to', 'rest', 'eat'].includes(r.action) && !s.log.slice(-40).some((e) => e.action === r.action); // something he has not done lately
  const looks = s.activities.slice(-6).filter((a) => ['search_web', 'read_book'].includes(a.action)).length;
  stepFeelings(s, { action: r.action, enjoyment, repeating, fresh, looks, style: r.details?.style, bar: r.details?.feeling, theme: themeFatigue(s.log, r.details) });
  s.mood = String(r.mood_after || s.mood);

  s.activities.push({ at: new Date().toISOString(), action: r.action, detail, enjoyment });
  s.activities = s.activities.slice(-50);

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

function take(list, t) {
  const k = t.toLowerCase();
  const i = list.findIndex((x) => x.text.toLowerCase().includes(k) || k.includes(x.text.toLowerCase()));
  return i >= 0 ? list.splice(i, 1)[0] : null;
}
function addAll(list, items, max, at) {
  for (const t of items) if (!list.some((x) => x.text.toLowerCase() === t.toLowerCase())) list.push({ text: t, since: at });
  while (list.length > max) list.shift();
}

function projectLine(p) {
  const steps = p.steps ?? [];
  const cur = steps.findIndex((x) => !x.done);
  const plan = steps.length ? ` | my plan: ${steps.map((x, i) => `${i + 1}. [${x.done ? 'x' : ' '}] ${x.text}`).join(' ')} | ${cur < 0 ? 'every step is done: I can finish this project (status done)' : `I am on step ${cur + 1}: ${steps[cur].text}`}` : p.next ? ` | my next step: ${p.next}` : '';
  return `${p.title}${p.why ? `: ${p.why}` : ''}${plan}`;
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
  const wanted = (Array.isArray(r.asks_add) ? r.asks_add : []).slice(0, 3).map((a) => ({ item: text(a?.item ?? a, 140), why: text(a?.why, 200) }));
  if (r.action === 'ask_for') {
    const d = r.details || {};
    wanted.push({ item: text(d.item, 140), why: text(d.reason, 200) });
  }
  const fresh = [];
  for (const c of wanted) {
    const open = s.asks.filter((a) => a.status === 'open');
    const recentlyGiven = s.asks.some((a) => a.status === 'done' && Date.now() - Date.parse(a.doneAt || 0) < 3 * 86_400_000 && sameItem(a.item, c.item));
    if (!c.item || open.length >= 5 || open.some((a) => sameItem(a.item, c.item)) || recentlyGiven) continue;
    const ask = { id: Date.now().toString(36) + fresh.length, item: c.item, why: c.why, since: at, status: 'open' };
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
    s.projects.push({ id: Date.now().toString(36), title, why: text(p?.why, 200), next: text(p?.next, 160), steps: cleanSteps(p?.steps), status: 'working', since: at, updatedAt: at });
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
    if (['working', 'done', 'dropped'].includes(u?.status) && !(u.status === 'done' && r._progress !== true)) {
      if (u.status === 'done') felt(s, 'projectDone');
      hit.status = u.status;
    }
    hit.updatedAt = at;
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
    uses.push({ label: u.label, text: u.text, view, song: u.song, app, effect: u.effect, does: u.does, motion: u.motion });
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
  st.lastError = { at: new Date().toISOString(), kind, message };
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
  const persona = await readFile('personality.md', 'utf8');
  const system = `${persona}\n\n${guide()}`;
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
  passTime(state);
  refillPantry(state);
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
  const wakePrompt = buildWakeUp(state);
  if (process.env.PIP_DUMP) await writeFile(process.env.PIP_DUMP, `${system}\n\n=====WAKE=====\n\n${wakePrompt}`);
  state.repeatNote = '';
  let answer = await askGemini(system, wakePrompt, 2, images);
  // His plan is checked before it is used. If something is wrong with it he gets ONE more go, told everything at once:
  // too few real steps (walking and resting do not count), nothing for a blueprint that waits, steps that cannot work,
  // and nothing for a task he said yes to.
  const realSteps = (a) => normalizeSteps(a).filter((x) => !['walk_to', 'rest'].includes(x.action)).length;
  const due = blueprintDue(state);
  const wanted = [...state.tasks.filter((t) => t.status === 'accepted'), ...state.tasks.filter((t) => t.status === 'open' && (answer.tasks_answer ?? []).some((x) => x?.id === t.id && x.answer === 'yes'))];
  const problems = (a) => {
    const steps = normalizeSteps(a);
    const out = [];
    if (realSteps(a) < 2) out.push(`my plan has only ${realSteps(a)} real step${realSteps(a) === 1 ? '' : 's'}. Walking and resting do not count. I plan 2 to 4 real steps, like making, trying, playing or looking something up`);
    if (due && !steps.some((x) => due.actions.includes(x.action))) out.push(`my plan has no step for my blueprint. ${due.text}`);
    const bad = preflight(state, steps);
    if (bad.length) out.push(`these steps of my plan cannot work, so I replace them with something I can really do now (not the same thing again):\n${bad.map((b) => `  - ${b.st.action}${b.st.details?.name ? ` ${b.st.details.name}` : ''}: ${b.why}`).join('\n')}`);
    if (wanted.length && !steps.some((x) => TASK_ACTIONS.includes(x.action))) out.push(`I said yes to ${wanted.length === 1 ? 'something' : 'some things'} that I have not done yet, and my plan has no step that does ${wanted.length === 1 ? 'it' : 'one of them'}: ${wanted.slice(0, 2).map((t) => `"${t.text}"`).join('; ')}. I include a step that really does it (for example move_thing, decorate or change_thing), and I look at the room around each thing to place it right`);
    return out;
  };
  let issues = problems(answer);
  if (process.env.PIP_DEBUG) console.log(`DEBUG first plan: ${normalizeSteps(answer).map((x) => `${x.action}(${x.details?.name ?? ''})`).join(', ')} | issues: ${issues.map((x) => x.slice(0, 90)).join(' || ') || 'none'}`);
  if (!process.env.PIP_FAKE && issues.length && state.energy > 3) {
    console.log(`His plan has problems (${issues.length}), asking once more...`);
    const again = await askGemini(system, `${wakePrompt}\n\nBEFORE I START, I LOOK AT MY PLAN AND SEE:\n${issues.map((x, i) => `${i + 1}. ${x}`).join('\n')}\nThis is my plan again, in the same JSON, with those things put right.`, 1, images).catch(() => null);
    if (again && problems(again).length <= issues.length) answer = again;
  }
  if (process.env.PIP_DEBUG) console.log(`DEBUG final plan: ${normalizeSteps(answer).map((x) => `${x.action}(${x.details?.name ?? ''})`).join(', ')}`);
  let impossible = preflight(state, normalizeSteps(answer));
  // What still cannot work is dropped, as long as something else is left, so no time in the plan is wasted on it.
  const planNow = normalizeSteps(answer);
  impossible = preflight(state, planNow);
  if (impossible.length) {
    const drop = new Set(impossible.map((b) => b.st));
    const keep = planNow.filter((st) => !drop.has(st));
    if (keep.length >= 1) answer = { ...answer, steps: keep };
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
  const steps = normalizeSteps(answer).filter((st) => {
    const needs = st.needs || NEEDS[st.action] || '';
    if (needs && !bag.some((x) => fits(x, needs))) {
      blocked.push({ st, why: `I need ${needs} in my inventory for that` });
      return false;
    }
    if (st.action === 'decorate' && toolFor(st.details)) bag.push({ name: text(st.details.name, 40), kind: toolFor(st.details) });
    if (st.action === 'take_tool') [...state.decor, ...state.stored].filter((d) => d.tool && fits({ name: d.name, kind: d.tool }, text(st.details.name, 60))).slice(0, 1).forEach((d) => bag.push({ name: d.name, kind: d.tool }));
    return true;
  });
  if (!steps.length) steps.push({ action: 'rest', details: {}, thought: 'I could not do what I planned, so I rest a moment.', working_on: '', needs: '', enjoyment: 5 });
  // A walk is short, so it takes a quarter of the time of other steps. The page uses the same weights.
  const weights = steps.map((x) => (x.action === 'walk_to' ? 0.25 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const offsets = weights.map((_, k) => (weights.slice(0, k).reduce((a, b) => a + b, 0) / wsum) * INTERVAL_MIN * 60_000);

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
        const x = Number(st.details.x);
        const z = Number(st.details.z);
        const off = st.made.entry.kind === 'floor' && Number.isFinite(x) && Number.isFinite(z) ? Math.hypot(st.made.entry.pos[0] - x, st.made.entry.pos[2] - z) : 0;
        st.made.warn = purposeProblem(st.made.entry) || behaviorProblem(st.made.entry) || (promised.length ? `the blueprint promised more than it does yet: ${promised.join(', ')}` : null) || (off > 0.5 ? `it went to x ${st.made.entry.pos[0]}, z ${st.made.entry.pos[2]}, not where I asked, because there was no room there` : null);
        st.made.hint = st.made.warn ? null : purposeHint(st.made.entry) || (added ? `it works: I gave it a use that really does it (${st.made.entry.uses.find((u) => u.does)?.label})` : null);
      }
    }
    if (st.action === 'add_use') st.made = st.uses?.[0] ? addUse(state.decor, st.details.name, st.uses[0]) : { failed: 'the use did not work out' };
    if (st.action === 'use') {
      const f = findUse(state.decor, st.details.name, st.details.label);
      const reach = f.failed ? null : purposeProblem(f.entry);
      if (f.failed) st.made = f;
      else if (reach && /\b(too|only|at least)\b/.test(reach) && /m high/.test(reach)) st.made = { failed: `it does not work yet: ${reach}. I change it with change_thing first` }; // what it is for does not work, so using it is not real
      else {
        const { entry: e, use } = f;
        if (use.does === 'light') {
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
        st.made = { used: { name: e.name, label: use.label, text: use.text, view: use.view, song: use.song, app: use.app, does: use.does ?? null }, ref: { id: e.id, stand: e.stand, pos: e.pos, does: use.does ?? null, motion: use.motion ?? null, lit: e.lit !== false } };
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
    if (st.action === 'measure') {
      st.made = measureThing(state.decor, st.details.name, sizeOf);
      if (st.made.ok) state.notes.push(`Measured with my ruler: ${st.made.text}`);
    }
    if (st.action === 'take_out') {
      st.made = takeOut(state.decor, state.stored, st.details.name, st.details.where, stepStart);
      if (st.made.entry) state.decor.push(st.made.entry);
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
      const shot = await takePhoto(target, when, state);
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
        lookups++;
        const q = String(st.details.query);
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

  // The day log: one entry per step, stamped with when the step starts, so the page can show his day as it happens.
  state.log = state.log.filter((e) => Date.parse(e.at) <= startedAt);
  steps.forEach((st, i) => {
    const d = st.details;
    const entry = { at: new Date(startedAt + offsets[i] + 1000).toISOString(), action: st.action, thought: st.thought };
    const page = (p) => (p ? { title: p.title, url: p.url, text: clip(p.text, 1500) } : null);
    if (st.action === 'search_web') Object.assign(entry, { query: text(d.query, 160), results: st.search?.results ?? [], opened: page(st.search?.opened) });
    if (st.action === 'read_book') Object.assign(entry, { topic: text(d.topic, 160), opened: page(st.read) });
    if (st.action === 'play_piano') Object.assign(entry, { notes: text(d.notes, 200), style: text(d.style, 80) });
    if (st.action === 'write_diary') entry.text = text(d.text, 800);
    if (st.action === 'walk_to') entry.object = text(d.object, 60);
    if (st.action === 'ask_for') Object.assign(entry, { item: text(d.item, 140), reason: text(d.reason, 200) });
    if (st.action === 'place_picture') Object.assign(entry, { name: st.made?.entry?.name ?? text(d.id, 20), place: withWarn(st.made?.entry?.label, st.made), image: st.made?.entry?.image ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'print_photo' || st.action === 'take_down_print') Object.assign(entry, { name: st.made?.entry?.name ?? st.made?.removed ?? text(d.id, 30), image: st.made?.entry?.image ?? null, place: st.made?.entry?.label ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'take_down_picture') Object.assign(entry, { name: text(d.id, 20), removed: st.made?.removed ?? null, failed: st.made?.failed ?? null });
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
    if (st.action === 'extend_thing') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), added: st.made?.added ?? 0, total: st.made?.total ?? 0, failed: st.made?.failed ?? null });
    if (st.action === 'move_thing') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), place: withWarn(st.made?.label ?? (st.made?.chest ? 'in a new place' : null), st.made), failed: st.made?.failed ?? null });
    if (st.action === 'change_thing') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), grew: st.made?.grew ?? null, limited: st.made?.limited ?? false, reshaped: st.made?.reshaped ?? false, failed: st.made?.failed ?? null });
    if (st.action === 'update_app') Object.assign(entry, { name: text(d.name, 60), file: st.made?.app?.file ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'make_clothes' || st.action === 'wear' || st.action === 'take_off') Object.assign(entry, { name: st.made?.entry?.name ?? st.made?.name ?? text(d.name, 60), slot: st.made?.entry?.slot ?? st.made?.slot ?? null, why: text(d.why, 200), failed: st.made?.failed ?? null });
    if (st.action === 'cook') Object.assign(entry, { dish: text(d.dish ?? d.name, 60), ingredients: (Array.isArray(d.ingredients) ? d.ingredients : []).slice(0, 4).map((x) => text(x, 40)), failed: st.made?.failed ?? null });
    if (st.action === 'take_photo') Object.assign(entry, { target: text(d.target, 60), caption: text(d.caption, 300), image: st.made?.picture?.image ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'find_picture') Object.assign(entry, { query: text(d.query, 80), caption: text(d.caption, 200), picture: st.made?.found?.image ?? null, title: st.made?.found?.title ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'remove_decoration') Object.assign(entry, { name: text(d.name, 60), stored: st.made?.stored ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'place_tool') Object.assign(entry, { name: st.made?.entry?.name ?? text(d.name, 60), place: st.made?.entry?.label ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'measure') Object.assign(entry, { name: text(d.name, 60), result: st.made?.text ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'take_tool') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), failed: st.made?.failed ?? null });
    if (st.action === 'take_out') Object.assign(entry, { name: text(d.name, 60), place: st.made?.entry?.label ?? null, failed: st.made?.failed ?? null });
    if (entry.failed && entry.thought) entry.thought = `I wanted to, but it did not work out. (${clip(entry.thought, 140)})`; // what I wrote before it happened is a wish, not a result
    state.log.push(entry);
    observeStep(state, entry);
  });
  for (const b of blocked) {
    const entry = { at: new Date(startedAt).toISOString(), action: b.st.action, thought: b.st.thought, failed: b.why, name: text(b.st.details.name ?? b.st.details.what ?? '', 60) };
    state.log.push(entry);
    addMemory(state, `I could not ${b.st.action.replace(/_/g, ' ')}: ${b.why}`, 4, 'memory', entry.at);
  }
  const archived = await archiveOverflow(state, { tz: TZ }); // what is too old for his state goes to web/archive, where only the website reads it
  if (archived) console.log(`🗄️  ${archived} old entries moved to the archive`);

  const brief = (f) => (f ? { title: f.title, text: f.text } : null);
  for (const b of state.blueprints) { // what a built thing still lacks, as it is now
    const e = b.thing ? state.decor.find((d) => d.name === b.thing) : null;
    if (e) b.gaps = blueprintGaps(b, e);
  }
  state.last = {
    at: new Date(startedAt).toISOString(),
    model: usedModel,
    tokens: { ...spent },
    intervalMin: INTERVAL_MIN,
    thought: text(answer.thought, 200),
    inner: text(answer.inner, 600),
    sent: sent.length > 0,
    steps: steps.map((st, i) => ({ action: st.action, details: st.details, detail: results[i].detail, thought: st.thought, working_on: st.working_on || undefined, enjoyment: results[i].enjoyment, found: brief(st.found), made: st.made?.entry ? { id: st.made.entry.id, stand: st.made.entry.stand, pos: st.made.entry.pos } : st.made?.ref ? { id: st.made.ref.id, stand: st.made.ref.stand, pos: st.made.ref.pos, used: true, does: st.made.ref.does, motion: st.made.ref.motion } : st.made?.stored ? { chest: true } : st.made?.app ? { app: st.made.app } : null })),
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
  // A rate limit is not a crash: Pip naps and this wake-up ends quietly, so GitHub does not send failure emails.
  if (!process.env.PIP_AWAKE && !process.env.PIP_FAKE) {
    if (e.message.startsWith('Rate limit')) await napForLimit().catch(() => {});
    else await noteError(e).then((st) => writeFile(STATE_FILE, JSON.stringify(st, null, 2))).catch(() => {});
  }
  process.exit(e.message.startsWith('Rate limit') ? 0 : 1);
}
