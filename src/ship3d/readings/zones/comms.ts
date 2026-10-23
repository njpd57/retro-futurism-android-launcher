import { idle } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `comms` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    put({
        id: 'comms.senales',
        lines: i.signals > 0 ? [`${i.signals} ${i.signals === 1 ? 'SEÑAL' : 'SEÑALES'}`, 'EN ESPERA'] : ['SIN SEÑALES', 'CANAL LIBRE'],
        level: i.signals > 0 ? 'notice' : 'idle',
    });
    put(idle('comms.mother', 'MOTHER', 'EN LÍNEA'));
}
