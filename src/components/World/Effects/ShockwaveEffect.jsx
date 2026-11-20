import {useContext, useLayoutEffect, useRef} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import {EffectComposerContext} from "@react-three/postprocessing";
import {ShockWaveEffect} from "postprocessing";
import {EffectPass} from "postprocessing";
import {Vector3} from "three";
import {useGameStore} from "../../../store/useGameStore";
import {PLAYER_BASELINE, getActionIntensity} from "../../../config/playerConfig";
import {debugLog} from "../../../utils/debugLog.js";

export function ShockwaveEffect({index}) {
    const {camera} = useThree();
    const {composer} = useContext(EffectComposerContext);
    const shockwaveData = useGameStore((state) => state.shockwaves[index]);
    const effectRef = useRef(null);
    const passRef = useRef(null);
    const baseAmplitude = PLAYER_BASELINE.shockwave.baseAmplitude;
    const lastIdRef = useRef(null);

    // Create the effect and EffectPass imperatively (matches postprocessing API)
    // ShockWaveEffect constructor: (camera, position: Vector3, options: {speed, maxRadius, waveSize, amplitude})
    useLayoutEffect(() => {
        if (!camera || !composer) return;
        const initialPos = new Vector3(0, 0, 0);
        effectRef.current = new ShockWaveEffect(camera, initialPos, {
            speed: 2.0,
            maxRadius: 1.0,
            waveSize: 0.0,
            amplitude: 0.05,
        });
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
    }, [camera, composer]);

    useFrame(() => {
        if (!effectRef.current) return;

        // Trigger explosion on new shockwave data
        if (shockwaveData && shockwaveData.position && shockwaveData.id !== lastIdRef.current) {
            lastIdRef.current = shockwaveData.id;
            const pos = new Vector3(shockwaveData.position[0], shockwaveData.position[1], shockwaveData.position[2]);
            effectRef.current.position.copy(pos);

            const currentPowerUp = useGameStore.getState().powerUp;
            const rawIntensity =
                shockwaveData.intensity ?? getActionIntensity("slideImpact", currentPowerUp?.rarity || "none");

            // Update effect parameters based on intensity
            effectRef.current.amplitude = rawIntensity * 0.01;
            effectRef.current.maxRadius = 1.0 * rawIntensity;
            effectRef.current.waveSize = 0.2 * rawIntensity;
            effectRef.current.speed = 2.0 + rawIntensity;

            debugLog("postprocessing", `Shockwave-- rawIntensity: ${rawIntensity} | baseAmplitude: ${baseAmplitude}`);

            debugLog(
                "postprocessing",
                `Shockwave-- amplitude: ${effectRef.current.amplitude} | maxRadius: ${effectRef.current.maxRadius} | waveSize: ${effectRef.current.waveSize} | speed: ${effectRef.current.speed}`
            );

            // Overide effect parameters for testing
            effectRef.current.maxRadius = 1.0 * rawIntensity;
            effectRef.current.waveSize = 0.2 * rawIntensity;
            effectRef.current.speed = 2.0 + rawIntensity;

            // Trigger the shock wave
            effectRef.current.explode();

            debugLog(
                "postprocessing",
                `Shockwave fired: index=${index} intensity=${rawIntensity.toFixed(
                    2
                )} position=[${shockwaveData.position.join(", ")}]`
            );
        }

        // Clear the shockwave slot once animation is complete
        if (lastIdRef.current) {
            const store = useGameStore.getState();
            const current = store.shockwaves[index];
            if (!current || current.id !== lastIdRef.current) {
                lastIdRef.current = null;
            }
        }
    });

    return null;
}
