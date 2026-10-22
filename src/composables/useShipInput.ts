import { computed } from 'vue';
import { useHeading } from '@/composables/useHeading';
import { useAlarmStore } from '@/stores/useAlarmStore';
import { useAlertsStore } from '@/stores/useAlertsStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useContactsStore } from '@/stores/useContactsStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMediaStore } from '@/stores/useMediaStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { useProtocolsStore } from '@/stores/useProtocolsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useShipClockStore } from '@/stores/useShipClockStore';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { useWeatherStore } from '@/stores/useWeatherStore';
import type { ShipInput } from '@/ship3d/readings';

/** Gathers what the ship's monitors show out of the stores. The monitors themselves are pure (`ship/readings.ts`). */
export function useShipInput()
{
    const { heading } = useHeading();
    const settings = useSettingsStore();
    const clock = useShipClockStore();
    const system = useSystemStatusStore();
    const notifications = useNotificationsStore();
    const media = useMediaStore();
    const calendar = useCalendarStore();
    const alarm = useAlarmStore();
    const weather = useWeatherStore();
    const contacts = useContactsStore();
    const usage = useUsageStore();
    const protocols = useProtocolsStore();
    const alerts = useAlertsStore();
    const log = useLogStore();

    return computed<ShipInput>(() =>
    {
        const now = clock.now.getTime();
        const next = calendar.events.filter(e => !e.allDay && e.end > now).sort((a, b) => a.begin - b.begin)[0];
        const rule = protocols.rules.find(r => protocols.active.includes(r.id));
        const storage = system.storage;
        const battery = system.battery;
        const link = system.connectivity?.type;
        return {
            now,
            heading: heading.value,
            weather: weather.forecast ? { temperature: weather.forecast.temperature, code: weather.forecast.code } : null,
            protocol: rule?.name ?? null,
            signals: notifications.packages.length,
            battery: battery ? { level: battery.level, charging: battery.isCharging } : null,
            link: link && link !== 'none' ? link.toUpperCase() : null,
            storage: storage ? { used: storage.totalBytes - storage.freeBytes, total: storage.totalBytes } : null,
            screenMs: usage.apps.length ? usage.apps.reduce((sum, a) => sum + a.totalTimeMs, 0) : null,
            alarmAt: alarm.nextAlarm?.triggerTime ?? null,
            nextEvent: next ? { title: next.title ?? '', begin: next.begin } : null,
            media: media.session && media.session.state !== 'none' && media.session.state !== 'stopped'
                ? { title: media.session.title ?? '', artist: media.session.artist ?? '', playing: media.session.state === 'playing' }
                : null,
            crew: contacts.starred.length,
            shuttles: settings.favorites.length,
            alerts: alerts.alerts.length,
            log: log.lines.slice(-2).map(l => `${l.tag} ${l.text}`),
        };
    });
}
