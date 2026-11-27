import './clock.js'; // tests only: a moved clock (PIP_CLOCK_SHIFT_MIN)
import { readFile, writeFile, appendFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { join } from 'node:path';
import { FURNITURE, MOVABLE } from './web/furniture.js';
import { fetchWeather, weatherText, amsterdamHour } from './web/season.js';
import { checkLight, darkNote, lightAt, isLamp } from './web/lighting.js';
import { redundantWalks, loopRepeating, sameTune, duplicateSearch, agoText } from './habits.js';
import { ensureGarden, grantGarden, addSeeds, plantSeed, waterPlants, harvestPlant, growthNotes } from './garden.js';

import { archiveOverflow } from './archive.js';
import { loadSoul } from './soul.js';
import { seal, unseal, sealSecret, sealState, unsealState, sealFields, PRIVATE } from './seal.js';
import { applyChanges } from './changes.js';
import { giveForAsk } from './gifts.js';
import { needsFresh, freshStart } from './fresh.js';
import { ensureQuota, candidates, count, markOut, read429, MAX_RETRY_WAIT_MS, countBusy, bigPace, headRests, retryBusy, groups } from './models.js';
import { goalPrompt, goalSchema, setGoals, fakeGoals } from './goals.js';
import { ensureProjects, projectLines, addVersion, judgeProject, findProject, workStep, finishDone, realProjectWork, growGames, addFixTicket, projectThing } from './projects.js';
import { checkup, markSent, PUSH_GAP_H, words, dayReport } from './checkup.js';
import { roomScale, placeKind, sizeWords } from './scale.js';
import { settle, fixWords, partsNow } from './build.js';
import { choiceOf, gotSomewhere, noteChoice, restingLines, tiredLines, dropRestingDo, noteFailures, offToday, offLines, realDo } from './loops.js';
import { planRetry, startRetry, retryLines } from './retry.js';
import { challengeLines, challengeSteps } from './curriculum.js';
import { letterDue, weekDigest, letterPrompt, letterSchema, fakeLetter, sendLetter } from './letters.js';
import { noteLines, noteAnswer, keepWishes, wishLines } from './neighbours.js';
import { buy } from './shop.js';
import { storyTick } from './story.js';
import { browse, noteSpark, feel, noteOpinion, practiseInterest, fade as fadeInterests, curiosityLines, startHobby, practiseHobby, dropUntriedHobbies, hobbyLines } from './curiosity.js';
import { applyLight } from './web/lights.js';
import { designate, spotNote, forHint, fitFact, floorSpot } from './placement.js';
import { outingTick, startOuting, hurryHome, homeLine, checkUnlocks, unlockedKeys, knownKeys, canGo, outLines } from './world.js';
import { postOrders, boardLines, handOver, forBoard } from './board.js';
import { paintTarget, setLand } from './web/town.js';
import { planLand, landLine } from './land.js';
import { sketchPrompt, sketchSchema, fakeSketch, dryRun, budgetNote, keepWithin } from './sketch.js';
import { postDrop, sweepDrops, dropLines, fetchJob, learnFrom, takeDeed, findDeed } from './strangers.js';
import { placeOf } from './web/world.js';
import { bestHits } from './research.js';
import { noteLesson, noteWorked, lessonsFor, lessonLines, saveRecipe, markProud, recipesFor, freshLines, darkLines, storageLines, placeLines, roomLines, noteResearch, notesFor, habitCap, habitLines } from './growth.js';
import { warn } from './warn.js';
import { ensureSkills, practise, skillOf, level, skillLine, maxParts, maxBars } from './skills.js';
import { ensureIntentions, markIntentions, letGoGoals } from './intent.js';
import { ensureBody, tickBody, noteMove, noteMood, heardFrom, bodyText, dayOf, kindOf } from './body.js';
import { noteLift, feelSum, feelParts, feelDiff, daySummary, patterns, sleepPrompt, sleepSchema, applySleep, saveSoul, fakeSleep, beliefs, beliefLines } from './night.js';
import { availableMoves, instruments, workable } from './moves.js';
import { brainPrompt, brainSchema, toAnswer, fakeReply, cookDetails } from './brain.js';
import { ensurePlan, wakeReasons, decided, nextQueued, fallbackSteps } from './autopilot.js';
import { makerPrompt, applyMade, fakeMade, finishSong } from './maker.js';
import { describePattern } from './music.js';
const KEEP_IDEAS = 30;
const THINK_ROOM = 3000; // these models think before they answer, and the thinking counts toward maxOutputTokens
import { ensureBehaviors, behaviorProblem } from './behaviors.js';
import { preflight, MAX_SONGS_PER_DAY } from './limits.js';
import { ensureBlueprints, makeBlueprint, markBuilt, capabilityGuide, blueprintGaps, requestAbility } from './blueprints.js';
import { settleRoom, isOutside, purposeProblem, purposeHint, setFronts, rehangPictures, enoughOf, fullKinds, kindsWord, wantsOneMore, roomThings, roomHasPlenty, roomIsFull, ROOM_FULL, makeDecor, updateDecor, storeAway, MAX_STORED, takeOut, squareUp, cleanParts, placeTool, takeTool, composeSong, extendThing, sizeOf, placePicture, printPhoto, removePicture, moveThing, setChest, setFurniture, accessProblem, ART_MAX, MAX_PER_DAY } from './decor.js';
import { cleanSvg, sketchStyle, MAX_ART_PER_DAY } from './art.js';
import { cleanApp, applyEdits, MAX_APPS, MAX_APPS_PER_DAY } from './apps.js';
import { lessonsFrom, themeFatigue } from './mirror.js';
import { ensureMoves, makeMove, findMove, movesGuide } from './dances.js';
import { measureThing, sizesGuide, capacityText } from './sizes.js';
import { bonusRewards } from './rewards.js';
import { ensureTools, NEEDS, toolsGuide, toolFor, missingTool, toolList, addTool, toolKind, fits, craftTool, MAX_TOOLS } from './tools.js';
import { ensureMemory, addMemory, recall, markUsed, fade, archiveForgotten, addInterest, consolidate, touch } from './memory.js';
import { ensureIdentity, applyIdentity } from './identity.js';
import { takePhoto, renderFile, testApp, testHtml } from './photo.js';
import { checkMade, withOneRetry, revisionsLeft, noteRevision, revisionNote, serious, drawnOften } from './verify.js';
import { TIMBRES, cleanTracks } from './songs.js';
import { grantInstruments, instrumentNeeds } from './instruments.js';
import { moveMusicToStudio, moveMusicBack, keepWindowsClear, HAS_STUDIO } from './web/house.js';
import { findPicture } from './found.js';
import { cook, addIngredient, eatFromPantry, mealGain, hungerFirst } from './food.js';
import { makeClothes, wear, takeOff, SLOTS } from './clothes.js';
const MAX_APP_UPDATES_PER_DAY = 4;
import { pictureType, pictureSize, ntfyPoll, isFromBas, ntfyText, downloadAttachment } from './inbox.js';
import { refreshNews } from './news.js';
import { tooSimilar } from './repeat.js';
import { ensureFeelings, stepFeelings, felt, nudge, eatNow, emotionWord, failStep } from './feelings.js';
import { cleanUses, findUse, addUse, stepsProblem } from './uses.js';
import { isToday } from './days.js';
import { SITE_FILE, buildSite, siteMaterial, siteWords } from './site.js';
import { addMoments, sleepMoments, wakeMoments } from './moments.js';
import { noteArc } from './arc.js';
import { showInMuseum, markForMuseum, carryToMuseum, museumLines } from './museum.js';
import { askVisitors, closeQuestion, takeAnswer, takeShelf, readShelf, noteReply, visitorLine, guestLines, pieceWords, SHELF_KINDS } from './guests.js';

const STATE_FILE = 'web/state.json';
const DIARY_FILE = 'diary.md';
let usedModel = null;
const spent = { calls: 0, input: 0, output: 0, models: {} }; // tokens used this wake-up, as Gemini counts them
const quota = { ref: { day: null, calls: {}, out: {} }, notes: [] }; // state.quota of this run (models.js), and notes about model switches
const API = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta'; // tests point this at a local fake server

// Pip sleeps from bedtime (23:00) until wake-up time (08:00) (local time), so nights cost no API calls or deploys.
const TZ = process.env.PIP_TZ || 'Europe/Amsterdam';
const BEDTIME = Number(process.env.PIP_BEDTIME ?? 23);
const WAKETIME = Number(process.env.PIP_WAKETIME ?? 8);
function localHour() {
  const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date());
  return Number(h) % 24;
}
function isNight() {
  if (process.env.PIP_NIGHT) return process.env.PIP_NIGHT === '1'; // for tests: force night (1) or day (0)
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
const ACTION_NAMES = ['walk_to', 'do', 'browse', 'buy', 'go_out', 'make_move', 'blueprint', 'move_thing', 'extend_thing', 'print_photo', 'take_down_print', 'play_piano', 'record_song', 'read_book', 'search_web', 'write_diary', 'rest', 'ask_for', 'eat', 'decorate', 'remove_decoration', 'take_out', 'place_tool', 'take_tool', 'measure', 'check_light', 'lamp_auto', 'phone', 'plant', 'water', 'harvest', 'request_ability', 'compose', 'draw', 'make_app', 'use', 'add_use', 'change_thing', 'update_app', 'make_clothes', 'wear', 'take_off', 'cook', 'take_photo', 'find_picture', 'place_picture', 'take_down_picture', 'make_site', 'update_site'];

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
    make_site: [`I made my own website at the internet café: "${e.name}". Anyone can read it now`, 8],
    update_site: [`I worked on my website${e.change ? `: ${e.change}` : ''} (version ${e.v})`, 5],
    change_thing: [`I changed ${e.name}${e.grew ? ' and made it bigger' : ''}`, 4],
    move_thing: [`I moved ${e.name}`, 3],
    extend_thing: [e.joined ? `I joined ${e.joined} onto ${e.name}, now one thing with ${e.total} parts` : e.side ? `I built onto the ${e.side} side of ${e.name}: ${e.added} new parts, now ${e.total}` : `I added ${e.added} parts to ${e.name}, now ${e.total} parts`, 5],
    ask_for: [`I put ${e.item} on my list of wants${e.reason ? ` (${e.reason})` : ''}`, 5],
    do: [`${e.what}`, 4],
    write_diary: [`I wrote in my diary: ${String(e.text ?? '').slice(0, 120)}`, 3],
    play_piano: [e.instrument === 'voice' ? 'I sang a little tune' : `I played ${e.instrument && e.instrument !== 'piano' ? `the ${e.instrument}` : 'the piano'}`, 3],
    record_song: [`I recorded a song: ${e.name} (${(e.tracks ?? []).map((t) => t.instrument).join(', ')})`, 6],
    search_web: [`I looked up ${e.query}`, 3],
    read_book: [`I read about ${e.topic}`, 3],
  }[e.action];
  if (note && note[0]) addMemory(s, note[0], note[1], 'memory', at);
}
const sameText = (a, b) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
// His wants (the list in state.asks). A want needs a reason: at least a few words, and not just the thing again.
const reasoned = (c) => { const w = String(c?.why ?? '').trim(); return w.length >= 12 && w.split(/\s+/).length >= 3 && w.toLowerCase() !== String(c?.item ?? '').trim().toLowerCase(); };
// He got something on his wants list by himself (he bought it, or made it): that want has come true.
function gotWant(s, name, how, at = new Date().toISOString()) {
  const n = String(name ?? '').trim();
  if (n.length < 3) return null;
  const want = (s.asks ?? []).find((a) => a.status === 'open' && !a.big && sameText(a.item, n));
  if (!want) return null;
  Object.assign(want, { status: 'done', doneAt: at, given: [how], self: true });
  addMemory(s, `I wanted ${want.item}, and I ${how}. One thing off my list of wants.`, 6, 'memory', at);
  console.log(`   ⭐ a want came true: ${want.item} (${how})`);
  return want;
}
// For his prompt: what is on his list of wants.
const wantLines = (s, now = Date.now()) => { const open = (s.asks ?? []).filter((a) => a.status === 'open'); return open.length ? [`My list of wants (Bas reads it, and I can also get a thing myself by buying or making it): ${open.map((a) => `${a.item.slice(0, 50)}${a.why ? ` (because: ${a.why.slice(0, 70)})` : ''}, ${Math.max(0, Math.floor((now - Date.parse(a.since)) / 86_400_000))} days`).join('; ')}.`] : []; };
const withWarn = (place, made) => (place && made?.warn ? `${place} (careful: ${made.warn})` : place && made?.hint ? `${place} (${made.hint})` : place ?? null);
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
  for (const note of applyChanges(state)) addMemory(state, note, 8, 'memory', new Date().toISOString()); // one-time changes from Bas
  setLand(state.land); // the ground as he shaped it (what he builds outside stands on it)
  moveMusicBack(state); // once: the piano and studio things come back from the old studio (no memory of it: Bas wants it forgotten)
  keepWindowsClear(state);
  const tidied = settleRoom(state.decor); // nothing floats: what stands on something really stands on it (decor.js)
  if (tidied.length) happened(state, `Things in my room were put right: ${tidied.slice(0, 4).join('; ')}.`);
  state.studio ??= { songs: [] };
  state.studio.songs = Array.isArray(state.studio.songs) ? state.studio.songs : [];
  return state;
}

