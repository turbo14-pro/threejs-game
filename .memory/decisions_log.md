# Decisions Log

> Append-only. Never rewrite, never delete, never reorder.

---

### 2026-04-10 - Platform Selection: Three.js
**Context**: Compared Fortnite Creative, Unreal Engine, AI Studio and Three.js as the base platform for Food Fight Frenzy. Needed a browser-based, lightweight engine that works well with AI coding tools.  
**Decision**:  
1. Use **Three.js** with **React Three Fiber** as the rendering framework.  
2. Use **Vite** as the build tool.  
**Impact**: All game code lives in `src/`. React component patterns used throughout. Shader and post-processing work uses Three.js APIs directly.  
**Agent**: Dev (human).

---

### 2026-04-10 - Physics Engine: Rapier
**Context**: Compared Rapier and Cannon-es for gravity, collisions, and hitting detection.  
**Decision**:  
1. Use **Rapier** via `@react-three/rapier`.  
**Impact**: Physics runs through Rapier's WASM module. Character controllers use Rapier rigid bodies. Collision groups set up through Rapier API.  
**Agent**: Dev (human).

---

### 2026-04-10 - State Management: Zustand
**Context**: Compared Zustand and Redux for managing game rules and shared state.  
**Decision**:  
1. Use **Zustand** for all game state.  
**Impact**: Game stores live in `src/stores/` or similar. No Redux boilerplate needed.  
**Agent**: Dev (human).

---

### 2026-04-10 - Input Abstraction: @react-three/drei
**Context**: Needed a control bridge to translate keyboard, mouse, and touch inputs into game actions.  
**Decision**:  
1. Use **@react-three/drei** for input helpers and camera controls.  
**Impact**: KeyboardControls, PointerLockControls and similar drei components used for input.  
**Agent**: Dev (human).

---

### 2026-04-10 - Hosting: InfinityFree
**Context**: Needed a free hosting solution for early development and testing.  
**Decision**:  
1. Use **InfinityFree.me** for static hosting.  
**Impact**: Deploy script at `deploy.cjs`. Production builds go to `dist/`.  
**Agent**: Dev (human).

---

### 2026-04-21 - Memory System Setup
**Context**: Needed a persistent memory vault so the AI assistant keeps track of decisions, status, architecture, and contacts across conversations.  
**Decision**:  
1. Create `.memory/` vault with four core files: `state_of_play.md`, `decisions_log.md`, `architecture_notes.md`, `contacts.md`.  
2. Add `snapshots/` folder for dated copies of state_of_play.  
3. Use Obsidian-style wiki links between memory files.  
4. Decisions log is append-only; state_of_play is overwrite-only.  
**Impact**: All future conversations should read `.memory/` before acting. AI will update these files automatically on relevant triggers.  
**Agent**: Antigravity (AI).

---

### 2026-04-10 - Networking Model: Authoritative Server
**Context**: Needed to decide how multiplayer data flows between players. Options were peer-to-peer (everyone talks to everyone) or authoritative server (one boss computer decides what happened).  
**Decision**:  
1. Use an **Authoritative Server Model** — the server decides what happened, the client just predicts movement to keep it smooth.  
**Impact**: Future multiplayer code (Phase 4+) must be written with server authority in mind. Client-side prediction needed for responsiveness.  
**Agent**: Dev (human).

---

### 2026-04-10 - Save File Format: JSON Schema with Versioning
**Context**: Needed a save system that won't break when the game updates.  
**Decision**:  
1. Every save file uses **JSON Schema with a version number**.  
2. This lets us safely update the game later and convert old saves.  
**Impact**: Save/load code must always read and write a `version` field. Migration functions needed for each version bump.  
**Agent**: Dev (human).

---

### 2026-04-10 - Naming Rules for 3D Assets
**Context**: Needed standard names so all models are easy to find and load automatically.  
**Decision**:  
1. Character skins: `skin_[name].glb`  
2. Weapons: `weapon_[name].glb`  
**Impact**: Asset loader code and the Master List (registries.js) depend on this naming pattern. Any new model must follow it.  
**Agent**: Dev (human).

---

### 2026-04-10 - Folder Layout Standard
**Context**: Needed a clear folder structure to keep the project tidy as it grows.  
**Decision**:  
1. `/src/components` — UI and scene pieces  
2. `/src/hook` — Logic hooks  
3. `/src/data/registries.js` — The Master List  
**Impact**: All new code files must go into the correct folder. Reviewed in Phase 0.  
**Agent**: Dev (human).

