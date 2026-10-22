import type { V3 } from '../math';
import { materialIndex } from '../materials';
import type { V2 } from '../world';
import { MAT, MAT_SURFACE, Builder } from './builder';

/** `mat` made of the material `id` of `materials.json` (the kind's own if there is none by that name). */
export function made(mat: number, id: string): number
{
    const i = materialIndex(id);
    return i < 0 ? mat : mat + (i + 1) * MAT_SURFACE;
}

/** A plane on a wall: `t` metres along it from `origin`, `z` up, `o` out of the wall into the room. */
export interface WallFrame { origin: V2; along: V2; normal: V2 }

export const wallPoint = (f: WallFrame, t: number, z: number, o: number): V3 =>
    [f.origin[0] + f.along[0] * t + f.normal[0] * o, z, f.origin[1] + f.along[1] * t + f.normal[1] * o];

/**
 * A moulding that stands `depth` out of a wall between two outlines in the wall's plane, `inner` and `outer`, with as
 * many points each, running from the floor round to the floor (an arch: the bottom is left open). The face is cut
 * into quads between matching points, and both edges get their sides.
 */
export function wallRing(b: Builder, f: WallFrame, inner: readonly V2[], outer: readonly V2[], depth: number, mat: number, o0 = 0)
{
    const o1 = o0 + depth;
    const n: V3 = [f.normal[0], 0, f.normal[1]];
    for (let i = 0; i < inner.length - 1; i++)
    {
        const [a, c] = [inner[i], inner[i + 1]];
        const [p, q] = [outer[i], outer[i + 1]];
        b.quad([wallPoint(f, a[0], a[1], o1), wallPoint(f, c[0], c[1], o1), wallPoint(f, q[0], q[1], o1), wallPoint(f, p[0], p[1], o1)], n,
            [[a[0], a[1]], [c[0], c[1]], [q[0], q[1]], [p[0], p[1]]], mat, 0);
    }
    for (const [line, sign] of [[inner, -1], [outer, 1]] as const)
        wallSides(b, f, line, o0, o1, sign, mat);
}

/** The sides of a moulding along `line`, facing away from the opening (`sign` 1) or into it (-1). */
function wallSides(b: Builder, f: WallFrame, line: readonly V2[], o0: number, o1: number, sign: number, mat: number)
{
    const [cx, cz] = [line.reduce((s, p) => s + p[0], 0) / line.length, line.reduce((s, p) => s + p[1], 0) / line.length];
    let run = 0;
    for (let i = 0; i < line.length - 1; i++)
    {
        const [a, c] = [line[i], line[i + 1]];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        let [nt, nz] = [(c[1] - a[1]) / len, -(c[0] - a[0]) / len];
        if ((((a[0] + c[0]) / 2 - cx) * nt + ((a[1] + c[1]) / 2 - cz) * nz) * sign < 0) [nt, nz] = [-nt, -nz];
        const n: V3 = [f.along[0] * nt, nz, f.along[1] * nt];
        b.quad([wallPoint(f, a[0], a[1], o0), wallPoint(f, c[0], c[1], o0), wallPoint(f, c[0], c[1], o1), wallPoint(f, a[0], a[1], o1)], n,
            [[run, o0], [run + len, o0], [run + len, o1], [run, o1]], mat, 0);
        run += len;
    }
}

/** A box standing out of a wall: `t0..t1` along it, `z0..z1` up, `o0..o1` out, closed all round. */
export function wallBox(b: Builder, f: WallFrame, t0: number, t1: number, z0: number, z1: number, o0: number, o1: number, mat: number, emit = 0)
{
    const P = (t: number, z: number, o: number) => wallPoint(f, t, z, o);
    const [al, nl]: [V3, V3] = [[f.along[0], 0, f.along[1]], [f.normal[0], 0, f.normal[1]]];
    const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];
    b.quad([P(t0, z0, o1), P(t1, z0, o1), P(t1, z1, o1), P(t0, z1, o1)], nl, [[t0, z0], [t1, z0], [t1, z1], [t0, z1]], mat, emit);
    b.quad([P(t0, z0, o0), P(t1, z0, o0), P(t1, z1, o0), P(t0, z1, o0)], neg(nl), [[t0, z0], [t1, z0], [t1, z1], [t0, z1]], mat, emit);
    b.quad([P(t1, z0, o0), P(t1, z0, o1), P(t1, z1, o1), P(t1, z1, o0)], al, [[o0, z0], [o1, z0], [o1, z1], [o0, z1]], mat, emit);
    b.quad([P(t0, z0, o0), P(t0, z0, o1), P(t0, z1, o1), P(t0, z1, o0)], neg(al), [[o0, z0], [o1, z0], [o1, z1], [o0, z1]], mat, emit);
    b.quad([P(t0, z1, o0), P(t1, z1, o0), P(t1, z1, o1), P(t0, z1, o1)], [0, 1, 0], [[t0, o0], [t1, o0], [t1, o1], [t0, o1]], mat, emit);
    b.quad([P(t0, z0, o0), P(t1, z0, o0), P(t1, z0, o1), P(t0, z0, o1)], [0, -1, 0], [[t0, o0], [t1, o0], [t1, o1], [t0, o1]], mat, emit);
}

