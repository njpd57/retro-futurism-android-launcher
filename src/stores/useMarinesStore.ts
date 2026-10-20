import { defineStore } from "pinia";
import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";

/** Best wave and score reached in ÚLTIMA DEFENSA. */
export interface MarinesRecords { wave: number; score: number }

/** How the game is played on this phone. */
export interface MarinesPrefs
{
    /** multiplies how far a drag on the view turns the player */
    sensitivity: number;
    /** frames a second: 30 spares the battery and the CRT filter, 60 aims smoother */
    fps: 30 | 60;
}

export const SENSITIVITY_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/**
 * The MARINES game screen, and what outlives it: the records and the preferences. The game itself lives in the
 * component.
 */
export const useMarinesStore = defineStore('marines', () =>
{
    const open = ref(false);
    const records = useLocalStorage<MarinesRecords>('widget.marines.records', { wave: 0, score: 0 }, { mergeDefaults: true });
    const prefs = useLocalStorage<MarinesPrefs>('widget.marines.prefs', { sensitivity: 1, fps: 30 }, { mergeDefaults: true });

    function show() { open.value = true; }
    function close() { open.value = false; }

    /** Keeps the best of each. */
    function record(wave: number, score: number)
    {
        if (wave > records.value.wave || score > records.value.score)
            records.value = { wave: Math.max(wave, records.value.wave), score: Math.max(score, records.value.score) };
    }

    return { open, records, prefs, show, close, record };
});
