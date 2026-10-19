const SPARK = '▁▂▃▄▅▆▇█';

/** `▓▓▓░░` for a fraction (0-1) over `width` cells. */
export function bar(fraction: number, width: number)
{
    const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
    const filled = Math.round(f * width);
    return '▓'.repeat(filled) + '░'.repeat(width - filled);
}

/** One block character per value, scaled between `min` and `max` (defaults to the data range). */
export function sparkline(values: number[], min = Math.min(...values), max = Math.max(...values))
{
    const span = max - min || 1;
    return values
        .map(v => SPARK[Math.min(SPARK.length - 1, Math.max(0, Math.floor(((v - min) / span) * SPARK.length)))])
        .join('');
}

/** `▂▄▆_` style bars for a signal level 0-4 (null means unknown). */
export function signalBars(level: number | null, max = 4)
{
    if (level === null) return '----';
    const l = Math.min(max, Math.max(0, Math.round(level)));
    return Array.from({ length: max }, (_, i) => i < l ? SPARK[1 + i * 2] : '_').join('');
}

/** `HH:MM:SS` (hours can exceed 24). */
export function formatDuration(ms: number)
{
    const total = Math.max(0, Math.floor(ms / 1000));
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(total / 3600))}:${p(Math.floor(total / 60) % 60)}:${p(total % 60)}`;
}

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

/** `18-OCT-26`, or `18-OCT-2026` with `longYear`. */
export function formatDateTui(d: Date, longYear = false)
{
    const y = String(d.getFullYear());
    return `${d.getDate()}-${MONTHS[d.getMonth()]}-${longYear ? y : y.slice(2)}`;
}

export function formatDayName(d: Date)
{
    return DAYS[d.getDay()];
}

/** `HH:MM` or `HH:MM:SS`. */
export function formatClock(d: Date, seconds = false)
{
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}${seconds ? `:${p(d.getSeconds())}` : ''}`;
}

/** `47.2 GB`, `512 MB`; binary units, one decimal from GB up. */
export function formatBytes(bytes: number)
{
    const GB = 1024 ** 3;
    const MB = 1024 ** 2;
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
    if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
    if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
