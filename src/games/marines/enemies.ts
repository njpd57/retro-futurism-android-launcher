import { blocks, distances, neighbour, type Dir, type Grid } from '../isolation/grid';
import { lineClear, moveCircle } from './physics';

export type EnemyKind = 'drone' | 'runner' | 'hugger';

export interface EnemyDef
{
    name: string;
    hp: number;
    /** cells per second */
    speed: number;
    radius: number;
    /** centre-to-centre distance at which it can strike */
    reach: number;
    /** warning before a strike lands, so the player can see it coming */
    windupMs: number;
    cooldownMs: number;
    damage: number;
    score: number;
    /** its strike on the player is a leap that clings to the face; against anyone else it is a plain blow */
    grab?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
    drone: { name: 'ZÁNGANO', hp: 8, speed: 3, radius: 0.3, reach: 0.8, windupMs: 350, cooldownMs: 900, damage: 15, score: 100 },
    // faster than anyone on foot, and it dies at a touch
    runner: { name: 'CORREDOR', hp: 5, speed: 5.2, radius: 0.26, reach: 0.78, windupMs: 220, cooldownMs: 650, damage: 9, score: 150 },
    // small and quick, and it leaps from a couple of cells: its warning is the crouch before the jump
    hugger: { name: 'ABRAZACARAS', hp: 3, speed: 4.4, radius: 0.2, reach: 1.7, windupMs: 500, cooldownMs: 1600, damage: 6, score: 125, grab: true },
};

export interface Enemy
{
    id: number;
    kind: EnemyKind;
    x: number;
    y: number;
    hp: number;
    /** unit vector of where it last moved or looked: the sprite faces that way */
    dirX: number;
    dirY: number;
    /** ms left before a strike lands, -1 when not striking */
    windMs: number;
    coolMs: number;
    /** it moved this step: only what moves shows on the tracker */
    moving: boolean;
    /** how long it has been trying to go straight and not getting anywhere */
    stuckMs: number;
    /** ms since it was last hit, for the flash */
    hitMs: number;
    /** ms of burning left: it takes damage until it runs out */
    burnMs: number;
    /** clinging to the player's face: it follows them, harms them every moment and falls to any hit */
    clung: boolean;
}

export function spawnEnemy(id: number, kind: EnemyKind, g: Grid, cell: number): Enemy
{
    return {
        id, kind, x: (cell % g.w) + 0.5, y: Math.floor(cell / g.w) + 0.5, hp: ENEMIES[kind].hp,
        dirX: 0, dirY: 1, windMs: -1, coolMs: 0, moving: false, stuckMs: 0, hitMs: 0, burnMs: 0, clung: false,
    };
}

/** Steps from every cell to `cell` through open space: the creatures flow down it towards the player. */
export interface Field { cell: number; dist: Int32Array }

export function buildField(g: Grid, closed: readonly number[], cell: number): Field
{
    return { cell, dist: distances(g, cell, i => !blocks(g, closed, i)) };
}

/** The neighbouring cell with the smallest distance, or -1 when there is no way. */
export function downhill(g: Grid, field: Field, cell: number): number
{
    let best = -1;
    for (let d = 0; d < 4; d++)
    {
        const n = neighbour(g, cell, d as Dir);
        if (n < 0 || field.dist[n] < 0) continue;
        if (best < 0 || field.dist[n] < field.dist[best]) best = n;
    }
    return best;
}

/** Someone besides the player the creatures may go for. */
export interface Victim { id: number; x: number; y: number }

export interface EnemyWorld
{
    grid: Grid;
    closed: readonly number[];
    field: Field;
    /** the player */
    px: number;
    py: number;
    /** the squad members still standing */
    marines?: readonly Victim[];
}

/** A blow (or a leap) that landed. */
export interface Strike
{
    enemy: number;
    /** the marine's id, or null for the player */
    target: number | null;
    damage: number;
    /** it is a leap onto the player's face, not a blow */
    grab: boolean;
}

/** Two bodies closer than this are pushed apart. */
const PERSONAL_SPACE = 0.55;
const STUCK_MS = 250;
/** A marine this close, and nearer than the player, draws the creature's attention. */
const NOTICE = 2.2;

/**
 * Moves and lets every creature strike. Mutates `enemies`: the caller passes copies. Returns the strikes that
 * landed. A creature goes for the player unless a marine stands nearer and in plain view.
 */
