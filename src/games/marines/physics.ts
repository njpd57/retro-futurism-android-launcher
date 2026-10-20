import { blocks, type Grid } from '../isolation/grid';
import { castRay } from '../wire/occlusion';

/** Yaw is in radians, 0 = north (up the map), clockwise. */
export const forward = (yaw: number): [number, number] => [Math.sin(yaw), -Math.cos(yaw)];
export const right = (yaw: number): [number, number] => [Math.cos(yaw), Math.sin(yaw)];

/** The yaw that looks from (`ax`, `ay`) at (`bx`, `by`). */
export const angleTo = (ax: number, ay: number, bx: number, by: number) => Math.atan2(bx - ax, -(by - ay));

/** `a - b` wrapped to [-π, π]. */
export function angleDiff(a: number, b: number)
{
    const d = (a - b) % (2 * Math.PI);
    return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
}

/** True when a circle of radius `r` at (`x`, `y`) overlaps a wall, a closed door or the outside. */
export function collides(g: Grid, closed: readonly number[], x: number, y: number, r: number): boolean
{
    const x0 = Math.floor(x - r);
    const x1 = Math.floor(x + r);
    const y0 = Math.floor(y - r);
    const y1 = Math.floor(y + r);
    for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++)
        {
            const solid = cx < 0 || cy < 0 || cx >= g.w || cy >= g.h || blocks(g, closed, cy * g.w + cx);
            if (!solid) continue;
            // the nearest point of the cell to the circle's centre
            const nx = Math.min(Math.max(x, cx), cx + 1);
            const ny = Math.min(Math.max(y, cy), cy + 1);
            if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
        }
    return false;
}

/** Moves a circle by (`dx`, `dy`), one axis at a time so it slides along walls instead of stopping dead. */
export function moveCircle(g: Grid, closed: readonly number[], x: number, y: number, dx: number, dy: number, r: number): { x: number; y: number }
{
    let nx = x;
    let ny = y;
    if (dx !== 0 && !collides(g, closed, x + dx, y, r)) nx = x + dx;
    if (dy !== 0 && !collides(g, closed, nx, y + dy, r)) ny = y + dy;
    return { x: nx, y: ny };
}

/** True when nothing solid lies on the straight line between two points. */
export function lineClear(g: Grid, closed: readonly number[], ax: number, ay: number, bx: number, by: number): boolean
{
    if (ax === bx && ay === by) return true;
    // castRay returns the fraction of the segment travelled before a wall, or 1
    return castRay(g, closed, ax, ay, bx - ax, by - ay, 1) >= 1;
}

/**
 * Distance along the unit direction (`dx`, `dy`) from (`ox`, `oy`) to the first point of a circle, or null when
 * the ray misses it or it lies behind.
 */
export function rayCircle(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, r: number): number | null
{
    const fx = cx - ox;
    const fy = cy - oy;
    const along = fx * dx + fy * dy;
    if (along < 0) return null;
    const off2 = fx * fx + fy * fy - along * along;
    if (off2 > r * r) return null;
    return Math.max(0, along - Math.sqrt(r * r - off2));
}
