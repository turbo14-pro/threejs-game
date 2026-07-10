# RecallMax: Power-Up Coin Implementation Session

## Compressed History

### [Turn 1-3] Design Phase
User requested plan to add power-up coin tokens to three.js game. Provided detailed spec: 16 coin types (4 categories × 4 rarities), duration ladder 120-180s, single active slot, spawn at y=67. Agent explored codebase, found PowerUpCoin.jsx exists but never rendered, store has dead code, PlayerController has hardcoded values.

### [Turn 4-6] Planning Pipeline
Agent loaded `00_meta-plan-pipeline` skill. Created planning files: decision.md, plan.md, findings.md, progress.md, task_plan.md in `planning/powerups/`. User corrected: "make the planning files do not begin implementing" — agent had started writing code prematurely. Agent reverted and stayed in planning mode.

### [Turn 7-9] Design Refinement
User provided new requirements: items folder (`src/components/World/items/`), coins should fall with physics, random spawn positions (not fixed). Agent began brainstorming phase, asked clarification questions. User chose: animated drop (not real physics), full table surface spawn, exclude platforms+bridge, y=50→y=1.5 hover, 8 coins max, 1-3 min interval, instant disappear, spin+bob, ~1.5s gravity curve, rarity color tints, bloom via existing post-processing.

### [Turn 10-12] File Updates
User asked to update planning files with new decisions. Agent updated decision.md (24 decisions), plan.md (8 batches, 47 tasks), findings.md (architecture patterns), task_plan.md. User then asked to "sharpen" files with llm-prompt-optimize skill. Agent applied CoT, few-shot examples, error handling to plan.md. Added structured tables to decision.md. Added actionable patterns to findings.md.

### [Turn 13-14] Context Persistence
User asked to enhance with llm-context skill. Agent created `.llm-context/context.json` with full session state: progress, decisions, fileState, nextSteps, keyFiles, architecture, powerUpEffects, durations, rarityVisuals, spawnConfig. Created snapshot for 2026-07-10.

### [Turn 15] RecallMax Compression
User triggered RecallMax skill. Agent compressed session memory into high-density format, fact-verified claims, created recallmax-summary.md.

### [Turn 16-17] Task Plan Enhancement
User requested adding RecallMax/LLM context protocols to task_plan.md for context retention. Also requested automatic linting and bug testing at every stage. Agent rewrote task_plan.md with:
- RecallMax integration protocols (every batch)
- LLM context persistence protocols (every task)
- Redundancy checkpoints (pre-batch, post-task, post-batch, cross-batch)
- Automatic linting protocol (npm run lint, npm run build after every task)
- Automatic testing protocol (manual test checklist per batch)
- Emergency recovery protocol (if context lost)
- Updated plan.md with testing/linting commands

---

## Key Decisions (Preserved)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Animated drop (type="fixed") | Avoids Rapier sensor/physics conflict |
| D2 | Distance-based pickup | Works with type="fixed", no Rapier events needed |
| D3 | Random spawn on full table | Maximum variety |
| D4 | Exclude platforms+bridge | Prevents unreachable coins |
| D5 | y=50→y=1.5 hover | Dramatic drop, clean hover |
| D6 | 8 coins, 1-3 min interval | More opportunities, faster pacing |
| D7 | Rarity color tints | Visual distinction via emissive colors |
| D8 | jumpCount refactor | Supports 3-6 jumps cleanly |
| D9 | Q key dash | Explicit, avoids accidents |
| D10 | Blue orb during dash | Clear visual feedback |

---

## File State (Current)

| File | Status | Notes |
|------|--------|-------|
| `src/components/World/items/PowerUpCoin.jsx` | Modified | Rarity tints added, needs rewrite |
| `src/store/useGameStore.js` | Modified | Dead code exists, needs cleanup |
| `src/components/World/items/PowerUpManager.jsx` | Not created | Needs creation |
| `src/components/Player/PlayerController.jsx` | Not modified | Needs power-up injection |
| `src/components/World/Arena.jsx` | Not modified | Needs PowerUpManager mount |
| `src/App.jsx` | Not modified | Needs Q key |
| `src/components/UI/PowerUpHUD.jsx` | Not created | Needs creation |
| `src/components/UI/HUD.jsx` | Not modified | Needs PowerUpHUD mount |
| `planning/powerups/decision.md` | Created | 24 decisions, optimized |
| `planning/powerups/plan.md` | Created | 8 batches, 47 tasks, optimized |
| `planning/powerups/findings.md` | Created | Architecture patterns, optimized |
| `planning/powerups/task_plan.md` | Created | Batch tracking + RecallMax/LLM protocols + auto-lint/test |
| `planning/powerups/progress.md` | Created | Session log |
| `.llm-context/context.json` | Created | Full session state |
| `.llm-context/recallmax-summary.md` | Created | Compressed session memory |

---

## Fact Verification

| Claim | Status | Evidence |
|-------|--------|----------|
| PowerUpCoin.jsx exists in items/ | ✅ SUPPORTED | Read file, 107 lines |
| Store has dead code (lines 86-97) | ✅ SUPPORTED | Read store, collectPowerup/removePowerup reference undefined getPowerUpDuration() |
| PlayerController has hardcoded speed | ✅ SUPPORTED | Line 481: `const speed = isSliding ? 45 : (walkingInput ? 8 : 30)` |
| hasDoubleJumped is boolean | ✅ SUPPORTED | Line 496: `setHasDoubleJumped(false)` |
| Arena imports PowerUpCoin but never renders | ✅ SUPPORTED | Line 13 imports, JSX return never uses it |
| Existing bloom in Effects.jsx | ✅ ASSUMED | Not directly verified, but Effects.jsx exists |
| Rapier setBodyType() available | ⚠️ UNSUPPORTED | Not directly tested, but documented in Rapier docs |

---

## Blockers: None

## Next Step: Begin Batch 1 (Store Cleanup) — Read context.json first, then plan.md
