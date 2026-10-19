export type Rng = () => number;

/** The systems the player shares power between. */
export const SYSTEMS = ['PUERTAS', 'SOPORTE VITAL', 'SENSORES'] as const;
export const POWER = 6;
export const MAX_LEVEL = 4;
const DAMAGE_PER_UNIT_S = 9;
const REPAIR_PER_S = 3;
const NEED_INTERVAL_MS = 7000;
const MIN_NEED_INTERVAL_MS = 3000;

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
}

export type RerouteEvent = 'demand' | 'lost';

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

export function step(s: RerouteState, dtMs: number, rng: Rng): { state: RerouteState; events: RerouteEvent[] }
{
    if (s.phase !== 'playing') return { state: s, events: [] };

    const events: RerouteEvent[] = [];
    const dt = dtMs / 1000;
    const integrity = s.integrity.map((value, i) =>
    {
        const deficit = Math.max(0, s.need[i] - s.alloc[i]);
        const next = deficit > 0 ? value - deficit * DAMAGE_PER_UNIT_S * dt : value + REPAIR_PER_S * dt;
        return Math.min(100, Math.max(0, next));
    });

    const next: RerouteState = { ...s, integrity, elapsedMs: s.elapsedMs + dtMs, needTimerMs: s.needTimerMs - dtMs };

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

    return { state: next, events };
}

export const score = (s: RerouteState) => Math.floor(s.elapsedMs / 1000);
