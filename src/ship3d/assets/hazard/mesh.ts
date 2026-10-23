import type { V3 } from '../../math';
import { portalAxis, PORTALS, roomAt } from '../../world';
import { zoneDef } from '../../zones';
import { MAT, Builder } from '../../mesh/builder';

/** Chevrons on the floor on both faces of the doorways of the working rooms. */
export function addHazard(b: Builder)
{
    for (const p of PORTALS)
    {
        const a = portalAxis(p);
        for (const side of [-1, 1])
        {
            const room = roomAt(p.x + a.nx * side * 0.8, p.y + a.ny * side * 0.8);
            if (!room || !zoneDef(room.zone)?.work) continue;
            b.room = room;
            const [hw, d0, d1] = [p.width / 2 + 0.2, 0.15, 1.05];
            const corner = (u: number, d: number): V3 => [p.x + a.dx * u + a.nx * side * d, 0.012, p.y + a.dy * u + a.ny * side * d];
            b.quad([corner(-hw, d0), corner(hw, d0), corner(hw, d1), corner(-hw, d1)], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.hazard, 0);
        }
    }
}

export const build = (b: Builder) => addHazard(b);
