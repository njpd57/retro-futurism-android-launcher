/**
 * Pure helpers of the animation system. `useAnimStore` decides which categories are on; everything here only does
 * the arithmetic, so it is tested. Motion is mechanical: values move in whole steps, never eased.
 */
export type AnimCategory = 'text' | 'transitions' | 'ambient';

export interface AnimFlags { text: boolean; transitions: boolean; ambient: boolean }

/** A category runs only if the user left it on and the system doesn't ask for reduced motion. */
export function animEnabled(category: AnimCategory, flags: AnimFlags, reducedMotion: boolean): boolean
{
    return !reducedMotion && flags[category];
}

/** The current frame (0..steps) of an animation of `durationMs` cut into `steps` equal frames; holds the last one. */
export function stepAt(elapsedMs: number, durationMs: number, steps: number): number
{
    if (durationMs <= 0 || steps <= 0) return Math.max(0, steps);
    const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
    return Math.min(steps, Math.floor(t * steps));
}

/** How many characters of a typed text are visible after `elapsedMs` at `cps` characters per second. */
export function typedLength(total: number, elapsedMs: number, cps: number): number
{
    if (cps <= 0) return total;
    return Math.min(total, Math.max(0, Math.floor((elapsedMs / 1000) * cps)));
}

/** Time a text of `total` characters takes to type at `cps`, capped so a long reply never makes the user wait. */
export function typeDuration(total: number, cps: number, maxMs = 1500): number
{
    if (cps <= 0) return 0;
    return Math.min(maxMs, Math.round((total / cps) * 1000));
}

/** Durations of the screen transitions (ms). The CSS keyframes that play them must use the same values. */
export const TRANSITION_MS = { wipe: 240, unfold: 180, menu: 160 } as const;

/** Extra characters per second a typewriter gains for each character it is behind, so streamed text never lags far. */
export const TYPE_CATCH_UP = 2;

/**
 * Next position (in characters, fractional) of a typewriter that is at `pos` of `total` after `dtMs`: it types at
 * `cps` and speeds up the further behind it is (a streamed answer grows while it is being typed).
 */
export function typewriterAdvance(pos: number, total: number, dtMs: number, cps: number): number
{
    if (pos >= total) return total;
    if (cps <= 0 || dtMs <= 0) return Math.max(0, pos);
    const rate = cps + (total - pos) * TYPE_CATCH_UP;
    return Math.min(total, Math.max(0, pos) + (rate * dtMs) / 1000);
}

/** A pressed control stays lit at least this long, so a quick tap is still seen. */
export const PRESS_MIN_MS = 110;

/** How long to keep a control lit after release, given when it was pressed and when it was released. */
export function pressHoldLeft(pressedAt: number, releasedAt: number, minMs = PRESS_MIN_MS): number
{
    return Math.max(0, minMs - (releasedAt - pressedAt));
}

export interface NoiseParams
{
    /** where the interference line crosses the window, % of its height */
    y: number;
    /** seconds between bursts */
    durS: number;
    /** animation delay in seconds (negative: the cycle starts part way through, so windows are out of step) */
    delayS: number;
}

/** A stable pseudo-random look for a window's interference line, from a seed (its id or title). */
export function noiseParams(seed: string): NoiseParams
{
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    const unit = (n: number) => ((h >>> n) % 1000) / 1000 + 0.0005; // three different slices of the hash
    const durS = 13 + Math.floor(unit(0) * 14);
    return { y: 12 + Math.round(unit(7) * 76), durS, delayS: -Math.round(unit(14) * durS * 10) / 10 };
}

/** A readout counting from `from` to `to`: linear, in whole numbers, holds the end. */
export function tweenValue(from: number, to: number, elapsedMs: number, durMs: number): number
{
    if (durMs <= 0 || elapsedMs >= durMs) return to;
    const t = Math.max(0, elapsedMs) / durMs;
    return Math.round(from + (to - from) * t);
}
