import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGLTF, useTexture, Text as TextDrei, Instances, Instance } from '@react-three/drei';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';


import { useGameStore } from '../../store/useGameStore';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import ArenaLightRays from './LightRays';
import { useCerealBoxAssets, CerealBoxMesh, CerealBoxPhysics } from './Obsticles/CerealBox.jsx';
import { TinCanPhysics } from './Obsticles/TinCan.jsx';

/**
 * Helper to calculate the Y offset needed to place a rotated box on the floor.
 */
const getAdjustmentY = (extent, rotation) => {
  const { x: halfW, y: halfH, z: halfD } = extent;
  
  const corners = [
    new THREE.Vector3(-halfW, -halfH, -halfD),
    new THREE.Vector3(halfW, -halfH, -halfD),
    new THREE.Vector3(-halfW, halfH, -halfD),
    new THREE.Vector3(halfW, halfH, -halfD),
    new THREE.Vector3(-halfW, -halfH, halfD),
    new THREE.Vector3(halfW, -halfH, halfD),
    new THREE.Vector3(-halfW, halfH, halfD),
    new THREE.Vector3(halfW, halfH, halfD),
  ];
  
  const euler = new THREE.Euler(...rotation);
  const matrix = new THREE.Matrix4().makeRotationFromEuler(euler);
  
  let minY = Infinity;
  corners.forEach(p => {
    p.applyMatrix4(matrix);
    if (p.y < minY) minY = p.y;
  });
  
  return -minY + 0.01;
};

/**
 * SkinPodium Component
 * Displays a character model on a podium with a blue touch pad to switch skins.
 */
function SkinPodium({ character, position, padOffset }) {
  const setPlayerSkin = useGameStore(state => state.setPlayerSkin);
  const { scene } = useGLTF(`/skins/skin_${character.toLowerCase()}.glb`);
  
  const clone = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse(node => {
      if (node.isMesh) {
        node.castShadow = false;
        node.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  return (
    <group position={position}>
      {/* Podium Plate */}
      <mesh position={[0, 0.5, 0]} receiveShadow>
        <cylinderGeometry args={[2.5, 2.7, 1, 32]} />
        <meshStandardMaterial color="#444444" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Model */}
      <primitive object={clone} position={[0, 1, 0]} scale={[2, 2, 2]} />

      {/* Blue Touch Pad - Sitting on carpet */}
      <RigidBody 
        type="fixed" 
        sensor 
        onIntersectionEnter={() => setPlayerSkin(character.toLowerCase())}
        position={padOffset}
      >
        <CuboidCollider args={[1.5, 0.1, 1.5]} />
        <mesh position={[0, 0.12, 0]} receiveShadow>
          <boxGeometry args={[3, 0.1, 3]} />
          <meshStandardMaterial 
            color="#0088ff" 
            emissive="#0088ff" 
            emissiveIntensity={4} 
            toneMapped={false} 
            transparent 
            opacity={0.8}
          />
        </mesh>
      </RigidBody>
    </group>
  );
}

/**
 * WeaponPodium Component
 * Allows players to choose their starting weapon.
 */
function WeaponPodium({ weapon, position, color = "#ff9300" }) {
  const setPlayerWeapon = useGameStore(state => state.setPlayerWeapon);
  const currentWeapon = useGameStore(state => state.player.selectedWeapon);
  
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.7, 0.8, 32]} />
        <meshStandardMaterial color="#444444" metalness={0.5} roughness={0.5} />
      </mesh>

      <TextDrei
        position={[0, 3, 0]}
        rotation={[0, Math.PI, 0]}
        fontSize={1.2}
        color="white"
      >
        {weapon.toUpperCase()}
      </TextDrei>

      <RigidBody 
        type="fixed" 
        sensor 
        onIntersectionEnter={() => setPlayerWeapon(weapon.toLowerCase())}
      >
        <CuboidCollider args={[1.5, 0.5, 1.5]} />
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[3, 0.1, 3]} />
          <meshStandardMaterial 
            color={currentWeapon === weapon ? "#ffffff" : color} 
            emissive={currentWeapon === weapon ? "#ffffff" : color} 
            emissiveIntensity={currentWeapon === weapon ? 10 : 2} 
            toneMapped={false}
          />
        </mesh>
      </RigidBody>
    </group>
  );
}



