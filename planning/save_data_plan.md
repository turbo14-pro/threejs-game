# Save Data Plan

**Decision:** LocalStorage only (cloud saving comes in Phase 10).

---

## How It Works

1. **Zustand persist** saves a small slice of game state to the browser's LocalStorage automatically.
2. Every save includes a `saveVersion` number (currently `1`).
3. When we change what gets saved, we bump the version and write a `migrate` function that converts old saves into the new shape — so nobody loses their progress.

## What Gets Saved

| Field | Why |
|-------|-----|
| `player.username` | So the player doesn't have to type their name again |
| `player.unlockedSkins` | Tracks which skins the player has earned |
| `player.stats` | Kills, deaths, wins, games played |
| `player.achievements` | Hidden challenges the player has completed |
| `settings` | Bloom, FXAA, shadow quality, etc. |

## What Does NOT Get Saved

- Current health, match phase, countdown — these reset every game.
- Mobile input state — only needed while playing.
- Teleport count — only used for internal resets.

## Risks

- **Browser data cleared:** Player loses everything. We'll warn about this in the settings menu.
- **Save gets corrupted:** The `migrate` function will catch version mismatches. If migration fails, we fall back to defaults instead of crashing.

## Future (Phase 10)

- Add cloud backup using Supabase.
- Add an "Export Save" button so the player can download a `.json` file.
- Add an "Import Save" button to restore from a file.

---

**Status:** [DONE]
