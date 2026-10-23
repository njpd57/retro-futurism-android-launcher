import { idle } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `enfermeria` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    put({
        id: 'enfermeria.sistema',
        lines: i.alerts > 0 ? ['SISTEMA', `${i.alerts} ${i.alerts === 1 ? 'ALERTA' : 'ALERTAS'}`] : ['SISTEMA', 'NOMINAL'],
        level: i.alerts > 0 ? 'notice' : 'idle',
    });
    put(idle('enfermeria.bitacora', ...(i.log.length ? i.log.slice(-2) : ['BITÁCORA', 'VACÍA'])));
}
