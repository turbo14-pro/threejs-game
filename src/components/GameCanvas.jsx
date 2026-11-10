import React from "react";
import {Physics} from "@react-three/rapier";
import {useGameStore} from "../store/useGameStore";
import EnvironmentSetup from "./World/EnvironmentSetup.jsx";
import Arena from "./World/Arena.jsx";
import PlayerController from "./Player/PlayerController.jsx";
import RemotePlayers from "./Player/RemotePlayers.jsx";
import BotPlayers from "./Player/BotPlayers.jsx";
import MenuCamera from "./World/MenuCamera.jsx";
import Effects from "./World/Effects.jsx";
import SoundListener from "./World/SoundListener.jsx";
import AmbientBed from "./World/AmbientBed.jsx";
import AmbientSFX from "./World/AmbientSFX.jsx";
import Occlusion from "./World/Occlusion.jsx";
import MusicPlayer from "./World/MusicPlayer.jsx";

export default function GameCanvas({sendUpdate}) {
    const gameState = useGameStore((state) => state.game.state);
    const physicsDebug = useGameStore((state) => state.settings.physicsDebug);

    return (
        <>
            <EnvironmentSetup />
            <SoundListener />
            <AmbientBed />
            <AmbientSFX />
            <Occlusion />
            <MusicPlayer />
            <Physics gravity={[0, -90.81, 0]} timestep={0.0333} debug={physicsDebug}>
                <Arena />
                {/* Bots spawn on the arena from the very first frame — menu included — so the
            world never looks empty before "Game Start" is pressed. */}
                <BotPlayers />
                {gameState === "PLAYING" ? (
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
