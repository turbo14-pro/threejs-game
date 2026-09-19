import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import PlayerModel from './PlayerModel.jsx';
import { useGameStore } from '../../store/useGameStore';
import { BotBrain, shouldRegisterTag, TAG_COOLDOWN } from './BotAI.jsx';
import { getLocalPlayerWorldPos } from '../World/items/PowerUpCoin.jsx';
import { SKINS } from '../../data/registries';

/**
 * THE BOT PLAYER
 * Renders a CPU opponent and drives it from the BotAI brain.
 *
 * Movement is kinematic (like RemotePlayer) rather than a full Rapier character
 * controller, because the human's PlayerController is a singleton bound to the camera,
 * pointer-lock and local-player store state — a second instance would fight over all three.
 * The brain still produces the exact `mobileInput` shape PlayerController consumes, so the
 * same decision logic can be handed to a real controller later if that is ever refactored.
 */

// Matches the arena's gravity in GameCanvas.jsx (<Physics gravity={[0, -90.81, 0]}>)
const BOT_GRAVITY = 90.81;
// Matches PlayerController's single-jump impulse
const BOT_JUMP_SPEED = 38;
// Cruising speeds (units/sec) between PlayerController's walk (8) and sprint (30)
const BOT_SPRINT_SPEED = 22;
const BOT_WALK_SPEED = 11;
// Clamp delta so a stalled tab cannot teleport a bot across the arena
const MAX_STEP = 0.05;
// The arena's ground/platform collision group, as used by PlayerController's ground probe
const GROUND_FILTER = 0x00010001;
// Stop pressing into the human once we are this close
const ARRIVE_DISTANCE = 2.0;
// Snap down to a surface within this distance instead of floating above it
const MAX_STICK_DOWN = 0.6;
// Safety net only — the arena table's surface is y≈0 (Arena.jsx: RigidBody [0,-1,0] + 600x2x600)
const RESPAWN_FLOOR_Y = -80;

const SPAWN = { x: 0, y: 103, z: 0 };

// Keeps each bot out of its teammates' spawn point (lobby platform 1)
const spawnForIndex = (index) => ({
  x: (index - 1) * 5,
  y: SPAWN.y,
  z: SPAWN.z - 6,
});

