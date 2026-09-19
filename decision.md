# Decision: Power-Up Coin Tokens

## What & Why
Implement a power-up system where players can collect coins of different rarities (Bronze, Silver, Gold, Diamond) across four categories (Jump, Speed, Dash, Slide) to gain temporary abilities. This enhances gameplay depth and provides rewarding progression.

## Who
Players of the 3D multiplayer game seeking varied power-up mechanics and strategic depth.

## Constraints
- Maximum 5 coins active on the map simultaneously
- Coins spawn at y=67 height on platform surfaces
- Each coin type has specific duration and effect values
- Power-up effects are client-side authoritative (no network sync required for active effects)
- Single active power-up slot (collecting a new coin replaces current effect)

## Non-Goals
- Network synchronization of active power-up states between players
- Persistent power-up storage across game sessions
- Complex power-up stacking or combination effects
- Visual effects beyond basic coin rotation and color

## Assumptions
- Existing WeaponPodium pattern can be adapted for coin sensors ⚠️
- Platform dropPoints are accessible from Arena component ⚠️
- PlayerController can be modified to handle power-up state changes ⚠️
- useGameStore can be extended with power-up state management ⚠️

## Decision Log
| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 1 | Implement 16 coin types (4 categories × 4 rarities) | Fewer categories/rarities | Provides meaningful progression and variety while keeping system manageable |
| 2 | Use sensor-based collision (like WeaponPodium) | Trigger volumes, raycasting | Matches existing patterns, reliable for pickup detection |
| 3 | Store active power-up in useGameStore with timer | Redux, context API, component state | Consistent with existing state management approach |
| 4 | Spawn coins at y=67 with random category/rarity | Fixed spawn points, predetermined sequences | Creates dynamic gameplay and unpredictability |
| 5 | Effects last 120-180 seconds (scaled 15x from original) | Original durations, different scaling | Provides meaningful duration for strategic use without being overpowered |

## Approaches Considered
### Recommended: Sensor-based coins with store-managed effects
This approach leverages existing patterns (WeaponPodium), centralizes state in useGameStore, and provides clear separation between coin collection and effect application.

### Alternative: Entity-component system for power-ups
Would require significant architectural changes to integrate with existing Three.js/Rapier setup, increasing complexity without clear benefits for this feature set.