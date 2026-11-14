// Checks the real free-tier limits for this key. Run it yourself (it uses your quota: one tiny call per model):
//   node --env-file=.env scripts/check-quota.mjs
// It lists the models the key can use, makes ONE tiny call per candidate in GEMINI_BIG and GEMINI_LITE,
// reads any 429 (quotaId, limit: per minute vs per day; limit 0 = not in the free tier) and writes docs/quota.md.
import { writeFile } from 'node:fs/promises';
import { groups, read429 } from '../models.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const key = process.env.GEMINI_API_KEY;
if (!key) { console.log('No GEMINI_API_KEY. Run: node --env-file=.env scripts/check-quota.mjs'); process.exit(1); }
const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' };

const listed = [];
let page = '';
do {
  const r = await fetch(`${API}/models?pageSize=1000${page ? `&pageToken=${page}` : ''}`, { headers });
  const j = await r.json();
  if (!r.ok) { console.log(`Listing models failed: ${r.status} ${JSON.stringify(j).slice(0, 300)}`); process.exit(1); }
  for (const m of j.models ?? []) if (m.supportedGenerationMethods?.includes('generateContent')) listed.push(m.name.replace('models/', ''));
  page = j.nextPageToken ?? '';
} while (page);

const g = groups();
const rows = [];
for (const [group, models] of Object.entries(g)) {
  for (const model of models) {
    const row = { group, model, listed: listed.includes(model) };
    try {
      const r = await fetch(`${API}/models/${model}:generateContent`, { method: 'POST', headers, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Answer {"ok": true}' }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 10 } }) });
      row.status = r.status;
      const body = await r.text();
      if (r.status === 429) Object.assign(row, read429(body), { raw: body.slice(0, 600) });
      else if (!r.ok) row.raw = body.slice(0, 300);
    } catch (e) {
      row.status = `error: ${e.message}`;
    }
    rows.push(row);
    console.log(`${group.padEnd(5)} ${model.padEnd(28)} ${row.listed ? 'listed' : 'NOT listed'}  ${row.status}${row.quotaId ? `  ${row.quotaId}` : ''}${row.notFree ? '  (limit 0: not in the free tier)' : ''}`);
  }
}

const verdict = (r) => (r.status === 200 ? 'works' : r.notFree ? 'no free quota: remove it' : r.status === 429 && r.perDay ? 'out for today (try again tomorrow)' : r.status === 429 ? 'per-minute limit (fine, just busy)' : r.status === 404 ? 'not found: remove it' : `check: ${r.status}`);
const md = `# Gemini free-tier check

Checked on ${new Date().toISOString().slice(0, 10)} with \`node --env-file=.env scripts/check-quota.mjs\` (one tiny call per model).

| group | model | listed for this key | answer | quota | verdict |
|---|---|---|---|---|---|
${rows.map((r) => `| ${r.group} | ${r.model} | ${r.listed ? 'yes' : 'no'} | ${r.status} | ${r.quotaId ? `${r.quotaId}${r.limit !== null ? ` (limit ${r.limit})` : ''}` : ''} | ${verdict(r)} |`).join('\n')}

Models this key can use for generateContent: ${listed.length}.

## What to do
- Remove models marked "no free quota" or "not found" from GEMINI_BIG / GEMINI_LITE (GitHub: Settings, Secrets and variables, Actions, Variables).
- Free-tier limits are per Google Cloud **project**, not per key: the key must belong to a project used only by Pip.
- The official limits are at https://ai.google.dev/gemini-api/docs/rate-limits (they change; the 429 details above are what really counts).

## Raw 429 details
${rows.filter((r) => r.raw).map((r) => `- ${r.model}: \`${r.raw.replace(/`/g, "'")}\``).join('\n') || '- none'}
`;
await writeFile('docs/quota.md', md);
console.log('\nWritten to docs/quota.md');
