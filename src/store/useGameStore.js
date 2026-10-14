import * as THREE from 'three';
import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { SKINS, WEAPONS, LEVELS } from '../data/registries';
import { Logger } from '../utils/Logger';
import {
  POWERUP_EFFECTS,
  POWERUP_DURATIONS,
  POWERUP_DESCRIPTIONS,
} from '../config/playerConfig';
import { BOT_DIFFICULTY, buildBotRoster } from '../components/Player/BotAI.jsx';

// Re-export for backward compatibility with existing imports
export { POWERUP_EFFECTS, POWERUP_DURATIONS, POWERUP_DESCRIPTIONS };

// Shadow quality → shadow map type mapping
const SHADOW_TYPE_MAP = {
  None:   null,                    // shadows disabled
  Low:    THREE.BasicShadowMap,    // cheapest, hard edges
  Medium: THREE.PCFShadowMap,      // moderate, slightly soft
  High:   THREE.PCFSoftShadowMap,  // smooth soft edges
  Ultra:  THREE.PCFSoftShadowMap,  // smooth soft edges (higher res)
};

export const getShadowMapType = (shadowQuality) => SHADOW_TYPE_MAP[shadowQuality] ?? THREE.PCFSoftShadowMap;

// Bots present on the arena before any lobby selection (see "spawn from the start").
// Every match runs exactly 3 bots on normal skill — the lobby has no selectors.
const DEFAULT_BOT_COUNT = 3;
const DEFAULT_BOT_DIFFICULTY = BOT_DIFFICULTY.normal;

/**
 * THE MAIN BRAIN (Game Store)
 * Organized into logical sections for clean scaling.
 */
