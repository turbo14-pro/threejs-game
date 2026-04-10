# Phase 1: Detailed Implementation Plan - The Character Core

This document tracks every decision for this phase build. No implementation begins until the User approves the specific decision.

## 1. Registry Architecture
*   **Goal:** Build a list of Skins and Weapons that can hold 100+ items.
*   **Decision:** Each skin must have `speed` and `health` stats.
*   **STATUS:** [APPROVED & IMPLEMENTED]

## 2. Character Skin Pack 1
*   **Goal:** Implement the first 2 characters (Avo and Egg).
*   **Decision:** Models must be under 3,000 polygons to ensure fast loading on mobile.
*   **STATUS:** [MODELS CREATED & CONNECTED TO BRAIN]

---

## 3. UPCOMING DECISION: The Main Brain Organization
*   **Decision:** How do we confirm a skin selection?
*   **Proposed Plan:** When the player standing on a "Login Pad," the Registry sends the `skinID` to the Brain, which then swaps the 3D model instantly.
*   **User Action Required:** Approve this automatic swap logic.

## 4. UPCOMING BATTLE TEST: "The Ghost Test"
*   **Goal:** Ensure collisions are perfect.
*   **Proposed Plan:**
    1.  Create a "Collision Cage" (a small invisible room).
    2.  Try to run, jump, and slide out of it. 
    3.  If the player escapes, the physics are "Ghosting" and need to be thickened.
*   **User Action Required:** Approve the construction of the Collision Cage.

---

**USER APPROVAL REQUIRED:** Please provide feedback on the Proposed Plans for Points 3 and 4.
