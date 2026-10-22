import { describe, expect, it } from 'vitest';
import { frameWait, lookScale, lowPower, renderScale } from '../power';

describe('low power', () =>
{
    it('starts below 20 % while unplugged, and never without a reading', () =>
    {
        expect(lowPower({ level: 19, isCharging: false })).toBe(true);
        expect(lowPower({ level: 20, isCharging: false })).toBe(false);
        expect(lowPower({ level: 5, isCharging: true })).toBe(false);
        expect(lowPower(null)).toBe(false);
    });

    it('caps the frame rate at 30 when moving and keeps the idle rest', () =>
    {
        expect(frameWait('60', true, false)).toBeLessThan(frameWait('30', true, false));
        expect(frameWait('60', true, true)).toBe(frameWait('30', true, false));
        expect(frameWait('eco', true, true)).toBe(frameWait('30', true, false));
        expect(frameWait('eco', true, false)).toBe(frameWait('60', true, false));
        expect(frameWait('eco', false, true)).toBe(100);
        expect(frameWait('eco', false, false)).toBe(100);
    });

    it('draws no more than one device pixel per CSS pixel', () =>
    {
        expect(renderScale(3, false)).toBe(2);
        expect(renderScale(3, true)).toBe(1);
        expect(renderScale(1, true)).toBe(1);
        expect(renderScale(0, false)).toBe(1);
    });
});

describe('look speed', () =>
{
    it('is a multiplier kept between half and double', () =>
    {
        expect(lookScale(100)).toBe(1);
        expect(lookScale(150)).toBe(1.5);
        expect(lookScale(10)).toBe(0.5);
        expect(lookScale(900)).toBe(2);
        expect(lookScale(NaN)).toBe(1);
    });
});
