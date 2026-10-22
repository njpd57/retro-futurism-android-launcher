/** How the ship panel spares the battery. Pure. */

export interface BatteryLike { level: number; isCharging: boolean }

/** Below this share of charge, and not plugged in, the panel eases off by itself. */
export const LOW_BATTERY = 20;

export const lowPower = (b: BatteryLike | null | undefined): boolean => !!b && !b.isCharging && b.level < LOW_BATTERY;

export type FpsMode = 'eco' | '30' | '60';

/** Milliseconds between frames (a little under, so a frame doesn't slip a vsync). AHORRO draws 60 moving and 10 idle; low power caps everything at 30 moving. */
export function frameWait(mode: FpsMode, active: boolean, low: boolean): number
{
    const fps30 = 1000 / 30 - 2;
    const fps60 = 1000 / 60 - 2;
    if (mode === '30') return fps30;
    if (mode === '60') return low ? fps30 : fps60;
    return active ? (low ? fps30 : fps60) : 100;
}

/** Device pixels drawn per CSS pixel. */
export const renderScale = (dpr: number, low: boolean): number => Math.min(dpr || 1, low ? 1 : 1.5);

export const LOOK_MIN = 50;
export const LOOK_MAX = 200;

/** The look speed setting (a percentage) as a multiplier, kept within what makes sense. */
export const lookScale = (percent: number): number => Math.min(LOOK_MAX, Math.max(LOOK_MIN, Number.isFinite(percent) ? percent : 100)) / 100;
