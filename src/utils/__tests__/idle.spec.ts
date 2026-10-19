import { describe, expect, it } from 'vitest';
import { idlePosition, isIdle, nextIdleMinutes } from '../idle';

describe('idle', () =>
{
    it('cycles the option list', () =>
    {
        expect(nextIdleMinutes(0)).toBe(1);
        expect(nextIdleMinutes(10)).toBe(0);
        expect(nextIdleMinutes(7)).toBe(0); // unknown value falls back to off
    });

    it('is never idle when off', () =>
    {
        expect(isIdle(10_000_000, 0, 0)).toBe(false);
        expect(isIdle(59_999, 0, 1)).toBe(false);
        expect(isIdle(60_000, 0, 1)).toBe(true);
    });

    it('keeps the clock on screen and moves it each minute', () =>
    {
        const seen = new Set<string>();
        for (let m = 0; m < 200; m++)
        {
            const p = idlePosition(new Date(m * 60_000));
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(30);
            expect(p.y).toBeGreaterThanOrEqual(10);
            expect(p.y).toBeLessThanOrEqual(70);
            seen.add(`${p.x},${p.y}`);
        }
        expect(seen.size).toBeGreaterThan(50);
        expect(idlePosition(new Date(5_000))).toEqual(idlePosition(new Date(50_000)));
    });
});
