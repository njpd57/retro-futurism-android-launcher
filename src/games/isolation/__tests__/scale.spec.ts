import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../decks';
import { generateDeck } from '../generate';
import { cellAt, distances, neighbour, parseMap, mountWall, type Cell, type Dir, type Grid } from '../grid';
import { scaleDeck, scaleMap } from '../scale';

const count = (g: Grid, c: Cell) => g.cells.filter(x => x === c).length;

const GENERATED = Array.from({ length: 12 }, (_, i) => generateDeck(1000 + i * 7919, 1 + (i % 6)));

describe('scaleMap', () =>
{
    it('doubles both sides and keeps every row the same length', () =>
    {
        const out = scaleMap(['#####', '#P.A#', '#####']);
        expect(out).toHaveLength(6);
        out.forEach(r => expect(r).toHaveLength(10));
    });

    it('turns a one-cell corridor into a two-cell one, walls two thick', () =>
    {
        const out = scaleMap(['#####', '#P.A#', '#####']);
        expect(out.slice(0, 2)).toEqual(['##########', '##########']);
        expect(out[2]).toMatch(/^##[.PA]{6}##$/);
        expect(out[3]).toMatch(/^##[.PA]{6}##$/);
    });

    it('puts a door across the whole corridor, one cell deep', () =>
    {
        const m = parseMap(scaleMap(['#######', '#P.D.A#', '#######']));
        const doors = m.grid.cells.flatMap((c, i) => c === 'door' ? [i] : []);
        expect(doors).toHaveLength(2);
        expect(m.closed).toEqual(doors);
        // same column, two rows: the corridor's whole width
        expect(doors[0] % m.grid.w).toBe(doors[1] % m.grid.w);
        expect(doors[1] - doors[0]).toBe(m.grid.w);
    });

    it('does the same for a door in a north-south corridor', () =>
    {
        const m = parseMap(scaleMap(['###', '#P#', '#D#', '#.#', '#A#', '###']));
        const doors = m.grid.cells.flatMap((c, i) => c === 'door' ? [i] : []);
        expect(doors).toHaveLength(2);
        expect(doors[1] - doors[0]).toBe(1);
    });

    it('keeps a locker against the wall it was mounted on', () =>
    {
        const small = ['#####', '#PLA#', '#####'];
        const m = parseMap(scaleMap(small));
        const i = m.grid.cells.indexOf('locker');
        const wall = mountWall(m.grid, m.closed, i);
        expect(wall).not.toBeNull();
        expect(cellAt(m.grid, neighbour(m.grid, i, wall as Dir))).toBe('wall');
        // north was the original mount wall
        expect(wall).toBe(0);
    });
});

describe.each([...CAMPAIGN.map(d => [d.id, d] as const), ...GENERATED.map(d => [d.id, d] as const)])('scaled deck %s', (_id, deck) =>
{
    const small = parseMap(deck.map);
    const scaled = scaleDeck(deck);
    const m = parseMap(scaled.map);
    const g = m.grid;
    const at = (x: number, y: number) => y * g.w + x;

    it('has twice the size and the same features', () =>
    {
        expect(g.w).toBe(small.grid.w * 2);
        expect(g.h).toBe(small.grid.h * 2);
        expect(m.items).toHaveLength(small.items.length);
        expect(m.loot.map(l => l.kind).sort()).toEqual(small.loot.map(l => l.kind).sort());
        expect(count(g, 'locker')).toBe(count(small.grid, 'locker'));
        expect(count(g, 'terminal')).toBe(count(small.grid, 'terminal'));
        expect(count(g, 'vent')).toBe(count(small.grid, 'vent'));
        expect(m.ash === null).toBe(small.ash === null);
        expect(m.steam).toHaveLength(small.steam.length * 4);
        expect(m.closed).toHaveLength(small.closed.length * 2);
        expect(m.locked).toHaveLength(small.locked.length * 2);
        expect(count(g, 'door')).toBe(count(small.grid, 'door') * 2);
        expect(count(g, 'exit')).toBe(count(small.grid, 'exit') * 4);
    });

    it('stays reachable from the start', () =>
    {
        const all = distances(g, m.start, i => cellAt(g, i) !== 'wall');
        expect(all[g.cells.indexOf('exit')]).toBeGreaterThan(0);
        for (const i of m.items) expect(all[i]).toBeGreaterThan(0);
        for (const l of m.loot) expect(all[l.cell]).toBeGreaterThan(0);
        g.cells.forEach((c, i) => { if (c === 'terminal' || c === 'locker' || c === 'vent') expect(all[i], c).toBeGreaterThan(0); });
    });

    it('leaves no gap beside a door: cells the doors kept apart stay apart', () =>
    {
        // the region of every cell on the small grid, with doors as walls
        const region = new Int32Array(small.grid.cells.length).fill(-1);
        small.grid.cells.forEach((c, i) =>
        {
            if (c === 'wall' || c === 'door' || region[i] >= 0) return;
            distances(small.grid, i, j => cellAt(small.grid, j) !== 'wall' && cellAt(small.grid, j) !== 'door').forEach((d, j) => { if (d >= 0) region[j] = i; });
        });
        const origin = (i: number) => region[Math.floor(Math.floor(i / g.w) / 2) * small.grid.w + Math.floor((i % g.w) / 2)];
        g.cells.forEach((c, i) =>
        {
            if (c === 'wall' || c === 'door') return;
            for (const d of [1, 2] as const)
            {
                const n = neighbour(g, i, d);
                const nc = cellAt(g, n);
                // the free lane of a door block belongs to no region: it only touches one side of the door
                if (n >= 0 && nc !== 'wall' && nc !== 'door' && origin(i) >= 0 && origin(n) >= 0) expect(origin(n), `${i}->${n}`).toBe(origin(i));
            }
        });
    });

    it('keeps lockers, terminals and vents against a wall wherever they were', () =>
    {
        const bare = (grid: Grid, closed: readonly number[]) =>
            grid.cells.filter((c, i) => (c === 'locker' || c === 'terminal' || c === 'vent') && mountWall(grid, closed, i) === null).length;
        expect(bare(g, m.closed)).toBe(bare(small.grid, small.closed));
    });

    it('points signs at floor cells against a wall', () =>
    {
        expect(scaled.signs).toHaveLength(deck.signs.length);
        for (const s of scaled.signs)
        {
            expect(cellAt(g, at(s.x, s.y)), s.text).not.toBe('wall');
            expect(cellAt(g, neighbour(g, at(s.x, s.y), s.dir as Dir)), s.text).toBe('wall');
        }
    });

    it('moves terminals onto terminal cells and their doors onto door cells', () =>
    {
        for (const t of scaled.terminals ?? [])
        {
            expect(cellAt(g, at(t.x, t.y))).toBe('terminal');
            if (t.opens) expect(m.locked).toContain(at(t.opens[0], t.opens[1]));
        }
    });

    it('scales the dark and blackout zones with the map', () =>
    {
        for (const r of [...(scaled.dark ?? []), ...(scaled.blackout?.rects ?? [])])
        {
            expect(r[2]).toBeLessThan(g.w);
            expect(r[3]).toBeLessThan(g.h);
        }
        expect(scaled.dark?.length).toBe(deck.dark?.length);
    });
});
