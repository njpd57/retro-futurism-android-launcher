import type { Agent } from './crew';
import { rayCylinder, rayFromPixel, rayRect, type V3 } from './math';
import { screenFrame } from './mesh';
import { collisionSegments, ROOMS, SCREENS, type Bay, type ScreenDef, type Seg } from './world';

/** Walls only (no props): a monitor can be seen over a crate, never through a wall. */
const WALLS: readonly Seg[] = collisionSegments(ROOMS, []);

/** How far the bezel reaches past the picture and still counts as the monitor. */
const BEZEL = 0.12;

/** Distance along a unit plan direction to a segment, or null. */
function raySegment(ox: number, oy: number, dx: number, dy: number, s: Seg): number | null
{
    const ex = s.bx - s.ax;
    const ey = s.by - s.ay;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((s.ax - ox) * ey - (s.ay - oy) * ex) / denom;
    const u = ((s.ax - ox) * dy - (s.ay - oy) * dx) / denom;
    return t > 0 && u >= 0 && u <= 1 ? t : null;
}

/** Distance along a 3D ray to the nearest wall (the walls are as tall as the ship), `Infinity` if none. */
function wallDistance(o: V3, d: V3): number
{
    const hor = Math.hypot(d[0], d[2]);
    if (hor < 1e-9) return Infinity;
    let best = Infinity;
    for (const s of WALLS)
    {
        const t = raySegment(o[0], o[2], d[0] / hor, d[2] / hor, s);
        if (t !== null) best = Math.min(best, t / hor);
    }
    return best;
}

export interface ScreenPick { screen: ScreenDef; distance: number }

/** The nearest monitor under pixel (px, py) of a `w` x `h` view, from `eye`, or null. Walls hide what is behind them. */
export function pickScreen(eye: V3, yaw: number, pitch: number, w: number, h: number, px: number, py: number): ScreenPick | null
{
    const ray = rayFromPixel(eye, yaw, pitch, w, h, px, py);
    const wall = wallDistance(ray.o, ray.d);
    let best: ScreenPick | null = null;
    for (const s of SCREENS)
    {
        const f = screenFrame(s);
        // seen from behind: not that monitor's picture
        if (ray.d[0] * f.normal[0] + ray.d[1] * f.normal[1] + ray.d[2] * f.normal[2] >= 0) continue;
        const t = rayRect(ray, f.center, f.normal, f.right, f.up, s.w / 2 + BEZEL, s.h / 2 + BEZEL);
        if (t === null || t > wall + 0.05) continue;
        if (!best || t < best.distance) best = { screen: s, distance: t };
    }
    return best;
}

/** Monitors can be used from this far. */
export const REACH = 4.2;

export interface AgentPick { agent: Agent; distance: number }

/** The nearest person or cat under pixel (px, py), or null; walls hide them like monitors. */
export function pickAgent(agents: readonly Agent[], eye: V3, yaw: number, pitch: number, w: number, h: number, px: number, py: number): AgentPick | null
{
    const ray = rayFromPixel(eye, yaw, pitch, w, h, px, py);
    const wall = wallDistance(ray.o, ray.d);
    let best: AgentPick | null = null;
    for (const a of agents)
    {
        const small = a.kind === 'cat';
        const t = rayCylinder(ray, a.x, a.y, small ? 0.45 : 0.4, 0, small ? 0.5 : a.kind === 'android' ? 2.2 : 1.8);
        if (t === null || t > wall + 0.05) continue;
        if (!best || t < best.distance) best = { agent: a, distance: t };
    }
    return best;
}

export interface BayPick { index: number; distance: number }

/** The nearest shuttle under pixel (px, py), by its index in `bays`, or null. */
export function pickShuttle(bays: readonly Bay[], eye: V3, yaw: number, pitch: number, w: number, h: number, px: number, py: number): BayPick | null
{
    const ray = rayFromPixel(eye, yaw, pitch, w, h, px, py);
    const wall = wallDistance(ray.o, ray.d);
    let best: BayPick | null = null;
    bays.forEach((bay, index) =>
    {
        const t = rayCylinder(ray, bay.x, bay.y, 1.7, 0, bay.prop.z0 + bay.prop.h + 0.6);
        if (t === null || t > wall + 0.05) return;
        if (!best || t < best.distance) best = { index, distance: t };
    });
    return best;
}
