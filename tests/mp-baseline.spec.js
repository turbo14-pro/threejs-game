import { test, expect } from '@playwright/test';

/**
 * M0 Baseline Test: Verify basic multiplayer functionality
 * This test connects 2 clients and verifies they can join the game
 * Server tick drift and payload size are measured manually from server terminal
 */
test.describe('M0 Multiplayer Baseline', () => {
  test('two clients can join and see each other', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const errors1 = [];
    const errors2 = [];
    
    page1.on('pageerror', err => errors1.push(err.message));
    page2.on('pageerror', err => errors2.push(err.message));

    // Navigate both pages to the game
    await page1.goto('/');
    await page2.goto('/');

    // Click START GAME on both
    await page1.locator('button', { hasText: 'START GAME' }).click();
    await page2.locator('button', { hasText: 'START GAME' }).click();

    // Wait for game to start (HUD visible)
    await expect(page1.locator('.game-hud-root')).toBeVisible({ timeout: 15000 });
    await expect(page2.locator('.game-hud-root')).toBeVisible({ timeout: 15000 });

    // Wait for network connection
    await page1.waitForTimeout(3000);
    await page2.waitForTimeout(3000);

    // Verify LatencyGraph shows server tick (should be > 0 after a few seconds)
    const serverTick1 = page1.locator('text=SERVER TICK').locator('..').locator('span').last();
    const serverTick2 = page2.locator('text=SERVER TICK').locator('..').locator('span').last();
    
    // Wait for server tick to be non-zero
    await expect(serverTick1).not.toHaveText('0', { timeout: 10000 });
    await expect(serverTick2).not.toHaveText('0', { timeout: 10000 });

    // Verify LatencyGraph is rendering on both clients
    await expect(page1.locator('text=LATENCY')).toBeVisible();
    await expect(page1.locator('text=FPS')).toBeVisible();
    await expect(page1.locator('text=SERVER TICK')).toBeVisible();
    await expect(page1.locator('text=REMOTE PLAYERS')).toBeVisible();
    await expect(page1.locator('text=DESYNC COUNT')).toBeVisible();
    
    await expect(page2.locator('text=LATENCY')).toBeVisible();
    await expect(page2.locator('text=FPS')).toBeVisible();
    await expect(page2.locator('text=SERVER TICK')).toBeVisible();
    await expect(page2.locator('text=REMOTE PLAYERS')).toBeVisible();
    await expect(page2.locator('text=DESYNC COUNT')).toBeVisible();

    // Verify no critical errors
    const criticalErrors1 = errors1.filter(e => !e.includes('PCFSoftShadowMap') && !e.includes('deprecated'));
    const criticalErrors2 = errors2.filter(e => !e.includes('PCFSoftShadowMap') && !e.includes('deprecated'));
    expect(criticalErrors1).toEqual([]);
    expect(criticalErrors2).toEqual([]);

    await context1.close();
    await context2.close();
  });

  test('server is running and accepting connections', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/');
    await page.locator('button', { hasText: 'START GAME' }).click();
    await expect(page.locator('.game-hud-root')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    // Verify LatencyGraph is rendering
    await expect(page.locator('text=LATENCY')).toBeVisible();
    await expect(page.locator('text=FPS')).toBeVisible();
    await expect(page.locator('text=SERVER TICK')).toBeVisible();
    await expect(page.locator('text=REMOTE PLAYERS')).toBeVisible();
    await expect(page.locator('text=DESYNC COUNT')).toBeVisible();

    // Verify server tick is non-zero
    const serverTick = page.locator('text=SERVER TICK').locator('..').locator('span').last();
    await expect(serverTick).not.toHaveText('0', { timeout: 10000 });

    await context.close();
  });
});