/** A flat glowing panel on a wall, `o` out of it. */
export function wallGlow(b: Builder, f: WallFrame, t0: number, t1: number, z0: number, z1: number, o: number, mat: number, emit: number)
{
    b.quad([wallPoint(f, t0, z0, o), wallPoint(f, t1, z0, o), wallPoint(f, t1, z1, o), wallPoint(f, t0, z1, o)], [f.normal[0], 0, f.normal[1]],
        [[0, 0], [1, 0], [1, 1], [0, 1]], mat, emit);
}

/**
 * The Nostromo's doorway, seen from a room: a thick white surround with chamfered shoulders stepping up over the
 * opening, lined with orange padding; where the wall has room for them, a lit status box over it and a tube light
 * of three segments either side. `mid` is the middle of the opening along the wall, `half` its half width, `top` its
 * height; `room` is how far the wall runs free either side of it and `height` how tall the room is.
 */
export function addDoorway(b: Builder, f: WallFrame, mid: number, half: number, top: number, room: number, height: number)
{
    const at = (pts: V2[]) => pts.map(([t, z]): V2 => [mid + t, z]);
    const lining = 0.12;
    const side = Math.max(0.12, Math.min(0.45, room - 0.04));
    const shoulder = Math.min(0.45, height - top - 0.1);
    const chamfer = 0.3;
    // the opening, its top corners cut
    const inner = at([[-half, 0], [-half, top - chamfer], [-half + chamfer, top], [half - chamfer, top], [half, top - chamfer], [half, 0]]);
    const lined = at([[-half - lining, 0], [-half - lining, top - chamfer + lining * 0.4], [-half + chamfer - lining * 0.4, top + lining],
        [half - chamfer + lining * 0.4, top + lining], [half + lining, top - chamfer + lining * 0.4], [half + lining, 0]]);
    const w = half + lining + side;
    const outer = at([[-w, 0], [-w, top - 0.2], [-w + 0.6, top + shoulder], [w - 0.6, top + shoulder], [w, top - 0.2], [w, 0]]);
    wallRing(b, f, inner, lined, 0.26, made(MAT.prop, 'orange'));
    wallRing(b, f, lined, outer, 0.18, MAT.frame);

    const free = room - side - lining;
    if (height - (top + shoulder) > 0.5)
    {
        // three status cells over the door: open, cycling, sealed
        const z0 = top + shoulder + 0.12;
        wallBox(b, f, mid - 0.62, mid + 0.62, z0, z0 + 0.36, 0, 0.14, made(MAT.prop, 'graphite'));
        ['green', 'amber', 'red'].forEach((id, k) =>
        {
            const t = mid - 0.5 + k * 0.38;
            wallGlow(b, f, t, t + 0.24, z0 + 0.06, z0 + 0.3, 0.15, made(MAT.glow, id), 0.3);
        });
    }
    if (free > 0.5)
    {
        // tube lights in a dark housing, a hand's width from the surround
        for (const s of [-1, 1])
        {
            const t = mid + s * (w + 0.3);
            wallBox(b, f, t - 0.13, t + 0.13, 0.85, 2.55, 0, 0.08, made(MAT.prop, 'graphite'));
            for (let k = 0; k < 3; k++)
            {
                const z = 0.95 + k * 0.53;
                wallGlow(b, f, t - 0.07, t + 0.07, z, z + 0.45, 0.09, MAT.glow, 1);
            }
        }
    }
}
