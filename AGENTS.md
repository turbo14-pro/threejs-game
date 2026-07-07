# AGENTS.md

## Project Overview
This project is a 3D multiplayer game. It uses **React** and **Three.js** (via **React Three Fiber**) for the visuals. It has a physics engine called **Rapier** to handle collisions and movement. The game also has a multiplayer part that uses **Geckos.io** to send data quickly between players and the server.

### Key Tools:
- **Three.js / React Three Fiber**: For drawing the 3D world.
- **Rapier**: For physics (gravity, bumping into things).
- **Zustand**: For keeping track of the game state (like player scores or settings).
- **Geckos.io**: For talking to the game server.
- **Vite**: For running the game quickly while coding.

---

## AI Agent Skills

This project is optimized for AI coding agents using a comprehensive skill system.
- **Master Orchestrator**: Use the `@antigravity-skill-orchestrator` skill as the primary entry point for complex tasks. It coordinates all other skills and tracks successful patterns using `@agent-memory-mcp`.
- **Project Skills**: These are core skills specific to this game:
    - **Logic**: `@character-actions`, `@game-engine`, `@multiplayer-game`, `@rapier-physics-worker`
    - **Visuals**: `@threejs-pro`, `@react-three-fiber`, `@threejs-shaders`, `@threejs-postprocessing`, `@threejs-animation`, `@threejs-interaction`, `@threejs-builder`, `@threejs-fundamentals`, `@threejs-geometry`, `@threejs-loaders`, `@threejs-lighting`, `@threejs-materials`, `@threejs-textures`, `@threejs-webgpu-rendering`
    - **Optimization**: `@game-performance-optimization`, `@react-performance`, `@react-patterns`, `@css-architecture`
    - **Tools**: `@folder-organization`, `@mobile-touch-controls`, `@sketchfab-model-search`, `@locchung-three-js-mcp`
- **Community Skills**: Thousands of additional skills are available in `.agents/skills/` for general development and infrastructure.

---

## Setup Commands

- **Install everything**: `npm install`
- **Run the game (Frontend)**: `npm run dev`
- **Run the game server (Backend)**: `npm run server`
- **Build the game for the web**: `npm run build`

---

## Development Workflow

To work on the game, you usually need both the game screen and the server running:
1. Open one terminal and run `npm run dev`. This starts the visual part of the game at `http://localhost:5173`.
2. Open a second terminal and run `npm run server`. This starts the multiplayer logic.
3. The game uses **hot-reloading**, so changes you make to the code will show up instantly in the browser.

---

## Testing Instructions

- **Run unit tests**: `npm run test` (Uses Vitest to check small pieces of code).
- **Run browser tests**: `npm run test:e2e` (Uses Playwright to check if the game works in a real browser).
- Tests are located in the `tests/` directory.

---

## Code Style and Rules

### File Organization:
- `src/components/`: Where the 3D items and UI pieces live.
- `src/store/`: Where the game's shared memory (Zustand) is kept.
- `src/hooks/`: Special React functions for reuse.
- `server/`: The code for the multiplayer server.

### Naming Things:
- Use **PascalCase** for React components (e.g., `PlayerController.jsx`).
- Use **camelCase** for functions and variables (e.g., `calculateSpeed`).
- Keep components small and focused on one job.

---

## Multiplayer and Physics

### How Multiplayer Works:
- The server (`server/index.js`) is the "boss." It keeps track of where everyone is.
- Players send their moves to the server using Geckos.io.
- The server tells everyone else about the new positions.

### How Physics Works:
- We use `@react-three/rapier`.
- Physics bodies should be kept simple (like boxes or capsules) to keep the game fast.
- Don't move physics objects by changing their position directly; use "impulses" or "forces" to push them.

---

## Deployment

- **Build**: `npm run build` creates a `dist/` folder with the final game files.
- **Deploy**: `npm run deploy` builds the game and then uploads it using the `deploy.cjs` script.

---

## Oracle Server Connection

Agents can connect to the Oracle server using the following information:

- **Server IP**: 192.9.188.215
- **Username**: ubuntu
- **SSH Key**: `u:\My Games\three.js\ssh-key-2026-04-22.key`
- **Local Development URL**: http://192.9.188.215
- **Production URL**: https://ff-server-9208.duckdns.org

Environment variables are stored in `.env`:
- `VITE_SERVER_URL_LOCAL` - Local development server URL
- `VITE_SERVER_URL_PRODUCTION` - Production server URL
- `IP_ADDRESS` - Server IP address
- `USERNAME` - SSH username

To connect via SSH:
```bash
ssh -i "u:\My Games\three.js\ssh-key-2026-04-22.key" ubuntu@192.9.188.215
```

Once connected, navigate to the project directory:
```bash
cd /home/ubuntu/three.js
```

To start the server:
```bash
node server/index.js
```

To run the frontend:
```bash
npm run dev
```

---

## Testing Instructions

## Troubleshooting

- **Server Connection**: If the game doesn't connect, make sure you ran `npm run server`.
- **Physics Glitches**: If objects fall through the floor, check that the floor has a `<RigidBody type="fixed">`.
- **Performance**: Use the "Performance" settings in the game UI to turn off heavy effects like shadows or bloom if the game is slow.
