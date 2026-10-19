// Barrel distortion shared by the SVG displacement map and the touch correction in CrtScreen.

export const MAX_BEND_K = 0.05; // bend at 100 %: MAX_BEND_K * half the width, in px, at the middle of each edge

/** Slider value (0..100) to the bend coefficient. */
export function bendK(pct: number): number
{
    return Math.max(0, Math.min(100, pct)) / 100 * MAX_BEND_K;
}

export interface Box { left: number; top: number; width: number; height: number }

/** How far the source is sampled from the output pixel at (x, y): where the filter moves what you see. */
export function bendOffset(x: number, y: number, box: Box, k: number): { dx: number; dy: number }
{
    const u = ((x - box.left) / box.width) * 2 - 1;
    const v = ((y - box.top) / box.height) * 2 - 1;
    const r2 = u * u + v * v;
    return { dx: (box.width / 2) * u * k * r2, dy: (box.height / 2) * v * k * r2 };
}

/** The layout position of what the user sees at (x, y), i.e. where the browser must hit-test a touch. */
export function correctPoint(x: number, y: number, box: Box, k: number): { x: number; y: number }
{
    if (k <= 0 || box.width <= 0 || box.height <= 0) return { x, y };
    const { dx, dy } = bendOffset(x, y, box, k);
    return { x: x + dx, y: y + dy };
}
