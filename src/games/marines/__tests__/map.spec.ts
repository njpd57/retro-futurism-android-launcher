import { describe, expect, it } from 'vitest';
import { blocks, distances } from '../../isolation/grid';
import { ARENAS, ARENA_OPERATIONS, parseArena } from '../map';

describe('parseArena', () =>
{
    it('reads the symbols', () =>
    {
        const m = parseArena(['#####', '#VP+#', '#.aD#', '#####']);
        expect(m.grid.w).toBe(5);
        expect(m.grid.h).toBe(4);
        expect(m.start).toBe(7);
        expect(m.spawns).toEqual([6]);
        expect(m.pickups).toEqual([{ cell: 8, kind: 'medkit' }, { cell: 12, kind: 'ammo' }]);
        expect(m.closed).toEqual([13]);
        expect(m.grid.cells[6]).toBe('vent');
        expect(m.grid.cells[13]).toBe('door');
    });

    it('reads grenades and the weapon crates', () =>
    {
        const m = parseArena(['######', '#PgSV#', '#MF..#', '######']);
        expect(m.pickups.map(p => p.kind)).toEqual(['grenade', 'shotgun', 'smartgun', 'flamer']);
        // they are plain floor underneath
        for (const p of m.pickups) expect(m.grid.cells[p.cell]).toBe('floor');
    });

    it('rejects malformed maps', () =>
    {
        expect(() => parseArena(['###', '#V#', '###'])).toThrow(/needs a P/);
        expect(() => parseArena(['###', '#P#', '###'])).toThrow(/needs at least one V/);
        expect(() => parseArena(['###', '#PV', '#?#'])).toThrow(/unknown cell/);
        expect(() => parseArena(['####', '#PV#', '###'])).toThrow(/columns/);
    });
});

describe.each(Object.values(ARENAS))('arena $id', arena =>
{
    const m = parseArena(arena.map);
    const g = m.grid;
    const reach = distances(g, m.start, i => !blocks(g, m.closed, i));

    it('is closed by walls all round', () =>
    {
        for (let x = 0; x < g.w; x++)
        {
            expect(g.cells[x]).toBe('wall');
            expect(g.cells[(g.h - 1) * g.w + x]).toBe('wall');
        }
        for (let y = 0; y < g.h; y++)
        {
            expect(g.cells[y * g.w]).toBe('wall');
            expect(g.cells[y * g.w + g.w - 1]).toBe('wall');
        }
    });

    it('has every open cell reachable from the start', () =>
    {
        const stranded = g.cells.map((c, i) => ({ c, i })).filter(({ c, i }) => c !== 'wall' && reach[i] < 0);
        expect(stranded).toEqual([]);
    });

    it('has reachable grilles, spread out, and pickups', () =>
    {
        expect(m.spawns.length).toBeGreaterThanOrEqual(2);
        for (const v of m.spawns) expect(reach[v]).toBeGreaterThan(0);
        for (const p of m.pickups) expect(reach[p.cell]).toBeGreaterThanOrEqual(0);
        expect(m.pickups.some(p => p.kind === 'ammo')).toBe(true);
        expect(m.pickups.some(p => p.kind === 'medkit')).toBe(true);
    });

    it('has every extra weapon to find, away from the start, and grenades to restock', () =>
    {
        if (arena.id !== ARENA_OPERATIONS.id) return;
        const kinds = m.pickups.map(p => p.kind);
        for (const k of ['shotgun', 'smartgun', 'flamer', 'grenade'] as const) expect(kinds, k).toContain(k);
        for (const p of m.pickups.filter(k => k.kind === 'shotgun' || k.kind === 'smartgun' || k.kind === 'flamer'))
            expect(reach[p.cell], p.kind).toBeGreaterThan(5);
    });

    it('puts every sign on a standable cell with a wall on that side', () =>
    {
        for (const sg of arena.signs)
        {
            const i = sg.y * g.w + sg.x;
            expect(g.cells[i], sg.text).not.toBe('wall');
            const dx = [0, 1, 0, -1][sg.dir];
            const dy = [-1, 0, 1, 0][sg.dir];
            expect(blocks(g, m.closed, (sg.y + dy) * g.w + sg.x + dx), sg.text).toBe(true);
        }
    });
});
