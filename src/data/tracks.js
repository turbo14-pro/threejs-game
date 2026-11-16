/**
 * Track Registry — Data-driven music track loader.
 * Reads manifest.json at runtime. Zero hardcoded filenames/titles/artists in game code.
 * Adding a track = drop .ogg in public/music/ + add entry to manifest.json.
 */

/**
 * Base URL of the deployed app ("/" for dev, "./" for the relative itch.io build).
 * Absolute paths break when the game is hosted from a subdirectory.
 */
const BASE_URL = import.meta.env.BASE_URL || "/";

const MANIFEST_URL = `${BASE_URL}music/manifest.json`;

let _tracksCache = null;
let _loadPromise = null;

/**
 * Fetch and parse the manifest. Caches result.
 * @returns {Promise<Array<{id, file, title, artist, bpm?, duration?}>>}
 */
export async function loadTracks() {
    if (_tracksCache) return _tracksCache;
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async () => {
        try {
            const res = await fetch(MANIFEST_URL, {cache: "no-cache"});
            if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
            const data = await res.json();
            if (!data?.tracks || !Array.isArray(data.tracks)) {
                throw new Error("Manifest missing 'tracks' array");
            }
            // Validate each track has required fields
            const validTracks = data.tracks.filter((t) => {
                if (!t.id || !t.file || !t.title || !t.artist) {
                    console.warn("[Tracks] Skipping invalid track entry:", t);
                    return false;
                }
                return true;
            });
            _tracksCache = validTracks;
            return validTracks;
        } catch (e) {
            console.error("[Tracks] Failed to load manifest:", e);
            _tracksCache = [];
            return [];
        }
    })();

    return _loadPromise;
}

/**
 * Get all loaded tracks (loads if not already loaded).
 */
export async function getTracks() {
    return loadTracks();
}

/**
 * Get a random track, optionally excluding a specific track ID.
 * @param {string} [excludeId] - Track ID to exclude from random selection
 * @returns {Promise<{id, file, title, artist, bpm?, duration?} | null>}
 */
export async function getRandomTrack(excludeId = null) {
    const tracks = await getTracks();
    if (tracks.length === 0) return null;
    if (tracks.length === 1) return tracks[0];

    const candidates = excludeId ? tracks.filter((t) => t.id !== excludeId) : tracks;
    if (candidates.length === 0) return tracks[0]; // fallback if only one track and it's excluded

    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
}

/**
 * Get a track by its ID.
 * @param {string} id
 * @returns {Promise<{id, file, title, artist, bpm?, duration?} | null>}
 */
export async function getTrackById(id) {
    const tracks = await getTracks();
    return tracks.find((t) => t.id === id) || null;
}

/**
 * Construct the URL for a track file, relative to the app base.
 * @param {string} file - Filename from manifest (e.g., "track-01.ogg")
 * @returns {string} - URL (e.g., "/music/track-01.ogg" in dev, "./music/track-01.ogg" in the itch build)
 */
export function getTrackUrl(file) {
    return `${BASE_URL}music/${file}`;
}

/**
 * Clear cache (useful for testing or manifest updates without reload).
 */
export function clearTracksCache() {
    _tracksCache = null;
    _loadPromise = null;
}
