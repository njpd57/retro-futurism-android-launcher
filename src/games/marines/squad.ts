import type { Grid } from '../isolation/grid';
import type { Rng } from '../isolation/rng';
import { castRay } from '../wire/occlusion';
import { downhill, type Enemy, type Field } from './enemies';
import { angleTo, collides, forward, lineClear, moveCircle, right } from './physics';

/**
 * The two marines that fight beside the player. Pure: no DOM. They follow at a distance or hold where they stand,
 * shoot the nearest creature in plain view, and go down like anyone else.
 */

export interface Marine
{
    /** 1 and 2: a strike's target names a marine by this */
    id: number;
    name: string;
    x: number;
    y: number;
    hp: number;
    /** unit vector of where it last moved or aimed: the sprite faces that way */
    dirX: number;
    dirY: number;
    coolMs: number;
    /** ms since its last round, for the muzzle flash */
    flashMs: number;
    /** ms since it was last hurt, for the flash */
    hitMs: number;
    moving: boolean;
    stuckMs: number;
}

export type Order = 'follow' | 'hold';

export const MARINE = {
    hp: 60,
    radius: 0.25,
    /** cells per second: a little slower than the player, so they trail */
    speed: 2.4,
    /** cells */
    range: 9,
    fireMs: 290,
    damage: 1,
    names: ['VEGA', 'HOLT'] as const,
    /** how much a marine heals between waves, and how much health a replacement arrives with */
    heal: 25,
    replacement: 0.5,
};

const STUCK_MS = 250;
/**
 * In `follow` a marine moves when it is farther than `LAG` from its place beside the player, and stops when it is
 * nearer than `ARRIVED`. Where there is no room beside them it keeps to the player themselves, at a distance.
 */
const LAG = 0.9;
const ARRIVED = 0.35;
const LAG_PLAYER = 2.4;
const ARRIVED_PLAYER = 1.6;
/** The marines keep this far from each other and from the player. */
const SPACE = 0.6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A free spot near (x, y), behind and to the side of the way `yaw` looks; `i` picks the side. */
export function spotNear(g: Grid, closed: readonly number[], x: number, y: number, yaw: number, i: number): { x: number; y: number }
{
    const [fx, fy] = forward(yaw);
    const [rx, ry] = right(yaw);
    const side = i % 2 === 0 ? -1 : 1;
    // beside and behind; in a corridor, in line behind (each marine a little farther back than the one before)
    const line = 0.7 * i;
    for (const [back, across] of [[1.3, 0.9], [1.0, 0.6], [1.8, 1.2], [1.3 + line, 0], [0.8 + line, 0], [0.3, 0]])
    {
        const sx = x - fx * back + rx * side * across;
        const sy = y - fy * back + ry * side * across;
        if (!collides(g, closed, sx, sy, MARINE.radius) && lineClear(g, closed, x, y, sx, sy)) return { x: sx, y: sy };
    }
    return { x, y };
}

export function newSquad(g: Grid, closed: readonly number[], x: number, y: number, yaw: number): Marine[]
{
    return MARINE.names.map((name, i): Marine =>
    {
        const at = spotNear(g, closed, x, y, yaw, i);
        return { id: i + 1, name, x: at.x, y: at.y, hp: MARINE.hp, dirX: Math.sin(yaw), dirY: -Math.cos(yaw), coolMs: 0, flashMs: 1e6, hitMs: 0, moving: false, stuckMs: 0 };
    });
}

export interface SquadWorld
{
    grid: Grid;
    closed: readonly number[];
    /** distances to the player's cell */
    field: Field;
    px: number;
    py: number;
    yaw: number;
    order: Order;
    /** the creatures: a marine's round that lands takes health off one of these */
    enemies: Enemy[];
}

/** A round a marine fired, for the tracers. */
export interface SquadShot { marine: number; x: number; y: number; x2: number; y2: number; hit: boolean }

