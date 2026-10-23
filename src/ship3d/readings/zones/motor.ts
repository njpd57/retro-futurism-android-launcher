import { bar } from '../../../utils/tui';
import { idle } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `motor` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    if (i.battery)
    {
        const { level, charging } = i.battery;
        put({
            id: 'motor.reserva',
            lines: [`RESERVA ${level} %`, bar(level / 100, 10)],
            level: charging ? 'idle' : level <= 15 ? 'urgent' : level <= 30 ? 'notice' : 'idle',
        });
    }
    else put(idle('motor.reserva', 'RESERVA', 'SIN DATOS'));
    put(idle('motor.enlace', i.link ? `ENLACE ${i.link}` : 'SIN ENLACE', i.link ? 'ESTABLE' : 'SOLO LOCAL'));
}
