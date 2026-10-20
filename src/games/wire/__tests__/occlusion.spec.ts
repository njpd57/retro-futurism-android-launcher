import { describe, expect, it } from 'vitest';
import { parseMap } from '../../isolation/grid';
import { castRay, depthBuffer, openSpans } from '../occlusion';

// the player at the south end of a corridor going north; a side room opens to the east half way up
const MAP = [
    '#######',
    '#A#...#',
    '###.###',
    '###.###',
    '###.###',
    '###P###',
    '#######',
];
const m = parseMap(MAP);
const G = m.grid;

describe('castRay', () =>
{
    it('measures the distance to the wall straight ahead', () =>
    {
        // from the middle of P (3.5, 5.5) north: the first wall is the top of row 1, y = 1 → 4.5
        expect(castRay(G, [], 3.5, 5.5, 0, -1, 50)).toBeCloseTo(4.5, 5);
        // the walls at the side
        expect(castRay(G, [], 3.5, 5.5, 1, 0, 50)).toBeCloseTo(0.5, 5);
        expect(castRay(G, [], 3.5, 5.5, -1, 0, 50)).toBeCloseTo(0.5, 5);
        expect(castRay(G, [], 3.5, 5.5, 0, 1, 50)).toBeCloseTo(0.5, 5);
    });

    it('scales with the length of the direction vector', () =>
    {
        // a ray twice as long reaches the wall in half the parameter
        expect(castRay(G, [], 3.5, 5.5, 0, -2, 50)).toBeCloseTo(2.25, 5);
    });

    it('goes along diagonals and stops at the first wall', () =>
    {
        // up and to the right from (3.5, 3.5): reaches the wall east of the corridor after 0.5 in x
        expect(castRay(G, [], 3.5, 3.5, 1, -1, 50)).toBeCloseTo(0.5, 5);
        // up and to the right from (3.5, 1.5), inside the room row: it runs east along the row first
        expect(castRay(G, [], 3.5, 1.5, 1, 0, 50)).toBeCloseTo(2.5, 5);
    });

    it('is stopped by a closed door but not by an open one', () =>
    {
        const door = parseMap(['#####', '#A#.#', '###D#', '###.#', '###P#', '#####']);
        const closed = castRay(door.grid, door.closed, 3.5, 4.5, 0, -1, 50);
        expect(closed).toBeCloseTo(1.5, 5);
        const open = castRay(door.grid, [], 3.5, 4.5, 0, -1, 50);
        expect(open).toBeCloseTo(3.5, 5);
    });

    it('returns maxT when nothing is hit in range, and 0 from inside a wall', () =>
    {
        expect(castRay(G, [], 3.5, 5.5, 0, -1, 2)).toBe(2);
        expect(castRay(G, [], 0.5, 0.5, 1, 0, 50)).toBe(0);
        expect(castRay(G, [], -3, 2, 1, 0, 50)).toBe(0);
    });

    it('handles rays that run exactly along a grid line', () =>
    {
        const t = castRay(G, [], 3, 5.5, 0, -1, 50);
        expect(Number.isFinite(t)).toBe(true);
    });
});

describe('depthBuffer and openSpans', () =>
{
    const W = 360;
    const pose = { x: 3.5, y: 5.5, yaw: 0 };

    it('is deepest straight ahead and shallow at the sides of a corridor', () =>
    {
        const buf = depthBuffer(G, [], pose, W, 90, 50);
        expect(buf.depth.length).toBe(90);
        expect(buf.depth[45]).toBeGreaterThan(buf.depth[5]);
        expect(buf.depth[45]).toBeCloseTo(4.5, 0);
        expect(Array.from(buf.depth).every(Number.isFinite)).toBe(true);
    });

    it('shows a sprite in the open and hides it behind the end wall', () =>
    {
        const buf = depthBuffer(G, [], pose, W, 90, 50);
        // 3 cells ahead and centred: open everywhere it spans
        const near = openSpans(buf, 150, 210, 3);
        expect(near).toEqual([150, 210]);
        // beyond the end wall (z = 4.5): hidden
        expect(openSpans(buf, 150, 210, 6)).toEqual([]);
    });

    it('clips a sprite that sticks out past a wall corner', () =>
    {
        // the corridor is one cell wide: a wide sprite 3 cells ahead spills over the walls at its sides
        const buf = depthBuffer(G, [], pose, W, 90, 50);
        const spans = openSpans(buf, 0, W, 3);
        expect(spans.length).toBeGreaterThanOrEqual(2);
        // what remains is the middle part of the screen only
        expect(spans[0]).toBeGreaterThan(0);
        expect(spans[spans.length - 1]).toBeLessThan(W);
        // a sprite far to the side, behind the side wall, is hidden whole
        expect(openSpans(buf, 0, 30, 3)).toEqual([]);
    });

    it('splits the spans where a nearer wall sits in the middle', () =>
    {
        // a pillar one cell and a half ahead blocks the centre of the view but not the sides
        const room = parseMap(['#######', '#A....#', '#..#..#', '#.....#', '#..P..#', '#######']);
        const buf = depthBuffer(room.grid, [], { x: 3.5, y: 4.5, yaw: 0 }, W, 90, 50);
        const spans = openSpans(buf, 0, W, 2.5);
        expect(spans.length).toBe(4);
        expect(spans[0]).toBe(0);
        expect(spans[3]).toBe(W);
        expect(spans[1]).toBeLessThan(W / 2);
        expect(spans[2]).toBeGreaterThan(W / 2);
        // something nearer than the pillar shows everywhere
        expect(openSpans(buf, 0, W, 1)).toEqual([0, W]);
    });
});
