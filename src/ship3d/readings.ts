import { SCREENS } from './world';
import { idle, type Level, type ScreenReading, type ShipInput } from './readings/kit';

export { fit, type Level, type ScreenReading, type ShipInput } from './readings/kit';

/** One file per kind of room in `readings/zones/` (`export function readings(i, put)`), found by name: a new room's monitors are one file. */
const zones = import.meta.glob<{ readings: (i: ShipInput, put: (r: ScreenReading) => void) => void }>('./readings/zones/*.ts', { eager: true });

export function roomReadings(i: ShipInput): Record<string, ScreenReading>
{
    const out: Record<string, ScreenReading> = {};
    const put = (r: ScreenReading) => { out[r.id] = r; };
    for (const z of Object.values(zones)) z.readings(i, put);
    for (const s of SCREENS) out[s.id] ??= idle(s.id, 'SIN DATOS');
    return out;
}

/** The loudest level among a room's monitors. */
export function roomLevel(readings: Record<string, ScreenReading>, room: string): Level
{
    let level: Level = 'idle';
    for (const s of SCREENS)
    {
        if (s.zone !== room) continue;
        const l = readings[s.id]?.level;
        if (l === 'urgent') return 'urgent';
        if (l === 'notice') level = 'notice';
    }
    return level;
}
