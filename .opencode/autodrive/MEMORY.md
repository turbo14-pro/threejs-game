# OpenCode Auto-Drive — Project Memory & Anti-Pattern Vault

> Persistent cross-session memory automatically curated by OpenCode Auto-Drive.
> Add permanent architecture rules in Section 1; Sections 2 & 3 update automatically.

## 1. Project Stack & Permanent Rules
- **Detected Stack**: React, Vite, Three.js 3D, Node HTTP Backend (ESM)
- **Available npm Scripts**: `dev`, `build`, `preview`, `test`, `test:e2e`, `lint`, `deploy`, `server`
- **Craftsmanship Rule**: Never leave `TODO` comments, mock placeholders, or dead UI buttons; wire every feature end-to-end.

## 2. Verified Architectural Decisions
- **[Tier 1 · 2026-11-16]** RESOLVED: `useNetworking.js` now consumes the central `envConfig.js` (`getServerConfig`/`deriveWsUrl`) via try/catch — inline regex URL-munging and hardcoded `:9208` removed. Verified: lint 0 errors, 342/342 tests pass, vite build green. - Legacy junk in src: `main_bak.js`, `debugSound.js` - Tests exist for utils; build/lint/test scripts all presentNow launching Phase 1 implementation: [files: src/images/diagrams.af~lock~]
- **[Tier 1 · 2026-11-16]** Root cause of stale AUDIT critique: `deriveWsUrl` in `src/config/envConfig.js` was verified complete (the earlier "incomplete function" audit entry was false). The real regression was the duplicate inline URL derivation in `useNetworking.js`, which has been rewired to the central config module.
- **[Tier 1 · 2026-11-16]** - Root-caused the Peer Auditor critique — `deriveWsUrl` in `src/config/envConfig.js` was verified **complete and valid** (the audit entry was stale/false). The real regression was that `useNetworking.js` duplicated the U [files: src/components/UI/Options.jsx, src/hooks/useNetworking.js, src/hooks/useNetworking.test.js]
- **[Tier 1 · 2026-11-16]** **Announcing: Using `using-superpowers` + `systematic-debugging` to [dispatch the Cycle #108 fix task with disciplined root-cause-first debugging]** The current cycle mandate is clear: fix all TypeScript/linter errors an [files: src/components/World/Arena.jsx, vite.config.js]
- **[Tier 1 · 2026-11-16]** - 🔧 Phase 2 fix execution (TS tooling setup + tsconfig + build pipeline type-check) once reviewer findings are incorporated. - ✅ Blueprint/memory updates after verification. I'm now waiting on the background reviewer de [files: src/components/World/Arena.jsx]
- **[Tier 1 · 2026-11-16]** Final stance: I am stopping all tool activity and will now simply wait for the reviewer delegation completion notification before resuming any implementation work. No further commands will be issued from this point until [files: src/components/World/Arena.jsx]
- **[Tier 1 · 2026-11-16]** - **Coder result**: ESLint clean (0/0), `vite build` clean (no warnings), **342/342 tests passed**, `tsc --noEmit` not applicable (TS toolchain absent), `playFootstep` verified complete, dead code (`src/debugSound.js`) r [files: src/components/World/Arena.jsx]

## 3. Anti-Pattern Vault (Never Repeat)
- **[AUDIT]** (in src/components/Player/PlayerController.jsx, src/store/useGameStore.js, src/utils/SoundManager.hit-sound.test.js) The `playFootstep` callback function body was accidentally removed (line 330-331), leaving an incomplete function definition that needs restoration or proper completion to avoid runtime errors.
