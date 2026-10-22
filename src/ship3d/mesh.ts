import { labelUv, slotUv, SLOT } from './atlas';
import { bakeVertex } from './bake';
import { STENCIL_PLATES, STENCILS } from './labels';
import type { V3 } from './math';
import { BRIDGE_CONSOLES, centroid, LIGHTS, PORTALS, portalAxis, PROPS, propOutline, roomAt, ROOMS, SCREENS, splitEdge, type Light, type Prop, type Room, type ScreenDef, type V2, type Zone } from './world';

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
export const STYLE: Readonly<Record<Zone, number>> = {
    comedor: 4, camarotes: 0, comms: 0, puente: 1, motor: 2, bodega: 3, hangar: 3, enfermeria: 4, hipersueno: 5, pasillo: 6,
};

export const MAT_STYLE = 16;

export interface Mesh { data: Float32Array; vertices: number }

export class Builder
{
    data: number[] = [];
    /** the room what is built now stands in: its vertices get that room's baked occlusion and lamp light */
    room: Room | null = null;

    vertex(x: number, up: number, y: number, n: V3, u: number, v: number, mat: number, emit: number)
    {
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
}

/** The frame of a screen as the viewer sees it: right, up and normal in GL space. */
export function screenFrame(s: ScreenDef): { center: V3; normal: V3; right: V3; up: V3 }
{
    return {
        center: [s.x, s.z, s.y],
        normal: [Math.sin(s.yaw), 0, -Math.cos(s.yaw)],
        // a viewer looks at the screen with yaw + PI
        right: [-Math.cos(s.yaw), 0, -Math.sin(s.yaw)],
        up: [0, 1, 0],
    };
}

/** Edge in metres of the cells the big surfaces are cut into: small enough for the baked light to follow the corners. */
export const CELL = 1;

/** `poly` (convex) with the part `keepAbove` / below `at` on `axis` kept. */
function clip(poly: readonly V2[], axis: 0 | 1, at: number, keepAbove: boolean): V2[]
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
function wallGrid(b: Builder, at: (t: number) => V2, from: number, to: number, y0: number, y1: number, n: V3, mat: number)
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

function addRoom(b: Builder, room: Room)
{
    const h = room.height;
    const st = STYLE[room.zone] * MAT_STYLE;
    b.room = room;
    // floor and ceiling, cut into cells and fanned
    for (const piece of tessellate(room.poly))
        for (let i = 1; i < piece.length - 1; i++)
        {
            const [p0, p1, p2] = [piece[0], piece[i], piece[i + 1]];
            b.tri([p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p2[0], 0, p2[1]], [0, 1, 0], MAT.floor + st, 0);
            b.tri([p0[0], h, p0[1]], [p1[0], h, p1[1]], [p2[0], h, p2[1]], [0, -1, 0], MAT.ceiling + st, 0);
        }

    for (let i = 0; i < room.poly.length; i++)
    {
        const e = splitEdge(room, i);
        const at = (t: number, o = 0): V2 => [e.ax + e.dx * t + e.nx * o, e.ay + e.dy * t + e.ny * o];
        const n: V3 = [e.nx, 0, e.ny];
        for (const [from, to] of e.walls)
        {
            wallGrid(b, at, from, to, 0, h, n, MAT.wall + st);
        }
        for (const d of e.doors)
        {
            const top = d.portal.height;
            if (h > top + 0.01)
            {
                wallGrid(b, at, d.from, d.to, top, h, n, MAT.wall + st);
            }
            // two posts and a beam
            const post = (t0: number, t1: number) => extrude(b, [at(t0), at(t1), at(t1, 0.35), at(t0, 0.35)], 0, top, MAT.frame, 0.06);
            post(d.from, d.from + 0.2);
            post(d.to - 0.2, d.to);
            extrude(b, [at(d.from), at(d.to), at(d.to, 0.35), at(d.from, 0.35)], top - 0.2, top, MAT.frame, 0.06);
        }
    }
}

function addProp(b: Builder, p: Prop)
{
    b.room = roomAt(p.x, p.y) ?? null;
    extrude(b, propOutline(p, p.kind === 'cyl' ? 16 : 4), p.z0, p.z0 + p.h, p.glow > 0 ? MAT.glow : MAT.prop, p.glow);
}

/** A monitor: its picture from the atlas on a dark bezel. */
function addScreen(b: Builder, s: ScreenDef)
{
    b.room = null;
    const f = screenFrame(s);
    const slot = SLOT[s.id];
    const [u0, v0, u1, v1] = slotUv(slot);
    const corner = (dw: number, dh: number, push = 0): V3 => [
        f.center[0] + f.right[0] * dw + f.normal[0] * push,
        f.center[1] + dh,
        f.center[2] + f.right[2] * dw + f.normal[2] * push,
    ];
    const hw = s.w / 2;
    const hh = s.h / 2;
    // the picture: top-left, top-right, bottom-right, bottom-left as the viewer sees them
    b.quad([corner(-hw, hh, 0.005), corner(hw, hh, 0.005), corner(hw, -hh, 0.005), corner(-hw, -hh, 0.005)], f.normal, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], MAT.screen, 1);
    const bz = 0.12;
    b.quad([corner(-hw - bz, hh + bz), corner(hw + bz, hh + bz), corner(hw + bz, -hh - bz), corner(-hw - bz, -hh - bz)], f.normal, [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.frame, 0.1);
}

/** A glowing lamp panel on the ceiling under each ceiling light. */
function addLamp(b: Builder, l: Light, room: Room)
{
    b.room = null;
    const y = room.height - 0.02;
    b.quad([[l.x - 0.8, y, l.y - 0.25], [l.x + 0.8, y, l.y - 0.25], [l.x + 0.8, y, l.y + 0.25], [l.x - 0.8, y, l.y + 0.25]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.glow, 1);
}

/**
 * A sliding door in each doorway: a leaf on either face of the opening. The vertices carry the door's number in the
 * `emit` slot, and the vertex shader lifts them by how open that door is.
 */
function addDoors(b: Builder)
{
    PORTALS.forEach((p, i) =>
    {
        const a = portalAxis(p);
        b.room = roomAt(p.x + a.nx * 0.6, p.y + a.ny * 0.6) ?? null;
        for (const side of [-1, 1])
        {
            const off = side * 0.03;
            const [cx, cy] = [p.x + a.nx * off, p.y + a.ny * off];
            const [x0, y0, x1, y1] = [cx - (a.dx * p.width) / 2, cy - (a.dy * p.width) / 2, cx + (a.dx * p.width) / 2, cy + (a.dy * p.width) / 2];
            b.quad([[x0, 0, y0], [x1, 0, y1], [x1, p.height, y1], [x0, p.height, y0]], [a.nx * side, 0, a.ny * side],
                [[0, 0], [p.width, 0], [p.width, p.height], [0, p.height]], MAT.door, i / 16);
        }
    });
}

/** A name plate: a quad of the atlas's plate `slot`, centred on `c` (GL space), `w` wide, spanning `right`, facing `n`. */
export function plate(b: Builder, c: V3, right: V3, w: number, n: V3, slot: number, emit = 1)
{
    b.room = null;
    const [u0, v0, u1, v1] = labelUv(slot);
    const hw = w / 2;
    const hh = w / 8;
    const at = (dw: number, dh: number): V3 => [c[0] + right[0] * dw, c[1] + dh, c[2] + right[2] * dw];
    b.quad([at(-hw, hh), at(hw, hh), at(hw, -hh), at(-hw, -hh)], n, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], MAT.label, emit);
}

const rectOutline = (x0: number, y0: number, x1: number, y1: number): V2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Heights of the padded cushions between a corridor's ribs, as on the Torrens: three rows of them up each wall. */
const CUSHIONS: readonly [number, number][] = [[0.3, 1.0], [1.08, 1.78], [1.86, 2.46]];

/**
 * Ribs up the long walls of a corridor with padded cushions between them, two pipes along its ceiling and hatch
 * plates down the floor: the Nostromo's ribbed, quilted hallways.
 */
function addCorridor(b: Builder, room: Room)
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

/** Chevrons on the floor on both faces of the doorways of the working rooms. */
function addHazard(b: Builder)
{
    const WORK = new Set<Zone>(['bodega', 'hangar', 'motor']);
    for (const p of PORTALS)
    {
        const a = portalAxis(p);
        for (const side of [-1, 1])
        {
            const room = roomAt(p.x + a.nx * side * 0.8, p.y + a.ny * side * 0.8);
            if (!room || !WORK.has(room.zone)) continue;
            b.room = room;
            const [hw, d0, d1] = [p.width / 2 + 0.2, 0.15, 1.05];
            const corner = (u: number, d: number): V3 => [p.x + a.dx * u + a.nx * side * d, 0.012, p.y + a.dy * u + a.ny * side * d];
            b.quad([corner(-hw, d0), corner(hw, d0), corner(hw, d1), corner(-hw, d1)], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.hazard, 0);
        }
    }
}

/** A name stencil on the wall beside the room's door, away from monitors. */
export function stencilSpot(room: Room): { x: number; y: number; nx: number; ny: number } | null
{
    const near = (x: number, y: number, list: readonly { x: number; y: number }[], r: number) => list.some(q => Math.hypot(q.x - x, q.y - y) < r);
    let fallback: { x: number; y: number; nx: number; ny: number } | null = null;
    for (let i = 0; i < room.poly.length; i++)
    {
        const e = splitEdge(room, i);
        for (const [from, to] of e.walls)
        {
            if (to - from < 2.4) continue;
            for (const t of [from + 1.3, to - 1.3])
            {
                const x = e.ax + e.dx * t + e.nx * 0.02;
                const y = e.ay + e.dy * t + e.ny * 0.02;
                if (near(x, y, SCREENS, 1.9)) continue;
                const spot = { x, y, nx: e.nx, ny: e.ny };
                if (near(x, y, PORTALS, 3.2)) return spot;
                fallback ??= spot;
            }
        }
    }
    return fallback;
}

function addStencils(b: Builder)
{
    STENCILS.forEach((s, i) =>
    {
        const room = ROOMS.find(r => r.id === s.room);
        const spot = room && stencilSpot(room);
        if (spot) plate(b, [spot.x, 2.2, spot.y], [spot.ny, 0, -spot.nx], 2, [spot.nx, 0, spot.ny], STENCIL_PLATES + i, 0.5);
    });
}

/** A slanted keyboard on each bridge console: low toward the middle of the bridge, rising to the back, lit from within. */
function addKeyboards(b: Builder)
{
    for (const c of BRIDGE_CONSOLES)
    {
        b.room = roomAt(c.x, c.y) ?? null;
        const cs = Math.cos(c.yaw);
        const sn = Math.sin(c.yaw);
        // `u` runs along the console, `v` toward the middle of the bridge
        const corner = (u: number, v: number, up: number): V3 => [c.x + u * cs - v * sn, up, c.y + u * sn + v * cs];
        const top = c.z0 + c.h;
        const [hw, hd] = [c.w / 2 - 0.25, c.d / 2 - 0.1];
        const q: [V3, V3, V3, V3] = [corner(-hw, hd, top + 0.02), corner(hw, hd, top + 0.02), corner(hw, -hd, top + 0.2), corner(-hw, -hd, top + 0.2)];
        const e1: V3 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]];
        const e2: V3 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
        let n: V3 = [e2[1] * e1[2] - e2[2] * e1[1], e2[2] * e1[0] - e2[0] * e1[2], e2[0] * e1[1] - e2[1] * e1[0]];
        if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
        const l = Math.hypot(...n);
        b.quad(q, [n[0] / l, n[1] / l, n[2] / l], [[0, 0], [hw * 2, 0], [hw * 2, hd * 2], [0, hd * 2]], MAT.frame, 0.45);
    }
}

export function buildMesh(): Mesh
{
    const b = new Builder();
    for (const room of ROOMS)
    {
        addRoom(b, room);
        if (room.zone === 'pasillo') addCorridor(b, room);
    }
    addHazard(b);
    addStencils(b);
    addKeyboards(b);
    for (const p of PROPS) addProp(b, p);
    for (const s of SCREENS) addScreen(b, s);
    addDoors(b);
    for (const l of LIGHTS)
    {
        const room = roomAt(l.x, l.y);
        if (room && Math.abs(l.z - (room.height - 0.3)) < 1e-6) addLamp(b, l, room);
    }
    return { data: new Float32Array(b.data), vertices: b.data.length / STRIDE };
}
