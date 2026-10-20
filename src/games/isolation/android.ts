import { centreOfCell, placed, sees, walkToward } from './alien';
import { cellOf, SENSES } from './senses';
import { cellAt, distances, nextStep, type Grid } from './grid';
import { pick, type Rng } from './rng';
import { SCALE } from './scale';

/**
 * Ash, the science officer who is not what he seems. He doesn't hear and the tracker doesn't see him: he follows
 * what he sees, slowly, and goes through nothing that is shut. Fire means nothing to him. He is switched off from
 * one terminal, or kept behind a sealed door.
 */
export interface Ash
{
    cell: number;
    /** where it is and faces; missing: the middle of its cell */
    x?: number;
    y?: number;
    heading?: number;
    /** switched off: it stands there and does nothing */
    active: boolean;
    mode: 'wander' | 'chase';
    target: number;
    /** ms it takes to cross a cell */
    stepMs: number;
}

export type AshEvent = 'ashSpotted' | 'ashLost';

export interface AshWorld
{
    grid: Grid;
    closed: readonly number[];
    player: number;
    pos?: { x: number; y: number };
    hidden: boolean;
    /** the player stands in the dark */
    dark?: boolean;
}

export const ASH = {
    sight: 6 * SCALE,
    darkSight: 2 * SCALE,
    /** ms between moves: he is slower than the player, who needs 380 per old cell */
    stepMs: { wander: 1500 / SCALE, chase: 620 / SCALE },
};

/** Ash's body radius. */
export const ASH_BODY = 0.25;

export const newAsh = (cell: number): Ash => ({ cell, active: true, mode: 'wander', target: cell, stepMs: ASH.stepMs.wander });

const passable = (w: AshWorld) => (i: number) => cellAt(w.grid, i) !== 'wall' && !w.closed.includes(i);

/** A floor cell he can walk to from `from`, to wander off to. */
function wanderTarget(w: AshWorld, from: number, rng: Rng): number
{
    const dist = distances(w.grid, from, passable(w));
    const options: number[] = [];
    dist.forEach((d, i) => { if (d >= 3 * SCALE && w.grid.cells[i] === 'floor') options.push(i); });
    return options.length ? pick(options, rng) : from;
}

export function stepAsh(ash: Ash, w: AshWorld, dtMs: number, rng: Rng): { ash: Ash; events: AshEvent[] }
{
    if (!ash.active) return { ash, events: [] };
    const events: AshEvent[] = [];
    const g = w.grid;
    const a = placed(g, ash);

    const spots = sees(w, w.closed, a, w.dark ? ASH.darkSight : ASH.sight, a.mode === 'chase' ? Math.PI : SENSES.ashFov);
    if (spots)
    {
        if (a.mode !== 'chase') events.push('ashSpotted');
        a.mode = 'chase';
        a.target = w.player;
    }

    const here = cellOf(g, a.x, a.y);
    const goal = centreOfCell(g, a.target);
    if (here === a.target && Math.hypot(a.x - goal.x, a.y - goal.y) <= 0.35)
    {
        if (a.mode === 'chase') events.push('ashLost');
        a.mode = 'wander';
        a.target = wanderTarget(w, here, rng);
    }
    const next = nextStep(g, here, a.target, passable(w));
    if (next < 0)
    {
        // nowhere to go: a door is in the way
        if (a.mode === 'chase') events.push('ashLost');
        a.mode = 'wander';
        a.target = wanderTarget(w, here, rng);
        a.stepMs = ASH.stepMs.wander;
        return { ash: { ...a, cell: here }, events };
    }
    a.stepMs = ASH.stepMs[a.mode];
    const waypoint = spots && w.pos ? w.pos : centreOfCell(g, next);
    walkToward(g, w.closed, a, waypoint, 1000 / a.stepMs, dtMs, ASH_BODY);
    const now = cellOf(g, a.x, a.y);
    a.cell = now >= 0 ? now : here;
    return { ash: a, events };
}
