import type { V3 } from '../../math';
import { BRIDGE_CONSOLES, roomAt } from '../../world';
import { MAT, Builder } from '../../mesh/builder';
import { made } from '../../mesh/doorway';

/** A slanted keyboard on each bridge console: low toward the middle of the bridge, rising to the back, lit from within. */
export function addKeyboards(b: Builder)
{
    for (const c of BRIDGE_CONSOLES)
    {
        b.room = roomAt(c.x, c.y) ?? null;
        const cs = Math.cos(c.yaw);
        const sn = Math.sin(c.yaw);
        // `u` runs along the console, `v` toward the middle of the bridge
        const corner = (u: number, v: number, up: number): V3 => [c.x + u * cs - v * sn, up, c.y + u * sn + v * cs];
        const top = c.z0 + c.h;
        const [hw, hd] = [c.w / 2 - 0.25, c.d / 2 - 0.1];
        const q: [V3, V3, V3, V3] = [corner(-hw, hd, top + 0.02), corner(hw, hd, top + 0.02), corner(hw, -hd, top + 0.2), corner(-hw, -hd, top + 0.2)];
        const e1: V3 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]];
        const e2: V3 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
        let n: V3 = [e2[1] * e1[2] - e2[2] * e1[1], e2[2] * e1[0] - e2[0] * e1[2], e2[0] * e1[1] - e2[1] * e1[0]];
        if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
        const l = Math.hypot(...n);
        const nn: V3 = [n[0] / l, n[1] / l, n[2] / l];
        b.quad(q, nn, [[0, 0], [hw * 2, 0], [hw * 2, hd * 2], [0, hd * 2]], made(MAT.prop, 'graphite'), 0);
        // rows of lit keys in colour, standing a hair off the board
        const at = (s: number, t: number): V3 =>
        {
            const lerp = (a: V3, c: V3, k: number): V3 => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k];
            const p = lerp(lerp(q[0], q[1], s), lerp(q[3], q[2], s), t);
            return [p[0] + nn[0] * 0.006, p[1] + nn[1] * 0.006, p[2] + nn[2] * 0.006];
        };
        const keys = ['amber', 'green', 'red', 'blue', 'amber', 'green'];
        const cols = Math.max(3, Math.floor(hw * 2 / 0.32));
        for (let row = 0; row < 3; row++)
            for (let col = 0; col < cols; col++)
            {
                const [s0, t0] = [(col + 0.15) / cols, 0.12 + row * 0.28];
                const [s1, t1] = [(col + 0.85) / cols, t0 + 0.16];
                const id = keys[(col * 7 + row * 3 + Math.round(c.x * 3)) % keys.length];
                b.quad([at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)], nn, [[0, 0], [1, 0], [1, 1], [0, 1]], made(MAT.glow, id), (col + row) % 3 === 0 ? 0.5 : 0.22);
            }
    }
}

export const build = (b: Builder) => addKeyboards(b);
