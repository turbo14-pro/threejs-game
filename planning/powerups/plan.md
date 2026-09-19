# Plan: Power-Up Multiplier System Extension

**Goal:** Extend the power-up system with a multiplier table, central player config, post-effects activation system, fix shockwave, and add speed knockback compensation.

**Approach:** Create `src/config/playerConfig.js` with all baseline values and multiplier tables. Refactor `POWERUP_EFFECTS` in `useGameStore.js` to use nested objects. Create a PostEffects system module. Fix ShockwaveEffect with intensity multiplier. Refactor RadialBlurEffect to accept power-up scaled intensity. Update PlayerController to use config values.

**Branch:** `feature/powerup-multiplier-system` (from `main`)

## Scope
- **In:** Central playerConfig.js, Multiplier table, PostEffects activation system, Fixed ShockwaveEffect, Scaled RadialBlurEffect, Speed knockback compensation
- **Out:** New power-up categories, coin detection/visual changes, network protocol changes

---

## Context Management Strategy

### Token Budget Allocation
| Component | Budget | Contents |
|-----------|--------|----------|
| Plan context | 15% | decision.md decisions, plan scope, current batch |
| Code context | 35% | Relevant files for current batch |
| Conversation history | 25% | User decisions, approvals, blockers |
| Working memory | 15% | Current task details, file paths |
| Response reserve | 10% | Never use for input |

### Context Checkpoints (every batch)
Before starting each batch, execute a **Context Recovery** block:
1. Re-read `decision.md` — verify batch aligns with decisions
2. Re-read `task_plan.md` — confirm we're on the right batch
3. Re-read `findings.md` — re-anchor on existing architecture
4. Verify no scope creep — check batch tasks against Non-Goals
5. Check git status — ensure clean working tree

### Memory Compression Checkpoints (every 2 batches)
After Batch 2, Batch 4, and Batch 6:
1. Compress completed batches into `progress.md` — preserve decisions, blockers, file references
2. Summarize what was built vs plan — tone/intent preserved
3. Verify no contradictions between batches
4. Prune stale context — remove resolved issues, confirmed decisions

### Serial Position Optimization (for each batch read)
```
1. Decision anchors (primacy — high weight)
   - Which decision from decision.md does this batch serve?
2. Current batch scope (primacy — high weight)
3. Relevant code excerpts (middle — factual, replaceable)
4. Previous batch summary (recency — medium weight)
5. Next batch preview (recency — low weight)
```

---

## Action Items

### Batch 1: Create Central Config File
**Decision anchors:** D1 (central config), D2 (multiplier table), D6 (use existing values)

- [ ] Task 1.1: Create `src/config/playerConfig.js` with PLAYER_BASELINE, POWERUP_EFFECTS, POWERUP_DURATIONS, POWERUP_DESCRIPTIONS, PLAYER_ACTIONS
- [ ] Task 1.2: Import and re-export from useGameStore.js (keeping backward compat)
- [ ] **Commit:** `chore: create central playerConfig.js with baseline values and multiplier tables`

**Context checkpoint after batch:**
- [ ] Re-read decision.md D1, D2, D6 — verified alignment
- [ ] Compare all baseline values against originals — exact match?
- [ ] Verify no references to old inline values remain in useGameStore

---

### Batch 2: Refactor useGameStore.js (Config)
**Decision anchors:** D1 (central config), D2 (multiplier table)

- [ ] Task 2.1: Remove inline POWERUP_EFFECTS, POWERUP_DURATIONS, POWERUP_DESCRIPTIONS from useGameStore.js
- [ ] Task 2.2: Import from playerConfig.js instead
- [ ] Task 2.3: Update collectPowerUp to work with new structure (already uses category/rarity pattern)
- [ ] **Commit:** `refactor: extract POWERUP_EFFECTS to playerConfig.js with multiplier tables`

**Memory compression checkpoint (after Batch 2):**
- [ ] Compress Batches 1-2 into progress.md
- [ ] Preserve: config values, import paths, decision alignments
- [ ] Prune: resolved discussions about config structure
- [ ] Verify no contradictions: do useGameStore imports match playerConfig exports?

**Context checkpoint after batch:**
- [ ] Re-read findings.md — re-anchor on PlayerController hardcoded values
- [ ] Verify all consumers of POWERUP_EFFECTS still resolve correctly

---

### Batch 3: Fix ShockwaveEffect + Add Multiplier
**Decision anchors:** D4 (fix shockwave), D7 (radial blur scaling)

- [ ] Task 3.1: Add `intensity` prop to ShockwaveEffect. Multiply baseAmplitude by intensity.
- [ ] Task 3.2: Pass intensity from store based on slideImpact PLAYER_ACTIONS config
- [ ] Task 3.3: Debug why it doesn't render (check position space, check if ShockWave component needs world-space, check pipeline order)
- [ ] **Commit:** `fix: repair ShockwaveEffect with intensity multiplier and correct parameters`

