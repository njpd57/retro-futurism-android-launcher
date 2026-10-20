import { describe, expect, it } from 'vitest';
import { CAMPAIGN, deckFor } from '../decks';
import { generatedId } from '../generate';
import { centreOf, newGame, playerCell, step, type Controls, type GameState } from '../game';
import { cellAt, cellX, cellY, distances, neighbour, type Dir } from '../grid';
import { angleDiff, angleTo } from '../../wire/physics';

/**
 * A bot that walks each deck with the controls alone: to every power cell, then to the shuttle. It proves the body
 * fits through every corridor, door and corner of the scaled decks. Doors are open, Ash is gone and the creature is kept in the
 * ducts, so only the walking is tested.
 */

const rng = () => 0;

function pathTo(s: GameState, to: number): number[]
{
    const g = s.grid;
    const from = playerCell(s);
    const dist = distances(g, to, i => cellAt(g, i) !== 'wall');
    const path = [from];
    for (let cell = from; cell !== to;)
    {
        let best = -1;
        for (let d = 0; d < 4; d++)
        {
            const n = neighbour(g, cell, d as Dir);
            if (n >= 0 && dist[n] >= 0 && (best < 0 || dist[n] < dist[best])) best = n;
        }
        if (best < 0 || dist[best] >= dist[cell]) return [];
        path.push(best);
        cell = best;
    }
    return path;
}

/** Controls that head for the centre of `cell`, turning first when the bearing is far off. */
function steer(s: GameState, cell: number): Controls
{
    const c = centreOf(s.grid, cell);
    const diff = angleDiff(angleTo(s.player.x, s.player.y, c.x, c.y), s.player.yaw);
    const turn = Math.max(-0.25, Math.min(0.25, diff));
    return { move: Math.abs(diff) < 0.6 ? 1 : 0, strafe: 0, turn };
}

function walkDeck(id: string): { won: boolean; ms: number }
{
    const deck = deckFor(id)!;
    let s = newGame(deck, rng);
    s = { ...s, closed: [], locked: [], ash: null };
    const park = { ...s.alien, vent: { from: s.alien.cell, to: s.alien.cell, ms: 1e9, totalMs: 1e9 } };
    let path: number[] = [];
    let goal = -1;
    for (let tick = 0; tick < 24000 && s.phase === 'playing'; tick++)
    {
        const exit = s.grid.cells.indexOf('exit');
        const target = s.items.length ? s.items.reduce((a, b) => distances(s.grid, playerCell(s), i => cellAt(s.grid, i) !== 'wall')[a] <= distances(s.grid, playerCell(s), i => cellAt(s.grid, i) !== 'wall')[b] ? a : b) : exit;
        if (target !== goal || tick % 20 === 0) { goal = target; path = pathTo(s, target); }
        // aim a cell or two ahead, as far as a straight line is open
        const here = playerCell(s);
        const idx = path.indexOf(here);
        const ahead = path[Math.min(path.length - 1, (idx < 0 ? 0 : idx) + 1)];
        const controls = ahead === undefined ? { move: 0, strafe: 0, turn: 0 } : steer(s, ahead);
        const r = step({ ...s, alien: park }, 50, rng, controls);
        s = r.state;
    }
    return { won: s.phase === 'won', ms: s.timeMs };
}

describe('walking every deck with the controls', () =>
{
    it.each(CAMPAIGN.map(d => d.id))('reaches the shuttle in %s', id =>
    {
        const r = walkDeck(id);
        expect(r.won, `${id} after ${Math.round(r.ms / 1000)} s`).toBe(true);
    });

    it.each([1, 2, 3, 4, 5, 6, 7, 8])('reaches the shuttle in endless sector %i', level =>
    {
        for (const seed of [11, 4242, 90001 % 100000])
        {
            const r = walkDeck(generatedId(seed, level));
            expect(r.won, `seed ${seed} level ${level} after ${Math.round(r.ms / 1000)} s`).toBe(true);
        }
    });
});

// keep the helper imports honest
void cellX; void cellY;
