import { describe, expect, it } from 'vitest';
import { applyCrtColor, applyDuotone, applyScanlines, luma, nextFilter, parseColor } from '../crtFilter';

const px = (...rgba: number[]) => new Uint8ClampedArray(rgba);

describe('crtFilter', () =>
{
    it('parses css colors', () =>
    {
        expect(parseColor('rgb(255, 176, 0)')).toEqual([255, 176, 0]);
        expect(parseColor(' #fb0 ')).toEqual([255, 187, 0]);
        expect(parseColor('#ffb000')).toEqual([255, 176, 0]);
        expect(parseColor('amber')).toBeNull();
    });

    it('cycles through the filters', () =>
    {
        expect(nextFilter('phosphor')).toBe('color');
        expect(nextFilter('original')).toBe('phosphor');
    });

    it('maps black to the background and white to the phosphor', () =>
    {
        const data = px(0, 0, 0, 255, 255, 255, 255, 255);
        applyDuotone(data, 2, [10, 5, 0], [255, 176, 0], false);
        expect(Array.from(data.slice(0, 3))).toEqual([10, 5, 0]);
        expect(Array.from(data.slice(4, 7))).toEqual([255, 176, 0]);
    });

    it('keeps the brightness order in the duotone', () =>
    {
        const data = px(40, 40, 40, 255, 200, 200, 200, 255);
        applyDuotone(data, 2, [0, 0, 0], [255, 255, 255], false);
        expect(data[0]).toBeLessThan(data[4]);
    });

    it('darkens only odd rows with scanlines', () =>
    {
        const data = px(100, 100, 100, 255, 100, 100, 100, 255);
        applyScanlines(data, 1, 0.5);
        expect(data[0]).toBe(100);
        expect(data[4]).toBe(50);
    });

    it('leaves grey untouched by saturation and widens contrast', () =>
    {
        const data = px(200, 200, 200, 255);
        applyCrtColor(data, 1.2, 0.5);
        expect(data[0]).toBe(data[1]);
        expect(data[0]).toBeGreaterThan(200);
        expect(luma(255, 255, 255)).toBeCloseTo(255);
    });
});
