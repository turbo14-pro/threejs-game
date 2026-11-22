import {useFrame, useThree} from "@react-three/fiber";
import {useGameStore} from "../../store/useGameStore";
import {useRef} from "react";
import * as THREE from "three";
import {debugLog} from "../../utils/debugLog.js";

/**
 * LightFollower
 *
 * Keeps the scene's directional (sun) light positioned 50 m above and 50 m
 * north-east of the player. If that desired position would fall outside a
 * 50 m radius around the player, the offset is scaled down so the light
 * stays exactly on the 50 m sphere.
 *
 * The shadow camera is also refreshed each frame so shadows follow the player
 * correctly across height changes and lateral movement.
 *
 * Handles light remounts (triggered by shadow quality key changes) by
 * removing the previous light's target from the scene.
 *
 * @param {{lightRef: import("react").RefObject<import("three").DirectionalLight>,
 *         playerBodyRef: import("react").RefObject<RigidBody>}} props
 *        `lightRef` points at the shadow-casting directional light to drive.
 *        `playerBodyRef` ref to the player's Rapier RigidBody (used for direct
 *        physics position instead of store read to avoid selector staleness).
 * @returns {null} This component renders no scene objects.
 */
export default function LightFollower({lightRef, playerBodyRef}) {
    const scene = useThree((state) => state.scene);
    const offset = new THREE.Vector3(50, 50, 50);
    const targetPos = new THREE.Vector3();
    const clampedTarget = new THREE.Vector3();
    const currentLightRef = useRef(null);

    useFrame(() => {
        const light = lightRef?.current;
        if (!light) return;

        // Light remounted (e.g. shadow quality changed) -> clean up old target.
        if (currentLightRef.current !== light) {
            if (currentLightRef.current?.target?.parent === scene) {
                scene.remove(currentLightRef.current.target);
            }
            currentLightRef.current = light;
        }

        // Ensure current light's target is in the scene so the light shines toward it.
        if (light.target.parent !== scene) {
            light.target.position.set(0, 0, 0);
            scene.add(light.target);
        }

        // Read player position from the Zustand store, which PlayerController
        // updates every frame via setPlayerPosition() inside useFrame. Reading
        // via getState() inside useFrame has no selector-staleness issues — we
        // are not subscribing, just reading the current value each frame.
        // Falls back to the Rapier body ref if it happens to be wired up.
        let pos = new THREE.Vector3(0, 0, 0);
        const storePos = useGameStore.getState().player.position;
        if (storePos && Number.isFinite(storePos.x) && Number.isFinite(storePos.y) && Number.isFinite(storePos.z)) {
            pos = new THREE.Vector3(storePos.x, storePos.y, storePos.z);
            debugLog("Lights", "storePos; pos=", {
                pos,
            });
        } else if (playerBodyRef?.current) {
            const translation = playerBodyRef.current.translation();
            if (Number.isFinite(translation[0]) && Number.isFinite(translation[1]) && Number.isFinite(translation[2])) {
                pos = new THREE.Vector3(translation[0], translation[1], translation[2]);
                debugLog("Lights", "playerBodyRef.current.translation(); pos=", {
                    pos,
                });
            }
        }

        // Desired light position: player + fixed offset
        targetPos.copy(pos).add(offset);

        // Clamp the light position to a 50 m radius around the player.
        const distance = pos.distanceTo(targetPos);
        if (distance > 50) {
            const scale = 50 / distance;
            clampedTarget.copy(pos).addScaledVector(offset, scale);
            light.position.copy(clampedTarget);
        } else {
            light.position.copy(targetPos);
        }

        // Target the player directly so the shadow frustum centers on them.
        light.target.position.copy(pos);
        light.target.updateMatrixWorld(true);

        if (light.shadow?.camera) {
            light.shadow.camera.updateProjectionMatrix();
            light.shadow.camera.updateMatrixWorld(true);
        }
    });

    return null;
}
