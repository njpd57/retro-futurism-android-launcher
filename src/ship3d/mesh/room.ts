import type { V3 } from '../math';
import { propOutline, roomAt, splitEdge, type Light, type Prop, type Room, type V2 } from '../world';
import { MAT, MAT_SURFACE, STYLE, MAT_STYLE, Builder, extrude } from './builder';
import { addDoorway } from './doorway';

/** Edge in metres of the cells the big surfaces are cut into: small enough for the baked light to follow the corners. */
export const CELL = 1;

/** `poly` (convex) with the part `keepAbove` / below `at` on `axis` kept. */
export function clip(poly: readonly V2[], axis: 0 | 1, at: number, keepAbove: boolean): V2[]
{
    const f = (p: V2) => (keepAbove ? p[axis] - at : at - p[axis]);
    const out: V2[] = [];
    for (let i = 0; i < poly.length; i++)
    {
        const [a, b] = [poly[i], poly[(i + 1) % poly.length]];
        const [fa, fb] = [f(a), f(b)];
        if (fa >= 0) out.push(a);
        if ((fa > 0 && fb < 0) || (fa < 0 && fb > 0))
        {
            const t = fa / (fa - fb);
            out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
    }
    return out;
}

/**
 * A convex polygon cut along the lines of a world grid of `step` metres: the pieces that are left, each convex. Cells
 * on either side of a grid line share its points, so the pieces fit without cracks.
 */
export function tessellate(poly: readonly V2[], step = CELL): V2[][]
{
    const xs = poly.map(p => p[0]);
    const ys = poly.map(p => p[1]);
    const out: V2[][] = [];
    for (let gx = Math.floor(Math.min(...xs) / step) * step; gx < Math.max(...xs); gx += step)
        for (let gy = Math.floor(Math.min(...ys) / step) * step; gy < Math.max(...ys); gy += step)
        {
            let piece = clip(poly, 0, gx, true);
            piece = piece.length ? clip(piece, 0, gx + step, false) : piece;
            piece = piece.length ? clip(piece, 1, gy, true) : piece;
            piece = piece.length ? clip(piece, 1, gy + step, false) : piece;
            let area = 0;
            for (let i = 0; i < piece.length; i++) area += piece[i][0] * piece[(i + 1) % piece.length][1] - piece[(i + 1) % piece.length][0] * piece[i][1];
            if (piece.length >= 3 && Math.abs(area) > 1e-6) out.push(piece);
        }
    return out;
}

/** A wall panel from `from` to `to` along an edge, between heights `y0` and `y1`, in cells of about `CELL`. */
export function wallGrid(b: Builder, at: (t: number) => V2, from: number, to: number, y0: number, y1: number, n: V3, mat: number)
{
    const nx = Math.max(1, Math.ceil((to - from) / CELL));
    const ny = Math.max(1, Math.ceil((y1 - y0) / CELL));
    for (let i = 0; i < nx; i++)
    {
        const [t0, t1] = [from + ((to - from) * i) / nx, from + ((to - from) * (i + 1)) / nx];
        const [p0, p1] = [at(t0), at(t1)];
        for (let j = 0; j < ny; j++)
        {
            const [v0, v1] = [y0 + ((y1 - y0) * j) / ny, y0 + ((y1 - y0) * (j + 1)) / ny];
            b.quad([[p0[0], v0, p0[1]], [p1[0], v0, p1[1]], [p1[0], v1, p1[1]], [p0[0], v1, p0[1]]], n, [[t0, v0], [t1, v0], [t1, v1], [t0, v1]], mat, 0);
        }
    }
}

export function addRoom(b: Builder, room: Room)
{
    const h = room.height;
    const st = STYLE[room.zone] * MAT_STYLE;
    b.room = room;
    const own = (i: number) => (i < 0 ? 0 : (i + 1) * MAT_SURFACE);
    const [fl, wl, ce] = [own(room.surface.floor), own(room.surface.wall), own(room.surface.ceiling)];
    // floor and ceiling, cut into cells and fanned
    for (const piece of tessellate(room.poly))
        for (let i = 1; i < piece.length - 1; i++)
        {
            const [p0, p1, p2] = [piece[0], piece[i], piece[i + 1]];
            b.tri([p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p2[0], 0, p2[1]], [0, 1, 0], MAT.floor + st + fl, 0);
            b.tri([p0[0], h, p0[1]], [p1[0], h, p1[1]], [p2[0], h, p2[1]], [0, -1, 0], MAT.ceiling + st + ce, 0);
        }

    for (let i = 0; i < room.poly.length; i++)
    {
        const e = splitEdge(room, i);
        const at = (t: number, o = 0): V2 => [e.ax + e.dx * t + e.nx * o, e.ay + e.dy * t + e.ny * o];
        const n: V3 = [e.nx, 0, e.ny];
        const [p0, p1] = [room.poly[i], room.poly[(i + 1) % room.poly.length]];
        const length = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        for (const [from, to] of e.walls)
        {
            wallGrid(b, at, from, to, 0, h, n, MAT.wall + st + wl);
        }
        for (const d of e.doors)
        {
            const top = d.portal.height;
            if (h > top + 0.01)
            {
                // the room on the other side of the doorway has its own panel in this plane: stand ours a hair into
                // our room so the two don't fight for the pixel
                wallGrid(b, t => at(t, 0.003), d.from, d.to, top, h, n, MAT.wall + st + wl);
            }
            // the moulded surround on the room's side (a corridor's ends are all doorway: its own kit frames them)
            if (room.zone !== 'pasillo')
                addDoorway(b, { origin: at(0), along: [e.dx, e.dy], normal: [e.nx, e.ny] }, (d.from + d.to) / 2, (d.to - d.from) / 2, top,
                    Math.min(d.from, length - d.to), h);
        }
    }
}

/** The material number of a prop's surfaces: a prop of its own material carries it (`MAT_SURFACE`); a lamp that names one shines in its colour. */
export const propMaterial = (p: Prop): number =>
    (p.glow > 0 ? MAT.glow : MAT.prop) + (p.material === undefined ? 0 : (p.material + 1) * MAT_SURFACE);

export function addProp(b: Builder, p: Prop)
{
    b.room = roomAt(p.x, p.y) ?? null;
    extrude(b, propOutline(p, p.kind === 'cyl' ? (p.sides ?? 16) : 4), p.z0, p.z0 + p.h, propMaterial(p), p.glow);
}

/** A glowing lamp panel on the ceiling under each ceiling light. */
export function addLamp(b: Builder, l: Light, room: Room)
{
    b.room = null;
    const y = room.height - 0.02;
    b.quad([[l.x - 0.8, y, l.y - 0.25], [l.x + 0.8, y, l.y - 0.25], [l.x + 0.8, y, l.y + 0.25], [l.x - 0.8, y, l.y + 0.25]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.glow, 1);
}
