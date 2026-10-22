import { slotUv, SLOT } from './atlas';
import type { V3 } from './math';
import { centroid, LIGHTS, PORTALS, portalAxis, PROPS, propOutline, roomAt, ROOMS, SCREENS, splitEdge, type Light, type Prop, type Room, type ScreenDef, type V2 } from './world';

/**
 * The ship baked into one triangle list. Built once and uploaded to the GPU: a frame only moves the camera.
 * Vertices are `x, up, z` in GL space (`z` is the plan's `y`), a normal, a texture coordinate, a material and how
 * much the surface shines by itself. No culling is used, so winding doesn't matter.
 */

export const STRIDE = 10;

export const MAT = { wall: 0, floor: 1, ceiling: 2, prop: 3, screen: 4, glow: 5, frame: 6, crew: 7, door: 8, label: 9 } as const;

export interface Mesh { data: Float32Array; vertices: number }

export class Builder
{
    data: number[] = [];

    vertex(x: number, up: number, y: number, n: V3, u: number, v: number, mat: number, emit: number)
    {
        this.data.push(x, up, y, n[0], n[1], n[2], u, v, mat, emit);
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

function addRoom(b: Builder, room: Room)
{
    const h = room.height;
    // floor and ceiling as fans
    for (let i = 1; i < room.poly.length - 1; i++)
    {
        const [p0, p1, p2] = [room.poly[0], room.poly[i], room.poly[i + 1]];
        b.tri([p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p2[0], 0, p2[1]], [0, 1, 0], MAT.floor, 0);
        b.tri([p0[0], h, p0[1]], [p1[0], h, p1[1]], [p2[0], h, p2[1]], [0, -1, 0], MAT.ceiling, 0);
    }

    for (let i = 0; i < room.poly.length; i++)
    {
        const e = splitEdge(room, i);
        const at = (t: number, o = 0): V2 => [e.ax + e.dx * t + e.nx * o, e.ay + e.dy * t + e.ny * o];
        const n: V3 = [e.nx, 0, e.ny];
        for (const [from, to] of e.walls)
        {
            const [p0, p1] = [at(from), at(to)];
            b.quad([[p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], h, p1[1]], [p0[0], h, p0[1]]], n, [[from, 0], [to, 0], [to, h], [from, h]], MAT.wall, 0);
        }
        for (const d of e.doors)
        {
            const top = d.portal.height;
            if (h > top + 0.01)
            {
                const [p0, p1] = [at(d.from), at(d.to)];
                b.quad([[p0[0], top, p0[1]], [p1[0], top, p1[1]], [p1[0], h, p1[1]], [p0[0], h, p0[1]]], n, [[d.from, top], [d.to, top], [d.to, h], [d.from, h]], MAT.wall, 0);
            }
            // two posts and a beam
            const post = (t0: number, t1: number) => extrude(b, [at(t0), at(t1), at(t1, 0.35), at(t0, 0.35)], 0, top, MAT.frame, 0.2);
            post(d.from, d.from + 0.2);
            post(d.to - 0.2, d.to);
            extrude(b, [at(d.from), at(d.to), at(d.to, 0.35), at(d.from, 0.35)], top - 0.2, top, MAT.frame, 0.2);
        }
    }
}

function addProp(b: Builder, p: Prop)
{
    extrude(b, propOutline(p, p.kind === 'cyl' ? 16 : 4), p.z0, p.z0 + p.h, p.glow > 0 ? MAT.glow : MAT.prop, p.glow);
}

/** A monitor: its picture from the atlas on a dark bezel. */
function addScreen(b: Builder, s: ScreenDef)
{
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

export function buildMesh(): Mesh
{
    const b = new Builder();
    for (const room of ROOMS) addRoom(b, room);
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
