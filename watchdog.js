// Watches the loop from outside. If Pip has not woken up for STUCK_MIN minutes, the loop is stuck:
// it writes web/health.json (the page shows a warning) and sends one push to Bas's phone.
// Exit code 2 means "stuck right now", so the workflow can try to restart the loop.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { checkup } from './checkup.js';
import { awakeMinutes } from './web/sleep.js';

export const STUCK_MIN = 30; // about two missed wake-ups
const HEALTH = 'web/health.json';

export const BACKUP_HOURS = 3; // how long on the backup model before it is worth a message

export function check(state, health, now = Date.now(), primary = process.env.GEMINI_MODEL || '') {
  const lastAt = Date.parse(state?.last?.at ?? '');
  const cfg = state?.sleep ?? { bed: Number(process.env.PIP_BEDTIME ?? 23), wake: Number(process.env.PIP_WAKETIME ?? 8), tz: process.env.PIP_TZ || 'Europe/Amsterdam' };
  const minutes = Number.isFinite(lastAt) ? awakeMinutes(lastAt, now, cfg) : null; // the night does not count
  const stuck = minutes !== null && minutes >= STUCK_MIN;
  const onBackup = state?.last?.fallback === true || (Boolean(primary) && Boolean(state?.last?.model) && state.last.model !== primary && !state?.quota); // models.js marks a real fallback
  const backupSince = onBackup ? (health?.backupSince ?? new Date(now).toISOString()) : null;
  const backupLong = onBackup && now - Date.parse(backupSince) >= BACKUP_HOURS * 3600_000;
  const next = { ...(state?.quota ? { models: { day: state.quota.day, calls: state.quota.calls, out: Object.keys(state.quota.out ?? {}), history: state.quota.history ?? [] } } : {}), backupSince, backupNotified: onBackup ? Boolean(health?.backupNotified) || backupLong : false, stuck, minutes, lastWake: state?.last?.at ?? null, since: stuck ? (health?.stuck ? health.since : new Date(now).toISOString()) : null, healedAt: health?.healedAt ?? null };
  const event = stuck && !health?.stuck ? 'stuck' : !stuck && health?.stuck ? 'recovered' : backupLong && !health?.backupNotified ? 'backup' : null;
  return { next, event };
}

// Warnings go to their own channel: the Pip topic with "-checkup" at the end (no new secret needed), so they do not mix
// with Pip's own messages. Until BOTH_UNTIL they also go to the old topic, so nothing is missed while Bas subscribes.
const BOTH_UNTIL = Date.parse('2026-11-17T00:00:00Z');
async function push(title, body) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  for (const t of [`${topic}-checkup`, ...(Date.now() < BOTH_UNTIL ? [topic] : [])]) await pushTo(t, title, body);
}
async function pushTo(topic, title, body) {
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      body,
      // "from-web" keeps Pip from reading this as a message from Bas.
      headers: { Title: title, Tags: 'warning,from-web', ...(process.env.PIP_SITE_URL ? { Click: process.env.PIP_SITE_URL } : {}) },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    console.error('push failed:', e.message);
  }
}

if (process.argv[1]?.endsWith('watchdog.js')) {
  const state = JSON.parse(readFileSync('web/state.json', 'utf8'));
  const health = existsSync(HEALTH) ? JSON.parse(readFileSync(HEALTH, 'utf8')) : {};
  const { next, event } = check(state, health);
  if (event === 'stuck') await push('Pip seems stuck', `Pip has not woken up for ${next.minutes} minutes. I will try to restart him.`);
  if (event === 'backup') await push('Pip is on a backup model', `For ${BACKUP_HOURS} hours Pip has been answered by a model further down his list (${state.last.model}). The first one is busy or out of free quota. ${(state.last.modelNotes ?? []).join('; ')}`);
  if (event === 'recovered') await push('Pip is awake again', 'He woke up and the loop runs again.');
  // The check-up: how he spends his days. New problems go to the phone in one message, each at most once a day.
  try {
    const c = checkup(state, health);
    next.checkup = c.saved;
    if (c.fresh.length) await push(`Pip check-up: ${c.fresh.length === 1 ? c.fresh[0].label.toLowerCase() : `${c.fresh.length} things`}`, c.fresh.map((x) => `• ${x.text}`).join('\n'));
    const bad = c.items.filter((x) => !x.ok);
    console.log(bad.length ? `check-up: ${bad.map((x) => x.id).join(', ')}` : 'check-up: all fine');
  } catch (e) {
    console.error('check-up failed:', e.message);
    if (health.checkup) next.checkup = health.checkup;
  }
  const same = (a) => JSON.stringify({ ...a, minutes: 0, checkup: { ...a.checkup, at: 0 } });
  if (same(next) !== same(health)) writeFileSync(HEALTH, JSON.stringify(next) + '\n');
  console.log(next.stuck ? `STUCK: ${next.minutes} minutes since the last wake-up` : `fine: last wake-up ${next.minutes} minutes ago`);
  process.exit(next.stuck ? 2 : 0);
}
