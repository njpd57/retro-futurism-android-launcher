import type { Grid } from '../isolation/grid';
import type { Rng } from '../isolation/rng';
import type { Enemy, EnemyKind } from './enemies';

export const WAVES = {
    /** quiet before the first wave, and between waves (the pickups are put back) */
    firstRestMs: 4000,
    restMs: 9000,
    /** the creatures stay at least this far from the player when they come out */
    spawnClear: 6,
};

/** Creatures in wave `n`. */
export const waveSize = (n: number) => 4 + 2 * n;

/** Time between creatures coming out: it speeds up with the waves. */
export const spawnIntervalMs = (n: number) => Math.max(500, 1300 - 60 * n);

/** Most creatures alive at once, so a wave arrives in pushes and not all at once. */
export const aliveCap = (n: number) => Math.min(14, 8 + n);

export const waveBonus = (n: number) => 250 * n;

/** Share of each kind in wave `n`: the rest are drones. Runners join at wave 3 and huggers at wave 4. */
export function mix(n: number): { runner: number; hugger: number }
{
    return {
        runner: n >= 3 ? Math.min(0.4, 0.15 + 0.05 * (n - 3)) : 0,
        hugger: n >= 4 ? Math.min(0.2, 0.08 + 0.02 * (n - 4)) : 0,
    };
}

/** The kind of the next creature out of a grille. */
export function pickKind(n: number, rng: Rng): EnemyKind
{
    const m = mix(n);
    const r = rng();
    if (r < m.hugger) return 'hugger';
    if (r < m.hugger + m.runner) return 'runner';
    return 'drone';
}

/**
 * The grille a creature comes out of: a random one that is far enough from the player and not already occupied;
 * if none is far enough, the farthest.
 */
export function pickSpawn(g: Grid, spawns: readonly number[], enemies: readonly Enemy[], px: number, py: number, rng: Rng): number
{
    const dist = (cell: number) => Math.hypot((cell % g.w) + 0.5 - px, Math.floor(cell / g.w) + 0.5 - py);
    const free = spawns.filter(c => !enemies.some(e => Math.hypot(e.x - ((c % g.w) + 0.5), e.y - (Math.floor(c / g.w) + 0.5)) < 0.8));
    const pool = free.length ? free : spawns;
    const far = pool.filter(c => dist(c) >= WAVES.spawnClear);
    if (far.length) return far[Math.floor(rng() * far.length)];
    return pool.reduce((best, c) => dist(c) > dist(best) ? c : best, pool[0]);
}
