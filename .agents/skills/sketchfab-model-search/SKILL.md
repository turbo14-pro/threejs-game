---
name: sketchfab-model-search
description: Search and retrieve 3D models from Sketchfab via the mcp-threejs MCP server. Use when the user wants to find, browse, or download 3D models for their Three.js project.
---

# Sketchfab Model Search (mcp-threejs)

## What This Does

This skill connects to the **mcp-threejs** MCP server, which talks to Sketchfab's library of 3D models. It lets you:

1. **Search** for 3D models by name or description (e.g. "low poly car", "food items", "cartoon character")
2. **Get a direct download link** for a model's GLTF file so it can be loaded straight into Three.js

## MCP Server Details

- **Server name in config:** `threejsMCP`
- **Source:** Cloned to `u:/My Games/three.js/mcp-threejs/`
- **Runs via:** `python u:/My Games/three.js/mcp-threejs/src/mcp_server_threejs/server.py`
- **Transport:** stdio (standard MCP)

## Available Tools

### 1. `threejs_search_models`

Searches Sketchfab for downloadable 3D models matching a text query.

**When to use:** The user wants to find 3D models — characters, props, environments, vehicles, food, etc.

**Inputs:**
| Parameter | Type   | Required | Description                                    |
|-----------|--------|----------|------------------------------------------------|
| `query`   | string | Yes      | What to search for (e.g. "burger", "low poly tree") |
| `limit`   | int    | No       | Max results, 1–24. Defaults to 10              |

**What comes back:**
- A list of downloadable models, each with:
  - `uid` — unique ID (needed for getting download links)
  - `name` — model name
  - `description` — what the model is
  - `viewerUrl` — link to view on Sketchfab
  - `thumbnailUrl` — preview image
  - `user` — who made it
  - `formats` — available file types and sizes (glb, gltf, usdz, etc.)

**Example call:**
```
Tool: threejs_search_models
Input: { "query": "cartoon food", "limit": 5 }
```

### 2. `threejs_get_gltf_model_url`

Gets a direct web link to download a model's GLTF file. This link can be used directly in Three.js loaders without saving the file locally.

**When to use:** The user has picked a model from search results and wants to use it.

**Inputs:**
| Parameter  | Type   | Required | Description                              |
|------------|--------|----------|------------------------------------------|
| `model_id` | string | Yes      | The `uid` from a search result           |

**What comes back:**
- `model_name` — name of the model
- `model_id` — the ID you sent
- `gltf_url` — direct URL to the GLTF file

**Example call:**
```
Tool: threejs_get_gltf_model_url
Input: { "model_id": "abc123def456" }
```

> **Note:** This tool requires Sketchfab OAuth2 credentials to work. Without them, only searching is available. See the Authentication section below.

## Authentication (Sketchfab OAuth2)

Searching works without any login. But to get download links, you need Sketchfab OAuth2 credentials set as environment variables:

- `SKETCHFAB_ACCESS_TOKEN`
- `SKETCHFAB_REFRESH_TOKEN`
- `SKETCHFAB_CLIENT_ID`
- `SKETCHFAB_CLIENT_SECRET`

### How to get credentials:
1. Go to https://sketchfab.com/developers/apps
2. Register a new app
3. Set the redirect URI to a valid endpoint
4. Use the OAuth2 flow to get your tokens
5. Add them to the MCP config as environment variables:

```json
"threejsMCP": {
  "command": "python",
  "args": [
    "u:/My Games/three.js/mcp-threejs/src/mcp_server_threejs/server.py"
  ],
  "env": {
    "SKETCHFAB_ACCESS_TOKEN": "your_token_here",
    "SKETCHFAB_REFRESH_TOKEN": "your_refresh_token",
    "SKETCHFAB_CLIENT_ID": "your_client_id",
    "SKETCHFAB_CLIENT_SECRET": "your_client_secret"
  },
  "disabled": false
}
```

Alternatively, credentials can be stored in `~/.sketchfab_credentials.json` and the server will pick them up automatically.

## Typical Workflow

1. **User asks for a 3D model** → Use `threejs_search_models` with a good search term
2. **Show the results** → Present model names, thumbnails, and format info
3. **User picks one** → Use `threejs_get_gltf_model_url` with its `uid`
4. **Load into Three.js** → Use the returned URL with `GLTFLoader`:

```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load(gltfUrl, (gltf) => {
  scene.add(gltf.scene);
});
```

## Tips

- **Be specific in searches** — "low poly cartoon burger" finds better results than just "food"
- **Check formats** — Not all models have GLB/GLTF. The `formats` field tells you what's available
- **File sizes matter** — The `formats` field includes size in bytes. Pick smaller files for better load times
- **Licensing** — Always check the model's Sketchfab page (`viewerUrl`) for licensing terms before using in a project
- **Without OAuth tokens**, you can still search and browse, but you won't be able to get direct download links
