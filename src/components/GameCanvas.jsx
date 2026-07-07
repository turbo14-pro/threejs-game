import React from 'react';
import { Physics } from '@react-three/rapier';
import { useGameStore } from '../store/useGameStore';
import EnvironmentSetup from './World/EnvironmentSetup.jsx';
import Arena from './World/Arena.jsx';
import PlayerController from './Player/PlayerController.jsx';
import RemotePlayers from './Player/RemotePlayers.jsx';
import MenuCamera from './World/MenuCamera.jsx';
import Effects from './World/Effects.jsx';
import SoundListener from './World/SoundListener.jsx';
import { SKINS } from '../data/registries';

export default function GameCanvas({ sendUpdate }) {

  const gameState = useGameStore(state => state.game.state);
  const physicsDebug = useGameStore(state => state.settings.physicsDebug);

  return (
    <>
      <EnvironmentSetup />
      <SoundListener />
      <Physics gravity={[0, -90.81, 0]} debug={physicsDebug}>
        <Arena />
        {gameState === 'PLAYING' ? (
          <>
            <PlayerController sendUpdate={sendUpdate} />
            <RemotePlayers />
          </>
        ) : (
          <MenuCamera />
        )}
      </Physics>
      <Effects />
    </>
  );
}

