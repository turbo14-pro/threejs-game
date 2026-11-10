import {useEffect, useRef} from "react";
import {useGameStore} from "../../store/useGameStore";
import {soundManager} from "../../utils/SoundManager";
import {getRandomTrack} from "../../data/tracks";

/**
 * MusicPlayer — Autonomous streaming music player.
 * - On mount: picks random track, starts playback via SoundManager
 * - On track end: picks next random (excluding current), crossfades
 * - Preloads next track metadata while current plays
 * - Cleans up on unmount
 *
 * NOTE: the backing <audio> uses loop=false so the `ended` event fires
 * reliably. Auto-advance is driven by a `timeupdate` poll (not the ended
 * event) because MediaElementAudioSource elements attached to a GainNode
 * sometimes suppress the ended callback in Chromium when the element is
 * wired into the Web Audio graph. The poll is cheap — it only runs while
 * music is playing and checks against the element's duration.
 */
export default function MusicPlayer() {
    const gameState = useGameStore((state) => state.game.state);
    const musicVolume = useGameStore((state) => state.audio.musicVolume);
    const setCurrentTrack = useGameStore((state) => state.setCurrentTrack);

    const currentTrackRef = useRef(null);
    const endedHandlerRef = useRef(null);
    const timeupdateHandlerRef = useRef(null);
    const isMountedRef = useRef(true);

    // Keep musicVolume in sync with SoundManager (reactive to slider changes)
    useEffect(() => {
        soundManager.setMusicVolume(musicVolume);
    }, [musicVolume]);

    // Main lifecycle: only run when PLAYING
    useEffect(() => {
        if (gameState !== "PLAYING") {
            // Stop music when leaving play state
            soundManager.stopMusic();
            setCurrentTrack(null);
            currentTrackRef.current = null;
            return;
        }

        isMountedRef.current = true;
        let cancelled = false;

        const playNextTrack = async (excludeId = null) => {
            if (cancelled || !isMountedRef.current) return;

            const track = await getRandomTrack(excludeId);
            if (!track || cancelled || !isMountedRef.current) return;

            currentTrackRef.current = track;
            setCurrentTrack(track);
            soundManager.playMusic(track);

            // Set up timeupdate poll for auto-advance (loop=false → ended fires,
            // but the Web Audio graph can suppress it, so poll as a fallback).
            const element = soundManager.currentMusicElement;
            if (element) {
                // Remove old handler if any
                if (endedHandlerRef.current) {
                    element.removeEventListener("ended", endedHandlerRef.current);
                }
                if (timeupdateHandlerRef.current) {
                    element.removeEventListener("timeupdate", timeupdateHandlerRef.current);
                }

                endedHandlerRef.current = () => {
                    if (!isMountedRef.current) return;
                    playNextTrack(track.id);
                };

                timeupdateHandlerRef.current = () => {
                    if (!isMountedRef.current) return;
                    const el = soundManager.currentMusicElement;
                    if (!el || !el.duration || el.currentTime < el.duration - 0.5) return;
                    playNextTrack(track.id);
                };

                element.addEventListener("ended", endedHandlerRef.current);
                element.addEventListener("timeupdate", timeupdateHandlerRef.current);
            }
        };

        // Start first track
        playNextTrack();

        // Cleanup on unmount or gameState change
        return () => {
            cancelled = true;
            isMountedRef.current = false;
            const element = soundManager.currentMusicElement;
            if (element && endedHandlerRef.current) {
                element.removeEventListener("ended", endedHandlerRef.current);
            }
            if (element && timeupdateHandlerRef.current) {
                element.removeEventListener("timeupdate", timeupdateHandlerRef.current);
            }
            soundManager.stopMusic();
            setCurrentTrack(null);
            currentTrackRef.current = null;
        };
    }, [gameState, setCurrentTrack]);

    return null; // No visual output
}
