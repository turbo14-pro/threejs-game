import { test, expect } from '@playwright/test';

/**
 * Smoke test for the CPU bot lobby roster. Verifies the plan's "visible in lobby with
 * names" requirement end-to-end in a real browser, without needing the game server.
 */
test('lobby shows the CPU opponent roster and reflects the bot count selection', async ({ page }) => {
  await page.goto('/');

  const roster = page.locator('.bot-panel');
  await expect(roster).toBeVisible();
  await expect(roster.locator('.bot-panel-title')).toHaveText(/CPU Opponents/i);

  // Fresh players get a default roster of 2 bots so the arena is populated from the start
  await expect(roster.locator('.bot-roster-row')).toHaveCount(2);

  // Select 3 bots
  await roster.locator('.bot-option-row', { hasText: 'Bots' }).locator('.bot-option-btn', { hasText: '3' }).click();

  const rows = roster.locator('.bot-roster-row');
  await expect(rows).toHaveCount(3);

  // Every bot is named and shows its difficulty tag
  const names = await roster.locator('.bot-roster-name').allTextContents();
  expect(names.length).toBe(3);
  names.forEach((name) => expect(name.trim()).toMatch(/^Bot /));
  await expect(roster.locator('.bot-roster-tag').first()).toHaveText(/normal/i);

  // Switching difficulty relabels the roster
  await roster.locator('.bot-option-row', { hasText: 'Skill' }).locator('.bot-option-btn', { hasText: 'insane' }).click();
  await expect(roster.locator('.bot-roster-tag').first()).toHaveText(/insane/i);

  // Back to solo practice
  await roster.locator('.bot-option-row', { hasText: 'Bots' }).locator('.bot-option-btn', { hasText: '0' }).click();
  await expect(roster.locator('.bot-roster-empty')).toBeVisible();
});
test('bots mount and spawn in the arena without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  const roster = page.locator('.bot-panel');
  await roster.locator('.bot-option-row', { hasText: 'Bots' }).locator('.bot-option-btn', { hasText: '3' }).click();
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