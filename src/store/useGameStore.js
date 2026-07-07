import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { SKINS, WEAPONS, LEVELS } from '../data/registries';
import { Logger } from '../utils/Logger';

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
        mobileInput: { x: 0, y: 0, jump: false, sprint: false, slide: false },
        cameraInput: { x: 0, y: 0 },
        
        // --- MULTIPLAYER ---
        remotePlayers: {}, // { id: { pos, rot, skin, username } }
        lastServerState: null, // { pos, tick } for local player reconciliation
        
        // --- VISUAL SETTINGS ---
        performancePreset: 'Medium', // Lowest, Low, Medium, High, Ultra, Custom
        settings: {
          shadowQuality: 'Medium', // None, Low, Medium, High, Ultra
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
        shockwaves: [null, null, null], // Fixed pool of 3 shockwaves
        shockwaveIndex: 0,
        knockbackCount: 0,
        knockbackDir: { x: 0, y: 0, z: 0 },
        isStunned: false,
        remoteKnockbacks: {}, // { id: timestamp }

        // --- ACTIONS ---
        setIsStunned: (val) => set({ isStunned: val }),

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
        setNetworkId: (id) => set((s) => ({ player: { ...s.player, networkId: id } })),
        
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
            Lowest: { shadowQuality: 'None', skybox: false, bloom: false, vignette: false, grain: false, antialiasing: 'None', ssao: false, lightRays: false, shockwave: false, depthOfField: false, physicsDebug: false },
            Low: { shadowQuality: 'Medium', skybox: true, bloom: false, vignette: false, grain: false, antialiasing: 'FXAA', ssao: false, lightRays: true, shockwave: true, depthOfField: false, physicsDebug: false },
            Medium: { shadowQuality: 'Medium', skybox: true, bloom: true, vignette: true, grain: false, antialiasing: 'FXAA', ssao: false, lightRays: true, shockwave: true, depthOfField: false, physicsDebug: false },
            High: { shadowQuality: 'High', skybox: true, bloom: true, vignette: true, grain: true, antialiasing: 'SMAA', ssao: false, lightRays: true, shockwave: true, depthOfField: true, physicsDebug: false },
            Ultra: { shadowQuality: 'Ultra', skybox: true, bloom: true, vignette: true, grain: true, antialiasing: 'TAA', ssao: true, lightRays: true, shockwave: true, depthOfField: true, physicsDebug: false }
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
        addShockwave: (position) => {
          const id = Math.random().toString(36).substr(2, 9);
          set((s) => {
            const nextIdx = (s.shockwaveIndex + 1) % 3;
            const newShockwaves = [...s.shockwaves];
            newShockwaves[nextIdx] = { id, position };
            return { shockwaves: newShockwaves, shockwaveIndex: nextIdx };
          });
        },

        triggerKnockback: (direction) => {
          set((s) => ({ 
            knockbackCount: s.knockbackCount + 1,
            knockbackDir: direction
          }));
        },

        triggerRemoteKnockback: (id, direction) => {
          set((s) => ({
            remoteKnockbacks: { 
              ...s.remoteKnockbacks, 
              [id]: { t: Date.now(), dir: direction } 
            }
          }));
        }
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
