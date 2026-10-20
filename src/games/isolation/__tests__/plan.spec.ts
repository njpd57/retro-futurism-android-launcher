import { describe, expect, it } from 'vitest';
import { deckFor } from '../decks';
import { doorGroup, newGame } from '../game';
import { planRows } from '../plan';

describe('planRows', () =>
{
    const s = newGame(deckFor('maint')!, () => 0);
    const rows = planRows(s);

    it('draws every row of the deck at its width', () =>
    {
        expect(rows).toHaveLength(s.grid.h);
        for (const r of rows) expect([...r]).toHaveLength(s.grid.w);
    });

    it('shows the player as an arrow facing where they look', () =>
    {
        expect(rows.join('')).toContain('▲');
        expect(planRows({ ...s, player: { ...s.player, yaw: Math.PI / 2 } }).join('')).toContain('►');
    });

    it('marks what is fixed, and never the creature', () =>
    {
        const flat = rows.join('');
        for (const c of ['X', 'T', 'V', 'L', '~', 'E', '*', '+', '█']) expect(flat, c).toContain(c);
        expect(flat).not.toContain('A');
        // a cell taken is no longer marked
        const taken = planRows({ ...s, items: [] }).join('');
        expect(taken).not.toContain('*');
    });

    it('shows a locked door as open once its power is diverted', () =>
    {
        const lock = s.locked[0];
        const opened = planRows({ ...s, locked: [], closed: s.closed.filter(c => !doorGroup(s.grid, lock).includes(c)) });
        expect(opened.join('')).not.toContain('X');
        expect(opened[Math.floor(lock / s.grid.w)][lock % s.grid.w]).toBe('/');
    });
});
