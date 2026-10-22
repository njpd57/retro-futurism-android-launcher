import type { Agent } from './crew';
import { SHUTTLE_PLATES } from './labels';
import { poseCat, posePerson, type Part } from './pose';
import type { V3 } from './math';
import { Builder, extrude, MAT, plate } from './mesh';
import type { Bay, V2 } from './world';

type Basis = { r: [number, number]; f: [number, number] };

const basis = (yaw: number): Basis => ({ r: [Math.cos(yaw), Math.sin(yaw)], f: [Math.sin(yaw), -Math.cos(yaw)] });

const len = (v: V3) => Math.hypot(v[0], v[1], v[2]);
const scale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * One part as a box in GL space, every face with uvs 0..1 so the shader can trace its edges: that outline is what
 * makes the crew read as silhouettes of light. `side` is the figure's right, for the box's width.
 */
function box(b: Builder, a: V3, c: V3, w: number, d: number, side: V3, mat: number, emit: number)
{
    const axis = sub(c, a);
    const l = len(axis);
    if (l < 1e-6) return;
    const u = scale(axis, 1 / l);
    let s = sub(side, scale(u, dot(side, u)));
    if (len(s) < 1e-4) s = cross(u, [0, 0, 1]);
    s = scale(s, 1 / len(s));
    const t = cross(u, s);
    const hs = scale(s, w / 2);
    const ht = scale(t, d / 2);
    // the eight corners: at the start (0..3) and the end (4..7) of the axis
    const ring = (o: V3): V3[] => [add(sub(o, hs), ht), add(add(o, hs), ht), sub(add(o, hs), ht), sub(sub(o, hs), ht)];
    const p = [...ring(a), ...ring(c)];
    const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const face = (i: number[], n: V3) => b.quad([p[i[0]], p[i[1]], p[i[2]], p[i[3]]], n, uv, mat, emit);
    face([0, 1, 5, 4], t);
    face([1, 2, 6, 5], s);
    face([2, 3, 7, 6], scale(t, -1));
    face([3, 0, 4, 7], scale(s, -1));
    face([3, 2, 1, 0], scale(u, -1));
    face([4, 5, 6, 7], u);
}

/** Draws posed parts at `(x, y)` facing `yaw`, raised by `lift`; `alert` marks the body to blink in the shader. */
function place(b: Builder, parts: readonly Part[], x: number, y: number, yaw: number, lift: number, alert: boolean)
{
    const { r, f } = basis(yaw);
    const world = (q: V3): V3 => [x + r[0] * q[0] + f[0] * q[2], q[1] + lift, y + r[1] * q[0] + f[1] * q[2]];
    for (const part of parts)
    {
        const side = basis(yaw + (part.turn ?? 0)).r;
        box(b, world(part.a), world(part.b), part.w, part.d, [side[0], 0, side[1]], part.glow ? MAT.glow : MAT.crew, part.glow ? 1 : alert ? 1 : 0);
    }
}

/** How the crew is drawn besides where it stands: who looks where, who blinks, and a clock (0 keeps them still). */
export interface CrewLook
{
    /** head turn to the right, radians, by agent id */
    headYaw?: ReadonlyMap<string, number>;
    /** the ones whose app is busy: their body blinks */
    alert?: ReadonlySet<string>;
}

/** The crew as triangles for the dynamic buffer; `time` (seconds) drives the walk of those who move and the idle life. */
export function figureVertices(agents: readonly Agent[], time: number, moving: ReadonlySet<string>, look: CrewLook = {}): Float32Array
{
    const b = new Builder();
    for (const a of agents)
    {
        const walking = moving.has(a.id);
        const phase = walking ? time * (a.kind === 'cat' ? 14 : 8) : 0;
        const lift = walking ? Math.abs(Math.sin(phase)) * (a.kind === 'cat' ? 0.02 : 0.025) : 0;
        const parts = a.kind === 'cat'
            ? poseCat(phase, walking, time)
            : posePerson({
                phase,
                gesture: walking ? 'walk' : a.kind === 'signal' ? 'typing' : 'idle',
                time,
                tall: a.kind === 'android' ? 1.12 : 1,
                headYaw: look.headYaw?.get(a.id) ?? 0,
                android: a.kind === 'android',
            });
        place(b, parts, a.x, a.y, a.yaw, lift, look.alert?.has(a.id) ?? false);
    }
    return new Float32Array(b.data);
}

/** Plate width over a person's head. */
export const HEAD_PLATE_W = 1.3;

/** The plates over the heads of those who have one, turned to face a camera looking along `camYaw`. */
export function plateVertices(agents: readonly Agent[], camYaw: number): Float32Array
{
    const b = new Builder();
    // the camera's right, in GL space; the plate faces back at it
    const right: V3 = [Math.cos(camYaw), 0, Math.sin(camYaw)];
    const n: V3 = [-Math.sin(camYaw), 0, Math.cos(camYaw)];
    for (const a of agents)
        if (a.plate !== undefined) plate(b, [a.x, a.kind === 'android' ? 2.5 : 2.05, a.y], right, HEAD_PLATE_W, n, a.plate);
    return new Float32Array(b.data);
}

const aabb = (x0: number, y0: number, x1: number, y1: number): V2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Half the shuttle's size across x and along y (see `hangarBays`). */
const HX = 1.7;
const HY = 1.5;

/**
 * The shuttles of the hangar: a hull on four struts, a cockpit toward the aisle, a glowing engine toward the wall and
 * the app's name painted on the side that faces the aisle.
 */
export function shuttleVertices(bays: readonly Bay[]): Float32Array
{
    const b = new Builder();
    bays.forEach((bay, i) =>
    {
        const { x, y, nx } = bay;
        const top = bay.prop.z0 + bay.prop.h;
        // the parking bay: chevrons on the floor round the shuttle
        b.quad([[x - HX - 0.5, 0.012, y - HY - 0.5], [x + HX + 0.5, 0.012, y - HY - 0.5], [x + HX + 0.5, 0.012, y + HY + 0.5], [x - HX - 0.5, 0.012, y + HY + 0.5]],
            [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.hazard, 0);
        extrude(b, aabb(x - HX, y - HY, x + HX, y + HY), bay.prop.z0, top, MAT.prop, 0);
        // the cockpit sits on the hull's aisle half, a little narrower and lower
        const cx = x + nx * 0.8;
        extrude(b, aabb(cx - 0.6, y - 0.8, cx + 0.6, y + 0.8), top, top + 0.55, MAT.prop, 0);
        extrude(b, aabb(cx + nx * 0.58 - 0.03, y - 0.6, cx + nx * 0.58 + 0.03, y + 0.6), top + 0.15, top + 0.45, MAT.glow, 0.7);
        // the engine
        const ex = x - nx * (HX + 0.05);
        extrude(b, aabb(ex - 0.05, y - 0.8, ex + 0.05, y + 0.8), 0.7, 1.4, MAT.glow, 0.9);
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
        {
            const [lx, ly] = [x + sx * (HX - 0.4), y + sy * (HY - 0.4)];
            extrude(b, aabb(lx - 0.08, ly - 0.08, lx + 0.08, ly + 0.08), 0, bay.prop.z0, MAT.frame, 0);
        }
        // seen from the aisle, the viewer's right runs along -nx * y
        plate(b, [x + nx * (HX + 0.02), bay.prop.z0 + bay.prop.h * 0.5, y], [0, 0, -nx], 2.6, [nx, 0, 0], SHUTTLE_PLATES + i);
    });
    return new Float32Array(b.data);
}
