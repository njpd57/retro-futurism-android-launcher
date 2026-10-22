import type { Seg } from './world';

/** The point of a segment nearest to `(x, y)`. */
function nearest(s: Seg, x: number, y: number): [number, number]
{
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / len2));
    return [s.ax + dx * t, s.ay + dy * t];
}

/** Pushes a circle out of every segment it overlaps; a few passes settle a corner. */
export function pushOut(segs: readonly Seg[], x: number, y: number, r: number): { x: number; y: number }
{
    for (let pass = 0; pass < 4; pass++)
    {
        let moved = false;
        for (const s of segs)
        {
            const [cx, cy] = nearest(s, x, y);
            const dx = x - cx;
            const dy = y - cy;
            const d = Math.hypot(dx, dy);
            if (d >= r) continue;
            if (d > 1e-9)
            {
                x += (dx / d) * (r - d);
                y += (dy / d) * (r - d);
            }
            else
            {
                // exactly on the line: step out along the segment's normal
                const l = Math.hypot(s.bx - s.ax, s.by - s.ay) || 1;
                x += (-(s.by - s.ay) / l) * r;
                y += ((s.bx - s.ax) / l) * r;
            }
            moved = true;
        }
        if (!moved) break;
    }
    return { x, y };
}

/**
 * Moves a circle by `(dx, dy)` and slides it along whatever it meets. The move is cut into steps of at most half
 * its radius, so a fast frame cannot jump through a wall.
 */
export function moveCircle(segs: readonly Seg[], x: number, y: number, dx: number, dy: number, r: number): { x: number; y: number }
{
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r * 0.5)));
    let p = { x, y };
    for (let i = 0; i < steps; i++) p = pushOut(segs, p.x + dx / steps, p.y + dy / steps, r);
    return p;
}

/** Whether a circle at `(x, y)` overlaps any segment. */
export function collides(segs: readonly Seg[], x: number, y: number, r: number): boolean
{
    return segs.some(s =>
    {
        const [cx, cy] = nearest(s, x, y);
        return Math.hypot(x - cx, y - cy) < r;
    });
}
