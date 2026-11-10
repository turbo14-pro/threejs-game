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
    const bedRef = useRef(null);

    useEffect(() => {
        // Load amb-bed.ogg if not already cached
        if (!soundManager.sounds.has("amb-bed")) {
            soundManager.load("amb-bed", "audio/amb-bed.ogg").then(() => {
                const bed = soundManager.playAmbientBed("amb-bed", ambientVolume);
                bedRef.current = bed;
            });
        } else {
            const bed = soundManager.playAmbientBed("amb-bed", ambientVolume);
            bedRef.current = bed;
        }

        return () => {
            if (bedRef.current) {
                soundManager.releaseAmbientBed(bedRef.current);
                bedRef.current = null;
            }
        };
    }, []); // Run once on mount

    // Update volume when the slider changes
    useEffect(() => {
        if (bedRef.current) {
            bedRef.current.setVolume(ambientVolume);
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