**Context checkpoint after batch:**
- [ ] Re-read decision.md D4 — verify fix approach matches decision
- [ ] Check git diff — only ShockwaveEffect files modified
- [ ] Verify no scope creep into visual/coin system (Non-Goals)

---

### Batch 4: Refactor RadialBlurEffect for Power-Up Scaling
**Decision anchors:** D7 (radial blur scaling)

- [ ] Task 4.1: Add power-up-aware intensity targeting instead of binary dashBlur
- [ ] Task 4.2: Read current powerUp category and rarity from store, map to PLAYER_ACTIONS radialBlur intensity
- [ ] Task 4.3: Remove dashBlur setter calls from PlayerController (replaced by PostEffects system)
- [ ] **Commit:** `feat: scale RadialBlurEffect intensity by active power-up category`

**Memory compression checkpoint (after Batch 4):**
- [ ] Compress Batches 3-4 into progress.md
- [ ] Preserve: shockwave fix details, radial blur intensity curves, any debugging discoveries
- [ ] Fact-check: does RadialBlurEffect correctly map all 4 categories?
- [ ] Prune: resolved shockwave debugging attempts

**Context checkpoint after batch:**
- [ ] Re-read task_plan.md — confirm we're on track
- [ ] Verify dashBlur state removal didn't break anything

---

### Batch 5: Create PostEffects Activation System
**Decision anchors:** D3 (PostEffects system), D4 (shockwave fix)

- [ ] Task 5.1: Create `src/components/World/PostEffectsActivator.jsx` — reads powerUp state and PLAYER_ACTIONS config, drives effect intensities
- [ ] Task 5.2: Add ripple impact activation on slide collision (triggers shockwave with intensity from PLAYER_ACTIONS.slideImpact)
- [ ] Task 5.3: Add speed blur activation (triggers radialBlur with intensity from PLAYER_ACTIONS.speedBoost)
- [ ] **Commit:** `feat: create PostEffectsActivator system for power-up-driven post effects`

**Context checkpoint after batch:**
- [ ] Re-read decision.md D3 — verify PostEffects system matches design
- [ ] Check git diff — only PostEffectsActivator + Effects.jsx modified
- [ ] Verify no new dependencies introduced

---

### Batch 6: Refactor PlayerController to Use Config
**Decision anchors:** D1 (central config), D2 (multiplier table), D5 (speed knockback compensation)

- [ ] Task 6.1: Replace all hardcoded baseline values (walkSpeed=8, sprintSpeed=30, jumpVelocity=38, etc.) with imports from playerConfig.js
- [ ] Task 6.2: Replace POWERUP_EFFECTS access with new nested multiplier structure using getPowerUpEffect()
- [ ] Task 6.3: Add speed knockbackReduction compensation to slide impact blast power
- [ ] **Commit:** `refactor: PlayerController uses playerConfig.js for all baseline values and multiplier tables`

**Memory compression checkpoint (after Batch 6):**
- [ ] Compress Batches 5-6 into progress.md
- [ ] Preserve: PlayerController line-by-line replacements, knockback compensation formula, import paths
- [ ] Fact-check: verify all baseline values match original (critical for gameplay)
- [ ] Prune: resolved import path discussions

**Context checkpoint after batch:**
- [ ] Re-read decision.md D5 — verify knockback compensation formula
- [ ] Run full diff check — ensure PlayerController changes are complete

---

### Batch 7: Polish & Verify
**Decision anchors:** All

- [ ] Task 7.1: Remove dead code, unused imports, debug logs
- [ ] Task 7.2: Verify all files compile cleanly
- [ ] Task 7.3: Run build to ensure no errors
- [ ] **Commit:** `chore: lint, format, cleanup power-up refactor`

**Final context checkpoint:**
- [ ] Read all planning files (decision.md, plan.md, task_plan.md, progress.md, findings.md) — verify complete
- [ ] Fact-check all 7 decision anchors against implementation
- [ ] Verify no Non-Goals violated
- [ ] Check git log — commits match plan batches

---

## Validation
- [ ] All baseline values in playerConfig.js match original hardcoded values (preserve balance)
- [ ] ShockwaveEffect renders on slide impact with correct position and scaling
- [ ] RadialBlurEffect shows different intensities for speed vs dash vs no power-up
- [ ] Speed power-up reduces dealt knockback proportionally
- [ ] All existing game behavior preserved
- [ ] Build succeeds with no errors

## Open Questions
- ShockwaveEffect: may need to check if `@react-three/postprocessing` ShockWave requires specific coordinate space or pipeline ordering

## Anti-Pattern Prevention
| Anti-Pattern | Prevention |
|--------------|------------|
| Skipping context checks | Context checkpoint block required before every batch |
| Losing decision context | Re-read decision.md anchors at batch start |
| Scope creep | Check Non-Goals at every context checkpoint |
| Forgetting past failures | progress.md preserves all attempts and resolutions |
| No rollback point | Git commit after every batch |
| Contradictory changes | Memory compression compares across batches |