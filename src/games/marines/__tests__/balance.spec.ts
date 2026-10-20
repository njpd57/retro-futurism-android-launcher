import { describe, expect, it } from 'vitest';
import { seeded } from '../../isolation/rng';
import { NO_CONTROLS, act, newGame, step, type Controls, type MarinesState } from '../game';
import { ARENAS } from '../map';
import { angleDiff, angleTo, lineClear } from '../physics';

/**
 * A mediocre bot: it turns to the nearest creature in plain view and fires, backs off when one is close, sets its
 * turrets down at the start of each wave and reloads when it can. It picks nothing up and seals nothing.
 * The numbers it reaches are not a target, only a guard against a change that makes the game trivial or impossible.
 */
function play(arena: string, seed: number, useTurrets: boolean): { wave: number; kills: number; seconds: number }
{
    const rng = seeded(seed);
    let s: MarinesState = newGame(ARENAS[arena]);
    let lastWave = 0;
    const dt = 50;
    for (let t = 0; t < 12 * 60 * 1000 && s.phase === 'playing'; t += dt)
    {
        if (s.wave.n !== lastWave && s.wave.phase === 'rest')
        {
            lastWave = s.wave.n;
            if (useTurrets) { s = act(s, 'turret').state; s = act(s, 'turret').state; }
        }
        const p = s.player;
        let target = null as null | { x: number; y: number; d: number };
        for (const e of s.enemies)
        {
            if (e.clung) continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if ((!target || d < target.d) && lineClear(s.grid, s.closed, p.x, p.y, e.x, e.y)) target = { x: e.x, y: e.y, d };
        }
        const c: Controls = { ...NO_CONTROLS };
        if (target)
        {
            const off = angleDiff(angleTo(p.x, p.y, target.x, target.y), p.yaw);
            c.turn = Math.max(-0.2, Math.min(0.2, off));
            c.fire = Math.abs(off) < 0.15;
            if (target.d < 2) c.forward = -1;
        }
        else if (s.enemies.length) c.turn = 0.08;
        if (p.mag < 10 && p.reserve > 0) s = act(s, 'reload').state;
        s = step(s, dt, c, rng).state;
    }
    return { wave: s.wave.n, kills: s.kills, seconds: s.timeMs / 1000 };
}

describe('balance', () =>
{
    it.each(Object.keys(ARENAS))('a mediocre bot gets somewhere in %s, but not everywhere', arena =>
    {
        const runs = [1, 2, 3].map(seed => play(arena, seed, true));
        const avg = runs.reduce((a, r) => a + r.wave, 0) / runs.length;
        console.log(arena, JSON.stringify(runs), 'avg wave', avg.toFixed(1));
        expect(avg).toBeGreaterThanOrEqual(2);
        expect(avg).toBeLessThan(15);
    });

    it('the turrets help', () =>
    {
        const withT = [1, 2, 3, 4].map(seed => play('hangar', seed, true).kills).reduce((a, b) => a + b, 0);
        const without = [1, 2, 3, 4].map(seed => play('hangar', seed, false).kills).reduce((a, b) => a + b, 0);
        console.log('hangar kills with', withT, 'without', without);
        expect(withT).toBeGreaterThan(without);
    });
});
