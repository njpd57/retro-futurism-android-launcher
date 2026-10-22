import { STANDS } from './glide';
import { HFOV, wrapAngle, yawOf } from './math';
import type { Level, ScreenReading } from './readings';
import { ROOMS, type RoomId, type Zone } from './world';

/**
 * The strip at the top of the walk: where you are, what that room's monitors say in a word, and the room that wants
 * attention most so a tap takes you there. Pure.
 */

/** The monitors whose first line sums up each room, in the order they are joined. */
const KEY_SCREENS: Readonly<Record<Zone, readonly string[]>> = {
    puente: ['puente.hora', 'puente.clima'],
    comms: ['comms.senales'],
    motor: ['motor.reserva', 'motor.enlace'],
    bodega: ['bodega.almacen'],
    enfermeria: ['enfermeria.sistema'],
    hipersueno: ['hipersueno.alarma'],
    comedor: ['comedor.pista'],
    hangar: ['hangar.flota'],
    hub: [],
    pasillo: [],
};

const NAMES: Readonly<Record<string, string>> = Object.fromEntries(ROOMS.filter(r => r.zone !== 'pasillo').map(r => [r.zone, r.name]));

export const zoneName = (zone: Zone | undefined): string => (zone && NAMES[zone]) || (zone === 'pasillo' ? 'PASILLO' : 'EXTERIOR');

/** `PUENTE · 14:32 · 18 °C`. */
export function hudLine(readings: Readonly<Record<string, ScreenReading>>, zone: Zone | undefined): string
{
    const parts = (zone ? KEY_SCREENS[zone] : []).map(id => readings[id]?.lines[0]).filter((l): l is string => !!l);
    return [zoneName(zone), ...parts].join(' · ');
}

/** The rooms in the order a tie is broken: the ship's data rooms as `ROOMS` lists them. */
const ORDER: readonly RoomId[] = ROOMS.map(r => r.zone).filter((z): z is RoomId => z !== 'hub' && z !== 'pasillo');

export interface AlertRoom { zone: RoomId; name: string; level: Exclude<Level, 'idle'> }

/** The room that wants attention most, other than the one you are in: urgent before notice; null when all is quiet. */
export function nextAlertRoom(levels: Readonly<Record<string, Level>>, here: Zone | undefined): AlertRoom | null
{
    for (const want of ['urgent', 'notice'] as const)
    {
        const zone = ORDER.find(z => z !== here && levels[z] === want);
        if (zone) return { zone, name: zoneName(zone), level: want };
    }
    return null;
}

/** Which way to turn to face a room's standing spot: ahead when it is within `halfFov` of where you look. */
export function turnToward(x: number, y: number, yaw: number, zone: string, halfFov = HFOV / 2): 'left' | 'right' | 'ahead'
{
    const at = STANDS[zone];
    if (!at) return 'ahead';
    const rel = wrapAngle(yawOf(at[0] - x, at[1] - y) - yaw);
    return Math.abs(rel) <= halfFov ? 'ahead' : rel > 0 ? 'right' : 'left';
}
