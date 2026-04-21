# 3D Asset Importing Rules

All 3D assets must adhere to these limits and guidelines so the game stays fast and memory-efficient in the browser.

## Characters (Skins)
- **Geometry**: Max **5,000 triangles**.
- **Materials**: 1 material per character if possible (use texture atlas). Non-glossy unless specifically needed.
- **Textures**: Max **512x512**. Must use KTX2 Basis Universal compression or optimized WebP.
- **Bone Rig**: Must precisely match the `CharacterBase` armature so animations can be shared.
- **Naming**: `skin_[name].glb` (e.g., `skin_avo.glb`).

## Weapons
- **Geometry**: Max **2,000 triangles**.
- **Materials**: 1 material.
- **Textures**: Max **512x512** (prefer 256x256 if detail isn't critical), compressed.
- **Naming**: `weapon_[name].glb` (e.g., `weapon_baguette.glb`).

## Animations
- Export via the automated Blender script (`mixamo_pipeline.py`).
- **Settings**: Baked at 50% sampling (Step 2 in script), Rest Position included, Y Up.
- **Structure**: We are using an **Animation Layering** approach. The base skeleton always plays full-body "run + hold melee" by default. If the character holds a gun, we overwrite *only* the arm bones with a gun-pose layer.

## Environment Objects (Obstacles/Boxes)
- **Geometry**: Keep extremely simple. If it's a box cube, just let Three.js generate it dynamically unless it has complex unique geometry.
- **Textures**: Procedural shaders preferred (like the cedar table) to avoid texture downloads.
- **Collider**: Simple primitive colliders (box, sphere, capsule). Avoid complex mesh colliders.

## Sanity Check Process
Before importing into the final project folder (`public/skins/` or `public/models/`), ensure the GLB file size is appropriate (characters under 1MB ideally).
