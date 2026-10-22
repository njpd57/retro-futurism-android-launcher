/**
 * The ship's bloom: the bright parts of a frame (lamps, monitors, the scan band) are cut out at half size, blurred in
 * two passes and added back, so the 3D view glows like the text around it. Only the numbers live here; `gl.ts` runs it.
 */

/** taps on each side of the centre of one blur pass; the shader's `uWeights` holds `BLUR_TAPS + 1` */
export const BLUR_TAPS = 4;

/** how far above the background (0..1 of the way to the phosphor) a pixel must be to start glowing */
export const BLOOM_THRESHOLD = 0.55;

/** the gain at the full BLOOM setting */
const MAX_GAIN = 1.6;

/** Gaussian weights for the centre and each side tap, normalised so the centre plus both sides add up to 1. */
export function blurWeights(taps = BLUR_TAPS): Float32Array
{
    const sigma = Math.max(taps, 1) / 2;
    const raw = Array.from({ length: taps + 1 }, (_, i) => Math.exp(-(i * i) / (2 * sigma * sigma)));
    const sum = raw[0] + 2 * raw.slice(1).reduce((a, b) => a + b, 0);
    return Float32Array.from(raw, w => w / sum);
}

/** The size of the blur buffers: half the frame, never empty. */
export function bloomSize(width: number, height: number): [number, number]
{
    return [Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2))];
}

/** How strongly the glow is added for the user's BLOOM (0..1); 0 turns the passes off. */
export function bloomGain(bloom: number): number
{
    if (!Number.isFinite(bloom) || bloom <= 0) return 0;
    return Math.min(bloom, 1) * MAX_GAIN;
}
