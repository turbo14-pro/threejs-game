import React, { Suspense, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { KeyboardControls } from '@react-three/drei';
import MainMenu from './components/UI/MainMenu.jsx';
import HUD from './components/UI/HUD.jsx';
import GameCanvas from './components/GameCanvas.jsx';
import { useGameStore } from './store/useGameStore.js';
import { useNetworking } from './hooks/useNetworking.js';
import NetworkStatus from './components/UI/NetworkStatus.jsx';

export default function App() {
  const gameState = useGameStore(state => state.game.state);
  const { sendUpdate } = useNetworking();

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent browser shortcuts for Ctrl + keys (like Ctrl+S, Ctrl+D)
      // Note: Some browsers still force Ctrl+W or Ctrl+T to work, so we also add 'KeyC' as an alternative slide key.
      if (e.ctrlKey && e.code !== 'KeyI' && e.code !== 'KeyR' && e.code !== 'KeyC' && e.code !== 'KeyV') {
        e.preventDefault();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const map = useMemo(() => [
    { name: "forward", keys: ["ArrowUp", "KeyW"] },
    { name: "backward", keys: ["ArrowDown", "KeyS"] },
    { name: "left", keys: ["ArrowLeft", "KeyA"] },
    { name: "right", keys: ["ArrowRight", "KeyD"] },
    { name: "jump", keys: ["Space"] },
    { name: "walk", keys: ["ShiftLeft", "ShiftRight"] },
    { name: "slide", keys: ["KeyC"] },
    { name: "dash", keys: ["KeyQ"] },
  ], []);

  return (
    <KeyboardControls map={map}>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        {gameState === 'MENU' && <MainMenu />}
        {gameState === 'PLAYING' && <HUD />}
        <NetworkStatus />
        
        <Canvas shadows={{ type: THREE.PCFSoftShadowMap }} gl={{ antialias: false, toneMapping: THREE.NoToneMapping }} camera={{ position: [0, 50, 100], fov: 75, near: 0.5, far: 2000 }} style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
          <Suspense fallback={null}>
            <color attach="background" args={['#958164']} />
            <fogExp2 attach="fog" args={['#958164', 0.004]} />
            <GameCanvas sendUpdate={sendUpdate} />

          </Suspense>
        </Canvas>
      </div>
    </KeyboardControls>
  );
}
