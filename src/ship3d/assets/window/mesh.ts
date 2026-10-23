import { assetMaterial } from '../../assets';
import { MAT, type Builder } from '../../mesh/builder';
import { made, wallBox, wallPoint, type WallFrame } from '../../mesh/doorway';
import { centroid, ROOMS, type V2 } from '../../world';

/**
 * The window onto space: one pane of glass on each side of a room's outline from `from` to `to` (indices into the
 * outline: side `k` runs from point `k` to `k + 1`), in a frame with a seal along the glass. The glass is a plain quad a
 * hair in front of the wall; the sky itself is painted by the shader (`MAT.window`), so this only places frame and pane.
 */
export function build(b: Builder, p: Record<string, unknown>)
{
    const room = ROOMS.find(r => r.id === p.room);
    if (!room) { console.warn(`window: no room "${p.room}"`); return; }
    const { from, to, sill, head, post, depth, rail } = p as Record<'from' | 'to' | 'sill' | 'head' | 'post' | 'depth' | 'rail', number>;
    const frame = made(MAT.prop, String(p.frame));
    const seal = made(MAT.prop, String(p.seal));
    b.room = room;
    const [cx, cy] = centroid(room.poly);
    for (let k = from; k < to; k++)
    {
        const [a, c] = [room.poly[k], room.poly[k + 1]];
        if (!a || !c) break;
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        const along: V2 = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
        let normal: V2 = [-along[1], along[0]];
        // into the room
        if ((cx - (a[0] + c[0]) / 2) * normal[0] + (cy - (a[1] + c[1]) / 2) * normal[1] < 0) normal = [-normal[0], -normal[1]];
        const f: WallFrame = { origin: a, along, normal };
        const t0 = post;
        const t1 = len - post;
        const z0 = sill + rail;
        const z1 = head - rail;

        // the sky: the shader draws it from the view ray, so the uvs mean nothing
        b.quad([wallPoint(f, t0, z1, 0.004), wallPoint(f, t1, z1, 0.004), wallPoint(f, t1, z0, 0.004), wallPoint(f, t0, z0, 0.004)],
            [normal[0], 0, normal[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], assetMaterial('window'), 0);
        // sill and head, heavier below, a seal along the glass
        wallBox(b, f, 0, len, sill, sill + rail, 0, depth + 0.06, frame);
        wallBox(b, f, 0, len, head - rail, head, 0, depth, frame);
        wallBox(b, f, t0, t1, z0, z0 + 0.04, 0, depth + 0.02, seal);
        wallBox(b, f, t0, t1, z1 - 0.04, z1, 0, depth + 0.02, seal);
        // a post at each end of the pane, and a thin one in the middle
        wallBox(b, f, 0, post, sill, head, 0, depth + 0.04, frame);
        wallBox(b, f, len - post, len, sill, head, 0, depth + 0.04, frame);
        wallBox(b, f, len / 2 - 0.05, len / 2 + 0.05, z0, z1, 0, depth - 0.04, frame);
    }
    b.room = null;
}
