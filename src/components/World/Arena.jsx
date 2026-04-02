import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGLTF, Text as TextDrei, Center, Instances, Instance } from '@react-three/drei';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { useGameStore } from '../../store/useGameStore';

/**
 * StaticCharacter Component for the Selection Podiums
 */
function SelectionModel({ path, position }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return <primitive object={cloned} position={position} scale={2.5} rotation={[0, Math.PI, 0]} />;
}

/**
 * CerealBoxPhysics Component
 * Handles the composite cuboid colliders for a single cereal box obstacle.
 * Includes an entrance "doorway" on the front face.
 */
function CerealBoxPhysics({ position, rotation, boxSize }) {
  const { x: w, y: h, z: d } = boxSize;
  const thickness = 0.5; // Thickness of the "cardboard" walls
  const doorHeight = 10; // Height of the player entrance

  return (
    <RigidBody
      type="fixed"
      position={position}
      rotation={rotation}
      collisionGroups={0x0001FFFF}
    >
      <group position={[0, h / 2, 0]}>
        {/* Floor */}
        <CuboidCollider args={[w / 2, thickness / 2, d / 2]} position={[0, -h / 2, 0]} />
        
        {/* Back Wall */}
        <CuboidCollider args={[w / 2, h / 2, thickness / 2]} position={[0, 0, -d / 2]} />
        
        {/* Left Wall */}
        <CuboidCollider args={[thickness / 2, h / 2, d / 2]} position={[-w / 2, 0, 0]} />
        
        {/* Right Wall */}
        <CuboidCollider args={[thickness / 2, h / 2, d / 2]} position={[w / 2, 0, 0]} />
        
        {/* Front Wall (The one with the Door)
            We use a shorter wall raised up to create an opening at the bottom.
         */}
        <CuboidCollider 
          args={[w / 2, (h - doorHeight) / 2, thickness / 2]} 
          position={[0, doorHeight / 2, d / 2]} 
        />
      </group>
    </RigidBody>
  );
}

/**
 * Arena Component
 * Restores the original 3D level layout from the vanilla JS version
 * while applying the new procedural wood texture.
 */
