/** Geometry of the vector gauges (bars, signal, sparklines). Pure, so it is tested; the components only paint it. */

export interface Rect
{
    x: number;
    y: number;
    w: number;
    h: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/** How many of `count` segments are lit for a fraction (0-1): rounded like the text bar, so the two agree. */
export function litSegments(fraction: number, count: number)
{
    return Math.round(clamp01(fraction) * count);
}

/** The segments of a bar in a `width` x `height` box, with a gap between them; `on` says which are lit. */
export function barSegments(fraction: number, count: number, width = 100, height = 10, gap = 1.2): (Rect & { on: boolean })[]
{
    const lit = litSegments(fraction, count);
    const w = (width - gap * (count - 1)) / count;
    return Array.from({ length: count }, (_, i) => ({ x: i * (w + gap), y: 0, w, h: height, on: i < lit }));
}

/** Signal bars of rising height in a `width` x `height` box: `level` of `max` are lit, `null` (unknown) lights none. */
export function signalGeometry(level: number | null, max = 4, width = 20, height = 14, gap = 2): (Rect & { on: boolean })[]
{
    const lit = level === null ? 0 : Math.min(max, Math.max(0, Math.round(level)));
    const w = (width - gap * (max - 1)) / max;
    return Array.from({ length: max }, (_, i) =>
    {
        const h = height * (i + 1) / max;
        return { x: i * (w + gap), y: height - h, w, h, on: i < lit };
    });
}

/**
 * One column per value in a `width` x `height` box, scaled between `min` and `max` (the data range by default).
 * A `null` value (a lost sample) is a zero-height column, so the caller can mark it.
 */
export function sparkBars(values: readonly (number | null)[], min?: number, max?: number, width = 100, height = 20, gap = 1): (Rect & { missing: boolean })[]
{
    const known = values.filter((v): v is number => v !== null);
    const lo = min ?? (known.length ? Math.min(...known) : 0);
    const hi = max ?? (known.length ? Math.max(...known) : 1);
    const span = hi - lo || 1;
    const w = values.length ? (width - gap * (values.length - 1)) / values.length : width;
    const floor = height * 0.12; // the lowest value still shows as a stub

    return values.map((v, i) =>
    {
        const h = v === null ? 0 : floor + clamp01((v - lo) / span) * (height - floor);
        return { x: i * (w + gap), y: height - h, w, h, missing: v === null };
    });
}

/** Points of a polyline through the values in a `width` x `height` box (`y` grows downwards), scaled to their range. */
export function sparkLine(values: readonly number[], width = 100, height = 20): { x: number; y: number }[]
{
    if (!values.length) return [];
    const lo = Math.min(...values);
    const span = Math.max(...values) - lo || 1;
    return values.map((v, i) => ({
        x: values.length === 1 ? width / 2 : i * width / (values.length - 1),
        y: height - (v - lo) / span * height,
    }));
}

/** `x,y x,y ...` for an SVG `points` attribute. */
export const toPoints = (points: readonly { x: number; y: number }[]) => points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
