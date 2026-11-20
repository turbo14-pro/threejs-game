import {useRef, useEffect, forwardRef} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import {EffectComposerContext} from "@react-three/postprocessing";
import {Effect, EffectPass} from "postprocessing";
import {useContext} from "react";
import {useGameStore} from "../../../store/useGameStore";
import {getActionIntensity, PLAYER_BASELINE} from "../../../config/playerConfig";
import {debugLog} from "../../../utils/debugLog.js";

const fragmentShader = `
uniform float uIntensity;
uniform float uSamples;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 center = vec2(0.5, 0.5);
  vec2 dir = uv - center;
  float dist = length(dir);

  vec4 color = vec4(0.0);
  float total = 0.0;

  for (float i = 0.0; i < 32.0; i++) {
    if (i >= uSamples) break;
    float t = i / uSamples;
    float scale = 1.0 + t * dist * uIntensity;
    vec2 sampleUv = center + dir * scale;
    // Clamp to screen
    sampleUv = clamp(sampleUv, vec2(0.0), vec2(1.0));
    color += texture(inputBuffer, sampleUv);
    total += 1.0;
  }

  outputColor = color / total;
}
`;

class RadialBlur extends Effect {
    constructor({intensity = 0.0, samples = 16.0} = {}) {
        super("RadialBlur", fragmentShader, {
            uniforms: new Map([
                ["uIntensity", {value: intensity}],
                ["uSamples", {value: samples}],
            ]),
        });
    }

    update(_renderer, _inputBuffer, _deltaTime) {
        // Intensity is updated via uniforms from React
    }
}

const RadialBlurEffect = forwardRef(function RadialBlurEffect(props, ref) {
    const {camera} = useThree();
    const {composer} = useContext(EffectComposerContext);
    const effectRef = useRef();
    const passRef = useRef();
    const forwardedRef = useRef(ref);
    const dashStartTime = useRef(null);
    const wasDashing = useRef(false);
    const lastPlayerIsDashing = useRef(false);
    const mountLog = useRef(false);

    // Diagnostic: log mount and context availability
    if (!mountLog.current) {
        debugLog("postprocessing", `RadialBlurEffect mounted: composer=${!!composer} camera=${!!camera}`);
        mountLog.current = true;
    }

    // Create the effect and EffectPass imperatively to avoid circular JSON serialization
    // from Three.js scene/camera objects being passed through React props
    useEffect(() => {
        if (!composer) {
            debugLog("postprocessing", "RadialBlurEffect: NO COMPOSER available — effect will not be created");
            return;
        }
        effectRef.current = new RadialBlur();
        passRef.current = new EffectPass(camera, effectRef.current);
        composer.addPass(passRef.current);
        debugLog("postprocessing", "RadialBlurEffect: EffectPass added to composer");
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

    // Keep forwarded ref in sync (not used for effect instance — effectRef is separate)
    useEffect(() => {
        forwardedRef.current = ref;
    }, [ref]);

    useFrame((state, delta) => {
        const store = useGameStore.getState();
        const dashBlur = store.dashBlur;
        const powerUp = store.powerUp;
        const playerIsMoving = store.playerIsMoving;
        const playerIsDashing = store.playerIsDashing;

        const effect = effectRef.current;
        if (!effect) {
            debugLog("postprocessing", "RadialBlurEffect useFrame: effectRef is null — effect not created");
            return;
        }

        effect.uniforms.get("uSamples").value = 16.0;

        // Diagnostic: log playerIsDashing value changes
        if (playerIsDashing !== lastPlayerIsDashing.current) {
            debugLog("postprocessing", `playerIsDashing changed: ${lastPlayerIsDashing.current} → ${playerIsDashing}`);
            lastPlayerIsDashing.current = playerIsDashing;
        }

        // Track dash start/end for progress-based easing over full dash duration
        if (playerIsDashing && !wasDashing.current) {
            dashStartTime.current = state.clock.elapsedTime;
            wasDashing.current = true;
            debugLog("postprocessing", "Dash Started — radial blur active");
        }
        if (!playerIsDashing && wasDashing.current) {
            dashStartTime.current = null;
            wasDashing.current = false;
            debugLog("postprocessing", "Dash Ended — radial blur fading out");
        }

        let targetIntensity = 0;

        // Speed blur only active when player is actually moving (running)
        if (powerUp && powerUp.category === "speed" && playerIsMoving) {
            targetIntensity = getActionIntensity("speedBoost", powerUp.rarity);
        }

        // Dash blur: active whenever player is dashing (Q pressed), eases out over dash duration
        // dashBlur flag can force blur on even when not dashing (for console testing)
        if (playerIsDashing || dashBlur) {
            let baseIntensity = 0;
            if (powerUp && powerUp.category === "dash") {
                baseIntensity = getActionIntensity("dashBoost", powerUp.rarity);
            } else if (dashBlur) {
                // Console toggle enabled without active dash power-up — visible test blur
                baseIntensity = 5.0;
            } else {
                // Default dash blur intensity when dashing without a dash power-up
                baseIntensity = PLAYER_BASELINE.radialBlur.defaultIntensity;
            }

            if (baseIntensity > 0) {
                if (dashStartTime.current !== null) {
                    const elapsed = state.clock.elapsedTime - dashStartTime.current;
                    const progress = Math.min(1, elapsed / PLAYER_BASELINE.dash.duration);
                    // Quadratic ease-out: full strength early, fades to 0 at dash end
                    const easeOut = Math.pow(1 - progress, 2);
                    targetIntensity = baseIntensity * easeOut;
                } else {
                    // dashBlur forced on without active dash — full intensity, no ease-out
                    targetIntensity = baseIntensity;
                }
            }
        }

        const current = effect.uniforms.get("uIntensity").value;
        // Smooth delta-based lerp
        effect.uniforms.get("uIntensity").value +=
            (targetIntensity - current) * PLAYER_BASELINE.radialBlur.lerpSpeed * delta;

        if (targetIntensity > 0) {
            debugLog("postprocessing", `RadialBlur active: intensity=${targetIntensity.toFixed(2)}`);
        }
    });

    return null;
});

export default RadialBlurEffect;