/**
 * Arena Component
 * Restores the original 3D level layout from the vanilla JS version
 * while applying the new procedural wood texture.
 */
export default function Arena() {
  const matchPhase = useGameStore(state => state.game.phase);
  const setMatchPhase = useGameStore(state => state.setMatchPhase);
  const countdown = useGameStore(state => state.game.countdown);
  const setCountdown = useGameStore(state => state.setCountdown);
  const startMatchSequence = useGameStore(state => state.startMatchSequence);
  const triggerWorldReset = useGameStore(state => state.triggerWorldReset);

  // Match Countdown Timer
  useEffect(() => {
    if (matchPhase === 'LOBBY') return;
    
    const interval = setInterval(() => {
      if (countdown > 0) {
        setCountdown(countdown - 1);
      } else {
        // Phase Transitions
        if (matchPhase === 'PREMATCH') {
          setMatchPhase('DROP');
          setCountdown(3);
          // Teleport to drop platforms
          triggerWorldReset(); 
        } else if (matchPhase === 'DROP') {
          setMatchPhase('BATTLE');
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [matchPhase, countdown]);

  const dropPoints = useMemo(() => [
    [50, 80, 50], [-50, 80, 50], [50, 80, -50], [-50, 80, -50],
    [100, 80, 0], [-100, 80, 0], [0, 80, 100], [0, 80, -100]
  ], []);

  // Load Cereal Box assets cleanly using the custom hook
  const { geometry: cerealBoxGeometry, material: cerealBoxMaterial, texture: munchiesTexture, extent: cerealBoxExtent } = useCerealBoxAssets();

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

  const woodTexture = useMemo(() => makeWoodCanvas('#3d2b1f'), []);
  const darkWoodTexture = useMemo(() => makeWoodCanvas('#2a1c13'), []);

  // Seeded random for synced layouts
  const seededRandom = (seed) => {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  };

  const woodMaterial = (
    <meshStandardMaterial
      map={woodTexture}
      roughness={0.6}
    />
  );

  const cerealBoxes = useMemo(() => {
    const random = seededRandom(42); // SYNC SEED
    const boxes = [];
    
    // Possible 90-degree orthogonal orientations (upside down removed)
    const orientations = [
      [0, 0, 0], // Standing
      [Math.PI / 2, 0, 0], // On face
      [0, 0, Math.PI / 2], // On side
      [-Math.PI / 2, 0, 0], // On back face
      [0, 0, -Math.PI / 2], // On other side
    ];

    const boxColors = [
      '#ff4d4d', '#4dff4d', '#4d4dff', '#ffff4d', '#ff4dff', '#4dffff',
      '#ff9933', '#9933ff', '#33ff99', '#ff3399', '#3399ff', '#99ff33',
      '#cc0000', '#00cc00', '#0000cc', '#cccc00', '#cc00cc', '#00cccc',
      '#ffcc00', '#ff6600'
    ].map(c => new THREE.Color(c));

    for (let i = 0; i < 20; i++) {
      let valid = false;
      let x, z;
      let attempts = 0;
      
      // Try to find a non-intersecting position
      while (!valid && attempts < 100) {
        x = (random() - 0.5) * 520;
        z = (random() - 0.5) * 520;
        attempts++;
        
        // Don't spawn on the starting platforms
        if (Math.abs(x) < 45 && z > -75 && z < 30) {
          continue;
        }

        // Check for intersection with existing boxes
        let intersects = false;
        // Minimum distance to ensure boxes don't intersect
        const minDistance = 42; 
        for (let j = 0; j < boxes.length; j++) {
          const dx = x - boxes[j].position[0];
          const dz = z - boxes[j].position[2];
          if (Math.sqrt(dx * dx + dz * dz) < minDistance) {
            intersects = true;
            break;
          }
        }
        
        if (!intersects) {
          valid = true;
        }
      }

      if (!valid) continue; // If we couldn't find a safe spot, skip this iteration

      const baseRot = orientations[Math.floor(random() * orientations.length)];
      const spin = Math.floor(random() * 4) * (Math.PI / 2);
      const finalRot = [baseRot[0], baseRot[1] + spin, baseRot[2]];
      
      const yOffset = getAdjustmentY(cerealBoxExtent, finalRot);

      boxes.push({
        id: i,
        position: [x, yOffset, z],
        rotation: finalRot,
        color: boxColors[i % boxColors.length],
        size: { x: 30, y: 36, z: 12 }
      });
    }

    return boxes;
  }, [cerealBoxExtent]);

  // Spawn tin‑can obstacles – similar to cereal boxes but cylinders
  const tinCans = useMemo(() => {
    const random = seededRandom(43); // different seed for variety
    const cans = [];
    const orientations = [
      [0, 0, 0],
      [Math.PI / 2, 0, 0],
      [0, 0, Math.PI / 2],
      [0, 0, -Math.PI / 2],
    ];
    const colors = [
      '#9933ff', '#4d4dff', '#ffcc00',
      '#7700cc', '#3366ff', '#ffdd33',
      '#aa44ff', '#2244cc', '#ffaa00',
    ].map(c => new THREE.Color(c));

    for (let i = 0; i < 20; i++) {
      let valid = false;
      let x, z;
      let attempts = 0;
      while (!valid && attempts < 100) {
        x = (random() - 0.5) * 520;
        z = (random() - 0.5) * 520;
        attempts++;
        // avoid central platform
        if (Math.abs(x) < 45 && z > -75 && z < 30) continue;
        // distance check against existing cans
        const minDist = 30;
        let tooClose = false;
        for (const c of cans) {
          const dx = x - c.position[0];
          const dz = z - c.position[2];
          if (Math.sqrt(dx * dx + dz * dz) < minDist) { tooClose = true; break; }
        }
        if (!tooClose) valid = true;
      }
      if (!valid) continue;
      const finalRot = orientations[Math.floor(random() * orientations.length)];
      const sideColor = colors[i % colors.length];
      const yOffset = getAdjustmentY({ x: 5, y: 6, z: 5 }, finalRot);
        cans.push({
          id: i,
          position: [x, yOffset, z],
          rotation: finalRot,
          color: sideColor,
        });
    }
    return cans;
  });

  return (
    <>
      {/* 1. Main Kitchen Table */}
      <RigidBody type="fixed" position={[0, -1, 0]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[600, 2, 600]} />
          {woodMaterial}
        </mesh>
      </RigidBody>

      {/* Main Kitchen Table Sides */}
      <group position={[0, -502, 0]}>
        <mesh position={[0, 0, 296]} receiveShadow>
          <boxGeometry args={[596, 1000, 4]} />
          <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
        </mesh>
        <mesh position={[0, 0, -296]} receiveShadow>
          <boxGeometry args={[596, 1000, 4]} />
          <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
        </mesh>
        <mesh position={[-296, 0, 0]} receiveShadow>
          <boxGeometry args={[4, 1000, 596]} />
          <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
        </mesh>
        <mesh position={[296, 0, 0]} receiveShadow>
          <boxGeometry args={[4, 1000, 596]} />
          <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
        </mesh>
      </group>

      {/* 2. Platform 1 (Spawning Area) */}
      <RigidBody type="fixed" position={[0, 100, 0]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[70, 2, 30]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 101.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
      </mesh>
      <mesh position={[0, 98.99, 0]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
      </mesh>
      <group position={[0, 100, 0]}>
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

      {/* Platform 1 Carpet Runner */}
      <mesh position={[0, 101.06, 0]} receiveShadow>
        <boxGeometry args={[70, 0.12, 4]} />
        <meshStandardMaterial color="#880000" roughness={0.8} />
      </mesh>

      <ArenaLightRays />
      
      {/* Platform Boundaries */}
      <group position={[0, 100, 0]}>
        <RigidBody type="fixed" position={[0, 2, 15]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[35, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[35, 2, 0]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[-35, 2, 0]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[21.25, 2, -15]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[-21.25, 2, -15]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[7.5, 2, -22.5]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 7.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[-7.5, 2, -22.5]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 7.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[21.25, 2, -30]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[-21.25, 2, -30]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[35, 2, -45]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[-35, 2, -45]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[0, 2, -60]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[35, 2, 0.5]} /> </RigidBody>
      </group>

      {/* SKIN PODIUMS (These are the "Blue walk on buttons" that switch skin) */}
      <SkinPodium 
        character="Avo" 
        position={[-31.5, 101, 0]} 
        padOffset={[5, 0, 0]} 
      />
      <SkinPodium 
        character="Egg" 
        position={[31.5, 101, 0]} 
        padOffset={[-5, 0, 0]} 
      />

      {/* START BUTTON (Central on Platform 1) */}
      {matchPhase !== 'BATTLE' && (
        <group position={[0, 101, 8]}>
          <TextDrei
            position={[0, 5, 0]}
            rotation={[0, Math.PI, 0]}
            fontSize={2.5}
            color="#ffcc00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.2}
            outlineColor="#000000"
          >
            JOIN BATTLE
          </TextDrei>
          <RigidBody
            type="fixed"
            sensor
            onIntersectionEnter={() => startMatchSequence()}
            position={[0, 0.5, 0]}
          >
            <CuboidCollider args={[2, 0.5, 2]} />
            <mesh>
              <boxGeometry args={[4, 0.2, 4]} />
              <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={2} toneMapped={false} />
            </mesh>
          </RigidBody>
        </group>
      )}

      {/* DROP PLATFORMS (These vanish when match starts) */}
      {matchPhase === 'DROP' && countdown > 0 && dropPoints.map((pos, i) => (
        <RigidBody key={`drop-${i}`} type="fixed" position={pos} colliders="cuboid">
          <mesh receiveShadow>
            <boxGeometry args={[4, 1, 4]} />
            <meshStandardMaterial color="#0088ff" emissive="#0088ff" emissiveIntensity={2} />
          </mesh>
        </RigidBody>
      ))}

      {/* Phase Indicator (In-World) */}
      {(matchPhase === 'PREMATCH' || (matchPhase === 'DROP' && countdown > 0)) && (
        <group position={[0, 120, 0]}>
          <TextDrei
            fontSize={8}
            color="#ffffff"
            position={[0, 0, 0]}
            outlineWidth={0.5}
            outlineColor="#000000"
          >
            {matchPhase === 'PREMATCH' ? `MATCH STARTING IN ${countdown}...` : `THE DROP: ${countdown}`}
          </TextDrei>
        </group>
      )}

      {/* 3. Platform 2 */}
      <RigidBody type="fixed" position={[0, 100, -45]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[70, 2, 30]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 101.01, -45]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
      </mesh>
      <mesh position={[0, 98.99, -45]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
      </mesh>
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

      {/* 4. Connecting Bridge */}
      <RigidBody type="fixed" position={[0, 100, -22.5]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[15, 2.0, 20]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 101.01, -22.5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 20]} />
        <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
      </mesh>
      <mesh position={[0, 98.99, -22.5]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 20]} />
        <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
      </mesh>
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

      {/* WEAPON PODIUMS on Platform 2 */}
      <group position={[0, 101, -45]}>

        
        <mesh position={[296, 0, 0]} receiveShadow>
          <boxGeometry args={[4, 1000, 596]} />
          <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
        </mesh>
      </group>

      {/* 2. Platform 1 (Spawning Area) */}
      <RigidBody type="fixed" position={[0, 100, 0]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[70, 2, 30]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 101.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
      </mesh>
      <mesh position={[0, 98.99, 0]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
      </mesh>
      <group position={[0, 100, 0]}>
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

      {/* Platform 1 Carpet Runner */}
      <mesh position={[0, 101.06, 0]} receiveShadow>
        <boxGeometry args={[70, 0.12, 4]} />
        <meshStandardMaterial color="#880000" roughness={0.8} />
      </mesh>

      <ArenaLightRays />
      
      {/* Platform Boundaries */}
      <group position={[0, 100, 0]}>
        <RigidBody type="fixed" position={[0, 2, 15]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[35, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[35, 2, 0]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[-35, 2, 0]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[21.25, 2, -15]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[-21.25, 2, -15]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[7.5, 2, -22.5]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 7.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[-7.5, 2, -22.5]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 7.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[21.25, 2, -30]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[-21.25, 2, -30]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[13.75, 2, 0.5]} /> </RigidBody>
        <RigidBody type="fixed" position={[35, 2, -45]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[-35, 2, -45]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[0.5, 2, 15]} /> </RigidBody>
        <RigidBody type="fixed" position={[0, 2, -60]} collisionGroups={0x0002FFFF}> <CuboidCollider args={[35, 2, 0.5]} /> </RigidBody>
      </group>

      {/* SKIN PODIUMS (These are the "Blue walk on buttons" that switch skin) */}
      <SkinPodium 
        character="Avo" 
        position={[-31.5, 101, 0]} 
        padOffset={[5, 0, 0]} 
      />
      <SkinPodium 
        character="Egg" 
        position={[31.5, 101, 0]} 
        padOffset={[-5, 0, 0]} 
      />

      {/* START BUTTON (Central on Platform 1) */}
      {matchPhase !== 'BATTLE' && (
        <group position={[0, 101, 8]}>
          <TextDrei
            position={[0, 5, 0]}
            rotation={[0, Math.PI, 0]}
            fontSize={2.5}
            color="#ffcc00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.2}
            outlineColor="#000000"
          >
            JOIN BATTLE
          </TextDrei>
          <RigidBody
            type="fixed"
            sensor
            onIntersectionEnter={() => startMatchSequence()}
            position={[0, 0.5, 0]}
          >
            <CuboidCollider args={[2, 0.5, 2]} />
            <mesh>
              <boxGeometry args={[4, 0.2, 4]} />
              <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={2} toneMapped={false} />
            </mesh>
          </RigidBody>
        </group>
      )}

      {/* DROP PLATFORMS (These vanish when match starts) */}
      {matchPhase === 'DROP' && countdown > 0 && dropPoints.map((pos, i) => (
        <RigidBody key={`drop-${i}`} type="fixed" position={pos} colliders="cuboid">
          <mesh receiveShadow>
            <boxGeometry args={[4, 1, 4]} />
            <meshStandardMaterial color="#0088ff" emissive="#0088ff" emissiveIntensity={2} />
          </mesh>
        </RigidBody>
      ))}

      {/* Phase Indicator (In-World) */}
      {(matchPhase === 'PREMATCH' || (matchPhase === 'DROP' && countdown > 0)) && (
        <group position={[0, 120, 0]}>
          <TextDrei
            fontSize={8}
            color="#ffffff"
            position={[0, 0, 0]}
            outlineWidth={0.5}
            outlineColor="#000000"
          >
            {matchPhase === 'PREMATCH' ? `MATCH STARTING IN ${countdown}...` : `THE DROP: ${countdown}`}
          </TextDrei>
        </group>
      )}

      {/* 3. Platform 2 */}
      <RigidBody type="fixed" position={[0, 100, -45]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[70, 2, 30]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 101.01, -45]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
      </mesh>
      <mesh position={[0, 98.99, -45]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[70, 30]} />
        <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
      </mesh>
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

      {/* 4. Connecting Bridge */}
      <RigidBody type="fixed" position={[0, 100, -22.5]} colliders="cuboid">
        <mesh receiveShadow>
          <boxGeometry args={[15, 2.0, 20]} />
          <meshStandardMaterial transparent opacity={0} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 101.01, -22.5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 20]} />
        <meshStandardMaterial map={darkWoodTexture} roughness={0.4} />
      </mesh>
      <mesh position={[0, 98.99, -22.5]} receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 20]} />
        <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0} />
      </mesh>
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

      {/* WEAPON PODIUMS on Platform 2 */}
      <group position={[0, 101, -45]}>
        <WeaponPodium weapon="Baguette" position={[-20, 0, 0]} color="#f1c232" />
        <WeaponPodium weapon="Donut" position={[0, 0, 0]} color="#ea9999" />
        <WeaponPodium weapon="Breadstick" position={[20, 0, 0]} color="#ce7e00" />
      </group>

      {/* 5. Cereal Box Obstacles (Individual Meshes with Custom Shader) */}
      {cerealBoxes.map((box) => (
        <CerealBoxMesh
          key={`mesh-${box.id}`}
          geometry={cerealBoxGeometry}
          material={cerealBoxMaterial}
          texture={munchiesTexture}
          position={box.position}
          rotation={box.rotation}
          color={box.color}
        />
      ))}

      {/* TinCan Obstacles – visual + physics combined */}
      {tinCans.map((can) => (
        <TinCanPhysics
          key={`tin-${can.id}`}
          position={can.position}
          rotation={can.rotation}
          color={can.color}
        />
      ))}

      {/* 6. Cereal Box Physics */}
      {cerealBoxes.map((box) => (
        <CerealBoxPhysics
          key={box.id}
          position={box.position}
          rotation={box.rotation}
          boxSize={box.size}
        />
      ))}
    </>
  );
}
