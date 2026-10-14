# Progress: CPU-Controlled Bots

## 2026-09-19 — Batch 1 (Brainstorm) Complete
- User interaction completed (high-level gameplay/UX only): competitive AI, adaptive difficulty, visible in lobby
- decision.md written to planning/
- No technical questions asked; recommended solutions used for technical decisions

## 2026-09-19 — Batch 2 (Plan / Context Init) Complete
- plan.md, task_plan.md, findings.md initialized
- Git assessment run: branch `main`, dirty tree (11 pre-existing `planning/*.md` deletions + untracked planning files)
- Planning commit deferred to the end so bot code commits stay clean (plan.md D7)

## 2026-09-19 — Batch 3 + 4 (Bot AI Core + Adaptive Difficulty) Complete
- `src/components/Player/BotAI.jsx` rewritten from a broken placeholder into a pure, framework-free heuristic brain
- Exports: `computeBotInput`, `steerTowards`, `computeAdaptiveDifficulty`, `createBotProfile`, `buildBotRoster`, `BotBrain`, `shouldRegisterTag`, `normalizeBotCount`, `makeBotName`
- Output shape is exactly the store's `mobileInput`, which `PlayerController` already merges — so no PlayerController changes were needed
- 32 unit tests (relocated to `src/components/Player/BotAI.test.js`; `tests/` is excluded by vitest.config.js — plan.md D1/D2)
- Caught and fixed a real bug: the reaction window made `reacting` permanently true, freezing every bot
- Commit `4a78210`

## 2026-09-19 — Batch 5 (Lobby Visibility / Integration) Complete
- `BotRoster.jsx`: bot names + skill tags + bot-count/difficulty selectors, shown in MainMenu and the HUD pause menu
- `BotPlayer.jsx` + `BotPlayers.jsx`: kinematic arena runtime (mirrors RemotePlayer) driven by `BotBrain`
- Store: `bots`, `botCount`, `botDifficulty`, `matchScore` + `setBotCount` / `setBotDifficulty` / `addMatchScore` / `resetMatchScore`
- Adaptive difficulty is fed live: power-up pickup scores for the player, bot contact ("tag") scores for the bots
- Flee mode honoured from the recorded project decision *2026-04-10 · Bot AI: Flee at 25% Health*
- Fixed a UI regression the e2e test exposed: the taller lobby was clipped, overlay is now scrollable
- Commit `a6c73ce`

## 2026-09-19 — Batch 6 (Test / Polish) Complete
- `npx vitest run` → 48/48 passing (was 9 before)
- `npx playwright test tests/bot-lobby.spec.js` → 2/2 passing (installed Chromium to run it)
- `npx vite build` → succeeded in 7.78s
- ESLint on all touched files → 0 errors, 3 pre-existing warnings
- Commit `fdcf9b8`

## Next
- Await go-ahead to `push` (or to move the three commits onto `feature/cpu-bots` first)
- Optional: bot damage source to activate flee mode; server-side bots so humans can see them
