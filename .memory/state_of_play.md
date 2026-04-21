# State of Play

**Last Updated:** 2026-04-21  
**Headline:** Food Fight Frenzy — Phase 1 active, core character skins done, movement system in progress.

---

## Immediate Attention

- **Movement system bugs** — PlayerController has had recent crashes from missing state variables. Owner: Dev. Est: 2-4 hrs.
- **Step 0.5.0 (Save Data Plan)** still not started — needs a decision before Phase 7. Owner: Dev.
- **Step 0.7.1 (AI naming/structure rules)** not yet done — risk of growing mess if left too long. Owner: Dev.

---

## Strategic Flags

The project uses **Three.js + React Three Fiber + Rapier + Zustand** running on Vite, hosted on InfinityFree. Two character skins (Avo and Egg) are built and working. Post-processing (bloom, anti-aliasing) has been tuned. A Blender animation pipeline script exists for importing Mixamo FBX files.

Multiplayer is planned for Phase 4 using Geckos.io. The roadmap runs across 12 phases, with the current focus on finishing Phase 1 (character system) and beginning Phase 2 (movement, camera, sound). The biggest near-term risk is movement stability — recent fixes addressed runtime crashes but the system still needs thorough testing on touch screens.

---

## Next 48 Hours

| When | What | Who | Notes |
|------|------|-----|-------|
| Now | Fix remaining movement bugs | Dev | Step 2.1.2 area |
| Next | Finish wall collision testing | Dev | Step 1.2.1 |
| After | Plan sound system research | Dev | Step 2.2.1 |

---

## Work Streams

### Characters (Phase 1)
Avo and Egg skins done. Smooth shading applied. Bump mapping added to Avo. Still need wall collision testing (Step 1.2.1) and naming/folder audit (Step 1.2.2).

### Movement (Phase 2)
Run/sprint/sneak partially built. Shoulder camera exists. Jump, slide, and fall systems not started. Recent crash fixes applied to PlayerController.

### Multiplayer (Phase 4 — future)
Not started. Geckos.io selected. Server architecture not yet planned.

### Tooling
Blender MCP connected. Three.js MCP installed. Sketchfab search skill created. Vite dev server running.

---

## Planning Ahead

> This section tracks where we are on the [[development_roadmap]] and what's coming next.

**Current Position:** Phase 1 → Stage 1.2 (Testing the Walls)  
**Current Phase Status:** Skins built, Master List done, movement partially in place.

### Next 3 Stages

| Stage | Name | Status |
|-------|------|--------|
| 1.2 | Testing the Walls | Not started — collision testing + naming audit |
| 2.0 | Phase 2 Planning and Research | Not started — create `phase2_details.md` |
| 2.1 | Building Movement | In progress — run/walk done, jump/slide/fall pending |

### Pending Decisions (from planning docs)

- **Spawn transition**: Change from current "teleport pad" to planned "floating squares" drop? → [[masterplan]] §Pre-Match
- **Weapon animations**: Do weapons change character animations? → [[masterplan]] §Pending Decisions
- **HUD style**: Move from 3D world-space text to 2D React overlay? → [[masterplan]] §Pending Decisions
- **Health visual feedback**: Screen vignetting or heart bar? → [[masterplan]] §Pending Decisions
- **Phase 2 approval**: Steps 2.1–2.5 are marked [PROPOSED] — need sign-off → [[phase2_details]]

### Already Decided (see [[decisions_log]])

30 decisions logged. Key ones for upcoming work:
- 3-step jump system (Launch → Air Loop → Landing)
- Run by default, Shift = walk
- Orbit camera with rubberbanding + castShape collision
- FXAA before Bloom in post-processing

---

## Related

- [[decisions_log]]
- [[architecture_notes]]
- [[contacts]]
- [[development_roadmap]]
- [[masterplan]]
- [[phase0_details]]
- [[phase1_details]]
- [[phase2_details]]

