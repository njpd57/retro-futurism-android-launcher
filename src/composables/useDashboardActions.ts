import { useSettingsStore } from '@/stores/useSettingsStore';
import { addWidgetToActive, allItems } from '@/utils/dashboardLayout';
import { appendNoteLine } from '@/utils/notes';

function read(key: string)
{
    try { return localStorage.getItem(key); }
    catch { return null; }
}

function write(key: string, value: string)
{
    try { localStorage.setItem(key, value); return true; }
    catch { return false; }
}

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

    // The widgets read their storage when they mount, and none of them is on screen while these run (the
    // console is on the APPS tab, MOTHER on its own tab), so the value is written straight to localStorage.

    function saveNote(text: string)
    {
        const key = `widget.notes.${ensureWidget('notes').id}`;
        return write(key, appendNoteLine(read(key), text));
    }

    function startTimer(minutes: number)
    {
        const key = `widget.timer.${ensureWidget('timer').id}`;
        return write(key, JSON.stringify(Date.now() + minutes * 60_000));
    }

    return { saveNote, startTimer };
}
