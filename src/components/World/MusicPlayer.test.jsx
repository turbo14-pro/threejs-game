import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import React from "react";
import MusicPlayer from "./MusicPlayer.jsx";
import {useGameStore} from "../../store/useGameStore";
import {soundManager} from "../../utils/SoundManager";
import {getRandomTrack} from "../../data/tracks";

/**
 * MusicPlayer component tests.
 *
 * Covers:
 *   - Mounts without crashing
 *   - Starts a track when entering PLAYING state
 *   - Stops music when leaving PLAYING state
 *   - Auto-advances to next track on ended/timeupdate
 *   - Syncs musicVolume from store to SoundManager
 */

vi.mock("../../data/tracks", () => ({
    getRandomTrack: vi.fn(),
    getTracks: vi.fn(),
    getTrackUrl: vi.fn((file) => `/music/${file}`),
    clearTracksCache: vi.fn(),
}));

vi.mock("../../utils/SoundManager.js", () => ({
    soundManager: {
        playMusic: vi.fn(),
        stopMusic: vi.fn(),
        setMusicVolume: vi.fn(),
        currentMusicElement: null,
        nextMusicElement: null,
    },
}));

const mockTrack = {
    id: "t1",
    file: "track-01.ogg",
    title: "Neon Drift",
    artist: "Synthwave Outrun",
};

const mockNextTrack = {
    id: "t2",
    file: "track-02.ogg",
    title: "Ironclad",
    artist: "Halcyon",
};

function renderMusicPlayer(initialState = "MENU") {
    // Set initial game state
    useGameStore.setState({game: {state: initialState}, audio: {musicVolume: 0.7}});
    return render(<MusicPlayer />);
}

describe("MusicPlayer", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        useGameStore.setState({
            game: {state: "MENU"},
            audio: {musicVolume: 0.7},
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("mounts without crashing", () => {
        renderMusicPlayer("MENU");
        expect(screen.queryByText(/now playing/i)).toBeNull(); // MusicPlayer renders nothing
    });

    it("starts a random track when entering PLAYING state", async () => {
        getRandomTrack.mockResolvedValue(mockTrack);
        renderMusicPlayer("PLAYING");

        await vi.waitFor(() => {
            expect(getRandomTrack).toHaveBeenCalled();
        });
        expect(soundManager.playMusic).toHaveBeenCalledWith(mockTrack);
    });

    it("stops music when leaving PLAYING state", async () => {
        getRandomTrack.mockResolvedValue(mockTrack);
        const {rerender} = renderMusicPlayer("PLAYING");

        await vi.waitFor(() => {
            expect(soundManager.playMusic).toHaveBeenCalled();
        });

        rerender(<MusicPlayer />);
        useGameStore.setState({game: {state: "MENU"}});

        await vi.waitFor(() => {
            expect(soundManager.stopMusic).toHaveBeenCalled();
        });
    });

    it("syncs musicVolume from store to SoundManager", async () => {
        getRandomTrack.mockResolvedValue(mockTrack);
        renderMusicPlayer("PLAYING");

        await vi.waitFor(() => {
            expect(soundManager.playMusic).toHaveBeenCalled();
        });

        useGameStore.setState({audio: {musicVolume: 0.2}});

        await vi.waitFor(() => {
            expect(soundManager.setMusicVolume).toHaveBeenCalledWith(0.2);
        });
    });

    it("auto-advances to next track on ended event", async () => {
        getRandomTrack.mockResolvedValueOnce(mockTrack).mockResolvedValueOnce(mockNextTrack);

        const mockElement = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            volume: 1,
            duration: 10,
            currentTime: 0,
            play: vi.fn(() => Promise.resolve()),
            pause: vi.fn(),
        };
        soundManager.currentMusicElement = mockElement;

        renderMusicPlayer("PLAYING");

        await vi.waitFor(() => {
            expect(soundManager.playMusic).toHaveBeenCalledWith(mockTrack);
        });

        // Simulate ended event on the current element
        const endedHandler = mockElement.addEventListener.mock.calls.find(
            (c) => c[0] === "ended"
        )?.[1];
        expect(endedHandler).toBeDefined();

        endedHandler();

        await vi.waitFor(() => {
            expect(soundManager.playMusic).toHaveBeenCalledWith(mockNextTrack);
        });
    });

    it("excludes the current track when auto-advancing", async () => {
        getRandomTrack.mockResolvedValueOnce(mockTrack).mockResolvedValueOnce(mockNextTrack);

        const mockElement = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            volume: 1,
            duration: 10,
            currentTime: 0,
            play: vi.fn(() => Promise.resolve()),
            pause: vi.fn(),
        };
        soundManager.currentMusicElement = mockElement;

        renderMusicPlayer("PLAYING");

        await vi.waitFor(() => {
            expect(soundManager.playMusic).toHaveBeenCalledWith(mockTrack);
        });

        const endedHandler = mockElement.addEventListener.mock.calls.find(
            (c) => c[0] === "ended"
        )?.[1];
        endedHandler();

        await vi.waitFor(() => {
            expect(getRandomTrack).toHaveBeenLastCalledWith("t1"); // exclude current
        });
    });
});
