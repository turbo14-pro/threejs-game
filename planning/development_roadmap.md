# Food Fight Frenzy - Plain English Development Roadmap

This is the main plan for the project. Each phase focuses on just one thing.

## 📜 How to Use This Roadmap

To make sure we build the best game possible, follow these rules for every phase:

1. **One Thing at a Time**: We only work on one feature at once.
2. **Research and Talk First**: Start every phase by looking for the best ways to build it and tools that might help. Talk with the user to brainstorm exactly how they want it to work. Never guess!
3. **Plan the Test**: Work with the user to make a step-by-step list to test if the new feature works perfectly.
4. **Save and Remember**: When a phase is finished, save the code (Git push) and update our project memory so we don't forget how we did it.
5. **Wait for the Green Light**: **NEVER** start the next phase on your own. Always stop and wait until the user says they are ready to move on.

---

---

## Phase 0: 🛠️ Foundation Setup
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

### Stage 0.4: Building the Control Bridge
1.  **Step 0.4.0:** Plan the **Control Bridge** (The tool that understands keys and touch). [DONE: @react-three/drei]
2.  **Step 0.4.1:** Build the **Control Bridge**. [DONE]

### Stage 0.5: AI and Code Rules
1.  **Step 0.5.1:** Set up AI tools for naming and folder rules. [DONE]
2.  **Step 0.5.2:** Install all coding tools. [DONE]
3.  **Step 0.5.3:** Set up the main folders. [DONE]

### Stage 0.6: Speed and Bug Checks
1.  **Step 0.6.0:** Set up the **Bug Catcher** system to find crashes.
2.  **Step 0.6.1:** Make sure the empty world runs fast on all computers.

---

## Phase 1: 🍎 Character Skins
**Goal:** Build the list of characters and add the first shapes.

### Stage 1.1: Building the Skin List
1.  **Step 1.1.1:** Build the **Master List Storage** (The list for all skins). [DONE]
2.  **Step 1.1.2:** Clean up the **Main Brain** to handle the list. [DONE]
3.  **Step 1.1.3:** Add **Skin #1** (The Avo). [DONE]
4.  **Step 1.1.4:** Add **Skin #2** (The Egg). [DONE]

### Stage 1.2: Extra Skins
1.  **Step 1.2.1:** Add **Skin #3** and **Skin #4**.

---

## Phase 2: 🏃 Basic Movement
**Goal:** Build the physics for walking, running, and jumping.

### Stage 2.1: Walking and Running
1. **Step 2.1.1:** Build the run, sprint, and sneak controls.
2. **Step 2.1.2:** Connect character speed to their weight in the Master List.

### Stage 2.2: Jumping and Sliding
1. **Step 2.2.1:** Build the **3-Step Jump** (Start, Fly, Land).
2. **Step 2.2.2:** Build the **Double Jump** flip.
3. **Step 2.2.3:** Build the **Sliding System** (roll to sneak).

### Stage 2.3: Falling and Landing
1. **Step 2.3.1:** Build the **Fall Animation** for falling off the map.
2. **Step 2.3.2:** Build the **Heavy Land** (landing from high up hurts health).

---

## Phase 3: 🎥 Camera View
**Goal:** Set up how the player sees the world.

### Stage 3.1: The Shoulder Camera
1. **Step 3.1.1:** Build the **Shoulder Camera** (Third-person view).
2. **Step 3.1.2:** Add a **Cross-Hair** for accurate aiming.

---

## Phase 4: 🔊 Audio System
**Goal:** Add all the music and sound effects.

### Stage 4.1: Sound Controls
1. **Step 4.1.1:** Build the **Sound Control Sliders** (Menu for volume).
2. **Step 4.1.2:** Research 3D audio (sounds get louder when close).

### Stage 4.2: Game Sounds
1. **Step 4.2.1:** Add **Walking Sounds** that match speed.
2. **Step 4.2.2:** Add **Background Music** and ambient noises.
3. **Step 4.2.3:** Add **Effect Sounds** (Splat, Thud, Jump, Slide, Click).

---

## Phase 5: 🌐 Basic Online
**Goal:** Let players see each other move in real-time.

### Stage 5.1: Server Connection
1. **Step 5.1.1:** Connect the **Network Tool** (Geckos).
2. **Step 5.1.2:** Build a simple way to join a room.

### Stage 5.2: Syncing Players
1. **Step 5.2.1:** Make the game update your friend's position.
2. **Step 5.2.2:** Sync which **Skin** each player is using.

---

## Phase 6: 🏠 Main Lobby
**Goal:** Build the area where players wait for a match.

### Stage 6.1: The Lobby Map
1. **Step 6.1.1:** Design the layout of the waiting room.
2. **Step 6.1.2:** Create the **Lobby Map** in 3D.

---

## Phase 7: 🖥️ Game Menus
**Goal:** Build all the screens for settings and pausing.

### Stage 7.1: Screen Design
1. **Step 7.1.1:** Build the **Main Menu, Pause Menu, and Settings**.
2. **Step 7.1.2:** Build the **Control Editing** screen (changing keys).
3. **Step 7.1.3:** Make sure menus look good on phones.

---

## Phase 8: ⏲️ Match Start
**Goal:** Build the countdown and the drop into the game.

### Stage 8.1: The Countdown
1. **Step 8.1.1:** Build the **Timer and Drop** (3-second countdown).
2. **Step 8.1.2:** Plan the gravity for the fall into the match.

---

## Phase 9: 🥊 Melee Hitting
**Goal:** Build the logic for hitting other players with food.

