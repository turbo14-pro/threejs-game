import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import * as THREE from "three";

/**
 * SoundManager music (streaming) tests.
 *
 * Covers:
 *   - _initMusic creates musicGain connected to destination
 *   - setMusicVolume ramps gain via linearRampToValueAtTime (50ms)
 *   - playMusic creates <audio> + MediaElementAudioSource, plays, sets current refs
 *   - crossfadeTo creates next element, ramps volumes, swaps current/next on complete
 *   - stopMusic pauses/disconnects all elements and clears refs
 *   - Music stops on leaving PLAYING state (handled by MusicPlayer, tested via store)
 */

function createAudioContextMock() {
    const makeParam = (value = 0) => ({
        value,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
    });
    const makeNode = (extra = {}) => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        ...extra,
    });
    return {
        state: "running",
        currentTime: 0,
        sampleRate: 44100,
        destination: makeNode(),
        resume: vi.fn(() => Promise.resolve()),
        suspend: vi.fn(() => Promise.resolve()),
        createGain: vi.fn(() => makeNode({gain: makeParam(1)})),
        createPanner: vi.fn(() =>
            makeNode({
                positionX: makeParam(0),
                positionY: makeParam(0),
                positionZ: makeParam(0),
                orientationX: makeParam(0),
                orientationY: makeParam(0),
                orientationZ: makeParam(0),
            })
        ),
        createBufferSource: vi.fn(() => {
            const source = makeNode({
                buffer: null,
                loop: false,
                loopStart: 0,
                loopEnd: 0,
                playbackRate: makeParam(1),
                detune: makeParam(0),
                onended: null,
                start: vi.fn(),
                stop: vi.fn(),
            });
            source.__ended = () => {
                if (source.onended) source.onended();
            };
            return source;
        }),
        createBuffer: vi.fn(() => {
            const buf = {duration: 1};
            buf.getChannelData = () => new Float32Array(44100);
            return buf;
        }),
        createConvolver: vi.fn(() => makeNode({buffer: null})),
        createMediaElementSource: vi.fn(() => makeNode()),
    };
}

let ctx;

beforeEach(() => {
    vi.useFakeTimers();
    ctx = createAudioContextMock();
    class FakeAudioContext {
        constructor() {
            return ctx;
        }
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.window = globalThis.window || {};
    globalThis.window.AudioContext = FakeAudioContext;
    THREE.AudioContext.setContext(ctx);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("SoundManager — music streaming", () => {
    it("_initMusic creates musicGain connected to destination", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        sm._initMusic();

        expect(sm.musicGain).toBeTruthy();
        expect(ctx.createGain).toHaveBeenCalled();
        expect(sm.musicGain.connect).toHaveBeenCalledWith(ctx.destination);
        expect(sm.musicGain.gain.value).toBe(0.7); // default musicVolume
    });

    it("setMusicVolume ramps gain via linearRampToValueAtTime (50ms)", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm._initMusic();

        sm.setMusicVolume(0.3);

        expect(sm.musicVolume).toBe(0.3);
        expect(sm.musicGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
        // The ramp target time is now + 0.05 (50ms)
        const rampCall = sm.musicGain.gain.linearRampToValueAtTime.mock.calls.at(-1);
        expect(rampCall[0]).toBe(0.3);
        expect(rampCall[1]).toBeGreaterThanOrEqual(ctx.currentTime + 0.049);
    });

    it("setMusicVolume clamps to [0, 1]", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm._initMusic();

        sm.setMusicVolume(-0.5);
        expect(sm.musicVolume).toBe(0);
        sm.setMusicVolume(2.0);
        expect(sm.musicVolume).toBe(1);
    });

    it("playMusic creates <audio> + MediaElementAudioSource and plays", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm._initMusic();

        const track = {id: "t1", file: "track-01.ogg", title: "Neon Drift", artist: "Synthwave Outrun"};
        sm.playMusic(track);

        expect(sm.currentMusicElement).toBeInstanceOf(Audio);
        expect(sm.currentMusicElement.src).toContain("track-01.ogg");
        expect(sm.currentMusicElement.loop).toBe(true);
        expect(sm.currentMusicSource).toBeTruthy();
        expect(ctx.createMediaElementSource).toHaveBeenCalledWith(sm.currentMusicElement);
        expect(sm.currentMusicSource.connect).toHaveBeenCalledWith(sm.musicGain);
    });

    it("playMusic stops existing music before starting new track", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm._initMusic();

        const track1 = {id: "t1", file: "track-01.ogg", title: "Track 1", artist: "Artist 1"};
        const track2 = {id: "t2", file: "track-02.ogg", title: "Track 2", artist: "Artist 2"};

        sm.playMusic(track1);
        const firstElement = sm.currentMusicElement;
        sm.playMusic(track2);

        // Old element should be paused/cleared (src resolved to base URL in happy-dom)
        expect(firstElement.src).not.toContain("track-01.ogg");
        expect(sm.currentMusicElement).not.toBe(firstElement);
        expect(sm.currentMusicElement.src).toContain("track-02.ogg");
    });

    it("crossfadeTo creates next element, ramps volumes, swaps current/next", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm._initMusic();

        const track1 = {id: "t1", file: "track-01.ogg", title: "Track 1", artist: "Artist 1"};
        const track2 = {id: "t2", file: "track-02.ogg", title: "Track 2", artist: "Artist 2"};

        sm.playMusic(track1);
        const outgoing = sm.currentMusicElement;

        sm.crossfadeTo(track2, 3000);

        const nextElement = sm.nextMusicElement; // set by crossfadeTo
        expect(nextElement).toBeTruthy();
        expect(nextElement.src).toContain("track-02.ogg");
        // Volume starts at 0, then first fade step sets it to 1/60 (~0.0167)
        expect(nextElement.volume).toBeLessThanOrEqual(0.02);
        expect(sm.nextMusicSource).toBeTruthy();

        // Advance the crossfade timer manually to completion
        // steps=60, stepTime=3000/60=50ms. Run all timers.
        vi.advanceTimersByTime(3000);

        // After crossfade: outgoing released, next promoted to current
        expect(outgoing.src).not.toContain("track-01.ogg"); // released
        expect(sm.currentMusicElement).toBe(nextElement);
        expect(sm.currentMusicElement.src).toContain("track-02.ogg");
        expect(sm.nextMusicElement).toBeNull();
        expect(sm.nextMusicSource).toBeNull();
        expect(sm.musicCrossfadeTimer).toBeNull();
    });

    it("stopMusic pauses/disconnects all elements and clears refs", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm._initMusic();

        const track = {id: "t1", file: "track-01.ogg", title: "Track 1", artist: "Artist 1"};
        sm.playMusic(track);
        sm.crossfadeTo({id: "t2", file: "track-02.ogg", title: "Track 2", artist: "Artist 2"}, 3000);

        sm.stopMusic();

        expect(sm.currentMusicElement).toBeNull();
        expect(sm.currentMusicSource).toBeNull();
        expect(sm.nextMusicElement).toBeNull();
        expect(sm.nextMusicSource).toBeNull();
        expect(sm.musicCrossfadeTimer).toBeNull();
    });
});
