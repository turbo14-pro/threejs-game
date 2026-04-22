# Food Fight Frenzy - Plain English Development Roadmap

This is the main plan for the project. 

---

## Phase 0: Setup and Planning
**Goal:** Pick professional tools and set up the project layout.

### Stage 0.1: Setting up the Platform
1.  **Step 0.1.0:** Compare platforms (Fortnite, Unreal Engine, Ai Studio or Three.js). [DONE: Three.js]
2.  **Step 0.1.1:** Set up selected platform for use with AI tools. [DONE]

### Stage 0.2: Picking the Physics Tool
1.  **Step 0.2.0:** Compare two tools (Rapier and Cannon) for gravity and hitting. [DONE: Rapier]
2.  **Step 0.2.1:** Install and connect Rapier to the project. [DONE]

### Stage 0.3: Picking the Game Rules Tool
1.  **Step 0.3.0:** Compare two tools (Zustand and Redux) for managing game rules. [DONE: Zustand]
2.  **Step 0.3.1:** Install and connect Zustand to the project. [DONE]

### Stage 0.4: Planning the Control Bridge
1.  **Step 0.4.0:** Plan the **Control Bridge** (The tool that understands controls: mouse, keyboard, touch). [DONE: @react-three/drei]
2.  **Step 0.4.1:** Build the **Control Bridge** (Translator for keys and touch). [DONE]

### Stage 0.5: Setting the Save Data Plan
1.  **Step 0.5.0:** Set the **Save Data Plan** (how we store progress) so it can be updated later.

### Stage 0.6: Selecting the Hosting Plan
1.  **Step 0.6.0:** Select online **Hosting Plan** for how players connect to each other. [Done: Infinityfree.me]
2.  **Step 0.6.1:** Set up online **Hosting Plan** for how players connect to each other. [Done]

### Stage 0.7: Setting up AI and Code Rules
1.  **Step 0.7.1:** Install AI tools to control **Naming Rules**, **code structure** and **Folder/File Structure** for all items and code.
1.  **Step 0.7.2:** Install all the coding tools. [DONE]
2.  **Step 0.7.3:** Set up the main folders. [DONE]

### Stage 0.9: Setting up the Bug Catcher
1.  **Step 0.9.0:** Set up the **Bug Catcher** system to find crashes.

### Stage 0.10: Testing the Empty World
1.  **Step 0.10.0:** Set a **Speed Check** to make sure the game runs fast on all computers.
2.  **Step 0.10.1:** Make sure the empty world runs perfectly at top speed.

*   **Git Goal:** `git commit -m "chore: complete phase 0 setup and planning" && git tag -a v0.0.0-foundation -m "Phase 0 Foundation Complete"`

---

## Phase 1: Characters and Item Rules
**Goal:** Build the "Master List" and the first character shapes.

### Stage 1.0: Phase 1 Planning and Research
1.  **Step 1.0.1:** Create **Importing Rules** for 3D models and animations.
2.  **Step 1.0.2:** Write a **Risk List** of things that might go wrong with physics or bots.
3.  **Step 1.0.3:** Create the `planning/phase1_details.md` file.

### Stage 1.1: Building the Character System
1.  **Step 1.1.1:** Research how to make arms hold items while legs run.
2.  **Step 1.1.2:** Build the **Master List Storage** (The main list for all skins and weapons). [DONE]
3.  **Step 1.1.3:** Clean up the **Main Brain** to handle lists of data. [DONE]
4.  **Step 1.1.4:** Add **Skin #1** (The Avo). [DONE]
5.  **Step 1.1.5:** Add **Skin #2** (The Egg). [DONE]
*   **Git Goal:** `git commit -m "feat: phase 1.3 - registries and core skins" && git tag -a v0.1.3-registries -m "Phase 1.3 Registries and Skins Complete"`

### Stage 1.2: Testing the Walls
1.  **Step 1.2.1:** Walk into every corner to make sure characters never go through walls.
2.  **Step 1.2.2:** Make sure all 3D items follow our naming and folder rules.

---

---

## Phase 2: Movement, Camera, and Sound
**Goal:** Build the physics for moving, the camera view, and the main sounds.

### Stage 2.0: Phase 2 Planning and Research
1.  **Step 2.0.1:** Create the `planning/phase2_details.md` file.

