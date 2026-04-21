# Phase 1: Detailed Implementation Plan - The Character Core

This document tracks every decision for Phase 1. Features are added **one at a time**.

## Step A: Research & Strategy
*   **Asset Pipeline:** All .GLB models must be exported with **Compressed Textures** to save memory.
*   **Animation Reuse & Layering:** We will use a shared "Bone Skeleton" for all character skins.
    *   **Base Layer:** The full body plays standard animations (run, jump, walk) with arms in a generic/melee pose.
    *   **Override Layer:** When a player equips a projectile weapon (Gun), we apply an animation layer *only* to the arm bones, overriding the base pose with a shooting pose, while legs keep running.
*   **STATUS:** [DECIDED]

## Step B: Implementation
*   **Stage 1.1:** Build the Master Registry. [DONE]
*   **Stage 1.2:** Clean the Main Brain (Zustand). [DONE]
*   **Stage 1.3:** Implement **Skin #1** (Starter). [DONE]
*   **Stage 1.4:** Implement **Skin #2** (Alternate). [DONE]

## Step C: QA Gate & Battle Test
*   **Asset Validation:** Check for texture flickering or missing UV maps on Skin #2. [PASSED]
*   **User Test:** Swap skins on the Select Pad. [PASSED]

---

**PHASE 1 CONCLUSION:** Foundation skins are production-ready. Moving to Phase 2: Movement & UI.
