import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CylinderCollider, CapsuleCollider } from '@react-three/rapier';
import PlayerModel from './PlayerModel.jsx';

/**
 * THE REMOTE PLAYER
 * Renders other players' characters and smooths their movement.
 */
export default function RemotePlayer({ data }) {
  const groupRef = useRef();
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, delta) => {
    if (!groupRef.current || !data) return;

    // 1. Update Target Position and Rotation
    // data.pos is [x, y, z] from PlayerController
    if (Array.isArray(data.pos)) {
      targetPos.set(data.pos[0], data.pos[1] - 1.3, data.pos[2]);
    } else {
      targetPos.set(data.pos.x, data.pos.y - 1.3, data.pos.z);
    }
    
    // data.rot is a number (radians) from PlayerController
    targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), data.rot || 0);

    // 2. Smooth Lerp (Using Rapier API for Kinematic Body)
    const currentPos = groupRef.current.translation();
    const currentRot = groupRef.current.rotation();
    
    // Lerp position
    const nextPos = {
      x: THREE.MathUtils.lerp(currentPos.x, targetPos.x, 0.2),
      y: THREE.MathUtils.lerp(currentPos.y, targetPos.y, 0.2),
      z: THREE.MathUtils.lerp(currentPos.z, targetPos.z, 0.2),
    };
    
    // Slerp rotation
    const curQuat = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);
    curQuat.slerp(targetQuat, 0.2);
    
    groupRef.current.setNextKinematicTranslation(nextPos);
    groupRef.current.setNextKinematicRotation(curQuat);
  });

  return (
    <RigidBody 
      ref={groupRef} 
      type="kinematicPosition" 
      colliders={false}
      collisionGroups={0x0001FFFF}
    >
      {/* 1. Main Body (Thick Cylinder) */}
      <CylinderCollider args={[0.5, 1.5]} position={[0, 0.7, 0]} />
      
      {/* 2. 'Step-up' Bottom (Rounded Capsule) */}
      <CapsuleCollider args={[0.1, 1.5]} position={[0, 0.4, 0]} />

      <PlayerModel 
        isMoving={data.anim?.mv}
        moveDir={data.anim?.dir}
        isSprinting={data.anim?.spr}
        jumpPhase={data.anim?.jp}
        // Force the skin based on server data
        skinOverride={data.skin} 
      />
    </RigidBody>
  );
}
