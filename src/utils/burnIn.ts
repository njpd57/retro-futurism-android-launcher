/** The faintest ghost the tube ever shows: it must stay far below anything that could lower the text contrast. */
export const BURN_MAX_OPACITY = 0.03;
/** Minutes of use after which the ghost has reached ~63 % of its maximum (about 40 hours). */
export const BURN_TIME_CONSTANT_MIN = 40 * 60;

/** Opacity of the burn-in ghost after `minutes` of use: it grows quickly at first and saturates at `BURN_MAX_OPACITY`. */
export function burnOpacity(minutes: number): number
{
    if (!Number.isFinite(minutes) || minutes <= 0) return 0;
    return BURN_MAX_OPACITY * (1 - Math.exp(-minutes / BURN_TIME_CONSTANT_MIN));
}

export interface BurnBand { top: number; height: number }

/**
 * Where the ghost bands go: the 2px edge just inside the dark area below the top bar and above the soft keys, the two
 * lines of the frame that never move. Bands that fall outside the screen, or have no element, are left out.
 */
export function burnBands(topBarBottom: number | null, softKeysTop: number | null, screenHeight: number): BurnBand[]
{
    const bands: BurnBand[] = [];
    const EDGE = 2;
    if (topBarBottom !== null && topBarBottom >= 0 && topBarBottom + EDGE <= screenHeight) bands.push({ top: topBarBottom, height: EDGE });
    if (softKeysTop !== null && softKeysTop - EDGE >= 0 && softKeysTop <= screenHeight) bands.push({ top: softKeysTop - EDGE, height: EDGE });
    return bands;
}
