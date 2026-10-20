import { isNight } from './nightShift';

/** The pod only appears when the alarm is this close: a far-off alarm is not tonight's sleep. */
export const STASIS_MAX_AHEAD_MS = 14 * 3_600_000;
/** Time constant of the pod cooling down, and where it settles. */
export const POD_COOL_MS = 20 * 60_000;
export const POD_START_C = 37;
export const POD_FLOOR_C = 4;
/** Milliseconds one column of the heartbeat line stands for. */
export const BEAT_COLUMN_MS = 250;

/** Night, and an alarm set within the next 14 hours: the idle screen becomes a cryo pod counting down to it. */
export function stasisActive(now: Date, alarmAt: number | null, maxAheadMs = STASIS_MAX_AHEAD_MS): boolean
{
    if (alarmAt === null || !isNight(now)) return false;
    const ahead = alarmAt - now.getTime();
    return ahead > 0 && ahead <= maxAheadMs;
}

/** `HH:MM:SS` left until `wakeAt`; zeros once it has passed. */
export function wakeCountdown(nowMs: number, wakeAt: number): string
{
    const total = Math.max(0, Math.ceil((wakeAt - nowMs) / 1000));
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(total / 3600))}:${p(Math.floor(total / 60) % 60)}:${p(total % 60)}`;
}

/** Simulated, slow-changing vital signs of a sleeper: pulse 42-48 and 8-11 breaths a minute. `seed` shifts the phase. */
export function vitals(nowMs: number, seed = 0): { bpm: number; resp: number }
{
    const t = nowMs / 1000 + seed * 97;
    const bpm = 45 + 3 * Math.sin(t / 53) * Math.cos(t / 131 + 1);
    const resp = 9.5 + 1.5 * Math.sin(t / 71 + 2);
    return { bpm: Math.round(bpm), resp: Math.round(resp) };
}

/**
 * A scrolling pulse trace of `width` columns: a spike `▁▃▅█` every beat that drifts to the left one column per
 * `BEAT_COLUMN_MS`. The newest moment is the rightmost column.
 */
export function heartbeatLine(nowMs: number, bpm: number, width: number): string
{
    const beatMs = 60_000 / Math.max(20, bpm);
    let out = '';
    for (let c = 0; c < width; c++)
    {
        const t = nowMs - (width - 1 - c) * BEAT_COLUMN_MS;
        const phase = (((t % beatMs) + beatMs) % beatMs) / beatMs;
        out += phase < 0.06 ? '█' : phase < 0.12 ? '▅' : phase < 0.2 ? '▃' : '▁';
    }
    return out;
}

/** Temperature of the pod `sinceMs` after it was closed: from body heat down towards the floor. */
export function podTemp(nowMs: number, startMs: number): number
{
    const elapsed = Math.max(0, nowMs - startMs);
    return POD_FLOOR_C + (POD_START_C - POD_FLOOR_C) * Math.exp(-elapsed / POD_COOL_MS);
}
