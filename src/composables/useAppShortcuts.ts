import { ref, watch, type Ref } from 'vue';
import type { BridgeAppShortcut } from '@/types/bridge-fork';
import { bridgeHas } from '@/utils/bridgeHas';

/** Launcher shortcuts of the app whose package name is in `packageName` (empty when unavailable). */
export function useAppShortcuts(packageName: Ref<string | null>)
{
    const shortcuts = ref<BridgeAppShortcut[]>([]);

    watch(packageName, async pkg =>
    {
        shortcuts.value = [];
        if (!pkg || !bridgeHas('getAppShortcutsURL') || !bridgeHas('getCanAccessAppShortcuts') || !Bridge.getCanAccessAppShortcuts()) return;

        try
        {
            const resp = await fetch(Bridge.getAppShortcutsURL(pkg));
            const list = ((await resp.json()) as { shortcuts: BridgeAppShortcut[] }).shortcuts;
            if (packageName.value === pkg) shortcuts.value = list;
        }
        catch (err)
        {
            console.error(err);
        }
    }, { immediate: true });

    function start(shortcutId: string)
    {
        if (packageName.value) Bridge.requestStartAppShortcut(packageName.value, shortcutId);
    }

    return { shortcuts, start };
}
