import { describe, expect, it } from 'vitest';
import { parseMap } from '../grid';
import { canSee, cellOf, hears, sightRange, SENSES, stepLoudness } from '../senses';

const map = (rows: string[]) => parseMap(rows);
const EAST = Math.PI / 2;
const OPTS = { range: 14, fov: SENSES.alienFov };

// a corridor along the row with a room above its east end
const HALL = map([
    '###########',
    '#.......#.#',
    '#P......D.#',
    '#.......#A#',
    '###########',
]);

describe('canSee', () =>
{
    it('sees along an open line inside range and view', () =>
    {
        expect(canSee(HALL.grid, HALL.closed, { x: 1.5, y: 2.5, heading: EAST }, { x: 6.5, y: 2.5 }, OPTS)).toBe(true);
    });

    it('does not see beyond its range', () =>
    {
        expect(canSee(HALL.grid, HALL.closed, { x: 1.5, y: 2.5, heading: EAST }, { x: 6.5, y: 2.5 }, { ...OPTS, range: 4 })).toBe(false);
    });

    it('does not see what is behind it, but does see what is right on top of it', () =>
    {
        const eye = { x: 4.5, y: 2.5, heading: EAST };
        expect(canSee(HALL.grid, HALL.closed, eye, { x: 1.5, y: 2.5 }, OPTS)).toBe(false);
        expect(canSee(HALL.grid, HALL.closed, eye, { x: 3.8, y: 2.5 }, OPTS)).toBe(true);
    });

    it('respects the width of the view', () =>
    {
        const eye = { x: 1.5, y: 1.5, heading: EAST };
        // 3 cells east and 2 down: about 34° off the heading
        const target = { x: 4.5, y: 3.5 };
        expect(canSee(HALL.grid, HALL.closed, eye, target, OPTS)).toBe(true);
        expect(canSee(HALL.grid, HALL.closed, eye, target, { ...OPTS, fov: (20 * Math.PI) / 180 })).toBe(false);
    });

    it('is stopped by a closed door and not by an open one', () =>
    {
        const eye = { x: 6.5, y: 2.5, heading: EAST };
        const t = { x: 9.5, y: 2.5 };
        expect(canSee(HALL.grid, HALL.closed, eye, t, OPTS)).toBe(false);
        expect(canSee(HALL.grid, [], eye, t, OPTS)).toBe(true);
    });

    it('never sees a hidden player', () =>
    {
        expect(canSee(HALL.grid, HALL.closed, { x: 1.5, y: 2.5, heading: EAST }, { x: 3.5, y: 2.5 }, { ...OPTS, hidden: true })).toBe(false);
    });

    it('does not see round a corner', () =>
    {
        const m = map([
            '#######',
            '#A..#.#',
            '###.#.#',
            '#P..#.#',
            '#######',
        ]);
        // the creature looks south-east across the wall at the player
        expect(canSee(m.grid, m.closed, { x: 1.5, y: 1.5, heading: EAST }, { x: 1.5, y: 3.5 }, { ...OPTS, fov: Math.PI })).toBe(false);
    });

    it('does not see through a diagonal pinch the body could not pass', () =>
    {
        const m = map([
            '#####',
            '#A#.#',
            '##..#',
            '#P..#',
            '#####',
        ]);
        // the straight line runs through the point where the two wall corners touch
        const eye = { x: 1.5, y: 1.5, heading: Math.PI / 4 };
        expect(canSee(m.grid, m.closed, eye, { x: 2.5, y: 2.5 }, { ...OPTS, fov: Math.PI })).toBe(false);
    });

    it('is shortened by sneaking', () =>
    {
        expect(sightRange(14, 1)).toBe(14);
        expect(sightRange(14, 0.3)).toBeCloseTo(8.4);
        expect(sightRange(14, 0)).toBe(14);
    });
});

describe('hears', () =>
{
    const p = (x: number, y: number) => ({ x, y });

    it('hears a sound within its loudness', () =>
    {
        expect(hears(HALL.grid, HALL.closed, p(1.5, 2.5), p(5.5, 2.5), 5, 4)).toBe(true);
        expect(hears(HALL.grid, HALL.closed, p(1.5, 2.5), p(5.5, 2.5), 3, 4)).toBe(false);
    });

    it('is muffled by a closed door', () =>
    {
        expect(hears(HALL.grid, HALL.closed, p(7.5, 2.5), p(9.5, 2.5), 4, 4)).toBe(false);
        expect(hears(HALL.grid, HALL.closed, p(7.5, 2.5), p(9.5, 2.5), 7, 4)).toBe(true);
        expect(hears(HALL.grid, [], p(7.5, 2.5), p(9.5, 2.5), 4, 4)).toBe(true);
    });

    it('goes round walls by the way through the deck, not through them', () =>
    {
        const m = map([
            '#######',
            '#A...P#',
            '#.###.#',
            '#.....#',
            '#######',
        ]);
        expect(hears(m.grid, m.closed, p(1.5, 1.5), p(1.5, 3.5), 2, 4)).toBe(true);
        // straight across the wall is 2 cells, but the sound has to walk 12
        expect(hears(m.grid, m.closed, p(2.5, 1.5), p(2.5, 3.5), 3, 4)).toBe(false);
    });

    it('hears nothing from outside the deck or with no loudness', () =>
    {
        expect(hears(HALL.grid, HALL.closed, p(-1, 2), p(5.5, 2.5), 9, 4)).toBe(false);
        expect(hears(HALL.grid, HALL.closed, p(1.5, 2.5), p(2.5, 2.5), 0, 4)).toBe(false);
    });
});

describe('helpers', () =>
{
    it('finds the cell holding a point', () =>
    {
        expect(cellOf(HALL.grid, 2.9, 1.1)).toBe(1 * 11 + 2);
        expect(cellOf(HALL.grid, -0.1, 1)).toBe(-1);
        expect(cellOf(HALL.grid, 11, 1)).toBe(-1);
    });

    it('makes a light push quieter', () =>
    {
        expect(stepLoudness(4, 1)).toBe(4);
        expect(stepLoudness(4, 0.25)).toBe(1);
        expect(stepLoudness(4, 0)).toBe(0);
    });
});
