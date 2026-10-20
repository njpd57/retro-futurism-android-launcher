import { cellAt, cellDistance, distances, lineOfSight, nextStep, soundDistance, type Grid } from './grid';
import { pick, type Rng } from './rng';

export type AlienMode = 'patrol' | 'investigate' | 'hunt' | 'search' | 'flee';

/** A crawl through the ducts, from one vent to another. Meanwhile it is not on the deck. */
export interface VentTrip
{
    from: number;
    to: number;
    /** left before it comes out */
    ms: number;
    totalMs: number;
}

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
    /** left before it stops running from the fire */
    fleeMs: number;
    /** the vent it will come out of, once it reaches the one in `target` */
    ventPlan: number | null;
    vent: VentTrip | null;
}

export type AlienEvent = 'spotted' | 'lostTrack' | 'doorForced' | 'heard' | 'ventIn' | 'ventOut';

/** What the creature needs to know about the deck. */
export interface World
{
    grid: Grid;
    closed: readonly number[];
    player: number;
    hidden: boolean;
    /** the player stands in the dark: it sees much less far */
    dark?: boolean;
    /** doors without power: shut, and no force opens them */
    locked?: readonly number[];
    /** the difficulty: multiplies the time between its moves (more is slower), and how far it sees */
    pace?: number;
    sight?: number;
}

export const ALIEN = {
    /** cells it sees along a corridor */
    sight: 7,
    /** ...when the player is in the dark */
    darkSight: 2,
    /** a closed door muffles a sound as much as this many cells */
    doorCost: 4,
    forceMs: 4000,
    searchMs: 8000,
    /** hiding this soon after being seen doesn't fool it */
    sawHideMs: 1500,
    stepMs: { patrol: 1100, investigate: 650, search: 900, hunt: 420, flee: 380 } as Record<AlienMode, number>,
    /** it runs from the flamethrower for this long, less each time it has been burnt */
    fleeMs: 7000,
    fleeLearnMs: 1500,
    minFleeMs: 2000,
    /** how often a patrol goes through the vents */
    ventChance: 0.35,
    ventMsPerCell: 450,
    minVentMs: 2500,
};

const NEVER = 1e9;

/** Time between its moves in `mode`, with the difficulty applied. */
const stepFor = (w: World, mode: AlienMode) => ALIEN.stepMs[mode] * (w.pace ?? 1);

const walkable = (g: Grid) => (i: number) => cellAt(g, i) !== 'wall';

const ventCache = new WeakMap<Grid, number[]>();
export function ventsOf(g: Grid): number[]
{
    let vents = ventCache.get(g);
    if (!vents)
    {
        vents = g.cells.flatMap((c, i) => c === 'vent' ? [i] : []);
        ventCache.set(g, vents);
    }
    return vents;
}

export function newAlien(cell: number): Alien
{
    return {
        cell, mode: 'patrol', target: cell, stepMs: 3000, forceMs: 0, stillMs: NEVER, searchMs: 0, seenMs: NEVER,
        sawHide: false, fleeMs: 0, ventPlan: null, vent: null,
    };
}

