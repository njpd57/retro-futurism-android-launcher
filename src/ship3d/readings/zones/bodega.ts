import { bar, formatBytes } from '../../../utils/tui';
import { fit, idle, hhmm } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `bodega` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    if (i.storage && i.storage.total > 0)
    {
        const full = i.storage.used / i.storage.total;
        put({
            id: 'bodega.almacen',
            lines: ['ALMACÉN', bar(full, 10), `${formatBytes(i.storage.total - i.storage.used)} LIBRES`].map(l => fit(l)),
            level: full >= 0.95 ? 'urgent' : full >= 0.85 ? 'notice' : 'idle',
        });
    }
    else put(idle('bodega.almacen', 'ALMACÉN', 'SIN DATOS'));
    put(idle('bodega.pantalla', 'PANTALLA HOY', i.screenMs === null ? 'SIN DATOS' : hhmm(i.screenMs)));
}
