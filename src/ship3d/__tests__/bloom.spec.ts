import { describe, expect, it } from 'vitest';
import { BLUR_TAPS, blurWeights, bloomGain, bloomSize } from '../bloom';

describe('blurWeights', () =>
{
    it('adds up to 1 counting both sides, and falls off from the centre', () =>
    {
        const w = blurWeights();
        expect(w).toHaveLength(BLUR_TAPS + 1);
        expect(w[0] + 2 * Array.from(w.slice(1)).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
        for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThan(w[i - 1]);
        expect(w[w.length - 1]).toBeGreaterThan(0);
    });
});

describe('bloomSize', () =>
{
    it('halves the frame and never gives an empty buffer', () =>
    {
        expect(bloomSize(1080, 1921)).toEqual([540, 961]);
        expect(bloomSize(1, 1)).toEqual([1, 1]);
        expect(bloomSize(0, 0)).toEqual([1, 1]);
    });
});

describe('bloomGain', () =>
{
    it('is off at 0 or nonsense and grows with the setting, capped at full', () =>
    {
        expect(bloomGain(0)).toBe(0);
        expect(bloomGain(-1)).toBe(0);
        expect(bloomGain(NaN)).toBe(0);
        expect(bloomGain(0.3)).toBeLessThan(bloomGain(0.7));
        expect(bloomGain(1)).toBe(bloomGain(5));
    });
});
