# Decision: CPU-Controlled Bots (AI Opponents)

## What & Why
Add CPU-controlled bot players as competitive AI opponents to the multiplayer arena game. Bots use adaptive difficulty and appear visible in lobby with names.

## Who
Players seeking competitive matches when human players are unavailable; training users.

## Constraints
- Must integrate with existing React Three Fiber / Rapier physics
- Must not break multiplayer (Geckos.io) server sync
- Adaptive difficulty must respond to player performance in real time

## Non-Goals
- Building a full ML training pipeline (use rule-based + heuristic adaptive)
- Replacing human multiplayer (bots supplement, not replace)
- Changing core physics engine

## Assumptions
- Existing PlayerController / RemotePlayer architecture can be reused for bot logic
- Lobby UI (MainMenu / HUD) supports bot name display
- Adaptive difficulty can be computed from score/position delta per round

## Decision Log
| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 1 | Competitive AI opponents | Practice dummies / co-op | User selected competitive |
| 2 | Adaptive difficulty | Fixed / player-selected | User selected adaptive |
| 3 | Visible in lobby with names | Invisible / toggle | User selected visible |
| 4 | Rule-based + heuristic adaptive | Full ML / static | Technical recommendation; avoids ML infra |

## Approaches Considered
### Recommended: Reuse PlayerController with BotAI wrapper
- BotAI computes inputs (movement, jump, actions) and feeds them into existing PlayerController
- Adaptive difficulty adjusts bot reaction speed / aggression based on player score gap
- Lobby shows bot names via existing UI components

### Alternative: Separate BotEntity with custom physics
- Trade-off: More isolated but duplicates physics logic; not recommended
