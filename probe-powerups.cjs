/* TEMP DIAGNOSTIC — start game, drive player over a coin, report console errors + pickup. */
const { chromium } = require('playwright');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      errors.push(`[${m.type()}] ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);

  // Enter the match
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const start = btns.find((b) => /start game/i.test(b.textContent || ''));
    if (start) start.click();
  });
  await sleep(3000);

  const report = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const coins = document.querySelectorAll('canvas');
    // Read the store's powerUp state directly from the exposed zustand store if present
    const st = window.__gameStore || null;
    const before = st ? { powerUp: st.getState().powerUp, coinCount: st.getState().coinCount, score: st.getState().matchScore } : null;

    // Force a coin to spawn right on top of the player by walking into it is slow;
    // instead teleport the player to the nearest hovering coin.
    await sleep(2000);
    const mid = st ? { powerUp: st.getState().powerUp, coinCount: st.getState().coinCount, score: st.getState().matchScore } : null;

    return { hasCanvas: coins.length > 0, storeExposed: !!st, before, mid };
  });

  console.log(JSON.stringify({ report, errors: errors.slice(0, 25) }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error('PROBE FAILED:', e.message);
  process.exit(1);
});
