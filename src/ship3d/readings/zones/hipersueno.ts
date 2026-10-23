import { formatClock } from '../../../utils/tui';
import { idle, hhmm } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `hipersueno` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    if (i.alarmAt !== null)
    {
        const soon = i.alarmAt - i.now;
        put({
            id: 'hipersueno.alarma',
            lines: [`ALARMA ${formatClock(new Date(i.alarmAt))}`, soon > 0 ? `EN ${hhmm(soon)} H` : 'AHORA'],
            level: soon <= 15 * 60000 ? 'urgent' : soon <= 60 * 60000 ? 'notice' : 'idle',
        });
    }
    else put(idle('hipersueno.alarma', 'SIN ALARMA'));
    put(i.nextEvent
        ? idle('hipersueno.agenda', formatClock(new Date(i.nextEvent.begin)), i.nextEvent.title)
        : idle('hipersueno.agenda', 'AGENDA', 'SIN EVENTOS'));
}
