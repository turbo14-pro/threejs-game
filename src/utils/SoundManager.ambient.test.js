import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import * as THREE from "three";

/**
 * Ambient sound tests for the atmospheric sound system.
 *
 * Covers:
 *   - playAmbientBed / releaseAmbientBed: looping bed attached to camera
 *   - preloadAmbientSFX: sequential background download of amb-sfx files
 *   - setReverbZone: zone-aware reverb IR + wet level
 *   - Occlusion gain: raycast obstruction reduces ambience volume
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

describe("SoundManager — ambient bed", () => {
    it("loads and plays a looping ambient bed attached to camera", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        // Pre-load the buffer into the cache (as the real SoundListener would)
        const buffer = {duration: 15, getChannelData: () => new Float32Array(44100)};
        sm.sounds.set("amb-bed", buffer);

        const sound = await sm.playAmbientBed("amb-bed", 0.5);
        expect(sound).not.toBeNull();
        expect(sound.isPlaying).toBe(true);
        expect(sound.loop).toBe(true);

        // Release should stop and detach
        sm.releaseAmbientBed(sound);
        expect(sound.isPlaying).toBe(false);
    });

    it("releaseAmbientBed handles null gracefully", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        expect(() => sm.releaseAmbientBed(null)).not.toThrow();
        expect(() => sm.releaseAmbientBed(undefined)).not.toThrow();
    });
});

describe("SoundManager — preloadAmbientSFX", () => {
    it("downloads amb-sfx files sequentially and caches them", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        const loadedUrls = [];
        sm.audioLoader.load = vi.fn((url, onLoad) => {
            loadedUrls.push(url);
            onLoad({duration: 2, getChannelData: () => new Float32Array(44100)});
        });

        await sm.preloadAmbientSFX();

        // Should have loaded all 10 amb-sfx files
        expect(loadedUrls.length).toBe(10);
        expect(loadedUrls[0]).toContain("amb-sfx01");
        expect(loadedUrls[9]).toContain("amb-sfx10");
        // All should be cached
        for (let i = 1; i <= 10; i++) {
            const name = `amb-sfx${i.toString().padStart(2, "0")}`;
            expect(sm.sounds.has(name)).toBe(true);
        }
    });

    it("skips already-loaded amb-sfx files", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        // Pre-cache one file
        sm.sounds.set("amb-sfx01", {duration: 2});

        const loadCalls = [];
        sm.audioLoader.load = vi.fn((url, onLoad) => {
            loadCalls.push(url);
            onLoad({duration: 2, getChannelData: () => new Float32Array(44100)});
        });

        await sm.preloadAmbientSFX();

        // amb-sfx01 should NOT be re-loaded
        expect(loadCalls.some((u) => u.includes("amb-sfx01"))).toBe(false);
        // The other 9 should be loaded
        expect(loadCalls.length).toBe(9);
    });
});

describe("SoundManager — setReverbZone", () => {
    it("sets reverb IR and wet level for 'outside' zone", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        sm.setReverbZone("outside");
        expect(sm.reverb).not.toBeNull();
        expect(sm.reverbWet).toBeGreaterThan(0);
        expect(sm.reverbWet).toBeLessThanOrEqual(1);
    });

    it("sets reverb IR and wet level for 'inside' zone", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        sm.setReverbZone("inside");
        expect(sm.reverb).not.toBeNull();
        // Inside should have less reverb (smaller space)
        expect(sm.reverbWet).toBeGreaterThan(0);
    });

    it("sets reverb IR and wet level for 'edge' zone", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        sm.setReverbZone("edge");
        expect(sm.reverb).not.toBeNull();
        // Edge should have more reverb (more echo)
        expect(sm.reverbWet).toBeGreaterThan(0);
    });

    it("different zones produce different wet levels", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        sm.setReverbZone("outside");
        const outsideWet = sm.reverbWet;
        sm.setReverbZone("edge");
        const edgeWet = sm.reverbWet;
        // Edge should have more reverb than outside
        expect(edgeWet).toBeGreaterThan(outsideWet);
    });
});

describe("SoundManager — occlusion gain", () => {
    it("applies occlusion gain multiplier to ambient bed", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        sm.setOcclusionGain(0.3);
        expect(sm.occlusionGain).toBe(0.3);
    });

    it("clamps occlusion gain to [0, 1]", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());

        sm.setOcclusionGain(-1);
        expect(sm.occlusionGain).toBe(0);
        sm.setOcclusionGain(2);
        expect(sm.occlusionGain).toBe(1);
    });
});
