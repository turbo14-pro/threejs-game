# Phase 0: Detailed Implementation Plan - Technical Foundation & Ops

This document tracks the "Month 1" engineering foundational decisions.

## 1. Professional Infrastructure
*   **Networking Model:** **Authoritative Server Model** selected. The server decides what happened, the client just "predicts" the movement to keep it smooth.
*   **Save Strategy:** **JSON Schema with Versioning**. Every save file will include a `version` number so we can safely update the game later.
*   **Folder Standards:** 
    *   `/src/components`: UI and Scene pieces.
    *   `/src/hook`: Logic.
    *   `/src/data/registries.js`: The "Master List."
*   **Naming Conventions:** All character models must be named `skin_[name].glb`. All weapons `weapon_[name].glb`.
*   **STATUS:** [DECIDED]

## 2. Input Bridge
*   **Goal:** Map Keyboard and Mobile Joystick to one "Main Brain" command. [DONE]
*   **STATUS:** [IMPLEMENTED]

## 3. Crash Reporting & Logging
*   **Decision:** Use simple `console.info` with custom tags for now, prepping for **Sentry** or **Bugsnag** in the future.
*   **STATUS:** [PLANNED for Stage 0.3]

---

**PHASE 0 CONCLUSION:** The professional foundation is laid. Ready for Phase 1.
