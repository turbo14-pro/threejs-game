import { test, expect } from '@playwright/test';

test.describe('Three.js Scene Visuals', () => {
  test('should load the page and find the canvas', async ({ page }) => {
    await page.goto('/');

    // Check if the canvas exists
    const canvas = await page.locator('#app');
    await expect(canvas).toBeVisible();

    // Check if the UI title is correct
    const title = await page.locator('.ui h1');
    await expect(title).toHaveText('THREE.JS PRO ENV');
  });

  test('visual regression check', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the scene to settle (clock starts from 0)
    await page.waitForTimeout(1000); 

    // Take a screenshot of the main canvas
    // NOTE: This will create a baseline image on the first run
    await expect(page.locator('#app')).toHaveScreenshot('scene-initial.png', {
        maxDiffPixelRatio: 0.1, // Allow some slight rendering differences
    });
  });
});
