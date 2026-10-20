import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Submenu } from '@/utils/settingsSchema';

/**
 * Where the settings page is: the open section (null = the root) and the submenu on top of it.
 * Not persisted. App.vue's back handler steps out of these one at a time before closing the page.
 */
export const useSettingsViewStore = defineStore('settingsView', () =>
{
    const section = ref<string | null>(null);
    const submenu = ref<Submenu | null>(null);

    function reset() { section.value = null; submenu.value = null; }

    /** One step back; false when there was nothing open inside the page. */
    function back()
    {
        if (submenu.value) submenu.value = null;
        else if (section.value) section.value = null;
        else return false;
        return true;
    }

    return { section, submenu, reset, back };
});
