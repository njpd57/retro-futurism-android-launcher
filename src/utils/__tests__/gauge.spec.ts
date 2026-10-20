import { describe, expect, it } from 'vitest';
import { bar } from '../tui';
import { barSegments, litSegments, signalGeometry, sparkBars, sparkLine, toPoints } from '../gauge';

describe('bar segments', () =>
{
    it('lights as many segments as the text bar fills', () =>
    {
        for (const f of [0, 0.1, 0.33, 0.5, 0.76, 1])
            expect(litSegments(f, 8)).toBe([...bar(f, 8)].filter(c => c === '▓').length);
    });

    it('clamps and survives bad input', () =>
    {
        expect(litSegments(2, 8)).toBe(8);
        expect(litSegments(-1, 8)).toBe(0);
        expect(litSegments(NaN, 8)).toBe(0);
    });

    it('fits the segments and their gaps in the box, in order', () =>
    {
        const s = barSegments(0.5, 10, 100, 10, 1);
        expect(s).toHaveLength(10);
        expect(s.filter(x => x.on)).toHaveLength(5);
        expect(s[0].x).toBe(0);
        expect(s[9].x + s[9].w).toBeCloseTo(100);
        expect(s.every((x, i) => i === 0 || x.x > s[i - 1].x + s[i - 1].w)).toBe(true);
    });
});

describe('signal geometry', () =>
{
    it('rises left to right from a common baseline and lights `level` bars', () =>
    {
        const s = signalGeometry(3, 4, 20, 12);
        expect(s.map(b => b.on)).toEqual([true, true, true, false]);
        expect(s.map(b => b.h)).toEqual([3, 6, 9, 12]);
        expect(s.every(b => b.y + b.h === 12)).toBe(true);
    });

    it('lights nothing when the level is unknown and clamps the rest', () =>
    {
        expect(signalGeometry(null).some(b => b.on)).toBe(false);
        expect(signalGeometry(9).every(b => b.on)).toBe(true);
        expect(signalGeometry(-2).some(b => b.on)).toBe(false);
    });
});

describe('sparklines', () =>
{
    it('scales columns between min and max, the highest being full height', () =>
    {
        const b = sparkBars([10, 20, 30], undefined, undefined, 100, 20);
        expect(b[2].h).toBeCloseTo(20);
        expect(b[0].h).toBeGreaterThan(0); // the lowest still shows
        expect(b[0].h).toBeLessThan(b[1].h);
        expect(b.every(x => x.y + x.h === 20)).toBe(true);
    });

    it('draws a lost sample as a zero-height column', () =>
    {
        const b = sparkBars([40, null, 80], 0, 100);
        expect(b[1]).toMatchObject({ h: 0, missing: true });
        expect(b[0].missing).toBe(false);
    });

    it('handles empty and flat data', () =>
    {
        expect(sparkBars([])).toEqual([]);
        expect(sparkBars([5, 5]).every(x => Number.isFinite(x.h))).toBe(true);
        expect(sparkLine([])).toEqual([]);
        expect(sparkLine([7])).toEqual([{ x: 50, y: 20 }]);
    });

    it('draws the polyline with the highest value at the top', () =>
    {
        const p = sparkLine([10, 30, 20], 100, 20);
        expect(p[0]).toEqual({ x: 0, y: 20 });
        expect(p[1]).toEqual({ x: 50, y: 0 });
        expect(p[2].x).toBe(100);
        expect(toPoints(p)).toBe('0.00,20.00 50.00,0.00 100.00,10.00');
    });
});
