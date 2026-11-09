import { spawnSync } from 'node:child_process';

// One long GitHub job that keeps Pip alive: wake him every few minutes, save his state, repeat.
// Messages from Bas never wake him. He reads them at his next normal wake-up and decides himself if he answers.
// GitHub's own cron is best-effort and can skip runs, so the workflow starts the next loop itself.
const LOOP_MIN = Number(process.env.LOOP_MINUTES ?? 330);
const EVERY_MIN = Number(process.env.WAKE_EVERY_MIN ?? 12);
const CHECK_SEC = Number(process.env.CHECK_SECONDS ?? 60);

const stamp = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (...args) => spawnSync('git', args, { stdio: 'pipe' }).status === 0;

function wakeAndSave() {
  const run = spawnSync(process.execPath, ['pip.js'], { stdio: 'inherit', env: { ...process.env, PIP_INTERVAL_MIN: String(EVERY_MIN) } });
  if (run.status !== 0) console.error(`[${stamp()}] pip.js exited with code ${run.status}`);
  git('add', '-A', 'web/state.json', 'web/gifts', 'diary.md', 'inbox');
  if (git('diff', '--cached', '--quiet')) return; // nothing changed
  git('commit', '-q', '-m', 'Pip woke up');
  for (let i = 0; i < 3; i++) {
    if (git('pull', '--rebase', '-q') && git('push', '-q')) return;
    git('rebase', '--abort');
  }
  console.error(`[${stamp()}] could not push Pip's state`);
}

console.log(`[${stamp()}] Pip's loop starts: a wake-up every ${EVERY_MIN} min for ${LOOP_MIN} min`);
const start = Date.now();
let lastWake = 0;
while ((Date.now() - start) / 60_000 < LOOP_MIN) {
  if (!git('pull', '--rebase', '-q')) git('rebase', '--abort');
  if ((Date.now() - lastWake) / 60_000 >= EVERY_MIN) {
    console.log(`[${stamp()}] waking Pip`);
    wakeAndSave();
    lastWake = Date.now();
  }
  await sleep(CHECK_SEC * 1000);
}
console.log(`[${stamp()}] loop finished, handing over to the next one`);