### Stage 2.1: Building Movement
1. **Step 2.1.1:** Research and plan movement including run, sprint, sneak, jump, slide and fall.
2. **Step 2.1.2:** Build the run sprint sneak system and controls.
3. **Step 2.1.3:** Build the **Shoulder Camera** with a **Cross-Hair** for accurate aiming.
4. **Step 2.1.4:** Build the **3-Step Jump** (Starting, Flying, Landing).
5. **Step 2.1.5:** Build the **Double Jump** (flip in the air).
6. **Step 2.1.6:** Build the **Sliding System** (run to slide/roll to sneak).
7. **Step 2.1.7:** Connect the speed of the character to the **Master List** (weight and stats).
8. **Step 2.1.8:** Build the **Fall Animation** (falling off map).
9. **Step 2.1.9:** Build the **Heavy Land** (landing from high points with health impact).
10. **Step 2.1.10:** Test movement system including on touch screens.

### Stage 2.2: Building Sound
1. **Step 2.2.1:** Research and plan the **Sound System** including 3D audio (how sound gets louder as you get closer).
2. **Step 2.2.2:** Build the **Sound Control Sliders** (A menu to turn music and sound effects up or down).
3. **Step 2.2.3:** Add the first **Walking Sound** (Footsteps that match how fast you are moving).
4. **Step 2.2.4:** Add the first **Background Sounds** (Ambient noise like hums, wind, or kitchen fans).
5. **Step 2.2.5:** Add the **Main Music Song** (A music track for the lobby and menus).
6. **Step 2.2.6:** Add a set of core game sounds:
    - **Splat & Thud** (Sounds for when food hits a wall or floor).
    - **Jump, Flip, and Heavy Land** (Sounds for all parts of the jump).
    - **Slide & Roll** (Sounds for crouching and moving fast).
    - **Fall** (A sound for when you fall off the map).
    - **Menu Click** (A clean sound for clicking buttons).
*   **Git Goal:** `git commit -m "feat: phase 2.3 - movement physics and stats" && git tag -a v0.2.3-physics -m "Phase 2.3 Movement Physics Complete"`

### Stage 2.3: Testing the Jump
1.  **Step 2.3.1:** Can the character jump high enough for game play (eg. onto an obstacle like a toaster)?
2.  **Step 2.3.2:** Can you still play the game even if the sound is turned off? (Visual cues).

---

## Phase 3: The Quick Link (Simple Multiplayer)
**Goal:** Sync players so you can see each other move in real-time.

### Stage 3.0: Phase 3 Planning and Research
1. **Step 3.0.1:** Create the `planning/phase3_details.md` file.
2. **Step 3.0.2:** Plan the **Geckos Server** (The connection that talks to all players).

### Stage 3.1: Building the Server and Client
1. **Step 3.1.1:** Research and plan how to send position data fast over long distances.
2. **Step 3.1.2:** Connect the **Network Tool** (Geckos).
3. **Step 3.1.3:** Build the **Simple Link** (A way to join a room).

### Stage 3.2: Syncing the Players
1. **Step 3.2.1:** Make the game update your friend's position on your screen.
2. **Step 3.2.2:** Sync which **Skin** each player is using from the Master List.

### Stage 3.3: Testing the Link
1. **Step 3.3.1:** Can two people move around the arena without the game crashing?
2. **Step 3.3.2:** Does the game correctly show when a player leaves?
*   **Git Goal:** `git commit -m "feat: phase 3.3 - basic player sync" && git tag -a v0.3.3-link -m "Phase 3.3 Multiplayer Link Complete"`

---

## Phase 4: The Lobby and World Menus
**Goal:** Build the match map, the tip popups, and the main screens.

### Stage 4.0: Phase 4 Planning and Research
1.  **Step 4.0.1:** Create the `planning/phase4_details.md` file.
2.  **Step 4.0.2:** Design the **Match Order** (The loop: Lobby -> Start -> End -> Play Again).

### Stage 4.1: The Lobby Map
1. **Step 4.1.1:** Plan the layout of the Lobby (where players stay before the game starts).
2. **Step 4.1.2:** Create the **Lobby Map**.

### Stage 4.2: Game Screens and Settings
1. **Step 4.2.1:** Research **Help Messages** and **Screen Resizing** (making buttons look good on phones).
2. **Step 4.2.2:** Build the **Main Menu, Pause Menu, and Settings**.
3. **Step 4.2.3:** Build the **Control Editing** screen (changing keys).

