import React, {useRef} from "react";
import {useFrame} from "@react-three/fiber";
import {Glitch} from "@react-three/postprocessing";
import {useGameStore} from "../../../store/useGameStore";
import {debugLog} from "../../../utils/debugLog.js";

function GlitchEffect() {
    const settings = useGameStore((state) => state.settings);
    const activeTimer = useRef(0);
    const initialDuration = useRef(0.4);

    useFrame((state, delta) => {
        const freshTimer = useGameStore.getState().slideImpactTimer;

        if (freshTimer > 0 && activeTimer.current <= 0) {
            activeTimer.current = freshTimer;
            initialDuration.current = freshTimer;
            useGameStore.getState().setSlideImpactTimer(0);
            debugLog("postprocessing", `Glitch activated: duration=${freshTimer.toFixed(2)}s`);
        }

        if (activeTimer.current > 0) {
            activeTimer.current = Math.max(0, activeTimer.current - delta);
        }
    });

    const intensity = activeTimer.current / (initialDuration.current || 0.4);

    if (activeTimer.current <= 0) return null;

    return (
        <Glitch
            active={settings.glitch}
            duration={activeTimer.current}
            strength={intensity * 1.5}
            chromaticAberrationOffset={0.03 * intensity}
            mode="CONSTANT"
        />
    );
}

export default GlitchEffect;
