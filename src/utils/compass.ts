const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export const normalizeDegrees = (deg: number) => ((deg % 360) + 360) % 360;

/** `deviceorientationabsolute` alpha (counter-clockwise from north) to a compass heading (clockwise). */
export function headingFromAlpha(alpha: number)
{
    return normalizeDegrees(360 - alpha);
}

/** `N`, `NE`... (`SO` and `O` for sur-oeste and oeste). */
export function compassPoint(heading: number)
{
    return POINTS[Math.round(normalizeDegrees(heading) / 45) % 8];
}

/**
 * A strip of the horizon `width` characters wide centred on `heading`: a tick every 15°, the cardinal
 * and intercardinal letters at their bearings. The centre column is the heading itself.
 */
export function compassStrip(heading: number, width: number, degreesPerChar = 5): string
{
    const half = Math.floor(width / 2);
    let out = '';
    for (let i = -half; i <= half; i++)
    {
        const bearing = normalizeDegrees(Math.round((heading + i * degreesPerChar) / degreesPerChar) * degreesPerChar);
        const point = bearing % 45 === 0 ? POINTS[bearing / 45] : null;
        out += point ? point[0] : bearing % 15 === 0 ? '|' : '·';
    }
    return out;
}