export function stepEnemies(enemies: Enemy[], w: EnemyWorld, dtMs: number): Strike[]
{
    const g = w.grid;
    const strikes: Strike[] = [];

    for (const e of enemies)
    {
        const def = ENEMIES[e.kind];
        e.hitMs = Math.max(0, e.hitMs - dtMs);
        e.coolMs = Math.max(0, e.coolMs - dtMs);

        // on the player's face: it goes where they go
        if (e.clung)
        {
            e.x = w.px;
            e.y = w.py;
            e.moving = false;
            continue;
        }

        const dp = Math.hypot(w.px - e.x, w.py - e.y);
        let tx = w.px;
        let ty = w.py;
        let victim: number | null = null;
        let d = dp;
        for (const m of w.marines ?? [])
        {
            const dm = Math.hypot(m.x - e.x, m.y - e.y);
            if (dm >= NOTICE || dm >= d || !lineClear(g, w.closed, e.x, e.y, m.x, m.y)) continue;
            tx = m.x;
            ty = m.y;
            victim = m.id;
            d = dm;
        }
        const goalX = tx;
        const goalY = ty;
        const dx = goalX - e.x;
        const dy = goalY - e.y;

        if (d <= def.reach)
        {
            // close enough: stop and strike once the warning has run out
            e.moving = false;
            if (d > 0.001)
            {
                e.dirX = dx / d;
                e.dirY = dy / d;
            }
            if (e.coolMs <= 0)
            {
                if (e.windMs < 0) e.windMs = def.windupMs;
                e.windMs -= dtMs;
                if (e.windMs <= 0)
                {
                    strikes.push({ enemy: e.id, target: victim, damage: def.damage, grab: !!def.grab && victim === null });
                    e.coolMs = def.cooldownMs;
                    e.windMs = -1;
                }
            }
            continue;
        }
        e.windMs = -1;

        // straight at the target when nothing is in the way; otherwise down the distance field, which leads to the
        // player (a marine is only chased in plain view)
        const direct = e.stuckMs < STUCK_MS && lineClear(g, w.closed, e.x, e.y, tx, ty);
        if (!direct && victim === null)
        {
            const here = Math.floor(e.y) * g.w + Math.floor(e.x);
            const next = w.field.dist[here] > 0 ? downhill(g, w.field, here) : -1;
            if (next >= 0)
            {
                tx = (next % g.w) + 0.5;
                ty = Math.floor(next / g.w) + 0.5;
            }
        }

        const tdx = tx - e.x;
        const tdy = ty - e.y;
        const td = Math.hypot(tdx, tdy);
        if (td < 0.001)
        {
            e.moving = false;
            continue;
        }
        // never run into the target: stop at striking distance
        let step = def.speed * dtMs / 1000;
        if (tx === goalX && ty === goalY) step = Math.min(step, Math.max(0, d - def.reach * 0.85));
        step = Math.min(step, td);
        const ux = tdx / td;
        const uy = tdy / td;
        const moved = moveCircle(g, w.closed, e.x, e.y, ux * step, uy * step, def.radius);
        const travelled = Math.hypot(moved.x - e.x, moved.y - e.y);
        e.stuckMs = travelled < step * 0.3 ? e.stuckMs + dtMs : Math.max(0, e.stuckMs - dtMs);
        e.moving = travelled > 0.0005;
        e.x = moved.x;
        e.y = moved.y;
        if (e.moving)
        {
            e.dirX = ux;
            e.dirY = uy;
        }
    }

    separate(enemies.filter(e => !e.clung), g, w.closed);
    return strikes;
}

/** Pushes overlapping creatures apart so they don't pile into one point. */
export function separate(enemies: Enemy[], g: Grid, closed: readonly number[])
{
    for (let i = 0; i < enemies.length; i++)
        for (let j = i + 1; j < enemies.length; j++)
        {
            const a = enemies[i];
            const b = enemies[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let d = Math.hypot(dx, dy);
            if (d >= PERSONAL_SPACE) continue;
            if (d < 0.0001)
            {
                // exactly on top of each other: split along an axis picked by id
                dx = (a.id + b.id) % 2 ? 1 : 0;
                dy = dx ? 0 : 1;
                d = 1;
            }
            const push = (PERSONAL_SPACE - Math.hypot(b.x - a.x, b.y - a.y)) / 2;
            const ux = dx / d;
            const uy = dy / d;
            const na = moveCircle(g, closed, a.x, a.y, -ux * push, -uy * push, ENEMIES[a.kind].radius);
            const nb = moveCircle(g, closed, b.x, b.y, ux * push, uy * push, ENEMIES[b.kind].radius);
            a.x = na.x;
            a.y = na.y;
            b.x = nb.x;
            b.y = nb.y;
        }
}