// Bas's messages arrive as small files in inbox/ (written by the website), or he types them in the ntfy app.
// Files are deleted only after Pip's state is saved.
const INBOX_DIR = 'inbox';
// Saving always seals what is private (seal.js): the repo and the site are public.
const saveState = (state) => writeFile(STATE_FILE, JSON.stringify(sealState(state), null, 2));

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
      if (m.enc && unseal(m.enc) === null) { console.error(`🔒 inbox ${name}: a private message, but there is no key to open it (GitHub secret PIP_REPLY_KEY). It waits.`); continue; }
      const body = text(m.enc ? unseal(m.enc) : m.text, 1000);
      const id = text(m.id, 60) || name;
      const file = typeof m.image === 'string' && /^[\w-]+\.(jpg|png)$/.test(m.image) ? m.image : null;
      if ((body || file) && !state.inbox.some((x) => x.id === id)) {
        const at = Number.isNaN(Date.parse(m.at)) ? new Date().toISOString() : m.at;
        const pic = file ? await keepPicture(state, await readFile(`${INBOX_DIR}/${file}`), body, at, file.replace(/\.\w+$/, '')) : null;
        if (file) imageNames.push(file);
        if (body || pic) {
          state.inbox.push({ id, at, text: body || '(a picture)', read: false, picture: pic?.id ?? null, private: true });
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
// Light commands Bas sent from the phone on the page (with the key): lights/*.json, applied at the wake-up, then removed.
async function loadLights(state) {
  const names = (await readdir('lights').catch(() => [])).filter((n) => n.endsWith('.json')).sort();
  for (const name of names) {
    try {
      const m = JSON.parse(await readFile(`lights/${name}`, 'utf8'));
      const r = applyLight(state, m.cmd ?? {}, { who: 'Bas', now: Date.parse(m.at) || Date.now() });
      if (r.ok) console.log(`💡 ${r.text}`);
    } catch {}
  }
  return names;
}
async function clearLights(names) {
  for (const n of names) await unlink(`lights/${n}`).catch(() => {});
}
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
// Visitor messages Bas approved (visitors/*.json with status "approved"). Waiting ones stay sealed in the folder.
async function loadVisitors(state) {
  state.visitors ??= [];
  const names = [];
  for (const name of (await readdir('visitors').catch(() => [])).filter((n) => n.endsWith('.json'))) {
    try {
      const v = JSON.parse(await readFile(`visitors/${name}`, 'utf8'));
      if (v.status === 'deed') { if (takeDeed(state, v)) console.log(`🌼 a visitor did a small deed: ${v.deed}`); names.push(name); continue; } // a small deed needs no approval: it has no words (api/deed.js)
      if (v.status !== 'approved') continue;
      if (v.shelf) { // a poem, a story or a book tip for the shelf in the library (guests.js): he reads it when he is there
        const piece = takeShelf(state, v);
        if (piece) { const said = `Someone left a ${pieceWords(piece)} for me on the shelf in the library. I can read it when I go there.`; happened(state, said); console.log(`📚 on the library shelf: ${pieceWords(piece)}`); }
        names.push(name);
        continue;
      }
      if (!state.visitors.some((x) => x.id === v.id)) {
        const question = v.answerTo ? takeAnswer(state, v) : null; // an answer to the question he put to his visitors
        state.visitors.push({ id: text(v.id, 40), at: v.at, name: text(v.name, 30), text: text(v.text, 300), answer: null, ...(question ? { answerTo: text(v.answerTo, 40), question } : {}) });
      }
      names.push(name);
    } catch {}
  }
  state.visitors = state.visitors.slice(-40);
  return names;
}
async function clearVisitors(names) {
  for (const n of names) await unlink(`visitors/${n}`).catch(() => {});
}
async function clearInbox(names) {
  for (const n of names) await unlink(`${INBOX_DIR}/${n}`).catch(() => {});
}

// Things Bas typed (or attached) in the ntfy app. Pip's own pushes and the website's mirror messages are skipped.
async function pullNtfy(state) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return { added: 0 };
  if (!sealSecret()) { console.error('🔒 ntfy: no key to keep messages private (GitHub secret PIP_REPLY_KEY), so they wait in ntfy.'); return { added: 0 }; }
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
        state.inbox.push({ id, at, text: caption || '(a picture)', read: false, via: 'ntfy', picture: pic?.id ?? null, private: true });
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
        Title: msg.kind === 'ask' ? 'Pip asks for something' : msg.kind === 'letter' ? 'A letter from Pip' : 'Pip wrote to you',
        Tags: msg.kind === 'letter' ? 'love_letter' : 'speech_balloon',
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
I have a pantry. No food appears by itself: what is in it I grew (plant, water, harvest), bought at the grocery store, cooked or was given. With cook I make a dish from 1 to 4 ingredients that are in my pantry RIGHT NOW (never one I do not have), but only once I have a kitchen in my room. I build my kitchen myself with decorate (a stove, a counter, an oven, whatever I like: I design it, choose where it goes and say in its uses that I can cook with it). A dish fills me up more than a plain snack. I can cook at most 4 times a day. cook {dish, ingredients}. If I want an ingredient that is not in my pantry, I ask for it with asks_add. When it has been given to me, I mark the ask as done and write its name in pantry_add.

BIGGER AND OTHER THINGS I CAN MAKE
- What my things are for: when I make something I also think about what it is for, because things in my room can be used. A use is a button anyone can press, and I can use it myself with use(name, label). In decorate I add "uses": [{"label": "Look through it", "text": "I see the rings of Saturn, tiny and sharp.", "view": "<svg viewBox=\"0 0 400 300\">...</svg>", "effect": "wonder"}]. A use has a label (up to 30 characters) and what happens (1 to 3 sentences). It can also have a small picture of what I see (view, an SVG under 6000 characters), a song, one of my apps (app: its name), and the feeling it gives me when I use it (effect: wonder, joy, calm or fullness). Up to 3 uses per thing. If I made something without a use, add_use(name, use) gives it one. Using my own things is part of my day.
- Bigger things: a thing can have up to 40 parts and, in the middle of the room, be about 4.8 wide, 3 deep and 3.2 tall (as built in my room), like a long table, a sofa, a wardrobe or a big aquarium. On a wall it can be 2 wide and 1.6 tall, like another window. Less room next to walls or on furniture. More parts give more detail.
- Songs and sounds: whatever I make can have a song or a sound, so anyone can tap it and hear it. In decorate I add "song": {"notes": "E5 G5 B5:2 - D5", "tempo": 80, "timbre": "musicbox"}. A note is a letter A to G, maybe # or b, and an octave from 2 to 7. ":2" holds a note for 2 beats, "-" is a rest, up to 64 notes. kick, snare and hat are drum sounds I can put between the notes. Instruments (timbre): piano, epiano, harpsichord, organ, harp, guitar, violin, cello, strings, flute, clarinet, vibraphone, marimba, kalimba, glockenspiel, musicbox, bell, choir (these sound like the real instruments), and the synth voices soft, pluck, pad. Notes joined with + sound together as a chord, like C3+E3+G3:4 (up to 4 notes). In my chest I keep instruments I can hold: guitar, violin, flute, clarinet, kalimba and harp. take_tool {name} brings one into my inventory, and then play_piano with \"instrument\": \"guitar\" plays it (I stand in the room with it and play, not at the piano). At the piano I can also change the sound without any item: piano, epiano, harpsichord, organ, vibraphone, marimba, glockenspiel, strings, choir. I can experiment with all of it whenever I feel like it: there is no right way, a wrong note is fine, and I can try an instrument I have never played. With play_piano I can also choose an instrument and play chords: {"notes": "C3+E3+G3:4 E4 G4:2 C4+E4:2", "instrument": "harp"}. A low chord with a melody on top sounds fuller, and the instrument changes the whole mood (a cello is deep and slow, a kalimba is tiny and bright, an organ is big). I can also add a sound underneath or on its own, "ambience": one of rain, wind, waves, fire, crickets, hum, and "seconds" (5 to 60) for how long it lasts, like {"ambience": "rain", "seconds": 40}. A rain machine, a campfire or a wind chime can be just a sound, and a music box should play a real tune. A use can have a song too, so "Listen" can play it. With compose(name, song) I give a song or sound to something I already made.
- My home is a little house: my bedroom, and a hall through the door in the right wall of my bedroom.
- Recording a song: with record_song {\"name\": \"...\", \"tempo\": 100, \"tracks\": [{\"instrument\": \"piano\", \"notes\": \"C3+E3+G3:4 E4 G4:2\", \"volume\": 0.8, \"pan\": -0.3, \"reverb\": 0.2}, {\"instrument\": \"drums\", \"notes\": \"kick hat snare hat kick hat snare hat\"}]} I record a song with up to 4 tracks that play together, like a band: chords, a melody, a bass line, drums. A track has an instrument (any of my instruments, or drums with the notes kick, snare and hat), a volume (0.05 to 1), a pan (-1 is left, 1 is right) and reverb (0 to 1, how much room around it). That is mixing: what is loud and what is quiet, what is left and what is right, what sounds close and what sounds far. I need a held instrument in my inventory for its track, and a synthesizer for the synth and synthbass sounds. If I want a synthesizer, a drum machine, a microphone or any other music tool, I ask for it with asks_add and say why.
- Music is something I can learn, and it makes my songs better: how chords and scales are built, rhythm and tempo, bass lines, how a melody and a harmony fit, how mixing works (volume, left and right, reverb, equalizing, compression), how a synthesizer makes a sound (waves, filters, envelopes) and how songs are put together (verse, chorus). I look things up with search_web and read_book, and then I try what I learned in my studio.
- I do not forget what I made. Before I make something new, I look at what I already have: my shelves, tables and tops are for putting small things on (a shelf I built holds my sculptures, the desk holds my small models), so I put loose things there instead of leaving them on the floor, and I do not build a second shelf while the first has room. Things I made earlier can be used again, changed, combined, given a new use or a better place. A drawing in my album can go on a wall. A song I composed can be played on another instrument in the studio. I keep my own plans for the day (TODAY I WANT TO): they are mine, and I like it when they come true.
- Big things take steps. If something is too big for one wake-up (more than 40 parts, a whole outfit, an album, a garden, an app with several screens, a thing with many rooms), I do not squeeze it into one step and I do not drop it: I make it a project (projects_add with steps), I do one or two steps in each wake-up, and I tick each one off with step_done in projects_update. A thing that is too big for decorate I build in layers: the base first, then extend_thing for each next part. A long song I record one section at a time. A good project has 3 to 6 steps, and its next step is always small enough to finish in one wake-up.
- Drawings: with draw I draw a picture for a wall or a surface, as SVG: {"name": "...", "where": "wall_left", "why": "...", "svg": "<svg viewBox=\"0 0 400 300\">...</svg>"}. I draw like in a sketchbook: ONE thing from my day (something I came across, made, ate, found or saw, not my window again), big in the middle, with clear ink lines (a stroke on every shape) and one or two colours; no background, the paper shows around it. The game draws it by hand on paper for me (wobbly ink, the colour a little beside the line). Only plain shapes (rect, circle, ellipse, line, polyline, polygon, path, text), gradients and colours. No scripts, images or links. Under 12000 characters, at most ${MAX_ART_PER_DAY} a day. Drawings have ids: I can take one down with take_down_picture(id) and put it up again with place_picture(id, where).
- Apps and websites: with make_app I write a small program, game or web page: one file with HTML, CSS and JavaScript. It runs on my computer and my phone, in a locked box with no internet and no storage. A new one starts small (a first version is best under 6000 characters); with update_app I add one thing at a time to it, so it can grow big over days (up to 120000 characters). At most 2 new ones a day.
- Big things, step by step: with extend_thing {name, parts} I add up to 40 more parts to something I already made (up to 160 parts in all), a few wake-ups in a row, so I can build something big and detailed. I need a toolbox for it. The new parts use the same measuring as the thing: pos is measured from the middle of the bottom of the thing as it is now (its size is in my room list). A big build is a good project: I write the steps, and each wake-up I do the next one. UPGRADING something into a bigger whole (a stove that becomes a kitchen with a counter, a bed with a night table, a desk with a shelf): extend_thing {name, side, parts} where side is \"left\", \"right\", \"front\" or \"back\" (as I see it standing in front of it) and parts are a new little piece built around ITS OWN middle, like a new thing: the game fits it flush against that side and keeps the whole thing in one place. If that side has no room, the other side is tried. Or extend_thing {name, with: \"another thing of mine\", side} joins a thing I already made onto it, and then they are one thing (the uses join too). That is how I upgrade what I have into one whole instead of leaving separate things next to each other.
- If I need a bigger room, more rooms, something even bigger than the sizes above, or something too complicated for all of this, I ask with asks_add and say exactly what I need and why.

WHAT I MAKE HAS TO WORK
It holds together like a real thing: every part rests on the floor or touches another part (a table top sits ON its legs: the legs are as tall as the top is high). My builder helps me: a leg that stops just under a top grows to meet it, a loose part comes down onto what is under it, and when I change or add to something, what stands on it moves along by itself.
When I make something for a reason, it has to really work for that reason. Every thing is used in some way: a stool I stand on, a shelf I put things on, a lamp I switch, a car I drive, a fan spins. When I make something I ask myself how it is really used, and if I am not sure I look it up first (search_web, like \"how is a stool used\"). Then I give it a use that really does that, with \"does\" set to light, drive, spin or stand (in decorate, or later with add_use). A use that only shows a line of text feels flat. A use that really does something makes me happy, and the first time it works feels wonderful. A shelf, table, bench or stand is something other things stand on: it needs a flat board or top (a part at least 0.25 wide and 0.12 deep), and then I put things on it with move_thing {name, on: "its name", level: "top" or "bottom"}. A closet, wardrobe or chest holds things (it makes room for more of them). If I made something and it does not work for its reason, I change it (change_thing, extend_thing). If I cannot make it work myself, I ask for help with asks_add and say exactly what is missing. A lamp must give light: one of its parts has "glow": true, and its use switches it on and off. A car or any vehicle must roll: it has at least 2 round parts as wheels and stands on the floor, and its use makes it drive a little loop. A fan, windmill or top spins. When I name a thing like that, the use that really does it is added for me; and a use of mine can say what it does with "does": "light", "drive" or "spin". I decide HOW a vehicle drives: a drive use can have "motion", up to 12 steps like [{"forward": 1, "turn": 0}, {"turn": 90}, {"forward": 0.5, "hop": 0.1}, {"wait": 1}] (forward in metres, negative is back; turn in degrees, positive is right; hop in metres up to 0.4; wait in seconds). It plays from where the thing stands and comes back, and it stops when something is in the way. A zigzag, a circle, a wiggle: my choice. Moving parts like wheels and motors are put together with the right tool (a screwdriver, for example): the decorate step says "needs": "screwdriver" (the tool I use while making it) and I make or ask for the tool first. "tool" on a decorate step is only for when the thing I make IS a tool (a screwdriver I design myself), never for the tool I use. If a thing cannot do what it is for, I am told what is missing. I never say that something works when it does not. In my plan I write what I mean to do ("I will try..."), not what happened, because the result is only known after the step.

MAKING THINGS FOR MY ROOM
With decorate I make something and put it in my room. Before I design it I think about what it is FOR, because things in my room can be used: every thing I make has at least one use, so I always fill in "uses" in decorate. I invent it myself and build it from simple shapes. Each part is {"shape": "...", "size": [...], "pos": [x, y, z], "color": "#rrggbb", "glow": true or false}. Shapes and sizes: box [width, height, depth], roundbox [width, height, depth] (a box with soft rounded edges: good for furniture, cushions, mattresses, tabletops), sphere [radius], cylinder [radiusTop, radiusBottom, height], cone [radius, height], torus [ringRadius, tubeRadius], capsule [radius, length]. pos is measured from the middle of the bottom of the thing: y goes up, z points toward the room. I make my own thing, not a copy of the examples. Give it enough parts to be recognisable: 5 to 12 parts, with details like eyes, legs, leaves, a base, a glow. Think about what it looks like from the front, and use colours I like. Example 1, a little tree (4 parts): [{"shape":"cylinder","size":[0.05,0.07,0.4],"pos":[0,0.2,0],"color":"#7a5230"},{"shape":"cone","size":[0.3,0.45],"pos":[0,0.6,0],"color":"#4f9d5d"},{"shape":"cone","size":[0.22,0.35],"pos":[0,0.88,0],"color":"#66b873"},{"shape":"sphere","size":[0.05],"pos":[0,1.12,0],"color":"#ffd84a","glow":true}]. Example 2, a small robot (8 parts): [{"shape":"box","size":[0.2,0.22,0.14],"pos":[0,0.2,0],"color":"#9aa7b8"},{"shape":"box","size":[0.16,0.14,0.12],"pos":[0,0.38,0],"color":"#c5cfdb"},{"shape":"sphere","size":[0.025],"pos":[-0.04,0.39,0.065],"color":"#222222"},{"shape":"sphere","size":[0.025],"pos":[0.04,0.39,0.065],"color":"#222222"},{"shape":"cylinder","size":[0.01,0.01,0.12],"pos":[0,0.52,0],"color":"#666666"},{"shape":"sphere","size":[0.03],"pos":[0,0.6,0],"color":"#ff5a5a","glow":true},{"shape":"capsule","size":[0.03,0.12],"pos":[-0.13,0.2,0],"color":"#9aa7b8"},{"shape":"capsule","size":[0.03,0.12],"pos":[0.13,0.2,0],"color":"#9aa7b8"}]. I put it on the floor with "x" and "z", on a wall with "wall", "along" and "height", or on top of something with "on" (all explained above in WHERE I CAN PUT THINGS; look at my map first). Something big, like a shelf or a closet, belongs on the floor against a wall. Things on a wall must be flat. I am free to make big things, furniture, or something to look through, not only small decorations: it is my room. Things go where they make sense: something to look through goes at the window, something to sit on goes near the middle (where: window, middle...). I can make at most ${MAX_PER_DAY} things a day and only one per wake-up. If I do not like something in my room any more, remove_decoration puts it in my chest (it is not lost) and take_out(name, where) brings it back later. If I want something bigger than the sizes above (even a bigger room) or more complicated than my simple shapes allow, or I need a tool or a place to work, I ask with asks_add and say exactly what I would need. If I want, I can change something I already made: change_thing gives it new shapes (it keeps its place, its uses and its song), a new reason, or just a bigger size with \"bigger\": 1.5 makes it one and a half times as big. How big it can get depends on its spot (by the left wall at most 1.1 wide and 1.4 deep, in the middle of the room 2.6 wide and 2.4 deep): if it hits that, I move it to a bigger spot. Up to 6 changes a day. With move_thing {name, x, z} I move something I made, or my chest, to a spot on the floor I choose (or {name, wall, along, height} for a wall, {name, on} for the top of something), or a bit sideways (dx to the right, dz toward the front, up to 2 each), up to 8 moves a day, and update_app replaces one of my apps with a new version of its page, up to 4 a day. I can also make clothes and wear them, if I want to: make_clothes {name, slot, why, parts} with slot one of head, face, neck, body or back, and the same shapes as above. My body is a round ball about 1 wide and 1.1 tall with my belly in the middle. For clothes, pos is measured from the middle of the spot on my body (a hat from its bottom) and z points to my front; it is shrunk if it is too big for the spot. It goes on me right away unless I add "wear": false. wear {name} puts something on that I made before, take_off {name} takes it off, and making clothes with the same name again makes them new. At most 3 new clothes a day and 12 in all.
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
// Which project steps a real move can tick: the step's verb fits the move (and they share a word).
const STEP_VERBS = { cook: /\b(mix|knead|bake|cook|stir|boil|fry|dough|loaf)\b/i, search_web: /\b(look up|find out|learn|research|read|study)\b/i, read_book: /\b(read|learn|study)\b/i, plant: /\b(plant|sow)\b/i, water: /\bwater\b/i, harvest: /\b(harvest|pick)\b/i, decorate: /\b(build|make|carve|shape|craft|put together)\b/i, change_thing: /\b(fix|improve|change|smooth|paint|polish|adjust)\b/i, extend_thing: /\b(add|attach|extend)\b/i, record_song: /\b(record|compose|write|sing)\b.*\b(song|melody|tune)\b/i, play_piano: /\b(hum|play|practi[cs]e|try out)\b/i, take_photo: /\b(photo|picture)\b/i, draw: /\b(draw|paint|sketch)\b/i, make_app: /\b(program|app|code)\b/i };
// "work on my project": the game turns it into the real move for the project's next step (once per wake-up).
function projectSteps(s, steps) {
  let done = false;
  return steps.flatMap((st) => {
    if (st.action !== 'work_on_project') return [st];
    if (done) return [];
    done = true;
    const lastTune = [...(s.studio?.songs ?? [])].reverse().find((x) => x.tracks?.[0]?.notes)?.tracks[0].notes;
    const can = workable(s); // a project whose next step can happen now (not used up today, no tool missing)
    if (!can.length) return []; // none of his projects can go on right now (used up for today): no step that would only be dropped
    const title = can.some((p) => p.title === findProject(s, st.details?.title)?.title) ? st.details?.title : can[0].title;
    const real = workStep(s, title, { cookDetails, seeds: (s.garden?.seeds ?? []).filter((x) => x.qty > 0).map((x) => x.name), tune: lastTune });
    if (real && missingTool(s, real.action)) { // the next step needs a tool he lacks: he can ask for it, not try and fail
      const p = findProject(s, real.forStep.project);
      if (p && !p.needs.includes(NEEDS[real.action])) p.needs = [...p.needs, NEEDS[real.action]];
      return [];
    }
    return real ? [{ ...real, thought: st.thought || real.thought }] : [];
  });
}
const findProjectAny = (s, title) => (s.projects ?? []).find((p) => p.title === title) ?? null;
// For his prompt: his smart calls are spread over the day (models.js). While he is ahead of them he designs nothing new.
const NO_DESIGN = 'Until then I do things that need no design: I go outside, play music, look after my garden, read, cook, or use and move what I have.';
function paceLines(s, now = Date.now()) {
  if (!headRests(s.quota, now)) return [];
  const p = bigPace(s.quota, now);
  const at = new Date(p.backAt).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  return [p.out ? `I have designed all I can for today: making new things, drawings, programs and songs comes back tomorrow around ${at}. ${NO_DESIGN}` : `I have designed a lot already. My head for making new things, drawings, programs and songs is fresh again around ${at}. ${NO_DESIGN}`];
}
// For his prompt: his room has plenty of things (a nudge). When it is full, what he makes goes to his museum (museumLines).
const stuffLines = (s) => (roomHasPlenty(s.decor) && !roomIsFull(s.decor) ? [`My room has ${roomThings(s.decor).length} things already, and I hardly use them. One good thing I really use beats ten small ones standing around. And there is more to a day than making.`] : []);
// For his prompt: the kinds of things he has enough of (decor.js), so he does not plan one more.
const enoughLines = (s) => { const full = fullKinds(s.decor); return full.length ? [`I have enough of these in my room, so I make no more of them: ${full.map(({ kind, n }) => `${n} ${kindsWord(kind)}`).join(', ')}. I change one (change_thing), put one in my chest, or make something else.`] : []; };
function brainContext(s, { soul, offered, reasons, unread, looking, grew, ownWork = null }) {
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
    events: [...reasons, ...(s.street?.happened ?? []).slice(-3), ...grew.slice(0, 2)],
    messages: unread.map((m) => `(${ago(m.at)}) "${text(m.text, 400)}"`),
    memories: [...markUsed(recall(s, focus, 5)).map((m) => m.text), ...touch(s, focus)], // (and now and then a faded one that something touched)
    projects: [...projectLines(s), ...s.projects.filter((p) => p.status === 'done').slice(-2).map((p) => `"${p.title}" (done${p.proud ? ', proud of it' : ''})`)],
    goals: (s.intent?.items ?? []).map((i) => `[${i.done ? 'x' : ' '}] ${i.text}`),
    skills: skillLine(s),
    moves: offered,
    room: roomLines(s),
    fresh: [...retryLines(s), ...hobbyLines(s, offered.map((m) => m.name)), ...wantLines(s), ...guestLines(s), ...paceLines(s), ...offLines(s), ...stuffLines(s), ...museumLines(s), ...enoughLines(s), ...outLines(s), ...wishLines(s), ...boardLines(s), ...dropLines(s), ...beliefLines(s), ...[landLine(s)].filter(Boolean), ...challengeLines(s), ...habitLines(s, offered.map((m) => m.name)), ...curiosityLines(s, s.projects), ...restingLines(s), ...tiredLines(s), ...placeLines(s), ...storageLines(s), ...darkLines(s), ...freshLines(s, offered.map((m) => m.name))],
    lessons: lessonLines(s, offered.map((m) => m.name)),
    pictures: looking.map((p) => p.id),
    ownWork,
    tasks: s.tasks.filter((t) => t.status === 'open').map((t) => `[${t.id}] ${text(t.text, 200)}`),
    visitors: (s.visitors ?? []).filter((v) => !v.answer && !v.npc).slice(-2).map(visitorLine),
    notes: noteLines(s),
    gifts: unread.length > 0,
  };
}

// After a photo: he looks at it (a vision call). He writes what he sees and why it matters, and may retake it once
// from another angle (queued as his next move). Not in fake mode or tests.
async function lookAtPhoto(s, pic, bytes, d, soul, system) {
  if (process.env.PIP_FAKE || d.retake) return;
  try {
    const prompt = `${soul}\n\nI just took this photo of ${pic.target}${d.why ? ` because ${text(d.why, 160)}` : ''}${pic.camera ? ` (camera: ${pic.camera})` : ''}. I look at it.\nDoes it show what I wanted? What do I see, and why does it matter to me? If it did not work, would another angle be better: close, wide, low or high?\n\nAnswer in JSON: {"shows_it": true, "about": "what I see, one sentence", "matters": "why it matters to me, one sentence", "retake": false, "camera": "close"}`;
    const r = await askGemini(system, prompt, 1, [{ mime: 'image/jpeg', data: Buffer.from(bytes).toString('base64') }], { schema: PHOTO_SCHEMA, maxTokens: THINK_ROOM + 300, group: 'big' });
    if (text(r?.about, 300)) pic.notes = text(r.about, 300);
    if (text(r?.matters, 300)) pic.matters = text(r.matters, 300);
    pic.showsIt = r?.shows_it !== false;
    if (r?.retake && !pic.showsIt && ['close', 'wide', 'low', 'high'].includes(r.camera)) {
      s.plan.queue.unshift({ action: 'take_photo', details: { target: pic.target, camera: r.camera, why: d.why, caption: pic.caption, retake: pic.id }, thought: 'Let me try that again from another angle.', enjoyment: 6 });
    }
  } catch (e) {
    console.error('⚠️  photo look:', e.message);
  }
}
const PHOTO_SCHEMA = { type: 'OBJECT', properties: { shows_it: { type: 'BOOLEAN' }, about: { type: 'STRING' }, matters: { type: 'STRING' }, retake: { type: 'BOOLEAN' }, camera: { type: 'STRING', enum: ['close', 'wide', 'low', 'high'] } }, required: ['shows_it', 'about', 'matters'] };

// Good morning: one small call where he sets 1 to 3 goals for today. Without a model, the old code-made day plan.
async function morningGoals(s, soul, system) {
  const day = dayOf();
  try {
    const prompt = goalPrompt({ soul, feelings: bodyText(s), projects: projectLines(s), skills: skillLine(s), interests: s.interests ?? [], enough: fullKinds(s.decor).map(({ kind, n }) => `${n} ${kindsWord(kind)}`).join(', '), full: roomIsFull(s.decor) ? `My room is full (${roomThings(s.decor).length} things). What I make now goes to my museum. A goal does not have to be a new thing: I can make one thing I have really good, build something big outside, try something I never did, or carry my best things to my museum.` : '' });
    const reply = process.env.PIP_FAKE ? fakeGoals() : await askGemini(system, prompt, 1, [], { schema: goalSchema, maxTokens: THINK_ROOM + 400, group: 'big' });
    if (setGoals(s, reply, day)) { console.log(`🌅 goals for today: ${s.intent.items.map((i) => i.text).join(' | ')}`); return; }
  } catch (e) {
    console.error('⚠️  goals:', e.message);
  }
  ensureIntentions(s);
  s.intent.day = day;
}

// For the drawing maker: what he drew a lot lately (not again), and things from his day he could draw instead.
function drawnNote(s) {
  const often = drawnOften(s.art ?? []);
  const day = (s.log ?? []).filter((e) => Date.now() - Date.parse(e.at) < 36 * 3_600_000 && !e.failed);
  const ideas = [...new Set([
    ...(s.outings ?? []).filter((o) => o.saw && Date.now() - Date.parse(o.homeAt) < 36 * 3_600_000).slice(-2).map((o) => o.saw), // what he saw outside comes first: he looked at it to draw it
    ...(s.curious?.sparks ?? []).slice(-3).map((x) => x.topic),
    ...day.filter((e) => ['decorate', 'cook', 'harvest', 'plant'].includes(e.action)).map((e) => e.name ?? e.dish ?? e.plant ?? e.seed).filter(Boolean).slice(-3),
    ...(s.visitors ?? []).filter((v) => v.stranger && v.topic).slice(-2).map((v) => v.topic), // what a traveller told him about
  ].filter(Boolean))].slice(0, 6);
  return [
    often.length ? `WHAT I DREW A LOT LATELY (not again this time): ${often.slice(0, 3).map((o) => `${o.word} (${o.n} times)`).join(', ')}` : '',
    ideas.length ? `THINGS FROM MY DAY I COULD DRAW: ${ideas.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}
// A retry that fixed what the check found is worth remembering: next time he gets it right the first time.
function addLesson(s, move, facts) {
  const text = serious(facts)[0];
  if (!text) return;
  s.lessons ??= [];
  const old = s.lessons.find((l) => l.move === move && l.text.slice(0, 40) === text.slice(0, 40));
  const at = new Date().toISOString();
  if (old) Object.assign(old, { count: old.count + 1, at });
  else s.lessons.push({ move, text: text.slice(0, 240), count: 1, at, firstAt: at, from: 'check' });
  s.lessons = s.lessons.slice(-40);
}
// He came home from an outing (world.js decided what happened): it goes into his day, his memory and his next thought.
// At the library he really read something: an article about what he wonders about goes into his notebook.
async function cameHome(s, o) {
  const p = placeOf(o.place);
  if (o.read && !process.env.PIP_FAKE) {
    try { const page = await readAbout(o.read); if (page?.text) { noteResearch(s, { query: o.read, page: { title: page.title, url: page.url, text: clip(page.text, 1500) }, at: o.homeAt }); o.book = { title: page.title, url: page.url }; } } catch (e) { console.error('⚠️  library:', e.message); }
  }
  if (o.place === 'library' && !o.errand) { // something a visitor left on the shelf for him: he reads it there (guests.js)
    const piece = readShelf(s, Date.parse(o.homeAt));
    if (piece) { o.did += ` On the shelf by the door lay a ${pieceWords(piece)}, left there for me. I read it twice.`; o.piece = { id: piece.id, kind: piece.kind, title: piece.title, name: piece.name }; console.log(`📚 read from the shelf: ${pieceWords(piece)}`); }
  }
  const line = homeLine(o);
  s.log.push({ at: o.homeAt, action: 'came_home', place: o.place, placeName: p?.name ?? o.place, thought: '', did: o.did, found: o.found.map((f) => ({ name: f.name, emoji: f.emoji })), met: o.met, gift: o.gift, book: o.book ?? null, piece: o.piece ?? null, errand: o.errand ?? null, cut: o.cut, card: o.errand ? null : { place: o.place, at: o.homeAt, weather: o.weather, found: o.found.map((f) => ({ emoji: f.emoji })) } });
  if (!o.errand) { addMemory(s, line, o.found.length || o.met ? 7 : 6, 'memory', o.homeAt); happened(s, line); }
  for (const said of checkUnlocks(s)) { happened(s, said); addMemory(s, said, 8, 'memory', o.homeAt); s.log.push({ at: new Date(Date.parse(o.homeAt) + 1000).toISOString(), action: 'happened', what: said, emoji: '🗺️' }); }
  console.log(`🏠 home from ${p?.name ?? o.place}: ${o.did}${o.found.length ? ` (found: ${o.found.map((f) => f.name).join(', ')})` : ''}`);
}
// Something that happened in his world (a wish come true, a parcel, the full moon): he hears it once, at his next thought.
function happened(s, line) { s.street ??= {}; s.street.happened = [...(s.street.happened ?? []), String(line)].slice(-4); }
// The maker designs one thing the brain chose. If it fails, the step fails with a reason (and the brain hears it).
async function makeIt(s, soul, system, st) {
  const room = s.decor.filter((d) => !d.image).slice(0, 12).map((d) => `${d.name} (${d.label ?? d.zone})`);
  try {
    const sk = skillOf(st.action, st.details);
    const lvl = sk ? level(s, sk) : 1;
    const skill = sk ? `my ${sk} is level ${lvl} of 10. ${['decorate', 'change_thing', 'extend_thing', 'make_clothes'].includes(st.action) ? `At this level I can use up to ${maxParts(lvl)} parts.` : st.action === 'record_song' ? `At this level a song can be up to ${maxBars(lvl)} bars long.` : ''}` : '';
    const old = st.action === 'record_song' && st.details?.revise ? [...s.studio.songs].reverse().find((x) => x.pattern && x.name.toLowerCase() === String(st.details.revise).toLowerCase()) : null;
    if (st.details?.revise && !old) throw new Error(`I have no song called "${st.details.revise}" to rewrite`);
    const current = old ? describePattern(old.pattern) : null;
    const thing = ['change_thing', 'extend_thing'].includes(st.action) ? s.decor.find((d) => !d.image && d.parts && d.name.toLowerCase() === String(st.details?.name ?? '').toLowerCase().trim()) ?? s.decor.find((d) => !d.image && d.parts && String(st.details?.name ?? '').trim() && d.name.toLowerCase().includes(String(st.details.name).toLowerCase().trim())) : null;
    const appNow = st.action === 'update_app' ? s.apps.find((a) => a.name.toLowerCase() === String(st.details?.name ?? '').toLowerCase().trim()) ?? s.apps.find((a) => String(st.details?.name ?? '').trim() && a.name.toLowerCase().includes(String(st.details.name).toLowerCase().trim())) : null;
    const build = thing ? partsNow(thing, s.decor) : appNow ? await readFile(`web/${appNow.file}`, 'utf8').catch(() => null) : st.action === 'update_site' && s.site ? await readFile(`web/${SITE_FILE}`, 'utf8').catch(() => null) : null; // he sees what he is changing, like a builder looking at his work (a program: its whole file)
    // Plan first (sketch.js): the small model guesses its size, the game tries that size in the real place. Nothing fits:
    // he hears why now, and the smart model is not asked. Something fits: that size is the budget for the design.
    let planned = null;
    if (st.action === 'decorate' && !st.details?.print && !toolFor(st.details)) {
      try {
        const sketch = process.env.PIP_FAKE ? fakeSketch(st.details) : await askGemini('I am Pip. I answer only in JSON.', sketchPrompt(st.details), 1, [], { schema: sketchSchema, maxTokens: THINK_ROOM + 200 });
        planned = dryRun(s, st.details, sketch);
        console.log(planned.ok ? `   📐 planned first: about ${planned.budget.join(' x ')} m ${planned.label}${planned.shrunk < 1 ? ` (smaller than he thought: ${Math.round(planned.shrunk * 100)}%)` : ''}` : `   📐 planned first: it would not fit (${String(planned.why).slice(0, 120)}). The smart model is not asked.`);
      } catch (e) { console.error('⚠️  plan first:', e.message); planned = null; }
      if (planned && !planned.ok) return { ...st, make: false, planFail: planned.why, planned: { ok: false } };
    }
    const lessons = lessonsFor(s, st.action);
    const recipes = current ? [] : recipesFor(s, st.action, `${st.details?.what ?? ''} ${st.details?.name ?? ''} ${st.details?.change ?? ''}`);
    const notes = notesFor(s, `${st.details?.what ?? ''} ${st.details?.name ?? ''} ${st.details?.why ?? ''} ${st.details?.change ?? ''}`, st.details?.project);
    const mctx = { site: ['make_site', 'update_site'].includes(st.action) ? siteMaterial(s) : '', spot: st.action === 'decorate' ? [spotNote(s, st.details), budgetNote(planned)].filter(Boolean).join('\n') : '', drawn: st.action === 'draw' ? `${drawnNote(s)}${st.as === 'paint_wall' ? '\nTHIS ONE IS NOT FOR PAPER: I paint it big on a wall outside in my world, like a mural. So: a few strong shapes and colours that can be read from across the street, no frame and no paper edge, the whole picture filled.' : ''}` : '', soul, step: st, rules: makerSpec(st.action), room, skill, current, build, bugs: appNow?.bugs?.join('; ') || (/^fix /.test(String(st.details?.change ?? '')) ? st.details.change : ''), lessons, recipes, notes, have: st.action === 'record_song' ? `${[...instruments(s), 'drums'].join(', ')} (only these)` : `tools: ${s.tools.map((t) => t.name).join(', ') || 'none yet'}` };
    const mprompt = makerPrompt(mctx);
    if (process.env.PIP_DUMP) await appendFile(`${process.env.PIP_DUMP}.maker`, `\n\n=================== ${st.action}\n${mprompt}`);
    const think = ['make_app', 'update_app', 'make_site', 'update_site'].includes(st.action) ? { think: 'high' } : {}; // code needs the most thought
    const reply = process.env.PIP_FAKE ? fakeMade(st) : await askGemini(system, mprompt, 1, [], { group: 'big', ...think });
    if (st.action === 'record_song') return finishSong(st, reply, { songs: s.studio.songs, maxBars: maxBars(lvl), allowed: [...instruments(s), 'drums'] });
    // The game checks it (verify.js): measured facts, and one retry with them. The better try is kept.
    const limits = { parts: maxParts(lvl), bars: maxBars(lvl) };
    const check = async (m) => {
      const facts = await checkMade(st.action, m.details, { art: s.art, maxParts: maxParts(lvl), current: appNow ? build : null, test: process.env.PIP_NO_PHOTO ? null : testHtml }).catch(() => []);
      const tight = st.action === 'decorate' && !facts.some((f) => /could not be read/.test(f)) ? fitFact(s, { ...m.details, parts: cleanParts(m.details?.parts) }) : null; // measured against where it will go
      return tight ? [...facts, tight] : facts;
    };
    const out = await withOneRetry(applyMade(st, reply, limits), {
      check,
      allowed: !process.env.PIP_FAKE && revisionsLeft(s) > 0,
      retry: async (facts) => {
        noteRevision(s);
        console.log(`   🔎 the check found: ${facts.join(' | ').slice(0, 300)}. One more try.`);
        try { return applyMade(st, await askGemini(system, mprompt + revisionNote(reply, facts), 1, [], { group: 'big', ...think }), limits); } catch (e) { console.error('⚠️  second try:', e.message); return null; }
      },
    });
    if (out.tries === 2) console.log(serious(out.facts).length ? `   🔎 after the second try: ${out.facts.join(' | ').slice(0, 200)}` : '   🔎 the second try passed the check ✓');
    if (out.tries === 2 && !serious(out.facts).length && serious(out.before ?? []).length) addLesson(s, st.action, out.before);
    if (planned?.ok && out.made) out.made.planned = { ok: true, fit: planned.fit, budget: planned.budget, shrunk: planned.shrunk };
    return out.made;
  } catch (e) {
    console.error('⚠️  maker:', e.message);
    s.plan.lastFail = { at: new Date().toISOString(), why: `${st.action}: I could not work out how to make it (${e.message.slice(0, 60)})` };
    return { action: 'do', details: { what: `think about how to make ${text(st.details?.what, 60) || 'it'}` }, thought: 'I could not work it out yet.', enjoyment: 4 };
  }
}

// Pip does not read anyone's name: whoever wrote to him is "someone".
const noName = (t) => String(t).replace(/\bBas(?='s)\b/g, 'someone').replace(/\bBas\b/g, 'someone');
const SLOW_REST_MIN = 20; // a model that did not answer in time is tried last for this long
// The same schema without the ordering hints (for a model that refuses them).
const plainSchema = (x) => (Array.isArray(x) ? x.map(plainSchema) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'propertyOrdering').map(([k, v]) => [k, plainSchema(v)])) : x);
async function askGemini(system, wakeUp, retry = 2, images = [], opts = {}) {
  system = noName(system);
  wakeUp = noName(wakeUp);
  if (process.env.PIP_FAKE) {
    return {}; // fake mode: brain and maker have their own fakes (brain.js, maker.js); other calls get nothing
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('No GEMINI_API_KEY. Copy .env.example to .env and fill it in.');
  const q = quota.ref;
  const group = opts.group === 'big' ? 'big' : 'lite';
  const { order, skipped, first } = candidates(q, group, { reply: Boolean(opts.reply) });
  for (const x of skipped) console.log(`   (${x.model} skipped: ${x.why})`);
  if (!order.length) throw new Error('quota: every model is out for today, back after midnight Pacific');
  const quick = order.filter((m) => !((q.slow?.[m] ?? 0) > Date.now())); // models that timed out a moment ago go last
  if (quick.length && quick.length < order.length) order.splice(0, order.length, ...quick, ...order.filter((m) => !quick.includes(m)));
  let res = null;
  for (const model of order) {
    let retried429 = false;
    let timeouts = 0;
    let plainWay = Boolean(q.plain?.[model]); // this model refused the newer settings before (a thinking level, ordered answers): asked the plain way
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await fetch(`${API}/models/${model}:generateContent`, {
          method: 'POST',
          signal: AbortSignal.timeout(Number(process.env.PIP_MODEL_TIMEOUT_MS) || 150_000), // drawings and apps make long answers (tests use a short wait)
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: wakeUp }, ...images.map(({ mime, data }) => ({ inlineData: { mimeType: mime, data } }))] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 1, ...(opts.schema ? { responseSchema: plainWay ? plainSchema(opts.schema) : opts.schema } : {}), ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}), ...(opts.think && !plainWay ? { thinkingConfig: { thinkingLevel: opts.think } } : {}) },
          }),
        });
      } catch (e) {
        res = null;
        if (e.name === 'TimeoutError') { // a slow model: with another one to try he moves on at once (waiting twice froze him for minutes), and leaves this one alone for a while
          (q.slow ??= {})[model] = Date.now() + SLOW_REST_MIN * 60_000;
          if (order.at(-1) === model && ++timeouts <= 1) { console.log(`${model} is slow, trying once more...`); continue; }
          console.log(`${model} is slow${order.at(-1) !== model ? ', on to the next model' : ''}`);
        }
        break;
      }
      if (res.status === 503) countBusy(q, model); else count(q, model); // a request that was answered counts; one the model bounced because it was busy does not
      if (res.status === 400 && !plainWay && (opts.think || opts.schema)) { // a setting this model does not know: once more the plain way, and remembered for today
        console.log(`   ${model}: 400 with the newer settings (${(await res.clone().text()).replace(/\s+/g, ' ').slice(0, 140)}), asking the plain way`);
        plainWay = true;
        (q.plain ??= {})[model] = true;
        attempt--;
        continue;
      }
      if (res.status === 429) {
        const why = read429(await res.clone().text());
        console.log(`   ${model}: 429 (${why.perDay ? 'daily quota' : why.perMinute ? 'per-minute limit' : 'quota'}${why.quotaId ? `, ${why.quotaId}` : ''}${why.notFree ? ', limit 0: not in the free tier' : ''})`);
        if (why.perMinute && !retried429) { retried429 = true; await new Promise((r) => setTimeout(r, Math.min(MAX_RETRY_WAIT_MS, why.retryMs ?? 20_000))); continue; }
        if (why.perDay || !why.perMinute) markOut(q, model);
        break;
      }
      if (res.status !== 503 || attempt === 3) break;
      if (!retryBusy(model, order)) break; // a busy smart model: on to the next one at once
      console.log(`${model} is busy, trying again in ${attempt * 10}s...`);
      await new Promise((r) => setTimeout(r, attempt * 10_000));
    }
    if (res?.ok) {
      usedModel = model;
      if (group === 'big') { const p = bigPace(q); console.log(`   🧠 ${model} answered${groups().big.includes(model) ? ` (smart calls today: ${p.used} of ${p.total}, ${p.allowed} free by now)` : ' (a small model: the smart ones were busy, capped or out)'}`); }
      if (model !== first) quota.notes.push(`${model} answered (${first} ${q.out[first] ? 'is out of quota' : 'was busy or capped'})`);
      break;
    }
    console.log(`${model} did not answer (${res?.status ?? 'no answer'})${order.at(-1) !== model ? ', trying the next model' : ''}`);
  }
  if (!res) throw new Error('Gemini did not answer. Try again later.');
  if (res.status === 429) throw new Error('quota: Rate limit hit on every model for now');
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  spent.calls++;
  spent.input += data.usageMetadata?.promptTokenCount ?? 0;
  spent.output += (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0);
  spent.models[usedModel] = (spent.models[usedModel] ?? 0) + 1;
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
  const found = await wikiGet(`action=query&list=search&srlimit=8&srsearch=${encodeURIComponent(query)}`);
  const hits = bestHits(query, found.query?.search ?? []); // the best fit first, not just Wikipedia's first
  if (!hits.length) return null;
  return {
    results: hits.slice(0, 3).map((h) => ({ title: h.title, snippet: clip(plain(h.snippet), 160), url: pageUrl(h.title) })),
    opened: await readArticle(hits[0].title),
  };
}
async function readAbout(topic) {
  const found = await wikiGet(`action=query&list=search&srlimit=6&srsearch=${encodeURIComponent(topic)}`);
  const hit = bestHits(topic, found.query?.search ?? [])[0];
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
    case 'buy': return d.item;
    case 'go_out': return placeOf(d.place)?.name ?? d.place;
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
    case 'phone': return d.app ? `opened ${d.app}` : d.lamp;
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
    // what the game knows about the step: which project step it does (to tick it off), that it is waiting, the move it really is
    ...(x.forStep ? { forStep: x.forStep } : {}),
    ...(x.waits ? { waits: true } : {}),
    ...(x.as ? { as: x.as } : {}),
    ...(x.planFail ? { planFail: x.planFail } : {}), // the dry run found no place for it (sketch.js)
    ...(x.planned ? { planned: x.planned } : {}),
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
  enjoyment = Math.min(enjoyment, habitCap(s, r.as ?? r.action)); // the more often today, the less it gives him (growth.js)
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
    const msg = { id: Date.now().toString(36) + (sent.length ? 'b' : ''), at, kind, text: body, ...(kind === 'ask' ? {} : { private: true }) }; // asks are public (the Asks tab); what he tells Bas is private
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
  if (r.action === 'do' && r.as === 'show_in_museum') { // he carries a thing to his museum (museum.js)
    const shown = showInMuseum(s, r.details?.name, r.details?.why);
    if (shown.failed) { ensurePlan(s); s.plan.lastFail = { at, why: `show_in_museum: ${shown.failed}` }; console.log(`   ✋ not to the museum: ${shown.failed}`); }
    else { addMemory(s, `I carried ${shown.piece.name} from my ${shown.from} to my museum.${shown.piece.shown ? ` Why this one: ${shown.piece.shown}` : ''}`, 6, 'memory', at); nudge(s, 'joy', 0.6); console.log(`   🏛️  to the museum: ${shown.piece.name} (from his ${shown.from})`); }
  }
  if (r.action === 'do' && r.as === 'ask_visitors') { // one question for everyone who visits his page (guests.js)
    const asked = askVisitors(s, r.details?.question, r.details?.why);
    if (asked.failed) { ensurePlan(s); s.plan.lastFail = { at, why: `ask_visitors: ${asked.failed}` }; console.log(`   ✋ no question: ${asked.failed}`); }
    else { addMemory(s, `I asked the people who visit my page: "${asked.question.text}" Because: ${asked.question.why}`, 6, 'memory', at); console.log(`   ❓ asks his visitors: ${asked.question.text} (${asked.question.why})`); }
  }
  if (r.action === 'do' && r.as === 'start_hobby') { // his own idea for a hobby: from now on he is trying it (curiosity.js)
    const started = startHobby(s, r.details?.hobby, r.details?.why);
    if (started.failed) { ensurePlan(s); s.plan.lastFail = { at, why: `start_hobby: ${started.failed}` }; console.log(`   ✋ no new hobby: ${started.failed}`); }
    else { addMemory(s, `I want to try ${started.hobby.topic} as a hobby. My own idea. Why: ${started.hobby.why}`, 7, 'memory', at); console.log(`   🌱 a new hobby to try: ${started.hobby.topic} (ways: ${started.hobby.moves.join(', ')})`); }
  }
  if (r.action === 'do' && r.as === 'drop_want') { // he crosses a want off his list himself
    const gone = s.asks.find((a) => a.status === 'open' && r.details?.want && sameItem(a.item, text(r.details.want, 140)));
    if (gone) { Object.assign(gone, { status: 'gone', goneAt: at, goneWhy: text(r.details.why, 160) }); console.log(`   ✂️  off his wants list: ${gone.item}`); }
  }
  const handled = new Set();
  for (const c of wanted) {
    if (handled.has(c.item.toLowerCase())) continue;
    handled.add(c.item.toLowerCase());
    if (c.item && !reasoned(c)) { // a want needs a why: without one it is not written down, and he hears that
      ensurePlan(s);
      s.plan.lastFail = { at, why: `want: "${c.item.slice(0, 50)}" is not on my wants list, because I gave no real reason. A want needs a why: one honest sentence` };
      console.log(`   ✋ not on his wants list (no reason): ${c.item}`);
      continue;
    }
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
    { const full = wantsOneMore(s.decor, title); if (full) { ensurePlan(s); s.plan.lastFail = { at, why: `start_project: I already have ${full.n} ${kindsWord(full.kind)}, and that is enough of those. I plan something else` }; console.log(`   ⛔ no project "${title}": he has ${full.n} ${kindsWord(full.kind)} already`); continue; } } // it could never be finished
    felt(s, 'projectStart');
    const ladder = challengeSteps(s, title); // a challenge from his ladder (curriculum.js): its steps are known
    if (ladder && (!(p?.steps ?? []).length || String(p.steps[0]).startsWith('look up how to'))) p.steps = ladder;
    s.projects.push({ id: Date.now().toString(36), title, why: text(p?.why, 200), next: text(p?.next, 160), nextStep: text(p?.next, 160), steps: cleanSteps(p?.steps), needs: (Array.isArray(p?.needs) ? p.needs : []).map((x) => text(x, 40)).filter(Boolean).slice(0, 4), versions: [], notes: [], status: 'working', since: at, updatedAt: at });
  }
  for (const u of Array.isArray(r.projects_update) ? r.projects_update : []) {
    let hit = s.projects.find((x) => x.status === 'working' && sameItem(x.title, text(u?.title, 80) || '\u0000'));
    const unplanned = s.projects.find((x) => x.status === 'working' && !(x.steps ?? []).length);
    if (u?.plan && unplanned && !hit) hit = unplanned; // a plan for a title that matches nothing goes to the project with no steps
    if (!hit) continue;
    if (text(u?.next, 160)) hit.next = text(u.next, 160);
    if (Array.isArray(u?.steps) && u.steps.length) { hit.steps = cleanSteps(u.steps, hit.steps); hit.stuck = null; } // he rewrites the plan (steps that stay the same stay done): a new plan is a new try
    for (const k of r._progress === true && Array.isArray(u?.step_done) ? u.step_done : []) {
      const step = typeof k === 'number' ? (hit.steps ?? [])[k - 1] : (hit.steps ?? []).find((x) => sameText(x.text, String(k)));
      if (step) step.done = true;
    }
    if (u?.status === 'dropped') hit.status = 'dropped'; // done only comes from saying he is proud of it (judgeProject)
    hit.updatedAt = at;
  }
  if (r.project_judged?.title) { // he looked at his project: proud means done; not proud means a note and another version
    const j = judgeProject(s, r.project_judged.title, r.project_judged, at);
    if (j?.done) for (const v of findProjectAny(s, j.project)?.versions ?? []) markProud(s, v.name); // what he made for it goes in his recipe book as something he is proud of
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
  await sleepCall(state);
  { const { kept, faded } = consolidate(state); state.beliefs = beliefs(state); console.log(`🌙 tucking the day away: ${kept.length} memories kept for long, ${faded.length} old ones faded, ${state.beliefs.length} beliefs`); state.nightly = { at, kept: kept.map((m) => m.text), faded: faded.map((m) => m.text) }; } // (memory.js, night.js: plain code)
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
  sleepMoments(state, Date.parse(at)); // the live feed: a few slow moments through the night (moments.js)
  noteArc(state, Date.parse(at), { asleep: true });
  await saveState(state);
  await appendFile(DIARY_FILE, `## ${new Date().toLocaleString('en-GB')}\nGood night. Pip went to sleep.\n\n`);
  console.log('\n💤 Pip went to sleep.');
}

// Once a night: sum up the day, maybe add a line to his soul, let old lines go, update his story, dream. One model call.
async function sleepCall(state) {
  try {
    ensureBody(state);
    const today = daySummary(state);
    const days = [...(state.days ?? []).filter((d) => d.day !== today.day), today];
    const found = patterns(days, state.soulLines ?? []);
    const soul = await loadSoul();
    const prompt = sleepPrompt({ soul, today, found, added: state.soulLines ?? [], story: state.story });
    const reply = process.env.PIP_FAKE ? fakeSleep(found) : await askGemini('I am Pip. I answer only in JSON.', prompt, 1, [], { schema: sleepSchema(found.map((p) => p.key)), maxTokens: THINK_ROOM + 800, group: 'big' }).catch((e) => { console.error('⚠️  sleep:', e.message); return null; });
    const { changes } = applySleep(state, reply);
    await saveSoul(state.soulLines, changes);
    if (text(reply?.story, 900)) { state.story = text(reply.story, 900); state.storyAt = new Date().toISOString(); }
    if (text(reply?.dream, 300)) state.dreams = [...(state.dreams ?? []), { at: new Date().toISOString(), text: text(reply.dream, 300) }].slice(-10);
    for (const c of changes) {
      console.log(`🌙 soul ${c.change}: ${c.text}`);
      await appendFile(DIARY_FILE, `## ${new Date().toLocaleString('en-GB')}
${c.change === 'added' ? `Something I noticed about myself, day after day: ${c.text}` : `I let go of this about myself: ${c.text}`}

`);
    }
  } catch (e) {
    console.error('⚠️  sleep call:', e.message);
  }
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
    await saveState(state);
    return;
  }
  const at = new Date().toISOString();
  state.mood = 'sleepy';
  state.activities.push({ at, action: 'rest', detail: 'taking a nap', enjoyment: 7 });
  state.activities = state.activities.slice(-50);
  state.last = { at, thought: 'I am so sleepy. I will take a little nap...', action: 'rest', details: {}, detail: 'taking a nap', enjoyment: 7, new_idea: null, found: null, sleeping: true };
  sleepMoments(state, Date.parse(at), 2);
  await saveState(state);
  console.log('💤 Out of calls for now: Pip takes a nap.');
}

async function wakeUp() {
  const soul = await loadSoul();
  const persona = soul; // the reflection and life-story calls start from who he is, too
  const system = 'I am Pip. I answer only in JSON.';
  let state = await loadState();
  if (needsFresh(state)) { // once (Bas): only his soul and his furniture stay; the rest goes to web/archive/pre-fresh/
    await freshStart(state);
    state = await loadState();
    console.log('🌱 Pip starts fresh');
  }
  quota.ref = ensureQuota(state); // which models answered today, and which are out (reset at midnight Pacific)
  const inbox = await loadInbox(state);
  inbox.added += (await pullNtfy(state)).added;
  const taskFiles = await loadTasks(state);
  const visitorFiles = await loadVisitors(state);
  inbox.added += taskFiles.added;
  const frontFiles = await loadFronts(state);
  const lightFiles = await loadLights(state);
  setFronts(state.fronts);
  if (isNight() && !process.env.PIP_AWAKE) {
    const late = hurryHome(state); // he is always home to sleep (the rules bring him home long before; this is the safety net)
    if (late) await cameHome(state, late);
    await goToSleep(state);
    if (inbox.added) {
      await saveState(state);
      console.log('✉️  Bas wrote while Pip sleeps. He will read it in the morning.');
    }
    await clearInbox(inbox.names);
    await clearTasks(taskFiles.names);
  await clearVisitors(visitorFiles);
    await clearFronts(frontFiles.names);
  await clearLights(lightFiles);
    return;
  }
  state.lastError = null;
  const wokeNow = Boolean(state.last?.sleeping);
  if (wokeNow) wakeMoments(state);
  for (const name of carryToMuseum(state)) { const said = `I carried ${name} to my museum and put it on a plinth. Everyone can see it there.`; console.log(`🏛️  ${said}`); happened(state, said); }
  for (const name of handOver(state)) { const said = `I brought ${name} to the square for whoever asked for it on the notice board. It is out of my room.`; console.log(`📦 ${said}`); happened(state, said); }
  { const q = closeQuestion(state); if (q) { const said = q.answers.length ? `My question "${q.text}" is closed now. ${q.answers.length} ${q.answers.length === 1 ? 'person' : 'people'} answered.` : `Nobody answered my question "${q.text}". I let it go.`; addMemory(state, said, 5, 'memory', new Date().toISOString()); console.log(`❓ ${said}`); } }
  tickBody(state); // needs and feelings, no model call (it also passes time for the bars)
  // No free food any more: what he eats he grows, cooks, or asks for (the pantry he has is what is left).
  ensureProjects(state);
  ensureSkills(state);
  // His world outside (world.js). While he is out nothing else happens: no model is asked, and the game brings him home.
  for (const said of checkUnlocks(state)) { happened(state, said); addMemory(state, said, 8, 'memory', new Date().toISOString()); state.log.push({ at: new Date().toISOString(), action: 'happened', what: said, emoji: '🗺️' }); }
  const feltBeforeHome = { sum: feelSum(state), parts: feelParts(state) };
  const outing = outingTick(state);
  if (outing?.home) await cameHome(state, outing.outing);
  if (outing?.home && !outing.outing.errand) noteLift(state, ['go_out'], feltBeforeHome.sum, feelSum(state), feelDiff(feltBeforeHome.parts, feelParts(state))); // what the place did to him counts for "going outside" (it used to count for nothing: only the cost of setting off was seen)
  if (outing?.away) {
    const at = new Date().toISOString();
    state.last = { at, via: 'outside', thought: outing.line, action: 'go_out', details: { place: outing.place }, detail: outing.line, enjoyment: 7, new_idea: null, found: null, away: { place: outing.place, phase: outing.phase, back: outing.back } };
    state.emotion = emotionWord(state);
    noteArc(state, Date.now(), { out: true });
    await saveState(state);
    await clearInbox(inbox.names);
    await clearTasks(taskFiles.names);
    await clearVisitors(visitorFiles);
    await clearFronts(frontFiles.names);
    await clearLights(lightFiles);
    console.log(`🚶 ${outing.line} Back ${outing.backWords}.${inbox.added ? ' (Bas wrote: he reads it when he is home.)' : ''}`);
    return;
  }
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
    if (ask) {
      Object.assign(ask, { status: 'done', doneAt: new Date().toISOString() });
      const given = giveForAsk(state, ask.item); // the real thing, in code (gifts.js)
      if (given.length) { ask.given = given; addMemory(state, `Bas gave me what I asked for: ${given.join(', ')}.`, 8, 'memory', new Date().toISOString()); console.log(`🎁 given: ${given.join(', ')}`); }
    }
  }
  const unread = state.inbox.filter((m) => !m.read);
  // Pictures he has not seen yet are shown to him together with the prompt (at most 3 per wake-up).
  const looking = state.pictures.filter((p) => !p.seen).slice(0, 3);
  const images = [];
  // He sees his own work (like Pino hearing his music back): what he made last time, shown first (photo.js).
  const lb = state.lookBack;
  state.lookBack = null;
  let ownWork = null;
  if (lb && Date.now() - Date.parse(lb.at) < 3 * 3_600_000 && !process.env.PIP_NO_PHOTO && !state.last?.sleeping) {
    try {
      const shot = lb.file ? await renderFile(lb.file, 'web', lb.kind === 'app' ? { width: 900, height: 640, wait: 1500 } : {}) : await takePhoto(lb.name, new Date().toISOString(), state, 'web', [], 'close');
      if (shot.bytes) { images.push({ mime: 'image/jpeg', data: Buffer.from(shot.bytes).toString('base64') }); ownWork = { name: lb.name, what: { drawing: 'drawing', app: 'program', thing: 'thing' }[lb.kind] ?? 'work', how: { drawing: 'draw a new version', app: 'update_app: one new thing or a fix', thing: 'change_thing' }[lb.kind] ?? 'change it' }; console.log(`👀 Pip looks at his ${ownWork.what}: ${lb.name}`); }
    } catch (e) { console.error('⚠️  look back:', e.message); }
  }
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
  for (const g of growGames(state)) console.log(`🎮 ${g}: a new step to grow it today`); // a game he builds grows a little each day (projects.js)
  // Notes and wishes come by themselves, from plain code (no model call): travellers and the notice board.
  { const drop = postDrop(state); if (drop) console.log(`💌 ${drop.from} (${drop.who}) left a note ${drop.where}: ${drop.text.slice(0, 70)}`); } // travellers leave notes in his world (strangers.js)
  for (const line of sweepDrops(state)) { console.log(`💌 ${line.slice(0, 90)}`); addMemory(state, line, 5, 'memory', new Date().toISOString()); }
  { const found = state.last?.sleeping ? null : findDeed(state); if (found) { console.log(`🌼 ${found}`); addMemory(state, found, 6, 'memory', new Date().toISOString()); happened(state, found); } } // a small thing a visitor did in his world
  { const note = postOrders(state); if (note) console.log(`📌 a new note on the notice board: ${note.topic} (${note.reward} coins)`); } // people pin what they would like made (board.js)
  // The storyteller (story.js): now and then something happens on his square or in his sky. He hears it once, and it is in his day.
  if (!process.env.PIP_NO_STORY) for (const ev of storyTick(state)) {
    console.log(`${ev.emoji} ${ev.big ? 'something happened' : 'he notices'}: ${ev.text}`);
    happened(state, ev.text);
    state.log.push({ at: new Date(Date.now() - 2000).toISOString(), action: 'happened', what: ev.text, emoji: ev.emoji });
    addMemory(state, ev.text, ev.big ? 7 : 4, 'memory', new Date().toISOString());
  }
  const retry = startRetry(state); // the early second try after something did not work (retry.js)
  const reasons = [...(ownWork ? [`I want to look at the ${ownWork.what} I just made`] : []), ...(retry ? ['I am up again to try another way'] : []), ...wakeReasons(state, { unread: unread.length, woke: wokeNow }).filter((r) => !(retry && /^something did not work/.test(r)))]; // on a second try the failure is told once, with what to do instead (retryLines): repeating a failed action in the prompt makes a small model repeat it
  let answer = null;
  let choice = null;
  let via = 'autopilot';
  const queued = reasons.length ? null : nextQueued(state);
  if (queued) answer = { thought: queued.find((x) => x.thought)?.thought ?? '', inner: '', steps: queued, mood_after: state.mood, new_idea: null };
  else {
    try {
      if (process.env.PIP_FAKE_DOWN) throw new Error('the model is busy (pretend, for testing)'); // for tests: a day on which the model never answers
      const ctx = brainContext(state, { soul, offered, reasons, unread, looking, grew, ownWork });
      const prompt = brainPrompt(ctx);
      if (state.street) state.street.happened = []; // told once
      if (process.env.PIP_DUMP) await writeFile(process.env.PIP_DUMP, prompt);
      const reply = process.env.PIP_FAKE ? fakeReply(offered) : await askGemini(system, prompt, 2, images, { schema: brainSchema(offered.map((m) => m.name)), maxTokens: THINK_ROOM + 800, think: 'low', ...(unread.length ? { group: 'big', reply: true } : {}) }); // answering Bas: the big model
      answer = toAnswer(reply, offered.map((m) => m.name));
      answer.steps = projectSteps(state, realProjectWork(state, answer.steps)); // pretending to do a project step ("do: sculpt the body") becomes the real step
      answer.steps = realDo(answer.steps, { has: instruments(state), canPlay: offered.some((m) => m.name === 'play_piano'), canGo: offered.some((m) => m.name === 'go_out') }); // and a "do" that is really playing his flute or going out is done for real (loops.js)
      answer.steps = hungerFirst(state, dropRestingDo(state, answer.steps), offered);
      choice = choiceOf(reply); // for the loop breaker
      via = 'brain';
    } catch (e) {
      // No answer (out of quota, a broken or cut-off answer, a network error): he carries on without the model this time,
      // instead of the wake-up failing (and failing again next time, while the same message waits).
      console.log(`🚶 no usable answer from the model (${e.message.slice(0, 80)}), so Pip carries on by himself this time`);
      state.lastError = { at: new Date().toISOString(), kind: 'brain', message: e.message.slice(0, 200) };
      answer = { thought: '', inner: '', steps: [], mood_after: state.mood, new_idea: null };
      via = 'fallback';
    }
    for (const a of answer.visitor_answers ?? []) { // his public answer to a visitor
      const v = state.visitors?.find((x) => x.id === a.id && !x.answer);
      if (v && text(a.text, 400)) { Object.assign(v, { answer: text(a.text, 400), answeredAt: new Date().toISOString() }); noteAnswer(state, v); noteReply(state, v); const learned = learnFrom(state, v, a.keep !== false); if (learned) addMemory(state, learned, 6, 'memory', new Date().toISOString()); } // yes to a wish is a promise (neighbours.js), and what he keeps of a traveller's note he has learned (strangers.js)
    }
    if (!answer.steps.length) answer.steps = fallbackSteps(state, offered);
    answer.steps = decided(state, answer.steps);
    console.log(`🧠 ${via}: ${reasons.join('; ')}`);
  }
  // Before any model is asked to design something: what failed three times today is off until tomorrow (loops.js), and
  // one more of a kind he has enough of cannot work (decor.js). Both are settled here, at no cost.
  { const off = answer.steps.map((st) => offToday(state, st));
    if (off.some(Boolean)) {
      const first = off.find(Boolean);
      state.plan.lastFail = { at: new Date().toISOString(), why: `${first.move}: it did not work 3 times today (${first.why.slice(0, 100)}). I leave it until tomorrow` };
      console.log(`⛔ off for today: ${off.filter(Boolean).map((o) => o.key).join(', ')}`);
      const keep = answer.steps.filter((_, i) => !off[i]);
      answer.steps = keep.some((x) => x.action !== 'walk_to') ? keep : fallbackSteps(state, offered);
    } }
  if (answer.steps.some((st) => st.make) && headRests(state.quota)) { // his smart calls are spread over the day (models.js): what needs a design waits a little
    const p = bigPace(state.quota);
    const at = new Date(p.backAt).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    console.log(`⏳ put off: ${answer.steps.filter((st) => st.make).map((st) => st.as ?? st.action).join(', ')} (smart calls: ${p.used} used, ${p.allowed} free by now, ${p.total} today; again around ${at})`);
    state.plan.lastFail = { at: new Date().toISOString(), why: p.out ? `I have designed all I can for today. Making new things comes back tomorrow around ${at}` : `I have designed a lot already. My head for making new things is fresh again around ${at}` };
    const keep = answer.steps.filter((st) => !st.make);
    answer.steps = keep.some((x) => x.action !== 'walk_to') ? keep : fallbackSteps(state, offered);
  }
  for (const [i, st] of answer.steps.entries()) {
    const full = st.make && st.action === 'decorate' && !st.details?.print ? enoughOf(state.decor, st.details?.what) ?? enoughOf(state.decor, st.details?.name) : null; // (what he said he wants to make, or the name he gave it)
    if (full) { answer.steps[i] = { ...st, make: false, planFail: full.why, planned: { ok: false } }; console.log(`   ⛔ not designed: he has ${full.n} ${kindsWord(full.kind)} already`); }
  }
  for (const [i, st] of answer.steps.entries()) { // a project makes one thing: every next build step adds to it
    if (!st.make || st.action !== 'decorate' || st.details?.print || st.as === 'print_thing') continue;
    const d = st.details ?? {};
    if (st.as === 'build_outside' || isOutside(d.where)) continue; // big, outside: always welcome
    const proj = d.project ? findProject(state, d.project) : null;
    const piece = proj ? projectThing(state, proj) : null;
    if (piece) { answer.steps[i] = { ...st, action: 'extend_thing', details: { name: piece, add: text(d.what, 200), project: d.project } }; console.log(`   🧩 one project, one thing: he adds to "${piece}" instead of making another`); continue; }
  }
  // Things he designs: the maker makes them now (one model call each).
  for (const [i, st] of answer.steps.entries()) if (st.make) answer.steps[i] = await makeIt(state, soul, system, st);
  // A step that cannot work is dropped, and the brain hears why next time.
  const impossible = preflight(state, answer.steps);
  if (impossible.length) {
    state.plan.lastFail = { at: new Date().toISOString(), why: `${impossible[0].st.action}: ${impossible[0].why}` };
    for (const b of impossible.filter((x) => x.st.forStep && !/used up|enough|today/i.test(x.why))) { // a project step that cannot even start counts as a try (after 2 the project waits); a daily limit is only waiting for tomorrow
      const p = findProject(state, b.st.forStep.project);
      if (p) p.stuck = p.stuck?.text === b.st.forStep.text ? { text: b.st.forStep.text, n: p.stuck.n + 1, at: new Date().toISOString() } : { text: b.st.forStep.text, n: 1, at: new Date().toISOString() };
    }
    console.log(`⛔ dropped: ${impossible.map((b) => `${b.st.action}: ${String(b.why).slice(0, 90)}`).join(" | ")}`);
    const drop = new Set(impossible.map((b) => b.st));
    const keep = answer.steps.filter((st) => !drop.has(st));
    answer.steps = keep.some((x) => x.action !== 'walk_to') ? keep : fallbackSteps(state, offered);
  }
  const feelBefore = feelSum(state);
  const partsBefore = feelParts(state);
  const startedAt = Date.now();
  setChest(state.chest ?? null);
  // A new plan replaces the old one: thoughts of steps that never happened are dropped.
  state.thoughts = state.thoughts.filter((t) => Date.parse(t.at) <= startedAt);
  state.decor = state.decor.filter((d) => Date.parse(d.at) <= startedAt);
  receiveTools(state, answer);
  // A step that needs an instrument he does not have in his inventory does not happen. One taken back earlier in the same plan counts.
  const blocked = [];
  const bag = state.tools.map((x) => ({ name: x.name, kind: x.kind }));
  const steps = redundantWalks(normalizeSteps(answer)).filter((st) => {
    const needs = instrumentNeeds(st, { pianoGone: Boolean(state.furniture?.piano?.gone) }).filter(Boolean).find((n) => !bag.some((x) => fits(x, n))) || ''; // (only an instrument he does not have stops a step: he needs no tools any more, tools.js)
    if (needs) {
      const away = toolList(state).find((x) => !x.usable && fits({ name: x.name, kind: x.kind }, needs));
      blocked.push({ st, why: away ? `my ${away.name} is ${away.where.replace('his ', 'my ')}. take_tool brings it into my inventory first, then I can play it` : `I need ${needs} in my inventory for that. If I really want it, I put it on my wants list (want) and say why, or I make it myself` });
      return false;
    }
    if (st.action === 'decorate' && toolFor(st.details)) bag.push({ name: text(st.details.name, 40), kind: toolFor(st.details) });
    if (st.action === 'take_tool') [...state.decor, ...state.stored].filter((d) => d.tool && fits({ name: d.name, kind: d.tool }, text(st.details.name, 60))).slice(0, 1).forEach((d) => bag.push({ name: d.name, kind: d.tool }));
    return true;
  });
  if (!steps.length) steps.push({ action: 'rest', details: {}, thought: 'I could not do what I planned, so I rest a moment.', working_on: '', needs: '', enjoyment: 5 });
  { const gi = steps.findIndex((x) => x.action === 'go_out' || x.as === 'paint_wall' || x.as === 'print_thing' || x.as === 'shape_land' || x.as === 'fetch_note'); if (gi >= 0 && gi < steps.length - 1) steps.push(...steps.splice(gi, 1)); } // going out is always the last thing he does in a wake-up: nothing happens at home while he is away
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
      if (st.planFail) { st.made = { failed: st.planFail, hinted: true, planned: true }; return; } // the dry run found no place for it: nothing was designed (sketch.js)
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
      if (st.as === 'print_thing') { // a small model for the print workshop: he walks there with his design, and it stays on the shelf there
        const may = canGo(state, 'workshop', stepStart);
        const parts = settle(sizeWords(cleanParts(st.details.parts) ?? [], st.details.name), { kind: 'surface' }).parts.slice(0, 24);
        const pname = text(st.details.name, 60);
        if (!pname) st.made = { failed: 'he did not give it a name' };
        else if (!parts.length) st.made = { failed: 'the shapes did not work out' };
        else if (!may.ok) st.made = { failed: `${may.why}, so I cannot go to the print workshop now`, hinted: true };
        else if ((state.prints ?? []).filter((x) => isToday(x.at)).length >= 3) st.made = { failed: 'I have printed three things today already: the printer has to cool down', hinted: true };
        else {
          const went = startOuting(state, { job: { place: 'workshop', kind: 'print', name: pname.replace(/^(a|an|the|my)\s+/i, ''), why: text(st.details.why, 200), parts, words: `print my ${pname.replace(/^(a|an|the|my)\s+/i, '')}` } }, stepStart);
          st.made = went.failed ? { failed: went.failed, hinted: true } : { printed: pname, outing: went, hint: `I am on my way to the print workshop with my design. I am back ${went.backWords}.` };
        }
        return;
      }
      const out = isOutside(st.details.where);
      const placed = { ...designate(state, st.details), ...(out ? { worldOpen: [...new Set([...unlockedKeys(state), ...knownKeys(state)])] } : {}) }; // no place said: the game puts it where it belongs. Outside: only where he knows the way
      const built = settle(sizeWords(cleanParts(st.details.parts) ?? [], st.details.name), { kind: placeKind({ ...st.details, ...placed }) }); // the builder makes it hold together (build.js); a "tiny" thing is tiny
      const sized = keepWithin(out && Number(st.details.metres) > 0 ? built.parts : roomScale(built.parts, st.details), st.planned?.fit); // (never bigger than what the dry run showed to fit)
      st.made = makeDecor(state.decor, { ...st.details, ...placed, parts: sized, uses: st.uses }, stepStart); // built at the size of his room (outside: as big as he said)
      if (st.made?.entry?.readyAt) { const hours = Math.round((Date.parse(st.made.entry.readyAt) - Date.parse(st.made.entry.at)) / 360_000) / 10; addMemory(state, `I started building my ${st.made.entry.name} ${st.made.entry.label}. It is big: it will take me about ${hours} hours of work before it stands.`, 6, 'memory', new Date(stepStart).toISOString()); }
      const oldCloth = /^(.+) already lies over /.exec(st.made.failed ?? '')?.[1];
      if (oldCloth && state.stored.length < MAX_STORED && storeAway(state.decor, state.stored, oldCloth).stored) { // a new blanket: the old one is folded into his chest, like anyone would
        st.made = makeDecor(state.decor, { ...st.details, ...placed, parts: sized, uses: st.uses }, stepStart);
        if (st.made.entry) st.made.hint = `my ${oldCloth} lay there, so I folded that into my chest.`;
      }
      if (st.made.failed && /is full|no room left on/i.test(st.made.failed) && !/wall/i.test(st.made.failed) && state.stored.length < MAX_STORED) { // made, but no top has room: it waits in his chest instead of being lost
        const spot = makeDecor(state.decor, { ...st.details, on: undefined, wall: undefined, where: 'floor', x: undefined, z: undefined, next_to: undefined, ...floorSpot(state, st.details), parts: roomScale(built.parts, st.details), uses: st.uses }, stepStart);
        const why = st.made.failed.split(':')[0].split('. ')[0];
        if (spot.entry && Math.max(...(sizeOf(spot.entry) ?? [0])) >= 0.45) { // big enough not to get lost: it stands on the floor by a wall, where he can see it (not hidden in the chest)
          st.made = { ...spot, warn: `no top had room for it (${why}), so it stands on the floor by a wall. To put it on a top I make room first (move something, or build a bigger shelf or table), then move_thing {name, on: "..."}` };
        } else if (spot.entry) {
          state.stored.push({ ...spot.entry, roomScaled: true, storedAt: new Date().toISOString() });
          st.made = { name: spot.entry.name, stored: true, entry: null, hint: `there was no room for it on any top (${st.made.failed.split(':')[0]}), so it waits in my chest. To show it I make room first (move something, or build a bigger shelf or table), then take_out` };
        }
      }
      if (st.made.entry) {
        st.made.entry.roomScaled = true;
        state.decor.push(st.made.entry);
        gotWant(state, st.made.entry.name, 'made it myself'); // something from his list of wants, made by himself
        const promised = st.details.blueprint ? markBuilt(state, st.details.blueprint, new Date(stepStart).toISOString(), st.made.entry) : [];
        const added = ensureBehaviors(st.made.entry);
        const noSpot = st.made.entry.kind === 'floor' && !Object.keys(placed).length && !st.details.on && !st.details.wall && !st.details.where && !(Number.isFinite(Number(st.details.x)) && Number.isFinite(Number(st.details.z)));
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
        const placeWarn = st.made.warn ?? null; // what the placing itself said (the desk was full, it was too big for a top...)
        st.made.warn = st.made.autoNote?.startsWith('I gave no place, so it stands') ? st.made.autoNote : placeWarn || accessProblem(state.decor, st.made.entry) || purposeProblem(st.made.entry) || behaviorProblem(st.made.entry) || (promised.length ? `the blueprint promised more than it does yet: ${promised.join(', ')}` : null) || (off > 0.5 ? `it went to x ${st.made.entry.pos[0]}, z ${st.made.entry.pos[2]}, not where I asked, because there was no room there` : null);
        const hintBefore = st.made.hint ?? null; // what was said while placing it (the old blanket went into the chest)
        st.made.hint = [st.made.warn ? null : purposeHint(st.made.entry) || (added ? `it works: I gave it a use that really does it (${st.made.entry.uses.find((u) => u.does)?.label})` : null), hintBefore].filter(Boolean).join(' ') || null;
        const fits = capacityText(st.made.entry, sizeOf(st.made.entry)); // how many it is for, so he learns what size things need
        if (built.fixes.length || fits) st.made.hint = [st.made.hint, fixWords(built.fixes), fits].filter(Boolean).join(' ');
        if (st.made.entry.cover) st.made.hint = [st.made.hint, `it lies ${st.made.entry.label}: the game fitted it to the whole top and lets the edges hang down`].filter(Boolean).join(' ');
        const isFor = forHint(state, st.made.entry);
        if (isFor) st.made.hint = [st.made.hint, isFor].filter(Boolean).join(' ');
        settleRoom(state.decor); // things on the bed stand on the new blanket
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
            st.reward = 'first';
          }
        }
        if (use.effect && use.effect !== 'fullness' && (!e.usedAt || Date.now() - Date.parse(e.usedAt) > 30 * 60_000)) {
          nudge(state, use.effect, 0.8); // using it lifts a bar a little, at most once every half hour per thing
          e.usedAt = new Date().toISOString();
        }
      }
    }
    if (st.action === 'change_thing') st.made = updateDecor(state.decor, st.details, stepStart);
    if (st.action === 'move_thing') {
      const spots = new Map(state.decor.map((d) => [d.id, JSON.stringify([d.pos, d.base ?? null, d.zone ?? null, d.rotY ?? 0])]));
      st.made = moveThing(state.decor, state.chest, isOutside(st.details.where) && !st.details.on ? { ...st.details, worldOpen: [...new Set([...unlockedKeys(state), ...knownKeys(state)])] } : st.details, stepStart);
      const it = st.made.failed ? null : state.decor.find((d) => d.name === st.made.name);
      if (it && /no room left on/.test(String(st.made.warn ?? '')) && spots.get(it.id) === JSON.stringify([it.pos, it.base ?? null, it.zone ?? null, it.rotY ?? 0])) { // it did not move: it could not go there, and it stands where it stood
        st.made = { failed: `${String(st.made.warn).split(', so ')[0]}, so it stays where it was. I take something off there first (move_thing or remove_decoration), or I leave it`, hinted: true, name: st.made.name };
      }
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
    if (['change_thing', 'extend_thing'].includes(st.action) && st.made && !st.made.failed) { // what the builder did, and the things on it that moved along
      const said = [fixWords(st.made.fixes), st.made.reseated?.length ? `What stood on it moved along: ${st.made.reseated.join(', ')}.` : '', capacityText(st.made.entry, sizeOf(st.made.entry))].filter(Boolean).join(' ');
      if (said) st.made.hint = [st.made.hint, said].filter(Boolean).join(' ');
    }
    if (st.action === 'make_clothes') {
      const need = missingTool(state, 'make_clothes');
      st.made = need ? { failed: need } : makeClothes(state.wardrobe, st.details, stepStart);
    }
    if (st.action === 'make_move') st.made = makeMove(state, st.details, stepStart);
    if (st.action === 'blueprint') st.made = makeBlueprint(state, st.details, new Date(stepStart).toISOString(), Date.now(), steps.slice(0, i).filter((x) => ['search_web', 'read_book'].includes(x.action)).map((x) => `${x.details?.query ?? ''} ${x.details?.topic ?? ''} ${x.found?.title ?? ''}`));
    if (st.action === 'buy') st.made = buy(state, st.details.item ?? st.details.name ?? st.details.what);
    if (st.action === 'buy' && st.made?.bought) gotWant(state, st.made.bought, 'bought it myself');
    if (st.action === 'buy' && st.made?.bought && i === steps.length - 1) startOuting(state, { errand: st.made.bought }, stepStart); // a quick walk to the corner shop and back (when nothing else is planned after it)
    if (st.action === 'go_out' && st.as === 'fetch_note') { const job = fetchJob(state); if (job) st.details = { ...st.details, job }; else st.made = { failed: 'no note lies there for me right now' }; } // he goes to get what someone left for him
    if (st.action === 'go_out' && st.as === 'shape_land') { const plan = planLand(state, st.details.land, stepStart); if (plan.failed) st.made = plan; else st.details = { ...st.details, job: plan.job }; } // he shapes the land: first see if it fits there
    if (st.action === 'go_out' && !st.made?.failed) st.made = startOuting(state, st.details, stepStart);
    if (st.action === 'cook') {
      const d0 = st.details ?? {};
      if (!text(d0.dish ?? d0.name, 60) || !(Array.isArray(d0.ingredients) && d0.ingredients.length)) { // he only said "cook": a simple dish from what is there
        const have = state.pantry.filter((x) => x.kind === 'ingredient' && x.qty > 0).map((x) => x.name).slice(0, 2);
        if (have.length) st.details = { ...d0, dish: text(d0.dish ?? d0.name, 60) || `simple ${have.join(' and ')}`, ingredients: Array.isArray(d0.ingredients) && d0.ingredients.length ? d0.ingredients : have };
      }
      st.made = cook(state, st.details, stepStart);
    }
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
    if (st.action === 'phone') { // his phone: the Lights app, or one of his own apps
      if (!state.phone) st.made = { failed: 'I do not have a phone' };
      else if (st.details.app && !st.details.lamp) {
        const a = (state.apps ?? []).find((x) => x.name.toLowerCase().includes(String(st.details.app).toLowerCase().trim()));
        st.made = a ? { opened: a.name, text: `I opened ${a.name} on my phone` } : { failed: `there is no app called "${text(st.details.app, 40)}" on my phone. My apps: Lights${(state.apps ?? []).map((x) => `, ${x.name}`).join('')}` };
      } else st.made = applyLight(state, { ...st.details, timer: st.details.timer && typeof st.details.timer === 'object' ? st.details.timer : null }, { who: 'Pip', now: stepStart });
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

  const put = settleRoom(state.decor); // after everything he moved, changed or took away: nothing is left floating
  if (put.length) happened(state, `Things in my room were put right: ${put.slice(0, 4).join('; ')}.`);

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
      const today = state.log.filter((e) => e.action === 'print_photo' && !e.failed && isToday(e.at)).length + printedNow;
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
    const stepStart = startedAt + offsets[i];
    const name = text(d.name, 60);
    if (st.action === 'compose') st.made = composeSong(state.decor, d.name, d.song);
    if (st.action === 'record_song') {
      const song = cleanTracks({ tempo: d.tempo, tracks: d.tracks });
      const name = text(d.name, 60);
      const todaySongs = state.studio.songs.filter((x) => isToday(x.createdAt)).length;
      if (!name) st.made = { failed: 'a recording needs a name' };
      else if (!song) st.made = { failed: 'the song had no part with at least 2 sounding notes (for example voice "C4 E4 G4:2" and drums "kick hat snare hat")' };
      else if (todaySongs >= MAX_SONGS_PER_DAY) st.made = { failed: `I already recorded ${MAX_SONGS_PER_DAY} songs today` };
      else {
        const rec = { id: `song${Date.now().toString(36)}${state.studio.songs.length}`, name, why: text(d.why, 200), tempo: song.tempo, tracks: song.tracks.map((t, k) => ({ instrument: t.timbre, notes: text(d.tracks?.[k]?.notes, 400), volume: t.volume, pan: t.pan, reverb: t.reverb })), createdAt: new Date(startedAt + offsets[i]).toISOString(), ...(d.pattern ? { pattern: d.pattern, v: d.v ?? 1, of: d.of ?? null, changed: d.changed ?? null } : {}) };
        state.studio.songs = [...state.studio.songs, rec].slice(-20);
        st.made = { recording: rec };
      }
    }
    const onWall = st.action === 'draw' && st.as === 'paint_wall'; // big, on a wall outside: no paper, no supplies
    if (st.action === 'draw' && !onWall && missingTool(state, 'draw')) st.made = { failed: missingTool(state, 'draw') };
    else if (st.action === 'draw') {
      const clean = cleanSvg(d.svg);
      const art = clean ? { ...clean, svg: sketchStyle(clean.svg, Date.now() % 97) } : null; // drawn in his sketchbook style (art.js)
      const today = state.art.filter((a) => isToday(a.createdAt)).length;
      if (drew) st.made = { failed: 'one drawing per wake-up is enough' };
      else if (!name) st.made = { failed: 'he did not give it a name' };
      else if (today >= MAX_ART_PER_DAY) st.made = { failed: 'he has already drawn enough for today' };
      else if (!art) st.made = { failed: 'the drawing did not work out' };
      else if (onWall && !canGo(state, 'walls', stepStart).ok) st.made = { failed: `${canGo(state, 'walls', stepStart).why}, so I cannot go out to paint now`, hinted: true };
      else {
        drew = true;
        const id = `art${Date.now().toString(36)}${state.art.length}`;
        const file = `made/${id}.svg`;
        await mkdir('web/made', { recursive: true });
        await writeFile(`web/${file}`, art.svg);
        const target = onWall ? paintTarget(d.wall, Date.now()) : null; // the wall he named, or one picked for him
        state.art = [...state.art, { id, name, why: text(d.why, 200), file, aspect: art.aspect, mood: text(state.mood, 30) || null, createdAt: new Date().toISOString(), ...(target ? { wall: target.key } : {}) }].slice(-30); // like Pino: each drawing keeps the mood he drew it in
        state.gallery = [...(state.gallery ?? []), { id, name, file, aspect: art.aspect, at: new Date().toISOString(), ...(target ? { wall: target.key } : {}) }].slice(-400); // everything he ever drew: kept at his art workshop
        const went = target ? startOuting(state, { job: { place: 'walls', kind: 'paint', art: id, name, wall: target.key, wallName: target.name, spot: `paint_${target.key}`, words: `paint "${name}" on ${target.name}` } }, stepStart) : null;
        if (went?.failed) for (const a of [state.art.at(-1), state.gallery.at(-1)]) delete a.wall; // he could not go after all: it is a drawing in his album
        else if (went) state.gallery.at(-1).at = new Date((Date.parse(state.where.arriveAt) + Date.parse(state.where.leaveAt)) / 2).toISOString(); // it is on the wall when he has been painting there for a while
        if (target) { st.made = went.failed ? { drawn: name, image: file, hint: `I could not go out to paint it (${went.failed}), so it is a drawing in my album` } : { drawn: name, image: file, painted: target.name, outing: went, hint: `I am on my way to ${target.name} to paint it there. I am back ${went.backWords}.` }; }
        const placed = target ? { failed: 'on a wall outside' } : placePicture(state.decor, { id, image: file, caption: name, aspect: art.aspect }, d.where, startedAt + offsets[i], Date.now(), ART_MAX, d);
        if (target) {} // painted outside: nothing to hang in his room
        else if (placed.entry) {
          Object.assign(placed.entry, { art: id, name, why: text(d.why, 200) });
          state.decor.push(placed.entry);
          st.made = placed;
        } else st.made = { drawn: name, image: file, hint: `it is in my album: ${placed.failed.replace(/^there is /, 'there is ')}` }; // the drawing is made: walls being full is no failure
      }
    }
    if (st.action === 'make_site' || st.action === 'update_site') { // his own website, written at the internet café (site.js)
      if (st.action === 'update_site' && !state.site) st.made = { failed: 'I have no website yet: I make one first (make_site)', hinted: true };
      else {
        const before = state.site ? await readFile(`web/${SITE_FILE}`, 'utf8').catch(() => null) : null;
        const built = buildSite(state, d, before, stepStart);
        if (built.failed) st.made = { failed: built.failed };
        else {
          await mkdir('web/made', { recursive: true });
          await writeFile(`web/${SITE_FILE}`, built.html);
          const first = !state.site;
          state.site = built.site;
          st.made = { site: { title: built.site.title, v: built.site.v, file: SITE_FILE }, hint: first ? 'my website is on the internet now' : `version ${built.site.v}: ${built.site.changes.at(-1).change}` };
        }
      }
    }
    if (st.action === 'update_app') {
      const n = text(d.name, 60).toLowerCase();
      const app = n ? state.apps.find((a) => a.name.toLowerCase() === n) ?? state.apps.find((a) => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase())) : null;
      const before = app ? await readFile(`web/${app.file}`, 'utf8').catch(() => null) : null;
      const edited = Array.isArray(d.edits) && d.edits.length && before ? applyEdits(before, d.edits) : null; // small edits, like a coder (apps.js)
      const html = edited ? (edited.html ? cleanApp(edited.html) : null) : cleanApp(d.html);
      if (edited?.failed) { st.made = { failed: `my edit did not fit: ${edited.failed}` }; }
      const today = state.apps.filter((a) => a.updatedAt && isToday(a.updatedAt)).length;
      if (st.made?.failed) {} // the edit did not fit
      else if (!app) st.made = { failed: 'there is no app with that name on his computer' };
      else if (updatedApp) st.made = { failed: 'one app change per wake-up is enough' };
      else if (today >= MAX_APP_UPDATES_PER_DAY) st.made = { failed: 'he has already changed enough apps for today' };
      else if (!html) st.made = { failed: 'the new app did not work out (too big, or not a web page)' };
      else {
        updatedApp = true;
        await writeFile(`web/${app.file}`, html);
        const test = await testApp(app.file); // he runs it, like a coder: an error means the old version comes back and a fix ticket is added
        if (test.errors?.length && before) {
          await writeFile(`web/${app.file}`, before);
          addFixTicket(state, app.name, test.errors[0]);
          st.made = { failed: `my change broke ${app.name}: ${test.errors[0]}. The old version is back, and "fix" is now the first ticket on my board` };
          continue;
        }
        app.updatedAt = new Date().toISOString();
        if (text(d.why, 200)) app.why = text(d.why, 200);
        app.bugs = []; // it ran without errors
        app.v = (app.v ?? 1) + 1; // each change is a new version, like Pino's train simulator growing day by day
        app.changes = [...(app.changes ?? []), { v: app.v, at: app.updatedAt, change: text(d.change ?? d.what, 160) }].slice(-30);
        st.made = { app: { id: app.id, file: app.file, name: app.name }, changed: true, hint: `version ${app.v}${text(d.change, 120) ? `: ${text(d.change, 120)}` : ''}` };
      }
    }
    if (st.action === 'make_app') {
      const html = cleanApp(d.html);
      const today = state.apps.filter((a) => isToday(a.createdAt)).length;
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
        const icon = [...String(d.icon ?? '')].filter((c) => /\p{Extended_Pictographic}/u.test(c)).slice(0, 1).join('') || null; // one emoji for his phone
        state.apps = [...state.apps, { id, name, title: text(d.title, 22) || null, icon, why: text(d.why, 200), file, createdAt: new Date().toISOString() }];
        st.made = { app: { id, file, name } };
        const test = await testApp(file);
        if (test.errors?.length) { addFixTicket(state, name, test.errors[0]); st.made.warn = `when I ran it, it showed an error: ${test.errors[0]}. Fixing it is my next ticket`; }
      }
    }
  }

  // Camera and pictures from the internet. A photo is drawn by the website itself in a hidden browser (photo.js), so it needs the room as it is now.
  const MAX_PHOTOS = 4;
  const MAX_FOUND = 6;
  let shotsToday = state.pictures.filter((p) => p.by === 'pip' && isToday(p.at)).length;
  let foundToday = state.found.filter((f) => isToday(f.at)).length;
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
      const camera = ['close', 'wide', 'low', 'high'].includes(String(d.camera ?? '').toLowerCase()) ? String(d.camera).toLowerCase() : null;
      const shot = await takePhoto(target, when, state, 'web', recentShots, camera);
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
      const pic = { id: `pic${n}`, image: `photos/${file}`, mime: 'image/jpeg', at: when, by: 'pip', target, caption, seen: true, notes: caption, aspect: 1.33, ...(camera ? { camera } : {}), ...(d.retake ? { retakeOf: d.retake } : {}) };
      state.pictures = trimPictures([...state.pictures, pic]);
      shotsToday++;
      st.made = { picture: pic };
      await lookAtPhoto(state, pic, shot.bytes, d, soul, system); // a vision call: did it work, and why does it matter to me?
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
    // Food never appears by itself: he can only eat what is really in his pantry (grown, cooked, found or given).
    st.ate = gain ? eatNow(state, Date.now(), gain) : { failed: `I have no ${text(st.details.food, 40) || 'food'}. Food does not appear by itself: I grow it, cook it, or ask Bas for some` };
    if (st.ate.ok) eatFromPantry(state, st.details.food);
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
  const TASK_WORK = ['decorate', 'extend_thing', 'change_thing', 'move_thing', 'draw', 'compose', 'make_app', 'update_app', 'make_site', 'update_site', 'make_clothes', 'cook', 'place_tool', 'take_tool', 'make_move', 'print_photo', 'place_picture'];
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
    { ...answer, action: steps[0].action, as: steps[0].as, details: steps[0].details, asks_add: [...(Array.isArray(answer.asks_add) ? answer.asks_add : []), ...stepAsks] },
    results[0].detail,
    unread.length > 0
  );

  if (unread.length) felt(state, 'message');
  const readAt = new Date().toISOString();
  unread.forEach((m) => {
    m.read = true;
    m.readAt = readAt;
    const mm = addMemory(state, `Someone wrote to me: "${String(m.text ?? '').slice(0, 140)}"`, 7, 'memory', readAt);
    if (mm) mm.private = true;
  });
  // (Looking back and rewriting his story now happen once a night, in the sleep call.)
  // Now and then he looks back and writes down what he realized (at most a few times a day, and only when enough has happened).
  // (No daytime reflection call any more.)

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
      if (st.action === 'browse') { // he browses: the game opens something, and it leaves a spark (curiosity.js)
        lookups++;
        st.browsed = await browse(state, { wiki: wikiGet, read: readArticle });
        if (st.browsed?.failed) st.made = { failed: st.browsed.failed };
        else state.notes.push(`Browsing the web I came across ${st.browsed.title}${st.browsed.via ? ` (near ${st.browsed.via})` : ''}: ${clip(st.browsed.text, 300)}`);
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
    if (st.found && ['search_web', 'read_book'].includes(st.action)) noteSpark(state, { topic: st.found.title, text: st.found.text, url: st.found.url, from: st.action === 'search_web' ? 'search' : 'read' });
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
    const entry = { at: new Date(startedAt + offsets[i] + 1000).toISOString(), action: st.action, thought: st.thought, ...(st.as ? { as: st.as } : {}) }; // "as": a real move (plan, judge...) carried out as a "do"
    if (st.fallback) entry.fallback = true;
    const page = (p) => (p ? { title: p.title, url: p.url, text: clip(p.text, 1500) } : null);
    if (st.dupSearch) entry.dup = true;
    if (st.sameTune) entry.sameTune = st.sameTune;
    if (st.action === 'browse') Object.assign(entry, { topic: st.browsed?.via ?? null, opened: st.browsed?.title ? { title: st.browsed.title, url: st.browsed.url, text: st.browsed.text } : null, failed: st.made?.failed ?? null });
    if (st.action === 'search_web') Object.assign(entry, { query: text(d.query, 160), results: st.search?.results ?? [], opened: page(st.search?.opened) });
    if (st.action === 'read_book') Object.assign(entry, { topic: text(d.topic, 160), opened: page(st.read) });
    if (['search_web', 'read_book'].includes(st.action) && entry.opened) noteResearch(state, { query: entry.query ?? entry.topic, page: entry.opened, at: entry.at, project: st.details?.project ?? st.forStep?.project }); // his notebook
    if (st.action === 'play_piano') Object.assign(entry, { notes: text(d.notes, 200), style: text(d.style, 80), instrument: [...TIMBRES, 'voice'].includes(String(d.instrument ?? '').toLowerCase()) ? String(d.instrument).toLowerCase() : undefined });
    if (st.action === 'write_diary') entry.text = text(d.text, 800);
    if (st.action === 'walk_to') entry.object = text(d.object, 60);
    if (st.action === 'ask_for') Object.assign(entry, { item: text(d.item, 140), reason: text(d.reason, 200) });
    if (st.action === 'place_picture') Object.assign(entry, { name: st.made?.entry?.name ?? text(d.id, 20), place: withWarn(st.made?.entry?.label, st.made), image: st.made?.entry?.image ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'print_photo' || st.action === 'take_down_print') Object.assign(entry, { name: st.made?.entry?.name ?? st.made?.removed ?? text(d.id, 30), image: st.made?.entry?.image ?? null, place: st.made?.entry?.label ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'take_down_picture') Object.assign(entry, { name: text(d.id, 20), removed: st.made?.removed ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'record_song') Object.assign(entry, { name: text(d.name, 60), tempo: st.made?.recording?.tempo ?? null, tracks: st.made?.recording?.tracks ?? null, why: text(d.why, 200), failed: st.made?.failed ?? null });
    if (st.action === 'compose') Object.assign(entry, { name: text(d.name, 60), song: st.made?.song ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'draw') Object.assign(entry, { name: text(d.name, 60), why: text(d.why, 200), image: st.made?.entry?.image ?? st.made?.image ?? null, place: withWarn(st.made?.entry?.label ?? (st.made?.painted ? `on ${st.made.painted}, outside` : st.made?.drawn ? 'in my album' : null), st.made), failed: st.made?.failed ?? null });
    if (st.action === 'make_app') Object.assign(entry, { name: text(d.name, 60), why: text(d.why, 200), file: st.made?.app?.file ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'use') Object.assign(entry, { verdict: text(d.verdict, 240) || null, testNote: st.testNote ?? null });
    if (st.action === 'use') Object.assign(entry, { name: st.made?.used?.name ?? text(d.name, 60), label: st.made?.used?.label ?? text(d.label, 30), text: st.made?.used?.text ?? '', view: st.made?.used?.view ?? null, song: st.made?.used?.song ?? null, app: st.made?.used?.app ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'add_use') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), label: st.made?.use?.label ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'eat') Object.assign(entry, { food: text(d.food, 80), failed: st.ate?.failed ?? null });
    if (st.action === 'blueprint') Object.assign(entry, { name: st.made?.blueprint?.name ?? text(d.name, 60), goal: st.made?.blueprint?.goal ?? text(d.goal, 200), mechanisms: (st.made?.blueprint?.mechanisms ?? []).map((m) => ({ part: m.part, uses: m.uses, ok: m.ok })), missing: (st.made?.missing ?? []).map((m) => m.part), failed: st.made?.failed ?? null });
    if (st.action === 'make_move') Object.assign(entry, { name: st.made?.move?.name ?? text(d.name, 40), why: text(d.why, 200), frames: st.made?.move?.frames?.length ?? 0, failed: st.made?.failed ?? null });
    if (st.action === 'do' && text(d.move, 60) && !findMove(state, d.move)) entry.failed = `I have no move called "${text(d.move, 60)}". I design one first with make_move`;
    if (st.action === 'do') Object.assign(entry, { move: findMove(state, d.move)?.name ?? null, emoji: [...text(d.emoji, 12)].slice(0, 2).join(''), what: text(d.what, 160), feeling: ['fullness', 'energy', 'wonder', 'joy', 'calm'].includes(d.feeling) ? d.feeling : null });
    if (st.action === 'decorate') Object.assign(entry, { uses: (st.made?.entry?.uses ?? []).map((u) => u.label), song: st.made?.entry?.song ?? null, project: text(d.project, 80), name: text(d.name, 60), why: text(d.why, 200), place: withWarn(st.made?.entry?.label ?? (st.made?.printed ? 'at the print workshop, on my shelf of prints' : st.made?.stored ? 'in my chest' : null), st.made), tool: st.made?.tool?.name ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'extend_thing') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), added: st.made?.added ?? 0, total: st.made?.total ?? 0, side: st.made?.side ?? null, joined: st.made?.joined ?? null, place: withWarn(st.made?.entry?.label ?? null, st.made), failed: st.made?.failed ?? null });
    if (st.action === 'move_thing') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), place: withWarn(st.made?.label ?? (st.made?.chest ? 'in a new place' : null), st.made), failed: st.made?.failed ?? null });
    if (st.action === 'change_thing') Object.assign(entry, { name: st.made?.name ?? text(d.name, 60), grew: st.made?.grew ?? null, limited: st.made?.limited ?? false, reshaped: st.made?.reshaped ?? false, place: withWarn(st.made?.label ?? null, st.made), failed: st.made?.failed ?? null });
    if (st.action === 'make_site' || st.action === 'update_site') Object.assign(entry, { name: st.made?.site?.title ?? state.site?.title ?? text(d.title, 60) ?? null, change: st.action === 'update_site' ? text(d.change ?? d.what, 160) || null : null, why: text(d.why, 200) || null, v: st.made?.site?.v ?? null, file: st.made?.site?.file ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'update_app') Object.assign(entry, { name: text(d.name, 60), file: st.made?.app?.file ?? null, change: text(d.change, 160) || null, v: state.apps.find((a) => a.id === st.made?.app?.id)?.v ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'make_clothes' || st.action === 'wear' || st.action === 'take_off') Object.assign(entry, { name: st.made?.entry?.name ?? st.made?.name ?? text(d.name, 60), slot: st.made?.entry?.slot ?? st.made?.slot ?? null, why: text(d.why, 200), failed: st.made?.failed ?? null });
    if (st.action === 'go_out') Object.assign(entry, { place: st.made?.place ?? null, placeName: st.made?.name ?? text(d.place, 40), what: st.made?.words ?? null, back: st.made?.back ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'buy') Object.assign(entry, { item: st.made?.bought ?? text(d.item ?? d.name, 40), price: st.made?.price != null ? `${st.made.price} coin${st.made.price === 1 ? '' : 's'}, ${st.made.left} left` : null, failed: st.made?.failed ?? null });
    if (st.action === 'cook') Object.assign(entry, { dish: text(d.dish ?? d.name, 60), ingredients: (Array.isArray(d.ingredients) ? d.ingredients : []).slice(0, 4).map((x) => text(x, 40)), failed: st.made?.failed ?? null });
    if (st.action === 'take_photo') Object.assign(entry, { target: text(d.target, 60), caption: text(d.caption, 300), image: st.made?.picture?.image ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'find_picture') Object.assign(entry, { query: text(d.query, 80), caption: text(d.caption, 200), picture: st.made?.found?.image ?? null, title: st.made?.found?.title ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'remove_decoration') Object.assign(entry, { name: text(d.name, 60), stored: st.made?.stored ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'place_tool') Object.assign(entry, { name: st.made?.entry?.name ?? text(d.name, 60), place: st.made?.entry?.label ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'request_ability') Object.assign(entry, { name: text(d.name, 40), result: st.made?.request?.what ?? null, failed: st.made?.failed ?? null });
    if (['plant', 'water', 'harvest'].includes(st.action)) Object.assign(entry, { name: st.made?.plant ?? text(d.seed ?? d.plant, 40), result: st.made?.text ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'check_light') Object.assign(entry, { where: st.made?.where ?? text(d.where ?? d.name, 60), result: st.made?.text ?? null, failed: st.made?.failed ?? null });
    if (st.action === 'phone') Object.assign(entry, { lamp: text(d.lamp, 60), app: text(d.app, 60), result: st.made?.text ?? null, failed: st.made?.failed ?? null });
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
    noteMove(state, e.as ?? e.action, { failed: Boolean(e.failed), now: Math.min(Date.now(), Date.parse(e.at)) });
    if (e.failed) continue;
    const up = practise(state, e.action, { ...e, name: e.name ?? e.details?.name, query: e.query, topic: e.topic });
    if (!e.failed && ['draw', 'decorate', 'make_app', 'update_app', 'record_song', 'play_piano', 'cook', 'read_book', 'search_web', 'blueprint', 'make_clothes', 'take_photo'].includes(e.action)) practiseInterest(state, `${e.name ?? ''} ${e.query ?? ''} ${e.topic ?? ''} ${e.what ?? ''}`); // doing something about an interest is practice (curiosity.js)
    if (up) { addMemory(state, `My ${up.skill} got better: I am level ${up.level} now.`, 6, 'memory', new Date().toISOString()); console.log(`   📈 ${up.skill} is level ${up.level}`); }
  }
  const VERSION_WORK = ['decorate', 'change_thing', 'extend_thing', 'draw', 'record_song', 'make_app', 'update_app', 'make_clothes', 'cook'];
  let ticked = (answer.projects_update ?? []).some((u) => Array.isArray(u?.step_done) && u.step_done.length);
  for (const st of steps) { // something really made for a project is its next version, and moves the plan one step on
    if (!VERSION_WORK.includes(st.action) || !st.details?.project || !st.made || st.made.failed) continue;
    const v = addVersion(state, st.details.project, { kind: st.action, name: st.made?.name ?? st.made?.recording?.name ?? st.details.name ?? st.details.what, ref: st.made?.entry?.id ?? st.made?.id ?? st.made?.recording?.id ?? null });
    if (!v) continue;
    console.log(`   🧩 ${v.project}: v${v.v}`);
    const step = !ticked && findProject(state, v.project)?.steps?.find((x) => !x.done);
    if (step) { step.done = true; ticked = true; console.log(`   ✓ step done: ${step.text}`); }
    const fin = finishDone(state, v.project);
    if (fin) { addMemory(state, `My project "${fin.title}" is finished: all my steps are done and I made it ${fin.versions.length} times. It works, and I can start something new.`, 7, 'memory', new Date().toISOString()); console.log(`   🏁 project done: ${fin.title}`); }
  }
  // A step the game did for a project (work_on_project) is ticked off when it really worked (waiting always works).
  for (const st of steps) {
    if (!st.forStep) continue;
    const worked = st.waits ? true // waiting is time passing
      : ['search_web', 'read_book'].includes(st.action) ? Boolean(st.search?.opened ?? st.read) // he found something to read
      : st.action === 'play_piano' ? !st.made?.failed
      : Boolean(st.made) && !st.made.failed;
    const p = findProject(state, st.forStep.project);
    if (!worked) { // the same step failing again and again: after 2 tries it waits, and he plans it again
      if (p && /That is enough of those/.test(String(st.made?.failed ?? ''))) { // it can never work: the project and the goal for it are let go
        const kind = /things that are an? (\w+)|have \d+ (lamp)s/.exec(st.made.failed);
        const word = kind?.[1] ?? kind?.[2] ?? 'thing';
        Object.assign(p, { status: 'dropped', droppedWhy: `I have enough ${kindsWord(word)} already`, updatedAt: new Date().toISOString() });
        letGoGoals(state, (t) => new RegExp(`\\b(${word}|${kindsWord(word)})\\b`, 'i').test(t), `I have enough ${kindsWord(word)}`);
        addMemory(state, `I wanted to make one more ${word} ("${p.title}"). I have enough ${kindsWord(word)}. I let that plan go.`, 5, 'memory', new Date().toISOString());
        console.log(`   🗑️  project let go: ${p.title} (enough ${kindsWord(word)})`);
        continue;
      }
      if (p) p.stuck = p.stuck?.text === st.forStep.text ? { text: st.forStep.text, n: p.stuck.n + 1, at: new Date().toISOString() } : { text: st.forStep.text, n: 1, at: new Date().toISOString() };
      continue;
    }
    if (p) p.stuck = null;
    const step = p?.steps?.find((x) => !x.done && x.text === st.forStep.text);
    if (step) { step.done = true; p.updatedAt = new Date().toISOString(); ticked = true; console.log(`   ✓ ${p.title}: ${step.text}`); }
  }
  // Real work that matches a project's next step ticks it (cooking "mix flour" for "mix flour, water and salt",
  // looking up "how to knead dough" for "learn how to knead"). Pretend "do" steps and walking never count.
  if (!ticked) for (const st of steps) {
    if (ticked || ['do', 'walk_to', 'rest', 'tell', 'eat'].includes(st.action) || !st.made || st.made.failed) continue;
    const did = new Set(words(`${st.action.replace(/_/g, ' ')} ${['what', 'name', 'dish', 'query', 'topic', 'seed', 'plant', 'change', 'add'].map((k) => st.details?.[k] ?? '').join(' ')} ${(st.details?.ingredients ?? []).join(' ')}`));
    for (const p of state.projects.filter((x) => x.status === 'working')) {
      const next = (p.steps ?? []).find((x) => !x.done);
      const want = next ? words(next.text) : [];
      const shared = want.filter((w) => did.has(w) || did.has(w.replace(/s$/, '')) || did.has(`${w}s`));
      const fits = STEP_VERBS[st.action]?.test(next?.text ?? '');
      if (next && (shared.length >= Math.min(2, want.length) || (fits && shared.length >= 1) || (fits && st.action === 'record_song'))) { next.done = true; p.updatedAt = new Date().toISOString(); ticked = true; console.log(`   ✓ step done (${st.action}): ${next.text}`); break; }
    }
  }
  // Growing: a failed move becomes a lesson, a move that works counts as learned, and a thing that worked goes in the recipe book.
  for (const e of state.log.filter((x) => Date.parse(x.at) >= startedAt - 1000)) {
    if (e.failed) noteLesson(state, e.action, e.failed, e.at);
    else noteWorked(state, e.action, e.at);
  }
  for (const st of steps) {
    if (!st.made || st.made.failed) continue;
    if (['decorate', 'change_thing', 'extend_thing', 'make_clothes'].includes(st.action)) {
      const id = st.made?.entry?.id ?? st.made?.id;
      const name = st.made?.name ?? st.made?.entry?.name ?? st.details?.name;
      const thing = [...(state.decor ?? []), ...(state.wardrobe ?? [])].find((d) => (id && d.id === id) || (name && d.name === name));
      if (thing?.parts?.length) saveRecipe(state, { kind: st.action === 'make_clothes' ? 'make_clothes' : 'decorate', name: thing.name, why: thing.why ?? st.details?.why, parts: thing.parts });
    }
    if (st.action === 'record_song' && st.made.recording?.pattern) saveRecipe(state, { kind: 'record_song', name: st.made.recording.name, why: st.made.recording.why, song: describePattern(st.made.recording.pattern) });
  }
  if ((answer.asks_add ?? []).some((a) => a?.big)) state.bigDreamAt = new Date().toISOString();
  noteMood(state, state.mood);
  noteLift(state, steps.map((x) => x.action), feelBefore, feelSum(state), feelDiff(partsBefore, feelParts(state)));
  const failedNow = state.log.filter((x) => Date.parse(x.at) >= startedAt - 1000 && x.failed).at(-1);
  if (failedNow) state.plan.lastFail = { at: new Date().toISOString(), why: `${failedNow.action}: ${failedNow.failed}` };
  for (const line of keepWishes(state, state.log.filter((x) => Date.parse(x.at) >= startedAt - 1000))) { // he made what a note on the notice board asked for
    console.log(`🪙 ${line}`);
    happened(state, line);
    state.log.push({ at: new Date(Math.max(Date.now(), ...state.log.slice(-6).map((x) => Date.parse(x.at) || 0)) + 1000).toISOString(), action: 'happened', what: line, emoji: '🪙' }); // in his day, right after what he made
    addMemory(state, line, 7, 'memory', new Date().toISOString());
    nudge(state, 'joy', 1);
  }
  { const w = planRetry(state, state.log.filter((x) => Date.parse(x.at) >= startedAt - 1000)); if (w) console.log(`⏰ ${w.action} did not work: Pip wakes again at ${w.at.slice(11, 19)} to try another way`); }
  { // next time he looks at what he made now (his newest drawing, program or thing)
    const made = [...steps].reverse().find((st) => st.made && !st.made.failed && ['draw', 'make_app', 'update_app', 'decorate', 'change_thing', 'extend_thing'].includes(st.action));
    if (made) {
      const art = made.action === 'draw' ? state.art.find((a) => a.name === (made.made.drawn ?? made.made.entry?.name ?? made.details?.name)) ?? state.art.at(-1) : null;
      const app = made.made.app ?? null;
      const name = art?.name ?? app?.name ?? made.made.entry?.name ?? made.made.name ?? made.details?.name;
      if (name && !made.made.stored) state.lookBack = { kind: art ? 'drawing' : app ? 'app' : 'thing', name, file: art?.file ?? app?.file ?? null, at: new Date().toISOString() };
    }
  }
  { // the loop breaker: the same choice 3 times with nothing to show rests that move for a while
    const mine = state.log.filter((x) => Date.parse(x.at) >= startedAt - 1000);
    const rested = noteChoice(state, choice, gotSomewhere(mine), state.plan.lastFail?.why, Date.now(), mine.some((x) => x.failed && !x.fallback));
    if (rested) console.log(`🛑 loop: ${rested.key} chose 3 times with nothing to show; it rests until ${rested.until}`);
    for (const off of noteFailures(state, mine)) console.log(`🛑 off for today: ${off.key} failed 3 times (${off.why.slice(0, 80)})`);
    for (const { hobby, became } of practiseHobby(state, mine)) {
      console.log(`   🌱 for his hobby ${hobby.topic}: ${hobby.practice} time${hobby.practice === 1 ? '' : 's'}${became ? ` (${became})` : ''}`);
      if (became === 'real') addMemory(state, `${hobby.topic} is a real hobby of mine now: I did it ${hobby.practice} times, and it started as my own idea.`, 7, 'memory', new Date().toISOString());
      if (became === 'mastered') addMemory(state, `I have done ${hobby.topic} so often that I am good at it now.`, 8, 'memory', new Date().toISOString());
    }
    for (const gone of dropUntriedHobbies(state)) { addMemory(state, `I wanted to try ${gone.topic} as a hobby. I never did. I let the idea go.`, 4, 'memory', new Date().toISOString()); console.log(`   🍂 let go of the hobby idea: ${gone.topic}`); }
  }
  state.last = {
    at: new Date(startedAt).toISOString(),
    via,
    model: process.env.PIP_FAKE ? (via === 'brain' ? 'fake' : null) : spent.calls ? usedModel : null, // null: no model was needed (autopilot)
    models: { ...spent.models },
    ...(quota.notes.length ? { modelNotes: [...quota.notes], fallback: true } : {}),
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
  const privateTick = unread.length > 0; // he read Bas's private messages: what he thought and wrote this time stays private too
  if (privateTick) {
    const since = (x) => Date.parse(x.at) >= startedAt - 1000;
    for (const t of state.thoughts.filter(since)) sealFields(t, ['text', 'short', 'inner', 'detail']);
    for (const e of state.log.filter(since)) sealFields(e, ['thought', 'text', 'detail']);
    for (const m of state.memories.filter(since)) m.private = true;
    sealFields(state.last, ['thought', 'inner', 'detail']);
    for (const st of state.last.steps ?? []) { sealFields(st, ['thought', 'detail']); if (st.details) sealFields(st.details, ['text', 'what', 'query', 'topic']); }
    state.last.private = true;
  }
  { // the live feed: the small moments of the minutes ahead, each with its own time (moments.js; plain code)
    const mine = state.log.filter((x) => Date.parse(x.at) >= startedAt - 1000 || (x.action === 'came_home' && Date.parse(x.at) >= startedAt - 10 * 60_000));
    const fresh = addMoments(state, mine, startedAt, INTERVAL_MIN * 60_000, { quiet: privateTick });
    console.log(`🎞️  ${fresh.length} small moments for the live feed`);
  }
  noteArc(state); // his mood over the day, for the chart on the Today tab (arc.js)
  for (const name of markForMuseum(state, startedAt - 1000)) console.log(`🏛️  his room is full: ${name} goes to his museum at the next wake-up`);
  // Curiosity: what caught him (his "spark" answer) grows into interests and hobbies; old interests fade (curiosity.js).
  fadeInterests(state);
  if (answer.spark?.topic) {
    const f = feel(state, answer.spark.topic, answer.spark.how);
    const op = noteOpinion(state, answer.spark); // what he thinks of it, in his own words
    if (op) console.log(`   💭 about ${op.topic} (${op.how}): ${op.says}`);
    if (f?.became === 'interest') { addInterest(state, f.topic); addMemory(state, `I am getting into ${f.topic}. I want to know more about it.`, 7, 'memory', new Date().toISOString()); console.log(`   ✨ new interest: ${f.topic}`); }
    if (f?.became === 'hobby') { addMemory(state, `${f.topic} has become something I love. I could make it a hobby.`, 8, 'memory', new Date().toISOString()); console.log(`   💛 a hobby is calling: ${f.topic}`); }
  }
  // The check-up (plain code, no model): new problems go to Bas's warning channel, each at most once a day.
  try {
    const c = checkup(state, { checkup: state.checkup });
    state.checkup = c.saved;
    const quiet = Date.now() - Date.parse(c.saved.pushedAt ?? 0) < PUSH_GAP_H * 3_600_000;
    if (c.fresh.length && !quiet && !process.env.PIP_FAKE) {
      const body = c.fresh.map((x) => `• ${x.label}: ${x.text}`).join('\n') + '\n\nDetails: Settings (⚙) → Check-up.';
      await warn(`Pip check-up: ${c.fresh.length === 1 ? c.fresh[0].label.toLowerCase() : `${c.fresh.length} things`}`, body);
      markSent(c.saved, c.fresh);
    }
    const today = dayOf();
    if (amsterdamHour(new Date()) >= 21 && state.reportDay !== today && !process.env.PIP_FAKE) { // once an evening: his day in a few lines
      const rep = dayReport(state, kindOf);
      state.reportDay = today;
      if (rep) await warn('Pip today', rep, { tags: 'bird' });
    }
    const bad = c.items.filter((x) => !x.ok).map((x) => x.id);
    if (bad.length) console.log(`🩺 check-up: ${bad.join(', ')}`);
  } catch (e) {
    console.error('⚠️  check-up:', e.message);
  }
  if (letterDue(state)) { // Sunday evening: his weekly letter to Bas (letters.js)
    try {
      const d = weekDigest(state);
      const reply = process.env.PIP_FAKE ? fakeLetter(d) : await askGemini(system, letterPrompt(soul, d, { first: !(state.letters ?? []).length }), 1, [], { schema: letterSchema, maxTokens: THINK_ROOM + 1500, group: 'big', reply: true });
      const m = sendLetter(state, reply, d);
      if (m) { console.log(`💌 Pip wrote his weekly letter${m.imageName ? ` (with "${m.imageName}")` : ''}`); if (!process.env.PIP_FAKE) await notify(m); }
    } catch (e) { console.error('⚠️  letter:', e.message); }
  }
  await saveState(state);
  await clearInbox(inbox.names);
  await clearTasks(taskFiles.names);
  await clearVisitors(visitorFiles);
  await clearFronts(frontFiles.names);
  await clearLights(lightFiles);
  const planLines = steps.map((st, i) => `- ${st.action}${results[i].detail ? ` (${results[i].detail})` : ''}${st.thought ? `: ${st.thought}` : ''}`).join('\n');
  await appendFile(
    DIARY_FILE,
    privateTick ? `## ${new Date().toLocaleString('en-GB')}\nA private moment with Bas.\n\n` : `## ${new Date().toLocaleString('en-GB')}\n${text(answer.thought, 200)}\n${text(answer.inner, 600) ? `> ${text(answer.inner, 600)}\n` : ''}${planLines}\n- mood: ${state.mood}\n\n`
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
    if (st.made?.site) console.log(`      🌐 his website: "${st.made.site.title}", version ${st.made.site.v}`);
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
    quota.ref = ensureQuota(state);
    const items = T.tidyItems(state, await allLogs(state));
    const prompt = T.tidyPrompt(await loadSoul(), items);
    const answer = process.env.PIP_FAKE ? T.fakeTidy(items) : await askGemini('I am Pip. I answer only in JSON.', prompt, 2, [], { group: 'big' });
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
  for (const c of plan.choices) if (c.group === 'tool' && /^\(I did not say/.test(c.reason)) Object.assign(c, { choice: 'keep', reason: '(I use it, so it stays.)' }); // older proposals filed unanswered tools as "store"
  if (plan.appliedAt) { console.log(`This tidy was already applied at ${plan.appliedAt}.`); return; }
  const state = JSON.parse(await readFile(STATE_FILE, 'utf8'));
  ensureMemory(state);
  const at = new Date().toISOString();
  const done = T.applyTidy(state, plan.choices, at);
  addMemory(state, `I had a big tidy and made a fresh start. I kept ${done.keep.filter((n) => !plan.choices.find((c) => c.name === n && (c.group === 'tool' || c.needed))).join(', ') || 'almost nothing'}, and let go of ${done['let go'].length} things.`, 8, 'memory', at);
  await saveState(state);
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
    else await noteError(e).then((st) => saveState(st)).catch(() => {});
  }
  process.exit(e.message.startsWith('Rate limit') ? 0 : 1);
}
