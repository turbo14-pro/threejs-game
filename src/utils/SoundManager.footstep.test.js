import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import * as THREE from "three";

/**
 * Footstep sound tests for the 2-step one-shot system.
 *
 * Covers:
 *   - setPlaybackRate on one-shot step sounds (velocity-tied pitch)
 *   - Looping walk/run sounds no longer get random detune
 *   - One-shot step sounds get random detune for variety
 *   - Footstep playback rate is clamped to [0.5, 2.0]
 */

function createAudioContextMock() {
    const makeParam = (value = 0) => {
        const p = {
            value,
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            setTargetAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
        };
        p.setValueAtTime = vi.fn((v) => {
            p.value = v;
        });
        return p;
    };
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
    };
}

let ctx;

beforeEach(() => {
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
    vi.restoreAllMocks();
});

describe("SoundManager — setPlaybackRate on one-shot step sounds", () => {
    it("sets playback rate on a one-shot step sound", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("step", {duration: 0.3});

        const parent = new THREE.Object3D();
        const sound = sm.playPositional("step", parent, 0.8, 2, 1, 50, false);
        expect(sound).toBeTruthy();

        // Set playback rate to 1.5 (faster footsteps for speed power-up)
        sm.setPlaybackRate(sound, 1.5);
        expect(sound.__smPlaybackRate).toBe(1.5);

        sm.release(sound);
    });

    it("clamps playback rate to [0.5, 2.0]", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("step", {duration: 0.3});

        const parent = new THREE.Object3D();
        const sound = sm.playPositional("step", parent, 0.8, 2, 1, 50, false);

        // Below 0.5 → clamped to 0.5
        sm.setPlaybackRate(sound, 0.1);
        expect(sound.__smPlaybackRate).toBe(0.5);

        // Above 2.0 → clamped to 2.0
        sm.setPlaybackRate(sound, 5.0);
        expect(sound.__smPlaybackRate).toBe(2.0);

        sm.release(sound);
    });

    it("handles NaN playback rate gracefully", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("step", {duration: 0.3});

        const parent = new THREE.Object3D();
        const sound = sm.playPositional("step", parent, 0.8, 2, 1, 50, false);

        // NaN falls back to 1.0 (Number(NaN) || 1.0), should not throw
        sm.setPlaybackRate(sound, NaN);
        expect(sound.__smPlaybackRate).toBe(1.0);

        sm.release(sound);
    });

    it("handles null/undefined sound gracefully", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        // Should not throw
        expect(() => sm.setPlaybackRate(null, 1.5)).not.toThrow();
        expect(() => sm.setPlaybackRate(undefined, 1.5)).not.toThrow();
    });
});

describe("SoundManager — random detune on one-shot vs looping sounds", () => {
    it("applies random detune to one-shot step sounds", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("step", {duration: 0.3});

        const setDetuneSpy = vi.spyOn(THREE.Audio.prototype, "setDetune");

        const parent = new THREE.Object3D();
        const sound = sm.playPositional("step", parent, 0.8, 2, 1, 50, false);

        // One-shot sounds should have detune applied (variety) — called with non-zero
        const nonZeroCalls = setDetuneSpy.mock.calls.filter(([v]) => v !== 0);
        expect(nonZeroCalls.length).toBeGreaterThan(0);

        sm.release(sound);
        setDetuneSpy.mockRestore();
    });

    it("does NOT apply random detune to looping walk/run sounds", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("walk", {duration: 1});

        const setDetuneSpy = vi.spyOn(THREE.Audio.prototype, "setDetune");

        const parent = new THREE.Object3D();
        const sound = sm.playPositional("walk", parent, 0.8, 2, 1, 50, true);

        // Looping sounds should NOT have random detune (would break velocity sync)
        // Only the default setDetune(0) from Three.js internals, no random detune
        const nonZeroCalls = setDetuneSpy.mock.calls.filter(([v]) => v !== 0);
        expect(nonZeroCalls.length).toBe(0);

        sm.release(sound);
        setDetuneSpy.mockRestore();
    });
});

describe("SoundManager — footstep playback rate mapping", () => {
    it("maps velocity to playback rate correctly", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("step", {duration: 0.3});

        const parent = new THREE.Object3D();
        const sound = sm.playPositional("step", parent, 0.8, 2, 1, 50, false);

        // At walkSpeed (4 m/s) → rate = 1.0
        sm.setPlaybackRate(sound, 4 / 4);
        expect(sound.__smPlaybackRate).toBe(1.0);

        // At sprintSpeed (35 m/s) → rate = 1.0 (reference is sprintSpeed for running)
        sm.setPlaybackRate(sound, 35 / 35);
        expect(sound.__smPlaybackRate).toBe(1.0);

        // At 2x speed (speed power-up) → rate = 2.0 (clamped)
        sm.setPlaybackRate(sound, 2.0);
        expect(sound.__smPlaybackRate).toBe(2.0);

        sm.release(sound);
    });
});
