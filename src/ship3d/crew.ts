import { glideRoute, pointAt, routeLength, STANDS } from './glide';
import type { V2 } from './world';

/** Who is aboard: a crew member per app with notifications waiting, the starred contacts, Jones and the android. */
export type AgentKind = 'signal' | 'contact' | 'cat' | 'android';

export interface Agent { id: string; kind: AgentKind; x: number; y: number; yaw: number }

interface Slot { x: number; y: number; yaw: number }

/** Where the crew of the signals stand in COMMS, facing their desks. */
export const SIGNAL_SLOTS: readonly Slot[] = [
    { x: -19.2, y: 3.4, yaw: Math.PI }, { x: -17, y: 3.4, yaw: Math.PI }, { x: -14.8, y: 3.4, yaw: Math.PI },
    { x: -19.2, y: -3.4, yaw: 0 }, { x: -17, y: -3.4, yaw: 0 }, { x: -14.8, y: -3.4, yaw: 0 },
];

/** Where the starred contacts wait in the mess: at their bunks. */
export const BUNK_SLOTS: readonly Slot[] = [
    { x: -27.1, y: 15, yaw: Math.PI / 2 }, { x: -27.1, y: 18.6, yaw: Math.PI / 2 }, { x: -27.1, y: 22, yaw: Math.PI / 2 },
    { x: -25.2, y: 22.4, yaw: Math.PI * 1.5 },
];

/** The ones that stay put: one per signal and per starred contact, as many as there are places for. */
export function stationaryAgents(signals: number, contacts: number): Agent[]
{
    const out: Agent[] = [];
    SIGNAL_SLOTS.slice(0, Math.max(0, signals)).forEach((s, i) => out.push({ id: `signal${i}`, kind: 'signal', ...s }));
    BUNK_SLOTS.slice(0, Math.max(0, contacts)).forEach((s, i) => out.push({ id: `contact${i}`, kind: 'contact', ...s }));
    return out;
}

/** A character that wanders: it waits where it is, then walks to another room. */
export interface Roamer
{
    id: string;
    kind: 'cat' | 'android';
    x: number;
    y: number;
    yaw: number;
    /** the room it is in or heading to */
    room: string;
    route: V2[] | null;
    /** metres done and total of the route */
    s: number;
    length: number;
    /** seconds left standing */
    wait: number;
    speed: number;
    /** where it may go */
    pool: readonly string[];
}

export function newRoamers(): Roamer[]
{
    const at = (room: string) => ({ x: STANDS[room][0], y: STANDS[room][1] });
    return [
        { id: 'jones', kind: 'cat', ...at('comedor'), yaw: 0, room: 'comedor', route: null, s: 0, length: 0, wait: 1, speed: 2.4, pool: ['comedor', 'hub', 'bodega', 'hipersueno', 'puente', 'enfermeria'] },
        { id: 'ash', kind: 'android', ...at('hub'), yaw: 0, room: 'hub', route: null, s: 0, length: 0, wait: 3, speed: 1.7, pool: ['puente', 'hub', 'comms', 'enfermeria', 'bodega', 'motor', 'hangar'] },
    ];
}

/** One step of `dt` seconds; `rng` gives 0..1. Pure: returns the next state. */
export function stepRoamer(r: Roamer, dt: number, rng: () => number): Roamer
{
    if (r.route)
    {
        const s = r.s + r.speed * dt;
        const at = pointAt(r.route, s);
        if (s >= r.length) return { ...r, x: at.x, y: at.y, yaw: at.yaw, route: null, s: 0, length: 0, wait: 2 + rng() * 6 };
        return { ...r, x: at.x, y: at.y, yaw: at.yaw, s };
    }
    if (r.wait > dt) return { ...r, wait: r.wait - dt };

    const options = r.pool.filter(room => room !== r.room);
    const target = options[Math.floor(rng() * options.length) % options.length];
    const route = glideRoute(r.x, r.y, target);
    if (!route || route.length < 2) return { ...r, wait: 2 };
    return { ...r, room: target, route, s: 0, length: routeLength(route), wait: 0 };
}

export const agentsOf = (stay: readonly Agent[], roamers: readonly Roamer[]): Agent[] =>
    [...stay, ...roamers.map((r): Agent => ({ id: r.id, kind: r.kind, x: r.x, y: r.y, yaw: r.yaw }))];
