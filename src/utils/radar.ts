export interface RadarBlip
{
    /** Radians, 0 = east, counter-clockwise on screen is negative. */
    angle: number;
    /** 0 (center) to 1 (edge). */
    radius: number;
}

const TAU = Math.PI * 2;

/** A stable position for a string (a notification key, a package name). */
export function blipFromKey(key: string): RadarBlip
{
    let h = 2166136261;
    for (let i = 0; i < key.length; i++)
        h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    h >>>= 0;
    return { angle: (h % 3600) / 3600 * TAU, radius: 0.3 + ((h >>> 12) % 700) / 1000 };
}

/**
 * ASCII radar: `4*radius + 1` columns by `2*radius + 1` rows (characters are about twice as tall as wide).
 * The sweep is a bright wedge at `sweep` radians with a fading trail behind it; blips light up when it passes.
 */
export function radarFrame(radius: number, sweep: number, blips: readonly RadarBlip[]): string[]
{
    const cols = radius * 4 + 1;
    const rows = radius * 2 + 1;
    const grid: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill(' '));

    const norm = (a: number) => ((a % TAU) + TAU) % TAU;
    const cell = (angle: number, r: number) => ({
        c: Math.round(radius * 2 + Math.cos(angle) * r * radius * 2),
        r: Math.round(radius + Math.sin(angle) * r * radius),
    });

    for (let r = 0; r < rows; r++)
    {
        for (let c = 0; c < cols; c++)
        {
            const dx = (c - radius * 2) / (radius * 2);
            const dy = (r - radius) / radius;
            const dist = Math.hypot(dx, dy);
            if (dist > 1.02) continue;

            if (dist < 0.08) { grid[r][c] = '+'; continue; }

            const behind = norm(sweep - Math.atan2(dy, dx)); // how far the sweep has moved past this cell
            if (behind < 0.12) grid[r][c] = '▓';
            else if (behind < 0.6) grid[r][c] = '▒';
            else if (behind < 1.2) grid[r][c] = '░';
            else if (dist > 0.96 || Math.abs(dist - 0.5) < 0.04) grid[r][c] = '·';
        }
    }

    for (const blip of blips)
    {
        const { c, r } = cell(blip.angle, blip.radius);
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const behind = norm(sweep - blip.angle);
        grid[r][c] = behind < 1 ? '◉' : behind < 3 ? 'o' : '·';
    }

    return grid.map(row => row.join(''));
}
