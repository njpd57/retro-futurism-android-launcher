import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { annunciators, newlyLit, storageText, tickerQueue, type ConsoleState, type LampId } from "@/utils/bridgeConsole";
import { appLabelFor } from "@/utils/notifications";
import { weatherText } from "@/utils/weather";
import { useAlarmStore } from "./useAlarmStore";
import { useAppsStore } from "./useAppsStore";
import { useCalendarStore } from "./useCalendarStore";
import { useMotherStore } from "./useMotherStore";
import { useNotificationsStore } from "./useNotificationsStore";
import { useProtocolsStore } from "./useProtocolsStore";
import { useRemindersStore } from "./useRemindersStore";
import { useShipClockStore } from "./useShipClockStore";
import { useSoundStore } from "./useSoundStore";
import { useSystemStatusStore } from "./useSystemStatusStore";
import { useWeatherStore } from "./useWeatherStore";

/** A forecast older than this is not read out on the tape. */
const WEATHER_FRESH_MS = 6 * 3_600_000;

/** The bridge console (our status bar): telemetry, annunciator lamps and what MOTHER's teletype says. */
export const useBridgeConsoleStore = defineStore('bridgeConsole', () =>
{
    const clock = useShipClockStore();
    const notifications = useNotificationsStore();
    const status = useSystemStatusStore();
    const alarm = useAlarmStore();
    const calendar = useCalendarStore();
    const weather = useWeatherStore();
    const reminders = useRemindersStore();
    const protocols = useProtocolsStore();
    const mother = useMotherStore();
    const appsStore = useAppsStore();
    const sound = useSoundStore();

    const now = computed(() => clock.now.getTime());

    /** `14° NUBLADO` from a forecast that is not too old. */
    const weatherLine = computed(() =>
    {
        const f = weather.forecast;
        return f && now.value - f.fetchedAt < WEATHER_FRESH_MS ? `${Math.round(f.temperature)}° ${weatherText(f.code)}` : null;
    });

    const storageLine = computed(() => status.storage ? storageText(status.storage.totalBytes, status.storage.freeBytes) : null);

    const state = computed<ConsoleState>(() =>
    {
        const c = status.connectivity;
        const b = status.battery;
        return {
            now: now.value,
            online: c ? c.type !== 'none' : null,
            battery: b ? { level: b.level, isCharging: b.isCharging } : null,
            signals: notifications.visible,
            alarmAt: alarm.nextAlarm?.triggerTime ?? null,
            protocols: protocols.rules.filter(r => protocols.active.includes(r.id)).map(r => r.name),
        };
    });

    const lamps = computed(() => annunciators(state.value));
    const alert = computed(() => lamps.value.some(l => l.blink));

    /** The lamp the user tapped: its message goes first on the tape until the tape has run once. */
    const focus = ref<LampId | null>(null);
    /** Which ambient line closes the tape; the teletype moves it on after every pass. */
    const ambient = ref(Math.floor(Math.random() * 1000));

    const queue = computed(() =>
    {
        const ev = calendar.events.find(e => e.end > now.value) ?? null;
        return tickerQueue({
            ...state.value,
            appLabel: pkg => appLabelFor(pkg, appsStore.apps).toUpperCase(),
            nextEvent: ev && { id: ev.eventId, title: ev.title, begin: ev.begin, allDay: ev.allDay },
            reminder: reminders.pending.find(r => r.at > now.value) ?? null,
            weather: weatherLine.value,
        }, ambient.value, focus.value);
    });

    /** Bumped when a new signal arrives, so the eye can wink. */
    const pulse = ref(0);
    watch(() => notifications.alerts, (n, old) => { if (n > old) pulse.value++; });

    // a data chirp when a lamp lights up (the sound store keeps it quiet unless the user enabled sound);
    // MSG is left out because a new notification already has its own tone
    watch(lamps, (next, prev) =>
    {
        if (prev && newlyLit(prev, next).some(id => id !== 'MSG')) sound.play('chirp');
    });

    function nextPass()
    {
        ambient.value++;
        focus.value = null;
    }

    return { weatherLine, storageLine, lamps, alert, busy: computed(() => mother.busy), queue, pulse, focus, nextPass };
});
