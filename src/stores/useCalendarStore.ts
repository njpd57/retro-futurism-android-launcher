import { defineStore } from "pinia";
import { ref } from "vue";
import type { BridgeCalendarEvent } from "@/types/bridge-fork";
import { bridgeHas } from "@/utils/bridgeHas";
import { useBridgeEventStore } from "./useBridgeEventStore";

const DAYS_AHEAD = 4;

/** Upcoming calendar events (today and the next days) from the fork. */
export const useCalendarStore = defineStore('calendar', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const supported = bridgeHas('getCalendarEventsURL') && bridgeHas('getCanReadCalendar');
    const canRead = ref(false);
    const events = ref<BridgeCalendarEvent[]>([]);

    async function sync()
    {
        if (!supported) return;

        canRead.value = Bridge.getCanReadCalendar();
        if (!canRead.value)
        {
            events.value = [];
            return;
        }

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + DAYS_AHEAD);

        try
        {
            const resp = await fetch(Bridge.getCalendarEventsURL(start.getTime(), end.getTime()));
            events.value = ((await resp.json()) as { events: BridgeCalendarEvent[] }).events;
        }
        catch (err)
        {
            console.error(err);
        }
    }

    sync();

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'calendarChanged' || ev.name === 'canReadCalendarChanged' || ev.name === 'afterResume')
            sync();
    });

    function requestAccess() { Bridge.requestCalendarPermission(); }
    function openEvent(e: BridgeCalendarEvent) { Bridge.requestOpenCalendarEvent(e.eventId, e.begin, e.end); }

    return { supported, canRead, events, sync, requestAccess, openEvent };
});
