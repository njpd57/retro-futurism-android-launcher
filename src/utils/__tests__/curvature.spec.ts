import { describe, expect, it } from 'vitest';
import { bendK, correctPoint, MAX_BEND_K } from '../curvature';

const box = { left: 0, top: 0, width: 400, height: 800 };

describe('curvature', () =>
{
    it('maps the slider to the coefficient', () =>
    {
        expect(bendK(0)).toBe(0);
        expect(bendK(100)).toBe(MAX_BEND_K);
        expect(bendK(500)).toBe(MAX_BEND_K);
    });

    it('leaves the center and a zero bend untouched', () =>
    {
        expect(correctPoint(200, 400, box, 0.05)).toEqual({ x: 200, y: 400 });
        expect(correctPoint(10, 10, box, 0)).toEqual({ x: 10, y: 10 });
    });

    it('moves points away from the center, more towards the corners', () =>
    {
        const edge = correctPoint(400, 400, box, 0.05); // middle of the right edge: r^2 = 1, 200 * 0.05
        expect(edge.x).toBeCloseTo(410);
        expect(edge.y).toBeCloseTo(400);
        const corner = correctPoint(400, 800, box, 0.05); // r^2 = 2
        expect(corner.x - 400).toBeCloseTo(20);
        expect(corner.y - 800).toBeCloseTo(40);
    });
});
