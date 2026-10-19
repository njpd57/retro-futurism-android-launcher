import { describe, expect, it } from 'vitest';
import { bar, formatClock, formatDateTui, formatDuration, signalBars, sparkline } from '../tui';
import { recordLaunch } from '../recents';

describe('tui', () =>
{
    it('bar fills proportionally and clamps', () =>
    {
        expect(bar(0.5, 4)).toBe('▓▓░░');
        expect(bar(2, 3)).toBe('▓▓▓');
        expect(bar(-1, 3)).toBe('░░░');
        expect(bar(NaN, 2)).toBe('░░');
    });

    it('sparkline scales between min and max', () =>
    {
        expect(sparkline([0, 1], 0, 1)).toBe('▁█');
        expect(sparkline([5, 5, 5])).toHaveLength(3);
    });

    it('signalBars shows level, unknown and clamps', () =>
    {
        expect(signalBars(0)).toBe('____');
        expect(signalBars(4)).toHaveLength(4);
        expect(signalBars(4)).not.toContain('_');
        expect(signalBars(null)).toBe('----');
        expect(signalBars(9)).toBe(signalBars(4));
    });

    it('formatDuration pads and exceeds 24h', () =>
    {
        expect(formatDuration(0)).toBe('00:00:00');
        expect(formatDuration(8025000)).toBe('02:13:45');
        expect(formatDuration(90 * 3600 * 1000)).toBe('90:00:00');
        expect(formatDuration(-5)).toBe('00:00:00');
    });

    it('formats dates and clock', () =>
    {
        const d = new Date(2026, 9, 18, 7, 5, 9);
        expect(formatDateTui(d)).toBe('18-OCT-26');
        expect(formatDateTui(d, true)).toBe('18-OCT-2026');
        expect(formatClock(d)).toBe('07:05');
        expect(formatClock(d, true)).toBe('07:05:09');
    });
});

describe('recordLaunch', () =>
{
    it('puts the app first without duplicates and caps the list', () =>
    {
        expect(recordLaunch(['a', 'b', 'c'], 'b', 5)).toEqual(['b', 'a', 'c']);
        expect(recordLaunch(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
    });
});
