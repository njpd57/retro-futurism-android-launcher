export const IDLE_OPTIONS_MIN = [0, 1, 2, 5, 10];

/** Next value of the idle-minutes setting (0 = off). */
export function nextIdleMinutes(current: number)
{
    const i = IDLE_OPTIONS_MIN.indexOf(current);
    return IDLE_OPTIONS_MIN[(i + 1) % IDLE_OPTIONS_MIN.length];
}

export function isIdle(now: number, lastActivity: number, minutes: number)
{
    return minutes > 0 && now - lastActivity >= minutes * 60_000;
}

/** Position (% of the screen, for the top-left corner of the clock) that changes every minute to avoid burn-in. */
export function idlePosition(date: Date): { x: number; y: number }
{
    const slot = Math.floor(date.getTime() / 60_000);
    // small deterministic scramble so consecutive minutes land far apart
    const a = (slot * 2654435761) >>> 0;
    const b = (slot * 40503 + 12345) >>> 0;
    return { x: a % 31, y: 10 + (b % 61) };
}