### Stage 4.3: Match Start Countdown
1. **Step 4.3.1:** Plan the timing and gravity for the fall into the match.
2. **Step 4.3.2:** Build the **Timer and Drop** (the 3-second countdown before falling into the match).
*   **Git Goal:** `git commit -m "feat: phase 4.3 - lobby maps and start logic" && git tag -a v0.4.3-lobby -m "Phase 4.3 Lobby and Countdown Complete"`

### Stage 4.4: Testing the Match Loop
1. **Step 4.4.1:** Can you start a match, play it, and finish it without the game breaking?
2. **Step 4.4.2:** Does the screen look correct when you change your key bindings?

---

## Phase 5: Hitting, Audio, and Feedback
**Goal:** Build "Splat" hitting logic and the professional Sound system.

### Stage 5.0: Phase 5 Planning and Research
1. **Step 5.0.1:** Create the `planning/phase5_details.md` file.
2. **Step 5.0.2:** Design a system to **Record Events** (who won, what weapon was used).

### Stage 5.1: Weapon Handling
1. **Step 5.1.1:** Research the best way to detect a weapon swing (finding the "Splat" zone).
2. **Step 5.1.2:** Add "Hand Pins" to the characters to hold items.

### Stage 5.2: Healing and Progress Rules
1. **Step 5.2.1:** Research health regeneration rules (how fast you heal when safe).
2. **Step 5.2.2:** Build the **Healing Logic** (5 seconds of safety = health points back).
3. **Step 5.2.3:** Build the **Event Recorder** (tracking player deaths and wins).

### Stage 5.3: Melee Combat and Effects
1. **Step 5.3.1:** Build the **Hitting Effects** (splat images and thud sounds).
2. **Step 5.3.2:** Build **Melee Weapon #1** (Basic) and **Weapon #2** (Heavy).

### Stage 5.4: Testing the Splat
1. **Step 5.4.1:** Can you hit 3 targets with one swing?
2. **Step 5.4.2:** Does the event recorder correctly write down that you got a point?
*   **Git Goal:** `git commit -m "feat: phase 5.4 - combat and healing" && git tag -a v0.5.4-combat -m "Phase 5.4 Combat Complete"`

---

## Phase 6: Shooting, Recycling, and Balancing
**Goal:** Build firing rules and a system to keep the game fast.

### Stage 6.0: Phase 6 Planning and Research
1. **Step 6.0.1:** Create the `planning/phase6_details.md` file.
2. **Step 6.0.2:** Research and plan ammo weapons and sounds.
3. **Step 6.0.3:** Consider how a user will switch weapons and items.

### Stage 6.1: Building the First Gun
1. **Step 6.1.1:** Build a **Bullet Recycler** -- code to reuse 100 shots instead of creating thousands (stops the game from lagging).
2. **Step 6.1.2:** Build **Ammo Weapon #1**
3. **Step 6.1.3:** Connect the **Event Recorder** to tracking weapon shots.
4. **Step 6.1.4:** Set up the **Tuning System** (easily changing power in the Master List).
5. **Step 6.1.5:** Add firing sounds

### Stage 6.2: Testing the Game Speed
1. **Step 6.2.1:** Shoot 100 bullets fast. Does the game stay smooth?
2. **Step 6.2.2:** Does Weapon #2 feel slower and more powerful than Weapon #1?

---

## Phase 7: Items, Breaking, and Saving
**Goal:** Add collectibles, breaking boxes, and make sure "Save" works.

### Stage 7.0: Phase 7 Planning and Research
1. **Step 7.0.1:** Create the `planning/phase7_details.md` file.
2. **Step 7.0.2:** Plan the **Save Integrity Test** (checking if our save system is solid).

### Stage 7.1: Safe Saving System
1. **Step 7.1.1:** Research how to fix a broken save file if the power goes out.
2. **Step 7.1.2:** Build the **Save Safety System** (make sure saves NEVER break).

### Stage 7.2: World Items and Boxes
1. **Step 7.2.1:** Add a **collectable** item.
2. **Step 7.2.2:** Test game speed and fps with 10 collectable items in the world

