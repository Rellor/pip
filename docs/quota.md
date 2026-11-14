# Gemini free-tier check

**Not checked yet.** As of 2026-11-14 nothing here has been verified.

Why: this was built in a session with no Gemini key (Bas asked not to use his calls), and the docs page
(https://ai.google.dev/gemini-api/docs/rate-limits) could not be reached from that session. Nothing below is assumed.

## How to check (uses one tiny call per model)
```
node --env-file=.env scripts/check-quota.mjs
```
It lists the models your key can use, makes one tiny call to each model in `GEMINI_BIG` and `GEMINI_LITE`,
reads any 429 answer (`quotaId` and `limit`: per minute or per day; `limit: 0` means not in the free tier)
and rewrites this file with a dated table.

Then remove any model marked "no free quota" or "not found" from the `GEMINI_BIG` / `GEMINI_LITE` variables.

## Important
Quota is per Google Cloud **project**, not per key. The key must belong to a project that only Pip uses.
