import { blocks, type Grid } from '../isolation/grid';
import type { Pose } from './camera';
import { FOCAL } from './camera';

/**
 * Which parts of the screen a sprite shows through. Walls are drawn as polygons far to near, which is right for
 * walls among themselves, but a creature standing in open space between two cells can be ordered wrongly against
 * a wall corner. A depth buffer per screen column settles it: the sprite is drawn only where it is nearer than
 * the wall in that column. Pure: no DOM.
 */

/**
 * Distance along a ray, in units of the ray's own length, to the first wall or closed door; `maxT` when none
 * is met. Cast from (`ox`, `oy`) along (`dx`, `dy`), which need not be a unit vector. With the camera's forward
 * component equal to 1, this distance is the depth (z) of the hit.
 */
export function castRay(g: Grid, closed: readonly number[], ox: number, oy: number, dx: number, dy: number, maxT: number): number
{
    let cx = Math.floor(ox);
    let cy = Math.floor(oy);
    if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) return 0;
    if (blocks(g, closed, cy * g.w + cx)) return 0;

    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    // ray length between two vertical (horizontal) grid lines
    const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    let tX = dx === 0 ? Infinity : ((dx > 0 ? cx + 1 - ox : ox - cx) * deltaX);
    let tY = dy === 0 ? Infinity : ((dy > 0 ? cy + 1 - oy : oy - cy) * deltaY);

    for (;;)
    {
        let t: number;
        if (tX < tY)
        {
            t = tX;
            tX += deltaX;
            cx += stepX;
        }
        else
        {
            t = tY;
            tY += deltaY;
            cy += stepY;
        }
        if (t >= maxT) return maxT;
        if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) return t;
        if (blocks(g, closed, cy * g.w + cx)) return t;
    }
}

export interface DepthBuffer
{
    /** view width in pixels */
    w: number;
    /** depth of the nearest wall in each of the equal-width column bands across the view */
    depth: Float32Array;
}

/** Wall depth per column band, by casting one ray through the middle of each. */
export function depthBuffer(g: Grid, closed: readonly number[], pose: Pose, w: number, columns: number, maxT: number): DepthBuffer
{
    const sin = Math.sin(pose.yaw);
    const cos = Math.cos(pose.yaw);
    const focal = FOCAL * w;
    const depth = new Float32Array(columns);
    for (let i = 0; i < columns; i++)
    {
        const u = ((i + 0.5) * w / columns - w / 2) / focal;
        // forward = (sin, -cos), right = (cos, sin)
        depth[i] = castRay(g, closed, pose.x, pose.y, sin + u * cos, -cos + u * sin, maxT);
    }
    return { w, depth };
}

/**
 * The pixel ranges `[x0, x1, x0, x1, ...]` within [`left`, `right`] where something at depth `z` is in front of
 * the walls. Empty when it is hidden completely.
 */
export function openSpans(buf: DepthBuffer, left: number, right: number, z: number): number[]
{
    const n = buf.depth.length;
    const band = buf.w / n;
    const first = Math.max(0, Math.floor(left / band));
    const last = Math.min(n - 1, Math.floor(right / band));
    const spans: number[] = [];
    let from = -1;
    for (let i = first; i <= last; i++)
    {
        const open = z < buf.depth[i];
        if (open && from < 0) from = i;
        if ((!open || i === last) && from >= 0)
        {
            const end = open ? i + 1 : i;
            spans.push(Math.max(left, from * band), Math.min(right, end * band));
            from = -1;
        }
    }
    return spans;
}
