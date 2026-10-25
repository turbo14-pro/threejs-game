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
  const buffer = useRef([]); // [{ pos, vel, rot, t, serverTick }]
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);
  const lastVel = useMemo(() => new THREE.Vector3(), []);
  const lastPacketTime = useRef(0);

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

    //console.log(`[REMOTEPLAYER BUFFER] player=${data.id} posY=${py.toFixed(2)} bufferLen=${buffer.current.length}`);

    buffer.current.push({
      pos: new THREE.Vector3(px, py, pz),
      vel: new THREE.Vector3(
        Number.isFinite(data.vel?.[0]) ? data.vel[0] : 0,
        Number.isFinite(data.vel?.[1]) ? data.vel[1] : 0,
        Number.isFinite(data.vel?.[2]) ? data.vel[2] : 0
      ),
      rot,
      facingRot: Number.isFinite(data.facingRot) ? data.facingRot : rot,
      groundY: Number.isFinite(data.groundY) ? data.groundY : -1,
      t: Date.now(),
      serverTick: data.tick || 0
    });

    // Track last packet time for extrapolation
    lastPacketTime.current = Date.now();

    // Keep buffer lean - 3 snapshots for 50ms jitter buffer
    if (buffer.current.length > 3) buffer.current.shift();
  }, [data]);

  useFrame((state, delta) => {
    if (!groupRef.current || !data || buffer.current.length === 0) return;

    // 2. INTERPOLATION: Find the right spot in the past (30ms delay for LAN)
    const interpolationDelay = 30;
    const targetTime = Date.now() - interpolationDelay;

    // Check if packets are stalled (no new data within 100ms)
    const timeSinceLastPacket = Date.now() - lastPacketTime.current;
    const packetsStalled = timeSinceLastPacket > 100;

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
        
        const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p0.facingRot);
        const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p1.facingRot);
        targetQuat.slerpQuaternions(q0, q1, fraction);

        // Store last velocity for extrapolation
        lastVel.copy(p1.vel);
      }
    } else {
      targetPos.copy(buffer.current[0].pos);
      lastVel.copy(buffer.current[0].vel);
      const soloRot = Number(buffer.current[0].rot);
      targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Number.isFinite(soloRot) ? soloRot : 0);
    }

    // 3. VELOCITY EXTRAPOLATION: When packets stall, extrapolate using last known velocity
    if (packetsStalled && buffer.current.length > 0) {
      const lastPacket = buffer.current[buffer.current.length - 1];
      const dt = timeSinceLastPacket / 1000; // seconds
      // Cap extrapolation to prevent runaway (max 500ms)
      const safeDt = Math.min(dt, 0.5);
      targetPos.copy(lastPacket.pos).addScaledVector(lastVel, safeDt);
    }

    // 4. APPLY KINEMATIC MOVEMENT
    // Instead of impulses, we tell Rapier exactly where to put the body next frame.
    // This resolves desync instantly without jitter.
    // Never pass live THREE objects straight in: snapshot to plain numbers so a
    // corrupt buffer entry can't trap WASM with NaN ("unreachable").
    
    // Ground-aware Y correction: when the remote player is grounded, snap Y to
    // server groundY + capsule radius (1.5) to prevent Y drift during jumps/falls
    // and obstacle standing. Only apply when grounded (anim.jp === 'none').
    const latest = buffer.current[buffer.current.length - 1];
    if (latest && latest.groundY >= 0 && data.anim?.jp === 'none') {
      targetPos.y = latest.groundY + 1.5; // capsule center sits 1.5m above ground
    }

    try {
      if (![targetPos.x, targetPos.y, targetPos.z].every(Number.isFinite)) return;
      if (![targetQuat.x, targetQuat.y, targetQuat.z, targetQuat.w].every(Number.isFinite)) return;
      //console.log(`[REMOTEPLAYER APPLY] player=${data.id} targetPosY=${targetPos.y.toFixed(2)}`);
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
          isSliding={data.anim?.sl}
          skinOverride={data.skin || 'avo'} 
        />
      </group>
    </RigidBody>
  );
}
