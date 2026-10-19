import { describe, expect, it } from 'vitest';
import { addItem, isDone, MAX_PROTOCOL_ITEMS, progress, removeItem, toggleItem } from '../protocol';
import { formatCountdown, parseDateInput } from '../countdown';
import { DEFAULT_ZONES, MAX_ZONES, toggleZone, zoneLabel, zoneTime } from '../worldClock';
import { moonArt, moonCycle, moonIllumination, moonName } from '../moon';

describe('protocol', () =>
{
    it('adds trimmed items up to the limit', () =>
    {
        let items = addItem([], '  tomar   agua ');
        expect(items).toEqual([{ text: 'tomar agua', doneOn: '' }]);
        expect(addItem(items, '   ')).toEqual(items);
        for (let i = 0; i < 20; i++) items = addItem(items, `t${i}`);
        expect(items).toHaveLength(MAX_PROTOCOL_ITEMS);
    });

    it('a tick only counts for its own day', () =>
    {
        const items = toggleItem(addItem([], 'a'), 0, '2026-10-19');
        expect(isDone(items[0], '2026-10-19')).toBe(true);
        expect(isDone(items[0], '2026-10-20')).toBe(false);
        expect(progress(items, '2026-10-20')).toEqual({ done: 0, total: 1, fraction: 0 });
        expect(isDone(toggleItem(items, 0, '2026-10-19')[0], '2026-10-19')).toBe(false);
    });

    it('removes and reports progress', () =>
    {
        let items = addItem(addItem([], 'a'), 'b');
        items = toggleItem(items, 1, 'D');
        expect(progress(items, 'D').fraction).toBe(0.5);
        expect(removeItem(items, 0).map(i => i.text)).toEqual(['b']);
        expect(progress([], 'D')).toEqual({ done: 0, total: 0, fraction: 0 });
    });
});

describe('countdown', () =>
{
    it('parses date inputs strictly', () =>
    {
        expect(parseDateInput('2026-12-31')).toBe(new Date(2026, 11, 31).getTime());
        expect(parseDateInput('2026-02-31')).toBeNull();
        expect(parseDateInput('31/12/2026')).toBeNull();
        expect(parseDateInput('')).toBeNull();
    });

    it('formats before and after the target', () =>
    {
        const target = new Date(2026, 0, 13, 4, 33).getTime();
        const start = new Date(2026, 0, 1, 0, 0).getTime();
        expect(formatCountdown(target, start)).toBe('T-MENOS 012 DÍAS 04:33');
        expect(formatCountdown(start, target)).toBe('T-MÁS 012 DÍAS 04:33');
    });
});

describe('world clock', () =>
{
    it('labels zones', () =>
    {
        expect(zoneLabel('America/New_York')).toBe('NEW YORK');
        expect(zoneLabel('UTC')).toBe('UTC');
    });

    it('formats the time in a zone and survives bad zones', () =>
    {
        expect(zoneTime(new Date(Date.UTC(2026, 0, 1, 12, 5)), 'UTC')).toBe('12:05');
        expect(zoneTime(new Date(), 'Nope/Nowhere')).toBe('--:--');
    });

    it('toggles zones within the limit', () =>
    {
        let z: string[] = [];
        for (const name of ['A', 'B', 'C', 'D', 'E']) z = toggleZone(z, name);
        expect(z).toHaveLength(MAX_ZONES);
        expect(toggleZone(z, 'A')).toEqual(['B', 'C', 'D']);
        expect(DEFAULT_ZONES.length).toBeLessThanOrEqual(MAX_ZONES);
    });
});

describe('moon', () =>
{
    it('is a new moon on the reference date and full about half a cycle later', () =>
    {
        expect(moonCycle(new Date(Date.UTC(2000, 0, 6, 18, 14)))).toBeCloseTo(0, 5);
        expect(moonCycle(new Date(Date.UTC(2000, 0, 21, 4, 40)))).toBeCloseTo(0.5, 1);
        expect(moonCycle(new Date(Date.UTC(1990, 5, 1)))).toBeGreaterThanOrEqual(0);
    });

    it('names the phases', () =>
    {
        expect(moonName(0)).toBe('LUNA NUEVA');
        expect(moonName(0.25)).toBe('CUARTO CRECIENTE');
        expect(moonName(0.5)).toBe('LUNA LLENA');
        expect(moonName(0.75)).toBe('CUARTO MENGUANTE');
        expect(moonName(0.99)).toBe('LUNA NUEVA');
        expect(moonIllumination(0.5)).toBeCloseTo(1);
        expect(moonIllumination(0)).toBeCloseTo(0);
    });

    it('draws a disc with the lit side on the correct edge', () =>
    {
        const lit = (rows: string[]) => rows.join('').split('█').length - 1;
        expect(lit(moonArt(0))).toBe(0);
        expect(lit(moonArt(0.5)) ).toBeGreaterThan(lit(moonArt(0.25)));
        const waxing = moonArt(0.25)[3];
        const waning = moonArt(0.75)[3];
        expect(waxing.indexOf('█')).toBeGreaterThan(waxing.length / 2 - 2);
        expect(waning.lastIndexOf('█')).toBeLessThan(waning.length / 2 + 2);
        expect(moonArt(0.5, 3)).toHaveLength(7);
    });
});

