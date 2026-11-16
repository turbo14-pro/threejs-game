/**
 * Central client environment configuration.
 * Single source of truth for deriving the WebSocket server URL from Vite env vars.
 *
 * The `.env` URLs point at the HTTP(S) origin of the game server
 * (e.g. `http://192.168.1.66:9208` in dev, `https://turbogames.duckdns.org` in prod).
 * This module converts the appropriate origin into a WebSocket URL:
 *   - dev:  `ws://<hostname>:<port>`   (explicit port, or default 9208)
 *   - prod: `wss://<hostname>[:port]`  (explicit port only if provided)
 */

/** Default WS port used in development when the env URL has no explicit port. */
const DEFAULT_DEV_WS_PORT = 9208;

/**
 * @typedef {Object} ServerConfig
 * @property {boolean} isDev - Whether the client is running in development mode.
 * @property {string} wsUrl - Fully derived WebSocket URL (`ws://…` in dev, `wss://…` in prod).
 */

/**
 * Derive the WebSocket URL from a raw env URL using proper URL parsing.
 * @param {string} rawUrl - Raw server origin from the environment (e.g. `http://host:9208`).
 * @param {boolean} isDev - Whether the client runs in development mode.
 * @returns {string} The derived WebSocket URL.
 * @throws {Error} If `rawUrl` is missing or not a parseable URL.
 */
export function deriveWsUrl(rawUrl, isDev) {
    if (!rawUrl) {
        throw new Error(
            isDev
                ? "VITE_SERVER_URL_LOCAL is not set — cannot derive the development WebSocket URL"
                : "VITE_SERVER_URL_PRODUCTION is not set — cannot derive the production WebSocket URL"
        );
    }

    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error(
            `Invalid server URL in ${isDev ? "VITE_SERVER_URL_LOCAL" : "VITE_SERVER_URL_PRODUCTION"}: "${rawUrl}"`
        );
    }

    const scheme = isDev ? "ws:" : "wss:";
    // URL normalizes default ports away (e.g. https://host:443 → port ""),
    // so an empty port means "no explicit port".
    const hasExplicitPort = parsed.port !== "";
    const port = isDev ? (hasExplicitPort ? `:${parsed.port}` : `:${DEFAULT_DEV_WS_PORT}`) : hasExplicitPort ? `:${parsed.port}` : "";

    return `${scheme}//${parsed.hostname}${port}`;
}

/**
 * Read the server configuration for the current (or requested) mode.
 * Fails fast with the exact missing env variable named in the error.
 * @param {{isDev?: boolean}} [options] - Override the mode (defaults to `import.meta.env.DEV`).
 * @returns {ServerConfig} The parsed server configuration.
 * @throws {Error} If the env URL required for the current mode is missing or invalid.
 */
export function getServerConfig({isDev = import.meta.env.DEV} = {}) {
    const rawUrl = isDev ? import.meta.env.VITE_SERVER_URL_LOCAL : import.meta.env.VITE_SERVER_URL_PRODUCTION;
    const wsUrl = deriveWsUrl(rawUrl, isDev);
    return {isDev, wsUrl};
}
