# Project Rules — Food Fight Frenzy

> The AI assistant MUST read this file before making any code changes.

---

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| React components | `PascalCase.jsx` | `PlayerController.jsx` |
| Utility/helper files | `camelCase.js` | `Logger.js`, `math.js` |
| Store files | `use[Name]Store.js` | `useGameStore.js` |
| Test files (unit) | `[name].test.js` | `math.test.js` |
| Test files (browser) | `[name].spec.js` | `visual.spec.js` |
| CSS files | `camelCase.css` or matching component | `styles/main.css` |
| 3D skin models | `skin_[name].glb` | `skin_avo.glb` |
| 3D weapon models | `weapon_[name].glb` | `weapon_baguette.glb` |
| Textures | `[type]_[name].[ext]` | `diffuse_wood.png` |
| Sound effects | `[action]_[name].mp3` | `hit_splat.mp3` |
| Planning docs | `snake_case.md` | `save_data_plan.md` |

## Folder Rules

| Folder | What goes here |
|--------|---------------|
| `src/components/` | React and R3F components, grouped by feature |
| `src/components/Player/` | Character controller, model, animations |
| `src/components/World/` | Arena, environment, obstacles |
| `src/components/UI/` | Menus, HUD, overlays |
| `src/components/Materials/` | Shared material and shader components |
| `src/store/` | Zustand stores |
| `src/data/` | Static data (registries, configs) |
| `src/utils/` | Helper functions (Logger, math, etc.) |
| `src/shaders/` | GLSL shader files |
| `src/models/` | Model-related code (loaders, processors) |
| `public/skins/` | Character `.glb` files |
| `public/models/` | Non-character 3D models |
| `public/textures/` | Image textures |
| `public/audio/` | Sound effects and music |
| `public/skybox/` | Skybox textures |
| `planning/` | Roadmap, phase details, rules |

## Code Style

1. **Variables and functions:** `camelCase` — `playerHealth`, `getDamage()`
2. **Constants:** `UPPER_SNAKE_CASE` — `MAX_HEALTH`, `SKINS`
3. **React components:** `PascalCase` — `PlayerModel`, `GameCanvas`
4. **CSS classes:** `kebab-case` — `game-hud`, `menu-button`
5. **No magic numbers:** Use named constants instead of bare numbers in code.
6. **Comments:** Write short comments explaining *why*, not *what*.

## 3D Asset Rules

| Rule | Value |
|------|-------|
| Max triangles (skin) | 5,000 |
| Max triangles (weapon) | 2,000 |
| Max texture size | 512 × 512 |
| Texture format | Compressed (KTX2 Basis Universal preferred) |
| Model format | `.glb` (binary GLTF) |
| Bone structure | Must match `CharacterBase` armature |
| Animation export | From Blender pipeline, Step 2 bake, +Y Up |

## Git Rules

1. **Commit messages:** Follow conventional commits — `feat:`, `fix:`, `chore:`, `docs:`
2. **Tag format:** `v[phase].[stage]-[label]` — `v0.0.0-foundation`
3. **No large binary files** in git. Models go in `public/` which is gitignored if too large.