### Stage 9.1: Weapon Holding
1. **Step 9.1.1:** Add "Hand Pins" so characters can hold items.
2. **Step 9.1.2:** Build **Melee Weapon #1** and **Weapon #2**.

### Stage 9.2: Hitting Logic
1. **Step 9.2.1:** Build the **Splat Zone** (detecting a hit).
2. **Step 9.2.2:** Add **Hitting Effects** (splat images and thud sounds).

---

## Phase 10: 🩹 Health Rules
**Goal:** Set the rules for taking damage and healing.

### Stage 10.1: Healing Logic
1. **Step 10.1.1:** Build **Health Regeneration** (safety = health back).
2. **Step 10.1.2:** Connect health to the **Heavy Land** impact.

---

## Phase 11: 📊 Event Tracking
**Goal:** Record who wins and what happens in the game.

### Stage 11.1: The Event Recorder
1. **Step 11.1.1:** Build the tool that tracks deaths and wins.
2. **Step 11.1.2:** Record which weapons are used the most.

---

## Phase 12: 🔫 Shooting System
**Goal:** Build weapons that fire food across the arena.

### Stage 12.1: Bullet Recycling
1. **Step 12.1.1:** Build a **Bullet Recycler** to stop the game from lagging.
2. **Step 12.1.2:** Build **Ammo Weapon #1** and add firing sounds.

---

## Phase 13: ⚙️ Game Tuning
**Goal:** Make it easy to change how strong weapons are.

### Stage 13.1: The Tuning Tool
1. **Step 13.1.1:** Set up the **Tuning System** in the Master List.
2. **Step 13.1.2:** Test if Weapon #2 feels slower but stronger.

---

## Phase 14: 💾 Save System
**Goal:** Make sure player progress is saved safely.

### Stage 14.1: Safe Saving
1. **Step 14.1.1:** Build a system that never breaks a save file.
2. **Step 14.1.2:** Test saving even if the power goes out.

---

## Phase 15: 🎁 Pickup Items
**Goal:** Add items in the world that players can collect.

### Stage 15.1: Collectibles
1. **Step 15.1.1:** Add a **Collectable Item** to the map.
2. **Step 15.1.2:** Make sure 10 items don't slow down the game.

---

## Phase 16: 📦 Breakable Parts
**Goal:** Add objects that smash when you hit them.

### Stage 16.1: Breaking Boxes
1. **Step 16.1.1:** Build **Breakable Boxes**.
2. **Step 16.1.2:** Make sure smashing 10 boxes stays smooth.

---

## Phase 17: 🪑 Movable Objects
**Goal:** Add objects that can be pushed around.

### Stage 17.1: Physics Obstacles
1. **Step 17.1.1:** Build an obstacle that moves with gravity.
2. **Step 17.1.2:** Make sure hitting objects feels realistic.

---

## Phase 18: 🏗️ Multi-Level Maps
**Goal:** Build maps with floors, shelves, and stairs.

### Stage 18.1: Level Design
1. **Step 18.1.1:** Build a map with multiple levels like a fridge or oven.
2. **Step 18.1.2:** Build **Jump Pads** to get to higher floors.

---

## Phase 19: ⚡ Speed Checks
**Goal:** Make sure the game stays fast during heavy action.

### Stage 19.1: Performance Testing
1. **Step 19.1.1:** Run a **Full Speed Profile** on the CPU.
2. **Step 19.1.2:** Test the game with 100 bullets on screen.

---

## Phase 20: 🤖 Computer Bots
**Goal:** Build smart computer players to fight against.

### Stage 20.1: Bot Brains
1. **Step 20.1.1:** Build **Bot Modes** (Attack vs Run).
2. **Step 20.1.2:** Add healing and stat tracking for bots.

---

## Phase 21: 🧪 Stress Testing
**Goal:** Run the game for a long time to find hidden bugs.

### Stage 21.1: The Soak Test
1. **Step 21.1.1:** Run 20 bots in a room for 2 hours.
2. **Step 21.1.2:** Fix bots so they don't "Spawn Trap" players.

---

## Phase 22: ☁️ Cloud Accounts
**Goal:** Connect the game to an online database.

### Stage 22.1: Supabase Setup
1. **Step 22.1.1:** Connect the game to **Supabase**.
2. **Step 22.1.2:** Build the **Online Leaderboard**.

---

## Phase 23: 🔒 Privacy Rules
**Goal:** Make sure player data is handled correctly.

### Stage 23.1: Profile Settings
1. **Step 23.1.1:** Create rules for **Guest vs Signed-in** players.
2. **Step 23.1.2:** Add **Opt-out switches** for privacy.

---

## Phase 24: 📶 Lag Fixing
**Goal:** Make the game look smooth even with slow internet.

### Stage 24.1: Prediction Math
1. **Step 24.1.1:** Build **Prediction and Smoothing** for player moves.
2. **Step 24.1.2:** Build a **Lag Finder** tool to spot slow-downs.

---

## Phase 25: 🤝 Matchmaking
**Goal:** Group players together into game rooms.

### Stage 25.1: Room Management
1. **Step 25.1.1:** Build **Matchmaking Rooms**.
2. **Step 25.1.2:** Build **Reconnect** logic for dropped players.

---

## Phase 26: ✨ Final Polish
**Goal:** Fix every tiny bug and clean up the visuals.

### Stage 26.1: The Bug Marathon
1. **Step 26.1.1:** Run the **Final Bug-Fix Marathon**.
2. **Step 26.1.2:** Double-check all security and privacy rules.

---

## Phase 27: 🚀 Official Launch
**Goal:** Release the game to the world.

### Stage 27.1: The Release
1. **Step 27.1.1:** Final network check.
2. **Step 27.1.2:** **Official Launch**.
