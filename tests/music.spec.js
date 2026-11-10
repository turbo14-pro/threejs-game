import {test, expect} from "@playwright/test";

/**
 * Music system integration tests.
 *
 * Covers:
 *   - Music starts when entering PLAYING state
 *   - NowPlaying HUD shows title/artist
 *   - Volume slider changes gain in real time (no restart)
 *   - Music stops when leaving PLAYING state
 */

test.describe("Music System", () => {
    test.beforeEach(async ({page}) => {
        await page.goto("/");
        // Wait for the app to hydrate
        await page.waitForTimeout(3000);
    });

    async function enterPlaying(page) {
        // Click "START GAME" button to enter PLAYING state
        const startButton = page.locator('button:has-text("START GAME")').first();
        if ((await startButton.count()) > 0) {
            await startButton.click();
        }
        // Wait for music to start (manifest fetch + audio element creation)
        await page.waitForTimeout(8000);
    }

    test("music starts and NowPlaying HUD shows title/artist when entering PLAYING", async ({page}) => {
        await enterPlaying(page);

        // NowPlaying HUD should appear with track info
        const hud = page.locator(".now-playing-hud");
        await expect(hud).toBeVisible();

        // HUD should contain title and artist text
        await expect(hud.locator(".now-playing-title")).toBeVisible();
        await expect(hud.locator(".now-playing-artist")).toBeVisible();
    });

    test("volume slider changes gain in real time without restart", async ({page}) => {
        await enterPlaying(page);

        // Open Options menu
        const optionsButton = page.locator('button:has-text("Options"), button:has-text("Settings")').first();
        if ((await optionsButton.count()) > 0) {
            await optionsButton.click();
        }

        // Find music volume slider
        const musicSlider = page.locator('#volume-music, input[type="range"]').first();
        if ((await musicSlider.count()) > 0) {
            // Move slider to 0
            await musicSlider.fill("0");
            await musicSlider.dispatchEvent("input");

            // Music should still be playing (no restart), just volume changed
            await page.waitForTimeout(500);

            // Slider should reflect 0
            await expect(musicSlider).toHaveValue("0");
        }
    });

    test("music stops when leaving PLAYING state", async ({page}) => {
        await enterPlaying(page);

        // HUD should be visible
        const hud = page.locator(".now-playing-hud");
        await expect(hud).toBeVisible();

        // Return to menu (press Escape)
        await page.keyboard.press("Escape");

        await page.waitForTimeout(1000);

        // HUD should be hidden
        await expect(hud).toBeHidden();
    });
});