---

### 2026-04-10 - Crash Logging: Console.info Now, Sentry Later
**Context**: Needed a way to track crashes without adding a big tool too early.  
**Decision**:  
1. Use `console.info` with custom tags for now.  
2. Switch to **Sentry** or **Bugsnag** when the game goes public.  
**Impact**: No extra dependencies added yet. Logging tags should be kept consistent so migration is easy.  
**Agent**: Dev (human).

---

### 2026-04-10 - Shared Bone Skeleton for All Skins
**Context**: Making separate animations for every character skin would take too long and waste memory.  
**Decision**:  
1. All character skins share one **unified bone skeleton** (armature).  
2. One animation set (idle, walk, run, jump) works for every skin.  
**Impact**: Every new skin must be rigged to the same `CharacterBase` armature in Blender. The `animations.json` map drives all characters equally.  
**Agent**: Dev (human).

---

### 2026-04-10 - Compressed GLB Textures
**Context**: Game assets need to load fast in a web browser. Uncompressed textures are too large.  
**Decision**:  
1. All `.glb` models must be exported with **compressed textures** (KTX2 Basis Universal planned).  
**Impact**: Export pipeline must include texture compression step. Larger models will need the `gltf-pipeline` tool.  
**Agent**: Dev (human).

---

### 2026-04-10 - Multiplayer Tool: Geckos.io
**Context**: Needed a networking library for browser-based multiplayer. Compared Socket.io and Geckos.io (WebRTC).  
**Decision**:  
1. Use **Geckos.io** for WebRTC-based real-time networking.  
**Impact**: `@geckos.io/client` already in `package.json`. Server-side setup needed in Phase 4. WebRTC gives lower delay than WebSocket for real-time movement.  
**Agent**: Dev (human).

---

### 2026-04-10 - ECS Library: Miniplex
**Context**: Needed an Entity Component System to manage game objects (players, bullets, items) efficiently.  
**Decision**:  
1. Use **Miniplex** for entity management.  
**Impact**: `miniplex` already in `package.json`. Used for managing collections of game entities with shared behaviour.  
**Agent**: Dev (human).

---

### 2026-04-10 - Camera System: Orbit with Rubberbanding
**Context**: Needed a camera that follows the player smoothly without clipping through walls.  
**Decision**:  
1. Use an **Orbit Camera** with "rubberbanding" (smooth follow).  
2. Use `castShape` collision avoidance to stop the camera going through walls and floors.  
3. Offset the camera so the character stays visible.  
**Impact**: Camera code in PlayerController. The `castShape` call uses Rapier physics for wall detection.  
**Agent**: Dev (human).

---

### 2026-04-10 - Health Regen: 5-Second Safety Timer
**Context**: Needed rules for how players recover health during a match.  
**Decision**:  
1. Passive health regeneration starts after **5 seconds** of not being hit.  
2. Players can hide behind obstacles to trigger this.  
**Impact**: Health system (Phase 5) must track "time since last hit". Obstacles become strategically important.  
**Agent**: Dev (human).

---

### 2026-04-10 - Bot AI: Flee at 25% Health
**Context**: Bots need smart behaviour so they feel like real players.  
**Decision**:  
1. Bots enter **Flee Mode** when health drops below 25%.  
2. In Flee Mode, bots run away and hide to trigger health regeneration.  
**Impact**: Bot state machine (Phase 9) needs Attack and Flee modes with health-aware switching.  
**Agent**: Dev (human).

---

### 2026-04-10 - Jump System: 3-Step Split
**Context**: A single "jump" animation feels robotic. Needed a more realistic approach.  
**Decision**:  
1. Jumps split into 3 parts: **Launch** (frames 0-18) → **Air Loop** (looping) → **Landing** (frames 0-20).  
2. Physics liftoff triggers at **frame 6** of the launch for responsiveness.  
**Impact**: Animation system must blend between 3 separate clips during a jump. PlayerController needs frame-aware physics triggers.  
**Agent**: Dev (human).

---

### 2026-04-10 - Deploy Method: FTP via deploy.cjs
**Context**: Needed a quick way to push builds to InfinityFree hosting.  
**Decision**:  
1. Use `ftp-deploy` npm package with a custom `deploy.cjs` script.  
2. `npm run deploy` builds, commits, and uploads in one step.  
**Impact**: Deploy credentials stored in `.env`. Build output at `dist/` is uploaded to the hosting server.  
**Agent**: Dev (human).

