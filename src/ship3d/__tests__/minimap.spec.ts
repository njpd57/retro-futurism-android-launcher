import { describe, expect, it } from 'vitest';
import { miniMap } from '../minimap';
import { ROOMS, START } from '../world';

describe('miniMap', () =>
{
    const m = miniMap(START, 2);

    it('draws every room inside the map', () =>
    {
        expect(m.rooms).toHaveLength(ROOMS.length);
        for (const r of m.rooms)
            for (const p of r.points.split(' ').map(q => q.split(',').map(Number)))
            {
                expect(p[0]).toBeGreaterThanOrEqual(0);
                expect(p[0]).toBeLessThanOrEqual(m.w);
                expect(p[1]).toBeGreaterThanOrEqual(0);
                expect(p[1]).toBeLessThanOrEqual(m.h);
            }
    });

    it('points the marker the way the camera faces', () =>
    {
        const [tip, right, left] = m.you.split(' ').map(p => p.split(',').map(Number));
        expect(tip[1]).toBeLessThan(right[1]);
        expect(tip[1]).toBeLessThan(left[1]);
        expect(left[0]).toBeLessThan(right[0]);
        const east = miniMap({ ...START, yaw: Math.PI / 2 }, 2).you.split(' ').map(p => p.split(',').map(Number));
        expect(east[0][0]).toBeGreaterThan(east[1][0]);
    });
});
