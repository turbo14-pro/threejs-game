# Project: Food Fight Frenzy (3D Web Deathmatch) - Master Blueprint

This is the comprehensive master development plan for a cross-platform, food-themed 3D arena combat game. It is designed to be highly optimized for web browsers while providing a "console-quality" feel on PC and mobile.

---

## 1. Core Concept & Gameplay Loop
Food Fight Frenzy is an arcade-style combat game where players control food-themed avatars in a giant kitchen-themed arena.

*   **Preparation (The Lobby):** 
    *   *Current State:* Players start on a dual-platform "Spawning Area" (Y=100) above the arena. 
    *   *System:* Interactive Podium selection allows toggling between character skins (Avo, Egg) via blue touch pads.
    *   *Goal:* Add username entry and weapon selection podiums.
*   **Pre-Match / The Drop:**
    *   *Decision Needed:* Transition from the current "Teleport/Jump" mechanic to the planned "Floating Squares" drop. A 10s countdown will display gameplay tips while the arena (Cereal Boxes, etc.) lazy-loads.
*   **The Battle:** Players fight for the top leaderboard spots on the giant Kitchen Table (600x600).
*   **Recovery:** Passive health regeneration triggers after 5 seconds of hiding behind obstacles. (Pending Implementation)
*   **Conclusion:** Top 3 players/teams displayed on a winner's podium at match end.

## 2. Game Modes
*   **Free-For-All (FFA):** Primary tested mode. Track top 4 individual killers on the HUD.
*   **Red vs. Blue (Team Deathmatch):** Future implementation. Requires team-colored outlines or accessory hats.
*   **Co-op Survival (Horde Mode):** Survive waves of "spoiled" food bots to unlock "Gold" variants.

## 3. Character Architecture & Animation
*   **Models:** High-fidelity low-poly character skins (`Avo`, `Egg`) using a unified skeletal armature for shared animation compatibility.
*   **Unified Animation Set:** Driven by `animations.json` map. 
    *   *Movement:* `idle`, `walk_for`, `walk_bac`, `run_for`, `run_bac`.
    *   **Compound Action Logic:** Jumps are split into `Launch` (Frames 0-18) → `Air Loop` (Looping) → `Landing` (Frames 0-20). Physics liftoff is triggered mid-launch (Frame 6) for responsiveness.
*   **Technical:** All skins optimized via KTX2 Basis Universal compression and Texture Atlasing.

## 4. Controls & Camera System
*   **Orbit Camera:** "Rubberbanding" smoothing with `castShape` collision avoidance to prevent clipping through walls/floors. Offset to ensure character visibility.
*   **Movement Mechanics:**
    *   **Standard:** WASD / Joystick.
    *   **Sprinting:** `Hold Shift` (Speed 30 vs. 8). Support for "Toggle Sprint" on touch.
    *   **Backwards Walking:** A context-aware 144-degree zone detect if the player is facing the camera while moving away, triggering `walk_bac`.
    *   **Slide:** `Press Ctrl` for a speed burst and low profile. *(Decision: Animation files and logic pending)*.
*   **Mobile Specifics:** Dynamic on-screen joystick, pinch-to-zoom camera, and dedicated jump/sprint/slide buttons.

## 5. Environment & AI Intelligence
*   **The Kitchen Arena:** A 600x600 cedar-themed table with procedural wood textures (save asset size via Canvas API).
*   **Dynamic Obstacles:** 
    *   **Cereal Boxes:** Randomized, non-intersecting spawns. 
    *   **Hollow Physics:** Composite colliders allow players to enter box interiors via front doorways.
    *   **Custom Shaders:** Instanced rendering with color-injectable brand logos and a separate "Cardboard Tan" interior material.
*   **Tactical AI:** High-density CPUs with health-aware state machines (Entering "Flee Mode" at 25% Health to hide and regenerate).

## 6. UI & Audio
*   **HUD:** Planned Top 4 Killer status squares.
*   **Menu:** `Esc` or `Top-left` button for settings.
*   **Audio SFX:**
    *   Combat "Splats" and "Clacks".
    *   System "Pop" for eliminations.
*   **Music:** Upbeat bouncy Lobby tracks transitioned into high-energy Battle tracks.

## 7. Optimization & Technical
*   **Rendering:** Frustum Culling, Instanced Rendering for map geometry.
*   **Physics:** Rapier physics with simplified primitive-based player capsules.
*   **Performance:** Object Pooling for projectiles; AI update throttling (every 10 frames).
*   **Network:** Future implementation of client-side prediction for smooth multiplayer.

## 8. Progression & Persistence
*   **Achievements:** Hidden "easter eggs" (e.g., Finding the hidden cookie) to unlock special skins.
*   **Save System:** LocalStorage (for web) and Cloud backup for stats, name, and unlocks.

---

# Current Implementation Assessment & Contradictions

### ❌ Contradictions to Address
1.  **Initial Spawn:** The plan specifies a 10s countdown on floating squares that vanish. Currently, the game uses a persistent "Spawn Platform" (Y=100) with a "START" teleport pad.
2.  **Slide Mechanic:** The plan describes a `Slide` (Ctrl) feature, but the current `PlayerController.jsx` does not have logic or animation states for sliding.
3.  **Weapon Choice:** The plan says "choose one weapon in the lobby." Current system only handles skin selection (Avo/Egg).

### 🛠️ Pending Decisions & Features
*   **Weapon System:** Do weapons change animations? (e.g., Breadstick sword vs. Tomato splat gun).
*   **Multiplayer Architecture:** Will we use Socket.io or a p2p solution (Geckos.io/PeerJS) for browser-based networking?
*   **HUD Implementation:** Conversion from the current 3D world-space "START" text to a proper 2D React-based Overlay.
*   **Health Overlay:** Visual feedback (e.g., Screen vignetting or a heart bar) for the health/regen system.
