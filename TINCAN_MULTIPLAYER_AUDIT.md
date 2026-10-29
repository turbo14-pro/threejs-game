# TinCan Multiplayer Obstacle — Requirements Audit

## Executive Summary

The `TinCan` obstacle in `src/components/World/Obsticles/TinCan.jsx` is currently a **purely client-side, locally-simulated physics object**. To make it a shared multiplayer interactive obstacle managed by the authoritative server (following the gold standard used for bots and remote players), it must be migrated to the server physics worker, broadcast via snapshots, and rendered from shared game state on clients.

---

## 1. Current State Analysis

### 1.1 TinCan.jsx — Two Components

| Component | Role | Current Behavior |
|-----------|------|-----------------|
| `TinCan` (visual) | Renders cylinder mesh with label texture, metal caps | Purely visual, no physics |
| `TinCanPhysics` | Dynamic Rapier RigidBody + CylinderCollider | Local physics only, no server sync |

### 1.2 Current TinCanPhysics Behavior

- Spawns at `position` passed from Arena (y=30, falls onto table)
- Dynamic RigidBody, mass=1, linearDamping=0.2
- Local sound on ground impact (`metal-ground`)
- Local collision response: pushes can when player slides into it
- Respawns to y=30 if falls below y=-100
- Reads `other.userData.isSliding` from colliding player body
- **No network ID, no server authority, no snapshot broadcast**

### 1.3 How TinCans Are Spawned (Arena.jsx)

```jsx
const tinCans = useMemo(() => {
  // 20 cans, seed 43, deterministic positions at y=30
  // Each: { id, position: [x, 30, z], rotation, color }
}, []);

{tinCans.map((can) => (
  <TinCanPhysics key={`tin-${can.id}`} position={can.position} rotation={can.rotation} color={can.color} />
))}
```

Each client independently spawns and simulates its own cans → **divergent state across clients**.

---

## 2. Gold Standard Reference: Bots & Remote Players

The existing multiplayer architecture (the "gold standard") works as follows:

### 2.1 Server Side (`server/physics-worker.mjs` + `server/ws-server.js`)

- **Physics worker** runs Rapier at 30Hz in a Web Worker thread
- **Players** (human + bots) are dynamic RigidBodies created via `addPlayer` / `addBot` messages
- **Inputs** are sent from clients to server, validated by sequence ID, applied in the simulation loop
- **Snapshots** are broadcast at 30Hz containing per-entity: `id`, `pos`, `vel`, `rot`, `skin`, `anim`, `tick`, `lastProcessedSeq`, `groundY`
- **Obstacles** (cereal boxes) are static fixed bodies on the server, used for ground checks but NOT broadcast in snapshots
- **Interest radius culling** (200m) and **change detection** (state hash) reduce bandwidth

### 2.2 Client Side (`src/hooks/useNetworking.js` + `src/store/useGameStore.js`)

- Client connects via WebSocket, receives `playerId` on welcome
- Receives snapshots with `{ p: [...], t: serverTick }`
- `updateRemotePlayers(players)` writes to `useGameStore` → `remotePlayers` map
- Local player inputs sent via `sendUpdate({ type: 'input', ... })`
- Remote players rendered by reading `remotePlayers` from store

### 2.3 Snapshot Entry Shape (per entity)

```js
{
  id: string,           // entity ID
  pos: [x, y, z],       // position
  vel: [x, y, z],       // linear velocity
  rot: number,          // yaw rotation
  skin: string,         // visual skin
  anim: object,         // animation state
  tick: number,         // server tick
  lastProcessedSeq: number, // last input sequence processed
  groundY: number,      // ground surface Y (-1 if airborne)
}
```

---

## 3. Requirements for Shared Multiplayer TinCan

### 3.1 Server-Side Requirements

#### 3.1.1 Physics Worker — TinCan Entity Management

The physics worker (`server/physics-worker.mjs`) must:

1. **Create TinCan physics bodies** on `addTinCan` message:
   - Dynamic RigidBody (not fixed — cans move, roll, get pushed)
   - CylinderCollider matching visual dimensions (radius ~4, halfHeight ~5)
   - Mass, damping matching client visual expectations
   - Stored in a `tinCans` Map keyed by `tinCanId`
   - Initial position from spawn data (y=30, falls onto table)

2. **Simulate TinCans in the 30Hz loop**:
   - Step physics for all tin can bodies
   - Apply gravity, collisions with floor, players, other cans
   - Handle respawn: if a can falls below y=-100, reset to spawn position with zero velocity

