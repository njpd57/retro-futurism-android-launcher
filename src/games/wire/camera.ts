import { blocks, neighbour, type Dir, type Grid } from '../isolation/grid';

/**
 * First-person wireframe camera shared by the games (AISLAMIENTO, MARINES). Pure: no DOM.
 *
 * Map units: cell (x, y) spans [x, x+1] × [y, y+1], y grows southwards. Heights go from -0.5 (ceiling) to 0.5
 * (floor) with the eye at 0. Faces are filled with the background and drawn far to near, so nearer walls hide
 * what is behind them.
 */

export interface Pose
{
    /** continuous map position; the centre of cell (x, y) is (x + 0.5, y + 0.5) */
    x: number;
    y: number;
    /** radians, 0 = north, clockwise */
    yaw: number;
}

export type V3 = [number, number, number];
export type P2 = [number, number];

export type Shape =
    /** `clip`: pairs of screen x ranges `[x0, x1, x0, x1, ...]` the shape may be drawn in (occlusion by nearer walls) */
    | { kind: 'poly'; tag: string; pts: number[]; fill: boolean; alpha: number; clip?: readonly number[] }
    | { kind: 'line'; tag: string; pts: number[]; alpha: number; clip?: readonly number[] }
    /** `a`, `b`: the text's horizontal axis on screen (1, 0 when the wall faces the camera), to follow the wall */
    | { kind: 'text'; tag: string; x: number; y: number; size: number; a: number; b: number; text: string; alpha: number };

/** Cells seen in any direction. */
export const VIEW_DEPTH = 6;
export const NEAR = 0.05;
/** focal length as a fraction of the view width */
export const FOCAL = 0.62;

export const dirYaw = (dir: Dir) => dir * Math.PI / 2;

/** Lines fade with distance. */
export function depthAlpha(dist: number, depth = VIEW_DEPTH)
{
    return Math.min(1, Math.max(0.15, 1.1 - dist / (depth + 1)));
}

/** Inside-out order of each wall: seen from inside the cell, `a` is on the left and `b` on the right. */
export function edge(x: number, y: number, dir: Dir): [P2, P2]
{
    switch (dir)
    {
        case 0: return [[x, y], [x + 1, y]];
        case 1: return [[x + 1, y], [x + 1, y + 1]];
        case 2: return [[x + 1, y + 1], [x, y + 1]];
        case 3: return [[x, y + 1], [x, y]];
    }
}

export const INWARD: Record<Dir, P2> = { 0: [0, 1], 1: [-1, 0], 2: [0, -1], 3: [1, 0] };

export function hash(n: number)
{
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) % 997;
}

/**
 * Outline of something standing against the `wall` side of cell (x, y): `margin` free at each end, `depth`
 * into the cell. Clockwise for `box`, starting at the front right corner; p3 → p2 is the front.
 */
