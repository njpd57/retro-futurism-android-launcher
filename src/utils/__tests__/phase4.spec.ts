import { describe, expect, it } from 'vitest';
import type { BridgeAppUsage, BridgeContact } from '@/types/bridge-fork';
import { blipFromKey, radarFrame } from '../radar';
import { primaryNumber, shortName } from '../contacts';
import { formatUsage, topUsage, totalUsageMs } from '../usage';
import { formatTimer, isFinished, remainingMs } from '../timer';
import { formatBytes } from '../tui';

const usage = (packageName: string, minutes: number): BridgeAppUsage => ({ packageName, totalTimeMs: minutes * 60_000, openCount: 1, lastTimeUsed: 0 });

describe('radar', () =>
{
    it('has the expected size and a center mark', () =>
    {
        const f = radarFrame(5, 0, []);
        expect(f).toHaveLength(11);
        expect(f.every(row => [...row].length === 21)).toBe(true);
        expect(f[5][10]).toBe('+');
    });

    it('blip positions are stable and inside the circle', () =>
    {
        expect(blipFromKey('abc')).toEqual(blipFromKey('abc'));
        for (const k of ['a', 'b', 'c', 'notif-1'])
        {
            const b = blipFromKey(k);
            expect(b.radius).toBeGreaterThanOrEqual(0.3);
            expect(b.radius).toBeLessThan(1);
        }
    });

    it('lights a blip the sweep just passed', () =>
    {
        const f = radarFrame(6, 0.05, [{ angle: 0, radius: 0.8 }]);
        expect(f.join('')).toContain('◉');
    });
});

describe('contacts', () =>
{
    const c = (numbers: BridgeContact['phoneNumbers']): BridgeContact => ({ id: 1, lookupKey: 'k', name: 'X', starred: true, hasPhoto: false, phoneNumbers: numbers });

    it('picks the primary number', () =>
    {
        expect(primaryNumber(c([{ number: '1', label: null, isPrimary: false }, { number: '2', label: null, isPrimary: true }]))).toBe('2');
        expect(primaryNumber(c([{ number: '1', label: null, isPrimary: false }]))).toBe('1');
        expect(primaryNumber(c([]))).toBeNull();
    });

    it('shortens names', () =>
    {
        expect(shortName('Ana', 10)).toBe('Ana');
        expect(shortName('Maria Fernanda Lopez', 8)).toBe('Maria F…');
    });
});

describe('usage', () =>
{
    const apps = [usage('a', 5), usage('b', 120), usage('self', 60), usage('c', 0.5)];

    it('ranks, filters and limits', () =>
    {
        expect(topUsage(apps, 5, ['self']).map(a => a.packageName)).toEqual(['b', 'a']);
        expect(topUsage(apps, 1).map(a => a.packageName)).toEqual(['b']);
    });

    it('totals and formats', () =>
    {
        expect(totalUsageMs(apps, ['self'])).toBe(125.5 * 60_000);
        expect(formatUsage(134 * 60_000)).toBe('2H 14M');
        expect(formatUsage(14 * 60_000)).toBe('14M');
        expect(formatUsage(20_000)).toBe('<1M');
    });
});

describe('timer', () =>
{
    it('computes remaining time and completion', () =>
    {
        expect(remainingMs(null, 5)).toBe(0);
        expect(remainingMs(1000, 400)).toBe(600);
        expect(remainingMs(1000, 2000)).toBe(0);
        expect(isFinished(1000, 1000)).toBe(true);
        expect(isFinished(null, 1000)).toBe(false);
    });

    it('formats', () =>
    {
        expect(formatTimer(61_000)).toBe('01:01');
        expect(formatTimer(100)).toBe('00:01');
        expect(formatTimer(3_661_000)).toBe('1:01:01');
    });
});

describe('formatBytes', () =>
{
    it('uses binary units', () =>
    {
        expect(formatBytes(47 * 1024 ** 3)).toBe('47.0 GB');
        expect(formatBytes(512 * 1024 ** 2)).toBe('512 MB');
        expect(formatBytes(0)).toBe('0 MB');
    });
});
