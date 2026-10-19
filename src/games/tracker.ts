export const SECTORS = 6;
export const MAX_DOORS = 3;
const DOOR_RECHARGE_MS = 8000;
const DRIFT_MS = 4000;

export type Rng = () => number;

export interface TrackerState
{
    phase: 'playing' | 'lost';
    /** Sector the alien is in (0-5). */
    sector: number;
    /** 1 = far, 0 = reached you. */
    dist: number;
    doors: number;
    doorTimerMs: number;
    pingTimerMs: number;
    driftTimerMs: number;
    /** What the last ping showed. */
    ping: { sector: number; dist: number } | null;
    pingAgeMs: number;
    /** Alien repelled so far. */
    score: number;
}

export type TrackerEvent = 'ping' | 'lost';

export function newGame(rng: Rng): TrackerState
{
    return {
        phase: 'playing', sector: Math.floor(rng() * SECTORS), dist: 1, doors: MAX_DOORS,
        doorTimerMs: 0, pingTimerMs: 600, driftTimerMs: DRIFT_MS, ping: null, pingAgeMs: 0, score: 0,
    };
}

/** Distance covered per second; it speeds up with each alien repelled. */
export function alienSpeed(score: number) { return 0.07 + 0.012 * score; }

/** The closer the alien, the faster the pings. */
export function pingInterval(dist: number) { return 500 + 2500 * Math.min(1, Math.max(0, dist)); }

export function step(s: TrackerState, dtMs: number, rng: Rng): { state: TrackerState; events: TrackerEvent[] }
{
    if (s.phase !== 'playing') return { state: s, events: [] };

    const events: TrackerEvent[] = [];
    const next: TrackerState = { ...s };

    next.dist = s.dist - alienSpeed(s.score) * dtMs / 1000;
    if (next.dist <= 0)
    {
        next.dist = 0;
        next.phase = 'lost';
        return { state: next, events: ['lost'] };
    }

    next.pingAgeMs = s.pingAgeMs + dtMs;

    next.driftTimerMs = s.driftTimerMs - dtMs;
    if (next.driftTimerMs <= 0)
    {
        next.driftTimerMs = DRIFT_MS;
        if (rng() < 0.5) next.sector = (s.sector + (rng() < 0.5 ? 1 : SECTORS - 1)) % SECTORS;
    }

    next.pingTimerMs = s.pingTimerMs - dtMs;
    if (next.pingTimerMs <= 0)
    {
        next.pingTimerMs = pingInterval(next.dist);
        next.ping = { sector: next.sector, dist: next.dist };
        next.pingAgeMs = 0;
        events.push('ping');
    }

    if (s.doors < MAX_DOORS)
    {
        next.doorTimerMs = s.doorTimerMs + dtMs;
        if (next.doorTimerMs >= DOOR_RECHARGE_MS)
        {
            next.doorTimerMs = 0;
            next.doors = s.doors + 1;
        }
    }

    return { state: next, events };
}

/** Seal a sector's door. Hits push the alien back and pick a new sector; any seal spends a door. */
export function seal(s: TrackerState, sector: number, rng: Rng): { state: TrackerState; result: 'hit' | 'miss' | 'none' }
{
    if (s.phase !== 'playing' || s.doors <= 0) return { state: s, result: 'none' };

    const spent = { ...s, doors: s.doors - 1 };
    if (s.sector !== sector) return { state: spent, result: 'miss' };

    return {
        state: { ...spent, score: s.score + 1, dist: 1, sector: Math.floor(rng() * SECTORS), ping: null, pingTimerMs: 800 },
        result: 'hit',
    };
}
