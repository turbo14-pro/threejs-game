import {useEffect, useRef} from "react";
import {useThree} from "@react-three/fiber";
import * as THREE from "three";

import {useGameStore} from "../../store/useGameStore";
import {soundManager} from "../../utils/SoundManager";

/**
 * AmbientSFX — spawns amb-sfx one-shots near the player at random intervals.
 * Files are downloaded lazily via preloadAmbientSFX() in SoundListener.
 */
export default function AmbientSFX() {
    const {camera} = useThree();
    const ambientVolume = useGameStore((state) => state.audio.ambientVolume);
    const intervalRef = useRef(null);
    const enabledRef = useRef(true);

    useEffect(() => {
        // Kick off background download of amb-sfx files (one at a time)
        soundManager.preloadAmbientSFX();

        // Spawn random amb-sfx one-shots near the player
        const spawn = () => {
            if (!enabledRef.current) return;
            if (!camera) return;

            // Pick a random amb-sfx file
            const i = Math.floor(Math.random() * 10) + 1;
            const name = `amb-sfx${i.toString().padStart(2, "0")}`;

            // Only play if the buffer is cached
            if (!soundManager.sounds.has(name)) return;

            // Spawn at a random offset near the camera
            const offset = new THREE.Vector3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20);
            const pos = camera.position.clone().add(offset);

            // Create a temporary empty object to parent the sound to
            const dummy = new THREE.Object3D();
            dummy.position.copy(pos);

            soundManager.playAmbientSFX(name, dummy, ambientVolume);
        };

        // Random interval between 8-20 seconds
        const nextInterval = () => 8000 + Math.random() * 12000;

        intervalRef.current = setInterval(spawn, nextInterval());
        spawn(); // Play one immediately

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [camera]);

    return null;
}
