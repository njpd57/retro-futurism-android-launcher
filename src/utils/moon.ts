const SYNODIC_DAYS = 29.530588853;
// a known new moon: 2000-01-06 18:14 UTC
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** Fraction of the lunar cycle (0 = new moon, 0.5 = full), computed without network. */
export function moonCycle(date: Date)
{
    const days = (date.getTime() - REFERENCE_NEW_MOON) / 86_400_000;
    return ((days / SYNODIC_DAYS) % 1 + 1) % 1;
}

const NAMES = ['LUNA NUEVA', 'CRECIENTE', 'CUARTO CRECIENTE', 'GIBOSA CRECIENTE', 'LUNA LLENA', 'GIBOSA MENGUANTE', 'CUARTO MENGUANTE', 'MENGUANTE'];

export function moonName(cycle: number)
{
    return NAMES[Math.floor(((cycle % 1) * 8 + 0.5)) % 8];
}

/** Share of the disc that is lit, 0..1. */
export function moonIllumination(cycle: number)
{
    return (1 - Math.cos(2 * Math.PI * cycle)) / 2;
}

type Pixel = 'L' | 'D' | 'O';

/**
 * The moon as block characters, two pixels per character cell with half blocks so the disc is round:
 * `█ ▀ ▄` lit, `░` the dark side, spaces outside. `2r+1` columns by `r+1` rows.
 */
export function moonArt(cycle: number, radius = 7): string[]
{
    const cos = Math.cos(2 * Math.PI * cycle);
    const waxing = cycle < 0.5;
    const size = 2 * radius + 1;
    const reach = radius * radius + radius; // a little over r² so small discs look round

    const pixel = (px: number, py: number): Pixel =>
    {
        const x = px - radius;
        const y = py - radius;
        if (py >= size || x * x + y * y > reach) return 'O';
        const half = Math.sqrt(reach - y * y);
        const lit = waxing ? x > half * cos + 1e-9 : x < -half * cos - 1e-9;
        return lit ? 'L' : 'D';
    };

    const rows: string[] = [];
    for (let py = 0; py < size; py += 2)
    {
        let row = '';
        for (let px = 0; px < size; px++)
        {
            const top = pixel(px, py);
            const bottom = pixel(px, py + 1);
            row += top === 'L' && bottom === 'L' ? '█'
                : top === 'L' ? '▀'
                : bottom === 'L' ? '▄'
                : top === 'O' && bottom === 'O' ? ' '
                : '░';
        }
        rows.push(row);
    }
    return rows;
}
