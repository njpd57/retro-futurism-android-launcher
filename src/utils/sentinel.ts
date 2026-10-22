import { normalizeHost } from './telemetry';

/** A site is declared down after this many failed probes in a row, so one dropped packet doesn't raise the alarm. */
export const FAIL_THRESHOLD = 2;
export const PROBE_MS = 60_000;
export const PROBE_TIMEOUT_MS = 8000;
export const MAX_SITES = 8;

export const DEFAULT_SITES = [
    'https://idiomajapones.com/',
    'https://mail.quickware.cl/',
    'https://quickware.cl/',
    'https://academia.quickware.cl/',
];

export type SiteStatus = 'unknown' | 'up' | 'down';

export interface SiteState
{
    status: SiteStatus;
    /** failed probes in a row */
    fails: number;
    /** ms epoch of the last change of status */
    since: number;
}

export const FRESH_STATE: SiteState = { status: 'unknown', fails: 0, since: 0 };

/** Was that answer a sign of life? `null` = no answer, `0` = opaque answer (no-cors: it did answer), 5xx = the server is failing. */
export function isAlive(httpStatus: number | null): boolean
{
    return httpStatus !== null && httpStatus < 500;
}

/** Folds a probe result into the state of a site. It only flips to `down` after `threshold` failures in a row. */
export function nextState(prev: SiteState, alive: boolean, now: number, threshold = FAIL_THRESHOLD): SiteState
{
    if (alive) return prev.status === 'up' ? { ...prev, fails: 0 } : { status: 'up', fails: 0, since: now };
    const fails = prev.fails + 1;
    if (fails >= threshold && prev.status !== 'down') return { status: 'down', fails, since: now };
    return { ...prev, fails };
}

/** Keeps the valid, unique URLs of a saved list, at most `MAX_SITES`. */
export function cleanSites(list: unknown): string[]
{
    if (!Array.isArray(list)) return [];
    const out: string[] = [];
    for (const item of list)
    {
        const url = typeof item === 'string' ? normalizeHost(item) : null;
        if (url && !out.includes(url)) out.push(url);
    }
    return out.slice(0, MAX_SITES);
}

/** `QUICKWARE.CL` for a URL; a path other than `/` is kept. */
export function siteLabel(url: string): string
{
    try
    {
        const u = new URL(url);
        return (u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname)).toUpperCase();
    }
    catch
    {
        return url.toUpperCase();
    }
}

export function sitesSummary(states: readonly SiteState[]): { up: number; down: number; total: number }
{
    return {
        up: states.filter(s => s.status === 'up').length,
        down: states.filter(s => s.status === 'down').length,
        total: states.length,
    };
}
