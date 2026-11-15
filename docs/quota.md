# Gemini free-tier check

Checked on 2026-11-15 with `node --env-file=.env scripts/check-quota.mjs` (one tiny call per model).

| group | model | listed for this key | answer | quota | verdict |
|---|---|---|---|---|---|
| big | gemini-3.8-flash | yes | 503 |  | check: 503 |
| big | gemini-3.6-flash | yes | 200 |  | works |
| big | gemini-3.5-flash | yes | 200 |  | works |
| lite | gemini-3.5-flash-lite | yes | 200 |  | works |
| lite | gemini-3.1-flash-lite | yes | 200 |  | works |

Models this key can use for generateContent: 49.

## What to do
- Remove models marked "no free quota" or "not found" from GEMINI_BIG / GEMINI_LITE (GitHub: Settings, Secrets and variables, Actions, Variables).
- Free-tier limits are per Google Cloud **project**, not per key: the key must belong to a project used only by Pip.
- The official limits are at https://ai.google.dev/gemini-api/docs/rate-limits (they change; the 429 details above are what really counts).

## Raw 429 details
- gemini-3.8-flash: `{
  "error": {
    "code": 503,
    "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
    "status": "UNAVAILABLE"
  }
}
`
