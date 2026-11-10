import {useEffect, useState} from "react";
import {useGameStore} from "../../store/useGameStore";

/**
 * NowPlaying — HUD overlay showing current track title & artist.
 * Fades in/out on track change. Only visible during PLAYING state.
 */
export default function NowPlaying() {
    const gameState = useGameStore((state) => state.game.state);
    const currentTrack = useGameStore((state) => state.audio.currentTrack);

    const [displayTrack, setDisplayTrack] = useState(null);
    const [visible, setVisible] = useState(false);

    // Fade in/out on track change
    useEffect(() => {
        if (!currentTrack) {
            setVisible(false);
            // Delay clearing displayTrack to allow fade-out animation
            setTimeout(() => setDisplayTrack(null), 800);
            return;
        }

        setDisplayTrack(currentTrack);
        setVisible(true);
    }, [currentTrack]);

    // Hide when not playing
    useEffect(() => {
        if (gameState !== "PLAYING") {
            setVisible(false);
            setTimeout(() => setDisplayTrack(null), 800);
        }
    }, [gameState]);

    if (!displayTrack) return null;

    return (
        <div className={`now-playing-hud ${visible ? "visible" : ""}`} role="status" aria-live="polite">
            <span className="now-playing-label">♪ Now Playing</span>
            <span className="now-playing-title">{displayTrack.title}</span>
            <span className="now-playing-separator">—</span>
            <span className="now-playing-artist">{displayTrack.artist}</span>
        </div>
    );
}