3. **Broadcast TinCan state in snapshots**:
   - Add `obstacles` (or `tinCans`) array to the snapshot message
   - Per-can entry: `id`, `pos`, `vel`, `rot`, `isGrounded`, `spawnPos`
   - `isGrounded` computed via `isGrounded()` from `baseGame.js` (check floor + obstacle surfaces)

#### 3.1.2 WebSocket Server — TinCan Message Handling

`server/ws-server.js` must:

1. **Handle `addTinCan` messages** (or initialize at startup from deterministic seed)
2. **Forward TinCan state** in snapshot broadcast to all clients within interest radius
3. **Handle collision impulses** from clients (or handle entirely server-side)

#### 3.1.3 Obstacle Ground Check Integration

TinCans must be added to the server's `obstacles` array (or a separate list) so that:
- `isGrounded(pos, obstacles)` returns true when a player stands on a tin can
- `getGroundY(pos, obstacles)` returns the can's top surface Y
- This matches the existing pattern where cereal boxes are obstacles for ground checks

---

### 3.2 Client-Side Requirements

#### 3.2.1 Game Store — TinCan State

`src/store/useGameStore.js` must add:

```js
tinCans: {}, // { id: { pos, rot, vel, isGrounded, color, spawnPos } }
```

With actions:
- `setTinCans(list)` — replace the full tin can state from snapshot
- `updateTinCan(id, state)` — merge/update a single can's state
- `removeTinCan(id)` — remove a can (if destroyed/removed)

#### 3.2.2 Networking Hook — TinCan Snapshot Handling

`src/hooks/useNetworking.js` must:

1. Receive snapshot with `o: obstacles` (or `t: tinCans`) field
2. Call `setTinCans(data.tinCans)` or equivalent to update shared state
3. Apply interest-radius culling (only send cans within 200m of viewer)

#### 3.2.3 Client Rendering — Read-Only from Shared State

`TinCanPhysics` must be refactored to:

1. **NOT create its own local Rapier body** — instead, read position/rotation from `useGameStore` state
2. **Be a visual-only component** that mirrors server-authoritative state
3. Use `useFrame` to interpolate between snapshot positions (smooth remote interpolation)
4. Receive `tinCanId` prop to look up its state in the store

#### 3.2.4 Collision Handling — Server-Authoritative

- Player → TinCan collisions: detected on server physics worker, impulse applied server-side
- Client sends "I hit a tin can" intent; server validates and applies force
- OR: server handles all collision response internally (players and cans are all in the same Rapier world)
- Client plays local sound effects on collision (predictive, but server state wins)

---

### 3.3 Shared State Schema

#### 3.3.1 TinCan Snapshot Entry (server → client)

```js
{
  id: string,           // e.g. "tin-0", "tin-1", ...
  pos: [x, y, z],       // server-authoritative position
  vel: [x, y, z],       // linear velocity
  rot: [x, y, z],       // Euler rotation (or yaw only)
  isGrounded: boolean,  // whether can is resting on a surface
  color: string,        // side color (deterministic from seed)
  spawnPos: [x, y, z],  // respawn position
}
```

#### 3.3.2 Game Store TinCan State

```js
tinCans: {
  "tin-0": { pos: [x,y,z], rot: [x,y,z], vel: [x,y,z], isGrounded: true, color: "#9933ff", spawnPos: [x,30,z] },
  ...
}
```

---

## 4. Files Requiring Changes

| File | Changes Needed |
|------|---------------|
| `server/physics-worker.mjs` | Add `tinCans` Map, `addTinCan` handler, simulate cans in loop, include in snapshot, respawn logic, add to obstacles for ground checks |
| `server/ws-server.js` | Handle `addTinCan` messages, include tin cans in snapshot broadcast, apply interest radius culling |
| `src/store/useGameStore.js` | Add `tinCans` state + `setTinCans` / `updateTinCan` / `removeTinCan` actions |
| `src/hooks/useNetworking.js` | Parse tin can data from snapshots, dispatch to store |
| `src/components/World/Obsticles/TinCan.jsx` | Refactor `TinCanPhysics` to read from store instead of creating local physics body; keep `TinCan` visual as-is |
| `src/components/World/Arena.jsx` | Send `addTinCan` to server (or rely on deterministic server-side spawn); render from shared state |

---

## 5. Detailed Implementation Plan

### Phase 1: Server Physics Worker

