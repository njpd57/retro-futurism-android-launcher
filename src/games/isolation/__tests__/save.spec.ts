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
            { ...good, v: 2 },
            { ...good, deck: 'z' },
            { ...good, player: { ...good.player, cell: 0 } },
            { ...good, player: { ...good.player, dir: 7 } },
            { ...good, alien: { ...good.alien, mode: 'sleep' } },
            { ...good, alien: { ...good.alien, stepMs: 'soon' } },
            { ...good, alien: { ...good.alien, vent: { from: 0, to: 70, ms: 1, totalMs: 1 } } },
            { ...good, items: [99999] },
            { ...good, hides: { 3: 'a' } },
        ];
        for (const v of bad) expect(isSavedGame(v), JSON.stringify(v)?.slice(0, 80)).toBe(false);
    });
});
