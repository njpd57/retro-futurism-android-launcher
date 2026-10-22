/**
 * The mess's timetable: when the crew sits down to eat, and how many of them are at the table. Pure.
 */

export interface Meal { name: string; from: number; to: number }

/** The three sittings of the day, in local hours: `from` inclusive, `to` exclusive. */
export const MEALS: readonly Meal[] = [
    { name: 'DESAYUNO', from: 7, to: 9 },
    { name: 'ALMUERZO', from: 13, to: 15 },
    { name: 'CENA', from: 20, to: 22 },
];

/** The meal being served at `date`, or null. */
export const mealAt = (date: Date): Meal | null => MEALS.find(m => date.getHours() >= m.from && date.getHours() < m.to) ?? null;

/** The next meal after `date` and when it starts (tomorrow's breakfast after the last one). */
export function nextMeal(date: Date): { meal: Meal; at: Date }
{
    for (const meal of MEALS)
        if (date.getHours() < meal.from)
        {
            const at = new Date(date);
            at.setHours(meal.from, 0, 0, 0);
            return { meal, at };
        }
    const at = new Date(date);
    at.setDate(at.getDate() + 1);
    at.setHours(MEALS[0].from, 0, 0, 0);
    return { meal: MEALS[0], at };
}

/** How many of the crew sit at the table: most of them at mealtimes, a couple lingering otherwise. */
export const DINERS = { meal: 6, between: 2 };

export const dinersAt = (date: Date): number => (mealAt(date) ? DINERS.meal : DINERS.between);

/** What the crew say when tapped at the table, in the mess's own voice. */
export const DINER_LINES: readonly string[] = [
    'EL CAFÉ ESTÁ FRÍO OTRA VEZ',
    '¿QUIÉN DEJÓ AL GATO EN LA MESA?',
    'PARTES IGUALES O NO HAY TRATO',
    'ESE PÁJARO NO PARA DE BEBER',
    'MOTHER DICE QUE TODO ESTÁ NOMINAL',
    'QUEDAN DIEZ MESES PARA CASA',
    'NO TOQUES MI TAZA',
];

/** The line a diner says, the same one for the same diner on the same tap count. */
export const dinerLine = (id: string, n: number): string =>
    DINER_LINES[([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000003, 7) + n) % DINER_LINES.length];
