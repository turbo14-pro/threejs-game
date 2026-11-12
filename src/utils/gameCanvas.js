/**
 * Returns the WebGL canvas rendered by the React Three Fiber <Canvas id="game-canvas">.
 *
 * Do NOT use `document.querySelector("canvas")` — other components (e.g. GlassSurface)
 * render their own <canvas> elements earlier in the DOM, so a bare selector can grab a
 * hidden/non-game canvas and pointer-lock requests will silently fail.
 */
export function getGameCanvas() {
    return document.querySelector("#game-canvas canvas");
}

/**
 * Requests pointer lock on the game canvas. Must be called from a user gesture.
 * Returns true if the request was issued, false if the canvas was not found.
 * Async rejections (e.g. browser denies the lock) are swallowed so callers
 * don't get unhandled promise rejections.
 */
export function requestGamePointerLock() {
    const canvas = getGameCanvas();
    if (!canvas) return false;
    try {
        const result = canvas.requestPointerLock();
        if (result && typeof result.catch === "function") {
            result.catch(() => {});
        }
        return true;
    } catch (e) {
        return false;
    }
}
