import type { BridgeAppUsage } from '@/types/bridge-fork';
import { dayKey } from './day';

export interface DayUsage { day: string; apps: BridgeAppUsage[] }

export const REPORT_DAYS = 7;
const DAY_MS = 86_400_000;

/** The `days` local days ending today, oldest first, as `[start, end)` ranges in ms (today's end is `now`). */
export function dayRanges(now: Date, days = REPORT_DAYS * 2): { day: string; from: number; to: number }[]
{
    const out: { day: string; from: number; to: number }[] = [];
    for (let i = days - 1; i >= 0; i--)
    {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
        out.push({ day: dayKey(start), from: start.getTime(), to: i === 0 ? now.getTime() : end.getTime() });
    }
    return out;
}

const sum = (apps: readonly BridgeAppUsage[], exclude: ReadonlySet<string>) =>
    apps.reduce((t, a) => t + (exclude.has(a.packageName) ? 0 : a.totalTimeMs), 0);

export interface AppTrend { packageName: string; ms: number; prevMs: number }

export interface WeeklyReport
{
    /** this week's days, oldest first, with their short weekday letter */
    days: { day: string; letter: string; ms: number }[];
    totalMs: number;
    prevMs: number;
    /** change against the previous week in %, null when there was no previous data */
    deltaPct: number | null;
    avgMs: number;
    top: AppTrend[];
    /** apps first seen this week that were used */
    newApps: string[];
}

const LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/**
 * Last `REPORT_DAYS` days against the ones before. `history` is oldest first, up to 14 days; days missing at
 * the start count as no data. `exclude` leaves out apps such as the launcher itself.
 */
export function buildReport(history: readonly DayUsage[], firstSeen: Readonly<Record<string, number>>, now: Date, exclude: readonly string[] = [], topN = 5): WeeklyReport
{
    const skip = new Set(exclude);
    const thisWeek = history.slice(-REPORT_DAYS);
    const prevWeek = history.slice(-REPORT_DAYS * 2, -REPORT_DAYS);

    const days = thisWeek.map(d => ({ day: d.day, letter: LETTERS[new Date(`${d.day}T12:00:00`).getDay()], ms: sum(d.apps, skip) }));
    const totalMs = days.reduce((t, d) => t + d.ms, 0);
    const prevMs = prevWeek.reduce((t, d) => t + sum(d.apps, skip), 0);

    const byApp = new Map<string, { ms: number; prevMs: number }>();
    const add = (days: readonly DayUsage[], key: 'ms' | 'prevMs') =>
    {
        for (const d of days)
            for (const a of d.apps)
            {
                if (skip.has(a.packageName)) continue;
                const entry = byApp.get(a.packageName) ?? { ms: 0, prevMs: 0 };
                entry[key] += a.totalTimeMs;
                byApp.set(a.packageName, entry);
            }
    };
    add(thisWeek, 'ms');
    add(prevWeek, 'prevMs');

    const trends = [...byApp.entries()].map(([packageName, v]) => ({ packageName, ...v }));
    const top = trends.filter(t => t.ms >= 60_000).sort((a, b) => b.ms - a.ms).slice(0, topN);
    const weekAgo = now.getTime() - REPORT_DAYS * DAY_MS;
    const newApps = trends.filter(t => t.ms >= 60_000 && (firstSeen[t.packageName] ?? 0) >= weekAgo).map(t => t.packageName);

    return {
        days,
        totalMs,
        prevMs,
        deltaPct: prevMs > 0 ? Math.round((totalMs - prevMs) / prevMs * 100) : null,
        avgMs: days.length ? totalMs / days.length : 0,
        top,
        newApps,
    };
}

export const formatDelta = (pct: number | null) => pct === null ? 'SIN DATOS PREVIOS' : `${pct > 0 ? '+' : ''}${pct}% VS SEMANA ANTERIOR`;

/** Plain text of the report, for the console and for MOTHER. `label` turns a package into a name. */
export function reportLines(r: WeeklyReport, label: (pkg: string) => string, format: (ms: number) => string): string[]
{
    const lines = [
        `TOTAL 7 DÍAS ${format(r.totalMs)} · MEDIA ${format(r.avgMs)}/DÍA`,
        formatDelta(r.deltaPct),
        ...r.top.map(t => `${label(t.packageName).toUpperCase()} ${format(t.ms)}`),
    ];
    if (r.newApps.length) lines.push(`APPS NUEVAS: ${r.newApps.map(p => label(p).toUpperCase()).join(', ')}`);
    return lines;
}
