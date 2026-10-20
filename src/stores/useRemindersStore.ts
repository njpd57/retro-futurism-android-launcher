import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { computed } from "vue";
import { formatWhen, normalizeReminders, pendingReminders, type Reminder, type ReminderDraft } from "@/utils/reminders";
import { useLogStore } from "./useLogStore";

/** Reminders typed with `> recordar` or `/recordar`. They fire as an alert while the launcher is running. */
export const useRemindersStore = defineStore('reminders', () =>
{
    const log = useLogStore();

    const items = useLocalStorage<Reminder[]>('widget.reminders', []);
    items.value = normalizeReminders(items.value, Date.now());

    const pending = computed(() => pendingReminders(items.value));

    function add(draft: ReminderDraft): Reminder
    {
        const reminder: Reminder = { id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, at: draft.at, text: draft.text, done: false };
        items.value = [...items.value, reminder];
        log.push('REM', `PROGRAMADO ${formatWhen(reminder.at, new Date())}: ${reminder.text.toUpperCase()}`);
        return reminder;
    }

    /** Dismisses a reminder that fired, or cancels one that has not. */
    function complete(id: string)
    {
        items.value = items.value.map(r => r.id === id ? { ...r, done: true } : r);
    }

    return { items, pending, add, complete };
});
