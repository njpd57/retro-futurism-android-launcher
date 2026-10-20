import { soundDistance, type Grid } from './grid';
import { angleDiff, angleTo, lineClear } from '../wire/physics';

/**
 * What a creature can see and hear, for free movement. Distances are in cells of the scaled deck (twice the
 * old ones: see `scale.ts`). Pure: the caller says who looks at whom and how far they can see.
 */

export const SENSES = {
    /** half the angle of the creature's view, radians */
    alienFov: (70 * Math.PI) / 180,
    /** half the angle of the android's view */
    ashFov: (45 * Math.PI) / 180,
    /** the player's body radius: rays go this far to each side of the centre */
    bodyRadius: 0.22,
    /** the joystick tilt (0..1) under which the player is sneaking */
    sneakTilt: 0.5,
    /** how much of the sight range is left while sneaking */
    sneakSight: 0.6,
    /** closer than this, it sees you whatever the angle (it is on top of you) */
    closeRange: 1,
};

export interface Eye { x: number; y: number; heading: number }
export interface Point { x: number; y: number }

export interface SightOptions
{
    /** how far it sees, in cells */
    range: number;
    /** half the angle of its view, radians */
    fov: number;
    /** a hidden target is never seen */
    hidden?: boolean;
    /** the target's body radius */
    radius?: number;
}

/** The cell index holding the point (`x`, `y`), or -1 off the deck. */
export function cellOf(g: Grid, x: number, y: number): number
{
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    return cx < 0 || cy < 0 || cx >= g.w || cy >= g.h ? -1 : cy * g.w + cx;
}

/** Sight range once the player's tilt is known: sneaking shortens it. */
export const sightRange = (range: number, tilt: number) => tilt > 0 && tilt < SENSES.sneakTilt ? range * SENSES.sneakSight : range;

/** Loudness of a footstep: the quieter the joystick is pushed, the less it carries. */
export const stepLoudness = (base: number, tilt: number) => base * Math.min(Math.max(tilt, 0), 1);

/**
 * Whether `eye` sees `target`: within range and inside its view cone, with nothing solid between. A single ray
 * would let it see through a slit the player could not squeeze into, so the centre ray must be clear and so must
 * one of the two offset by the body radius to each side.
 */
export function canSee(g: Grid, closed: readonly number[], eye: Eye, target: Point, o: SightOptions): boolean
{
    if (o.hidden) return false;
    const dx = target.x - eye.x;
    const dy = target.y - eye.y;
    const dist = Math.hypot(dx, dy);
    if (dist > o.range) return false;
    if (dist > SENSES.closeRange && Math.abs(angleDiff(angleTo(eye.x, eye.y, target.x, target.y), eye.heading)) > o.fov) return false;
    if (!lineClear(g, closed, eye.x, eye.y, target.x, target.y)) return false;
    if (dist < 1e-6) return true;
    // the side vector, perpendicular to the line of sight
    const r = o.radius ?? SENSES.bodyRadius;
    const sx = (-dy / dist) * r;
    const sy = (dx / dist) * r;
    return lineClear(g, closed, eye.x, eye.y, target.x + sx, target.y + sy)
        || lineClear(g, closed, eye.x, eye.y, target.x - sx, target.y - sy);
}

/**
 * Whether a sound of `loudness` cells made at `from` reaches `to`. It goes round walls through the deck, and each
 * closed door it crosses costs `doorCost` cells.
 */
export function hears(g: Grid, closed: readonly number[], from: Point, to: Point, loudness: number, doorCost: number): boolean
{
    const a = cellOf(g, from.x, from.y);
    const b = cellOf(g, to.x, to.y);
    if (a < 0 || b < 0 || loudness <= 0) return false;
    return soundDistance(g, closed, a, b, doorCost, loudness) <= loudness;
}
