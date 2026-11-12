import React, {useState} from "react";
import {useGameStore} from "../../store/useGameStore";
import {useMenuKeyboard} from "../../hooks/useMenuKeyboard.js";
import Options from "./Options.jsx";
import GlassSurface from "./GlassSurface";
import {Play, Settings} from "lucide-react";
import {requestGamePointerLock} from "../../utils/gameCanvas.js";
import "./Menu.css";

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
            requestGamePointerLock();
            setIsLoading(false);
        }, 100);
    };

    return (
        <div className="menu">
            <GlassSurface borderRadius={38} distortionScale={-180} displace={0.5} backgroundOpacity={0.1}>
                {page === "START" && (
                    <>
                        <h1 className="menu__title">FOOD FRENZY</h1>
                        <div className="menu__stack">
                            <button className="menu__button" onClick={handleStartGame} disabled={isLoading}>
                                <Play size={20} strokeWidth={2} />
                                <span className="menu__button-name">{isLoading ? "LOADING..." : "START GAME"}</span>
                            </button>
                            <button className="menu__button" onClick={() => setPage("OPTIONS")}>
                                <Settings size={20} strokeWidth={2} />
                                <span className="menu__button-name">OPTIONS</span>
                            </button>
                        </div>
                    </>
                )}

                {page === "OPTIONS" && <Options onBack={() => setPage("START")} />}
            </GlassSurface>
        </div>
    );
}
