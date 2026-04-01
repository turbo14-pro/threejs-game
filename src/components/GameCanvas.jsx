import React from 'react';
import { Physics } from '@react-three/rapier';
import { useGameStore } from '../store/useGameStore';
import EnvironmentSetup from './World/EnvironmentSetup.jsx';
import Arena from './World/Arena.jsx';
import PlayerController from './Player/PlayerController.jsx';
import MenuCamera from './World/MenuCamera.jsx';
import Effects from './World/Effects.jsx';

export default function GameCanvas() {

  const gameState = useGameStore(state => state.gameState);

  return (
    <>
      <EnvironmentSetup />
      <Physics gravity={[0, -90, 0]}>
        <Arena />
        {gameState === 'PLAYING' ? <PlayerController /> : <MenuCamera />}
      </Physics>
      <Effects />
    </>
  );
}