export default function BotPlayer({ bot }) {
  const bodyRef = useRef();
  const modelRef = useRef();
  const { world, rapier } = useRapier();

  // Each bot owns its own brain so boot-up delay and animation state are independent
  const brainRef = useRef(null);
  if (brainRef.current === null) {
    brainRef.current = new BotBrain({ difficulty: bot.difficulty, name: bot.name });
  }

  const spawn = useMemo(() => spawnForIndex(bot.spawnIndex ?? 0), [bot.spawnIndex]);
  // Give each bot a different skin from the master registry so they are easy to tell apart
  const skin = SKINS[(bot.spawnIndex ?? 0) % SKINS.length].id;

  const stateRef = useRef({
    pos: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
    vy: 0,
    yaw: Math.PI,
    grounded: true,
    lastTagAt: -Infinity,
    lastDebug: null,
  });

  const [anim, setAnim] = useState({ mv: false, dir: 'for', spr: false, jp: 'none' });

  const groundShape = useMemo(() => (rapier ? new rapier.Ball(0.5) : null), [rapier]);
  const addMatchScore = useGameStore(s => s.addMatchScore);

  useFrame((frameState, delta) => {
    if (!bodyRef.current) return;

    const s = stateRef.current;
    const brain = brainRef.current;
    const step = Math.min(delta, MAX_STEP);

    // Match PlayerController: freeze during PREMATCH and the DROP countdown
    const { game, matchScore } = useGameStore.getState();
    const frozen = game.phase === 'PREMATCH' || (game.phase === 'DROP' && game.countdown > 0);
    if (frozen) {
      s.vy = 0;
      return;
    }

    // The human's position is published by PlayerController every frame
    const target = getLocalPlayerWorldPos();

    const input = brain.update(step, {
      bot: { x: s.pos.x, y: s.pos.y, z: s.pos.z, rotationY: 0 },
      target,
      targetScore: matchScore.player,
      botScore: matchScore.bots,
    });
    const debug = brain.lastDebug;
    s.lastDebug = debug;

    // --- GROUND PROBE: same castShape technique PlayerController uses ---
    let groundY = null;
    if (groundShape) {
      const hit = world.castShape(
        s.pos,
        { w: 1, x: 0, y: 0, z: 0 },
        { x: 0, y: -1, z: 0 },
        groundShape,
        0.0,
        3.0,
        true,
        null,
        GROUND_FILTER,
        null,
        bodyRef.current
      );
      if (hit) groundY = s.pos.y - hit.time_of_impact;
      // Only "grounded" when the surface is within stepping distance — a platform 3m below
      // is a ledge to fall off, not something to stand on.
      s.grounded = groundY !== null && (s.pos.y - groundY) <= MAX_STICK_DOWN;
    }

    // --- VERTICAL ---
    const canJump = input.jump && s.grounded && s.vy <= 0;
    if (canJump) {
      s.vy = BOT_JUMP_SPEED;
      s.grounded = false;
      s.pos.y += s.vy * step;
    } else if (groundY !== null && s.vy <= 0 && (s.pos.y - groundY) <= MAX_STICK_DOWN) {
      // Stick to the surface so bots can walk down slopes and small steps without floating
      s.pos.y = groundY;
      s.vy = 0;
      s.grounded = true;
    } else {
      // Nothing in reach (or falling): integrate gravity off the ledge
      s.vy -= BOT_GRAVITY * step;
      s.pos.y += s.vy * step;
      s.grounded = false;
    }
    // Never fall out of the world if the arena has a hole under a platform
    if (s.pos.y < RESPAWN_FLOOR_Y) {
      s.pos.set(spawn.x, spawn.y, spawn.z);
      s.vy = 0;
      s.grounded = true;
    }

    // --- HORIZONTAL: ease off as we arrive so bots do not shove into the player ---
    const distance = debug?.distance ?? null;
    const arrival = distance === null
      ? 1
      : Math.max(0, Math.min(1, (distance - ARRIVE_DISTANCE) / ARRIVE_DISTANCE));
    const speed = input.sprint ? BOT_SPRINT_SPEED : BOT_WALK_SPEED;
    s.pos.x += input.x * speed * arrival * step;
    s.pos.z += input.y * speed * arrival * step;

    // --- TAG SCORING: drives the bots' side of the adaptive difficulty ---
    if (shouldRegisterTag({ distance, lastTagAt: s.lastTagAt, now: frameState.clock.elapsedTime, cooldown: TAG_COOLDOWN })) {
      s.lastTagAt = frameState.clock.elapsedTime;
      addMatchScore('bots', 1);
    }

    // --- FACING: smooth toward the travel direction ---
    if (debug && Number.isFinite(debug.targetRotationY)) {
      s.yaw = THREE.MathUtils.damp(s.yaw, debug.targetRotationY, 8, step);
    }
    if (modelRef.current) modelRef.current.rotation.y = s.yaw;

    // --- APPLY: kinematic body follows the integrated position ---
    bodyRef.current.setNextKinematicTranslation(s.pos);

    // --- ANIMATION: only re-render on an actual change, not every frame ---
    const next = brain.getAnimationState(input, s.grounded);
    setAnim(prev => (
      prev.mv === next.mv && prev.dir === next.dir && prev.spr === next.spr && prev.jp === next.jp
        ? prev
        : next
    ));
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      collisionGroups={0x0002FFFF}
      position={[spawn.x, spawn.y, spawn.z]}
      userData={{ type: 'bot-player', id: bot.id, name: bot.name, isBot: true }}
    >
      <CapsuleCollider args={[1.5, 1]} />

      <group ref={modelRef} position={[0, -2.5, 0]}>
        <PlayerModel
          isMoving={anim.mv}
          moveDir={anim.dir}
          isSprinting={anim.spr}
          jumpPhase={anim.jp}
          skinOverride={skin}
        />
      </group>
    </RigidBody>
  );
}