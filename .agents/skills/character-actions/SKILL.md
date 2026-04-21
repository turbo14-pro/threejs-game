# Skill: Character Actions

Automate the processing of Mixamo animations into game-ready GLTF files and register them in the project.

## Overview
This skill uses a Blender Python script to transfer Mixamo animations onto a custom character rig (`CharacterBase`) via a constraint-based `MixamoBase` intermediary. It then bakes the animation and exports it with optimized settings for Three.js.

## Directory Structure
- `scripts/mixamo_pipeline.py`: The core Blender automation script.
- `u:\My Games\three.js\src\models\mixamo.blend`: The base source file (must exist).
- `u:\My Games\three.js\public\skins\actions\`: Output directory for GLBs.

## Workflow

### 1. Project Sync (Adaptive Step)
Before processing any animation, you **MUST** inspect the project's current animation integration:
- Read `u:\My Games\three.js\public\skins\animations.json` to see current categories.
- Read `u:\My Games\three.js\src\components\Player\PlayerModel.jsx` to see how these animations are loaded.
- Determine if a new category is needed or if you should append to an existing one (e.g., "Melee", "Emotes").

### 2. Processing Animations

#### Single File
To process a single FBX:
```powershell
& "P:\Program Files\Blender 5.1\blender.exe" --background "u:\My Games\three.js\src\models\mixamo.blend" --python "u:\My Games\three.js\.agents\skills\character-actions\scripts\mixamo_pipeline.py" -- --fbx "PATH_TO_FBX" --output "u:\My Games\three.js\public\skins\actions\" --name "CUSTOM_NAME"
```

#### Batch Processing
To process all FBX files in a folder:
```powershell
Get-ChildItem "FOLDER_PATH\*.fbx" | ForEach-Object {
    & "P:\Program Files\Blender 5.1\blender.exe" --background "u:\My Games\three.js\src\models\mixamo.blend" --python "u:\My Games\three.js\.agents\skills\character-actions\scripts\mixamo_pipeline.py" -- --fbx $_.FullName --output "u:\My Games\three.js\public\skins\actions\"
}
```

### 3. Integration
After the GLTF is exported, update `u:\My Games\three.js\public\skins\animations.json`.

**Example Entry**:
```json
"Mixamo": {
  "victory": "victory.gltf",
  "defeat": "defeat.gltf"
}
```

- Ensure the key used in the JSON matches the intent (e.g., "dance", "victory").
- The file should point to the correct `.gltf` in `/public/skins/actions/`.
- **Note**: If you add a new category, ensure the `PlayerModel.jsx` or relevant controller is aware of it.

## Customization
- **Baking**: The script uses a `Step: 2` (50% sampling) to reduce file size.
- **Unique Names**: The script uses a hex suffix for internal Blender actions to prevent collisions, but the final exported filename and external action name will match the `--name` parameter.
