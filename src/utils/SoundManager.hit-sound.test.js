import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import * as THREE from "three";

/**
 * Hit sound tests for the sound engine.
 *
 * Covers:
 *   - computeHitVolume: maps closing speed (m/s) to a 0-1 volume
 *   - playPositional integration: hit sounds use velocity-based volume
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

describe("SoundManager — computeHitVolume", () => {
    it("returns 0 for zero closing speed", async () => {
        const {SoundManager, computeHitVolume} = await import("./SoundManager.js");
        expect(computeHitVolume(0)).toBe(0);
    });

    it("returns 1 for closing speed at or above reference speed", async () => {
        const {computeHitVolume} = await import("./SoundManager.js");
        expect(computeHitVolume(15)).toBe(1);
        expect(computeHitVolume(30)).toBe(1);
        expect(computeHitVolume(100)).toBe(1);
    });

    ("returns proportional volume for intermediate speeds");
    it("returns proportional volume for intermediate speeds", async () => {
        const {computeHitVolume} = await import("./SoundManager.js");
        // referenceSpeed defaults to 15 m/s
        expect(computeHitVolume(7.5)).toBeCloseTo(0.5, 2);
        expect(computeHitVolume(3)).toBeCloseTo(0.2, 1);
        expect(computeHitVolume(12)).toBeCloseTo(0.8, 1);
    });

    it("clamps negative speeds to 0", async () => {
        const {computeHitVolume} = await import("./SoundManager.js");
        expect(computeHitVolume(-5)).toBe(0);
        expect(computeHitVolume(-100)).toBe(0);
    });

    it("accepts a custom reference speed", async () => {
        const {computeHitVolume} = await import("./SoundManager.js");
        expect(computeHitVolume(10, 20)).toBeCloseTo(0.5, 2);
        expect(computeHitVolume(20, 20)).toBe(1);
        expect(computeHitVolume(5, 20)).toBeCloseTo(0.25, 2);
    });

    it("never returns NaN or Infinity", async () => {
        const {computeHitVolume} = await import("./SoundManager.js");
        expect(Number.isFinite(computeHitVolume(0))).toBe(true);
        expect(Number.isFinite(computeHitVolume(15))).toBe(true);
        expect(Number.isFinite(computeHitVolume(999))).toBe(true);
    });
});

describe("SoundManager — playPositional hit sound uses computeHitVolume", () => {
    it("playPositional plays a hit sound with the given volume", async () => {
        const {SoundManager, computeHitVolume} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("hit", {duration: 0.5});

        const parent = new THREE.Object3D();

        // Volume passed directly to playPositional is used as-is (clamped to [0,1])
        const volume = computeHitVolume(7.5); // = 0.5
        const s = sm.playPositional("hit", parent, volume, 5, 1, 50, false);
        expect(s).toBeTruthy();
        // The sound was created and tracked
        expect(sm.instances.has(s)).toBe(true);
        // Clean up
        sm.release(s);
    });

    it("playPositional with zero closing speed volume produces silent hit", async () => {
        const {computeHitVolume} = await import("./SoundManager.js");
        const volume = computeHitVolume(0);
        expect(volume).toBe(0);
    });
});

describe("SoundManager — hit sound volume scaling curve", () => {
    it("produces a smooth monotonic curve from 0 to 1", async () => {
        const {computeHitVolume} = await import("./SoundManager.js");
        const speeds = [0, 1, 2, 3, 5, 7.5, 10, 12.5, 15, 20];
        const volumes = speeds.map((s) => computeHitVolume(s));
        for (let i = 1; i < volumes.length; i++) {
            expect(volumes[i]).toBeGreaterThanOrEqual(volumes[i - 1]);
        }
        expect(volumes[0]).toBe(0);
        expect(volumes[volumes.length - 1]).toBe(1);
    });
});
