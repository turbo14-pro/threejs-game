import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CylinderCollider, CapsuleCollider } from '@react-three/rapier';
import PlayerModel from './PlayerModel.jsx';
import { useGameStore } from '../../store/useGameStore';

/**
 * THE REMOTE PLAYER
 * Renders other players' characters and smooths their movement.
 */
export default function RemotePlayer({ data }) {
  const groupRef = useRef();
  const stunTimer = useRef(0);
  const firstLoad = useRef(true);
  const lastAppliedImpact = useRef(0);
  
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);
  const buffer = useRef([]); // [{ pos, rot, t }]
  const renderTime = useRef(0);

  // 1. UPDATE BUFFER: When new data arrives, add it to the list
  useEffect(() => {
    if (!data) return;
    
    // We assume the data arrives in order for now, but we could sort by 't' if we add it
    buffer.current.push({
      pos: new THREE.Vector3(
        Array.isArray(data.pos) ? data.pos[0] : (data.pos?.x || 0),
        Array.isArray(data.pos) ? data.pos[1] : (data.pos?.y || 0),
        Array.isArray(data.pos) ? data.pos[2] : (data.pos?.z || 0)
      ),
      rot: data.rot || 0,
      t: Date.now() // Local timestamp for arrival-based interpolation
    });

    // Keep buffer lean
    if (buffer.current.length > 10) buffer.current.shift();
  }, [data]);

  useFrame((state, delta) => {
    if (!groupRef.current || !data || buffer.current.length === 0) return;

    // 1. INTERPOLATION: Find the right spot in the past
    // We render ~40ms in the past to ensure we have data to interpolate between
    const interpolationDelay = 40; 
    const targetTime = Date.now() - interpolationDelay;

    if (buffer.current.length >= 2) {
      // Find the two points we are between
      let i = 0;
      for (i = 0; i < buffer.current.length - 1; i++) {
        if (buffer.current[i + 1].t > targetTime) break;
      }

      const p0 = buffer.current[i];
      const p1 = buffer.current[i + 1];

      if (p0 && p1 && p0.t !== p1.t) {
        const fraction = (targetTime - p0.t) / (p1.t - p0.t);
        targetPos.lerpVectors(p0.pos, p1.pos, THREE.MathUtils.clamp(fraction, 0, 1));
        
        // Smoothly rotate
        const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p0.rot);
        const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p1.rot);
        targetQuat.slerpQuaternions(q0, q1, THREE.MathUtils.clamp(fraction, 0, 1));
      }
    } else if (buffer.current.length === 1) {
      targetPos.copy(buffer.current[0].pos);
      targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), buffer.current[0].rot);
    }

    const currentPos = groupRef.current.translation();
    const currentVel = groupRef.current.linvel();

    // 2. SNAPPING & TELEPORT (Prevent getting stuck in floors/walls)
    const distSq = (targetPos.x - currentPos.x)**2 + (targetPos.y - currentPos.y)**2 + (targetPos.z - currentPos.z)**2;
    
    // If we are more than 5 meters away, or it's the very first time we see this player, SNAP.
    if (distSq > 25 || firstLoad.current) {
      groupRef.current.setTranslation({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, true);
      groupRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      firstLoad.current = false;
      return;
    }

    // 4. PD Controller (Spring-Force Positioning)
    const k = 300; 
    const d = 20;  

    // CRITICAL: Disable Magnet if the player was recently hit (from store)
    const remoteKnockbacks = useGameStore.getState().remoteKnockbacks;
    const impactInfo = remoteKnockbacks[data.id];
    const lastHitTime = impactInfo?.t || 0;
    const isRecentlyHit = Date.now() - lastHitTime < 1200;

    // --- LOCAL PHYSICS PREDICTION: Apply the hit force LOCALLY for observers ---
    if (impactInfo && impactInfo.t > lastAppliedImpact.current) {
        lastAppliedImpact.current = impactInfo.t; // Mark as applied IMMEDIATELY
        console.log("⚡ [Observer] Applying Local Impulse to Remote Player:", data.id);
        const dir = impactInfo.dir;
        const BLAST_POWER = 250;
        groupRef.current.applyImpulse({
          x: dir[0] * BLAST_POWER,
          y: 45,
          z: dir[2] * BLAST_POWER
        }, true);
    }

    // Also check for high velocity just in case
    const currentSpeedSq = currentVel.x * currentVel.x + currentVel.y * currentVel.y + currentVel.z * currentVel.z;
    const isFlyingFromHit = currentSpeedSq > 400 || isRecentlyHit;

    if (isFlyingFromHit) {
      // Let physics take over completely during a high-speed flight
      return;
    }

    const impulse = {
      x: (targetPos.x - currentPos.x) * k - currentVel.x * d,
      y: (targetPos.y - currentPos.y) * k - currentVel.y * d,
      z: (targetPos.z - currentPos.z) * k - currentVel.z * d
    };

    // CLAMP: Prevent massive energy loops
    const MAX_IMPULSE = 60;
    const mag = Math.sqrt(impulse.x ** 2 + impulse.y ** 2 + impulse.z ** 2);
    if (mag > MAX_IMPULSE) {
      const scale = MAX_IMPULSE / mag;
      impulse.x *= scale;
      impulse.y *= scale;
      impulse.z *= scale;
    }

    groupRef.current.applyImpulse(impulse, true);

    // Smooth Rotation (Force orientation even if locked for physics)
    groupRef.current.setRotation(targetQuat, true);
  });

  return (
    <RigidBody 
      ref={groupRef} 
      type="dynamic" 
      gravityScale={firstLoad.current ? 0 : 1}
      colliders={false}
      collisionGroups={0x0002FFFF}
      linearDamping={0.8} // Natural sliding
      angularDamping={1.0}
      lockRotations={true}
      userData={{ 
        type: 'remote-player', 
        id: data.id,
        isSliding: data.anim?.sl // Pass sliding state for instant impact detection
      }}
    >
      {/* UNIFIED COLLIDER (Hidden Debug) - MATCHING 5M PILL */}
      <CapsuleCollider args={[1.5, 1]} position={[0, 0, 0]}>
        {/* <mesh>
          <capsuleGeometry args={[1.5, 1]} />
          <meshStandardMaterial color="purple" transparent opacity={0.3} depthTest={false} />
        </mesh> */}
      </CapsuleCollider>


      {/* Vertical Offset for 5m pill */}
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
