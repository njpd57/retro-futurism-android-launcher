import { labelUv } from '../atlas';
import { STENCIL_PLATES, STENCILS } from '../labels';
import type { V3 } from '../math';
import { BRIDGE_CONSOLES, PORTALS, portalAxis, roomAt, ROOMS, SCREENS, splitEdge, type Room, type Zone } from '../world';
import { MAT, Builder } from './builder';

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

/** Chevrons on the floor on both faces of the doorways of the working rooms. */
export function addHazard(b: Builder)
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

export function addStencils(b: Builder)
{
    STENCILS.forEach((s, i) =>
    {
        const room = ROOMS.find(r => r.id === s.room);
        const spot = room && stencilSpot(room);
        if (spot) plate(b, [spot.x, 2.2, spot.y], [spot.ny, 0, -spot.nx], 2, [spot.nx, 0, spot.ny], STENCIL_PLATES + i, 0.5);
    });
}

/** A slanted keyboard on each bridge console: low toward the middle of the bridge, rising to the back, lit from within. */
export function addKeyboards(b: Builder)
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
