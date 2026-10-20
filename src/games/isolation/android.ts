import { cellAt, distances, lineOfSight, nextStep, type Grid } from './grid';
import { pick, type Rng } from './rng';

/**
 * Ash, the science officer who is not what he seems. He doesn't hear and the tracker doesn't see him: he follows
 * what he sees, slowly, and goes through nothing that is shut. Fire means nothing to him. He is switched off from
 * one terminal, or kept behind a sealed door.
 */
export interface Ash
{
    cell: number;
    /** switched off: it stands there and does nothing */
    active: boolean;
    mode: 'wander' | 'chase';
    target: number;
    /** until the next move */
    stepMs: number;
}

export type AshEvent = 'ashSpotted' | 'ashLost';

export interface AshWorld
{
    grid: Grid;
    closed: readonly number[];
    player: number;
    hidden: boolean;
    /** the player stands in the dark */
    dark?: boolean;
}

export const ASH = {
    sight: 6,
    darkSight: 2,
    /** ms between moves: he is slower than the player, who needs 380 */
    stepMs: { wander: 1500, chase: 620 },
};

export const newAsh = (cell: number): Ash => ({ cell, active: true, mode: 'wander', target: cell, stepMs: ASH.stepMs.wander });

const passable = (w: AshWorld) => (i: number) => cellAt(w.grid, i) !== 'wall' && !w.closed.includes(i);

/** A floor cell he can walk to from `from`, to wander off to. */
function wanderTarget(w: AshWorld, from: number, rng: Rng): number
{
    const dist = distances(w.grid, from, passable(w));
    const options: number[] = [];
    dist.forEach((d, i) => { if (d >= 3 && w.grid.cells[i] === 'floor') options.push(i); });
    return options.length ? pick(options, rng) : from;
}

export function stepAsh(ash: Ash, w: AshWorld, dtMs: number, rng: Rng): { ash: Ash; events: AshEvent[] }
{
    if (!ash.active) return { ash, events: [] };
    const events: AshEvent[] = [];
    const a: Ash = { ...ash, stepMs: ash.stepMs - dtMs };

    const sees = !w.hidden && lineOfSight(w.grid, w.closed, a.cell, w.player, w.dark ? ASH.darkSight : ASH.sight);
    if (sees)
    {
        if (a.mode !== 'chase') events.push('ashSpotted');
        a.mode = 'chase';
        a.target = w.player;
    }
    if (a.stepMs > 0) return { ash: a, events };

    if (a.cell === a.target)
    {
        if (a.mode === 'chase') events.push('ashLost');
        a.mode = 'wander';
        a.target = wanderTarget(w, a.cell, rng);
    }
    const next = nextStep(w.grid, a.cell, a.target, passable(w));
    if (next < 0 || next === a.cell)
    {
        // nowhere to go: a door is in the way
        if (a.mode === 'chase') events.push('ashLost');
        a.mode = 'wander';
        a.target = wanderTarget(w, a.cell, rng);
        a.stepMs = ASH.stepMs.wander;
        return { ash: a, events };
    }
    a.cell = next;
    a.stepMs = ASH.stepMs[a.mode];
    return { ash: a, events };
}
