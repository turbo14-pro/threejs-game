# Audio Assets

## Running Footsteps (`running.ogg`)
- **Type**: Loop (4-step cycle)
- **Usage**: Positional audio attached to player
- **Trigger**: When player is moving (`isMoving` / `isWalking`)
- **Architecture**: `soundManager.playPositional('running', playerRef, 0.6, 3, true)`

## Planned Sounds
- `footstep.mp3` — single step (non-loop)
- `jump.mp3` — jump launch
- `land.mp3` — landing impact
- `hit.mp3` — knockback / damage
- `splat.mp3` — splash / fall
