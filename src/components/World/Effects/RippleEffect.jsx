import {useContext, useLayoutEffect, useRef} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import {EffectComposerContext} from "@react-three/postprocessing";
import {Effect, EffectPass} from "postprocessing";
import {Uniform, Vector2} from "three";
import {useGameStore} from "../../../store/useGameStore";
import {debugLog} from "../../../utils/debugLog.js";

// --- RippleDisplacement as a proper postprocessing pass ---
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

// RippleDisplacementEffect — now a proper postprocessing pass (not a scene primitive)
function RippleDisplacementEffect() {
    const {camera} = useThree();
    const {composer} = useContext(EffectComposerContext);
    const effectRef = useRef();
    const passRef = useRef();
    const activeTimer = useRef(0);
    const debugTestTimer = useRef(0);
    const initialDuration = useRef(0.8);
    const wasActive = useRef(false);

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

export default RippleDisplacementEffect;
