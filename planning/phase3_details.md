# Phase 3: Detailed Implementation Plan - Movement, Camera & Sound

This document tracks every decision for Phase 3. Feature additions follow a strict **One-at-a-Time** rule.

## Step A: Research & Strategy
*   **Physics Movement:** We will implement "Interpolated Movement" for jumping and sliding to ensure the character feels "weighty" but responsive.
*   **Camera System:** Switch to a **Shoulder Camera** (3rd person) with a **Spring Arm** to prevent the camera from going through walls.
*   **Sound Architecture:** Use the **Web Audio API** or a library to handle "Spatial Audio" (sounds getting louder as you get closer).

## Step B: Implementation
*   **Stage 3.1: Pro Movement**
    *   **Step 3.1.1:** 3-Step Jump (Start -> Fly -> Land). [PROPOSED]
    *   **Step 3.1.2:** Double Jump (Air Flip). [PROPOSED]
    *   **Step 3.1.3:** Friction Slide (Run to Slide logic). [PROPOSED]
*   **Stage 3.2: Shoulder Camera** [PROPOSED]
*   **Stage 3.3: Sound System** [PROPOSED]
    *   **Step 3.3.1:** Walking Footsteps.
    *   **Step 3.3.2:** Jump & Thud effects.

## Step C: QA Gate & Battle Test
*   **The Wall Test:** Can the camera see through walls when near a corner?
*   **The Land Test:** Does the character "sink" slightly when landing from a high place?

---

**USER APPROVAL REQUIRED:** Please provide approval for the Movement and Camera focus in Step B.
