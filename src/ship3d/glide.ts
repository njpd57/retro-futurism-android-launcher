import { collides } from './collide';
import { yawOf } from './math';
import { collisionSegments, PORTALS, ROOMS, roomAt, splitEdge, type Portal, type Seg, type V2 } from './world';

/**
 * Where the minimap takes the camera: each room has a spot to stand, and a route of straight legs through the
 * doorways that keeps clear of crates, columns and walls. Pure.
 */

/** Where the camera ends up in each room (the hub and the eight rooms the data lives in). */
export const STANDS: Readonly<Record<string, V2>> = {
    hub: [2, 2],
    puente: [0, -12.5],
    comms: [-15, 0],
    enfermeria: [15, 0],
    bodega: [0, 18.6],
    comedor: [-19.5, 18.6],
    hipersueno: [23, 18.6],
    motor: [0, 35.4],
    hangar: [0, 56],
};

/** Points to route round what stands in the way of a straight leg inside a room. */
const VIAS: Readonly<Record<string, readonly V2[]>> = {
    hub: [[2.3, 2.3], [-2.3, 2.3], [2.3, -2.3], [-2.3, -2.3]],
    bodega: [[0, 18.6]],
    motor: [[-4.2, 39.6], [4.2, 39.6]],
};

/** Body radius used to judge a leg clear. */
const CLEAR_RADIUS = 0.3;

const SEGS: readonly Seg[] = collisionSegments();

/** Whether a body can walk the straight line from `a` to `b`. */
export function clear(a: V2, b: V2, segs: readonly Seg[] = SEGS): boolean
{
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / 0.25));
    for (let i = 0; i <= steps; i++)
    {
        const t = i / steps;
        if (collides(segs, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, CLEAR_RADIUS)) return false;
    }
    return true;
}

interface Link { portal: Portal; rooms: [string, string] }

let links: Link[] | null = null;

/** Which two rooms each doorway joins. */
function portalLinks(): Link[]
{
    links ??= PORTALS.map(portal => ({
        portal,
        rooms: ROOMS.filter(r => r.poly.some((_, i) => splitEdge(r, i).doors.some(d => d.portal === portal))).map(r => r.id) as [string, string],
    }));
    return links;
}

/** The doorways to pass, in order, to get from one room to another; null when there is no way. */
export function roomPath(from: string, to: string): { portal: Portal; room: string }[] | null
{
    if (from === to) return [];
    const came = new Map<string, { portal: Portal; from: string }>();
    const queue = [from];
    for (let head = 0; head < queue.length; head++)
    {
        const at = queue[head];
        for (const l of portalLinks())
        {
            if (!l.rooms.includes(at)) continue;
            const next = l.rooms[0] === at ? l.rooms[1] : l.rooms[0];
            if (next === from || came.has(next)) continue;
            came.set(next, { portal: l.portal, from: at });
            if (next === to)
            {
                const path: { portal: Portal; room: string }[] = [];
                for (let r = to; r !== from; r = came.get(r)!.from) path.unshift({ portal: came.get(r)!.portal, room: r });
                return path;
            }
            queue.push(next);
        }
    }
    return null;
}

/** A leg inside one room from `a` to `b`, routed through a via point if the straight line is blocked. */
function leg(a: V2, b: V2, room: string): V2[]
{
    if (clear(a, b)) return [b];
    for (const v of VIAS[room] ?? []) if (clear(a, v) && clear(v, b)) return [v, b];
    return [b];
}

/** The waypoints from `(x, y)` to the stand of `target`, starting at the point itself; null if it can't be done. */
export function glideRoute(x: number, y: number, target: string): V2[] | null
{
    const stand = STANDS[target];
    const start = roomAt(x, y)?.id;
    if (!stand || !start) return null;
    const path = roomPath(start, target);
    if (!path) return null;

    const route: V2[] = [[x, y]];
    let at: V2 = [x, y];
    const rooms = [start, ...path.map(p => p.room)];
    rooms.forEach((room, i) =>
    {
        const out = i < path.length ? path[i].portal : null;
        const goal: V2 = out ? [out.x, out.y] : stand;
        // the first leg starts where the camera is; later ones at the doorway just passed
        for (const p of leg(at, goal, room)) route.push(p);
        at = goal;
        if (out) route.push(at);
        // step through the doorway to the room beyond: its centre line is the same point
    });
    return route.filter((p, i) => i === 0 || Math.hypot(p[0] - route[i - 1][0], p[1] - route[i - 1][1]) > 1e-6);
}

export const routeLength = (route: readonly V2[]) =>
    route.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p[0] - route[i - 1][0], p[1] - route[i - 1][1])), 0);

/** The point `s` metres along a route, and the way it is heading there. */
export function pointAt(route: readonly V2[], s: number): { x: number; y: number; yaw: number }
{
    let left = Math.max(0, s);
    for (let i = 1; i < route.length; i++)
    {
        const dx = route[i][0] - route[i - 1][0];
        const dy = route[i][1] - route[i - 1][1];
        const len = Math.hypot(dx, dy);
        if (left <= len || i === route.length - 1)
        {
            const k = len === 0 ? 1 : Math.min(1, left / len);
            return { x: route[i - 1][0] + dx * k, y: route[i - 1][1] + dy * k, yaw: yawOf(dx, dy) };
        }
        left -= len;
    }
    return { x: route[0][0], y: route[0][1], yaw: 0 };
}

/** Metres per second the camera glides at. */
export const GLIDE_SPEED = 9;
