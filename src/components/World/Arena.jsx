import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGLTF, Text as TextDrei } from '@react-three/drei';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { useGameStore } from '../../store/useGameStore';

/**
 * StaticCharacter Component for the Selection Podiums
 */
function SelectionModel({ path, position }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  return <primitive object={cloned} position={position} scale={2.5} rotation={[0, Math.PI, 0]} />;
}

/**
 * Arena Component
 * Restores the original 3D level layout from the vanilla JS version
 * while applying the new procedural wood texture and reflective clear coat.
 */
export default function Arena() {
  const setSelectedCharacter = useGameStore(state => state.setSelectedCharacter);
  const triggerSpawn = useGameStore(state => state.triggerSpawn);

  // Helper: generate procedural wood canvas with a given base color
  const makeWoodCanvas = (baseColor) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor; 
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const length = 40 + Math.random() * 150;
      const opacity = 0.05 + Math.random() * 0.15;
      ctx.strokeStyle = `rgba(30, 20, 10, ${opacity})`;
      ctx.lineWidth = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + (Math.random() - 5), y + length * 0.3, x + (Math.random() - 5), y + length * 0.6, x, y + length);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5); 
    return tex;
  };

  // Procedural Wood Texture (Fast loading, 0KB)
  const woodTexture = useMemo(() => makeWoodCanvas('#3d2b1f'), []);

  // Darker wood texture for spawn platform tops
  const darkWoodTexture = useMemo(() => makeWoodCanvas('#2a1c13'), []);

  // Shared Material for wood objects (arena floor)
  const woodMaterial = (
    <meshPhysicalMaterial 
      map={woodTexture} 
      roughness={0.4} 
      clearcoat={1.0} 
      clearcoatRoughness={0.05} 
      reflectivity={0.5} 
    />
  );

  return (
    <>
      {/* 1. Main Kitchen Table (The massive arena floor at Y=0) */}
      <RigidBody type="fixed" position={[0, -1, 0]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[600, 2, 600]} />
          {woodMaterial}
        </mesh>
      </RigidBody>

      {/* Main Kitchen Table - Inset Glossy Sides (Island Bench effect) */}
      <group position={[0, -502, 0]}>
        {/* Front */}
        <mesh position={[0, 0, 296]} receiveShadow>
          <boxGeometry args={[596, 1000, 4]} />
          <meshPhysicalMaterial color="#eeeeee" roughness={0.05} clearcoat={1.0} />
        </mesh>
        {/* Back */}
        <mesh position={[0, 0, -296]} receiveShadow>
          <boxGeometry args={[596, 1000, 4]} />
          <meshPhysicalMaterial color="#eeeeee" roughness={0.05} clearcoat={1.0} />
        </mesh>
        {/* Left */}
        <mesh position={[-296, 0, 0]} receiveShadow>
          <boxGeometry args={[4, 1000, 596]} />
          <meshPhysicalMaterial color="#eeeeee" roughness={0.05} clearcoat={1.0} />
        </mesh>
        {/* Right */}
        <mesh position={[296, 0, 0]} receiveShadow>
          <boxGeometry args={[4, 1000, 596]} />
          <meshPhysicalMaterial color="#eeeeee" roughness={0.05} clearcoat={1.0} />
        </mesh>
      </group>

      {/* 2. Platform 1 (Spawning Area at Y=100) */}
      <RigidBody type="fixed" position={[0, 100, 0]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[70, 2, 30]} />
          <meshPhysicalMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      {/* Platform 1 - Dark Top */}
      <mesh position={[0, 101.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} reflectivity={0.5} />
      </mesh>
      {/* Platform 1 - Light Bottom */}
      <mesh position={[0, 98.99, 0]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshPhysicalMaterial color="#eeeeee" roughness={0.05} clearcoat={1.0} />
      </mesh>
      {/* Platform 1 - Sides */}
      <group position={[0, 100, 0]}>
        {/* Front (Z+) */}
        <mesh position={[0, 0, 15]} receiveShadow>
          <planeGeometry args={[70, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
        {/* Back (Z-) */}
        <mesh position={[0, 0, -15]} receiveShadow rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[70, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
        {/* Left (X-) */}
        <mesh position={[-35, 0, 0]} receiveShadow rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[30, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
        {/* Right (X+) */}
        <mesh position={[35, 0, 0]} receiveShadow rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[30, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
      </group>

      {/* Platform 1 Carpet Runner */}
      <mesh position={[0, 101.06, 0]} receiveShadow>
        <boxGeometry args={[70, 0.12, 4]} />
        <meshStandardMaterial color="#880000" roughness={0.8} />
      </mesh>

      {/* COMPOSITE PLATFORM BOUNDARY (Invisible Walls for Platform 1, 2, and Bridge) */}
      <group position={[0, 100, 0]}>
        {/* Outer Perimeter Platform 1 (Z: +15 to -15, X: ±35) */}
        <RigidBody type="fixed" position={[0, 2, 15]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[35, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[35, 2, 0]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[-35, 2, 0]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        {/* Closing Wall North Platform 1 (Z: -15) where Bridge DOES NOT start */}
        <RigidBody type="fixed" position={[21.25, 2, -15]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[-21.25, 2, -15]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>

        {/* Bridge Outer Sides (Z: -15 to -30, X: ±7.5) */}
        <RigidBody type="fixed" position={[7.5, 2, -22.5]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 7.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[-7.5, 2, -22.5]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 7.5]} /> </RigidBody>

        {/* Closing Wall South Platform 2 (Z: -30) where Bridge DOES NOT end */}
        <RigidBody type="fixed" position={[21.25, 2, -30]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[-21.25, 2, -30]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>

        {/* Outer Perimeter Platform 2 (Z: -30 to -60, X: ±35) */}
        <RigidBody type="fixed" position={[35, 2, -45]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[-35, 2, -45]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[0, 2, -60]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[35, 2, 0.5]} /> </RigidBody>
      </group>

      {/* Podium A (EGG Selector) */}
      <group position={[20, 101, 5]}>
        <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
          <boxGeometry args={[4, 0.3, 4]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        <SelectionModel path="/models/EGG.glb" position={[0, 0.3, 0]} />
        
        {/* Button Sensor */}
        <RigidBody 
          type="fixed" 
          sensor 
          onIntersectionEnter={() => setSelectedCharacter('Egg')}
          position={[0, 0.5, 5]}
        >
          <CuboidCollider args={[2, 0.5, 2]} />
          <mesh>
            <boxGeometry args={[4, 0.2, 4]} />
            <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </RigidBody>
      </group>

      {/* START BUTTON (Central on Platform 1) */}
      <group position={[0, 101, 8]}>
        <TextDrei
          position={[0, 5, 0]}
          rotation={[0, Math.PI, 0]}
          fontSize={2.5}
          color="#00ff88"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.2}
          outlineColor="#000000"
        >
          START
        </TextDrei>
        <RigidBody 
          type="fixed" 
          sensor 
          onIntersectionEnter={() => {
            console.log("Start Button Triggered");
            triggerSpawn();
          }}
          position={[0, 0.5, 0]}
        >
          <CuboidCollider args={[2, 0.5, 2]} />
          <mesh>
            <boxGeometry args={[4, 0.2, 4]} />
            <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </RigidBody>
      </group>

      {/* Podium B (Avo Selector) */}
      <group position={[-20, 101, 5]}>
        <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
          <boxGeometry args={[4, 0.3, 4]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
        <SelectionModel path="/models/Avo.glb" position={[0, 0.3, 0]} />
        
        {/* Button Sensor */}
        <RigidBody 
          type="fixed" 
          sensor 
          onIntersectionEnter={() => setSelectedCharacter('Avo')}
          position={[0, 0.5, 5]}
        >
          <CuboidCollider args={[2, 0.5, 2]} />
          <mesh>
            <boxGeometry args={[4, 0.2, 4]} />
            <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </RigidBody>
      </group>

      {/* 3. Platform 2 (Secondary Area) */}
      <RigidBody type="fixed" position={[0, 100, -45]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[70, 2, 30]} />
          <meshPhysicalMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      {/* Platform 2 - Dark Top */}
      <mesh position={[0, 101.01, -45]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} reflectivity={0.5} />
      </mesh>
      {/* Platform 2 - Light Bottom */}
      <mesh position={[0, 98.99, -45]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshPhysicalMaterial color="#eeeeee" roughness={0.05} clearcoat={1.0} />
      </mesh>
      {/* Platform 2 - Sides */}
      <group position={[0, 100, -45]}>
        <mesh position={[0, 0, 15]} receiveShadow>
          <planeGeometry args={[70, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
        <mesh position={[0, 0, -15]} receiveShadow rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[70, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
        <mesh position={[-35, 0, 0]} receiveShadow rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[30, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
        <mesh position={[35, 0, 0]} receiveShadow rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[30, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
      </group>

      {/* Platform 2 Carpet Runner */}
      <mesh position={[0, 101.06, -45]} receiveShadow>
        <boxGeometry args={[70, 0.12, 4]} />
        <meshStandardMaterial color="#880000" roughness={0.8} />
      </mesh>

      {/* 4. Connecting Bridge */}
      <RigidBody type="fixed" position={[0, 100, -22.5]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[15, 2.0, 20]} />
          <meshPhysicalMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      {/* Bridge - Dark Top */}
      <mesh position={[0, 101.01, -22.5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 20]} />
        <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} reflectivity={0.5} />
      </mesh>
      {/* Bridge - Light Bottom */}
      <mesh position={[0, 98.99, -22.5]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 20]} />
        <meshPhysicalMaterial color="#eeeeee" roughness={0.05} clearcoat={1.0} />
      </mesh>
      {/* Bridge - Sides */}
      <group position={[0, 100, -22.5]}>
        <mesh position={[7.5, 0, 0]} receiveShadow rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[20, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
        <mesh position={[-7.5, 0, 0]} receiveShadow rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[20, 2]} />
          <meshPhysicalMaterial map={darkWoodTexture} roughness={0.4} clearcoat={1.0} clearcoatRoughness={0.05} />
        </mesh>
      </group>
    </>
  );
}
