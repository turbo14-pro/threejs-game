import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {loadTracks, getTracks, getRandomTrack, getTrackById, getTrackUrl, clearTracksCache} from "./tracks.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Track Registry (tracks.js)", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        clearTracksCache();
    });

    afterEach(() => {
        clearTracksCache();
    });

    const validManifest = {
        tracks: [
            {
                id: "track-01",
                file: "track-01.ogg",
                title: "Neon Drift",
                artist: "Synthwave Outrun",
                bpm: 128,
                duration: 240,
            },
            {id: "track-02", file: "track-02.ogg", title: "Ironclad", artist: "Halcyon", bpm: 140, duration: 210},
            {
                id: "track-03",
                file: "track-03.ogg",
                title: "Midnight Protocol",
                artist: "Neon Valley",
                bpm: 110,
                duration: 280,
            },
        ],
    };

    it("loads and caches tracks from manifest", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => validManifest,
        });

        const tracks = await loadTracks();
        expect(tracks).toHaveLength(3);
        expect(tracks[0].id).toBe("track-01");
        expect(tracks[0].title).toBe("Neon Drift");
        expect(tracks[0].artist).toBe("Synthwave Outrun");

        // Second call should use cache (no additional fetch)
        const tracks2 = await loadTracks();
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(tracks2).toBe(tracks); // same reference
    });

    it("filters out invalid track entries (missing required fields)", async () => {
        const manifestWithInvalid = {
            tracks: [
                {id: "track-01", file: "track-01.ogg", title: "Valid", artist: "Artist"},
                {id: "track-02", file: "track-02.ogg"}, // missing title, artist
                {file: "track-03.ogg", title: "No ID", artist: "Artist"}, // missing id
                {id: "track-04", title: "No File", artist: "Artist"}, // missing file
            ],
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => manifestWithInvalid,
        });

        const tracks = await loadTracks();
        expect(tracks).toHaveLength(1);
        expect(tracks[0].id).toBe("track-01");
    });

    it("returns empty array on fetch failure", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const tracks = await loadTracks();
        expect(tracks).toEqual([]);
    });

    it("returns empty array on non-ok response", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
        });

        const tracks = await loadTracks();
        expect(tracks).toEqual([]);
    });

    it("returns empty array on malformed JSON (missing tracks array)", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({notTracks: []}),
        });

        const tracks = await loadTracks();
        expect(tracks).toEqual([]);
    });

    it("getTracks loads if not cached", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => validManifest,
        });

        const tracks = await getTracks();
        expect(tracks).toHaveLength(3);
    });

    it("getRandomTrack returns a track from the list", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => validManifest,
        });

        const track = await getRandomTrack();
        expect(track).not.toBeNull();
        expect(validManifest.tracks.some((t) => t.id === track.id)).toBe(true);
    });

    it("getRandomTrack excludes specified ID", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => validManifest,
        });

        // Run multiple times to ensure exclusion works
        for (let i = 0; i < 10; i++) {
            const track = await getRandomTrack("track-01");
            expect(track.id).not.toBe("track-01");
        }
    });

    it("getRandomTrack falls back to any track if only one track and it's excluded", async () => {
        const singleTrackManifest = {tracks: [{id: "only", file: "only.ogg", title: "Only", artist: "One"}]};
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => singleTrackManifest,
        });

        const track = await getRandomTrack("only");
        expect(track.id).toBe("only");
    });

    it("getRandomTrack returns null if no tracks loaded", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({tracks: []}),
        });

        const track = await getRandomTrack();
        expect(track).toBeNull();
    });

    it("getTrackById returns matching track", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => validManifest,
        });

        const track = await getTrackById("track-02");
        expect(track).not.toBeNull();
        expect(track.id).toBe("track-02");
        expect(track.title).toBe("Ironclad");
    });

    it("getTrackById returns null for unknown ID", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => validManifest,
        });

        const track = await getTrackById("unknown");
        expect(track).toBeNull();
    });

    it("getTrackUrl constructs correct public URL", () => {
        expect(getTrackUrl("track-01.ogg")).toBe("/music/track-01.ogg");
        expect(getTrackUrl("subfolder/track.ogg")).toBe("/music/subfolder/track.ogg");
    });

    it("clearTracksCache resets cache and allows reload", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => validManifest,
        });

        await loadTracks();
        expect(mockFetch).toHaveBeenCalledTimes(1);

        clearTracksCache();
        await loadTracks();
        expect(mockFetch).toHaveBeenCalledTimes(2); // fetch called again after clear
    });
});