---

### 2026-04-11 - Movement Reversed: Run by Default
**Context**: Original design had walking as default with Shift to sprint. Felt too slow for an action game.  
**Decision**:  
1. **Run speed (30)** is now the default movement.  
2. **Shift** key (or mobile toggle) slows the player to **Walk speed (8)**.  
3. UI labels changed from "SPRINT" to "WALK".  
**Impact**: PlayerController movement code reversed. Mobile UI buttons relabelled. All future speed tuning references run as baseline.  
**Agent**: Dev (human) + Antigravity (AI).

---

### 2026-04-11 - Mobile Controls: Dedicated Slide Button
**Context**: Mobile players had no easy way to slide. Needed a dedicated button.  
**Decision**:  
1. Add a **SLIDE** button to the bottom-right of the mobile screen.  
2. Add a **WALK** toggle button (stays active until tapped again).  
**Impact**: Mobile UI component updated. Touch input handler maps slide button to the same action as Ctrl on keyboard.  
**Agent**: Dev (human) + Antigravity (AI).

---

### 2026-04-11 - Post-Processing Order: FXAA → Bloom
**Context**: Dark halo rings were appearing around glowing objects due to effect ordering.  
**Decision**:  
1. Apply **FXAA smoothing first**, then **Bloom glow second**.  
2. Turn off `multisampling` on the EffectComposer to avoid doubling up with FXAA.  
**Impact**: Post-processing pipeline in the rendering code reordered. Fixed the dark ring visual bug.  
**Agent**: Antigravity (AI).

---

### 2026-04-11 - Blender Animation Pipeline
**Context**: Needed an automated way to turn Mixamo FBX animations into game-ready GLTF files.  
**Decision**:  
1. Built a 12-step Blender Python script (`mixamo_pipeline.py`).  
2. Pipeline: Import FBX → remove unwanted meshes → NLA transfer → duplicate CharacterBase → bake at **Step 2** (50% sampling) → export GLTF (Separate, +Y Up, Rest Position).  
3. New animations must be added to `animations.json` after export.  
**Impact**: All future animations go through this pipeline. Consistent output format. Batch processing supported via PowerShell loop.  
**Agent**: Antigravity (AI).

---

### 2026-04-11 - Blender Installation Path
**Context**: Needed to know the exact Blender path for command-line automation.  
**Decision**:  
1. Blender lives at `P:\Program Files\Blender 5.1\blender.exe`.  
**Impact**: All Blender CLI commands and skill scripts use this path. Must be updated if Blender is reinstalled or upgraded.  
**Agent**: Antigravity (AI).

---

### 2026-04-11 - Roadmap Hierarchy: Phase → Stage → Step
**Context**: The original roadmap had inconsistent naming (Step A, Stage 1.1, etc.). Needed a clear system.  
**Decision**:  
1. **Phase** = biggest chunk (Phase 0, 1, 2...).  
2. **Stage** = main job within a phase (Stage 1.0, 1.1...).  
3. **Step** = small task within a stage (Step 1.1.1, 1.1.2...).  
4. Phase research goes in Stage X.0. Stage research goes in Step X.Y.1.  
**Impact**: Entire roadmap restructured. All future planning must follow this system.  
**Agent**: Antigravity (AI).

---

### 2026-04-11 - Smooth Shading on Character Meshes
**Context**: Low-poly character models (Egg, Avo) had visible banding — flat faces were obvious.  
**Decision**:  
1. Apply **smooth shading** to all character meshes.  
2. Keep materials non-glossy for performance.  
**Impact**: PlayerModel.jsx updated. All future character skins should have smooth normals applied in Blender before export.  
**Agent**: Antigravity (AI).

---

### 2026-04-11 - Bump Map on Avo Skin
**Context**: The Avo character's dark material looked too flat and needed surface detail.  
**Decision**:  
1. Add a **procedural noise-based bump map** using a `DataTexture`.  
2. Applied to the `bumpMap` property of the Avo's dark material.  
**Impact**: PlayerModel.jsx updated for Avo skin. Other skins can use the same approach for surface detail.  
**Agent**: Antigravity (AI).

---

