import { roomPath } from './glide';
import { wrapAngle, yawOf } from './math';
import { centroid, PORTALS, roomAt, ROOMS, type Room, type V2, type Zone } from './world';

/**
 * What the ship sounds like from where the camera stands: every room hums in its own way, and what reaches you
 * depends on how far it is, how many doorways are in between and whether those are open. Pure: `audio/shipAmbient.ts`
 * turns the numbers into sound.
 */

export type Wave = 'sine' | 'sawtooth' | 'square' | 'triangle';
export type Filter = 'lowpass' | 'highpass' | 'bandpass';

/** The continuous sound of a room: a tone, a band of noise, and how much both swell and fade. */
export interface Voice
{
    /** loudness of the whole voice when it is right next to you, 0..1 */
    level: number;
    tone?: { freq: number; wave: Wave; gain: number };
    hush?: { filter: Filter; freq: number; q: number; gain: number };
    /** the amplitude breathes `hz` times a second by up to `depth` (0..0.5) */
    wobble?: { hz: number; depth: number };
}

export const VOICES: Readonly<Record<Zone, Voice>> = {
    // relays and telemetry: a thin tone over a hiss
    puente: { level: 0.5, tone: { freq: 164, wave: 'sine', gain: 0.35 }, hush: { filter: 'highpass', freq: 4200, q: 0.7, gain: 0.25 } },
    // radio static
    comms: { level: 0.55, hush: { filter: 'bandpass', freq: 3000, q: 2, gain: 0.5 }, wobble: { hz: 3.1, depth: 0.35 } },
    // the reactor: a deep, slow throb
    motor: { level: 0.9, tone: { freq: 41, wave: 'sawtooth', gain: 0.5 }, hush: { filter: 'lowpass', freq: 220, q: 0.7, gain: 0.6 }, wobble: { hz: 0.7, depth: 0.3 } },
    bodega: { level: 0.5, tone: { freq: 50, wave: 'sine', gain: 0.4 }, hush: { filter: 'lowpass', freq: 320, q: 0.7, gain: 0.3 } },
    enfermeria: { level: 0.35, tone: { freq: 1320, wave: 'sine', gain: 0.05 }, hush: { filter: 'highpass', freq: 6000, q: 0.7, gain: 0.2 } },
    // sleeping breath
    hipersueno: { level: 0.55, hush: { filter: 'bandpass', freq: 420, q: 1, gain: 0.7 }, wobble: { hz: 0.22, depth: 0.5 } },
    // a cold store humming away under the murmur of the crew at the table
    comedor: { level: 0.45, tone: { freq: 100, wave: 'sine', gain: 0.25 }, hush: { filter: 'bandpass', freq: 520, q: 1.2, gain: 0.35 }, wobble: { hz: 0.6, depth: 0.25 } },
    // quiet quarters: the ventilation and little else
    camarotes: { level: 0.3, tone: { freq: 55, wave: 'sine', gain: 0.35 }, hush: { filter: 'lowpass', freq: 200, q: 0.7, gain: 0.2 } },
    // wind through the big doors
    hangar: { level: 0.7, tone: { freq: 60, wave: 'sine', gain: 0.25 }, hush: { filter: 'bandpass', freq: 700, q: 0.8, gain: 0.6 }, wobble: { hz: 0.1, depth: 0.4 } },
    // the corridor you stand in: air in the ducts
    pasillo: { level: 0.5, hush: { filter: 'bandpass', freq: 220, q: 0.9, gain: 0.7 } },
};

/** Metal plates in most rooms, gratings where the floor is open work. */
export type StepKind = 'plate' | 'grate';

export const stepKind = (zone: Zone | undefined): StepKind => (zone === 'motor' || zone === 'pasillo' || zone === 'hangar' || zone === 'bodega' ? 'grate' : 'plate');

export interface Heard { gain: number; pan: number }

/** How much of a sound each doorway between you and it lets through: shut, open. */
const SHUT = 0.3;
const OPEN = 0.85;
/** Distance in metres at which a sound has fallen to half. */
const HALF = 7;

const SOURCES: readonly { room: Room; at: V2 }[] = ROOMS.filter(r => r.zone !== 'pasillo').map(room => ({ room, at: centroid(room.poly) }));

/**
 * What each room's voice sounds like at `(x, y)` looking along `yaw`. The sound reaches you through the doorways on the
 * way, so it comes from the first of them and is softer for every closed one. The corridor you are in is always heard.
 */
export function hear(x: number, y: number, yaw: number, doors: ArrayLike<number>): Record<Zone, Heard>
{
    const out = Object.fromEntries(Object.keys(VOICES).map(z => [z, { gain: 0, pan: 0 }])) as Record<Zone, Heard>;
    const here = roomAt(x, y);
    if (!here) return out;
    if (here.zone === 'pasillo') out.pasillo.gain = 1;

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
