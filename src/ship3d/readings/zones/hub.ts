import { idle } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `hub` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    // the ship's terminal on the crown over the mess table: a tap searches the apps or talks to MOTHER
    put(idle('hub.buscar', 'TERMINAL', '> BUSCAR APP'));
    put(idle('hub.mother', 'MOTHER', '> CONSULTAR'));
}
