import { describe, expect, it } from 'vitest';
import type { BridgeAppUsage } from '@/types/bridge-fork';
import { buildReport, dayRanges, formatDelta, reportLines, type DayUsage } from '../weeklyReport';

const MIN = 60_000;
const use = (packageName: string, minutes: number): BridgeAppUsage => ({ packageName, totalTimeMs: minutes * MIN, openCount: 1, lastTimeUsed: 0 });
const now = new Date(2026, 9, 19, 15, 0); // Monday

/** 14 days ending today: `perDay(i)` gives the apps of day i (0 = oldest) */
function history(perDay: (i: number) => BridgeAppUsage[]): DayUsage[]
{
    return dayRanges(now).map((r, i) => ({ day: r.day, apps: perDay(i) }));
}

describe('dayRanges', () =>
{
    it('gives 14 local days, oldest first, ending today at now', () =>
    {
        const r = dayRanges(now);
        expect(r).toHaveLength(14);
        expect(r[13].day).toBe('2026-10-19');
        expect(r[0].day).toBe('2026-10-06');
        expect(r[13].to).toBe(now.getTime());
        expect(r[12].to).toBe(r[13].from);
    });

    it('crosses a month', () =>
    {
        expect(dayRanges(new Date(2026, 10, 2))[0].day).toBe('2026-10-20');
    });
});

describe('buildReport', () =>
{
    it('totals this week against the one before', () =>
    {
        const h = history(i => [use('a.chat', i < 7 ? 60 : 90)]);
        const r = buildReport(h, {}, now);
        expect(r.totalMs).toBe(7 * 90 * MIN);
        expect(r.prevMs).toBe(7 * 60 * MIN);
        expect(r.deltaPct).toBe(50);
        expect(r.avgMs).toBe(90 * MIN);
        expect(r.days).toHaveLength(7);
        expect(r.days[6].letter).toBe('L'); // today is Monday
    });

    it('has no change to report without a previous week', () =>
    {
        const h = history(i => i < 7 ? [] : [use('a', 10)]);
        expect(buildReport(h, {}, now).deltaPct).toBeNull();
        expect(formatDelta(null)).toBe('SIN DATOS PREVIOS');
        expect(formatDelta(12)).toBe('+12% VS SEMANA ANTERIOR');
        expect(formatDelta(-8)).toBe('-8% VS SEMANA ANTERIOR');
    });

    it('lists the top apps with their previous week and skips what was left out', () =>
    {
        const h = history(i => [use('big', i < 7 ? 10 : 30), use('small', 5), use('launcher', 500)]);
        const r = buildReport(h, {}, now, ['launcher'], 2);
        expect(r.top.map(t => t.packageName)).toEqual(['big', 'small']);
        expect(r.top[0]).toEqual({ packageName: 'big', ms: 7 * 30 * MIN, prevMs: 7 * 10 * MIN });
        expect(r.totalMs).toBe(7 * 35 * MIN);
    });

    it('finds apps first seen this week that were used', () =>
    {
        const weekAgo = now.getTime() - 7 * 86_400_000;
        const h = history(() => [use('old', 10), use('fresh', 10), use('fresh.unused', 0)]);
        const r = buildReport(h, { old: weekAgo - 1000, fresh: weekAgo + 1000, 'fresh.unused': weekAgo + 1000 }, now);
        expect(r.newApps).toEqual(['fresh']);
    });

    it('copes with a short history', () =>
    {
        const r = buildReport(history(() => [use('a', 10)]).slice(-3), {}, now);
        expect(r.days).toHaveLength(3);
        expect(r.prevMs).toBe(0);
        expect(buildReport([], {}, now).totalMs).toBe(0);
    });
});

describe('reportLines', () =>
{
    it('writes the summary', () =>
    {
        const h = history(() => [use('a.chat', 60)]);
        const lines = reportLines(buildReport(h, {}, now), p => p, ms => `${Math.round(ms / MIN)}M`);
        expect(lines[0]).toBe('TOTAL 7 DÍAS 420M · MEDIA 60M/DÍA');
        expect(lines[1]).toBe('0% VS SEMANA ANTERIOR');
        expect(lines[2]).toBe('A.CHAT 420M');
    });
});
