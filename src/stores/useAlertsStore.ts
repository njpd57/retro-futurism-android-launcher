import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { computed, watch } from "vue";
import { pendingAlerts, type AlertContext, type ShipAlert } from "@/protocols/alerts";
import { dayKey } from "@/utils/day";
import { useAlarmStore } from "./useAlarmStore";
import { useCalendarStore } from "./useCalendarStore";
import { useLogStore } from "./useLogStore";
import { useRemindersStore } from "./useRemindersStore";
import { useSentinelStore } from "./useSentinelStore";
import { useSettingsStore } from "./useSettingsStore";
import { useShipClockStore } from "./useShipClockStore";
import { useSoundStore } from "./useSoundStore";
import { useSystemStatusStore } from "./useSystemStatusStore";

/** ALERTAS DE A BORDO: what the ship's computer warns about on its own. Dismissed by id and by day. */
export const useAlertsStore = defineStore('alerts', () =>
{
    const settings = useSettingsStore();
    const calendar = useCalendarStore();
    const system = useSystemStatusStore();
    const alarm = useAlarmStore();
    const reminders = useRemindersStore();
    const clock = useShipClockStore();
    const sound = useSoundStore();
    const log = useLogStore();
    const sentinel = useSentinelStore();

    const saved = useLocalStorage<{ day: string; ids: string[] }>('widget.alerts.dismissed', { day: '', ids: [] });
    const dismissed = computed(() => new Set(saved.value && saved.value.day === dayKey(clock.now) && Array.isArray(saved.value.ids) ? saved.value.ids : []));

    const context = computed<AlertContext>(() => ({
        now: clock.now,
        events: calendar.events,
        battery: system.battery,
        nextAlarm: alarm.nextAlarm?.triggerTime ?? null,
        reminders: reminders.items,
        sitesDown: sentinel.down,
    }));

    const alerts = computed(() => pendingAlerts(
        context.value,
        { event: settings.alertsEvent, battery: settings.alertsBattery, alarm: settings.alertsAlarm, site: settings.alertsSites },
        dismissed.value,
    ));

    // the ambient hum throbs while any alert is pending
    watch(() => alerts.value.length > 0, on => sound.setMood(on ? 'alert' : 'calm'), { immediate: true });

    // a new alert is logged and, if the user wants it, announced with the klaxon
    watch(alerts, (after, before) =>
    {
        const known = new Set((before ?? []).map(a => a.id));
        const fresh = after.filter(a => !known.has(a.id));
        for (const a of fresh) log.push('ALR', a.text);
        if (fresh.length && settings.alertsKlaxon) sound.play('klaxon');
    });

    function dismiss(alert: ShipAlert)
    {
        if (alert.kind === 'reminder') { reminders.complete(alert.id.slice('reminder:'.length)); return; }
        const today = dayKey(clock.now);
        const ids = saved.value && saved.value.day === today && Array.isArray(saved.value.ids) ? saved.value.ids : [];
        saved.value = { day: today, ids: [...ids, alert.id] };
    }

    return { alerts, dismiss };
});