export default function Arena() {
  const setSelectedCharacter = useGameStore(state => state.setSelectedCharacter);
  const triggerSpawn = useGameStore(state => state.triggerSpawn);

  // Load Cereal Box Model for Instancing
  const cerealBoxModel = useGLTF('/materials/cerealbox.glb');
  
  // Extract main mesh, geometry and material for instancing
  const { geometry, material, boxSize } = useMemo(() => {
    let g = null;
    let m = null;
    let size = new THREE.Vector3(14, 20, 5); // Fallback defaults
    
    cerealBoxModel.scene.traverse(child => {
      if (child.isMesh && child.visible !== false) {
        if (!g) g = child.geometry;
        if (!m) m = child.material;
      }
    });

    if (cerealBoxModel.scene) {
      const box = new THREE.Box3().setFromObject(cerealBoxModel.scene);
      box.getSize(size);
    }

    return { geometry: g, material: m, boxSize: size };
  }, [cerealBoxModel]);

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
    <meshStandardMaterial
      map={woodTexture}
      roughness={0.6}
    />
  );

  // Randomly place 20 cereal boxes
  const cerealBoxes = useMemo(() => {
    const boxes = [];
    for (let i = 0; i < 20; i++) {
      // Stay within table bounds [-300, 300], adding a bit of margin
      const x = (Math.random() - 0.5) * 500;
      const z = (Math.random() - 0.5) * 500;
      // Exclude platform and bridge footprints on the main table
      if (Math.abs(x) < 40 && z > -70 && z < 25) {
        i--;
        continue;
      }
      boxes.push({
        id: i,
        position: [x, 0, z],
        rotation: [0, Math.random() * Math.PI * 2, 0]
      });
    }
    return boxes;
  }, []);

  return (
    <>
      {/* 1. Main Kitchen Table (The massive arena floor at Y=0) */}
      <RigidBody type="fixed" position={[0, -1, 0]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[600, 2, 600]} />
          {woodMaterial}
        </mesh>
      </RigidBody>

      {/* Main Kitchen Table - Inset Sides (Island Bench effect) */}
      <group position={[0, -502, 0]}>
        {/* Front */}
        <mesh position={[0, 0, 296]} receiveShadow>
          <boxGeometry args={[596, 1000, 4]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.05} />
        </mesh>
        {/* Back */}
        <mesh position={[0, 0, -296]} receiveShadow>
          <boxGeometry args={[596, 1000, 4]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.05} />
        </mesh>
        {/* Left */}
        <mesh position={[-296, 0, 0]} receiveShadow>
          <boxGeometry args={[4, 1000, 596]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.05} />
        </mesh>
        {/* Right */}
        <mesh position={[296, 0, 0]} receiveShadow>
          <boxGeometry args={[4, 1000, 596]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.05} />
        </mesh>
      </group>

      {/* 2. Platform 1 (Spawning Area at Y=100) */}
      <RigidBody type="fixed" position={[0, 100, 0]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[70, 2, 30]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      {/* Platform 1 - Dark Top */}
      <mesh position={[0, 101.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
      </mesh>
      {/* Platform 1 - Light Bottom */}
      <mesh position={[0, 98.99, 0]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.05} />
      </mesh>
      {/* Platform 1 - Sides */}
      <group position={[0, 100, 0]}>
        {/* Front (Z+) */}
        <mesh position={[0, 0, 15]} receiveShadow>
          <planeGeometry args={[70, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
        </mesh>
        {/* Back (Z-) */}
        <mesh position={[0, 0, -15]} receiveShadow rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[70, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
        </mesh>
        {/* Left (X-) */}
        <mesh position={[-35, 0, 0]} receiveShadow rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[30, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
        </mesh>
        {/* Right (X+) */}
        <mesh position={[35, 0, 0]} receiveShadow rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[30, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
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
        <pointLight position={[0, 4, 2]} intensity={20} color="#00ff88" distance={10} decay={2} />
        <pointLight position={[0, 1, -2]} intensity={10} color="#ffffff" distance={5} decay={2} />

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
        <pointLight position={[0, 4, 2]} intensity={20} color="#00ff88" distance={10} decay={2} />
        <pointLight position={[0, 1, -2]} intensity={10} color="#ffffff" distance={5} decay={2} />

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
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      {/* Platform 2 - Dark Top */}
      <mesh position={[0, 101.01, -45]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
      </mesh>
      {/* Platform 2 - Light Bottom */}
      <mesh position={[0, 98.99, -45]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.05} />
      </mesh>
      {/* Platform 2 - Sides */}
      <group position={[0, 100, -45]}>
        <mesh position={[0, 0, 15]} receiveShadow>
          <planeGeometry args={[70, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, -15]} receiveShadow rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[70, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
        </mesh>
        <mesh position={[-35, 0, 0]} receiveShadow rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[30, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
        </mesh>
        <mesh position={[35, 0, 0]} receiveShadow rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[30, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
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
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      {/* Bridge - Dark Top */}
      <mesh position={[0, 101.01, -22.5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 20]} />
        <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
      </mesh>
      {/* Bridge - Light Bottom */}
      <mesh position={[0, 98.99, -22.5]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 20]} />
        <meshStandardMaterial color="#eeeeee" roughness={0.05} />
      </mesh>
      {/* Bridge - Sides */}
      <group position={[0, 100, -22.5]}>
        <mesh position={[7.5, 0, 0]} receiveShadow rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[20, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
        </mesh>
        <mesh position={[-7.5, 0, 0]} receiveShadow rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[20, 2]} />
          <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
        </mesh>
      </group>

      {/* 5. Cereal Box Obstacles (Instanced Rendering) */}
      {geometry && material && (
        <Instances geometry={geometry} material={material} castShadow receiveShadow>
          {cerealBoxes.map((box) => (
            <Instance 
              key={box.id} 
              position={box.position} 
              rotation={box.rotation} 
            />
          ))}
        </Instances>
      )}

      {/* 6. Cereal Box Physics (Composite Cuboid Colliders) */}
      {cerealBoxes.map((box) => (
        <CerealBoxPhysics 
          key={box.id} 
          position={box.position} 
          rotation={box.rotation} 
          boxSize={boxSize} 
        />
      ))}
    </>
  );
}
