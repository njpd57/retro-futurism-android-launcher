import { idle } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `camarotes` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    put(idle('camarotes.tripulacion', i.crew === 1 ? '1 TRIPULANTE' : `${i.crew} TRIPULANTES`));
}
