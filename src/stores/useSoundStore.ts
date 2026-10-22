import { defineStore } from "pinia";
import { watch } from "vue";
import { resumeAudio, setBusVolume, setMasterVolume, suspendAudio } from "@/audio/context";
import { applyAmbientMix, previewAmbient, setAmbientLevel, setAmbientMood, startAmbient, stopAmbient, type AmbientMood } from "@/audio/ambient";
import { shipAmbientRunning, startShipAmbient, stopShipAmbient, updateShipAmbient } from "@/audio/shipAmbient";
import { hear } from "@/ship3d/acoustics";
import { normalizeMix, setMix } from "@/audio/mix";
import { profileOf } from "@/audio/profiles";
import { playSfx, setProfile, type SfxName } from "@/audio/sfx";
import { useBridgeEventStore } from "./useBridgeEventStore";
import { useSettingsStore } from "./useSettingsStore";

/** A sample of the interface for [PROBAR SONIDOS]: name and delay in ms. */
const TEST_SEQUENCE: readonly [SfxName, number][] = [['key', 0], ['select', 250], ['toggleOn', 500], ['open', 800], ['notify', 1300], ['alert', 2000], ['pulse', 3000], ['door', 3500]];

/** Synthesized UI sounds and the ambient hum, gated by the settings. Silent while the launcher is paused. */
export const useSoundStore = defineStore('sound', () =>
{
    const settings = useSettingsStore();
    const bridgeEvents = useBridgeEventStore();

    let paused = false;
    let unlocked = false;
    let mood: AmbientMood = 'calm';
    let testTimers: number[] = [];

    // the ship panel is on screen: its rooms hum, and the terminal hum steps back so they don't pile up
    let shipHere = false;
    let lastListen = 0;

    function applyAmbientLevel()
    {
        const share = profileOf(settings.soundProfile).ambient;
        setAmbientLevel(shipAmbientRunning() ? share * 0.4 : share);
    }

    function syncShip()
    {
        if (settings.soundAmbient && settings.shipRoomSound && unlocked && !paused && shipHere) startShipAmbient(); else stopShipAmbient();
        applyAmbientLevel();
    }

    function syncAmbient()
    {
        if (settings.soundAmbient && unlocked && !paused) startAmbient(); else stopAmbient();
        syncShip();
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
    setBusVolume('ui', settings.volumeUi);
    watch(() => settings.volumeUi, v => setBusVolume('ui', v));
    setBusVolume('ambient', settings.volumeAmbient);
    watch(() => settings.volumeAmbient, v => setBusVolume('ambient', v));
    setBusVolume('game', settings.volumeGame);
    watch(() => settings.volumeGame, v => setBusVolume('game', v));

    const applyMix = () => { setMix(normalizeMix(settings.soundMix)); applyAmbientMix(); };
    applyMix();
    watch(() => settings.soundMix, applyMix, { deep: true });

    const applyProfile = () =>
    {
        setProfile(profileOf(settings.soundProfile));
        applyAmbientLevel();
    };
    applyProfile();
    watch(() => settings.soundProfile, applyProfile);
    watch(() => settings.soundAmbient, syncAmbient);
    watch(() => settings.shipRoomSound, syncShip);

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'beforePause')
        {
            paused = true;
            stopAmbient();
            syncShip();
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

    /** [▶] in the mixer: one sample of a sound by its id, heard even when its channel is off. */
    function preview(id: string)
    {
        unlock();
        resumeAudio();
        if (id.startsWith('amb')) previewAmbient(id);
        else playAlways(id as SfxName);
    }

    /** The ambient hum rises and throbs while the ship is on alert. */
    function setMood(m: AmbientMood)
    {
        mood = m;
        setAmbientMood(m);
    }

    /** [PROBAR SONIDOS]: a short sample, heard even when the UI sound is off. */
    function test()
    {
        unlock();
        resumeAudio();
        for (const id of testTimers) window.clearTimeout(id);
        testTimers = TEST_SEQUENCE.map(([name, delay]) => window.setTimeout(() => playAlways(name), delay));
    }

    /** The ship panel appeared or went away. */
    function setShip(on: boolean)
    {
        shipHere = on;
        syncShip();
    }

    /** Where the camera is: the rooms' hum follows it (ten times a second at most). */
    function listenShip(x: number, y: number, yaw: number, doors: ArrayLike<number>)
    {
        if (!shipAmbientRunning()) return;
        const now = performance.now();
        if (now - lastListen < 100) return;
        lastListen = now;
        updateShipAmbient(hear(x, y, yaw, doors));
    }

    return { play, playAlways, preview, setMood, test, setShip, listenShip, mood: () => mood };
});
