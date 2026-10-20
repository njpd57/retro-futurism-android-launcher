import type { Grid } from '../isolation/grid';
import { cellAt } from '../isolation/grid';
import type { Rng } from '../isolation/rng';
import type { Enemy } from './enemies';
import { angleDiff, angleTo, collides, forward, lineClear } from './physics';

/**
 * What the squad sets up: sentry turrets, welded doors, and the acid the spitters lob. Pure: no DOM.
 */

/** Sentry turrets: they turn to the nearest creature in plain view and shoot until their ammunition runs out. */
export const TURRET = {
    /** charges carried at the start and the most that can be carried; one more comes with each wave */
    start: 2,
    cap: 3,
    /** the most standing at once */
    max: 2,
    hp: 45,
    ammo: 180,
    /** cells */
    range: 8,
    fireMs: 120,
    damage: 0.8,
    /** radians per second it turns, and how close to its target it fires */
    turnRate: 4.5,
    aimDeg: 7,
    /** cells ahead of the player where it is set down */
    place: 0.9,
    /** health it recovers between waves */
    mend: 20,
    /** creatures this close, and nearer than the player, go for it */
    radius: 0.2,
    /** ids at or above this are turrets, below it marines */
    idBase: 1000,
};

export interface Turret
{
    id: number;
    x: number;
    y: number;
    yaw: number;
    hp: number;
    ammo: number;
    coolMs: number;
    /** ms since its last round, for the flash */
    flashMs: number;
    /** ms since it was last hurt */
    hitMs: number;
}

/** A turret's round that left, for the tracers. */
export interface TurretShot { turret: number; x: number; y: number; x2: number; y2: number; hit: boolean }

/** The blowtorch: a door is welded shut, and creatures must gnaw through. */
export const WELD = {
    /** charges carried: one each time a door is sealed; cutting one open gives it back; all are restored each wave */
    max: 3,
    /** what a weld can take before it gives, in creature gnawing (see `gnawRate`) */
    hp: 100,
    /** cells: how far from the player the door may be, and how far off the line of sight it may lie */
    reach: 1.9,
    coneDeg: 38,
    /** the door must be free of anyone this close to its middle */
    clear: 0.75,
};

/** What a spitter lobs: it lands after `flightMs` where its target was standing, and leaves a pool of acid. */
export const SPIT = { flightMs: 700, radius: 0.8, damage: 10, pool: 0.6 };

/** A gob of acid in the air. */
export interface Spit { id: number; x: number; y: number; tx: number; ty: number; ms: number; totalMs: number }

/** A welded door and what is left of its weld. */
export interface Weld { cell: number; hp: number }

const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A turret set down ahead of the player, or null when there is no room or too many are standing. */
export function placeTurret(g: Grid, closed: readonly number[], x: number, y: number, yaw: number, id: number, turrets: readonly Turret[]): Turret | null
{
    if (turrets.length >= TURRET.max) return null;
    const [fx, fy] = forward(yaw);
    for (const ahead of [TURRET.place, 0.6, 0.3])
    {
        const tx = x + fx * ahead;
        const ty = y + fy * ahead;
        if (collides(g, closed, tx, ty, 0.25) || !lineClear(g, closed, x, y, tx, ty)) continue;
        if (turrets.some(t => Math.hypot(t.x - tx, t.y - ty) < 0.6)) continue;
        return { id, x: tx, y: ty, yaw, hp: TURRET.hp, ammo: TURRET.ammo, coolMs: 0, flashMs: 1e6, hitMs: 0 };
    }
    return null;
}

