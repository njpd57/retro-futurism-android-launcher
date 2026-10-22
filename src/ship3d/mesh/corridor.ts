import type { V3 } from '../math';
import { type Room, type V2 } from '../world';
import { MAT, Builder, extrude } from './builder';

export const rectOutline = (x0: number, y0: number, x1: number, y1: number): V2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Heights of the padded cushions between a corridor's ribs, as on the Torrens: three rows of them up each wall. */
export const CUSHIONS: readonly [number, number][] = [[0.3, 1.0], [1.08, 1.78], [1.86, 2.46]];

/**
 * Ribs up the long walls of a corridor with padded cushions between them, two pipes along its ceiling and hatch
 * plates down the floor: the Nostromo's ribbed, quilted hallways.
 */
export function addCorridor(b: Builder, room: Room)
{
    b.room = room;
    const xs = room.poly.map(p => p[0]);
    const ys = room.poly.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const alongX = x1 - x0 > y1 - y0;
    const [a0, a1, c0, c1] = alongX ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
    const at = (u0: number, v0: number, u1: number, v1: number) => (alongX ? rectOutline(u0, v0, u1, v1) : rectOutline(v0, u0, v1, u1));
    const ribs: number[] = [];
    for (let u = a0 + 1; u < a1 - 0.6; u += 2) ribs.push(u);
    for (const u of ribs)
        for (const [v0, v1] of [[c0, c0 + 0.14], [c1 - 0.14, c1]])
            extrude(b, at(u - 0.06, v0, u + 0.06, v1), 0, room.height, MAT.frame, 0.1);
    // each bay between two ribs (or a rib and the doorway) is quilted: a slab, and a thicker one inset on it for the bevel
    const stops = [a0 + 0.35, ...ribs, a1 - 0.35];
    for (let i = 0; i < stops.length - 1; i++)
    {
        const [u0, u1] = [stops[i] + 0.1, stops[i + 1] - 0.1];
        if (u1 - u0 < 0.4) continue;
        for (const [z0, z1] of CUSHIONS)
            for (const side of [0, 1])
            {
                const wall = side === 0 ? c0 : c1;
                const into = side === 0 ? 1 : -1;
                const slab = (inset: number, depth: number) =>
                {
                    const [v0, v1] = [wall, wall + into * depth].sort((p, q) => p - q);
                    extrude(b, at(u0 + inset, v0, u1 - inset, v1), z0 + inset, z1 - inset, MAT.prop, 0);
                };
                slab(0, 0.07);
                slab(0.06, 0.13);
            }
        // a hatch plate in the middle of the floor
        const [m, hw] = [(u0 + u1) / 2, Math.min(0.7, (u1 - u0) / 2 - 0.1)];
        const plateAt = (u: number, v: number): V3 => (alongX ? [u, 0.008, v] : [v, 0.008, u]);
        const cv = (c0 + c1) / 2;
        b.quad([plateAt(m - hw, cv - 0.55), plateAt(m + hw, cv - 0.55), plateAt(m + hw, cv + 0.55), plateAt(m - hw, cv + 0.55)], [0, 1, 0],
            [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.frame, 0);
    }
    for (const v of [c0 + 0.45, c1 - 0.45])
        extrude(b, at(a0, v - 0.07, a1, v + 0.07), room.height - 0.5, room.height - 0.36, MAT.prop, 0);
}
