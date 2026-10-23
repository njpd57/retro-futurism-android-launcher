import { PORTALS, portalAxis, roomAt } from '../../world';
import { MAT, Builder } from '../../mesh/builder';

/**
 * A sliding door in each doorway: a leaf on either face of the opening. The vertices carry the door's number in the
 * `emit` slot, and the vertex shader lifts them by how open that door is.
 */
export function addDoors(b: Builder)
{
    PORTALS.forEach((p, i) =>
    {
        const a = portalAxis(p);
        b.room = roomAt(p.x + a.nx * 0.6, p.y + a.ny * 0.6) ?? null;
        for (const side of [-1, 1])
        {
            const off = side * 0.03;
            const [cx, cy] = [p.x + a.nx * off, p.y + a.ny * off];
            const [x0, y0, x1, y1] = [cx - (a.dx * p.width) / 2, cy - (a.dy * p.width) / 2, cx + (a.dx * p.width) / 2, cy + (a.dy * p.width) / 2];
            b.quad([[x0, 0, y0], [x1, 0, y1], [x1, p.height, y1], [x0, p.height, y0]], [a.nx * side, 0, a.ny * side],
                [[0, 0], [p.width, 0], [p.width, p.height], [0, p.height]], MAT.door, i / 16);
        }
    });
}

export const build = (b: Builder) => addDoors(b);
