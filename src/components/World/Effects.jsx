import React, {useContext, useLayoutEffect, useRef} from "react";
import {
    Bloom,
    Noise,
    Vignette,
    EffectComposer,
    EffectComposerContext,
    FXAA,
    SMAA,
    ToneMapping,
    N8AO,
    TiltShift,
    DepthOfField,
} from "@react-three/postprocessing";
import {HalfFloatType, Uniform, Vector2, Vector3} from "three";
import {BlendFunction, Effect, EffectPass, KernelSize, ToneMappingMode} from "postprocessing";
import {useThree, useFrame} from "@react-three/fiber";
import {useGameStore} from "../../store/useGameStore";
import {debugLog, setDebugCategory} from "../../utils/debugLog.js";
import {ShockwaveEffect} from "./Effects/ShockwaveEffect";
import RadialBlurEffect from "./Effects/RadialBlurEffect";
import GlitchEffect from "./Effects/GlitchEffect";

// --- RippleDisplacement as a proper postprocessing pass (was <primitive object={effect} />) ---
const rippleFragmentShader = `
  uniform vec2 uCenter;
  uniform float uStrength;
  uniform float uWaveWidth;
  uniform float uRadius;
  uniform float uTime;

  void mainUv(inout vec2 uv) {
    vec2 centered = uv - uCenter;
    float dist = length(centered);
    float wave = exp(-abs(dist - uRadius) / max(uWaveWidth, 0.0001)) * uStrength;
    vec2 displacement = centered * wave;
    uv += displacement;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = inputColor;
  }
`;

class RippleDisplacement extends Effect {
    constructor() {
        super("RippleDisplacement", rippleFragmentShader, {
            uniforms: new Map([
                ["uCenter", new Uniform(new Vector2(0.5, 0.5))],
                ["uStrength", new Uniform(0.45)],
                ["uWaveWidth", new Uniform(0.4)],
                ["uRadius", new Uniform(0.05)],
                ["uTime", new Uniform(0.0)],
            ]),
        });
    }
}

function RippleDebugProjector() {
    const {camera, gl} = useThree();
    const debugEnabled = useGameStore((state) => state.debugRipple.enabled);
    const setRippleDebugScreenPosition = useGameStore((state) => state.setRippleDebugScreenPosition);
    const rippleWorldPosition = useGameStore((state) => state.debugRipple.worldPosition);

    useFrame(() => {
        if (!debugEnabled) return;
        if (!rippleWorldPosition) return;

        const worldPosition = new Vector3(rippleWorldPosition.x, rippleWorldPosition.y, rippleWorldPosition.z);
        worldPosition.project(camera);

        const width = gl.domElement.clientWidth || 1;
        const height = gl.domElement.clientHeight || 1;
        const x = (worldPosition.x * 0.5 + 0.5) * width;
        const y = (-worldPosition.y * 0.5 + 0.5) * height;

        setRippleDebugScreenPosition({x, y});
    });

    return null;
}

// RippleDisplacementEffect — now a proper postprocessing pass (not a scene primitive)
function RippleDisplacementEffect() {
    const {gl, camera} = useThree();
    const {composer} = useContext(EffectComposerContext);
    const effectRef = useRef();
    const passRef = useRef();
    const activeTimer = useRef(0);
    const debugTestTimer = useRef(0);
    const initialDuration = useRef(0.8);
    const wasActive = useRef(false);
    // Reused Vector2 to avoid per-frame GC
    const centerVec = useRef(new Vector2(0.5, 0.5)).current;

    // Create the effect and EffectPass imperatively to avoid circular JSON serialization
    // from Three.js scene/camera objects being passed through React props
    useLayoutEffect(() => {
        if (!composer) return;
        effectRef.current = new RippleDisplacement();
        passRef.current = new EffectPass(camera, effectRef.current);
        composer.addPass(passRef.current);
        return () => {
            if (composer && passRef.current) {
                composer.removePass(passRef.current);
                passRef.current.dispose();
            }
            if (effectRef.current) {
                effectRef.current.dispose();
            }
        };
    }, [composer, camera]);

    useFrame((state, delta) => {
        const storeState = useGameStore.getState();
        const debugEnabled = storeState.debugRipple.enabled;
        const debugScreenPos = storeState.debugRipple.screenPosition;

        if (debugEnabled) {
            debugTestTimer.current += delta;
            if (debugTestTimer.current >= 6.0) {
                debugTestTimer.current = 0;
                storeState.triggerRipple(0.8);
                const wp = storeState.debugRipple.worldPosition;
                storeState.addShockwave([wp.x, wp.y, wp.z], 1.0);
                debugLog("effects", "🧪 DEBUG: Auto-triggered rippleTimer + shockwave = 0.8s");
            }
        } else {
            debugTestTimer.current = 0;
        }

        const freshRippleTimer = storeState.rippleTimer;

        if (freshRippleTimer > 0 && activeTimer.current <= 0) {
            // 5x faster fadeout + wave speed: shrink both timers
            activeTimer.current = freshRippleTimer / 5;
            initialDuration.current = freshRippleTimer / 5;
            storeState.setRippleTimer(0);
        } else if (freshRippleTimer > 0) {
            storeState.setRippleTimer(0);
        }

        const isActive = activeTimer.current > 0;

        if (!isActive) {
            // Always kill strength when inactive so the effect doesn't render
            // with its constructor default (0.045) on first mount.
            effectRef.current.uniforms.get("uStrength").value = 0;
            wasActive.current = false;
            return;
        }
        wasActive.current = true;

        activeTimer.current = Math.max(0, activeTimer.current - delta);

        const center =
            debugEnabled && debugScreenPos
                ? new Vector2(
                      debugScreenPos.x / gl.domElement.clientWidth,
                      1.0 - debugScreenPos.y / gl.domElement.clientHeight
                  )
                : centerVec.set(0.5, 0.5);

        const decay = Math.min(1, activeTimer.current / (initialDuration.current || 0.8));

        effectRef.current.uniforms.get("uCenter").value = new Vector2(0.4, 0.45);
        effectRef.current.uniforms.get("uStrength").value = 0.045 * 5 * decay;
        effectRef.current.uniforms.get("uWaveWidth").value = 0.04;
        effectRef.current.uniforms.get("uRadius").value = 0.05 + (1 - decay);
        effectRef.current.uniforms.get("uTime").value = state.clock.elapsedTime;

        debugLog(
            "postprocessing",
            `RippleDisplacement active: strength=${(0.045 * decay).toFixed(4)} decay=${decay.toFixed(2)}`
        );
    });

    return null;
}

