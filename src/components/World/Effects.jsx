import React, {useContext, useLayoutEffect} from "react";
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
import {HalfFloatType} from "three";
import {BlendFunction, KernelSize, ToneMappingMode} from "postprocessing";
import {useThree} from "@react-three/fiber";
import {useGameStore} from "../../store/useGameStore";
import {debugLog, setDebugCategory} from "../../utils/debugLog.js";
import {ShockwaveEffect} from "./Effects/ShockwaveEffect";
import RadialBlurEffect from "./Effects/RadialBlurEffect";
import GlitchEffect from "./Effects/GlitchEffect";
import RippleEffect from "./Effects/RippleEffect";

export default function Effects() {
    const settings = useGameStore((state) => state.settings);
    const {camera} = useThree();
    const composer = useContext(EffectComposerContext)?.composer;

    // Console command: toggleDashFX() / toggleDash() / setDashFX(boolean) — enables dash visual effects (shockwave + radial blur)
    // Console command: triggerTestShockwave() — spawns a visible test shockwave at origin
    // Console command: powerup(type) — gives player a platinum (diamond) powerup; type = slide | dash | jump | speed
    // Console command: debugLogCategory(type) — enables debug logging for a type (e.g. slide, dash, jump, speed, lights)
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
        window.debugLogCategory = (type, enabled = true) => {
            setDebugCategory(type, enabled);
            debugLog("postprocessing", `Debug logging ${enabled ? "enabled" : "disabled"} for type: ${type}`);
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
                <RippleEffect />

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
