export const MAX_SAMPLES = 30;
/** A request slower than this counts as lost. */
export const TIMEOUT_MS = 4000;
export const DEFAULT_HOST = 'https://www.google.com/generate_204';

/** What the user typed to an https URL; null when it can't be one. Plain `host` or `host/path` gets https://. */
export function normalizeHost(text: string): string | null
{
    const t = text.trim();
    if (!t || /\s/.test(t)) return null;
    const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
    try
    {
        const u = new URL(url);
        return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') ? u.toString() : null;
    }
    catch
    {
        return null;
    }
}

/** `null` is a lost sample. */
export type Sample = number | null;

export function pushSample(history: readonly Sample[], sample: Sample, max = MAX_SAMPLES): Sample[]
{
    return [...history, sample].slice(-max);
}

export function latencyStats(history: readonly Sample[])
{
    const ok = history.filter((s): s is number => s !== null);
    return {
        last: history.length ? history[history.length - 1] : null,
        avg: ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null,
        max: ok.length ? Math.max(...ok) : null,
        lossPct: history.length ? Math.round(((history.length - ok.length) / history.length) * 100) : 0,
    };
}

/** Sparkline input: lost samples are drawn at the ceiling. */
export function sparkValues(history: readonly Sample[], ceiling = TIMEOUT_MS): number[]
{
    return history.map(s => s ?? ceiling);
}
