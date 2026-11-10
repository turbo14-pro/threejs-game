import React, {useEffect, useMemo, useRef, useState, memo} from "react";
import {useShallow} from "zustand/react/shallow";
import {useGLTF} from "@react-three/drei";
import {useFrame} from "@react-three/fiber";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {useGameStore} from "../../store/useGameStore";

/**
 * Add a soft, bright rim light while preserving the character's base colors.
 */
const applyCharacterMaterials = (material) => {
    material.dithering = true;
    material.flatShading = false;

    const isDark = material.name.toLowerCase().includes("dark");

    material.onBeforeCompile = (shader) => {
        shader.uniforms.rimIntensity = {value: 2.0};
        shader.uniforms.rimColor = {value: new THREE.Color(0.8, 0.9, 1.0)};
        shader.uniforms.bumpScale = {value: isDark ? 0.2 : 0.0}; // stronger bump for dark material

        shader.fragmentShader = `
      uniform float rimIntensity;
      uniform vec3 rimColor;
      uniform float bumpScale;
      float getNoise(vec2 p) {
        return fract(sin(dot(p, vec2(12.989, 78.233))) * 43758.545) - 0.5;
      }
      ${shader.fragmentShader}
    `
        .replace(
            "#include <normal_fragment_begin>",
            `
      #include <normal_fragment_begin>
      if (bumpScale > 0.0) {
        #ifdef USE_UV
          float n = getNoise(vUv * 60.0) * bumpScale;
        #else
          float n = getNoise(gl_FragCoord.xy * 0.1) * bumpScale;
        #endif
        normal = normalize(normal + vec3(n, n, 0.0));
      }
      `
        )
        .replace(
            "#include <emissive_fragment>",
            `
      #include <emissive_fragment>
      vec3 rimNormal = normalize(normal);
      vec3 viewDir = normalize(-vViewPosition);
      float rim = pow(1.0 - clamp(dot(rimNormal, viewDir), 0.0, 1.0), 2.5) * rimIntensity;
      totalEmissiveRadiance += rimColor * rim;
      `
        );
    };
    return material;
};

