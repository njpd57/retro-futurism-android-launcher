import { describe, expect, it } from 'vitest';
import { DECK_C } from '../decks';
import { blocks, cellAt, distances, lineOfSight, neighbour, nextStep, parseMap, rectMask, soundDistance, turn, type Dir } from '../grid';
import { seeded } from '../rng';

const corridor = parseMap([
    '#######',
    '#P..D.#',
    '#.###A#',
    '#######',
]);

describe('parseMap', () =>
{
    it('reads cells, start, alien, items and closed doors', () =>
    {
        const m = parseMap(['#####', '#P*A#', '#L.E#', '#####']);
        expect(m.grid).toMatchObject({ w: 5, h: 4 });
        expect(m.start).toBe(6);
        expect(m.alien).toBe(8);
        expect(m.items).toEqual([7]);
        expect(cellAt(m.grid, 11)).toBe('locker');
        expect(cellAt(m.grid, 13)).toBe('exit');
        expect(corridor.closed).toEqual([11]);
    });

    it('reads the loot on the floor, which stays walkable', () =>
    {
        const m = parseMap(['######', '#Pswc#', '#fA.##', '######']);
        expect(m.loot).toEqual([
            { cell: 8, kind: 'scrap' }, { cell: 9, kind: 'wires' }, { cell: 10, kind: 'chems' }, { cell: 13, kind: 'flamer' },
        ]);
        expect(m.loot.every(l => cellAt(m.grid, l.cell) === 'floor')).toBe(true);
    });

    it('marks the cells in rectangles', () =>
    {
        const g = parseMap(['#####', '#P.A#', '#####']).grid;
        const mask = rectMask(g, [[1, 1, 2, 1], [4, 2, 4, 2]]);
        expect(mask.map(Number).join('')).toBe('000000110000001');
        expect(rectMask(g, []).some(Boolean)).toBe(false);
    });

    it('rejects ragged rows, unknown cells and maps without P or A', () =>
    {
        expect(() => parseMap(['###', '##'])).toThrow();
        expect(() => parseMap(['#P?A#'])).toThrow();
        expect(() => parseMap(['#..#'])).toThrow();
    });
});

describe('grid helpers', () =>
{
    const g = corridor.grid;

    it('finds neighbours and treats the outside and closed doors as solid', () =>
    {
        expect(neighbour(g, 8, 1)).toBe(9);
        expect(neighbour(g, 0, 0)).toBe(-1);
        expect(blocks(g, corridor.closed, 11)).toBe(true);
        expect(blocks(g, [], 11)).toBe(false);
        expect(blocks(g, [], -1)).toBe(true);
        expect(turn(0, -1)).toBe(3);
        expect(turn(3, 2)).toBe(1);
    });

    it('walks shortest paths', () =>
    {
        const open = (i: number) => !blocks(g, [], i);
        expect(distances(g, 8, open)[12]).toBe(4);
        expect(nextStep(g, 8, 12, open)).toBe(9);
        expect(nextStep(g, 8, 8, open)).toBe(8);
        expect(nextStep(g, 8, 12, i => !blocks(g, corridor.closed, i))).toBe(-1);
    });

    it('muffles sound through closed doors', () =>
    {
        expect(soundDistance(g, [], 8, 12, 4)).toBe(4);
        expect(soundDistance(g, [11], 8, 12, 4)).toBe(8);
    });

    it('sees along a row until something blocks', () =>
    {
        expect(lineOfSight(g, [], 8, 10, 7)).toBe(true);
        expect(lineOfSight(g, [11], 8, 12, 7)).toBe(false);
        expect(lineOfSight(g, [], 8, 12, 3)).toBe(false);
        expect(lineOfSight(g, [], 8, 19, 7)).toBe(false);
    });
});

describe('DECK_C', () =>
{
    const m = parseMap(DECK_C.map);
    const g = m.grid;
    const walk = (i: number) => cellAt(g, i) !== 'wall';

    it('lets the player reach every item and the exit (doors can be opened)', () =>
    {
        const dist = distances(g, m.start, walk);
        expect(m.items.length).toBe(3);
        for (const i of m.items) expect(dist[i]).toBeGreaterThan(0);
        const exit = g.cells.indexOf('exit');
        expect(dist[exit]).toBeGreaterThan(0);
        expect(dist[m.alien]).toBeGreaterThan(5);
    });

    it('puts every sign on a floor cell against a wall', () =>
    {
        for (const s of DECK_C.signs)
        {
            const i = s.y * g.w + s.x;
            expect(cellAt(g, i), s.text).not.toBe('wall');
            expect(cellAt(g, neighbour(g, i, s.dir as Dir)), s.text).toBe('wall');
        }
    });
});

describe('seeded', () =>
{
    it('repeats a sequence for a seed and stays in [0, 1)', () =>
    {
        const a = seeded(42);
        const b = seeded(42);
        const values = Array.from({ length: 50 }, () => a());
        expect(Array.from({ length: 50 }, () => b())).toEqual(values);
        expect(values.every(v => v >= 0 && v < 1)).toBe(true);
        expect(seeded(7)()).not.toBe(values[0]);
    });
});
