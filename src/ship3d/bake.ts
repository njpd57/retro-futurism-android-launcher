import type { V3 } from './math';
import { LIGHTS, onWorldChange, PROPS, propOutline, roomAt, type Light, type Room, type V2 } from './world';

/**
 * Light and occlusion baked into the vertices of the ship. Nothing here is computed per frame: every vertex gets how
 * much ambient light it misses (`ao`, 1 = open air, lower in corners and under things), how much light the lamps of
 * its own room give it (`lit`) and where that light mostly comes from (`dir`, a unit vector). With the direction, the
 * shader can light a normal-mapped surface from the baked light, so the relief shows without any light per frame.
 * Smooth values on a mesh cut into small cells are stable when the camera moves, which is exactly what thin
 * procedural lines were not. Pure.
 */

const smooth = (a: number, b: number, x: number) =>
{
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number
{
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

interface RoomBake { edges: [V2, V2][]; solids: V2[][]; lights: Light[] }

const cache = new Map<string, RoomBake>();
onWorldChange(() => cache.clear());

function bakeOf(room: Room): RoomBake
{
    let b = cache.get(room.id);
    if (!b)
    {
        b = {
            edges: room.poly.map((p, i): [V2, V2] => [p, room.poly[(i + 1) % room.poly.length]]),
            solids: PROPS.filter(p => p.solid && roomAt(p.x, p.y)?.id === room.id).map(p => propOutline(p, 10)),
            lights: LIGHTS.filter(l => roomAt(l.x, l.y)?.id === room.id),
        };
        cache.set(room.id, b);
    }
    return b;
}

/** Distance in the plan from a point to the nearest outline in `shapes`. */
function outlineDist(x: number, y: number, shapes: readonly V2[][]): number
{
    let d = Infinity;
    for (const o of shapes)
        for (let i = 0; i < o.length; i++)
        {
            const [a, b] = [o[i], o[(i + 1) % o.length]];
            d = Math.min(d, segDist(x, y, a[0], a[1], b[0], b[1]));
        }
    return d;
}

/** What a vertex gets: occlusion, lamp light (not yet turned by the surface) and the way it comes from. */
export interface Baked { ao: number; lit: number; dir: V3 }

/** Occlusion and lamp light of the vertex at `(x, up, y)` with normal `n`, in `room`; open air and no light without a room. */
export function bakeVertex(room: Room | null, x: number, up: number, y: number, n: V3): Baked
{
    if (!room) return { ao: 1, lit: 0, dir: [0, 1, 0] };
    const r = bakeOf(room);

    let nearest = Infinity;
    let nearestOther = Infinity;
    let touching = 0;
    for (const [a, b] of r.edges)
    {
        const d = segDist(x, y, a[0], a[1], b[0], b[1]);
        nearest = Math.min(nearest, d);
        if (d < 1e-3) touching++; else nearestOther = Math.min(nearestOther, d);
    }

    let ao = 1;
    if (Math.abs(n[1]) > 0.5)
    {
        // a floor, a ceiling or the top of something: dark where it meets a wall, and on the floor under and around things
        ao *= 0.3 + 0.7 * smooth(0, 2.2, nearest);
        if (up < 0.05 && n[1] > 0) ao *= 0.4 + 0.6 * smooth(0, 1.4, outlineDist(x, y, r.solids));
    }
    else
    {
        // a wall or the side of something: dark where it meets the floor, the ceiling and a corner
        ao *= 0.45 + 0.55 * smooth(0, 2.0, touching >= 2 ? 0 : nearestOther);
        ao *= 0.35 + 0.65 * smooth(0, 1.4, up);
        ao *= 0.55 + 0.45 * smooth(0, 1.2, room.height - up);
    }

    // the lamps of this room, falling off the same way the shader's own lights do; a lamp hung high in a tall room is
    // made stronger so the floor of the cargo hold is not left in the dark
    const reach = Math.pow(Math.max(1, room.height / 4), 1.5);
    let lit = 0;
    const sum: V3 = [0, 0, 0];
    for (const l of r.lights)
    {
        const to: V3 = [l.x - x, l.z - up, l.y - y];
        const d2 = to[0] * to[0] + to[1] * to[1] + to[2] * to[2];
        const w = (l.power * reach) / (1 + 0.3 * d2);
        const len = Math.sqrt(d2) || 1;
        lit += w;
        sum[0] += (w * to[0]) / len;
        sum[1] += (w * to[1]) / len;
        sum[2] += (w * to[2]) / len;
    }
    // no lamp near: the light comes from above, like the ceiling's
    const m = Math.hypot(...sum);
    const dir: V3 = m < 1e-6 ? [0, 1, 0] : [sum[0] / m, sum[1] / m, sum[2] / m];
    void n;
    return { ao, lit, dir };
}
