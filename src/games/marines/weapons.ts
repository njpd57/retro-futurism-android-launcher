import type { Grid } from '../isolation/grid';
import { castRay } from '../wire/occlusion';
import { angleDiff, angleTo, forward, lineClear, rayCircle } from './physics';
import type { Rng } from '../isolation/rng';

export type WeaponId = 'rifle' | 'shotgun' | 'smartgun' | 'flamer';

/** The order the weapon key cycles through. */
export const WEAPON_ORDER: readonly WeaponId[] = ['rifle', 'shotgun', 'smartgun', 'flamer'];

export interface WeaponDef
{
    id: WeaponId;
    name: string;
    /** what the counter counts: rounds, shells, fuel */
    unit: string;
    /** `bullet`: hitscan rounds (one or many pellets); `flame`: a cone of fire that burns everything in it */
    kind: 'bullet' | 'flame';
    /** rounds in a magazine, and the most that can be carried besides it */
    mag: number;
    reserveMax: number;
    /** reserve added by an ammunition box, and by the crate the weapon is found in (with a full magazine) */
    box: number;
    crate: number;
    fireMs: number;
    reloadMs: number;
    /** damage of each pellet (or of each tick of flame) */
    damage: number;
    pellets: number;
    /** the damage drops with distance, down to a third at the end of the range */
    falloff: boolean;
    /** cells */
    range: number;
    /** degrees: the spread grows from `spreadMin` to `spreadMax` as `heat` goes from 0 to 1 */
    spreadMin: number;
    spreadMax: number;
    heatPerShot: number;
    heatDecayPerS: number;
    /** degrees: a target this close to where you look is aimed at for you */
    assistDeg: number;
    /** degrees: half the width of the flame */
    coneDeg: number;
    /** the sights mark the creature that is being aimed at */
    lock: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
    rifle: {
        id: 'rifle', name: 'RIFLE DE PULSOS', unit: 'MUN', kind: 'bullet', mag: 99, reserveMax: 495, box: 99, crate: 0,
        fireMs: 100, reloadMs: 1600, damage: 1, pellets: 1, falloff: false, range: 14,
        spreadMin: 1.5, spreadMax: 5, heatPerShot: 0.09, heatDecayPerS: 1.2, assistDeg: 4.5, coneDeg: 0, lock: false,
    },
    // nine pellets: a kill at a couple of cells, a wound beyond a few
    shotgun: {
        id: 'shotgun', name: 'ESCOPETA', unit: 'CART', kind: 'bullet', mag: 6, reserveMax: 36, box: 12, crate: 18,
        fireMs: 750, reloadMs: 2000, damage: 1.1, pellets: 9, falloff: true, range: 9,
        spreadMin: 5.5, spreadMax: 5.5, heatPerShot: 0, heatDecayPerS: 1, assistDeg: 4, coneDeg: 0, lock: false,
    },
    // fast and light, and it finds the target for the shooter: the price is a magazine that empties in ten seconds
    smartgun: {
        id: 'smartgun', name: 'SMARTGUN', unit: 'MUN', kind: 'bullet', mag: 150, reserveMax: 450, box: 100, crate: 150,
        fireMs: 70, reloadMs: 2800, damage: 0.8, pellets: 1, falloff: false, range: 12,
        spreadMin: 1, spreadMax: 2.5, heatPerShot: 0.04, heatDecayPerS: 1.5, assistDeg: 22, coneDeg: 0, lock: true,
    },
    // `spread` is only how wide the crosshair opens; the flame's own width is `coneDeg`
    flamer: {
        id: 'flamer', name: 'LANZALLAMAS', unit: 'COMB', kind: 'flame', mag: 100, reserveMax: 200, box: 60, crate: 100,
        fireMs: 80, reloadMs: 2200, damage: 0.9, pellets: 1, falloff: true, range: 4.2,
        spreadMin: 6, spreadMax: 6, heatPerShot: 0, heatDecayPerS: 1, assistDeg: 0, coneDeg: 14, lock: false,
    },
};

const DEG = Math.PI / 180;

