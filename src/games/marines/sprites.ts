import type { P2 } from '../wire/camera';

/**
 * Silhouettes for the MARINES view, in the same units as `wire/creature.ts`: x across (-0.5..0.5), y from the top of
 * the sprite (-0.5) to the floor (0.5). Pure data.
 */

/** A marine seen from the front or the back: helmet, shoulders, arms, hips and two legs, as one outline. */
export const MARINE_OUTLINE: readonly P2[] = [
    [-0.07, -0.3], [0.07, -0.3], [0.1, -0.24], [0.09, -0.15],
    [0.2, -0.12], [0.22, 0.08], [0.12, 0.1],
    [0.12, 0.5], [0.02, 0.5], [0.01, 0.18], [-0.01, 0.18], [-0.02, 0.5], [-0.12, 0.5],
    [-0.12, 0.1], [-0.22, 0.08], [-0.2, -0.12], [-0.09, -0.15], [-0.1, -0.24],
];

/** The visor across the helmet. */
export const MARINE_VISOR: readonly P2[] = [[-0.075, -0.225], [0.075, -0.225]];

/** The body of a facehugger, side on and crouched on the floor, and the legs that carry it. */
export const HUGGER_BODY: readonly P2[] = [
    [-0.13, 0.38], [-0.08, 0.31], [0.02, 0.29], [0.11, 0.33], [0.15, 0.4], [0.08, 0.45], [-0.06, 0.45],
];
/** Each leg is a line from the body to the floor (a knee between). */
export const HUGGER_LEGS: readonly (readonly P2[])[] = [
    [[-0.1, 0.42], [-0.2, 0.36], [-0.27, 0.5]],
    [[-0.05, 0.44], [-0.1, 0.36], [-0.14, 0.5]],
    [[0.04, 0.44], [0.08, 0.36], [0.12, 0.5]],
    [[0.1, 0.42], [0.2, 0.36], [0.26, 0.5]],
];
/** The tail, long, curling up behind. */
export const HUGGER_TAIL: readonly P2[] = [[-0.12, 0.4], [-0.3, 0.46], [-0.42, 0.38], [-0.46, 0.28]];
