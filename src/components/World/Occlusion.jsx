import {useRef} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import * as THREE from "three";
import {soundManager} from "../../utils/SoundManager";

/**
 * Occlusion — raycasts from camera to player and applies low-pass gain to the
 * ambient bed when the path is obstructed. Runs in useFrame for per-frame
 * occlusion updates.
 *
 * Player position is passed in as a prop (updated by PlayerController).
 */
export default function Occlusion({playerPos}) {
    const {camera} = useThree();
    const playerPosRef = useRef(playerPos ? new THREE.Vector3(...playerPos) : new THREE.Vector3(0, 0, 0));
    const raycasterRef = useRef(new THREE.Raycaster());
    const directionRef = useRef(new THREE.Vector3());

    // Update ref when prop changes
    if (playerPos) {
        playerPosRef.current.set(playerPos.x, playerPos.y, playerPos.z);
    }

    useFrame((state) => {
        if (!camera) return;

        const target = playerPosRef.current;
        const origin = camera.position;

        directionRef.current.subVectors(target, origin);
        const distance = directionRef.current.length();
        if (distance < 0.1) return;
        directionRef.current.normalize();

        raycasterRef.current.set(origin, directionRef.current);
        raycasterRef.current.far = distance;

        // Cast against scene children
        const scene = state.scene;
        const hits = raycasterRef.current.intersectObjects(scene.children, true);

        // Filter out hits that are the camera itself
        const obstructed = hits.some((hit) => hit.object !== camera && hit.distance < distance - 0.5);

        // Apply occlusion gain: 1.0 = no occlusion, 0.25 = heavy occlusion
        const gain = obstructed ? 0.25 : 1.0;
        soundManager.setOcclusionGain(gain);
    });

    return null;
}
