import { bakeVertex } from '../bake';
import { STYLE } from '../materials';
import type { V3 } from '../math';
import { centroid, type Room, type V2 } from '../world';

/**
 * The ship baked into one triangle list. Built once and uploaded to the GPU: a frame only moves the camera.
 * Vertices are `x, up, z` in GL space (`z` is the plan's `y`), a normal, a texture coordinate, a material and how
 * much the surface shines by itself. No culling is used, so winding doesn't matter.
 */

/** position 3, normal 3, uv 2, material, emit, baked occlusion, baked lamp light, its direction 3 */
export const STRIDE = 15;

export const MAT = { wall: 0, floor: 1, ceiling: 2, prop: 3, screen: 4, glow: 5, frame: 6, crew: 7, door: 8, label: 9, hazard: 10 } as const;

/**
 * The look of a room's surfaces. It rides in the material number as `mat + 16 * style` (the shader splits it), so a
 * wall, floor or ceiling carries its room's brightness with no extra vertex data.
 */
export { STYLE } from '../materials';

export const MAT_STYLE = 16;
/** A surface that names its own material carries `material + 1` times this on top of `mat + 16 * style` (0 = the kind's). */
export const MAT_SURFACE = 256;

export interface Mesh { data: Float32Array; vertices: number }

export class Builder
{
    data: number[] = [];
    /** the room what is built now stands in: its vertices get that room's baked occlusion and lamp light */
    room: Room | null = null;

    vertex(x: number, up: number, y: number, n: V3, u: number, v: number, mat: number, emit: number)
    {
        // everything in a room carries the room's style, which is the colour of its light
        if (this.room && mat % MAT_SURFACE < MAT_STYLE) mat += (STYLE[this.room.zone] ?? 0) * MAT_STYLE;
        const { ao, lit, dir } = bakeVertex(this.room, x, up, y, n);
        this.data.push(x, up, y, n[0], n[1], n[2], u, v, mat, emit, ao, lit, dir[0], dir[1], dir[2]);
    }

    /** A quad `a b c d` around, with uvs per corner. */
    quad(c: [V3, V3, V3, V3], n: V3, uv: [number, number][], mat: number, emit: number)
    {
        for (const k of [0, 1, 2, 0, 2, 3]) this.vertex(c[k][0], c[k][1], c[k][2], n, uv[k][0], uv[k][1], mat, emit);
    }

    tri(a: V3, b: V3, c: V3, n: V3, mat: number, emit: number)
    {
        for (const p of [a, b, c]) this.vertex(p[0], p[1], p[2], n, p[0], p[2], mat, emit);
    }
}

/** A flat-topped solid on a plan outline, from `z0` to `z1`. */
export function extrude(b: Builder, outline: readonly V2[], z0: number, z1: number, mat: number, emit: number)
{
    const [cx, cy] = centroid(outline);
    let run = 0;
    for (let i = 0; i < outline.length; i++)
    {
        const [ax, ay] = outline[i];
        const [bx, by] = outline[(i + 1) % outline.length];
        const len = Math.hypot(bx - ax, by - ay);
        let nx = -(by - ay) / len;
        let ny = (bx - ax) / len;
        // outward: away from the middle
        if (((ax + bx) / 2 - cx) * nx + ((ay + by) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; }
        b.quad([[ax, z0, ay], [bx, z0, by], [bx, z1, by], [ax, z1, ay]], [nx, 0, ny], [[run, z0], [run + len, z0], [run + len, z1], [run, z1]], mat, emit);
        run += len;
    }
    for (let i = 1; i < outline.length - 1; i++)
        b.tri([outline[0][0], z1, outline[0][1]], [outline[i][0], z1, outline[i][1]], [outline[i + 1][0], z1, outline[i + 1][1]], [0, 1, 0], mat, emit);
    // where the wall and the box's own back faces share it and fight for the pixel
    if (z0 > 0)
        for (let i = 1; i < outline.length - 1; i++)
            b.tri([outline[0][0], z0, outline[0][1]], [outline[i][0], z0, outline[i][1]], [outline[i + 1][0], z0, outline[i + 1][1]], [0, -1, 0], mat, emit);
}
