import { defineStore } from "pinia";
import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { isSavedGame, type SavedGame } from "@/games/isolation/save";
import { nullableJson } from "@/utils/storage";

/**
 * The AISLAMIENTO game screen, and what outlives it: the last terminal save and the game suspended when the
 * player left (Atrás, Home, the app going to the background). The game itself lives in the component.
 */
export const useIsolationStore = defineStore('isolation', () =>
{
    const open = ref(false);
    const save = useLocalStorage<SavedGame | null>('widget.isolation.save', null, { serializer: nullableJson(isSavedGame) });
    const suspended = useLocalStorage<SavedGame | null>('widget.isolation.suspend', null, { serializer: nullableJson(isSavedGame) });

    function show() { open.value = true; }
    function close() { open.value = false; }

    return { open, save, suspended, show, close };
});
