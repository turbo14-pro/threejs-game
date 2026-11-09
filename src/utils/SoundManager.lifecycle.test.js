import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import * as THREE from "three";

/**
 * Audio lifecycle regression tests.
 *
 * These lock in three bugs found while bisecting the movement-triggered
 * "audio lifecycle" crash:
 *
 *  1. `sound.onEnded` was assigned AFTER `sound.play()`. three binds
 *     `source.onended = this.onEnded.bind(this)` INSIDE play(), so the
 *     cleanup callback never ran and every finished sound leaked.
 *  2. Overriding `onEnded` per instance bypassed three's base implementation
 *     (which resets `isPlaying` / `_progress`), so `isPlaying` stayed true
 *     forever and the node could never be reused or cleaned up.
 *  3. `isPositionalAudio` does not exist in three r183 — the code used it to
 *     detect positional audio, so the check was always false and the NaN
 *     guard was dead code.
 */

/** Minimal Web Audio mock — enough for three's Audio/AudioListener. */
function createAudioContextMock() {
    /** AudioParam-like object with the methods three calls. */
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
    // three's AudioContext.getContext() does `new (window.AudioContext || ...)()`,
    // so the mock MUST be a constructible class (not a plain arrow fn).
    class FakeAudioContext {
        constructor() {
            return ctx;
        }
    }
    globalThis.AudioContext = FakeAudioContext;
    globalThis.window = globalThis.window || {};
    globalThis.window.AudioContext = FakeAudioContext;
    // Reset the three.js AudioContext singleton so each test gets a fresh mock.
    THREE.AudioContext.setContext(ctx);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("SoundManager audio lifecycle", () => {
    it("assigns onEnded BEFORE play so the cleanup callback actually fires", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();

        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("beep", {duration: 1});

        const sound = sm.playGlobal("beep", 0.5, false);
        expect(sound).toBeTruthy();

        // three binds source.onended inside play(); if onEnded had been assigned
        // afterwards, the bound callback would be the prototype method and our
        // cleanup would never run.
        const source = sound.source;
        expect(source.onended).toBeTruthy();
        expect(source.onended).not.toBe(THREE.Audio.prototype.onEnded);

        // Fire the native 'ended' event -> our handler must run.
        source.__ended();

        // Base onEnded must have reset the playing state (bug #2).
        expect(sound.isPlaying).toBe(false);
    });

    it("chains to three base onEnded so isPlaying/_progress reset", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("beep", {duration: 1});

        const sound = sm.playGlobal("beep", 0.5, false);
        expect(sound.isPlaying).toBe(true);

        sound.source.__ended();

        // If we had replaced onEnded without chaining, isPlaying would stay true.
        expect(sound.isPlaying).toBe(false);
    });

    it("untracks and detaches a sound when it ends naturally", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("beep", {duration: 1});

        const sound = sm.playGlobal("beep", 0.5, false);
        expect(sm.instances.has(sound)).toBe(true);

        sound.source.__ended();
        expect(sm.instances.has(sound)).toBe(false);

        // The detach is deferred to a microtask.
        await Promise.resolve();
        await Promise.resolve();
        expect(sound.parent).toBeNull();
    });

    it("detects positional audio via the panner node, not isPositionalAudio", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("step", {duration: 1});

        const parent = new THREE.Object3D();
        const sound = sm.playPositional("step", parent, 1, 5, 1, 50, false);
        expect(sound).toBeTruthy();

        // three r183 has no `isPositionalAudio` flag...
        expect(sound.isPositionalAudio).toBeUndefined();
        // ...but PositionalAudio always has a panner.
        expect(sound.panner).toBeTruthy();

        const snap = sm.getDebugSnapshot();
        const meta = snap.nodes.find((n) => n.name === "step");
        expect(meta.positional).toBe(true);
    });

    it("release() stops, untracks and detaches a caller-owned loop", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("walk", {duration: 1});

        const parent = new THREE.Object3D();
        const sound = sm.playPositional("walk", parent, 0.8, 2, 1, 50, true);
        expect(sm.instances.has(sound)).toBe(true);

        sm.release(sound);
        expect(sound.isPlaying).toBe(false);
        expect(sm.instances.has(sound)).toBe(false);

        await Promise.resolve();
        await Promise.resolve();
        expect(sound.parent).toBeNull();
    });

    it("does not remove a sound from the scene graph during traversal", async () => {
        const {SoundManager} = await import("./SoundManager.js");
        const sm = new SoundManager();
        sm.init(new THREE.PerspectiveCamera());
        sm.sounds.set("step", {duration: 1});

        const parent = new THREE.Object3D();
        const sound = sm.playPositional("step", parent, 1, 5, 1, 50, false);

        // Simulate three's traversal: iterate children with a cached length.
        let crashed = null;
        try {
            const children = parent.children;
            for (let i = 0; i < children.length; i++) {
                // If a detach happened mid-traversal, children[i] would be undefined.
                children[i].updateMatrixWorld(true);
                sm.release(sound); // detach requested DURING traversal
            }
        } catch (e) {
            crashed = e;
        }
        expect(crashed).toBeNull();
    });

    describe("reverb (native ConvolverNode send/return)", () => {
        it("initializes a ConvolverNode, wet gain, and connects to destination", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            sm.init(new THREE.PerspectiveCamera());

            sm._initReverb();

            expect(sm.reverb).toBeTruthy();
            expect(sm.reverbGain).toBeTruthy();
            expect(sm.reverbSend).toBeTruthy();
            // Convolver should have a buffer (synthetic impulse response)
            expect(sm.reverb.buffer).toBeTruthy();
            // Wet gain defaults to 0.25
            expect(sm.reverbGain.gain.value).toBeCloseTo(0.25, 2);
            // ctx.createConvolver was called
            expect(ctx.createConvolver).toHaveBeenCalled();
        });

        it("setReverbWet adjusts the reverb gain", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            sm.init(new THREE.PerspectiveCamera());
            sm._initReverb();

            sm.setReverbWet(0.7);
            expect(sm.reverbWet).toBe(0.7);
            expect(sm.reverbGain.gain.value).toBeCloseTo(0.7, 2);

            // Clamp to [0, 1]
            sm.setReverbWet(-0.5);
            expect(sm.reverbWet).toBe(0);
            sm.setReverbWet(2.0);
            expect(sm.reverbWet).toBe(1);
        });

        it("setReverb toggles reverb on/off", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            sm.init(new THREE.PerspectiveCamera());
            sm._initReverb();

            expect(sm.reverbEnabled).toBe(true);
            sm.setReverb(false);
            expect(sm.reverbEnabled).toBe(false);
            sm.setReverb(true);
            expect(sm.reverbEnabled).toBe(true);
        });

        it("playGlobal wires a reverb send gain to the convolver", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            sm.init(new THREE.PerspectiveCamera());
            sm._initReverb();
            sm.sounds.set("beep", {duration: 1});

            const sound = sm.playGlobal("beep", 0.5, false);
            expect(sound).toBeTruthy();
            expect(sound.__reverbSend).toBeTruthy();
            // The send gain should be connected to the convolver
            expect(sound.__reverbSend.connect).toHaveBeenCalledWith(sm.reverb);
        });

        it("playPositional wires a reverb send gain to the convolver", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            sm.init(new THREE.PerspectiveCamera());
            sm._initReverb();
            sm.sounds.set("step", {duration: 1});

            const parent = new THREE.Object3D();
            const sound = sm.playPositional("step", parent, 1, 5, 1, 50, false);
            expect(sound).toBeTruthy();
            expect(sound.__reverbSend).toBeTruthy();
            expect(sound.__reverbSend.connect).toHaveBeenCalledWith(sm.reverb);
        });

        it("disconnects reverb send when a sound ends naturally", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            sm.init(new THREE.PerspectiveCamera());
            sm._initReverb();
            sm.sounds.set("beep", {duration: 1});

            const sound = sm.playGlobal("beep", 0.5, false);
            const send = sound.__reverbSend;
            expect(send).toBeTruthy();

            sound.source.__ended();
            expect(send.disconnect).toHaveBeenCalled();
            expect(sound.__reverbSend).toBeNull();
        });

        it("disconnects reverb send on release()", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            sm.init(new THREE.PerspectiveCamera());
            sm._initReverb();
            sm.sounds.set("walk", {duration: 1});

            const parent = new THREE.Object3D();
            const sound = sm.playPositional("walk", parent, 0.8, 2, 1, 50, true);
            const send = sound.__reverbSend;
            expect(send).toBeTruthy();

            sm.release(sound);
            expect(send.disconnect).toHaveBeenCalled();
            expect(sound.__reverbSend).toBeNull();
        });

        it("disconnects all reverb sends on stopAll()", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            sm.init(new THREE.PerspectiveCamera());
            sm._initReverb();
            sm.sounds.set("beep", {duration: 1});
            sm.sounds.set("step", {duration: 1});

            const s1 = sm.playGlobal("beep", 0.5, false);
            const s2 = sm.playGlobal("step", 0.5, false);
            expect(s1.__reverbSend).toBeTruthy();
            expect(s2.__reverbSend).toBeTruthy();

            // Save send refs before stopAll() nulls them out
            const send1 = s1.__reverbSend;
            const send2 = s2.__reverbSend;

            sm.stopAll();
            expect(send1.disconnect).toHaveBeenCalled();
            expect(send2.disconnect).toHaveBeenCalled();
            expect(s1.__reverbSend).toBeNull();
            expect(s2.__reverbSend).toBeNull();
        });

        it("does not create reverb sends when reverb is disabled", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            sm.init(new THREE.PerspectiveCamera());
            sm._initReverb();
            sm.setReverb(false);
            sm.sounds.set("beep", {duration: 1});

            const sound = sm.playGlobal("beep", 0.5, false);
            expect(sound.__reverbSend).toBeNull();
        });

        it("does not create reverb sends when reverb is not initialized", async () => {
            const {SoundManager} = await import("./SoundManager.js");
            const sm = new SoundManager();
            // Do NOT call init() — no listener, no reverb
            sm.sounds.set("beep", {duration: 1});

            const sound = sm.playGlobal("beep", 0.5, false);
            expect(sound).toBeNull(); // ensureRunning() fails without listener
        });
    });
});
