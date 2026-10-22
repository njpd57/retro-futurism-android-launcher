import { describe, expect, it } from 'vitest';
import { cameraGap, cutoutSpan, DEFAULT_CAMERA_FRACTION } from '../statusBar';

describe('cutoutSpan', () =>
{
    it('reads the bounding box of an absolute path as screen fractions', () =>
    {
        const span = cutoutSpan('M 480 0 L 600 0 L 600 80 L 480 80 Z', 1080);
        expect(span?.from).toBeCloseTo(480 / 1080);
        expect(span?.to).toBeCloseTo(600 / 1080);
    });

    it('is null without a usable path', () =>
    {
        expect(cutoutSpan(null, 1080)).toBeNull();
        expect(cutoutSpan('', 1080)).toBeNull();
        expect(cutoutSpan('M 5 5', 1080)).toBeNull();
        expect(cutoutSpan('M 1 1 L 2 2', 0)).toBeNull();
    });
});

describe('cameraGap', () =>
{
    it('prefers the manual value, then the cutout, then the default', () =>
    {
        expect(cameraGap(0.3, { from: 0.4, to: 0.5 })).toBe(0.3);
        expect(cameraGap(0, { from: 0.4, to: 0.5 })).toBeCloseTo(0.14);
        expect(cameraGap(0, null)).toBe(DEFAULT_CAMERA_FRACTION);
    });

    it('never takes more than 60 % of the bar', () =>
    {
        expect(cameraGap(0.9, null)).toBe(0.6);
        expect(cameraGap(0, { from: 0, to: 1 })).toBe(0.6);
    });
});
