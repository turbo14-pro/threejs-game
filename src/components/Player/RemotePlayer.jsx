import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CylinderCollider, CapsuleCollider } from '@react-three/rapier';
import PlayerModel from './PlayerModel.jsx';
import { useGameStore } from '../../store/useGameStore';

import { SnapshotInterpolation } from '@geckos.io/snapshot-interpolation';

const SI = new SnapshotInterpolation(30); // 30Hz Match

/**
 * THE REMOTE PLAYER
 * Renders other players' characters and smooths their movement.
 */
export default function RemotePlayer({ data }) {
  const groupRef = useRef();
  const firstLoad = useRef(true);
  const buffer = useRef([]); // [{ pos, rot, t }]
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);

  // 1. UPDATE BUFFER: When new data arrives, add it to the list
  useEffect(() => {
    if (!data || !data.pos) return;
    
    buffer.current.push({
      pos: new THREE.Vector3(data.pos[0], data.pos[1], data.pos[2]),
      rot: data.rot || 0,
      t: Date.now()
    });

    // Keep buffer lean
    if (buffer.current.length > 10) buffer.current.shift();
  }, [data]);

  useFrame((state, delta) => {
    if (!groupRef.current || !data || buffer.current.length === 0) return;

    // 2. INTERPOLATION: Find the right spot in the past (100ms delay for smoothness)
    const interpolationDelay = 100; 
    const targetTime = Date.now() - interpolationDelay;

    if (buffer.current.length >= 2) {
      let i = 0;
      for (i = 0; i < buffer.current.length - 1; i++) {
        if (buffer.current[i + 1].t > targetTime) break;
      }

      const p0 = buffer.current[i];
      const p1 = buffer.current[i + 1];

      if (p0 && p1 && p0.t !== p1.t) {
        const fraction = (targetTime - p0.t) / (p1.t - p0.t);
        targetPos.lerpVectors(p0.pos, p1.pos, THREE.MathUtils.clamp(fraction, 0, 1));
        
        const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p0.rot);
        const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p1.rot);
        targetQuat.slerpQuaternions(q0, q1, THREE.MathUtils.clamp(fraction, 0, 1));
      }
    } else {
      targetPos.copy(buffer.current[0].pos);
      targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), buffer.current[0].rot);
    }

    // 3. APPLY KINEMATIC MOVEMENT
    // Instead of impulses, we tell Rapier exactly where to put the body next frame.
    // This resolves desync instantly without jitter.
    groupRef.current.setNextKinematicTranslation(targetPos);
    groupRef.current.setNextKinematicRotation(targetQuat);

    if (firstLoad.current) {
      groupRef.current.setTranslation(targetPos, true);
      firstLoad.current = false;
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
