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

/** The moon as block characters: `█` lit, `░` dark side, spaces outside. Rows are `2r+1`, columns about `4r+1`. */
export function moonArt(cycle: number, radius = 3): string[]
{
    const theta = 2 * Math.PI * cycle;
    const cos = Math.cos(theta);
    const waxing = cycle < 0.5;
    const rows: string[] = [];

    for (let y = -radius; y <= radius; y++)
    {
        const half = Math.sqrt(radius * radius - y * y);
        let row = '';
        for (let col = -2 * radius; col <= 2 * radius; col++)
        {
            const x = col / 2; // characters are about twice as tall as wide
            if (Math.abs(x) > half + 0.001) { row += ' '; continue; }
            const lit = waxing ? x > half * cos + 1e-9 : x < -half * cos - 1e-9;
            row += lit ? '█' : '░';
        }
        rows.push(row);
    }
    return rows;
}
