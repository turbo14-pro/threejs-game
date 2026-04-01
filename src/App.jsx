import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import MainMenu from './components/UI/MainMenu.jsx';
import HUD from './components/UI/HUD.jsx';
import GameCanvas from './components/GameCanvas.jsx';
import { useGameStore } from './store/useGameStore.js';

export default function App() {
  const gameState = useGameStore(state => state.gameState);

  const map = useMemo(() => [
    { name: "forward", keys: ["ArrowUp", "KeyW"] },
    { name: "backward", keys: ["ArrowDown", "KeyS"] },
    { name: "left", keys: ["ArrowLeft", "KeyA"] },
    { name: "right", keys: ["ArrowRight", "KeyD"] },
    { name: "jump", keys: ["Space"] },
    { name: "sprint", keys: ["ShiftLeft", "ShiftRight"] },
  ], []);

  return (
    <KeyboardControls map={map}>
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        {gameState === 'MENU' && <MainMenu />}
        {gameState === 'PLAYING' && <HUD />}
        
        <Canvas shadows gl={{ antialias: false }} camera={{ position: [0, 50, 100], fov: 75, near: 0.5, far: 2000 }} style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
          <Suspense fallback={null}>
            <color attach="background" args={['#101010']} />
            <GameCanvas />
          </Suspense>
        </Canvas>
      </div>
    </KeyboardControls>
  );
}
