# Rebuild notes

Changes to the original rebuild plan, agreed with Bas.

## Goal
Pip is his own maker. He finds something (news, web, Bas), learns how to make it,
asks for the tools he needs, practises, and gets better. Ugly first tries are fine.

## Changes to the phases
- Phase 3 (tidy) is a fresh start in the same room: keep soul, ~10 core memories and
  owned tools; archive old repeats. Nothing is deleted.
- Phase 5 adds:
  - Sparks: news, web pages and Bas's messages become sparks. Sparks fade in a few
    days unless they turn into a project.
  - Learn, then tool: a project step can need research first. Research names the
    tools and materials. `ask` is offered only when a researched tool is missing
    (max 2 asks a day), and says what it is for.
  - Skills with levels (music, painting, woodwork, sculpture, gardening, cooking,
    coding). Practice and research raise them. Higher levels let the maker do more.
  - Food comes from the garden only. No free daily pantry refill.
  - Dreams list: things too big for him (like a synth). Bas picks what to build.
  - Sameness is a feeling: doing the same kind of thing all day lowers his mood.
- Phase 6: decorating and building go through the maker. Code snaps things to the
  floor, a shelf or the wall. He checks a photo of the result and can fix it.

## Phase 8 additions (from Bas): verify, don't assume
1. Check the real free-tier limits: run `node pip.js models`, read
   https://ai.google.dev/gemini-api/docs/rate-limits, make ONE tiny test call per
   candidate model and log it. On a 429 read error.details (quotaId and limit:
   per minute vs per day; limit 0 = not in the free tier). Write docs/quota.md, dated.
2. Two groups (env, comma-separated):
   GEMINI_BIG  = gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash
   GEMINI_LITE = gemini-3.5-flash-lite,gemini-3.1-flash-lite
   Remove models with no free quota.
3. Routing. BIG: daily goal, sleep call, maker calls, vision checks, replies to Bas.
   LITE: normal brain calls. All BIG out -> LITE. All out -> autopilot until reset.
4. web/health.json: calls per model per day (reset midnight Pacific). Per-day 429:
   model "out" until reset. Per-minute 429: wait retryDelay, retry once. Never switch
   silently: state.last.model, shown in the site footer.
5. Budget guard: BIG calls under 15 per model per day (room for replies to Bas).
6. PR note: the key must belong to a Google Cloud project used only by Pip
   (quota is per project, not per key).
