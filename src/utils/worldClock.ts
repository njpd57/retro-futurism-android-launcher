/** Time zones offered in the world clock. */
export const ZONE_PRESETS = [
    'UTC', 'Europe/Madrid', 'Europe/London', 'Europe/Moscow', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Kolkata',
    'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'America/Sao_Paulo', 'America/New_York', 'America/Mexico_City',
    'America/Los_Angeles',
] as const;

export const MAX_ZONES = 4;
export const DEFAULT_ZONES = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];

/** `NEW YORK` from `America/New_York`. */
export function zoneLabel(zone: string)
{
    return (zone.split('/').pop() ?? zone).replace(/_/g, ' ').toUpperCase();
}

/** `HH:MM` in the zone, or `--:--` if the runtime doesn't know it. */
export function zoneTime(date: Date, zone: string)
{
    try
    {
        return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone }).format(date);
    }
    catch
    {
        return '--:--';
    }
}

/** Adds the zone if missing and there is room; removes it if present. */
export function toggleZone(zones: readonly string[], zone: string): string[]
{
    if (zones.includes(zone)) return zones.filter(z => z !== zone);
    return zones.length >= MAX_ZONES ? [...zones] : [...zones, zone];
}
