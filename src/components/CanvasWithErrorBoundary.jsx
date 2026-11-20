import React from 'react';
import { Canvas } from '@react-three/fiber';
import ErrorBoundary from './ErrorBoundary.jsx';

export default function CanvasWithErrorBoundary({sendUpdate}) {
  return (
    <ErrorBoundary>
      <Canvas
        id="game-canvas"
        shadows
        gl={{antialias: true, toneMapping: THREE.NoToneMapping, toneMappingExposure: 0.9}}
        camera={{position: [0, 50, 100], fov: 75, near: 0.5, far: 2000}}
        style={{position: "absolute", top: 0, left: 0, zIndex: 0}}>
        <Suspense fallback={null}>
          <ShadowUpdater />
          <color attach="background" args={["#958164"]} />
          <fogExp2 attach="fog" args={["#6b8fc7", 0.0035]} />
          <GameCanvas sendUpdate={sendUpdate} />
        </Suspense>
      </Canvas>
    </ErrorBoundary>
  );
}