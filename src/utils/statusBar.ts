/** Share of the bar left empty for the camera when the system gives no cutout shape. */
export const DEFAULT_CAMERA_FRACTION = 0.2;

/**
 * Horizontal span of the camera cutout, as fractions of the screen width, from the bounding box of the SVG
 * path Bridge gives (`getDisplayCutoutPath`, in screen pixels). Null when the path is missing or unreadable.
 */
export function cutoutSpan(path: string | null | undefined, screenWidth: number): { from: number; to: number } | null
{
    if (typeof path !== 'string' || !path || !(screenWidth > 0)) return null;
    // the path is absolute M/L/C/Z commands: x values are the even-indexed numbers of each pair
    const nums = (path.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    if (nums.length < 4) return null;
    const xs = nums.filter((_, i) => i % 2 === 0);
    const from = Math.max(0, Math.min(...xs) / screenWidth);
    const to = Math.min(1, Math.max(...xs) / screenWidth);
    return to > from ? { from, to } : null;
}

/**
 * Width of the empty gap in the middle of the bar, as a fraction of its width. A manual value (0..1, 0 = auto)
 * wins; otherwise the cutout's width plus a small margin; otherwise the default.
 */
export function cameraGap(manual: number, span: { from: number; to: number } | null): number
{
    if (manual > 0) return Math.min(0.6, manual);
    if (!span) return DEFAULT_CAMERA_FRACTION;
    return Math.min(0.6, span.to - span.from + 0.04);
}
