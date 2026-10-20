export const AUTO_DEGAUSS_MIN_MINUTES = 20;
export const AUTO_DEGAUSS_MAX_MINUTES = 60;

/** Minutes of screen time until the next automatic degauss: a whole number between the two limits, picked with `rng` (0..1). */
export function nextDegaussMinutes(rng: () => number): number
{
    const span = AUTO_DEGAUSS_MAX_MINUTES - AUTO_DEGAUSS_MIN_MINUTES;
    const r = Math.min(0.999999, Math.max(0, rng()));
    return AUTO_DEGAUSS_MIN_MINUTES + Math.floor(r * (span + 1));
}
