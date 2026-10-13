import { test, expect } from '@playwright/test';

/**
 * Smoke test for the CPU bot lobby roster. Every match runs a fixed roster of
 * 3 bots on normal skill — the lobby has no selectors, it just shows the names.
 */
test('lobby shows the fixed 3-bot CPU opponent roster', async ({ page }) => {
  await page.goto('/');

  const roster = page.locator('.bot-panel');
  await expect(roster).toBeVisible();
  await expect(roster.locator('.bot-panel-title')).toHaveText(/CPU Opponents/i);

  // Fixed roster: always 3 named bots, all on normal skill
  const rows = roster.locator('.bot-roster-row');
  await expect(rows).toHaveCount(3);

  // Every bot is named and shows its difficulty tag
  const names = await roster.locator('.bot-roster-name').allTextContents();
  expect(names.length).toBe(3);
  names.forEach((name) => expect(name.trim()).toMatch(/^Bot /));
  await expect(roster.locator('.bot-roster-tag').first()).toHaveText(/normal/i);

  // No lobby selectors remain
  await expect(roster.locator('.bot-option-btn')).toHaveCount(0);
});
test('bots mount and spawn in the arena without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  const roster = page.locator('.bot-panel');
  await expect(roster.locator('.bot-roster-row')).toHaveCount(3);

  // Enter the match — the bots are rendered inside the Rapier <Physics> tree
  await page.locator('button', { hasText: 'START GAME' }).click();

  // The HUD only renders while the game state is PLAYING
  await expect(page.locator('.game-hud-root')).toBeVisible({ timeout: 15000 });

  // Give the physics loop a moment to drive the bots through a few frames
  await page.waitForTimeout(2500);

  // Bots must not throw while driven by BotAI (e.g. bad castShape arguments)
  expect(errors).toEqual([]);

  // NOTE: the in-game roster lives in the pause menu, which only opens after a real
  // pointer-lock change. Headless Chromium cannot acquire the lock, so the roster's
  // in-game rendering is covered by the lobby test above (same shared component).
});