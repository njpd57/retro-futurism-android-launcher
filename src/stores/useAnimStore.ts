import { defineStore } from "pinia";
import { computed } from "vue";
import { useReducedMotion } from "@/composables/useReducedMotion";
import { animEnabled } from "@/utils/anim";
import { useSettingsStore } from "./useSettingsStore";

/** Which animation categories are running: the user's toggles, all off under `prefers-reduced-motion`. */
export const useAnimStore = defineStore('anim', () =>
{
    const settings = useSettingsStore();
    const reduced = useReducedMotion();
    const flags = computed(() => ({ text: settings.animText, transitions: settings.animTransitions, ambient: settings.animAmbient }));

    const text = computed(() => animEnabled('text', flags.value, reduced.value));
    const transitions = computed(() => animEnabled('transitions', flags.value, reduced.value));
    const ambient = computed(() => animEnabled('ambient', flags.value, reduced.value));

    return { text, transitions, ambient };
});
