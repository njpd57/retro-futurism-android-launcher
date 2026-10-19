import { describe, expect, it } from 'vitest';
import { isNight } from '../nightShift';
import { canVibrate } from '../haptics';

const at = (h: number) => new Date(2026, 0, 1, h, 30);

describe('isNight', () =>
{
    it('wraps past midnight', () =>
    {
        expect(isNight(at(22))).toBe(true);
        expect(isNight(at(3))).toBe(true);
        expect(isNight(at(6))).toBe(true);
        expect(isNight(at(7))).toBe(false);
        expect(isNight(at(15))).toBe(false);
        expect(isNight(at(21))).toBe(false);
    });

    it('works with a same-day range', () =>
    {
        expect(isNight(at(13), 12, 14)).toBe(true);
        expect(isNight(at(14), 12, 14)).toBe(false);
    });
});

describe('canVibrate', () =>
{
    it('detects the API', () =>
    {
        expect(canVibrate({ vibrate: () => true })).toBe(true);
        expect(canVibrate({})).toBe(false);
        expect(canVibrate(undefined)).toBe(false);
    });
});
