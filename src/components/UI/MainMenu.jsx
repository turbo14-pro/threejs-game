import React, {useState} from "react";
import {useGameStore} from "../../store/useGameStore";
import {useMenuKeyboard} from "../../hooks/useMenuKeyboard.js";
import Options from "./Options.jsx";
import FluidGlassPanel from "./FluidGlassPanel/FluidGlassPanel";
import {Play, Settings} from "lucide-react";

export default function MainMenu() {
    const setGameState = useGameStore((state) => state.setGameState);

    const [page, setPage] = useState("START"); // 'START' | 'OPTIONS'
    const [isLoading, setIsLoading] = useState(false);
    const menuRef = useMenuKeyboard({
        enabled: true,
        screen: page,
        onBack: page === "OPTIONS" ? () => setPage("START") : undefined,
    });

    const handleStartGame = async () => {
        setIsLoading(true);
        setGameState("PLAYING");

        // Capture the mouse to enter the game instantly
        setTimeout(() => {
            const canvas = document.querySelector("canvas");
            if (canvas) canvas.requestPointerLock();
            setIsLoading(false);
        }, 100);
    };

    return (
        <div className="menu-overlay">
            <FluidGlassPanel
                ref={menuRef}
                refraction={0.25}
                spin={0}
                frost={0.5}
                shadow={1}
                dispersion={1}
                interaction="follow"
                smoothness={0.5}
                wobble={0.5}
                idle={true}
                intro={true}>
                {page === "START" && (
                    <>
                        <h1>FOOD FRENZY</h1>
                        <div className="menu-stack">
                            <button className="char-btn main-btn" onClick={handleStartGame} disabled={isLoading}>
                                <Play size={20} strokeWidth={2} />
                                <span className="btn-name">{isLoading ? "LOADING..." : "START GAME"}</span>
                            </button>
                            <button className="char-btn main-btn" onClick={() => setPage("OPTIONS")}>
                                <Settings size={20} strokeWidth={2} />
                                <span className="btn-name">OPTIONS</span>
                            </button>
                        </div>
                    </>
                )}

                {page === "OPTIONS" && <Options onBack={() => setPage("START")} />}
            </FluidGlassPanel>
        </div>
    );
}
