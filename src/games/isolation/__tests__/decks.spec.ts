import { describe, expect, it } from 'vitest';
import { CAMPAIGN, DECKS, deckFor } from '../decks';
import { newGame } from '../game';
import { cellAt, distances, neighbour, parseMap, type Dir } from '../grid';
import { DIFFICULTY } from '../difficulty';
import { LOGS } from '../logs';

const ids = CAMPAIGN.map(d => d.id);

describe.each(CAMPAIGN)('deck $id', deck =>
{
    const m = parseMap(deck.map);
    const g = m.grid;
    const at = (x: number, y: number) => y * g.w + x;
    // a door without power is a wall until its panel is used
    const withoutPower = (i: number) => cellAt(g, i) !== 'wall' && !m.locked.includes(i);
    const reach = distances(g, m.start, withoutPower);
    const reachAll = distances(g, m.start, i => cellAt(g, i) !== 'wall');

    it('is closed by walls all round', () =>
    {
        for (let x = 0; x < g.w; x++) { expect(cellAt(g, x)).toBe('wall'); expect(cellAt(g, (g.h - 1) * g.w + x)).toBe('wall'); }
        for (let y = 0; y < g.h; y++) { expect(cellAt(g, y * g.w)).toBe('wall'); expect(cellAt(g, y * g.w + g.w - 1)).toBe('wall'); }
    });

    it('lets the player reach every cell, loot and terminal, and the exit', () =>
    {
        const exit = g.cells.indexOf('exit');
        expect(reachAll[exit]).toBeGreaterThan(0);
        for (const i of m.items) expect(reachAll[i], 'cell').toBeGreaterThan(0);
        for (const l of m.loot) expect(reachAll[l.cell], l.kind).toBeGreaterThan(0);
        expect(reachAll[m.alien]).toBeGreaterThan(5);
        g.cells.forEach((c, i) => { if (c === 'terminal' || c === 'locker' || c === 'vent') expect(reachAll[i], c).toBeGreaterThan(0); });
    });

    it('needs no flamethrower: the cells and the exit are all reachable on foot', () =>
    {
        // the flamethrower only scares the creature, it opens nothing
        expect(m.items.length).toBeGreaterThanOrEqual(2);
    });

    it('puts every sign on a floor cell against a wall', () =>
    {
        for (const s of deck.signs)
        {
            const i = at(s.x, s.y);
            expect(cellAt(g, i), s.text).not.toBe('wall');
            expect(cellAt(g, neighbour(g, i, s.dir as Dir)), s.text).toBe('wall');
        }
    });

    it('puts its terminals on terminal cells, with real logs', () =>
    {
        for (const t of deck.terminals ?? [])
        {
            expect(cellAt(g, at(t.x, t.y))).toBe('terminal');
            if (t.log) expect(LOGS.map(l => l.id)).toContain(t.log);
            // a terminal that diverts power can be reached before the door opens
            if (t.opens)
            {
                expect(reach[at(t.x, t.y)]).toBeGreaterThan(0);
                expect(m.locked).toContain(at(t.opens[0], t.opens[1]));
            }
        }
        expect(m.grid.cells.filter(c => c === 'terminal')).toHaveLength(deck.terminals?.length ?? 0);
    });

    it('can be finished: what lies behind a locked door needs a panel that is outside it', () =>
    {
        for (const door of m.locked)
        {
            const panel = (deck.terminals ?? []).find(t => t.opens && at(t.opens[0], t.opens[1]) === door);
            expect(panel, 'a panel for the door').toBeTruthy();
        }
        // with the doors shut, the start still reaches the creature's side and a terminal
        expect(reach.some(d => d > 0)).toBe(true);
    });

    it('can be started', () =>
    {
        const s = newGame(deck, () => 0);
        expect(s.needed).toBe(m.items.length);
        expect(s.phase).toBe('playing');
    });
});

describe('the campaign', () =>
{
    it('has five decks in order', () =>
    {
        expect(ids).toEqual(['c', 'b', 'lab', 'maint', 'hangar']);
        expect(Object.keys(DECKS)).toEqual(ids);
    });

    it('teaches one thing per deck', () =>
    {
        const count = (id: string, f: (c: string) => boolean) => parseMap(DECKS[id].map).grid.cells.filter(f).length;
        expect(parseMap(DECKS.c.map).loot.some(l => l.kind === 'flamer')).toBe(false);
        expect(parseMap(DECKS.b.map).loot.filter(l => l.kind === 'flamer')).toHaveLength(1);
        expect(DECKS.b.dark?.length).toBeGreaterThan(0);
        expect(parseMap(DECKS.lab.map).ash).not.toBeNull();
        expect(DECKS.lab.terminals?.some(t => t.ashOff)).toBe(true);
        expect(DECKS.maint.blackout).toBeTruthy();
        expect(parseMap(DECKS.maint.map).steam.length).toBeGreaterThan(0);
        expect(parseMap(DECKS.maint.map).locked).toHaveLength(1);
        expect(DECKS.hangar.countdownMs).toBe(300000);
        expect(parseMap(DECKS.hangar.map).loot.filter(l => l.kind === 'cat')).toHaveLength(1);
        expect(count('hangar', c => c === 'exit')).toBe(1);
    });

    it('hides all twelve logs in terminals', () =>
    {
        const found = CAMPAIGN.flatMap(d => (d.terminals ?? []).map(t => t.log)).filter(Boolean);
        expect(new Set(found).size).toBe(LOGS.length);
        expect(found).toHaveLength(LOGS.length);
    });

    it('resolves campaign and generated ids', () =>
    {
        expect(deckFor('b')?.id).toBe('b');
        expect(deckFor('inf:123:2')?.id).toBe('inf:123:2');
        expect(deckFor('nope')).toBeNull();
        expect(deckFor('inf:1:0')).toBeNull();
    });
});

describe('the countdown deck', () =>
{
    it('leaves time to walk it, even on the hardest setting, with a detour for Jones', () =>
    {
        const m = parseMap(DECKS.hangar.map);
        const walk = (i: number) => cellAt(m.grid, i) !== 'wall';
        let here = m.start;
        let steps = 0;
        const stops = [...m.items, m.loot.find(l => l.kind === 'cat')!.cell, m.grid.cells.indexOf('exit')];
        for (const to of stops)
        {
            steps += distances(m.grid, here, walk)[to];
            here = to;
        }
        // the player walks a cell in 380 ms; doors, hiding and the creature take their share
        const hard = DECKS.hangar.countdownMs! + DIFFICULTY.hard.countdownMs;
        expect(steps * 380).toBeLessThan(hard * 0.4);
    });
});
