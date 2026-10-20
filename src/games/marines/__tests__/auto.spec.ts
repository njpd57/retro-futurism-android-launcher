import { describe, expect, it } from 'vitest';
import { spawnEnemy } from '../enemies';
import { inSights, newGame, type MarinesState } from '../game';
import type { ArenaDef } from '../map';

const ROOM: ArenaDef = {
    id: 'auto', title: 'PRUEBA', startDir: 1, signs: [], briefing: [],
    map: [
        '#############',
        '#V..........#',
        '#...........#',
        '#.P.....#...#',
        '#...........#',
        '#...........#',
        '#############',
    ],
};

// the player at (2.5, 3.5) looks east
function facing(x: number, y: number): MarinesState
{
    const s = newGame(ROOM);
    return { ...s, marines: [], enemies: [{ ...spawnEnemy(1, 'drone', s.grid, 14), x, y }] };
}

describe('inSights', () =>
{
    it('is true for a creature dead ahead, in range and in view', () =>
    {
        expect(inSights(facing(6.5, 3.5))).toBe(true);
    });

    it('is false for one off to the side, out of range, behind a wall or when nothing is there', () =>
    {
        expect(inSights(facing(6.5, 5.2))).toBe(false);
        expect(inSights(facing(2.5, 1.5))).toBe(false);
        expect(inSights(facing(11.5, 3.5))).toBe(false);
        expect(inSights({ ...facing(10.5, 3.5) })).toBe(false);
        expect(inSights({ ...facing(6.5, 3.5), enemies: [] })).toBe(false);
    });

    it('does not count a facehugger already on the face, nor anything once the game is over', () =>
    {
        const s = facing(6.5, 3.5);
        expect(inSights({ ...s, enemies: s.enemies.map(e => ({ ...e, clung: true })) })).toBe(false);
        expect(inSights({ ...s, phase: 'dead' })).toBe(false);
    });

    it('works for the flamethrower, whose aim assist is nil, with the least cone', () =>
    {
        const s = facing(5.5, 3.5);
        expect(inSights({ ...s, player: { ...s.player, weapon: 'flamer' } })).toBe(true);
    });
});