/** Turns and fires the turrets. Mutates `turrets` and the creatures they hit: the caller passes copies. */
export function stepTurrets(turrets: Turret[], w: { grid: Grid; closed: readonly number[]; enemies: Enemy[] }, dtMs: number, rng: Rng): TurretShot[]
{
    const shots: TurretShot[] = [];
    for (const t of turrets)
    {
        t.hitMs = Math.max(0, t.hitMs - dtMs);
        t.flashMs += dtMs;
        t.coolMs = Math.max(-dtMs, t.coolMs - dtMs);
        if (t.ammo <= 0) continue;

        let target: Enemy | null = null;
        let near = Infinity;
        for (const e of w.enemies)
        {
            if (e.hp <= 0 || e.clung) continue;
            const d = Math.hypot(e.x - t.x, e.y - t.y);
            if (d > TURRET.range || d >= near || !lineClear(w.grid, w.closed, t.x, t.y, e.x, e.y)) continue;
            target = e;
            near = d;
        }
        if (!target) continue;

        // it turns at a fixed rate, and fires once it is looking at the target
        const want = angleTo(t.x, t.y, target.x, target.y);
        const off = angleDiff(want, t.yaw);
        const max = TURRET.turnRate * dtMs / 1000;
        t.yaw = angleDiff(t.yaw + clamp(off, -max, max), 0);
        if (Math.abs(angleDiff(want, t.yaw)) > TURRET.aimDeg * DEG || t.coolMs > 0) continue;

        t.coolMs += TURRET.fireMs;
        t.flashMs = 0;
        t.ammo--;
        const hit = rng() < clamp(0.9 - 0.05 * near, 0.3, 0.9);
        if (hit)
        {
            target.hp -= TURRET.damage;
            target.hitMs = 120;
        }
        shots.push({ turret: t.id, x: t.x, y: t.y, x2: target.x, y2: target.y, hit });
    }
    return shots;
}

/** What the blowtorch would do from where the player stands: seal this door, or cut this weld open. */
export interface WeldTarget { cell: number; action: 'weld' | 'cut' }

/**
 * The door the player is facing: the nearest door cell within reach and inside the cone of where they look. A
 * welded one is cut open; an open one is sealed unless somebody stands in it. Null when there is none.
 */
export function weldTarget(
    g: Grid, closed: readonly number[], welds: readonly Weld[], x: number, y: number, yaw: number, bodies: readonly { x: number; y: number }[],
): WeldTarget | null
{
    let best: WeldTarget | null = null;
    let bestD = Infinity;
    const x0 = Math.max(0, Math.floor(x - WELD.reach));
    const x1 = Math.min(g.w - 1, Math.floor(x + WELD.reach));
    const y0 = Math.max(0, Math.floor(y - WELD.reach));
    const y1 = Math.min(g.h - 1, Math.floor(y + WELD.reach));
    for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++)
        {
            const cell = cy * g.w + cx;
            if (cellAt(g, cell) !== 'door') continue;
            const mx = cx + 0.5;
            const my = cy + 0.5;
            const d = Math.hypot(mx - x, my - y);
            if (d > WELD.reach || d >= bestD) continue;
            // standing in the doorway counts as facing it
            if (d > 0.6 && Math.abs(angleDiff(angleTo(x, y, mx, my), yaw)) > WELD.coneDeg * DEG) continue;
            const welded = welds.some(wd => wd.cell === cell);
            // a door that was shut from the start has no weld to cut and nothing to seal
            if (!welded && closed.includes(cell)) continue;
            if (!welded)
            {
                if (bodies.some(b => Math.hypot(b.x - mx, b.y - my) < WELD.clear)) continue;
                if (d > 0.6 && !lineClear(g, closed, x, y, mx, my)) continue;
            }
            best = { cell, action: welded ? 'cut' : 'weld' };
            bestD = d;
        }
    return best;
}

/** Spits in the air: each ticks down and is returned as it lands. Mutates the list it is given. */
export function landedSpits(spits: Spit[], dtMs: number): Spit[]
{
    const landed: Spit[] = [];
    for (let i = spits.length - 1; i >= 0; i--)
    {
        spits[i].ms -= dtMs;
        if (spits[i].ms > 0) continue;
        landed.push(spits[i]);
        spits.splice(i, 1);
    }
    return landed;
}