export default function Effects() {
    const settings = useGameStore((state) => state.settings);
    const {camera} = useThree();
    const composer = useContext(EffectComposerContext)?.composer;

    // Console command: toggleDashFX() / toggleDash() / setDashFX(boolean) — enables dash visual effects (shockwave + radial blur)
    // Console command: triggerTestShockwave() — spawns a visible test shockwave at origin
    // Console command: powerup(type) — gives player a platinum (diamond) powerup; type = slide | dash | jump | speed
    // Console command: debugLogCategory(type) — enables debug logging for a type (e.g. slide, dash, jump, speed)
    if (typeof window !== "undefined") {
        const applyDashFX = (enabled) => {
            const store = useGameStore.getState();
            const next = Boolean(enabled);
            store.setDashBlur(next);
            store.setSetting("shockwave", next);
            debugLog("postprocessing", `Dash visual effects ${next ? "ON" : "OFF"} (shockwave + radial blur)`);
        };
        window.setDashFX = applyDashFX;
        window.shockwaveFX = () => {
            const store = useGameStore.getState();
            store.addShockwave([0, 0, 0], 2.0);
            debugLog("postprocessing", "Test shockwave triggered at [0, 0, 0]");
        };
        window.powerup = (type) => {
            const validTypes = ["slide", "dash", "jump", "speed"];
            if (!validTypes.includes(type)) {
                debugLog("postprocessing", `Invalid powerup type "${type}". Use: ${validTypes.join(", ")}`);
                return;
            }
            const store = useGameStore.getState();
            store.collectPowerUp(type, "diamond");
            debugLog("postprocessing", `Powerup granted: ${type} (diamond/platinum)`, store.powerUp);
        };
        // Renamed from window.debugger to avoid overriding the native debugger statement
        window.debugLogCategory = (type) => {
            setDebugCategory(type, true);
            debugLog("postprocessing", `Debug logging enabled for type: ${type}`);
        };
    }

    // Main camera should see everything
    useLayoutEffect(() => {
        camera.layers.enableAll();
    }, [camera]);

    // Dispose composer and passes on unmount
    useLayoutEffect(() => {
        return () => {
            if (composer?.dispose) {
                composer.dispose();
            }
        };
    }, [composer]);

    // Dynamic focus logic removed for performance

    return (
        <>
            <RippleDebugProjector />
            <EffectComposer disableNormalPass multisampling={0} frameBufferType={HalfFloatType}>
                {/* FXAA MUST BE FIRST to avoid haloing on other passes */}
                {settings.antialiasing === "FXAA" && <FXAA />}

                {settings.ssao && (
                    <N8AO
                        aoRadius={2}
                        aoSamples={16}
                        denoiseSamples={4}
                        denoiseRadius={8}
                        distanceFalloff={1}
                        intensity={1.5}
                        color="black"
                    />
                )}
                <RippleDisplacementEffect />

                <>
                    <ShockwaveEffect index={0} />
                    <ShockwaveEffect index={1} />
                    <ShockwaveEffect index={2} />
                </>
                {/* Radial blur: active when player is dashing (Q pressed), eases out over dash duration */}
                <RadialBlurEffect />

                {settings.tiltShift && (
                    <TiltShift
                        blendFunction={BlendFunction.SRC}
                        rotation={0}
                        offset={-0}
                        feather={10}
                        focusArea={3.5}
                        kernelSize={KernelSize.VERY_LARGE}
                    />
                )}
                {settings.depthOfField && (
                    <DepthOfField
                        blendFunction={BlendFunction.NORMAL}
                        bokehScale={4}
                        focusRange={500}
                        focusDistance={20}
                    />
                )}

                {settings.vignette && <Vignette eskil={false} offset={0} darkness={1} />}

                {settings.grain && <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />}

                {/* Always on per requirements */}
                <Bloom
                    intensity={1.0}
                    luminanceThreshold={0.7}
                    luminanceSmoothing={0.5}
                    blendFunction={BlendFunction.ADD}
                    mipmapBlur={true}
                    radius={0.3}
                    height={300}
                />

                {/* SMAA after color/bloom for best results, before ToneMapping */}
                {settings.antialiasing === "SMAA" && <SMAA />}

                <ToneMapping mode={ToneMappingMode.CINEON} />

                {/* Dynamic: Glitch + Shockwave on slide impact (GlitchEffect self-manages its timer) */}
                <GlitchEffect />

                {/* Console command: triggerTestShockwave() — spawns a test shockwave at player position */}
            </EffectComposer>
        </>
    );
}
