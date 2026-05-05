/**
 * MASTER REGISTRY
 * This file is the single source of truth for all game content.
 * Adding a new item here automatically makes it available in the game.
 */

export const SKINS = [
  {
    id: 'avo',
    name: 'Avo',
    model: '/skins/skin_avo.glb',
    description: 'The green guard.',
    stats: { speed: 1.0, health: 100 }
  },
  {
    id: 'egg',
    name: 'Egg',
    model: '/skins/skin_egg.glb',
    description: 'The golden yolk.',
    stats: { speed: 1.1, health: 80 }
  }
];

export const WEAPONS = [];

export const LEVELS = [
  {
    id: 'kitchen_table',
    name: 'The Giant Table',
    map: 'KitchenTable',
    description: 'A massive cedar table covered in obstacles.'
  }
];

export const ACHIEVEMENTS = [
  {
    id: 'hidden_cookie',
    name: 'Cookie Monster',
    description: 'Find the hidden cookie behind the toaster.',
    reward: 'Gold Avo Skin'
  }
];