### 2026-04-11 - Start Game: Instant Spawn
**Context**: There was an artificial delay when stepping on the "start game" pad. Felt sluggish.  
**Decision**:  
1. Remove all timers and delays from the start pad interaction.  
2. Player spawns into the arena **immediately** on pad contact.  
**Impact**: Start pad handler simplified. No countdown or transition delay before arena entry.  
**Agent**: Dev (human) + Antigravity (AI).

---

### 2026-04-11 - AI Tooling: Three.js MCP + Sketchfab Search
**Context**: Needed AI tools to inspect the running game and search for 3D assets.  
**Decision**:  
1. Install **Three.js MCP** for WebSocket scene inspection.  
2. Install **Sketchfab MCP** for searching downloadable 3D models.  
3. API key stored in `.env`.  
**Impact**: MCP config updated. Sketchfab search skill created in `.agents/skills/`. AI can now inspect live scenes and find models.  
**Agent**: Antigravity (AI).

---

### 2026-04-23 - Multiplayer Hosting: Oracle Cloud VPS
**Context**: Static hosting (InfinityFree) cannot run Node.js processes needed for the Geckos.io server. Needed a persistent server for signaling and relay.  
**Decision**:  
1. Use **Oracle Cloud "Always Free" Arm Instance** running Ubuntu.  
2. Open **Port 9208 (TCP/UDP)** in the Oracle Security List and OS firewall (iptables).  
3. Use **PM2** for process management and auto-restart.  
**Impact**: Multiplayer logic runs on a dedicated VPS. Frontend remains on InfinityFree. Cross-origin communication handled via Geckos.io signaling.  
**Agent**: Dev (human) + Antigravity (AI).

---

### 2026-04-23 - Networking Fix: STUN + Public IP Injection
**Context**: Connection handshakes were hanging because the server was advertising internal/private IPs (127.0.0.1 or 10.x.x.x) instead of its public face.  
**Decision**:  
1. Add **Google STUN servers** to both client and server configurations.  
2. Use the **GECKOS_PUBLIC_IP** environment variable on the server to force its identity.  
3. Restrict Geckos to use **port 9208** for all WebRTC data via the `portRange` setting.  
**Impact**: Successfully bypassed the cloud NAT firewall. Handshake succeeds in both Node.js and Browser environments.  
**Agent**: Antigravity (AI).

---

### 2026-04-23 - UI Status: Glassmorphism Network Notifications
**Context**: Needed a way to show players the connection status (Connecting, Online, Error) without requiring them to check the console.  
**Decision**:  
1. Implement a **NetworkStatus** component in React using **framer-motion**.  
2. Use a **glassmorphism style** (blur, semi-transparent background) for a premium feel.  
3. Link the UI to the global **Zustand store** (`networkStatus` field).  
**Impact**: Players get instant visual feedback. Improved professional aesthetic for the game's HUD.  

---

### 2026-05-01 - Hybrid Physics Sync: Magnet + Local Prediction
**Context**: Remote player movement was laggy with pure interpolation, and physics interactions (hits) were rubber-banding due to "Magnet" pull-back.  
**Decision**:  
1. Use a **PD Controller (Magnet)** with stiff constants (k=300, d=20) to pull remote players toward their network target.  
2. Implement **Local Physics Prediction** for impacts: every client applies the hit impulse instantly to the remote player's body when an `impact` event is received.  
3. Disable the "Magnet" pull for **1.2s** during a hit to allow the natural physics flight to finish.  
**Impact**: Instant, snappy hits for observers. No rubber-banding during knockbacks. Hits look real-time for everyone.  
**Agent**: Antigravity (AI).

---

### 2026-05-01 - Network Heartbeat: Latency Visualization
**Context**: Needed to debug "ghost lag" and monitor server responsiveness.  
**Decision**:  
1. Implement a **Ping-Pong** system (Client sends `ping` -> Server responds with same timestamp -> Client measures RTT).  
2. Added a **LatencyGraph** UI component in the top-right HUD.  
**Impact**: Full transparency into network health. Confirmed stable round-trip times to Oracle instance.  
**Agent**: Antigravity (AI).

---

### 2026-05-01 - Tick-Based Update Ordering
**Context**: Packet jitter was causing remote players to "jump" backwards or jitter in place.  
**Decision**:  
1. Added a global `serverTick` counter on the server (increments at 30Hz).  
2. Every network update includes the current tick.  
**Impact**: Clients now have a reference for ordering packets, preventing jitter from late arrivals.  
**Agent**: Antigravity (AI).

---
