import { ROOMS, centroid } from '../world';
import type { V2 } from '../world';
import { MAT, Builder } from './builder';
import { made, wallBox, wallPoint, type WallFrame } from './doorway';

/** Sides of the bridge's dome the great window spans, as indices into the room's outline: `FIRST` up to `LAST`. */
const FIRST = 2;
const LAST = 6;
/** Sill and head of the glass, in metres above the floor. */
const SILL = 0.95;
const HEAD = 3.55;
/** Width of a mullion (a post at each corner of the dome), and the depth of the frame out of the wall. */
const POST = 0.22;
const DEPTH = 0.16;
const RAIL = 0.16;

/**
 * The window onto space: one pane of glass on each of the middle sides of the bridge's dome, in a heavy graphite
 * frame with an orange seal. The glass is a plain quad a hair in front of the wall; the sky itself is painted by the
 * shader (`MAT.window`), so this only places the frame and the pane.
 */
export function addWindow(b: Builder)
{
    const room = ROOMS.find(r => r.zone === 'puente');
    if (!room) return;
    b.room = room;
    const [cx, cy] = centroid(room.poly);
    const graphite = made(MAT.prop, 'graphite');
    const orange = made(MAT.prop, 'orange');
    for (let k = FIRST; k < LAST; k++)
    {
        const [a, c] = [room.poly[k], room.poly[k + 1]];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const along: V2 = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
        let normal: V2 = [-along[1], along[0]];
        // into the room
        if ((cx - (a[0] + c[0]) / 2) * normal[0] + (cy - (a[1] + c[1]) / 2) * normal[1] < 0) normal = [-normal[0], -normal[1]];
        const f: WallFrame = { origin: a, along, normal };
        const t0 = POST;
        const t1 = len - POST;
        const z0 = SILL + RAIL;
        const z1 = HEAD - RAIL;

        // the sky: the shader draws it from the view ray, so the uvs mean nothing
        b.quad([wallPoint(f, t0, z1, 0.004), wallPoint(f, t1, z1, 0.004), wallPoint(f, t1, z0, 0.004), wallPoint(f, t0, z0, 0.004)],
            [normal[0], 0, normal[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.window, 0);
        // sill and head, heavier below, a seal along the glass
        wallBox(b, f, 0, len, SILL, SILL + RAIL, 0, DEPTH + 0.06, graphite);
        wallBox(b, f, 0, len, HEAD - RAIL, HEAD, 0, DEPTH, graphite);
        wallBox(b, f, t0, t1, z0, z0 + 0.04, 0, DEPTH + 0.02, orange);
        wallBox(b, f, t0, t1, z1 - 0.04, z1, 0, DEPTH + 0.02, orange);
        // a post at each end of the pane, and a thin one in the middle
        wallBox(b, f, 0, POST, SILL, HEAD, 0, DEPTH + 0.04, graphite);
        wallBox(b, f, len - POST, len, SILL, HEAD, 0, DEPTH + 0.04, graphite);
        wallBox(b, f, len / 2 - 0.05, len / 2 + 0.05, z0, z1, 0, DEPTH - 0.04, graphite);
    }    b.room = null;
}
