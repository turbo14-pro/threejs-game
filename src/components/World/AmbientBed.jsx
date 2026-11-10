import {useEffect, useRef} from "react";
import {useGameStore} from "../../store/useGameStore";
import {soundManager} from "../../utils/SoundManager";

/**
 * AmbientBed — looping ambient bed attached to the camera (follows the player).
 * Volume is driven by the store's audio.ambientVolume. Crossfades on zone change.
 */
export default function AmbientBed() {
    const ambientVolume = useGameStore((state) => state.audio.ambientVolume);
    const reverbZone = useGameStore((state) => state.audio.reverbZone);
    const occlusionGain = useGameStore((state) => state.audio.occlusionGain);
    const bedRef = useRef({primary: null, secondary: null});

    useEffect(() => {
        // Load amb-bed.ogg if not already cached
        if (!soundManager.sounds.has("amb-bed")) {
            soundManager.load("amb-bed", "audio/amb-bed.ogg").then(() => {
                const bed = soundManager.playAmbientBed("amb-bed", ambientVolume);
                bedRef.current.primary = bed;
                bedRef.current.secondary = soundManager.ambientBedB;
            });
        } else {
            const bed = soundManager.playAmbientBed("amb-bed", ambientVolume);
            bedRef.current.primary = bed;
            bedRef.current.secondary = soundManager.ambientBedB;
        }

        return () => {
            if (bedRef.current.primary) {
                soundManager.releaseAmbientBed(bedRef.current.primary);
                bedRef.current.primary = null;
            }
            if (bedRef.current.secondary) {
                soundManager.releaseAmbientBed(bedRef.current.secondary);
                bedRef.current.secondary = null;
            }
        };
    }, []); // Run once on mount

    // Update volume when the slider changes — ambient bed is always capped at 1/4
    useEffect(() => {
        const cappedVolume = Math.min(ambientVolume, 0.25);
        if (bedRef.current.primary && typeof bedRef.current.primary.setVolume === "function") {
            bedRef.current.primary.setVolume(cappedVolume);
        }
        if (bedRef.current.secondary && typeof bedRef.current.secondary.setVolume === "function") {
            bedRef.current.secondary.setVolume(cappedVolume);
        }
    }, [ambientVolume]);

    // Crossfade reverb zone on zone change
    useEffect(() => {
        soundManager.setReverbZone(reverbZone);
    }, [reverbZone]);

    // Apply occlusion gain to the bed
    useEffect(() => {
        soundManager.setOcclusionGain(occlusionGain);
    }, [occlusionGain]);

    return null;
}
