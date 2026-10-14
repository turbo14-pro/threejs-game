# Task Plan: CPU-Controlled Bots

## Status: complete (all batches done; only `push` remains, awaiting user go-ahead)

| Phase | Status | Notes |
|-------|--------|-------|
| Brainstorm | complete | decision.md written; user interaction done |
| Plan | complete | plan.md written; context files initialized; git assessment run |
| Execute & Review | complete | Batches 3, 4, 5 implemented and committed; Batch 6 verified |
| Review | complete | 48 unit tests + 2 e2e tests green; `vite build` succeeded; ESLint 0 errors |

## Batches
- Batch 1: Brainstorm — complete
- Batch 2: Plan / Context Init — complete (commit deferred, see plan.md D7)
- Batch 3: Bot AI Core — complete (`4a78210`)
- Batch 4: Adaptive Difficulty — complete (shipped in `4a78210`)
- Batch 5: Lobby Visibility / Integration — complete (`a6c73ce`)
- Batch 6: Test / Polish — complete (`fdcf9b8`)

## Deliverables
- `src/components/Player/BotAI.jsx` — pure heuristic brain
- `src/components/Player/BotAI.test.js` — 32 unit tests
- `src/components/Player/BotPlayer.jsx` / `BotPlayers.jsx` — arena runtime
- `src/components/UI/BotRoster.jsx` — lobby + pause-menu roster
- `src/store/useGameStore.js` — bot slice, match score, adaptive-difficulty feed
- `tests/bot-lobby.spec.js` — 2 Playwright e2e tests
- `planning/plan.md` — full batch summaries, deviations (D1–D7), error tables

## Remaining
- `push` (decision needed: push `main`, or move commits to `feature/cpu-bots` first)
- Optional follow-ups: bot damage source (activates flee mode), server-side bots
