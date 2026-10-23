import { mealAt, nextMeal } from '../../mess';
import { formatClock } from '../../../utils/tui';
import { idle } from '../kit';
import type { ScreenReading, ShipInput } from '../kit';

/** What the monitors of `comedor` show. */
export function readings(i: ShipInput, put: (r: ScreenReading) => void)
{
    put(i.media
        ? idle('comedor.pista', i.media.playing ? '» SONANDO' : '▌▌ PAUSA', i.media.title, i.media.artist)
        : idle('comedor.pista', 'SIN SEÑAL', 'DE AUDIO'));
    const meal = mealAt(new Date(i.now));
    if (meal) put(idle('comedor.rancho', 'RANCHO', `${meal.name} SERVIDO`));
    else
    {
        const next = nextMeal(new Date(i.now));
        put(idle('comedor.rancho', 'RANCHO', `${next.meal.name} ${formatClock(next.at)}`));
    }
}