export function against(x: number, y: number, wall: Dir, margin: number, depth: number): P2[]
{
    const [a, b] = edge(x, y, wall);
    const inward = INWARD[wall];
    const lerp = (t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const p0 = lerp(margin);
    const p1 = lerp(1 - margin);
    const p2: P2 = [p1[0] + inward[0] * depth, p1[1] + inward[1] * depth];
    const p3: P2 = [p0[0] + inward[0] * depth, p0[1] + inward[1] * depth];
    return [p2, p3, p0, p1];
}

/**
 * The cells reachable from the camera's cell through open space, with their distance in steps (the camera's own
 * cell is 0); anything else is behind a wall. Null when the camera is inside a wall.
 */
export function visibleCells(g: Grid, closed: readonly number[], pose: Pose, depth = VIEW_DEPTH): Map<number, number> | null
{
    const start = Math.floor(pose.y) * g.w + Math.floor(pose.x);
    if (start < 0 || start >= g.cells.length || blocks(g, closed, start)) return null;
    const seen = new Map<number, number>([[start, 0]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++)
    {
        const c = queue[head];
        const d = seen.get(c)!;
        if (d >= depth) continue;
        for (let k = 0; k < 4; k++)
        {
            const n = neighbour(g, c, k as Dir);
            if (n < 0 || seen.has(n) || blocks(g, closed, n)) continue;
            seen.set(n, d + 1);
            queue.push(n);
        }
    }
    return seen;
}

export interface CameraOptions
{
    pose: Pose;
    /** vertical offset of the eye (walking bob) */
    bob: number;
    /** view size in pixels */
    w: number;
    h: number;
}

/** A camera at `pose` and the primitives to build shapes in its view. */
export function createCamera({ pose, bob, w, h }: CameraOptions)
{
    const sin = Math.sin(pose.yaw);
    const cos = Math.cos(pose.yaw);
    const focal = FOCAL * w;

    const cam = (wx: number, wy: number, height: number): V3 =>
    {
        const dx = wx - pose.x;
        const dy = wy - pose.y;
        // right = (cos, sin), forward = (sin, -cos)
        return [dx * cos + dy * sin, height + bob, dx * sin - dy * cos];
    };
    const project = (p: V3): P2 => [w / 2 + p[0] / p[2] * focal, h / 2 + p[1] / p[2] * focal];

    function clipPoly(pts: V3[]): V3[]
    {
        const out: V3[] = [];
        for (let i = 0; i < pts.length; i++)
        {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const ina = a[2] >= NEAR;
            const inb = b[2] >= NEAR;
            if (ina) out.push(a);
            if (ina !== inb)
            {
                const t = (NEAR - a[2]) / (b[2] - a[2]);
                out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
            }
        }
        return out;
    }

    function clipSegment(a: V3, b: V3): [V3, V3] | null
    {
        if (a[2] < NEAR && b[2] < NEAR) return null;
        if (a[2] >= NEAR && b[2] >= NEAR) return [a, b];
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        const m: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
        return a[2] < NEAR ? [m, b] : [a, m];
    }

    const flat = (pts: P2[]) => pts.flatMap(p => p);

    function poly(tag: string, pts: V3[], fill: boolean, alpha: number): Shape | null
    {
        const clipped = clipPoly(pts);
        if (clipped.length < 3) return null;
        return { kind: 'poly', tag, pts: flat(clipped.map(project)), fill, alpha };
    }

    function line(tag: string, a: V3, b: V3, alpha: number): Shape | null
    {
        const c = clipSegment(a, b);
        return c && { kind: 'line', tag, pts: flat(c.map(project)), alpha };
    }

    /** A vertical face from `a` to `b`, with points given as (u across, v down) in 0..1. */
    function face(a: P2, b: P2, top = -0.5, bottom = 0.5)
    {
        const at = (u: number, v: number): V3 => cam(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, top + (bottom - top) * v);
        return {
            poly: (tag: string, uv: P2[], fill: boolean, alpha: number) => poly(tag, uv.map(([u, v]) => at(u, v)), fill, alpha),
            line: (tag: string, u0: number, v0: number, u1: number, v1: number, alpha: number) => line(tag, at(u0, v0), at(u1, v1), alpha),
            rect: (tag: string, u0: number, v0: number, u1: number, v1: number, alpha: number) =>
                poly(tag, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => at(u, v)), false, alpha),
            point: (u: number, v: number) => at(u, v),
        };
    }

    /** True when the camera is on the side of a→b that faces are drawn for. */
    const facing = (a: P2, b: P2) => (pose.x - a[0]) * -(b[1] - a[1]) + (pose.y - a[1]) * (b[0] - a[0]) > 0;
    const distTo = (x: number, y: number) => Math.hypot(x - pose.x, y - pose.y);

    type Face = ReturnType<typeof face>;

    /** A label across the top of a wall, sheared to follow it; null when too small or too edge-on to read. */
    function text(f: Face, label: string, alpha: number): Shape | null
    {
        const V = 0.12;
        const pts = [f.point(0.5, 0.28 - V / 2), f.point(0.5, 0.28 + V / 2), f.point(0.45, 0.28), f.point(0.55, 0.28)];
        if (pts.some(p => p[2] < NEAR)) return null;
        const [top, bottom, left, right] = pts.map(project);
        const size = Math.abs(bottom[1] - top[1]);
        // screen pixels per wall unit across, over pixels per wall unit down
        const a = (right[0] - left[0]) / 0.1 / (size / V);
        const b = (right[1] - left[1]) / 0.1 / (size / V);
        if (size < 6 || a < 0.3) return null;
        return { kind: 'text', tag: 'sign', x: (top[0] + bottom[0]) / 2, y: (top[1] + bottom[1]) / 2, size, a, b, text: label, alpha };
    }

    /** A box standing on the floor from `top` to `bottom` height over the 2D outline `base` (clockwise). */
    function box(base: P2[], top: number, bottom: number, tag: string, alpha: number, detail?: (f: Face, alpha: number) => (Shape | null)[]): (Shape | null)[]
    {
        const shapes: (Shape | null)[] = [];
        for (let i = 0; i < base.length; i++)
        {
            // outward faces: walk the outline backwards so each face is seen from outside
            const a = base[(i + 1) % base.length];
            const b = base[i];
            if (!facing(a, b)) continue;
            const f = face(a, b, top, bottom);
            shapes.push(f.poly(tag, [[0, 0], [1, 0], [1, 1], [0, 1]], true, alpha));
            if (detail) shapes.push(...detail(f, alpha));
        }
        return shapes;
    }

    return { pose, sin, cos, focal, w, h, bob, cam, project, poly, line, face, facing, distTo, text, box };
}

export type Camera = ReturnType<typeof createCamera>;
export type Face = ReturnType<Camera['face']>;
