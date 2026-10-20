import { describe, expect, it } from 'vitest';
import { AUTO_DEGAUSS_MAX_MINUTES, AUTO_DEGAUSS_MIN_MINUTES, nextDegaussMinutes } from '../degauss';

describe('nextDegaussMinutes', () =>
{
    it('covers the whole range and nothing outside it', () =>
    {
        expect(nextDegaussMinutes(() => 0)).toBe(AUTO_DEGAUSS_MIN_MINUTES);
        expect(nextDegaussMinutes(() => 0.999999)).toBe(AUTO_DEGAUSS_MAX_MINUTES);
        expect(nextDegaussMinutes(() => 1)).toBe(AUTO_DEGAUSS_MAX_MINUTES);
        expect(nextDegaussMinutes(() => -3)).toBe(AUTO_DEGAUSS_MIN_MINUTES);
    });

    it('is an integer in between', () =>
    {
        for (const r of [0.1, 0.37, 0.5, 0.83]) expect(Number.isInteger(nextDegaussMinutes(() => r))).toBe(true);
    });
});
