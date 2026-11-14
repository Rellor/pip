// Pip's soul: who he is, from soul.md. Bas's lines are [locked]; lines Pip adds go under "Added by him".
import { readFile } from 'node:fs/promises';

export const SOUL_FILE = 'soul.md';

// The soul as plain text for the model: no [locked] marks, no notes for people.
export function soulText(md) {
  return String(md)
    .split('\n')
    .filter((l) => !/^Who Pip is|^Lines Pip adds|^\(nothing yet\)/.test(l.trim()))
    .map((l) => l.replace(/\[locked\]\s*/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function loadSoul(file = SOUL_FILE) {
  try {
    return soulText(await readFile(file, 'utf8'));
  } catch {
    return 'I am Pip, a small creature who lives in a little room on a website.';
  }
}
