# Risk List

Here are the biggest identified technical and procedural risks for Food Fight Frenzy.

### 1. Multiplayer Synchronization (Loading/Sync)
- **Risk**: Players cannot load into a game together or sync properly. The Geckos server might fail to establish a connection, or prediction smoothing might jitter significantly over poor connections.
- **Likelihood**: High
- **Impact**: Critical
- **Mitigation**: Start testing basic network sync in Phase 4. We will build a "Lag Debugger" to simulate and debug poor connections. Ensure world loading relies on authoritative triggers.

### 2. Physics Engine Overload
- **Risk**: Too many rigid bodies or complex collision shapes (mesh-based colliders) drop the frame rate heavily, especially on mobile devices.
- **Likelihood**: High
- **Impact**: Critical (Game unplayable)
- **Mitigation**: Use simple primitive colliders (Box, Sphere, Capsule, Cylinder) exclusively. Use object pooling so we recycle entities rather than creating new Rapier bodies.

### 3. Touch Control Clunkiness
- **Risk**: The mobile controls feel unresponsive or awkward compared to WASD/mouse.
- **Likelihood**: High
- **Impact**: Medium (Mobile player drop-off)
- **Mitigation**: Implement a robust virtual joystick with generous deadzones, a dedicated SLIDE button, and a walk toggle button. Test frequently on physical phones.

### 4. Animation Conflict/Breakage
- **Risk**: Adding new skins causes visual stretching or bone mismatches because skeletons differ slightly.
- **Likelihood**: Medium
- **Impact**: Medium
- **Mitigation**: Enforce the use of a single shared `CharacterBase` armature. Test every new skin in a test scene explicitly against walk, run, and jump animations.

### 5. Save Data Loss
- **Risk**: Browser clears LocalStorage, or a game update shape-changes the save format causing parsing errors.
- **Likelihood**: Medium
- **Impact**: High (Player frustration)
- **Mitigation**: Implement a `saveVersion` pattern. Write a `migrate` function inside `useGameStore` to safely transition old save formats. Phase 10 introduces cloud backups.

### 6. Bot AI "Getting Stuck"
- **Risk**: Bots get trapped in corners or stuck jumping against walls.
- **Likelihood**: High
- **Impact**: Low (Looks silly but game continues)
- **Mitigation**: Implement a "stuck detector" in the Bot AI loop. If position change over 2 seconds is negligible despite movement flags, force a jump and vector reverse.
