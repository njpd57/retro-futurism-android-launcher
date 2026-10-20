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

export interface CompassMark
{
    /** Bearing in degrees, clockwise from north. */
    deg: number;
    /** SVG path of the tick on a rose of radius 1 (longer every 30°, longest at the cardinal points). */
    d: string;
}

export interface CompassLabel
{
    text: string;
    x: number;
    y: number;
}

const polar = (deg: number, r: number) => `${(Math.sin(deg * Math.PI / 180) * r).toFixed(3)} ${(-Math.cos(deg * Math.PI / 180) * r).toFixed(3)}`;

/** The card of a compass rose for a viewBox centred on the origin: a tick every 5°, and the eight points named inside. */
export function compassRose(): { marks: CompassMark[]; labels: CompassLabel[] }
{
    const marks: CompassMark[] = [];
    for (let deg = 0; deg < 360; deg += 5)
    {
        const inner = deg % 90 === 0 ? 0.78 : deg % 30 === 0 ? 0.84 : deg % 15 === 0 ? 0.9 : 0.94;
        marks.push({ deg, d: `M${polar(deg, inner)} L${polar(deg, 1)}` });
    }

    const labels = POINTS.map((text, i) =>
    {
        const r = i % 2 === 0 ? 0.6 : 0.62;
        const deg = i * 45;
        return { text, x: Math.sin(deg * Math.PI / 180) * r, y: -Math.cos(deg * Math.PI / 180) * r };
    });

    return { marks, labels };
}