### Sage 7.3: Breakable world obstacles 
1. **Step 7.2.2:** Build **Breakable Boxes**.
2. **Step 7.2.3:** Test game speed and fps with 10 breakable boxes in the world

### Stage 7.4: Movable world obstacles
1. **Step 7.3.1:** Build an obstracle that can be hit and moves with gravity
2. **Step 7.3.2:** Test game speed and fps with 10 movable world obstacles in the world

### Stage 7.4: Extra Character Skins
1. **Step 7.3.1:** Add **Skin #3** and **Skin #4**

---

## Phase 8: The Multi-Level Arena and Speed Check
**Goal:** Build a prototype multi-level map and check the game's speed limits.

### Stage 8.0: Phase 8 Planning and Research
1. **Step 8.0.1:** Create the `planning/phase8_details.md` file.
2. **Step 8.0.2:** Set up the **Final Speed Tests** for characters and computers.

### Stage 8.1: Build a multi-level map
1. **Step 8.1.1:** Plan, build and test a way to get to different levels (double jump or jump pads?)
2. **Step 8.1.2:** Build a test multi-level map like an oven/fridge with shelves or cupboard
3. **Step 8.1.3:** Run a **Full Speed Profile** (checking how much CPU the map uses).

---

## Phase 9: Computer Players (Bots) and Final Tests
**Goal:** Build the Bots and test their "Smart" moves.

### Stage 9.0: Phase 9 Planning and Research
1. **Step 9.0.1:** Create the `planning/phase9_details.md` file.

### Stage 9.1: Building the Bots
1. **Step 9.1.1:** List the **Bot Risks** (getting stuck) and Bot Modes (Attack vs Run).
2. **Step 9.1.2:** Build the Bot "Healing" logic.
3. **Step 9.1.3:** Build **Bot Stats Tracking** (counting how many times bots win).

### Stage 9.2: Testing the Crowd
1. **Step 9.2.1:** Put 20 bots in a room for 2 hours (Soak Test).
2. **Step 9.2.2:** Make sure bots don't "Spawn Trap" players (waiting at the start to hit them).

---

## Phase 10: Cloud Saving and Privacy
**Goal:** Finalize the Database, User Accounts, and Privacy rules.

### Stage 10.0: Phase 10 Planning and Research
1. **Step 10.0.1:** Create the `planning/phase10_details.md` file.

### Stage 10.1: Building the Cloud
1. **Step 10.1.1:** Design the rules for **Guests vs. Signed-in** players and **Privacy Rules**.
2. **Step 10.1.2:** Connect the game to the **Cloud Database** (Supabase).
3. **Step 10.1.3:** Build the **Profile Settings** (Opt-out switches).
4. **Step 10.1.4:** Build the **Leaderboard**.

---

## Phase 11: The Pro Link (Online Polish)
**Goal:** Finalize player rooms and stability under lag.

### Stage 11.0: Phase 11 Planning and Research
1. **Step 11.0.1:** Research Prediction and Smoothing math (making moves look perfect).

### Stage 11.1: Fixing Lag and Sync Errors
1. **Step 11.1.1:** Plan a way to **Shrink Data Packages** and build a **Lag Finder** tool.
2. **Step 11.1.2:** Build the **Lag Debugger** (on-screen tool for fixing lag).
3. **Step 11.1.3:** Build the **Sync System** with Prediction and Smoothing.

### Stage 11.2: Rooms and Connection Fixing
1. **Step 11.2.1:** Pick the **Hosting Model** and design the **Lag Test Table** (Testing with bad internet).
2. **Step 11.2.2:** Design the **Host-Migration** and **Reconnect** logic.
3. **Step 11.2.3:** Build the Matchmaking rooms.
4. **Step 11.2.4:** Build the **Lag Simulation** and "Jump back in" logic.
*   **Git Goal:** `git commit -m "feat: phase 11 multiplayer polish" && git tag -a v0.11.0-online-polish -m "Phase 11 Online Polish Complete"`

---

## Phase 12: Final Polish and Launch
**Goal:** Final fix of all bugs and checking accessibility.

### Stage 12.1: Final Cleanup and Launch
1. **Step 12.1.1:** The **Final Bug-Fix Marathon**.
2. **Step 12.1.2:** **Privacy and Data Security Check**.
3. **Step 12.1.3:** **Network Lag Pass** (must work even with bad internet).
4. **Step 12.1.4:** **Final Launch**.
