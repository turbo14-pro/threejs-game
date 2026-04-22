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
          phase: 'LOBBY',    // LOBBY, PREMATCH, DROP, BATTLE
          countdown: 0,
          currentLevel: LEVELS[0].id,
          startTime: 0,
        },

        // --- PLAYER STATE ---
        player: {
          username: 'Guest Player',
          selectedSkin: SKINS[0].id,
          selectedWeapon: 'Bat',
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
        mobileInput: { x: 0, y: 0, jump: false, sprint: false, slide: false },
        
        // --- MULTIPLAYER ---
        remotePlayers: {}, // { id: { pos, rot, skin, username } }
        
        // --- VISUAL SETTINGS ---
        settings: {
          bloom: true,
          fxaa: true,
          vignette: true,
          grain: false,
          pixelRatio: window.devicePixelRatio || 1,
          shadowQuality: 'Medium'
        },

        // --- ACTIONS ---

        // Game Control
        setGameState: (state) => set((s) => ({ game: { ...s.game, state } })),
        setMatchPhase: (phase) => set((s) => ({ game: { ...s.game, phase } })),
        setCountdown: (val) => set((s) => ({ game: { ...s.game, countdown: val } })),
        
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
        setSelectedWeapon: (weapon) => set((s) => ({ player: { ...s.player, selectedWeapon: weapon } })),
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
              teleportCount: s.teleportCount + 1
            }));
          }
        },
        
        healPlayer: (amount) => {
          const newHealth = Math.min(100, get().player.health + amount);
          set((s) => ({ player: { ...s.player, health: newHealth } }));
        },

        // Multiplayer Sync
        updateRemotePlayers: (list) => {
          const remotePlayers = {};
          const localId = get().player.networkId;
          list.forEach(p => {
            if (p.id !== localId) {
              remotePlayers[p.id] = p;
            }
          });
          set({ remotePlayers });
        },
        removeRemotePlayer: (id) => set((s) => {
          const newPlayers = { ...s.remotePlayers };
          delete newPlayers[id];
          return { remotePlayers: newPlayers };
        }),
        setNetworkId: (id) => set((s) => ({ player: { ...s.player, networkId: id } })),
        
        // System
        triggerWorldReset: () => set({ teleportCount: get().teleportCount + 1 }),
        setMobileInput: (input) => set({ mobileInput: { ...get().mobileInput, ...input } }),
        setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),

        // Persistence (Achievements)
        unlockAchievement: (id) => {
          if (!get().player.achievements.includes(id)) {
            set((s) => ({ 
              player: { ...s.player, achievements: [...s.player.achievements, id] } 
            }));
          }
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
          settings: state.settings 
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
