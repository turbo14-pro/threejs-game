# Architecture Notes

> The list of what's in the stack and why. Update this file when you add or swap a tool.

---

## Rendering

| Tool | Purpose | Notes |
|------|---------|-------|
| Three.js | 3D engine | Core renderer |
| React Three Fiber (R3F) | React wrapper for Three.js | All scene components are React components |
| @react-three/drei | Helper library | Camera controls, input helpers, loaders |
| @react-three/postprocessing | Post-processing | Bloom, anti-aliasing, colour grading |

## Physics

| Tool | Purpose | Notes |
|------|---------|-------|
| Rapier (via @react-three/rapier) | Physics engine | WASM-based. Rigid bodies, collisions, character controllers |

## State Management

| Tool | Purpose | Notes |
|------|---------|-------|
| Zustand | Game state | Stores for player data, game rules, UI state |

## Build & Dev

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite | Build tool + dev server | Fast HMR, ES modules |
| Vitest | Test runner | Config at `vitest.config.js` |
| Playwright | Browser testing | Config at `playwright.config.js` |

## Hosting & Deploy

| Tool | Purpose | Notes |
|------|---------|-------|
| InfinityFree.me | Static hosting | Free tier. Deploy via `deploy.cjs` |

## 3D Pipeline

| Tool | Purpose | Notes |
|------|---------|-------|
| Blender | 3D modelling + animation | Connected via Blender MCP |
| Mixamo | Animation library | FBX imports retargeted in Blender |

## AI Tooling

| Tool | Purpose | Notes |
|------|---------|-------|
| Blender MCP | Control Blender from AI | Scene inspection, code execution |
| Three.js MCP | Inspect Three.js scenes | WebSocket connection to running dev server |
| Sketchfab MCP | Search 3D models | API key in `.env` |

## Multiplayer (Planned)

| Tool | Purpose | Notes |
|------|---------|-------|
| Geckos.io | WebRTC networking | Not yet installed. Planned for Phase 4 |

---

## Key Folders

| Path | What's In It |
|------|-------------|
| `src/` | All game source code |
| `src/components/` | React/R3F components |
| `src/components/Materials/` | Shader and material components |
| `public/` | Static assets (models, textures, sounds) |
| `planning/` | Roadmap and phase detail docs |
| `dist/` | Production build output |
| `.agents/skills/` | AI skill definitions |

---

## Related

- [[decisions_log]]
- [[state_of_play]]
