import { roomPath } from './glide';
import { wrapAngle, yawOf } from './math';
import { centroid, PORTALS, roomAt, ROOMS, type Room, type V2, type Zone } from './world';
import { isHall, ZONES, zoneDef, type Voice } from './zones';

/**
 * What the ship sounds like from where the camera stands: every room hums in its own way, and what reaches you
 * depends on how far it is, how many doorways are in between and whether those are open. Pure: `audio/shipAmbient.ts`
 * turns the numbers into sound.
 */

export type { Wave, Filter, Voice } from './zones';

export const VOICES: Readonly<Record<string, Voice>> = Object.fromEntries(Object.values(ZONES).map(z => [z.id, z.voice]));

/** Metal plates in most rooms, gratings where the floor is open work. */
export type StepKind = 'plate' | 'grate';

export const stepKind = (zone: string | undefined): StepKind => zoneDef(zone)?.step ?? 'plate';

export interface Heard { gain: number; pan: number }

/** How much of a sound each doorway between you and it lets through: shut, open. */
const SHUT = 0.3;
const OPEN = 0.85;
/** Distance in metres at which a sound has fallen to half. */
const HALF = 7;

const SOURCES: readonly { room: Room; at: V2 }[] = ROOMS.filter(r => !isHall(r.zone)).map(room => ({ room, at: centroid(room.poly) }));

/**
 * What each room's voice sounds like at `(x, y)` looking along `yaw`. The sound reaches you through the doorways on the
 * way, so it comes from the first of them and is softer for every closed one. The corridor you are in is always heard.
 */
export function hear(x: number, y: number, yaw: number, doors: ArrayLike<number>): Record<Zone, Heard>
{
    const out = Object.fromEntries(Object.keys(VOICES).map(z => [z, { gain: 0, pan: 0 }])) as Record<Zone, Heard>;
    const here = roomAt(x, y);
    if (!here) return out;
    if (isHall(here.zone)) out[here.zone].gain = 1;

    for (const { room, at } of SOURCES)
    {
        const path = room.id === here.id ? [] : roomPath(here.id, room.id);
        if (!path) continue;
        const points: V2[] = [[x, y], ...path.map(p => [p.portal.x, p.portal.y] as V2), at];
        let dist = 0;
        for (let i = 1; i < points.length; i++) dist += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        let gain = 1 / (1 + (dist / HALF) ** 2);
        for (const { portal } of path) gain *= SHUT + (OPEN - SHUT) * (doors[PORTALS.indexOf(portal)] ?? 0);

        // it comes from the way in; one right on top of you has no side
        const [tx, ty] = points[1];
        const d = Math.hypot(tx - x, ty - y);
        const side = d < 0.5 ? 0 : Math.sin(wrapAngle(yawOf(tx - x, ty - y) - yaw));
        out[room.zone] = { gain, pan: side * 0.85 * Math.min(1, d / 3) };
    }
    return out;
}