const PlayerModel = ({
    isMoving,
    moveDir,
    isSprinting,
    jumpPhase = "none",
    isSliding = false,
    hSpeed = 0,
    onFootstep,
    config,
    skinOverride,
    jumpTransitionId = 0,
}) => {
    const {localSkin, globalAnimConfig} = useGameStore(
        useShallow((state) => ({
            localSkin: state.player.selectedSkin,
            globalAnimConfig: state.player.playerAnimations,
        }))
    );

    // If no skin is provided by the server, we use 'avo' as the base look.
    // We only use the local skin if this is our own character (skinOverride is undefined).
    const selectedSkin = skinOverride || (skinOverride === undefined ? localSkin : "avo");

    const isAvo = selectedSkin === "avo";

    const activeConfig = useMemo(() => {
        return (
            config ||
            globalAnimConfig || {
                idle: "melee.idle.glb",
                walk_for: "melee.walk.for.glb",
                walk_bac: "melee.walk.bac.glb",
                run_for: "melee.run.for.glb",
                run_bac: "melee.run.bac.glb",
                slide: "melee.slide.glb",
                doublejump: {file: "melee.doublejump.glb", frames: 20},
                doublejump_back: {file: "melee.doublejumpback.glb", frames: 27},
                jump: {file: "melee.jump.glb", launchFrames: 4, landFrames: 10},
                run_jump: {file: "melee.run.jump.glb", launchFrames: 4, landFrames: 10},
            }
        );
    }, [config, JSON.stringify(globalAnimConfig)]);

    const {scene: avoScene} = useGLTF("skins/skin_avo.glb");
    const {scene: eggScene} = useGLTF("skins/skin_egg.glb");

    const {animations: idleClips} = useGLTF(`skins/actions/${activeConfig.idle}`);
    const {animations: walkForClips} = useGLTF(`skins/actions/${activeConfig.walk_for}`);
    const {animations: walkBacClips} = useGLTF(`skins/actions/${activeConfig.walk_bac}`);
    const {animations: runForClips} = useGLTF(`skins/actions/${activeConfig.run_for}`);
    const {animations: runBacClips} = useGLTF(`skins/actions/${activeConfig.run_bac}`);
    const {animations: slideClips} = useGLTF(`skins/actions/${activeConfig.slide || "melee.slide.glb"}`);

    const djFile =
        activeConfig.doublejump?.file ||
        (typeof activeConfig.doublejump === "string" ? activeConfig.doublejump : "melee.doublejump.glb");
    const djbFile =
        activeConfig.doublejump_back?.file ||
        (typeof activeConfig.doublejump_back === "string" ? activeConfig.doublejump_back : "melee.doublejumpback.glb");

    const {animations: doubleJumpClips} = useGLTF(`skins/actions/${djFile}`);
    const {animations: doubleJumpBacClips} = useGLTF(`skins/actions/${djbFile}`);

    const {animations: jumpFileClips} = useGLTF(`skins/actions/${activeConfig.jump.file}`);
    const {animations: runJumpFileClips} = useGLTF(`skins/actions/${activeConfig.run_jump.file}`);

    const sourceScene = isAvo ? avoScene : eggScene;
    const scale = 2.0;

    const actionsRef = React.useRef({});
    const prevAnimState = React.useRef(null);
    const cycleTimeRef = React.useRef("none"); // "left" | "right" | "none"

    const clone = useMemo(() => {
        if (!sourceScene) return null;
        const c = SkeletonUtils.clone(sourceScene);
        c.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                const applyMaterial = (material) => applyCharacterMaterials(material.clone());
                node.material = Array.isArray(node.material)
                    ? node.material.map(applyMaterial)
                    : applyMaterial(node.material);
            }
        });
        return c;
    }, [sourceScene]);

    // Determine the correct animation state based on movement and jump status
    const animState = useMemo(() => {
        if (jumpPhase === "doublejump") {
            return moveDir === "bac" ? "doublejump_back" : "doublejump";
        }
        if (jumpPhase !== "none") {
            const jumpPrefix = isSprinting ? "run_jump" : "jump";
            // Map 'air' to 'loop' to match our subclip naming
            const phase = jumpPhase === "air" ? "loop" : jumpPhase;
            return `${jumpPrefix}_${phase}`;
        }
        if (isSliding) {
            return "slide";
        }
        if (isMoving) {
            const movePrefix = isSprinting ? "run" : "walk";
            return `${movePrefix}_${moveDir}`;
        }
        return "idle";
    }, [isMoving, isSprinting, jumpPhase, moveDir, isSliding]);
    // 1. Initialize Mixer
    const mixer = useMemo(() => {
        if (!clone) return null;
        return new THREE.AnimationMixer(clone);
    }, [clone]);

    // 2. Setup Actions ONCE per mixer/config
    useEffect(() => {
        if (!mixer || !idleClips) return;

        mixer.stopAllAction();
        const newActions = {};
        const FPS = 30;

        const processClips = (clips, prefix) => {
            if (!clips) return;
            clips.forEach((clip, i) => {
                const c = clip.clone();
                c.name = `${prefix}_${i}`;
                c.tracks.forEach((track) => {
                    if (track.name.includes(".")) {
                        const parts = track.name.split(".");
                        if (parts.length > 2) {
                            track.name = parts.slice(-2).join(".");
                        }
                    }
                });
                newActions[c.name] = mixer.clipAction(c);
            });
        };

        const processJump = (clips, prefix, cfg) => {
            if (!clips || !clips[0]) return;
            const mainClip = clips[0];
            const totalFrames = Math.round(mainClip.duration * FPS);
            const launchEnd = cfg.launchFrames;
            const loopEnd = cfg.loopFrames ? launchEnd + cfg.loopFrames : totalFrames - cfg.landFrames;
            const landStart = cfg.loopFrames ? loopEnd : totalFrames - cfg.landFrames;

            const launch = THREE.AnimationUtils.subclip(mainClip, `${prefix}_launch_0`, 0, launchEnd, FPS);
            const loop = THREE.AnimationUtils.subclip(mainClip, `${prefix}_loop_0`, launchEnd, loopEnd, FPS);
            const land = THREE.AnimationUtils.subclip(mainClip, `${prefix}_land_0`, landStart, totalFrames, FPS);

            [launch, loop, land].forEach((c) => {
                c.tracks.forEach((track) => {
                    if (track.name.includes(".")) {
                        const parts = track.name.split(".");
                        if (parts.length > 2) {
                            track.name = parts.slice(-2).join(".");
                        }
                    }
                });
                newActions[c.name] = mixer.clipAction(c);
            });
        };

        processClips(idleClips, "idle");
        processClips(walkForClips, "walk_for");
        processClips(walkBacClips, "walk_bac");
        processClips(runForClips, "run_for");
        processClips(runBacClips, "run_bac");
        processClips(slideClips, "slide");
        processClips(doubleJumpClips, "doublejump");
        processClips(doubleJumpBacClips, "doublejump_back");
        processJump(jumpFileClips, "jump", activeConfig.jump);
        processJump(runJumpFileClips, "run_jump", activeConfig.run_jump);

        actionsRef.current = newActions;

        // Play idle by default if nothing is playing
        if (newActions["idle_0"]) {
            newActions["idle_0"].play();
            prevAnimState.current = "idle_0";
        }

        return () => {
            if (mixer) mixer.stopAllAction();
        };
    }, [
        mixer,
        idleClips,
        walkForClips,
        walkBacClips,
        runForClips,
        runBacClips,
        slideClips,
        doubleJumpClips,
        doubleJumpBacClips,
        jumpFileClips,
        runJumpFileClips,
        activeConfig,
        JSON.stringify(activeConfig),
    ]);

    // Keep the blob shadow glued to the ground under the character: the shadow
    // mesh is a child of the model group, so subtract the world Y to cancel the
    // body's height. Below the table (y < -1, e.g. falling off or hidden while
    // downed) the shadow hides instead of floating at table height.

    useEffect(() => {
        const actions = actionsRef.current;
        if (!actions || Object.keys(actions).length === 0) return;

        const keys = Object.keys(actions);
        const targetKey = keys.find((k) => k.startsWith(animState)) || keys[0];
        const action = actions[targetKey];
        const prevAction = actions[prevAnimState.current];

        if (!action) return;

        const shouldRestart =
            prevAnimState.current === targetKey && (jumpPhase === "doublejump" || jumpPhase === "launch");

        if (prevAnimState.current !== targetKey || shouldRestart) {
            let fadeTime = 0.2;
            if (animState.includes("launch")) fadeTime = 0.05;
            if (animState.includes("loop")) fadeTime = 2 / 30;

            if (prevAction) {
                prevAction.fadeOut(fadeTime);
            }

            action.reset();
            action.setEffectiveWeight(1);
            action.fadeIn(fadeTime);
            action.play();

            if (
                animState.includes("launch") ||
                animState.includes("land") ||
                animState.includes("doublejump") ||
                animState === "slide"
            ) {
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
            } else {
                action.setLoop(THREE.LoopRepeat, Infinity);
                action.clampWhenFinished = false;
            }

            prevAnimState.current = targetKey;
        }

        // Always update speed — tie walk/run animation speed to actual velocity
        // so the visual cycle matches the footstep audio playback rate.
        // Walk is much slower than run, so the animation must reflect that:
        // walk speedScale ranges from 0.5 (at 0.5 m/s) to 1.0 (at 4 m/s),
        // run speedScale ranges from 1.0 (at 4 m/s) to 1.5 (at 35 m/s).
        let speedScale = 1.0;
        if (animState.includes("land")) {
            speedScale = 1.6;
        } else if (animState.includes("walk")) {
            // Scale from 0.5 (at 0.5 m/s) to 1.0 (at walkSpeed = 4 m/s)
            const t = Math.max(0, Math.min(1, (hSpeed - 0.5) / (4 - 0.5)));
            speedScale = 0.5 + t * 0.5;
        } else if (animState.includes("run")) {
            // Scale from 1.0 (at walkSpeed = 4 m/s) to 1.5 (at sprintSpeed = 35 m/s)
            const t = Math.max(0, Math.min(1, (hSpeed - 4) / (35 - 4)));
            speedScale = 1.0 + t * 0.5;
        }

        action.setEffectiveTimeScale(speedScale);
    }, [animState, activeConfig, mixer, jumpTransitionId, jumpPhase]);

    const blobShadowRef = useRef();

    useFrame((state, delta) => {
        if (mixer) mixer.update(delta);

        // --- Footstep timing — left at cycle start, right at cycle midpoint ---
        // Uses animation time so footsteps are perfectly synced to the animation
        // cycle (not a drifting timer) and fire immediately when movement starts.
        const actions = actionsRef.current;
        const targetKey = actions && Object.keys(actions).length > 0
            ? Object.keys(actions).find((k) => k.startsWith(animState)) || Object.keys(actions)[0]
            : null;
        const action = actions?.[targetKey];
        if (action && onFootstep) {
            const clipName = action._clip?.name || "";
            if (clipName.includes("walk") || clipName.includes("run")) {
                const time = action.time % action._clip.duration;
                const cycle = time / action._clip.duration;

                if (cycle < 0.05 && cycleTimeRef.current !== "left") {
                    onFootstep("left");
                    cycleTimeRef.current = "left";
                } else if (cycle >= 0.45 && cycle < 0.55 && cycleTimeRef.current !== "right") {
                    onFootstep("right");
                    cycleTimeRef.current = "right";
                } else if (cycle >= 0.95) {
                    cycleTimeRef.current = "none";
                }
            } else {
                cycleTimeRef.current = "none";
            }
        }

        // Keep the blob shadow glued to the ground under the character: the shadow
        // mesh is a child of the model group, so subtract the world Y to cancel the
        // body's height. Below the table (y < -1, e.g. falling off or hidden while
        // downed) the shadow hides instead of floating at table height.
        if (blobShadowRef.current && clone) {
            const worldPos = new THREE.Vector3();
            clone.getWorldPosition(worldPos);
            if (worldPos.y < -1) {
                blobShadowRef.current.visible = false;
            } else {
                blobShadowRef.current.visible = true;
                blobShadowRef.current.position.y = -worldPos.y + 0.05;
            }
        }
    });

    const blobShadowTexture = useMemo(() => {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, "rgba(0,0,0,0.35)");
        gradient.addColorStop(0.5, "rgba(0,0,0,0.15)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }, []);

    return (
        <group>
            <primitive object={clone} scale={[scale, scale, scale]} />
            {/* Blob shadow — soft radial circle on the ground for visual grounding */}
            <mesh ref={blobShadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                <planeGeometry args={[2.5, 2.5]} />
                <meshBasicMaterial map={blobShadowTexture} transparent depthWrite={false} />
            </mesh>
        </group>
    );
};

export default memo(PlayerModel);

useGLTF.preload("skins/skin_avo.glb");
useGLTF.preload("skins/skin_egg.glb");
useGLTF.preload(`skins/actions/melee.idle.glb`);
useGLTF.preload(`skins/actions/melee.walk.for.glb`);
useGLTF.preload(`skins/actions/melee.walk.bac.glb`);
useGLTF.preload(`skins/actions/melee.run.for.glb`);
useGLTF.preload(`skins/actions/melee.run.bac.glb`);
useGLTF.preload(`skins/actions/melee.slide.glb`);
useGLTF.preload(`skins/actions/melee.doublejump.glb`);
useGLTF.preload(`skins/actions/melee.doublejumpback.glb`);
useGLTF.preload(`skins/actions/melee.jump.glb`);
useGLTF.preload(`skins/actions/melee.run.jump.glb`);
