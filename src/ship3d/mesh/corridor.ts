import type { V3 } from '../math';
import { type Room, type V2 } from '../world';
import { MAT, Builder } from './builder';
import { made, wallBox, wallPoint, type WallFrame } from './doorway';

export const rectOutline = (x0: number, y0: number, x1: number, y1: number): V2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Rows of padded cushions up each wall of a corridor, between the sill and the cornice: `[z0, z1]`. */
export const CUSHIONS: readonly [number, number][] = [[0.62, 1.52], [1.6, 2.48]];
/** The sloped sill along the foot of each wall: it leans from `top` on the wall down to `lip` high, `out` from it. */
const SILL = { top: 0.55, lip: 0.15, out: 0.4 };
/** The cornice where each wall meets the ceiling: `drop` down the wall, `out` across the ceiling. */
const CORNICE = { drop: 0.45, out: 0.4 };
/** Metres between the moulded ribs. */
const BAY = 1.5;

/** A quad in a wall frame from four `[t, z, o]` corners. */
function frameQuad(b: Builder, f: WallFrame, c: [number, number, number][], n: V3, mat: number, emit = 0)
{
    const pts = c.map(([t, z, o]) => wallPoint(f, t, z, o)) as [V3, V3, V3, V3];
    b.quad(pts, n, c.map(([t, z, o]) => [t, z + o] as [number, number]), mat, emit);
}

/**
 * The Torrens's padded hallway: a white sill sloping down to the floor with vents in it, ribs up the walls with orange
 * cushions stepped out between them, a white cornice at the ceiling and a strip of light down the middle.
 */
export function addCorridor(b: Builder, room: Room)
{
    b.room = room;
    const xs = room.poly.map(p => p[0]);
    const ys = room.poly.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const alongX = x1 - x0 > y1 - y0;
    const [a0, a1, c0, c1] = alongX ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
    const h = room.height;
    const orange = made(MAT.prop, 'orange');
    const louvre = made(MAT.prop, 'louvre');

    // the ribs, spaced evenly from end to end
    const bays = Math.max(1, Math.round((a1 - a0) / BAY));
    const ribs = Array.from({ length: bays - 1 }, (_, i) => a0 + ((i + 1) * (a1 - a0)) / bays);
    const stops = [a0 + 0.1, ...ribs, a1 - 0.1];

    for (const side of [0, 1])
    {
        const wall = side === 0 ? c0 : c1;
        const into = side === 0 ? 1 : -1;
        const f: WallFrame = alongX
            ? { origin: [0, wall], along: [1, 0], normal: [0, into] }
            : { origin: [wall, 0], along: [0, 1], normal: [into, 0] };
        const nrm = (o: number, z: number): V3 => [f.normal[0] * o, z, f.normal[1] * o];

        // the sill: a slope and a little upright lip, closed at both ends
        const s = Math.SQRT1_2;
        frameQuad(b, f, [[a0, SILL.top, 0], [a1, SILL.top, 0], [a1, SILL.lip, SILL.out], [a0, SILL.lip, SILL.out]], nrm(s, s), MAT.frame);
        frameQuad(b, f, [[a0, SILL.lip, SILL.out], [a1, SILL.lip, SILL.out], [a1, 0, SILL.out], [a0, 0, SILL.out]], nrm(1, 0), MAT.frame);
        // the cornice
        frameQuad(b, f, [[a0, h - CORNICE.drop, 0], [a1, h - CORNICE.drop, 0], [a1, h, CORNICE.out], [a0, h, CORNICE.out]], nrm(s, -s), MAT.frame);
        for (const t of [a0, a1])
        {
            const n: V3 = [f.along[0], 0, f.along[1]];
            b.tri(wallPoint(f, t, 0, 0), wallPoint(f, t, SILL.top, 0), wallPoint(f, t, SILL.lip, SILL.out), n, MAT.frame, 0);
            b.tri(wallPoint(f, t, 0, 0), wallPoint(f, t, SILL.lip, SILL.out), wallPoint(f, t, 0, SILL.out), n, MAT.frame, 0);
            b.tri(wallPoint(f, t, h - CORNICE.drop, 0), wallPoint(f, t, h, 0), wallPoint(f, t, h, CORNICE.out), n, MAT.frame, 0);
        }

        for (const u of ribs) wallBox(b, f, u - 0.07, u + 0.07, SILL.top - 0.05, h - CORNICE.drop + 0.05, 0, 0.22, MAT.frame);

        for (let i = 0; i < stops.length - 1; i++)
        {
            const [u0, u1] = [stops[i] + 0.1, stops[i + 1] - 0.1];
            if (u1 - u0 < 0.4) continue;
            // a vent let into the slope of the sill, a hair above it
            const [v0, v1] = [u0 + 0.15, u1 - 0.15];
            const lift = 0.006;
            frameQuad(b, f, [[v0, SILL.top - 0.08, 0.08 + lift], [v1, SILL.top - 0.08, 0.08 + lift], [v1, SILL.lip + 0.08, SILL.out - 0.08 + lift],
                [v0, SILL.lip + 0.08, SILL.out - 0.08 + lift]], nrm(s, s), louvre);
            // the cushions, each a stack of three slabs, smaller as they stand out, for the stepped padding
            for (const [z0, z1] of CUSHIONS)
                for (const [inset, o] of [[0, 0.07], [0.05, 0.12], [0.11, 0.16]])
                    wallBox(b, f, u0 + inset, u1 - inset, z0 + inset, z1 - inset, 0, o, orange);
        }
    }

    // a strip of light down the middle of the ceiling
    const [m, hw] = [(c0 + c1) / 2, 0.18];
    const P = (u: number, v: number): V3 => (alongX ? [u, h - 0.01, v] : [v, h - 0.01, u]);
    b.quad([P(a0 + 0.6, m - hw), P(a1 - 0.6, m - hw), P(a1 - 0.6, m + hw), P(a0 + 0.6, m + hw)], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.glow, 0.9);
}