import { dailyRows, parseForecast } from '../weather';

describe('extended forecast', () =>
{
    const base = { current: { temperature_2m: 10, weather_code: 1 }, hourly: { temperature_2m: [10] } };
    const daily = { time: ['2026-10-19', '2026-10-20'], temperature_2m_max: [20.4, 18.6], temperature_2m_min: [9, 8.2], weather_code: [0, 61] };

    it('parses the daily block when it is consistent', () =>
    {
        expect(parseForecast({ ...base, daily }, 1)?.daily).toEqual({ date: daily.time, max: daily.temperature_2m_max, min: daily.temperature_2m_min, code: daily.weather_code });
    });

    it('ignores a missing or misaligned daily block', () =>
    {
        expect(parseForecast(base, 1)?.daily).toBeUndefined();
        expect(parseForecast({ ...base, daily: { ...daily, weather_code: [0] } }, 1)?.daily).toBeUndefined();
    });

    it('builds rows with HOY and weekday names', () =>
    {
        const rows = dailyRows(parseForecast({ ...base, daily }, 1)!.daily!);
        expect(rows).toEqual([{ day: 'HOY', max: 20, min: 9, code: 0 }, { day: 'MAR', max: 19, min: 8, code: 61 }]);
    });
});

import { EMPTY_STOPWATCH, formatStopwatch, lapSplits, lapStopwatch, startStopwatch, stopStopwatch, stopwatchElapsed, MAX_LAPS } from '../timer';

describe('stopwatch', () =>
{
    it('accumulates across stops', () =>
    {
        let sw = startStopwatch(EMPTY_STOPWATCH, 1000);
        expect(stopwatchElapsed(sw, 1500)).toBe(500);
        sw = stopStopwatch(sw, 2000);
        expect(stopwatchElapsed(sw, 99999)).toBe(1000);
        sw = startStopwatch(sw, 5000);
        expect(stopwatchElapsed(sw, 5250)).toBe(1250);
    });

    it('ignores redundant start/stop and laps while stopped', () =>
    {
        const running = startStopwatch(EMPTY_STOPWATCH, 10);
        expect(startStopwatch(running, 99)).toBe(running);
        expect(stopStopwatch(EMPTY_STOPWATCH, 5)).toBe(EMPTY_STOPWATCH);
        expect(lapStopwatch(EMPTY_STOPWATCH, 5)).toBe(EMPTY_STOPWATCH);
    });

    it('records laps and their splits, capped', () =>
    {
        let sw = startStopwatch(EMPTY_STOPWATCH, 0);
        sw = lapStopwatch(sw, 1000);
        sw = lapStopwatch(sw, 2500);
        expect(sw.laps).toEqual([1000, 2500]);
        expect(lapSplits(sw.laps)).toEqual([1000, 1500]);
        for (let i = 0; i < 30; i++) sw = lapStopwatch(sw, 3000 + i);
        expect(sw.laps).toHaveLength(MAX_LAPS);
    });

    it('formats with centiseconds', () =>
    {
        expect(formatStopwatch(0)).toBe('00:00.00');
        expect(formatStopwatch(61_230)).toBe('01:01.23');
        expect(formatStopwatch(3_600_000 + 5_000)).toBe('1:00:05.00');
    });
});

import { latencyStats, normalizeHost, pushSample, sparkValues } from '../telemetry';
import { compassPoint, compassStrip, headingFromAlpha } from '../compass';

describe('telemetry', () =>
{
    it('normalizes hosts', () =>
    {
        expect(normalizeHost('example.com')).toBe('https://example.com/');
        expect(normalizeHost('http://example.com/ping')).toBe('http://example.com/ping');
        expect(normalizeHost('ftp://example.com')).toBeNull();
        expect(normalizeHost('localhost')).toBeNull();
        expect(normalizeHost('a b.com')).toBeNull();
        expect(normalizeHost('')).toBeNull();
    });

    it('keeps a bounded history and computes stats with losses', () =>
    {
        let h: (number | null)[] = [];
        for (const s of [40, 60, null, 80]) h = pushSample(h, s, 3);
        expect(h).toEqual([60, null, 80]);
        expect(latencyStats(h)).toEqual({ last: 80, avg: 70, max: 80, lossPct: 33 });
        expect(latencyStats([])).toEqual({ last: null, avg: null, max: null, lossPct: 0 });
        expect(sparkValues([10, null], 100)).toEqual([10, 100]);
    });
});

describe('compass', () =>
{
    it('converts alpha to heading and names points', () =>
    {
        expect(headingFromAlpha(0)).toBe(0);
        expect(headingFromAlpha(90)).toBe(270);
        expect(compassPoint(0)).toBe('N');
        expect(compassPoint(359)).toBe('N');
        expect(compassPoint(92)).toBe('E');
        expect(compassPoint(200)).toBe('S');
        expect(compassPoint(270)).toBe('O');
    });

    it('centres the strip on the heading', () =>
    {
        const strip = compassStrip(90, 21);
        expect(strip).toHaveLength(21);
        expect(strip[10]).toBe('E');
        expect(compassStrip(0, 21)[10]).toBe('N');
        expect(compassStrip(358, 21)).toHaveLength(21);
    });
});
