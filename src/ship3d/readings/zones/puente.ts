import { weatherText } from '../../../utils/weather';
import { compassPoint, normalizeDegrees } from '../../../utils/compass';
import { formatClock, formatDateTui } from '../../../utils/tui';
import { idle } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `puente` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    const date = new Date(i.now);
    put(idle('puente.hora', formatClock(date), formatDateTui(date)));
    put(idle('puente.rumbo', i.heading === null ? 'RUMBO ---' : `RUMBO ${String(Math.round(normalizeDegrees(i.heading)) % 360).padStart(3, '0')}`,
        i.heading === null ? 'SIN BRÚJULA' : compassPoint(i.heading)));
    put(i.weather
        ? idle('puente.clima', `${Math.round(i.weather.temperature)} °C`, weatherText(i.weather.code))
        : idle('puente.clima', 'EXTERIOR', 'SIN DATOS'));
    put(idle('puente.turno', 'TURNO', i.protocol ?? 'SIN PROTOCOLO'));
}
