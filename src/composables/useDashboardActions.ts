import { useLocalStorage } from '@vueuse/core';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { addWidgetToActive, allItems } from '@/utils/dashboardLayout';
import { appendNoteLine } from '@/utils/notes';

/** Things the console and MOTHER can do to the dashboard widgets. */
export function useDashboardActions()
{
    const settings = useSettingsStore();

    /** The first widget of that kind in any panel; created in the visible panel when there is none. */
    function ensureWidget(kind: string)
    {
        let item = allItems(settings.layouts).find(i => i.kind === kind);
        if (!item)
        {
            settings.layouts = addWidgetToActive(settings.layouts, kind);
            item = settings.dashboard[settings.dashboard.length - 1];
        }
        return item;
    }

    function saveNote(text: string)
    {
        const stored = useLocalStorage(`widget.notes.${ensureWidget('notes').id}`, '');
        stored.value = appendNoteLine(stored.value, text);
    }

    function startTimer(minutes: number)
    {
        const stored = useLocalStorage<number | null>(`widget.timer.${ensureWidget('timer').id}`, null);
        stored.value = Date.now() + minutes * 60_000;
    }

    return { saveNote, startTimer };
}
