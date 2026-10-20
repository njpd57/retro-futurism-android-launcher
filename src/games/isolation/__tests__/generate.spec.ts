import { describe, expect, it } from 'vitest';
import { generateDeck, generatedId, newSeed, parseGeneratedId, sizeFor } from '../generate';
import { newGame } from '../game';
import { cellAt, distances, neighbour, parseMap, type Dir } from '../grid';

describe('generated decks', () =>
{
    it('round-trips the id', () =>
    {
        expect(parseGeneratedId(generatedId(4821, 7))).toEqual({ seed: 4821, level: 7 });
        expect(parseGeneratedId('inf:abc:1')).toBeNull();
        expect(parseGeneratedId('inf:100000:1')).toBeNull();
        expect(parseGeneratedId('c')).toBeNull();
    });

    it('is the same deck for the same seed and level, and another for another', () =>
    {
        expect(generateDeck(77, 3).map).toEqual(generateDeck(77, 3).map);
        expect(generateDeck(77, 3).map).not.toEqual(generateDeck(78, 3).map);
        expect(generateDeck(77, 3).map).not.toEqual(generateDeck(77, 4).map);
    });

    it('grows with the level', () =>
    {
        expect(sizeFor(1).w).toBeLessThan(sizeFor(5).w);
        expect(sizeFor(20)).toEqual(sizeFor(5));
        const d = generateDeck(5, 1);
        expect([d.map[0].length, d.map.length]).toEqual([sizeFor(1).w, sizeFor(1).h]);
    });

    it('is always solvable: every cell, terminal, locker and the exit can be reached, 3 cells, one creature', () =>
    {
        for (let seed = 0; seed < 60; seed++)
            for (const level of [1, 2, 3, 4, 5, 8, 12])
            {
                const deck = generateDeck(seed * 1237 + 11, level);
                const label = `seed ${seed} level ${level}`;
                const m = parseMap(deck.map);
                const dist = distances(m.grid, m.start, i => cellAt(m.grid, i) !== 'wall');
                expect(m.items.length, label).toBe(3);
                expect(m.locked, label).toEqual([]);
                const exit = m.grid.cells.indexOf('exit');
                expect(dist[exit], label).toBeGreaterThan(5);
                for (const i of m.items) expect(dist[i], `${label} cell`).toBeGreaterThan(0);
                for (const l of m.loot) expect(dist[l.cell], `${label} ${l.kind}`).toBeGreaterThan(0);
                expect(dist[m.alien], `${label} alien`).toBeGreaterThan(4);
                m.grid.cells.forEach((c, i) => { if (c !== 'wall') expect(dist[i], `${label} ${c}`).toBeGreaterThanOrEqual(0); });
                if (m.ash !== null) expect(dist[m.ash], label).toBeGreaterThan(0);
                expect(m.grid.cells.filter(c => c === 'vent').length, label).toBeGreaterThanOrEqual(2);
                expect(m.grid.cells.filter(c => c === 'terminal').length, label).toBeGreaterThanOrEqual(1);
                // the start is not in the dark
                if (deck.dark) for (const [x0, y0, x1, y1] of deck.dark) expect(1 >= x0 && 1 <= x1 && 1 >= y0 && 1 <= y1, label).toBe(false);
                for (const sg of deck.signs)
                {
                    const i = sg.y * m.grid.w + sg.x;
                    expect(cellAt(m.grid, neighbour(m.grid, i, sg.dir as Dir)), label).toBe('wall');
                }
                expect(newGame(deck, () => 0).phase).toBe('playing');
            }
    });

    it('adds hazards as the levels go', () =>
    {
        const has = (level: number) => { const m = parseMap(generateDeck(321, level).map); return { ash: m.ash !== null, steam: m.steam.length, dark: !!generateDeck(321, level).dark || !!generateDeck(321, level).blackout }; };
        expect(has(1)).toEqual({ ash: false, steam: 0, dark: false });
        expect(has(2).dark).toBe(true);
        expect(has(3).steam).toBeGreaterThan(0);
        expect(has(4).ash).toBe(true);
        expect(generateDeck(321, 6).blackout).toBeTruthy();
    });

    it('has a fresh seed in range', () =>
    {
        expect(newSeed(() => 0)).toBe(0);
        expect(newSeed(() => 0.999999)).toBeLessThanOrEqual(99999);
    });
});
