import { describe, expect, it } from 'vitest';
import { AIM, aimPixels } from '../aim';

describe('aimPixels', () =>
{
    it('keeps the sign, and leaves nothing as nothing', () =>
    {
        expect(aimPixels(0)).toBe(0);
        expect(aimPixels(-6)).toBeLessThan(0);
        expect(aimPixels(6)).toBe(-aimPixels(-6));
    });

    it('barely changes a small move and stretches a quick one, up to a limit', () =>
    {
        expect(aimPixels(1)).toBeCloseTo(1, 0);
        expect(aimPixels(28)).toBeGreaterThan(28 * 2.9 / 1.5);
        expect(aimPixels(500)).toBeCloseTo(500 * (1 + AIM.boost), 5);
    });
});
