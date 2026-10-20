import { describe, expect, it } from 'vitest';
import { DECK_C } from '../decks';
import { newGame, reduce, step } from '../game';
import { isSavedGame, restore, snapshot } from '../save';
import { seeded } from '../rng';

describe('save', () =>
{
    const rng = seeded(37);
    let s = newGame(DECK_C, rng);
    for (const input of ['forward', 'forward', 'right'] as const)
        s = step(reduce(s, input).state, 1000, rng).state;

    it('survives a trip through JSON and comes back as the same game', () =>
    {
        const stored: unknown = JSON.parse(JSON.stringify(snapshot(s)));
        expect(isSavedGame(stored)).toBe(true);
        const back = restore(stored as ReturnType<typeof snapshot>, rng);
        expect(back.player).toEqual({ ...s.player, busyMs: 0 });
        expect(back.alien).toEqual(s.alien);
        expect(back).toMatchObject({ deck: 'c', closed: s.closed, items: s.items, collected: s.collected, timeMs: s.timeMs, phase: 'playing' });
        expect(back.tracker.raised).toBe(false);
    });

    it('keeps the bag, the tools thrown and the burns', () =>
    {
        const tooled = {
            ...s,
            bag: { scrap: 2, wires: 1, chems: 3, decoys: 1, flares: 2, fuel: 1, flamer: true },
            decoys: [{ cell: 20, ms: 4000, pulseMs: 300 }],
            flares: [{ cell: 21, ms: 12000, lit: [20, 21, 22] }],
            burns: 2,
            alien: { ...s.alien, mode: 'flee' as const, fleeMs: 3000 },
        };
        const stored: unknown = JSON.parse(JSON.stringify(snapshot(tooled)));
        expect(isSavedGame(stored)).toBe(true);
        const back = restore(stored as ReturnType<typeof snapshot>, rng);
        expect(back).toMatchObject({ bag: tooled.bag, decoys: tooled.decoys, flares: tooled.flares, burns: 2, loot: s.loot });
        expect(back.alien).toMatchObject({ mode: 'flee', fleeMs: 3000 });
        expect(back.flameMs).toBe(0);
    });

    it('keeps a creature crawling in the ducts', () =>
    {
        const crawling = { ...s, alien: { ...s.alien, vent: { from: 30, to: 70, ms: 1200, totalMs: 4000 } } };
        const stored: unknown = JSON.parse(JSON.stringify(snapshot(crawling)));
        expect(isSavedGame(stored)).toBe(true);
    });

    it('rejects anything damaged or from another version', () =>
    {
        const good = snapshot(s);
        const bad: unknown[] = [
            null, 'x', [], {},
            { ...good, v: 1 },
            { ...good, deck: 'z' },
            { ...good, player: { ...good.player, cell: 0 } },
            { ...good, player: { ...good.player, dir: 7 } },
            { ...good, alien: { ...good.alien, mode: 'sleep' } },
            { ...good, alien: { ...good.alien, stepMs: 'soon' } },
            { ...good, alien: { ...good.alien, vent: { from: 0, to: 70, ms: 1, totalMs: 1 } } },
            { ...good, items: [99999] },
            { ...good, hides: { 3: 'a' } },
            { ...good, bag: { ...good.bag, scrap: 9 } },
            { ...good, bag: null },
            { ...good, loot: [{ cell: 0, kind: 'scrap' }] },
            { ...good, loot: [{ cell: good.player.cell, kind: 'gold' }] },
            { ...good, decoys: [{ cell: 0, ms: 1, pulseMs: 1 }] },
            { ...good, flares: [{ cell: good.player.cell, ms: 1, lit: [99999] }] },
            { ...good, burns: 'many' },
            { ...good, alien: { ...good.alien, fleeMs: null } },
        ];
        for (const v of bad) expect(isSavedGame(v), JSON.stringify(v)?.slice(0, 80)).toBe(false);
    });
});
