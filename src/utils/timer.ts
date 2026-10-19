export const TIMER_PRESETS_MIN = [1, 5, 10, 25] as const;

export function remainingMs(endsAt: number | null, now: number)
{
    return endsAt === null ? 0 : Math.max(0, endsAt - now);
}

export function isFinished(endsAt: number | null, now: number)
{
    return endsAt !== null && now >= endsAt;
}

/** `MM:SS`, or `H:MM:SS` from an hour up; rounds up so it never shows 00:00 before the end. */
export function formatTimer(ms: number)
{
    const total = Math.ceil(Math.max(0, ms) / 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    const h = Math.floor(total / 3600);
    const m = Math.floor(total / 60) % 60;
    return h ? `${h}:${p(m)}:${p(total % 60)}` : `${p(m)}:${p(total % 60)}`;
}

// ---- stopwatch ----

export interface Stopwatch
{
    running: boolean;
    /** when the current run started, ms */
    startedAt: number;
    /** time from earlier runs, ms */
    accumulated: number;
    /** elapsed time at each lap press, ms */
    laps: number[];
}

export const EMPTY_STOPWATCH: Stopwatch = { running: false, startedAt: 0, accumulated: 0, laps: [] };
export const MAX_LAPS = 20;

export function stopwatchElapsed(sw: Stopwatch, now: number)
{
    return sw.accumulated + (sw.running ? Math.max(0, now - sw.startedAt) : 0);
}

export function startStopwatch(sw: Stopwatch, now: number): Stopwatch
{
    return sw.running ? sw : { ...sw, running: true, startedAt: now };
}

export function stopStopwatch(sw: Stopwatch, now: number): Stopwatch
{
    return sw.running ? { ...sw, running: false, accumulated: stopwatchElapsed(sw, now), startedAt: 0 } : sw;
}

/** Marks a lap; only while running, keeping the latest MAX_LAPS. */
export function lapStopwatch(sw: Stopwatch, now: number): Stopwatch
{
    if (!sw.running) return sw;
    return { ...sw, laps: [...sw.laps, stopwatchElapsed(sw, now)].slice(-MAX_LAPS) };
}

/** Duration of each lap (the difference between consecutive marks). */
export function lapSplits(laps: readonly number[]): number[]
{
    return laps.map((t, i) => t - (i ? laps[i - 1] : 0));
}

/** `MM:SS.cc`, or `H:MM:SS.cc` from an hour up. */
export function formatStopwatch(ms: number)
{
    const total = Math.max(0, Math.floor(ms / 10));
    const p = (n: number) => String(n).padStart(2, '0');
    const cs = total % 100;
    const s = Math.floor(total / 100) % 60;
    const m = Math.floor(total / 6000) % 60;
    const h = Math.floor(total / 360000);
    return h ? `${h}:${p(m)}:${p(s)}.${p(cs)}` : `${p(m)}:${p(s)}.${p(cs)}`;
}