/** Something a shot can hit. */
export interface Target { id: number; x: number; y: number; radius: number }

export interface Shot
{
    /** the yaw the round actually left at */
    aim: number;
    /** target hit, or null when it ended on a wall or ran out of range */
    hitId: number | null;
    impactX: number;
    impactY: number;
    distance: number;
}

/** Spread in radians at a given heat. */
export function spreadAt(def: WeaponDef, heat: number)
{
    return (def.spreadMin + (def.spreadMax - def.spreadMin) * Math.min(1, Math.max(0, heat))) * DEG;
}

/** The damage of a pellet or a lick of flame that lands `distance` cells away. */
export function damageAt(def: WeaponDef, distance: number)
{
    return def.falloff ? def.damage * (1 - 0.67 * Math.min(1, Math.max(0, distance / def.range))) : def.damage;
}

/**
 * The target the shooter is helped to aim at: the one closest to where they look within the assist cone, in range
 * and in plain view. Null when there is none.
 */
export function assistTarget<T extends Target>(g: Grid, closed: readonly number[], x: number, y: number, yaw: number, targets: readonly T[], def: WeaponDef): T | null
{
    let best: T | null = null;
    let bestScore = Infinity;
    for (const t of targets)
    {
        const d = Math.hypot(t.x - x, t.y - y);
        if (d > def.range || d < 0.01) continue;
        const off = Math.abs(angleDiff(angleTo(x, y, t.x, t.y), yaw));
        if (off > def.assistDeg * DEG) continue;
        if (!lineClear(g, closed, x, y, t.x, t.y)) continue;
        // closest to the sights first, then the nearer one
        const score = off + d * 0.002;
        if (score < bestScore)
        {
            best = t;
            bestScore = score;
        }
    }
    return best;
}

/** One round: aimed (with assist), spread by `spread` radians, and followed to the first wall or target. */
export function resolveShot(
    g: Grid, closed: readonly number[], x: number, y: number, yaw: number, targets: readonly Target[],
    def: WeaponDef, spread: number, rng: Rng,
): Shot
{
    const mark = assistTarget(g, closed, x, y, yaw, targets, def);
    const aim = (mark ? angleTo(x, y, mark.x, mark.y) : yaw) + (rng() * 2 - 1) * spread;
    const [dx, dy] = forward(aim);

    const wall = castRay(g, closed, x, y, dx, dy, def.range);
    let hitId: number | null = null;
    let distance = wall;
    for (const t of targets)
    {
        const d = rayCircle(x, y, dx, dy, t.x, t.y, t.radius);
        if (d !== null && d <= distance)
        {
            hitId = t.id;
            distance = d;
        }
    }
    return { aim, hitId, impactX: x + dx * distance, impactY: y + dy * distance, distance };
}

export interface FlameHit { id: number; distance: number }

/**
 * What a flame breathed along `yaw` reaches: every target inside the cone and the range that nothing solid hides,
 * and how far the flame itself goes (it stops at a wall). A target on top of the shooter (one clinging to them)
 * is always reached.
 */
export function flameReach(
    g: Grid, closed: readonly number[], x: number, y: number, yaw: number, targets: readonly Target[], def: WeaponDef,
): { hits: FlameHit[]; tip: number }
{
    const [dx, dy] = forward(yaw);
    const tip = castRay(g, closed, x, y, dx, dy, def.range);
    const hits: FlameHit[] = [];
    for (const t of targets)
    {
        const d = Math.hypot(t.x - x, t.y - y);
        if (d < 0.05)
        {
            hits.push({ id: t.id, distance: 0 });
            continue;
        }
        if (d - t.radius > def.range) continue;
        // the body has width: a target a little outside the cone still catches its edge
        const slack = Math.atan2(t.radius, d);
        if (Math.abs(angleDiff(angleTo(x, y, t.x, t.y), yaw)) > def.coneDeg * DEG + slack) continue;
        if (!lineClear(g, closed, x, y, t.x, t.y)) continue;
        hits.push({ id: t.id, distance: d });
    }
    return { hits, tip };
}
