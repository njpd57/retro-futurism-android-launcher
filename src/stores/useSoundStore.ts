import { defineStore } from "pinia";
import { watch } from "vue";
import { resumeAudio, setMasterVolume, suspendAudio } from "@/audio/context";
import { startAmbient, stopAmbient } from "@/audio/ambient";
import { playSfx, type SfxName } from "@/audio/sfx";
import { useBridgeEventStore } from "./useBridgeEventStore";
import { useSettingsStore } from "./useSettingsStore";

/** Synthesized UI sounds and the ambient hum, gated by the settings. Silent while the launcher is paused. */
export const useSoundStore = defineStore('sound', () =>
{
    const settings = useSettingsStore();
    const bridgeEvents = useBridgeEventStore();

    let paused = false;
    let unlocked = false;

    function syncAmbient()
    {
        if (settings.soundAmbient && unlocked && !paused) startAmbient(); else stopAmbient();
    }

    // browsers only start audio after a gesture
    function unlock()
    {
        if (unlocked) return;
        unlocked = true;
        resumeAudio();
        syncAmbient();
    }
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });

    setMasterVolume(settings.volume);
    watch(() => settings.volume, setMasterVolume);
    watch(() => settings.soundAmbient, syncAmbient);

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'beforePause')
        {
            paused = true;
            stopAmbient();
            suspendAudio();
        }
        else if (ev.name === 'afterResume')
        {
            paused = false;
            resumeAudio();
            syncAmbient();
        }
    });

    function play(name: SfxName)
    {
        if (!settings.soundUi || paused) return;
        playSfx(name);
    }

    /** Plays regardless of the UI-sound setting (alarms, game events the user asked for). */
    function playAlways(name: SfxName)
    {
        if (!paused) playSfx(name);
    }

    return { play, playAlways };
});
