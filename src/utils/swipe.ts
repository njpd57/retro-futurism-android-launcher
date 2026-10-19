export type SwipeKind = 'left' | 'right' | 'pull-down';

export interface SwipeInput
{
    dx: number;
    dy: number;
    /** where the touch started, px from the top of the screen */
    startY: number;
    ms: number;
}

export const SWIPE_MIN_PX = 70;
/** a horizontal swipe must be clearly more horizontal than vertical */
export const SWIPE_RATIO = 2;
export const SWIPE_MAX_MS = 700;
/** pull-down only counts when it starts this close to the top edge */
export const PULL_EDGE_PX = 56;
export const PULL_MIN_PX = 90;

/** Classifies a finished touch. Vertical scrolling must never be classified as a swipe. */
export function classifySwipe({ dx, dy, startY, ms }: SwipeInput): SwipeKind | null
{
    if (ms > SWIPE_MAX_MS) return null;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    if (ax >= SWIPE_MIN_PX && ax >= ay * SWIPE_RATIO)
        return dx < 0 ? 'left' : 'right';

    if (startY <= PULL_EDGE_PX && dy >= PULL_MIN_PX && ay >= ax * SWIPE_RATIO)
        return 'pull-down';

    return null;
}

/** Next/previous item of a list; null at the ends (no wrap-around). */
export function neighbour<T>(items: readonly T[], current: T, step: 1 | -1): T | null
{
    const i = items.indexOf(current);
    if (i < 0) return null;
    return items[i + step] ?? null;
}
