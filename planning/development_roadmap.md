# Food Fight Frenzy - Staged Development Roadmap

This roadmap is built for a year-long project. It adds exactly **2 new features** at a time to keep the game balanced. Each Phase has a **Detailed Implementation Plan** that must be approved before building.

---

## Phase 0: Technical Foundation
**Goal:** Research and install the professional tools (Libraries) for the whole year.

### Step A: Research & Strategy
*   **Research:** Compare Rapier.js vs. Cannon.js for physics.
*   **Research:** Compare Zustand vs. Redux for the Main Brain.
*   **Git Milestone:** `git commit -m "chore: complete phase 0 library selection" && git tag -a v0.0.0-foundation -m "Phase 0 Foundation Complete"`

### Step B: Implementation
*   **Technical Check:** Install all libraries. [DONE]
*   **Technical Check:** Set up the folder structure for `/data`, `/store`, and `/components`. [DONE]

### Step C: Battle Test: "The Empty World"
*   **Test:** Ensure the game runs at 60 FPS with nothing in it.

---

## Phase 1: The Character Core
**Goal:** Build the "Scalable Registries" and the first 2 characters.

### Step A: Research & Strategy
*   **Research:** "Animation Layering" (Arms vs. Legs).
*   **Plan:** Create `planning/phase1_details.md`.

### Step B: Implementation (The Many-for-One System)
1.  **Stage 1.1:** Build the **Master Registry** for Skins and Weapons. [DONE]
2.  **Stage 1.2:** Clean the **Main Brain** to read from these registries. [DONE]
3.  **Stage 1.3:** Set up **Skin Pack 1**: Avo and Egg models. [DONE]
*   **Git Milestone:** `git commit -m "feat: phase 1.3 - registries and core skins" && git tag -a v0.1.3-registries -m "Phase 1.3 Registries and Skins Complete"`

### Step C: Battle Test: "The Ghost Test"
*   **Test:** Walk into every corner of a test box. Ensure the Avo NEVER clips through walls.

---

## Phase 2: Professional Movement
**Goal:** Build the "Launch -> Loop -> Land" jump and the Friction Slide.

### Step A: Research & Strategy
*   **Research:** Kinetic Friction vs. Static Friction for sliding.
*   **Plan:** Create `planning/phase2_details.md`.

### Step B: Implementation (Advanced Physics)
1.  **Stage 2.1:** Build the 3-Step Jump physics.
2.  **Stage 2.2:** Build the Crouch/Slide system (Hiding in small gaps).
3.  **Stage 2.3:** Map movement speed to the **Registry stats** (Avo = Heavy, Egg = Fast).
*   **Git Milestone:** `git commit -m "feat: phase 2.3 - movement physics and stats" && git tag -a v0.2.3-physics -m "Phase 2.3 Movement Physics Complete"`

### Step C: Battle Test: "The Toaster Escape"
*   **Test:** Can the Avo jump onto a platform the height of a toaster? If not, we need more "Jump Power."

---

## Phase 3: The Lobby & Weapon Prep
**Goal:** Build the separate Lobby map and the first 2 Weapon Platforms.

### Step A: Research & Strategy
*   **Research:** Scene swapping techniques for 3D maps.
*   **Plan:** Create `planning/phase3_details.md`.

### Step B: Implementation (Preparation Area)
1.  **Stage 3.1:** Build the **Lobby Map** (Separate from the Arena).
2.  **Stage 3.2:** Build the **Weapon Platform** (Supports adding 100 weapons later).
3.  **Stage 3.3:** Add **Weapon Pack 1**: Baguette (Melee) and Tomato Gun (Projectile).
*   **Git Milestone:** `git commit -m "feat: phase 3.3 - lobby and first weapons" && git tag -a v0.3.3-lobby -m "Phase 3.3 Lobby and Weapons Complete"`

### Step C: Battle Test: "The Weapon Swap"
*   **Test:** Standing on a pad for 2 seconds should change your weapon instantly.

---

## Phase 4: Melee Combat
**Goal:** Build the "Baguette Smash" and hitting logic.

### Step A: Research & Strategy
*   **Research:** Sphere-casting for wide weapon swings.
*   **Plan:** Create `planning/phase4_details.md`.

### Step B: Implementation (Hitting Things)
1.  **Stage 4.1:** Add "Hand Sockets" to models.
2.  **Stage 4.2:** Build the "Splat" detection.
3.  **Stage 4.3:** Add **Weapon Pack 2**: Donut (Heavy Melee) and Breadstick (Long Range Melee).

### Step C: Battle Test: "The Splat Test"
*   **Test:** Can you hit 3 targets with one large Baguette swing?

---

## Phase 5: Shooting Combat
**Goal:** Build the "Tomato Rain" and Recycling System.

### Step A: Research & Strategy
*   **Research:** Object Pooling (to keep the game fast).
*   **Plan:** Create `planning/phase5_details.md`.

### Step B: Implementation (Firing Things)
1.  **Stage 5.1:** Build the **Recycling Box** (Object Pool) for tomatoes.
2.  **Stage 5.2:** Build the Tomato Gun firing rules.
3.  **Stage 5.3:** Add **Weapon Pack 3**: Pea Shooter (Fast) and Watermelon Cannon (Heavy).

### Step C: Battle Test: "The 100 Tomato Test"
*   **Test:** Shoot 100 tomatoes as fast as possible. Does the game frame-rate Drop?

---

## Phase 6: Items & Destruction
**Goal:** Add collectibles and breaking boxes.

### Step A: Research & Strategy
*   **Research:** 2D Billboarding vs. 3D Meshes for items.
*   **Plan:** Create `planning/phase6_details.md`.

### Step B: Implementation (Pickups)
1.  **Stage 6.1:** Add the **Hidden Cookie** collectible.
2.  **Stage 6.2:** Build the **Destructible Cereal Boxes**.
3.  **Stage 6.3:** Add **Skin Pack 2**: Corn Dog and Burger skins.

---

## Phase 7: The Vertical Arena
**Goal:** Build the multi-level Kitchen environment.

### Step A: Research & Strategy
*   **Research:** Procedural level generation.
*   **Plan:** Create `planning/phase7_details.md`.

### Step B: Implementation (The Table)
1.  **Stage 7.1:** Build the "Multi-level" table (Stacks of plates).
2.  **Stage 7.2:** Build the **Master Shader** for transparent obstacles.
3.  **Stage 7.3:** Add the **Room Logic** (Inside the Fridge).

---

## Phase 8: Smart Enemies
**Goal:** Build the computer-controlled Bots.

### Step A: Information
*   **Plan:** Create `planning/phase8_details.md`.

### Step B: Implementation (The Intelligence)
1.  **Stage 8.1:** Build the Bot "Flee" behavior (Running away to heal).
2.  **Stage 8.2:** Build the Bot "Hunt" behavior.

---

## Phase 9: Persistence & Scores
**Goal:** Save user data to the cloud.

### Step A: Information
*   **Plan:** Create `planning/phase9_details.md`.

### Step B: Implementation (The Cloud)
1.  **Stage 9.1:** Connect to **Supabase** database.
2.  **Stage 9.2:** Build the Winner's Podium and Leaderboard.

---

## Phase 10: New Game Modes
**Goal:** Add Team Battle and Horde Mode.

---

## Phase 11: Multiplayer
**Goal:** Final Online Launch.
