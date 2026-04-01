import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useGameStore = create(subscribeWithSelector((set, get) => ({
  gameState: 'MENU',
  selectedCharacter: 'Avo',
  playerHealth: 100,
  teleportCount: 0,
  mobileInput: { x: 0, y: 0, jump: false, sprint: false },
  
  // Settings
  settings: {
    bloom: true,
    fxaa: true,
    vignette: true,
    grain: false,
    pixelRatio: window.devicePixelRatio || 1
  },

  setGameState: (state) => set({ gameState: state }),
  setSelectedCharacter: (char) => set({ selectedCharacter: char }),
  triggerSpawn: () => set({ teleportCount: get().teleportCount + 1 }),
  setMobileInput: (input) => set({ mobileInput: { ...get().mobileInput, ...input } }),
  
  setSetting: (key, value) => set((state) => ({ 
    settings: { ...state.settings, [key]: value } 
  })),

  damagePlayer: (amount) => {
    const newHealth = Math.max(0, get().playerHealth - amount);
    set({ playerHealth: newHealth });
    if (newHealth === 0) {
      set({ gameState: 'GAMEOVER' });
    }
  },
  
  healPlayer: (amount) => {
    const newHealth = Math.min(100, get().playerHealth + amount);
    set({ playerHealth: newHealth });
  },

  respawn: () => set({ playerHealth: 100, gameState: 'PLAYING' })
})));

