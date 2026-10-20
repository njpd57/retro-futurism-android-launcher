import { describe, expect, it } from 'vitest';
import { deckFor } from '../decks';
import { newGame, playerCell } from '../game';
import { isSavedGame, restore, snapshot } from '../save';
import { seeded } from '../rng';
import { FORWARD, run } from './helpers';

describe('save', () =>
{
    const rng = seeded(37);
    let s = newGame(deckFor('c')!, rng);
    s = run(s, 600, FORWARD, () => false, rng).s;
    s = run(s, 300, { move: 0, strafe: 0, turn: 0.1 }, () => false, rng).s;

    it('survives a trip through JSON and comes back as the same game', () =>
    {
        const stored: unknown = JSON.parse(JSON.stringify(snapshot(s)));
        expect(isSavedGame(stored)).toBe(true);
        const back = restore(stored as ReturnType<typeof snapshot>, rng);
        // the position is kept to two decimals
        expect(back.player.x).toBeCloseTo(s.player.x, 2);
        expect(back.player.y).toBeCloseTo(s.player.y, 2);
        expect(back.player.yaw).toBeCloseTo(s.player.yaw, 2);
        expect(back.player).toMatchObject({ hidden: false, busyMs: 0, holdMs: 0 });
        // positions are kept to two decimals
        const { x, y, heading, ...rest } = s.alien;
        expect(back.alien).toMatchObject(rest);
        expect(back.alien.x).toBeCloseTo(x ?? 0, 2);
        expect(back.alien.y).toBeCloseTo(y ?? 0, 2);
        expect(back.alien.heading).toBeCloseTo(heading ?? 0, 2);
        expect(back).toMatchObject({ deck: 'c', closed: s.closed, items: s.items, collected: s.collected, timeMs: s.timeMs, phase: 'playing' });
        expect(back.tracker.raised).toBe(false);
    });

    it('keeps the bag, the tools thrown and the burns', () =>
    {
        const tooled = {
            ...s,
            bag: { scrap: 2, wires: 1, chems: 3, decoys: 1, flares: 2, fuel: 1, flamer: true },
            decoys: [{ cell: playerCell(s), ms: 4000, pulseMs: 300 }],
            flares: [{ cell: playerCell(s), ms: 12000, lit: [playerCell(s), playerCell(s) + 1] }],
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
        const crawling = { ...s, alien: { ...s.alien, vent: { from: playerCell(s), to: s.alien.cell, ms: 1200, totalMs: 4000 } } };
        const stored: unknown = JSON.parse(JSON.stringify(snapshot(crawling)));
        expect(isSavedGame(stored)).toBe(true);
    });

    it('rejects anything damaged or from another version', () =>
    {
        const good = snapshot(s);
        const bad: unknown[] = [
            null, 'x', [], {},
            { ...good, v: 1 },
            { ...good, v: 3 },
            { ...good, deck: 'z' },
            { ...good, player: { ...good.player, x: 0.5 } },
            { ...good, player: { ...good.player, x: -4 } },
            { ...good, player: { ...good.player, yaw: 'north' } },
            { ...good, player: { cell: 8, dir: 1, hidden: false } },
            { ...good, alien: { ...good.alien, mode: 'sleep' } },
            { ...good, alien: { ...good.alien, stepMs: 'soon' } },
            { ...good, alien: { ...good.alien, vent: { from: 0, to: 70, ms: 1, totalMs: 1 } } },
            { ...good, items: [99999] },
            { ...good, hides: { 3: 'a' } },
            { ...good, bag: { ...good.bag, scrap: 9 } },
            { ...good, bag: null },
            { ...good, loot: [{ cell: 0, kind: 'scrap' }] },
            { ...good, loot: [{ cell: playerCell(s), kind: 'gold' }] },
            { ...good, decoys: [{ cell: 0, ms: 1, pulseMs: 1 }] },
            { ...good, flares: [{ cell: playerCell(s), ms: 1, lit: [99999] }] },
            { ...good, burns: 'many' },
            { ...good, alien: { ...good.alien, fleeMs: null } },
        ];
        for (const v of bad) expect(isSavedGame(v), JSON.stringify(v)?.slice(0, 80)).toBe(false);
    });
});
