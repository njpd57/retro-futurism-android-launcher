import { describe, expect, it } from 'vitest';
import { BURN_MAX_OPACITY, burnBands, burnOpacity } from '../burnIn';

describe('burnOpacity', () =>
{
    it('is zero with no use or bad input', () =>
    {
        expect(burnOpacity(0)).toBe(0);
        expect(burnOpacity(-5)).toBe(0);
        expect(burnOpacity(NaN)).toBe(0);
    });

    it('grows with use and never passes the maximum', () =>
    {
        const a = burnOpacity(60), b = burnOpacity(60 * 40), c = burnOpacity(60 * 1000);
        expect(a).toBeGreaterThan(0);
        expect(b).toBeGreaterThan(a);
        expect(c).toBeGreaterThan(b);
        expect(c).toBeLessThanOrEqual(BURN_MAX_OPACITY);
    });

    it('stays within 2-3 % so the contrast cannot drop', () =>
    {
        expect(BURN_MAX_OPACITY).toBeLessThanOrEqual(0.03);
    });
});

describe('burnBands', () =>
{
    it('puts one band under the top bar and one above the soft keys', () =>
    {
        expect(burnBands(30, 770, 800)).toEqual([{ top: 30, height: 2 }, { top: 768, height: 2 }]);
    });

    it('skips what is missing or off screen', () =>
    {
        expect(burnBands(null, null, 800)).toEqual([]);
        expect(burnBands(30, null, 800)).toEqual([{ top: 30, height: 2 }]);
        expect(burnBands(900, 1000, 800)).toEqual([]);
    });
});
