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
