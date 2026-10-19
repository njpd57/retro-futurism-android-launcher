import { useAlarmStore } from '@/stores/useAlarmStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import { useWeatherStore } from '@/stores/useWeatherStore';
import type { ShipSnapshot } from '@/mother/local';

/** Reads the stores into one snapshot. Call it inside a computed to keep it reactive. */
export function useShipSnapshot()
{
    const status = useSystemStatusStore();
    const calendar = useCalendarStore();
    const alarm = useAlarmStore();
    const weather = useWeatherStore();

    return function snapshot(now = new Date()): ShipSnapshot
    {
        return {
            now,
            battery: status.battery ? { level: status.battery.level, isCharging: status.battery.isCharging } : null,
            connection: status.connectivity?.type ?? null,
            storage: status.storage,
            events: calendar.events,
            calendarAvailable: calendar.supported && calendar.canRead,
            weather: weather.city && weather.forecast ? { city: weather.city.name, temperature: weather.forecast.temperature, code: weather.forecast.code } : null,
            alarm: alarm.nextAlarm?.triggerTime ?? null,
        };
    };
}
