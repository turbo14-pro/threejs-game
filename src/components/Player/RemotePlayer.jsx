import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CylinderCollider, CapsuleCollider } from '@react-three/rapier';
import PlayerModel from './PlayerModel.jsx';
import { useGameStore } from '../../store/useGameStore';

/**
 * THE REMOTE PLAYER
 * Renders other players' characters and smooths their movement.
 * Uses 50ms jitter buffer with 3 snapshots for LAN optimization.
 */
export default function RemotePlayer({ data }) {
  const groupRef = useRef();
  const firstLoad = useRef(true);
  const buffer = useRef([]); // [{ pos, rot, t, serverTick }]
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);

  // 1. UPDATE BUFFER: When new data arrives, add it to the list.
  // Drop corrupt snapshots — a single NaN pos poisons lerpVectors, then
  // setNextKinematicTranslation(NaN) traps WASM ("unreachable") and corrupts
  // the whole world (all later steps throw + aliasing panics).
  useEffect(() => {
    if (!data || !data.pos) return;
    const px = Number(data.pos[0]);
    const py = Number(data.pos[1]);
    const pz = Number(data.pos[2]);
    const rot = Number(data.rot ?? 0);
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return;
    if (!Number.isFinite(rot)) return;
    if (Math.abs(px) > 10000 || Math.abs(py) > 10000 || Math.abs(pz) > 10000) return;

    buffer.current.push({
      pos: new THREE.Vector3(px, py, pz),
      rot,
      t: Date.now(),
      serverTick: data.tick || 0
    });

    // Keep buffer lean - 3 snapshots for 50ms jitter buffer
    if (buffer.current.length > 3) buffer.current.shift();
  }, [data]);

  useFrame((state, delta) => {
    if (!groupRef.current || !data || buffer.current.length === 0) return;

    // 2. INTERPOLATION: Find the right spot in the past (50ms delay for LAN)
    const interpolationDelay = 50; 
    const targetTime = Date.now() - interpolationDelay;

    if (buffer.current.length >= 2) {
      let i = 0;
      for (; i < buffer.current.length - 1; i++) {
        if (buffer.current[i + 1].t > targetTime) break;
      }

      const p0 = buffer.current[i];
      const p1 = buffer.current[i + 1];

      if (p0 && p1 && p0.t !== p1.t) {
        const denom = p1.t - p0.t;
        const rawFraction = Number.isFinite(denom) && denom !== 0 ? (targetTime - p0.t) / denom : 0;
        const fraction = THREE.MathUtils.clamp(Number.isFinite(rawFraction) ? rawFraction : 0, 0, 1);
        targetPos.lerpVectors(p0.pos, p1.pos, fraction);
        
        const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p0.rot);
        const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p1.rot);
        targetQuat.slerpQuaternions(q0, q1, fraction);
      }
    } else {
      targetPos.copy(buffer.current[0].pos);
      const soloRot = Number(buffer.current[0].rot);
      targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Number.isFinite(soloRot) ? soloRot : 0);
    }

    // 3. APPLY KINEMATIC MOVEMENT
    // Instead of impulses, we tell Rapier exactly where to put the body next frame.
    // This resolves desync instantly without jitter.
    // Never pass live THREE objects straight in: snapshot to plain numbers so a
    // corrupt buffer entry can't trap WASM with NaN ("unreachable").
    try {
      if (![targetPos.x, targetPos.y, targetPos.z].every(Number.isFinite)) return;
      if (![targetQuat.x, targetQuat.y, targetQuat.z, targetQuat.w].every(Number.isFinite)) return;
      groupRef.current.setNextKinematicTranslation({ x: targetPos.x, y: targetPos.y, z: targetPos.z });
      groupRef.current.setNextKinematicRotation({ x: targetQuat.x, y: targetQuat.y, z: targetQuat.z, w: targetQuat.w });

      if (firstLoad.current) {
        groupRef.current.setTranslation({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, true);
        firstLoad.current = false;
      }
    } catch {
      // A poisoned world throws on every write — drop the buffer so the next
      // good snapshot can re-seed instead of replaying the corrupt one.
      buffer.current.length = 0;
    }
  });

  return (
    <RigidBody 
      ref={groupRef} 
      type="kinematicPosition" 
      colliders={false}
      collisionGroups={0x0002FFFF}
      userData={{ 
        type: 'remote-player', 
        id: data.id,
        isSliding: data.anim?.sl
      }}
    >
      <CapsuleCollider args={[1.5, 1]} />
      
      <group position={[0, -2.5, 0]}>
        <PlayerModel 
          isMoving={data.anim?.mv}
          moveDir={data.anim?.dir}
          isSprinting={data.anim?.spr}
          jumpPhase={data.anim?.jp}
          skinOverride={data.skin || 'avo'} 
        />
      </group>
    </RigidBody>
  );
}
