import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { SKINS, WEAPONS, LEVELS } from '../data/registries';

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
          selectedWeapon: WEAPONS[0].id,
          health: 100,
          isHiding: false,
          isGrounded: true,
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
          set((s) => ({ 
            game: { ...s.game, phase: 'PREMATCH', countdown: 10 } 
          }));
        },

        // Player Control
        setPlayerSkin: (skinId) => set((s) => ({ player: { ...s.player, selectedSkin: skinId } })),
        setPlayerWeapon: (weaponId) => set((s) => ({ player: { ...s.player, selectedWeapon: weaponId } })),
        setUsername: (name) => set((s) => ({ player: { ...s.player, username: name } })),
        setIsHiding: (hiding) => set((s) => ({ player: { ...s.player, isHiding: hiding } })),
        
        damagePlayer: (amount) => {
          const newHealth = Math.max(0, get().player.health - amount);
          set((s) => ({ player: { ...s.player, health: newHealth } }));
          
          if (newHealth <= 0) {
            // Player died: Update stats and kick back to lobby
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
        // Persistence Strategy: Only save player progress and settings
        partialize: (state) => ({ 
          player: {
            username: state.player.username,
            unlockedSkins: state.player.unlockedSkins,
            stats: state.player.stats,
            achievements: state.player.achievements
          },
          settings: state.settings 
        }),
      }
    )
  )
);
