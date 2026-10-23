import { idle } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `hangar` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    put(idle('hangar.flota', i.shuttles === 1 ? '1 LANZADERA' : `${i.shuttles} LANZADERAS`));
}
