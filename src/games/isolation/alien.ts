import { cellAt, distances, lineOfSight, nextStep, soundDistance, type Grid } from './grid';
import { pick, type Rng } from './rng';

export type AlienMode = 'patrol' | 'investigate' | 'hunt' | 'search';

export interface Alien
{
    cell: number;
    mode: AlienMode;
    /** where it is heading */
    target: number;
    /** until the next move */
    stepMs: number;
    /** time spent forcing the closed door in its way */
    forceMs: number;
    /** since its last move: the motion tracker only sees it while it moves */
    stillMs: number;
    /** left before a search gives up */
    searchMs: number;
    /** since it last saw the player */
    seenMs: number;
    /** it saw the player get into a locker, and will open it */
    sawHide: boolean;
}

export type AlienEvent = 'spotted' | 'lostTrack' | 'doorForced' | 'heard';

/** What the creature needs to know about the deck. */
export interface World
{
    grid: Grid;
    closed: readonly number[];
    player: number;
    hidden: boolean;
}

export const ALIEN = {
    /** cells it sees along a corridor */
    sight: 7,
    /** a closed door muffles a sound as much as this many cells */
    doorCost: 4,
    forceMs: 4000,
    searchMs: 8000,
    /** hiding this soon after being seen doesn't fool it */
    sawHideMs: 1500,
    stepMs: { patrol: 1100, investigate: 650, search: 900, hunt: 420 } as Record<AlienMode, number>,
};

const NEVER = 1e9;

const walkable = (g: Grid) => (i: number) => cellAt(g, i) !== 'wall';

export function newAlien(cell: number): Alien
{
    return { cell, mode: 'patrol', target: cell, stepMs: 3000, forceMs: 0, stillMs: NEVER, searchMs: 0, seenMs: NEVER, sawHide: false };
}

/**
 * Somewhere to wander to. Half the time it is near the player, so the creature never drifts away for long
 * (the "director" of the original game does the same).
 */
export function patrolTarget(w: World, from: number, rng: Rng): number
{
    const fromPlayer = distances(w.grid, w.player, walkable(w.grid));
    const all: number[] = [];
    const near: number[] = [];
    w.grid.cells.forEach((c, i) =>
    {
        if (c !== 'floor' || i === from) return;
        all.push(i);
        if (fromPlayer[i] >= 2 && fromPlayer[i] <= 6) near.push(i);
    });
    if (!all.length) return from;
    return pick(near.length && rng() < 0.5 ? near : all, rng);
}

/** A sound of `loudness` cells at `cell`. Unless it is already hunting, the creature goes to look. */
export function hear(a: Alien, w: World, cell: number, loudness: number): { alien: Alien; heard: boolean }
{
    if (a.mode === 'hunt') return { alien: a, heard: false };
    if (soundDistance(w.grid, w.closed, a.cell, cell, ALIEN.doorCost) > loudness) return { alien: a, heard: false };
    return {
        alien: { ...a, mode: 'investigate', target: cell, stepMs: Math.min(a.stepMs, ALIEN.stepMs.investigate) },
        heard: true,
    };
}

/** Advances the creature by `dtMs`: senses, picks a goal, walks, forces doors. Doors it opens are removed from `closed`. */
export function stepAlien(alien: Alien, w: World, dtMs: number, rng: Rng): { alien: Alien; closed: readonly number[]; events: AlienEvent[] }
{
    const events: AlienEvent[] = [];
    const a: Alien = { ...alien, stillMs: alien.stillMs + dtMs, stepMs: alien.stepMs - dtMs };
    let closed = w.closed;

    if (!w.hidden && lineOfSight(w.grid, closed, a.cell, w.player, ALIEN.sight))
    {
        if (a.mode !== 'hunt') events.push('spotted');
        a.mode = 'hunt';
        a.target = w.player;
        a.seenMs = 0;
    }
    else a.seenMs = Math.min(NEVER, a.seenMs + dtMs);

    if (a.mode === 'search')
    {
        a.searchMs -= dtMs;
        if (a.searchMs <= 0)
        {
            a.mode = 'patrol';
            a.sawHide = false;
            a.target = patrolTarget(w, a.cell, rng);
        }
    }

    if (a.stepMs > 0) return { alien: a, closed, events };

    if (a.cell === a.target)
    {
        if (a.mode === 'patrol') a.target = patrolTarget(w, a.cell, rng);
        else if (a.mode === 'search') a.target = searchTarget(w, a.cell, rng);
        else
        {
            // reached the noise, or the last place it saw the player
            if (a.mode === 'hunt') events.push('lostTrack');
            a.mode = 'search';
            a.searchMs = ALIEN.searchMs;
            a.target = searchTarget(w, a.cell, rng);
        }
    }

    const next = nextStep(w.grid, a.cell, a.target, walkable(w.grid));
    if (next < 0 || next === a.cell)
    {
        a.target = patrolTarget(w, a.cell, rng);
        a.stepMs = ALIEN.stepMs[a.mode];
        return { alien: a, closed, events };
    }

    if (closed.includes(next))
    {
        a.forceMs += dtMs;
        if (a.forceMs >= ALIEN.forceMs)
        {
            closed = closed.filter(c => c !== next);
            a.forceMs = 0;
            a.stepMs = ALIEN.stepMs[a.mode];
            events.push('doorForced');
        }
        return { alien: a, closed, events };
    }

    a.cell = next;
    a.forceMs = 0;
    a.stillMs = 0;
    a.stepMs = ALIEN.stepMs[a.mode];
    return { alien: a, closed, events };
}

/** A cell within three steps, to sniff around. */
function searchTarget(w: World, from: number, rng: Rng): number
{
    const dist = distances(w.grid, from, walkable(w.grid));
    const around: number[] = [];
    dist.forEach((d, i) => { if (d >= 1 && d <= 3 && w.grid.cells[i] !== 'door') around.push(i); });
    return around.length ? pick(around, rng) : from;
}
