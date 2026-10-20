import { defineStore } from "pinia";
import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import type { Difficulty } from "@/games/isolation/difficulty";
import { EMPTY_PROGRESS, isProgress, record as recordEvent, type Progress, type RunEvent } from "@/games/isolation/progress";
import { isSavedGame, type SavedGame } from "@/games/isolation/save";
import { nullableJson } from "@/utils/storage";

/** How the game is played on this phone. */
export interface IsolationPrefs
{
    difficulty: Difficulty;
    /** multiplies how far a drag on the view turns the player */
    sensitivity: number;
}

export const SENSITIVITY_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/**
 * The AISLAMIENTO game screen, and what outlives it: the last terminal save, the game suspended when the player
 * left (Atrás, Home, the app going to the background) and the archive of everything done over all runs. The game
 * itself lives in the component.
 */
export const useIsolationStore = defineStore('isolation', () =>
{
    const open = ref(false);
    const save = useLocalStorage<SavedGame | null>('widget.isolation.save', null, { serializer: nullableJson(isSavedGame) });
    const suspended = useLocalStorage<SavedGame | null>('widget.isolation.suspend', null, { serializer: nullableJson(isSavedGame) });
    const progress = useLocalStorage<Progress>('widget.isolation.progress', structuredClone(EMPTY_PROGRESS), { serializer: {
        read: raw => { try { const v: unknown = JSON.parse(raw); return isProgress(v) ? v : structuredClone(EMPTY_PROGRESS); } catch { return structuredClone(EMPTY_PROGRESS); } },
        write: v => JSON.stringify(v),
    } });
    const prefs = useLocalStorage<IsolationPrefs>('widget.isolation.prefs', { difficulty: 'normal', sensitivity: 1 }, { mergeDefaults: true });

    /** Folds something that happened in a run into the archive; returns the achievements it earned. */
    function record(event: RunEvent): string[]
    {
        const r = recordEvent(progress.value, event);
        progress.value = r.progress;
        return r.earned;
    }

    function show() { open.value = true; }
    function close() { open.value = false; }

    return { open, save, suspended, progress, prefs, record, show, close };
});
