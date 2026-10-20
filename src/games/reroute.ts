export type Rng = () => number;

/** The systems the player shares power between. */
export const SYSTEMS = ['PUERTAS', 'SOPORTE VITAL', 'SENSORES'] as const;
export const POWER = 6;
export const MAX_LEVEL = 4;
const DAMAGE_PER_UNIT_S = 9;
const REPAIR_PER_S = 3;
const NEED_INTERVAL_MS = 7000;
const MIN_NEED_INTERVAL_MS = 3000;
// ship incidents, on top of the changing demands
const FIRST_INCIDENT_MS = 15000;
const MIN_INCIDENT_GAP_MS = 8000;
const DOOR_FAULT_LOSS = 25;
/** a door fault never kills by itself: it leaves at least this much */
const DOOR_FAULT_FLOOR = 5;
const SENSOR_ALARM_MS = 8000;
const VENT_LEAK_MS = 10000;
const LEAK_DAMAGE_FACTOR = 2;

export interface RerouteState
{
    phase: 'playing' | 'lost';
    /** power given to each system */
    alloc: number[];
    /** power each system is asking for right now */
    need: number[];
    /** 0-100 */
    integrity: number[];
    needTimerMs: number;
    elapsedMs: number;
    /** time until the next incident */
    incidentTimerMs: number;
    /** SENSORES asks for double while this is above 0 (a sensor alarm) */
    sensorAlarmMs: number;
    /** SOPORTE VITAL takes more damage and does not repair while this is above 0 (a vent leak) */
    ventLeakMs: number;
}

export type RerouteEvent = 'demand' | 'lost' | 'doorFault' | 'sensorAlarm' | 'ventLeak';

const INCIDENTS = ['doorFault', 'sensorAlarm', 'ventLeak'] as const;
const DOORS = 0, LIFE = 1, SENSORS = 2;

/** Power each system asks for now: the demand, with SENSORES doubled (at least 2) during a sensor alarm. */
export function effectiveNeed(s: RerouteState): number[]
{
    if (s.sensorAlarmMs <= 0) return s.need;
    return s.need.map((n, i) => i === SENSORS ? Math.min(MAX_LEVEL, Math.max(2, n * 2)) : n);
}

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);

/** Demands between 0 and MAX_LEVEL whose total is a little above or below the available power, so something always has to give. */
export function pickNeeds(rng: Rng): number[]
{
    for (let attempt = 0; attempt < 30; attempt++)
    {
        const need = SYSTEMS.map(() => Math.floor(rng() * (MAX_LEVEL + 1)));
        const total = sum(need);
        if (total >= POWER - 1 && total <= POWER + 3) return need;
    }
    return [2, 2, 2];
}

export function newGame(rng: Rng): RerouteState
{
    return {
        phase: 'playing', alloc: [2, 2, 2], need: pickNeeds(rng), integrity: SYSTEMS.map(() => 100),
        needTimerMs: NEED_INTERVAL_MS, elapsedMs: 0,
        incidentTimerMs: FIRST_INCIDENT_MS + rng() * 5000, sensorAlarmMs: 0, ventLeakMs: 0,
    };
}

/** Gives (+1) or takes (-1) one unit of power; ignored when it would break a limit. */
export function adjust(s: RerouteState, system: number, delta: 1 | -1): RerouteState
{
    if (s.phase !== 'playing' || system < 0 || system >= SYSTEMS.length) return s;
    const level = s.alloc[system] + delta;
    if (level < 0 || level > MAX_LEVEL || sum(s.alloc) + delta > POWER) return s;
    return { ...s, alloc: s.alloc.map((a, i) => i === system ? level : a) };
}

export const freePower = (s: RerouteState) => POWER - sum(s.alloc);

/** Demands change faster the longer you survive. */
export function needInterval(elapsedMs: number)
{
    return Math.max(MIN_NEED_INTERVAL_MS, NEED_INTERVAL_MS - elapsedMs / 25);
}

/** Time to the next incident: they come closer together as the run goes on. */
export function incidentInterval(elapsedMs: number, rng: Rng)
{
    return Math.max(MIN_INCIDENT_GAP_MS, 20000 - elapsedMs / 30) + rng() * 6000;
}

export function step(s: RerouteState, dtMs: number, rng: Rng): { state: RerouteState; events: RerouteEvent[] }
{
    if (s.phase !== 'playing') return { state: s, events: [] };

    const events: RerouteEvent[] = [];
    const dt = dtMs / 1000;
    const need = effectiveNeed(s);
    const leaking = s.ventLeakMs > 0;
    const integrity = s.integrity.map((value, i) =>
    {
        const deficit = Math.max(0, need[i] - s.alloc[i]);
        const factor = leaking && i === LIFE ? LEAK_DAMAGE_FACTOR : 1;
        // a leak keeps life support from recovering, and bleeds it a little even when it has all the power it asks for
        const next = deficit > 0 ? value - deficit * DAMAGE_PER_UNIT_S * factor * dt : leaking && i === LIFE ? value - 1 * dt : value + REPAIR_PER_S * dt;
        return Math.min(100, Math.max(0, next));
    });

    const next: RerouteState = {
        ...s, integrity, elapsedMs: s.elapsedMs + dtMs, needTimerMs: s.needTimerMs - dtMs,
        incidentTimerMs: s.incidentTimerMs - dtMs,
        sensorAlarmMs: Math.max(0, s.sensorAlarmMs - dtMs),
        ventLeakMs: Math.max(0, s.ventLeakMs - dtMs),
    };

    if (integrity.some(v => v <= 0))
    {
        next.phase = 'lost';
        return { state: next, events: ['lost'] };
    }

    if (next.needTimerMs <= 0)
    {
        next.need = pickNeeds(rng);
        next.needTimerMs = needInterval(next.elapsedMs);
        events.push('demand');
    }

    if (next.incidentTimerMs <= 0)
    {
        const incident = INCIDENTS[Math.min(INCIDENTS.length - 1, Math.floor(rng() * INCIDENTS.length))];
        next.incidentTimerMs = incidentInterval(next.elapsedMs, rng);
        if (incident === 'doorFault') next.integrity = next.integrity.map((v, i) => i === DOORS ? Math.max(Math.min(v, DOOR_FAULT_FLOOR), v - DOOR_FAULT_LOSS) : v);
        else if (incident === 'sensorAlarm') next.sensorAlarmMs = SENSOR_ALARM_MS;
        else next.ventLeakMs = VENT_LEAK_MS;
        events.push(incident);
    }

    return { state: next, events };
}

export const score = (s: RerouteState) => Math.floor(s.elapsedMs / 1000);
