import { defineStore } from "pinia";
import { ref } from "vue";

/** The AISLAMIENTO game screen. For now only whether it is open; the game lives in the component. */
export const useIsolationStore = defineStore('isolation', () =>
{
    const open = ref(false);

    function show() { open.value = true; }
    function close() { open.value = false; }

    return { open, show, close };
});
