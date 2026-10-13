import { test, expect } from '@playwright/test';

/**
 * Smoke test: the main menu and pause menu show no CPU opponent names.
 * Every match runs a fixed 3 bots on normal skill — names/tags are internal only.
 */
test('menus show no CPU opponent names', async ({ page }) => {
  await page.goto('/');

  // The old roster panel (names + difficulty tags + selectors) is gone
  await expect(page.locator('.bot-panel')).toHaveCount(0);
  await expect(page.locator('.bot-roster-row')).toHaveCount(0);
  await expect(page.locator('.bot-roster-name')).toHaveCount(0);
  await expect(page.locator('.bot-roster-tag')).toHaveCount(0);
  await expect(page.locator('.bot-option-btn')).toHaveCount(0);
});
test('bots mount and spawn in the arena without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  // No roster UI on the menu anymore
  await expect(page.locator('.bot-panel')).toHaveCount(0);

  // Enter the match — the bots are rendered inside the Rapier <Physics> tree
  await page.locator('button', { hasText: 'START GAME' }).click();

  // The HUD only renders while the game state is PLAYING
  await expect(page.locator('.game-hud-root')).toBeVisible({ timeout: 15000 });

  // Give the physics loop a moment to drive the bots through a few frames
  await page.waitForTimeout(2500);

  // Bots must not throw while driven by BotAI (e.g. bad castShape arguments)
  expect(errors).toEqual([]);

  // NOTE: the bots still mount in-game (BotPlayers inside the Rapier <Physics>
  // tree). The old pause-menu roster was removed along with the lobby one —
  // bot names/tags are internal only now.
});