/** Where it is on the map, between two vents while it crawls. Cell centres are at (x + 0.5, y + 0.5). */
export function alienPosition(g: Grid, a: Alien): { x: number; y: number }
{
    const at = (i: number) => ({ x: i % g.w + 0.5, y: Math.floor(i / g.w) + 0.5 });
    if (!a.vent) return at(a.cell);
    const from = at(a.vent.from);
    const to = at(a.vent.to);
    const t = 1 - a.vent.ms / a.vent.totalMs;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
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

/** A patrol goal, sometimes by way of the vents when they make a real shortcut. */
export function planPatrol(w: World, from: number, rng: Rng): { target: number; ventPlan: number | null }
{
    const target = patrolTarget(w, from, rng);
    const vents = ventsOf(w.grid);
    if (vents.length < 2 || rng() >= ALIEN.ventChance) return { target, ventPlan: null };

    const dist = distances(w.grid, from, walkable(w.grid));
    const reachable = vents.filter(v => dist[v] >= 0);
    if (!reachable.length) return { target, ventPlan: null };
    const entry = reachable.reduce((p, q) => dist[q] < dist[p] ? q : p);
    const exits = vents.filter(v => v !== entry);
    const exit = exits.reduce((p, q) => cellDistance(w.grid, q, target) < cellDistance(w.grid, p, target) ? q : p);
    // not worth it when walking is about as short
    if (dist[target] >= 0 && dist[entry] + 4 >= dist[target]) return { target, ventPlan: null };
    return { target: entry, ventPlan: exit };
}

/** How long it keeps running after a burn: each earlier one makes it shorter, because it learns. */
export const fleeMsFor = (burns: number) => Math.max(ALIEN.minFleeMs, ALIEN.fleeMs - ALIEN.fleeLearnMs * burns);

/**
 * The flamethrower hits it: it runs for the nearest vent it can reach without passing the player, and leaves by
 * the one farthest from them. With no vents, to the farthest cell.
 */
export function scare(a: Alien, w: World, burns: number): Alien
{
    const away = (i: number) => walkable(w.grid)(i) && i !== w.player;
    const fromAlien = distances(w.grid, a.cell, away);
    const fromPlayer = distances(w.grid, w.player, walkable(w.grid));
    const vents = ventsOf(w.grid);
    const entries = vents.filter(v => fromAlien[v] >= 0 && fromPlayer[v] >= 4);

    let target = a.cell;
    let ventPlan: number | null = null;
    if (entries.length && vents.length > 1)
    {
        target = entries.reduce((p, q) => fromAlien[q] < fromAlien[p] ? q : p);
        ventPlan = vents.filter(v => v !== target).reduce((p, q) => cellDistance(w.grid, q, w.player) > cellDistance(w.grid, p, w.player) ? q : p);
    }
    else fromAlien.forEach((d, i) => { if (d >= 0 && fromPlayer[i] > fromPlayer[target]) target = i; });

    return {
        ...a, mode: 'flee', target, ventPlan, fleeMs: fleeMsFor(burns), stepMs: Math.min(a.stepMs, stepFor(w, 'flee')),
        forceMs: 0, searchMs: 0, sawHide: false,
    };
}

/** A sound of `loudness` cells at `cell`. Unless it is already hunting or running, the creature goes to look. */
export function hear(a: Alien, w: World, cell: number, loudness: number): { alien: Alien; heard: boolean }
{
    if (a.mode === 'hunt' || a.mode === 'flee') return { alien: a, heard: false };

    if (a.vent)
    {
        // the ducts carry sound: it hears through the grille nearest the noise and comes out there
        let best = -1;
        let bestDist = Infinity;
        for (const v of ventsOf(w.grid))
        {
            const d = soundDistance(w.grid, w.closed, v, cell, ALIEN.doorCost);
            if (d < bestDist) { best = v; bestDist = d; }
        }
        if (best < 0 || bestDist > loudness + 1) return { alien: a, heard: false };
        return {
            alien: { ...a, mode: 'investigate', target: cell, vent: { ...a.vent, to: best, ms: Math.min(a.vent.ms, 1500) } },
            heard: true,
        };
    }

    if (soundDistance(w.grid, w.closed, a.cell, cell, ALIEN.doorCost) > loudness) return { alien: a, heard: false };
    return {
        alien: { ...a, mode: 'investigate', target: cell, ventPlan: null, stepMs: Math.min(a.stepMs, stepFor(w, 'investigate')) },
        heard: true,
    };
}

/** Advances the creature by `dtMs`: senses, picks a goal, walks, forces doors, crawls. Doors it opens are removed from `closed`. */
export function stepAlien(alien: Alien, w: World, dtMs: number, rng: Rng): { alien: Alien; closed: readonly number[]; events: AlienEvent[] }
{
    const events: AlienEvent[] = [];
    let closed = w.closed;

    if (alien.vent)
    {
        const ms = alien.vent.ms - dtMs;
        // moving all the time: the tracker follows it through the walls
        if (ms > 0) return { alien: { ...alien, stillMs: 0, vent: { ...alien.vent, ms } }, closed, events };
        const out: Alien = { ...alien, cell: alien.vent.to, vent: null, stillMs: 0, stepMs: stepFor(w, alien.mode) };
        if (out.mode === 'flee')
        {
            // it got away
            out.mode = 'patrol';
            out.fleeMs = 0;
        }
        if (out.mode === 'patrol') out.target = patrolTarget(w, out.cell, rng);
        events.push('ventOut');
        return { alien: out, closed, events };
    }

    const a: Alien = { ...alien, stillMs: alien.stillMs + dtMs, stepMs: alien.stepMs - dtMs };

    if (a.mode === 'flee')
    {
        // it ignores the player until the fear passes
        a.fleeMs -= dtMs;
        if (a.fleeMs <= 0)
        {
            a.mode = 'search';
            a.searchMs = ALIEN.searchMs;
            a.ventPlan = null;
            a.target = searchTarget(w, a.cell, rng);
        }
    }
    else if (!w.hidden && lineOfSight(w.grid, closed, a.cell, w.player, w.dark ? ALIEN.darkSight : (w.sight ?? ALIEN.sight)))
    {
        if (a.mode !== 'hunt') events.push('spotted');
        a.mode = 'hunt';
        a.target = w.player;
        a.seenMs = 0;
        a.ventPlan = null;
    }
    else a.seenMs = Math.min(NEVER, a.seenMs + dtMs);

    if (a.mode === 'search')
    {
        a.searchMs -= dtMs;
        if (a.searchMs <= 0)
        {
            a.mode = 'patrol';
            a.sawHide = false;
            Object.assign(a, planPatrol(w, a.cell, rng));
        }
    }

    if (a.stepMs > 0) return { alien: a, closed, events };

    if (a.cell === a.target && a.ventPlan !== null && cellAt(w.grid, a.cell) === 'vent')
    {
        const totalMs = Math.max(ALIEN.minVentMs, cellDistance(w.grid, a.cell, a.ventPlan) * ALIEN.ventMsPerCell);
        events.push('ventIn');
        return { alien: { ...a, vent: { from: a.cell, to: a.ventPlan, ms: totalMs, totalMs }, ventPlan: null }, closed, events };
    }

    if (a.cell === a.target)
    {
        if (a.mode === 'patrol') Object.assign(a, planPatrol(w, a.cell, rng));
        else if (a.mode === 'search') a.target = searchTarget(w, a.cell, rng);
        else if (a.mode !== 'flee')
        {
            // reached the noise, or the last place it saw the player
            if (a.mode === 'hunt') events.push('lostTrack');
            a.mode = 'search';
            a.searchMs = ALIEN.searchMs;
            a.target = searchTarget(w, a.cell, rng);
        }
    }

    // running away never goes through the player
    // ...and no force opens a door without power
    const open = (i: number) => walkable(w.grid)(i) && !w.locked?.includes(i);
    const passable = a.mode === 'flee' ? (i: number) => open(i) && i !== w.player : open;
    const next = nextStep(w.grid, a.cell, a.target, passable);
    if (a.mode === 'flee' && (next < 0 || next === a.cell))
    {
        // cornered far away: waits for the fear to pass
        a.stepMs = stepFor(w, 'flee');
        return { alien: a, closed, events };
    }
    if (next < 0 || next === a.cell)
    {
        a.target = patrolTarget(w, a.cell, rng);
        a.ventPlan = null;
        a.stepMs = stepFor(w, a.mode);
        return { alien: a, closed, events };
    }

    if (closed.includes(next))
    {
        a.forceMs += dtMs;
        if (a.forceMs >= ALIEN.forceMs)
        {
            closed = closed.filter(c => c !== next);
            a.forceMs = 0;
            a.stepMs = stepFor(w, a.mode);
            events.push('doorForced');
        }
        return { alien: a, closed, events };
    }

    a.cell = next;
    a.forceMs = 0;
    a.stillMs = 0;
    a.stepMs = stepFor(w, a.mode);
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
