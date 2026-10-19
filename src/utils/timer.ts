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
