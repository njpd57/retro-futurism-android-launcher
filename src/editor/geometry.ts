import type { V2 } from '@/ship3d/world';

/** Plain 2D helpers for the map editor. Pure; metres in the plan. */

export const snap = (v: number, grid: number) => (grid > 0 ? Math.round(v / grid) * grid : v);

/** Float noise off (0.1 + 0.2): the JSON keeps four decimals at most. */
export const clean = (v: number) => Math.round(v * 1e4) / 1e4;

export interface Nearest { x: number; y: number; /** 0..1 along the segment */ t: number; d: number }

export function nearestOnSegment(px: number, py: number, a: V2, b: V2): Nearest
{
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
    const x = a[0] + t * dx;
    const y = a[1] + t * dy;
    return { x, y, t, d: Math.hypot(px - x, py - y) };
}

export interface EdgeHit extends Nearest { room: number; edge: number }

/** The room side nearest to a point. */
export function nearestEdge(polys: readonly (readonly V2[])[], px: number, py: number): EdgeHit | null
{
    let best: EdgeHit | null = null;
    polys.forEach((poly, room) =>
    {
        for (let edge = 0; edge < poly.length; edge++)
        {
            const n = nearestOnSegment(px, py, poly[edge], poly[(edge + 1) % poly.length]);
            if (!best || n.d < best.d) best = { ...n, room, edge };
        }
    });
    return best;
}

/** Signed area (plan y down, so clockwise on screen is positive). */
export function area(poly: readonly V2[]): number
{
    let a = 0;
    for (let i = 0; i < poly.length; i++)
    {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        a += ax * by - bx * ay;
    }
    return a / 2;
}

/** Whether every turn goes the same way (collinear points allowed). */
export function isConvex(poly: readonly V2[]): boolean
{
    let sign = 0;
    for (let i = 0; i < poly.length; i++)
    {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        const [cx, cy] = poly[(i + 2) % poly.length];
        const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
        if (Math.abs(cross) < 1e-9) continue;
        if (sign === 0) sign = Math.sign(cross);
        else if (Math.sign(cross) !== sign) return false;
    }
    return true;
}

/** Whether a point is inside a polygon of any shape (even-odd). */
export function pointInPoly(poly: readonly V2[], x: number, y: number): boolean
{
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

export function rotate(x: number, y: number, a: number): V2
{
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
}

/** Whether two polygons overlap by more than touching (their separating-axis test, convex shapes). */
export function overlaps(a: readonly V2[], b: readonly V2[], tol = 1e-3): boolean
{
    for (const poly of [a, b])
        for (let i = 0; i < poly.length; i++)
        {
            const [ax, ay] = poly[i];
            const [bx, by] = poly[(i + 1) % poly.length];
            const nx = ay - by;
            const ny = bx - ax;
            const len = Math.hypot(nx, ny) || 1;
            const proj = (p: readonly V2[]) => p.map(q => (q[0] * nx + q[1] * ny) / len);
            const pa = proj(a);
            const pb = proj(b);
            if (Math.max(...pa) <= Math.min(...pb) + tol || Math.max(...pb) <= Math.min(...pa) + tol) return false;
        }
    return true;
}
