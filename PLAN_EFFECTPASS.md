# Plan: Optimum Performance Postprocessing Setup with EffectPass

## Goal
Refactor `src/components/World/Effects.jsx` to use `@react-three/postprocessing`'s `EffectPass` instead of the current `EffectComposer` pass-chaining approach, reducing fullscreen render operations per the library manual.

## Current State (baseline)
- `Effects.jsx` uses `EffectComposer disableNormalPass multisampling={0} frameBufferType={HalfFloatType}` with sequential passes: FXAA → N8AO → Shockwave×3 → RippleDisplacement → Bloom → Vignette → Noise → SMAA → ToneMapping.
- `RadialBlurEffect.jsx` is now gated into the composer behind `dashBlur` but never actually added to the EffectComposer (it is rendered as a `<primitive>` scene object, not a postprocessing pass).
- Renderer clearing is handled inside the composer.

## Target State
- Replace `EffectComposer` with `EffectPass`.
- `EffectPass` takes `(scene, camera, ...effects)` and merges fullscreen operations into minimal render calls.
- Keep all effects gated by store settings (`settings.bloom`, `settings.vignette`, `settings.grain`, `settings.antialiasing`, `settings.ssao`, `dashBlur`).
- Keep RadialBlurEffect as a real postprocessing pass inside the EffectPass effect list (gated by `dashBlur`).
- Preserve hardcoded ShockWave values (per user testing preference).

## Files to modify
1. `src/components/World/Effects.jsx` — main refactor.
2. `src/components/World/Effects/RadialBlurEffect.jsx` — ensure it exports a proper `Effect` instance usable by `EffectPass` (already an `Effect` subclass; needs to be conditionally included in the effects array).
3. `src/components/World/Effects/ShockwaveEffect.jsx` — no change required (hardcoded values kept).
4. `PostEffectsActivator.jsx` — already deleted; confirm no references remain.

## Step-by-step implementation

### Step 1: Audit EffectPass API compatibility
- Confirm `@react-three/postprocessing` v3 exports `EffectPass`.
- `EffectPass` signature: `<EffectPass scene={scene} camera={camera}>{effects...}</EffectPass>` or imperative `new EffectPass(scene, camera, ...effects)`.
- In R3F declarative usage, `scene` and `camera` are available from `useThree()`.
- `EffectPass` renders the scene itself, so the children of `EffectPass` should be only the effects, NOT the scene content. The scene content is rendered by EffectPass internally.
- **Critical**: All scene geometry must be OUTSIDE `EffectPass`. `Effects.jsx` currently returns `<EffectComposer>` wrapping effects only — this pattern is compatible if `EffectPass` is used the same way (effects as children), but we must ensure `scene`/`camera` props are passed.

### Step 2: Refactor Effects.jsx to use EffectPass
- Import `EffectPass` from `@react-three/postprocessing` alongside existing imports.
- Get `{scene, camera}` from `useThree()`.
- Replace `<EffectComposer ...>` with `<EffectPass scene={scene} camera={camera}>`.
- Keep the same effect children in the same order, conditionally rendered by settings.
- Remove `renderer.autoClear` / `setClearColor` mutation (already done in prior edits).
- Keep `camera.layers.enableAll()` layout effect.
- Keep `RippleDebugProjector` and `RippleDisplacementEffect` as-is.
- Add `RadialBlurEffect` to the effect list gated by `dashBlur` (already done; just ensure it's inside EffectPass children).

### Step 3: Verify RadialBlurEffect works as an EffectPass child
- `RadialBlurEffect` returns `<primitive object={effect} />` where `effect` is a `postprocessing.Effect` subclass.
- `@react-three/postprocessing` effects like `Bloom`, `Vignette` are also Effect subclasses wrapped for R3F.
- `RadialBlurEffect` uses `forwardRef` and returns `<primitive object={effect} />` — compatible with being a child of `EffectPass`.
- Confirm `texture` (not `texture2D`) is used in the shader (already done).

### Step 4: Handle clearing / buffer reset
- With `EffectComposer` removed, `renderer.autoClear` defaults to `true`. `EffectPass` manages its own render target clearing internally.
- Remove any manual clear logic (already removed).
- If depth/reset between passes is needed, rely on `EffectPass` internal handling.

### Step 5: Lint and typecheck
- Run `npx eslint src/components/World/Effects.jsx src/components/World/Effects/RadialBlurEffect.jsx`.
- Run `npm run build` or `npm run dev` to confirm no runtime errors.

### Step 6: Verify visual parity
- Confirm bloom, vignette, grain, SSAO, FXAA/SMAA, shockwaves, ripple, and radial blur still appear as before.
- Confirm `dashBlur` gating enables/disables RadialBlur.

## Rollback / risk notes
- `EffectPass` merges passes; some effects that depend on previous pass output ordering (e.g., ToneMapping must be last) must remain last in the effects array.
- `FXAA` comment says "MUST BE FIRST" — keep FXAA first in the effects array.
- `HalfFloatType` framebuffer type — `EffectPass` may handle render target creation internally; verify `multisampling`/`frameBufferType` equivalents if needed (EffectPass constructor accepts parameters).
