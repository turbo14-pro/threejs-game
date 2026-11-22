import React, {useLayoutEffect, useMemo, useEffect, useRef} from "react";
import * as THREE from "three";
import {useTexture} from "@react-three/drei";
import {useThree} from "@react-three/fiber";
import {useGameStore} from "../../store/useGameStore";
import LightFollower from "./LightFollower";

export default function EnvironmentSetup() {
    const {scene} = useThree();
    const texture = useTexture("skybox/skybox-kitchen.webp");
    const settings = useGameStore((state) => state.settings);
    // Sun ref handed to LightFollower, which moves it each frame so it stays
    // 50 m above and 50 m north-east of the player.
    const sunLightRef = useRef(null);
    const playerBodyRef = useRef(null);

    const cabinetColor = useMemo(() => new THREE.Color("#cfc1ad"), []);

    // Shadow quality settings - camera size, map resolution, and bias per tier
    // Tighter camera = higher texel density = less banding
    const shadowConfig = useMemo(() => {
        switch (settings.shadowQuality) {
            case "None":
                return {enabled: false, size: 0, cameraSize: 0, bias: 0, normalBias: 0};
            case "Low":
                return {enabled: true, size: 512, cameraSize: 300, bias: -0.002, normalBias: 0.03, radius: 1};
            case "Medium":
                return {enabled: true, size: 1024, cameraSize: 512, bias: -0.0, normalBias: 0.0, radius: 0};
            case "High":
                return {enabled: true, size: 2048, cameraSize: 512, bias: -0.0, normalBias: 0.0, radius: 0.25};
            case "Ultra":
                return {enabled: true, size: 4096, cameraSize: 1024, bias: 0.001, normalBias: 0, radius: 5};
            default:
                return {enabled: true, size: 1024, cameraSize: 500, bias: -0.001, normalBias: 0.02};
        }
    }, [settings.shadowQuality]);

    const shadowMapSize = shadowConfig.size;
    const shadowCameraSize = shadowConfig.cameraSize;
    const shadowBias = shadowConfig.bias;
    const shadowNormalBias = shadowConfig.normalBias;
    const shadowsEnabled = shadowConfig.enabled;
    const shadowRadius = shadowConfig.radius;

    // Configure texture for equirectangular mapping
    useEffect(() => {
        if (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.repeat.set(2, 1);
            texture.needsUpdate = true;
        }
    }, [texture]);

    useLayoutEffect(() => {
        if (!settings.skybox) {
            scene.background = cabinetColor;
            // Re-apply fog since setting scene.background can reset it
            scene.fog = new THREE.FogExp2("#ac9173", 0.0045);
        } else {
            // Don't set background to null - let the skybox mesh show through
            scene.background = null;
            scene.fog = new THREE.FogExp2("#514b44", 0.0045);
        }
    }, [settings.skybox, scene, cabinetColor]);

    return (
        <>
            <hemisphereLight args={["#a2aab7", "#1f2525", 1.5]} />

            {/* Single shadow-casting directional light — always mounted, castShadow toggled.
     Key forces remount when quality tier changes (recreates shadow map properly).
     LightFollower drives its position each frame (player + 50 m east/north/up), so the
     initial position mirrors that offset and the shadow camera only needs a short depth range. */}
            <directionalLight
                key={settings.shadowQuality}
                ref={sunLightRef}
                position={[50, 50, 50]}
                intensity={3.0}
                color="#fff5e0"
                castShadow={shadowsEnabled}
                shadow-mapSize-width={shadowMapSize}
                shadow-mapSize-height={shadowMapSize}
                shadow-camera-left={-shadowCameraSize}
                shadow-camera-right={shadowCameraSize}
                shadow-camera-top={shadowCameraSize}
                shadow-camera-bottom={-shadowCameraSize}
                shadow-camera-near={1}
                shadow-camera-far={shadowCameraSize + 200}
                shadow-bias={shadowBias}
                shadow-normalBias={shadowNormalBias}
                shadow-radius={shadowRadius}
            />
            {/* Keeps the sun rigged to the player every frame */}
            <LightFollower lightRef={sunLightRef} playerBodyRef={playerBodyRef} />

            <directionalLight
                position={[-150, 200, -300]}
                intensity={0}
                color="#8ab4ff" // Cool sky fill (~8000K)
            />

            {/* Skybox background — only visible when enabled */}
            {settings.skybox && texture && (
                <mesh position={[0, 150, 0]} scale={[1, 0.5, 1]}>
                    <sphereGeometry args={[900, 64, 32]} />
                    <meshBasicMaterial
                        map={texture}
                        side={THREE.BackSide}
                        toneMapped={false}
                        depthWrite={true}
                        fog={false}
                    />
                </mesh>
            )}
        </>
    );
}
