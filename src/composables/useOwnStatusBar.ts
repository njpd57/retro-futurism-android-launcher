import { useLocalStorage } from "@vueuse/core";
import { watch, type Ref } from "vue";
import { useTogglesStore } from "@/stores/useTogglesStore";

/**
 * Hides the system status bar while `enabled` is on, and restores the previous appearance when it's turned off.
 * The previous value is kept in localStorage so it survives a reload while the bar is hidden.
 */
export function useOwnStatusBar(enabled: Ref<boolean>)
{
    const toggles = useTogglesStore();
    const previous = useLocalStorage<string | null>('statusBar.previousAppearance', null);

    watch(enabled, on =>
    {
        if (on)
        {
            if (toggles.statusBarAppearance !== 'hide')
            {
                previous.value = toggles.statusBarAppearance;
                toggles.statusBarAppearance = 'hide';
            }
        }
        else if (previous.value !== null)
        {
            toggles.statusBarAppearance = previous.value as typeof toggles.statusBarAppearance;
            previous.value = null;
        }
    }, { immediate: true });
}
