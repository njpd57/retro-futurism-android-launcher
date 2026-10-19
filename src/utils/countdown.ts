export interface Countdown
{
    label: string;
    /** target instant, ms; null when not set */
    target: number | null;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** `2026-12-31` (from an `<input type="date">`) to local midnight of that day; null when invalid. */
export function parseDateInput(value: string): number | null
{
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(y, mo - 1, d);
    return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date.getTime() : null;
}

/** `T-MENOS 012 DÍAS 04:33` before the target, `T-MÁS ...` after it. */
export function formatCountdown(target: number, now: number): string
{
    const diff = target - now;
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86_400_000);
    const hours = Math.floor(abs / 3_600_000) % 24;
    const minutes = Math.floor(abs / 60_000) % 60;
    return `${diff >= 0 ? 'T-MENOS' : 'T-MÁS'} ${pad(days, 3)} DÍAS ${pad(hours)}:${pad(minutes)}`;
}
