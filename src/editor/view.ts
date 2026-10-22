import type { V2 } from '@/ship3d/world';

/** The plan view's camera: the middle of the screen in metres and how many metres reach the top edge. */
export class PlanView
{
    x = 0;
    y = 30;
    half = 45;
    width = 1;
    height = 1;

    get scale() { return this.height / (2 * this.half); }

    toScreen(wx: number, wy: number): V2
    {
        return [this.width / 2 + (wx - this.x) * this.scale, this.height / 2 + (wy - this.y) * this.scale];
    }

    toWorld(px: number, py: number): V2
    {
        return [this.x + (px - this.width / 2) / this.scale, this.y + (py - this.height / 2) / this.scale];
    }

    resize(w: number, h: number) { this.width = w; this.height = h; }

    pan(dpx: number, dpy: number) { this.x -= dpx / this.scale; this.y -= dpy / this.scale; }

    /** Zooms by `factor` keeping the plan point under `(px, py)` where it is. */
    zoom(factor: number, px: number, py: number)
    {
        const [wx, wy] = this.toWorld(px, py);
        this.half = Math.min(120, Math.max(2, this.half / factor));
        this.x = wx - (px - this.width / 2) / this.scale;
        this.y = wy - (py - this.height / 2) / this.scale;
    }

    /** Frames a rectangle of the plan. */
    fit(x0: number, y0: number, x1: number, y1: number)
    {
        this.x = (x0 + x1) / 2;
        this.y = (y0 + y1) / 2;
        const needH = (y1 - y0) / 2 + 3;
        const needW = ((x1 - x0) / 2 + 3) * (this.height / this.width);
        this.half = Math.max(needH, needW);
    }
}
