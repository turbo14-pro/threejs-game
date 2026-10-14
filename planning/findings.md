# Findings: CPU-Controlled Bots

## Project State
- React + Three.js (React Three Fiber) + Rapier physics
- Multiplayer via Geckos.io; server in `server/index.js`
- Player components: `PlayerController.jsx`, `PlayerModel.jsx`, `RemotePlayer.jsx`, `RemotePlayers.jsx`
- Lobby UI: `MainMenu.jsx`, `HUD.jsx`
- Store: `useGameStore.js`

## Technical Recommendation (recommended solution)
- Reuse `PlayerController` architecture; wrap with `BotAI` input generator
- Adaptive difficulty via heuristic (score gap, reaction time) — avoids ML infra
- Lobby visibility via existing UI components

---

## Verified During Execution

### The key integration seam (makes the plan's "reuse PlayerController" work)
`PlayerController.jsx` lines 412–418 already merge store `mobileInput` into its keyboard input:
```js
moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (mobileInput.x || 0);
moveZ = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0) - (mobileInput.y || 0);
walkingInput = !!(keys.walk || mobileInput.walk);
jumpingInput = !!(keys.jump || mobileInput.jump);
slidingInput = !!(keys.slide || mobileInput.slide);
dashInput    = !!(keys.dash || mobileInput.dash);
```
→ The brain only has to emit `{ x, y, jump, sprint, slide, dash }`, and **PlayerController needs no changes**.

### Why the runtime host is not a second PlayerController
- `PlayerController` is a singleton bound to the camera (`useThree`), pointer lock, and *local* player store state (`player.health`, `selectedSkin`, `debugRipple`, ...). A second instance would fight over all three.
- `RemotePlayer` (kinematic `setNextKinematicTranslation`) is the established pattern for "a character the local player does not control", so `BotPlayer` mirrors it.

### Coordinate convention (verified, not assumed)
- `PlayerController` turns a body-local direction into world space with:
  `direction.applyAxisAngle(Y, rotationY.current)` → `x' = x·cos + z·sin`, `z' = -x·sin + z·cos`
- `steerTowards` applies the exact inverse, so its output is body-local. The bot runtime passes `rotationY: 0`, where the inverse is identity and the result is simply world-space steering.
- Facing matches `targetRotationY.current = Math.atan2(direction.x, direction.z)` (line 746).

### Physics numbers taken from the codebase (not guessed)
| Value | Source |
|-------|--------|
| Gravity `-90.81` | `GameCanvas.jsx` `<Physics gravity={[0, -90.81, 0]}>` |
| Jump impulse `38` | `PlayerController.jsx` single-jump `setLinvel({ y: 38 })` |
| Ground filter `0x00010001` | `PlayerController.jsx` ground `castShape` filter |
| Ground probe radius `0.3` / distance `2.6` | `PlayerController.jsx` `rapier.Ball(0.3)` glue sensor |
| Lobby spawn `[0, 103, 0]` | `PlayerController.jsx` respawn + `useNetworking.js` initial emit |
| Arena table surface `y ≈ 0` | `Arena.jsx` `<RigidBody type="fixed" position={[0,-1,0]} colliders="cuboid">` with a `600×2×600` box → top at −1 + 1 = 0 |
| Speed range walk `8` … sprint `30` | `PlayerController.jsx` (`walkingInput ? 8 : 30`) — bots cruise at 11/22 |

### Store hazards discovered
- `game.remotePlayers: []` (line 39) coexists with a top-level `remotePlayers: {}` (line 74). `useNetworking`/`RemotePlayers` use the top-level object; the array is vestigial.
- `updateRemotePlayers` **replaces the whole map** (line 211: `set({ remotePlayers })`) on every 20 Hz server tick. Anything added to `remotePlayers` would be deleted each tick → bots live in their own `bots` slice. (plan.md D4)

### Project decision already on record
`.memory/decisions_log.md` → *2026-04-10 · Bot AI: **Flee at 25% Health***: bots should enter Flee Mode below 25% health and run away to regenerate. `BotAI` implements it via `healthRatio < FLEE_HEALTH` (0.25); bots currently have no damage source, so the branch is inert until combat exists.

### Test/tooling constraints
- `vitest.config.js` excludes `**/tests/**`, so unit tests must be colocated under `src/`.
- No Jest, no `@testing-library/react` in `package.json` → component render tests are not available; pure-logic tests are the repo convention.
- Playwright's browsers were **not installed**; `npx playwright install chromium` is required before `npm run test:e2e` works.
- `tests/visual.spec.js` is stale (asserts a title that no longer exists) and fails independently of this work.
- Headless Chromium cannot acquire pointer lock → the HUD pause menu (and therefore any in-game UI assertion) is unreachable in e2e.

### UI finding
Adding the roster pushed `.menu-content` past a 720p viewport. `.menu-overlay` used `align-items: center` with no scroll, which clipped the overflow and swallowed clicks. Fixed with `overflow-y: auto` on the overlay + `margin: auto` on `.menu-content` (keeps centering, still scrollable).