export const useGameStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // --- GAME STATE ---
        game: {
          state: 'MENU',     // MENU, PLAYING, PAUSED
          networkStatus: 'OFFLINE', // OFFLINE, CONNECTING, ONLINE, ERROR
          networkId: null,
          remotePlayers: [],
          phase: 'LOBBY',    // LOBBY, PREMATCH, DROP, BATTLE
          countdown: 0,
          currentLevel: LEVELS[0].id,
          startTime: 0,
          latency: 0,
        },

        // --- PLAYER STATE ---
        player: {
          username: 'Guest Player',
          selectedSkin: SKINS[0].id,
          health: 100,
          isHiding: false,
          isGrounded: true,
          networkId: null,
          playerAnimations: null, // Shared animation config
          // Stats for persistence
          stats: {
            kills: 0,
            deaths: 0,
            wins: 0,
            gamesPlayed: 0
          },
          unlockedSkins: [SKINS[0].id],
          achievements: []
        },

        // --- TECHNICAL / INPUT ---
        teleportCount: 0, // Used to trigger player position resets
        respawnCount: 0, // Used to trigger lobby respawn
        mobileInput: { x: 0, y: 0, jump: false, sprint: false, slide: false, dash: false },
        cameraInput: { x: 0, y: 0 },
        pendingTeleportTarget: null, // { x, y, z } set by spawnPlayerAtRandomLocation
        
        // --- MULTIPLAYER ---
        remotePlayers: {}, // { id: { pos, rot, skin, username } }
        lastServerState: null, // { pos, tick } for local player reconciliation

        // --- CPU BOTS ---
        // Fixed roster: every match runs 3 bots on normal skill. The lobby has
        // no selectors, so the count and difficulty are constants, not state.
        bots: buildBotRoster({ count: DEFAULT_BOT_COUNT, difficulty: DEFAULT_BOT_DIFFICULTY }),
        botCount: DEFAULT_BOT_COUNT,    // always 3
        botDifficulty: DEFAULT_BOT_DIFFICULTY, // always normal
        matchScore: { player: 0, bots: 0 }, // drives adaptive bot difficulty
        
        // --- VISUAL SETTINGS ---
        performancePreset: 'High', // Lowest, Low, Medium, High, Ultra, Custom
        settings: {
          shadowQuality: 'High', // None, Low, Medium, High, Ultra
          skybox: true,
          bloom: true,
          vignette: true,
          grain: false,
          antialiasing: 'FXAA', // None, FXAA, SMAA, TAA
          ssao: false,
          lightRays: true,
          shockwave: true,
          depthOfField: false,
          pixelRatio: window.devicePixelRatio || 1,
          physicsDebug: false
        },

        // --- EFFECTS ---
        dashBlur: false, // radial blur during dash
        playerIsMoving: false, // set by PlayerController each frame
        playerIsDashing: false, // set by PlayerController each frame
        shockwaves: [null, null, null], // Fixed pool of 3 shockwaves
        rippleTimer: 0, // Seconds remaining for impact ripple animation (>0 = active)
        debugRipple: {
          enabled: false,
          worldPosition: { x: 0, y: 0, z: 0 },
          screenPosition: { x: 0, y: 0 },
        },
        shockwaveIndex: 0,
        knockbackCount: 0,
        knockbackDir: { x: 0, y: 0, z: 0 },
        knockbackForce: 250,
        isStunned: false,
        remoteKnockbacks: {}, // { id: timestamp }

        // --- POWER-UP STATE ---
        powerUp: null, // { category: 'jump'|'speed'|'dash'|'slide', rarity: 'bronze'|'silver'|'gold'|'diamond', expiresAt: number } or null
        coinCount: 0, // Number of active power-up coins on map

        // --- NOTIFICATION ---
        notification: null, // { category, rarity, id } or null

        // --- ACTIONS ---
        setPendingTeleportTarget: (target) => set({ pendingTeleportTarget: target }),
        setDashBlur: (val) => set({ dashBlur: val }),
        setPlayerMovement: (moving, dashing) => set({ playerIsMoving: moving, playerIsDashing: dashing }),
        setIsStunned: (val) => set({ isStunned: val }),
        setRippleDebugPosition: (worldPosition, screenPosition = null) => set((state) => ({
          debugRipple: {
            ...state.debugRipple,
            worldPosition,
            screenPosition: screenPosition ?? state.debugRipple.screenPosition,
          }
        })),
        setRippleDebugScreenPosition: (screenPosition) => set((state) => ({
          debugRipple: {
            ...state.debugRipple,
            screenPosition,
          }
        })),
        showNotification: (category, rarity) => {
          const id = Date.now();
          set({ notification: { category, rarity, id } });
          setTimeout(() => {
            const current = get().notification;
            if (current && current.id === id) {
              set({ notification: null });
            }
          }, 4000);
        },

        // Game Control
        setGameState: (state) => set((s) => ({ game: { ...s.game, state } })),
        setMatchPhase: (phase) => set((s) => ({ game: { ...s.game, phase } })),
        setCountdown: (val) => set((s) => ({ game: { ...s.game, countdown: val } })),
        setNetworkStatus: (status) => set((s) => ({ game: { ...s.game, networkStatus: status } })),
        setLatency: (ms) => set((s) => ({ game: { ...s.game, latency: ms } })),
        
        startMatchSequence: () => {
          Logger.info('Match', 'Starting battle sequence');
          set((s) => ({ 
            game: { ...s.game, phase: 'BATTLE', countdown: 0 },
            teleportCount: s.teleportCount + 1
          }));
        },
        
        // Spawn player at random location 15m above arena floor
        spawnPlayerAtRandomLocation: () => {
          Logger.info('Player', 'Spawning player at random location');
          const store = get();
          
          // Generate random position within arena bounds, avoiding platforms
          const TABLE_HALF = 280;
          const PLATFORM_ZONES = [
            { cx: 0, cz: 0, rx: 50, rz: 35 },   // Platform 1
            { cx: 0, cz: -45, rx: 40, rz: 20 }, // Platform 2
            { cx: 0, cz: -22.5, rx: 12, rz: 15 }, // Bridge
          ];
          const SAFE_DIST = 22;
          
          let tx, tz, placed = false;
          for (let attempt = 0; attempt < 200; attempt++) {
            tx = (Math.random() - 0.5) * TABLE_HALF * 2;
            tz = (Math.random() - 0.5) * TABLE_HALF * 2;
            let inZone = false;
            for (const z of PLATFORM_ZONES) {
              if (Math.abs(tx - z.cx) < z.rx && Math.abs(tz - z.cz) < z.rz) { 
                inZone = true; 
                break; 
              }
            }
            if (inZone) continue;
            let tooClose = false;
            // Check distance from cereal boxes (reuse logic from PlayerController)
            const seededRandom = (seed) => {
              let s = seed;
              return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
            };
            const rand = seededRandom(42);
            const cerealPositions = [];
            for (let i = 0; i < 20; i++) {
              let bx, bz, valid = false, attempts = 0;
              while (!valid && attempts < 100) {
                bx = (rand() - 0.5) * 520;
                bz = (rand() - 0.5) * 520;
                attempts++;
                if (Math.abs(bx) < 45 && bz > -75 && bz < 30) continue;
                let ok = true;
                for (const b of cerealPositions) {
                  if (Math.hypot(bx - b.x, bz - b.z) < 42) { ok = false; break; }
                }
                if (ok) valid = true;
              }
              if (valid) cerealPositions.push({ x: bx, z: bz });
            }
            
            for (const b of cerealPositions) {
              if (Math.hypot(tx - b.x, tz - b.z) < SAFE_DIST) { tooClose = true; break; }
            }
            if (tooClose) continue;
            placed = true;
            break;
          }
          if (!placed) { tx = 0; tz = 80; } // fallback
          
          const ty = 15; // 15 metres above arena floor (spawn 15m above floor)
          
          // Trigger teleport via existing mechanism
          set({ teleportCount: store.teleportCount + 1 });
          
          // Store the target position for useFrame to pick up
          set({ pendingTeleportTarget: { x: tx, y: ty, z: tz } });
        },

        // Player Control
        setPlayerSkin: (skinId) => {
          Logger.info('Player', `Skin changed to: ${skinId}`);
          set((s) => ({ player: { ...s.player, selectedSkin: skinId } }));
        },
        setNetworkId: (id) => set((s) => ({ player: { ...s.player, networkId: id } })),
        setPlayerAnimations: (anim) => set((s) => ({ player: { ...s.player, playerAnimations: anim } })),
        setUsername: (name) => set((s) => ({ player: { ...s.player, username: name } })),
        setIsHiding: (hiding) => set((s) => ({ player: { ...s.player, isHiding: hiding } })),
        
        damagePlayer: (amount) => {
          const newHealth = Math.max(0, get().player.health - amount);
          set((s) => ({ player: { ...s.player, health: newHealth } }));
          
          if (newHealth <= 0) {
            Logger.info('Player', 'Player died — returning to lobby');
            set((s) => ({ 
              game: { ...s.game, phase: 'LOBBY' },
              player: { 
                ...s.player, 
                health: 100, 
                stats: { ...s.player.stats, deaths: s.player.stats.deaths + 1 } 
              },
              respawnCount: s.respawnCount + 1
            }));
          }
        },
        
        healPlayer: (amount) => {
          const newHealth = Math.min(100, get().player.health + amount);
          set((s) => ({ player: { ...s.player, health: newHealth } }));
        },

        // Multiplayer Sync
        updateRemotePlayers: (list) => {
          if (!list || !Array.isArray(list)) return;
          const remotePlayers = {};
          const localId = get().player.networkId;
          let lastServerState = null;

          list.forEach(p => {
            if (p.id !== localId) {
              remotePlayers[p.id] = p;
            } else {
              // Capture our own state for reconciliation
              lastServerState = { pos: p.pos, tick: p.tick };
            }
          });
          
          set({ remotePlayers, lastServerState });
        },
        removeRemotePlayer: (id) => set((s) => {
          const newPlayers = { ...s.remotePlayers };
          delete newPlayers[id];
          return { remotePlayers: newPlayers };
        }),

        // --- CPU BOT ACTIONS ---
        // Locked: every match runs 3 bots on normal skill. The setters are kept
        // as no-ops so old callers/tests don't crash — they always rebuild the
        // fixed roster.
        setBotCount: () => set(() => ({
          botCount: DEFAULT_BOT_COUNT,
          bots: buildBotRoster({ count: DEFAULT_BOT_COUNT, difficulty: DEFAULT_BOT_DIFFICULTY }),
        })),
        setBotDifficulty: () => set(() => ({
          botDifficulty: DEFAULT_BOT_DIFFICULTY,
          bots: buildBotRoster({ count: DEFAULT_BOT_COUNT, difficulty: DEFAULT_BOT_DIFFICULTY }),
        })),
        addMatchScore: (side, amount = 1) => set((s) => ({
          matchScore: {
            ...s.matchScore,
            [side]: Math.max(0, (s.matchScore[side] || 0) + amount)
          }
        })),
        resetMatchScore: () => set({ matchScore: { player: 0, bots: 0 } }),
        
        // System
        triggerWorldReset: () => set({ teleportCount: get().teleportCount + 1 }),
        respawnToLobby: () => set((s) => ({ 
          game: { ...s.game, phase: 'LOBBY' },
          player: { ...s.player, health: 100 },
          respawnCount: s.respawnCount + 1 
        })),
        setMobileInput: (input) => set({ mobileInput: { ...get().mobileInput, ...input } }),
        setCameraInput: (input) => set({ cameraInput: { ...get().cameraInput, ...input } }),
        setSetting: (key, value) => set((s) => ({ 
          settings: { ...s.settings, [key]: value },
          performancePreset: 'Custom'
        })),
        setPerformancePreset: (preset) => set((s) => {
          if (preset === 'Custom') return { performancePreset: preset };
          
          const PRESETS = {
            Lowest: { shadowQuality: 'None',  skybox: true, bloom: false, vignette: false, grain: false, antialiasing: 'None',  ssao: false, lightRays: false, shockwave: false, depthOfField: false, physicsDebug: false },
            Low:    { shadowQuality: 'Low',    skybox: true, bloom: false, vignette: false, grain: false, antialiasing: 'FXAA', ssao: false, lightRays: true,  shockwave: true,  depthOfField: false, physicsDebug: false },
            Medium: { shadowQuality: 'Medium', skybox: true, bloom: true,  vignette: true,  grain: false, antialiasing: 'FXAA', ssao: false, lightRays: true,  shockwave: true,  depthOfField: false, physicsDebug: false },
            High:   { shadowQuality: 'High',   skybox: true, bloom: true,  vignette: true,  grain: true,  antialiasing: 'SMAA', ssao: false, lightRays: true,  shockwave: true,  depthOfField: true,  physicsDebug: false },
            Ultra:  { shadowQuality: 'Ultra',  skybox: true, bloom: true,  vignette: true,  grain: true,  antialiasing: 'TAA',  ssao: true,  lightRays: true,  shockwave: true,  depthOfField: true,  physicsDebug: false }
          };
          
          return {
            performancePreset: preset,
            settings: { ...s.settings, ...PRESETS[preset] }
          };
        }),

        // Persistence (Achievements)
        unlockAchievement: (id) => {
          if (!get().player.achievements.includes(id)) {
            set((s) => ({ 
              player: { ...s.player, achievements: [...s.player.achievements, id] } 
            }));
          }
        },

        // Effects Management
        triggerRipple: (duration = 0.8) => {
          set({ rippleTimer: duration });
        },
        setRippleTimer: (val) => set({ rippleTimer: Math.max(0, val) }),
        addShockwave: (position, intensity = 1.0) => {
          const id = Math.random().toString(36).substr(2, 9);
          set((s) => {
            const nextIdx = (s.shockwaveIndex + 1) % 3;
            const newShockwaves = [...s.shockwaves];
            newShockwaves[nextIdx] = { id, position, intensity };
            return { shockwaves: newShockwaves, shockwaveIndex: nextIdx };
          });
        },
        clearShockwaveSlot: (index) => set((s) => {
          const newShockwaves = [...s.shockwaves];
          newShockwaves[index] = null;
          return { shockwaves: newShockwaves };
        }),

        triggerKnockback: (direction, force = 250) => {
          set((s) => ({ 
            knockbackCount: s.knockbackCount + 1,
            knockbackDir: direction,
            knockbackForce: force
          }));
        },

        triggerRemoteKnockback: (id, direction) => {
          set((s) => ({
            remoteKnockbacks: { 
              ...s.remoteKnockbacks, 
              [id]: { t: Date.now(), dir: direction } 
            }
          }));
        },

        // --- POWER-UP ACTIONS ---
        collectPowerUp: (category, rarity) => {
          set({
            powerUp: {
              category,
              rarity,
              expiresAt: Date.now() + (POWERUP_DURATIONS[rarity] || 120) * 1000
            }
          });
          // Collecting a power-up counts as a point for the human, which nudges the
          // CPU bots' adaptive difficulty upward while the player is ahead.
          get().addMatchScore('player', 1);
          get().showNotification(category, rarity);
        },

        clearPowerUp: () => set({ powerUp: null }),
        
        // Coin count management
        incrementCoinCount: () => set((s) => ({ coinCount: s.coinCount + 1 })),
        decrementCoinCount: () => set((s) => ({ coinCount: Math.max(0, s.coinCount - 1) }))
      }),
      {
        name: 'food-frenzy-data',
        version: 1,
        // Persistence Strategy: Only save player progress and settings
        partialize: (state) => ({ 
          saveVersion: 1,
          player: {
            username: state.player.username,
            unlockedSkins: state.player.unlockedSkins,
            stats: state.player.stats,
            achievements: state.player.achievements
          },
          settings: state.settings,
          performancePreset: state.performancePreset
        }),
        // When we change the save format, bump `version` above and add
        // a case here to convert old data into the new shape.
        migrate: (savedState, version) => {
          // version 0 → 1: no changes needed, this is the first version
          return savedState;
        },
      }
    )
  )
);
