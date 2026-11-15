// Watches the loop from outside. If Pip has not woken up for STUCK_MIN minutes, the loop is stuck:
// it writes web/health.json (the page shows a warning) and sends one push to Bas's phone.
// Exit code 2 means "stuck right now", so the workflow can try to restart the loop.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { warn } from './warn.js';
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

const push = (title, body) => warn(title, body);

if (process.argv[1]?.endsWith('watchdog.js')) {
  const state = JSON.parse(readFileSync('web/state.json', 'utf8'));
  const health = existsSync(HEALTH) ? JSON.parse(readFileSync(HEALTH, 'utf8')) : {};
  const { next, event } = check(state, health);
  if (event === 'stuck') await push('Pip seems stuck', `Pip has not woken up for ${next.minutes} minutes. I will try to restart him.`);
  if (event === 'backup') await push('Pip is on a backup model', `For ${BACKUP_HOURS} hours Pip has been answered by a model further down his list (${state.last.model}). The first one is busy or out of free quota. ${(state.last.modelNotes ?? []).join('; ')}`);
  if (event === 'recovered') await push('Pip is awake again', 'He woke up and the loop runs again.');
  // (The check-up of how he spends his days runs at the end of each wake-up, in pip.js: this job is often late.)
  const same = (a) => JSON.stringify({ ...a, minutes: 0, checkup: { ...a.checkup, at: 0 } });
  if (same(next) !== same(health)) writeFileSync(HEALTH, JSON.stringify(next) + '\n');
  console.log(next.stuck ? `STUCK: ${next.minutes} minutes since the last wake-up` : `fine: last wake-up ${next.minutes} minutes ago`);
  process.exit(next.stuck ? 2 : 0);
}