1. Add `tinCans = new Map()` to track can bodies
2. Add `addTinCan` message handler: create dynamic RigidBody + CylinderCollider, store in map
3. Add `setTinCans` message handler: initialize all cans at startup (deterministic seed 43)
4. In `simulate()` loop:
   - Step physics for all tin can bodies
   - Check respawn (y < -100 → reset to spawnPos, zero velocity)
   - Compute `isGrounded` using `isGrounded(pos, obstacles)` 
5. Include `tinCans` array in snapshot `parentPort.postMessage()`

### Phase 2: WebSocket Server

1. On startup, send `setTinCans` to worker with deterministic can positions (seed 43, matching Arena.jsx)
2. In snapshot broadcast, include `o: tinCanList` (or merge into existing obstacles)
3. Apply interest-radius culling for tin cans (same 200m radius as players)

### Phase 3: Client Store

1. Add `tinCans: {}` to initial state
2. Add `setTinCans(list)` action
3. Add `updateTinCan(id, state)` action

### Phase 4: Client Networking

1. In `ws.onmessage` snapshot handler, extract `data.o` (or `data.tinCans`)
2. Call `setTinCans()` with the list

### Phase 5: Client Component Refactor

1. `TinCanPhysics` → read position/rotation from `useGameStore(state => state.tinCans[id])`
2. Remove local `RigidBody` / `CylinderCollider` creation
3. Add `useFrame` interpolation for smooth remote movement
4. Keep local sound effects (triggered by state changes: velocity changes, grounded transitions)
5. `TinCan` visual component stays unchanged (pure visual)

### Phase 6: Arena.jsx

1. Remove local `TinCanPhysics` instantiation (or keep as thin wrapper that reads from store)
2. Ensure deterministic spawn positions match server seed (43)

---

## 6. Key Design Decisions

### 6.1 Server Authority

The server is authoritative for TinCan position, velocity, and rotation. Clients are **dumb mirrors** that interpolate server state. This prevents cheating and ensures all players see the same can positions.

### 6.2 Deterministic Spawning

TinCan spawn positions use the same seeded random (seed 43) as Arena.jsx. The server initializes cans at startup with these positions. Clients don't need to know spawn positions — they receive them from the server.

### 6.3 Collision Response

Since players and tin cans are all in the same Rapier world on the server, collisions are handled natively by the physics engine. The server applies impulses automatically. Clients only need to play local sound effects.

### 6.4 isGrounded for TinCans

TinCans need `isGrounded` in their snapshot so clients know whether to play landing sounds or show the can as "resting" vs "falling". Computed via `isGrounded(pos, obstacles)` on the server.

---

## 7. Risks & Considerations

| Risk | Mitigation |
|------|-----------|
| **State divergence** — clients simulating cans locally will diverge from server | Remove all local physics from `TinCanPhysics`; make it read-only from store |
| **Interpolation jitter** — 30Hz snapshots may look choppy | Add linear interpolation in `useFrame` between last and current snapshot positions |
| **Sound desync** — clients may play sounds at different times | Play sounds locally on state transition (grounded→not grounded, velocity spikes) — acceptable for FX |
| **Respawn timing** — server respawns at different time than client expects | Server sends respawn event in snapshot; client resets can position when it sees `pos` jump to spawnPos |
| **Collision with player not felt locally** — client applies impulse locally but server may disagree | Let server handle all physics; client only renders. Local prediction optional for responsiveness |

---

## 8. Testing Requirements

1. **Server unit test**: Verify `addTinCan` creates a body in the worker
2. **Server unit test**: Verify tin cans appear in snapshot output
3. **Server unit test**: Verify `isGrounded` returns true when player is on top of a tin can
4. **Client unit test**: Verify `setTinCans` updates store correctly
5. **Integration test**: Verify client renders can at server-provided position
6. **E2E test**: Verify two clients see the same can position after a collision

---

## 9. Summary

To make TinCan a shared multiplayer interactive obstacle:

1. **Move physics to server** — `TinCanPhysics` should not create a local Rapier body
2. **Server simulates cans** — in the physics worker at 30Hz
3. **Broadcast state** — include tin can pos/vel/rot/isGrounded in snapshots
4. **Client reads from store** — `useGameStore.tinCans` is the single source of truth
5. **Server-authoritative collisions** — server Rapier world handles all can-player interactions

This follows the exact same pattern used for bots and remote players, ensuring consistency across the multiplayer architecture.
