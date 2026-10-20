import { describe, expect, it } from 'vitest';
import { parseArena } from '../map';
import { angleDiff, angleTo, collides, forward, lineClear, moveCircle, rayCircle, right } from '../physics';

const ROOM = parseArena([
    '#######',
    '#V....#',
    '#.....#',
    '#..#..#',
    '#.P...#',
    '#######',
]);
const G = ROOM.grid;

describe('angles', () =>
{
    it('forward and right follow the yaw convention (0 north, clockwise)', () =>
    {
        expect(forward(0)).toEqual([0, -1]);
        const [fx, fy] = forward(Math.PI / 2);
        expect(fx).toBeCloseTo(1);
        expect(fy).toBeCloseTo(0);
        const [rx, ry] = right(0);
        expect(rx).toBeCloseTo(1);
        expect(ry).toBeCloseTo(0);
    });

    it('angleTo looks from one point at another', () =>
    {
        expect(angleTo(0, 0, 0, -5)).toBeCloseTo(0);
        expect(angleTo(0, 0, 5, 0)).toBeCloseTo(Math.PI / 2);
        expect(Math.abs(angleTo(0, 0, 0, 5))).toBeCloseTo(Math.PI);
        expect(angleTo(0, 0, -5, 0)).toBeCloseTo(-Math.PI / 2);
    });

    it('angleDiff wraps to the short way round', () =>
    {
        expect(angleDiff(0.1, -0.1)).toBeCloseTo(0.2);
        expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2);
        expect(angleDiff(7, 0)).toBeCloseTo(7 - 2 * Math.PI);
    });
});

describe('collides and moveCircle', () =>
{
    it('treats walls, the pillar and the outside as solid', () =>
    {
        expect(collides(G, [], 3.5, 2.5, 0.25)).toBe(false);
        expect(collides(G, [], 0.5, 2.5, 0.25)).toBe(true);
        expect(collides(G, [], 3.5, 3.5, 0.25)).toBe(true);
        expect(collides(G, [], -1, 2.5, 0.25)).toBe(true);
        expect(collides(G, [], 20, 2.5, 0.25)).toBe(true);
    });

    it('a body touching the wall at its radius is free, one a hair closer is not', () =>
    {
        expect(collides(G, [], 1.25, 2.5, 0.25)).toBe(false);
        expect(collides(G, [], 1.2, 2.5, 0.25)).toBe(true);
    });

    it('moves freely in the open', () =>
    {
        const m = moveCircle(G, [], 3.5, 2.5, 0.5, 0, 0.25);
        expect(m).toEqual({ x: 4, y: 2.5 });
    });

    it('slides along a wall instead of stopping', () =>
    {
        // heading diagonally into the east wall from (5.5, 2.5): x is stopped, y goes on
        const m = moveCircle(G, [], 5.7, 2.5, 0.3, 0.3, 0.25);
        expect(m.x).toBeCloseTo(5.7);
        expect(m.y).toBeCloseTo(2.8);
    });

    it('does not enter a closed door but passes an open one', () =>
    {
        const door = parseArena(['#####', '#V.D#', '#.P.#', '#####']);
        const closed = door.closed;
        expect(closed.length).toBe(1);
        expect(collides(door.grid, closed, 3.5, 1.5, 0.25)).toBe(true);
        expect(collides(door.grid, [], 3.5, 1.5, 0.25)).toBe(false);
    });
});

describe('lineClear and rayCircle', () =>
{
    it('sees across open floor and not through the pillar', () =>
    {
        expect(lineClear(G, [], 1.5, 4.5, 5.5, 4.5)).toBe(true);
        expect(lineClear(G, [], 1.5, 3.5, 5.5, 3.5)).toBe(false);
        expect(lineClear(G, [], 2.5, 2.5, 2.5, 2.5)).toBe(true);
    });

    it('finds the near side of a circle on the ray', () =>
    {
        expect(rayCircle(0, 0, 1, 0, 5, 0, 1)).toBeCloseTo(4);
        expect(rayCircle(0, 0, 1, 0, 5, 0.5, 1)).toBeCloseTo(5 - Math.sqrt(1 - 0.25));
        expect(rayCircle(0, 0, 1, 0, 5, 2, 1)).toBeNull();
        expect(rayCircle(0, 0, 1, 0, -5, 0, 1)).toBeNull();
        // starting inside the circle: hits at once
        expect(rayCircle(0, 0, 1, 0, 0.2, 0, 1)).toBe(0);
    });
});