/** Moves the marines and lets them shoot. Mutates `marines` and the creatures they hit: the caller passes copies. */
export function stepSquad(marines: Marine[], w: SquadWorld, dtMs: number, rng: Rng): SquadShot[]
{
    const g = w.grid;
    const shots: SquadShot[] = [];

    for (const m of marines)
    {
        if (m.hp <= 0) continue;
        m.hitMs = Math.max(0, m.hitMs - dtMs);
        m.flashMs += dtMs;
        // like the player's, the cooldown carries over so the cadence doesn't depend on the frame rate
        m.coolMs = Math.max(-dtMs, m.coolMs - dtMs);

        // the nearest creature in plain view
        let target: Enemy | null = null;
        let near = Infinity;
        for (const e of w.enemies)
        {
            if (e.hp <= 0 || e.clung) continue;
            const d = Math.hypot(e.x - m.x, e.y - m.y);
            if (d > MARINE.range || d >= near || !lineClear(g, w.closed, m.x, m.y, e.x, e.y)) continue;
            target = e;
            near = d;
        }
        if (target)
        {
            m.dirX = (target.x - m.x) / near;
            m.dirY = (target.y - m.y) / near;
            if (m.coolMs <= 0)
            {
                m.coolMs += MARINE.fireMs;
                m.flashMs = 0;
                const hit = rng() < clamp(0.8 - 0.045 * near, 0.25, 0.8);
                if (hit)
                {
                    target.hp -= MARINE.damage;
                    target.hitMs = 120;
                    shots.push({ marine: m.id, x: m.x, y: m.y, x2: target.x, y2: target.y, hit });
                }
                else
                {
                    // wide of the mark, to the first wall
                    const aim = angleTo(m.x, m.y, target.x, target.y) + (rng() < 0.5 ? -1 : 1) * (0.06 + rng() * 0.12);
                    const [ax, ay] = forward(aim);
                    const reach = castRay(g, w.closed, m.x, m.y, ax, ay, MARINE.range);
                    shots.push({ marine: m.id, x: m.x, y: m.y, x2: m.x + ax * reach, y2: m.y + ay * reach, hit });
                }
            }
        }

        if (w.order === 'follow') follow(m, marines, w, dtMs);
        else m.moving = false;
    }
    return shots;
}

/** Walks the marine to its place beside and behind the player, and keeps it off the player. */
function follow(m: Marine, marines: readonly Marine[], w: SquadWorld, dtMs: number)
{
    const g = w.grid;
    const i = marines.indexOf(m);
    const [fx, fy] = forward(w.yaw);
    const [rx, ry] = right(w.yaw);
    const side = i % 2 === 0 ? -1 : 1;
    // the place beside the player, or the player themselves when that place is not open
    let gx = w.px - fx * 1.4 + rx * side * 1.2;
    let gy = w.py - fy * 1.4 + ry * side * 1.2;
    let onPlayer = false;
    if (collides(g, w.closed, gx, gy, MARINE.radius) || !lineClear(g, w.closed, w.px, w.py, gx, gy))
    {
        gx = w.px;
        gy = w.py;
        onPlayer = true;
    }

    const toGoal = Math.hypot(gx - m.x, gy - m.y);
    const direct = lineClear(g, w.closed, m.x, m.y, gx, gy);
    // out of sight of its place it keeps going, however near it is as the crow flies
    const want = !direct || toGoal > (m.moving ? (onPlayer ? ARRIVED_PLAYER : ARRIVED) : (onPlayer ? LAG_PLAYER : LAG));
    if (!want)
    {
        m.moving = false;
        m.stuckMs = 0;
    }
    else
    {
        let tx = gx;
        let ty = gy;
        if (!direct || m.stuckMs >= STUCK_MS)
        {
            const here = Math.floor(m.y) * g.w + Math.floor(m.x);
            const next = w.field.dist[here] > 0 ? downhill(g, w.field, here) : -1;
            if (next >= 0)
            {
                tx = (next % g.w) + 0.5;
                ty = Math.floor(next / g.w) + 0.5;
            }
        }
        const dx = tx - m.x;
        const dy = ty - m.y;
        const d = Math.hypot(dx, dy);
        // far behind, it hurries
        const step = Math.min(d, MARINE.speed * (toGoal > 6 ? 1.5 : 1) * dtMs / 1000);
        if (d > 0.001)
        {
            const moved = moveCircle(g, w.closed, m.x, m.y, dx / d * step, dy / d * step, MARINE.radius);
            const travelled = Math.hypot(moved.x - m.x, moved.y - m.y);
            m.stuckMs = travelled < step * 0.3 ? m.stuckMs + dtMs : Math.max(0, m.stuckMs - dtMs);
            m.moving = travelled > 0.0005;
            m.x = moved.x;
            m.y = moved.y;
            // it faces where it goes, unless it is busy aiming (the caller set the aim already this step)
            if (m.moving && m.flashMs > 400)
            {
                m.dirX = dx / d;
                m.dirY = dy / d;
            }
        }
    }

    // never stand on the player, or on each other
    for (const [ox, oy] of [[w.px, w.py], ...marines.filter(o => o !== m && o.hp > 0).map(o => [o.x, o.y])])
    {
        const dx = m.x - ox;
        const dy = m.y - oy;
        const d = Math.hypot(dx, dy);
        if (d >= SPACE) continue;
        const ux = d > 0.001 ? dx / d : 1;
        const uy = d > 0.001 ? dy / d : 0;
        const push = (SPACE - d) * 0.5;
        const moved = moveCircle(g, w.closed, m.x, m.y, ux * push, uy * push, MARINE.radius);
        m.x = moved.x;
        m.y = moved.y;
    }
}
